# 작업 목록

## 현재 진행 (갱신: 2026-11-25 22:00)
- 진행 중: 치지직 채팅 → 컨트롤러(41) — Chzzk-1∼4 구현 완료, 실연동 확인 대기 (Main)
- 마지막 완료: Chzzk-3 b270fbc
- 대기: (사용자) Chzzk 실연동 확인, 실기기 연동 클라이언트 쪽 작업, 노션 정리(plan_review "노션에 적을 것"), push
- 다음: qa(명세 02 Relay-1∼3 + 명세 01 Chzzk-1∼4) → Relay-4 → Chzzk-5

## 운영 방식
- 형식과 규칙은 `visha-common:design-work` 5절. 끝난 항목은 명세 "구현 현황"에 기록하고 여기서 지운다.
- 항목 형식: `- [ ] <번호> [P1] <내용> — 기획: [태그] / 명세: <문서 번호> §<절> / 이슈: <저장소>-#<번호>`. 근거 기획이 없으면 `기획: 없음(AI 발견 버그)`.
- 번호 영역은 plan_review "태그 목록". 다음 번호: Relay-5, Chzzk-6, DB-1, OBS-1, Deploy-1, Dep-4, Doc-7. 커밋에 남은 옛 번호(C1∼C11, G1∼G9)는 그대로 둔다.

## 사용자 할 일
- [ ] **Chzzk 실연동 확인 (개발 PC).** `npm start` → 콘솔의 인증 URL을 같은 PC 브라우저로 열어 동의 → `치지직 상태: connected` 확인 → 채팅 한 줄 보내고 1분 건수 로그·컨트롤러(41) 수신 확인. 실패하면 콘솔의 에러 코드를 알려 준다. 확인 대상: 리디렉션 URL 허용(명세 01 §6 Q1), `socket.io-client@2.5.0` 호환(Q3), 구독 `sessionKey` 위치, CHAT 원본 필드, 재시작 후 저장된 토큰으로 바로 접속
- [ ] **실기기 연동 (Face iOS → Synapse → Vishamos).** 서버 쪽은 끝났고(Relay-1∼3) 클라이언트와 실행 환경이 남았다. 규칙은 `docs/protocol/README.md`(특히 §9 옛 방식에서 바꿀 점).
  - 실행 PC에서 `start.bat`으로 서버 실행 성공(2026-11-22). 다른 PC에서 접속하려면 실행 PC 방화벽 TCP 4000 인바운드 허용(개인 네트워크)
  - Face iOS → Synapse 연결 완료(2026-11-23). 테스트 수신기: `node .temp/test-receiver.js ws://<실행 PC IP>:4000 11`
  - 수신기 실측(2026-11-23): Face(22) 250B·30회/초(셋째 바이트 22, 의도한 새 형식), Body(31) 1,092B·21∼23회/초. 둘 다 11로 정상 중계
  - (Vishamos 프로젝트) 11로 JSON 등록, Face 새 형식으로 해석, 수신 버퍼를 보내는 쪽 최대 크기 이상으로(Body 1,092B > 지금 1KB), 받은 길이 확인 (protocol README §8)
  - 클라이언트 3개(Vishamos·Face·Body) 변경을 각 저장소 이슈로 둘지 결정. Body(Vishas_Capture)는 `Protocol/` 대신 `docs/protocol/` 참조로 변경
- [ ] (노션) plan_review "노션에 적을 것". 코드 작업은 막지 않음
- [ ] (GitHub 웹) Secret scanning의 Push protection 켜기
- [ ] 기획서 초안 검토·수정 (`docs/specs/VishaSynapse_spec.md`). F-2를 공식 API 기준으로 갱신
- [ ] 기술 명세 검토 (`docs/tech_spec/01_chzzk_openapi_and_secret_db.md`), 6장 확인 필요 항목
- [ ] 공유기: Mac IP DHCP 예약 고정, DB 포트포워딩 닫기 (LAN 전용)
- [ ] 실행 PC가 정해지면: `synapse_app`@실행 PC IP 계정 추가, 실행 PC에 `.env`(`ENV_SECRET_KEY`는 개발 PC와 같은 값)·`db-ca.pem` 복사, 서버 콘솔의 치지직 인증 URL을 **실행 PC 브라우저**로 열어 한 번 더 동의

## Relay. 중계 서버 (VishaSynapse/)
> C6∼C11, Relay-1∼3 완료(2026-11-18, 진행도는 명세 02 "구현 현황"). qa 미실시: 명세 02 기준 `test/` 작성(C6∼C11, Relay-1∼3 범위).

- [ ] Relay-4 [P1] 포트 사용 중(`EADDRINUSE`)이면 서버 `'error'` 처리기가 없어 프로세스가 죽음. 동작을 명세에 정한 뒤 수정. 시작 시 포트 값 검사(`IsValidPort`, 명세에 없음)도 함께 명세에 정한다 — 기획: 없음(AI 발견 버그) / 명세: 02 / 이슈: VishaSynapse-#5

## Chzzk. 치지직 공식 API 전환 (명세 01, 진행도는 명세 01 "구현 현황")
> 2026-11-25 보류 해제(VishaSynapse-#2), 범위: 채팅 수신 → 컨트롤러(41). 후원·Vishamos 전달은 나중. Chzzk-1∼4 구현 2026-11-25, 실연동 확인은 "사용자 할 일".

- [ ] Chzzk-5 [P1] (security 낮음, 제안) `RedirectUri` 호스트가 `localhost`·`127.0.0.1`·`::1`이 아니면 시작 거부(콜백 서버가 LAN에 열리지 않게), state 비교를 `crypto.timingSafeEqual`로, DB 판정 로그 문구를 "DB 연결 실패 또는 TLS 미사용"으로 — 기획: 없음(security 점검) / 명세: 01 §4·§5.2

## Dep. 의존성·설정
- [ ] Dep-3 [P2] 전역 `@google/gemini-cli@0.22.4` 업데이트 또는 삭제

## Doc. 문서·공개 준비
- [ ] Doc-2 [P2] README 보강 (설치, `.env` 위치, 실행 방법, 중계 서버는 로컬 전용, "REST API" 표현 수정)
- [ ] Doc-3 [P2] LICENSE 정리 (GitHub에 LICENSE 있음 → 로컬과 맞추기, `package.json` license 일치)
- [ ] Doc-4 [P2] `TestArea/` 제거
- [ ] Doc-5 [P2] `.gitignore` 정리
- [ ] Doc-6 [P2] `docs/specs/` 정리(노션 이전 후 삭제 또는 링크)

## 올린 이슈
- VishaSynapse-#3 OBS (보류)
- VishaSynapse-#4 게임컴 입력 (보류, #3 선행)
- VishaSynapse-#5·#6·#7 명세 02 보완 질문(C6∼C11 후속, 진행을 막지 않음)
