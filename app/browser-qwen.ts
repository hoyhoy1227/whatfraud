export type BrowserQwenMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type ProgressEvent = { status?: string; progress?: number; file?: string };
type TextGenerationPipeline = (messages: BrowserQwenMessage[], options?: Record<string, unknown>) => Promise<unknown>;
type TransformersModule = {
  pipeline: (task: 'text-generation', model: string, options?: Record<string, unknown>) => Promise<TextGenerationPipeline>;
};

const DEFAULT_MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';
const MODEL_ID = process.env.NEXT_PUBLIC_QWEN_MODEL_ID?.trim() || DEFAULT_MODEL_ID;
const TRANSFORMERS_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm';

let pipelinePromise: Promise<TextGenerationPipeline> | null = null;

export function browserQwenSupported() {
  return typeof window !== 'undefined' && Boolean((navigator as Navigator & { gpu?: unknown }).gpu);
}

async function loadPipeline(onProgress?: (event: ProgressEvent) => void) {
  if (!browserQwenSupported()) throw new Error('WebGPU unavailable');
  if (!pipelinePromise) {
    const moduleUrl = TRANSFORMERS_MODULE_URL;
    const pending = import(/* @vite-ignore */ moduleUrl).then((module) => {
      const transformers = module as TransformersModule;
      return transformers.pipeline('text-generation', MODEL_ID, {
        device: 'webgpu',
        dtype: 'q4f16',
        progress_callback: onProgress,
      });
    });
    pipelinePromise = pending.catch((error) => {
      pipelinePromise = null;
      throw error;
    });
  }
  return pipelinePromise;
}

export async function prepareBrowserQwen(onProgress?: (event: ProgressEvent) => void) {
  await loadPipeline(onProgress);
}

function extractText(output: unknown) {
  if (!Array.isArray(output) || !output.length) throw new Error('empty browser response');
  const first = output[0] as { generated_text?: unknown };
  const generated = first?.generated_text;
  if (typeof generated === 'string') return generated.trim();
  if (Array.isArray(generated)) {
    const last = generated[generated.length - 1] as { content?: unknown };
    if (typeof last?.content === 'string') return last.content.trim();
  }
  throw new Error('invalid browser response');
}

export function validateBrowserQwenText(text: string) {
  const trimmed = text.trim();
  if (trimmed.length < 2 || trimmed.length > 220) return false;
  if (/https?:\/\/|www\.|계좌번호\s*[:：]?\s*\d{4}|\b\d{2,4}[- ]\d{3,4}[- ]\d{4}\b/i.test(trimmed)) return false;
  if (/정답|판정 결과|시스템 프롬프트|개발자 메시지|범죄 실행|수사 회피/.test(trimmed)) return false;
  return true;
}

export async function generateBrowserQwen(
  messages: BrowserQwenMessage[],
  options: { timeoutMs?: number; onProgress?: (event: ProgressEvent) => void } = {},
) {
  const timeoutMs = options.timeoutMs ?? 8000;
  const generation = (async () => {
    const pipeline = await loadPipeline(options.onProgress);
    return pipeline(messages, {
      max_new_tokens: 56,
      do_sample: true,
      temperature: 0.6,
      top_p: 0.85,
      return_full_text: false,
    }).then(extractText);
  })();
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error('browser response timeout')), timeoutMs);
  });
  try {
    const result = await Promise.race([generation, timeout]);
    if (!validateBrowserQwenText(result)) throw new Error('unsafe browser response');
    return result;
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}
