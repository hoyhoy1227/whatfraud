# 사기방지위원회

익숙한 스마트폰 연락 속에서 자료를 확인하고, 선택이 남긴 결과를 돌아보는 인터랙티브 사기 체험 게임입니다.

**[공개 데모 플레이](https://whatfraud.hoyhoy1227.chatgpt.site/)** · [게임 안내](docs/game/PUBLIC_DEMO.md) · [문서 전체 보기](docs/README.md)

## 하루의 흐름

| 아침 | 낮 | 저녁 | 하루 끝 |
| --- | --- | --- | --- |
| 지인 이름으로 온 부탁 | 투자 자료방의 유료 분석 안내 | 피해 회수를 약속하는 연락 | 대응 보고서·결말·되감기 |
| 기존 연락처·수취인 확인 | 안내와 은행·독립 기록 비교 | 추가 요청의 근거 확인 | 선택 이전으로 돌아가 다른 대응 시도 |

- 메시지·전화·은행·브라우저·메모를 오가며 가상 거래와 확인·보류·차단을 선택합니다.
- 본편·이어하기·짧은 체험을 제공하며, 선택적 AI를 사용하지 않아도 완주할 수 있습니다.
- 모든 인물과 거래는 허구입니다. 실제 송금·전화 연결·신고 접수는 하지 않습니다.

## 저장소 한눈에 보기

```text
app/         게임 화면·진행·AI API
content/     실행 콘텐츠·스키마·과거 자료
public/      이미지·아이콘·음원
scripts/     콘텐츠 생성·검사·테스트·자산 도구
docs/        게임 안내·개발 기록·운영·권리 고지
db/          DB 정의
drizzle/     DB 변경 이력
.github/     자동 검증·수동 평가
```

| 하고 싶은 일 | 바로 가기 |
| --- | --- |
| 게임 이해 | [공개 데모 안내](docs/game/PUBLIC_DEMO.md) |
| 개발 과정 보기 | [문제 해결 기록](docs/development/DEVELOPMENT_JOURNEY.md) |
| 파일·콘텐츠 찾기 | [전체 구조](docs/development/PROJECT_STRUCTURE.md) · [게임 코드](app/story/README.md) · [콘텐츠](content/README.md) |
| 실행·검증하기 | [운영 안내](docs/operations/OPERATIONS.md) · [스크립트 안내](scripts/README.md) |

게임 기능·콘텐츠·자산은 공개 데모 v76의 소스 `7aadfed`를 기준으로 유지합니다. 문서·검증 도구·의존성은 이후 보완하며, [공개 기준](docs/game/PUBLIC_DEMO.md#확인-기준)에서 범위를 구분합니다. 영문 프로젝트 식별자는 `whatfraud`입니다.

[라이선스](LICENSE.md) · [제3자·자산 고지](docs/legal/THIRD_PARTY_NOTICES.md) · [보안](SECURITY.md). 공개 데모 제공이 소스·콘텐츠 재사용 허락을 뜻하지는 않습니다.
