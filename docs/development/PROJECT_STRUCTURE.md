# 사기방지위원회 — 전체 구조

목적: 저장소에서 수정할 위치와 실행 연결을 빠르게 찾도록 안내합니다. 세부 파일 설명은 각 소스 폴더의 README에서 관리합니다.

## 폴더 지도

| 폴더 | 역할 | 상세 안내 |
| --- | --- | --- |
| [app/](../../app) | 페이지·스타일·AI API | [게임 코드 지도](../../app/story/README.md) |
| [content/](../../content) | 활성 사건·생성물·스키마·과거 콘텐츠 | [콘텐츠 지도](../../content/README.md) |
| [public/](../../public) | 공유 이미지·아이콘·음원·보존 자산 | [출처·권리](../legal/THIRD_PARTY_NOTICES.md) |
| [scripts/](../../scripts) | 생성·검사·회귀 테스트·자산 도구 | [스크립트 지도](../../scripts/README.md) |
| [docs/](../README.md) | 게임·개발·운영 문서 | [문서 안내](../README.md) |
| [db/](../../db), [drizzle/](../../drizzle) | DB 정의와 SQL·메타데이터 이력 | [운영](../operations/OPERATIONS.md) |
| [patches/](../../patches) | 고정된 의존성 소스 패치 | [보안 정책](../../SECURITY.md) |
| [.github/](../../.github) | 자동 검증·선택적 실응답 평가 | [검증 명령](../../scripts/README.md#검사-선택) |

## 게임이 실행되는 길

```text
content/cases/*.json
  → scripts/content/build-content.mjs
    → content/generated/cases.json
      → app/story/engine.js           진행·거래·저장
      → app/game-data.ts              타입·검증, API 데이터

app/page.tsx
  → app/game-client.tsx
    → app/story/story-client.tsx      화면과 상호작용
      → app/api/ai-chat/route.ts      선택적 AI 답장
```

생성물은 직접 편집하지 않습니다. 사건 원본과 작성 대사·조건의 위치는 [콘텐츠 지도](../../content/README.md), 화면·메시지·보고서의 위치는 [게임 코드 지도](../../app/story/README.md)에서 찾습니다.

## 루트에 남기는 파일

| 종류 | 파일 |
| --- | --- |
| 첫 안내·권리·보안 | [README](../../README.md), [LICENSE](../../LICENSE.md), [SECURITY](../../SECURITY.md) |
| 실행·의존성 | [package.json](../../package.json), [pnpm-lock.yaml](../../pnpm-lock.yaml), [pnpm-workspace.yaml](../../pnpm-workspace.yaml) |
| 프레임워크·타입·스타일 | vite.config.ts, next.config.ts, tsconfig.json, eslint.config.mjs |
| DB·배포 설정 | drizzle.config.ts, [.openai/hosting.json](../../.openai/hosting.json) |
| 환경 예시·추적 규칙 | .env.example, .gitignore, .gitattributes |

## 활성·과거·로컬 산출물

| 구분 | 위치 | 처리 원칙 |
| --- | --- | --- |
| 활성 콘텐츠 | `content/cases/` | 빌드 원본 |
| 과거 콘텐츠 | `content/archive/excluded/`, `content/archive/v2/` | 런타임에서 읽지 않으며 삭제하지 않음 |
| 과거 픽셀 자산 | `public/assets/pixel/` | 코드 참조는 없지만 정적 배포에 포함될 수 있어 출처와 함께 보존 |
| 의존성·빌드·로컬 작업물 | `node_modules/`, `dist/`, `.next/`, `.vinext/`, `.wrangler/`, `outputs/`, `.sites-runtime/` | Git 추적 제외 |

현재 공개 기준은 [공개 데모 안내](../game/PUBLIC_DEMO.md#확인-기준), 진행 과제와 완료 조건은 [ROADMAP](ROADMAP.md)에서 관리합니다.
