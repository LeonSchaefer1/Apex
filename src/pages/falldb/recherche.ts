// Fachlogik der Fall-Datenbank: Suchfelder, Zitierweise, ähnliche Entscheidungen und die KI-Recherche (live & offline).
import { ENTSCHEIDUNGEN } from "@/core/rechtsprechung";
import { overlapScore, tokenize, type SearchField } from "@/core/search";
import { fmtDate } from "@/core/dates";
import type { Akte, Entscheidung } from "@/core/types";
import { llmJson, DemoModus } from "@/ai/llm";

export type Ebene = Entscheidung["ebene"];

/** Gewichtete Suchfelder: Aktenzeichen und Titel zählen mehr als der Fließtext. */
export const ENTSCHEIDUNG_FELDER: SearchField<Entscheidung>[] = [
  { get: (e) => e.az, weight: 5 },
  { get: (e) => e.titel, weight: 4 },
  { get: (e) => e.schlagworte.join(" "), weight: 3 },
  { get: (e) => e.normen.join(" "), weight: 3 },
  { get: (e) => `${e.gericht} ${e.spruchkoerper ?? ""}`, weight: 2 },
  { get: (e) => e.leitsatz, weight: 2 },
  { get: (e) => e.bedeutung, weight: 1 },
];

/** Beispielanfragen für die Stichwortsuche. */
export const BEISPIEL_SUCHEN = [
  "Kündigung wegen Bagatelle nach langer Betriebszugehörigkeit",
  "Schönheitsreparaturen unrenovierte Wohnung",
  "§ 626 BGB",
  "VIII ZR 185/14",
  "Dashcam als Beweis",
  "Rohmessdaten Blitzer",
  "Digitaler Nachlass",
];

/** Beispiel-Sachverhalte für die KI-Recherche. */
export const BEISPIEL_SACHVERHALTE = [
  {
    titel: "Fristlose Kündigung",
    text: "Fristlose Kündigung nach 14 Jahren Betriebszugehörigkeit: Der Mandant (52) hat drei beschädigte Kaffeepackungen aus dem Entsorgungscontainer mitgenommen – Warenwert 8,97 €. Eine Abmahnung gab es nie.",
  },
  {
    titel: "Kaution & Renovierung",
    text: "Die Vermieterin behält die Kaution von 2.850 € für Malerarbeiten ein. Die Wohnung wurde beim Einzug unrenoviert übergeben, laut Mietvertrag soll die Mieterin trotzdem alle fünf Jahre streichen.",
  },
  {
    titel: "Unfall mit Kürzung",
    text: "Nach einem Auffahrunfall kürzt die gegnerische Versicherung die fiktiv abgerechneten Reparaturkosten und verweist auf eine günstigere freie Werkstatt. Das Auto ist zwei Jahre alt und scheckheftgepflegt; eine Dashcam hat den Unfall aufgezeichnet.",
  },
];

/** Zitierweise wie im Schriftsatz: „BGH, Urt. v. 18.03.2015 – VIII ZR 185/14“. */
export function zitat(e: Entscheidung): string {
  return `${e.gericht}, ${e.art === "Urteil" ? "Urt." : "Beschl."} v. ${fmtDate(e.datum)} – ${e.az}`;
}

export function jahr(e: Entscheidung): number {
  return Number(e.datum.slice(0, 4));
}

export function entscheidung(id: string | null | undefined): Entscheidung | undefined {
  return id ? ENTSCHEIDUNGEN.find((e) => e.id === id) : undefined;
}

/** Ausgeschriebener Gerichtsname für Überschriften. */
export const GERICHT_NAME: Record<string, string> = {
  BVerfG: "Bundesverfassungsgericht",
  EuGH: "Gerichtshof der Europäischen Union",
  BGH: "Bundesgerichtshof",
  BAG: "Bundesarbeitsgericht",
  BVerwG: "Bundesverwaltungsgericht",
  BFH: "Bundesfinanzhof",
  BSG: "Bundessozialgericht",
  OLG: "Oberlandesgericht",
  LAG: "Landesarbeitsgericht",
  LG: "Landgericht",
  AG: "Amtsgericht",
  ArbG: "Arbeitsgericht",
};

function normKern(n: string): string {
  const nr = n.match(/\d+[a-z]?/)?.[0] ?? n;
  const gesetz = n.trim().split(/\s+/).pop() ?? "";
  return `${nr} ${gesetz}`.toLowerCase();
}

/** Ähnliche Entscheidungen: gemeinsame Schlagworte, gleiche Normen, gleiches Rechtsgebiet. */
export function aehnlicheEntscheidungen(e: Entscheidung, n = 3): Entscheidung[] {
  const text = `${e.titel} ${e.schlagworte.join(" ")}`;
  const normen = new Set(e.normen.map(normKern));
  return ENTSCHEIDUNGEN.filter((x) => x.id !== e.id)
    .map((x) => {
      let s = overlapScore(text, x.schlagworte) * 2;
      if (x.rechtsgebiet === e.rechtsgebiet) s += 2;
      if (x.normen.some((nx) => normen.has(normKern(nx)))) s += 3;
      return { x, s };
    })
    .filter((t) => t.s > 2)
    .sort((a, b) => b.s - a.s || b.x.datum.localeCompare(a.x.datum))
    .slice(0, n)
    .map((t) => t.x);
}

/** Welche offenen Akten passen zu einer Entscheidung? (für die Vorauswahl beim Anheften) */
export function passendeAkten(e: Entscheidung, akten: Akte[]): Akte[] {
  return akten
    .map((a) => {
      let s = overlapScore(`${a.titel} ${a.beschreibung} ${a.schlagworte.join(" ")}`, e.schlagworte) * 2;
      if (a.sachgebiet === e.rechtsgebiet) s += 2;
      return { a, s };
    })
    .filter((t) => t.s >= 4)
    .sort((x, y) => y.s - x.s)
    .map((t) => t.a);
}

// ───────────────────────── KI-Recherche ─────────────────────────

export interface RechercheTreffer {
  entscheidung: Entscheidung;
  relevanz: number; // 0..100
  begruendung: string;
  gemeinsam: string[];
}

export interface RechercheErgebnis {
  treffer: RechercheTreffer[];
  quelle: "live" | "offline";
  hinweis?: string; // z. B. Rückfall auf Offline-Recherche
  verworfen?: number; // KI-Vorschläge ohne gültige ID (nicht in der Fall-Datenbank)
  dauerMs: number;
}

function kennzeichen(text: string) {
  const toks = new Set(tokenize(text));
  const passt = (kw: string) => {
    const kt = tokenize(kw);
    return kt.length > 0 && kt.every((t) => [...toks].some((x) => x === t || x.startsWith(t) || t.startsWith(x)));
  };
  return { toks, passt };
}

/** Offline-Recherche: Schlagwort-Überlappung, Leitsatz-Wortschatz und Normen – nachvollziehbar und ohne Netz. */
export function offlineRecherche(sachverhalt: string, n = 4): RechercheTreffer[] {
  const { toks, passt } = kennzeichen(sachverhalt);
  const normText = sachverhalt.toLowerCase();
  const roh = ENTSCHEIDUNGEN.map((e) => {
    const gemeinsam = e.schlagworte.filter(passt);
    let score = overlapScore(sachverhalt, e.schlagworte) * 3;
    const lt = new Set(tokenize(`${e.titel} ${e.leitsatz}`));
    for (const t of lt) if (t.length > 3 && toks.has(t)) score += 0.6;
    let norm = false;
    for (const nm of e.normen) {
      const nr = nm.match(/\d+[a-z]?/)?.[0];
      if (nr && new RegExp(`(§|art\\.?)\\s*${nr}\\b`).test(normText)) {
        score += 3;
        norm = true;
      }
    }
    return { e, score, gemeinsam, norm };
  }).sort((a, b) => b.score - a.score);
  // Rechtsgebiet des besten Treffers bevorzugen; Einzelwort-Treffer aus fremden Rechtsgebieten aussortieren.
  const gebiet = roh[0] && roh[0].score >= 3 ? roh[0].e.rechtsgebiet : undefined;
  const auswahl = roh
    .map((t) => ({ ...t, score: t.score + (gebiet && t !== roh[0] && t.e.rechtsgebiet === gebiet ? 2 : 0) }))
    .filter((t) => t.score >= 3 && (t.gemeinsam.length >= 2 || t.norm || (t.gemeinsam.length === 1 && t.e.rechtsgebiet === gebiet)))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
  const max = auswahl[0]?.score ?? 1;
  return auswahl.map(({ e, score, gemeinsam }) => ({
    entscheidung: e,
    relevanz: Math.round(Math.min(97, 52 + (score / max) * 44)),
    gemeinsam,
    begruendung: offlineBegruendung(e, gemeinsam),
  }));
}

function offlineBegruendung(e: Entscheidung, gemeinsam: string[]): string {
  const merkmale = gemeinsam.slice(0, 3).map((g) => `„${g}“`);
  const teil =
    merkmale.length > 1
      ? `Übereinstimmung bei ${merkmale.slice(0, -1).join(", ")} und ${merkmale[merkmale.length - 1]}.`
      : merkmale.length === 1
        ? `Übereinstimmung beim Merkmal ${merkmale[0]}.`
        : `Inhaltliche Nähe zum Leitsatz (${e.rechtsgebiet}).`;
  return `${teil} ${e.bedeutung}`;
}

interface LlmRanking {
  treffer?: { id?: string; relevanz?: number; begruendung?: string }[];
}

/**
 * Recherche mit Live-KI: Claude bewertet ausschließlich Entscheidungen aus der Fall-Datenbank.
 * Unbekannte IDs werden verworfen; bei Fehlern fällt die Recherche auf die Offline-Logik zurück.
 */
export async function kiRecherche(sachverhalt: string, opts: { live: boolean; signal?: AbortSignal }): Promise<RechercheErgebnis> {
  const t0 = performance.now();
  const offline = () => offlineRecherche(sachverhalt);
  if (!opts.live) return { treffer: offline(), quelle: "offline", dauerMs: performance.now() - t0 };
  try {
    const liste = ENTSCHEIDUNGEN.map((e) => ({ id: e.id, az: `${e.gericht} ${e.az}`, titel: e.titel, leitsatz: e.leitsatz }));
    const res = await llmJson<LlmRanking>({
      system:
        "Du bist Rechercheassistent einer deutschen Anwaltskanzlei. Du wählst aus einer vorgegebenen Liste von Gerichtsentscheidungen die für einen Sachverhalt relevantesten aus. Verwende ausschließlich IDs aus der Liste. Nenne keine weiteren Entscheidungen, Aktenzeichen oder Fundstellen. Begründe jeden Treffer in ein bis zwei sachlichen Sätzen auf Deutsch: Welches Merkmal des Sachverhalts trifft auf die Entscheidung zu, und wie hilft sie der Mandantschaft?",
      messages: [
        {
          role: "user",
          content: `Sachverhalt:\n${sachverhalt.slice(0, 4000)}\n\nEntscheidungen der Fall-Datenbank (JSON):\n${JSON.stringify(liste)}\n\nAntwortformat (JSON): {"treffer": [{"id": string, "relevanz": number (0–100), "begruendung": string}]}\nHöchstens 4 Treffer, absteigend nach Relevanz. Nur Entscheidungen, die wirklich weiterhelfen.`,
        },
      ],
      signal: opts.signal,
      effort: "low",
    });
    const { passt } = kennzeichen(sachverhalt);
    const gesehen = new Set<string>();
    const treffer: RechercheTreffer[] = [];
    let verworfen = 0;
    for (const t of res.treffer ?? []) {
      const e = entscheidung(t.id);
      if (!e) {
        verworfen++;
        continue;
      }
      if (gesehen.has(e.id)) continue;
      gesehen.add(e.id);
      treffer.push({
        entscheidung: e,
        relevanz: Math.max(1, Math.min(99, Math.round(Number(t.relevanz) || 70))),
        begruendung: (t.begruendung ?? "").trim() || e.bedeutung,
        gemeinsam: e.schlagworte.filter(passt),
      });
      if (treffer.length >= 4) break;
    }
    if (!treffer.length) {
      return { treffer: offline(), quelle: "offline", hinweis: "Die Live-KI hat keine Entscheidung aus der Datenbank ausgewählt – angezeigt wird die Offline-Recherche.", dauerMs: performance.now() - t0 };
    }
    return { treffer, quelle: "live", verworfen, dauerMs: performance.now() - t0 };
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    const hinweis = e instanceof DemoModus ? undefined : `Die Live-KI war nicht erreichbar (${e instanceof Error ? e.message : String(e)}). Angezeigt wird die Offline-Recherche.`;
    return { treffer: offline(), quelle: "offline", hinweis, dauerMs: performance.now() - t0 };
  }
}

// ───────────────────────── Zitatprüfung ─────────────────────────

const AZ_MUSTER = /\b(?:[IVX]+\s?Z[RB]|\d+\s?(?:AZR|ABR|AZB|StR|BvR|BvL|BvF))\s?\d+\/\d{2}\b|\b\d+\s?C\s?\d+\.\d{2}\b|\bC-\d+\/\d{2}\b/g;
const azKey = (az: string) => az.replace(/\s+/g, "").toUpperCase();
const BEKANNTE_AZ = new Map<string, Entscheidung>();
for (const e of ENTSCHEIDUNGEN) for (const teil of e.az.split(/\s+und\s+/)) BEKANNTE_AZ.set(azKey(teil), e);

export interface ZitatPruefung {
  az: string;
  entscheidung?: Entscheidung;
}

/** Findet Aktenzeichen im Text und prüft, ob sie in der Fall-Datenbank stehen (Grundsatz: nur geprüfte Quellen). */
export function pruefeZitate(text: string, ignorieren: (string | undefined)[] = []): ZitatPruefung[] {
  const gesehen = new Set<string>(ignorieren.filter((x): x is string => !!x).map(azKey));
  const out: ZitatPruefung[] = [];
  for (const m of text.matchAll(AZ_MUSTER)) {
    const key = azKey(m[0]);
    if (gesehen.has(key)) continue;
    gesehen.add(key);
    out.push({ az: m[0], entscheidung: BEKANNTE_AZ.get(key) });
  }
  return out;
}
