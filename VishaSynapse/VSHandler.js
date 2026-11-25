const WebSocket = require('ws');
const {
    Signature,
    SERVER_SIGNATURES,
    CLIENT_SIGNATURES,
    MessageType,
    ErrorCode,
    CloseCode,
    ClientStatus,
} = require('./VSServerCommand');
const { serverEvents, NextConnectionIndex, AddRegistered, GetTargets } = require('./VSServerData');

// 바이너리 헤더 [to, from] (명세 02 §6.4)
const BINARY_TO = 0;
const BINARY_FROM = 1;
const BINARY_HEADER_LENGTH = 2;

function ClientLabel(client) {
    return client.index === null ? '미등록 연결' : `${client.index}번 클라이언트(${client.signature})`;
}

function IsOpen(client) {
    return Boolean(client.socket) && client.socket.readyState === WebSocket.OPEN;
}

// 서버가 보내는 JSON에도 type을 붙인다 (§6.2c). 등록 전이면 to 키를 넣지 않는다 (§6.10a).
// from은 직접 관리 요소의 이벤트일 때만 그 요소의 시그니처로 준다 (§6.0)
function SendJson(client, type, data, from = Signature.SERVER) {
    if (!IsOpen(client)) return;
    const header = client.signature === null ? {} : { to: client.signature };
    client.socket.send(JSON.stringify({ ...header, from, type, data }));
}

// 직접 관리 요소의 이벤트를 목적지로 등록된 클라이언트 모두에게 보낸다. 없으면 버린다 (명세 01 §7)
function SendEvent(to, from, type, data) {
    for (const target of GetTargets(to)) SendJson(target, type, data, from);
}

function SendError(client, error) {
    SendJson(client, MessageType.ERROR, { code: error.code, message: error.message });
}

// 헤더 형식 검사 (§6.2, §6.2a, §6.2b). 키는 소문자만 읽으므로 대문자 키는 누락으로 본다.
function ParseJson(text) {
    let message;
    try {
        message = JSON.parse(text);
    } catch {
        return null;
    }
    if (message === null || typeof message !== 'object' || Array.isArray(message)) return null;
    if (!Number.isInteger(message.to) || !Number.isInteger(message.from)) return null;
    if (message.type !== undefined && typeof message.type !== 'string') return null;
    if (SERVER_SIGNATURES.has(message.to) && message.type === undefined) return null;
    return message;
}

function IsKnownSignature(value) {
    return SERVER_SIGNATURES.has(value) || CLIENT_SIGNATURES.has(value);
}

// 등록 (§5.5a~5.5d, §5.5f)
function Register(client, message) {
    if (client.status !== ClientStatus.CONNECTING) {
        console.log(`${ClientLabel(client)}: 이미 등록됨, 재등록 요청 무시`);
        return;
    }
    if (!CLIENT_SIGNATURES.has(message.from)) {
        SendError(client, ErrorCode.NOT_FOUND);
        return;
    }
    clearTimeout(client.registerTimer);
    client.registerTimer = null;
    client.signature = message.from;
    client.index = NextConnectionIndex();
    client.status = ClientStatus.CONNECTED;
    AddRegistered(client);
    SendJson(client, MessageType.CLIENT_REGISTERED, { index: client.index });
    console.log(`${ClientLabel(client)} 등록됨`);
    serverEvents.emit('registered', client);
}

function HandleText(client, data) {
    const text = data.toString('utf8');
    const message = ParseJson(text);
    if (!message) {
        SendError(client, ErrorCode.BAD_REQUEST);
        return;
    }
    if (message.to === Signature.SERVER && message.type === MessageType.CLIENT_REGISTER) {
        Register(client, message);
        return;
    }
    if (client.status === ClientStatus.CONNECTING) {
        SendError(client, ErrorCode.NOT_REGISTERED);
        return;
    }
    if (!IsKnownSignature(message.to)) {
        SendError(client, ErrorCode.NOT_FOUND);
        return;
    }
    // 서버 시그니처: 모르는 type, 보류 요소(111·121), 받을 명령이 없는 치지직(101)은 501 (§6.12, §7.0, §7.1.6)
    if (SERVER_SIGNATURES.has(message.to)) {
        SendError(client, ErrorCode.NOT_IMPLEMENTED);
        return;
    }
    // 중계하는 JSON의 from이 등록 시그니처와 다르면 전달하지 않는다 (§6.4c)
    if (message.from !== client.signature) {
        SendError(client, ErrorCode.BAD_REQUEST);
        return;
    }
    // 헤더만 확인하고 받은 그대로 전달한다 (§6.7). 받을 대상이 없으면 404 (§6.12d).
    let sent = 0;
    for (const target of GetTargets(message.to)) {
        if (!IsOpen(target)) continue;
        target.socket.send(text);
        sent += 1;
    }
    if (sent === 0) SendError(client, ErrorCode.NOT_FOUND);
}

// 바이너리의 문제와 받을 대상 없음에는 에러를 보내지 않는다 (§6.12b)
function HandleBinary(client, data) {
    if (client.status === ClientStatus.CONNECTING) return;
    if (data.length < BINARY_HEADER_LENGTH) return;
    const to = data.readUInt8(BINARY_TO);
    // 서버가 도착지인 바이너리는 무시한다 (§6.8a, §7.0.2)
    if (SERVER_SIGNATURES.has(to)) return;
    // 메시지는 변형하지 않는다. from이 등록 시그니처와 다르면 로그 없이 연결을 끊는다 (§6.4a)
    if (data.readUInt8(BINARY_FROM) !== client.signature) {
        client.socket.close(CloseCode.FROM_MISMATCH.code, CloseCode.FROM_MISMATCH.reason);
        return;
    }
    for (const target of GetTargets(to)) {
        if (IsOpen(target)) target.socket.send(data, { binary: true });
    }
}

function HandleMessage(client, data, isBinary) {
    if (!IsOpen(client)) return;
    if (isBinary) {
        HandleBinary(client, data);
    } else {
        HandleText(client, data);
    }
}

module.exports = { HandleMessage, ClientLabel, SendJson, SendEvent };
