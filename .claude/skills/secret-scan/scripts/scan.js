#!/usr/bin/env node
'use strict';
// 프로젝트 파일에서 비밀 값으로 의심되는 패턴을 찾는다.
// 출력은 "파일:줄 [규칙]" 뿐이며, 일치한 값은 절대 출력하지 않는다.
// 사용법: node .claude/skills/secret-scan/scripts/scan.js [검사할 폴더]

const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || '.');
const self = path.resolve(__filename);

const SKIP_DIRS = new Set(['node_modules', '.git']);
const BINARY_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.zip', '.gz', '.exe', '.dll', '.ttf', '.woff', '.woff2', '.pdf']);
const MAX_SIZE = 1024 * 1024;

const RULES = [
    ['naver-cookie', /NID_(AUT|SES)\s*=\s*(?!\$\{)[A-Za-z0-9+/=_%-]{8,}/],
    ['password-literal', /\b(pass(word)?|pwd|secret|token)\b\s*[:=]\s*['"`][^'"`\s$]{4,}['"`]/i],
    ['private-ip', /\b(10\.\d{1,3}|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/],
    ['private-key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ['long-hex-literal', /['"`][0-9a-fA-F]{32,}['"`]/],
    ['db-url', /\b(mysql|mariadb|postgres(ql)?|mongodb(\+srv)?):\/\/[^\s'"/]*:[^\s'"@/]+@/i],
];

// .env 계열 파일은 열지 않는다.
function isEnvFile(name) {
    return name === '.env' || name.startsWith('.env.') || name.endsWith('.env');
}

const findings = [];
const envFiles = [];
let scanned = 0;

function walk(dir) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
        console.error(`폴더 읽기 실패: ${path.relative(root, dir) || '.'} (${err.code})`);
        return;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) walk(full);
            continue;
        }
        if (!entry.isFile()) continue;
        if (isEnvFile(entry.name)) {
            envFiles.push(path.relative(root, full));
            continue;
        }
        if (full === self || BINARY_EXT.has(path.extname(entry.name).toLowerCase())) continue;
        scanFile(full);
    }
}

function scanFile(file) {
    let text;
    try {
        if (fs.statSync(file).size > MAX_SIZE) return;
        text = fs.readFileSync(file, 'utf8');
    } catch (err) {
        console.error(`파일 읽기 실패: ${path.relative(root, file)} (${err.code})`);
        return;
    }
    scanned++;
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
        for (const [name, re] of RULES) {
            if (re.test(line)) findings.push(`${path.relative(root, file)}:${i + 1} [${name}]`);
        }
    });
}

walk(root);

console.log(`검사한 파일: ${scanned}개`);
if (envFiles.length > 0) {
    console.log(`경고: 프로젝트 안에 .env 계열 파일이 있습니다 (내용은 읽지 않음). .gitignore 포함 여부를 확인하세요.`);
    envFiles.forEach((f) => console.log(`  ${f}`));
}
if (findings.length === 0) {
    console.log('의심 항목 없음');
    process.exit(0);
}
console.log(`의심 항목 ${findings.length}건:`);
findings.forEach((f) => console.log(`  ${f}`));
process.exit(1);
