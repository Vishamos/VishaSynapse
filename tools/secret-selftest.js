// SecretStore 동작 확인: node tools/secret-selftest.js
// 실제 비밀 값은 다루지 않는다. 테스트 전용 행(selftest_tmp)에 무작위 값을 저장 → 읽기 → 비교 → 삭제한다.
// 출력은 통과/실패와 에러 코드뿐이다.
const crypto = require('crypto');
const { loadEnv } = require('../Env');

const TEST_NAME = 'selftest_tmp';

async function main() {
    if (!loadEnv()) {
        process.exitCode = 1;
        return;
    }
    const SecretStore = require('../Secret/SecretStore');
    const { getPool, closePool } = require('../VIshaDB/VSDB');

    let ok = true;
    const check = (label, pass) => {
        console.log(`  ${label}: ${pass ? '통과' : '실패'}`);
        if (!pass) ok = false;
    };

    try {
        const sample = crypto.randomBytes(24).toString('base64');

        await SecretStore.set(TEST_NAME, sample);
        check('저장 후 읽은 값 일치', (await SecretStore.get(TEST_NAME)) === sample);

        const [rows] = await getPool().query('SELECT ciphertext FROM secret_store WHERE name = ?', [TEST_NAME]);
        check('DB에 평문으로 저장되지 않음', rows.length === 1 && !rows[0].ciphertext.includes(Buffer.from(sample)));

        await SecretStore.set(TEST_NAME, sample + 'x');
        check('같은 이름 덮어쓰기', (await SecretStore.get(TEST_NAME)) === sample + 'x');

        await SecretStore.remove(TEST_NAME);
        check('삭제 후 null 반환', (await SecretStore.get(TEST_NAME)) === null);

        console.log(ok ? 'SecretStore 확인 통과' : 'SecretStore 확인 실패');
    } catch (err) {
        ok = false;
        console.error(`SecretStore 확인 실패: ${err.code || 'UNKNOWN'}`);
        await SecretStore.remove(TEST_NAME).catch(() => {});
    } finally {
        await closePool();
        process.exitCode = ok ? 0 : 1;
    }
}

main();
