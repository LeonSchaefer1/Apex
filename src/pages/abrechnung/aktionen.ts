// Buchende Aktionen der Abrechnung – schreiben Rechnungen, Aktenkonto (Buchungen), Dokumente und Aktivitäten.
import { useData } from "@/store/data";
import { addDays, fmtDate, fmtEUR, nowLocal, round2, today, uid } from "@/core/dates";
import type { Akte, Buchung, Dokument, Rechnung, RechnungsPosition } from "@/core/types";
import { entwurfsKennung, istEntwurfsKennung, istOffen, naechsteNummern, offenerBetrag, summen, type Summen } from "./lib";

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
}): Rechnung {
  const datum = p.datum ?? today();
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
    inhalt: `${art}${r.art === "vorschuss" ? " (Vorschuss nach § 9 RVG)" : ""} ${r.nummer} vom ${fmtDate(r.datum)}${akte ? ` in Sachen ${akte.titel} (Az. ${akte.aktenzeichen})` : ""}.\n${zeilen}\nNetto ${fmtEUR(r.netto)}, USt. ${fmtEUR(r.ust)}, Gesamtbetrag ${fmtEUR(r.brutto)}. Zahlbar bis ${fmtDate(r.faellig)}.`,
    quelle: "generiert",
    autorId,
    version: 1,
    createdAt: nowLocal(),
  };
}

/** Legt eine Rechnung an. Gestellte Rechnungen erzeugen die Honorarbuchung im Aktenkonto und ein PDF in der E-Akte. */
export function legeRechnungAn(r: Rechnung, autorId?: string) {
  const st = useData.getState();
  st.upsert("rechnungen", r);
  if (r.status !== "entwurf") {
    const akte = st.data.akten.find((a) => a.id === r.akteId);
    st.upsert("buchungen", { id: uid("b"), akteId: r.akteId, datum: r.datum, art: "honorar", betrag: r.brutto, text: `${belegArt(r)} ${r.nummer}`, rechnungId: r.id });
    st.upsert("dokumente", rechnungsDokument(r, akte, autorId));
  }
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
  const next: Rechnung = { ...aktuell, nummer, status: "gestellt", datum, faellig: addDays(datum, ZAHLUNGSZIEL_TAGE) };
  st.patch("rechnungen", r.id, next);
  const akte = st.data.akten.find((a) => a.id === r.akteId);
  st.upsert("buchungen", { id: uid("b"), akteId: r.akteId, datum, art: "honorar", betrag: next.brutto, text: `${belegArt(next)} ${next.nummer}`, rechnungId: r.id });
  st.upsert("dokumente", rechnungsDokument(next, akte, autorId));
  return next;
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
  format: Rechnung["format"],
  status: "entwurf" | "gestellt",
  autorId?: string,
): Rechnung[] {
  const st = useData.getState();
  const vorhandene = [...st.data.rechnungen];
  const nummern = status === "gestellt" ? naechsteNummern(vorhandene, eintraege.length) : [];
  const erstellt = eintraege.map((e, i) => {
    const nummer = status === "gestellt" ? nummern[i] : entwurfsKennung(vorhandene);
    const r = baueRechnung({ nummer, akte: e.akte, positionen: e.positionen, summen: e.summen ?? summen(e.positionen), format: e.format ?? format, status, vorschuss: e.vorschuss, zeitIds: e.zeitIds });
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

export function leiteFremdgeldWeiter(akte: Akte, betrag: number, empfaenger: string, userId?: string): Weiterleitung {
  const st = useData.getState();
  const id = uid("b");
  st.upsert("buchungen", { id, akteId: akte.id, datum: today(), art: "fremdgeld", betrag: -round2(betrag), text: `Weiterleitung an Mandant (${empfaenger})`, fremdgeld: true });
  const fristen = st.data.fristen.filter((f) => f.akteId === akte.id && f.status === "offen" && /fremdgeld/i.test(f.titel));
  for (const f of fristen) st.patch("fristen", f.id, { status: "erledigt", erledigtAm: nowLocal(), erledigtVon: userId });
  st.log({ akteur: "nutzer", userId, akteId: akte.id, text: `Fremdgeld ${fmtEUR(betrag)} an ${empfaenger} weitergeleitet – ${akte.aktenzeichen}` });
  return { buchungId: id, erledigteFristen: fristen.map((f) => f.id), akteId: akte.id, aktenzeichen: akte.aktenzeichen, betrag: round2(betrag), empfaenger, userId };
}

/** Weiterleitung zurücknehmen: Buchung entfernen, Fristen wieder öffnen – mit Gegeneintrag im Aktivitätsprotokoll. */
export function macheWeiterleitungRueckgaengig(res: Weiterleitung) {
  const st = useData.getState();
  st.remove("buchungen", res.buchungId);
  for (const fid of res.erledigteFristen) st.patch("fristen", fid, { status: "offen", erledigtAm: undefined, erledigtVon: undefined });
  st.log({ akteur: "nutzer", userId: res.userId, akteId: res.akteId, text: `Weiterleitung von Fremdgeld ${fmtEUR(res.betrag)} an ${res.empfaenger} rückgängig gemacht – ${res.aktenzeichen}` });
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
