import { readFileSync } from 'node:fs';

import OpenAI from 'openai';

import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from './models';

/** Metinleri anlam vektörüne çevirir. Claude'un vektör modeli olmadığı için bu küçük iş OpenAI'da. */
export async function embed(texts: string[]): Promise<{ vectors: number[][]; tokens: number }> {
  const client = new OpenAI({ timeout: 60_000, maxRetries: 2 });
  const response = await client.embeddings.create({ model: EMBEDDING_MODEL, input: texts, dimensions: EMBEDDING_DIMENSIONS });
  const vectors = [...response.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  return { vectors, tokens: response.usage.prompt_tokens };
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Vektör boyutları farklı.');
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  return normA === 0 || normB === 0 ? 0 : dot / Math.sqrt(normA * normB);
}

export interface Neighbor {
  id: string;
  similarity: number;
}

/** Sorgu vektörüne en yakın k kayıt, benzerliğe göre azalan sırada. */
export function nearest(query: number[], store: Record<string, number[]>, k: number): Neighbor[] {
  return Object.entries(store)
    .map(([id, vector]) => ({ id, similarity: cosine(query, vector) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}

/** Depoda saklanan aday vektörleri (npm run vektor ile üretilir). */
export function loadVectors(): Record<string, number[]> {
  const file = JSON.parse(readFileSync(new URL('../data/vectors.json', import.meta.url), 'utf8')) as {
    model: string;
    dimensions: number;
    vectors: Record<string, number[]>;
  };
  if (file.model !== EMBEDDING_MODEL || file.dimensions !== EMBEDDING_DIMENSIONS) {
    throw new Error('Saklı vektörler başka bir modelle üretilmiş; "npm run vektor" ile yeniden üret.');
  }
  return file.vectors;
}
