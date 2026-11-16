---
name: dev-workflow
description: VishaSynapse 코드 수정 절차. 메인 세션이 직접 고칠 때와 developer 에이전트가 고칠 때 모두 사용한다. 분석, 수정, 자체 확인(문법 검사·모듈 로드·로컬 실행), 보고까지 진행한다.
---

# 수정 절차

## 1. 분석
- `docs/work/worklist.md`에서 맡은 항목의 내용을 확인한다.
- 대상 파일을 처음부터 끝까지 읽는다.
- Grep으로 대상 함수·모듈의 사용처(`require`, 호출부)를 찾아 영향 범위를 확인한다.
- 승인된 수정 방향과 실제 코드가 맞지 않으면(이미 고쳐졌거나, 방향대로 하면 다른 곳이 깨지는 경우) 수정하지 말고 보고한다.

## 2. 수정
- 승인된 범위 안에서만 Edit로 수정한다.
- `node-coding-rule` 스킬의 표준을 따른다.
- 기존 파일을 삭제 후 재생성하지 않는다. 줄바꿈(CRLF)과 인코딩을 유지한다.

## 3. 자체 확인 (에러가 없는지만 본다)
1. **문법 검사** (프로젝트 전체):
   ```bash
   find . -name '*.js' -not -path './node_modules/*' -not -path './.claude/*' -print0 | xargs -0 -n1 node --check
   ```
2. **모듈 로드** (바뀐 모듈마다):
   ```bash
   node -e "require('./<파일>')"
   ```
   require하는 순간 외부 통신이 일어나는 모듈이면 실행하지 않고 보고에 적는다.
3. **로컬 실행** (중계 서버 관련 변경일 때):
   ```bash
   node -e "require('./VishaSynapse/VSServer').SocketServer(); setTimeout(() => process.exit(0), 1500)"
   ```
   - 에러 없이 기동 로그가 나오고 1.5초 뒤 종료되면 통과.
   - 포트가 이미 사용 중(`EADDRINUSE`)이면 실패로 보지 말고 그 사실만 보고한다.
4. **실행하지 않는 것**: `VishaCore.js`, 치지직 API 호출, DB 접속. 필요하면 사용자 승인을 받는다.

## 4. 보고
- 처리 항목, 변경 파일(파일:줄), 자체 확인 결과, 범위 밖 발견 사항.
- 구현 기록(`docs/implementations/`)은 사용자가 요청한 경우에만 작성한다.
