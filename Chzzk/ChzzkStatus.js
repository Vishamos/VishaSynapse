const { Signature, MessageType } = require('../VishaSynapse/VSServerCommand');
const { serverEvents } = require('../VishaSynapse/VSServerData');
const { SendJson, SendEvent } = require('../VishaSynapse/VSHandler');
const { Log, LogCode } = require('../VishaSynapse/VSLog');

// 치지직 연동 상태 (명세 01 §5.5)
const ChzzkState = Object.freeze({
    DISABLED: 'disabled',
    AUTH_REQUIRED: 'auth_required',
    DISCONNECTED: 'disconnected',
    CONNECTED: 'connected',
});

const CHAT_LOG_INTERVAL_MS = 60 * 1000;

let state = ChzzkState.DISABLED;
let chatCount = 0;
let chatLogTimer = null;

function GetState() {
    return state;
}

// 같은 값이면 보내지 않는다. 바뀌면 로그 한 줄과 41 전체에 chzzk.status (§5.5, §7)
function SetState(next) {
    if (next === state) return;
    state = next;
    Log.Info(LogCode.CHZZK_STATUS, `치지직 상태: ${state}`);
    SendEvent(Signature.CONTROLLER, Signature.CHZZK, MessageType.CHZZK_STATUS, { state });
}

// 정규화된 채팅을 41 전체에 보낸다. 41이 없으면 버린다 (§7). 내용·닉네임은 로그로 남기지 않는다.
function ForwardChat(data) {
    chatCount += 1;
    SendEvent(Signature.CONTROLLER, Signature.CHZZK, MessageType.CHZZK_CHAT, data);
}

function LogChatCount() {
    if (chatCount === 0) return;
    Log.Info(LogCode.CHZZK_CHAT_COUNT, `치지직 채팅 수신: ${chatCount}건 (1분)`);
    chatCount = 0;
}

// 41이 등록된 직후(client.registered 다음) 그 클라이언트에게 지금 상태를 한 번 보낸다 (§5.5)
function OnRegistered(client) {
    if (client.signature !== Signature.CONTROLLER) return;
    SendJson(client, MessageType.CHZZK_STATUS, { state }, Signature.CHZZK);
}

// 진입점에서 중계 서버 시작 전에 한 번 호출한다
function Init() {
    if (chatLogTimer) return;
    serverEvents.on('registered', OnRegistered);
    chatLogTimer = setInterval(LogChatCount, CHAT_LOG_INTERVAL_MS);
    chatLogTimer.unref();
}

module.exports = { ChzzkState, Init, GetState, SetState, ForwardChat };
