const path = require('path');

// 서버 설정 폴더: %LOCALAPPDATA%\VishaSTD\server
const SERVER_DIR = path.join(process.env.LOCALAPPDATA || '', 'VishaSTD', 'server');
const ENV_PATH = path.join(SERVER_DIR, '.env');

let loaded = false;

// .env를 읽어 process.env에 넣는다. 값은 출력하지 않는다.
function loadEnv() {
    if (loaded) return true;
    try {
        process.loadEnvFile(ENV_PATH);
        loaded = true;
        return true;
    } catch (err) {
        console.error('.env 로드 실패:', err.code || err.name);
        return false;
    }
}

module.exports = { loadEnv, SERVER_DIR };
