// Gemeinsame Fristen-Helfer für Fristenkalender und Posteingang (Anlegen, Erledigen, Vier-Augen-Kontrolle, Darstellung).
import { addDays, addMonthsBGB, fmtDate, fmtEUR, fmtTime, fromISO, nowLocal, today, uid, weekday } from "@/core/dates";
import { berechneNachRegel, type Einheit } from "@/core/fristen";
import { BUNDESLAENDER } from "@/core/feiertage";
import { istKritisch } from "@/core/fristenLage";
import { useData } from "@/store/data";
import type { Akte, Bundesland, Buchung, Frist, FristGerichtsort, FristTyp, ID, ISODate, Nachricht, Transaktion, User } from "@/core/types";
import type { Tone } from "@/components/ui";

export interface TypMeta {
  label: string;
  kurz: string;
  tone: Tone;
  /** Klassen für Kalender-Pillen */
  pill: string;
  /** Farbpunkt */
  dot: string;
}

export const TYP_META: Record<FristTyp, TypMeta> = {
  notfrist: { label: "Notfrist", kurz: "Notfrist", tone: "seal", pill: "bg-seal-soft text-seal", dot: "bg-seal" },
  frist: { label: "Frist", kurz: "Frist", tone: "ink", pill: "bg-ink-soft text-ink", dot: "bg-ink" },
  vorfrist: { label: "Vorfrist", kurz: "Vorfrist", tone: "outline", pill: "border border-dashed border-[var(--line-strong)] text-fg-2", dot: "border border-dashed border-fg-3" },
  wiedervorlage: { label: "Wiedervorlage", kurz: "WV", tone: "neutral", pill: "bg-[var(--ink-softer)] text-fg-2 ring-1 ring-inset ring-[var(--line)]", dot: "bg-fg-4" },
  termin: { label: "Termin", kurz: "Termin", tone: "violet", pill: "bg-violet-soft text-violet", dot: "bg-violet" },
};

export const TYP_REIHENFOLGE: FristTyp[] = ["notfrist", "frist", "vorfrist", "wiedervorlage", "termin"];

/**
 * Kalenderdarstellung (Woche, Monat): kritische Fristen – Notfrist oder gesetzlich nicht verlängerbar (§ 4 KSchG,
 * § 17 TzBfG …) – rot wie Notfristen, mit sichtbarem Text statt nur Tooltip (WCAG 1.4.1).
 */
export function kalenderMeta(f: Pick<Frist, "typ" | "regelKey">): { pill: string; dot: string; kritisch?: "Notfrist" | "nicht verlängerbar" } {
  if (istKritisch(f)) return { pill: TYP_META.notfrist.pill, dot: TYP_META.notfrist.dot, kritisch: f.typ === "notfrist" ? "Notfrist" : "nicht verlängerbar" };
  return { pill: TYP_META[f.typ].pill, dot: TYP_META[f.typ].dot };
}

/** Herkunft einer Frist – eine Tabelle für Fristenkalender, Akten-Reiter und Filter-Chips. */
export const QUELLE_LABEL: Record<Frist["quelle"], string> = {
  ki: "Von KI erkannt",
  automatisch: "Automatisch angelegt",
  manuell: "Von Hand eingetragen",
  migration: "Aus Umzug",
};

/** Erläuterung der Herkunft (Tooltip). */
export const QUELLE_TITEL: Record<Frist["quelle"], string> = {
  ki: "Von der KI im Dokument erkannt – berechnet mit dem Fristenrechner",
  automatisch: "Automatisch angelegt (z. B. Vorfrist, Automatik des 38h-Motors)",
  manuell: "Von Hand eingetragen",
  migration: "Aus der Altsoftware übernommen – Datum laut Altsystem, bitte mit dem Fristenrechner nachrechnen",
};

/**
 * Vier-Augen-Kontrolle – maßgebliche Regel für Fristenkalender, Akten-Reiter und Posteingang:
 * Jede offene Notfrist oder Frist ist bis zur Bestätigung durch eine zweite Person unkontrolliert –
 * unabhängig davon, ob sie mit einer Regel des Fristenrechners (`regelKey`) oder als richterliche
 * bzw. KI-Frist ohne Regel angelegt wurde. Vorfristen, Wiedervorlagen und Termine brauchen keine Kontrolle.
 */
export function brauchtKontrolle(f: Frist): boolean {
  return f.status === "offen" && (f.typ === "notfrist" || f.typ === "frist") && !f.kontrolliertVon;
}

/**
 * Von der KI erkannte oder aus der Altsoftware übernommene Frist, die noch nicht kontrolliert ist – eine Teilmenge
 * von `brauchtKontrolle` (die Kachel „Vier-Augen-Kontrolle offen“ nennt sie als „davon … von der KI erkannt / aus Umzug“).
 */
export function istUngeprueft(f: Frist): boolean {
  return (f.quelle === "ki" || f.quelle === "migration") && brauchtKontrolle(f);
}

/** Unterliegt der Vier-Augen-Kontrolle (Notfrist oder Frist) – unabhängig davon, ob sie schon bestätigt ist. */
export function unterliegtKontrolle(f: Frist): boolean {
  return f.typ === "notfrist" || f.typ === "frist";
}

/** Darf diese Person die Kontrolle bestätigen? Nie die verantwortliche Person selbst (keine Selbstkontrolle). */
export function darfKontrollieren(f: Frist, userId: ID): boolean {
  return brauchtKontrolle(f) && f.verantwortlichId !== userId;
}

/** Ampelfarbe für den Dringlichkeitsstreifen. */
export function streifenFarbe(f: Frist, heute: ISODate = today()): string {
  if (f.status === "erledigt") return "bg-green";
  const diff = (fromISO(f.datum).getTime() - fromISO(heute).getTime()) / 86400000;
  if (diff < 0) return "bg-seal";
  if (diff <= 2) return f.typ === "wiedervorlage" || f.typ === "vorfrist" ? "bg-amber" : "bg-seal";
  if (diff <= 7) return "bg-amber";
  return "bg-[var(--line-strong)]";
}

/** Montag der Woche, in der `iso` liegt. */
export function wochenStart(iso: ISODate): ISODate {
  const wd = weekday(iso); // 0 = So
  return addDays(iso, wd === 0 ? -6 : 1 - wd);
}

/**
 * Erster Tag der Wochenansicht: Montag bis Donnerstag die laufende Kalenderwoche; ab Freitag ein 7-Tage-Fenster
 * ab heute – sonst stünden am Freitag vier leere Vortage im Bild und die Fristen der nächsten Woche fehlten.
 */
export function wochenAnsichtStart(heute: ISODate): ISODate {
  const wd = weekday(heute); // 0 = So
  return wd === 5 || wd === 6 || wd === 0 ? heute : wochenStart(heute);
}

/** ISO-Kalenderwoche. */
export function kalenderwoche(iso: ISODate): number {
  const d = fromISO(iso);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const diff = (d.getTime() - firstThursday.getTime()) / 86400000;
  return 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

/** Rechnerisches Fristende vor Verschiebung (§ 188 BGB) – zur Visualisierung des § 222 Abs. 2 ZPO. */
export function rohesEnde(ereignis: ISODate, dauer: number, einheit: Einheit): ISODate {
  if (einheit === "tage") return addDays(ereignis, dauer);
  if (einheit === "wochen") return addDays(ereignis, dauer * 7);
  if (einheit === "monate") return addMonthsBGB(ereignis, dauer).date;
  return `${Number(ereignis.slice(0, 4)) + dauer}-12-31`;
}

export interface NeueFrist {
  akteId: ID;
  titel: string;
  typ: FristTyp;
  datum: ISODate;
  uhrzeit?: string;
  ort?: string;
  vorfrist?: ISODate;
  regelKey?: string;
  grundlage?: string;
  ereignisDatum?: ISODate;
  rechenweg?: string[];
  quelle: Frist["quelle"];
  verantwortlichId: ID;
  /** Verantwortlich für die Vorfrist (z. B. ReFa); Standard: wie Frist */
  vorfristVerantwortlichId?: ID;
  notiz?: string;
  /** Ort, mit dessen Feiertagen die Frist berechnet wurde (für spätere Korrekturen, § 222 Abs. 2 ZPO) */
  gerichtsort?: FristGerichtsort;
}

/** Legt eine Frist an – mit Vorfrist als eigenem Kalendereintrag. Kontrolle (Vier-Augen) bleibt offen. */
export function legeFristAn(p: NeueFrist): { frist: Frist; vorfrist?: Frist } {
  const { upsert } = useData.getState();
  const jetzt = nowLocal();
  const frist: Frist = {
    id: uid("f"),
    akteId: p.akteId,
    titel: p.titel,
    typ: p.typ,
    datum: p.datum,
    uhrzeit: p.uhrzeit,
    ort: p.ort,
    vorfrist: p.vorfrist,
    regelKey: p.regelKey,
    grundlage: p.grundlage,
    ereignisDatum: p.ereignisDatum,
    rechenweg: p.rechenweg,
    status: "offen",
    verantwortlichId: p.verantwortlichId,
    quelle: p.quelle,
    notiz: p.notiz,
    ...(p.gerichtsort ? { gerichtsort: p.gerichtsort } : {}),
    createdAt: jetzt,
  };
  upsert("fristen", frist);
  let vorfrist: Frist | undefined;
  if (p.vorfrist && p.vorfrist < p.datum) {
    vorfrist = {
      id: uid("f"),
      akteId: p.akteId,
      titel: `Vorfrist: ${p.titel}`,
      typ: "vorfrist",
      datum: p.vorfrist,
      bezugId: frist.id,
      grundlage: p.grundlage,
      regelKey: p.regelKey,
      status: "offen",
      verantwortlichId: p.vorfristVerantwortlichId ?? p.verantwortlichId,
      quelle: p.quelle === "manuell" ? "manuell" : "automatisch",
      notiz: `Vorfrist zu „${p.titel}“ (Fristende ${p.datum.split("-").reverse().join(".")}).`,
      createdAt: jetzt,
    };
    upsert("fristen", vorfrist);
  }
  return { frist, vorfrist };
}

/** Zugehörige Vorfrist-Einträge einer Frist – über `bezugId`, bei älteren Einträgen ohne Bezug über den Titel. */
export function vorfristenZu(f: Frist, alle: Frist[]): Frist[] {
  if (f.typ === "vorfrist") return [];
  return alle.filter((x) => x.typ === "vorfrist" && x.akteId === f.akteId && (x.bezugId ? x.bezugId === f.id : x.titel === `Vorfrist: ${f.titel}`));
}

/** Vom Apex Assistenten angelegt (Notiz-Präfix) – Etikett „Durch Assistent angelegt“ statt „Von KI erkannt“. */
export const ASSISTENT_PRAEFIX = "Vom Apex Assistenten angelegt";
export function durchAssistent(f: Pick<Frist, "notiz">): boolean {
  return !!f.notiz?.startsWith(ASSISTENT_PRAEFIX);
}

// ───────────────────────── Ausgangskontrolle: Erledigen nur mit Nachweis oder Grund ─────────────────────────

export type Nachweis = NonNullable<Frist["erledigtNachweis"]>;

export const NACHWEIS_ART: Record<Nachweis["art"], string> = {
  bea: "beA-Versand",
  fax: "Telefax (Sendebericht)",
  bote: "Bote",
  post: "Post",
  persoenlich: "persönlich übergeben",
  ueberweisung: "Überweisung (Kontoumsatz)",
  gestrichen: "gestrichen/gegenstandslos",
  sonstiges: "sonstiger Nachweis",
};

/** Versandwege mit Pflicht-Versandzeit (Datum und Uhrzeit des tatsächlichen Versands – nicht die Zeit des Eintrags). */
export const VERSAND_ARTEN: Nachweis["art"][] = ["bea", "fax", "bote", "post", "persoenlich"];
export const istVersandArt = (a: Nachweis["art"]) => VERSAND_ARTEN.includes(a);

/** „versandt per beA“, „persönlich übergeben“ … */
const VERSAND_WEG: Partial<Record<Nachweis["art"], string>> = {
  bea: "versandt per beA",
  fax: "versandt per Telefax",
  bote: "übergeben durch Boten",
  post: "versandt per Post",
  persoenlich: "persönlich übergeben",
};

/** Zahlungsfristen (Fremdgeld weiterleiten, § 43a Abs. 7 BRAO) werden durch Überweisung gewahrt, nicht durch einen Schriftsatz. */
export function istZahlungsfrist(f: Pick<Frist, "titel">): boolean {
  return /fremdgeld|weiterleit|überweis|auszahl|zahlung an/i.test(f.titel);
}

/** Nachweisarten nach Fristart: Zahlungsfristen per Überweisung (Kontoumsatz), sonst die Versandwege. */
export function nachweisArtenFuer(f: Pick<Frist, "titel">): Nachweis["art"][] {
  return istZahlungsfrist(f) ? ["ueberweisung", "gestrichen"] : [...VERSAND_ARTEN, "gestrichen"];
}

/** Nachweisquelle einer Zahlungsfrist: Fremdgeld-Weiterleitung der Akte (Aktenkonto) oder Ausgang aus dem Bankabgleich. */
export interface NachweisQuelle {
  /** „b:<Buchungs-ID>“ (Weiterleitung) bzw. „t:<Transaktions-ID>“ (Kontoumsatz) */
  id: string;
  art: "weiterleitung" | "umsatz";
  datum: ISODate;
  /** Betrag des Ausgangs (negativ) */
  betrag: number;
  /** Zeile für die Auswahl, z. B. „Weiterleitung vom 17.10.2026 · 6.120,00 € an Elif Yilmaz (SEPA-Datei)“ */
  label: string;
  /** Akte, zu der der Ausgang gehört (fehlt bei einem keiner Akte zugeordneten Umsatz) */
  akteId?: ID;
  aktenzeichen?: string;
  transaktionId?: ID;
  buchungId?: ID;
}

/**
 * Überweisungsnachweis einer Zahlungsfrist (I3-T15-01): nur Ausgänge (Betrag < 0), Eingänge (Gutschriften) nie.
 * `passend` = zuerst die Fremdgeld-Weiterleitungen der Akte (nicht storniert), dann die der Akte zugeordneten Ausgänge;
 * `fremd` = Ausgänge anderer oder keiner Akte – nur hinter „Anderen Umsatz wählen …“, mit Warnung und Pflichtbegründung.
 * `erwartet` = Fremdgeld- bzw. Fristbetrag (Betrag im Titel/in der Notiz, sonst Fremdgeld-Eingänge der Akte) für den Abweichungshinweis.
 */
export function nachweisUmsaetze(
  f: Pick<Frist, "akteId" | "titel" | "notiz">,
  transaktionen: Transaktion[],
  buchungen: Buchung[],
  akten: Pick<Akte, "id" | "aktenzeichen">[] = [],
): { passend: NachweisQuelle[]; fremd: NachweisQuelle[]; erwartet?: number } {
  const az = (id?: ID) => (id ? akten.find((a) => a.id === id)?.aktenzeichen : undefined);
  const storniert = (b: Buchung) => buchungen.some((x) => x.akteId === b.akteId && x.text === `Storno: ${b.text}` && Math.abs(x.betrag + b.betrag) < 0.005);
  const weiterleitungen: NachweisQuelle[] = buchungen
    .filter((b) => b.akteId === f.akteId && b.betrag < 0 && !!b.weiterleitung && !storniert(b))
    .sort((a, b) => b.datum.localeCompare(a.datum))
    .map((b) => ({
      id: `b:${b.id}`,
      art: "weiterleitung",
      datum: b.datum,
      betrag: b.betrag,
      label: `Weiterleitung vom ${fmtDate(b.datum)} · ${fmtEUR(-b.betrag)} an ${b.weiterleitung!.empfaenger} (${b.weiterleitung!.wirkung === "sepa-datei" ? "SEPA-Datei" : "bereits überwiesen"})`,
      akteId: b.akteId,
      aktenzeichen: az(b.akteId),
      buchungId: b.id,
    }));
  const ausgaenge = transaktionen
    .filter((t) => t.betrag < 0 && t.status !== "ignoriert")
    .sort((a, b) => b.datum.localeCompare(a.datum))
    .map(
      (t): NachweisQuelle => ({
        id: `t:${t.id}`,
        art: "umsatz",
        datum: t.datum,
        betrag: t.betrag,
        label: `${fmtDate(t.datum)} · ${fmtEUR(t.betrag)} · ${t.gegenpartei} · ${t.verwendungszweck}`,
        akteId: t.zuordnung?.akteId,
        aktenzeichen: az(t.zuordnung?.akteId),
        transaktionId: t.id,
      }),
    );
  const passend = [...weiterleitungen, ...ausgaenge.filter((q) => q.akteId === f.akteId)];
  const fremd = ausgaenge.filter((q) => q.akteId !== f.akteId).slice(0, 40);
  const imText = /(\d{1,3}(?:\.\d{3})*,\d{2})\s*€/.exec(`${f.titel} ${f.notiz ?? ""}`);
  const eingaenge = buchungen.filter((b) => b.akteId === f.akteId && b.fremdgeld && b.betrag > 0 && !b.text.startsWith("Storno: "));
  const erwartet = imText ? Number(imText[1].replace(/\./g, "").replace(",", ".")) : eingaenge.length ? Math.round(eingaenge.reduce((s, b) => s + b.betrag, 0) * 100) / 100 : undefined;
  return { passend, fremd, ...(erwartet !== undefined ? { erwartet } : {}) };
}

/** Warnung für einen Ausgang außerhalb der Akte: „Umsatz gehört zu 137/26 – nicht zu 131/26“. */
export function fremdHinweis(q: Pick<NachweisQuelle, "aktenzeichen">, aktenzeichenFrist?: string): string {
  return q.aktenzeichen ? `Umsatz gehört zu ${q.aktenzeichen} – nicht zu ${aktenzeichenFrist ?? "dieser Akte"}` : `Umsatz ist keiner Akte zugeordnet – nicht ${aktenzeichenFrist ?? "dieser Akte"}`;
}

/** Notfristen und Fristen brauchen beim Erledigen einen Nachweis (Ausgangskontrolle) – Wiedervorlagen, Vorfristen und Termine nicht. */
export function erfordertNachweis(f: Pick<Frist, "typ">): boolean {
  return f.typ === "notfrist" || f.typ === "frist";
}

/** „am 16.10.2026 um 18:05 Uhr“ bzw. nur „am 16.10.2026“ (Überweisung) */
function amUm(iso: string): string {
  const zeit = iso.length > 10 ? fmtTime(iso) : "";
  return `am ${fmtDate(iso.slice(0, 10))}${zeit ? ` um ${zeit} Uhr` : ""}`;
}

/**
 * Nachweis einer erledigten Frist – Versandzeit und Protokollzeit getrennt:
 * „versandt per beA am 16.10.2026 um 18:05 Uhr · protokolliert 21:39 Uhr von Dr. Julia Hartmann“,
 * „überwiesen am 16.10.2026 (Kontoumsatz −1.250,00 € an …) · protokolliert …“, „gestrichen – weil …“.
 */
export function nachweisText(f: Frist, team: User[], nachrichten: Nachricht[] = [], transaktionen: Transaktion[] = []): string {
  const n = f.erledigtNachweis;
  const wer = team.find((u) => u.id === f.erledigtVon)?.name;
  if (!n) return `erledigt – ohne Nachweis${wer ? ` (${wer})` : ""}`;
  if (n.art === "gestrichen") return `gestrichen – ${n.text ?? "ohne Grund"}${wer ? ` (${wer})` : ""}`;
  const protokoll = f.erledigtAm
    ? ` · protokolliert ${n.versandAm && n.versandAm.slice(0, 10) === f.erledigtAm.slice(0, 10) ? `${fmtTime(f.erledigtAm)} Uhr` : `am ${fmtDate(f.erledigtAm.slice(0, 10))}, ${fmtTime(f.erledigtAm)} Uhr`}${wer ? ` von ${wer}` : ""}`
    : wer
      ? ` · ${wer}`
      : "";
  const zusatz = n.text ? ` · ${n.text}` : "";
  if (n.art === "ueberweisung") {
    const t = n.transaktionId ? transaktionen.find((x) => x.id === n.transaktionId) : undefined;
    const wann = n.versandAm ?? t?.datum;
    const umsatz = t ? ` (Kontoumsatz ${fmtEUR(t.betrag)} ${t.betrag < 0 ? "an" : "von"} ${t.gegenpartei})` : "";
    return `überwiesen${wann ? ` ${amUm(wann.slice(0, 10))}` : ""}${umsatz}${zusatz}${protokoll}`;
  }
  const msg = n.nachrichtId ? nachrichten.find((m) => m.id === n.nachrichtId) : undefined;
  const versand = n.versandAm ?? msg?.eingang;
  const weg = VERSAND_WEG[n.art] ?? `Nachweis: ${NACHWEIS_ART[n.art]}`;
  return `${weg} ${versand ? amUm(versand) : "– Versandzeit nicht erfasst"}${zusatz}${protokoll}`;
}

/** Erledigt eine Frist (inkl. offener Vorfrist) und protokolliert es – bei Notfristen und Fristen mit Nachweis bzw. Grund. */
export function erledigeFrist(f: Frist, userId: ID, nachweis?: Nachweis): void {
  const { patch, log, data } = useData.getState();
  const jetzt = nowLocal();
  patch("fristen", f.id, { status: "erledigt", erledigtAm: jetzt, erledigtVon: userId, ...(nachweis ? { erledigtNachweis: nachweis } : {}) });
  for (const v of vorfristenZu(f, data.fristen)) if (v.status === "offen") patch("fristen", v.id, { status: "erledigt", erledigtAm: jetzt, erledigtVon: userId });
  const was = nachweis
    ? nachweis.art === "gestrichen"
      ? ` gestrichen – Grund: ${nachweis.text ?? "–"}`
      : ` als erledigt markiert – gewahrt per ${NACHWEIS_ART[nachweis.art]}${nachweis.versandAm ? ` ${amUm(nachweis.versandAm)}` : ""}${nachweis.nachrichtId ? ` (${data.nachrichten.find((m) => m.id === nachweis.nachrichtId)?.betreff ?? "beA-Nachricht"})` : ""}${nachweis.transaktionId ? ` (Kontoumsatz ${data.transaktionen.find((t) => t.id === nachweis.transaktionId)?.gegenpartei ?? ""})` : ""}${nachweis.text ? `: ${nachweis.text}` : ""}`
    : " als erledigt markiert";
  const kontrolle = nachweis?.kontrolleOffenBestaetigt ? " · Vier-Augen-Kontrolle stand noch aus – trotzdem erledigt (bestätigt)" : "";
  log({ akteur: "nutzer", userId, akteId: f.akteId, text: `${TYP_META[f.typ].label} „${f.titel}“ (${fmtDate(f.datum)})${was}${kontrolle}` });
}

/** Streicht einen Eintrag (Frist oder Wiedervorlage) mit Pflichtgrund – protokolliert. */
export function streicheFrist(f: Frist, userId: ID, grund: string, kontrolleOffenBestaetigt?: boolean): void {
  erledigeFrist(f, userId, { art: "gestrichen", text: grund.trim(), ...(kontrolleOffenBestaetigt ? { kontrolleOffenBestaetigt: true } : {}) });
}

/**
 * Macht „Erledigt“ rückgängig – inklusive Vorfrist: Eine noch bevorstehende Vorfrist wird immer mit geöffnet
 * (die Erinnerung darf nicht verloren gehen), eine vergangene nur, wenn sie zusammen mit der Frist erledigt wurde.
 */
export function oeffneFristWieder(f: Frist, heute: ISODate = today(), userId?: ID): void {
  const { patch, data, log } = useData.getState();
  const aktuell = data.fristen.find((x) => x.id === f.id);
  const zeitpunkt = aktuell?.erledigtAm;
  const vorher = aktuell?.erledigtNachweis;
  patch("fristen", f.id, { status: "offen", erledigtAm: undefined, erledigtVon: undefined, erledigtNachweis: undefined });
  // Wiederöffnen wird protokolliert (Ausgangskontrolle nachvollziehbar)
  log({ akteur: "nutzer", userId, akteId: f.akteId, text: `${TYP_META[f.typ].label} „${f.titel}“ (${fmtDate(f.datum)}) wieder geöffnet${vorher ? ` – vorheriger Nachweis: ${NACHWEIS_ART[vorher.art]}${vorher.text ? ` (${vorher.text})` : ""}` : ""}` });
  for (const v of vorfristenZu(f, data.fristen)) {
    if (v.status !== "erledigt") continue;
    if (v.datum >= heute || (zeitpunkt && v.erledigtAm === zeitpunkt)) patch("fristen", v.id, { status: "offen", erledigtAm: undefined, erledigtVon: undefined });
  }
}

export interface FristKorrektur {
  datum: ISODate;
  vorfrist?: ISODate;
  ereignisDatum?: ISODate;
  regelKey?: string;
  titel?: string;
  grundlage?: string;
  rechenweg?: string[];
  typ?: FristTyp;
  /** Ort, mit dessen Feiertagen korrigiert wurde – bleibt an der Frist gespeichert (I3-T03-02) */
  gerichtsort?: FristGerichtsort;
}

/**
 * Gerichtsort aus der Feiertagszeile eines Rechenwegs: „Feiertage am Gerichtsort geprüft: Berlin (Kammergericht,
 * Berufungsgericht)“ → { land: "BE", gericht: "Kammergericht, Berufungsgericht", quelle: "gericht" }; „… (X – laut Akte)“ →
 * quelle „akte“; „(von Hand gewählt)“ → quelle „hand“; „Gerichtsort noch offen – … Kanzleisitz (Y)“ → quelle „kanzleisitz“.
 * So speichern Fristübernahmen (Posteingang) den Ort, den der Fristenrechner verwendet hat.
 */
export function gerichtsortAusRechenweg(rechenweg: string[] | undefined): FristGerichtsort | undefined {
  const landVon = (name: string): Bundesland | undefined => BUNDESLAENDER.find((b) => b.name === name.trim())?.code;
  for (const z of rechenweg ?? []) {
    const offen = /^Gerichtsort noch offen – geprüft mit den Feiertagen am Kanzleisitz \((.+)\)$/.exec(z);
    if (offen) {
      const land = landVon(offen[1]);
      return land ? { land, quelle: "kanzleisitz" } : undefined;
    }
    const m = /^Feiertage am Gerichtsort geprüft: ([^(]+?) \((.+)\)$/.exec(z);
    if (!m) continue;
    const land = landVon(m[1]);
    if (!land) return undefined;
    const ort = m[2].trim();
    if (ort === "von Hand gewählt") return { land, quelle: "hand" };
    return { land, gericht: ort, quelle: / – laut Akte$/.test(ort) ? "akte" : "gericht" };
  }
  return undefined;
}

/**
 * Korrektur „Neu berechnen“: mit dem gespeicherten bzw. gewählten Gerichtsort (Feiertage am Ort der Fristwahrung) –
 * nie still mit dem Kanzleisitz, wenn die Frist einen anderen Ort hatte (I3-T03-02).
 */
export function korrekturNeuBerechnet(
  f: Pick<Frist, "regelKey">,
  regelKey: string,
  ereignis: ISODate,
  ort: { land: Bundesland; feiertagsOrt?: string; gerichtsort: FristGerichtsort },
  kanzleiLand: Bundesland,
): FristKorrektur {
  const erg = berechneNachRegel(regelKey, ereignis, ort.land, undefined, { feiertagsOrt: ort.feiertagsOrt, kanzleiLand });
  return {
    datum: erg.ende,
    vorfrist: erg.vorfrist,
    ereignisDatum: ereignis,
    regelKey,
    titel: regelKey !== f.regelKey ? erg.regel.titel : undefined,
    grundlage: erg.regel.grundlage,
    rechenweg: erg.rechenweg,
    typ: erg.regel.typ,
    gerichtsort: ort.gerichtsort,
  };
}

/**
 * Korrigiert eine notierte Frist (Datum bzw. Fristart/Ereignisdatum über den Fristenrechner) mit Pflichtgrund.
 * Der vorherige Stand bleibt in `korrekturen` erhalten, Vorfristen ziehen mit, die Vier-Augen-Kontrolle ist danach
 * wieder offen und eine angeforderte Korrektur erledigt. Protokolliert.
 */
export function korrigiereFrist(f: Frist, userId: ID, neu: FristKorrektur, grund: string): void {
  const { patch, log, data } = useData.getState();
  const aktuell = data.fristen.find((x) => x.id === f.id) ?? f;
  const am = nowLocal();
  const vorher = { datum: aktuell.datum, ereignisDatum: aktuell.ereignisDatum, regelKey: aktuell.regelKey, titel: aktuell.titel };
  const titel = neu.titel ?? aktuell.titel;
  patch("fristen", f.id, {
    ...neu,
    titel,
    korrekturen: [...(aktuell.korrekturen ?? []), { am, vonId: userId, grund: grund.trim(), vorher }],
    kontrolliertVon: undefined,
    korrekturAngefordert: undefined,
  });
  for (const v of vorfristenZu(aktuell, data.fristen)) {
    if (v.status !== "offen") continue;
    if (neu.vorfrist && neu.vorfrist < neu.datum) patch("fristen", v.id, { datum: neu.vorfrist, titel: `Vorfrist: ${titel}`, notiz: `Vorfrist zu „${titel}“ (Fristende ${fmtDate(neu.datum)}).` });
    else patch("fristen", v.id, { status: "erledigt", erledigtAm: am, erledigtVon: userId, notiz: `Mit der Korrektur von „${titel}“ entfallen.` });
  }
  const was = [
    vorher.datum !== neu.datum ? `Fristende ${fmtDate(vorher.datum)} → ${fmtDate(neu.datum)}` : "",
    neu.gerichtsort?.quelle === "hand" && aktuell.gerichtsort?.land !== neu.gerichtsort.land ? `Feiertage ${BUNDESLAENDER.find((b) => b.code === neu.gerichtsort!.land)?.name ?? neu.gerichtsort.land} (abweichender Gerichtsort bestätigt)` : "",
    neu.ereignisDatum && neu.ereignisDatum !== vorher.ereignisDatum ? `Ereignis ${vorher.ereignisDatum ? fmtDate(vorher.ereignisDatum) : "–"} → ${fmtDate(neu.ereignisDatum)}` : "",
    neu.regelKey && neu.regelKey !== vorher.regelKey ? `Fristart „${vorher.titel}“ → „${titel}“` : "",
  ].filter(Boolean);
  log({
    akteur: "nutzer",
    userId,
    akteId: f.akteId,
    text: `${TYP_META[aktuell.typ].label} „${vorher.titel}“ korrigiert: ${was.join(", ") || "ohne Datumsänderung"} – Grund: ${grund.trim()}${unterliegtKontrolle(aktuell) ? " · Vier-Augen-Kontrolle wieder offen" : ""}`,
  });
}

/** Kontrolle: „Korrektur anfordern“ mit Grund – sichtbar für die verantwortliche Person, protokolliert. */
export function fordereKorrekturAn(f: Frist, userId: ID, grund: string): void {
  const { patch, log } = useData.getState();
  patch("fristen", f.id, { korrekturAngefordert: { vonId: userId, am: nowLocal(), grund: grund.trim() } });
  log({ akteur: "nutzer", userId, akteId: f.akteId, text: `Korrektur angefordert (Vier-Augen-Kontrolle): ${f.titel} (${fmtDate(f.datum)}) – ${grund.trim()}` });
}

/** Vier-Augen-Kontrolle bestätigen (nur durch eine andere Person als die verantwortliche, siehe `darfKontrollieren`). */
export function bestaetigeKontrolle(f: Frist, userId: ID): boolean {
  const aktuell = useData.getState().data.fristen.find((x) => x.id === f.id) ?? f;
  if (!darfKontrollieren(aktuell, userId)) return false;
  const { patch, log } = useData.getState();
  patch("fristen", f.id, { kontrolliertVon: userId, korrekturAngefordert: undefined });
  log({ akteur: "nutzer", userId, akteId: f.akteId, text: `Vier-Augen-Kontrolle bestätigt: ${f.titel} (${f.datum.split("-").reverse().join(".")})` });
  return true;
}
