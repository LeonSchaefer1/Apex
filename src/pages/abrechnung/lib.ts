// Fachliche Hilfen der Abrechnung: offene Posten, Rechnungsnummern, Abrechnungsvorschläge je Akte.
import { addDays, fmtDate, fromISO, round2, today } from "@/core/dates";
import { berechnetePauschalen, berechneRvg, fassungFuerAuftrag, gebuehr, rvgRechnungsPositionen, UST_SATZ, type RvgFassung, type RvgZeile } from "@/core/rvg";
import type { Akte, AktenPhase, Dokument, Frist, ISODate, Kontakt, Rechnung, RechnungsPosition, User, Zeiteintrag } from "@/core/types";

export type TabKey = "uebersicht" | "rechnungen" | "rvg" | "bank" | "forderung" | "zeit";
export const TAB_KEYS: TabKey[] = ["uebersicht", "rechnungen", "rvg", "bank", "forderung", "zeit"];

export const MINUTEN_JE_EINZELRECHNUNG = 6;
export const STANDARD_STUNDENSATZ = 250;

// ───────────── Offene Posten ─────────────
export const istOffen = (r: Rechnung) => r.status === "gestellt" || r.status === "teilbezahlt";
export const offenerBetrag = (r: Rechnung) => (istOffen(r) ? round2(r.brutto - r.bezahlt) : 0);
export const istUeberfaellig = (r: Rechnung, heute = today()) => istOffen(r) && r.faellig < heute;
/** Zählt als Umsatz: gestellte, (teil-)bezahlte Rechnungen – keine Entwürfe, keine Stornos. */
export const zaehltAlsUmsatz = (r: Rechnung) => r.status !== "entwurf" && r.status !== "storniert";

/**
 * Nächste freie Rechnungsnummern (RE-JJJJ-NNNN) nach der höchsten vorhandenen Nummer des Jahres. Stornorechnungen
 * belegen eigene Nummern desselben Nummernkreises; Entwürfe tragen nur eine vorläufige Kennung (siehe `entwurfsKennung`).
 */
export function naechsteNummern(rechnungen: Rechnung[], anzahl: number, jahr = today().slice(0, 4)): string[] {
  let max = 0;
  const re = new RegExp(`^RE-${jahr}-(\\d+)$`);
  for (const r of rechnungen) {
    for (const n of [r.nummer, r.stornoNummer]) {
      const m = n ? re.exec(n) : null;
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  return Array.from({ length: anzahl }, (_, i) => `RE-${jahr}-${String(max + i + 1).padStart(4, "0")}`);
}

/** Vorläufige Kennung eines Rechnungsentwurfs – die endgültige Rechnungsnummer wird erst beim Stellen vergeben. */
export const ENTWURF_PRAEFIX = "Entwurf-";
export const istEntwurfsKennung = (nummer: string) => nummer.startsWith(ENTWURF_PRAEFIX);
export function entwurfsKennung(rechnungen: Rechnung[]): string {
  let max = 0;
  for (const r of rechnungen) if (istEntwurfsKennung(r.nummer)) max = Math.max(max, Number(r.nummer.slice(ENTWURF_PRAEFIX.length)) || 0);
  return `${ENTWURF_PRAEFIX}${String(max + 1).padStart(3, "0")}`;
}

// ───────────── Formatierung ─────────────
/** Kurzform für Achsen: „0 €“, „850 €“, „2,5 Tsd. €“, „1,2 Mio. €“. */
export function fmtEURkompakt(n: number): string {
  const a = Math.abs(n);
  const f = (v: number) => v.toLocaleString("de-DE", { maximumFractionDigits: 1 });
  if (a >= 1_000_000) return `${f(n / 1_000_000)} Mio. €`;
  if (a >= 1_000) return `${f(n / 1_000)} Tsd. €`;
  return `${Math.round(n).toLocaleString("de-DE")} €`;
}

/** Deutsche Betragseingabe („10.000,50“, „5000“, „1.000“) in eine Zahl umwandeln. */
export function parseBetrag(s: string): number {
  const clean = s.replace(/[^\d,.-]/g, "");
  if (!clean) return 0;
  if (clean.includes(",")) return Number(clean.replace(/\./g, "").replace(",", ".")) || 0;
  if (/^\d{1,3}(\.\d{3})+$/.test(clean)) return Number(clean.replace(/\./g, "")) || 0;
  return Number(clean) || 0;
}

export const fmtSatz = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
export const fmtProzent = (n: number, digits = 2) => `${n.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;

/** 90 → „1:30 Std.“ */
export function fmtDauer(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}:${String(m).padStart(2, "0")} Std.`;
}

export const fmtStunden = (min: number) => (min / 60).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

/** ISO-Kalenderwoche (Montag als Wochenbeginn). */
export function isoWoche(iso: string): { jahr: number; kw: number; montag: string } {
  const wd = (fromISO(iso).getUTCDay() + 6) % 7;
  const montag = addDays(iso, -wd);
  const donnerstag = fromISO(addDays(montag, 3));
  const jahr = donnerstag.getUTCFullYear();
  const jan4 = new Date(Date.UTC(jahr, 0, 4));
  const kw = 1 + Math.round(((donnerstag.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return { jahr, kw, montag };
}

export const FASSUNG_LABEL: Record<RvgFassung, string> = { "2025": "KostBRÄG 2025", "2021": "KostRÄG 2021" };

// ───────────── Rechenhilfen ─────────────
export interface Summen {
  netto: number;
  ust: number;
  brutto: number;
}

/** Summen aus Positionen (USt. 19 % nach Nr. 7008 VV RVG). */
export function summen(positionen: RechnungsPosition[], ust = true): Summen {
  const netto = round2(positionen.reduce((s, p) => s + p.betrag, 0));
  const u = ust ? round2(netto * UST_SATZ) : 0;
  return { netto, ust: u, brutto: round2(netto + u) };
}

// ───────────── Sammelabrechnung: Vorschlag je Akte ─────────────
export const PHASE_POSITIONEN: Partial<Record<AktenPhase, string[]>> = {
  Außergerichtlich: ["2300"],
  Gerichtlich: ["3100", "3104"],
  Beweisaufnahme: ["3100", "3104"],
  Urteil: ["3100", "3104"],
  Vollstreckung: ["3309"],
};

/** Phasen, in denen das gerichtliche Verfahren noch läuft: Vergütung nicht fällig (§ 8 Abs. 1 RVG), nur Vorschuss (§ 9 RVG). */
export const LAUFENDES_VERFAHREN: AktenPhase[] = ["Gerichtlich", "Beweisaufnahme"];

export interface Vorschlag {
  akte: Akte;
  art: "rvg" | "stunden";
  positionen: RechnungsPosition[];
  summen: Summen;
  fassung?: RvgFassung;
  bereitsAbgerechnet: string[];
  zeitIds: string[];
  hinweis?: string;
  /** Vorschussrechnung nach § 9 RVG statt Rechnung – die Vergütung ist noch nicht fällig (§ 8 Abs. 1 RVG). */
  vorschuss?: boolean;
}

export interface Ausschluss {
  akte: Akte;
  grund: string;
}

/** Zusatzdaten einer Akte für den Abrechnungsvorschlag. */
export interface AkteKontext {
  /** Gericht der Akte – erkennt das Mahnverfahren beim Mahngericht. */
  gericht?: Kontakt;
  /** Fristen und Termine der Akte – die Terminsgebühr entsteht erst mit einem wahrgenommenen Termin. */
  fristen?: Frist[];
  /** Dokumente der Akte (Vergütungsvereinbarung, Vollstreckungsbescheid). */
  dokumente?: Dokument[];
  heute?: ISODate;
}

/** Vergütungsvereinbarung (§ 3a RVG) an der Akte hinterlegt oder als Dokument in der E-Akte. */
export function hatVerguetungsvereinbarung(akte: Akte, dokumente: Dokument[] = []): boolean {
  return !!akte.verguetungsvereinbarung || dokumente.some((d) => d.akteId === akte.id && /vergütungsvereinbarung/i.test(d.name));
}

const TERMIN_TAETIGKEIT = /gerichtstermin|mündliche[nr]? verhandlung|terminswahrnehmung|wahrnehmung (des |eines )?termins/i;

/**
 * Terminsgebühr (Vorbem. 3 Abs. 3 VV RVG): entsteht erst mit der Wahrnehmung eines Termins – erkennbar an einem
 * vergangenen oder erledigten Termin im Fristenkalender oder an erfasster Zeit für die Terminswahrnehmung.
 */
export function terminWahrgenommen(fristen: Frist[], zeiten: Zeiteintrag[], heute = today()): boolean {
  return fristen.some((f) => f.typ === "termin" && (f.status === "erledigt" || f.datum < heute)) || zeiten.some((z) => TERMIN_TAETIGKEIT.test(z.taetigkeit));
}

/** Mahnverfahren: Akte liegt (noch) beim Mahngericht, kein Streitgericht eingetragen. */
export const istMahnverfahren = (akte: Akte, gericht?: Kontakt) => LAUFENDES_VERFAHREN.includes(akte.phase) && /mahngericht/i.test(gericht?.name ?? "");

/** Nr. 3308 VV RVG: Antrag auf Vollstreckungsbescheid – nur, wenn kein Widerspruch erhoben wurde (Anm. zu Nr. 3308). */
function vollstreckungsbescheidBeantragt(akte: Akte, dokumente: Dokument[]): boolean {
  if (akte.schlagworte.some((s) => /widerspruch/i.test(s))) return false;
  return /vollstreckungsbescheid/i.test(akte.forderung?.titel ?? "") || dokumente.some((d) => d.akteId === akte.id && /vollstreckungsbescheid/i.test(d.name));
}

/** Anrechnungszeile auf eine Verfahrensgebühr (gleiche Darstellung wie die Anrechnung aus `berechneRvg`). */
function anrechnungsZeile(nr: string, titel: string, satz: number, wert: number, fassung: RvgFassung, angelegenheit: RvgZeile["angelegenheit"]): RvgZeile {
  return { nr, titel, satz: -satz, gegenstandswert: wert, betrag: -gebuehr(wert, satz, fassung), anrechnung: true, angelegenheit };
}

/** Stundenpositionen je Bearbeiter (Vergütungsvereinbarung nach § 3a RVG). */
export function stundenPositionen(eintraege: Zeiteintrag[], usersById: Map<string, User>, fallbackSatz: number, vereinbarterSatz?: number): RechnungsPosition[] {
  const proUser = new Map<string, number>();
  for (const z of eintraege) proUser.set(z.userId, (proUser.get(z.userId) ?? 0) + z.minuten);
  return [...proUser.entries()].map(([userId, minuten]) => {
    const u = usersById.get(userId);
    const satz = vereinbarterSatz ?? u?.stundensatz ?? fallbackSatz;
    const std = round2(minuten / 60);
    return { vv: "Std", bezeichnung: `Tätigkeit ${u?.name ?? "Rechtsanwalt"} lt. Vergütungsvereinbarung (${satz.toLocaleString("de-DE")} €/Std.)`, menge: std, betrag: round2(std * satz) };
  });
}

/**
 * Ermittelt, was für eine Akte abgerechnet werden kann. Bereits berechnete Gebühren werden nicht erneut angesetzt
 * (§ 15 Abs. 2 RVG); eine früher berechnete Geschäftsgebühr wird auf die Verfahrensgebühr angerechnet (Vorbem. 3 Abs. 4 VV RVG).
 * - Straf- und Bußgeldsachen: nach Zeit nur mit Vergütungsvereinbarung (§ 3a RVG), sonst gesetzliche Rahmengebühren (Teil 4/5 VV RVG).
 * - Terminsgebühr Nr. 3104 erst nach wahrgenommenem Termin (Vorbem. 3 Abs. 3 VV RVG).
 * - Mahnverfahren beim Mahngericht: Nr. 3305 (und 3308 nach Antrag auf Vollstreckungsbescheid) statt 3100/3104;
 *   die Gebühr 3305 wird auf die Verfahrensgebühr des nachfolgenden Rechtsstreits angerechnet (Anm. zu Nr. 3305 VV RVG).
 * - Laufendes gerichtliches Verfahren: Vergütung noch nicht fällig (§ 8 Abs. 1 RVG) → Vorschussrechnung (§ 9 RVG).
 */
export function vorschlagFuerAkte(
  akte: Akte,
  rechnungenDerAkte: Rechnung[],
  zeitenDerAkte: Zeiteintrag[],
  usersById: Map<string, User>,
  fallbackSatz: number,
  kontext: AkteKontext = {},
): Vorschlag | Ausschluss {
  const heute = kontext.heute ?? today();
  const dokumente = kontext.dokumente ?? [];
  const gueltig = rechnungenDerAkte.filter((r) => r.status !== "storniert");
  const abgerechnet = new Set(gueltig.flatMap((r) => r.positionen.map((p) => p.vv)));

  // Straf- und Bußgeldsachen: gesetzlich Betragsrahmengebühren (Teil 4/5 VV RVG, Bestimmung nach § 14 RVG).
  // Nach Zeitaufwand nur, wenn eine Vergütungsvereinbarung in Textform vorliegt (§ 3a RVG).
  const bussgeld = /bußgeld|owi\b/i.test(akte.titel) || akte.schlagworte.includes("bußgeld");
  if (akte.sachgebiet === "Strafrecht" || bussgeld) {
    const sache = bussgeld ? "Bußgeldsache" : "Strafsache";
    const teil = bussgeld ? "Teil 5" : "Teil 4";
    if (!hatVerguetungsvereinbarung(akte, dokumente)) return { akte, grund: `Ohne Vergütungsvereinbarung – Rahmengebühren nach ${teil} VV RVG bestimmen (§ 14 RVG)` };
    const offen = zeitenDerAkte.filter((z) => z.abrechenbar && !z.abgerechnet);
    if (!offen.length) return { akte, grund: `${sache}: keine offenen abrechenbaren Zeiten` };
    const positionen = stundenPositionen(offen, usersById, fallbackSatz, akte.verguetungsvereinbarung?.stundensatz);
    return { akte, art: "stunden", positionen, summen: summen(positionen), bereitsAbgerechnet: [], zeitIds: offen.map((z) => z.id), hinweis: "nach Zeitaufwand lt. Vergütungsvereinbarung (§ 3a RVG)" };
  }

  const mahn = istMahnverfahren(akte, kontext.gericht);
  const basis = mahn ? ["3305", ...(vollstreckungsbescheidBeantragt(akte, dokumente) ? ["3308"] : [])] : PHASE_POSITIONEN[akte.phase];
  if (!basis) return { akte, grund: akte.phase === "Mandatsaufnahme" ? "Mandatsaufnahme – noch keine abrechenbare Tätigkeit" : "Keine Gebühren für diese Phase hinterlegt" };
  if (akte.gegenstandswert <= 0) return { akte, grund: "Kein Gegenstandswert hinterlegt" };
  let neu = basis.filter((nr) => !abgerechnet.has(nr));
  if (!neu.length) return { akte, grund: "Gebühren dieser Phase bereits abgerechnet" };

  // Terminsgebühr erst nach wahrgenommenem Termin – ein angesetzter, noch ausstehender Termin genügt nicht.
  if (neu.includes("3104") && !terminWahrgenommen(kontext.fristen ?? [], zeitenDerAkte, heute)) {
    neu = neu.filter((nr) => nr !== "3104");
    if (!neu.length) {
      const naechster = (kontext.fristen ?? []).filter((f) => f.typ === "termin" && f.status === "offen" && f.datum >= heute).sort((a, b) => a.datum.localeCompare(b.datum))[0];
      return { akte, grund: `Terminsgebühr (Nr. 3104 VV RVG) noch nicht entstanden – ${naechster ? `Termin am ${fmtDate(naechster.datum)} steht aus` : "kein wahrgenommener Termin erfasst"}` };
    }
  }

  const fassung = fassungFuerAuftrag(akte.createdAt.slice(0, 10));
  const frueher = gueltig.flatMap((r) => r.positionen);
  const fruehere2300 = frueher.find((p) => p.vv === "2300");
  const fruehere3305 = frueher.find((p) => p.vv === "3305");
  // Geschäftsgebühr → erste gerichtliche Verfahrensgebühr (Mahnverfahren oder Rechtsstreit); 3305 → 3100 des Rechtsstreits.
  const anrechnen2300auf3100 = neu.includes("3100") && !!fruehere2300 && !fruehere3305;
  const anrechnen2300auf3305 = neu.includes("3305") && !!fruehere2300;
  const anrechnen3305auf3100 = neu.includes("3100") && !!fruehere3305;
  const eingabe = [...(anrechnen2300auf3100 ? [{ nr: "2300", satz: fruehere2300?.satz ?? 1.3 }] : []), ...neu.map((nr) => ({ nr }))];
  // Pauschale Nr. 7002 je Angelegenheit nur einmal: in früheren Rechnungen schon berechnete Beträge zählen mit.
  const erg = berechneRvg({ positionen: eingabe, gegenstandswert: akte.gegenstandswert, fassung, anrechnung: true, bereitsPauschale: berechnetePauschalen(gueltig) });
  // Die früher berechnete Geschäftsgebühr dient nur der Anrechnung – ihre Angelegenheit ist abgerechnet.
  let angelegenheiten = anrechnen2300auf3100 ? erg.angelegenheiten.filter((a) => a.key !== "aussergerichtlich") : erg.angelegenheiten;
  const zusatz = (key: RvgZeile["angelegenheit"], z: RvgZeile) => {
    angelegenheiten = angelegenheiten.map((a) => (a.key === key && !a.zeilen.some((x) => x.anrechnung) ? { ...a, zeilen: [...a.zeilen, z] } : a));
  };
  if (anrechnen2300auf3305 && fruehere2300) {
    const satz = Math.min((fruehere2300.satz ?? 1.3) / 2, 0.75);
    zusatz("mahnverfahren", anrechnungsZeile("Vorb. 3 IV", `Anrechnung Geschäftsgebühr (${satz.toLocaleString("de-DE")})`, satz, Math.min(fruehere2300.gegenstandswert ?? akte.gegenstandswert, akte.gegenstandswert), fassung, "mahnverfahren"));
  }
  if (anrechnen3305auf3100 && fruehere3305) {
    const satz = fruehere3305.satz ?? 1;
    zusatz("gerichtlich", anrechnungsZeile("Anm. 3305", `Anrechnung Verfahrensgebühr Mahnverfahren (${satz.toLocaleString("de-DE")})`, satz, Math.min(fruehere3305.gegenstandswert ?? akte.gegenstandswert, akte.gegenstandswert), fassung, "gerichtlich"));
  }
  const positionen = rvgRechnungsPositionen(angelegenheiten);
  const vorschuss = LAUFENDES_VERFAHREN.includes(akte.phase);
  const hinweise = [
    mahn ? "Mahnverfahren" : "",
    anrechnen2300auf3100 || anrechnen2300auf3305 ? "Geschäftsgebühr aus Vorrechnung angerechnet" : "",
    anrechnen3305auf3100 ? "Mahnverfahrensgebühr angerechnet" : "",
    basis.includes("3104") && !neu.includes("3104") && !abgerechnet.has("3104") ? "Terminsgebühr erst nach dem Termin" : "",
  ].filter(Boolean);
  return {
    akte,
    art: "rvg",
    positionen,
    summen: summen(positionen),
    fassung,
    bereitsAbgerechnet: [...abgerechnet].filter((nr) => /^\d{4}$/.test(nr) && nr !== "7002"),
    zeitIds: [],
    hinweis: hinweise.length ? hinweise.join(" · ") : undefined,
    vorschuss,
  };
}

export const istVorschlag = (v: Vorschlag | Ausschluss): v is Vorschlag => "positionen" in v;

/** Leistungszeitraum einer Rechnung (Auftrag bis Rechnungsdatum). */
export function leistungszeitraum(akte: Akte | undefined, r: Rechnung): [string, string] {
  const von = akte?.createdAt.slice(0, 10) ?? r.datum;
  return [von < r.datum ? von : r.datum, r.datum];
}
