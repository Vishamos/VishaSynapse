const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { SERVER_DIR } = require('../Env');

const REQUIRED_VARS = ['ENV_DB_HOST', 'ENV_DB_PORT', 'ENV_DB_USER', 'ENV_DB_PASS', 'ENV_DB_NAME'];
const DEFAULT_CA_PATH = path.join(SERVER_DIR, 'db-ca.pem');

let pool = null;

// 에러 코드만 담은 Error (메시지에 접속 정보를 넣지 않는다)
function dbError(code, extra = {}) {
    const err = new Error(code);
    err.code = code;
    return Object.assign(err, extra);
}

function buildSslOptions(caPath) {
    try {
        return { ca: fs.readFileSync(caPath), rejectUnauthorized: true };
    } catch (err) {
        throw dbError(err.code === 'ENOENT' ? 'DB_CA_NOT_FOUND' : 'DB_CA_READ_FAILED');
    }
}

// 커넥션 풀은 처음 요청할 때 한 번만 만든다. (require 시점에는 아무 연결도 하지 않음)
function getPool({ caPath = DEFAULT_CA_PATH } = {}) {
    if (pool) return pool;

    const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
    if (missing.length > 0) throw dbError('DB_ENV_MISSING', { missing });

    const port = Number(process.env.ENV_DB_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw dbError('DB_PORT_INVALID');

    pool = mysql.createPool({
        host: process.env.ENV_DB_HOST,
        port,
        user: process.env.ENV_DB_USER,
        password: process.env.ENV_DB_PASS,
        database: process.env.ENV_DB_NAME,
        ssl: buildSslOptions(caPath),
        connectionLimit: 5,
        connectTimeout: 10000,
        enableKeepAlive: true,
    });
    return pool;
}

// 연결 확인: 성공/실패, 에러 코드, TLS 사용 여부, secret_store 존재 여부만 출력한다.
async function testConnection(options) {
    try {
        const db = getPool(options);
        await db.query('SELECT 1');

        const [ssl] = await db.query("SHOW SESSION STATUS LIKE 'Ssl_cipher'");
        const tlsOn = Boolean(ssl[0] && ssl[0].Value);

        const [tables] = await db.query(
            "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'secret_store'"
        );

        console.log('DB 연결 성공');
        console.log(`  TLS 사용: ${tlsOn ? '예' : '아니요'}`);
        console.log(`  secret_store 테이블: ${tables[0].n > 0 ? '있음' : '없음'}`);
        return tlsOn;
    } catch (err) {
        const missing = err.missing ? ` (누락: ${err.missing.join(', ')})` : '';
        console.error(`DB 연결 실패: ${err.code || 'UNKNOWN'}${missing}`);
        return false;
    }
}

async function closePool() {
    if (!pool) return;
    const p = pool;
    pool = null;
    await p.end();
}

module.exports = { getPool, testConnection, closePool };
