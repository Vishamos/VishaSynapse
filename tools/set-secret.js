// 비밀 값 입력 도구: node tools/set-secret.js <이름>
// 사용자만 실행한다. (Claude는 실행하지 않음)
// 값은 명령줄 인자로 받지 않는다 (셸 기록에 남지 않게). 입력 중 화면에 표시하지 않는다.
const { loadEnv } = require('../Env');

const ALLOWED_NAMES = new Set(['chzzk_client_secret']);

function codeError(code) {
    const err = new Error(code);
    err.code = code;
    return err;
}

function readHidden(prompt) {
    return new Promise((resolve, reject) => {
        const stdin = process.stdin;
        if (!stdin.isTTY) {
            reject(codeError('TTY_REQUIRED'));
            return;
        }
        let value = '';
        const cleanup = () => {
            stdin.setRawMode(false);
            stdin.pause();
            stdin.removeListener('data', onData);
            process.stdout.write('\n');
        };
        const onData = (chunk) => {
            for (const ch of chunk) {
                if (ch === '\r' || ch === '\n') { cleanup(); resolve(value.trim()); return; }
                if (ch === '\u0003') { cleanup(); reject(codeError('CANCELLED')); return; }   // Ctrl+C
                if (ch === '\u0008' || ch === '\u007f') { value = value.slice(0, -1); continue; } // Backspace
                value += ch;
            }
        };
        process.stdout.write(prompt);
        stdin.setRawMode(true);
        stdin.setEncoding('utf8');
        stdin.resume();
        stdin.on('data', onData);
    });
}

async function main() {
    const name = process.argv[2];
    if (!ALLOWED_NAMES.has(name)) {
        console.error('사용법: node tools/set-secret.js <이름>');
        console.error(`허용된 이름: ${[...ALLOWED_NAMES].join(', ')}`);
        process.exitCode = 1;
        return;
    }
    if (!loadEnv()) {
        process.exitCode = 1;
        return;
    }

    const SecretStore = require('../Secret/SecretStore');
    const { closePool } = require('../VIshaDB/VSDB');
    try {
        const value = await readHidden(`${name} 값을 붙여 넣고 Enter (화면에 표시되지 않음): `);
        if (!value) throw codeError('EMPTY_VALUE');
        await SecretStore.set(name, value);
        console.log(`저장 완료: ${name}`);
    } catch (err) {
        console.error(`저장 실패: ${err.code || 'UNKNOWN'}`);
        process.exitCode = 1;
    } finally {
        await closePool();
    }
}

main();
