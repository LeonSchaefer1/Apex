// Suche nach Fristarten (Fristenrechner, „Frist anlegen“): wortweise UND-Suche über Wortanfänge, mit Abkürzungen der
// Gerichte und Rangfolge „Titeltreffer zuerst“. Reine Suchhilfe – berechnet wird ausschließlich in src/core/fristen.ts.
import { FRIST_REGELN, type FristRegel } from "@/core/fristen";
import { normalize } from "@/core/search";

/** Abkürzungen und Langformen, die sich gegenseitig finden (normalisiert, ohne Umlaute). */
const SYNONYME: string[][] = [
  ["arbg", "arbeitsgericht"],
  ["lag", "landesarbeitsgericht"],
  ["bag", "bundesarbeitsgericht"],
  ["olg", "oberlandesgericht"],
  ["lg", "landgericht"],
  ["ag", "amtsgericht"],
  ["bgh", "bundesgerichtshof"],
  ["vg", "verwaltungsgericht"],
  ["begruendung", "begruendungsfrist"],
  ["vu", "versaeumnisurteil"],
  ["mb", "mahnbescheid"],
  ["vb", "vollstreckungsbescheid"],
];

/**
 * Gerichte, bei denen bzw. gegen deren Entscheidungen die Frist läuft – damit „LAG“ die arbeitsgerichtliche Berufung
 * findet und „OLG“ die zivilprozessuale. Ergänzt die Stichworte der Fristregeln, ohne sie zu verändern.
 */
function gerichtsWoerter(r: FristRegel): string[] {
  const k = r.key;
  if (r.gebiet === "Arbeitsrecht") {
    if (/berufung/.test(k)) return ["arbeitsgericht", "arbg", "landesarbeitsgericht", "lag"];
    if (/revision/.test(k)) return ["landesarbeitsgericht", "lag", "bundesarbeitsgericht", "bag"];
    return ["arbeitsgericht", "arbg"];
  }
  if (r.gebiet === "Zivilprozess") {
    if (/^berufung/.test(k)) return ["amtsgericht", "ag", "landgericht", "lg", "oberlandesgericht", "olg"];
    if (/^revision/.test(k)) return ["oberlandesgericht", "olg", "bundesgerichtshof", "bgh"];
  }
  if (r.gebiet === "Verwaltungsrecht") return ["verwaltungsgericht", "vg"];
  return [];
}

const woerter = (s: string) => normalize(s).replace(/§/g, " ").split(/[^a-z0-9]+/).filter(Boolean);

/** Varianten eines Suchworts (Abkürzung ↔ Langform). */
function varianten(token: string): string[] {
  const v = new Set([token]);
  for (const gruppe of SYNONYME) if (gruppe.includes(token)) for (const g of gruppe) v.add(g);
  return [...v];
}

/** Treffergüte eines Suchworts in einer Wortliste: 3 = ganzes Wort, 2 = Wortanfang, 1 = Wortteil (ab 5 Zeichen, z. B. „begründung“ in „Berufungsbegründungsfrist“). */
function guete(token: string, liste: string[]): number {
  let best = 0;
  for (const t of varianten(token)) {
    for (const w of liste) {
      if (w === t) return 3;
      if (w.startsWith(t)) best = Math.max(best, 2);
      else if (t.length >= 5 && w.includes(t)) best = Math.max(best, 1);
    }
  }
  return best;
}

export interface FristartTreffer {
  regel: FristRegel;
  punkte: number;
}

/**
 * Fristarten zur Suche `q`: jedes Wort muss passen (UND), Wortanfänge statt beliebiger Teilstrings („LAG“ findet nicht
 * „Klage“), Abkürzungen der Gerichte; Titeltreffer zählen dreifach (bei Gleichstand bleibt die Grundreihenfolge). Ohne Suchtext alle Fristarten in der Grundreihenfolge.
 */
export function sucheFristarten(q: string, regeln: FristRegel[] = FRIST_REGELN): FristRegel[] {
  const tokens = woerter(q);
  if (!tokens.length) return regeln;
  const treffer: (FristartTreffer & { i: number })[] = [];
  regeln.forEach((regel, i) => {
    const titel = woerter(regel.titel);
    const rest = [...woerter([regel.grundlage, regel.ereignis, regel.gebiet, ...regel.stichworte].join(" ")), ...gerichtsWoerter(regel)];
    let punkte = 0;
    for (const t of tokens) {
      const imTitel = guete(t, titel);
      const sonst = guete(t, rest);
      if (!imTitel && !sonst) return;
      // Titeltreffer zuerst; unter gleich guten Treffern bleibt die Grundreihenfolge (ZPO vor Sondergebieten)
      punkte += imTitel ? 3 : 1;
    }
    treffer.push({ regel, punkte, i });
  });
  return treffer.sort((a, b) => b.punkte - a.punkte || a.i - b.i).map((t) => t.regel);
}
