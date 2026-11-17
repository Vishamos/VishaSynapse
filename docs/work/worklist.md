# 작업 목록

> **현재 진행 (2026-11-18):** **우선순위: 중계 서버(기기 → VishaSynapse → 버추얼 프로그램), 그중 페이셜 연동·바디 연동 먼저.** 치지직(#2)·OBS(#3)·게임컴 입력(#4)은 이슈로 보류.
> **다음 할 일:**
> 1. **C6~C11 후속**: C13~C15 수정(Q20~Q24 명세 반영 완료 2026-11-18) → qa 명세 기준 `test/` 작성. 진행을 막지 않는 보완 질문은 이슈 #5·#6. 클라이언트(Vishamos·Face·Body) 등록 방식·시그니처 변경(11·31) 이슈 초안
> 2. (병행, 메인 세션) `Protocol/` 클라이언트 프로토콜 문서 작성 (Face·Body 앱이 기준으로 삼음, 명세 02 §4~6에서 클라이언트가 지킬 부분만). "메시지 용량 표"(클라이언트별 최대 크기·초당 횟수) 포함, 새 시스템을 만들 때마다 한 줄씩 추가 (명세 02 §6.5a). 공개 저장소이므로 내부 주소·경로 제외
> 3. (사용자) 태그 작업 → Claude가 plan_review·worklist 함께 갱신, 작업 번호를 `Relay-1` 형식으로 재지정
> 4. GitHub 라벨 나머지 생성(만든 것: 작업·제안·보류·치지직·OBS / 남은 제안: 버그·명세보완·기획검토 / 중계서버·DB·Vishamos·Face·Discord / ai-작성 / 사용자검수)
> 6. (사용자, GitHub 웹) Secret scanning의 Push protection 켜기
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
> C6~C11 완료(2026-11-17, 진행도는 명세 02 "구현 현황").

- [ ] C13 등록 전 `error`의 `to`를 `null` 대신 생략 — 기획: [Synapse-Message-Type] / 명세: 02 §6.10a
- [ ] C14 중계하는 JSON의 `from`이 등록 시그니처와 다르면 400, 바이너리는 덮어쓰기를 없애고 불일치 시 연결 종료(1008 `from_mismatch`) — 기획: [Synapse-Message-Relay], [Synapse-Message-Error] / 명세: 02 §6.4a, §6.4c, §6.12a
- [ ] C15 시그니처 상수 변경(Vishamos 11, Body 31, Vishamos_Test·Facial 삭제)과 묶음표 제거, JSON 목적지에 연결된 클라이언트가 없으면 404 — 기획: [Synapse-Message-Signature], [Synapse-Message-Relay] / 명세: 02 §4, §6.12d
- [ ] C12 포트 사용 중(`EADDRINUSE`)이면 서버 `'error'` 처리기가 없어 프로세스가 죽음. 동작을 명세에 정한 뒤 수정 — 기획: 없음(AI 발견 버그)

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
