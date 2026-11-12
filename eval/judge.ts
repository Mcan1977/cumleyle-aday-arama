// Kör hakem: üç modelin çıktısı A, B, C adıyla ve her aramada farklı sırayla verilir; hakem hangisinin hangi model
// olduğunu bilmez. Sıralama için asıl ölçüt etiketlerdir (report.ts); hakem özellikle gerekçelerin kalitesi için var.
// Var olan kayıt yeniden çalıştırılmaz; zorlamak için: npm run eval:hakem -- --force
import { z } from 'zod';

import { structured } from '../src/claude';
import { loadCandidates } from '../src/data';
import { MODELS } from '../src/models';
import { profileText } from '../src/types';
import { blindOrder } from './blind';
import { listJson, readJson, writeJson, type JudgeRun, type RawRun } from './files';

const LETTERS = ['A', 'B', 'C'] as const;

const judgeSchema = z.object({
  scores: z.array(
    z.object({
      system: z.enum(LETTERS),
      ranking: z.number().describe('Sıralamanın isteğe uygunluğu, 0-10 arası tam sayı.'),
      reasons: z.number().describe('Gerekçelerin kalitesi, 0-10 arası tam sayı.'),
      note: z.string().describe('Bir cümlelik açıklama.'),
    }),
  ),
});

const PROMPT = `Sen deneyimli bir işe alım uzmanısın ve bir aday sıralama sisteminin çıktılarını değerlendiriyorsun.
Bir arama isteği, aday profilleri ve aynı adaylar için üç ayrı sistemin (A, B, C) ürettiği sıralama verilecek. Sistemlerin ne olduğu senden gizlidir.

Her sistem için iki puan ver (0-10 arası tam sayı):
- "ranking": Sıralama isteğe ne kadar uygun? İsteğin açık koşullarını (şart koşulan yetenek, şehir ya da uzaktan çalışma, deneyim, öğrenci ya da profesyonel olma) karşılayan adaylar üstte mi; anahtar kelimesi tutan ama bir koşulu karşılamayan adaylar geride mi?
- "reasons": Gerekçeler profilde yazana dayanıyor mu (uydurma var mı), eksik koşulu açıkça söylüyor mu, kısa ve arayan kişinin işine yarar mı?
- "note": puanın nedenini anlatan, Türkçe yazılmış bir cümle.

Sistemleri birbirine göre değil isteğe göre değerlendir; hak ediyorlarsa aynı puanı verebilirsin. Her sistem için tam olarak bir sonuç döndür.`;

const force = process.argv.includes('--force');
const byId = new Map(loadCandidates().map((c) => [c.id, c]));
let spent = 0;

for (const [index, name] of listJson('results/raw').entries()) {
  const run = readJson<RawRun>(`results/raw/${name}`)!;
  const file = `results/judge/${name}`;
  if (!force && readJson<JudgeRun>(file)) {
    console.log(`${run.id}: kayıt var, atlandı`);
    continue;
  }
  const order = blindOrder(index);
  const blind = Object.fromEntries(LETTERS.map((letter, i) => [letter, order[i]!])) as JudgeRun['blind'];
  const profiles = run.neighbors.map((n) => ({ id: n.id, profil: profileText(byId.get(n.id)!) }));
  const systems = LETTERS.map((letter) => {
    const rows = run.models[blind[letter]].results.map((r, i) => ({ sira: i + 1, id: r.id, puan: r.score, gerekce: r.reason }));
    return `SİSTEM ${letter}:\n${JSON.stringify(rows)}`;
  });
  const input = [`ARAMA İSTEĞİ:\n${run.query}`, `ADAY PROFİLLERİ:\n${JSON.stringify(profiles)}`, ...systems].join('\n\n');

  const { output, call } = await structured(judgeSchema, { model: MODELS.opus, effort: 'medium', system: PROMPT, input });
  const scores = LETTERS.map((letter) => {
    const row = output.scores.find((s) => s.system === letter);
    if (!row) throw new Error(`${run.id}: hakem ${letter} sistemini puanlamadı.`);
    return row;
  });
  writeJson(file, { id: run.id, blind, scores, call } satisfies JudgeRun);
  spent += call.costUsd;
  console.log(`${run.id}: ${scores.map((s) => `${blind[s.system]} ${s.ranking}/${s.reasons}`).join(', ')}; ${call.costUsd.toFixed(4)} dolar`);
}
console.log(`Toplam: ${spent.toFixed(4)} dolar`);
