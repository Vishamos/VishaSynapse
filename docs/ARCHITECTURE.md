# VishaSynapse 구조

## 모듈 구성

```
VishaCore.js          진입점: 설정 로드 → 치지직 채널ID / 액세스 토큰 조회
Data.js               %LOCALAPPDATA%/VishaSTD/server/config.json 읽기/쓰기 (비밀 값 아님)
Chzzk/                치지직(네이버) 채팅 WebSocket 클라이언트
  ChatID.js           채널 → chatChannelId 조회
  ChatAT.js           채팅 accessToken 조회 (네이버 쿠키 인증)
  ChatSocket.js       wss://kr-ssN.chat.naver.com/chat 연결, 20초 하트비트
  ChzzkCommand.js     내부 명령 상수
  ChzzkCommandHandler.js  수신 cmd 코드별 처리
VishaSynapse/         자체 WebSocket 중계 서버 (현재 포트 4000 고정)
  VSServer.js         서버 기동, 클라이언트 연결·등록 타이머
  VSHandler.js        바이너리 메시지 분기·중계
  VSServerCommand.js  명령·목적지 상수
  VSServerData.js     접속 클라이언트 맵
VIshaDB/VSDB.js       MariaDB 연결 (작업 중)
TestArea/             연습용 코드 (공개 전 제거 예정)
```

## 설정과 비밀 값
| 위치 | 내용 |
|---|---|
| `%LOCALAPPDATA%\VishaSTD\server\config.json` | 일반 설정 (`ChatAPI.IdHash`, `ChatAPI.ChannelId`, `SocketPort`) |
| `%LOCALAPPDATA%\VishaSTD\server\.env` | 비밀 값 (`ENV_` 접두사). Claude는 읽지 않는다 |

## 치지직 채팅 흐름
1. `GetID(ChannelId)` → `chatChannelId`
2. `GetAccessToken(chatChannelId)` → `accessToken` (네이버 쿠키 필요)
3. `ConnectChzzk()` → 세션 서버 중 하나에 접속, `cmd 100`(INIT) 전송
4. `cmd 10100`(연결 확인) 수신 → 20초 간격 하트비트(`cmd 0`) 시작
5. `cmd 93101` 채팅 수신, `cmd 93102` 후원 (미처리)

## 중계 서버 프로토콜 (바이너리)
- 연결 직후 서버 → 클라이언트: `[0, 0]`
- 클라이언트는 30초 안에 `[0, 1, deviceType]`으로 등록 → 서버 응답 `[0, 1]`. 시간 안에 등록하지 않으면 연결 종료
- 첫 바이트 = 목적지

| 값 | 목적지 |
|---|---|
| 0 | 서버 자신 (둘째 바이트가 명령: 0 없음, 1 INIT_CLIENT) |
| 10 | Vishamos |
| 21 / 22 | Face (Android / iOS) |
| 31 | 치지직 |
| 41 | Discord |
| 51 | OBS |

- 목적지가 0이 아니면 `deviceType`이 같은 모든 클라이언트에게 메시지를 그대로 전달한다.
