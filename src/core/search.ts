// Leichtgewichtige Volltextsuche mit deutscher Normalisierung (Umlaute, ß, einfache Stammformen),
// Präfix-Treffern und Feldgewichtung. Läuft vollständig lokal – keine Mandantendaten verlassen das Gerät.

const STOP = new Set([
  "der", "die", "das", "und", "oder", "ein", "eine", "einer", "eines", "einem", "einen", "den", "dem", "des",
  "im", "in", "ist", "zu", "zum", "zur", "mit", "von", "vom", "auf", "für", "fur", "an", "am", "bei", "als",
  "auch", "nicht", "nach", "wie", "wird", "werden", "wurde", "sich", "es", "sie", "er", "wir", "ich", "dass",
]);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

function stem(t: string): string {
  if (t.length <= 4) return t;
  for (const suf of ["ungen", "heiten", "keiten", "ung", "heit", "keit", "en", "er", "es", "e", "n", "s"]) {
    if (t.endsWith(suf) && t.length - suf.length >= 4) return t.slice(0, -suf.length);
  }
  return t;
}

export function tokenize(s: string): string[] {
  return normalize(s)
    .split(/[^a-z0-9§/]+/)
    .map((t) => t.replace(/^\/+|\/+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

export interface SearchField<T> {
  get: (item: T) => string | undefined | null;
  weight: number;
}

export interface Hit<T> {
  item: T;
  score: number;
}

/** Durchsucht Items; jedes Suchwort muss (als Präfix) in mindestens einem Feld vorkommen. */
export function search<T>(items: T[], query: string, fields: SearchField<T>[], limit = 50): Hit<T>[] {
  const q = tokenize(query);
  if (q.length === 0) return [];
  const rawQ = normalize(query).trim();
  const hits: Hit<T>[] = [];
  for (const item of items) {
    let score = 0;
    let allMatched = true;
    const fieldTokens = fields.map((f) => {
      const v = f.get(item) ?? "";
      return { tokens: tokenize(v), raw: normalize(v), weight: f.weight };
    });
    for (const term of q) {
      let best = 0;
      for (const ft of fieldTokens) {
        for (const tok of ft.tokens) {
          if (tok === term) best = Math.max(best, 3 * ft.weight);
          else if (tok.startsWith(term)) best = Math.max(best, 2 * ft.weight);
          else if (term.length >= 5 && tok.includes(term)) best = Math.max(best, 1 * ft.weight);
        }
      }
      if (best === 0) {
        allMatched = false;
        break;
      }
      score += best;
    }
    if (!allMatched) continue;
    // Bonus für exakte Phrase (z. B. Aktenzeichen „142/26")
    for (const ft of fieldTokens) if (rawQ.length > 2 && ft.raw.includes(rawQ)) score += 4 * ft.weight;
    hits.push({ item, score });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

/** Relevanz zwischen Freitext und Schlagwortliste (für „ähnliche Fälle"). */
export function overlapScore(text: string, keywords: string[]): number {
  const toks = new Set(tokenize(text));
  let s = 0;
  for (const kw of keywords) {
    const kt = tokenize(kw);
    if (kt.length && kt.every((t) => [...toks].some((x) => x === t || x.startsWith(t) || t.startsWith(x)))) s += kt.length > 1 ? 2 : 1;
  }
  return s;
}

/** Markiert Treffer im Text für die Anzeige: gibt Segmente zurück. */
export function highlight(text: string, query: string): { text: string; hit: boolean }[] {
  const terms = tokenize(query).filter((t) => t.length > 1);
  if (!terms.length) return [{ text, hit: false }];
  const out: { text: string; hit: boolean }[] = [];
  const re = /[A-Za-zÄÖÜäöüß0-9§]+|[^A-Za-zÄÖÜäöüß0-9§]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const word = m[0];
    const nw = stem(normalize(word));
    const hit = /[A-Za-zÄÖÜäöüß0-9]/.test(word) && terms.some((t) => nw.startsWith(t));
    const last = out[out.length - 1];
    if (last && last.hit === hit) last.text += word;
    else out.push({ text: word, hit });
  }
  return out;
}

/** Kontext-Ausschnitt rund um den ersten Treffer. */
export function snippet(text: string, query: string, radius = 90): string {
  const terms = tokenize(query);
  const norm = normalize(text);
  let idx = -1;
  for (const t of terms) {
    const i = norm.indexOf(t);
    if (i >= 0 && (idx < 0 || i < idx)) idx = i;
  }
  if (idx < 0) return text.slice(0, radius * 2) + (text.length > radius * 2 ? " …" : "");
  let start = Math.max(0, idx - radius);
  let end = Math.min(text.length, idx + radius);
  // an Wortgrenzen ausrichten
  if (start > 0) {
    const sp = text.indexOf(" ", start);
    if (sp > 0 && sp < idx) start = sp + 1;
  }
  if (end < text.length) {
    const sp = text.lastIndexOf(" ", end);
    if (sp > idx) end = sp;
  }
  return (start > 0 ? "… " : "") + text.slice(start, end).trim() + (end < text.length ? " …" : "");
}
