import { DatabaseSync } from 'node:sqlite';
import { embed, toBuffer } from './embed.ts';

export type Hit = {
  chunkId: number;
  text: string;
  heading: string;
  sourcePath: string;
  ingestedAt: number;
  score: number;
};

export async function retrieve(db: DatabaseSync, query: string, topK = 5): Promise<Hit[]> {
  const vec = await embed(query);
  const rows = db
    .prepare(
      `SELECT chunks.id AS chunkId, chunks.text, chunks.heading,
              sources.path AS sourcePath, sources.ingested_at AS ingestedAt,
              vec_distance_cosine(embedding, ?) AS d
       FROM vec_chunks
       JOIN chunks ON chunks.id = vec_chunks.rowid
       JOIN sources ON sources.id = chunks.source_id
       ORDER BY d ASC
       LIMIT ?`,
    )
    .all(toBuffer(vec), topK) as Array<Hit & { d: number }>;

  return rows.map(({ d, ...rest }) => ({ ...rest, score: +(1 - d).toFixed(4) }));
}
