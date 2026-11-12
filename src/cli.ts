// Kullanım: npm run ara -- "İstanbul'da React ve TypeScript bilen frontend geliştirici" [--model haiku|sonnet|opus]
import { MODEL_KEYS, type ModelKey } from './models';
import { search } from './search';

const args = process.argv.slice(2);
const modelFlag = args.indexOf('--model');
const model = (modelFlag >= 0 ? args[modelFlag + 1] : 'sonnet') as ModelKey;
const query = args.filter((_, i) => modelFlag < 0 || (i !== modelFlag && i !== modelFlag + 1)).join(' ').trim();

if (!query || !MODEL_KEYS.includes(model)) {
  console.error('Kullanım: npm run ara -- "arama cümlesi" [--model haiku|sonnet|opus]');
  process.exit(1);
}

const { criteria, results, costUsd, ms } = await search(query, model);

console.log(`\nKriterler: ${JSON.stringify({ ...criteria, summary: undefined })}\n`);
for (const [index, r] of results.entries()) {
  const c = r.candidate;
  console.log(`${String(index + 1).padStart(2)}. ${String(r.score).padStart(3)} puan  ${c.title}, ${c.city}${c.remote ? ' (uzaktan olur)' : ''}`);
  console.log(`    ${r.reason}`);
}
console.log(`\n${model}, ${(ms / 1000).toFixed(1)} sn, ${costUsd.toFixed(4)} dolar\n`);
