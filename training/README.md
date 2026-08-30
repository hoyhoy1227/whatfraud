# Qwen 로컬 튜닝

이 폴더에는 게임의 검수된 대화형 사건으로 LoRA를 학습하는 코드만 들어 있습니다. 모델 가중치, 어댑터, 생성된 학습 데이터와 플레이어 대화는 GitHub에 올리지 않으며 모든 출력은 `training/output/`에 만들어져 `.gitignore`로 제외됩니다.

## 기본 모델 선택

공개 게임의 브라우저 실행 모델과 결과를 연결하기 위해 기본값은 `Qwen/Qwen2.5-0.5B-Instruct`입니다. 작은 텍스트 모델이라 일반 PC에서 LoRA를 시험하기 쉽고, 병합 후 ONNX 양자화본을 별도 Hugging Face 저장소에 올리면 Transformers.js 모델 ID로 연결할 수 있습니다.

`Qwen/Qwen3.5-4B`는 더 최신이고 Apache-2.0으로 공개됐지만 멀티모달 구조와 더 큰 메모리 요구량 때문에 이 경량 브라우저 파이프라인의 기본값으로 사용하지 않습니다. 로컬 고성능 실험은 별도 환경에서 진행하고, 게임에는 OpenAI 호환 로컬 서버로 연결한 뒤 반복 평가를 먼저 통과시켜야 합니다.

## 1. 데이터 만들기

```powershell
python training/build_dataset.py
```

`content/generated/cases.json`에서 대화형 사건만 읽어 주제별 고정 질문과 검수된 답변을 만듭니다. 실제 플레이어 입력과 Qwen 실행 기록은 읽거나 저장하지 않습니다.

## 2. 환경과 LoRA 학습

```powershell
python -m venv training/.venv
training/.venv/Scripts/pip install -r training/requirements.txt
training/.venv/Scripts/python training/train_lora.py
```

CUDA 환경에서 4비트 QLoRA를 사용할 경우 호환되는 `bitsandbytes`를 별도로 설치한 뒤 `--qlora`를 붙입니다. Windows와 GPU 조합에 따라 지원 여부가 다르므로 설치 실패 시 일반 LoRA를 사용합니다.

## 3. 병합과 평가

```powershell
training/.venv/Scripts/python training/merge_adapter.py
```

병합 모델을 llama.cpp가 읽는 GGUF로 변환하거나 OpenAI 호환 로컬 서버에서 실행한 뒤 다음 평가를 통과해야 합니다.

```powershell
pnpm dialogue:qwen:evaluate -- --model whatfraud-qwen
```

평가는 실제 대화를 저장하지 않고 역할 이탈, 질문 대응, URL·전화번호·계좌 형태, 범죄 실행 정보와 반복 응답을 집계합니다. 전체 통과율 80% 미만이거나 실행·데이터·출력 필터 실패가 있으면 배포하지 않습니다.

## 4. 브라우저 모델로 내보내기

병합 모델을 Optimum ONNX 형식으로 변환하고 4비트 양자화한 뒤 별도 Hugging Face 모델 저장소에 업로드합니다. 가중치는 이 GitHub 저장소나 Sites 배포물에 넣지 않습니다. 변환 도구가 현재 Qwen 아키텍처와 `text-generation-with-past` 작업을 지원하는지 먼저 확인하세요.

배포 빌드에서 `NEXT_PUBLIC_QWEN_MODEL_ID`를 업로드한 Transformers.js 호환 모델 ID로 설정하면 게임이 해당 모델을 지연 로드합니다. 설정하지 않으면 검증된 기본 ONNX 모델을 계속 사용합니다.

## 안전 기준

- 사기 NPC는 게임 안의 가상 주장만 말하며 실제 범죄 실행법을 학습하지 않습니다.
- 실제 회사, 인물, 계좌, 전화번호, 작동 URL과 플레이어 개인정보를 데이터에 넣지 않습니다.
- 어댑터를 공개할 때에는 기본 모델의 Apache-2.0 조건, 변경 사항과 사용한 데이터의 권리를 함께 검토합니다.
- 모델 성능이 좋아져도 사건 정답과 점수는 고정 게임 코드에서만 결정합니다.
