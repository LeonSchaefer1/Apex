// Fachliche Hilfen der Abrechnung: offene Posten, Rechnungsnummern, Abrechnungsvorschläge je Akte.
import { addDays, fmtDate, fromISO, round2, today } from "@/core/dates";
import { berechnetePauschalen, berechneRvg, fassungFuerAuftrag, rvgRechnungsPositionen, type RvgFassung, type RvgZeile } from "@/core/rvg";
import type { Akte, AktenPhase, Dokument, Frist, ISODate, Kontakt, Rechnung, RechnungsPosition, User, Zeiteintrag } from "@/core/types";
import { summen, type Summen } from "@/core/abrechnung";

export type TabKey = "uebersicht" | "rechnungen" | "rvg" | "bank" | "forderung" | "zinsen" | "zeit";
export const TAB_KEYS: TabKey[] = ["uebersicht", "rechnungen", "rvg", "bank", "forderung", "zinsen", "zeit"];

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
  // typografisches Minus (U+2212, so formatiert fmtEUR negative Beträge) wie Bindestrich behandeln
  const clean = s.replace(/\u2212/g, "-").replace(/[^\d,.-]/g, "");
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

// Summen, Rechtsschutz-Aufteilung, Vorschuss (§ 9 RVG) und IBAN-Prüfung liegen in src/core/abrechnung.ts (mit Tests).
export { ibanFormatiert, ibanGueltig, ibanKompakt, rsvAufteilung, rsvBlockText, summen, vorschussVorschlag, type Summen } from "@/core/abrechnung";

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

/** Woher der Stundensatz einer Zeitabrechnung stammt. */
export type SatzQuelle = "vereinbarung" | "abrechnung" | "person";

/** Stundensatz für eine Zeitabrechnung: abweichend je Abrechnung > vereinbarter Satz der Akte (§ 3a RVG) > Satz der Person. */
export function satzFuerAbrechnung(akte: Pick<Akte, "verguetungsvereinbarung"> | undefined, eingabe: number | undefined, personSatz: number): { satz: number; quelle: SatzQuelle } {
  const vereinbart = akte?.verguetungsvereinbarung?.stundensatz;
  if (eingabe !== undefined && eingabe > 0 && eingabe !== vereinbart) return { satz: eingabe, quelle: "abrechnung" };
  if (vereinbart) return { satz: vereinbart, quelle: "vereinbarung" };
  return { satz: personSatz, quelle: "person" };
}

/**
 * Der eine Stundensatz eines Zeiteintrags – Zeitliste, Abrechnungsvorschau, Rechnungspositionen und Tätigkeitsnachweis
 * nutzen nur diese Funktion: abweichender Satz dieser Abrechnung > vereinbarter Satz der Akte (§ 3a RVG) > Satz der Person,
 * die den Eintrag erfasst hat (nie der angemeldeten Person) > Standardsatz der Kanzlei.
 */
export function satzFuerEintrag(
  eintrag: Pick<Zeiteintrag, "userId">,
  akte: Pick<Akte, "verguetungsvereinbarung"> | undefined,
  usersById: Map<string, Pick<User, "stundensatz">>,
  abrechnungsSatz?: number,
): { satz: number; quelle: SatzQuelle } {
  return satzFuerAbrechnung(akte, abrechnungsSatz, usersById.get(eintrag.userId)?.stundensatz ?? STANDARD_STUNDENSATZ);
}

/** Betrag einer Zeit: Minuten × Stundensatz / 60, kaufmännisch auf Cent gerundet (20 Min. × 240 € = 80,00 €). */
export const betragFuerMinuten = (minuten: number, satz: number) => round2((minuten * satz) / 60);

/** Wert eines Zeiteintrags mit seinem Satz (siehe `satzFuerEintrag`). */
export function wertEintrag(eintrag: Pick<Zeiteintrag, "userId" | "minuten">, akte: Pick<Akte, "verguetungsvereinbarung"> | undefined, usersById: Map<string, Pick<User, "stundensatz">>, abrechnungsSatz?: number): number {
  return betragFuerMinuten(eintrag.minuten, satzFuerEintrag(eintrag, akte, usersById, abrechnungsSatz).satz);
}

/**
 * Stundenpositionen je Bearbeiter und Satz – jeder Eintrag mit seinem eigenen Satz (`satzFuerEintrag`), der Betrag aus
 * den Minuten je Eintrag. „lt. Vergütungsvereinbarung“ steht nur im Text, wenn der Satz tatsächlich der an der Akte
 * hinterlegte vereinbarte Stundensatz ist (§ 3a RVG) – ein abweichender oder persönlicher Satz wird nur als Betrag genannt.
 */
export function stundenPositionen(
  eintraege: Zeiteintrag[],
  akte: Pick<Akte, "verguetungsvereinbarung"> | undefined,
  usersById: Map<string, User>,
  opts: { abrechnungsSatz?: number } = {},
): RechnungsPosition[] {
  const gruppen = new Map<string, { userId: string; satz: number; quelle: SatzQuelle; minuten: number; betrag: number }>();
  for (const z of eintraege) {
    const { satz, quelle } = satzFuerEintrag(z, akte, usersById, opts.abrechnungsSatz);
    const key = `${z.userId}|${satz}`;
    const g = gruppen.get(key) ?? { userId: z.userId, satz, quelle, minuten: 0, betrag: 0 };
    g.minuten += z.minuten;
    g.betrag = round2(g.betrag + betragFuerMinuten(z.minuten, satz));
    gruppen.set(key, g);
  }
  const vereinbarungDatum = akte?.verguetungsvereinbarung?.datum;
  return [...gruppen.values()].map(({ userId, satz, quelle, minuten, betrag }) => {
    const u = usersById.get(userId);
    const satzText = `${satz.toLocaleString("de-DE")} €/Std.`;
    const bezeichnung =
      quelle === "vereinbarung"
        ? `Tätigkeit ${u?.name ?? "Rechtsanwalt"} lt. Vergütungsvereinbarung${vereinbarungDatum ? ` vom ${fmtDate(vereinbarungDatum)}` : ""} (${satzText})`
        : `Tätigkeit ${u?.name ?? "Rechtsanwalt"} nach Zeitaufwand (${satzText})`;
    return { vv: "Std", bezeichnung, menge: round2(minuten / 60), betrag };
  });
}

/** Stundensatz einer Zeitposition aus der Rechnung („… (240 €/Std.)“), sonst aus Betrag und Menge. */
export function satzAusPosition(p: RechnungsPosition): number {
  const m = p.bezeichnung.match(/\((\d{1,3}(?:\.\d{3})*(?:,\d+)?) €\/Std\.\)/);
  if (m) return Number(m[1].replace(/\./g, "").replace(",", "."));
  return p.menge ? round2(p.betrag / p.menge) : 0;
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
  /** veraltet – der Satz kommt je Eintrag aus `satzFuerEintrag` (Satz der erfassenden Person, nie der angemeldeten) */
  _fallbackSatz: number,
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
    const positionen = stundenPositionen(offen, akte, usersById);
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
  // Anrechnungen rechnet src/core/rvg.ts: Geschäftsgebühr → erste gerichtliche Verfahrensgebühr (3305 im Mahnverfahren,
  // sonst 3100; Vorbem. 3 Abs. 4 VV RVG), Mahnverfahrensgebühr 3305 → 3100 des Rechtsstreits (Anm. zu Nr. 3305).
  // Früher berechnete Gebühren gehen nur als Anrechnungsgrundlage ein; ihre Angelegenheit ist bereits abgerechnet.
  const anrechnen3305auf3100 = neu.includes("3100") && !!fruehere3305;
  const anrechnen2300 = !!fruehere2300 && (neu.includes("3305") || (neu.includes("3100") && !fruehere3305));
  const grundlage = (p: RechnungsPosition, standardSatz: number) => ({ nr: p.vv, satz: p.satz ?? standardSatz, gegenstandswert: p.gegenstandswert ?? akte.gegenstandswert });
  const eingabe = [
    ...(anrechnen2300 && fruehere2300 ? [grundlage(fruehere2300, 1.3)] : []),
    ...(anrechnen3305auf3100 && fruehere3305 ? [grundlage(fruehere3305, 1)] : []),
    ...neu.map((nr) => ({ nr })),
  ];
  // Pauschale Nr. 7002 je Angelegenheit nur einmal: in früheren Rechnungen schon berechnete Beträge zählen mit.
  const erg = berechneRvg({ positionen: eingabe, gegenstandswert: akte.gegenstandswert, fassung, anrechnung: true, bereitsPauschale: berechnetePauschalen(gueltig) });
  const nurGrundlage = new Set<RvgZeile["angelegenheit"]>([...(anrechnen2300 ? (["aussergerichtlich"] as const) : []), ...(anrechnen3305auf3100 ? (["mahnverfahren"] as const) : [])]);
  const angelegenheiten = erg.angelegenheiten.filter((a) => !nurGrundlage.has(a.key));
  const positionen = rvgRechnungsPositionen(angelegenheiten);
  const vorschuss = LAUFENDES_VERFAHREN.includes(akte.phase);
  const hinweise = [
    mahn ? "Mahnverfahren" : "",
    anrechnen2300 ? "Geschäftsgebühr aus Vorrechnung angerechnet" : "",
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

// ───────────── Rechtsschutz, E-Rechnung, Korrektur, Umzug ─────────────

export const RSV_VORSTEUER_HINWEIS =
  "Hinweis für vorsteuerabzugsberechtigte Mandanten: Die Rechtsschutzversicherung erstattet nur den Nettobetrag; die Umsatzsteuer tragen Sie selbst und ziehen sie als Vorsteuer ab.";

/** Deckungsstand für Sammelabrechnung (Spalte und Filter „RSV“). */
export type RsvStand = "erteilt" | "angefragt" | "keine";
export function rsvStand(akte: Pick<Akte, "rsv">): RsvStand {
  const d = akte.rsv?.deckung;
  if (d === "erteilt") return "erteilt";
  if (d === "angefragt" || d === "offen") return "angefragt";
  return "keine";
}
export const RSV_STAND_LABEL: Record<RsvStand, string> = { erteilt: "Deckung erteilt", angefragt: "Deckung angefragt", keine: "keine RSV" };

/** E-Rechnung: bei Organisationen als Empfänger vorbelegt (B2B), sonst PDF. */
export function formatVorbelegung(empfaenger?: Pick<Kontakt, "typ">): Rechnung["format"] {
  return empfaenger?.typ === "organisation" ? "XRechnung" : "PDF";
}

export const ERECHNUNG_PFLICHT =
  "Empfang von E-Rechnungen ist seit 01.01.2025 Pflicht; Ausstellung im B2B-Verkehr ab 01.01.2027 bei Vorjahresumsatz über 800.000 €, sonst ab 01.01.2028.";

/** Korrekturrechnung: Bezugstext auf die stornierte Ursprungsrechnung. */
export const korrekturText = (nummer: string) => `Korrektur zu ${nummer}`;

/** Aus einem Umzug übernommen und Abrechnungsstand noch nicht geprüft – in der Sammelabrechnung nicht vorausgewählt. */
export const abrechnungUngeprueft = (akte: Pick<Akte, "umzugLaufId" | "abrechnungGeprueft">) => !!akte.umzugLaufId && !akte.abrechnungGeprueft;

// ───────────── Sammelabrechnung: Auswahl und Filter (I3-T07-01) ─────────────

/** Filter „RSV“ der Sammelabrechnung. */
export type RsvFilter = "alle" | RsvStand;
export const RSV_FILTER_LABEL: Record<RsvFilter, string> = { alle: "Alle", erteilt: "Deckung erteilt", angefragt: "Deckung angefragt", keine: "keine RSV" };
type SammelZeile = { akte: Pick<Akte, "id" | "rsv" | "umzugLaufId" | "abrechnungGeprueft"> };

/** Vorschläge, die der aktuelle Filter zeigt. */
export function sichtbareVorschlaege<V extends SammelZeile>(vorschlaege: V[], filter: RsvFilter): V[] {
  return filter === "alle" ? vorschlaege : vorschlaege.filter((v) => rsvStand(v.akte) === filter);
}

/**
 * Was abgerechnet, gezählt und summiert wird: Auswahl ∩ sichtbar. Ausgeblendete Akten werden nie abgerechnet –
 * auch wenn sie (etwa vor einem Filterwechsel) ausgewählt waren.
 */
export function auswahlFuerAbrechnung<V extends SammelZeile>(vorschlaege: V[], auswahl: ReadonlySet<string>, filter: RsvFilter): V[] {
  return sichtbareVorschlaege(vorschlaege, filter).filter((v) => auswahl.has(v.akte.id));
}

/** Auswahl nach einem Filterwechsel: alle sichtbaren Akten – ohne Umzugsakten mit ungeprüftem Abrechnungsstand. */
export function auswahlFuerFilter<V extends SammelZeile>(vorschlaege: V[], filter: RsvFilter): Set<string> {
  return new Set(sichtbareVorschlaege(vorschlaege, filter).filter((v) => !abrechnungUngeprueft(v.akte)).map((v) => v.akte.id));
}

/**
 * Kopf-Häkchen: Zustand nur nach den sichtbaren Akten. „an“, wenn jede wählbare sichtbare Akte gewählt ist
 * (Umzugsakten mit ungeprüftem Abrechnungsstand zählen nur, wenn sie von Hand gewählt wurden).
 */
export function kopfZustand<V extends SammelZeile>(vorschlaege: V[], auswahl: ReadonlySet<string>, filter: RsvFilter): "an" | "teilweise" | "aus" {
  const sichtbar = sichtbareVorschlaege(vorschlaege, filter);
  const gewaehlt = sichtbar.filter((v) => auswahl.has(v.akte.id)).length;
  const waehlbar = sichtbar.filter((v) => auswahl.has(v.akte.id) || !abrechnungUngeprueft(v.akte)).length;
  if (gewaehlt === 0) return "aus";
  return gewaehlt >= waehlbar ? "an" : "teilweise";
}

/** Klick aufs Kopf-Häkchen: wählt bzw. abwählt nur sichtbare Akten; ausgeblendete Auswahl wird verworfen. */
export function kopfUmschalten<V extends SammelZeile>(vorschlaege: V[], auswahl: ReadonlySet<string>, filter: RsvFilter): Set<string> {
  if (kopfZustand(vorschlaege, auswahl, filter) === "an") return new Set();
  const n = new Set(auswahlFuerAbrechnung(vorschlaege, auswahl, filter).map((v) => v.akte.id));
  for (const id of auswahlFuerFilter(vorschlaege, filter)) n.add(id);
  return n;
}

/**
 * Leistungszeitraum einer Rechnung (§ 14 Abs. 4 S. 1 Nr. 6 UStG): bei einer Zeitrechnung vom ersten bis zum letzten
 * abgerechneten Eintrag, sonst vom Auftrag bis zum Rechnungsdatum.
 */
export function leistungszeitraum(akte: Akte | undefined, r: Rechnung, zeiten: Pick<Zeiteintrag, "id" | "datum">[] = []): [string, string] {
  const tage = r.zeitIds?.length ? zeiten.filter((z) => r.zeitIds!.includes(z.id)).map((z) => z.datum).sort() : [];
  if (tage.length) return [tage[0], tage[tage.length - 1]];
  const von = akte?.createdAt.slice(0, 10) ?? r.datum;
  return [von < r.datum ? von : r.datum, r.datum];
}

/** Reine Zeitrechnung: nur Positionen nach Zeitaufwand (und ggf. Auslagen), keine Wertgebühr – dann kein Gegenstandswert im Kopf. */
export const istReineZeitrechnung = (r: Pick<Rechnung, "positionen">) =>
  r.positionen.some((p) => p.vv === "Std") && !r.positionen.some((p) => p.vv !== "Std" && (!!p.gegenstandswert || (/^\d{4}$/.test(p.vv) && !/^700\d$/.test(p.vv))));

// ───────────── Forderungskonto: Grund eines neuen Zinsabschnitts (I3-T09-01) ─────────────

/**
 * Warum beginnt hier ein neuer Zinsabschnitt? Erster Abschnitt: Verzugsbeginn; sonst Wechsel des Basiszinssatzes, Änderung des
 * Kapitals oder – bei gleichem Kapital und Satz – eine Buchung an diesem Tag (z. B. Kostenbuchung), die den Lauf teilt.
 * Die Summen bleiben unverändert; der Grund erklärt nur die Teilung.
 */
export function zinsAbschnittGrund(
  z: { von: ISODate; kapital: number; zinssatz: number },
  vorher: { kapital: number; zinssatz: number } | undefined,
  verlauf: { datum: ISODate; art: string }[],
): string {
  const am = fmtDate(z.von);
  if (!vorher) return `Verzugsbeginn ${am}`;
  if (Math.abs(vorher.zinssatz - z.zinssatz) > 1e-9) return `Basiszinssatz geändert zum ${am}`;
  const buchung = verlauf.filter((v) => v.datum === z.von && v.art !== "zinsen");
  if (Math.abs(vorher.kapital - z.kapital) > 0.004) return buchung.some((v) => v.art === "zahlung") ? `Teilzahlung ${am} (Kapital geändert)` : `Kapital geändert ${am}`;
  if (buchung.some((v) => v.art === "kosten")) return `Kostenbuchung ${am}`;
  if (buchung.some((v) => v.art === "zahlung")) return `Zahlung ${am} (auf Kosten/Zinsen verrechnet)`;
  if (buchung.some((v) => v.art === "hauptforderung")) return `Buchung ${am}`;
  return `Neuer Abschnitt ${am}`;
}

// ───────────── Rückfrage „Rechnung stellen“ (I3-T07-03) ─────────────

/** Titel der Rückfrage: „RE-2026-0026 stellen?“ bzw. „3 Rechnungen stellen?“ – den Nummernbereich nennt der Text darunter. */
export function stellenTitel(nummern: string[]): string {
  if (nummern.length <= 1) return `${nummern[0] ?? "Rechnung"} stellen?`;
  return `${nummern.length} Rechnungen stellen?`;
}

/**
 * Zeile im Warnkasten der Rückfrage: Pflichtangaben nach § 14 Abs. 4 UStG (Einträge mit Paragraph) einmal mit Fundstelle,
 * die Bankverbindung als Angabe für den Zahlungsweg – sie ist keine Pflichtangabe nach § 14 UStG.
 * z. B. „Pflichtangaben fehlen: Steuernummer oder USt-IdNr. (§ 14 Abs. 4 UStG) · Bankverbindung (IBAN) für den Zahlungsweg“
 */
export function fehlendKurz(fehlend: string[]): string {
  const ustg = fehlend.filter((f) => f.includes("§")).map((f) => f.replace(/\s*\(§[^)]*\)/g, "").trim());
  const sonst = fehlend.filter((f) => !f.includes("§"));
  const teile = [...(ustg.length ? [`${ustg.join(" · ")} (§ 14 Abs. 4 UStG)`] : []), ...(sonst.length ? [`${sonst.join(" · ")} für den Zahlungsweg`] : [])];
  return `${ustg.length ? "Pflichtangaben fehlen" : "Rechnungsangaben fehlen"}: ${teile.join(" · ")}`;
}

/** Darf gestellt werden? Fehlen Pflichtangaben: in Präsentationskanzleien nur mit Häkchen, sonst gesperrt. */
export function stellenErlaubt(fehlend: string[], praesentation: boolean, haekchen: boolean): boolean {
  if (!fehlend.length) return true;
  return praesentation && haekchen;
}
