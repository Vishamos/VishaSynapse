const crypto = require('crypto');
const ChzzkApi = require('./ChzzkApi');
const { StartCallbackServer } = require('./CallbackServer');
const { ChzzkState } = require('./ChzzkStatus');

// 치지직 OAuth: 인증 URL·state, code → 토큰, 토큰 저장·로드·갱신 (명세 01 §5.2, §5.3)
// 토큰·Client Secret·code는 로그와 에러 메시지에 넣지 않는다 (§3.4).
const TOKEN_NAME = 'chzzk_token';
const TOKEN_PATH = '/auth/v1/token';
const INTERLOCK_URL = 'https://chzzk.naver.com/account-interlock';
const STATE_TTL_MS = 10 * 60 * 1000;          // §5.2-1
const REFRESH_BEFORE_MS = 60 * 60 * 1000;      // §5.3 만료 1시간 전
const REFRESH_RETRY_MS = 60 * 1000;            // 예약 갱신이 일시 실패했을 때 다시 시도할 간격
const MAX_TIMER_MS = 2147483647;               // setTimeout 최대값
const SAVE_ATTEMPTS = 3;                       // §5.3 저장 3회 재시도

function codeError(code, extra = {}) {
    const err = new Error(code);
    err.code = code;
    return Object.assign(err, extra);
}

// 로그용: 에러 코드, HTTP 상태, 코드형 API 메시지만
function Describe(err) {
    const detail = [err.status ? `HTTP ${err.status}` : null, err.apiMessage || null, err.cause || null]
        .filter(Boolean).join(', ');
    return `${err.code || err.name}${detail ? ` (${detail})` : ''}`;
}

// 토큰 응답 → 저장 형식 { accessToken, refreshToken, expiresAt }. expiresIn은 초 단위 문자열 (§5.3)
function ToToken(content, now = Date.now()) {
    const expiresIn = Number(content && content.expiresIn);
    if (!content || typeof content.accessToken !== 'string' || typeof content.refreshToken !== 'string'
        || !Number.isFinite(expiresIn) || expiresIn <= 0) {
        throw codeError('CHZZK_UNEXPECTED_RESPONSE');
    }
    return { accessToken: content.accessToken, refreshToken: content.refreshToken, expiresAt: now + expiresIn * 1000 };
}

function IsValidToken(token) {
    return Boolean(token) && typeof token.accessToken === 'string' && typeof token.refreshToken === 'string'
        && Number.isFinite(token.expiresAt);
}

function CreateAuth({
    clientId,
    clientSecret,
    redirectUri,
    callbackPort,
    secretStore,
    setState,
    onAuthorized,
    onAuthRequired,
    api = ChzzkApi,
    startCallbackServer = StartCallbackServer,
    saveRetryDelayMs = 1000,
}) {
    let token = null;
    let refreshPromise = null;
    let refreshTimer = null;
    let pendingState = null;           // { value, expiresAt }
    let callbackServer = null;

    function ScheduleRefresh(delayMs) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
        if (!token) return;
        const delay = delayMs !== undefined ? delayMs : token.expiresAt - REFRESH_BEFORE_MS - Date.now();
        refreshTimer = setTimeout(OnRefreshTimer, Math.min(Math.max(delay, 0), MAX_TIMER_MS));
    }

    async function OnRefreshTimer() {
        refreshTimer = null;
        try {
            await Refresh();
        } catch (err) {
            console.error(`치지직 토큰 갱신 실패: ${Describe(err)}`);
            if (err.authRequired) {
                onAuthRequired();
                return;
            }
            ScheduleRefresh(REFRESH_RETRY_MS);
        }
    }

    // 새 토큰을 DB에 먼저 저장한다. 3회 모두 실패하면 새 Refresh Token을 잃으므로 재연동이 필요하다 (§5.3)
    async function SaveToken(next) {
        const value = JSON.stringify(next);
        for (let attempt = 1; attempt <= SAVE_ATTEMPTS; attempt += 1) {
            try {
                await secretStore.set(TOKEN_NAME, value);
                return;
            } catch (err) {
                console.error(`치지직 토큰 저장 실패 (${attempt}/${SAVE_ATTEMPTS}): ${err.code || err.name}`);
                if (attempt < SAVE_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, saveRetryDelayMs));
            }
        }
        throw codeError('CHZZK_TOKEN_SAVE_FAILED', { authRequired: true });
    }

    // 저장이 끝난 뒤에만 새 토큰을 쓴다. 저장 실패 시 이전 Refresh Token은 이미 썼으므로 버린다.
    async function UseNewToken(content) {
        const next = ToToken(content);
        try {
            await SaveToken(next);
        } catch (err) {
            token = null;
            ScheduleRefresh();
            throw err;
        }
        token = next;
        ScheduleRefresh();
        return next.accessToken;
    }

    // 저장된 토큰을 읽어 둔다. 있으면 true. 형식이 깨진 값은 없는 것으로 본다(새로 연동하면 덮어쓴다).
    async function LoadToken() {
        const raw = await secretStore.get(TOKEN_NAME);
        let parsed = null;
        if (raw) {
            try {
                parsed = JSON.parse(raw);
            } catch {
                parsed = null;
            }
        }
        if (!IsValidToken(parsed)) {
            if (raw) console.error('치지직 토큰 형식 오류: CHZZK_TOKEN_INVALID');
            return false;
        }
        token = { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken, expiresAt: parsed.expiresAt };
        ScheduleRefresh();
        return true;
    }

    // 갱신은 동시에 하나만. 진행 중이면 같은 Promise를 돌려준다 (§5.3)
    function Refresh() {
        if (refreshPromise) return refreshPromise;
        refreshPromise = (async () => {
            if (!token) throw codeError('CHZZK_TOKEN_MISSING', { authRequired: true });
            let content;
            try {
                content = await api.request('POST', TOKEN_PATH, {
                    body: { grantType: 'refresh_token', refreshToken: token.refreshToken, clientId, clientSecret },
                });
            } catch (err) {
                // 4xx: Refresh Token 만료·무효. 토큰을 지우고 재연동한다 (§5.3). 그 밖(네트워크·5xx)은 일시 실패
                if (err.status >= 400 && err.status < 500) {
                    await ClearToken();
                    err.authRequired = true;
                }
                throw err;
            }
            return UseNewToken(content);
        })().finally(() => {
            refreshPromise = null;
        });
        return refreshPromise;
    }

    // 만료 1시간 전이면 갱신한 뒤 돌려준다
    async function GetAccessToken() {
        if (!token) throw codeError('CHZZK_TOKEN_MISSING', { authRequired: true });
        if (Date.now() >= token.expiresAt - REFRESH_BEFORE_MS) return Refresh();
        return token.accessToken;
    }

    // 권한 철회·Refresh Token 만료 시 (§5.3, §5.4-7). DB 삭제 실패는 코드만 남긴다.
    async function ClearToken() {
        token = null;
        ScheduleRefresh();
        try {
            await secretStore.remove(TOKEN_NAME);
        } catch (err) {
            console.error(`치지직 토큰 삭제 실패: ${err.code || err.name}`);
        }
    }

    function NewState() {
        pendingState = { value: crypto.randomBytes(16).toString('hex'), expiresAt: Date.now() + STATE_TTL_MS };
        const query = new URLSearchParams({ clientId, redirectUri, state: pendingState.value });
        // URL에는 clientId·redirectUri·state만 들어 있어 출력해도 된다 (§5.2-2)
        console.log(`치지직 연동 필요. 이 PC의 브라우저에서 여세요: ${INTERLOCK_URL}?${query}`);
    }

    function OpenCallbackServer() {
        if (callbackServer) return;
        const { hostname, pathname } = new URL(redirectUri);
        try {
            callbackServer = startCallbackServer({ host: hostname, port: callbackPort, path: pathname, onCallback: HandleCallback });
        } catch (err) {
            console.error(`치지직 콜백 서버 시작 실패: ${err.code || err.name}`);
        }
    }

    function CloseCallbackServer() {
        if (!callbackServer) return;
        callbackServer.Close();
        callbackServer = null;
    }

    // 상태 auth_required, 콜백 서버 대기, 인증 URL 출력 (§5.2). 유효한 state가 있으면 다시 출력하지 않는다.
    function StartAuthFlow() {
        setState(ChzzkState.AUTH_REQUIRED);
        OpenCallbackServer();
        if (pendingState && Date.now() < pendingState.expiresAt) return;
        NewState();
    }

    // 콜백: state 검증 → code → 토큰 → 저장 → 세션 시작 (§5.2-3∼6)
    async function HandleCallback({ code, state, error }) {
        if (!pendingState || typeof state !== 'string' || state !== pendingState.value) {
            console.error('치지직 콜백 거부: CHZZK_STATE_MISMATCH');
            return false;
        }
        if (Date.now() >= pendingState.expiresAt) {
            console.error('치지직 콜백 거부: CHZZK_STATE_EXPIRED');
            NewState();
            return false;
        }
        pendingState = null;   // 한 번만 쓴다
        try {
            if (error || typeof code !== 'string' || code.length === 0) throw codeError('CHZZK_AUTH_DENIED');
            const content = await api.request('POST', TOKEN_PATH, {
                body: { grantType: 'authorization_code', clientId, clientSecret, code, state },
            });
            await UseNewToken(content);
        } catch (err) {
            console.error(`치지직 연동 실패: ${Describe(err)}`);
            NewState();
            return false;
        }
        CloseCallbackServer();
        onAuthorized();
        return true;
    }

    function Stop() {
        clearTimeout(refreshTimer);
        refreshTimer = null;
        CloseCallbackServer();
    }

    return { LoadToken, GetAccessToken, Refresh, ClearToken, StartAuthFlow, HandleCallback, Stop };
}

module.exports = { CreateAuth, ToToken, Describe };
