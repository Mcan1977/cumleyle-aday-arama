export interface Candidate {
  id: string;
  title: string;
  type: 'student' | 'professional';
  years: number;
  city: string;
  remote: boolean;
  skills: string[];
  about: string;
  projects: string[];
}

/** Modele ve vektör aramasına giden aday metni. Ad, iletişim bilgisi ve şirket adı içermez. */
export function profileText(c: Candidate): string {
  const experience = c.type === 'student' ? 'Öğrenci' : c.years > 0 ? `Profesyonel, ${c.years} yıl deneyim` : 'Profesyonel, yeni mezun';
  return [
    `Unvan: ${c.title}`,
    `Durum: ${experience}`,
    `Konum: ${c.city}; ${c.remote ? 'uzaktan çalışabilir' : 'uzaktan çalışmıyor'}`,
    `Yetenekler: ${c.skills.join(', ')}`,
    `Hakkında: ${c.about}`,
    'Projeler:',
    ...c.projects.map((p) => `- ${p}`),
  ].join('\n');
}
