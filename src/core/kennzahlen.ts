// Kennzahlen der Kanzlei – eine Berechnung für Cockpit, Apex Island und Apex Assistent, damit überall dieselben Zahlen
// stehen (Posteingang, Finanzen, Fremdgeld, 38h-Motor, Akten). Fristen zählt src/core/fristenLage.ts.
import type { Akte, Aktivitaet, Buchung, Frist, ID, ISODate, Nachricht, Rechnung, Transaktion } from "./types";
import { addDays, diffDays, weekday } from "./dates";
import { WERT_PRO_STUNDE, WOCHEN_PRO_JAHR } from "./automationen";
import { aktenMitFrist, FENSTER_TAGE } from "./fristenLage";

/** Montag der Kalenderwoche (Mo–So) zum Stichtag – „diese Woche“ meint immer die Kalenderwoche. */
export function wochenbeginn(heute: ISODate): ISODate {
  return addDays(heute, -((weekday(heute) + 6) % 7));
}

/** Sonntag der Kalenderwoche zum Stichtag. */
export function wochenende(heute: ISODate): ISODate {
  return addDays(wochenbeginn(heute), 6);
}

// ───────────── Posteingang ─────────────

export interface PosteingangZahlen {
  /** neue eingehende Nachrichten, neueste zuerst */
  neu: Nachricht[];
  /** davon mit fertiger KI-Analyse (analysiert oder übernommen) */
  kiFertig: number;
  /** davon wartend auf die KI-Analyse */
  wartetAufKi: number;
  /** davon Zustellungen gegen eEB, die noch abzugeben sind */
  eeb: number;
}

/** Neue Post wie im Cockpit-Briefing: eingehend und Status „neu“. */
export function posteingangZahlen(nachrichten: Nachricht[]): PosteingangZahlen {
  const neu = nachrichten.filter((n) => n.richtung === "ein" && n.status === "neu").sort((a, b) => b.eingang.localeCompare(a.eingang));
  return {
    neu,
    kiFertig: neu.filter((n) => n.kiStatus === "analysiert" || n.kiStatus === "uebernommen").length,
    wartetAufKi: neu.filter((n) => n.kiStatus === "ausstehend" || !n.kiStatus).length,
    eeb: neu.filter((n) => n.eebErforderlich && !n.eebAbgegeben).length,
  };
}

// ───────────── Finanzen ─────────────

export interface FinanzZahlen {
  /** offene Forderungen: Restbetrag (brutto) gestellter und teilbezahlter Rechnungen */
  offen: number;
  offenAnzahl: number;
  /** davon über dem Zahlungsziel */
  ueberfaellig: number;
  ueberfaelligAnzahl: number;
  /** Fremdgeld zur Weiterleitung (§ 43a Abs. 7 BRAO): positiver Saldo der Fremdgeld-Buchungen je Akte */
  fremdgeld: number;
  fremdgeldAkten: number;
  /** Akten mit Fremdgeld-Saldo und Betrag, größter zuerst */
  fremdgeldJeAkte: { akteId: ID; betrag: number }[];
  /** nicht zugeordnete Kontoumsätze */
  bankOffen: number;
  /** die am längsten überfälligen Rechnungen */
  aelteste: { id: ID; nummer: string; akteId: ID; tage: number; betrag: number }[];
}

export function finanzZahlen(rechnungen: Rechnung[], buchungen: Buchung[], transaktionen: Transaktion[], heute: ISODate): FinanzZahlen {
  const offeneRe = rechnungen.filter((r) => r.status === "gestellt" || r.status === "teilbezahlt");
  const rest = (r: Rechnung) => Math.max(0, r.brutto - r.bezahlt);
  const ueberRe = offeneRe.filter((r) => r.faellig < heute);
  const fremdJeAkte = new Map<string, number>();
  for (const b of buchungen) if (b.art === "fremdgeld") fremdJeAkte.set(b.akteId, (fremdJeAkte.get(b.akteId) ?? 0) + b.betrag);
  const fremdOffen = [...fremdJeAkte].filter(([, v]) => v > 0.005).map(([akteId, betrag]) => ({ akteId, betrag })).sort((a, b) => b.betrag - a.betrag);
  return {
    offen: offeneRe.reduce((s, r) => s + rest(r), 0),
    offenAnzahl: offeneRe.length,
    ueberfaellig: ueberRe.reduce((s, r) => s + rest(r), 0),
    ueberfaelligAnzahl: ueberRe.length,
    fremdgeld: fremdOffen.reduce((s, x) => s + x.betrag, 0),
    fremdgeldAkten: fremdOffen.length,
    fremdgeldJeAkte: fremdOffen,
    bankOffen: transaktionen.filter((t) => t.status === "offen").length,
    aelteste: [...ueberRe]
      .sort((a, b) => a.faellig.localeCompare(b.faellig))
      .slice(0, 2)
      .map((r) => ({ id: r.id, nummer: r.nummer, akteId: r.akteId, tage: diffDays(r.faellig, heute), betrag: rest(r) })),
  };
}

// ───────────── 38h-Motor ─────────────

export interface MotorZahlen {
  /** gesparte Minuten in den letzten 7 Tagen (heute und die sechs Tage davor) – wie Apex Island und Cockpit */
  minuten: number;
  stunden: number;
  /** gesparte Minuten je Tag der letzten 7 Tage (ältester zuerst) */
  proTag: { datum: ISODate; minuten: number }[];
  /** Läufe mit gesparter Zeit in den letzten 7 Tagen */
  laeufe: number;
  /** gesparte Minuten seit Montag (Kalenderwoche) */
  minutenSeitMontag: number;
  /** Bewertung mit internen Personalkosten (Rechenbeispiel, siehe WERT_PRO_STUNDE) */
  euro: number;
  euroJahr: number;
}

/** Gesparte Zeit des 38h-Motors: Summe `minutenGespart` aller Aktivitäten der letzten 7 Tage. */
export function motorZahlen(aktivitaeten: Aktivitaet[], heute: ISODate): MotorZahlen {
  const grenze = addDays(heute, -(FENSTER_TAGE - 1));
  const montag = wochenbeginn(heute);
  const tage = Array.from({ length: FENSTER_TAGE }, (_, i) => addDays(grenze, i));
  const proTag = new Map(tage.map((k) => [k, 0]));
  let minuten = 0;
  let laeufe = 0;
  let seitMontag = 0;
  for (const a of aktivitaeten) {
    const tag = a.zeit.slice(0, 10);
    if (!a.minutenGespart || tag > heute) continue;
    if (tag >= montag) seitMontag += a.minutenGespart;
    if (tag >= grenze) {
      minuten += a.minutenGespart;
      laeufe++;
      proTag.set(tag, (proTag.get(tag) ?? 0) + a.minutenGespart);
    }
  }
  const stunden = minuten / 60;
  return {
    minuten,
    stunden,
    proTag: tage.map((datum) => ({ datum, minuten: proTag.get(datum) ?? 0 })),
    laeufe,
    minutenSeitMontag: seitMontag,
    euro: stunden * WERT_PRO_STUNDE,
    euroJahr: stunden * WERT_PRO_STUNDE * WOCHEN_PRO_JAHR,
  };
}

// ───────────── Akten ─────────────

export interface AktenZahlen {
  offen: number;
  /** davon mit hoher Priorität */
  hoch: number;
  ruhend: number;
  abgeschlossen: number;
  gesamt: number;
  /** angelegt seit Montag (Kalenderwoche) */
  neuSeitMontag: number;
  /** offene Akten mit Frist ≤ 7 Tage inkl. überfälliger – wie Akten-Kennzahl und Cockpit „Akten mit Handlungsbedarf“ */
  mitFrist: number;
  /** davon mit kritischer Frist (Notfrist oder nicht verlängerbar) */
  mitKritischerFrist: number;
}

export function aktenZahlen(akten: Akte[], fristen: Frist[], heute: ISODate): AktenZahlen {
  const offen = akten.filter((a) => a.status === "offen");
  const montag = wochenbeginn(heute);
  const je = aktenMitFrist(fristen, heute);
  const mitFrist = offen.filter((a) => je.has(a.id));
  return {
    offen: offen.length,
    hoch: offen.filter((a) => a.prioritaet === "hoch").length,
    ruhend: akten.filter((a) => a.status === "ruhend").length,
    abgeschlossen: akten.filter((a) => a.status === "abgeschlossen").length,
    gesamt: akten.length,
    neuSeitMontag: akten.filter((a) => a.createdAt.slice(0, 10) >= montag).length,
    mitFrist: mitFrist.length,
    mitKritischerFrist: mitFrist.filter((a) => !!je.get(a.id)?.kritisch).length,
  };
}
