// DB 연결 확인용 스크립트: node tools/db-check.js
// 성공/실패, 에러 코드, TLS 사용 여부, secret_store 존재 여부만 출력한다.
const { loadEnv } = require('../Env');

if (!loadEnv()) {
    process.exitCode = 1;
} else {
    const { testConnection, closePool } = require('../VIshaDB/VSDB');
    (async () => {
        const ok = await testConnection();
        await closePool();
        process.exitCode = ok ? 0 : 1;
    })();
}
