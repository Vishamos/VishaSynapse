const { loadEnv } = require('./Env');
const Data = require('./Data');
const { testConnection, closePool } = require('./VIshaDB/VSDB');
const { SocketServer } = require('./VishaSynapse/VSServer');

// 시작 순서: DB 연결 시도 → (치지직·OBS 보류) → 중계 서버 대기 (명세 02 §2.1, §7.0)
(async () => {
    console.log("클라이언트 실행");
    if (!loadEnv()) {
        process.exitCode = 1;
        return;
    }
    const serverData = await Data.loadData();
    if (!serverData) {
        console.error('설정 파일을 불러오지 못해 종료합니다.');
        process.exitCode = 1;
        return;
    }
    // DB 연결이 실패해도 서버는 계속 동작한다 (§2.5)
    await testConnection();
    // 치지직(#2)·OBS(#3)는 보류 중이라 시작 시 연결하지 않는다 (§7.0.2)
    try {
        SocketServer(serverData.SocketPort);
    } catch (err) {
        console.error(`중계 서버 시작 실패: ${err.code || err.name}`);
        await closePool();
        process.exitCode = 1;
    }
})();
