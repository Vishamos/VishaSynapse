# 작업 목록

> **현재 진행 (2026-11-18):** **우선순위: 중계 서버(기기 → VishaSynapse → 버추얼 프로그램), 그중 페이셜 연동·바디 연동 먼저.** 치지직(#2)·OBS(#3)·게임컴 입력(#4)은 이슈로 보류.
> **다음 할 일:**
> 1. **실기기 연동 (Face iOS → Synapse → Vishamos)**. 서버 쪽 작업은 끝났고(Relay-1∼3), 남은 것은 클라이언트와 실행 환경이다. 규칙은 `docs/protocol/README.md`(특히 §9 옛 방식에서 바꿀 점).
>    - 실행 PC에서 `start.bat`으로 서버 실행 성공(2026-11-22). (사용자) 다른 PC에서 접속하려면 실행 PC 방화벽 TCP 4000 인바운드 허용(개인 네트워크)
>    - (사용자, Face iOS 프로젝트) JSON `client.register`(from 22)로 등록, 바이너리 헤더 `[11, 22, 15, …]`, 쓰는 WebSocket 라이브러리의 pong 자동 응답 확인
>    - (Claude, 제안만 함·미착수) `.temp/` 테스트 수신기: 11로 등록해 받은 바이너리의 바이트·초당 횟수 출력. Vishamos를 고치기 전에 Face iOS만 따로 확인하는 용도
>    - (사용자, Vishamos 프로젝트) 11로 JSON 등록, 바이너리 데이터 시작 위치 한 칸 뒤로(`[11, 22, 15, …]`). Body 연동 전에는 수신 버퍼 1KB 확장
>    - 클라이언트 3개(Vishamos·Face·Body) 변경을 각 저장소 이슈로 둘지 결정. Body(Vishas_Capture)는 `Protocol/` 대신 `docs/protocol/` 참조로 변경
> 2. **qa**: 명세 02 기준 `test/` 작성 (C6∼C11, Relay-1∼3 범위). 진행을 막지 않는 보완 질문은 이슈 #5·#6·#7
> 3. **Relay-4**: 포트 사용 중 처리와 포트 값 검사(이슈 #5의 4)를 명세에 정한 뒤 수정
> 4. (사용자, 노션) plan_review "노션 정리" 목록. 코드 작업은 막지 않음
> 5. `docs/protocol/README.md`는 명세 02가 바뀌면 함께 고치고, 새 메시지를 만들 때마다 "메시지 용량 표"에 한 줄씩 추가 (명세 02 §6.5a)
> 6. GitHub 라벨 나머지 생성(만든 것: 작업·제안·보류·치지직·OBS / 남은 제안: 버그·명세보완·기획검토 / 중계서버·DB·Vishamos·Face·Discord / ai-작성 / 사용자검수)
> 7. (사용자, GitHub 웹) Secret scanning의 Push protection 켜기
> 8. `docs/specs/` 정리(노션 이전 후 삭제 또는 링크)

## 운영 방식
- **해야 할 작업만 적는다.** 끝난 항목은 지운다.
  - 명세에 근거한 항목: 해당 명세의 "구현 현황" 표에 기록한다 (진행도).
  - 명세 밖 항목(AI 발견 버그 등): 커밋 메시지(항목 번호 포함)로만 남는다.
- 사용자가 항목을 고르면 메인 세션이 수정 방향을 제안하고, 승인된 항목만 반영한다. 수정한 쪽이 문법 검사·로드·로컬 실행으로 에러만 확인한다. 정밀 검증(qa)과 보안 점검(security)은 요청 시에만.
- 항목 형식: `- [ ] <번호> <내용> — 기획: [태그] / 명세: <문서 번호> §<절>`
  예: `- [ ] Relay-1 등록 전 error의 to 생략 — 기획: [Synapse-Message-Type] / 명세: 02 §6.10a`
  (근거가 없는 항목은 `기획: 없음(AI 발견 버그)`처럼 표시한다.)
- 번호는 `영역-번호`(영역 접두어는 plan_review "태그 목록"). 영역 안에서 계속 늘리고 다시 쓰지 않는다. 다음 번호: Relay-5, Chzzk-4, DB-1, OBS-1, Deploy-1, Dep-4, Doc-6. 커밋에 남은 옛 번호(C1∼C11, G1∼G9)는 그대로 둔다.

## 사용자 조치 대기
- [ ] 기획서 초안 검토·수정 (`docs/specs/VishaSynapse_spec.md`). F-2를 공식 API 기준으로 갱신
- [ ] 기술 명세 검토 (`docs/tech_spec/01_chzzk_openapi_and_secret_db.md`), 6장 확인 필요 항목
- [ ] 공유기: Mac IP DHCP 예약 고정, DB 포트포워딩 닫기 (LAN 전용)
- [ ] 실행 PC가 정해지면: `synapse_app`@실행 PC IP 계정 추가, 실행 PC에 `.env`(`ENV_SECRET_KEY`는 개발 PC와 같은 값)·`db-ca.pem` 복사
- [ ] (#2 진행 시) `node tools/set-secret.js chzzk_client_secret`으로 Client Secret 입력

## Relay. 중계 서버 (VishaSynapse/)
> C6∼C11, Relay-1∼3 완료(2026-11-18, 진행도는 명세 02 "구현 현황").

- [ ] Relay-4 포트 사용 중(`EADDRINUSE`)이면 서버 `'error'` 처리기가 없어 프로세스가 죽음. 동작을 명세에 정한 뒤 수정. 시작 시 포트 값 검사(`IsValidPort`, 명세에 없음, 이슈 #5의 4)도 함께 명세에 정한다 — 기획: 없음(AI 발견 버그)

## Chzzk. 치지직 공식 API 전환 (명세 01, 진행도는 명세 01 "구현 현황")
> Chzzk-1∼3(옛 G6∼G8)은 이슈 #2로 옮김(보류). OBS #3, 게임컴 입력 #4(#3 선행).

## Dep. 의존성·설정
- [ ] Dep-3 전역 `@google/gemini-cli@0.22.4` 업데이트 또는 삭제

## Doc. 문서·공개 준비
- [ ] Doc-2 README 보강 (설치, `.env` 위치, 실행 방법, 중계 서버는 로컬 전용)
- [ ] Doc-3 LICENSE 정리 (GitHub에 LICENSE 있음 → 로컬과 맞추기, `package.json` license 일치)
- [ ] Doc-4 `TestArea/` 제거
- [ ] Doc-5 `.gitignore` 정리
