const WebSocket = require('ws');
const { Signature, CloseCode, ClientStatus } = require('./VSServerCommand');
const { connections, RemoveClient } = require('./VSServerData');
const { HandleMessage, ClientLabel, OnControllerLost, CancelControllerTimer } = require('./VSHandler');
const { Log, LogCode } = require('./VSLog');

const REGISTER_TIMEOUT_MS = 30 * 1000; // 명세 02 §5.8
const PING_INTERVAL_MS = 30 * 1000; // §5.6a
const PING_MISS_LIMIT = 5; // §5.6c
const MAX_PAYLOAD = 64 * 1024; // §6.5. 넘으면 ws가 1009로 끊는다 (§6.5b)
const CLOSE_WAIT_MS = 3 * 1000; // §2.6d ③

let server = null;
let pingTimer = null;
let stopping = false; // 정상 종료 중에는 41이 끊겨도 자동 종료 타이머를 시작하지 않는다

function IsValidPort(port) {
    return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function CreateClient(socket, remoteAddress) {
    const client = {
        socket,
        remoteAddress,          // server.shutdown 허용 판단에 쓴다 (§2.6b)
        status: ClientStatus.CONNECTING,
        signature: null,
        index: null,
        registerTimer: null,
        awaitingPong: false,
        missedPings: 0,
        pingSentAt: 0,
        lastPongAt: null,
        latencyMs: null,
        errorLogs: new Map(),   // 에러 code → { at, skipped }. CLIENT_ERROR_SENT 묶기 (§6.13.8)
    };
    // 접속 후 30초 안에 등록하지 않으면 끊는다 (§5.8)
    client.registerTimer = setTimeout(() => {
        client.registerTimer = null;
        const target = client.socket;
        if (client.status !== ClientStatus.CONNECTING || !target) return;
        if (target.readyState !== WebSocket.OPEN) return;
        Log.Warn(LogCode.CLIENT_REGISTER_TIMEOUT, `${ClientLabel(client)}: 등록 시간 초과로 종료`);
        target.close(CloseCode.REGISTER_TIMEOUT.code, CloseCode.REGISTER_TIMEOUT.reason);
    }, REGISTER_TIMEOUT_MS);
    return client;
}

function OnPong(client) {
    if (!client.awaitingPong) return;
    const now = Date.now();
    client.awaitingPong = false;
    client.missedPings = 0;
    client.lastPongAt = now;
    client.latencyMs = now - client.pingSentAt;
    if (client.status === ClientStatus.DELAY) {
        client.status = ClientStatus.CONNECTED;
        Log.Info(LogCode.CLIENT_DELAY_RESOLVED, `${ClientLabel(client)}: 연결 지연 해소`);
    }
}

// 간격마다 응답과 관계없이 ping을 보낸다. 다음 ping까지 pong이 없으면 Delay,
// pong 없이 지나간 ping이 허용 횟수에 이르면 종료 신호 없이 끊는다 (§5.6~5.7a)
function CheckConnections() {
    for (const client of connections) {
        const socket = client.socket;
        if (!socket || socket.readyState !== WebSocket.OPEN) continue;
        // 등록 전 연결은 등록 타이머가 관리한다
        if (client.status === ClientStatus.CONNECTING) continue;
        if (client.awaitingPong) {
            client.missedPings += 1;
            if (client.missedPings >= PING_MISS_LIMIT) {
                client.status = ClientStatus.DISCONNECT;
                Log.Warn(LogCode.CLIENT_PING_TIMEOUT, `${ClientLabel(client)}: ping 미응답으로 종료 (${CloseCode.PING_TIMEOUT.code} ${CloseCode.PING_TIMEOUT.reason})`);
                socket.terminate();
                continue;
            }
            if (client.status !== ClientStatus.DELAY) {
                client.status = ClientStatus.DELAY;
                Log.Warn(LogCode.CLIENT_DELAY, `${ClientLabel(client)}: 연결 지연`);
            }
        }
        client.awaitingPong = true;
        client.pingSentAt = Date.now();
        socket.ping();
    }
}

// 포트에서 듣기 시작하면 resolve, 시작하지 못하면(포트 값 오류, EADDRINUSE 등) err.code를 담아 reject (명세 02 §2.6f, §2.6h)
const SocketServer = (port) => new Promise((resolve, reject) => {
    if (!IsValidPort(port)) {
        const err = new Error('SocketPort 설정이 올바르지 않습니다 (1~65535 정수).');
        err.code = 'SOCKET_PORT_INVALID';
        throw err;
    }
    server = new WebSocket.Server({ port, maxPayload: MAX_PAYLOAD });
    const OnStartError = (err) => {
        server = null;
        reject(err);
    };
    server.once('error', OnStartError);
    server.once('listening', () => {
        server.off('error', OnStartError);
        Log.Info(LogCode.SERVER_STARTED, `WebSocket 서버가 ${port}포트에서 실행 중입니다.`);
        pingTimer = setInterval(CheckConnections, PING_INTERVAL_MS);
        resolve();
    });
    server.on('connection', (socket, req) => {
        const client = CreateClient(socket, req.socket.remoteAddress);
        connections.add(client);
        Log.Info(LogCode.CLIENT_CONNECTED, `클라이언트 접속. 현재 연결: ${connections.size}`);

        socket.on('message', (data, isBinary) => {
            try {
                HandleMessage(client, data, isBinary);
            } catch (err) {
                Log.Error(LogCode.CLIENT_MESSAGE_ERROR, `${ClientLabel(client)} 메시지 처리 오류: ${err.code || err.name}`);
            }
        });
        socket.on('pong', () => OnPong(client));
        // 'error' 뒤에는 항상 'close'가 오므로 정리는 'close'에서만 한다
        socket.on('error', (err) => {
            Log.Error(LogCode.CLIENT_SOCKET_ERROR, `${ClientLabel(client)} 소켓 오류: ${err.code || err.name}`);
        });
        socket.on('close', (code) => {
            client.status = ClientStatus.DISCONNECT;
            clearTimeout(client.registerTimer);
            client.registerTimer = null;
            RemoveClient(client);
            client.socket = null;
            Log.Info(LogCode.CLIENT_DISCONNECTED, `${ClientLabel(client)} 연결 종료 (${code}). 남은 연결: ${connections.size}`);
            // 등록된 41만 signature가 41이다 (403·409로 거부된 연결은 null). 41은 하나뿐이다 (§5.9.1, §5.9.4)
            if (!stopping && client.signature === Signature.CONTROLLER) OnControllerLost();
        });
    });
    server.on('close', () => {
        clearInterval(pingTimer);
        pingTimer = null;
    });
});

// 정상 종료 ①: 새 접속을 받지 않는다. 기존 연결은 ws 8에서 자동으로 닫히지 않는다 (§2.6d)
function StopAccepting() {
    stopping = true;
    CancelControllerTimer();
    clearInterval(pingTimer);
    pingTimer = null;
    if (!server) return;
    server.close();
    server = null;
}

// 정상 종료 ③: 모든 연결을 1001 server_shutdown으로 끊고, 모두 'close'될 때까지 최대 3초 기다린 뒤
// 남은 연결은 강제로 끊는다 (§2.6d)
async function CloseAllClients() {
    const sockets = [];
    const waits = [];
    for (const client of connections) {
        const socket = client.socket;
        if (!socket) continue;
        sockets.push(socket);
        waits.push(new Promise((resolve) => socket.once('close', resolve)));
        socket.close(CloseCode.SERVER_SHUTDOWN.code, CloseCode.SERVER_SHUTDOWN.reason);
    }
    let timer = null;
    const timeout = new Promise((resolve) => {
        timer = setTimeout(resolve, CLOSE_WAIT_MS);
    });
    await Promise.race([Promise.all(waits), timeout]);
    clearTimeout(timer);
    for (const socket of sockets) {
        if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
    }
}

module.exports = { SocketServer, StopAccepting, CloseAllClients };
