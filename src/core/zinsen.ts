// Verzugszinsen (§ 288 BGB) und Forderungskonto mit Tilgungsreihenfolge nach § 367 BGB.
import { addDays, diffDays, round2 } from "./dates";
import type { ISODate } from "./types";

/** Basiszinssatz nach § 247 BGB (Deutsche Bundesbank), jeweils gültig ab Datum. */
export const BASISZINS: { ab: ISODate; satz: number }[] = [
  { ab: "2019-07-01", satz: -0.88 },
  { ab: "2023-01-01", satz: 1.62 },
  { ab: "2023-07-01", satz: 3.12 },
  { ab: "2024-01-01", satz: 3.62 },
  { ab: "2024-07-01", satz: 3.37 },
  { ab: "2025-01-01", satz: 2.27 },
  { ab: "2025-07-01", satz: 1.27 },
  { ab: "2026-01-01", satz: 1.27 },
  { ab: "2026-07-01", satz: 1.52 },
];

export function basiszinsAm(datum: ISODate): number {
  let satz = BASISZINS[0].satz;
  for (const b of BASISZINS) if (b.ab <= datum) satz = b.satz;
  return satz;
}

export interface ZinsAbschnitt {
  von: ISODate;
  bis: ISODate;
  tage: number;
  kapital: number;
  zinssatz: number;
  zinsen: number;
}

/** Zinsen auf ein Kapital für [von, bis] (beide inklusive), Act/365, nach Basiszins-Perioden aufgeteilt. */
export function verzugszinsen(kapital: number, von: ISODate, bis: ISODate, verbraucher: boolean): ZinsAbschnitt[] {
  if (bis < von || kapital <= 0) return [];
  const aufschlag = verbraucher ? 5 : 9;
  const grenzen = BASISZINS.map((b) => b.ab).filter((d) => d > von && d <= bis);
  const starts = [von, ...grenzen];
  const out: ZinsAbschnitt[] = [];
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    const e = i + 1 < starts.length ? addDays(starts[i + 1], -1) : bis;
    const tage = diffDays(s, e) + 1;
    const zinssatz = round2(basiszinsAm(s) + aufschlag);
    out.push({ von: s, bis: e, tage, kapital, zinssatz, zinsen: round2((kapital * zinssatz * tage) / 36500) });
  }
  return out;
}

export interface ForderungsVorgang {
  datum: ISODate;
  art: "hauptforderung" | "kosten" | "zahlung";
  betrag: number; // positiv
  text: string;
}

export interface ForderungsStand {
  hauptforderung: number;
  zinsen: number;
  kosten: number;
  gesamt: number;
  bezahlt: number;
  verlauf: {
    datum: ISODate;
    text: string;
    art: ForderungsVorgang["art"] | "zinsen";
    betrag: number;
    aufZinsen?: number;
    aufKosten?: number;
    aufHaupt?: number;
    saldoHaupt: number;
    saldoGesamt: number;
  }[];
  zinsAbschnitte: ZinsAbschnitt[];
}

/**
 * Führt ein Forderungskonto: Zinsen laufen auf die offene Hauptforderung.
 * Zahlungen werden nach § 367 Abs. 1 BGB zuerst auf die Kosten, dann auf die Zinsen, zuletzt auf die Hauptforderung verrechnet.
 */
export function forderungskonto(params: {
  vorgaenge: ForderungsVorgang[];
  verzugAb: ISODate;
  stichtag: ISODate;
  verbraucher: boolean;
}): ForderungsStand {
  const vorgaenge = [...params.vorgaenge].sort((a, b) => a.datum.localeCompare(b.datum));
  let haupt = 0;
  let zinsen = 0;
  let kosten = 0;
  let bezahlt = 0;
  let zinsLaufAb = params.verzugAb;
  const verlauf: ForderungsStand["verlauf"] = [];
  const zinsAbschnitte: ZinsAbschnitt[] = [];

  const zinsenBis = (bisInkl: ISODate) => {
    if (haupt > 0 && bisInkl >= zinsLaufAb) {
      const abschnitte = verzugszinsen(haupt, zinsLaufAb, bisInkl, params.verbraucher);
      const summe = round2(abschnitte.reduce((s, a) => s + a.zinsen, 0));
      if (summe > 0) {
        zinsen = round2(zinsen + summe);
        zinsAbschnitte.push(...abschnitte);
      }
    }
    zinsLaufAb = addDays(bisInkl, 1) > zinsLaufAb ? addDays(bisInkl, 1) : zinsLaufAb;
  };

  for (const v of vorgaenge) {
    if (v.datum > params.verzugAb) zinsenBis(addDays(v.datum, -1));
    if (v.art === "hauptforderung") {
      haupt = round2(haupt + v.betrag);
      verlauf.push({ datum: v.datum, text: v.text, art: v.art, betrag: v.betrag, saldoHaupt: haupt, saldoGesamt: round2(haupt + zinsen + kosten) });
    } else if (v.art === "kosten") {
      kosten = round2(kosten + v.betrag);
      verlauf.push({ datum: v.datum, text: v.text, art: v.art, betrag: v.betrag, saldoHaupt: haupt, saldoGesamt: round2(haupt + zinsen + kosten) });
    } else {
      let rest = v.betrag;
      bezahlt = round2(bezahlt + v.betrag);
      const aufKosten = Math.min(rest, kosten);
      kosten = round2(kosten - aufKosten);
      rest = round2(rest - aufKosten);
      const aufZinsen = Math.min(rest, zinsen);
      zinsen = round2(zinsen - aufZinsen);
      rest = round2(rest - aufZinsen);
      const aufHaupt = Math.min(rest, haupt);
      haupt = round2(haupt - aufHaupt);
      verlauf.push({
        datum: v.datum, text: v.text, art: "zahlung", betrag: -v.betrag,
        aufKosten: round2(aufKosten), aufZinsen: round2(aufZinsen), aufHaupt: round2(aufHaupt),
        saldoHaupt: haupt, saldoGesamt: round2(haupt + zinsen + kosten),
      });
    }
  }
  zinsenBis(params.stichtag);
  verlauf.push({
    datum: params.stichtag, text: "Zinsen bis Stichtag (§ 288 BGB)", art: "zinsen", betrag: zinsen,
    saldoHaupt: haupt, saldoGesamt: round2(haupt + zinsen + kosten),
  });
  return { hauptforderung: haupt, zinsen, kosten, gesamt: round2(haupt + zinsen + kosten), bezahlt, verlauf, zinsAbschnitte };
}
