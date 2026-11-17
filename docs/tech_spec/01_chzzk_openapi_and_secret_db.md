# 01. 치지직 공식 Open API 전환과 비밀 값 DB 저장

- 작성: 2026-11-16
- 상태: 일부 구현 후 보류. 2026-11-16 기준 비밀 값 DB 저장(3장)과 Open API 요청 공통부·앱 인증 확인(`tools/chzzk-check.js`)까지 구현. OAuth 연동·세션 소켓(5.2~5.4)은 중계 서버 작업 이후로 미룸
- 관련 기획: `docs/specs/VishaSynapse_spec.md` F-2(치지직), F-5(DB)
- 근거 문서: CHZZK Open API (https://chzzk.gitbook.io/chzzk) — Authorization, Session, Chat, Tips

## 구현 현황
작업이 끝나면 메인 세션이 기록한다. 상세 이력은 커밋 메시지의 항목 번호로 찾는다.

| 명세 | 대상 | 상태 | 항목 |
|---|---|---|---|
| §2, §3 | `Env.js` | 완료 2026-11-16 | G1 |
| §2 | `VIshaDB/VSDB.js`, `tools/db-check.js` | 완료 2026-11-16 (Mac DB TLS 연결 확인) | G2 |
| §3 | `Secret/SecretStore.js`, `tools/set-secret.js`, `tools/secret-selftest.js` | 완료 2026-11-16 (selftest 4항목 통과) | G3 |
| §8 | `socket.io-client@2.5.0` 설치 | 완료 2026-11-16 | G4 |
| §2 | `Chzzk/ChzzkApi.js`, `tools/chzzk-check.js` | 완료 2026-11-16 (앱 인증 성공) | G5 |
| §2 삭제 | 비공식 연동 코드 5개 | 완료 2026-11-16 | G9 |
| §5.2, §5.3 | `Chzzk/ChzzkAuth.js`, `Chzzk/CallbackServer.js` | 보류 (중계 서버 우선, #2) | Chzzk-1 |
| §5.4, §7 | `Chzzk/ChzzkSession.js` | 보류 (#2) | Chzzk-2 |
| §4 `SocketPort` | `VishaSynapse/VSServer.js`, `VishaCore.js`, `Data.js`(기본값 4000) | 완료 2026-11-17 | C6 |
| §4, §5.1 | `Data.js` config(나머지 항목), `VishaCore.js` 시작 순서 | 보류 (#2) | Chzzk-3 |
| §10 | CLAUDE.md·ARCHITECTURE.md 갱신, `.env.example` | 미착수 | Doc-1 |

## 1. 결정 사항 (2026-11-16)

| 항목 | 결정 |
|---|---|
| 치지직 연동 방식 | 비공식(네이버 로그인 쿠키) → **공식 Open API** |
| 기능 범위 | **채팅 수신, 후원 수신**. 구독 알림·채팅 송신은 제외 |
| 요청 권한(scope) | `채팅 메시지 조회`, `후원 조회` |
| 이벤트 소켓 | `socket.io-client@2.5.0` (정확한 버전 고정) |
| 비밀 값 저장 | MariaDB `secret_store` 테이블에 AES-256-GCM으로 암호화해 저장 |
| `.env`에 남는 값 | DB 접속 정보, 암호화 키(`ENV_SECRET_KEY`)만 |
| 실행 PC | 같은 집의 다른 Windows PC (DB는 별도 Mac, LAN 접속) |
| 첫 git 커밋 | 비공식 연동 코드를 모두 제거한 뒤 |

## 2. 전체 구조

```
[치지직 Open API] ──HTTPS──> ChzzkApi ─┬─ ChzzkAuth (토큰 발급·갱신) ──> SecretStore ──TLS──> [MariaDB: secret_store]
                                       └─ ChzzkSession (세션 URL)
[치지직 세션 서버] ──Socket.IO──> ChzzkSession ──> 이벤트 정규화 ──> (전달 대상: 기획 미정, 우선 로그)
[브라우저] ──OAuth 콜백──> CallbackServer (로컬 HTTP) ──> ChzzkAuth
```

### 모듈 (신규·변경)
| 모듈 | 역할 |
|---|---|
| `Env.js` (신규) | `process.loadEnvFile()`로 `%LOCALAPPDATA%\VishaSTD\server\.env` 로드. 값은 출력하지 않음 |
| `Data.js` (변경) | config 구조 변경 (4장), 읽기 실패 시 `null` 반환 처리 |
| `VIshaDB/VSDB.js` (재작성) | `mysql2/promise` 커넥션 풀, TLS 필수, `testConnection()` (성공/실패·에러 코드만 출력) |
| `Secret/SecretStore.js` (신규) | `get(name)`, `set(name, value)`. AES-256-GCM 암복호화, `secret_store` 읽기·쓰기 |
| `tools/set-secret.js` (신규) | 사용자가 직접 실행하는 비밀 값 입력 도구. 입력값을 화면에 표시하지 않고 받아 DB에 암호화 저장 |
| `Chzzk/ChzzkApi.js` (신규) | Open API 요청 공통부. 기본 주소, 인증 헤더, 응답 래퍼(`code`/`content`) 처리, 타임아웃, 에러 코드 |
| `Chzzk/ChzzkAuth.js` (신규) | 인증 URL 생성, code → 토큰 교환, 토큰 갱신, 토큰 저장·로드 |
| `Chzzk/CallbackServer.js` (신규) | OAuth 콜백을 받는 로컬 HTTP 서버 |
| `Chzzk/ChzzkSession.js` (신규) | 세션 URL 발급, 소켓 접속, 채팅·후원 구독, 재연결 |
| `VishaCore.js` (재구성) | 시작 순서 조립 (5장) |
| 삭제 | `Chzzk/ChatID.js`, `Chzzk/ChatAT.js`, `Chzzk/ChatSocket.js`, `Chzzk/ChzzkCommand.js`, `Chzzk/ChzzkCommandHandler.js` |

## 3. 비밀 값과 암호화

### 3.1 저장 위치
| 값 | 위치 | 비밀 여부 |
|---|---|---|
| DB 접속 정보 (`ENV_DB_HOST/PORT/USER/PASS/NAME`) | `.env` | 비밀 |
| 암호화 키 `ENV_SECRET_KEY` (32바이트, base64) | `.env` | 비밀. 개발 PC와 실행 PC에 같은 값 |
| 치지직 Client ID | `config.json` | 비밀 아님 |
| 치지직 Client Secret | `secret_store` / `chzzk_client_secret` | 비밀 |
| 치지직 토큰 | `secret_store` / `chzzk_token` | 비밀 |
| DB CA 인증서 경로 | `config.json` | 비밀 아님 |

`chzzk_token`은 하나의 JSON으로 묶어 한 번에 저장한다. 토큰 둘을 따로 저장하면 중간에 실패했을 때 짝이 맞지 않을 수 있다.
```json
{ "accessToken": "...", "refreshToken": "...", "expiresAt": 1763300000000 }
```

### 3.2 암호화 (SecretStore)
- 알고리즘: AES-256-GCM (Node 내장 `crypto`, 추가 의존성 없음)
- 저장할 때마다 새 12바이트 `iv`를 무작위로 만든다. 같은 `iv`를 다시 쓰지 않는다.
- `auth_tag`(16바이트)로 변조를 검출한다. 복호화가 실패하면 값을 반환하지 않고 `SECRET_DECRYPT_FAILED` 에러를 낸다.
- `key_version`은 지금은 1로 고정. 나중에 키를 교체할 때 쓴다.
- 키 형식이 잘못되었으면(디코딩 후 32바이트가 아니면) 시작할 때 `SECRET_KEY_INVALID`로 중단한다.

### 3.3 Client Secret 입력 (`tools/set-secret.js`)
- **사용자가 직접 실행한다. Claude는 실행하지 않는다.**
- 사용법: `node tools/set-secret.js chzzk_client_secret` → 입력 프롬프트에서 값을 붙여 넣음. 화면에는 표시하지 않음
- 허용 이름 목록만 받는다 (`chzzk_client_secret`). 토큰은 이 도구로 넣지 않는다.

### 3.4 로그 금지 항목
토큰, Client Secret, **세션 URL**(쿼리에 인증 토큰이 들어 있음), OAuth `code`, Authorization 헤더, Open API 응답 본문 전체, DB 설정 객체, mysql2 에러 메시지.

## 4. 설정 파일 (`config.json`) 변경

```json
{
  "SocketPort": 4000,
  "Chzzk": {
    "ClientId": "",
    "CallbackPort": 4100,
    "RedirectUri": "http://localhost:4100/chzzk/callback"
  },
  "Db": {
    "CaPath": ""
  }
}
```
- 제거: `ChatAPI.IdHash`, `ChatAPI.ChannelId`. Open API는 토큰의 사용자 채널 이벤트를 구독하므로 채널 ID가 필요 없다.
- `RedirectUri`는 치지직 앱 등록 때 입력한 값과 **정확히 같아야** 한다.
- 기존 config.json에 새 항목이 없으면 기본값을 채워 저장하고, 필수 값(`ClientId`)이 비어 있으면 치지직 연동만 건너뛴다.

## 5. 동작 흐름

### 5.1 시작 순서 (VishaCore)
1. `.env` 로드 → 실패하면 종료
2. `config.json` 로드 → 실패하면 종료
3. DB 연결 확인 (`testConnection`) → 실패하면 치지직 연동만 건너뛰고 계속
4. 중계 서버 기동 (치지직·DB 상태와 관계없이 동작)
5. 치지직 연동 시작: 토큰 로드 → 없으면 5.2, 있으면 5.4로

### 5.2 최초 연동 (토큰이 없을 때)
1. `state`를 무작위로 만들어 메모리에 보관한다 (10분 유효).
2. 콜백 서버를 띄우고 콘솔에 인증 URL을 출력한다. URL에는 `clientId`, `redirectUri`, `state`만 들어 있어 출력해도 된다.
   `https://chzzk.naver.com/account-interlock?clientId=...&redirectUri=...&state=...`
3. 사용자가 브라우저로 열고 동의하면 `redirectUri?code=...&state=...`로 돌아온다.
4. `state`가 다르면 거부한다 (CSRF 방지).
5. `POST /auth/v1/token` (`grantType: authorization_code`)로 토큰을 받는다.
6. `chzzk_token`을 저장한 뒤 5.4로 간다.
7. 브라우저에는 "연동 완료, 창을 닫아도 됩니다"만 보여 준다. 토큰은 표시하지 않는다.

`redirectUri`가 `localhost`이므로 **브라우저를 VishaSynapse가 실행 중인 PC에서 열어야** 한다. 다른 PC에서 열려면 실행 PC의 LAN IP로 등록해야 한다 (6장 확인 필요).

### 5.3 토큰 갱신
- Access Token 유효기간 1일, Refresh Token 30일, **Refresh Token은 1회용**.
- 갱신 시점: `expiresAt` 1시간 전, 또는 API가 `401 INVALID_TOKEN`을 반환했을 때.
- 순서: `POST /auth/v1/token` (`grantType: refresh_token`) → **새 토큰을 DB에 먼저 저장** → 그다음 새 Access Token 사용.
  - 저장에 실패하면 새 Refresh Token을 잃게 되므로 3회 재시도하고, 그래도 실패하면 치지직 연동을 멈추고 재연동 필요를 알린다.
- 동시에 여러 곳에서 갱신하지 않도록 진행 중인 갱신 Promise를 공유한다.
- Refresh Token까지 만료되었으면(30일 미사용 등) 토큰을 지우고 5.2로 돌아간다.

### 5.4 이벤트 수신 (ChzzkSession)
1. `GET /open/v1/sessions/auth` (Bearer) → 세션 URL
2. `socket.io-client`로 접속: `transports: ['websocket']`, `reconnection: false`, `forceNew: true`, 접속 제한 3초
3. `SYSTEM` 메시지 `type: connected` → `data.sessionKey` 획득
4. `POST /open/v1/sessions/events/subscribe/chat`, `.../subscribe/donation` (body: `sessionKey`)
5. `SYSTEM` `type: subscribed` 두 건 확인 → 수신 시작
6. `CHAT`, `DONATION` 이벤트 → 7장 형식으로 정규화
7. `SYSTEM` `type: revoked` → 권한 철회. 토큰을 지우고 재연동 안내
8. 연결이 끊기면 세션 URL을 **새로 발급받아** 1~5를 다시 한다. 대기 시간은 1초부터 두 배씩 늘려 최대 60초.

이벤트 본문이 JSON 문자열로 한 번 더 감싸져 올 수 있다는 커뮤니티 보고가 있으므로, 문자열이면 한 번 더 파싱한다.

## 6. 확인 필요

| # | 내용 | 확인 방법 |
|---|---|---|
| Q1 | 앱 등록에서 `http://localhost` 리디렉션 URL이 허용되는지 | 앱 등록 시 직접 확인 |
| Q2 | 앱 등록 위치와 승인 절차 | 치지직 개발자 센터 |
| Q3 | `socket.io-client@2.5.0`이 실제 세션 서버와 호환되는지 (문서는 2.0.3까지 명시) | 첫 접속 테스트. 안 되면 재논의 (2.0.3은 치명 취약점 3건) |
| Q4 | 세션 URL 유효 시간 | 문서에 없음. 발급 즉시 접속하도록 구현 |
| Q5 | 수신한 채팅·후원을 어디로 전달할지 | 기획서 F-2. 정해지기 전까지는 로그만 남김 |
| Q6 | 실행 PC에서 인증 브라우저를 여는지 | Q1과 함께 결정 |

## 7. 내부 이벤트 형식

```js
// 채팅
{ type: 'chat', channelId, senderChannelId, nickname, role, content, emojis, time }
// 후원
{ type: 'donation', channelId, donatorChannelId, nickname, amount, text, donationType, emojis }
```
- `amount`는 숫자로 변환 (API는 문자열로 줌)
- 전달 대상이 정해지면(Q5) 이 형식을 중계 서버 바이너리 프로토콜로 바꾸는 부분만 추가한다.

## 8. 의존성

| 패키지 | 버전 | 비고 |
|---|---|---|
| `socket.io-client` | `2.5.0` (정확히 고정) | `npm audit`: 중간 3건, 모두 `parseuri` ReDoS. 파싱 대상은 치지직 API가 준 URL뿐이라 위험 낮음. 하위 의존성 24개 |

- 설치: 사용자 승인 후 `npm install socket.io-client@2.5.0 --save-exact --ignore-scripts`
- 2.0.3은 치명 3건 포함 6건이라 쓰지 않는다.

## 9. 사용자 사전 작업

1. 치지직 개발자 센터에서 앱 등록 (이름에 chzzk·치지직·naver·네이버 금지), 권한: 채팅 메시지 조회, 후원 조회, 리디렉션 URL 입력
2. DB: `synapse_app` 계정을 실행 PC IP로 생성 (`REQUIRE SSL`, `SELECT/INSERT/UPDATE/DELETE`)
3. 실행 PC의 `.env`: `ENV_DB_*`, `ENV_SECRET_KEY`
4. DB 서버가 자체 서명 인증서를 쓰면 CA 파일을 실행 PC로 복사
5. 코드 반영 후 `node tools/set-secret.js chzzk_client_secret`으로 Client Secret 입력

## 10. CLAUDE.md 반영 예정
- 비밀 값 목록 갱신: `ENV_NAVER_NID_*` 삭제, `ENV_SECRET_KEY` 추가
- Claude는 `secret_store` 테이블을 조회하지 않는다
- Claude는 `tools/set-secret.js`를 실행하지 않는다
- 세션 URL·토큰·OAuth code를 로그로 출력하지 않는다
