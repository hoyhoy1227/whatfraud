# 사기방지위원회 — 실행·검증·운영

목적: 공개 데모 v76 기준 소스의 실행 명령, AI·DB 설정, 배포와 복구 절차를 관리합니다. 게임·콘텐츠 설명은 [공개 데모 안내](../game/PUBLIC_DEMO.md)와 [프로젝트 구조](../development/PROJECT_STRUCTURE.md)에 둡니다.

## 실행과 검증

Node.js 22.13 이상과 pnpm 11.25.0을 사용합니다. `package.json`의 packageManager와 설치 workflow에서 같은 pnpm 버전을 고정합니다. 패키지·버전의 기준은 `package.json`, `pnpm-lock.yaml`, 설치 스크립트 허용 목록은 `pnpm-workspace.yaml`입니다.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

| 명령 | 범위 |
| --- | --- |
| `pnpm docs:check` | 추적 파일명·Markdown UTF-8·로컬 문서/파일/제목 링크 검사 |
| `pnpm content:build` | 활성 3막 JSON 검사와 통합 생성 |
| `pnpm content:check` | 원본 검수와 생성물 일치 확인 |
| `pnpm dialogue:check` | 활성 3사건의 내장 후보 응답 안전·길이·반복 검사 |
| `pnpm release:check` | 3막 순서·예산 데이터·무AI 결말·서버 방어·배포 바인딩 |
| `pnpm lint` | 사전 콘텐츠·대사 검사 후 ESLint |
| `pnpm exec tsc --noEmit` | 타입 검사 |
| `pnpm build` | 사전 콘텐츠·대사·출시 검사 후 Vinext 빌드 |

`predev / prebuild / prelint`는 Node로 검사를 실행하므로 npm 진입점에서도 동작합니다. 기존 `dist/`가 남아 있다는 사실만으로 이번 빌드 성공을 판단하지 않습니다. 생성물은 LF로 비교하므로 `.gitattributes`에서 해당 JSON과 Markdown의 LF를 유지합니다. 오래된 Windows 체크아웃에서 줄바꿈만 달라 검사에 실패하면 `pnpm content:build`로 다시 생성합니다.

### CI 회귀 검사

[Validate game](../../.github/workflows/validate.yml)의 실제 명령이 기준입니다.

- `docs:check`: 비정상 파일명, 삭제된 파일 참조, 이동 후 링크·제목 누락 검사.

- Drizzle 생성 후 `drizzle/` diff 검사.
- `check-security.mjs`: 현재 추적 파일의 비밀 형식·인증 파일 검사.
- `test-ai-chat.mjs`, `test-budget.mjs`: 모의 API·SQLite 공용 예산.
- `test-story.mjs`, `test-story-ui.mjs`: 진행·저장·모드·되감기·SSR/소스 회귀.
- `test-attachment-branches.mjs`, `test-decision-messages.mjs`, `test-message-transcript.mjs`, `test-response-report.mjs`: 첨부·결정 메시지·대화 순서·보고서 회귀.
- lint·타입·빌드·`check-dependencies.mjs`. 의존성 audit는 통신 실패도 실패로 처리.
- 성공 빌드의 `dist/` Artifact 보관은 workflow 설정을 따름.

AI 실호출과 브라우저·실기기 검수는 위 자동 검사와 별개입니다.

## 공개 기준 정리 검증 기록

2026-10-28, 공개 v76 소스를 반영한 커밋 `900ac76`의 [GitHub Validate game 실행](https://github.com/hoyhoy1227/whatfraud/actions/runs/40703626921)을 확인했습니다.

| 검사 | 결과 |
| --- | --- |
| 고정 lockfile 설치·Drizzle 생성/diff·추적 파일 보안 검사 | GitHub CI 통과 |
| 진행·첨부·결정 메시지·대화 순서·보고서·모의 AI·공용 예산 | GitHub CI 통과 |
| 콘텐츠·대사·lint·타입·프로덕션 빌드 | 로컬 및 GitHub CI 통과 |
| 증거 메모 검사·UTF-8·문서 내부 링크 | 로컬 통과 |
| 의존성 감사 | GitHub CI 실패: 미보완 경고 항목 51개. image-size 자체 패치로 보완한 2개 ID와 구분 |

의존성 감사에는 Next.js·Vite·undici·fast-uri 등 직접/전이 패키지가 포함되며 중복 경로가 있을 수 있습니다. 이 수치를 서로 다른 취약점 51종으로 단정하지 않습니다. 패키지·lockfile은 공개 데모 원본과 동일하게 유지했고, 보안 갱신은 [ROADMAP](../development/ROADMAP.md)에 남겼습니다. 검사 예외를 늘리거나 실패를 성공으로 바꾸지 않았습니다.

로컬 Windows에서는 `check-dependencies.mjs`의 파서 패치 검사는 실행됐지만 `spawnSync('pnpm')`이 ENOENT로 실패해 감사 전체를 완료하지 못했습니다. 위 감사 결과는 Ubuntu CI에서 실제 실행된 결과입니다. 브라우저 직접 검토·실제 Gemini 호출·공개 재배포는 수행하지 않았습니다.

## 검사 #131 실패 원인과 보완

2026-10-29 확인한 [검사 #131](https://github.com/hoyhoy1227/whatfraud/actions/runs/40819833335)은 PR #43의 병합 이후 실행된 Validate game입니다. 파일명·게임 검사·타입·빌드는 통과했고, 마지막 의존성 감사에서 미보완 경고 항목 51개로 실패했습니다.

| 대상 | 보완 |
| --- | --- |
| Next.js / eslint-config-next | 16.4.1로 함께 갱신 |
| Vite | 8.1.6으로 고정 |
| HTTP·URI 처리 | undici 7.30.1, fast-uri 3.1.9 |
| 빌드·이미지 처리 | brace-expansion 1.1.21/5.0.12, source-map-js 1.2.2, sharp 0.35.5 |
| 스키마·렌더링·압축 | zod 4.6.6, satori 0.33.5, fflate 0.7.5 |
| 설치 재현 | 수정 버전을 overrides와 lockfile에 고정, frozen-lockfile 설치 확인 |
| Windows 감사 실행 | pnpm.cmd를 직접 실행하던 ENOENT를 고정된 cmd 실행 경로로 보완 |
| CI 설치 도구 | pnpm 10/11의 patchedDependencies 형식 차이를 해소하도록 packageManager와 설치 workflow를 모두 11.25.0으로 고정 |

공식 npm 메타데이터의 배포 버전·호환 조건과 감사의 수정 범위를 확인했습니다. Next.js·Vite 등의 근거는 [Next.js 보안 고지](https://github.com/vercel/next.js/security/advisories), [Vite 보안 고지](https://github.com/vitejs/vite/security/advisories)를 참고할 수 있습니다.

보완 후 로컬 `node scripts/check-dependencies.mjs` 결과는 `unmitigated: []`입니다. 갱신 과정에서 새로 드러난 fflate 경고도 포함해 수정했습니다. image-size의 기존 경고 2개는 아래 보안 정책대로 패치·악성 입력 종료·PNG 회귀 검증을 통과한 경우에만 보완됨으로 분류하며, 예외 목록은 늘리지 않았습니다. 전체 보안 감사 완료를 뜻하지 않습니다.

문서 정리는 `docs:check`로 추적 파일명·UTF-8·로컬 링크를 검사합니다. GitHub의 최종 상태는 [최신 Validate game 실행](https://github.com/hoyhoy1227/whatfraud/actions/workflows/validate.yml)을 기준으로 확인합니다. 과거 실패 실행 #131은 원인 기록으로 보존합니다.

## 로컬 산출물과 lint

ESLint는 공개 데모 소스의 설정대로 `.sites-runtime/` 로컬 배포 산출물을 제외합니다. `.wrangler/`·`.vinext/` 등의 도구 산출물까지 남아 있는 환경에서는 아래 명령으로 추가 제외할 수 있습니다. 기본 CI는 `pnpm lint`를 사용합니다.

```bash
pnpm lint --ignore-pattern .sites-runtime --ignore-pattern .wrangler --ignore-pattern .vinext
```

## 선택적 AI 설정

| 항목 | 공개 데모 기준 구현 |
| --- | --- |
| 키 | 서버 전용 `GEMINI_API_KEY`; [예시](../../.env.example). 공개 접두사 사용 금지 |
| 중단 스위치 | `GEMINI_ENABLED=false`는 생성을 중단. 준비된 메시지로 게임 진행 가능 |
| 모델 ID | 코드의 `gemini-3.5-flash-lite`. 공급자 사용 가능 여부는 별도 확인 |
| UI 생성 창구 | 결정 직전 메시지와 인물 메시지. 사건별 2/2/1, 새 실행 전체 최대 5회 |
| 공통 한도 | `decision-message.js`의 `AI_CASE_LIMITS / AI_RUN_LIMIT`과 콘텐츠 `story.aiLimit`을 함께 유지 |
| 공급자 대기·출력 | 45초, 출력 최대 500토큰. 브라우저는 공유된 응답 제한 시간 사용 |
| 요청 간격·병렬 | 세션 최소 12초, 인스턴스 공급자 동시 2개 |
| 인스턴스 보조 제한 | 세션 분당 5/하루 30, IP 분당 10/하루 120, 메시지 순간별 1 |
| 공용 D1 예약 | 분당 20/UTC 하루 240. DB 실패·지연·소진 시 생성하지 않음 |
| 실패·화면 이동 | 전송·할당량 실패 자동 재시도 없음. 품질 검사 실패 시 원래 마감 안에서 제한된 수정 요청 1회, 내장 대사 전환. 취소 후 늦은 응답 무시 |

- 클라이언트 AI는 기본 꺼짐입니다. 동의 화면에서 허구·전송·개인정보·5회 한도를 안내하며 나이 확인 절차는 없습니다. 서비스 이용 조건의 적합성은 별도 확인 대상입니다.
- 입력은 허용된 결정/인물 장면·단계·첨부 ID·역할·길이를 검사합니다. 일반 대화와 거래는 작성 데이터로 진행하며 모든 자유 입력을 공급자로 보내지 않습니다.
- 공용 예약은 생성 직전 단일 원자적 SQL로 수행하며 실패·취소 요청도 환불하지 않습니다.
- 동일 사용자·문맥의 중복 요청은 인스턴스 내에서 제한된 시간 합칩니다. 원문·해시를 영구 로그로 남기지 않습니다.
- 인스턴스 제한과 Origin 검사는 인증·봇 차단·전체 과금 상한이 아닙니다. 이 배포 외 동일 키 사용과 공급자 청구는 별개입니다.
- 실제 키를 소스·채팅·CI·로그·캡처에 넣지 않습니다. Sites 런타임 Secret과 로컬 예시 파일·hosting 설정은 별개입니다.

공급자 조건·권리 확인은 [제3자 고지](../legal/THIRD_PARTY_NOTICES.md), 방어 한계는 [SECURITY](../../SECURITY.md)에 둡니다.

## 배포 기준과 절차

공개 URL·버전·소스·확인 범위는 [공개 데모 안내](../game/PUBLIC_DEMO.md#확인-기준) 한 곳에서 관리합니다. 저장소 수정·소스 동기화·공개 배포는 별개이며, 이번 정리에서는 배포하지 않습니다.

1. 대상 커밋과 CI 결과를 확인합니다. 대상 소스가 공개 기준에서 어떻게 달라지는지 검토합니다.
2. `.openai/hosting.json`의 기존 project ID와 `d1: DB`를 유지합니다.
3. 요청된 배포 소스와 빌드 SHA를 일치시키고 해당 소스의 저장 버전을 만듭니다.
4. `db/schema.ts`, `drizzle/` SQL·metadata, D1 바인딩을 대조합니다. 런타임에서 임의 DDL을 실행하지 않습니다.
5. 명시적으로 요청된 버전을 배포하고 성공 상태·URL·소스 SHA·검수 범위를 기록합니다.
6. `GET /api/ai-chat`은 설정 모드 확인용입니다. DB 연결·실제 Gemini 성공을 보증하지 않습니다.
7. 별도 승인된 실응답 평가는 `--allow-live`가 필요한 평가 스크립트·수동 workflow를 사용합니다. 비용·표본 한도를 확인하고 원문을 로그에 남기지 않습니다.

## 복구와 키 교체

| 상황 | 처리 |
| --- | --- |
| 생성 장애·비용 중단 | `GEMINI_ENABLED=false`로 설정 후 대상 버전 재배포. 게임 내 준비된 메시지 확인 |
| DB 장애 | 자동 재시도 폭주 없이 생성 중단 상태 유지. 바인딩·스키마·시간창 확인 |
| 롤백 | 알려진 저장 버전 선택, DB·기기 저장의 후방 호환 검토 후 배포 |
| 키 유출 | 기존 키 사용 중단·사용량 확인 → 새 서버 Secret 설정 → 재배포·확인 → 기존 키 폐기 |

문자열을 Git에서 지우는 것만으로 유출 키가 무효화되지는 않습니다.

## 저장·로그·콘텐츠 편집

- 진행은 기기 내부 이벤트로 저장하고 복원 시 다시 계산합니다. 본편·짧은 체험·되감기를 분리합니다.
- 자유 입력·생성 답장 원문은 진행 저장에 남기지 않습니다. 서버로 중앙 플레이 분석을 보내는 기능은 없습니다.
- 앱 로그는 사전 정의된 결과 코드·상태 중심입니다. 호스팅 제공자 요청 로그와 구분합니다.
- D1은 공용 예산 시간창·카운터를 보관합니다.
- `content/cases` 원본 → `content:build` → `content/generated/cases.json` 순서로 편집합니다.
- 제작 근거·독립 확인 경로·안전 검수표와 `training` 호환 필드는 검사 대상이므로 화면 미사용만으로 삭제하지 않습니다.

## 관련 운영·권리 문서

| 문서 | 역할 |
| --- | --- |
| [SECURITY](../../SECURITY.md) | 제보·방어 범위·의존성 패치 예외 |
| [LICENSE](../../LICENSE.md), [THIRD_PARTY_NOTICES](../legal/THIRD_PARTY_NOTICES.md) | 자체 권리와 제3자 조건 |

특정 기기의 로컬 폴더·동기화 관행을 프로젝트 공통 개발 제한으로 두지 않습니다. 브랜치 보호·출품 적격성·전체 자산 증빙은 실제 설정과 자료를 확인해야 합니다.
