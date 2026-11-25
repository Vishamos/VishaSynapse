# 작업 목록

> **현재 진행 (2026-11-25):** **우선순위: 치지직 채팅 → 컨트롤러(41)**(아래 Chzzk 묶음, developer). 그다음 중계 서버 실기기 연동. OBS(#3)·게임컴 입력(#4)은 이슈로 보류.
> **다음 할 일:**
> 0. **Chzzk-1∼4** (명세 01 §5·§7, 명세 02 §7.1). 개발 PC에서 먼저 만든다(DB 접속 확인 2026-11-25). 첫 실연동 때 확인: 리디렉션 URL(`localhost`) 허용(명세 01 §6 Q1), `socket.io-client@2.5.0` 호환(Q3, 문서는 2.0.3까지 명시), 구독 `sessionKey` 위치, CHAT 원본 필드
> 1. **실기기 연동 (Face iOS → Synapse → Vishamos)**. 서버 쪽 작업은 끝났고(Relay-1∼3), 남은 것은 클라이언트와 실행 환경이다. 규칙은 `docs/protocol/README.md`(특히 §9 옛 방식에서 바꿀 점).
>    - 실행 PC에서 `start.bat`으로 서버 실행 성공(2026-11-22). (사용자) 다른 PC에서 접속하려면 실행 PC 방화벽 TCP 4000 인바운드 허용(개인 네트워크)
>    - Face iOS → Synapse 연결 완료(2026-11-23, 사용자). 테스트 수신기 `.temp/test-receiver.js` 준비됨: `node .temp/test-receiver.js ws://<실행 PC IP>:4000 11`로 Face 데이터(88B·10회/초 예상) 확인
>    - 수신기 실측(2026-11-23): Face(22) 250B·30회/초(셋째 바이트 22, 의도한 새 형식), Body(31) 1,092B·21∼23회/초. 둘 다 11로 정상 중계
>    - (사용자, Vishamos 프로젝트) 11로 JSON 등록, Face 새 형식(Face 사양 기준)으로 해석, 수신 버퍼를 보내는 쪽 최대 크기 이상으로(Body 1,092B > 지금 1KB), 받은 길이 확인 (protocol README §8)
>    - 클라이언트 3개(Vishamos·Face·Body) 변경을 각 저장소 이슈로 둘지 결정. Body(Vishas_Capture)는 `Protocol/` 대신 `docs/protocol/` 참조로 변경
> 2. **qa**: 명세 02 기준 `test/` 작성 (C6∼C11, Relay-1∼3 범위). 진행을 막지 않는 보완 질문은 이슈 #5·#6·#7
> 3. **Relay-4**: 포트 사용 중 처리와 포트 값 검사(이슈 #5의 4)를 명세에 정한 뒤 수정
> 4. (사용자, 노션) plan_review "노션 정리" 목록. 코드 작업은 막지 않음
> 5. `docs/protocol/README.md`는 명세 02가 바뀌면 함께 고친다. 메시지별 크기는 각 클라이언트 사양에 둔다 (명세 02 §6.5a)
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
- 번호는 `영역-번호`(영역 접두어는 plan_review "태그 목록"). 영역 안에서 계속 늘리고 다시 쓰지 않는다. 다음 번호: Relay-5, Chzzk-5, DB-1, OBS-1, Deploy-1, Dep-4, Doc-6. 커밋에 남은 옛 번호(C1∼C11, G1∼G9)는 그대로 둔다.

## 사용자 조치 대기
- [ ] 기획서 초안 검토·수정 (`docs/specs/VishaSynapse_spec.md`). F-2를 공식 API 기준으로 갱신
- [ ] 기술 명세 검토 (`docs/tech_spec/01_chzzk_openapi_and_secret_db.md`), 6장 확인 필요 항목
- [ ] 공유기: Mac IP DHCP 예약 고정, DB 포트포워딩 닫기 (LAN 전용)
- [ ] 실행 PC가 정해지면: `synapse_app`@실행 PC IP 계정 추가, 실행 PC에 `.env`(`ENV_SECRET_KEY`는 개발 PC와 같은 값)·`db-ca.pem` 복사
- [ ] (Chzzk-1 이후) 서버 콘솔에 나온 인증 URL을 **서버를 실행한 PC의 브라우저**로 열어 치지직 연동 동의. 실행 PC로 옮길 때는 실행 PC에서 한 번 더

## Relay. 중계 서버 (VishaSynapse/)
> C6∼C11, Relay-1∼3 완료(2026-11-18, 진행도는 명세 02 "구현 현황").

- [ ] Relay-4 포트 사용 중(`EADDRINUSE`)이면 서버 `'error'` 처리기가 없어 프로세스가 죽음. 동작을 명세에 정한 뒤 수정. 시작 시 포트 값 검사(`IsValidPort`, 명세에 없음, 이슈 #5의 4)도 함께 명세에 정한다 — 기획: 없음(AI 발견 버그)

## Chzzk. 치지직 공식 API 전환 (명세 01, 진행도는 명세 01 "구현 현황")
> 2026-11-25 보류 해제(#2), 범위: 채팅 수신 → 컨트롤러(41). 후원·Vishamos 전달은 나중. OBS #3, 게임컴 입력 #4(#3 선행)는 계속 보류.

- [ ] Chzzk-1 OAuth 연동: 인증 URL·`state`, 콜백 서버, code → 토큰, 토큰 저장·자동 갱신(Refresh Token 1회용) — 기획: [Synapse-Chzzk] / 명세: 01 §5.2·§5.3
- [ ] Chzzk-2 세션 소켓: 세션 URL 발급, 접속, 채팅 구독, 무제한 재연결(1→60초), `revoked` 처리 — 기획: [Synapse-Chzzk] / 명세: 01 §5.4
- [ ] Chzzk-3 config(`Chzzk.CallbackPort`·`RedirectUri`, 빠진 항목 기본값 채움)와 시작 순서(DB → 중계 서버 → 치지직, 치지직이 서버 시작을 막지 않음). `Data.js` 파싱 실패 시 `undefined` 반환도 함께 고침 — 기획: [Synapse-Loop] / 명세: 01 §4·§5.1, 02 §2.3
- [ ] Chzzk-4 상태(`disabled`·`auth_required`·`disconnected`·`connected`)와 컨트롤러 전달: 시그니처 41 등록 허용, `chzzk.chat`·`chzzk.status`를 41로, 41 등록 직후 현재 상태 1회, 로그는 상태 변화와 1분 건수만 — 기획: [Synapse-Chzzk] / 명세: 01 §5.5·§7, 02 §4·§7.1

## Dep. 의존성·설정
- [ ] Dep-3 전역 `@google/gemini-cli@0.22.4` 업데이트 또는 삭제

## Doc. 문서·공개 준비
- [ ] Doc-2 README 보강 (설치, `.env` 위치, 실행 방법, 중계 서버는 로컬 전용)
- [ ] Doc-3 LICENSE 정리 (GitHub에 LICENSE 있음 → 로컬과 맞추기, `package.json` license 일치)
- [ ] Doc-4 `TestArea/` 제거
- [ ] Doc-5 `.gitignore` 정리
