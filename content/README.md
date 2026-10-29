# 사기방지위원회 — 콘텐츠 지도

목적: 현재 실행되는 이야기 원본과 생성물, 보존 중인 과거 자료를 구분합니다.

## 현재 게임에서 사용하는 사건

| 순서 | 사건 | 수정할 원본 |
| --- | --- | --- |
| 1막 | 준호에게 온 부탁 · 지인 사칭 | [01-familiar-request.json](cases/01-familiar-request.json) |
| 2막 | 화면 속 수익 · 투자 자료방 | [02-paper-profit.json](cases/02-paper-profit.json) |
| 3막 | 돌려받을 수 있습니다 · 피해 회수 사칭 | [03-recovery-team.json](cases/03-recovery-team.json) |

## 폴더별 역할

| 위치 | 내용 | 직접 수정 |
| --- | --- | --- |
| [cases/](cases) | 활성 3막의 사실·장면·행동·단서 | 가능 |
| [schema/case.schema.json](schema/case.schema.json) | 사건 JSON Schema | 빌더·게임 타입과 함께 검토 |
| [generated/cases.json](generated/cases.json) | 원본을 통합한 실행 데이터 | 생성 명령 사용 |
| [archive/excluded/](archive/excluded) | 이전 확장안에서 제외한 6개 사건 | 과거 기록, 현재 실행 제외 |
| [archive/v2/](archive/v2) | 3막 전환 전 활성 6사건 | 과거 기록, 현재 실행 제외 |

빌더는 `cases/`의 JSON만 파일명 순으로 읽습니다. `archive/`는 자동으로 게임에 포함되지 않으며, 폴더 이동으로 사건 내용은 바꾸지 않습니다.

## 내용을 바꾸는 순서

1. `cases/`의 원본을 수정합니다.
2. `pnpm content:build`로 통합 데이터를 다시 만듭니다.
3. `pnpm content:check`, `pnpm dialogue:check`, `pnpm test:story`로 연결과 진행을 확인합니다.

| 바꾸려는 내용 | 관리 위치 |
| --- | --- |
| 사건 사실·단서·금액·단계 | 사건 JSON의 `story` |
| 작성된 선택 대화·선행 조건 | [narrative.js](../app/story/narrative.js) |
| 일상·막 전환·이어하기 맥락 | [context.js](../app/story/context.js) |
| 인물 메시지·첨부·결정 답장 | [게임 코드 지도](../app/story/README.md#메시지와-ai) |
| 유형 근거·가상화·제작 검수 | 사건 JSON의 `review`, [유형 근거](../docs/development/ROADMAP.md#유형-근거) |

`training`은 이전 검수 규격과의 호환 데이터이며 현재 판정 UI로 소개하지 않습니다. 빌더가 요구하는 필드이므로 화면 미사용만으로 삭제하지 않습니다. 빌더의 수동 검사와 JSON Schema 파일은 함께 유지하며, 스키마 파일 자체를 빌더가 직접 실행하는 것은 아닙니다.

[전체 구조](../docs/development/PROJECT_STRUCTURE.md) · [실제 플레이 안내](../docs/game/PUBLIC_DEMO.md)
