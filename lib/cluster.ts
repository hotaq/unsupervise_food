// Lightweight 2D embedding of foods using char-3gram TF-IDF + PCA.
// Server-side only. Output is a stable, JSON-serializable array of points.
//
// This is intentionally a simple baseline. When richer features land
// (ingredients, tags, user-by-food rating matrix), swap `vectorize` for the
// new feature builder; the rest of the pipeline does not change.

import { PCA } from "ml-pca";

export type FoodForCluster = {
  id: number;
  name: string; // canonical display name (whichever language is non-null)
  text: string; // text used for vectorization (en + th + aliases)
  ratingCount: number;
  avgRating: number; // 0 when no ratings yet
};

export type ScatterPoint = {
  id: number;
  name: string;
  x: number;
  y: number;
  ratingCount: number;
  avgRating: number;
  bucket: "low" | "mid" | "high" | "unrated";
};

const NGRAM = 3;

function trigrams(s: string): string[] {
  const padded = ` ${s.toLowerCase()} `;
  const out: string[] = [];
  for (let i = 0; i + NGRAM <= padded.length; i++) {
    out.push(padded.slice(i, i + NGRAM));
  }
  return out;
}

/**
 * Build a TF-IDF matrix over character trigrams. Returns a dense matrix
 * (rows = foods, cols = top-K trigrams by document frequency). PCA is fine
 * with a few thousand cols, but capping keeps memory bounded.
 */
function buildTfidfMatrix(rows: FoodForCluster[], topK = 1500): number[][] {
  // Document frequency per trigram.
  const df = new Map<string, number>();
  for (const r of rows) {
    const tris = Array.from(new Set(trigrams(r.text)));
    for (const t of tris) df.set(t, (df.get(t) ?? 0) + 1);
  }

  // Pick the most common K trigrams as the vocabulary.
  const vocab = [...df.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([t]) => t);
  const vocabIndex = new Map(vocab.map((t, i) => [t, i] as const));

  const N = rows.length;
  const idf = new Float64Array(vocab.length);
  for (let i = 0; i < vocab.length; i++) {
    const dfi = df.get(vocab[i]) ?? 1;
    idf[i] = Math.log((N + 1) / (dfi + 1)) + 1; // smooth IDF
  }

  // Term frequency per row, then multiply by IDF and L2-normalize.
  const matrix: number[][] = new Array(N);
  for (let r = 0; r < N; r++) {
    const v = new Array<number>(vocab.length).fill(0);
    const tris = trigrams(rows[r].text);
    for (const t of tris) {
      const idx = vocabIndex.get(t);
      if (idx !== undefined) v[idx] += 1;
    }
    let norm = 0;
    for (let i = 0; i < v.length; i++) {
      v[i] = v[i] * idf[i];
      norm += v[i] * v[i];
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < v.length; i++) v[i] = v[i] / norm;
    matrix[r] = v;
  }
  return matrix;
}

function bucketize(avg: number, count: number): ScatterPoint["bucket"] {
  if (count === 0) return "unrated";
  if (avg >= 4) return "high";
  if (avg >= 3) return "mid";
  return "low";
}

export function reduceToScatter(rows: FoodForCluster[]): ScatterPoint[] {
  if (rows.length === 0) return [];
  if (rows.length === 1) {
    const r = rows[0];
    return [
      {
        id: r.id,
        name: r.name,
        x: 0,
        y: 0,
        ratingCount: r.ratingCount,
        avgRating: r.avgRating,
        bucket: bucketize(r.avgRating, r.ratingCount),
      },
    ];
  }

  const matrix = buildTfidfMatrix(rows);
  const pca = new PCA(matrix, { method: "SVD" });
  const projected = pca.predict(matrix, { nComponents: 2 }).to2DArray();

  return rows.map((r, i) => ({
    id: r.id,
    name: r.name,
    x: projected[i][0],
    y: projected[i][1],
    ratingCount: r.ratingCount,
    avgRating: r.avgRating,
    bucket: bucketize(r.avgRating, r.ratingCount),
  }));
}
