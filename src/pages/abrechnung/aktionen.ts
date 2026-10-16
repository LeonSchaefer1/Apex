// Buchende Aktionen der Abrechnung – schreiben Rechnungen, Aktenkonto (Buchungen), Dokumente und Aktivitäten.
import { useData } from "@/store/data";
import { useSession } from "@/store/session";
import { istConsole } from "@/lib/backend";
import { addDays, fmtDate, fmtEUR, nowLocal, round2, today, uid } from "@/core/dates";
import type { Akte, Buchung, Dokument, Kontakt, Rechnung, RechnungsPosition } from "@/core/types";
import { entwurfsKennung, formatVorbelegung, istEntwurfsKennung, istOffen, korrekturText, naechsteNummern, offenerBetrag, rsvAufteilung, rsvBlockText, summen, type Summen } from "./lib";

/** Name der Kanzlei für Schreiben – aus der Sitzung, sonst neutral. */
function kanzleiName(): string {
  const s = useSession.getState().sitzung;
  return s && !istConsole(s) ? s.tenant.name : "Ihre Rechtsanwälte";
}

export const ZAHLUNGSZIEL_TAGE = 14;

export function baueRechnung(p: {
  nummer: string;
  akte: Akte;
  positionen: RechnungsPosition[];
  summen: Summen;
  format: Rechnung["format"];
  status: "entwurf" | "gestellt";
  datum?: string;
  vorschuss?: boolean;
  zeitIds?: string[];
  korrekturVon?: string;
}): Rechnung {
  const datum = p.datum ?? today();
  const rsv = rsvAufteilung(p.akte, p.summen.brutto);
  return {
    id: uid("r"),
    nummer: p.nummer,
    akteId: p.akte.id,
    empfaengerId: p.akte.mandantId,
    datum,
    faellig: addDays(datum, ZAHLUNGSZIEL_TAGE),
    positionen: p.positionen,
    netto: p.summen.netto,
    ust: p.summen.ust,
    brutto: p.summen.brutto,
    status: p.status,
    bezahlt: 0,
    format: p.format,
    createdAt: nowLocal(),
    ...(p.vorschuss ? { art: "vorschuss" as const } : {}),
    ...(p.zeitIds?.length ? { zeitIds: p.zeitIds } : {}),
    ...(rsv ? { rsv } : {}),
    ...(p.korrekturVon ? { korrekturVon: p.korrekturVon } : {}),
  };
}

/** „Rechnung“ bzw. „Vorschussrechnung“ (§ 9 RVG) – für Buchungstexte, E-Akte und Papier. */
export const belegArt = (r: Pick<Rechnung, "art">) => (r.art === "vorschuss" ? "Vorschussrechnung" : "Rechnung");

function rechnungsDokument(r: Rechnung, akte: Akte | undefined, autorId?: string): Dokument {
  const zeilen = r.positionen.map((p) => `${p.vv} ${p.bezeichnung}: ${fmtEUR(p.betrag)}`).join("\n");
  const art = belegArt(r);
  return {
    id: uid("d"),
    akteId: r.akteId,
    name: `${art} ${r.nummer}${r.format !== "PDF" ? ` (${r.format})` : ""}`,
    art: "rechnung",
    ordner: "Rechnungen",
    format: "pdf",
    groesseKb: 38 + r.positionen.length * 4,
    seiten: 1,
    inhalt: `${art}${r.art === "vorschuss" ? " (Vorschuss nach § 9 RVG)" : ""} ${r.nummer} vom ${fmtDate(r.datum)}${akte ? ` in Sachen ${akte.titel} (Az. ${akte.aktenzeichen})` : ""}.\n${zeilen}\nNetto ${fmtEUR(r.netto)}, USt. ${fmtEUR(r.ust)}, Gesamtbetrag ${fmtEUR(r.brutto)}. Zahlbar bis ${fmtDate(r.faellig)}.${r.rsv ? `\n${rsvBlockText(r.rsv, fmtEUR)}.` : ""}${r.korrekturVon ? `\n${korrekturText(useData.getState().data.rechnungen.find((x) => x.id === r.korrekturVon)?.nummer ?? "")}` : ""}`,
    quelle: "generiert",
    autorId,
    version: 1,
    createdAt: nowLocal(),
  };
}

/**
 * „Abrechnungsschreiben an <RSV>“ bzw. bei Vorschüssen „Zahlungsaufforderung an <RSV>“: Zahlungsaufforderung über den
 * RSV-Anteil mit Versicherungs- und Schadennummer, die Kostennote an den Mandanten liegt in Kopie bei.
 */
export function rsvSchreiben(r: Rechnung, akte: Akte | undefined, mandant: Kontakt | undefined, autorId?: string): Dokument | undefined {
  if (!r.rsv) return undefined;
  const vorschuss = r.art === "vorschuss";
  const titel = vorschuss ? `Zahlungsaufforderung an ${r.rsv.versicherung} (Entwurf)` : `Abrechnungsschreiben an ${r.rsv.versicherung}`;
  const vn = mandant?.name ?? "Ihr Versicherungsnehmer";
  const inhalt = [
    `${r.rsv.versicherung}`,
    "Schadenabteilung",
    "",
    `${fmtDate(today())}`,
    "",
    `Versicherungsnehmer: ${vn}`,
    `Versicherungsnummer: ${r.rsv.versicherungsnummer || "bitte ergänzen"}`,
    `Schadennummer: ${r.rsv.schadennummer || "bitte ergänzen"}`,
    akte ? `Unser Zeichen: ${akte.aktenzeichen} – ${akte.titel}` : "",
    "",
    vorschuss ? `Vorschuss nach § 9 RVG – ${belegArt(r)} ${r.nummer}` : `Kostenerstattung – ${belegArt(r)} ${r.nummer}`,
    "",
    "Sehr geehrte Damen und Herren,",
    "",
    // Ohne erteilte Deckung nicht auf eine „Deckungszusage“ berufen – sondern um sie bitten
    `${vorschuss ? `in der oben genannten Angelegenheit haben wir Ihrem Versicherungsnehmer einen Vorschuss nach § 9 RVG über ${fmtEUR(r.brutto)} berechnet.` : `in der oben genannten Angelegenheit überreichen wir die Kostennote an Ihren Versicherungsnehmer über ${fmtEUR(r.brutto)} in Kopie.`} ${
      r.rsv.zugesagt === false ? "Wir bitten um Erteilung der Deckungszusage und" : "Auf Grundlage Ihrer Deckungszusage bitten wir"
    } um ${vorschuss ? "Zahlung" : "Ausgleich"} Ihres Anteils von ${fmtEUR(r.rsv.anteilVersicherung)} bis zum ${fmtDate(r.faellig)}.`,
    r.rsv.selbstbeteiligung > 0 ? `Die vereinbarte Selbstbeteiligung von ${fmtEUR(r.rsv.selbstbeteiligung)} haben wir Ihrem Versicherungsnehmer in Rechnung gestellt.` : "",
    "Ist Ihr Versicherungsnehmer vorsteuerabzugsberechtigt, erstatten Sie bitte nur den Nettobetrag; die Umsatzsteuer trägt er selbst.",
    "",
    `Bitte überweisen Sie unter Angabe der Rechnungsnummer ${istEntwurfsKennung(r.nummer) ? "(wird beim Stellen vergeben)" : r.nummer} und unseres Zeichens.`,
    "",
    "Anlage: Kostennote in Kopie",
    "",
    "Mit freundlichen Grüßen",
    "",
    kanzleiName(),
  ]
    .filter((z, i, a) => z !== "" || a[i - 1] !== "")
    .join("\n");
  return {
    id: uid("d"),
    akteId: r.akteId,
    name: titel,
    art: "brief",
    ordner: "Korrespondenz",
    format: "docx",
    groesseKb: 26,
    seiten: 1,
    inhalt,
    quelle: "generiert",
    autorId,
    version: 1,
    createdAt: nowLocal(),
  };
}

/** Gestellte Rechnung: Honorarbuchung, PDF in der E-Akte und – bei Rechtsschutz – das Schreiben an die RSV. */
function belegeGestellt(r: Rechnung, autorId?: string) {
  const st = useData.getState();
  const akte = st.data.akten.find((a) => a.id === r.akteId);
  st.upsert("buchungen", { id: uid("b"), akteId: r.akteId, datum: r.datum, art: "honorar", betrag: r.brutto, text: `${belegArt(r)} ${r.nummer}`, rechnungId: r.id });
  st.upsert("dokumente", rechnungsDokument(r, akte, autorId));
  const brief = rsvSchreiben(r, akte, st.data.kontakte.find((k) => k.id === r.empfaengerId), autorId);
  if (brief) st.upsert("dokumente", brief);
}

/** Legt eine Rechnung an. Gestellte Rechnungen erzeugen die Honorarbuchung im Aktenkonto und ein PDF in der E-Akte. */
export function legeRechnungAn(r: Rechnung, autorId?: string) {
  const st = useData.getState();
  st.upsert("rechnungen", r);
  if (r.status !== "entwurf") belegeGestellt(r, autorId);
}

/**
 * Entwurf → gestellte Rechnung (Rechnungsdatum heute, Zahlungsziel 14 Tage). Erst jetzt wird die endgültige,
 * fortlaufende Rechnungsnummer vergeben (§ 14 Abs. 4 S. 1 Nr. 4 UStG) – gelöschte Entwürfe hinterlassen keine Lücke.
 */
export function stelleRechnung(r: Rechnung, autorId?: string): Rechnung {
  const st = useData.getState();
  const aktuell = st.data.rechnungen.find((x) => x.id === r.id) ?? r;
  const datum = today();
  const nummer = istEntwurfsKennung(aktuell.nummer) ? naechsteNummern(st.data.rechnungen, 1)[0] : aktuell.nummer;
  // RSV-Aufteilung beim Stellen aktualisieren (Schadennummer oder Selbstbeteiligung können nachgetragen sein)
  const akte = st.data.akten.find((a) => a.id === r.akteId);
  const rsv = rsvAufteilung(akte, aktuell.brutto) ?? aktuell.rsv;
  const next: Rechnung = { ...aktuell, nummer, status: "gestellt", datum, faellig: addDays(datum, ZAHLUNGSZIEL_TAGE), ...(rsv ? { rsv } : {}) };
  st.patch("rechnungen", r.id, next);
  belegeGestellt(next, autorId);
  return next;
}

/** Positionen eines Entwurfs ändern – Summen und RSV-Aufteilung werden neu berechnet. */
export function aktualisierePositionen(r: Rechnung, positionen: RechnungsPosition[]) {
  const st = useData.getState();
  const s = summen(positionen);
  const akte = st.data.akten.find((a) => a.id === r.akteId);
  const rsv = rsvAufteilung(akte, s.brutto);
  st.patch("rechnungen", r.id, { positionen, netto: s.netto, ust: s.ust, brutto: s.brutto, rsv });
}

/** Formatwahl eines Entwurfs (PDF, XRechnung, ZUGFeRD). */
export function setzeFormat(r: Rechnung, format: Rechnung["format"]) {
  useData.getState().patch("rechnungen", r.id, { format });
}

/**
 * „Korrigieren“: storniert die Rechnung (Stornorechnung mit eigener Nummer) und legt einen vorbefüllten Entwurf mit
 * `korrekturVon` an – Positionen, Format und Zeiten wie im Original, Text „Korrektur zu RE-…“.
 */
export function korrigiereRechnung(r: Rechnung, autorId?: string): { storno: StornoErgebnis; entwurf: Rechnung } {
  const st = useData.getState();
  const aktuell = st.data.rechnungen.find((x) => x.id === r.id) ?? r;
  const storno = aktuell.status === "storniert" ? { stornoNummer: aktuell.stornoNummer, guthaben: 0, zeitenFrei: 0 } : storniereRechnung(aktuell, autorId);
  const akte = st.data.akten.find((a) => a.id === aktuell.akteId);
  if (!akte) throw new Error("Akte nicht gefunden");
  const entwurf = baueRechnung({
    nummer: entwurfsKennung(useData.getState().data.rechnungen),
    akte,
    positionen: aktuell.positionen.map((p) => ({ ...p })),
    summen: summen(aktuell.positionen),
    format: aktuell.format,
    status: "entwurf",
    vorschuss: aktuell.art === "vorschuss",
    zeitIds: aktuell.zeitIds,
    korrekturVon: aktuell.id,
  });
  legeRechnungAn(entwurf, autorId);
  for (const zid of aktuell.zeitIds ?? []) st.patch("zeiten", zid, { abgerechnet: true });
  st.log({
    akteur: "nutzer",
    userId: autorId,
    akteId: aktuell.akteId,
    text: `${korrekturText(aktuell.nummer)}: ${belegArt(aktuell)} storniert (Stornorechnung ${storno.stornoNummer ?? "–"}), Korrekturentwurf angelegt (${entwurf.nummer})${akte ? ` – ${akte.aktenzeichen}` : ""}`,
  });
  return { storno, entwurf };
}

export interface ZahlungsErgebnis {
  status: Rechnung["status"];
  /** Auf die Rechnung verrechneter Betrag (höchstens der offene Rest). */
  verrechnet: number;
  /** Mehrbetrag, der als Guthaben der Mandantschaft im Aktenkonto steht (Erstattung oder Verrechnung). */
  guthaben: number;
}

/**
 * Zahlung auf eine Rechnung buchen (Aktenkonto + Status bezahlt / teilbezahlt). Auf die Rechnung wird höchstens der
 * offene Rest verrechnet. Eine Überzahlung wird – sofern nicht `ueberzahlung: "nurOffen"` – getrennt als Guthaben
 * der Mandantschaft gebucht und im Protokoll vermerkt, damit sie erstattet oder verrechnet wird.
 */
export function erfasseZahlung(
  r: Rechnung,
  betrag: number,
  datum: string,
  opts: { transaktionId?: string; text?: string; ueberzahlung?: "guthaben" | "nurOffen" } = {},
): ZahlungsErgebnis {
  const st = useData.getState();
  const aktuell = st.data.rechnungen.find((x) => x.id === r.id) ?? r;
  const offen = round2(Math.max(0, aktuell.brutto - aktuell.bezahlt));
  const verrechnet = round2(Math.min(Math.max(0, betrag), offen));
  const mehr = round2(betrag - verrechnet);
  const guthaben = mehr > 0.004 && opts.ueberzahlung !== "nurOffen" ? mehr : 0;
  const bezahlt = round2(aktuell.bezahlt + verrechnet);
  const status: Rechnung["status"] = bezahlt + 0.005 >= aktuell.brutto ? "bezahlt" : "teilbezahlt";
  st.patch("rechnungen", r.id, { bezahlt, status, bezahltAm: datum });
  if (verrechnet > 0) {
    const b: Buchung = {
      id: uid("b"),
      akteId: r.akteId,
      datum,
      art: "zahlung",
      betrag: -verrechnet,
      text: opts.text ?? (status === "bezahlt" ? `Zahlungseingang ${aktuell.nummer}` : `Teilzahlung ${aktuell.nummer}`),
      rechnungId: r.id,
      transaktionId: opts.transaktionId,
    };
    st.upsert("buchungen", b);
  }
  if (guthaben > 0) {
    st.upsert("buchungen", {
      id: uid("b"),
      akteId: r.akteId,
      datum,
      art: "zahlung",
      betrag: -guthaben,
      text: `Überzahlung zu ${aktuell.nummer} – Guthaben der Mandantschaft (erstatten oder verrechnen)`,
      rechnungId: r.id,
      transaktionId: opts.transaktionId,
    });
    const akte = st.data.akten.find((a) => a.id === r.akteId);
    st.log({ akteur: "system", akteId: r.akteId, text: `Überzahlung ${fmtEUR(guthaben)} auf ${aktuell.nummer} als Guthaben gebucht – Erstattung oder Verrechnung prüfen${akte ? ` – ${akte.aktenzeichen}` : ""}` });
  }
  return { status, verrechnet, guthaben };
}

/** Noch nicht stornierte Zahlungsbuchungen einer Rechnung (optional nur aus einem Bankumsatz). */
export function aktiveZahlungen(r: Pick<Rechnung, "id">, buchungen: Buchung[], transaktionId?: string): Buchung[] {
  const eigene = buchungen.filter((b) => b.rechnungId === r.id && b.art === "zahlung");
  return eigene.filter(
    (b) =>
      b.betrag < 0 &&
      !b.text.startsWith("Storno: ") &&
      (!transaktionId || b.transaktionId === transaktionId) &&
      !eigene.some((x) => x.text === `Storno: ${b.text}` && Math.abs(x.betrag + b.betrag) < 0.005 && x.transaktionId === b.transaktionId),
  );
}

/**
 * „Zahlung zurücknehmen“ bzw. „Zuordnung lösen“: Gegenbuchung (Storno) der Zahlungsbuchungen im Aktenkonto, Rechnungsstatus
 * zurücksetzen, zugehörige Bankumsätze wieder offen – mit Protokolleintrag. Nichts wird stillschweigend gelöscht.
 */
export function nimmZahlungZurueck(r: Rechnung, opts: { userId?: string; transaktionId?: string; grund?: string } = {}): { betrag: number; buchungen: number } {
  const st = useData.getState();
  const aktuell = st.data.rechnungen.find((x) => x.id === r.id) ?? r;
  const zahlungen = aktiveZahlungen(aktuell, st.data.buchungen, opts.transaktionId);
  if (!zahlungen.length) return { betrag: 0, buchungen: 0 };
  const datum = today();
  let verrechnet = 0;
  let gesamt = 0;
  for (const b of zahlungen) {
    st.upsert("buchungen", { id: uid("b"), akteId: b.akteId, datum, art: "zahlung", betrag: -b.betrag, text: `Storno: ${b.text}`, rechnungId: b.rechnungId, transaktionId: b.transaktionId });
    gesamt += -b.betrag;
    if (!b.text.startsWith("Überzahlung zu")) verrechnet += -b.betrag;
  }
  const bezahlt = round2(Math.max(0, aktuell.bezahlt - verrechnet));
  if (aktuell.status !== "storniert") st.patch("rechnungen", aktuell.id, { bezahlt, status: bezahlt > 0.004 ? "teilbezahlt" : "gestellt", bezahltAm: bezahlt > 0.004 ? aktuell.bezahltAm : undefined });
  else st.patch("rechnungen", aktuell.id, { bezahlt });
  const tIds = [...new Set(zahlungen.map((b) => b.transaktionId).filter((x): x is string => !!x))];
  for (const tid of tIds) st.patch("transaktionen", tid, { status: "offen", zuordnung: undefined });
  const akte = st.data.akten.find((a) => a.id === aktuell.akteId);
  st.log({
    akteur: "nutzer",
    userId: opts.userId,
    akteId: aktuell.akteId,
    text: `Zahlung zu ${aktuell.nummer} zurückgenommen: ${fmtEUR(round2(gesamt))} gegengebucht${tIds.length ? `, ${tIds.length === 1 ? "Bankumsatz wieder offen" : `${tIds.length} Bankumsätze wieder offen`}` : ""}${opts.grund ? ` · ${opts.grund}` : ""}${akte ? ` – ${akte.aktenzeichen}` : ""}`,
  });
  return { betrag: round2(gesamt), buchungen: zahlungen.length };
}

/** Mit einer Rechnung abgerechnete Zeiten wieder als offen führen (Entwurf gelöscht oder Rechnung storniert). */
function gebeZeitenFrei(r: Rechnung): number {
  const st = useData.getState();
  const ids = (r.zeitIds ?? []).filter((id) => st.data.zeiten.some((z) => z.id === id && z.abgerechnet));
  for (const id of ids) st.patch("zeiten", id, { abgerechnet: false });
  return ids.length;
}

/** Entwurf endgültig löschen; abgerechnete Zeiten werden wieder abrechenbar. Gibt die Zahl freigegebener Zeiten zurück. */
export function loescheEntwurf(r: Rechnung): number {
  const st = useData.getState();
  const aktuell = st.data.rechnungen.find((x) => x.id === r.id) ?? r;
  if (aktuell.status !== "entwurf") return 0;
  const frei = gebeZeitenFrei(aktuell);
  st.remove("rechnungen", aktuell.id);
  return frei;
}

export interface StornoErgebnis {
  stornoNummer?: string;
  /** Bereits auf die Rechnung gezahlter Betrag – steht nach dem Storno als Guthaben im Aktenkonto. */
  guthaben: number;
  zeitenFrei: number;
}

/**
 * Storno: Die Rechnung bleibt mit ihrer Nummer erhalten; es entsteht eine Stornorechnung mit eigener, fortlaufender
 * Nummer (Gegenbuchung im Aktenkonto, Beleg in der E-Akte). Bereits geleistete Zahlungen bleiben als Guthaben stehen.
 */
export function storniereRechnung(r: Rechnung, autorId?: string): StornoErgebnis {
  const st = useData.getState();
  const aktuell = st.data.rechnungen.find((x) => x.id === r.id) ?? r;
  const hatteHonorar = aktuell.status !== "entwurf";
  const datum = today();
  const stornoNummer = hatteHonorar ? naechsteNummern(st.data.rechnungen, 1)[0] : undefined;
  st.patch("rechnungen", r.id, { status: "storniert", storniertAm: datum, ...(stornoNummer ? { stornoNummer } : {}) });
  if (hatteHonorar && stornoNummer) {
    const art = belegArt(aktuell);
    st.upsert("buchungen", { id: uid("b"), akteId: r.akteId, datum, art: "honorar", betrag: -aktuell.brutto, text: `Stornorechnung ${stornoNummer} zu ${art} ${aktuell.nummer}`, rechnungId: r.id });
    const akte = st.data.akten.find((a) => a.id === r.akteId);
    st.upsert("dokumente", {
      id: uid("d"),
      akteId: r.akteId,
      name: `Stornorechnung ${stornoNummer} zu ${aktuell.nummer}`,
      art: "rechnung",
      ordner: "Rechnungen",
      format: "pdf",
      groesseKb: 34,
      seiten: 1,
      inhalt: `Stornorechnung ${stornoNummer} vom ${fmtDate(datum)} zur ${art} ${aktuell.nummer} vom ${fmtDate(aktuell.datum)}${akte ? ` in Sachen ${akte.titel} (Az. ${akte.aktenzeichen})` : ""}.\nDie ${art} wird in voller Höhe storniert: Netto ${fmtEUR(-aktuell.netto)}, USt. ${fmtEUR(-aktuell.ust)}, Gesamtbetrag ${fmtEUR(-aktuell.brutto)}.${aktuell.bezahlt > 0 ? `\nBereits gezahlt: ${fmtEUR(aktuell.bezahlt)} – Guthaben der Mandantschaft, wird erstattet oder verrechnet.` : ""}`,
      quelle: "generiert",
      autorId,
      version: 1,
      createdAt: nowLocal(),
    });
  }
  const zeitenFrei = gebeZeitenFrei(aktuell);
  return { stornoNummer, guthaben: hatteHonorar ? round2(aktuell.bezahlt) : 0, zeitenFrei };
}

/**
 * Mehrere Rechnungen in einem Durchgang (Sammelabrechnung, Zeiterfassung, RVG-Rechner). Gestellte Rechnungen erhalten
 * fortlaufende Rechnungsnummern, Entwürfe nur eine vorläufige Kennung. Abgerechnete Zeiten werden an der Rechnung vermerkt.
 */
export function erstelleRechnungen(
  eintraege: { akte: Akte; positionen: RechnungsPosition[]; summen?: Summen; zeitIds?: string[]; vorschuss?: boolean; format?: Rechnung["format"] }[],
  /** „auto“: E-Rechnung (XRechnung) für Organisationen, PDF für Privatpersonen – im Entwurf änderbar. */
  format: Rechnung["format"] | "auto",
  status: "entwurf" | "gestellt",
  autorId?: string,
): Rechnung[] {
  const st = useData.getState();
  const vorhandene = [...st.data.rechnungen];
  const nummern = status === "gestellt" ? naechsteNummern(vorhandene, eintraege.length) : [];
  const erstellt = eintraege.map((e, i) => {
    const nummer = status === "gestellt" ? nummern[i] : entwurfsKennung(vorhandene);
    const fmt = e.format ?? (format === "auto" ? formatVorbelegung(st.data.kontakte.find((k) => k.id === e.akte.mandantId)) : format);
    const r = baueRechnung({ nummer, akte: e.akte, positionen: e.positionen, summen: e.summen ?? summen(e.positionen), format: fmt, status, vorschuss: e.vorschuss, zeitIds: e.zeitIds });
    vorhandene.push(r);
    legeRechnungAn(r, autorId);
    for (const zid of e.zeitIds ?? []) st.patch("zeiten", zid, { abgerechnet: true });
    return r;
  });
  return erstellt;
}

/** Fremdgeld an die Mandantschaft weiterleiten (§ 43a Abs. 7 BRAO). Gibt die Buchungs-ID für „Rückgängig“ zurück. */
export interface Weiterleitung {
  buchungId: string;
  erledigteFristen: string[];
  akteId: string;
  aktenzeichen: string;
  betrag: number;
  empfaenger: string;
  userId?: string;
}

export interface WeiterleitungsAngaben {
  empfaenger: string;
  iban: string;
  verwendungszweck: string;
  wirkung: "sepa-datei" | "bereits-ueberwiesen";
  /** Bei „bereits überwiesen“: Datum der Überweisung */
  ueberwiesenAm?: string;
}

/**
 * Weiterleitung buchen: Auszahlung im Aktenkonto mit Empfänger, IBAN, Verwendungszweck und Wirkung (`buchung.weiterleitung`),
 * zugehörige Fremdgeld-Fristen erledigt. Rückgängig bleibt dauerhaft über eine Stornobuchung möglich.
 */
export function leiteFremdgeldWeiter(akte: Akte, betrag: number, angaben: WeiterleitungsAngaben, userId?: string): Weiterleitung {
  const st = useData.getState();
  const id = uid("b");
  const am = nowLocal();
  const datum = angaben.wirkung === "bereits-ueberwiesen" && angaben.ueberwiesenAm ? angaben.ueberwiesenAm : today();
  st.upsert("buchungen", {
    id,
    akteId: akte.id,
    datum,
    art: "fremdgeld",
    betrag: -round2(betrag),
    text: `Weiterleitung Fremdgeld an ${angaben.empfaenger}${angaben.wirkung === "sepa-datei" ? " (SEPA-Überweisung zur Freigabe)" : " (bereits überwiesen)"}`,
    fremdgeld: true,
    weiterleitung: { empfaenger: angaben.empfaenger, iban: angaben.iban.replace(/\s+/g, "").toUpperCase(), verwendungszweck: angaben.verwendungszweck, wirkung: angaben.wirkung, am, von: userId ?? "" },
  });
  const fristen = st.data.fristen.filter((f) => f.akteId === akte.id && f.status === "offen" && /fremdgeld/i.test(f.titel));
  for (const f of fristen) st.patch("fristen", f.id, { status: "erledigt", erledigtAm: am, erledigtVon: userId, erledigtNachweis: { art: "sonstiges", text: `Fremdgeld ${fmtEUR(betrag)} an ${angaben.empfaenger} weitergeleitet` } });
  st.log({
    akteur: "nutzer",
    userId,
    akteId: akte.id,
    text: `Fremdgeld ${fmtEUR(betrag)} an ${angaben.empfaenger} weitergeleitet (IBAN ${angaben.iban.replace(/\s+/g, "").toUpperCase().replace(/^(.{4}).*(.{4})$/, "$1 … $2")}, ${angaben.wirkung === "sepa-datei" ? "SEPA-Überweisungsdatei pain.001 erzeugt – Freigabe im Online-Banking" : `bereits überwiesen am ${fmtDate(datum)}`}) – ${akte.aktenzeichen}`,
  });
  return { buchungId: id, erledigteFristen: fristen.map((f) => f.id), akteId: akte.id, aktenzeichen: akte.aktenzeichen, betrag: round2(betrag), empfaenger: angaben.empfaenger, userId };
}

/**
 * Weiterleitung zurücknehmen – dauerhaft möglich: Stornobuchung im Aktenkonto (das Fremdgeld ist wieder offen),
 * Fristen wieder offen, Protokolleintrag. Die ursprüngliche Buchung bleibt sichtbar.
 */
export function storniereWeiterleitung(buchungId: string, userId?: string): boolean {
  const st = useData.getState();
  const b = st.data.buchungen.find((x) => x.id === buchungId);
  if (!b || b.betrag >= 0 || st.data.buchungen.some((x) => x.text === `Storno: ${b.text}` && x.akteId === b.akteId && Math.abs(x.betrag + b.betrag) < 0.005)) return false;
  st.upsert("buchungen", { id: uid("b"), akteId: b.akteId, datum: today(), art: "fremdgeld", betrag: -b.betrag, text: `Storno: ${b.text}`, fremdgeld: true });
  const erledigt = st.data.fristen.filter((f) => f.akteId === b.akteId && f.status === "erledigt" && /fremdgeld/i.test(f.titel) && f.erledigtAm === b.weiterleitung?.am);
  for (const f of erledigt) st.patch("fristen", f.id, { status: "offen", erledigtAm: undefined, erledigtVon: undefined, erledigtNachweis: undefined });
  const akte = st.data.akten.find((a) => a.id === b.akteId);
  st.log({ akteur: "nutzer", userId, akteId: b.akteId, text: `Weiterleitung von Fremdgeld ${fmtEUR(-b.betrag)}${b.weiterleitung ? ` an ${b.weiterleitung.empfaenger}` : ""} storniert – Fremdgeld wieder offen${akte ? ` – ${akte.aktenzeichen}` : ""}` });
  return true;
}

/** Weiterleitung aus dem Hinweis „Rückgängig“ zurücknehmen (Stornobuchung, siehe `storniereWeiterleitung`). */
export function macheWeiterleitungRueckgaengig(res: Weiterleitung) {
  storniereWeiterleitung(res.buchungId, res.userId);
}

/** SEPA-Überweisungsdatei (pain.001.001.09) für die Weiterleitung – Freigabe im Online-Banking des Anderkontos. */
export function sepaPain001(p: { betrag: number; empfaenger: string; iban: string; verwendungszweck: string; kanzlei: string; ausfuehrung: string }): string {
  const x = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const msgId = `APEX-${Date.now()}`;
  const betrag = round2(p.betrag).toFixed(2);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${new Date().toISOString().slice(0, 19)}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <CtrlSum>${betrag}</CtrlSum>
      <InitgPty><Nm>${x(p.kanzlei)}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${msgId}-1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>1</NbOfTxs>
      <CtrlSum>${betrag}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>
      <ReqdExctnDt><Dt>${p.ausfuehrung}</Dt></ReqdExctnDt>
      <Dbtr><Nm>${x(p.kanzlei)} – Anderkonto</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>DE00000000000000000000</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>${msgId}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">${betrag}</InstdAmt></Amt>
        <Cdtr><Nm>${x(p.empfaenger)}</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>${p.iban.replace(/\s+/g, "").toUpperCase()}</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>${x(p.verwendungszweck.slice(0, 140))}</Ustrd></RmtInf>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>
`;
}

/** Zahlungserinnerungen für offene Rechnungen versenden (protokolliert je Rechnung). */
export function sendeZahlungserinnerungen(rs: Rechnung[], userId?: string): number {
  const st = useData.getState();
  const offen = rs.filter(istOffen);
  for (const r of offen) {
    const akte = st.data.akten.find((a) => a.id === r.akteId);
    st.log({ akteur: "nutzer", userId, akteId: r.akteId, text: `Zahlungserinnerung zu ${r.nummer} versendet (${fmtEUR(offenerBetrag(r))} offen)${akte ? ` – ${akte.aktenzeichen}` : ""}` });
  }
  return offen.length;
}

/** Offene Rechnungen vollständig als bezahlt buchen. */
export function markiereBezahlt(rs: Rechnung[]): number {
  const offen = rs.filter(istOffen);
  for (const r of offen) erfasseZahlung(r, offenerBetrag(r), today(), { text: `Zahlungseingang ${r.nummer} (manuell bestätigt)` });
  return offen.length;
}
