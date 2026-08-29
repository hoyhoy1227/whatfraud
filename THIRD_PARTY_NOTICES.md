# 제3자 라이선스 고지

이 문서는 WhatFraud가 직접 사용하거나 사용자가 선택적으로 연결할 수 있는 주요 제3자 구성 요소를 안내합니다. 정확한 의존성 버전은 `package.json`과 `pnpm-lock.yaml`에서 확인할 수 있으며, 각 구성 요소의 원본 배포물과 라이선스 파일이 최종 기준입니다.

## 선택적 로컬 AI 구성 요소

| 구성 요소 | 저장소 포함 여부 | 라이선스 | 공식 정보 |
| --- | --- | --- | --- |
| Qwen3.5-4B | 모델 가중치 미포함 | Apache License 2.0 (현재 공식 모델 페이지 기준) | [모델 페이지](https://huggingface.co/Qwen/Qwen3.5-4B), [라이선스 원문](https://www.apache.org/licenses/LICENSE-2.0) |
| llama.cpp | 실행 파일 및 소스 미포함 | MIT License | [공식 저장소 라이선스](https://github.com/ggml-org/llama.cpp/blob/master/LICENSE) |

다른 Qwen 체크포인트, GGUF 변환본, LoRA 어댑터 또는 파생 모델을 사용할 경우에는 해당 배포 페이지의 라이선스를 별도로 확인해야 합니다. 모델 파일을 재배포할 때에는 적용되는 라이선스의 고지·저작권 표시·변경 사항 표시 등 의무를 직접 준수해야 합니다.

## 주요 웹 애플리케이션 의존성

| 구성 요소 | 현재 선언 버전 | 라이선스 | 공식 정보 |
| --- | ---: | --- | --- |
| React / React DOM | 19.2.6 | MIT License | [React 라이선스](https://github.com/facebook/react/blob/main/LICENSE) |
| Next.js | 16.2.6 | MIT License | [Next.js 패키지 정보](https://github.com/vercel/next.js/blob/canary/packages/next/package.json) |
| Vinext | 1.0.0-beta.3 | MIT License | [Vinext 공식 저장소](https://github.com/cloudflare/vinext) |
| Vite | 8.0.13 | MIT License | [Vite 라이선스](https://github.com/vitejs/vite/blob/main/LICENSE) |
| Tailwind CSS | 4.2.1 | MIT License | [Tailwind CSS 공식 저장소](https://github.com/tailwindlabs/tailwindcss) |
| Transformers.js | 3.8.1 (브라우저 CDN 선택 로드) | Apache License 2.0 | [공식 저장소](https://github.com/huggingface/transformers.js) |

위 표는 이해를 돕기 위한 주요 항목 요약이며 전체 전이 의존성 목록을 대신하지 않습니다. 빌드 결과나 의존성 자체를 배포하기 전에는 설치된 각 패키지에 포함된 `LICENSE`, `NOTICE`, `COPYING` 파일과 패키지 메타데이터를 확인하고 필요한 고지를 함께 제공해야 합니다. 특히 프레임워크가 묶어 배포하는 전이 의존성에는 서로 다른 라이선스가 적용될 수 있습니다.

브라우저 Qwen 기능은 `onnx-community/Qwen2.5-0.5B-Instruct`의 ONNX 가중치를 방문자 브라우저가 Hugging Face에서 선택적으로 내려받습니다. 가중치는 저장소에 포함하지 않으며, 모델을 재배포하거나 미러링할 때에는 [모델 페이지](https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct)의 라이선스와 원본 Qwen 라이선스를 별도로 확인해야 합니다.

## 프로젝트 자료와 제3자 자료의 관계

- WhatFraud가 직접 작성한 코드와 콘텐츠에는 [LICENSE.md](LICENSE.md)가 적용됩니다.
- 제3자 구성 요소는 각 구성 요소의 원래 라이선스에 따라 사용할 수 있습니다.
- 제3자 오픈 소스 라이선스가 WhatFraud 자체 콘텐츠의 별도 사용 권한을 부여하는 것은 아닙니다.
- 저장소에는 모델 가중치, llama.cpp 바이너리, 실제 금융기관의 상표·로고 또는 실존 피해자의 개인정보가 포함되지 않습니다.

이 문서는 편의를 위한 정보이며 법률 자문이 아닙니다. 배포 방식이나 상업적 이용 범위에 따라 추가 의무가 생길 수 있습니다.
