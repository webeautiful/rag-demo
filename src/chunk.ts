export type Chunk = { ord: number; heading: string; text: string };

const TARGET = 400;
const OVERLAP = 60;

export function chunkMarkdown(md: string, filename: string): Chunk[] {
  const sections = splitByHeadings(md);
  const chunks: Chunk[] = [];
  let ord = 0;
  for (const { heading, body } of sections) {
    const parts = recursiveSplit(body.trim(), TARGET, OVERLAP);
    for (const part of parts) {
      if (part.trim().length < 20) continue;
      const anchor = `[来源: ${filename} § ${heading || '开篇'}]\n`;
      chunks.push({ ord: ord++, heading, text: anchor + part });
    }
  }
  return chunks;
}

function splitByHeadings(md: string): { heading: string; body: string }[] {
  const lines = md.split('\n');
  const out: { heading: string; body: string }[] = [];
  let currentHeading = '';
  let buf: string[] = [];
  const flush = () => {
    const body = buf.join('\n').trim();
    if (body) out.push({ heading: currentHeading, body });
    buf = [];
  };
  for (const line of lines) {
    const m = /^#{1,3}\s+(.+)$/.exec(line);
    if (m) {
      flush();
      currentHeading = m[1].trim();
    } else {
      buf.push(line);
    }
  }
  flush();
  return out.length ? out : [{ heading: '', body: md }];
}

function recursiveSplit(text: string, target: number, overlap: number): string[] {
  if (text.length <= target) return [text];
  const seps = ['\n\n', '\n', '。', '!', '?', '.', ' '];
  for (const sep of seps) {
    if (!text.includes(sep)) continue;
    const pieces = text.split(sep).filter(Boolean);
    if (pieces.every((p) => p.length <= target)) {
      return packWithOverlap(pieces, sep, target, overlap);
    }
    const grouped: string[] = [];
    for (const piece of pieces) {
      if (piece.length > target) {
        grouped.push(...recursiveSplit(piece, target, overlap));
      } else {
        grouped.push(piece);
      }
    }
    return packWithOverlap(grouped, sep, target, overlap);
  }
  const out: string[] = [];
  for (let i = 0; i < text.length; i += target - overlap) {
    out.push(text.slice(i, i + target));
  }
  return out;
}

function packWithOverlap(pieces: string[], sep: string, target: number, overlap: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const piece of pieces) {
    const next = cur ? cur + sep + piece : piece;
    if (next.length > target && cur) {
      out.push(cur);
      const tail = cur.slice(Math.max(0, cur.length - overlap));
      cur = tail + sep + piece;
    } else {
      cur = next;
    }
  }
  if (cur.trim()) out.push(cur);
  return out;
}
