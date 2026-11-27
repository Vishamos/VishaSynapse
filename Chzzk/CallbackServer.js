const http = require('http');
const { Log, LogCode } = require('../VishaSynapse/VSLog');

// OAuth 콜백을 받는 로컬 HTTP 서버 (명세 01 §5.2)
// 쿼리(code·state)는 로그로 출력하지 않는다. 브라우저에는 결과 문구만 보여 준다.
const TEXT_SUCCESS = '연동 완료, 창을 닫아도 됩니다.';
const TEXT_FAILURE = '연동 실패. 서버 콘솔을 확인하세요.';

function Reply(res, status, text) {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(text);
}

// onCallback({ code, state, error }) → Promise<boolean>(성공 여부)
// host·port·path는 config의 RedirectUri·CallbackPort에서 온다.
function StartCallbackServer({ host, port, path, onCallback }) {
    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        if (req.method !== 'GET' || url.pathname !== path) {
            Reply(res, 404, 'Not Found');
            return;
        }
        let ok = false;
        try {
            ok = await onCallback({
                code: url.searchParams.get('code'),
                state: url.searchParams.get('state'),
                error: url.searchParams.get('error'),
            });
        } catch (err) {
            Log.Error(LogCode.CHZZK_CALLBACK_FAILED, `치지직 콜백 처리 오류: ${err.code || err.name}`);
        }
        Reply(res, ok ? 200 : 400, ok ? TEXT_SUCCESS : TEXT_FAILURE);
    });
    server.on('error', (err) => {
        Log.Error(LogCode.CHZZK_CALLBACK_FAILED, `치지직 콜백 서버 오류: ${err.code || err.name}`);
    });
    server.on('listening', () => {
        Log.Info(LogCode.CHZZK_CALLBACK_READY, `치지직 콜백 서버 대기: ${port}포트`);
    });
    server.listen(port, host);
    return {
        Close() {
            server.close();
        },
    };
}

module.exports = { StartCallbackServer };
