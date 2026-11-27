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
const { Log, LogCode } = require('./VSLog');
const Data = require('../Data');

const MINUTE_MS = 60 * 1000;
const MAX_TIMER_MS = 2147483647; // setTimeout 최대값(약 24.8일). 넘으면 바로 실행되므로 이 값으로 줄인다

const ERROR_LOG_INTERVAL_MS = 10 * 1000; // 같은 클라이언트·같은 코드의 CLIENT_ERROR_SENT 간격 (명세 02 §6.13.8)

// 바이너리 헤더 [to, from] (명세 02 §6.4)
const BINARY_TO = 0;
const BINARY_FROM = 1;
const BINARY_HEADER_LENGTH = 2;

// server.shutdown·41 등록을 받는 접속 주소: 같은 PC (§2.6b, §5.9.1)
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function IsLoopback(client) {
    return LOOPBACK_ADDRESSES.has(client.remoteAddress);
}

// 컨트롤러 부재 시 자동 종료 타이머 (§5.9.4∼5.9.7)
let controllerTimer = null;

function CancelControllerTimer() {
    clearTimeout(controllerTimer);
    controllerTimer = null;
}

// 등록된 41이 끊겼을 때 VSServer가 부른다. 0이면 자동 종료하지 않는다.
// 설정 값은 이때 읽으므로 config.set의 새 값은 다음 끊김부터 적용된다 (§5.9.10)
function OnControllerLost() {
    const minutes = Data.controllerShutdownMinutes();
    if (minutes === 0) return;
    CancelControllerTimer();
    Log.Warn(LogCode.SERVER_CONTROLLER_LOST, `컨트롤러(41) 연결 끊김. ${minutes}분 안에 다시 등록하지 않으면 서버를 종료합니다.`);
    controllerTimer = setTimeout(() => {
        controllerTimer = null;
        Log.Info(LogCode.SERVER_AUTO_SHUTDOWN, '컨트롤러 부재로 자동 종료');
        serverEvents.emit('shutdown');
    }, Math.min(minutes * MINUTE_MS, MAX_TIMER_MS));
}

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

// 10초 안에 다시 나온 같은 코드는 세기만 하고, 다음 로그 message에 그 건수를 붙인다 (§6.13.8)
function LogErrorSent(client, error) {
    const now = Date.now();
    const last = client.errorLogs.get(error.code);
    if (last && now - last.at < ERROR_LOG_INTERVAL_MS) {
        last.skipped += 1;
        return;
    }
    const more = last && last.skipped > 0 ? ` (앞 로그 뒤 ${last.skipped}건 더)` : '';
    client.errorLogs.set(error.code, { at: now, skipped: 0 });
    Log.Warn(LogCode.CLIENT_ERROR_SENT, `${ClientLabel(client)}에게 error ${error.code} ${error.message} 보냄${more}`);
}

function SendError(client, error) {
    if (!IsOpen(client)) return;
    SendJson(client, MessageType.ERROR, { code: error.code, message: error.message });
    LogErrorSent(client, error);
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
        Log.Warn(LogCode.CLIENT_REREGISTER_IGNORED, `${ClientLabel(client)}: 이미 등록됨, 재등록 요청 무시`);
        return;
    }
    if (!CLIENT_SIGNATURES.has(message.from)) {
        SendError(client, ErrorCode.NOT_FOUND);
        return;
    }
    // 41은 같은 PC의 연결 하나만. 다른 PC 403, 이미 있으면 409. 등록하지 않고 연결은 유지한다 (§5.9.1∼5.9.3)
    if (message.from === Signature.CONTROLLER) {
        if (!IsLoopback(client)) {
            SendError(client, ErrorCode.FORBIDDEN);
            return;
        }
        if (GetTargets(Signature.CONTROLLER).size > 0) {
            SendError(client, ErrorCode.CONFLICT);
            return;
        }
    }
    clearTimeout(client.registerTimer);
    client.registerTimer = null;
    client.signature = message.from;
    client.index = NextConnectionIndex();
    client.status = ClientStatus.CONNECTED;
    AddRegistered(client);
    if (client.signature === Signature.CONTROLLER) CancelControllerTimer();
    SendJson(client, MessageType.CLIENT_REGISTERED, { index: client.index });
    Log.Info(LogCode.CLIENT_REGISTERED, `${ClientLabel(client)} 등록됨`);
    serverEvents.emit('registered', client);
}

// 41 전용 명령은 같은 PC에서 접속해 41로 등록한 연결만 받는다. 아니면 403, 연결은 유지 (§2.6b, §2.6c, §5.9.8)
function IsController(client, message) {
    return client.signature === Signature.CONTROLLER
        && message.from === Signature.CONTROLLER
        && IsLoopback(client);
}

function RequestShutdown(client, message) {
    if (!IsController(client, message)) {
        SendError(client, ErrorCode.FORBIDDEN);
        return;
    }
    serverEvents.emit('shutdown');
}

// config.get 답: 다루는 항목만 넣는다 (§5.9.8, §5.9.9)
function SendConfig(client) {
    SendJson(client, MessageType.CONFIG_GET, { ControllerShutdownMinutes: Data.controllerShutdownMinutes() });
}

function GetConfig(client, message) {
    if (!IsController(client, message)) {
        SendError(client, ErrorCode.FORBIDDEN);
        return;
    }
    SendConfig(client);
}

// 다루는 항목만 검사해 적용·저장한다. 다른 키는 무시, 잘못된 값은 400이고 그 항목은 바꾸지 않는다.
// 400을 보낸 뒤에도 현재 값을 답한다 (§5.9.8∼5.9.10)
function SetConfig(client, message) {
    if (!IsController(client, message)) {
        SendError(client, ErrorCode.FORBIDDEN);
        return;
    }
    const data = message.data;
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        SendError(client, ErrorCode.BAD_REQUEST);
    } else if (Object.hasOwn(data, 'ControllerShutdownMinutes')) {
        const value = data.ControllerShutdownMinutes;
        if (Data.isValidControllerShutdownMinutes(value)) {
            Data.current.ControllerShutdownMinutes = value;
            Data.saveData(Data.current); // 실패는 saveData가 CONFIG_SAVE_FAILED로 남긴다
        } else {
            SendError(client, ErrorCode.BAD_REQUEST);
        }
    }
    SendConfig(client);
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
    if (message.to === Signature.SERVER && message.type === MessageType.SERVER_SHUTDOWN) {
        RequestShutdown(client, message);
        return;
    }
    if (message.to === Signature.SERVER && message.type === MessageType.CONFIG_GET) {
        GetConfig(client, message);
        return;
    }
    if (message.to === Signature.SERVER && message.type === MessageType.CONFIG_SET) {
        SetConfig(client, message);
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

module.exports = { HandleMessage, ClientLabel, SendJson, SendEvent, OnControllerLost, CancelControllerTimer };
