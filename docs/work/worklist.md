# 작업 목록

> **현재 진행 (2026-11-16):** **우선순위: 중계 서버(기기 → VishaSynapse → 버추얼 프로그램) 먼저.** 치지직은 G5(앱 인증 확인)까지 완료, G6~G8 보류.
> **다음 대화에서 할 일:**
> 1. (사용자) 노션 `붸쉐뭬 노션 / VishaSynapse`에 `docs/work/plan_review.md` A 그룹 답 반영 (Q3 메시지 형식 최우선, 질문별 `태그 제안` 함께)
> 2. (Claude, `vs-plan-intake`) 노션 확인 → plan_review 항목 정리 → `docs/tech_spec/02_relay_server.md`(초안 작성됨) 승인 → C 그룹 재정리
> 3. GitHub 라벨 생성(제안 목록: 작업·제안·버그·명세보완·기획검토 / 중계서버·치지직·DB·Vishamos·Face·OBS·Discord / ai-작성), worklist 항목의 이슈 이전 여부 결정
> 4. `docs/specs/` 정리(노션 이전 후 삭제 또는 링크), `docs/ARCHITECTURE.md` 갱신(예전 치지직 모듈 제거)

진행 방식: 사용자가 항목을 고르면 메인 세션이 수정 방향을 제안하고, 승인된 항목만 반영한다. 수정 후에는 수정한 쪽이 문법 검사·로드·로컬 실행으로 에러만 확인한다. 정밀 검증(qa)과 보안 점검(security)은 요청 시에만.

항목 형식: `- [ ] <번호> <내용> — 기획: [태그] / 명세: <문서 번호> §<절>`
예: `- [ ] C4 등록 전 클라이언트 중계 차단 — 기획: [Synapse-DB-Connect] / 명세: 02 §4.1`
(기획 태그는 노션 기획서에 태그가 붙은 뒤부터 채운다. 근거가 없는 항목은 `기획: 없음(AI 발견 버그)`처럼 표시한다.)

## 완료
- [x] Node.js v26.13.1, npm 11.20.0 업데이트 (2026-11-16)
- [x] `npm audit fix`: ws 8.23.0, mysql2 3.24.6 (취약점 5개 → 1개, pkg만 남음) (2026-11-16)
- [x] `.env` 변수명 `ENV_` 접두사로 변경 (사용자)
- [x] `Data.js` 기본값 `IdHash`, `ChannelId` 비움 (사용자)
- [x] Claude Code 에이전트 구성 (CLAUDE.md, .claude/agents, .claude/skills, docs/) (2026-11-16)
- [x] 기획 폴더 구성(`docs/specs/` 읽기 전용, `docs/tech_spec/`), 기획서 초안 작성, 단일 브랜치 규칙 (2026-11-16)
- [x] 에이전트 구성 간소화: qa·security는 요청 시에만, 구현 기록 선택, status.md를 worklist로 통합 (2026-11-16)
- [x] GitHub 저장소 재생성 (`Vishamos/VishaSynapse`, 공개), 저장소 전용 작성자 설정 (사용자)
- [x] DB 구성: `visha_synapse` DB, 관리자 계정, `secret_store` 테이블 (사용자, Mac MariaDB)
- [x] 치지직 연동 방향 결정 및 기술 명세 작성 (2026-11-16)

## 진행 순서
1. 기술 명세(`docs/tech_spec/01_...`) 사용자 검토
2. G1~G9 (치지직 공식 API 전환) → 첫 git 커밋
3. 나머지 A~E 항목을 항목별 커밋으로 진행

## 사용자 조치 대기
- [ ] 기획서 초안 검토·수정 (`docs/specs/VishaSynapse_spec.md`). F-2를 공식 API 기준으로 갱신
- [ ] 기술 명세 검토 (`docs/tech_spec/01_chzzk_openapi_and_secret_db.md`), 6장 확인 필요 항목
- [x] 치지직 개발자 센터 앱 등록 (사용자, 2026-11-16). Client ID는 G8에서 config.json에 넣음 (저장소에는 기록하지 않음)
- [x] DB TLS 설정 (Mac 자체 CA, 서버 인증서 SAN에 Mac LAN IP), 개발 PC용 `synapse_app` 계정, 개발 PC `.env`·`db-ca.pem` (사용자, 2026-11-16)
- [ ] 공유기: Mac IP DHCP 예약 고정, DB 포트포워딩 닫기 (LAN 전용)
- [ ] 실행 PC가 정해지면: `synapse_app`@실행 PC IP 계정 추가, 실행 PC에 `.env`(`ENV_SECRET_KEY`는 개발 PC와 같은 값)·`db-ca.pem` 복사
- [x] 개발 PC `.env`에 `ENV_SECRET_KEY` 입력 (사용자, 2026-11-16)
- [ ] (G3 이후) `node tools/set-secret.js chzzk_client_secret`으로 Client Secret 입력

## G. 치지직 공식 API 전환 + 비밀 값 DB 저장 (명세 01)
- [x] G1 `Env.js` 신규: `.env` 로드 (← A2 대체) (2026-11-16)
- [x] G2 `VIshaDB/VSDB.js` 재작성: 커넥션 풀, TLS 필수, `testConnection()`, `tools/db-check.js` (← A4, B6 대체) (2026-11-16, 개발 PC → Mac DB 연결·TLS 검증·secret_store 확인 완료)
- [x] G3 `Secret/SecretStore.js` (AES-256-GCM, name을 AAD로 묶음) + `tools/set-secret.js` + `tools/secret-selftest.js` (2026-11-16, selftest 4항목 통과)
- [x] G4 `socket.io-client@2.5.0` 설치 (`--save-exact --ignore-scripts`, audit 중간 4건 = parseuri 3 + pkg 1, 설치 스크립트 0) (2026-11-16)
- [x] G5 `Chzzk/ChzzkApi.js`: Open API 요청 공통부 + `tools/chzzk-check.js` (앱 인증 확인 전용, 사용자 실행) (2026-11-16, 앱 인증 성공 확인)
- ⏸ G6~G8은 보류 (2026-11-16 결정: 중계 서버 우선)
- [ ] G6 `Chzzk/ChzzkAuth.js` + `Chzzk/CallbackServer.js`: OAuth 연동, 토큰 갱신·저장
- [ ] G7 `Chzzk/ChzzkSession.js`: 세션 소켓, 채팅·후원 구독, 재연결, 이벤트 정규화 (← B1, B2, F1 대체)
- [ ] G8 `Data.js` config 구조 변경 + `VishaCore.js` 시작 순서 재구성 (← A1, B5 포함)
- [x] G9 비공식 연동 코드 삭제: `ChatID.js`, `ChatAT.js`, `ChatSocket.js`, `ChzzkCommand.js`, `ChzzkCommandHandler.js` (← A3, B3, B4, E5 일부 대체). `VishaCore.js`에서 참조 제거, `.env` 로드 추가, 세미콜론 크래시(A1) 해소 (2026-11-16)
- [ ] G10 CLAUDE.md 비밀 값 규칙 갱신 (명세 10장), `docs/ARCHITECTURE.md` 갱신, `.env.example` 추가 (← E1)

## C. 중계 서버 (VishaSynapse/)
- [ ] C1 `VSServer.js:34` ws v8에서 텍스트 분기가 실행되지 않음 → `isBinary` 사용
- [ ] C2 `VSHandler.js:81` 정의되지 않은 `target` 참조 (ReferenceError)
- [ ] C3 `VSHandler.js:45` 메시지 길이 미확인 → RangeError, 클라이언트 없음 미처리
- [ ] C4 `VSHandler.js:73` 등록하지 않은 클라이언트도 메시지 중계 가능
- [ ] C5 `VSHandler.js:5-38` 쓰지 않는 핸들러 맵, 인자 순서 불일치, 없는 `InitClient` 호출
- [ ] C6 `VSServer.js:9` 포트 4000 고정 → config `SocketPort` 사용

## D. 의존성·설정
- [ ] D1 `pkg` 제거 (로컬·전역). 수정 불가 취약점, Node 26 미지원. 필요 시 SEA로 대체
- [ ] D2 `package.json` `main` 수정, `start`·`test` 스크립트 추가, 이름 정리
- [ ] D3 전역 `@google/gemini-cli@0.22.4` 업데이트 또는 삭제

## E. 공개 준비·정리
- [ ] E2 README 보강 (설치, `.env` 위치, 실행 방법, 중계 서버는 로컬 전용)
- [ ] E3 LICENSE 정리 (GitHub에 LICENSE 있음 → 로컬과 맞추기, `package.json` license 일치)
- [ ] E4 `TestArea/` 제거
- [ ] E6 `.gitignore` 정리

## 대체된 항목 (G 그룹으로 흡수)
A1·A2·A3·A4, B1·B2·B3·B4·B5·B6, E1, E5(치지직 부분), E7(첫 커밋은 G9 이후), F1
