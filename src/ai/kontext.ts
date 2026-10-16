// Aufbereitung des Akteninhalts für die KI und Suche passender Präzedenzfälle.
import { ENTSCHEIDUNGEN } from "@/core/rechtsprechung";
import { overlapScore, tokenize } from "@/core/search";
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
  gemeinsam: string[];
}

/** Ähnliche Entscheidungen: Schlagwort-Überlappung + Sachgebiet + Volltext. */
export function findePraezedenzfaelle(akte: Akte, data: TenantData, n = 5): Treffer[] {
  const doks = data.dokumente.filter((d) => d.akteId === akte.id).map((d) => d.inhalt).join(" ");
  const text = `${akte.titel} ${akte.beschreibung} ${akte.schlagworte.join(" ")} ${doks}`;
  const akteToks = new Set(tokenize(text));
  const out: Treffer[] = [];
  for (const e of ENTSCHEIDUNGEN) {
    let score = overlapScore(text, e.schlagworte) * 3;
    const gemeinsam = e.schlagworte.filter((s) => tokenize(s).every((t) => [...akteToks].some((x) => x === t || x.startsWith(t))));
    if (e.rechtsgebiet === akte.sachgebiet) score += 4;
    for (const t of tokenize(e.leitsatz)) if (akteToks.has(t)) score += 0.25;
    if (score > 4) out.push({ entscheidung: e, score, gemeinsam });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, n);
}

/** Relevanz als Prozentwert für die Anzeige. */
export function relevanzProzent(score: number, max: number): number {
  return Math.round(Math.min(99, 55 + (score / Math.max(max, 1)) * 44));
}
