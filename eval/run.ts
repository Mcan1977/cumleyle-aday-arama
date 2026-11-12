// Her arama için kısa listeyi bir kez çıkarır, aynı listeyi üç modele sıralatır ve ham çıktıyı results/raw altına yazar.
// Var olan kayıt yeniden çalıştırılmaz (para harcamamak için); zorlamak için: npm run eval -- --force
// Tek arama: npm run eval -- --only q03
import { MODEL_KEYS, type ModelKey } from '../src/models';
import { rank, shortlist } from '../src/search';
import { loadQueries, readJson, writeJson, type RawRun } from './files';

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

let spent = 0;
for (const query of loadQueries()) {
  if (only && query.id !== only) continue;
  const file = `results/raw/${query.id}.json`;
  if (!force && readJson<RawRun>(file)) {
    console.log(`${query.id}: kayıt var, atlandı`);
    continue;
  }
  const list = await shortlist(query.text);
  // Üç model aynı anda çalışır; her biri aynı girdiyi görür.
  const outputs = await Promise.all(MODEL_KEYS.map((model) => rank(list, model)));
  const models = Object.fromEntries(MODEL_KEYS.map((model, i) => [model, outputs[i]!])) as RawRun['models'];
  const run: RawRun = {
    id: query.id,
    query: query.text,
    criteria: list.criteria,
    criteriaCall: list.criteriaCall,
    embeddingCostUsd: list.embeddingCostUsd,
    neighbors: list.neighbors,
    models,
  };
  writeJson(file, run);
  const cost = list.criteriaCall.costUsd + list.embeddingCostUsd + outputs.reduce((sum, o) => sum + o.call.costUsd, 0);
  spent += cost;
  const line = MODEL_KEYS.map((m: ModelKey) => `${m} ${(models[m].call.ms / 1000).toFixed(1)} sn`).join(', ');
  console.log(`${query.id}: ${line}; ${cost.toFixed(4)} dolar`);
}
console.log(`Toplam: ${spent.toFixed(4)} dolar`);
