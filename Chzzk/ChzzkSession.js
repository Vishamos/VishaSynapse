const SocketIo = require('socket.io-client');
const ChzzkApi = require('./ChzzkApi');
const { Describe } = require('./ChzzkAuth');
const { ChzzkState } = require('./ChzzkStatus');

// 치지직 세션: 세션 URL 발급, 소켓 접속, 채팅 구독, 재연결 (명세 01 §5.4)
// 세션 URL·sessionKey·이벤트 원본은 로그로 남기지 않는다 (§3.4, §7).
const SESSION_AUTH_PATH = '/open/v1/sessions/auth';
const SUBSCRIBE_CHAT_PATH = '/open/v1/sessions/events/subscribe/chat';
const CONNECT_TIMEOUT_MS = 3000;               // §5.4-2 접속 제한 3초
const SETUP_TIMEOUT_MS = 10 * 1000;            // 접속 후 구독 완료(subscribed)까지 기다리는 시간
const RETRY_BASE_MS = 1000;                    // §5.4-8 1초부터 두 배, 최대 60초
const RETRY_MAX_MS = 60 * 1000;

function codeError(code) {
    const err = new Error(code);
    err.code = code;
    return err;
}

// 재시도 대기 시간 (attempt: 0부터 센 연속 실패 횟수)
function RetryDelay(attempt) {
    return Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS);
}

// 구독 요청. sessionKey 위치가 문서에 명시되지 않아 쿼리 문자열로 보낸다 (§5.4-4). 바꿀 때는 여기만 고친다.
function SubscribeChatRequest(sessionKey) {
    return { path: `${SUBSCRIBE_CHAT_PATH}?sessionKey=${encodeURIComponent(sessionKey)}`, body: undefined };
}

// 이벤트 본문이 JSON 문자열로 한 번 더 감싸져 올 수 있다 (§5.4). 객체가 아니면 null
function ParseEvent(raw) {
    let value = raw;
    if (typeof value === 'string') {
        try {
            value = JSON.parse(value);
        } catch {
            return null;
        }
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    return value;
}

// CHAT 이벤트 → 컨트롤러용 data (§7 표). content가 문자열이 아니면 null(버림)
function NormalizeChat(raw, now = Date.now()) {
    const event = ParseEvent(raw);
    if (!event || typeof event.content !== 'string') return null;
    const profile = event.profile !== null && typeof event.profile === 'object' ? event.profile : {};
    const emojis = event.emojis !== null && typeof event.emojis === 'object' && !Array.isArray(event.emojis)
        ? event.emojis
        : {};
    return {
        nickname: typeof profile.nickname === 'string' ? profile.nickname : '',
        role: typeof event.userRoleCode === 'string' ? event.userRoleCode : '',
        content: event.content,
        emojis,
        time: Number.isInteger(event.messageTime) ? event.messageTime : now,
    };
}

function CreateSession({
    auth,
    setState,
    onChat,
    onAuthRequired,
    api = ChzzkApi,
    io = SocketIo,
    setupTimeoutMs = SETUP_TIMEOUT_MS,
}) {
    let runId = 0;              // Start·Stop마다 바뀐다. 이전 실행의 비동기 결과를 무시하는 데 쓴다
    let running = false;
    let socket = null;
    let setupTimer = null;
    let retryTimer = null;
    let attempt = 0;

    // 유저 세션은 최대 3개이므로 재접속 전에 이전 소켓을 반드시 닫는다 (§5.4-4)
    function CloseSocket() {
        clearTimeout(setupTimer);
        setupTimer = null;
        if (!socket) return;
        const old = socket;
        socket = null;          // 닫으며 나오는 disconnect 이벤트는 무시된다
        old.close();
    }

    function Fail(err) {
        CloseSocket();
        if (!running || retryTimer) return;
        if (err.authRequired) {
            onAuthRequired();
            return;
        }
        const delay = RetryDelay(attempt);
        attempt += 1;
        console.error(`치지직 세션 실패: ${Describe(err)}. ${delay / 1000}초 뒤 재시도`);
        setState(ChzzkState.DISCONNECTED);
        retryTimer = setTimeout(() => {
            retryTimer = null;
            Connect();
        }, delay);
    }

    async function RequestSessionUrl(accessToken) {
        const content = await api.request('GET', SESSION_AUTH_PATH, { headers: api.userHeaders(accessToken) });
        if (!content || typeof content.url !== 'string') throw codeError('CHZZK_UNEXPECTED_RESPONSE');
        return content.url;
    }

    // 401이면 갱신을 한 번 하고 다시 시도한다 (§5.4-8). 갱신 실패(authRequired)는 그대로 올린다.
    async function FetchSessionUrl() {
        try {
            return await RequestSessionUrl(await auth.GetAccessToken());
        } catch (err) {
            if (err.status !== 401) throw err;
            return RequestSessionUrl(await auth.Refresh());
        }
    }

    async function Subscribe(current, sessionKey) {
        try {
            const { path, body } = SubscribeChatRequest(sessionKey);
            await api.request('POST', path, { headers: api.userHeaders(await auth.GetAccessToken()), body });
        } catch (err) {
            if (current === socket) Fail(err);
        }
    }

    function OnSystem(current, raw) {
        const message = ParseEvent(raw);
        if (!message) return;
        const data = message.data !== null && typeof message.data === 'object' ? message.data : {};
        if (message.type === 'connected') {
            if (typeof data.sessionKey !== 'string') {
                Fail(codeError('CHZZK_SESSION_KEY_MISSING'));
                return;
            }
            Subscribe(current, data.sessionKey);
        } else if (message.type === 'subscribed') {
            clearTimeout(setupTimer);
            setupTimer = null;
            attempt = 0;
            setState(ChzzkState.CONNECTED);
        } else if (message.type === 'revoked') {
            // 권한 철회: 토큰을 지우고 재연동 (§5.4-7)
            console.error('치지직 권한 철회: CHZZK_REVOKED');
            Stop();
            auth.ClearToken();
            onAuthRequired();
        }
    }

    function OnChat(raw) {
        const data = NormalizeChat(raw);
        if (!data) {
            console.error('치지직 채팅 형식 오류: CHZZK_CHAT_INVALID');
            return;
        }
        onChat(data);
    }

    function OpenSocket(url) {
        const current = io(url, {
            transports: ['websocket'],
            reconnection: false,
            forceNew: true,
            timeout: CONNECT_TIMEOUT_MS,
        });
        socket = current;
        setupTimer = setTimeout(() => Fail(codeError('CHZZK_SUBSCRIBE_TIMEOUT')), setupTimeoutMs);
        // 이전 소켓에서 늦게 온 이벤트는 무시한다
        const on = (event, handler) => current.on(event, (arg) => {
            if (current === socket) handler(arg);
        });
        on('connect_error', () => Fail(codeError('CHZZK_SOCKET_CONNECT_FAILED')));
        on('connect_timeout', () => Fail(codeError('CHZZK_SOCKET_CONNECT_TIMEOUT')));
        on('disconnect', () => Fail(codeError('CHZZK_SOCKET_DISCONNECTED')));
        on('SYSTEM', (raw) => OnSystem(current, raw));
        on('CHAT', OnChat);
    }

    // 세션 URL을 매번 새로 발급받아 접속한다 (§5.4-1∼5, 8)
    async function Connect() {
        const id = runId;
        CloseSocket();
        setState(ChzzkState.DISCONNECTED);
        let url;
        try {
            url = await FetchSessionUrl();
        } catch (err) {
            if (id === runId) Fail(err);
            return;
        }
        if (id === runId) OpenSocket(url);
    }

    function Start() {
        Stop();
        runId += 1;
        running = true;
        attempt = 0;
        Connect();
    }

    function Stop() {
        runId += 1;
        running = false;
        clearTimeout(retryTimer);
        retryTimer = null;
        CloseSocket();
    }

    return { Start, Stop };
}

module.exports = { CreateSession, RetryDelay, NormalizeChat, ParseEvent, SubscribeChatRequest };
