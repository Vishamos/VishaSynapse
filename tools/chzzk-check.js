// 치지직 앱 인증 확인: node tools/chzzk-check.js
// 사용자만 실행한다. (Client Secret을 복호화하고 치지직 서버와 통신하므로 Claude는 실행하지 않음)
//
// config.json의 Chzzk.ClientId와 secret_store의 chzzk_client_secret으로
// 클라이언트 세션 URL 발급을 시도해, 앱 인증이 통과하는지만 확인한다.
// 발급된 URL에는 인증 토큰이 들어 있으므로 출력하지 않고 바로 버린다.
const { loadEnv } = require('../Env');

function codeError(code) {
    const err = new Error(code);
    err.code = code;
    return err;
}

async function main() {
    if (!loadEnv()) {
        process.exitCode = 1;
        return;
    }
    const Data = require('../Data');
    const SecretStore = require('../Secret/SecretStore');
    const { closePool } = require('../VIshaDB/VSDB');
    const { request, clientHeaders } = require('../Chzzk/ChzzkApi');

    try {
        const config = await Data.loadData();
        const clientId = config && config.Chzzk && config.Chzzk.ClientId;
        if (!clientId) throw codeError('CHZZK_CLIENT_ID_MISSING');

        const clientSecret = await SecretStore.get('chzzk_client_secret');
        if (!clientSecret) throw codeError('CHZZK_CLIENT_SECRET_MISSING');

        const content = await request('GET', '/open/v1/sessions/auth/client', {
            headers: clientHeaders(clientId, clientSecret),
        });
        if (!content || typeof content.url !== 'string') throw codeError('CHZZK_UNEXPECTED_RESPONSE');

        console.log('치지직 앱 인증 성공 (클라이언트 세션 URL 발급 확인, URL은 출력하지 않음)');
    } catch (err) {
        const detail = [
            err.status ? `HTTP ${err.status}` : null,
            err.apiMessage || null,
            err.cause || null,
        ].filter(Boolean).join(', ');
        console.error(`치지직 앱 인증 실패: ${err.code || 'UNKNOWN'}${detail ? ` (${detail})` : ''}`);
        process.exitCode = 1;
    } finally {
        await closePool();
    }
}

main();
