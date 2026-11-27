const { loadEnv } = require('./Env');
const Data = require('./Data');
const { testConnection, closePool } = require('./VIshaDB/VSDB');
const { SocketServer } = require('./VishaSynapse/VSServer');
const SecretStore = require('./Secret/SecretStore');
const ChzzkStatus = require('./Chzzk/ChzzkStatus');
const { CreateAuth } = require('./Chzzk/ChzzkAuth');
const { CreateSession } = require('./Chzzk/ChzzkSession');

const CLIENT_SECRET_NAME = 'chzzk_client_secret';

// 프로세스 종료 코드 (명세 02 §2.6f). 1(예기치 못한 오류)은 Node 기본 동작에 맡긴다.
const ExitCode = Object.freeze({
    ENV_LOAD_FAILED: 2,
    CONFIG_LOAD_FAILED: 3,
    PORT_IN_USE: 4,
    SERVER_START_FAILED: 5,
});

// 치지직을 쓰지 않으면 상태는 disabled 그대로 두고 이유만 남긴다 (명세 01 §5.5)
function SkipChzzk(reason) {
    console.log(`치지직 상태: disabled (${reason})`);
}

// 치지직 연동 시작: 토큰이 없으면 OAuth(§5.2), 있으면 세션(§5.4). 중계 서버 시작을 막지 않는다 (명세 02 §2.3)
async function StartChzzk(config, dbOk) {
    const chzzk = config.Chzzk || {};
    if (typeof chzzk.ClientId !== 'string' || chzzk.ClientId === '') {
        SkipChzzk('Chzzk.ClientId 없음');
        return;
    }
    if (!URL.canParse(chzzk.RedirectUri)) {
        SkipChzzk('Chzzk.RedirectUri 형식 오류');
        return;
    }
    if (!dbOk) {
        SkipChzzk('시작 시 DB 연결 실패');
        return;
    }
    let clientSecret;
    try {
        clientSecret = await SecretStore.get(CLIENT_SECRET_NAME);
    } catch (err) {
        SkipChzzk(`Client Secret 읽기 실패: ${err.code || err.name}`);
        return;
    }
    if (!clientSecret) {
        SkipChzzk('Client Secret 없음');
        return;
    }

    let auth = null;
    let session = null;
    const RequireAuth = () => {
        session.Stop();
        auth.StartAuthFlow();
    };
    auth = CreateAuth({
        clientId: chzzk.ClientId,
        clientSecret,
        redirectUri: chzzk.RedirectUri,
        callbackPort: chzzk.CallbackPort,
        secretStore: SecretStore,
        setState: ChzzkStatus.SetState,
        onAuthorized: () => session.Start(),
        onAuthRequired: RequireAuth,
    });
    session = CreateSession({
        auth,
        setState: ChzzkStatus.SetState,
        onChat: ChzzkStatus.ForwardChat,
        onAuthRequired: RequireAuth,
    });

    let hasToken;
    try {
        hasToken = await auth.LoadToken();
    } catch (err) {
        SkipChzzk(`토큰 읽기 실패: ${err.code || err.name}`);
        return;
    }
    if (hasToken) {
        session.Start();
    } else {
        auth.StartAuthFlow();
    }
}

// 시작 순서: .env → config → DB 연결 확인 → 중계 서버 → 치지직 (명세 01 §5.1, 명세 02 §2.3). OBS는 보류 (§7.0)
(async () => {
    console.log("클라이언트 실행");
    if (!loadEnv()) {
        process.exitCode = ExitCode.ENV_LOAD_FAILED;
        return;
    }
    const serverData = await Data.loadData();
    if (!serverData) {
        console.error('설정 파일을 불러오지 못해 종료합니다.');
        process.exitCode = ExitCode.CONFIG_LOAD_FAILED;
        return;
    }
    // DB 연결이 실패해도 서버는 계속 동작한다 (§2.5). 치지직만 건너뛴다 (§2.5a)
    const dbOk = await testConnection();
    ChzzkStatus.Init();
    try {
        await SocketServer(serverData.SocketPort);
    } catch (err) {
        // 포트 사용 중이면 4, 그 밖(포트 값 오류 포함)은 5 (§2.6f, §2.6h)
        console.error(`중계 서버 시작 실패: ${err.code || err.name}`);
        await closePool();
        process.exitCode = err.code === 'EADDRINUSE' ? ExitCode.PORT_IN_USE : ExitCode.SERVER_START_FAILED;
        return;
    }
    try {
        await StartChzzk(serverData, dbOk);
    } catch (err) {
        SkipChzzk(`시작 오류: ${err.code || err.name}`);
    }
})();
