// Ham kayıtlardan ve hakem puanlarından özet tabloyu üretir: results/summary.json ve results/summary.md.
// Model çağrısı yapmaz; istenildiği kadar yeniden çalıştırılabilir.
import { MODEL_KEYS, type ModelKey } from '../src/models';
import { listJson, loadQueries, readJson, writeJson, writeText, type JudgeRun, type RawRun } from './files';
import { mean, ndcg, topIsBest, trapsAhead } from './metrics';

const K = 5;
/** İstemdeki kural: şart koşulan yeteneği profilinde görünmeyen aday en fazla 64 alır. */
const STRONG_MATCH = 65;

interface Row {
  ndcg: number[];
  topBest: number;
  trapsAhead: number;
  trapsScoredHigh: number;
  judgeRanking: number[];
  judgeReasons: number[];
  cost: number[];
  seconds: number[];
}
const emptyRow = (): Row => ({ ndcg: [], topBest: 0, trapsAhead: 0, trapsScoredHigh: 0, judgeRanking: [], judgeReasons: [], cost: [], seconds: [] });

const queries = new Map(loadQueries().map((q) => [q.id, q]));
const rows: Record<ModelKey | 'vector', Row> = { vector: emptyRow(), haiku: emptyRow(), sonnet: emptyRow(), opus: emptyRow() };
const perQuery: Array<Record<string, string | number>> = [];
let searches = 0;
let relevantTotal = 0;
let relevantFound = 0;
let fixedCost = 0;
let judgeCost = 0;

for (const name of listJson('results/raw')) {
  const run = readJson<RawRun>(`results/raw/${name}`)!;
  const query = queries.get(run.id);
  if (!query) continue;
  searches += 1;
  fixedCost += run.criteriaCall.costUsd + run.embeddingCostUsd;

  // 1. aşamanın kaçırdığı: etiketi 2 ve üstü olan adaylardan kaçı kısa listeye girdi?
  const shortlistIds = run.neighbors.map((n) => n.id);
  const relevant = Object.entries(query.labels).filter(([, label]) => label >= 2).map(([id]) => id);
  relevantTotal += relevant.length;
  relevantFound += relevant.filter((id) => shortlistIds.includes(id)).length;

  // Karşılaştırma tabanı: sıralama adımı hiç olmasa, yalnız vektör benzerliğiyle sıra.
  const baseline = ndcg(shortlistIds, query.labels, K);
  if (baseline !== null) rows.vector.ndcg.push(baseline);
  rows.vector.topBest += topIsBest(shortlistIds, query.labels) ? 1 : 0;
  rows.vector.trapsAhead += trapsAhead(shortlistIds, query.labels, query.traps);

  const line: Record<string, string | number> = { id: run.id, vector: baseline === null ? '-' : baseline.toFixed(2) };
  for (const model of MODEL_KEYS) {
    const { results, call } = run.models[model];
    const ids = results.map((r) => r.id);
    const score = ndcg(ids, query.labels, K);
    if (score !== null) rows[model].ndcg.push(score);
    rows[model].topBest += topIsBest(ids, query.labels) ? 1 : 0;
    rows[model].trapsAhead += trapsAhead(ids, query.labels, query.traps);
    rows[model].trapsScoredHigh += results.filter((r) => query.traps.includes(r.id) && r.score >= STRONG_MATCH).length;
    rows[model].cost.push(call.costUsd);
    rows[model].seconds.push(call.ms / 1000);
    line[model] = score === null ? '-' : score.toFixed(2);
  }
  perQuery.push(line);

  const judge = readJson<JudgeRun>(`results/judge/${name}`);
  if (judge) {
    judgeCost += judge.call.costUsd;
    for (const s of judge.scores) {
      rows[judge.blind[s.system]].judgeRanking.push(s.ranking);
      rows[judge.blind[s.system]].judgeReasons.push(s.reasons);
    }
  }
}

const trapCount = [...queries.values()].reduce((sum, q) => sum + q.traps.length, 0);
const summary = {
  searches,
  shortlistRecall: relevantTotal === 0 ? null : relevantFound / relevantTotal,
  relevantFound,
  relevantTotal,
  trapCount,
  fixedCostPerSearchUsd: searches === 0 ? 0 : fixedCost / searches,
  totalSpentUsd: fixedCost + judgeCost + MODEL_KEYS.reduce((sum, m) => sum + rows[m].cost.reduce((a, b) => a + b, 0), 0),
  models: Object.fromEntries(
    (['vector', ...MODEL_KEYS] as const).map((key) => {
      const r = rows[key];
      return [
        key,
        {
          ndcg5: mean(r.ndcg),
          topBest: r.topBest,
          trapsAhead: r.trapsAhead,
          trapsScoredHigh: key === 'vector' ? null : r.trapsScoredHigh,
          judgeRanking: r.judgeRanking.length ? mean(r.judgeRanking) : null,
          judgeReasons: r.judgeReasons.length ? mean(r.judgeReasons) : null,
          costPerSearchUsd: r.cost.length ? mean(r.cost) : null,
          secondsPerSearch: r.seconds.length ? mean(r.seconds) : null,
        },
      ];
    }),
  ),
  perQuery,
};
writeJson('results/summary.json', summary);

const tr = (value: number | null, digits: number) => (value === null ? '-' : value.toFixed(digits).replace('.', ','));
const names: Record<string, string> = { vector: 'Yalnız vektör sırası', haiku: 'Haiku 5.5', sonnet: 'Sonnet 5.5', opus: 'Opus 5.5' };
const table = [
  `| Sıralayan | nDCG@${K} | İlk sıra doğru | Öne geçen tuzak | ${STRONG_MATCH}+ puan alan tuzak | Hakem: sıralama | Hakem: gerekçe | Arama başına | Süre |`,
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...Object.entries(summary.models).map(([key, m]) =>
    [
      '',
      names[key],
      tr(m.ndcg5, 3),
      `${m.topBest}/${searches}`,
      `${m.trapsAhead}/${trapCount}`,
      m.trapsScoredHigh === null ? '-' : `${m.trapsScoredHigh}/${trapCount}`,
      tr(m.judgeRanking, 1),
      tr(m.judgeReasons, 1),
      m.costPerSearchUsd === null ? '-' : `${tr(m.costPerSearchUsd * 100, 2)} sent`,
      m.secondsPerSearch === null ? '-' : `${tr(m.secondsPerSearch, 1)} sn`,
      '',
    ].join(' | ').trim(),
  ),
].join('\n');

const detail = [
  `| Arama | Vektör | Haiku | Sonnet | Opus |`,
  '| --- | --- | --- | --- | --- |',
  ...perQuery.map((q) => `| ${q.id} | ${q.vector} | ${q.haiku} | ${q.sonnet} | ${q.opus} |`.replaceAll('.', ',')),
].join('\n');

writeText(
  'results/summary.md',
  [
    `# Sonuç özeti`,
    '',
    `${searches} arama; her aramada aynı kısa liste üç modele verildi.`,
    `Kısa listeye giren ilgili aday (etiket 2 ve üstü): ${relevantFound}/${relevantTotal}.`,
    `Kriter çıkarma ve vektör adımı arama başına ${tr(summary.fixedCostPerSearchUsd * 100, 3)} sent.`,
    `Bu koşunun toplam harcaması (hakem dahil): ${tr(summary.totalSpentUsd, 2)} dolar.`,
    '',
    table,
    '',
    `## Arama bazında nDCG@${K}`,
    '',
    detail,
    '',
  ].join('\n'),
);
console.log(table);
console.log(`\nKısa liste: ${relevantFound}/${relevantTotal} ilgili aday; toplam ${summary.totalSpentUsd.toFixed(2)} dolar`);
