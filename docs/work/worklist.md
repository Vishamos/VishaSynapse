# 작업 목록

> **현재 진행 (2026-11-17):** **우선순위: 중계 서버(기기 → VishaSynapse → 버추얼 프로그램) 먼저.** 치지직은 G5까지 완료, G6~G8 보류.
> **다음 할 일:**
> 1. (사용자) 노션에 plan_review A 그룹 답 반영 — 순서는 `plan_review.md` 맨 위 "다음에 할 일"
> 1-1. (사용자) 태그 작업 → Claude가 plan_review·worklist 함께 갱신, 작업 번호를 `Relay-1` 형식으로 재지정
> 2. (Claude, `vs-plan-intake`) 노션 확인 → plan_review 항목 정리 → `docs/tech_spec/02_relay_server.md`(초안 작성됨) 승인 → C 그룹 재정리
> 3. (병행 가능) C6 → C2·C5를 developer로 진행
> 4. GitHub 라벨 생성(제안 목록: 작업·제안·버그·명세보완·기획검토 / 중계서버·치지직·DB·Vishamos·Face·OBS·Discord / ai-작성)
> 5. `docs/specs/` 정리(노션 이전 후 삭제 또는 링크), `docs/ARCHITECTURE.md` 갱신(예전 치지직 모듈 제거)

## 운영 방식
- **해야 할 작업만 적는다.** 끝난 항목은 지운다.
  - 명세에 근거한 항목: 해당 명세의 "구현 현황" 표에 기록한다 (진행도).
  - 명세 밖 항목(AI 발견 버그 등): 커밋 메시지(항목 번호 포함)로만 남는다.
- 사용자가 항목을 고르면 메인 세션이 수정 방향을 제안하고, 승인된 항목만 반영한다. 수정한 쪽이 문법 검사·로드·로컬 실행으로 에러만 확인한다. 정밀 검증(qa)과 보안 점검(security)은 요청 시에만.
- 항목 형식: `- [ ] <번호> <내용> — 기획: [태그] / 명세: <문서 번호> §<절>`
  예: `- [ ] C4 등록 전 클라이언트 중계 차단 — 기획: [Synapse-DB-Connect] / 명세: 02 §4.1`
  (근거가 없는 항목은 `기획: 없음(AI 발견 버그)`처럼 표시한다.)

## 사용자 조치 대기
- [ ] 기획서 초안 검토·수정 (`docs/specs/VishaSynapse_spec.md`). F-2를 공식 API 기준으로 갱신
- [ ] 기술 명세 검토 (`docs/tech_spec/01_chzzk_openapi_and_secret_db.md`), 6장 확인 필요 항목
- [ ] 공유기: Mac IP DHCP 예약 고정, DB 포트포워딩 닫기 (LAN 전용)
- [ ] 실행 PC가 정해지면: `synapse_app`@실행 PC IP 계정 추가, 실행 PC에 `.env`(`ENV_SECRET_KEY`는 개발 PC와 같은 값)·`db-ca.pem` 복사
- [ ] (G6 이후) `node tools/set-secret.js chzzk_client_secret`으로 Client Secret 입력

## C. 중계 서버 (VishaSynapse/)
> C6을 먼저 한다 (2026-11-16): 포트를 나눠야 developer 로컬 실행과 사용자 테스트를 병행할 수 있다. 명세 01의 config `SocketPort`가 근거.
> C1·C3·C4는 plan_review Q3·Q5 결정에 걸려 있다.

- [ ] C1 `VSServer.js:34` ws v8에서 텍스트 분기가 실행되지 않음 → `isBinary` 사용
- [ ] C2 `VSHandler.js:81` 정의되지 않은 `target` 참조 (ReferenceError)
- [ ] C3 `VSHandler.js:45` 메시지 길이 미확인 → RangeError, 클라이언트 없음 미처리
- [ ] C4 `VSHandler.js:73` 등록하지 않은 클라이언트도 메시지 중계 가능
- [ ] C5 `VSHandler.js:5-38` 쓰지 않는 핸들러 맵, 인자 순서 불일치, 없는 `InitClient` 호출
- [ ] C6 `VSServer.js:9` 포트 4000 고정 → config `SocketPort` 사용 — 명세: 01 §4

## G. 치지직 공식 API 전환 (명세 01, 진행도는 명세 01 "구현 현황")
> ⏸ G6~G8 보류 (2026-11-16 결정: 중계 서버 우선)

- [ ] G6 `Chzzk/ChzzkAuth.js` + `Chzzk/CallbackServer.js`: OAuth 연동, 토큰 갱신·저장 — 명세: 01 §5.2, §5.3
- [ ] G7 `Chzzk/ChzzkSession.js`: 세션 소켓, 채팅·후원 구독, 재연결, 이벤트 정규화 — 명세: 01 §5.4, §7
- [ ] G8 `Data.js` config 구조 변경 + `VishaCore.js` 시작 순서 재구성 — 명세: 01 §4, §5.1
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
