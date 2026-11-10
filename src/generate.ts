import type { Hit } from './retrieve.ts';

const OLLAMA = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
const MODEL = process.env.GEN_MODEL ?? 'qwen3.8:27b-mlx';

const SYSTEM = `你是公司内部知识库助手。只根据下方提供的资料片段回答用户问题。
规则：
1. 如果资料不足以回答，如实说"根据现有资料无法确定"。
2. 回答中用 [1] [2] 等标注引用编号，对应 SOURCES 的顺序。
3. 保持简洁，直接回答问题。`;

export function buildMessages(query: string, hits: Hit[]) {
  const sources = hits
    .map((h, i) => `[${i + 1}] (${h.sourcePath} § ${h.heading || '开篇'})\n${h.text}`)
    .join('\n\n');
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `SOURCES:\n${sources}\n\n问题：${query}` },
  ];
}

export async function* generate(
  query: string,
  hits: Hit[],
): AsyncGenerator<string, void, unknown> {
  const messages = buildMessages(query, hits);
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, stream: true }),
  });
  if (!res.ok) throw new Error(`generate failed: ${res.status}`);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop()!;
    for (const line of lines) {
      if (!line.trim()) continue;
      const obj = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
      if (obj.message?.content) yield obj.message.content;
    }
  }
  if (buf.trim()) {
    const obj = JSON.parse(buf) as { message?: { content?: string } };
    if (obj.message?.content) yield obj.message.content;
  }
}
