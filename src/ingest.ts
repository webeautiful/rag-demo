import './env.ts'; // 副作用:加载 .env(须在读取 process.env 之前)
import { readdirSync, readFileSync, statSync, mkdirSync, existsSync, cpSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { openDb, deleteSource } from './db.ts';
import { chunkMarkdown } from './chunk.ts';
import { embed, toBuffer } from './embed.ts';

const CORPUS = process.env.CORPUS_DIR ?? 'data/corpus';
const SEED = 'seed';

const ALLOWED_EXT = /\.(md|txt)$/i;
const OUTDATED = /(旧版|outdated|deprecated|archive)/i;

function seedIfEmpty() {
  mkdirSync(CORPUS, { recursive: true });
  const existing = readdirSync(CORPUS);
  if (existing.length > 0) return;
  if (!existsSync(SEED)) return;
  for (const name of readdirSync(SEED)) {
    cpSync(join(SEED, name), join(CORPUS, name));
  }
  console.log(`seeded ${readdirSync(CORPUS).length} files from ${SEED}/`);
}

function listCorpus(): string[] {
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) out.push(...walk(full));
      else out.push(full);
    }
    return out;
  };
  return walk(CORPUS);
}

function classify(path: string): 'ok' | 'ext-skip' | 'outdated' {
  if (!ALLOWED_EXT.test(path)) return 'ext-skip';
  if (OUTDATED.test(path)) return 'outdated';
  return 'ok';
}

async function main() {
  seedIfEmpty();
  const db = openDb();

  const files = listCorpus();
  const ok: string[] = [];
  let extSkipped = 0;
  let outdated = 0;
  for (const f of files) {
    const cls = classify(f);
    if (cls === 'ext-skip') extSkipped++;
    else if (cls === 'outdated') outdated++;
    else ok.push(f);
  }

  const okRel = new Set(ok.map((f) => relative(CORPUS, f)));
  const dbSources = db
    .prepare('SELECT id, path FROM sources')
    .all() as { id: number; path: string }[];
  let orphans = 0;
  for (const s of dbSources) {
    if (!okRel.has(s.path)) {
      deleteSource(db, s.id);
      orphans++;
    }
  }

  let ingestedFiles = 0;
  let ingestedChunks = 0;
  let dedupedChunks = 0;
  let unchangedFiles = 0;

  const getSource = db.prepare('SELECT id, mtime FROM sources WHERE path = ?');
  const insSource = db.prepare(
    'INSERT INTO sources (path, mtime, ingested_at) VALUES (?, ?, ?)',
  );
  const insChunk = db.prepare(
    'INSERT INTO chunks (source_id, ord, heading, text, hash) VALUES (?, ?, ?, ?, ?)',
  );
  const insVec = db.prepare('INSERT INTO vec_chunks (rowid, embedding) VALUES (CAST(? AS INTEGER), ?)');
  const hashExists = db.prepare('SELECT 1 FROM chunks WHERE hash = ?');

  for (const abs of ok) {
    const rel = relative(CORPUS, abs);
    const mtime = Math.floor(statSync(abs).mtimeMs);
    const existing = getSource.get(rel) as { id: number; mtime: number } | undefined;

    if (existing && existing.mtime === mtime) {
      unchangedFiles++;
      continue;
    }
    if (existing) deleteSource(db, existing.id);

    const text = readFileSync(abs, 'utf8');
    const chunks = chunkMarkdown(text, rel);
    const now = Date.now();
    const sourceId = insSource.run(rel, mtime, now).lastInsertRowid;

    for (const c of chunks) {
      const hash = createHash('sha256').update(c.text).digest('hex');
      if (hashExists.get(hash)) {
        dedupedChunks++;
        continue;
      }
      const vec = await embed(c.text);
      const chunkId = insChunk.run(sourceId, c.ord, c.heading, c.text, hash).lastInsertRowid;
      insVec.run(chunkId, toBuffer(vec));
      ingestedChunks++;
    }
    ingestedFiles++;
    process.stdout.write(`  · ${rel} → ${chunks.length} chunks\n`);
  }

  console.log('');
  console.log(`ingested ${ingestedFiles} files, ${ingestedChunks} chunks`);
  console.log(`unchanged ${unchangedFiles} files`);
  console.log(`deduped ${dedupedChunks} chunks (exact duplicates)`);
  console.log(`skipped ${outdated} outdated files (旧版/outdated/deprecated)`);
  console.log(`skipped ${extSkipped} non-.md/.txt files`);
  console.log(`removed ${orphans} orphan sources`);
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
