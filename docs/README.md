# 사기방지위원회 — 문서 안내

게임 소개는 [저장소 README](../README.md), 세부 문서는 아래 목적별 안내에서 시작합니다.

## 먼저 고르기

| 목적 | 읽는 순서 |
| --- | --- |
| 게임을 이해하고 싶어요 | [공개 데모 안내](game/PUBLIC_DEMO.md) |
| 문제 해결 과정을 보고 싶어요 | [개발 시행착오](development/DEVELOPMENT_JOURNEY.md) → [남은 과제](development/ROADMAP.md) |
| 코드를 수정하고 싶어요 | [전체 구조](development/PROJECT_STRUCTURE.md) → [게임 코드](../app/story/README.md) / [콘텐츠](../content/README.md) / [스크립트](../scripts/README.md) |
| 실행·검증·배포를 관리해요 | [운영](operations/OPERATIONS.md) → [보안](../SECURITY.md) |
| 권리·출처를 확인해요 | [라이선스](../LICENSE.md) → [제3자·자산 고지](legal/THIRD_PARTY_NOTICES.md) |

## 문서 지도

| 폴더 | 문서 | 담당 내용 |
| --- | --- | --- |
| game | [PUBLIC_DEMO](game/PUBLIC_DEMO.md) | 체험 흐름·기능·저장·공개 버전 |
| development | [PROJECT_STRUCTURE](development/PROJECT_STRUCTURE.md) | 전체 폴더·실행 연결 |
| development | [DEVELOPMENT_JOURNEY](development/DEVELOPMENT_JOURNEY.md) | 문제·원인·해결·결과 |
| development | [ROADMAP](development/ROADMAP.md) | 미완료 과제·완료 조건·유형 근거 |
| development | [UI_REVIEW](development/UI_REVIEW.md) | 화면 개선·검수 기록 |
| operations | [OPERATIONS](operations/OPERATIONS.md) | 실행·검사·AI·배포·복구 |
| legal | [THIRD_PARTY_NOTICES](legal/THIRD_PARTY_NOTICES.md) | 의존성·이미지·음원 출처 |

README·LICENSE·SECURITY는 저장소 루트에 둡니다. 소스 폴더의 README는 그 폴더의 파일을 찾는 안내이며, 기능 설명·개발 기록·운영 절차의 본문은 위 문서 한 곳에서 관리합니다.

## 문서를 고칠 때

- 기능·공개 버전: game에서 수정합니다.
- 구현 이유·과거 결정: DEVELOPMENT_JOURNEY, 미완료 일: ROADMAP, 검수 상태: UI_REVIEW에서 관리합니다.
- 파일을 옮기면 링크·실행 명령·콘텐츠의 근거 경로를 함께 갱신합니다.
- 변경 후 `pnpm docs:check`를 실행합니다.
