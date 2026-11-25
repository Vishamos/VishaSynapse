const https = require('https');

// 치지직 공식 Open API 요청 공통부
// 요청 헤더(인증 정보)와 응답 본문은 로그로 출력하지 않는다.
const API_HOST = 'openapi.chzzk.naver.com';
const TIMEOUT_MS = 10000;
const SAFE_API_MESSAGE = /^[A-Z_]{1,64}$/;   // 예: INVALID_CLIENT. 그 외 형식은 에러에 담지 않는다.

function apiError(code, extra = {}) {
    const err = new Error(code);
    err.code = code;
    return Object.assign(err, extra);
}

// 성공 응답 { code: 200, message: null, content } 에서 content만 돌려준다.
// 실패 시 status(HTTP 상태), apiMessage(INVALID_CLIENT 같은 코드형 메시지)만 담은 Error로 reject한다.
function request(method, path, { headers = {}, body } = {}) {
    return new Promise((resolve, reject) => {
        const payload = body === undefined ? null : JSON.stringify(body);
        const reqHeaders = { 'Content-Type': 'application/json', ...headers };
        if (payload) reqHeaders['Content-Length'] = Buffer.byteLength(payload);

        const req = https.request({ hostname: API_HOST, path, method, headers: reqHeaders }, (res) => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                let json = null;
                try {
                    json = JSON.parse(data);
                } catch {
                    // 아래에서 실패로 처리
                }
                if (res.statusCode === 200 && json && json.code === 200) {
                    resolve(json.content);
                    return;
                }
                const apiMessage = json && typeof json.message === 'string' && SAFE_API_MESSAGE.test(json.message)
                    ? json.message
                    : undefined;
                reject(apiError('CHZZK_API_ERROR', { status: res.statusCode, apiMessage }));
            });
        });
        req.setTimeout(TIMEOUT_MS, () => req.destroy(apiError('CHZZK_TIMEOUT')));
        req.on('error', (err) => {
            reject(err.code === 'CHZZK_TIMEOUT' ? err : apiError('CHZZK_REQUEST_FAILED', { cause: err.code }));
        });
        if (payload) req.write(payload);
        req.end();
    });
}

// 클라이언트 인증 헤더 (앱 자체 인증, 사용자 로그인 불필요)
function clientHeaders(clientId, clientSecret) {
    return { 'Client-Id': clientId, 'Client-Secret': clientSecret };
}

// 유저 인증 헤더 (OAuth Access Token)
function userHeaders(accessToken) {
    return { Authorization: `Bearer ${accessToken}` };
}

module.exports = { request, clientHeaders, userHeaders };
