const { CLIENT_SIGNATURES } = require('./VSServerCommand');

// 시그니처별 등록 클라이언트 목록 (명세 02 §4.3a)
const clientsBySignature = new Map();
for (const signature of CLIENT_SIGNATURES) {
    clientsBySignature.set(signature, new Set());
}

// 접속한 모든 클라이언트 (등록 전 포함). 연결 체크(ping)에 쓴다.
const connections = new Set();

// 서버 전체 연결 번호 (§5.5c, §5.5c-1). 연결이 끊겨도 줄이거나 재사용하지 않는다.
let lastConnectionIndex = 0;

function NextConnectionIndex() {
    lastConnectionIndex += 1;
    return lastConnectionIndex;
}

function AddRegistered(client) {
    const list = clientsBySignature.get(client.signature);
    if (list) list.add(client);
}

function RemoveClient(client) {
    connections.delete(client);
    if (client.signature === null) return;
    const list = clientsBySignature.get(client.signature);
    if (list) list.delete(client);
}

// 목적지로 등록된 클라이언트 모두. 묶음은 없다 (§4.1)
function GetTargets(to) {
    return clientsBySignature.get(to) || [];
}

module.exports = { connections, NextConnectionIndex, AddRegistered, RemoveClient, GetTargets };
