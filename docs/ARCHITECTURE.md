# VishaSynapse 구조

## 모듈 구성

```
VishaCore.js          진입점. 시작 순서: .env 로드 → config.json 로드 → DB 연결 확인 → 중계 서버 시작 → 치지직 연동 시작(서버 시작을 막지 않음)
Env.js                %LOCALAPPDATA%\VishaSTD\server\.env 로드 (값은 출력하지 않음). 없으면 종료
Data.js               %LOCALAPPDATA%\VishaSTD\server\config.json 읽기/쓰기 (비밀 값 아님). 없으면 기본값으로 생성
VishaSynapse/         WebSocket 중계 서버 (명세 02)
  VSServer.js         서버 기동, 연결·등록 타이머(30초), ping 확인(30초 간격, 5회 미응답 시 종료)
  VSHandler.js        JSON·바이너리 메시지 분기와 중계
  VSServerCommand.js  기기 시그니처, 명령, 종료 코드 상수
  VSServerData.js     시그니처별 등록 클라이언트 목록
VIshaDB/VSDB.js       MariaDB 커넥션 풀(mysql2/promise, TLS 필수), 연결 확인
Secret/SecretStore.js secret_store 테이블 비밀 값 읽기·쓰기 (AES-256-GCM)
Chzzk/                치지직 공식 Open API 연동, 채팅 → 컨트롤러(41) (명세 01)
  ChzzkApi.js         Open API 요청 공통부 (앱 인증·Bearer 헤더, 타임아웃, 에러 코드)
  ChzzkAuth.js        OAuth: 인증 URL·state, code → 토큰, 토큰 저장·자동 갱신(SecretStore)
  CallbackServer.js   OAuth 콜백을 받는 로컬 HTTP 서버 (CallbackPort, 기본 4100)
  ChzzkSession.js     세션 URL 발급, socket.io 접속, 채팅 구독, 무제한 재연결
  ChzzkStatus.js      연동 상태 4개, 41로 chzzk.status·chzzk.chat 전송, 1분 건수 로그
tools/                사용자용 확인·입력 도구 (db-check, secret-selftest, set-secret, chzzk-check)
start.bat             실행 PC용: .env 확인 → npm ci --ignore-scripts → npm start
TestArea/             연습용 코드 (공개 전 제거 예정, Doc-4)
```

의존 방향: `VishaCore` → `ChzzkAuth`·`ChzzkSession`(서로 콜백으로 연결) → `ChzzkStatus` → `VSHandler`·`VSServerData`. OBS, 게임컴 입력은 보류 중이라 아직 없다(이슈 #3·#4).

## 설정과 비밀 값
| 위치 | 내용 |
|---|---|
| `%LOCALAPPDATA%\VishaSTD\server\config.json` | 일반 설정 (`SocketPort` 기본 4000, `Chzzk.ClientId`·`CallbackPort`(기본 4100)·`RedirectUri`). 빠진 항목은 기본값으로 채워 저장 |
| `%LOCALAPPDATA%\VishaSTD\server\.env` | 비밀 값 (`ENV_` 접두사: DB 접속 정보, 암호화 키). 사용자가 직접 배치한다. Claude는 읽지 않는다 |
| `%LOCALAPPDATA%\VishaSTD\server\db-ca.pem` | DB CA 인증서 |
| DB `secret_store` | 치지직 Client Secret·토큰 (암호화 저장). DB 연결이 실패하면 치지직은 `disabled` |

DB 연결이 실패해도 중계 서버는 동작한다. 중계만 쓸 때는 DB 접속 정보가 없어도 되지만, `.env` 파일 자체는 있어야 한다(빈 파일 가능).

## 중계 서버 프로토콜
클라이언트가 지킬 규칙은 [`docs/protocol/README.md`](protocol/README.md), 구현 기준은 [`docs/tech_spec/02_relay_server.md`](tech_spec/02_relay_server.md)에 있다. 이 문서에는 옮겨 적지 않는다.
