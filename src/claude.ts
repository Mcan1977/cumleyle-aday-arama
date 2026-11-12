import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';

import { costUsd, type Usage } from './models';

export type Effort = 'low' | 'medium' | 'high';

/** Bir model çağrısının kaydı: hangi model yanıtladı, kaç token, kaç dolar, kaç milisaniye. İçerik tutulmaz. */
export interface CallRecord {
  model: string;
  usage: Usage;
  costUsd: number;
  ms: number;
}

let client: Anthropic | undefined;
/** İstemci ilk çağrıda kurulur; anahtar ANTHROPIC_API_KEY ortam değişkeninden okunur. */
function anthropic(): Anthropic {
  return (client ??= new Anthropic({ timeout: 120_000, maxRetries: 2 }));
}

/**
 * Şemaya uyan yapılandırılmış yanıt ister. Yanıtın biçimini API garanti eder; yine de ret, kesilme ve ayrıştırma
 * hatası ayrı ayrı yakalanır, çünkü üçü de sessizce boş sonuç üretebilir.
 */
export async function structured<S extends z.ZodType>(
  schema: S,
  opts: { model: string; effort: Effort; system: string; input: string },
): Promise<{ output: z.infer<S>; call: CallRecord }> {
  const started = performance.now();
  const response = await anthropic().messages.parse({
    model: opts.model,
    max_tokens: 16_000,
    system: opts.system,
    messages: [{ role: 'user', content: opts.input }],
    output_config: { effort: opts.effort, format: zodOutputFormat(schema) },
  });
  const ms = Math.round(performance.now() - started);

  if (response.stop_reason === 'refusal') throw new Error(`Model isteği yanıtlamadı (${opts.model}).`);
  if (response.stop_reason === 'max_tokens') throw new Error(`Yanıt token sınırında kesildi (${opts.model}).`);
  if (!response.parsed_output) throw new Error(`Yanıt şemaya göre ayrıştırılamadı (${opts.model}).`);

  const usage: Usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
  return {
    output: response.parsed_output as z.infer<S>,
    call: { model: response.model, usage, costUsd: costUsd(response.model, usage), ms },
  };
}
