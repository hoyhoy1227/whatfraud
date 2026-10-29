# 사기방지위원회 — 전체 구조

목적: 저장소에서 수정할 위치와 실행 연결을 빠르게 찾도록 안내합니다. 세부 파일 설명은 각 소스 폴더의 README에서 관리합니다.

## 폴더 지도

| 폴더 | 역할 | 상세 안내 |
| --- | --- | --- |
| [app/](../../app) | 페이지·스타일·AI API | [게임 코드 지도](../../app/story/README.md) |
| [content/](../../content) | 활성 사건·생성물·스키마·과거 콘텐츠 | [콘텐츠 지도](../../content/README.md) |
| [public/](../../public) | 공유 이미지·아이콘·음원·보존 자산 | [출처·권리](../legal/THIRD_PARTY_NOTICES.md) |
| [tools/](../../tools) | 개발 설정·생성·검사·테스트·자산 도구·의존성 패치 | [개발 도구 지도](../../tools/README.md) |
| [docs/](../README.md) | 게임·개발·운영 문서 | [문서 안내](../README.md) |
| [drizzle/](../../drizzle) | DB 정의·SQL·메타데이터·생성 설정 | [운영](../operations/OPERATIONS.md) |
| [.github/](../../.github) | 자동 검증·선택적 실응답 평가·보안 정책 | [보안 정책](../../.github/SECURITY.md) |
| [.openai/](../../.openai) | 기존 Sites 프로젝트·DB 바인딩 | [배포 설정](../../.openai/hosting.json) |

## 게임이 실행되는 길

```text
content/cases/*.json
  → tools/content/build-content.mjs
    → content/generated/cases.json
      → app/story/engine.js           진행·거래·저장
      → app/game-data.ts              타입·검증, API 데이터

app/page.tsx
  → app/game-client.tsx
    → app/story/story-client.tsx      화면과 상호작용
      → app/api/ai-chat/route.ts      선택적 AI 답장
```

생성물은 직접 편집하지 않습니다. 사건 원본과 작성 대사·조건의 위치는 [콘텐츠 지도](../../content/README.md), 화면·메시지·보고서의 위치는 [게임 코드 지도](../../app/story/README.md)에서 찾습니다.

## 최상위에 남긴 파일

| 파일 | 남긴 이유 |
| --- | --- |
| [README](../../README.md), [LICENSE](../../LICENSE.md) | 저장소 첫 화면과 프로젝트 이용 조건 |
| [package.json](../../package.json), [pnpm-lock.yaml](../../pnpm-lock.yaml), [pnpm-workspace.yaml](../../pnpm-workspace.yaml) | 루트에서 설치·실행하고 고정 버전·패치를 적용하는 기준 |
| [vite.config.ts](../../vite.config.ts) | Vinext가 자동으로 찾아 Sites·Cloudflare 빌드 연결을 불러오는 진입점 |
| [tsconfig.json](../../tsconfig.json) | 편집기·타입 검사·프레임워크가 자동으로 읽는 타입·import 경로 설정 |
| [.gitignore](../../.gitignore), [.gitattributes](../../.gitattributes) | 저장소 전체의 추적 제외·줄바꿈 규칙 |

## 통합한 위치

| 묶음 | 현재 위치 | 연결 방식 |
| --- | --- | --- |
| 스크립트·의존성 패치 | `tools/`의 역할별 폴더, `tools/patches/` | 기존 `pnpm` 명령명과 패치 내용을 유지하고 참조 경로 갱신 |
| 코드 검사·환경 예시 | `tools/config/` | `pnpm lint`가 설정을 지정. 환경 예시는 필요한 경우 루트 `.env.local`로 복사 |
| DB 정의·생성 설정 | `drizzle/schema.ts`, `drizzle/drizzle.config.ts` | `pnpm db:generate`가 설정을 지정. 기존 SQL·metadata 경로 유지 |
| 보안 정책 | `.github/SECURITY.md` | GitHub가 지원하는 보안 정책 위치로 이동 |
| 비어 있던 Next 설정 | 제거 | 빈 객체만 내보내던 파일. Vinext의 기본 설정 사용 |

상세 명령과 개발 설정은 [도구 지도](../../tools/README.md#설정과-패치), 실행·배포 절차는 [운영 안내](../operations/OPERATIONS.md)에서 관리합니다.

## 활성·과거·로컬 산출물

| 구분 | 위치 | 처리 원칙 |
| --- | --- | --- |
| 활성 콘텐츠 | `content/cases/` | 빌드 원본 |
| 과거 콘텐츠 | `content/archive/excluded/`, `content/archive/v2/` | 런타임에서 읽지 않으며 삭제하지 않음 |
| 과거 픽셀 자산 | `public/assets/pixel/` | 코드 참조는 없지만 정적 배포에 포함될 수 있어 출처와 함께 보존 |
| 의존성·빌드·로컬 작업물 | `node_modules/`, `dist/`, `.next/`, `.vinext/`, `.wrangler/`, `outputs/`, `.sites-runtime/` | Git 추적 제외 |

현재 공개 기준은 [공개 데모 안내](../game/PUBLIC_DEMO.md#확인-기준), 진행 과제와 완료 조건은 [ROADMAP](ROADMAP.md)에서 관리합니다.
