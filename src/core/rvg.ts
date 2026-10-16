// RVG-Gebührenrechner (Wertgebühren nach § 13 RVG, Anlage 2) inkl. Anrechnung und Auslagen.
import { round2 } from "./dates";
import type { RechnungsPosition } from "./types";

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
  /** Erhöhung nach Nr. 1008 VV RVG, die im Satz bereits enthalten ist. */
  erhoehung?: number;
  /** Angelegenheit (§ 15 RVG), zu der die Gebühr gehört. */
  angelegenheit: Angelegenheit;
}

/** Nr. 1008 VV RVG: Gebühren, die sich bei mehreren Auftraggebern erhöhen (Geschäfts- bzw. Verfahrensgebühr). */
export const ERHOEHBAR = ["2300", "3100", "3101", "3200", "3305", "3308", "3309"];
/** Mehrere Erhöhungen dürfen einen Gebührensatz von 2,0 nicht übersteigen (Anm. Abs. 3 zu Nr. 1008 VV RVG). */
export const ERHOEHUNG_HOECHSTENS = 2;

/**
 * Gebührenrechtliche Angelegenheiten. Außergerichtliche Vertretung und gerichtliches Verfahren sind verschiedene
 * Angelegenheiten (deshalb die Anrechnung nach Vorbem. 3 Abs. 4 VV RVG); jeder Rechtszug ist eine eigene
 * Angelegenheit (§ 17 Nr. 1 RVG), ebenso das Mahnverfahren gegenüber dem streitigen Verfahren (§ 17 Nr. 2 RVG)
 * und jede Vollstreckungsmaßnahme (§ 18 Abs. 1 Nr. 1 RVG).
 */
export type Angelegenheit = "beratung" | "aussergerichtlich" | "mahnverfahren" | "gerichtlich" | "berufung" | "vollstreckung";

export const ANGELEGENHEITEN: { key: Angelegenheit; titel: string }[] = [
  { key: "beratung", titel: "Prüfung der Erfolgsaussicht" },
  { key: "aussergerichtlich", titel: "Außergerichtliche Vertretung" },
  { key: "mahnverfahren", titel: "Mahnverfahren" },
  { key: "gerichtlich", titel: "Gerichtliches Verfahren, 1. Instanz" },
  { key: "berufung", titel: "Berufungsverfahren" },
  { key: "vollstreckung", titel: "Zwangsvollstreckung" },
];

const PHASE_ANGELEGENHEIT: Partial<Record<VVPosition["phase"], Angelegenheit>> = {
  Beratung: "beratung",
  Außergerichtlich: "aussergerichtlich",
  Mahnverfahren: "mahnverfahren",
  Gerichtlich: "gerichtlich",
  Berufung: "berufung",
  Vollstreckung: "vollstreckung",
};

/**
 * Angelegenheit einer Gebühr. Einigungsgebühren folgen der Angelegenheit, in der die Einigung erzielt wird
 * (1000: außergerichtlich, 1003: anhängiges Verfahren); die Erhöhung 1008 folgt der Geschäfts- bzw.
 * Verfahrensgebühr, die sie erhöht. `vorhanden` sind die übrigen Angelegenheiten derselben Berechnung.
 */
export function angelegenheitVon(nr: string, vorhanden: Angelegenheit[] = []): Angelegenheit {
  const erste = (reihe: Angelegenheit[], sonst: Angelegenheit) => reihe.find((a) => vorhanden.includes(a)) ?? sonst;
  if (nr === "1000") return "aussergerichtlich";
  if (nr === "1003") return erste(["gerichtlich", "mahnverfahren", "berufung"], "gerichtlich");
  if (nr === "1008") return erste(["aussergerichtlich", "mahnverfahren", "gerichtlich", "berufung", "vollstreckung"], "aussergerichtlich");
  const phase = vv(nr)?.phase;
  const a = phase && PHASE_ANGELEGENHEIT[phase];
  if (a) return a;
  if (/^21\d\d$/.test(nr)) return "beratung";
  if (/^2\d{3}$/.test(nr)) return "aussergerichtlich";
  if (/^32\d\d$/.test(nr)) return "berufung";
  return "gerichtlich";
}

export interface RvgAngelegenheit {
  key: Angelegenheit;
  titel: string;
  /** Gebühren dieser Angelegenheit, eine Anrechnung steht bei der Angelegenheit, auf deren Gebühr angerechnet wird. */
  zeilen: RvgZeile[];
  /** Entstandene Gebühren der Angelegenheit vor Anrechnung – Grundlage der Pauschale. */
  gebuehren: number;
  auslagenpauschale: number;
}

export interface RvgErgebnis {
  zeilen: RvgZeile[];
  /** Gebühren und Auslagenpauschale je Angelegenheit, in Verfahrensreihenfolge. */
  angelegenheiten: RvgAngelegenheit[];
  gebuehrenSumme: number;
  /** Summe der Auslagenpauschalen aller Angelegenheiten. */
  auslagenpauschale: number;
  netto: number;
  ust: number;
  brutto: number;
}

/** Auslagenpauschale Nr. 7002 VV RVG: 20 % der Gebühren, höchstens 20 € je Angelegenheit. */
export const PAUSCHALE_HOECHSTBETRAG = 20;
export function auslagenpauschale(gebuehren: number, bereitsBerechnet = 0): number {
  return round2(Math.max(0, Math.min(Math.max(0, gebuehren) * 0.2, PAUSCHALE_HOECHSTBETRAG - bereitsBerechnet)));
}

/**
 * Berechnet eine Gebührenrechnung.
 * - Anrechnung (Vorbem. 3 Abs. 4 VV RVG): Die Geschäftsgebühr (2300) wird zur Hälfte, höchstens mit 0,75,
 *   auf die Verfahrensgebühr (3100) angerechnet, wenn beide im selben Auftrag abgerechnet werden.
 * - Auslagenpauschale Nr. 7002 VV RVG: 20 % der Gebühren, höchstens 20 € – je Angelegenheit. Grundlage sind die
 *   in der Angelegenheit entstandenen Gebühren; die Anrechnung mindert nur den Gesamtbetrag (§ 15a Abs. 1 RVG).
 *   `bereitsPauschale` berücksichtigt in früheren Rechnungen schon berechnete Pauschalen derselben Angelegenheit.
 * - Erhöhung Nr. 1008 VV RVG (mehrere Auftraggeber): eine 1008-Position erhöht die Geschäfts- bzw. Verfahrensgebühr
 *   jeder Angelegenheit um ihren Satz; die Anrechnung geht dann von der erhöhten Geschäftsgebühr aus.
 * - Umsatzsteuer Nr. 7008 VV RVG: 19 %.
 */
export function berechneRvg(input: {
  positionen: { nr: string; satz?: number; gegenstandswert?: number }[];
  gegenstandswert: number;
  auslagenpauschale?: boolean;
  ust?: boolean;
  anrechnung?: boolean;
  fassung?: RvgFassung;
  bereitsPauschale?: Partial<Record<Angelegenheit, number>>;
}): RvgErgebnis {
  const fassung = input.fassung ?? "2025";
  // Nr. 1008 ist keine eigene Gebühr, sondern erhöht die Geschäfts- bzw. Verfahrensgebühr jeder Angelegenheit
  // (höchstens um 2,0). Nur ohne erhöhbare Gebühr bleibt sie – wie eingegeben – eine eigene Zeile.
  const erhoehung = round2(Math.min(input.positionen.filter((p) => p.nr === "1008").reduce((s, p) => s + (p.satz ?? 0.3), 0), ERHOEHUNG_HOECHSTENS));
  const erhoehbar = erhoehung > 0 && input.positionen.some((p) => ERHOEHBAR.includes(p.nr));
  const positionen = erhoehbar ? input.positionen.filter((p) => p.nr !== "1008") : input.positionen;
  const vorhanden = positionen.filter((p) => !["1000", "1003", "1008"].includes(p.nr)).map((p) => angelegenheitVon(p.nr));
  const zeilen: RvgZeile[] = [];
  for (const p of positionen) {
    const def = vv(p.nr);
    const satz = p.satz ?? def?.satz ?? 1;
    const wert = p.gegenstandswert ?? input.gegenstandswert;
    zeilen.push({ nr: p.nr, titel: def?.titel ?? `Nr. ${p.nr} VV RVG`, satz, gegenstandswert: wert, betrag: gebuehr(wert, satz, fassung), angelegenheit: angelegenheitVon(p.nr, vorhanden) });
  }
  if (erhoehbar) {
    for (const { key } of ANGELEGENHEITEN) {
      const eigene = zeilen.filter((z) => z.angelegenheit === key);
      // je Angelegenheit die erste erhöhbare Gebühr; 3308 nur, wenn sich nicht schon 3305 erhöht (Anm. zu Nr. 3308)
      const z = ERHOEHBAR.map((nr) => eigene.find((e) => e.nr === nr)).find((e) => e && !(e.nr === "3308" && eigene.some((x) => x.nr === "3305")));
      if (!z) continue;
      z.erhoehung = erhoehung;
      z.satz = round2(z.satz + erhoehung);
      z.betrag = gebuehr(z.gegenstandswert, z.satz, fassung);
    }
  }
  const gg = zeilen.find((z) => z.nr === "2300");
  const vg = zeilen.find((z) => z.nr === "3100");
  if ((input.anrechnung ?? true) && gg && vg) {
    // Angerechnet wird die (ggf. nach Nr. 1008 erhöhte) Geschäftsgebühr zur Hälfte, höchstens mit 0,75.
    const anrSatz = Math.min(round2(gg.satz / 2), 0.75);
    const betrag = -gebuehr(Math.min(gg.gegenstandswert, vg.gegenstandswert), anrSatz, fassung);
    zeilen.push({
      nr: "Vorb. 3 IV",
      titel: `Anrechnung Geschäftsgebühr (${anrSatz.toLocaleString("de-DE")})`,
      satz: -anrSatz,
      gegenstandswert: vg.gegenstandswert,
      betrag,
      anrechnung: true,
      angelegenheit: vg.angelegenheit,
    });
  }
  const angelegenheiten: RvgAngelegenheit[] = ANGELEGENHEITEN.flatMap(({ key, titel }) => {
    const eigene = zeilen.filter((z) => z.angelegenheit === key);
    if (!eigene.length) return [];
    const gebuehren = round2(eigene.filter((z) => !z.anrechnung).reduce((s, z) => s + z.betrag, 0));
    const pauschale = input.auslagenpauschale === false ? 0 : auslagenpauschale(gebuehren, input.bereitsPauschale?.[key] ?? 0);
    return [{ key, titel, zeilen: eigene, gebuehren, auslagenpauschale: pauschale }];
  });
  const gebuehrenSumme = round2(zeilen.reduce((s, z) => s + z.betrag, 0));
  const pauschaleSumme = round2(angelegenheiten.reduce((s, a) => s + a.auslagenpauschale, 0));
  const netto = round2(gebuehrenSumme + pauschaleSumme);
  const ust = input.ust === false ? 0 : round2(netto * UST_SATZ);
  return { zeilen, angelegenheiten, gebuehrenSumme, auslagenpauschale: pauschaleSumme, netto, ust, brutto: round2(netto + ust) };
}

export const PAUSCHALE_BEZEICHNUNG = "Pauschale für Post- und Telekommunikation";

/**
 * Rechnungspositionen in Angelegenheits-Reihenfolge: Gebühren einer Angelegenheit, danach ihre Pauschale.
 * Bei mehreren Angelegenheiten nennt die Pauschale ihre Angelegenheit.
 */
export function rvgRechnungsPositionen(angelegenheiten: RvgAngelegenheit[]): RechnungsPosition[] {
  const mehrere = angelegenheiten.length > 1;
  return angelegenheiten.flatMap((a) => [
    ...a.zeilen.map((z) => ({ vv: z.nr, bezeichnung: z.erhoehung ? `${z.titel}, erhöht nach Nr. 1008 VV RVG um ${z.erhoehung.toLocaleString("de-DE")}` : z.titel, satz: z.satz, gegenstandswert: z.gegenstandswert, betrag: z.betrag })),
    ...(a.auslagenpauschale > 0 ? [{ vv: "7002", bezeichnung: mehrere ? `${PAUSCHALE_BEZEICHNUNG} – ${a.titel}` : PAUSCHALE_BEZEICHNUNG, betrag: a.auslagenpauschale }] : []),
  ]);
}

/**
 * Bereits berechnete Pauschalen je Angelegenheit aus früheren Rechnungspositionen. Eine 7002-Position gehört zur
 * Angelegenheit der Gebühr, die ihr in derselben Rechnung vorausgeht.
 */
export function berechnetePauschalen(rechnungen: { positionen: RechnungsPosition[] }[]): Partial<Record<Angelegenheit, number>> {
  const summe: Partial<Record<Angelegenheit, number>> = {};
  for (const r of rechnungen) {
    let aktuell: Angelegenheit | undefined;
    for (const p of r.positionen) {
      if (p.vv === "7002") {
        if (aktuell) summe[aktuell] = round2((summe[aktuell] ?? 0) + p.betrag);
      } else if (/^\d{4}$/.test(p.vv) && p.vv !== "1008") {
        aktuell = angelegenheitVon(p.vv);
      }
    }
  }
  return summe;
}
