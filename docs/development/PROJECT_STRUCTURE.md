# 사기방지위원회 — 프로젝트 구조

목적: 실제 게임 진입점과 콘텐츠 생성 흐름을 따라 파일을 찾도록 안내합니다. 실행 파일은 공개 v76 기준입니다. 출처와 추가 정리는 [공개 데모 안내](../game/PUBLIC_DEMO.md#공개-데모와-저장소의-기준)를 참고하세요.

## 실행 흐름

```text
app/page.tsx
  → app/game-client.tsx
    → app/story/story-client.tsx
      ├─ engine.js        진행·거래·복원·되감기
      ├─ narrative.js     작성 대화·선택
      ├─ context.js       일상·전환·이어하기 맥락
      ├─ presentation.js  대화·프로필·미리보기 표현
      ├─ panels.tsx       앱별 기록·결말
      ├─ analysis-report.tsx / response-report.js  행동 근거 보고서
      ├─ evidence-detail.tsx / attachment-picker.tsx  첨부·대조
      ├─ use-game-audio.ts 음악·효과음
      └─ story-message.tsx / one-shot.js / decision-composer.tsx
           → /api/ai-chat → 서버 검증·공용 예산 → 선택적 Gemini 답장
```

| 관심사 | 파일 | 수정할 때 주의할 점 |
| --- | --- | --- |
| 페이지·공유 정보 | [page.tsx](../../app/page.tsx), [layout.tsx](../../app/layout.tsx) | 표시명·HTML/OG/Twitter 정보와 실제 공개 주소 일치 |
| 게임 화면·상호작용 | [story-client.tsx](../../app/story/story-client.tsx) | 앱 전환·대기 응답·저장·되감기 분리 |
| 상태와 기록 | [engine.js](../../app/story/engine.js) | 허용 이벤트·거래 ID·저장 호환 유지 |
| 대사와 선택 조건 | [narrative.js](../../app/story/narrative.js), [context.js](../../app/story/context.js) | 미래 사건·미선택 행동을 이미 일어난 일처럼 노출하지 않기 |
| 인물 메시지 | [one-shot.js](../../app/story/one-shot.js), [story-message.tsx](../../app/story/story-message.tsx) | 원문 미저장, 제한된 반응·후속 행동 계약 |
| 결정 메시지·인물 맥락 | [decision-message.js](../../app/story/decision-message.js), [fraud-context.js](../../app/story/fraud-context.js), [decision-composer.tsx](../../app/story/decision-composer.tsx) | 지정된 장면·지식·반응 범주와 5회 한도 |
| 첨부·보고서 | [evidence-detail.tsx](../../app/story/evidence-detail.tsx), [attachment-picker.tsx](../../app/story/attachment-picker.tsx), [response-report.js](../../app/story/response-report.js), [analysis-report.tsx](../../app/story/analysis-report.tsx) | 제작 기록 ID, 실제 행동과 AI 분류 구분 |
| 음악·효과음 | [use-game-audio.ts](../../app/story/use-game-audio.ts), [main-ost.wav](../../public/audio/main-ost.wav) | 음량·중단·재개와 원본 권리 |
| 대화 표시 | [presentation.js](../../app/story/presentation.js), [chat-bubbles.tsx](../../app/story/chat-bubbles.tsx), [message-pacing.js](../../app/story/message-pacing.js) | 표시 순서·미리보기·읽음의 일치 |
| AI 취소·기기 예산 | [reply-gate.js](../../app/story/reply-gate.js), [session-budget.js](../../app/story/session-budget.js) | 화면 이동 후 늦은 응답 반영 방지 |
| AI 서버 | [route.ts](../../app/api/ai-chat/route.ts), [ai-dialogue.ts](../../app/ai-dialogue.ts) | 비밀 키·입력/출력 검사·내장 대사 호환 |
| 공용 예산·DB | [ai-budget.ts](../../app/api/ai-budget.ts), [schema.ts](../../db/schema.ts), [drizzle/](../../drizzle) | 생성 직전 원자적 예약과 실패 시 생성 중단 |
| 스타일·아이콘 | [globals.css](../../app/globals.css), [app-icon.tsx](../../app/app-icon.tsx) | 좁은 화면·긴 한글·큰 글자 검수 |

## 콘텐츠 원본에서 실행 데이터까지

```text
content/cases/*.json                 활성 원본 3개, 파일명 순서
  → scripts/build-content.mjs        필드·이야기·순서·안전 메타데이터 검사
    → content/generated/cases.json  통합 생성물
      ├─ app/story/engine.js         진행 엔진
      └─ app/game-data.ts            타입·추가 검증 → AI 서버 등
```

| 위치 | 역할 | 수정 원칙 |
| --- | --- | --- |
| [content/cases/](../../content/cases) | 현재 실행되는 3막 원본 | 사건 사실·단서·단계는 원본에서 수정 |
| [content/generated/cases.json](../../content/generated/cases.json) | 게임과 서버가 읽는 통합 데이터 | 직접 편집하지 않고 `pnpm content:build`로 갱신 |
| [case.schema.json](../../content/schema/case.schema.json) | 사건 데이터의 JSON Schema | 빌드의 수동 검사·TypeScript 타입과 함께 맞추기. 빌드가 이 스키마 파일을 직접 실행하지는 않음 |
| `story` | 현재 장면·단서·금액·행동 정의 | 엔진·UI가 사용 |
| `dialogue`, `review` | 내장 대사와 제작 검수 근거 | 대사 평가·콘텐츠 검사의 대상 |
| `training` | 이전 검수 규격과의 호환 데이터 | 현재 판정 UI로 소개하지 않기. 빌드 검사가 요구하므로 삭제 보류 |

원본을 바꾸면 `pnpm content:build` 후 `pnpm content:check`를 실행합니다. dev/build/lint의 사전 단계도 콘텐츠를 생성하거나 일치 여부를 검사합니다.

## 비활성 자료와 유지 이유

| 위치 | 확인한 참조 | 처리 |
| --- | --- | --- |
| [content/archive/](../../content/archive) | 과거 제외 사건 6개 + `v2/`의 이전 활성 사건 6개. 현재 빌드는 `content/cases`만 읽음 | 실행 제외 상태로 보존. 복원 시 현재 검사에 맞춰 재작성 필요 |
| [public/assets/pixel/](../../public/assets/pixel) | 현재 app·scripts·콘텐츠에서 런타임 경로 참조 없음. 제3자 고지의 출처 기록은 존재 | 과거 자산으로 보존. `public/`에 있으므로 배포 파일에 포함될 수 있으며 미사용을 배포 제외로 단정하지 않음 |
| [public/committee-og.png](../../public/committee-og.png), [og.png](../../public/og.png), [screenshot.jpeg](../../public/screenshot.jpeg) | OG/Twitter 공유 자산과 호환 사본 | 새 제목의 홍보용 이미지. 실제 게임 캡처로 소개하지 않음 |
| 루트 README·LICENSE·SECURITY | 방문자 첫 화면·이용 조건·보안 제보 | 루트 유지. 나머지는 [문서 안내](../README.md)의 폴더 체계로 정리 |

참조 조사는 추적 파일의 import·문자열 경로, `package.json`, CI와 콘텐츠 빌드 코드를 기준으로 했습니다. 문서 자체는 실행 스크립트의 입력이 아닙니다. 이동한 문서의 상호 링크와 콘텐츠 검수 근거 경로를 함께 갱신하며, 기존에 삭제된 출품 준비 파일은 복원하지 않습니다.

## 설정과 자동 검사

| 위치 | 역할 |
| --- | --- |
| [package.json](../../package.json), [pnpm-lock.yaml](../../pnpm-lock.yaml) | 실행 명령·의존성 기준. 패키지 이름 `whatfraud` 유지 |
| [vite.config.ts](../../vite.config.ts), [.openai/hosting.json](../../.openai/hosting.json) | Vinext·Sites·D1 바인딩 |
| [.github/workflows/validate.yml](../../.github/workflows/validate.yml) | 콘텐츠·진행·AI 방어·타입·빌드 등 CI |
| [scripts/](../../scripts) | 콘텐츠 생성, 대사·진행·보안·출시 검증 |

검사별 범위와 실행법은 [OPERATIONS](../operations/OPERATIONS.md#실행과-검증)에 모았습니다. 보고서·첨부·음원·대화 순서 검사도 공개 데모 소스와 함께 포함합니다.
