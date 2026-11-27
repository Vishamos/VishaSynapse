const WebSocket = require('ws');
const { Signature, MessageType } = require('./VSServerCommand');
const { GetTargets } = require('./VSServerData');

// 서버 로그: 콘솔에 쓰고 컨트롤러(41) 모두에게도 보낸다 (명세 02 §6.13)
// 비밀 값은 넣지 않는다. 콘솔에만 보여야 하는 문장은 consoleText로 따로 준다 (§6.13.4)
const LogCode = Object.freeze(Object.fromEntries([
    'SERVER_STARTING',
    'SERVER_STARTED',
    'SERVER_START_FAILED',
    'SERVER_SHUTDOWN',
    'CONFIG_SAVE_FAILED',
    'CLIENT_CONNECTED',
    'CLIENT_REGISTERED',
    'CLIENT_REREGISTER_IGNORED',
    'CLIENT_REGISTER_TIMEOUT',
    'CLIENT_DELAY',
    'CLIENT_DELAY_RESOLVED',
    'CLIENT_PING_TIMEOUT',
    'CLIENT_DISCONNECTED',
    'CLIENT_MESSAGE_ERROR',
    'CLIENT_SOCKET_ERROR',
    'CLIENT_ERROR_SENT',
    'DB_CONNECTED',
    'DB_CONNECT_FAILED',
    'CHZZK_STATUS',
    'CHZZK_CHAT_COUNT',
    'CHZZK_AUTH_REQUIRED',
    'CHZZK_AUTH_FAILED',
    'CHZZK_CALLBACK_READY',
    'CHZZK_CALLBACK_FAILED',
    'CHZZK_CALLBACK_REJECTED',
    'CHZZK_TOKEN_REFRESH_FAILED',
    'CHZZK_TOKEN_SAVE_FAILED',
    'CHZZK_TOKEN_DELETE_FAILED',
    'CHZZK_TOKEN_INVALID',
    'CHZZK_SESSION_RETRY',
    'CHZZK_REVOKED',
    'CHZZK_CHAT_INVALID',
].map((code) => [code, code])));

const LogLevel = Object.freeze({ ERROR: 'error', WARN: 'warn', INFO: 'info' });

const BUFFER_LIMIT = 100; // §6.13.5

// 41이 하나도 등록되지 않은 동안의 로그 (보낼 JSON 문자열)
const buffer = [];

// 전송 실패는 콘솔에만 쓰고 41로 다시 보내지 않는다 (§6.13.6)
function SendTo(client, text) {
    const socket = client.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(text, (err) => {
        if (err) console.error(`로그 전송 실패: ${err.code || err.name}`);
    });
}

function Write(level, code, message, consoleText = message) {
    if (level === LogLevel.ERROR) console.error(consoleText);
    else if (level === LogLevel.WARN) console.warn(consoleText);
    else console.log(consoleText);

    const text = JSON.stringify({
        to: Signature.CONTROLLER,
        from: Signature.SERVER,
        type: MessageType.LOG,
        data: { level, code, message, time: Date.now() },
    });
    const targets = [...GetTargets(Signature.CONTROLLER)];
    if (targets.length === 0) {
        buffer.push(text);
        if (buffer.length > BUFFER_LIMIT) buffer.shift();
        return;
    }
    // 쌓인 로그는 41이 등록된 뒤 처음 남는 로그(등록 직후의 CLIENT_REGISTERED)에서 그 41에게 오래된 것부터 보낸다 (§6.13.5)
    for (const queued of buffer.splice(0)) {
        for (const target of targets) SendTo(target, queued);
    }
    for (const target of targets) SendTo(target, text);
}

const Log = Object.freeze({
    Error: (code, message, consoleText) => Write(LogLevel.ERROR, code, message, consoleText),
    Warn: (code, message, consoleText) => Write(LogLevel.WARN, code, message, consoleText),
    Info: (code, message, consoleText) => Write(LogLevel.INFO, code, message, consoleText),
});

module.exports = { Log, LogCode };
