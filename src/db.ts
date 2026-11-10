import { DatabaseSync } from 'node:sqlite';
import * as sqliteVec from 'sqlite-vec';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.DB_PATH ?? 'data/kb.sqlite';

export function openDb(): DatabaseSync {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH, { allowExtension: true });
  db.loadExtension(sqliteVec.getLoadablePath());

  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      mtime INTEGER NOT NULL,
      ingested_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY,
      source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      ord INTEGER NOT NULL,
      heading TEXT,
      text TEXT NOT NULL,
      hash TEXT UNIQUE NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source_id);

    CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
      embedding float[1024]
    );
  `);

  return db;
}

export function deleteSource(db: DatabaseSync, sourceId: number): void {
  const chunkIds = db
    .prepare('SELECT id FROM chunks WHERE source_id = ?')
    .all(sourceId) as { id: number }[];
  const delVec = db.prepare('DELETE FROM vec_chunks WHERE rowid = ?');
  for (const { id } of chunkIds) delVec.run(id);
  db.prepare('DELETE FROM sources WHERE id = ?').run(sourceId);
}
