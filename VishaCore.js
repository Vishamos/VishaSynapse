const { loadEnv } = require('./Env');
const Data = require('./Data');
const { testConnection, closePool } = require('./VIshaDB/VSDB');
const { SocketServer, StopAccepting, CloseAllClients } = require('./VishaSynapse/VSServer');
const { serverEvents } = require('./VishaSynapse/VSServerData');
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

const TOKEN_SAVE_WAIT_MS = 5 * 1000; // 명세 02 §2.6d ②

// 정상 종료 때 닫을 치지직 객체 (StartChzzk가 만든 뒤 채운다)
let chzzkAuth = null;
let chzzkSession = null;
let shuttingDown = false;

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
    chzzkAuth = auth;
    chzzkSession = session;

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

// 정상 종료 (명세 02 §2.6d). server.shutdown과 Ctrl+C(SIGINT)가 같은 순서를 쓴다 (§2.6e)
async function Shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('정상 종료 시작');
    // ① 새 접속 받지 않음
    StopAccepting();
    // ② 진행 중인 토큰 저장을 최대 5초 기다림
    if (chzzkAuth) {
        let timer = null;
        const timeout = new Promise((resolve) => {
            timer = setTimeout(resolve, TOKEN_SAVE_WAIT_MS);
        });
        await Promise.race([chzzkAuth.WaitPending(), timeout]);
        clearTimeout(timer);
    }
    // ③ 모든 클라이언트를 1001로 끊음
    await CloseAllClients();
    // ④ 치지직 세션·콜백 서버·DB 풀 닫기
    if (chzzkSession) chzzkSession.Stop();
    if (chzzkAuth) chzzkAuth.Stop();
    try {
        await closePool();
    } catch {
        // 끝내는 중이므로 풀 닫기 실패는 무시하고 정상 종료 코드로 끝낸다
    }
    // ⑤ 종료 코드 0
    process.exit(0);
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
    // 중계 서버가 열린 뒤부터 정상 종료 순서를 쓴다. 그 전의 Ctrl+C는 Node 기본 동작(즉시 종료)
    serverEvents.on('shutdown', Shutdown);
    process.on('SIGINT', Shutdown);
    try {
        await StartChzzk(serverData, dbOk);
    } catch (err) {
        SkipChzzk(`시작 오류: ${err.code || err.name}`);
    }
})();
