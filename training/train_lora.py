"""LoRA/QLoRA supervised fine-tuning for the browser-compatible Qwen model."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from torch.utils.data import Dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    DataCollatorForSeq2Seq,
    Trainer,
    TrainingArguments,
)


class ChatDataset(Dataset):
    def __init__(self, path: Path, tokenizer, max_length: int):
        self.rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index):
        messages = self.rows[index]["messages"]
        prompt_text = self.tokenizer.apply_chat_template(messages[:-1], tokenize=False, add_generation_prompt=True)
        full_text = self.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
        prompt = self.tokenizer(prompt_text, add_special_tokens=False, truncation=True, max_length=self.max_length)
        full = self.tokenizer(full_text, add_special_tokens=False, truncation=True, max_length=self.max_length)
        input_ids = full["input_ids"]
        prompt_length = min(len(prompt["input_ids"]), len(input_ids))
        labels = [-100] * prompt_length + input_ids[prompt_length:]
        return {"input_ids": input_ids, "attention_mask": full["attention_mask"], "labels": labels}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="Qwen/Qwen2.5-0.5B-Instruct")
    parser.add_argument("--train", type=Path, default=Path("training/output/data/train.jsonl"))
    parser.add_argument("--eval", type=Path, default=Path("training/output/data/eval.jsonl"))
    parser.add_argument("--output", type=Path, default=Path("training/output/adapter"))
    parser.add_argument("--epochs", type=float, default=3.0)
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--gradient-accumulation", type=int, default=8)
    parser.add_argument("--max-length", type=int, default=768)
    parser.add_argument("--qlora", action="store_true")
    args = parser.parse_args()

    if not args.train.is_file() or not args.eval.is_file():
        raise FileNotFoundError("먼저 training/build_dataset.py를 실행해 학습·평가 데이터를 만드세요.")
    if args.qlora and not torch.cuda.is_available():
        raise RuntimeError("QLoRA는 CUDA GPU와 bitsandbytes가 필요합니다.")

    tokenizer = AutoTokenizer.from_pretrained(args.model, use_fast=True)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token

    quantization_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16,
        bnb_4bit_use_double_quant=True,
    ) if args.qlora else None
    dtype = torch.bfloat16 if torch.cuda.is_available() and torch.cuda.is_bf16_supported() else torch.float16 if torch.cuda.is_available() else torch.float32
    model = AutoModelForCausalLM.from_pretrained(
        args.model,
        torch_dtype=dtype,
        device_map="auto" if torch.cuda.is_available() else None,
        quantization_config=quantization_config,
    )
    if args.qlora:
        model = prepare_model_for_kbit_training(model)
    model.config.use_cache = False
    model = get_peft_model(model, LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    ))
    model.print_trainable_parameters()

    train_dataset = ChatDataset(args.train, tokenizer, args.max_length)
    eval_dataset = ChatDataset(args.eval, tokenizer, args.max_length)
    use_bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()
    trainer = Trainer(
        model=model,
        args=TrainingArguments(
            output_dir=str(args.output),
            num_train_epochs=args.epochs,
            learning_rate=args.learning_rate,
            per_device_train_batch_size=args.batch_size,
            per_device_eval_batch_size=1,
            gradient_accumulation_steps=args.gradient_accumulation,
            gradient_checkpointing=True,
            logging_steps=1,
            eval_strategy="epoch",
            save_strategy="epoch",
            save_total_limit=2,
            bf16=use_bf16,
            fp16=torch.cuda.is_available() and not use_bf16,
            report_to=[],
            remove_unused_columns=False,
            seed=2409,
        ),
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        data_collator=DataCollatorForSeq2Seq(tokenizer=tokenizer, padding=True, label_pad_token_id=-100),
    )
    trainer.train()
    metrics = trainer.evaluate()
    trainer.save_model(str(args.output))
    tokenizer.save_pretrained(str(args.output))
    (args.output / "evaluation.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    print(f"LoRA 학습 완료: {args.output}")


if __name__ == "__main__":
    main()
