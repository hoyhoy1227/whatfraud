# 사기방지위원회 — 스크립트 지도

목적: 작업 목적에 맞는 도구와 검사를 찾도록 안내합니다. 모든 명령은 저장소 루트에서 실행하며, Node.js 22.13 이상·pnpm 11.25.0을 사용합니다.

## 폴더별 역할

| 폴더 | 들어 있는 도구 |
| --- | --- |
| [content/](content) | 활성 사건 검사·통합 생성 |
| [dialogue/](dialogue) | 내장 대사 평가·공통 규칙·선택적 Gemini 평가 |
| [checks/](checks) | 문서·보안·의존성·출시 조건 검사 |
| [tests/](tests) | 진행·저장·첨부·대화·보고서·API·공용 예산 회귀 검사 |
| [media/](media) | 공유 이미지 생성·음원 변환 |

## 검사 선택

| 확인할 것 | 실행 명령 | 주요 범위 |
| --- | --- | --- |
| 문서·폴더 참조 | `pnpm docs:check` | 파일명·UTF-8·로컬 링크·제목 링크 |
| 콘텐츠 원본·생성물 | `pnpm content:check` | 원본 규격과 생성물 일치 |
| 내장 대사 | `pnpm dialogue:check` | 길이·위험 표현·반복 |
| 진행·저장·보고서 | `pnpm test:story` | 분기·중복 거래·첨부·결정 메시지·대화 순서·보고서·증거 메모 |
| UI 구조 | `pnpm test:ui` | SSR·표현·소스 회귀 |
| API·공용 예산 | `pnpm test:api` | 모의 공급자·실패 전환·SQLite 예약 |
| 전체 게임 회귀 | `pnpm test` | 위 story → UI → API 검사 |
| 추적 파일 보안 | `pnpm security:check` | 비밀 형식·인증 파일·workflow 고정 |
| 의존성 보안 | `pnpm dependencies:check` | 감사·기존 이미지 파서 패치 검사 |
| 출시 조건 | `pnpm release:check` | 3막 순서·무AI 결말·서버 방어·배포 바인딩 |

`pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`는 정적 검사·타입·빌드 확인에 사용합니다. 실제 CI 순서는 [Validate game](../.github/workflows/validate.yml)이 기준입니다.

## 생성·평가 도구

| 작업 | 진입점 | 주의할 점 |
| --- | --- | --- |
| 콘텐츠 통합 | `pnpm content:build` | `content/cases` 수정 후 실행 |
| 선택적 실응답 평가 | `pnpm dialogue:gemini:evaluate --allow-live` | 명시적 허용 시 실제 요청·비용 발생. 기본 검사와 분리 |
| 공유 이미지 생성 | [media/build-brand.mjs](media/build-brand.mjs) | 기존 SVG에서 PNG·JPEG·아이콘 사본 생성. 필요 시 sharp 모듈 경로 전달 |
| 음원 변환 | [media/prepare-audio.mjs](media/prepare-audio.mjs) | 원본 WAV와 필요 시 출력 경로 전달. 원본 이용 조건 별도 확인 |

예: `node scripts/media/prepare-audio.mjs <source.wav> [destination.wav]`

## 검사 결과를 읽을 때

- 게임·UI 회귀 검사는 실제 브라우저·터치·실기기 사용성을 보증하지 않습니다.
- 내장 대사 검사와 모의 API 검사는 실제 Gemini 응답 품질 평가가 아닙니다.
- 의존성 검사는 알려진 감사 결과와 기존 패치 검증이며 전체 보안 감사가 아닙니다.

[운영·복구](../docs/operations/OPERATIONS.md) · [보안 정책](../SECURITY.md)
