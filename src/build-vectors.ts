// Aday profillerinin vektörlerini üretir ve data/vectors.json dosyasına yazar. Aday verisi değişince yeniden çalıştırılır.
import { writeFileSync } from 'node:fs';

import { loadCandidates } from './data';
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, costUsd } from './models';
import { profileText } from './types';
import { embed } from './vectors';

const candidates = loadCandidates();
const { vectors, tokens } = await embed(candidates.map(profileText));
const rounded = Object.fromEntries(candidates.map((c, i) => [c.id, vectors[i]!.map((v) => Number(v.toFixed(5)))]));
writeFileSync(
  new URL('../data/vectors.json', import.meta.url),
  JSON.stringify({ model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS, vectors: rounded }) + '\n',
);
const cost = costUsd(EMBEDDING_MODEL, { inputTokens: tokens, outputTokens: 0 });
console.log(`${candidates.length} aday, ${tokens} token, ${cost.toFixed(5)} dolar`);
