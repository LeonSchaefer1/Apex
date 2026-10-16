// RVG-Gebührenrechner (Wertgebühren nach § 13 RVG, Anlage 2) inkl. Anrechnung und Auslagen.
import { round2 } from "./dates";

/**
 * Gebührentabelle § 13 Abs. 1 RVG in der Fassung des KostBRÄG 2025 (gültig für Aufträge ab 01.06.2025).
 * Format: [bisWert, Schrittweite, Erhöhung je angefangenem Schritt]
 */
export const RVG_TABELLE = {
  stand: "KostBRÄG 2025 – Aufträge ab 01.06.2025",
  basis: 51.5, // Gegenstandswert bis 500 €
  stufen: [
    [2_000, 500, 41.5],
    [10_000, 1_000, 59.5],
    [25_000, 3_000, 55],
    [50_000, 5_000, 86],
    [200_000, 15_000, 99.5],
    [500_000, 30_000, 140],
    [Number.POSITIVE_INFINITY, 50_000, 175],
  ] as [number, number, number][],
};

/** Vorherige Tabelle (KostRÄG 2021) – maßgeblich, wenn der unbedingte Auftrag vor dem 01.06.2025 erteilt wurde (§ 60 RVG). */
export const RVG_TABELLE_2021 = {
  stand: "KostRÄG 2021 – Aufträge bis 31.05.2025",
  basis: 49,
  stufen: [
    [2_000, 500, 39],
    [10_000, 1_000, 56],
    [25_000, 3_000, 52],
    [50_000, 5_000, 81],
    [200_000, 15_000, 94],
    [500_000, 30_000, 132],
    [Number.POSITIVE_INFINITY, 50_000, 165],
  ] as [number, number, number][],
};

export type RvgFassung = "2025" | "2021";

/** Übergangsrecht § 60 RVG: maßgeblich ist der Tag der unbedingten Auftragserteilung. */
export function fassungFuerAuftrag(auftragsdatum: string): RvgFassung {
  return auftragsdatum < "2025-06-01" ? "2021" : "2025";
}

/** Volle (1,0) Wertgebühr für einen Gegenstandswert. */
export function wertgebuehr(gegenstandswert: number, fassung: RvgFassung = "2025"): number {
  const tabelle = fassung === "2021" ? RVG_TABELLE_2021 : RVG_TABELLE;
  let gebuehr = tabelle.basis;
  let untergrenze = 500;
  if (gegenstandswert <= 500) return gebuehr;
  for (const [bis, schritt, plus] of tabelle.stufen) {
    const obergrenze = Math.min(gegenstandswert, bis);
    if (obergrenze > untergrenze) {
      const schritte = Math.ceil((obergrenze - untergrenze) / schritt);
      gebuehr += schritte * plus;
    }
    if (gegenstandswert <= bis) break;
    untergrenze = bis;
  }
  return round2(gebuehr);
}

/** Gebühr mit Gebührensatz; Rundung auf volle Cent (§ 2 Abs. 2 S. 2 RVG). */
export function gebuehr(gegenstandswert: number, satz: number, fassung: RvgFassung = "2025"): number {
  return round2(wertgebuehr(gegenstandswert, fassung) * satz);
}

export interface VVPosition {
  nr: string;
  titel: string;
  satz: number;
  rahmen?: [number, number];
  phase: "Beratung" | "Außergerichtlich" | "Gerichtlich" | "Berufung" | "Mahnverfahren" | "Vollstreckung" | "Allgemein";
  hinweis?: string;
}

export const VV_KATALOG: VVPosition[] = [
  { nr: "2300", titel: "Geschäftsgebühr", satz: 1.3, rahmen: [0.5, 2.5], phase: "Außergerichtlich", hinweis: "Mehr als 1,3 nur bei umfangreicher oder schwieriger Tätigkeit." },
  { nr: "2100", titel: "Prüfung der Erfolgsaussicht eines Rechtsmittels", satz: 0.75, rahmen: [0.5, 1.0], phase: "Beratung" },
  { nr: "3100", titel: "Verfahrensgebühr (1. Instanz)", satz: 1.3, phase: "Gerichtlich" },
  { nr: "3101", titel: "Verfahrensgebühr bei vorzeitiger Beendigung", satz: 0.8, phase: "Gerichtlich" },
  { nr: "3104", titel: "Terminsgebühr (1. Instanz)", satz: 1.2, phase: "Gerichtlich" },
  { nr: "1000", titel: "Einigungsgebühr (außergerichtlich)", satz: 1.5, phase: "Allgemein" },
  { nr: "1003", titel: "Einigungsgebühr (Gericht anhängig)", satz: 1.0, phase: "Allgemein" },
  { nr: "1008", titel: "Erhöhung je weiterem Auftraggeber", satz: 0.3, phase: "Allgemein", hinweis: "Höchstens 2,0 Erhöhung." },
  { nr: "3200", titel: "Verfahrensgebühr (Berufung)", satz: 1.6, phase: "Berufung" },
  { nr: "3202", titel: "Terminsgebühr (Berufung)", satz: 1.2, phase: "Berufung" },
  { nr: "3305", titel: "Verfahrensgebühr Mahnverfahren", satz: 1.0, phase: "Mahnverfahren" },
  { nr: "3308", titel: "Verfahrensgebühr Vollstreckungsbescheid", satz: 0.5, phase: "Mahnverfahren" },
  { nr: "3309", titel: "Verfahrensgebühr Zwangsvollstreckung", satz: 0.3, phase: "Vollstreckung" },
  { nr: "3310", titel: "Terminsgebühr Zwangsvollstreckung", satz: 0.3, phase: "Vollstreckung" },
];

export function vv(nr: string): VVPosition | undefined {
  return VV_KATALOG.find((p) => p.nr === nr);
}

export const UST_SATZ = 0.19;

export interface RvgZeile {
  nr: string;
  titel: string;
  satz: number;
  gegenstandswert: number;
  betrag: number;
  anrechnung?: boolean;
}

export interface RvgErgebnis {
  zeilen: RvgZeile[];
  gebuehrenSumme: number;
  auslagenpauschale: number;
  netto: number;
  ust: number;
  brutto: number;
}

/**
 * Berechnet eine Gebührenrechnung.
 * - Anrechnung (Vorbem. 3 Abs. 4 VV RVG): Die Geschäftsgebühr (2300) wird zur Hälfte, höchstens mit 0,75,
 *   auf die Verfahrensgebühr (3100) angerechnet, wenn beide im selben Auftrag abgerechnet werden.
 * - Auslagenpauschale Nr. 7002 VV RVG: 20 % der Gebühren, höchstens 20 € (je Angelegenheit; hier vereinfacht einmal).
 * - Umsatzsteuer Nr. 7008 VV RVG: 19 %.
 */
export function berechneRvg(input: {
  positionen: { nr: string; satz?: number; gegenstandswert?: number }[];
  gegenstandswert: number;
  auslagenpauschale?: boolean;
  ust?: boolean;
  anrechnung?: boolean;
  fassung?: RvgFassung;
}): RvgErgebnis {
  const fassung = input.fassung ?? "2025";
  const zeilen: RvgZeile[] = [];
  for (const p of input.positionen) {
    const def = vv(p.nr);
    const satz = p.satz ?? def?.satz ?? 1;
    const wert = p.gegenstandswert ?? input.gegenstandswert;
    zeilen.push({ nr: p.nr, titel: def?.titel ?? `Nr. ${p.nr} VV RVG`, satz, gegenstandswert: wert, betrag: gebuehr(wert, satz, fassung) });
  }
  const gg = zeilen.find((z) => z.nr === "2300");
  const vg = zeilen.find((z) => z.nr === "3100");
  if ((input.anrechnung ?? true) && gg && vg) {
    const anrSatz = Math.min(gg.satz / 2, 0.75);
    const betrag = -gebuehr(Math.min(gg.gegenstandswert, vg.gegenstandswert), anrSatz, fassung);
    zeilen.push({
      nr: "Vorb. 3 IV",
      titel: `Anrechnung Geschäftsgebühr (${anrSatz.toLocaleString("de-DE")})`,
      satz: -anrSatz,
      gegenstandswert: vg.gegenstandswert,
      betrag,
      anrechnung: true,
    });
  }
  const gebuehrenSumme = round2(zeilen.reduce((s, z) => s + z.betrag, 0));
  const auslagenpauschale = input.auslagenpauschale === false ? 0 : round2(Math.min(gebuehrenSumme * 0.2, 20));
  const netto = round2(gebuehrenSumme + auslagenpauschale);
  const ust = input.ust === false ? 0 : round2(netto * UST_SATZ);
  return { zeilen, gebuehrenSumme, auslagenpauschale, netto, ust, brutto: round2(netto + ust) };
}
