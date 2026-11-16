const {VSCommand, TargetType} = require('./VSServerCommand');
const {clients} = require('./VSServerData');


const TargetHandler = {
    [TargetType.VS_SERVER] : (cmd, id, m) => {
        console.log('서버 명령 실행');
        return ServerCMD(cmd, id, m);
    },
    [TargetType.VISHAMOS] : () => {
        console.log('TODO : 버츄얼로 메시지 전송');
    },
    [TargetType.FACE_ANDROID] : () => {
        console.log('TODO : 페이스(안드로이드)로 메시지 전송');
    },
    [TargetType.FACE_IOS] : () => {
        console.log('TODO : 페이스(IOS)로 메시지 전송');
    },
    [TargetType.CHZZK] : () => {
        console.log('TODO : CHZZK으로 메시지 전송');
    },
    [TargetType.DISCORD] : () => {
        console.log('TODO : DISCORD로 메시지 전송');
    },
    [TargetType.OBS] : () => {
        console.log('TODO : OBS로 메시지 전송');
    },
}

const ServerHander = {
    [VSCommand.INIT_CLIENT] : (id, m) => {
        console.log('클라이언트 초기화');
        return InitClient(id, m);
    },
    [VSCommand.NOTHING_TO_DO] : () => {
        console.log('서버 명령 없음');
    },
}

function ServerCMD(cmd, m, id){
    try{
        const vscmd = ServerHander[cmd];
        if (cmd === VSCommand.INIT_CLIENT) {
            const client = clients.get(id);
            client.deviceType = m.message.readUInt8(2); //두 번째를 읽어 넣는다.
            console.log(`Client ${id} registered as ${client.deviceType}`);
            client.ClearTime();

            const InitMessage = Buffer.alloc(2);
            InitMessage.writeUInt8(0, 0);
            InitMessage.writeUInt8(0x01, 1);
            client.socket.send(InitMessage, { binary: true });
        }
    }
    catch(e){
        console.log(`serverCMD error :  ${e.message}`);
    }
}

function VSHandler(m, id)
{
    try{
        const targetType = m.message.readUInt8(0)
        const handler = TargetHandler[targetType];
        if(targetType === TargetType.VS_SERVER)
            {
                const messageType = m.message.readUInt8(1);
                ServerCMD(messageType, m, id);
                console.log(id + ` - binary message : `+ m.message);
            }
            else
            {
                clients.forEach(({ socket, deviceType }, id) => {
                    if (deviceType === targetType) {
                        socket.send(m.message, { binary: true });
                        console.log(`Message sent to Client ${id} (${deviceType})`);
                    }
                });
            }
        if(!handler){
            console.error('알 수 없는 명령: ', target);
        }
    }catch (error){
        console.error("MessageHandler Error: ", error.message);
    }
}

module.exports = {VSHandler}