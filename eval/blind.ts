import type { ModelKey } from '../src/models';

/**
 * Hakemin göreceği A, B, C sırası. Rastgele karıştırmak yerine altı olası sıra dönüşümlü kullanılır: böylece on aramada
 * her model her harfe yaklaşık eşit sayıda düşer ve "hep son sıradaki sistem" gibi bir konum etkisi modele yapışmaz.
 */
const ROTATION: ModelKey[][] = [
  ['haiku', 'sonnet', 'opus'],
  ['sonnet', 'opus', 'haiku'],
  ['opus', 'haiku', 'sonnet'],
  ['haiku', 'opus', 'sonnet'],
  ['opus', 'sonnet', 'haiku'],
  ['sonnet', 'haiku', 'opus'],
];

export function blindOrder(index: number): ModelKey[] {
  return [...ROTATION[index % ROTATION.length]!];
}
