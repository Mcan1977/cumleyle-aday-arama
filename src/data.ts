import { readFileSync } from 'node:fs';

import type { Candidate } from './types';

export function loadCandidates(): Candidate[] {
  return JSON.parse(readFileSync(new URL('../data/candidates.json', import.meta.url), 'utf8')) as Candidate[];
}
