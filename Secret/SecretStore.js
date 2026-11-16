const crypto = require('crypto');
const { getPool } = require('../VIshaDB/VSDB');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_VERSION = 1;
const MAX_VALUE_BYTES = 4000;               // 컬럼 VARBINARY(4096) 이내
const NAME_PATTERN = /^[a-z0-9_]{1,64}$/;

// 에러 코드만 담은 Error (값이나 키를 메시지에 넣지 않는다)
function secretError(code) {
    const err = new Error(code);
    err.code = code;
    return err;
}

let cachedKey = null;
function getKey() {
    if (cachedKey) return cachedKey;
    const raw = process.env.ENV_SECRET_KEY;
    if (!raw) throw secretError('SECRET_KEY_MISSING');
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) throw secretError('SECRET_KEY_INVALID');
    cachedKey = key;
    return key;
}

function checkName(name) {
    if (typeof name !== 'string' || !NAME_PATTERN.test(name)) throw secretError('SECRET_NAME_INVALID');
}

// name을 AAD로 묶어서, 다른 행의 암호문을 옮겨 붙이면 복호화가 실패하게 한다.
function encrypt(name, plain) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    cipher.setAAD(Buffer.from(name, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

function decrypt(name, row) {
    if (row.key_version !== KEY_VERSION) throw secretError('SECRET_KEY_VERSION_UNSUPPORTED');
    try {
        const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), row.iv);
        decipher.setAAD(Buffer.from(name, 'utf8'));
        decipher.setAuthTag(row.auth_tag);
        return Buffer.concat([decipher.update(row.ciphertext), decipher.final()]).toString('utf8');
    } catch {
        throw secretError('SECRET_DECRYPT_FAILED');
    }
}

// 값이 없으면 null
async function get(name) {
    checkName(name);
    const [rows] = await getPool().query(
        'SELECT ciphertext, iv, auth_tag, key_version FROM secret_store WHERE name = ?',
        [name]
    );
    if (rows.length === 0) return null;
    return decrypt(name, rows[0]);
}

async function set(name, value) {
    checkName(name);
    if (typeof value !== 'string' || value.length === 0) throw secretError('SECRET_VALUE_INVALID');
    if (Buffer.byteLength(value, 'utf8') > MAX_VALUE_BYTES) throw secretError('SECRET_VALUE_TOO_LONG');

    const { ciphertext, iv, authTag } = encrypt(name, value);
    await getPool().query(
        `INSERT INTO secret_store (name, ciphertext, iv, auth_tag, key_version)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           ciphertext = VALUES(ciphertext), iv = VALUES(iv),
           auth_tag = VALUES(auth_tag), key_version = VALUES(key_version)`,
        [name, ciphertext, iv, authTag, KEY_VERSION]
    );
}

async function remove(name) {
    checkName(name);
    await getPool().query('DELETE FROM secret_store WHERE name = ?', [name]);
}

module.exports = { get, set, remove };
