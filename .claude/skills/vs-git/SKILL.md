---
name: vs-git
description: VishaSynapse에서 git 커밋을 만들거나 커밋 메시지를 쓸 때 사용한다. 단일 브랜치 운영, 커밋 단위와 메시지 형식(항목 번호·기획 태그·Fixes #), 커밋 전 검사, 금지 명령을 다룬다.
---

# Git 운영

## 저장소
- 공개 저장소 GitHub `Vishamos/VishaSynapse`. push는 사용자가 GitHub Desktop으로 한다.
- 브랜치는 `main` 하나만 쓴다. 작업 브랜치·worktree·PR을 쓰지 않는다.
  - 이유: 브랜치 전환 시 `.claude/` 스킬이 바뀌고, git 제외 파일인 CLAUDE.md가 따라가지 않으며, worktree는 GitHub Desktop에서 정리가 끝나지 않는 문제가 있었다.
  - 다시 검토할 시점: 실행 PC 배포를 시작해 `main`이 "실제로 돌아가는 버전"이 될 때.
- 큰 단위가 끝나면 브랜치 대신 태그(`v0.1.0` 등)로 표시한다.

## 커밋 단위와 메시지
- **규칙**(`.claude/`, `.githooks/`): 의도가 분명하므로 수정하고 확인한 직후 바로 커밋한다. 사용자 요청을 기다리지 않는다.
- **코드:** worklist 항목(또는 이슈) 하나당 커밋 하나(그 커밋만 되돌릴 수 있는 단위). 자체 확인과 커밋 전 검사를 통과하면 바로 커밋한다. 사용자 요청을 기다리지 않는다.
  - 명세 "구현 현황" 갱신과 worklist에서 끝난 항목 삭제는 같은 커밋에 넣는다.
  - 명세 보완 질문이 남아 있어도 커밋하고, 답이 정해지면 새 커밋으로 고친다.
- **문서**(plan_review, 명세 본문, worklist 정리, ARCHITECTURE): 대화하며 계속 바뀌므로 쌓아 둔다. Q1·Q2 정리나 태그 정리처럼 큰 단위가 끝났다고 판단될 때만 커밋을 **제안**한다. 그 사이에는 커밋을 언급하지 않는다.
- 바로 커밋한 뒤에는 `커밋: <해시> <메시지>` 한 줄로 보고한다.
- 커밋할 파일은 이름을 지정해 올린다(`git add <파일>`). `git add -A`·`git add .`·`commit -a`는 쓰지 않는다(성격이 다른 변경이 섞이지 않게).
- 커밋된 코드에서 문제를 발견하면 revert하지 않고 `사용자검수` 라벨 이슈 초안을 써서 사용자 승인 후 올린다. 고친 커밋에 `Fixes #번호`.
- 형식: `[항목] 요약 (기획 [태그])` + 필요하면 본문
  - 예: `[C4] 등록 전 클라이언트 중계 차단 (기획 [Synapse-DB-Connect])`
  - 이슈를 닫을 때 본문에 `Fixes #번호`
- 메시지 끝에 공동 작성자 줄을 넣는다: `Co-Authored-By: Claude <noreply@anthropic.com>` (시스템이 지정한 형식이 있으면 그것을 따른다)

## 커밋 전 검사 (모두 통과해야 커밋)
`.githooks/pre-commit` 훅(`core.hooksPath=.githooks`)이 1~3을 자동으로 실행하고, 실패하면 커밋을 막는다. GitHub Desktop에서 사용자가 커밋할 때도 실행된다. 훅이 막으면 우회(`--no-verify`)하지 않고 원인을 보고한다.
1. 비밀 값 스캔: `node .claude/skills/secret-scan/scripts/scan.js`
2. 문법 검사: 스테이징된 `.js` 파일마다 `node --check`
3. 스테이징 목록에 제외 대상이 없는지: `.env` 계열, `CLAUDE.md`, `.claude/settings.local.json`, `*.pem`
4. (수동) 이미지·스크린샷이 섞이지 않았는지, 저장소 전용 `user.email`이 설정되어 있는지만 확인한다 (값은 출력하지 않는다).

## 하지 않는 것
- push (사용자가 GitHub Desktop으로 한다)
- 문서만 바뀐 상태에서 사용자 확인 없이 커밋
- `push --force`, `reset --hard`, rebase 등 히스토리 재작성
- amend는 사용자가 요청하고, 그 커밋이 아직 push되지 않았을 때만 (`git log origin/main..main`으로 확인)
- `docs/specs/`(사용자 기획서) 변경은 사용자가 수정한 경우에만, 별도 커밋으로 분리한다
