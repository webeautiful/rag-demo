import type { Hit } from './retrieve.ts';
import { backend, ollama, omlx } from './config.ts';

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

/** Ollama:原始 JSON 行流,无 SSE 前缀 */
async function* streamOllama(res: Response): AsyncGenerator<string> {
  const parse = (line: string): string | null => {
    if (!line.trim()) return null;
    const obj = JSON.parse(line) as { message?: { content?: string } };
    return obj.message?.content ?? null;
  };
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop()!;
      for (const line of lines) {
        const c = parse(line);
        if (c) yield c;
      }
    }
    if (done) break;
  }
  if (buf) {
    const c = parse(buf);
    if (c) yield c;
  }
}

/** oMLX(OpenAI 兼容):SSE 行 `data: {...}`,以 `data: [DONE]` 结束 */
async function* streamOmlx(res: Response): AsyncGenerator<string> {
  const parse = (line: string): string | null => {
    if (!line.startsWith('data:')) return null;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') return null;
    const obj = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
    return obj.choices?.[0]?.delta?.content ?? null;
  };
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop()!;
      for (const line of lines) {
        const c = parse(line);
        if (c) yield c;
      }
    }
    if (done) break;
  }
  if (buf) {
    const c = parse(buf);
    if (c) yield c;
  }
}

export async function* generate(
  query: string,
  hits: Hit[],
): AsyncGenerator<string, void, unknown> {
  const messages = buildMessages(query, hits);

  let res: Response;
  if (backend === 'omlx') {
    res = await fetch(`${omlx.host}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(omlx.apiKey ? { Authorization: `Bearer ${omlx.apiKey}` } : {}),
      },
      body: JSON.stringify({ model: omlx.genModel, messages, stream: true }),
    });
    if (!res.ok) throw new Error(`generate(omlx) failed: ${res.status} ${await res.text()}`);
    yield* streamOmlx(res);
    return;
  }

  res = await fetch(`${ollama.host}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: ollama.genModel, messages, stream: true }),
  });
  if (!res.ok) throw new Error(`generate(ollama) failed: ${res.status}`);
  yield* streamOllama(res);
}
