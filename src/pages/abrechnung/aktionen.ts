// Buchende Aktionen der Abrechnung – schreiben Rechnungen, Aktenkonto (Buchungen), Dokumente und Aktivitäten.
import { useData } from "@/store/data";
import { addDays, fmtDate, fmtEUR, nowLocal, round2, today, uid } from "@/core/dates";
import type { Akte, Buchung, Dokument, Rechnung, RechnungsPosition } from "@/core/types";
import { istOffen, naechsteNummern, offenerBetrag, summen, type Summen } from "./lib";

export const ZAHLUNGSZIEL_TAGE = 14;

export function baueRechnung(p: { nummer: string; akte: Akte; positionen: RechnungsPosition[]; summen: Summen; format: Rechnung["format"]; status: "entwurf" | "gestellt"; datum?: string }): Rechnung {
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
  };
}

function rechnungsDokument(r: Rechnung, akte: Akte | undefined, autorId?: string): Dokument {
  const zeilen = r.positionen.map((p) => `${p.vv} ${p.bezeichnung}: ${fmtEUR(p.betrag)}`).join("\n");
  return {
    id: uid("d"),
    akteId: r.akteId,
    name: `Rechnung ${r.nummer}${r.format !== "PDF" ? ` (${r.format})` : ""}`,
    art: "rechnung",
    ordner: "Rechnungen",
    format: "pdf",
    groesseKb: 38 + r.positionen.length * 4,
    seiten: 1,
    inhalt: `Rechnung ${r.nummer} vom ${fmtDate(r.datum)}${akte ? ` in Sachen ${akte.titel} (Az. ${akte.aktenzeichen})` : ""}.\n${zeilen}\nNetto ${fmtEUR(r.netto)}, USt. ${fmtEUR(r.ust)}, Gesamtbetrag ${fmtEUR(r.brutto)}. Zahlbar bis ${fmtDate(r.faellig)}.`,
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
    st.upsert("buchungen", { id: uid("b"), akteId: r.akteId, datum: r.datum, art: "honorar", betrag: r.brutto, text: `Rechnung ${r.nummer}`, rechnungId: r.id });
    st.upsert("dokumente", rechnungsDokument(r, akte, autorId));
  }
}

/** Entwurf → gestellte Rechnung (Rechnungsdatum heute, Zahlungsziel 14 Tage). */
export function stelleRechnung(r: Rechnung, autorId?: string) {
  const st = useData.getState();
  const datum = today();
  const next: Rechnung = { ...r, status: "gestellt", datum, faellig: addDays(datum, ZAHLUNGSZIEL_TAGE) };
  st.patch("rechnungen", r.id, next);
  const akte = st.data.akten.find((a) => a.id === r.akteId);
  st.upsert("buchungen", { id: uid("b"), akteId: r.akteId, datum, art: "honorar", betrag: r.brutto, text: `Rechnung ${r.nummer}`, rechnungId: r.id });
  st.upsert("dokumente", rechnungsDokument(next, akte, autorId));
}

/** Zahlung auf eine Rechnung buchen (Aktenkonto + Status bezahlt / teilbezahlt). */
export function erfasseZahlung(r: Rechnung, betrag: number, datum: string, opts: { transaktionId?: string; text?: string } = {}) {
  const st = useData.getState();
  const aktuell = st.data.rechnungen.find((x) => x.id === r.id) ?? r;
  const bezahlt = round2(Math.min(aktuell.brutto, aktuell.bezahlt + betrag));
  const status: Rechnung["status"] = bezahlt + 0.005 >= aktuell.brutto ? "bezahlt" : "teilbezahlt";
  st.patch("rechnungen", r.id, { bezahlt, status, bezahltAm: datum });
  const b: Buchung = {
    id: uid("b"),
    akteId: r.akteId,
    datum,
    art: "zahlung",
    betrag: -round2(betrag),
    text: opts.text ?? (status === "bezahlt" ? `Zahlungseingang ${r.nummer}` : `Teilzahlung ${r.nummer}`),
    rechnungId: r.id,
    transaktionId: opts.transaktionId,
  };
  st.upsert("buchungen", b);
  return status;
}

/** Storno: Status „storniert“, Gegenbuchung im Aktenkonto. Die Nummer bleibt lückenlos erhalten. */
export function storniereRechnung(r: Rechnung) {
  const st = useData.getState();
  const hatteHonorar = r.status !== "entwurf";
  st.patch("rechnungen", r.id, { status: "storniert" });
  if (hatteHonorar) {
    st.upsert("buchungen", { id: uid("b"), akteId: r.akteId, datum: today(), art: "honorar", betrag: -r.brutto, text: `Storno Rechnung ${r.nummer}`, rechnungId: r.id });
  }
}

/** Mehrere Rechnungen in einem Durchgang (Sammelabrechnung). */
export function erstelleRechnungen(
  eintraege: { akte: Akte; positionen: RechnungsPosition[]; summen?: Summen; zeitIds?: string[] }[],
  format: Rechnung["format"],
  status: "entwurf" | "gestellt",
  autorId?: string,
): Rechnung[] {
  const st = useData.getState();
  const nummern = naechsteNummern(st.data.rechnungen, eintraege.length);
  const erstellt = eintraege.map((e, i) => {
    const r = baueRechnung({ nummer: nummern[i], akte: e.akte, positionen: e.positionen, summen: e.summen ?? summen(e.positionen), format, status });
    legeRechnungAn(r, autorId);
    for (const zid of e.zeitIds ?? []) st.patch("zeiten", zid, { abgerechnet: true });
    return r;
  });
  return erstellt;
}

/** Fremdgeld an die Mandantschaft weiterleiten (§ 43a Abs. 5 BRAO). Gibt die Buchungs-ID für „Rückgängig“ zurück. */
export function leiteFremdgeldWeiter(akte: Akte, betrag: number, empfaenger: string, userId?: string): { buchungId: string; erledigteFristen: string[] } {
  const st = useData.getState();
  const id = uid("b");
  st.upsert("buchungen", { id, akteId: akte.id, datum: today(), art: "fremdgeld", betrag: -round2(betrag), text: `Weiterleitung an Mandant (${empfaenger})`, fremdgeld: true });
  const fristen = st.data.fristen.filter((f) => f.akteId === akte.id && f.status === "offen" && /fremdgeld/i.test(f.titel));
  for (const f of fristen) st.patch("fristen", f.id, { status: "erledigt", erledigtAm: nowLocal(), erledigtVon: userId });
  st.log({ akteur: "nutzer", userId, akteId: akte.id, text: `Fremdgeld ${fmtEUR(betrag)} an ${empfaenger} weitergeleitet – ${akte.aktenzeichen}` });
  return { buchungId: id, erledigteFristen: fristen.map((f) => f.id) };
}

export function macheWeiterleitungRueckgaengig(res: { buchungId: string; erledigteFristen: string[] }) {
  const st = useData.getState();
  st.remove("buchungen", res.buchungId);
  for (const fid of res.erledigteFristen) st.patch("fristen", fid, { status: "offen", erledigtAm: undefined, erledigtVon: undefined });
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
