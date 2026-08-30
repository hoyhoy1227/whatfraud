"""Merge a reviewed LoRA adapter into a standalone local Qwen checkpoint."""

from __future__ import annotations

import argparse
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="Qwen/Qwen2.5-0.5B-Instruct")
    parser.add_argument("--adapter", type=Path, default=Path("training/output/adapter"))
    parser.add_argument("--output", type=Path, default=Path("training/output/merged"))
    args = parser.parse_args()

    if not args.adapter.is_dir():
        raise FileNotFoundError("LoRA 어댑터 폴더가 없습니다. 먼저 train_lora.py를 실행하세요.")
    dtype = torch.bfloat16 if torch.cuda.is_available() and torch.cuda.is_bf16_supported() else torch.float16 if torch.cuda.is_available() else torch.float32
    base = AutoModelForCausalLM.from_pretrained(args.model, torch_dtype=dtype, device_map="auto" if torch.cuda.is_available() else None)
    merged = PeftModel.from_pretrained(base, args.adapter).merge_and_unload()
    merged.save_pretrained(args.output, safe_serialization=True, max_shard_size="2GB")
    AutoTokenizer.from_pretrained(args.model, use_fast=True).save_pretrained(args.output)
    print(f"어댑터 병합 완료: {args.output}")


if __name__ == "__main__":
    main()
