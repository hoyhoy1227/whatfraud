# 사기방지위원회 — 게임 코드 지도

목적: 휴대폰 게임의 기능별 담당 파일을 찾도록 안내합니다. 파일 위치와 import는 유지하고, 이 문서에서 역할을 묶어 설명합니다.

## 진행과 화면

| 찾는 기능 | 담당 파일 |
| --- | --- |
| 게임 화면·앱 이동·저장·되감기 연결 | [story-client.tsx](story-client.tsx) |
| 행동 전이·가상 거래·저장 재생·결말 | [engine.js](engine.js) |
| 앱별 기록·결말·조작 안내 | [panels.tsx](panels.tsx) |
| 일상·장면 도입·이어하기 | [context.js](context.js) |
| 작성 대화·선택·선행 조건 | [narrative.js](narrative.js) |

## 메시지와 AI

| 찾는 기능 | 담당 파일 |
| --- | --- |
| 대화·프로필·미리보기·읽음 표현 | [presentation.js](presentation.js), [chat-bubbles.tsx](chat-bubbles.tsx) |
| 메시지 도착 간격 | [message-pacing.js](message-pacing.js) |
| 인물 메시지·첨부·후속 연락 | [one-shot.js](one-shot.js), [story-message.tsx](story-message.tsx) |
| 결정 직전 메시지·반응 범주·공통 한도 | [decision-message.js](decision-message.js), [decision-composer.tsx](decision-composer.tsx) |
| 인물의 사건별 지식 범위 | [fraud-context.js](fraud-context.js) |
| 요청 취소·늦은 응답 방지 | [reply-gate.js](reply-gate.js) |
| 기기 내 AI 시도 예산 | [session-budget.js](session-budget.js) |

서버 요청은 [AI route](../api/ai-chat/route.ts), 공용 예산은 [ai-budget.ts](../api/ai-budget.ts), 공통 대사·안전 규칙은 [ai-dialogue.ts](../ai-dialogue.ts)에서 처리합니다. AI 답장은 실제 거래·단서·진행의 권한을 갖지 않습니다.

## 자료·보고서·소리

| 찾는 기능 | 담당 파일 |
| --- | --- |
| 자료 상세·비교 | [evidence-detail.tsx](evidence-detail.tsx) |
| 확인 가능한 제작 기록 첨부 | [attachment-picker.tsx](attachment-picker.tsx) |
| 행동 근거 보고서 계산 | [response-report.js](response-report.js) |
| 보고서 화면 | [analysis-report.tsx](analysis-report.tsx) |
| 음악·합성 효과음·음량 | [use-game-audio.ts](use-game-audio.ts) |

## 함께 확인할 곳

- 사건 원본·생성물: [콘텐츠 지도](../../content/README.md)
- 진행·UI·API 검사: [스크립트 지도](../../tools/README.md#검사-선택)
- 스타일·아이콘: [globals.css](../globals.css), [app-icon.tsx](../app-icon.tsx)
- 페이지·공유 metadata: [page.tsx](../page.tsx), [layout.tsx](../layout.tsx)
- 구현 이유·문제 해결 과정: [개발 시행착오](../../docs/development/DEVELOPMENT_JOURNEY.md)
