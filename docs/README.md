# 사기방지위원회 — 문서 안내

목적: 공개 게임 설명, 개발 기록, 운영 절차와 권리 문서를 용도별로 찾을 수 있게 안내합니다. 게임 소개는 [저장소 README](../README.md)에서 시작합니다.

## 목적별 읽기

| 목적 | 문서 | 다루는 내용 |
| --- | --- | --- |
| 시작하기 | [README](../README.md), [실행·검증](operations/OPERATIONS.md#실행과-검증) | 공개 데모 진입, 개발 환경과 검사 |
| 게임 이해 | [공개 데모 안내](game/PUBLIC_DEMO.md) | 체험 흐름·앱·첨부·보고서·저장·공개 기준 |
| 개발/구조 | [프로젝트 구조](development/PROJECT_STRUCTURE.md) | 진입점과 콘텐츠 빌드의 파일 지도 |
| 개발/구조 | [개발 시행착오](development/DEVELOPMENT_JOURNEY.md) | 문제·원인·해결·결과와 근거 |
| 개발/구조 | [남은 과제](development/ROADMAP.md), [UI 검수](development/UI_REVIEW.md) | 범위·완료 조건·검수 기록 |
| 운영/권리 | [운영](operations/OPERATIONS.md), [보안](../SECURITY.md) | AI·배포·복구·검증 및 제보 |
| 운영/권리 | [라이선스](../LICENSE.md), [제3자·자산 고지](legal/THIRD_PARTY_NOTICES.md) | 저작권·이용 조건·출처 기록 |

## 문서 위치

```text
README.md                       방문자용 소개
LICENSE.md                      프로젝트 이용 조건
SECURITY.md                     보안 제보와 방어 범위
docs/
  README.md                     문서 안내
  game/PUBLIC_DEMO.md            실제 공개 체험
  development/
    PROJECT_STRUCTURE.md        파일·데이터 흐름
    DEVELOPMENT_JOURNEY.md      문제 해결 과정
    ROADMAP.md                  남은 과제·유형 근거
    UI_REVIEW.md                UI 개선·검수 기록
  operations/OPERATIONS.md       실행·검증·운영
  legal/THIRD_PARTY_NOTICES.md   외부 구성 요소·자산 출처
```

## 편집 기준

- 저장소 첫 화면과 GitHub 기본 안내에 쓰는 README·LICENSE·SECURITY는 루트에 둡니다.
- 게임 소개는 game, 개발 기록은 development, 실행 절차는 operations, 자산 고지는 legal에서 관리합니다.
- 경로를 바꾸면 문서 링크와 콘텐츠 검수 메타데이터의 근거 경로를 함께 갱신합니다.
- 삭제된 출품 준비 문서는 복원하지 않습니다. 프로젝트 이용 조건은 LICENSE, 자산 고지는 legal 문서를 따릅니다.
- 게임 코드·import·배포 설정·기존 저작권자 표기는 문서 이동 때문에 바꾸지 않습니다.
