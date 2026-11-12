// Aramanın iki aşaması: (1) ucuz ve hızlı vektör ön elemesi, (2) kısa listeyi dil modeliyle gerekçeli sıralama.
import type { CallRecord } from './claude';
import { parseQuery, type Criteria } from './criteria';
import { loadCandidates } from './data';
import { EMBEDDING_MODEL, costUsd, type ModelKey } from './models';
import { rerank, type RankedCandidate } from './rerank';
import { profileText, type Candidate } from './types';
import { embed, loadVectors, nearest, type Neighbor } from './vectors';

/** Sıralama adımına giden aday sayısı. Büyüdükçe kaçırma azalır, sıralama çağrısı pahalanır. */
export const SHORTLIST_SIZE = 10;

export interface Shortlist {
  query: string;
  criteria: Criteria;
  criteriaCall: CallRecord;
  embeddingCostUsd: number;
  neighbors: Neighbor[];
}

/** 1. aşama: cümleden kriter çıkar, ideal aday özetini vektöre çevir, en yakın adayları getir. */
export async function shortlist(query: string, k = SHORTLIST_SIZE): Promise<Shortlist> {
  const { output: criteria, call: criteriaCall } = await parseQuery(query);
  // Yalnız cümle yerine cümle + ideal aday özeti aranır: özet, profillerin yazıldığı dile daha yakındır.
  const { vectors, tokens } = await embed([`${query}\n${criteria.summary}`]);
  return {
    query,
    criteria,
    criteriaCall,
    embeddingCostUsd: costUsd(EMBEDDING_MODEL, { inputTokens: tokens, outputTokens: 0 }),
    neighbors: nearest(vectors[0]!, loadVectors(), k),
  };
}

/** 2. aşama: kısa listeyi seçilen modelle puanla ve gerekçelendir. */
export async function rank(list: Shortlist, model: ModelKey): Promise<{ results: RankedCandidate[]; call: CallRecord }> {
  const byId = new Map(loadCandidates().map((c) => [c.id, c]));
  const candidates = list.neighbors.map((n) => ({ id: n.id, text: profileText(byId.get(n.id)!) }));
  return rerank(list.query, list.criteria, candidates, model);
}

export interface SearchResult {
  criteria: Criteria;
  results: Array<RankedCandidate & { candidate: Candidate; similarity: number }>;
  costUsd: number;
  ms: number;
}

export async function search(query: string, model: ModelKey): Promise<SearchResult> {
  const started = performance.now();
  const list = await shortlist(query);
  const { results, call } = await rank(list, model);
  const byId = new Map(loadCandidates().map((c) => [c.id, c]));
  const similarity = new Map(list.neighbors.map((n) => [n.id, n.similarity]));
  return {
    criteria: list.criteria,
    results: results.map((r) => ({ ...r, candidate: byId.get(r.id)!, similarity: similarity.get(r.id)! })),
    costUsd: list.criteriaCall.costUsd + list.embeddingCostUsd + call.costUsd,
    ms: Math.round(performance.now() - started),
  };
}
