import './env.ts'; // 副作用:加载 .env(须在读取 process.env 之前)
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openDb } from './db.ts';
import { retrieve } from './retrieve.ts';
import { generate } from './generate.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 5173);

const db = openDb();
const app = express();

app.use(express.static(join(__dirname, 'public')));

app.get('/api/ask', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) {
    res.status(400).json({ error: 'missing ?q=' });
    return;
  }

  const hits = await retrieve(db, q, 5);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  res.write(`data: ${JSON.stringify({ type: 'sources', sources: hits.map(h => ({ path: h.sourcePath, heading: h.heading, score: h.score, text: h.text, ingestedAt: h.ingestedAt })) })}\n\n`);

  try {
    for await (const delta of generate(q, hits)) {
      res.write(`data: ${JSON.stringify({ type: 'delta', content: delta })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  } catch (e: any) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: e.message })}\n\n`);
  }
  res.end();
});

app.listen(PORT, () => {
  console.log(`RAG demo running at http://localhost:${PORT}`);
});
