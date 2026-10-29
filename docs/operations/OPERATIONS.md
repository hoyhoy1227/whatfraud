# 사기방지위원회 — 실행·검증·운영

목적: 개발 환경, AI·DB 설정, 배포와 복구 절차를 관리합니다. 파일별 검사 목록은 [스크립트 지도](../../scripts/README.md), 게임 설명은 [공개 데모 안내](../game/PUBLIC_DEMO.md)에 둡니다.

## 실행과 검증

Node.js **22.13 이상**, pnpm **11.25.0**을 사용합니다. `package.json`의 packageManager와 설치 workflow에서 같은 pnpm을 고정합니다.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

| 단계 | 명령 |
| --- | --- |
| 문서·데이터 | `pnpm docs:check` · `pnpm content:check` · `pnpm dialogue:check` |
| 게임 회귀 | `pnpm test` |
| 정적 검사·빌드 | `pnpm lint` · `pnpm exec tsc --noEmit` · `pnpm build` |
| 보안·의존성 | `pnpm security:check` · `pnpm dependencies:check` |
| DB 생성 확인 | `pnpm db:generate` 후 `git diff --exit-code -- drizzle/` |

검사 범위는 [명령 안내](../../scripts/README.md#검사-선택), 실행 순서는 [CI](../../.github/workflows/validate.yml)가 기준입니다.

- `predev / prebuild / prelint`는 Node로 사전 검사를 실행합니다.
- 활성 원본 수정 후 `pnpm content:build`로 생성물을 갱신합니다. 생성물·Markdown은 LF를 유지합니다.
- 로컬 도구 산출물이 검사에 섞이면 `pnpm lint --ignore-pattern .wrangler --ignore-pattern .vinext --ignore-pattern outputs`로 추가 제외할 수 있습니다.
- 자동 검사는 브라우저·실기기 검수나 실제 Gemini 응답 품질 평가와 구분합니다.

## 선택적 AI 설정

| 항목 | 공개 데모 기준 구현 |
| --- | --- |
| 키·중단 | 서버 전용 `GEMINI_API_KEY`, `GEMINI_ENABLED=false`는 생성 중단. [환경 예시](../../.env.example) |
| 모델 | 코드의 `gemini-3.5-flash-lite`. 공급자 사용 가능 여부는 별도 확인 |
| 생성 창구·한도 | 지정된 결정/인물 장면. 사건별 2/2/1, 새 실행 전체 최대 5회 |
| 대기·출력 | 공급자 45초, 최대 500토큰. 브라우저는 공유 응답 제한 시간 사용 |
| 요청 간격·동시성 | 세션 최소 12초, 인스턴스 공급자 동시 2개 |
| 인스턴스 보조 제한 | 세션 분당 5/하루 30, IP 분당 10/하루 120, 지정 순간별 1 |
| 공용 D1 예약 | 모든 Worker 합계 분당 20/UTC 하루 240. 실패·지연·소진 시 생성 중단 |
| 실패 처리 | 전송·할당량 자동 재시도 없음. 품질 실패는 원래 마감 안에서 수정 요청 최대 1회, 내장 대사 전환 |

- AI는 기본 꺼짐이며 동의 화면에 허구·전송·개인정보·5회 한도를 안내합니다. 나이 확인 절차는 없습니다.
- 지정된 장면·단계·첨부 ID·역할·길이를 검사합니다. 모든 자유 입력을 공급자로 보내지 않습니다.
- 공용 예약은 생성 직전 원자적 SQL로 수행하며, 실패·취소된 요청도 환불하지 않습니다.
- 같은 사용자·문맥의 중복 요청은 인스턴스 내에서 일시적으로 합칩니다. 원문·해시를 영구 로그로 남기지 않습니다.
- 화면 이동 후 늦은 응답을 무시합니다. 이미 공급자에게 전달된 사용량의 취소를 보장하지 않습니다.
- Origin·세션·인스턴스 제한은 인증·봇 차단·전체 과금 상한이 아닙니다. 공급자 청구와 다른 배포의 같은 키 사용은 별개입니다.
- 키는 서버 Secret에만 두고 소스·채팅·CI·로그·캡처에 넣지 않습니다. 런타임 Secret은 hosting 설정·환경 예시와 별개입니다.

서비스 조건은 [제3자 고지](../legal/THIRD_PARTY_NOTICES.md), 방어 범위는 [SECURITY](../../SECURITY.md)를 참고하세요.

## 배포·DB·복구

공개 주소·버전·소스는 [공개 기준](../game/PUBLIC_DEMO.md#확인-기준)에서 관리합니다. 저장소 반영과 공개 배포는 별도입니다.

1. 배포할 커밋·검증 결과·공개 기준과의 차이를 확인합니다.
2. `.openai/hosting.json`의 기존 project ID와 `d1: DB`를 유지합니다.
3. 배포 소스·빌드 SHA·저장 버전을 일치시킵니다.
4. `db/schema.ts`, `drizzle/` SQL·metadata, D1 바인딩을 대조합니다. 런타임에서 임의 DDL을 실행하지 않습니다.
5. 요청된 버전을 배포한 뒤 성공 상태·URL·SHA·검수 범위를 기록합니다.
6. `GET /api/ai-chat`은 설정 모드 확인용입니다. DB 연결·실제 Gemini 응답 성공을 보장하지 않습니다.

| 상황 | 처리 |
| --- | --- |
| 생성 장애·비용 중단 | `GEMINI_ENABLED=false` 설정 후 대상 버전 재배포, 준비된 메시지로 진행 확인 |
| DB 장애 | 생성 중단을 유지하고 바인딩·스키마·시간창 확인 |
| 롤백 | 알려진 저장 버전 선택, DB·기기 저장의 후방 호환 검토 |
| 키 유출 | 기존 키 사용 중단·사용량 확인 → 새 Secret → 재배포·확인 → 기존 키 폐기 |

실응답 평가는 명시적 비용 동의와 `--allow-live`가 필요한 [수동 workflow](../../.github/workflows/live-gemini.yml)로 분리합니다. 기본 CI는 실제 AI 키를 사용하지 않습니다.

## 저장·로그

| 대상 | 저장 범위 |
| --- | --- |
| 기기 진행 | 허용된 행동 이벤트. 복원 시 잔액·거래·결말 재계산 |
| 본편·짧은 체험·되감기 | 저장·원본 상태 분리 |
| 자유 입력·생성 답장 | 진행 저장에 원문을 남기지 않음 |
| 앱 로그 | 사전 정의된 결과·상태 코드. 호스팅 요청 로그와 별개 |
| D1 | 공용 예산 시간창·카운터 |

중앙 플레이 분석은 구현하지 않았습니다. 검수용 `training / review` 필드는 화면 미사용만으로 삭제하지 않습니다.

## 공개 기준 정리 검증 기록

| 기록 | 결과·보완 |
| --- | --- |
| [#131](https://github.com/hoyhoy1227/whatfraud/actions/runs/40819833335) | 파일명·게임·타입·빌드 통과, 미보완 의존성 경고 항목 51개로 실패 |
| [#132](https://github.com/hoyhoy1227/whatfraud/actions/runs/40822472493) | 로컬 pnpm 11 / CI pnpm 10의 patchedDependencies 형식 불일치로 설치 실패 |
| [#133](https://github.com/hoyhoy1227/whatfraud/actions/runs/40844066936) | pnpm 11.25.0 통일 후 문서·설치·게임·타입·빌드·의존성 검사 전체 통과 |

## 검사 #131 실패 원인과 보완

Next.js·Vite와 전이 의존성을 수정 버전으로 고정하고 lockfile을 갱신했습니다. undici·fast-uri·brace-expansion·source-map-js·sharp·zod·satori와 갱신 과정에서 드러난 fflate를 포함합니다. Windows의 pnpm.cmd 실행 경로도 보완했습니다.

미보완 경고는 0개로 확인했습니다. image-size의 기존 경고 2개는 [보안 정책](../../SECURITY.md)의 패치·악성 입력 종료·PNG 회귀 검사를 통과한 경우에만 보완됨으로 분류하며 예외 목록을 늘리지 않습니다. 전체 보안 감사 완료를 뜻하지는 않습니다.

최종 상태는 [최신 Validate game](https://github.com/hoyhoy1227/whatfraud/actions/workflows/validate.yml)을 기준으로 확인합니다. 세부 보안 과제는 [ROADMAP](../development/ROADMAP.md), 이용 조건은 [LICENSE](../../LICENSE.md)에서 관리합니다.
