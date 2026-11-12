import './env.ts'; // 副作用:先把 .env 读进来,再解析下面的配置

export type Backend = 'ollama' | 'omlx';

/** 推理后端切换:LLM_BACKEND=omlx|ollama,未设置默认 ollama */
export const backend: Backend =
  (process.env.LLM_BACKEND ?? 'ollama').trim().toLowerCase() === 'omlx' ? 'omlx' : 'ollama';

/** Ollama 后端(原生 /api/* 接口) */
export const ollama = {
  host: process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434',
  embedModel: process.env.EMBED_MODEL ?? 'bge-m3',
  genModel: process.env.GEN_MODEL ?? 'qwen3.8:27b-mlx',
};

/** oMLX 后端(OpenAI 兼容 /v1/*,需 Bearer sub key) */
export const omlx = {
  host: process.env.OMLX_HOST ?? 'http://127.0.0.1:8000',
  apiKey: process.env.OMLX_API_KEY ?? '',
  embedModel: process.env.OMLX_EMBED_MODEL ?? 'bge-m3-mlx-fp16',
  genModel: process.env.OMLX_GEN_MODEL ?? 'qwen3.8-27b-4bit',
};
