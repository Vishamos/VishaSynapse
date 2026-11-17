---
name: node-coding-rule
description: VishaSynapse Node.js 코드 작성 표준. JS 코드를 작성·수정·리뷰할 때 적용한다 (CommonJS, 에러 처리, 비밀 값 참조, 로그 규칙, ws·mysql2 사용법, 바이너리 파싱 안전 규칙).
---

# VishaSynapse Node.js 코딩 표준

## 런타임과 의존성
- Node.js 26, CommonJS(`require` / `module.exports`). ESM 전환은 별도 결정 전까지 하지 않는다.
- 내장 기능을 우선한다.
  - `.env` 로드: `process.loadEnvFile(경로)` (dotenv 불필요)
  - 테스트: `node:test`, `node:assert/strict`
  - HTTP 요청: `https` 또는 전역 `fetch`
- 새 의존성 추가는 사용자 승인이 필요하다.

## 비밀 값
- `process.env.ENV_*` 이름으로만 참조한다. 기본값(`|| '...'`)에 실제 값을 넣지 않는다.
- 비밀 값이 들어 있는 객체를 로그로 출력하지 않는다. (요청 헤더, DB 설정, 토큰이 든 객체 등)
- 외부 API 응답 본문 전체를 로그로 남기지 않는다. 토큰이 들어 있을 수 있다.
- 필요한 환경 변수가 없으면 **변수 이름만** 담은 에러를 낸다.

## 에러 처리
- `reject`/`throw`는 항상 `Error` 객체로 한다. 문자열로 reject하면 `error.message`가 `undefined`가 된다.
- Promise로 감싼 요청은 다음을 모두 갖춘다.
  - `'error'` 이벤트에서 `reject`
  - 타임아웃 (`req.setTimeout` → `req.destroy(new Error(...))`)
  - HTTP 상태 코드 확인
- `JSON.parse`는 반드시 `try` 안에서 한다.
- 로그에는 `err.code`(없으면 `err.name`) 위주로 남긴다. mysql2 등 외부 라이브러리의 `err.message`에는 계정명·호스트가 들어갈 수 있으므로 DB 관련 에러는 메시지를 출력하지 않는다.
- 이벤트 핸들러와 타이머 콜백 안에서는 `null`이 될 수 있는 참조(소켓 등)를 확인하고 접근한다.

## 모듈 구조
- `require` 시점에 부수효과(연결, 쿼리, 서버 기동, 타이머 시작)를 만들지 않는다. 함수로 export하고 진입점(`VishaCore.js`)에서 호출한다.
- **세미콜론을 생략하지 않는다.** 줄이 `(`나 `[`로 시작하면 앞 줄과 합쳐져 해석된다. (`VishaCore.js`의 `require('mysql2')` 다음 줄 `(async () => ...)()` 사고)
- 쓰지 않는 `require`, 변수, 주석 처리된 예전 코드를 남기지 않는다.
- 같은 모듈을 두 번 `require`하지 않고 한 줄에서 구조 분해한다.

## ws (v8)
- `'message'` 핸들러는 `(data, isBinary)`를 받는다. 텍스트·바이너리 구분은 `isBinary`로 한다. (`Buffer.isBuffer`는 항상 true)
- `'error'` 뒤에는 항상 `'close'`가 온다. 정리 작업(타이머 해제, 참조 `null` 처리, 맵에서 삭제)은 `'close'`에서 한 번만 한다.
- `send` 전에 `readyState === WebSocket.OPEN`을 확인한다.

## 바이너리 파싱
- `readUInt8(n)` 등으로 읽기 전에 `buffer.length > n`을 확인한다. 짧은 메시지에서 RangeError가 난다.
- 프로토콜 값(시그니처, 메시지 type, 에러 코드)은 상수로 정의해 쓰고 숫자·문자열을 직접 적지 않는다.
- 프로토콜 내용 자체(바이트 의미, 등록 절차 등)는 이 스킬에 적지 않는다. 기준은 기술 명세(중계 서버는 명세 02)다.

## 스타일
- 기존 파일의 들여쓰기, 명명 방식(파일명 PascalCase, 기존 함수명 관례), 줄바꿈(CRLF)을 유지한다.
- 기존 파일을 지우고 새로 만들지 않는다. 편집으로 수정한다. 통째로 다시 써야 하면 하기 전에 "규칙 예외 제안"으로 이유를 알린다.
- 주석은 한국어로, "왜 그렇게 했는지"가 코드만으로 드러나지 않을 때만 단다.
