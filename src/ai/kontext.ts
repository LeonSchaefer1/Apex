// Aufbereitung des Akteninhalts für die KI und Suche passender Präzedenzfälle.
import { ENTSCHEIDUNGEN } from "@/core/rechtsprechung";
import { tokenize } from "@/core/search";
import { fmtDate, fmtEUR } from "@/core/dates";
import type { Akte, Entscheidung, TenantData } from "@/core/types";

export function kontaktName(data: TenantData, id?: string) {
  return data.kontakte.find((k) => k.id === id)?.name;
}

/** Kompakte Textfassung einer Akte für Prompts (gekürzt, ohne Bankdaten). */
export function akteAlsText(akte: Akte, data: TenantData, maxDok = 6): string {
  const doks = data.dokumente.filter((d) => d.akteId === akte.id).slice(0, maxDok);
  const fristen = data.fristen.filter((f) => f.akteId === akte.id && f.status === "offen");
  const notizen = data.notizen.filter((n) => n.akteId === akte.id);
  const zeilen = [
    `Aktenzeichen: ${akte.aktenzeichen}`,
    `Titel: ${akte.titel}`,
    `Sachgebiet: ${akte.sachgebiet} · Phase: ${akte.phase} · Status: ${akte.status}`,
    `Mandant: ${kontaktName(data, akte.mandantId) ?? "–"}`,
    akte.gegnerId ? `Gegner: ${kontaktName(data, akte.gegnerId)}` : "",
    akte.gerichtId ? `Gericht: ${kontaktName(data, akte.gerichtId)} (Az. ${akte.gerichtsAz ?? "–"})` : "",
    akte.gegenstandswert ? `Gegenstandswert: ${fmtEUR(akte.gegenstandswert)}` : "",
    akte.rsv ? `Rechtsschutz: ${akte.rsv.versicherung}, Deckung ${akte.rsv.deckung}` : "",
    `Sachverhalt: ${akte.beschreibung}`,
    fristen.length ? `Offene Fristen: ${fristen.map((f) => `${f.titel} bis ${fmtDate(f.datum)}${f.grundlage ? ` (${f.grundlage})` : ""}`).join("; ")}` : "",
    notizen.length ? `Notizen: ${notizen.map((n) => n.text).join(" | ")}` : "",
    "",
    "Dokumente:",
    ...doks.map((d) => `### ${d.name} (${fmtDate(d.createdAt.slice(0, 10))})\n${d.inhalt.slice(0, 1600)}`),
  ];
  return zeilen.filter((z) => z !== "").join("\n");
}

export interface Treffer {
  entscheidung: Entscheidung;
  score: number;
  /** Schlagworte der Entscheidung, die im Kern der Akte (Titel, Sachverhalt, Schlagworte) vorkommen */
  gemeinsam: string[];
}

/**
 * Wortvergleich mit Stammformen: gleich, Wort beginnt mit dem Stichwort („kündigungen“ ↔ „kündigung“) oder
 * unterscheidet sich nur in der Endung. Kurze Wortreste („hin“, „ver“) oder Wortanfänge („verzug“ ↔
 * „verzugspauschale“) zählen nicht als Treffer.
 */
function wortPasst(stichwort: string, wort: string): boolean {
  if (wort === stichwort) return true;
  if (stichwort.length >= 4 && wort.startsWith(stichwort)) return true;
  return wort.length >= 5 && stichwort.startsWith(wort) && stichwort.length - wort.length <= 2;
}

function enthaelt(woerter: string[], schlagwort: string): boolean {
  const teile = tokenize(schlagwort);
  return teile.length > 0 && teile.every((t) => woerter.some((w) => wortPasst(t, w)));
}

/**
 * Bewertet eine Entscheidung für eine Akte.
 * - Schlagwort im Kern der Akte (Titel, Sachverhalt, Schlagworte): 3 Punkte (mehrteilig 5)
 * - Schlagwort nur in Dokumenten oder Notizen: 1 Punkt (mehrteilig 2) – z. B. „Arbeitszeit“ aus dem Arbeitsvertrag
 * - gleiches Rechtsgebiet: 2 Punkte; Leitsatz-Begriffe im Kern: je 0,3 (höchstens 3)
 */
export function bewertePraezedenz(akte: Akte, data: TenantData, e: Entscheidung): Treffer & { nurDokumente: string[] } {
  const kern = tokenize(`${akte.titel} ${akte.beschreibung} ${akte.schlagworte.join(" ")}`);
  const rest = tokenize([...data.dokumente.filter((d) => d.akteId === akte.id).map((d) => d.inhalt), ...data.notizen.filter((n) => n.akteId === akte.id).map((n) => n.text)].join(" "));
  const kernSet = new Set(kern);
  let score = 0;
  const gemeinsam: string[] = [];
  const nurDokumente: string[] = [];
  for (const sw of e.schlagworte) {
    const mehrteilig = tokenize(sw).length > 1;
    if (enthaelt(kern, sw)) {
      gemeinsam.push(sw);
      score += mehrteilig ? 5 : 3;
    } else if (enthaelt(rest, sw)) {
      nurDokumente.push(sw);
      score += mehrteilig ? 2 : 1;
    }
  }
  if (e.rechtsgebiet === akte.sachgebiet) score += 2;
  score += Math.min(3, tokenize(e.leitsatz).filter((t) => t.length >= 5 && kernSet.has(t)).length * 0.3);
  return { entscheidung: e, score, gemeinsam, nurDokumente };
}

/** Mindestpunktzahl für einen Präzedenzfall-Vorschlag */
export const MIN_SCORE = 7;

/**
 * Ähnliche Entscheidungen für eine Akte. Mindestrelevanz: mindestens zwei gemeinsame Schlagworte im Kern der Akte –
 * oder eines im Kern und eines in den Dokumenten. Treffer, die nur auf dem Rechtsgebiet oder einem einzelnen
 * Schlagwort beruhen, werden ausgeblendet.
 */
export function findePraezedenzfaelle(akte: Akte, data: TenantData, n = 5): Treffer[] {
  const out: Treffer[] = [];
  for (const e of ENTSCHEIDUNGEN) {
    const t = bewertePraezedenz(akte, data, e);
    const relevant = t.score >= MIN_SCORE && (t.gemeinsam.length >= 2 || (t.gemeinsam.length === 1 && t.nurDokumente.length >= 1));
    if (relevant) out.push({ entscheidung: t.entscheidung, score: t.score, gemeinsam: t.gemeinsam });
  }
  out.sort((a, b) => b.score - a.score);
  const top = out[0]?.score ?? 0;
  // deutlich schwächere Treffer als der beste nicht mitschleppen
  return out.filter((t) => t.score >= top * 0.3).slice(0, n);
}

/**
 * Relevanz als Prozentwert für die Anzeige: zu 65 % absolut (ab 18 Punkten volle Übereinstimmung),
 * zu 35 % relativ zum besten Treffer. Ein einzelner schwacher Treffer erscheint so nicht als „99 %“.
 */
export function relevanzProzent(score: number, max: number): number {
  const absolut = Math.min(1, Math.max(0, score) / 18);
  const relativ = Math.min(1, Math.max(0, score) / Math.max(max, 1));
  return Math.round(Math.min(99, 50 + 49 * (0.65 * absolut + 0.35 * relativ)));
}
