// Einschätzung der Erfolgsaussicht ohne Scheingenauigkeit: verbale Stufe, Faktoren mit Quelle, Status der Deckungsanfrage.
// Reine Funktionen – genutzt von der KI-Fallanalyse (src/ai/fallanalyse.ts), dem Panel und dem Cockpit.
import type { Aktivitaet, Dokument, ID, ISODateTime } from "./types";

export type Stufe = "hoch" | "mittel" | "gering";

/** Einheitliche Stufen-Wörter (Fallanalyse, Cockpit, Landing-Vorschau, Fachseiten). */
export const STUFE_WORT: Record<Stufe, string> = { hoch: "Gute Aussichten", mittel: "Offen", gering: "Schwierig" };

/** Hinweis zur Prozentzahl – sie ist nur ein Schätzwert der KI. */
export const SCHAETZWERT_HINWEIS = "KI-Schätzwert, keine Wahrscheinlichkeit";

/** Stufe aus dem KI-Schätzwert: ab 65 „Gute Aussichten“, ab 40 „Offen“, darunter „Schwierig“. */
export function stufeAusProzent(p: number): Stufe {
  return p >= 65 ? "hoch" : p >= 40 ? "mittel" : "gering";
}

export function stufeWort(s: Stufe | undefined, prozent?: number): string {
  const st = s ?? (typeof prozent === "number" ? stufeAusProzent(prozent) : undefined);
  return st ? STUFE_WORT[st] : "Noch keine Einschätzung";
}

export type QuellenArt = "entscheidung" | "norm" | "dokument";
export interface FaktorQuelle {
  art: QuellenArt;
  label: string;
  /** Entscheidung (Fall-Datenbank) bzw. Dokument der Akte */
  id?: string;
}
export type Gewicht = "stark" | "mittel" | "gering";
export interface Faktor {
  text: string;
  richtung: "pro" | "contra";
  gewicht: Gewicht;
  /** leer = „ohne Beleg – anwaltlich prüfen“ */
  quellen: FaktorQuelle[];
}
export const OHNE_BELEG = "ohne Beleg – anwaltlich prüfen";

export interface FaktorKontext {
  entscheidungen: { id: string; gericht: string; az: string }[];
  dokumente: Pick<Dokument, "id" | "name">[];
}

const ws = (s: string) => s.replace(/\s+/g, " ").trim();

/** Normzitate wie „§ 626 Abs. 1 BGB“, „§§ 187 ff. BGB“, „§ 159 Abs. 1 S. 2 Nr. 7 SGB III“, „Art. 9 DSGVO“. */
const NORM = /(?:§§?|Art\.)\s*\d+[a-z]?(?:\s*(?:ff?\.|Abs\.\s*\d+[a-z]?|S\.\s*\d+|Satz\s*\d+|Nr\.\s*\d+[a-z]?|lit\.\s*[a-z]|,\s*\d+[a-z]?))*\s+(?:SGB\s+[IVX]+|[A-ZÄÖÜ][a-zäöü]*[A-ZÄÖÜ][A-Za-zÄÖÜäöü]*)/g;

/** Allgemeine Wörter in Dokumentnamen, die allein keinen Beleg ergeben. */
const DOK_STOP = new Set([
  "schreiben", "entwurf", "anlage", "anlagen", "dokument", "nachricht", "rechnung", "vollmacht", "mandant", "mandantin", "kanzlei", "notiz", "vermerk", "schriftsatz",
  "gegenseite", "beklagte", "beklagten", "klägerin", "klaegerin", "gericht", "gerichts", "versicherung", "rechtsschutz",
]);

function dokWorte(name: string): string[] {
  return name
    .replace(/\.[a-z]{2,4}$/i, "")
    .split(/[^A-Za-zÄÖÜäöüß]+/)
    .filter((w) => w.length >= 7 && !DOK_STOP.has(w.toLowerCase()))
    .map((w) => w.toLowerCase());
}

/** Belege eines Arguments: zitierte Entscheidungen der Fall-Datenbank, Normen und Dokumente der Akte. */
export function belegeIn(text: string, k: FaktorKontext): FaktorQuelle[] {
  const t = ws(text);
  const tl = t.toLowerCase();
  const quellen: FaktorQuelle[] = [];
  for (const e of k.entscheidungen) {
    if (e.az && t.includes(ws(e.az))) quellen.push({ art: "entscheidung", label: `${e.gericht} ${e.az}`, id: e.id });
  }
  const normen = new Set<string>();
  for (const m of t.matchAll(NORM)) normen.add(ws(m[0]));
  for (const n of normen) quellen.push({ art: "norm", label: n });
  for (const d of k.dokumente) {
    const worte = dokWorte(d.name);
    // Wortstamm genügt („Übergabeprotokoll“ ↔ „Übergabeprotokolls“), mindestens 7 Zeichen
    if (worte.some((w) => tl.includes(w.slice(0, Math.max(7, w.length - 2))))) quellen.push({ art: "dokument", label: d.name, id: d.id });
  }
  return quellen;
}

/** Gewicht nach der Reihenfolge der Begründung: erstes Argument stark, zweites mittel, danach gering. */
function gewichtNach(i: number): Gewicht {
  return i === 0 ? "stark" : i === 1 ? "mittel" : "gering";
}

/** Pro- und Contra-Faktoren mit Gewicht und Quelle (oder ohne Beleg). */
export function faktorenAus(pro: string[], contra: string[], k: FaktorKontext): Faktor[] {
  return [
    ...pro.map((text, i) => ({ text, richtung: "pro" as const, gewicht: gewichtNach(i), quellen: belegeIn(text, k) })),
    ...contra.map((text, i) => ({ text, richtung: "contra" as const, gewicht: gewichtNach(i), quellen: belegeIn(text, k) })),
  ];
}

// ───────────── Deckungsanfrage ─────────────

export interface DeckungsStatus {
  status: "keine" | "entwurf" | "versandt";
  am?: ISODateTime;
  vonId?: ID;
  dokumentId?: ID;
}

/**
 * Tatsächlicher Stand der Deckungsanfrage einer Akte: versandt (Freigabe durch eine Person protokolliert), Entwurf (Dokument
 * liegt vor, Versand erst nach Freigabe) oder noch keine. Vorlagen des 38h-Motors gelten nicht als Versand.
 */
export function deckungsanfrageStatus(akteId: ID, aktivitaeten: Aktivitaet[], dokumente: Pick<Dokument, "id" | "akteId" | "name" | "createdAt">[]): DeckungsStatus {
  const versand = aktivitaeten
    .filter((a) => a.akteId === akteId && a.akteur === "nutzer" && /deckungsanfrage/i.test(a.text) && /\b(versandt|versendet|verschickt)\b/i.test(a.text) && !/nicht\s+(versandt|versendet)/i.test(a.text))
    .sort((a, b) => b.zeit.localeCompare(a.zeit))[0];
  if (versand) return { status: "versandt", am: versand.zeit, vonId: versand.userId };
  const dok = dokumente.filter((d) => d.akteId === akteId && /deckungsanfrage/i.test(d.name)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (dok) return { status: "entwurf", dokumentId: dok.id };
  return { status: "keine" };
}

/** „Entwurf – wartet auf Ihre Freigabe“ / „versandt am 14.10.2026 von Mia Becker“ / „noch nicht gestellt“. */
export function deckungsText(s: DeckungsStatus, name?: (id: ID) => string | undefined, datum?: (iso: string) => string): string {
  if (s.status === "versandt") {
    const wer = s.vonId ? name?.(s.vonId) : undefined;
    const wann = s.am ? (datum ? datum(s.am) : s.am.slice(0, 10).split("-").reverse().join(".")) : undefined;
    return `versandt${wann ? ` am ${wann}` : ""}${wer ? ` von ${wer}` : ""}`;
  }
  if (s.status === "entwurf") return "Entwurf – wartet auf Ihre Freigabe";
  return "noch nicht gestellt";
}
