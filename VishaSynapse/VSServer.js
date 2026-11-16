const WebSocket = require('ws');
let {clientIdCounter} = require('./VSServerData');
const {clients} = require('./VSServerData');
const {VSHandler} = require('./VSHandler');

let server = null;

const SocketServer = () => {
    server = new WebSocket.Server({ port: 4000 });
    server.on('connection', (socket) => {
        const clientId = clientIdCounter++;
        const clientInfo = {
            socket: socket,
            ClearTime: () => clearTimeout(clientInfo.leftTime),
            SetTimer: () => {
                clearTimeout(clientInfo.leftTime);
                clientInfo.leftTime = setTimeout(() => {
                    socket.send('Fail to Initialize.');
                    socket.close();
                }, 30000);
            },
            leftTime: null,
            registClient: false,
            deviceType: null,
        };
        clients.set(clientId, clientInfo);
        console.log(`${clientId}클라이언트로 연결됨.`);
        const shakeHand = Buffer.alloc(2);
        shakeHand.writeUInt8(0, 0);
        shakeHand.writeUInt8(0, 1);
        socket.send(shakeHand, { binary: true });
        clientInfo.SetTimer();
        
        socket.on('message', (message) => {
            if (Buffer.isBuffer(message)) {
                //console.log(message);
                const VSCmd={
                    message: message,
                }
                VSHandler(VSCmd, clientId);
            } else {
                const decodedMessage = message.toString('utf8');
                console.log(`${clientId}'s JsonMessage : ${decodedMessage}`);
                socket.send(`Echo: ${message}`);
            }
        });
        socket.on('close', () => {
            console.log(`${clientId}번 클라이언트 연결 종료. 남은 소캣 : ${clients.size-1}`);
            clients.delete(clientId);
        });

    });
    console.log('WebSocket 서버가 4000포트에서 실행 중입니다.');
}





module.exports = { SocketServer }