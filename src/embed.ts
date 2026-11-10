const OLLAMA = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
const MODEL = process.env.EMBED_MODEL ?? 'bge-m3';

export async function embed(text: string): Promise<Float32Array> {
  const res = await fetch(`${OLLAMA}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: text }),
  });
  if (!res.ok) throw new Error(`embed failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { embedding: number[] };
  return new Float32Array(data.embedding);
}

export function toBuffer(v: Float32Array): Buffer {
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
}
