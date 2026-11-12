// Değerlendirme dosyalarının ortak tipleri ve okuma/yazma yardımcıları.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { CallRecord } from '../src/claude';
import type { Criteria } from '../src/criteria';
import type { ModelKey } from '../src/models';
import type { RankedCandidate } from '../src/rerank';
import type { Neighbor } from '../src/vectors';
import type { Labels } from './metrics';

export interface EvalQuery {
  id: string;
  text: string;
  labels: Labels;
  traps: string[];
}

/** Bir aramanın ham kaydı: kısa liste herkes için aynıdır, yalnız sıralama modeli değişir. */
export interface RawRun {
  id: string;
  query: string;
  criteria: Criteria;
  criteriaCall: CallRecord;
  embeddingCostUsd: number;
  neighbors: Neighbor[];
  models: Record<ModelKey, { results: RankedCandidate[]; call: CallRecord }>;
}

export interface JudgeRun {
  id: string;
  /** Hakemin gördüğü harf -> gerçek model. Hakem bu eşlemeyi görmez. */
  blind: Record<'A' | 'B' | 'C', ModelKey>;
  scores: Array<{ system: 'A' | 'B' | 'C'; ranking: number; reasons: number; note: string }>;
  call: CallRecord;
}

const path = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));

export function loadQueries(): EvalQuery[] {
  return JSON.parse(readFileSync(path('data/queries.json'), 'utf8')) as EvalQuery[];
}

export function readJson<T>(relative: string): T | null {
  return existsSync(path(relative)) ? (JSON.parse(readFileSync(path(relative), 'utf8')) as T) : null;
}

export function writeJson(relative: string, value: unknown): void {
  mkdirSync(path(relative.slice(0, relative.lastIndexOf('/'))), { recursive: true });
  writeFileSync(path(relative), JSON.stringify(value, null, 2) + '\n');
}

export function writeText(relative: string, text: string): void {
  writeFileSync(path(relative), text);
}

export function listJson(directory: string): string[] {
  return existsSync(path(directory)) ? readdirSync(path(directory)).filter((f) => f.endsWith('.json')).sort() : [];
}
