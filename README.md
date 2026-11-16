# VishaSynapse

방송·버추얼 활동에 쓰는 여러 프로그램을 하나로 이어 주는 Node.js 중계 서버입니다.

> **개발 중인 프로젝트입니다.** 아직 실행해서 바로 쓸 수 있는 상태가 아닙니다.

## 하는 일

- **중계 서버**: Vishamos, Face(Android/iOS), Discord, OBS 같은 프로그램이 WebSocket으로 접속하면, 메시지의 목적지에 따라 해당 프로그램으로 전달합니다.
- **치지직 연동**: 치지직 공식 Open API로 내 채널의 채팅과 후원 이벤트를 받습니다.
- **비밀 값 관리**: API 키와 토큰은 MariaDB에 AES-256-GCM으로 암호화해 저장합니다. 코드와 저장소에는 비밀 값을 두지 않습니다.

## 진행 상황

| 기능 | 상태 |
|---|---|
| DB 연결 (TLS), 비밀 값 암호화 저장 | 완료 |
| 치지직 공식 Open API 연동 (채팅·후원 수신) | 진행 중 |
| 중계 서버 | 기본 동작 구현, 안정화 예정 |
| Discord, OBS 연동 | 기획 단계 |

## 요구 사항

- Windows
- Node.js 26 이상
- MariaDB (TLS 설정 필요)
- 치지직 개발자 센터에 등록한 애플리케이션 (채팅 메시지 조회, 후원 조회 권한)

## 설정 위치

설정과 비밀 값은 저장소가 아니라 `%LOCALAPPDATA%\VishaSTD\server\`에 둡니다.

| 파일 | 내용 |
|---|---|
| `.env` | DB 접속 정보와 암호화 키 (`ENV_DB_HOST`, `ENV_DB_PORT`, `ENV_DB_USER`, `ENV_DB_PASS`, `ENV_DB_NAME`, `ENV_SECRET_KEY`) |
| `config.json` | 일반 설정 (첫 실행 시 자동 생성) |
| `db-ca.pem` | DB 서버의 CA 인증서 |

## 확인용 명령

```bash
npm install --ignore-scripts
node tools/db-check.js          # DB 연결·TLS 확인
node tools/secret-selftest.js   # 비밀 값 암호화 저장 확인
```

## 주의

- 중계 서버에는 아직 접속 인증이 없습니다. **로컬 네트워크 안에서만** 사용하세요.

## 문서

- [구조와 중계 프로토콜](docs/ARCHITECTURE.md)
- [기획서](docs/specs/VishaSynapse_spec.md)
- [치지직 연동·비밀 값 저장 기술 명세](docs/tech_spec/01_chzzk_openapi_and_secret_db.md)

## 라이선스

[MIT](LICENSE)
