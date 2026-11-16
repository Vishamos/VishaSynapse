---
name: vs-git
description: VishaSynapse에서 git 커밋을 만들거나 커밋 메시지를 쓸 때 사용한다. 단일 브랜치 운영, 커밋 단위와 메시지 형식(항목 번호·기획 태그·Fixes #), 커밋 전 검사, 금지 명령을 다룬다.
---

# Git 운영

## 저장소
- 공개 저장소 GitHub `Vishamos/VishaSynapse`. push는 사용자가 GitHub Desktop으로 한다.
- 브랜치는 `main` 하나만 쓴다. 작업 브랜치를 만들지 않는다. (브랜치 전환 시 `.claude/` 스킬이 끊기는 문제 방지)
- 큰 단위가 끝나면 브랜치 대신 태그(`v0.1.0` 등)로 표시한다.

## 커밋 단위와 메시지
- **코드:** worklist 항목(또는 이슈) 하나당 커밋 하나. 항목이 끝나고 확인한 직후에 커밋한다(맥락이 살아 있을 때). 관련 없는 변경은 나눠서 커밋한다.
- **문서**(plan_review, worklist, 명세, `.claude/`): 큰 단위가 끝났을 때 한 번에 커밋한다. 예: "Q2 정리 완료", "태그 정리 완료". 태그 하나·질문 하나 정의 같은 작은 수정마다 커밋하지 않는다.
- 형식: `[항목] 요약 (기획 [태그])` + 필요하면 본문
  - 예: `[C4] 등록 전 클라이언트 중계 차단 (기획 [Synapse-DB-Connect])`
  - 이슈를 닫을 때 본문에 `Fixes #번호`
- 메시지 끝에 공동 작성자 줄을 넣는다: `Co-Authored-By: Claude <noreply@anthropic.com>` (시스템이 지정한 형식이 있으면 그것을 따른다)

## 커밋 전 검사 (모두 통과해야 커밋)
1. 비밀 값 스캔: `node .claude/skills/secret-scan/scripts/scan.js`
2. 문법 검사: `find . -name '*.js' -not -path './node_modules/*' -not -path './.claude/*' -print0 | xargs -0 -n1 node --check`
3. 스테이징 목록에 제외 대상이 없는지: `.env` 계열, `CLAUDE.md`, `.claude/settings.local.json`, `*.pem`, 이미지·스크린샷
4. 작성자: 저장소 전용 `user.email`이 설정되어 있는지만 확인한다 (값은 출력하지 않는다).

## 하지 않는 것
- 사용자 요청 없는 커밋·push
- `push --force`, `reset --hard`, rebase 등 히스토리 재작성
- amend는 사용자가 요청하고, 그 커밋이 아직 push되지 않았을 때만 (`git log origin/main..main`으로 확인)
- `docs/specs/`(사용자 기획서) 변경은 사용자가 수정한 경우에만, 별도 커밋으로 분리한다
