# 제3자 라이선스 고지

이 문서는 WhatFraud가 직접 사용하거나 사용자가 선택적으로 연결할 수 있는 주요 제3자 구성 요소를 안내합니다. 정확한 의존성 버전은 `package.json`과 `pnpm-lock.yaml`에서 확인할 수 있으며, 각 구성 요소의 원본 배포물과 라이선스 파일이 최종 기준입니다.

## 외부 AI 서비스

공개 게임의 선택적 보조 대화는 Google Gemini API의 안정 모델 `gemini-3.6-flash`를 사용합니다. Gemini 모델 가중치나 Google SDK는 이 저장소에 포함하지 않으며, 서버가 HTTPS REST API를 호출합니다. 이용에는 [Gemini API 추가 서비스 약관](https://ai.google.dev/gemini-api/terms)과 [요금·무료 등급 조건](https://ai.google.dev/gemini-api/docs/pricing)이 적용됩니다. 무료 등급의 입력·출력 데이터 취급 조건은 유료 서비스와 다를 수 있으므로 실제 개인정보를 입력하지 않아야 합니다.

## 주요 웹 애플리케이션 의존성

| 구성 요소 | 현재 선언 버전 | 라이선스 | 공식 정보 |
| --- | ---: | --- | --- |
| React / React DOM | 19.2.6 | MIT License | [React 라이선스](https://github.com/facebook/react/blob/main/LICENSE) |
| Next.js | 16.2.6 | MIT License | [Next.js 패키지 정보](https://github.com/vercel/next.js/blob/canary/packages/next/package.json) |
| Vinext | 1.0.0-beta.3 | MIT License | [Vinext 공식 저장소](https://github.com/cloudflare/vinext) |
| Vite | 8.0.13 | MIT License | [Vite 라이선스](https://github.com/vitejs/vite/blob/main/LICENSE) |
| Tailwind CSS | 4.2.1 | MIT License | [Tailwind CSS 공식 저장소](https://github.com/tailwindlabs/tailwindcss) |

위 표는 이해를 돕기 위한 주요 항목 요약이며 전체 전이 의존성 목록을 대신하지 않습니다. 빌드 결과나 의존성 자체를 배포하기 전에는 설치된 각 패키지에 포함된 `LICENSE`, `NOTICE`, `COPYING` 파일과 패키지 메타데이터를 확인하고 필요한 고지를 함께 제공해야 합니다. 특히 프레임워크가 묶어 배포하는 전이 의존성에는 서로 다른 라이선스가 적용될 수 있습니다.

## 프로젝트 자료와 제3자 자료의 관계

- WhatFraud가 직접 작성한 코드와 콘텐츠에는 [LICENSE.md](LICENSE.md)가 적용됩니다.
- 제3자 구성 요소는 각 구성 요소의 원래 라이선스에 따라 사용할 수 있습니다.
- 제3자 오픈 소스 라이선스가 WhatFraud 자체 콘텐츠의 별도 사용 권한을 부여하는 것은 아닙니다.
- 저장소에는 AI 모델 가중치, 실제 금융기관의 상표·로고 또는 실존 피해자의 개인정보가 포함되지 않습니다.

이 문서는 편의를 위한 정보이며 법률 자문이 아닙니다. 배포 방식이나 상업적 이용 범위에 따라 추가 의무가 생길 수 있습니다.
