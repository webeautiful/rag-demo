# RAG 演示知识库 v1

半天能跑通的最小闭环:上传 → 检索 → 生成 → 引用。

## 一次性准备

```sh
npm i
ollama pull bge-m3         # ~1.2GB,只拉一次
cp seed/*.md data/corpus/  # 铺初始 mock 语料
```

## 每次开发

```sh
npm run ingest   # 幂等,重跑只处理变化的文件
npm run dev      # http://localhost:5173
```

## 换成你自己的资料

- 把 `.md` / `.txt` 丢进 `data/corpus/`
- 想删,直接删文件,重跑 `npm run ingest`(孤儿会被自动清理)
- 文件名带「旧版 / outdated / draft」的会被跳过,`.bak` 也是
