# RAG 演示知识库 v1

半天能跑通的最小闭环:上传 → 检索 → 生成 → 引用。

## 一次性准备

```sh
npm i
cp .env.example .env       # 按需改后端 / API key
# Ollama 路线才需要:
ollama pull bge-m3         # ~1.2GB,只拉一次
cp seed/*.md data/corpus/  # 铺初始 mock 语料(ingest 见空也会自动铺)
```

## 选择推理后端

`.env` 里 `LLM_BACKEND` 切换(shell 环境变量优先于 .env):

| 后端 | 服务 | 向量化模型 | 生成模型 | 认证 |
|------|------|-----------|---------|------|
| `omlx` | [oMLX](https://github.com/jundot/omlx),Apple Silicon,OpenAI 兼容 | `bge-m3-mlx-fp16` | `qwen3.8-27b-4bit` | `OMLX_API_KEY`(sub key) |
| `ollama` | Ollama(默认) | `bge-m3` | `qwen3.8:27b-mlx` | 无 |

oMLX 走 OpenAI 兼容接口(`:8000` 的 `/v1/embeddings`、`/v1/chat/completions`),菜单栏 app 里创建 sub key 填进 `OMLX_API_KEY` 即可。

## 每次开发

```sh
npm run ingest   # 幂等,重跑只处理变化的文件
npm run dev      # http://localhost:5173
```

## 换成你自己的资料

- 把 `.md` / `.txt` 丢进 `data/corpus/`
- 想删,直接删文件,重跑 `npm run ingest`(孤儿会被自动清理)
- 文件名带「旧版 / outdated」的、以及 `.bak` 会被跳过
