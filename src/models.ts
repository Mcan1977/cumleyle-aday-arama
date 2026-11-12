// Hangi iş hangi modelle çalışır ve bir çağrı kaç para tutar: tek tablo.

export const MODELS = {
  haiku: 'claude-haiku-5-5',
  sonnet: 'claude-sonnet-5-5',
  opus: 'claude-opus-5-5',
} as const;
export type ModelKey = keyof typeof MODELS;
export const MODEL_KEYS = Object.keys(MODELS) as ModelKey[];

/** Kriter çıkarma kısa ve kalıplı bir iş: en ucuz model yeter. */
export const CRITERIA_MODEL = MODELS.haiku;

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 256;

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

/** 1 milyon token başına dolar (liste fiyatı, Kasım 2026). Haiku fiyatı 100 bin token altındaki istemler içindir. */
const PRICES: Array<[prefix: string, price: { input: number; output: number }]> = [
  ['claude-haiku-5-5', { input: 0.1, output: 0.5 }],
  ['claude-sonnet-5-5', { input: 2, output: 10 }],
  ['claude-opus-5-5', { input: 4, output: 20 }],
  ['text-embedding-3-small', { input: 0.02, output: 0 }],
];

/** Çağrının dolar cinsinden maliyeti. Fiyatı bilinmeyen modelde hata verir: sessizce 0 yazmak tabloyu yanıltır. */
export function costUsd(model: string, usage: Usage): number {
  const price = PRICES.find(([prefix]) => model.startsWith(prefix))?.[1];
  if (!price) throw new Error(`Fiyatı bilinmeyen model: ${model}`);
  return (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
}
