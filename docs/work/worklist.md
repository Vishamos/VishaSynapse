# 작업 목록

> **현재 진행 (2026-11-17):** **우선순위: 중계 서버(기기 → VishaSynapse → 버추얼 프로그램), 그중 페이셜 연동·바디 연동 먼저.** 치지직(#2)·OBS(#3)·게임컴 입력(#4)은 이슈로 보류.
> **다음 할 일:**
> 1. **C6 → C7 → C8 → C9 → C10 → C11을 developer 한 명에게 순서대로** (명세 02 승인 완료 2026-11-17)
> 2. (병행, 메인 세션) `Protocol/` 클라이언트 프로토콜 문서 작성 (Face·Body 앱이 기준으로 삼음, 명세 02 §4~6에서 클라이언트가 지킬 부분만). "메시지 용량 표"(클라이언트별 최대 크기·초당 횟수) 포함, 새 시스템을 만들 때마다 한 줄씩 추가 (명세 02 §6.5a). 공개 저장소이므로 내부 주소·경로 제외
> 3. (사용자) 태그 작업 → Claude가 plan_review·worklist 함께 갱신, 작업 번호를 `Relay-1` 형식으로 재지정
> 4. GitHub 라벨 나머지 생성(만든 것: 작업·제안·보류·치지직·OBS / 남은 제안: 버그·명세보완·기획검토 / 중계서버·DB·Vishamos·Face·Discord / ai-작성)
> 5. `docs/specs/` 정리(노션 이전 후 삭제 또는 링크), `docs/ARCHITECTURE.md` 갱신(예전 치지직 모듈 제거)

## 운영 방식
- **해야 할 작업만 적는다.** 끝난 항목은 지운다.
  - 명세에 근거한 항목: 해당 명세의 "구현 현황" 표에 기록한다 (진행도).
  - 명세 밖 항목(AI 발견 버그 등): 커밋 메시지(항목 번호 포함)로만 남는다.
- 사용자가 항목을 고르면 메인 세션이 수정 방향을 제안하고, 승인된 항목만 반영한다. 수정한 쪽이 문법 검사·로드·로컬 실행으로 에러만 확인한다. 정밀 검증(qa)과 보안 점검(security)은 요청 시에만.
- 항목 형식: `- [ ] <번호> <내용> — 기획: [태그] / 명세: <문서 번호> §<절>`
  예: `- [ ] C8 등록 전 메시지 401 — 기획: [Synapse-Client] / 명세: 02 §5.5e`
  (근거가 없는 항목은 `기획: 없음(AI 발견 버그)`처럼 표시한다.)

## 사용자 조치 대기
- [ ] 기획서 초안 검토·수정 (`docs/specs/VishaSynapse_spec.md`). F-2를 공식 API 기준으로 갱신
- [ ] 기술 명세 검토 (`docs/tech_spec/01_chzzk_openapi_and_secret_db.md`), 6장 확인 필요 항목
- [ ] 공유기: Mac IP DHCP 예약 고정, DB 포트포워딩 닫기 (LAN 전용)
- [ ] 실행 PC가 정해지면: `synapse_app`@실행 PC IP 계정 추가, 실행 PC에 `.env`(`ENV_SECRET_KEY`는 개발 PC와 같은 값)·`db-ca.pem` 복사
- [ ] (#2 진행 시) `node tools/set-secret.js chzzk_client_secret`으로 Client Secret 입력

## C. 중계 서버 (VishaSynapse/)
> 명세 02 승인(2026-11-17). 순서대로 한 developer에게 맡긴다(같은 파일들). C6을 먼저: 포트를 나눠야 developer 로컬 실행과 사용자 테스트를 병행할 수 있다.
> 옛 버그 C1~C5는 새 명세대로 다시 만들며 함께 없어진다: C1 → C9, C2·C5 → C7, C3 → C9, C4 → C8. 완료 시 커밋 메시지에 함께 적는다.

- [ ] C6 `VSServer.js:9` 포트 4000 고정 → config `SocketPort` 사용 — 명세: 01 §4
- [ ] C7 시그니처 열거형과 묶음 대응표(10 → 10·11, 20 → 20·21·22), 시그니처별 `Set`, 서버 전체 연결 번호, 옛 핸들러 맵 정리 — 기획: [Synapse-Message-Signature], [Synapse-Client] / 명세: 02 §4, §5.5c
- [ ] C8 접속·등록: 접속 시 `Connecting` + 30초 타이머(초과 시 종료 1008 `register_timeout`), `client.register`(`from`=시그니처) → 목록 추가·`client.registered`(`data.index`) → `Connected`, 표에 없는 시그니처 404, 등록 전 메시지 401, `[0, 0]` 인사 제거 — 기획: [Synapse-Client], [Synapse-Message-Type], [Synapse-Message-Error] / 명세: 02 §5.5~5.5f, §5.8
- [ ] C9 메시지 처리: 텍스트/바이너리 분기(`isBinary`), JSON 소문자 키 검사(400), 서버 시그니처(0·101·111·121)는 서버 처리(모르는 `type`·보류 요소 501, 서버 도착 바이너리 무시), 바이너리는 2바이트 미만 버림·`from`을 서버가 채움, 목적지 + 하위 목록 모두에게 전달, `maxPayload` 64KB(1009), 바이너리·대상 없음에는 에러 안 보냄 — 기획: [Synapse-Message], [Synapse-Message-Type], [Synapse-Message-Error] / 명세: 02 §4.1a, §4.2, §6
- [ ] C10 연결 체크: 30초마다 ping, 마지막 pong 시각 기록, 다음 ping까지 pong 없으면 `Delay`, 5회면 종료(1006 `ping_timeout`, 목록에서 제거), pong 오면 `Connected` 복귀 — 기획: [Synapse-Client-Ping], [Synapse-Client-Status] / 명세: 02 §5.6~5.7a
- [ ] C11 시작 순서: DB 연결 시도(실패해도 계속) → 치지직·OBS 연결 생략(보류) → 중계 서버 대기. `VishaCore.js` 실행은 사용자 승인 후 — 기획: [Synapse-Loop] / 명세: 02 §2.1, §7.0

## G. 치지직 공식 API 전환 (명세 01, 진행도는 명세 01 "구현 현황")
> G6~G8은 이슈 #2로 옮김(보류). OBS #3, 게임컴 입력 #4(#3 선행).

- [ ] G10 CLAUDE.md 비밀 값 규칙 갱신, `docs/ARCHITECTURE.md` 갱신, `.env.example` 추가 — 명세: 01 §10

## D. 의존성·설정
- [ ] D1 `pkg` 제거 (로컬·전역). 수정 불가 취약점, Node 26 미지원. 필요 시 SEA로 대체
- [ ] D2 `package.json` `main` 수정, `start`·`test` 스크립트 추가, 이름 정리
- [ ] D3 전역 `@google/gemini-cli@0.22.4` 업데이트 또는 삭제

## E. 공개 준비·정리
- [ ] E2 README 보강 (설치, `.env` 위치, 실행 방법, 중계 서버는 로컬 전용)
- [ ] E3 LICENSE 정리 (GitHub에 LICENSE 있음 → 로컬과 맞추기, `package.json` license 일치)
- [ ] E4 `TestArea/` 제거
- [ ] E6 `.gitignore` 정리
