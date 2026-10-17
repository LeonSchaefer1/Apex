// Kennzahlen der Kanzlei – eine Berechnung für Cockpit, Apex Island und Apex Assistent, damit überall dieselben Zahlen
// stehen (Posteingang, Finanzen, Fremdgeld, 38h-Motor, Akten). Fristen zählt src/core/fristenLage.ts.
import type { Akte, Aktivitaet, Buchung, Frist, FristTyp, ID, ISODate, Nachricht, Rechnung, Transaktion } from "./types";
import { addDays, diffDays, fmtDateShort, fmtNum, weekday, wochentagName } from "./dates";
import { WERT_PRO_STUNDE, WOCHEN_PRO_JAHR } from "./automationen";
import { aktenMitFrist, FENSTER_TAGE, fristenLage, istKritisch, nachDringlichkeit } from "./fristenLage";

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

// ───────────── Tagesbriefing (drei Sätze: Fristen, Posteingang, nächster Termin) ─────────────

/** Ein Teil eines Briefing-Satzes: Anzeige-Text, optional abweichend gesprochen, optional betont/verlinkt (wie im Cockpit). */
export interface BriefingTeil {
  t: string;
  s?: string;
  ton?: "fg" | "seal" | "amber" | "ink" | "violet";
  href?: string;
}
export type BriefingSatz = BriefingTeil[];

const TYP_LABEL: Record<FristTyp, string> = { notfrist: "Notfrist", frist: "Frist", vorfrist: "Vorfrist", wiedervorlage: "Wiedervorlage", termin: "Termin" };

/** Bezeichnung im Satz: „Notfrist“, „nicht verlängerbare Frist“, „Frist“, „Wiedervorlage“ … */
export function fristArtLabel(f: Frist): string {
  if (f.typ === "frist" && istKritisch(f)) return "nicht verlängerbare Frist";
  return TYP_LABEL[f.typ];
}

function plural(n: number, eins: string, viele: string) {
  return `${n === 1 ? "eine" : fmtNum(n)} ${n === 1 ? eins : viele}`;
}

/** „heute“, „morgen“, „gestern“, sonst „Mo, 19. Okt.“ */
function tagLabel(iso: ISODate, heute: ISODate): string {
  const n = diffDays(heute, iso);
  if (n === 0) return "heute";
  if (n === 1) return "morgen";
  if (n === -1) return "gestern";
  return `${wochentagName(iso, true)}, ${fmtDateShort(iso)}`;
}

function langDatum(iso: ISODate) {
  return `${wochentagName(iso)}, ${fmtDateShort(iso).replace(/\.$/, "")}`;
}

/** Schließt einen Satz mit Punkt ab – ohne doppelten Punkt nach Abkürzungen („22. Okt.“). */
function punkt(s: BriefingSatz) {
  const letzter = s[s.length - 1];
  if (letzter && /\.$/.test(letzter.t)) return;
  s.push({ t: "." });
}

export interface BriefingEingabe {
  heute: ISODate;
  fristen: Frist[];
  akten: Akte[];
  nachrichten: Nachricht[];
  /** nur Fristen und Termine dieser Person („Meine Sicht“) */
  nurFuer?: ID;
}

/**
 * KI-Tagesbriefing aus den Daten – dieselben Sätze wie im Cockpit: „Heute sind 2 Fristen fällig, dazu eine Wiedervorlage und
 * eine Vorfrist. In den nächsten sieben Tagen folgen 5 weitere Fristen und 12 Wiedervorlagen – zuerst zu erledigen ist …“.
 */
export function tagesbriefing(e: BriefingEingabe): BriefingSatz[] {
  const { heute } = e;
  const meine = !!e.nurFuer;
  const akten = new Map(e.akten.map((a) => [a.id, a]));
  const lage = fristenLage(e.fristen, heute, e.nurFuer);
  const prio = (f: Frist) => (akten.get(f.akteId)?.prioritaet === "hoch" ? 0 : 1);
  const nachPrio = (a: Frist, b: Frist) => nachDringlichkeit(a, b) || prio(a) - prio(b);
  const kritischste =
    [...lage.ueberfaellig].sort(nachPrio)[0] ?? [...lage.heute].sort(nachPrio)[0] ?? [...lage.kritischWoche].sort(nachPrio)[0] ?? [...lage.woche].sort(nachPrio)[0];
  const briefing: BriefingSatz[] = [];
  {
    const s: BriefingSatz = [];
    const nF = lage.faellig.length;
    const nU = lage.ueberfaellig.length;
    const nWv = lage.wiedervorlagen.length;
    const nV = lage.vorfristen.length;
    const nW = lage.woche.length;
    const nWvW = lage.wiedervorlagenWoche.length;
    const dazu: BriefingTeil[] = [];
    if (nWv > 0) dazu.push({ t: plural(nWv, "Wiedervorlage", "Wiedervorlagen"), ton: "fg" });
    if (nV > 0) dazu.push({ t: plural(nV, "Vorfrist", "Vorfristen"), ton: "fg" });
    const dazuTeile = dazu.flatMap((p, k) => (k === 0 ? [p] : [{ t: " und " }, p]));
    if (nF + nWv + nV + nW + nWvW === 0) {
      s.push({ t: meine ? "Für Sie sind in den nächsten sieben Tagen keine Fristen notiert." : "In den nächsten sieben Tagen sind keine Fristen notiert." });
    } else {
      if (nF > 0) {
        s.push({ t: meine ? `Für Sie ${nF === 1 ? "ist" : "sind"} heute ` : `Heute ${nF === 1 ? "ist" : "sind"} ` });
        s.push({ t: plural(nF, "Frist", "Fristen"), ton: "fg" });
        s.push({ t: " fällig" });
        if (nU > 0) s.push({ t: nU === nF ? (nF === 1 ? " (bereits überfällig)" : " (alle bereits überfällig)") : ` (davon ${fmtNum(nU)} überfällig)`, ton: "seal" });
        if (dazuTeile.length) s.push({ t: ", dazu " }, ...dazuTeile);
      } else {
        s.push({ t: meine ? "Für Sie ist heute keine Frist fällig" : "Heute ist keine Frist fällig" });
        if (dazuTeile.length) s.push({ t: ", nur " }, ...dazuTeile);
      }
      if (nW > 0 || nWvW > 0) {
        s.push({ t: ". In den nächsten sieben Tagen " });
        if (nW > 0) {
          s.push({ t: nW === 1 ? (nF > 0 ? "folgt " : "steht ") : nF > 0 ? "folgen " : "stehen " });
          s.push({ t: nF > 0 ? (nW === 1 ? "eine weitere Frist" : `${fmtNum(nW)} weitere Fristen`) : plural(nW, "Frist", "Fristen"), ton: "fg" });
          if (nWvW > 0) s.push({ t: " und " }, { t: plural(nWvW, "Wiedervorlage", "Wiedervorlagen"), ton: "fg" });
          if (nF === 0) s.push({ t: " an" });
        } else {
          s.push({ t: "stehen keine weiteren Fristen an, nur " }, { t: plural(nWvW, "Wiedervorlage", "Wiedervorlagen"), ton: "fg" });
        }
      }
      if (kritischste) {
        const a = akten.get(kritischste.akteId);
        const ueber = kritischste.datum < heute;
        const kritisch = istKritisch(kritischste);
        s.push({ t: ueber ? " – sofort zu erledigen ist " : kritischste.datum === heute ? " – zuerst zu erledigen ist " : " – am dringendsten ist " });
        s.push({ t: `die ${fristArtLabel(kritischste)} „${kritischste.titel}“`, ton: kritisch || ueber ? "seal" : "amber" });
        if (a) s.push({ t: " in " }, { t: a.aktenzeichen, ton: "ink", href: `/akten/${a.id}?tab=fristen` });
        if (ueber) s.push({ t: ` (fällig seit ${tagLabel(kritischste.datum, heute)})` });
        else if (kritischste.datum === heute) s.push({ t: " (heute fällig)" });
        else s.push({ t: ` bis ${tagLabel(kritischste.datum, heute)}`, s: ` bis ${langDatum(kritischste.datum)}` });
      }
      punkt(s);
    }
    briefing.push(s);
  }
  {
    const s: BriefingSatz = [];
    const p = posteingangZahlen(e.nachrichten);
    const n = p.neu.length;
    if (n === 0) {
      s.push({ t: "Der Posteingang ist aufgeräumt – keine neuen Nachrichten." });
    } else {
      s.push({ t: "Im Posteingang " }, { t: n === 1 ? "wartet " : "warten " });
      s.push({ t: plural(n, "neue Nachricht", "neue Nachrichten"), ton: "fg" });
      if (p.kiFertig > 0 && p.wartetAufKi > 0) {
        s.push({ t: ` – bei ${fmtNum(p.kiFertig)} ist die KI-Analyse fertig, ` });
        s.push({ t: `${fmtNum(p.wartetAufKi)} ${p.wartetAufKi === 1 ? "wartet" : "warten"} noch auf die KI-Analyse`, ton: "violet" });
      } else if (p.wartetAufKi > 0) {
        s.push({ t: " – " }, { t: p.wartetAufKi === 1 ? "sie wartet noch auf die KI-Analyse" : "alle warten noch auf die KI-Analyse", ton: "violet" });
      } else {
        s.push({ t: " – " }, { t: "die KI hat bereits alle ausgewertet", ton: "violet" });
      }
      if (p.eeb > 0) s.push({ t: `, darunter ${p.eeb === 1 ? "eine Zustellung" : `${fmtNum(p.eeb)} Zustellungen`} gegen eEB`, s: `, darunter ${p.eeb === 1 ? "eine Zustellung" : `${p.eeb} Zustellungen`} gegen elektronisches Empfangsbekenntnis` });
      punkt(s);
    }
    briefing.push(s);
  }
  {
    const s: BriefingSatz = [];
    const t = naechsteTermine(e.fristen, heute, e.nurFuer)[0];
    if (!t) {
      s.push({ t: meine ? "Für Sie stehen derzeit keine Termine im Kalender." : "Derzeit stehen keine Gerichts- oder Ortstermine im Kalender." });
    } else {
      const a = akten.get(t.akteId);
      s.push({ t: "Ihr nächster Termin: " });
      s.push({ t: t.titel, ton: "fg" });
      if (a) s.push({ t: " in " }, { t: a.aktenzeichen, ton: "ink", href: `/akten/${a.id}` });
      s.push({ t: ` ${diffDays(heute, t.datum) <= 1 ? tagLabel(t.datum, heute) : `am ${tagLabel(t.datum, heute)}`}`, s: ` am ${langDatum(t.datum)}` });
      if (t.uhrzeit) s.push({ t: ` um ${t.uhrzeit} Uhr` });
      if (t.ort) s.push({ t: ` – ${t.ort}` });
      punkt(s);
    }
    briefing.push(s);
  }
  return briefing;
}

/** Offene Termine ab heute, nach Datum und Uhrzeit (höchstens fünf). */
export function naechsteTermine(fristen: Frist[], heute: ISODate, nurFuer?: ID): Frist[] {
  return fristen
    .filter((f) => f.status === "offen" && f.typ === "termin" && f.datum >= heute && (!nurFuer || f.verantwortlichId === nurFuer))
    .sort((a, b) => a.datum.localeCompare(b.datum) || (a.uhrzeit ?? "").localeCompare(b.uhrzeit ?? ""))
    .slice(0, 5);
}

/** Text eines Briefing-Satzes – angezeigt oder gesprochen. */
export function briefingText(s: BriefingSatz, gesprochen = false): string {
  return s.map((p) => (gesprochen ? p.s ?? p.t : p.t)).join("");
}

// ───────────── Apex Console: Kanzleien nach Status ─────────────

export interface KanzleiStatusZahlen {
  gesamt: number;
  aktiv: number;
  /** Testzugänge (Status „test“, auch abgelaufene – die Teile ergeben zusammen die Gesamtzahl) */
  imTest: number;
  pausiert: number;
  /** jeder weitere Status (künftig ergänzt), damit die Summe aufgeht */
  sonstige: number;
}

/** Aufteilung der Kanzleien in der Apex Console (I5-T21-01): aktiv + im Test + pausiert (+ sonstige) = gesamt. Ohne Status = aktiv. */
export function kanzleiStatusZahlen(tenants: { status?: string }[]): KanzleiStatusZahlen {
  const status = (t: { status?: string }) => t.status ?? "aktiv";
  const aktiv = tenants.filter((t) => status(t) === "aktiv").length;
  const imTest = tenants.filter((t) => status(t) === "test").length;
  const pausiert = tenants.filter((t) => status(t) === "pausiert").length;
  return { gesamt: tenants.length, aktiv, imTest, pausiert, sonstige: tenants.length - aktiv - imTest - pausiert };
}

/** „3 aktiv · 1 im Test · 0 pausiert“ (weitere Status nur, wenn vorhanden). */
export function kanzleiStatusText(z: KanzleiStatusZahlen): string {
  return [`${z.aktiv} aktiv`, `${z.imTest} im Test`, `${z.pausiert} pausiert`, ...(z.sonstige ? [`${z.sonstige} sonstige`] : [])].join(" · ");
}
