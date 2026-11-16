---
name: qa-workflow
description: qa 에이전트의 정밀 검증 절차. 사용자가 정밀 검증을 요청했을 때만 사용한다. 변경된 파일을 기준으로 문법 검사, 코딩 표준 검토, node:test 단위 테스트를 수행하고 통과/반려를 판정한다.
---

# 정밀 검증 절차

## 1. 대상 확인
- 메인 세션이 전달한 검증 범위(변경 파일 목록 또는 모듈)를 확인한다. 구현 기록(`docs/implementations/`)이 있으면 함께 읽는다.

## 2. 정적 검사
프로젝트의 모든 JS 파일 문법 검사 (node_modules, .claude 제외):
```bash
find . -name '*.js' -not -path './node_modules/*' -not -path './.claude/*' -print0 | xargs -0 -n1 node --check
```

## 3. 코딩 표준 검토
`node-coding-rule` 스킬 기준으로 변경 파일을 검토한다. 특히 다음을 확인한다.
- `Error` 객체로 reject/throw 하는지
- 비밀 값·응답 본문·에러 객체 전체를 로그로 출력하지 않는지
- require 시점 부수효과가 없는지
- ws `isBinary` 사용, `close`에서 정리, 버퍼 길이 확인

## 4. 단위 테스트
- 위치: `test/<모듈명>.test.js`, 프레임워크: `node:test` + `node:assert/strict`
- 실행: `node --test test/`
  - `package.json`의 `test` 스크립트는 아직 자리표시자라서 `npm test`를 쓰지 않는다.
- 외부 통신 금지:
  - `https.get` → `mock.method(https, 'get', ...)`로 가짜 응답
  - ws → 테스트 안에서 `new WebSocket.Server({ port: 0 })`로 로컬 서버를 띄우고 끝나면 닫기
  - mysql2 → `mock.method`로 대체
- 중계 서버(`VSServer.js`)는 포트 4000이 고정되어 있다(worklist C6). 고쳐지기 전에는 실제 서버를 띄우는 테스트를 하지 않고 `VSHandler`를 직접 호출해 테스트한다.
- 바이너리 프로토콜은 경계값을 포함한다: 빈 버퍼, 1바이트, 2바이트, 등록 전 클라이언트, 존재하지 않는 클라이언트 ID.
- 테스트에는 더미 값만 쓴다. 환경 변수가 필요하면 테스트 안에서 설정하고 `after`에서 원래대로 되돌린다.

## 5. 판정
- 통과: 정적 검사 오류 0, 테스트 전부 통과, 표준 위반 없음
- 반려: 하나라도 실패. 재현 방법, 기대값과 실제값, 파일:줄을 적는다.
