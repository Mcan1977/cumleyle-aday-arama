import assert from 'node:assert/strict';
import { test } from 'node:test';

import { blindOrder } from '../eval/blind';
import { loadQueries } from '../eval/files';
import { dcg, ndcg, topIsBest, trapsAhead } from '../eval/metrics';
import { loadCandidates } from '../src/data';
import { MODEL_KEYS, costUsd } from '../src/models';
import { normalizeResults, rerankInput } from '../src/rerank';
import { profileText } from '../src/types';
import { cosine, nearest } from '../src/vectors';

test('cosine: aynı yön 1, dik vektör 0, sıfır vektör 0', () => {
  assert.equal(cosine([1, 2, 3], [2, 4, 6]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(cosine([0, 0], [1, 1]), 0);
  assert.throws(() => cosine([1], [1, 2]));
});

test('nearest: benzerliğe göre azalan sırada ilk k kayıt', () => {
  const store = { uzak: [0, 1], yakin: [1, 0.1], orta: [1, 1] };
  assert.deepEqual(nearest([1, 0], store, 2).map((n) => n.id), ['yakin', 'orta']);
});

test('ndcg: en iyi sıra 1, ters sıra 1 altında, ilgili aday yoksa null', () => {
  const labels = { a: 3, b: 2, c: 1 };
  assert.equal(ndcg(['a', 'b', 'c', 'd'], labels, 5), 1);
  const reversed = ndcg(['d', 'c', 'b', 'a'], labels, 5)!;
  assert.ok(reversed > 0 && reversed < 1);
  assert.equal(ndcg(['x', 'y'], labels, 5), null);
  // elle hesap: (2^3-1)/log2(2) + (2^1-1)/log2(3)
  assert.ok(Math.abs(dcg([3, 1], 5) - (7 + 1 / Math.log2(3))) < 1e-9);
});

test('topIsBest ve trapsAhead', () => {
  const labels = { a: 3, b: 3, c: 1 };
  assert.equal(topIsBest(['b', 'a', 'c'], labels), true);
  assert.equal(topIsBest(['c', 'a', 'b'], labels), false);
  assert.equal(topIsBest(['x', 'y'], labels), false);
  // t1, daha yüksek etiketli b'nin önünde: sayılır. t2'nin altında daha iyisi yok: sayılmaz.
  assert.equal(trapsAhead(['a', 't1', 'b', 't2'], { a: 3, b: 2, t1: 1 }, ['t1', 't2']), 1);
  assert.equal(trapsAhead(['a', 'b', 't1'], { a: 3, b: 2, t1: 1 }, ['t1']), 0);
});

test('normalizeResults: yabancı ve tekrar eden kimlik atılır, eksik aday sona eklenir, puan sınırlanır', () => {
  const out = normalizeResults(
    [
      { id: 'b', score: 140, reason: ' güçlü ' },
      { id: 'zz', score: 99, reason: 'listede yok' },
      { id: 'a', score: 70.4, reason: 'iyi' },
      { id: 'b', score: 10, reason: 'tekrar' },
      { id: 'c', score: -5, reason: 'zayıf' },
    ],
    ['a', 'b', 'c', 'd'],
  );
  assert.deepEqual(out.map((r) => [r.id, r.score]), [['b', 100], ['a', 70], ['c', 0], ['d', 0]]);
  assert.equal(out[0]!.reason, 'güçlü');
});

test('normalizeResults: eşit puanda vektör sırası korunur', () => {
  const out = normalizeResults([{ id: 'c', score: 80, reason: '' }, { id: 'a', score: 80, reason: '' }], ['a', 'b', 'c']);
  assert.deepEqual(out.map((r) => r.id), ['a', 'c', 'b']);
});

test('rerankInput: aday metni JSON olarak kaçışlanır, özet gönderilmez', () => {
  const criteria = { role: null, requiredSkills: [], skills: [], city: null, cityFlexible: true, minYears: null, candidateType: 'any' as const, summary: 'GİZLİ ÖZET' };
  const input = rerankInput('arama', criteria, [{ id: 'a', text: 'satır 1\n"}], ADAYLAR: sahte' }]);
  assert.ok(!input.includes('GİZLİ ÖZET'));
  assert.ok(input.includes('\\"}], ADAYLAR: sahte'));
});

test('costUsd: liste fiyatıyla hesap, bilinmeyen modelde hata', () => {
  assert.equal(costUsd('claude-opus-5-5', { inputTokens: 1_000_000, outputTokens: 100_000 }), 6);
  assert.equal(costUsd('claude-haiku-5-5', { inputTokens: 2_000_000, outputTokens: 0 }), 0.2);
  assert.throws(() => costUsd('bilinmeyen-model', { inputTokens: 1, outputTokens: 1 }));
});

test('blindOrder: her model bir kez; on aramada her model her harfe en az üç kez düşer', () => {
  const counts: Record<string, number> = {};
  for (let i = 0; i < 10; i += 1) {
    const order = blindOrder(i);
    assert.deepEqual([...order].sort(), [...MODEL_KEYS].sort());
    order.forEach((model, slot) => (counts[model + slot] = (counts[model + slot] ?? 0) + 1));
  }
  assert.equal(Object.keys(counts).length, 9);
  assert.ok(Object.values(counts).every((n) => n >= 3));
});

test('veri: kimlikler benzersiz, etiketler ve tuzaklar var olan adayları gösterir, profilde ad yok', () => {
  const candidates = loadCandidates();
  const ids = new Set(candidates.map((c) => c.id));
  assert.equal(ids.size, candidates.length);
  for (const q of loadQueries()) {
    for (const id of [...Object.keys(q.labels), ...q.traps]) assert.ok(ids.has(id), `${q.id}: ${id} yok`);
    for (const id of q.traps) assert.ok((q.labels[id] ?? 0) <= 1, `${q.id}: tuzak ${id} yüksek etiketli`);
  }
  assert.ok(profileText(candidates[0]!).startsWith('Unvan: '));
});
