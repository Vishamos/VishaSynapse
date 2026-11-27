// 기기 시그니처 (명세 02 §4). 클라이언트는 1~99, 서버가 직접 관리하는 요소는 100 이상.
const Signature = Object.freeze({
    SERVER: 0,
    VISHAMOS: 11,
    FACE_ANDROID: 21,
    FACE_IOS: 22,
    BODY: 31,
    CONTROLLER: 41,
    CHZZK: 101,
    DISCORD: 111,
    OBS: 121,
});

// 서버가 처리하는 시그니처 (§4.2)
const SERVER_SIGNATURES = new Set([Signature.SERVER, Signature.CHZZK, Signature.DISCORD, Signature.OBS]);

// 등록할 수 있는 클라이언트 시그니처 (§4.0, §4.2): 표에 있는 값 중 서버 시그니처를 뺀 것
const CLIENT_SIGNATURES = new Set(Object.values(Signature).filter((value) => !SERVER_SIGNATURES.has(value)));

// 서버가 주고받는 JSON type (§6.10)
const MessageType = Object.freeze({
    CLIENT_REGISTER: 'client.register',
    CLIENT_REGISTERED: 'client.registered',
    ERROR: 'error',
    // 컨트롤러(41) → 서버 정상 종료 (§2.6b)
    SERVER_SHUTDOWN: 'server.shutdown',
    // 서버 → 컨트롤러(41) 서버 로그 (§6.13)
    LOG: 'log',
    // 치지직 → 컨트롤러(41) (명세 01 §7)
    CHZZK_CHAT: 'chzzk.chat',
    CHZZK_STATUS: 'chzzk.status',
});

// 에러 메시지 (§6.12). 연결은 유지한다.
const ErrorCode = Object.freeze({
    BAD_REQUEST: Object.freeze({ code: 400, message: 'bad_request' }),
    NOT_REGISTERED: Object.freeze({ code: 401, message: 'not_registered' }),
    FORBIDDEN: Object.freeze({ code: 403, message: 'forbidden' }),
    NOT_FOUND: Object.freeze({ code: 404, message: 'not_found' }),
    CONFLICT: Object.freeze({ code: 409, message: 'conflict' }),
    NOT_IMPLEMENTED: Object.freeze({ code: 501, message: 'not_implemented' }),
});

// 연결 종료 (§6.12a). 1009는 ws의 maxPayload가 자동으로 처리한다.
const CloseCode = Object.freeze({
    REGISTER_TIMEOUT: Object.freeze({ code: 1008, reason: 'register_timeout' }),
    FROM_MISMATCH: Object.freeze({ code: 1008, reason: 'from_mismatch' }),
    // 상대가 응답하지 않으므로 종료 신호 없이 끊는다(terminate). 코드는 기록용.
    PING_TIMEOUT: Object.freeze({ code: 1006, reason: 'disconnect' }),
    // 정상 종료 (§2.6d)
    SERVER_SHUTDOWN: Object.freeze({ code: 1001, reason: 'server_shutdown' }),
});

// 클라이언트 연결 상태 (§5.7, §5.7a)
const ClientStatus = Object.freeze({
    CONNECTING: 'Connecting',
    CONNECTED: 'Connected',
    DELAY: 'Delay',
    DISCONNECT: 'Disconnect',
});

module.exports = {
    Signature,
    SERVER_SIGNATURES,
    CLIENT_SIGNATURES,
    MessageType,
    ErrorCode,
    CloseCode,
    ClientStatus,
};
