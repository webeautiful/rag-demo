import { backend, ollama, omlx } from './config.ts';

function authHeaders(key: string): Record<string, string> {
  return key ? { Authorization: `Bearer ${key}` } : {};
}

export async function embed(text: string): Promise<Float32Array> {
  if (backend === 'omlx') {
    const res = await fetch(`${omlx.host}/v1/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(omlx.apiKey) },
      body: JSON.stringify({ model: omlx.embedModel, input: text }),
    });
    if (!res.ok) throw new Error(`embed(omlx) failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as {
      data?: { embedding: number[] }[];
      embedding?: number[];
    };
    const arr = data.data?.[0]?.embedding ?? data.embedding;
    if (!arr) throw new Error('embed(omlx): response has no embedding');
    return new Float32Array(arr);
  }

  const res = await fetch(`${ollama.host}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: ollama.embedModel, prompt: text }),
  });
  if (!res.ok) throw new Error(`embed(ollama) failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { embedding: number[] };
  return new Float32Array(data.embedding);
}

export function toBuffer(v: Float32Array): Buffer {
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
}
