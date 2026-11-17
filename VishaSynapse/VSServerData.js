const { SignatureGroup, CLIENT_SIGNATURES } = require('./VSServerCommand');

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

// 목적지 목록과 대응표에 적힌 하위 목록의 클라이언트 모두 (§4.1a)
function GetTargets(to) {
    const signatures = SignatureGroup[to] || [to];
    const targets = [];
    for (const signature of signatures) {
        const list = clientsBySignature.get(signature);
        if (list) targets.push(...list);
    }
    return targets;
}

module.exports = { connections, NextConnectionIndex, AddRegistered, RemoveClient, GetTargets };
