// Sıralama ölçütleri. Etiketler 0-3 arasıdır: 3 tam uyum, 2 güçlü ama eksikli, 1 kısmi, 0 ilgisiz.

export type Labels = Record<string, number>;

const gain = (label: number) => 2 ** label - 1;

/** İlk k sıradaki kazanç; alt sıralar logaritmik olarak daha az sayılır. */
export function dcg(labelsInOrder: number[], k: number): number {
  return labelsInOrder.slice(0, k).reduce((sum, label, index) => sum + gain(label) / Math.log2(index + 2), 0);
}

/**
 * nDCG@k: verilen sıranın, aynı adayların olabilecek en iyi sırasına oranı (0-1). İlgili aday hiç yoksa null döner:
 * o arama ortalamaya katılmaz.
 */
export function ndcg(orderedIds: string[], labels: Labels, k: number): number | null {
  const inOrder = orderedIds.map((id) => labels[id] ?? 0);
  const ideal = dcg([...inOrder].sort((a, b) => b - a), k);
  return ideal === 0 ? null : dcg(inOrder, k) / ideal;
}

/** İlk sıradaki aday, listedeki en yüksek etiketli adaylardan biri mi? */
export function topIsBest(orderedIds: string[], labels: Labels): boolean {
  const best = Math.max(...orderedIds.map((id) => labels[id] ?? 0));
  return best > 0 && (labels[orderedIds[0]!] ?? 0) === best;
}

/**
 * Öne geçen tuzak sayısı. Tuzak, anahtar kelimesi tutan ama açık bir koşulu karşılamayan adaydır; kendisinden daha
 * yüksek etiketli bir adayın üstüne çıktıysa sayılır. (İlgili aday az olan aramada tuzak ister istemez üst sıralara
 * gelir; bu yüzden "ilk 3'te tuzak var mı" yerine bu sayılır.)
 */
export function trapsAhead(orderedIds: string[], labels: Labels, traps: string[]): number {
  return orderedIds.filter((id, index) => {
    if (!traps.includes(id)) return false;
    const own = labels[id] ?? 0;
    return orderedIds.slice(index + 1).some((below) => (labels[below] ?? 0) > own);
  }).length;
}

export function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}
