# VishaSynapse 구조

## 모듈 구성

```
VishaCore.js          진입점. 시작 순서: .env 로드 → config.json 로드 → DB 연결 확인 → 중계 서버 시작
Env.js                %LOCALAPPDATA%\VishaSTD\server\.env 로드 (값은 출력하지 않음). 없으면 종료
Data.js               %LOCALAPPDATA%\VishaSTD\server\config.json 읽기/쓰기 (비밀 값 아님). 없으면 기본값으로 생성
VishaSynapse/         WebSocket 중계 서버 (명세 02)
  VSServer.js         서버 기동, 연결·등록 타이머(30초), ping 확인(30초 간격, 5회 미응답 시 종료)
  VSHandler.js        JSON·바이너리 메시지 분기와 중계
  VSServerCommand.js  기기 시그니처, 명령, 종료 코드 상수
  VSServerData.js     시그니처별 등록 클라이언트 목록
VIshaDB/VSDB.js       MariaDB 커넥션 풀(mysql2/promise, TLS 필수), 연결 확인
Secret/SecretStore.js secret_store 테이블 비밀 값 읽기·쓰기 (AES-256-GCM)
Chzzk/ChzzkApi.js     치지직 공식 Open API 요청 공통부 (연동 자체는 보류, 이슈 #2)
tools/                사용자용 확인·입력 도구 (db-check, secret-selftest, set-secret, chzzk-check)
start.bat             실행 PC용: .env 확인 → npm ci --ignore-scripts → npm start
TestArea/             연습용 코드 (공개 전 제거 예정, Doc-4)
```

치지직(`ChzzkAuth`·`CallbackServer`·`ChzzkSession`), OBS, 게임컴 입력은 보류 중이라 아직 없다(이슈 #2·#3·#4).

## 설정과 비밀 값
| 위치 | 내용 |
|---|---|
| `%LOCALAPPDATA%\VishaSTD\server\config.json` | 일반 설정 (`SocketPort` 기본 4000, `Chzzk.ClientId`) |
| `%LOCALAPPDATA%\VishaSTD\server\.env` | 비밀 값 (`ENV_` 접두사: DB 접속 정보, 암호화 키). 사용자가 직접 배치한다. Claude는 읽지 않는다 |
| `%LOCALAPPDATA%\VishaSTD\server\db-ca.pem` | DB CA 인증서 |
| DB `secret_store` | 치지직 Client Secret·토큰 (암호화 저장) |

DB 연결이 실패해도 중계 서버는 동작한다. 중계만 쓸 때는 DB 접속 정보가 없어도 되지만, `.env` 파일 자체는 있어야 한다(빈 파일 가능).

## 중계 서버 프로토콜
클라이언트가 지킬 규칙은 [`docs/protocol/README.md`](protocol/README.md), 구현 기준은 [`docs/tech_spec/02_relay_server.md`](tech_spec/02_relay_server.md)에 있다. 이 문서에는 옮겨 적지 않는다.
