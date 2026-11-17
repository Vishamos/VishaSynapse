---
name: secret-scan
description: 프로젝트 파일에서 비밀 값으로 의심되는 패턴(네이버 쿠키, 비밀번호 문자열, 내부 IP, 개인 키, 긴 hex 문자열, 접속 URL)을 찾는다. 값은 출력하지 않고 파일:줄과 규칙 이름만 보고한다. 커밋·공개 전이나 비밀 값 관련 코드 수정 후에 사용한다.
---

# 비밀 값 스캔

## 실행
프로젝트 루트에서:
```bash
node .claude/skills/secret-scan/scripts/scan.js
```
- 종료 코드 0: 발견 없음 / 1: 의심 항목 있음
- `node_modules`, `.git`, `.env` 계열 파일은 읽지 않는다. 프로젝트 안에 `.env` 계열 파일이 **있는지만** 확인해 경고한다.

## 출력 해석
```
Data.js:6 [long-hex-literal]
```
- 일치한 값은 출력되지 않는다. 확인이 필요하면 사용자에게 해당 줄을 직접 확인해 달라고 요청한다.
- 오탐 가능성이 있는 규칙: `long-hex-literal`(해시·ID), `private-ip`(문서 예시)

## 규칙 목록
| 규칙 | 찾는 것 |
|---|---|
| `naver-cookie` | `NID_AUT=`, `NID_SES=` 뒤에 템플릿 변수(`${`)가 아닌 실제 값 |
| `password-literal` | password·pass·secret·token 키에 따옴표 문자열 값 |
| `private-ip` | 10.x, 172.16∼31.x, 192.168.x 주소 |
| `private-key` | PEM 개인 키 헤더 |
| `long-hex-literal` | 따옴표 안의 32자 이상 hex 문자열 |
| `db-url` | 계정·비밀번호가 포함된 DB 접속 URL |

## 주의
- 스캔 결과를 보고할 때 의심 값을 옮겨 적지 않는다.
- 규칙을 추가할 때 스크립트 안의 예시나 주석에 실제 형식의 값을 쓰지 않는다.
