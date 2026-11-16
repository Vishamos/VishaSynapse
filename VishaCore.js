const { loadEnv } = require('./Env');
const Data = require('./Data');
const { SocketServer } = require('./VishaSynapse/VSServer');

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
    // TODO(G7·G8): 치지직 공식 Open API 연동 시작 (docs/tech_spec/01_chzzk_openapi_and_secret_db.md 5.1)
    //SocketServer();
})();
