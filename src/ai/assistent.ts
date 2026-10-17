// Apex Assistent: Support & Arbeits-Agent. Live mit Claude (Werkzeuge = Funktionen dieser App) oder offline per Absichtserkennung.
import { berechneNachRegel, FRIST_REGELN, fristDringlichkeit, gerichtsortDerAkte } from "@/core/fristen";
import { FENSTER_TAGE, fristenImZeitraum, fristenLage, istKritisch, zaehltAlsFrist } from "@/core/fristenLage";
import { aktenZahlen, briefingText, finanzZahlen, motorZahlen, posteingangZahlen, tagesbriefing, wochenbeginn, wochenende } from "@/core/kennzahlen";
import { WERT_PRO_STUNDE } from "@/core/automationen";
import { berechneRvg, VV_KATALOG } from "@/core/rvg";
import { ENTSCHEIDUNGEN } from "@/core/rechtsprechung";
import { search, normalize, tokenize } from "@/core/search";
import { addDays, fmtDate, fmtDateWd, fmtEUR, fmtNum, nowLocal, relDays, today, uid, weekday } from "@/core/dates";
import { istWerktag } from "@/core/feiertage";
import { RUECKRUF_SIMULIERT, inServicezeit, naechsteServicezeit, rueckrufNachFristende, rueckrufRegel, rueckrufZusage } from "@/core/rueckruf";
import { tagKurz } from "@/core/vertretung";
import { artikel, wikiFuer, type WikiArtikel } from "@/content/wiki";
import { NAV } from "@/app/nav";
import { useData } from "@/store/data";
import { ansprechBezeichnung, ansprechText, festeAnsprechBezeichnung, foermlicherName, gruss } from "@/lib/rollen";
import type { Akte, Ansprechpartner, Bundesland, Frist, ISODate, Notiz, SessionInfo, FristTyp, TenantData } from "@/core/types";
import { DemoModus, llmAgent, verstaendlicheMeldung, type AgentTool, type LlmMessage } from "./llm";
import { bewertePraezedenz, findePraezedenzfaelle } from "./kontext";

export interface AssistentLink {
  label: string;
  to: string;
}

/** Auswahlknopf bei mehreren Treffern („Öffne die Akte Müller“): ein Klick stellt die eindeutige Folgefrage. */
export interface AuswahlKnopf {
  label: string;
  sub?: string;
  frage: string;
}

export type VorschlagArt = "wiedervorlage" | "frist" | "termin" | "notfrist" | "notiz";

/** Schreibende Aktion als Vorschlag – eingetragen wird erst nach „Eintragen“ in der Bestätigungskarte. */
export interface SchreibVorschlag {
  id: string;
  art: VorschlagArt;
  akteId: string;
  aktenzeichen: string;
  akteTitel: string;
  /** Bezeichnung des Eintrags – bei Wiedervorlagen der Auftragstext („Zeugen Seifert benennen“) */
  titel: string;
  datum?: ISODate;
  uhrzeit?: string;
  /** Inhalt einer Notiz */
  text?: string;
  /** Wortlaut des Auftrags (für das Protokoll) */
  auftrag: string;
  /**
   * Doppelung (I4-T20-01): Für die Akte liegt am selben Tag schon ein offener Eintrag gleicher Art – die Karte zeigt das vor dem
   * Eintragen und verlangt „Trotzdem eintragen“.
   */
  doppelt?: { fristId: string; titel: string; hinweis: string };
}

/** Ergebnis von „Eintragen“ – Grundlage für „Rückgängig“. */
export interface Eintragung {
  col: "fristen" | "notizen";
  id: string;
}

export interface AssistentAntwort {
  text: string;
  links: AssistentLink[];
  werkzeuge: string[];
  auswahl?: AuswahlKnopf[];
  vorschlag?: SchreibVorschlag;
}

export const WERKZEUG_LABEL: Record<string, string> = {
  suche_akten: "Akten durchsucht",
  akte_details: "Akte gelesen",
  fristen_liste: "Fristenkalender geprüft",
  frist_berechnen: "Frist berechnet (§ 222 ZPO)",
  frist_anlegen: "Eintrag vorbereitet – wartet auf Ihre Bestätigung",
  notiz_anlegen: "Notiz vorbereitet – wartet auf Ihre Bestätigung",
  notfall_bea: "Notfallwissen beA-Störung",
  rvg_berechnen: "RVG berechnet",
  rechtsprechung_suchen: "Fall-Datenbank durchsucht",
  entscheidung_erlaeutern: "Entscheidung erläutert",
  navigiere: "Bereich geöffnet",
  hilfe_artikel: "Wiki durchsucht",
  ansprechpartner: "Ansprechpartner abgerufen",
  rueckruf_anfordern: "Rückruf angefordert",
  posteingang_status: "Posteingang geprüft",
  finanzen_status: "Finanzen geprüft",
  motor_status: "38h-Motor geprüft",
  akten_status: "Aktenbestand gezählt",
  tagesbriefing: "Tag zusammengefasst",
};

/** Chip-Text eines Werkzeugs – „Ansprechpartnerin abgerufen“ bzw. „Ansprechpartner abgerufen“ nach den Kanzleidaten. */
export function werkzeugLabel(name: string, ap?: Ansprechpartner): string {
  if (name === "ansprechpartner" && ap) return `${ansprechBezeichnung(ap)} abgerufen`;
  return WERKZEUG_LABEL[name] ?? name;
}

interface Kontext {
  sitzung: SessionInfo;
  nav: (to: string) => void;
  links: AssistentLink[];
  werkzeuge: string[];
  auswahl?: AuswahlKnopf[];
  vorschlag?: SchreibVorschlag;
  /** Ursprünglicher Wortlaut, wenn eine Kurzform („wv 137 …“) intern ausformuliert wurde – für das Protokoll („Ihr Auftrag“). */
  originalFrage?: string;
}

function daten() {
  return useData.getState().data;
}

function mandantName(d: TenantData, a: Akte) {
  return d.kontakte.find((k) => k.id === a.mandantId)?.name;
}

function findeAkteNachAz(az: string): Akte | undefined {
  const d = daten();
  const n = az.replace(/\s/g, "").toLowerCase();
  if (!n) return undefined;
  const exakt = d.akten.find((a) => a.aktenzeichen.toLowerCase() === n || (/^\d+$/.test(n.split("/")[0]) && a.aktenzeichen.split("/")[0] === n.split("/")[0]));
  if (exakt) return exakt;
  if (/^\d{2,3}(\/\d{2})?$/.test(n)) return undefined; // ein unbekanntes Aktenzeichen nicht „ähnlich“ auflösen
  return search(d.akten, az, [{ get: (a) => a.aktenzeichen, weight: 4 }, { get: (a) => a.titel, weight: 3 }, { get: (a) => mandantName(d, a), weight: 2 }], 1)[0]?.item;
}

/** Füllwörter, die beim Erkennen einer Akte über den Namen nie zählen. */
const KANDIDAT_STOP = new Set(tokenize(
  "öffne oeffne zeig zeige mir die der das den dem akte akten sache mandat bitte geh gehe wechsle navigiere bring mich zu zum zur von für fuer lege leg trag trage eintragen erstelle setze setz an anlegen wiedervorlage frist fristen termin notiz erinnerung " +
  "in tagen tage woche wochen morgen heute übermorgen uebermorgen drei zwei vier fünf sechs sieben zehn vierzehn einen eine einer und mit am bis wegen",
));

/**
 * Alle Akten, die zu einem Namen bzw. Aktenzeichen im Text passen („Müller“ → 101/26, 12/26, 14/26). Ein Aktenzeichen ist
 * eindeutig; sonst zählen Wörter aus Titel und Mandantenname (ganze Wörter bzw. Wortanfänge ab vier Zeichen).
 */
export function akteKandidaten(text: string): Akte[] {
  const az = azAus(text);
  if (az) {
    // Nur Ziffern („137“): mehrere Jahrgänge (137/25, 137/26) sind mehrdeutig – dann Rückfrage mit Karten
    if (!az.includes("/")) {
      const alle = daten().akten.filter((a) => a.status !== "abgeschlossen" && a.aktenzeichen.split("/")[0] === az);
      if (alle.length > 1) return alle;
    }
    const a = findeAkteNachAz(az);
    if (a) return [a];
  }
  const d = daten();
  const pool = d.akten.filter((a) => a.status !== "abgeschlossen");
  const woerter = tokenize(text).filter((t) => t.length >= 3 && !KANDIDAT_STOP.has(t) && !AKTEN_STOP.has(t) && !/^\d+$/.test(t));
  let kand: Akte[] | null = null;
  for (const w of woerter) {
    const hits = pool.filter((a) => tokenize(`${a.titel} ${mandantName(d, a) ?? ""}`).some((t) => t === w || (w.length >= 4 && t.startsWith(w))));
    if (!hits.length) continue;
    const enger: Akte[] = kand ? kand.filter((a) => hits.includes(a)) : hits;
    kand = enger.length ? enger : kand;
  }
  return kand ?? [];
}

/** Auswahlknöpfe zu mehreren Treffern – Aktenzeichen, Titel, Mandant. */
function auswahlFuer(akten: Akte[], frage: (a: Akte) => string): AuswahlKnopf[] {
  const d = daten();
  return akten.slice(0, 6).map((a) => ({ label: `${a.aktenzeichen} · ${a.titel}`, sub: mandantName(d, a) ? `Mandant: ${mandantName(d, a)}` : undefined, frage: frage(a) }));
}

/** Nächste offene Frist (Notfrist oder Frist) einer Akte – Wiedervorlagen, Vorfristen und Termine zählen nicht. */
function naechsteFrist(akteId: string) {
  return daten().fristen.filter((f) => f.akteId === akteId && f.status === "offen" && zaehltAlsFrist(f)).sort((a, b) => a.datum.localeCompare(b.datum))[0];
}

/** Bezeichnung eines Eintrags im Satz: „Notfrist“, „nicht verlängerbar“, „Wiedervorlage“ … (leer bei gewöhnlicher Frist). */
function artZusatz(f: Pick<Frist, "typ" | "regelKey">): string {
  if (f.typ === "notfrist") return "Notfrist";
  if (f.typ === "frist") return istKritisch(f) ? "nicht verlängerbar" : "";
  return TYP_NAME[f.typ];
}

const TYP_NAME: Record<FristTyp, string> = { notfrist: "Notfrist", frist: "Frist", vorfrist: "Vorfrist", wiedervorlage: "Wiedervorlage", termin: "Termin" };

/** Anzahl mit Singular/Plural: anz(1, "Frist", "Fristen") → „eine Frist“, anz(3, …) → „3 Fristen“. */
function anz(n: number, sing: string, plur: string, eins = "eine"): string {
  return n === 1 ? `${eins} ${sing}` : `${n} ${plur}`;
}

// ───────────── Bereiche der App (Navigation & Bedienfragen) ─────────────

interface Bereich {
  label: string;
  to: string;
  /** Wo man den Bereich findet (für „Wo finde ich …?“) */
  ort: string;
  beschreibung: string;
  worte: string[];
}

const BEREICHE: Bereich[] = [
  ...NAV.map((n) => ({ label: n.label, to: n.to, ort: `in der Seitenleiste unter „${n.label}“`, beschreibung: n.beschreibung, worte: [n.label, n.kurz ?? "", n.to.slice(1).replace(/-/g, " ")].filter(Boolean) })),
  { label: "Fristenrechner", to: "/fristen?rechner=1", ort: "unter „Fristen“ → „Frist berechnen“", beschreibung: "Berechnet gesetzliche Fristen nach §§ 187, 188 BGB und § 222 ZPO – mit Feiertagen Ihres Bundeslands und vollständigem Rechenweg.", worte: ["Fristenrechner", "Frist berechnen", "Fristberechnung"] },
  { label: "Fristenkalender", to: "/fristen", ort: "in der Seitenleiste unter „Fristen“", beschreibung: "Alle Fristen, Vorfristen und Termine mit Vier-Augen-Kontrolle.", worte: ["Fristenkalender", "Kalender"] },
  { label: "Neue Akte (Mandatsaufnahme)", to: "/akten?neu=1", ort: "unter „Akten“ → „Neue Akte“", beschreibung: "Die Mandatsaufnahme führt in vier Schritten durch Mandant, Sache, Rechtsschutz und Zusammenfassung – Vollmacht, Mandatsbestätigung und Datenschutzhinweise entstehen automatisch.", worte: ["Mandatsaufnahme", "Neue Akte", "Akte anlegen", "neues Mandat"] },
  { label: "RVG-Rechner", to: "/abrechnung?tab=rvg", ort: "unter „Abrechnung“ → „RVG-Rechner“", beschreibung: "Gebühren nach RVG mit Anrechnung, Auslagenpauschale und Umsatzsteuer.", worte: ["RVG-Rechner", "RVG Rechner", "Gebührenrechner"] },
  { label: "Bankabgleich", to: "/abrechnung?tab=bank", ort: "unter „Abrechnung“ → „Bankabgleich“", beschreibung: "Kontoumsätze werden automatisch Rechnungen und Aktenkonten zugeordnet.", worte: ["Bankabgleich", "Kontoumsätze", "Bankumsätze"] },
  { label: "Rechnungen", to: "/abrechnung?tab=rechnungen", ort: "unter „Abrechnung“ → „Rechnungen“", beschreibung: "Alle Rechnungen mit Status – auch als Sammelabrechnung und XRechnung.", worte: ["Rechnungen", "Sammelabrechnung"] },
  { label: "Forderungskonto", to: "/abrechnung?tab=forderung", ort: "unter „Abrechnung“ → „Forderungskonto“", beschreibung: "Zinsen taggenau nach § 288 BGB, Verrechnung nach § 367 BGB.", worte: ["Forderungskonto"] },
  { label: "Zeiterfassung", to: "/abrechnung?tab=zeit", ort: "unter „Abrechnung“ → „Zeiterfassung“", beschreibung: "Zeiten je Akte erfassen und abrechnen.", worte: ["Zeiterfassung"] },
  { label: "Team & Zugänge", to: "/einstellungen?tab=team", ort: "unter „Einstellungen“ → „Team“", beschreibung: "Kolleginnen und Kollegen mit Rolle anlegen und Zugänge verwalten.", worte: ["Team", "Zugänge", "Benutzer", "Mitarbeiter"] },
  { label: "Lizenz", to: "/einstellungen?tab=lizenz", ort: "unter „Einstellungen“ → „Lizenz“", beschreibung: "Ihre Lifetime-Lizenz mit Arbeitsplätzen und Lizenznummer.", worte: ["Lizenz"] },
  { label: "KI-Einstellungen", to: "/einstellungen?tab=ki", ort: "unter „Einstellungen“ → „KI“", beschreibung: "Live-KI oder Präsentationsmodus mit Demo-KI.", worte: ["KI-Einstellungen", "KI Einstellungen"] },
  { label: "Darstellung", to: "/einstellungen?tab=darstellung", ort: "unter „Einstellungen“ → „Darstellung“", beschreibung: "Hell- oder Dunkelmodus und Zeilendichte.", worte: ["Darstellung", "Dunkelmodus", "Dark Mode"] },
  { label: "Datenschutz", to: "/einstellungen?tab=datenschutz", ort: "unter „Einstellungen“ → „Datenschutz“", beschreibung: "Datenschutz-Einstellungen und Demodaten zurücksetzen.", worte: ["Datenschutz"] },
  { label: "Systemstatus", to: "/hilfe", ort: "unter „Hilfe & Support“", beschreibung: "Zeigt, ob beA, E-Mail, Bank und KI verbunden sind.", worte: ["Systemstatus"] },
];

const BEREICH_WORTE = BEREICHE.flatMap((b) => b.worte.map((w) => ({ b, w: normalize(w).replace(/[^a-z0-9]+/g, " ").trim() }))).filter((x) => x.w.length >= 2);

/** Erkennt einen Bereich der App im Text (spezifischster Begriff gewinnt, ganze Wörter). */
export function findeBereich(text: string): Bereich | undefined {
  const n = ` ${normalize(text).replace(/[^a-z0-9]+/g, " ").trim()} `;
  let best: { b: Bereich; w: string } | undefined;
  for (const x of BEREICH_WORTE) {
    if (n.includes(` ${x.w} `) && (!best || x.w.length > best.w.length)) best = x;
  }
  return best?.b;
}

const FUELLWOERTER = new Set(["bitte", "mal", "den", "die", "das", "der", "dem", "zum", "zur", "zu", "in", "mein", "meine", "meinen", "mir", "uns", "oeffnen", "anzeigen", "aufrufen", "bereich", "seite", "danke", "jetzt"]);

/** Besteht die Eingabe nur aus einem Bereichsnamen (z. B. „Einstellungen“ oder „Bankabgleich bitte“)? */
function nurBereich(text: string): Bereich | undefined {
  const rest = normalize(text).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter((w) => w && !FUELLWOERTER.has(w)).join(" ");
  if (!rest) return undefined;
  return BEREICH_WORTE.find((x) => x.w === rest)?.b;
}

/** Werkzeuge = echte Funktionen der App, die die KI aufrufen darf. */
const PRIORITAET = ["hilfe_artikel", "fristen_liste", "suche_akten", "akte_details", "frist_berechnen", "frist_anlegen", "navigiere", "ansprechpartner", "rueckruf_anfordern", "entscheidung_erlaeutern", "rechtsprechung_suchen", "rvg_berechnen", "posteingang_status", "finanzen_status", "motor_status", "akten_status"];

export function werkzeuge(ctx: Kontext): AgentTool[] {
  return alleWerkzeuge(ctx).sort((a, b) => PRIORITAET.indexOf(a.name) - PRIORITAET.indexOf(b.name));
}

/**
 * Zeiträume der Fristenliste: „heute“ (fällig inkl. überfälliger), „morgen“, „woche“ = nächste 7 Tage nach heute (gleitend,
 * wie Cockpit und Fristen-Kennzahl), „kalenderwoche“ = diese Woche bis Sonntag (inkl. überfälliger), „naechste_woche“ =
 * Mo–So der Folgewoche, „monat“ = nächste 30 Tage, „kommend“ = alle offenen (für „als Nächstes“).
 */
export type Zeitraum = "heute" | "morgen" | "woche" | "kalenderwoche" | "naechste_woche" | "monat" | "kommend";
const ZEITRAEUME: Zeitraum[] = ["heute", "morgen", "woche", "kalenderwoche", "naechste_woche", "monat", "kommend"];

interface FristEintrag {
  titel: string;
  typ: FristTyp;
  /** „Notfrist“, „nicht verlängerbar“, „Wiedervorlage“ … – leer bei einer gewöhnlichen Frist */
  art: string;
  kritisch: boolean;
  datum: string;
  relativ: string;
  dringlichkeit: ReturnType<typeof fristDringlichkeit>;
  akte: string;
  grundlage: string | null;
}

export interface FristenListe {
  zeitraum: Zeitraum;
  /** Zeitraum im Klartext, z. B. „in den nächsten 7 Tagen (bis Fr, 23.10.2026)“ */
  label: string;
  von: ISODate | "";
  bis: ISODate;
  /** nur kritische Fristen (Notfrist oder nicht verlängerbar) gezählt und gelistet */
  nurKritisch: boolean;
  /** Anzahl der Fristen (Notfristen und Fristen) im Zeitraum – Wiedervorlagen, Vorfristen und Termine zählen nicht */
  anzahl: number;
  /** davon überfällig (bei „heute“, „kalenderwoche“ und „kommend“) */
  ueberfaellig: number;
  /** davon Notfristen */
  notfristen: number;
  /** davon kritisch: Notfrist oder gesetzlich nicht verlängerbar (z. B. § 4 KSchG, StPO, OWiG) */
  kritisch: number;
  /** Wiedervorlagen im Zeitraum – getrennt genannt, nicht in `anzahl` */
  wiedervorlagen: number;
  /** Vorfristen im Zeitraum – Erinnerungen, nicht in `anzahl` */
  vorfristen: number;
  /** Termine im Zeitraum – nicht in `anzahl` */
  termine: number;
  /** die dringendsten Fristen (höchstens 12) */
  eintraege: FristEintrag[];
  /** nicht aufgeführte weitere Fristen */
  weitere: number;
  /** die nächsten Wiedervorlagen (höchstens 5) */
  wiedervorlagenEintraege: FristEintrag[];
  /** die nächsten Termine (höchstens 3) */
  termineEintraege: FristEintrag[];
  /** die nächsten Vorfristen (höchstens 3) */
  vorfristenEintraege: FristEintrag[];
}

function zeitraumGrenzen(zeitraum: Zeitraum, heute: ISODate): { von: ISODate | ""; bis: ISODate; label: string } {
  const bisText = (d: ISODate) => fmtDateWd(d);
  switch (zeitraum) {
    case "heute": return { von: "", bis: heute, label: "heute" };
    case "morgen": return { von: addDays(heute, 1), bis: addDays(heute, 1), label: "morgen" };
    case "kalenderwoche": return { von: "", bis: wochenende(heute), label: `diese Woche (bis ${bisText(wochenende(heute))})` };
    case "naechste_woche": {
      const mo = addDays(wochenbeginn(heute), 7);
      return { von: mo, bis: addDays(mo, 6), label: `nächste Woche (${bisText(mo)} bis ${bisText(addDays(mo, 6))})` };
    }
    case "monat": return { von: addDays(heute, 1), bis: addDays(heute, 30), label: `in den nächsten 30 Tagen (bis ${bisText(addDays(heute, 30))})` };
    case "kommend": return { von: "", bis: "9999-12-31", label: "als Nächstes" };
    default: return { von: addDays(heute, 1), bis: addDays(heute, FENSTER_TAGE), label: `in den nächsten 7 Tagen (bis ${bisText(addDays(heute, FENSTER_TAGE))})` };
  }
}

/** Fristen eines Zeitraums – mit derselben Zählweise wie Cockpit, Seitenleiste und Fristenkalender (fristenLage). */
export function fristenListe(d: TenantData, zeitraum: Zeitraum, heute: string, nurFuer?: string, opts: { nurKritisch?: boolean } = {}): FristenListe {
  const g = zeitraumGrenzen(zeitraum, heute);
  const lage = fristenLage(d.fristen, heute, nurFuer);
  const z = fristenImZeitraum(d.fristen, g.von, g.bis, nurFuer);
  // „heute“ und „nächste 7 Tage“ exakt wie fristenLage (Badge, Cockpit, Fristen-Kennzahlen)
  let fristen = zeitraum === "heute" ? lage.faellig : zeitraum === "woche" ? lage.woche : z.fristen;
  const wiedervorlagen = zeitraum === "heute" ? lage.wiedervorlagen : zeitraum === "woche" ? lage.wiedervorlagenWoche : z.wiedervorlagen;
  const vorfristen = zeitraum === "heute" ? lage.vorfristen : z.vorfristen;
  const termine = zeitraum === "heute" ? fristenImZeitraum(d.fristen, heute, heute, nurFuer).termine : zeitraum === "kalenderwoche" || zeitraum === "kommend" ? z.termine.filter((f) => f.datum >= heute) : z.termine;
  if (opts.nurKritisch) fristen = fristen.filter(istKritisch);
  const eintrag = (f: Frist): FristEintrag => {
    const a = d.akten.find((x) => x.id === f.akteId);
    return { titel: f.titel, typ: f.typ, art: artZusatz(f), kritisch: istKritisch(f), datum: fmtDateWd(f.datum), relativ: relDays(f.datum, heute), dringlichkeit: fristDringlichkeit(f.datum, heute), akte: a ? `${a.aktenzeichen} ${a.titel}` : "", grundlage: f.grundlage ?? null };
  };
  const eintraege = fristen.slice(0, 12).map(eintrag);
  return {
    zeitraum,
    label: g.label,
    von: g.von,
    bis: g.bis,
    nurKritisch: !!opts.nurKritisch,
    anzahl: fristen.length,
    ueberfaellig: fristen.filter((f) => f.datum < heute).length,
    notfristen: fristen.filter((f) => f.typ === "notfrist").length,
    kritisch: fristen.filter(istKritisch).length,
    wiedervorlagen: wiedervorlagen.length,
    vorfristen: vorfristen.length,
    termine: termine.length,
    eintraege,
    weitere: Math.max(0, fristen.length - eintraege.length),
    wiedervorlagenEintraege: wiedervorlagen.slice(0, 5).map(eintrag),
    termineEintraege: termine.slice(0, 3).map(eintrag),
    vorfristenEintraege: vorfristen.slice(0, 3).map(eintrag),
  };
}

/**
 * Link-Vertrag zum Fristenrechner: /fristen?rechner=1&regel=<regelKey>&ereignis=<YYYY-MM-DD>&akte=<akteId>&herkunft=<Text>.
 * `ereignis` leer → der Rechner fragt das Datum ab (nie still „heute“, I3-T18-02). `herkunft` im Dativ („der Frage an den
 * Apex Assistenten“) – der Rechenweg nennt dann „Ereignisdatum aus der Frage an den Apex Assistenten übernommen“.
 */
export function fristenrechnerLink(regelKey: string, ereignis?: string, akteId?: string, herkunft?: string): string {
  const p = new URLSearchParams({ rechner: "1", regel: regelKey });
  if (ereignis) p.set("ereignis", ereignis);
  if (akteId) p.set("akte", akteId);
  if (ereignis && herkunft) p.set("herkunft", herkunft);
  return `/fristen?${p.toString()}`;
}

// ───────────── Argumentationshilfe zu einer Entscheidung der Fall-Datenbank ─────────────

/**
 * Argumentationsbausteine zu den Leitentscheidungen des Demo-Auszugs (kuratiert). Für andere Entscheidungen
 * entstehen die Bausteine aus Leitsatz, Bedeutung und Normen.
 */
const ARGUMENTATION: Record<string, string[]> = {
  "bag-2azr541-09": [
    "Kein Freibrief, aber Abwägung: Auch ein Bagatelldelikt kann an sich ein wichtiger Grund sein – entscheidend ist die Interessenabwägung im Einzelfall (§ 626 Abs. 1 BGB).",
    "Vertrauenskapital betonen: Eine lange, beanstandungsfreie Beschäftigung ist als erworbenes Vertrauen zu gewichten; ein einmaliger Vorfall mit geringem Schaden zehrt es nicht ohne Weiteres auf.",
    "Abmahnung als milderes Mittel: Ist eine Verhaltensänderung zu erwarten, genügt regelmäßig eine Abmahnung (Ultima-Ratio-Prinzip).",
    "Konkret vortragen: Dauer der Beschäftigung, fehlende Abmahnungen, Höhe des Schadens und Umstände der Tat (z. B. Duldung durch Vorgesetzte).",
  ],
  "bag-2azr133-18": [
    "Für die Arbeitgeberseite günstig: Aufnahmen einer rechtmäßigen offenen Videoüberwachung dürfen auch nach längerer Zeit verwertet werden.",
    "Verteidigung: Rechtmäßigkeit der Überwachung bestreiten – Hinweisschilder, Zweckbindung, Beteiligung des Betriebsrats (§ 87 Abs. 1 Nr. 6 BetrVG).",
    "Der Verwertung im Prozess ausdrücklich widersprechen, wenn die Überwachung rechtswidrig war.",
  ],
  "bag-2azr681-16": [
    "Beruht der Vorwurf auf verdeckter Überwachung ohne konkreten Verdacht, besteht ein Beweisverwertungsverbot.",
    "Der Verwertung frühzeitig widersprechen und die Anlasslosigkeit der Überwachung darlegen.",
  ],
  "bag-1abr22-21": [
    "Die Pflicht zur Arbeitszeiterfassung stützt Auskunfts- und Vorlageansprüche zu den Arbeitszeiten.",
    "Achtung: An der Darlegungslast im Überstundenprozess ändert sie nach der Rechtsprechung des BAG nichts – Stunden nach Tagen und Uhrzeiten aufstellen und Anordnung oder Duldung vortragen.",
  ],
  "bag-9azr423-16": [
    "Urlaub verfällt nur, wenn die Arbeitgeberin konkret zur Urlaubnahme aufgefordert und auf den Verfall hingewiesen hat – das muss sie beweisen.",
    "Bei Beendigung des Arbeitsverhältnisses Abgeltung des Resturlaubs (§ 7 Abs. 4 BUrlG) mitverlangen – auch im Abfindungsvergleich regeln.",
  ],
  "bgh-viiizr185-14": [
    "Unrenovierte Übergabe darlegen und beweisen (Übergabeprotokoll, Fotos, Zeugen) – die Beweislast trägt die Mieterseite.",
    "Fehlenden angemessenen Ausgleich vortragen (kein Mietnachlass, keine Renovierung durch die Vermieterin).",
    "Folge: Die Renovierungsklausel ist unwirksam – Schadensersatz wegen unterlassener Schönheitsreparaturen und eine Aufrechnung gegen die Kaution entfallen.",
  ],
  "bgh-viiizr242-13": [
    "Verlangt die Vermieterin anteilige Renovierungskosten aufgrund einer Quotenabgeltungsklausel, ist die Klausel unwirksam (§ 307 BGB).",
    "Gemeinsam mit VIII ZR 185/14 vortragen, wenn Renovierungs- und Quotenklausel kombiniert sind.",
  ],
  "bgh-viiizr180-18": [
    "Härtegründe substantiiert vortragen und mit ärztlichen Attesten belegen.",
    "Ein Sachverständigengutachten beantragen – das Gericht muss gesundheitliche Härten besonders sorgfältig aufklären.",
  ],
  "bgh-vizr53-09": [
    "Die Gleichwertigkeit der freien Werkstatt muss der Schädiger darlegen und beweisen.",
    "Unzumutbar ist der Verweis regelmäßig bei Fahrzeugen bis drei Jahre oder durchgehender Wartung in der Markenwerkstatt – Alter und Scheckheft belegen.",
  ],
  "bgh-vizr233-17": [
    "Dashcam-Aufnahmen sind trotz datenschutzrechtlicher Bedenken im Unfallprozess verwertbar – maßgeblich ist die Interessenabwägung.",
    "Aufnahme sichern (Originaldatei, Metadaten) und den Unfallhergang anhand der Standbilder konkret darstellen.",
  ],
  "bgh-vizr398-02": [
    "Bei fiktiver Abrechnung dürfen die Stundenverrechnungssätze einer markengebundenen Fachwerkstatt laut Gutachten zugrunde gelegt werden.",
    "Grenzen beachten: Ein Verweis auf eine gleichwertige freie Werkstatt ist möglich (vgl. VI ZR 53/09).",
  ],
  "bgh-iiizr183-17": [
    "Der Nutzungsvertrag geht im Wege der Gesamtrechtsnachfolge auf die Erben über (§ 1922 Abs. 1 BGB) – einschließlich der Kommunikationsinhalte.",
    "Weder das postmortale Persönlichkeitsrecht noch das Fernmeldegeheimnis oder der Datenschutz stehen dem Zugang entgegen.",
    "Erbschein vorlegen und dem Betreiber eine Frist zur Freischaltung setzen.",
  ],
  "bverfg-2bvr1616-18": [
    "Frühzeitig Zugang zu Rohmessdaten, Eichschein und Lebensakte des Messgeräts bei der Bußgeldbehörde beantragen.",
    "Bei Ablehnung gerichtliche Entscheidung beantragen (§ 62 OWiG) – der Anspruch folgt aus dem Recht auf ein faires Verfahren.",
  ],
  "bgh-xiizb601-15": [
    "Maßstab ist allein das Kindeswohl (§ 1697a BGB) – nicht der Wunsch nach Gleichverteilung zwischen den Eltern.",
    "Ein Wechselmodell setzt eine tragfähige Kommunikation und Kooperation der Eltern voraus; hohe Konfliktbelastung spricht dagegen.",
  ],
  "eugh-c65-09": [
    "Im Rahmen der Nacherfüllung muss der Verkäufer auch Ausbau der mangelhaften und Einbau der Ersatzsache leisten oder die Kosten tragen – heute § 439 Abs. 3 BGB.",
    "Voraussetzung: Die Käuferin hat die Sache gemäß ihrer Art und ihrem Verwendungszweck eingebaut.",
  ],
  "bgh-viizr46-17": [
    "Im Werkvertragsrecht kann der Besteller den Schaden nicht nach fiktiven Mängelbeseitigungskosten bemessen.",
    "Für die Unternehmerseite: Eine Aufrechnung mit fiktiven Mängelbeseitigungskosten zurückweisen. Für die Bestellerseite: Vorschuss (§ 637 Abs. 3 BGB), Minderwert oder tatsächliche Kosten verlangen.",
  ],
  "eugh-c311-18": [
    "Bei Datenübermittlungen in die USA oder andere Drittländer die Rechtsgrundlage prüfen: Angemessenheitsbeschluss (z. B. Zertifizierung des Anbieters nach dem EU-US Data Privacy Framework) oder Standardvertragsklauseln mit ergänzenden Maßnahmen.",
    "In der AVV Unterauftragsverarbeiter, Speicherorte und Zugriffsmöglichkeiten offenlegen lassen.",
  ],
};

/** Entscheidung über ihr Aktenzeichen im Text („2 AZR 541/09“, „VIII ZR 185/14“, „C-55/18“). */
export function findeEntscheidung(text: string): (typeof ENTSCHEIDUNGEN)[number] | undefined {
  const n = ` ${normalize(text).replace(/\s+/g, " ")} `;
  const passt = (az: string) => new RegExp(`[^a-z0-9]${normalize(az).replace(/\s+/g, " ").replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&")}[^0-9]`).test(n);
  return ENTSCHEIDUNGEN.find((e) => e.az.split(/\s+und\s+/).some(passt));
}

/** Argumentationshilfe: Kernaussage, Bausteine, Normen und die Akten der Kanzlei, zu denen die Entscheidung passt. */
export function argumentationshilfe(e: (typeof ENTSCHEIDUNGEN)[number], d: TenantData, fuerAkte?: Akte) {
  const geheftet = d.akten.filter((a) => a.entscheidungen?.includes(e.id));
  const passend = d.akten
    .filter((a) => a.status === "offen" && !geheftet.includes(a))
    .map((a) => ({ a, t: findePraezedenzfaelle(a, d, 5).find((x) => x.entscheidung.id === e.id) }))
    .filter((x): x is { a: Akte; t: NonNullable<typeof x.t> } => !!x.t)
    .sort((x, y) => y.t.score - x.t.score);
  const akten = [
    ...(fuerAkte && !geheftet.includes(fuerAkte) && !passend.some((p) => p.a.id === fuerAkte.id) ? [{ akte: fuerAkte, geheftet: false, gemeinsam: bewertePraezedenz(fuerAkte, d, e).gemeinsam }] : []),
    ...geheftet.map((a) => ({ akte: a, geheftet: true, gemeinsam: bewertePraezedenz(a, d, e).gemeinsam })),
    ...passend.map((p) => ({ akte: p.a, geheftet: false, gemeinsam: p.t.gemeinsam })),
  ];
  if (fuerAkte) akten.sort((x, y) => Number(y.akte.id === fuerAkte.id) - Number(x.akte.id === fuerAkte.id));
  const bausteine = ARGUMENTATION[e.id] ?? [`Kernaussage für den Schriftsatz nutzen: ${e.leitsatz}`, `Praxis: ${e.bedeutung}`];
  return {
    zitat: `${e.gericht}, ${e.art === "Urteil" ? "Urt." : "Beschl."} v. ${fmtDate(e.datum)} – ${e.az}`,
    titel: e.titel,
    leitsatz: e.leitsatz,
    bedeutung: e.bedeutung,
    normen: e.normen,
    bausteine,
    akten: akten.slice(0, 3).map((x) => ({ aktenzeichen: x.akte.aktenzeichen, titel: x.akte.titel, id: x.akte.id, geheftet: x.geheftet, gemeinsam: x.gemeinsam.slice(0, 3) })),
  };
}

/** Füllwörter, die im lockeren Rückfall der Rechtsprechungssuche nicht zählen. */
const RECHTSPRECHUNG_STOP = new Set(tokenize("wegen über sowie einer eines einem gegen ohne durch nach unter zwischen"));

function alleWerkzeuge(ctx: Kontext): AgentTool[] {
  const land = ctx.sitzung.tenant.bundesland;
  const t = (name: string) => {
    if (!ctx.werkzeuge.includes(name)) ctx.werkzeuge.push(name);
  };
  return [
    {
      name: "suche_akten",
      description: "Durchsucht die Akten der Kanzlei (Aktenzeichen, Titel, Mandant, Sachverhalt). Gibt bis zu 6 Treffer mit nächster Frist (Notfrist oder Frist) zurück.",
      inputSchema: { type: "object", properties: { suchbegriff: { type: "string" } }, required: ["suchbegriff"] },
      execute: (i) => {
        t("suche_akten");
        const d = daten();
        const hits = search(d.akten, String(i.suchbegriff ?? ""), [
          { get: (a) => a.aktenzeichen, weight: 4 }, { get: (a) => a.titel, weight: 3 }, { get: (a) => mandantName(d, a), weight: 2 },
          { get: (a) => a.beschreibung, weight: 1 }, { get: (a) => a.schlagworte.join(" "), weight: 1 },
        ], 6);
        hits.slice(0, 3).forEach((h) => ctx.links.push({ label: `Akte ${h.item.aktenzeichen}`, to: `/akten/${h.item.id}` }));
        return hits.map(({ item: a }) => {
          const f = naechsteFrist(a.id);
          return { aktenzeichen: a.aktenzeichen, titel: a.titel, sachgebiet: a.sachgebiet, phase: a.phase, status: a.status, naechsteFrist: f ? `${f.titel} am ${fmtDateWd(f.datum)}` : null };
        });
      },
    },
    {
      name: "akte_details",
      description: "Liest eine Akte über ihr Aktenzeichen (z. B. '142/26' oder '142'): Sachverhalt, Beteiligte, offene Fristen (Notfristen und Fristen), getrennt davon Wiedervorlagen und Termine, Dokumente.",
      inputSchema: { type: "object", properties: { aktenzeichen: { type: "string" } }, required: ["aktenzeichen"] },
      execute: (i) => {
        const a = findeAkteNachAz(String(i.aktenzeichen ?? ""));
        if (!a) throw new Error(`Eine Akte „${String(i.aktenzeichen ?? "")}“ gibt es in dieser Kanzlei nicht.`);
        t("akte_details");
        const d = daten();
        ctx.links.push({ label: `Akte ${a.aktenzeichen} öffnen`, to: `/akten/${a.id}` });
        return {
          aktenzeichen: a.aktenzeichen, titel: a.titel, sachgebiet: a.sachgebiet, phase: a.phase, gegenstandswert: fmtEUR(a.gegenstandswert),
          mandant: mandantName(d, a), gegner: d.kontakte.find((k) => k.id === a.gegnerId)?.name,
          gericht: d.kontakte.find((k) => k.id === a.gerichtId)?.name, gerichtsAz: a.gerichtsAz, sachverhalt: a.beschreibung,
          offeneFristen: d.fristen.filter((f) => f.akteId === a.id && f.status === "offen" && zaehltAlsFrist(f)).sort((x, y) => x.datum.localeCompare(y.datum)).map((f) => `${f.titel}${istKritisch(f) ? ` (${artZusatz(f)})` : ""} – ${fmtDateWd(f.datum)} (${relDays(f.datum)})`),
          wiedervorlagenUndTermine: d.fristen.filter((f) => f.akteId === a.id && f.status === "offen" && (f.typ === "wiedervorlage" || f.typ === "termin")).sort((x, y) => x.datum.localeCompare(y.datum)).map((f) => `${TYP_NAME[f.typ]}: ${f.titel.replace(/^(Wiedervorlage|Termin):\s*/i, "")} – ${fmtDateWd(f.datum)}${f.uhrzeit ? `, ${f.uhrzeit} Uhr` : ""} (${relDays(f.datum)})`),
          dokumente: d.dokumente.filter((x) => x.akteId === a.id).slice(0, 8).map((x) => x.name),
        };
      },
    },
    {
      name: "fristen_liste",
      description:
        "Zählt und listet offene Fristen der Kanzlei. Zeiträume: 'heute' (heute fällig inklusive überfälliger), 'morgen', 'woche' (die nächsten 7 Tage nach heute – gleitend), 'kalenderwoche' (diese Woche Mo–So bis Sonntag, inklusive überfälliger – für „diese Woche“), 'naechste_woche' (Mo–So der Folgewoche), 'monat' (nächste 30 Tage), 'kommend' (alle offenen, für „als Nächstes“). Gezählt werden nur Notfristen und Fristen ('anzahl'); Wiedervorlagen, Vorfristen und Termine stehen getrennt in eigenen Feldern und sind keine Fristen. 'nurKritisch' beschränkt auf Notfristen und gesetzlich nicht verlängerbare Fristen (z. B. § 4 KSchG, Einspruch nach StPO/OWiG). Nenne immer die Gesamtzahl aus 'anzahl'; 'eintraege' enthält nur die dringendsten (max. 12).",
      inputSchema: { type: "object", properties: { zeitraum: { type: "string", enum: ZEITRAEUME }, nurMeine: { type: "boolean" }, nurKritisch: { type: "boolean" } }, required: ["zeitraum"] },
      execute: (i) => {
        t("fristen_liste");
        const z = ZEITRAEUME.find((x) => x === i.zeitraum) ?? "woche";
        ctx.links.push({ label: "Fristenkalender öffnen", to: i.nurKritisch ? "/fristen?filter=kritisch" : "/fristen" });
        return fristenListe(daten(), z, today(), i.nurMeine ? ctx.sitzung.user.id : undefined, { nurKritisch: !!i.nurKritisch });
      },
    },
    {
      name: "frist_berechnen",
      description: "Berechnet eine gesetzliche Frist deterministisch nach §§ 187, 188 BGB und § 222 ZPO inklusive Wochenenden und Feiertagen des Bundeslands. Gibt Fristende, Vorfrist und Rechenweg zurück.",
      inputSchema: {
        type: "object",
        properties: {
          regel: { type: "string", enum: FRIST_REGELN.map((r) => r.key), description: `Fristregel: ${FRIST_REGELN.map((r) => `${r.key}=${r.titel}`).join("; ")}` },
          ereignisDatum: { type: "string", description: "Datum des fristauslösenden Ereignisses (Zustellung, Zugang), Format YYYY-MM-DD" },
          aktenzeichen: { type: "string", description: "Optional: Aktenzeichen der Akte, für die die Frist gilt (z. B. 142/26)" },
        },
        required: ["regel", "ereignisDatum"],
      },
      execute: (i) => {
        t("frist_berechnen");
        const ereignis = String(i.ereignisDatum).slice(0, 10);
        const akte = i.aktenzeichen ? findeAkteNachAz(String(i.aktenzeichen)) : undefined;
        // Feiertage am Gerichtsort laut Akte (§ 222 Abs. 2 ZPO) – wie Fristenrechner und „Frist anlegen“; sonst Kanzleisitz
        const gerichtsort = gerichtsortDerAkte(akte, daten().kontakte);
        const r = berechneNachRegel(String(i.regel), ereignis, gerichtsort?.land ?? land, undefined, {
          feiertagsOrt: gerichtsort ? `${gerichtsort.gericht} – laut Akte` : "Kanzleisitz",
          kanzleiLand: land,
        });
        ctx.links.push({ label: "Im Fristenrechner öffnen", to: fristenrechnerLink(r.regel.key, ereignis, akte?.id, "der Frage an den Apex Assistenten") });
        return { frist: r.regel.titel, grundlage: r.regel.grundlage, fristende: fmtDateWd(r.ende), vorfrist: fmtDateWd(r.vorfrist), verschoben: r.verschoben, feiertageNach: r.feiertagsOrt, rechenweg: r.rechenweg, hinweise: r.warnungen, akte: akte ? `${akte.aktenzeichen} ${akte.titel}` : null };
      },
    },
    {
      name: "frist_anlegen",
      description:
        "Bereitet eine Frist, Wiedervorlage oder einen Termin für eine Akte vor. Es wird NICHTS eingetragen: Die Person sieht eine Bestätigungskarte (Akte, Titel, Datum mit Wochentag) und trägt mit „Eintragen“ ein – danach gibt es „Rückgängig“. Als Titel den Auftragstext verwenden (z. B. „Zeugen Seifert benennen“), nicht nur „Wiedervorlage“ – fehlt er, vorher nachfragen. In „auftrag“ den Wortlaut der Bitte übergeben. Nur aufrufen, wenn die Person das ausdrücklich möchte.",
      inputSchema: {
        type: "object",
        properties: { aktenzeichen: { type: "string", description: "Aktenzeichen oder Name (Mandant/Titel)" }, titel: { type: "string" }, datum: { type: "string", description: "YYYY-MM-DD" }, typ: { type: "string", enum: ["frist", "wiedervorlage", "termin", "notfrist"] }, uhrzeit: { type: "string", description: "Optional HH:MM (Termine)" }, auftrag: { type: "string", description: "Wortlaut der Bitte der Person (für das Protokoll)" } },
        required: ["aktenzeichen", "titel", "datum"],
      },
      execute: (i) => {
        const roh = String(i.aktenzeichen ?? "");
        const kandidaten = akteKandidaten(roh);
        if (kandidaten.length > 1) {
          ctx.auswahl = auswahlFuer(kandidaten, (a) => `${TYP_NAME[(String(i.typ ?? "wiedervorlage") as FristTyp)] ?? "Wiedervorlage"} für Akte ${a.aktenzeichen} am ${fmtDate(String(i.datum).slice(0, 10))}: ${String(i.titel)}`);
          return { mehrdeutig: true, treffer: kandidaten.slice(0, 6).map((a) => `${a.aktenzeichen} ${a.titel}`), hinweis: "Mehrere Akten passen – die Person wählt per Knopf. Nichts vorbereitet." };
        }
        const a = kandidaten[0] ?? findeAkteNachAz(roh);
        if (!a) throw new Error(`Eine Akte „${roh}“ gibt es in dieser Kanzlei nicht.`);
        t("frist_anlegen");
        const datum = String(i.datum).slice(0, 10);
        const typ = (["frist", "wiedervorlage", "termin", "notfrist"].includes(String(i.typ)) ? String(i.typ) : "wiedervorlage") as VorschlagArt;
        ctx.vorschlag = { id: uid("vs"), art: typ, akteId: a.id, aktenzeichen: a.aktenzeichen, akteTitel: a.titel, titel: String(i.titel).trim() || TYP_NAME[typ as FristTyp], datum, uhrzeit: i.uhrzeit ? String(i.uhrzeit).slice(0, 5) : undefined, auftrag: String(i.auftrag ?? "").trim() || String(i.titel) };
        // Doppelungsprüfung wie im Frist-Dialog (I4-T20-01): gleicher Tag, gleiche Art, offen
        const doppel = doppelterEintrag(ctx.vorschlag, daten().fristen);
        if (doppel) ctx.vorschlag.doppelt = { fristId: doppel.frist.id, titel: doppel.frist.titel, hinweis: doppel.hinweis };
        const p = pruefeDatum(datum, land);
        return {
          status: "zur_bestaetigung",
          hinweis: doppel ? "Noch nicht eingetragen – am selben Tag liegt schon ein gleichartiger Eintrag; die Person entscheidet mit „Trotzdem eintragen“ in der Karte." : "Noch nicht eingetragen – die Person bestätigt mit „Eintragen“ in der Karte unter Ihrer Antwort.",
          akte: `${a.aktenzeichen} ${a.titel}`, titel: ctx.vorschlag.titel, datum: fmtDateWd(datum), werktag: p.werktag, vorschlagNaechsterWerktag: p.naechster ? fmtDateWd(p.naechster) : null,
          doppelung: doppel ? doppel.hinweis : null,
        };
      },
    },
    {
      name: "notiz_anlegen",
      description: "Bereitet eine Notiz zu einer Akte vor. Es wird NICHTS gespeichert, bis die Person in der Bestätigungskarte „Eintragen“ wählt.",
      inputSchema: { type: "object", properties: { aktenzeichen: { type: "string" }, text: { type: "string" } }, required: ["aktenzeichen", "text"] },
      execute: (i) => {
        const roh = String(i.aktenzeichen ?? "");
        const kandidaten = akteKandidaten(roh);
        if (kandidaten.length > 1) {
          ctx.auswahl = auswahlFuer(kandidaten, (a) => `Notiz zu Akte ${a.aktenzeichen}: ${String(i.text)}`);
          return { mehrdeutig: true, treffer: kandidaten.slice(0, 6).map((a) => `${a.aktenzeichen} ${a.titel}`) };
        }
        const a = kandidaten[0] ?? findeAkteNachAz(roh);
        if (!a) throw new Error(`Eine Akte „${roh}“ gibt es in dieser Kanzlei nicht.`);
        t("notiz_anlegen");
        const text = String(i.text ?? "").trim();
        ctx.vorschlag = { id: uid("vs"), art: "notiz", akteId: a.id, aktenzeichen: a.aktenzeichen, akteTitel: a.titel, titel: "Notiz", text, auftrag: text };
        return { status: "zur_bestaetigung", akte: `${a.aktenzeichen} ${a.titel}`, text };
      },
    },
    {
      name: "rvg_berechnen",
      description: "Berechnet RVG-Gebühren nach der Tabelle 2025 inklusive Anrechnung, Auslagenpauschale und 19 % USt. Außergerichtlich: 2300; Klageverfahren: 3100 und 3104.",
      inputSchema: {
        type: "object",
        properties: {
          gegenstandswert: { type: "number", description: "Gegenstandswert in Euro" },
          positionen: { type: "array", items: { type: "string", enum: VV_KATALOG.map((v) => v.nr) }, description: `VV-Nummern: ${VV_KATALOG.map((v) => `${v.nr} ${v.titel}`).join("; ")}` },
        },
        required: ["gegenstandswert", "positionen"],
      },
      execute: (i) => {
        t("rvg_berechnen");
        const pos = (Array.isArray(i.positionen) ? i.positionen : ["2300"]).map((nr) => ({ nr: String(nr) }));
        const r = berechneRvg({ positionen: pos, gegenstandswert: Number(i.gegenstandswert) || 0 });
        ctx.links.push({ label: "RVG-Rechner öffnen", to: "/abrechnung?tab=rvg" });
        // Auslagenpauschale Nr. 7002 je Angelegenheit (z. B. außergerichtlich und gerichtlich getrennt)
        const zeilen = r.angelegenheiten.flatMap((a) => [
          ...a.zeilen.map((z) => `${z.nr} ${z.titel} ${String(Math.abs(z.satz)).replace(".", ",")}: ${fmtEUR(z.betrag)}`),
          ...(a.auslagenpauschale > 0 ? [`7002 Auslagenpauschale${r.angelegenheiten.length > 1 ? ` (${a.titel})` : ""}: ${fmtEUR(a.auslagenpauschale)}`] : []),
        ]);
        return { zeilen, auslagenpauschale: fmtEUR(r.auslagenpauschale), netto: fmtEUR(r.netto), ust: fmtEUR(r.ust), brutto: fmtEUR(r.brutto) };
      },
    },
    {
      name: "rechtsprechung_suchen",
      description: "Sucht passende Entscheidungen in der Fall-Datenbank (nur diese dürfen zitiert werden).",
      inputSchema: { type: "object", properties: { suchbegriffe: { type: "string" } }, required: ["suchbegriffe"] },
      execute: (i) => {
        t("rechtsprechung_suchen");
        const q = String(i.suchbegriffe ?? "");
        // Ein genanntes Aktenzeichen ist eindeutig – dann nur diese Entscheidung, keine fachfremden Beifänge
        const exakt = findeEntscheidung(q);
        let hits = exakt ? [{ item: exakt, score: 100 }] : search(ENTSCHEIDUNGEN, q, [{ get: (e) => e.az, weight: 4 }, { get: (e) => e.titel, weight: 3 }, { get: (e) => e.schlagworte.join(" "), weight: 2 }, { get: (e) => e.leitsatz, weight: 1 }], 4);
        // Mindestrelevanz: deutlich schwächere Treffer als der beste nicht zeigen
        if (!exakt && hits.length) hits = hits.filter((h) => h.score >= hits[0].score * 0.5);
        if (!hits.length) {
          // lockerer Rückfall: Anteil der Suchwörter, die vorkommen – schwächere Treffer als der beste werden nicht gezeigt
          const toks = tokenize(q).filter((x) => x.length >= 4 && !RECHTSPRECHUNG_STOP.has(x));
          const bewertet = ENTSCHEIDUNGEN.map((e) => ({ item: e, score: toks.filter((x) => normalize(`${e.titel} ${e.schlagworte.join(" ")} ${e.leitsatz}`).includes(x)).length }))
            .filter((h) => h.score > 0).sort((a, b) => b.score - a.score);
          const top = bewertet[0]?.score ?? 0;
          hits = bewertet.filter((h) => h.score >= Math.max(1, top * 0.6)).slice(0, 4);
        }
        hits.slice(0, 2).forEach((h) => ctx.links.push({ label: `${h.item.gericht} ${h.item.az}`, to: `/fall-datenbank?id=${h.item.id}` }));
        return hits.map(({ item: e }) => ({ zitat: `${e.gericht}, ${e.art === "Urteil" ? "Urt." : "Beschl."} v. ${fmtDate(e.datum)} – ${e.az}`, titel: e.titel, rechtsgebiet: e.rechtsgebiet, leitsatz: e.leitsatz, bedeutung: e.bedeutung, normen: e.normen }));
      },
    },
    {
      name: "entscheidung_erlaeutern",
      description: "Erläutert eine Entscheidung der Fall-Datenbank für die eigene Argumentation: Kernaussage, Normen, Argumentationsbausteine und die Akten der Kanzlei, zu denen sie passt. Für Fragen wie „Wie nutze ich 2 AZR 541/09 in meiner Argumentation?“.",
      inputSchema: {
        type: "object",
        properties: { aktenzeichen: { type: "string", description: "Aktenzeichen der Entscheidung, z. B. '2 AZR 541/09'" }, akte: { type: "string", description: "Optional: Aktenzeichen der eigenen Akte, z. B. '142/26'" } },
        required: ["aktenzeichen"],
      },
      execute: (i) => {
        const e = findeEntscheidung(String(i.aktenzeichen ?? ""));
        if (!e) throw new Error(`Die Entscheidung „${String(i.aktenzeichen ?? "")}“ ist nicht im Demo-Bestand der Fall-Datenbank.`);
        t("entscheidung_erlaeutern");
        const fuer = i.akte ? findeAkteNachAz(String(i.akte)) : undefined;
        const h = argumentationshilfe(e, daten(), fuer);
        ctx.links.push({ label: `${e.gericht} ${e.az}`, to: `/fall-datenbank?id=${e.id}` });
        const erste = h.akten[0];
        if (erste) ctx.links.push({ label: `Akte ${erste.aktenzeichen}`, to: `/akten/${erste.id}` }, { label: `KI-Fallanalyse ${erste.aktenzeichen}`, to: `/ki?akte=${erste.id}` });
        return h;
      },
    },
    {
      name: "navigiere",
      description: "Öffnet einen Bereich der App (z. B. Fristen, Posteingang, Abrechnung, Bankabgleich, Fristenrechner, Einstellungen) oder eine Akte über ihr Aktenzeichen.",
      inputSchema: { type: "object", properties: { ziel: { type: "string", description: `Bereich (${BEREICHE.map((b) => b.label).join(", ")}) oder Aktenzeichen wie 142/26` } }, required: ["ziel"] },
      execute: (i) => {
        const ziel = String(i.ziel ?? "");
        const b = findeBereich(ziel);
        if (b) {
          t("navigiere");
          ctx.nav(b.to);
          return { geoeffnet: b.label, beschreibung: ansprechText(b.beschreibung, ctx.sitzung.tenant.ansprechpartner) };
        }
        const name = ziel.replace(/^(die\s+)?akte\s+/i, "");
        const kandidaten = akteKandidaten(name);
        if (kandidaten.length > 1) {
          // Mehrdeutig: nie still eine Akte öffnen – Auswahl anbieten (Chip „Akten durchsucht“, nicht „Bereich geöffnet“)
          t("suche_akten");
          ctx.auswahl = auswahlFuer(kandidaten, (a) => `Öffne die Akte ${a.aktenzeichen}`);
          return { mehrdeutig: true, suchbegriff: name, treffer: kandidaten.slice(0, 6).map((a) => `${a.aktenzeichen} ${a.titel}`), hinweis: "Mehrere Akten passen – die Person wählt per Knopf. Keine Akte geöffnet." };
        }
        const a = kandidaten[0] ?? findeAkteNachAz(name);
        if (a) {
          t("navigiere");
          ctx.nav(`/akten/${a.id}`);
          return { geoeffnet: `Akte ${a.aktenzeichen}`, titel: a.titel };
        }
        throw new Error(`„${ziel}“ habe ich weder als Bereich noch als Akte gefunden.`);
      },
    },
    {
      name: "hilfe_artikel",
      description: "Durchsucht das AnwaltApex-Wiki (Bedienung der Software, Funktionen, Support). Für jede Frage zur Benutzung der Software verwenden. Liefert nur sichere Treffer – bei leerer Liste ehrlich nachfragen statt zu raten.",
      inputSchema: { type: "object", properties: { frage: { type: "string" } }, required: ["frage"] },
      execute: (i) => {
        t("hilfe_artikel");
        const list = wikiSuche(String(i.frage ?? ""), ctx.sitzung.tenant.ansprechpartner).map((x) => x.w);
        list.slice(0, 1).forEach((w) => w.pfad && ctx.links.push({ label: `Zu „${w.titel}“`, to: w.pfad }));
        return list.map((w) => ({ titel: w.titel, kurz: w.kurz, schritte: w.schritte.map((s) => `${s.titel}: ${s.text}`), tipps: w.tipps ?? [] }));
      },
    },
    {
      name: "ansprechpartner",
      description: "Gibt die feste Ansprechperson der Kanzlei bei AnwaltApex zurück (Name, Bezeichnung „Ansprechpartnerin“/„Ansprechpartner“, Telefon, E-Mail, Erreichbarkeit).",
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        t("ansprechpartner");
        ctx.links.push({ label: "Hilfe & Support", to: "/hilfe" });
        const ap = ctx.sitzung.tenant.ansprechpartner;
        const jetzt = new Date();
        const erreichbar = inServicezeit(jetzt, ap.verfuegbar, ctx.sitzung.tenant.bundesland);
        return {
          ...ap,
          bezeichnung: ansprechBezeichnung(ap),
          anrede: festeAnsprechBezeichnung(ap),
          erreichbar,
          wiederErreichbar: erreichbar ? undefined : naechsteServicezeit(jetzt, ap.verfuegbar, ctx.sitzung.tenant.bundesland).text,
          hinweis: erreichbar ? undefined : "Außerhalb der Servicezeit nicht erreichbar – nie „direkt erreichbar“ sagen. Bei einer heute ablaufenden Frist auf die Ersatzeinreichung (§ 130d S. 2, 3 ZPO; § 46g S. 3, 4 ArbGG) und die Wissenskarte „beA-Störung – was tun?“ verweisen.",
        };
      },
    },
    {
      name: "rueckruf_anfordern",
      description: "Fordert einen Rückruf der festen Ansprechperson der Kanzlei an (Eskalation an einen Menschen).",
      inputSchema: { type: "object", properties: { thema: { type: "string" } }, required: ["thema"] },
      execute: (i) => {
        t("rueckruf_anfordern");
        const ap = ctx.sitzung.tenant.ansprechpartner;
        const jetzt = new Date();
        const z = rueckrufZusage(jetzt, ap.verfuegbar, ctx.sitzung.tenant.bundesland);
        useData.getState().log({ akteur: "nutzer", userId: ctx.sitzung.user.id, text: `Rückruf bei ${ap.name} angefordert (${z.text}) ${RUECKRUF_SIMULIERT}: ${String(i.thema)}` });
        const spaeter = rueckrufNachFristende(z, jetzt);
        return {
          ok: true,
          ansprechpartner: ap.name,
          durchwahl: ap.telefon,
          zusage: z.text,
          regel: z.ausserhalb ? rueckrufRegel(ap.verfuegbar) : undefined,
          erstNachHeute: spaeter,
          hinweis: `Im Prototyp simuliert – es ruft niemand an. Bitte immer „${RUECKRUF_SIMULIERT}“ dazusagen.${spaeter ? " Der Rückruf kommt erst nach heute 24 Uhr: Läuft heute eine Frist ab, auf die Ersatzeinreichung und die Wissenskarte „beA-Störung – was tun?“ verweisen." : ""}`,
        };
      },
    },
    {
      name: "posteingang_status",
      description: "Zeigt neue Nachrichten im Posteingang (beA & E-Mail) inkl. KI-Status – gleiche Zählweise wie das Cockpit.",
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        t("posteingang_status");
        const p = posteingangZahlen(daten().nachrichten);
        ctx.links.push({ label: "Posteingang öffnen", to: "/posteingang" });
        return {
          neu: p.neu.length,
          ausgewertet: p.kiFertig,
          wartenAufKi: p.wartetAufKi,
          eeb: p.eeb,
          nachrichten: p.neu.slice(0, 6).map((n) => ({ kanal: n.kanal === "bea" ? "beA" : "E-Mail", von: n.von, betreff: n.betreff })),
        };
      },
    },
    {
      name: "finanzen_status",
      description: "Finanzen der Kanzlei wie im Cockpit: offene Forderungen (Restbetrag brutto offener Rechnungen), davon überfällig, Fremdgeld zur Weiterleitung (§ 43a Abs. 7 BRAO) und nicht zugeordnete Kontoumsätze.",
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        t("finanzen_status");
        const d = daten();
        const f = finanzZahlen(d.rechnungen, d.buchungen, d.transaktionen, today());
        const az = (id: string) => d.akten.find((a) => a.id === id)?.aktenzeichen ?? "";
        ctx.links.push({ label: "Abrechnung öffnen", to: "/abrechnung" });
        return {
          offen: fmtEUR(f.offen), offenAnzahl: f.offenAnzahl, ueberfaellig: fmtEUR(f.ueberfaellig), ueberfaelligAnzahl: f.ueberfaelligAnzahl,
          fremdgeld: fmtEUR(f.fremdgeld), fremdgeldAkten: f.fremdgeldJeAkte.map((x) => `${az(x.akteId)}: ${fmtEUR(x.betrag)}`),
          bankOffen: f.bankOffen, amLaengstenUeberfaellig: f.aelteste.map((r) => `${r.nummer} (${az(r.akteId)}): ${fmtEUR(r.betrag)}, seit ${r.tage} ${r.tage === 1 ? "Tag" : "Tagen"} überfällig`),
        };
      },
    },
    {
      name: "motor_status",
      description: "Bilanz des 38h-Motors wie in Apex Island und Cockpit: automatisch gesparte Stunden der letzten 7 Tage, seit Montag und der Wert als Rechenbeispiel (interne Personalkosten).",
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        t("motor_status");
        const m = motorZahlen(daten().aktivitaeten, today());
        ctx.links.push({ label: "38h-Motor öffnen", to: "/automatisierung" });
        return {
          stundenLetzte7Tage: fmtNum(m.stunden, 1), stundenSeitMontag: fmtNum(m.minutenSeitMontag / 60, 1), laeufeLetzte7Tage: m.laeufe,
          wertLetzte7Tage: fmtEUR(m.euro, { cents: false }), wertProStunde: fmtEUR(WERT_PRO_STUNDE), hinweis: "Wert = Rechenbeispiel mit internen Personalkosten, keine Umsatzgarantie",
        };
      },
    },
    {
      name: "akten_status",
      description: "Aktenbestand wie auf der Seite „Akten“: offene Akten (davon hohe Priorität), ruhende, abgeschlossene, neu seit Montag und Akten mit Frist ≤ 7 Tage.",
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        t("akten_status");
        const d = daten();
        ctx.links.push({ label: "Akten öffnen", to: "/akten" });
        return aktenZahlen(d.akten, d.fristen, today());
      },
    },
  ];
}

const FRAGEWORTE = new Set(["wie", "was", "wo", "wann", "warum", "funktioniert", "funktionieren", "geht", "kann", "ich", "man", "mache", "machen", "erklaer", "erklaere", "erkläre", "bitte", "mir", "zeig", "zeige", "gibt", "es", "eine", "einen", "richtig"]);

/** Wörter, die in der Wiki-Suche nichts unterscheiden (Fragewörter, Hilfsverben, Pronomen, Füllwörter). */
const WIKI_STOP = new Set(tokenize(
  "wie was wo wann warum wer welche welcher welches welchen wieso weshalb funktioniert funktionieren geht gehen kann koennen können konnte muss müssen soll sollen sollte darf dürfen mache machen macht tun tue " +
  "ich man mir mich mein meine meinen meinem meiner wir uns unser unsere unseren ihr ihre ihnen bitte mal noch schon auch nur gibt gib es eine einen einem einer eines der die das den dem des " +
  "und oder zu zum zur im in am an auf aus bei mit von vom für über richtig erklär erkläre erklaere erklaer zeig zeige viele viel habe haben hat hast sind ist bin sein hier dort jetzt gerade heute " +
  "dort damit dazu etwas so ganz genau eigentlich überhaupt denn mal kurz software anwaltapex apex-software",
));

export interface WikiTreffer {
  w: WikiArtikel;
  score: number;
}

/**
 * Wiki-Suche mit Stoppwörtern und Mindestscore: Ein Artikel gilt nur als Antwort, wenn mindestens 60 % der
 * aussagekräftigen Suchwörter vorkommen und mindestens ein Treffer in Titel oder Stichworten liegt bzw. mehrere im Kurztext.
 * Ohne sicheren Treffer: leere Liste – der Assistent fragt dann ehrlich nach, statt einen fachfremden Artikel zu zeigen.
 */
export function wikiSuche(frage: string, ap?: Ansprechpartner): WikiTreffer[] {
  const WIKI = wikiFuer(ap);
  const toks = [...new Set(tokenize(frage).filter((t) => !WIKI_STOP.has(t) && t.length >= 2))];
  if (!toks.length) return [];
  const passt = (t: string, woerter: Set<string>) => {
    if (woerter.has(t)) return true;
    for (const w of woerter) if ((t.length >= 4 && w.startsWith(t)) || (w.length >= 5 && t.startsWith(w))) return true;
    return false;
  };
  return WIKI.map((w) => {
    const kopf = new Set(tokenize(`${w.titel} ${w.key.replace(/-/g, " ")} ${(w.stichworte ?? []).join(" ")}`));
    const kurz = new Set(tokenize(w.kurz));
    const rest = new Set(tokenize(`${w.schritte.map((s) => `${s.titel} ${s.text}`).join(" ")} ${(w.tipps ?? []).join(" ")}`));
    let score = 0;
    let getroffen = 0;
    let imKopf = 0;
    for (const t of toks) {
      const p = passt(t, kopf) ? 4 : passt(t, kurz) ? 2 : passt(t, rest) ? 1 : 0;
      if (p) getroffen++;
      if (p === 4) imKopf++;
      score += p;
    }
    const sicher = getroffen / toks.length >= 0.6 && (imKopf > 0 || score >= 4);
    return { w, score: sicher ? score : 0 };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
}

export function systemPrompt(s: SessionInfo, voice: boolean): string {
  const ap = s.tenant.ansprechpartner;
  return `Du bist der „Apex Assistent“, der integrierte KI-Assistent der Kanzlei-Software AnwaltApex. Stellst du dich vor, sag „Ich bin der Apex Assistent“. Du sprichst mit ${s.user.name} (${s.user.titel}) von ${s.tenant.name} in ${s.tenant.stadt}. Sprich die Person förmlich an – Sie-Form und „${foermlicherName(s.user)}“, nie mit Vornamen. Heute ist ${fmtDateWd(today())}.
Du hilfst bei zwei Dingen: (1) Live-Support zur Bedienung von AnwaltApex (nutze dafür hilfe_artikel) und (2) Kanzleiarbeit mit den Daten der Kanzlei (Akten, Fristen, Posteingang, Finanzen, 38h-Motor, RVG, Rechtsprechung) über die Werkzeuge.
Regeln:
- Antworte auf Deutsch, knapp und freundlich, in 1–4 Sätzen oder einer kurzen Liste.${voice ? " Die Antwort wird vorgelesen: keine Tabellen, keine Markdown-Formatierung, Zahlen gut sprechbar." : " Leichtes Markdown (Fett, Listen) ist erlaubt."}
- Daten der Kanzlei immer über Werkzeuge abfragen – nie erfinden. Zahlen zu Posteingang, Finanzen, Fremdgeld, 38h-Motor und Akten nur aus posteingang_status, finanzen_status, motor_status und akten_status. Fristen ausschließlich mit frist_berechnen berechnen.
- „Fristen“ sind nur Notfristen und Fristen. Wiedervorlagen, Vorfristen und Termine nennst du getrennt und nie als Fristen, z. B. „Heute sind 2 Fristen fällig, dazu 1 Wiedervorlage und 1 Vorfrist.“ Nenne immer die Gesamtzahl aus fristen_liste (Feld „anzahl“); die Liste „eintraege“ kann gekürzt sein. Überfällige Fristen nennst du gesondert.
- „Diese Woche“ ist die Kalenderwoche bis Sonntag (zeitraum 'kalenderwoche'); gleitende Fenster heißen „nächste 7 Tage“ (zeitraum 'woche') bzw. „letzte 7 Tage“. Fragt jemand nach Notfristen, nicht verlängerbaren oder kritischen Fristen, nutze nurKritisch und sag ehrlich, ob echte Notfristen darunter sind (z. B. ist die Klagefrist nach § 4 KSchG keine Notfrist im Sinne der ZPO, aber nicht verlängerbar).
- Der Wert gesparter Zeit ist ein Rechenbeispiel mit internen Personalkosten – keine Umsatz- oder Erfolgsgarantie.
- Zitiere Rechtsprechung nur aus rechtsprechung_suchen oder entscheidung_erlaeutern. Fragt der Nutzer, wie er eine bestimmte Entscheidung nutzen kann, rufe entscheidung_erlaeutern auf und gib eine Argumentationshilfe (Kernaussage, Bausteine, passende Akte) – keine bloße Trefferliste.
- Schreibende Aktionen (frist_anlegen, notiz_anlegen) legen nur einen Vorschlag vor – eingetragen wird erst, wenn die Person in der Karte „Eintragen“ wählt. Sag deshalb nie „eingetragen“, sondern „Bitte bestätigen Sie …“. Fällt das Datum auf ein Wochenende oder einen Feiertag, nenne den nächsten Werktag als Vorschlag.
- Passen mehrere Akten (Werkzeug meldet „mehrdeutig“), öffne oder bearbeite keine davon: Sag, wie viele passen, und bitte um Auswahl – die Knöpfe erscheinen unter deiner Antwort.
- Kurze Antworten wie „Ja“, „Gerne“ oder „Nein“ beziehen sich auf deine letzte Rückfrage – führe dann genau das Angebotene aus.
- Findest du keine sichere Antwort (z. B. leere Wiki-Treffer), sag das ehrlich und frag nach, was genau gemeint ist.
- Wenn du nicht weiterkommst oder der Nutzer einen Menschen möchte: biete die feste Ansprechperson an und nutze rueckruf_anfordern. Formuliere ohne Pronomen für die Ansprechperson: „${festeAnsprechBezeichnung(ap)}: ${ap.name}“ und wiederhole bei Bedarf den Namen.
- Wenn der Nutzer einen Bereich sehen möchte, nutze navigiere.
- Rückrufe sind im Prototyp simuliert: nenne die Zusage mit Uhrzeit aus rueckruf_anfordern und immer den Zusatz „${RUECKRUF_SIMULIERT}“.
- Nenne bei Fragen nach der Ansprechperson und bei Rückruf- oder Störungsantworten immer die Durchwahl (Feld „telefon“ bzw. „durchwahl“), auch außerhalb der Servicezeit; bei einer Zusage außerhalb der Servicezeit auch die „regel“.
- Meldet ansprechpartner „erreichbar: false“, sag ehrlich, dass die Ansprechperson jetzt nicht erreichbar ist, und nenne „wiederErreichbar“. Läuft heute eine Frist ab, verweise auf die Ersatzeinreichung (§ 130d S. 2, 3 ZPO; § 46g S. 3, 4 ArbGG) und die Wissenskarte „beA-Störung – was tun?“ – erfinde keine Notfallnummer.
- Notfallwissen beA-Störung (verbindlich, bei Fragen nach gestörtem beA, Ersatzeinreichung oder technischer Unmöglichkeit – vor jeder Posteingangsabfrage):
${beaWissen(ap)}`;
}

/** Wissenskarte „beA-Störung – was tun?“ als Kontext für die Live-KI. */
function beaWissen(ap?: Ansprechpartner): string {
  const w = artikel("bea-stoerung", ap);
  if (!w) return "";
  return [`  ${w.kurz}`, ...w.schritte.map((x) => `  • ${x.titel}: ${x.text}`)].join("\n");
}

// ───────────── beA-Störung: Gerichtsbarkeit erkennen und Notfallantwort geben ─────────────

type Gerichtsbarkeit = "arbeit" | "zivil" | "verwaltung" | "sozial" | "finanz" | "straf";

const GERICHTSBARKEIT: [Gerichtsbarkeit, RegExp][] = [
  ["arbeit", /landesarbeitsgericht|arbeitsgericht|bundesarbeitsgericht|\blag\b|\barbg\b|\bbag\b|arbgg|arbeitsrecht/],
  ["verwaltung", /verwaltungsgericht|verwaltungsgerichtshof|\bvg\b|\bovg\b|\bvgh\b|bverwg|vwgo/],
  ["sozial", /sozialgericht|landessozialgericht|bundessozialgericht|\bsg\b|\blsg\b|\bbsg\b|\bsgg\b/],
  ["finanz", /finanzgericht|bundesfinanzhof|\bfg\b|\bbfh\b|\bfgo\b/],
  ["straf", /strafsache|strafgericht|strafkammer|staatsanwaltschaft|\bstpo\b|strafbefehl|revision in strafsachen/],
  ["zivil", /oberlandesgericht|landgericht|amtsgericht|bundesgerichtshof|\bolg\b|\blg\b|\bag\b|\bbgh\b|\bzpo\b|zivil|familiengericht|kammergericht/],
];

const NORM: Record<Gerichtsbarkeit, { erlaubt: string; glaubhaft: string; gerichte: string }> = {
  arbeit: { erlaubt: "§ 46g S. 3 ArbGG", glaubhaft: "§ 46g S. 4 ArbGG", gerichte: "Arbeitsgerichtsbarkeit (ArbG, LAG, BAG)" },
  zivil: { erlaubt: "§ 130d S. 2 ZPO", glaubhaft: "§ 130d S. 3 ZPO", gerichte: "Zivilgerichte (AG, LG, OLG, BGH)" },
  verwaltung: { erlaubt: "§ 55d S. 3 VwGO", glaubhaft: "§ 55d S. 4 VwGO", gerichte: "Verwaltungsgerichte (VG, OVG, BVerwG)" },
  sozial: { erlaubt: "§ 65d S. 3 SGG", glaubhaft: "§ 65d S. 4 SGG", gerichte: "Sozialgerichte (SG, LSG, BSG)" },
  finanz: { erlaubt: "§ 52d S. 3 FGO", glaubhaft: "§ 52d S. 4 FGO", gerichte: "Finanzgerichte (FG, BFH)" },
  straf: { erlaubt: "§ 32d S. 3 StPO", glaubhaft: "§ 32d S. 4 StPO", gerichte: "Strafsachen" },
};

const NORM_KURZ: Record<Gerichtsbarkeit, string> = {
  arbeit: "§ 46g S. 3, 4 ArbGG",
  zivil: "§ 130d S. 2, 3 ZPO",
  verwaltung: "§ 55d VwGO",
  sozial: "§ 65d SGG",
  finanz: "§ 52d FGO",
  straf: "§ 32d StPO",
};

export function gerichtsbarkeitAus(text: string): Gerichtsbarkeit | undefined {
  const t = normalize(text);
  return GERICHTSBARKEIT.find(([, re]) => re.test(t))?.[0];
}

const BEA_STOERUNG = /\bbea\b[^.?!]*(gest(o|oe)rt|st(o|oe)rung|geht nicht|funktioniert nicht|ausgefallen|nicht erreichbar|nicht moeglich|down|streikt|haengt)|st(o|oe)rung[^.?!]*\bbea\b|ersatzeinreichung|technischen? (gruenden|unmoeglichkeit|stoerung)|technische[nr]? unmoeglichkeit|130d|46g/;

export function istBeaStoerung(text: string): boolean {
  return BEA_STOERUNG.test(normalize(text));
}

/**
 * Notfallantwort zur beA-Störung – nach Gerichtsbarkeit, mit Normen, Ersatzeinreichung, Glaubhaftmachung und Dokumentation.
 * Die Ansprechperson nennt sie ehrlich nach Servicezeit (I4-T12-02): außerhalb „jetzt nicht erreichbar (wieder …) – warten Sie
 * nicht, reichen Sie jetzt ersatzweise ein“; keine erfundene Notfallnummer.
 */
export function beaStoerungAntwort(g: Gerichtsbarkeit | undefined, ap: Ansprechpartner, opts: { jetzt?: Date; land?: Bundesland } = {}): string {
  const jetzt = opts.jetzt ?? new Date();
  const land = opts.land ?? "BE";
  const erreichbar = inServicezeit(jetzt, ap.verfuegbar, land);
  const gb = g ?? "zivil";
  const n = NORM[gb];
  const ort = (() => {
    if (!g) return "";
    if (g === "arbeit") return " beim Arbeitsgericht bzw. Landesarbeitsgericht";
    if (g === "zivil") return " beim Zivilgericht (AG, LG, OLG, BGH)";
    return ` – ${n.gerichte}`;
  })();
  const kopf = g
    ? `**beA-Störung – Ersatzeinreichung${ort} (${NORM_KURZ[gb]}):**`
    : "**beA-Störung – Ersatzeinreichung (Zivilgerichte § 130d S. 2, 3 ZPO, Arbeitsgerichte § 46g S. 3, 4 ArbGG):**";
  const andere = g === "arbeit"
    ? "Für Zivilgerichte (AG, LG, OLG, BGH) gilt dasselbe nach § 130d S. 2, 3 ZPO"
    : g === "zivil"
      ? "Für die Arbeitsgerichtsbarkeit (ArbG, LAG, BAG) gilt dasselbe nach § 46g S. 3, 4 ArbGG"
      : g
        ? "Für Zivilgerichte gilt dasselbe nach § 130d S. 2, 3 ZPO, für Arbeitsgerichte nach § 46g S. 3, 4 ArbGG"
        : "Für welches Gericht gilt die Frist? Dann nenne ich die genaue Vorschrift";
  return [
    kopf,
    liste([
      `Ersatzeinreichung: Ist das beA vorübergehend aus technischen Gründen nicht nutzbar, bleibt die Einreichung nach den allgemeinen Vorschriften zulässig – per Telefax, auf Papier oder per Bote (${g ? n.erlaubt : "§ 130d S. 2 ZPO bzw. § 46g S. 3 ArbGG"}).`,
      `Glaubhaftmachung: Die vorübergehende Unmöglichkeit bei der Ersatzeinreichung oder unverzüglich danach glaubhaft machen – mit anwaltlicher Versicherung und einer geschlossenen Schilderung der Abläufe (${g ? n.glaubhaft : "§ 130d S. 3 ZPO bzw. § 46g S. 4 ArbGG"}).`,
      "Dokumentation: Störung sofort dokumentieren – Screenshot mit Uhrzeit, Fehlermeldung, Störungsmeldung der BRAK bzw. beA-Status, Uhrzeiten Ihrer Versuche.",
      "Auf Anforderung des Gerichts das elektronische Dokument nachreichen.",
      "Die Frist erst nach Sendebericht bzw. Eingangsbestätigung als erledigt markieren (Ausgangskontrolle).",
      erreichbar
        ? `${festeAnsprechBezeichnung(ap)} ${ap.name} anrufen: ${ap.telefon} (${ap.verfuegbar}) – prüft mit Ihnen den beA-Status.`
        : `${festeAnsprechBezeichnung(ap)} ${ap.name} ist jetzt nicht erreichbar (wieder ${naechsteServicezeit(jetzt, ap.verfuegbar, land).text}) – warten Sie nicht, reichen Sie jetzt ersatzweise ein.`,
    ]),
    `${andere}; entsprechend § 55d VwGO, § 65d SGG, § 52d FGO, § 32d StPO. Bitte im Einzelfall am Gesetzestext prüfen.`,
  ].join("\n");
}

// ───────────── Bestätigung vor dem Schreiben, Rückgängig ─────────────

/** Werktag? Sonst der nächste Werktag als Vorschlag (Wochenende, Feiertage des Bundeslands). */
export function pruefeDatum(datum: ISODate, land: Bundesland): { werktag: boolean; naechster?: ISODate } {
  if (istWerktag(datum, land)) return { werktag: true };
  let d = datum;
  for (let i = 0; i < 10 && !istWerktag(d, land); i++) d = addDays(d, 1);
  return { werktag: false, naechster: d };
}

const ART_NAME: Record<VorschlagArt, string> = { wiedervorlage: "Wiedervorlage", frist: "Frist", termin: "Termin", notfrist: "Notfrist", notiz: "Notiz" };

export function vorschlagArtName(v: Pick<SchreibVorschlag, "art">): string {
  return ART_NAME[v.art];
}

/** Trägt einen bestätigten Vorschlag ein (über useData) und protokolliert – Grundlage für „Rückgängig“. */
/** Gleichartige Einträge für die Doppelungsprüfung: Fristen und Notfristen zählen zusammen, Wiedervorlagen und Termine je für sich. */
function gleicheArt(a: FristTyp | VorschlagArt, b: FristTyp): boolean {
  const klasse = (t: string) => (t === "notfrist" ? "frist" : t);
  return klasse(a) === klasse(b);
}

const ART_MIT_ARTIKEL: Record<FristTyp, string> = { wiedervorlage: "eine Wiedervorlage", frist: "eine Frist", notfrist: "eine Notfrist", termin: "ein Termin", vorfrist: "eine Vorfrist" };

/**
 * Doppelungsprüfung für einen Vorschlag des Assistenten (I4-T20-01): offener Eintrag gleicher Art für dieselbe Akte am selben Tag.
 * Hinweis: „Für 137/26 liegt am Di, 20.10. schon eine Wiedervorlage: ‚Stellungnahme der Mandantin zur Replik einholen‘“.
 */
export function doppelterEintrag(v: Pick<SchreibVorschlag, "art" | "akteId" | "datum" | "aktenzeichen">, fristen: Frist[]): { frist: Frist; hinweis: string } | undefined {
  if (v.art === "notiz" || !v.datum) return undefined;
  const f = fristen.find((x) => x.status === "offen" && x.akteId === v.akteId && x.datum === v.datum && gleicheArt(v.art, x.typ));
  if (!f) return undefined;
  return { frist: f, hinweis: `Für ${v.aktenzeichen} liegt am ${tagKurz(v.datum)} schon ${ART_MIT_ARTIKEL[f.typ]}: ‚${f.titel}‘` };
}

export function vorschlagEintragen(v: SchreibVorschlag, s: SessionInfo): Eintragung {
  const st = useData.getState();
  if (!st.data.akten.some((a) => a.id === v.akteId)) throw new Error(`Die Akte ${v.aktenzeichen} gibt es nicht mehr.`);
  if (v.art === "notiz") {
    const n: Notiz = { id: uid("n"), akteId: v.akteId, userId: s.user.id, text: `${v.text ?? v.titel}\n— Vom Apex Assistenten angelegt (bestätigt)`, zeit: nowLocal() };
    st.upsert("notizen", n);
    st.log({ akteur: "nutzer", userId: s.user.id, akteId: v.akteId, text: `Notiz über den Apex Assistenten hinzugefügt – ${v.aktenzeichen}` });
    return { col: "notizen", id: n.id };
  }
  if (!v.datum || !/^\d{4}-\d{2}-\d{2}$/.test(v.datum)) throw new Error("Bitte geben Sie ein gültiges Datum an.");
  const f: Frist = {
    id: uid("f"), akteId: v.akteId, titel: v.titel, typ: v.art as FristTyp, datum: v.datum, uhrzeit: v.uhrzeit, status: "offen",
    verantwortlichId: s.user.id, quelle: "ki", createdAt: nowLocal(), notiz: `Vom Apex Assistenten angelegt – Auftrag: „${v.auftrag}“`,
  };
  st.upsert("fristen", f);
  const doppel = doppelterEintrag(v, st.data.fristen.filter((x) => x.id !== f.id));
  st.log({ akteur: "nutzer", userId: s.user.id, akteId: v.akteId, text: `${ART_NAME[v.art]} „${v.titel}“ für ${fmtDateWd(v.datum)} eingetragen (über den Apex Assistenten, bestätigt${doppel ? ", trotz gleichartigem Eintrag am selben Tag" : ""}) – ${v.aktenzeichen}` });
  return { col: "fristen", id: f.id };
}

/** Nimmt einen über den Assistenten eingetragenen Eintrag wieder heraus und protokolliert das. */
export function vorschlagZuruecknehmen(v: SchreibVorschlag, e: Eintragung, s: SessionInfo): boolean {
  const st = useData.getState();
  const da = (st.data[e.col] as { id: string }[]).some((x) => x.id === e.id);
  if (!da) return false;
  st.remove(e.col, e.id);
  st.log({ akteur: "nutzer", userId: s.user.id, akteId: v.akteId, text: `Rückgängig: ${ART_NAME[v.art]} „${v.titel}“${v.datum ? ` (${fmtDateWd(v.datum)})` : ""} wieder entfernt – ${v.aktenzeichen}` });
  return true;
}

/** Auftragstext aus der Bitte: nach einem Doppelpunkt, in Anführungszeichen oder nach „wegen/betreffend/zum Thema“. */
export function auftragAus(text: string): string | undefined {
  const t = text.trim().replace(/[.!?]+$/, "");
  const zitat = t.match(/[„"»']([^“"«']{3,160})[“"«']/)?.[1];
  if (zitat) return zitat.trim();
  const nachDoppelpunkt = t.includes(":") ? t.slice(t.lastIndexOf(":") + 1).trim() : "";
  if (nachDoppelpunkt.length >= 3 && !/^\d/.test(nachDoppelpunkt)) return nachDoppelpunkt;
  const wegen = t.match(/\b(?:wegen|betreffend|betreff|zum thema|thema|mit dem (?:titel|text)|mit (?:titel|text)|zwecks)\s+(.{3,160})$/i)?.[1];
  if (wegen) return wegen.replace(/\s+(an|eintragen|anlegen)$/i, "").trim();
  return undefined;
}

/** „ohne Titel“, „egal“ … als Antwort auf die Rückfrage nach dem Auftrag: Titel bleibt die Art („Wiedervorlage“). */
const OHNE_TITEL = /^(ohne( titel| auftrag| text)?|egal|keiner|kein(en)? titel|nichts|nix|einfach so)$/;

/**
 * Auftragstext ohne Doppelpunkt oder Anführungszeichen: nach einem Komma bzw. Gedankenstrich
 * („… in drei Tagen an, Zeugen Seifert benennen“) oder als „um … zu …“.
 */
export function auftragAusNachsatz(text: string): string | undefined {
  const t = text.trim().replace(/[.!?]+$/, "");
  const um = t.match(/\bum\s+(.{3,120}?)\s+zu\s+([a-zäöüß]+)$/i);
  if (um) return `${um[1].charAt(0).toUpperCase()}${um[1].slice(1)} ${um[2]}`;
  const teile = t.split(/\s*[,;]\s+|\s+[–—-]\s+/);
  if (teile.length < 2) return undefined;
  const rest = teile[teile.length - 1].trim();
  if (rest.length < 3 || datumAus(rest) || azAus(rest)) return undefined;
  if (/\b(wiedervorlage|frist|notfrist|termin|notiz|akte|an|ein|anlegen|eintragen|bitte)$/i.test(rest) || /^(bitte|danke)\b/i.test(rest)) return undefined;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

// ───────────── Kanzleikürzel und Kurzformen (I3-T20-01, I3-T20-02) ─────────────

/**
 * Kanzleikürzel ausschreiben, damit die Absichtserkennung sie versteht: „WV“, „Wv.“, „Wiedervorl.“ → „Wiedervorlage“,
 * „Az. 137“ → „Akte 137“, „Fr. 142 …“ (am Anfang, vor einer Nummer) → „Frist 142 …“, „eeb“ → „eEB“, „kschg“ → „KSchG“.
 * „Fr.“ mitten im Satz bleibt unangetastet (Frau, Freitag).
 */
export function kuerzelNormal(text: string): string {
  return text
    .trim()
    .replace(/(^|[\s(„"])(?:wv|wiedervorl)\.?(?=[\s,:;)“"]|$)/gi, "$1Wiedervorlage")
    .replace(/(^|[\s(])az\.?\s*(?=\d)/gi, "$1Akte ")
    .replace(/^fr\.?\s+(?=\d)/i, "Frist ")
    .replace(/\beebs?\b/gi, (m) => (m.toLowerCase() === "eebs" ? "eEBs" : "eEB"))
    .replace(/\bkschg\b/gi, "KSchG")
    .replace(/\s+/g, " ");
}

const KURZ_DATUM = /(?<![a-zäöüß\d])(?:(?:am|zum|bis)\s+)?(?:in\s+(?:\d+|einer|einem|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn|vierzehn)\s+(?:tagen|tag|wochen|woche)|übermorgen|uebermorgen|morgen|heute|(?:nächste|naechste|kommende)n?\s+woche|\d{1,2}\.\s?\d{1,2}\.(?:\s?\d{2,4})?)(?![a-zäöüß\d])\.?/i;

/**
 * Kurzbefehl im Stil einer Kanzlei-Notiz („Wiedervorlage 137 in 3 tagen zeugenliste prüfen“, „Frist 142 morgen …“) in die
 * ausgeschriebene Bitte übersetzen („Lege eine Wiedervorlage für Akte 137 in 3 tagen an: Zeugenliste prüfen“). Nur mit
 * Aktenbezug – „Wiedervorlagen heute“ bleibt eine Abfrage. Eingetragen wird weiter erst nach „Eintragen“.
 */
export function kurzbefehlAlsBitte(text: string): string | undefined {
  const t = kuerzelNormal(text).replace(/[.!]+$/, "");
  const m = t.match(/^(wiedervorlage|notfrist|frist|termin)\b[\s:,-]*(?:für\s+|fuer\s+)?(.*)$/i);
  if (!m || /\?$/.test(t)) return undefined;
  let rest = m[2];
  const az = azAus(rest);
  if (!az) return undefined;
  // Aktenbezug („Akte 137“, „137/26“, „137“) und Datumsangabe aus dem Rest lösen – was übrig bleibt, ist der Auftrag
  rest = rest.replace(new RegExp(`(?:\\bakte\\s+)?\\b${az.replace("/", "\\s?/\\s?")}(?:\\s?/\\s?\\d{2})?\\b`, "i"), " ");
  const datum = rest.match(KURZ_DATUM)?.[0];
  if (datum) rest = rest.replace(datum, " ");
  let auftrag = rest.replace(/^[\s,:;–-]+|[\s,:;–-]+$/g, "").replace(/\s+/g, " ");
  // In Großbuchstaben getippt („ZEUGEN LADEN“): als normaler Titel übernehmen
  if (auftrag.length > 3 && auftrag === auftrag.toUpperCase() && /[A-ZÄÖÜ]/.test(auftrag)) auftrag = auftrag.toLowerCase();
  const art = m[1].toLowerCase();
  const name = art === "wiedervorlage" ? "eine Wiedervorlage" : art === "notfrist" ? "eine Notfrist" : art === "frist" ? "eine Frist" : "einen Termin";
  const titel = auftrag ? `: ${auftrag.charAt(0).toUpperCase()}${auftrag.slice(1)}` : "";
  return `Lege ${name} für Akte ${az}${datum ? ` ${datum.trim()}` : ""} an${titel}`;
}

/** Kurzform einer Aktensuche: „akte müller“, „Az. Weber“ oder nur ein Name („müller“) – ohne Verb und ohne Zahl. */
function aktenKurzform(text: string): string | undefined {
  const k = kurzform(kuerzelNormal(text));
  const mitAkte = k.match(/^akte\s+([a-zäöüß][a-zäöüß .'-]{1,60})$/)?.[1];
  if (mitAkte) return mitAkte.trim();
  if (/^[a-zäöüß][a-zäöüß'-]{2,30}( [a-zäöüß][a-zäöüß'-]{2,30})?$/.test(k) && akteKandidaten(k).length > 0) return k;
  return undefined;
}

// ───────────── Offline-Assistent (Demo-Modus) ─────────────

const MONATE: Record<string, number> = { januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12 };

function datumAus(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/\bheute\b/.test(t)) return today();
  if (/\bvorgestern\b/.test(t)) return addDays(today(), -2);
  if (/\bgestern\b/.test(t)) return addDays(today(), -1);
  // \b kennt ohne u-Flag keine Umlaute („übermorgen“ am Satzanfang oder nach einer Zahl) – daher eigene Wortgrenzen
  if (/(?<![a-zäöüß])(übermorgen|uebermorgen)(?![a-zäöüß])/.test(t)) return addDays(today(), 2);
  if (/(?<![a-zäöüß])morgen(?![a-zäöüß])/.test(t)) return addDays(today(), 1);
  // „nächste Woche“ / „kommende Woche“: Montag der nächsten Woche (Werktagsprüfung folgt in der Bestätigungskarte)
  if (/\b(nächste|naechste|kommende)n? woche\b/.test(t)) {
    const wd = weekday(today());
    return addDays(today(), wd === 0 ? 1 : 8 - wd);
  }
  const inTagen = t.match(/in (\d+|einer|einem|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|vierzehn) (tag|tagen|woche|wochen)/);
  if (inTagen) {
    const z: Record<string, number> = { einer: 1, einem: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, vierzehn: 14 };
    const n = /^\d+$/.test(inTagen[1]) ? Number(inTagen[1]) : z[inTagen[1]] ?? 1;
    return addDays(today(), inTagen[2].startsWith("woche") ? n * 7 : n);
  }
  const m = t.match(/(\d{1,2})\.\s?(\d{1,2})\.?\s?(\d{2,4})?/);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : Number(today().slice(0, 4));
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const m2 = t.match(/(\d{1,2})\.\s?(januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)/);
  if (m2) return `${today().slice(0, 4)}-${String(MONATE[m2[2]]).padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  return undefined;
}

function azAus(text: string): string | undefined {
  const mitAkte = text.match(/akte\s+(?:nr\.?\s*)?(\d{2,3}(?:\s?\/\s?\d{2})?)/i)?.[1];
  if (mitAkte) return mitAkte.replace(/\s/g, "");
  const voll = text.match(/\b\d{2,3}\s?\/\s?\d{2}\b/)?.[0];
  if (voll) return voll.replace(/\s/g, "");
  return text.match(/\b(\d{3})\b(?![.,]\d|\s?(?:€|euro|tage|wochen|%))/i)?.[1];
}

/** Wörter, die beim Erkennen einer Akte über den Namen nicht zählen. */
const AKTEN_STOP = new Set(tokenize(
  "chancen sache akte akten fallanalyse erfolgsaussicht erfolgsaussichten stehen gewinnen wiedervorlage frist fristen termin termine erinnerung lege leg trag trage eintragen erstelle setze setz anlegen tagen tage woche wochen monat heute morgen übermorgen drei zwei vier fünf sechs sieben zehn vierzehn bitte einen eine einer mandant mandantin mandanten wie was wann starte start analyse prüfe pruefe öffne oeffne zeige zeig details stand",
));

/** Akte aus dem Text: Aktenzeichen oder eindeutiger Name (Mandant/Titel). */
function akteAusText(text: string): Akte | undefined {
  const az = azAus(text);
  if (az) {
    const a = findeAkteNachAz(az);
    if (a) return a;
  }
  const kandidaten = akteKandidaten(text);
  if (kandidaten.length === 1) return kandidaten[0];
  if (kandidaten.length > 1) return undefined; // mehrdeutig – nie still eine Akte wählen
  const d = daten();
  const offen = d.akten.filter((a) => a.status !== "abgeschlossen");
  for (const tok of tokenize(text).filter((t) => t.length >= 4 && !AKTEN_STOP.has(t))) {
    const hits = search(offen, tok, [{ get: (a) => a.titel, weight: 3 }, { get: (a) => mandantName(d, a), weight: 3 }], 3);
    if (hits.length === 1 || (hits.length > 1 && hits[0].score > hits[1].score)) return hits[0].item;
  }
  return undefined;
}

/** Ein Aktenzeichen, das es in dieser Kanzlei wirklich gibt – für Beispiele in Antworten. */
function beispielAz(): string {
  const d = daten();
  const a = d.akten.find((x) => x.status === "offen" && x.prioritaet === "hoch") ?? d.akten.find((x) => x.status === "offen") ?? d.akten[0];
  return a?.aktenzeichen ?? "142/26";
}

function regelAus(text: string): string | undefined {
  const t = normalize(text);
  if (/berufungsbegrund/.test(t)) return "berufungsbegruendung";
  if (/revision/.test(t)) return "revision";
  if (/berufung/.test(t)) return /arbeitsgericht/.test(t) ? "berufung_arbg" : "berufung";
  if (/versaeumnisurteil/.test(t)) return "einspruch_vu";
  if (/strafbefehl/.test(t)) return "einspruch_strafbefehl";
  if (/bussgeld/.test(t)) return "einspruch_bussgeld";
  if (/mahnbescheid/.test(t)) return "widerspruch_mb";
  if (/vollstreckungsbescheid/.test(t)) return "einspruch_vb";
  if (/kuendigungsschutz|kschg|kuendigung/.test(t)) return "kschg_klage";
  if (/beschwerde/.test(t)) return "sofortige_beschwerde";
  if (/verjaehr/.test(t)) return "regelverjaehrung";
  if (/widerspruch/.test(t)) return "widerspruch_va";
  return undefined;
}

function liste(items: string[]): string {
  return items.map((x) => `• ${x}`).join("\n");
}

// ── Gesprächskontext: Rückfragen des Assistenten und kurze Antworten darauf ──

type Rueckfrage = "rueckruf" | "akte" | "datum" | "akte-analyse" | "titel";

const RUECKFRAGEN: [Rueckfrage, RegExp][] = [
  ["rueckruf", /soll ich einen rückruf (für dann )?anfordern\?/i],
  ["akte", /^für welche akte soll ich das eintragen\?/i],
  ["datum", /^zu welchem datum\?/i],
  ["akte-analyse", /^für welche akte soll ich die fallanalyse/i],
  ["titel", /^worum geht es bei der (wiedervorlage|frist|notfrist|termin)\b/i],
];

function rueckfrageIn(text: string | undefined): Rueckfrage | undefined {
  if (!text) return undefined;
  return RUECKFRAGEN.find(([, re]) => re.test(text.trim()))?.[0];
}

const ZUSTIMMUNG = /^(ja|jo|jep|jawohl|gern|gerne|bitte|ok|okay|klar|genau|einverstanden|unbedingt|auf jeden fall|mach das|mach mal|machen sie das|sehr gerne?|ja bitte|ja gerne|ja gern|bitte ja|ja klar|ja mach das|ja das waere toll|ja das wäre toll|ja bitte gerne)$/;
const ABLEHNUNG = /^(nein|nee|ne|nö|noe|nicht noetig|nicht nötig|lieber nicht|nein danke|danke nein|nein danke nicht noetig|kein bedarf|spaeter|später|jetzt nicht|nein jetzt nicht)$/;
const GRUSS = /^(hallo|hi|hey|moin|moin moin|servus|guten morgen|guten tag|guten abend|grüß gott|gruess gott|grüezi)\b[\s,!.]*/;
const DANK = /^(danke|danke schön|dankeschön|vielen dank|danke sehr|super danke|perfekt danke|prima danke|toll danke|klasse danke|danke dir|danke ihnen)$/;
const ABSCHIED = /^(tschüss|tschuess|ciao|bis bald|bis später|auf wiedersehen|bye)$/;

function kurzform(text: string): string {
  return text.toLowerCase().replace(/[!.?,;:„“"]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Antwortet der Nutzer auf eine Rückfrage nach fehlenden Angaben (Akte, Datum), wird die ursprüngliche Bitte mit den
 * Antworten zusammengeführt – z. B. „Lege eine Wiedervorlage an“ → „Für welche Akte …?“ → „142/26“.
 */
function zusammengefuehrt(verlauf: LlmMessage[]): string | undefined {
  let i = verlauf.length - 1;
  const teile = [verlauf[i]?.content ?? ""];
  let ergaenzt = false;
  while (i >= 2 && verlauf[i - 1].role === "assistant" && verlauf[i - 2].role === "user") {
    const r = rueckfrageIn(verlauf[i - 1].content);
    if (r !== "akte" && r !== "datum" && r !== "akte-analyse" && r !== "titel") break;
    // Antwort auf „Worum geht es …?“ ist der Auftragstext – als „Befehl: Auftrag“ anhängen, damit er zum Titel wird
    if (r === "titel") teile[0] = `${verlauf[i - 2].content.trim().replace(/[.!?]+$/, "")}: ${teile[0].trim()}`;
    else teile.unshift(verlauf[i - 2].content);
    ergaenzt = true;
    i -= 2;
  }
  return ergaenzt ? teile.join(" ") : undefined;
}

/** Vorschläge für den leeren Assistenten – aus den tatsächlichen Daten der Kanzlei (keine festen Aktenzeichen). */
export const VORSCHLAEGE = [
  "Was steht heute an?",
  "Welche Fristen laufen diese Woche ab?",
  "Berechne die Berufungsfrist bei Zustellung heute",
  "Wie lege ich eine neue Akte an?",
  "Urteile zu Kündigung wegen Bagatelle",
  "Wie funktioniert der Bankabgleich?",
  "RVG für 10.000 € außergerichtlich",
  "Ich möchte mit meinem Ansprechpartner sprechen",
];

/** „Ich möchte mit meiner Ansprechpartnerin sprechen“ bzw. „… mit meinem Ansprechpartner …“ – passend zur hinterlegten Person. */
export function ansprechBitte(ap?: Ansprechpartner): string {
  return ap && ansprechBezeichnung(ap) === "Ansprechpartnerin" ? "Ich möchte mit meiner Ansprechpartnerin sprechen" : "Ich möchte mit meinem Ansprechpartner sprechen";
}

export function vorschlaege(data: TenantData = daten(), ap?: Ansprechpartner): string[] {
  const offen = data.akten.filter((a) => a.status === "offen");
  const akte =
    offen.find((a) => a.id.startsWith("hero-") && a.prioritaet === "hoch") ??
    [...offen].filter((a) => a.prioritaet === "hoch").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ??
    [...offen].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return VORSCHLAEGE.map((v) => (v === "Wie lege ich eine neue Akte an?" && akte ? `Öffne die Akte ${akte.aktenzeichen}` : v === VORSCHLAEGE[7] ? ansprechBitte(ap) : v));
}

/** „Mo, 19.10.2026: Replik auf Klageerwiderung (nicht verlängerbar) – 137/26 Schneider ./. …“ */
function fristZeile(f: FristEintrag): string {
  const titel = f.typ === "wiedervorlage" || f.typ === "termin" ? f.titel.replace(/^(Wiedervorlage|Termin):\s*/i, "") : f.titel;
  return `${f.datum}: ${titel}${f.art ? ` (${f.art})` : ""}${f.akte ? ` – ${f.akte}` : ""}`;
}

/** „eine Wiedervorlage und eine Vorfrist“ – getrennt genannte Einträge (keine Fristen). */
function dazuText(l: Pick<FristenListe, "wiedervorlagen" | "vorfristen">, mitVorfristen = true): string {
  const teile = [l.wiedervorlagen ? anz(l.wiedervorlagen, "Wiedervorlage", "Wiedervorlagen") : "", mitVorfristen && l.vorfristen ? anz(l.vorfristen, "Vorfrist", "Vorfristen") : ""].filter(Boolean);
  return teile.join(" und ");
}

const gross = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Bedienfrage („Wie funktioniert …?“, „Wo finde ich …?“) – dann Wiki statt Zahlen. */
const BEDIENFRAGE = /\bwie (funktioniert|funktionieren|geht|gehe|kann|lege|richte|nutze|benutze|bediene|erstelle|mache|öffne|oeffne|finde|starte|stelle|ändere|aendere|trage|übernehme|uebernehme|schalte|rechne|berechne ich|erfasse|lade|exportiere|importiere|teile|lösche|loesche)\b|\bwo\b|erklär|erklaer|anleitung|schritt für schritt/;

/** Antwort auf Fristenfragen – mit derselben Zählweise wie Cockpit und Fristenkalender. */
async function fristenAntwort(q: string, run: (name: string, input?: Record<string, unknown>) => Promise<never>): Promise<string> {
  const nurKritisch = /notfrist|nicht verl(ä|ae)ngerbar|unverl(ä|ae)ngerbar|kritisch/.test(q);
  const nachNotfrist = /notfrist/.test(q) && !/nicht verl|unverl|kritisch/.test(q);
  const meine = /\b(meine|mich|mir)\b/.test(q);
  const zeitraum: Zeitraum = /\bheute\b|heutig/.test(q)
    ? "heute"
    : /\bmorgen\b/.test(q) && !/übermorgen|uebermorgen/.test(q)
      ? "morgen"
      : /(7|sieben) tage|n(ä|ae)chsten tage|kommenden tage/.test(q)
        ? "woche"
        : /(n(ä|ae)chste[nr]?|kommende[nr]?|folgende[nr]?) woche/.test(q)
          ? "naechste_woche"
          : /\bwoche\b|wochenende|bis (zum )?sonntag/.test(q)
            ? "kalenderwoche"
            : /monat|30 tage|dreißig tage|dreissig tage/.test(q)
              ? "monat"
              : nurKritisch || /als n(ä|ae)chstes|demn(ä|ae)chst|anstehen|stehen.*\ban\b|n(ä|ae)chste[n]? frist|bald/.test(q)
                ? "kommend"
                : "woche";
  const l = (await run("fristen_liste", { zeitraum, nurMeine: meine, nurKritisch })) as FristenListe;
  const fuer = meine ? " für Sie" : "";
  const top = l.eintraege.slice(0, 6);
  const rest = l.anzahl - top.length;
  const aufzaehlung = top.length ? `\n${liste(top.map(fristZeile))}${rest > 0 ? `\n… und ${rest} weitere.` : ""}` : "";

  // ── nur kritische Fristen (Notfrist oder gesetzlich nicht verlängerbar) ──
  if (nurKritisch) {
    const ehrlich = nachNotfrist && l.anzahl > 0 && l.notfristen === 0
      ? `Notfristen im Sinne der ZPO stehen${fuer} ${l.zeitraum === "kommend" ? "derzeit keine an" : `${l.label} keine an`}. Ebenso wenig verlängerbar – und genauso streng zu behandeln – ${l.anzahl === 1 ? "ist diese Frist" : `sind diese ${l.anzahl} Fristen`}:`
      : "";
    if (!l.anzahl) {
      let text = l.zeitraum === "kommend"
        ? `Derzeit ist${fuer} keine ${nachNotfrist ? "Notfrist und auch keine andere " : ""}nicht verlängerbare Frist offen.`
        : `${gross(l.label)} läuft${fuer} keine ${nachNotfrist ? "Notfrist und auch keine andere " : ""}nicht verlängerbare Frist ab.`;
      if (l.zeitraum !== "kommend") {
        const naechste = (await run("fristen_liste", { zeitraum: "kommend", nurMeine: meine, nurKritisch: true })) as FristenListe;
        const n = naechste.eintraege.find((e) => e.relativ !== "heute") ?? naechste.eintraege[0];
        if (n) text += ` Die nächste: ${fristZeile(n)} (${n.relativ}).`;
      }
      return text;
    }
    const kopf = ehrlich || (l.zeitraum === "kommend"
      ? `Als Nächstes ${l.anzahl === 1 ? "steht" : "stehen"}${fuer} ${anz(l.anzahl, "nicht verlängerbare Frist", "nicht verlängerbare Fristen")} an${l.notfristen ? `, darunter ${anz(l.notfristen, "Notfrist", "Notfristen")}` : ""}${l.ueberfaellig ? ` (davon ${l.ueberfaellig} überfällig)` : ""}:`
      : `${gross(l.label)} ${l.anzahl === 1 ? "läuft" : "laufen"}${fuer} ${anz(l.anzahl, "nicht verlängerbare Frist", "nicht verlängerbare Fristen")} ab${l.notfristen ? `, darunter ${anz(l.notfristen, "Notfrist", "Notfristen")}` : ""}${l.ueberfaellig ? ` (davon ${l.ueberfaellig} überfällig)` : ""}:`);
    const grundlagen = top.map((e) => (e.grundlage ? `${fristZeile(e)} · ${e.grundlage}` : fristZeile(e)));
    return `${kopf}\n${liste(grundlagen)}${rest > 0 ? `\n… und ${rest} weitere.` : ""}\nBei Versäumnis hilft nur Wiedereinsetzung bzw. nachträgliche Zulassung – diese Fristen bitte vorrangig erledigen.`;
  }

  // ── heute ──
  if (zeitraum === "heute") {
    const dazu = dazuText(l);
    let text = !l.anzahl
      ? `Heute ist${fuer} keine Frist fällig${dazu ? `, nur ${dazu}` : ""}.`
      : `Heute ${l.anzahl === 1 ? "ist" : "sind"}${fuer} ${anz(l.anzahl, "Frist", "Fristen")} fällig${l.ueberfaellig ? (l.ueberfaellig === l.anzahl ? (l.anzahl === 1 ? " (bereits überfällig)" : " (alle bereits überfällig)") : ` (davon ${l.ueberfaellig} überfällig)`) : ""}${dazu ? `, dazu ${dazu}` : ""}.`;
    if (top.length) text += aufzaehlung;
    const ohneArt = (e: FristEintrag) => fristZeile({ ...e, art: "" });
    if (l.wiedervorlagenEintraege.length) text += `\n${l.wiedervorlagen === 1 ? "Wiedervorlage" : "Wiedervorlagen"}:\n${liste(l.wiedervorlagenEintraege.slice(0, 3).map(ohneArt))}${l.wiedervorlagen > 3 ? `\n… und ${l.wiedervorlagen - 3} weitere.` : ""}`;
    if (l.vorfristenEintraege.length) text += `\n${l.vorfristen === 1 ? "Vorfrist" : "Vorfristen"} (Erinnerung):\n${liste(l.vorfristenEintraege.slice(0, 2).map((e) => ohneArt({ ...e, titel: e.titel.replace(/^Vorfrist:\s*/i, "") })))}`;
    if (l.termine) text += `\nAußerdem ${l.termine === 1 ? "steht heute ein Termin" : `stehen heute ${l.termine} Termine`} an: ${l.termineEintraege.map((t) => t.titel).join(", ")}.`;
    return text;
  }

  // ── Zeiträume ──
  const dazu = dazuText(l, false);
  let text = !l.anzahl
    ? `${gross(l.label)} ${l.zeitraum === "kalenderwoche" ? "ist" : "läuft"}${fuer} keine Frist ${l.zeitraum === "kalenderwoche" ? "mehr offen" : "ab"}${dazu ? `, nur ${dazu}` : ""}.`
    : `${gross(l.label)} ${l.zeitraum === "kalenderwoche" ? (l.anzahl === 1 ? "ist" : "sind") : l.anzahl === 1 ? "läuft" : "laufen"}${fuer} ${l.zeitraum === "kalenderwoche" ? "noch " : ""}${anz(l.anzahl, "Frist", "Fristen")} ${l.zeitraum === "kalenderwoche" ? "offen" : "ab"}${l.ueberfaellig ? ` (davon ${l.ueberfaellig} überfällig)` : ""}${l.kritisch ? `, darunter ${anz(l.kritisch, "nicht verlängerbare", "nicht verlängerbare", "eine")}` : ""}${dazu ? `, dazu ${dazu}` : ""}${top.length < l.anzahl ? ". Die dringendsten:" : ":"}${aufzaehlung}`;
  if (l.termine) text += `\nAußerdem ${l.termine === 1 ? "steht ein Termin" : `stehen ${l.termine} Termine`} an${l.termineEintraege[0] ? ` – zuerst ${l.termineEintraege[0].titel} am ${l.termineEintraege[0].datum}` : ""}.`;
  if (zeitraum === "woche") {
    const h = (await run("fristen_liste", { zeitraum: "heute", nurMeine: meine })) as FristenListe;
    if (h.anzahl) text += `\nDazu ${h.anzahl === 1 ? "kommt eine heute fällige Frist" : `kommen ${h.anzahl} heute fällige Fristen`}${h.ueberfaellig ? ` (davon ${h.ueberfaellig} überfällig)` : ""}.`;
  }
  // Endet die Kalenderwoche in den nächsten zwei Tagen, zusätzlich der Ausblick auf die nächsten 7 Tage
  if (zeitraum === "kalenderwoche" && l.bis <= addDays(today(), 2)) {
    const w = (await run("fristen_liste", { zeitraum: "woche", nurMeine: meine })) as FristenListe;
    if (w.anzahl || w.wiedervorlagen) {
      text += `\nAusblick ${w.label}: ${w.anzahl ? anz(w.anzahl, "Frist", "Fristen") : "keine Frist"}${w.kritisch ? ` (darunter ${anz(w.kritisch, "nicht verlängerbare", "nicht verlängerbare")})` : ""}${w.wiedervorlagen ? ` und ${anz(w.wiedervorlagen, "Wiedervorlage", "Wiedervorlagen")}` : ""}${w.eintraege[0] ? ` – als Nächstes ${fristZeile(w.eintraege[0])}` : ""}.`;
    }
  }
  return text;
}

/** Leitet die Frage auf Zahlen der Kanzlei (Posteingang, Finanzen, Fremdgeld, 38h-Motor, Akten) – oder `undefined`. */
async function kennzahlAntwort(q: string, run: (name: string, input?: Record<string, unknown>) => Promise<never>): Promise<string | undefined> {
  // ── Apex Island ──
  if (/apex[- ]?island|\bisland\b|schwarze kapsel/.test(q)) {
    const m = (await run("motor_status")) as { stundenLetzte7Tage: string };
    return `Die Apex Island ist die schwarze Kapsel oben in der Kopfleiste. Sie zeigt live, was der 38h-Motor gerade automatisch erledigt (z. B. „Vorfrist gesetzt“), und sonst die in den letzten 7 Tagen gesparte Zeit – aktuell ${m.stundenLetzte7Tage} Std. Ein Klick öffnet den 38h-Motor mit allen Automatiken.`;
  }
  // ── 38h-Motor: gesparte Zeit ──
  const erklaeren = /^(was|wie) (ist|sind|macht|bedeutet|funktioniert)\b(?! mit)/.test(q);
  if (/gespart|erspart|ersparnis|eingespart|zeitgewinn/.test(q) || (/38\s?h|motor|automati(on|sierung)/.test(q) && /wie viel|wieviel|wie viele|stunden|bilanz|was hat|erledigt/.test(q) && !erklaeren)) {
    const m = (await run("motor_status")) as { stundenLetzte7Tage: string; stundenSeitMontag: string; laeufeLetzte7Tage: number; wertLetzte7Tage: string; wertProStunde: string };
    const kw = /diese[rn]? woche|seit montag/.test(q);
    const basis = `In den letzten 7 Tagen hat der 38h-Motor ${m.stundenLetzte7Tage} Std. Arbeit automatisch erledigt (${fmtNum(m.laeufeLetzte7Tage)} Läufe) – so zeigt es auch die Apex Island.`;
    const wert = ` Bewertet mit internen Personalkosten von ${m.wertProStunde} je Stunde (Rechenbeispiel) entspricht das rund ${m.wertLetzte7Tage}.`;
    return kw ? `Diese Woche (seit Montag) sind es ${m.stundenSeitMontag} Std. ${basis}${wert}` : `${basis}${wert}`;
  }
  // ── Finanzen & Fremdgeld ──
  if (/fremdgeld|anderkonto/.test(q)) {
    const f = (await run("finanzen_status")) as { fremdgeld: string; fremdgeldAkten: string[] };
    if (!f.fremdgeldAkten.length) return "Derzeit liegt kein Fremdgeld zur Weiterleitung vor (§ 43a Abs. 7 BRAO).";
    return `Zur Weiterleitung liegen ${f.fremdgeld} Fremdgeld vor (§ 43a Abs. 7 BRAO: unverzüglich weiterleiten) – ${f.fremdgeldAkten.length === 1 ? `Akte ${f.fremdgeldAkten[0]}` : `in ${f.fremdgeldAkten.length} Akten: ${f.fremdgeldAkten.join(", ")}`}.`;
  }
  if (/forderung(?!skonto)|offene[nr]? (rechnung|posten|betr(ä|ae)ge)|au(ß|ss)enst(ä|ae)nde|unbezahlt|(ü|ue)berf(ä|ae)llige[nr]? rechnung|rechnungen offen|finanzen|zahlungseing|kontoums(ä|ae)tze|bankums(ä|ae)tze|wie viel geld|liquidit/.test(q)) {
    const f = (await run("finanzen_status")) as { offen: string; offenAnzahl: number; ueberfaellig: string; ueberfaelligAnzahl: number; fremdgeld: string; fremdgeldAkten: string[]; bankOffen: number; amLaengstenUeberfaellig: string[] };
    if (!f.offenAnzahl) return `Keine offenen Forderungen – alle gestellten Rechnungen sind bezahlt.${f.fremdgeldAkten.length ? ` Fremdgeld zur Weiterleitung: ${f.fremdgeld}.` : ""}`;
    return `Offene Forderungen: ${f.offen} aus ${anz(f.offenAnzahl, "Rechnung", "Rechnungen")}, davon ${f.ueberfaelligAnzahl ? `${f.ueberfaellig} überfällig (${anz(f.ueberfaelligAnzahl, "Rechnung", "Rechnungen")})` : "nichts überfällig"}.${f.amLaengstenUeberfaellig[0] ? ` Am längsten überfällig: ${f.amLaengstenUeberfaellig[0]}.` : ""}${f.fremdgeldAkten.length ? ` Dazu ${f.fremdgeld} Fremdgeld zur Weiterleitung.` : ""}${f.bankOffen ? ` ${f.bankOffen === 1 ? "Ein Kontoumsatz wartet" : `${f.bankOffen} Kontoumsätze warten`} auf den Bankabgleich.` : ""}`;
  }
  // ── Aktenbestand ──
  if (/wie ?viele (offene |laufende |aktive |neue )?(akten|mandate|f(ä|ae)lle|verfahren)|anzahl (der )?(akten|mandate)|aktenbestand|(akten|mandate) (haben|hat|habe) (wir|ich)|wie gro(ß|ss) ist (unser|der) bestand/.test(q)) {
    const a = (await run("akten_status")) as { offen: number; hoch: number; ruhend: number; abgeschlossen: number; neuSeitMontag: number; mitFrist: number; mitKritischerFrist: number };
    const weitere = [a.ruhend ? `${a.ruhend} ruhende` : "", a.abgeschlossen ? `${a.abgeschlossen} abgeschlossene` : ""].filter(Boolean).join(" und ");
    return `Sie haben ${anz(a.offen, "offene Akte", "offene Akten")} (davon ${a.hoch} mit hoher Priorität)${weitere ? `, dazu ${weitere}` : ""}. Neu seit Montag: ${a.neuSeitMontag}. Akten mit Frist ≤ 7 Tage: ${a.mitFrist}${a.mitKritischerFrist ? `, davon ${a.mitKritischerFrist} mit nicht verlängerbarer Frist` : ""}.`;
  }
  return undefined;
}

/** Heute ablaufende Fristen (Kanzlei) bzw. „Frist läuft heute ab“ in der Frage. */
function fristHeute(q: string): number {
  const genannt = /frist[^.?!]*heute|heute[^.?!]*frist|l(ä|ae)uft heute ab/.test(q.toLowerCase());
  const anzahl = fristenLage(daten().fristen, today()).heute.length;
  return genannt ? Math.max(1, anzahl) : anzahl;
}

/**
 * Hinweis bei einer heute ablaufenden Frist, wenn die Ansprechperson nicht mehr rechtzeitig zurückrufen kann:
 * nicht warten, sondern ersatzweise einreichen (§ 130d S. 2, 3 ZPO; § 46g S. 3, 4 ArbGG) – mit Wissenskarte.
 */
function fristHeuteSatz(ctx: Kontext, q: string, nurVerweis = false): string {
  const n = fristHeute(q);
  if (!n) return "";
  ctx.links.push({ label: "Wissenskarte beA-Störung", to: "/hilfe?wiki=bea-stoerung" });
  if (nurVerweis) return " Ist das beA gestört und läuft heute eine Frist ab: siehe Wissenskarte „beA-Störung – was tun?“.";
  return ` ${n === 1 ? "Heute läuft noch eine Frist ab" : `Heute laufen noch ${n} Fristen ab`} – warten Sie nicht auf den Rückruf: Ist das beA gestört, reichen Sie nach den allgemeinen Vorschriften ein (Ersatzeinreichung, § 130d S. 2, 3 ZPO; vor den Arbeitsgerichten § 46g S. 3, 4 ArbGG) und machen Sie die Störung glaubhaft – siehe Wissenskarte „beA-Störung – was tun?“.`;
}

/** Nachsatz zur Erreichbarkeit nach einer Rückrufanforderung – ehrlich außerhalb der Servicezeit. */
function erreichbarSatz(ctx: Kontext, ap: Ansprechpartner, erstNachHeute: boolean, q = ""): string {
  if (inServicezeit(new Date(), ap.verfuegbar, ctx.sitzung.tenant.bundesland)) return ` Direkt erreichbar unter der Durchwahl ${ap.telefon}.`;
  // Auch außerhalb der Servicezeit immer die Durchwahl nennen (I3-T20-03) – und die Rückrufregel, die die Zusage erklärt (I3-T12-04)
  return ` ${ap.name} ist jetzt nicht erreichbar – Durchwahl ${ap.telefon}, wieder erreichbar ${naechsteServicezeit(new Date(), ap.verfuegbar, ctx.sitzung.tenant.bundesland).text}. ${rueckrufRegel(ap.verfuegbar)}${erstNachHeute ? fristHeuteSatz(ctx, q) : ""}`;
}

async function demoAntwort(frage: string, ctx: Kontext, verlauf: LlmMessage[] = []): Promise<string> {
  const tools = Object.fromEntries(werkzeuge(ctx).map((t) => [t.name, t]));
  const run = async (name: string, input: Record<string, unknown> = {}) => tools[name].execute(input) as Promise<never> | never;
  await new Promise((r) => setTimeout(r, 450 + Math.random() * 400));
  const ap = ctx.sitzung.tenant.ansprechpartner;
  const apText = `${festeAnsprechBezeichnung(ap)}: ${ap.name}`;

  // ── Kanzleikürzel: „wv 137 in 3 tagen zeugenliste prüfen“ → ausgeschriebene Bitte (Bestätigungskarte wie gewohnt) ──
  const bitte = kurzbefehlAlsBitte(frage);
  if (bitte) {
    ctx.originalFrage ??= frage;
    return demoAntwort(bitte, ctx, []);
  }

  // ── Gesprächskontext ──
  const vorher = verlauf.length >= 2 && verlauf[verlauf.length - 2].role === "assistant" ? verlauf[verlauf.length - 2].content : undefined;
  const offeneRueckfrage = rueckfrageIn(vorher);
  const kurz = kurzform(frage);

  if (offeneRueckfrage === "rueckruf" && (ZUSTIMMUNG.test(kurz) || (/^(ja|gern|gerne|bitte|ok|okay|klar)\b/.test(kurz) && !/^(ja|bitte)? ?(nein|nicht)\b/.test(kurz)))) {
    const vorherFrage = verlauf.length >= 3 ? verlauf[verlauf.length - 3].content : "";
    await run("ansprechpartner");
    const r = (await run("rueckruf_anfordern", { thema: vorherFrage || "Rückruf gewünscht" })) as { zusage: string; erstNachHeute: boolean };
    return `Erledigt: Ich habe einen Rückruf bei ${ap.name} angefordert – ${r.zusage} (${ap.verfuegbar}). ${RUECKRUF_SIMULIERT}${erreichbarSatz(ctx, ap, r.erstNachHeute)}`;
  }
  if (offeneRueckfrage === "rueckruf" && (ABLEHNUNG.test(kurz) || /^(nein|nee|lieber nicht)\b/.test(kurz))) {
    return inServicezeit(new Date(), ap.verfuegbar, ctx.sitzung.tenant.bundesland)
      ? `Alles klar, kein Rückruf. ${ap.name} ist in der Servicezeit direkt erreichbar unter der Durchwahl ${ap.telefon} oder ${ap.email} (${ap.verfuegbar}).`
      : `Alles klar, kein Rückruf. ${ap.name} ist wieder erreichbar ${naechsteServicezeit(new Date(), ap.verfuegbar, ctx.sitzung.tenant.bundesland).text} unter der Durchwahl ${ap.telefon} oder ${ap.email}.`;
  }
  // Antwort auf „Für welche Akte …?“ bzw. „Zu welchem Datum?“ – nur, wenn sie die erfragte Angabe auch enthält
  const vollstaendig = zusammengefuehrt(verlauf);
  const liefertAngabe =
    offeneRueckfrage === "datum"
      ? /^(am|zum|bis|in|ab|heute|morgen|übermorgen|uebermorgen|\d)/.test(kurz) && !!datumAus(kurz)
      : offeneRueckfrage === "titel"
        ? kurz.length >= 3 && !ZUSTIMMUNG.test(kurz) && !ABLEHNUNG.test(kurz)
        : !!akteAusText(frage);
  if (vollstaendig && liefertAngabe) return demoAntwort(vollstaendig, ctx, []);
  if (ZUSTIMMUNG.test(kurz) || ABLEHNUNG.test(kurz)) {
    return ZUSTIMMUNG.test(kurz)
      ? "Gern – wobei darf ich helfen? Zum Beispiel: „Was steht heute an?“, „Welche Fristen laufen diese Woche ab?“ oder „Wie funktioniert der Bankabgleich?“"
      : "Alles klar. Sagen Sie einfach Bescheid, wenn ich etwas für Sie tun kann.";
  }

  // ── Smalltalk ──
  const ohneGruss = frage.replace(new RegExp(GRUSS.source, "i"), "").trim();
  if (GRUSS.test(kurz) && !kurzform(ohneGruss)) {
    return `${gruss(ctx.sitzung.user)}! Ich bin der Apex Assistent. Ich prüfe Fristen, öffne Akten, berechne Fristen und RVG-Gebühren, nenne Zahlen aus Posteingang, Finanzen und 38h-Motor, finde Urteile oder erkläre die Bedienung. Womit fange ich an?`;
  }
  if (DANK.test(kurz)) return "Gern geschehen! Wenn noch etwas ist – einfach fragen.";
  if (ABSCHIED.test(kurz)) return "Bis bald! Ich bin jederzeit unten rechts für Sie da.";
  if (ohneGruss !== frage && ohneGruss) return demoAntwort(ohneGruss, ctx, []);

  const q = frage.toLowerCase();
  const bedienFrage = BEDIENFRAGE.test(q);

  // ── Notfall beA-Störung – vor Posteingang und Bereichen; Folgefrage („Und beim OLG?“) aus dem Gesprächskontext ──
  const imBeaGespraech = verlauf.slice(0, -1).some((m) => m.role === "assistant" && m.content.startsWith("**beA-Störung"));
  const folgefrage = imBeaGespraech && !!gerichtsbarkeitAus(frage) && (/^(und|aber|was|wie|gilt|bei|beim|am|vor|zum|zur)\b/.test(kurz) || kurz.split(" ").length <= 8);
  if (istBeaStoerung(frage) || folgefrage) {
    if (!ctx.werkzeuge.includes("notfall_bea")) ctx.werkzeuge.push("notfall_bea");
    ctx.links.push({ label: "beA-Status (Systemstatus)", to: "/hilfe#status" }, { label: "Wissenskarte beA-Störung", to: "/hilfe?wiki=bea-stoerung" });
    return beaStoerungAntwort(gerichtsbarkeitAus(frage), ap, { land: ctx.sitzung.tenant.bundesland });
  }

  // ── Nur ein Bereichsname („Einstellungen“, „Bankabgleich“) → Bereich öffnen; danach Mensch / Ansprechpartner ──
  const bereichAllein = nurBereich(frage);
  if (bereichAllein) {
    const r = (await run("navigiere", { ziel: bereichAllein.label })) as { geoeffnet: string; beschreibung: string };
    return `Ich habe „${r.geoeffnet}“ für Sie geöffnet. ${r.beschreibung}`;
  }
  if (/ansprechpartner|ansprechperson|mensch|rückruf|rueckruf|hotline|anrufen|support|kontakt zu (euch|ihnen)/.test(q) || normalize(q).includes(normalize(ap.name))) {
    const a = (await run("ansprechpartner")) as { name: string; telefon: string; email: string; verfuegbar: string; erreichbar: boolean; wiederErreichbar?: string };
    if (/rückruf|rueckruf|ruf.*an\b|anrufen/.test(q)) {
      const r = (await run("rueckruf_anfordern", { thema: frage })) as { zusage: string; erstNachHeute: boolean };
      return `Erledigt: Ich habe einen Rückruf bei ${a.name} angefordert – ${r.zusage} (${a.verfuegbar}). ${RUECKRUF_SIMULIERT}${erreichbarSatz(ctx, ap, r.erstNachHeute, q)}`;
    }
    if (!a.erreichbar) {
      return `${apText} (Durchwahl ${a.telefon}). ${a.name} ist jetzt nicht erreichbar – Rückruf frühestens ${a.wiederErreichbar} (Servicezeit ${a.verfuegbar}). ${rueckrufRegel(a.verfuegbar)}${fristHeuteSatz(ctx, q)} Soll ich einen Rückruf für dann anfordern?`;
    }
    return `${apText} – direkt erreichbar unter der Durchwahl ${a.telefon} oder ${a.email} (${a.verfuegbar}), ohne Warteschleife.${fristHeuteSatz(ctx, q, true)} Soll ich einen Rückruf anfordern?`;
  }

  // ── Kurzform einer Aktensuche („akte müller“, „müller“): dieselbe Suche mit Mehrdeutigkeitsprüfung wie „Öffne die Akte …“ ──
  const kurzName = aktenKurzform(frage);
  if (kurzName) {
    const original = frage.trim().replace(/^(akte|az\.?)\s+/i, "").replace(/[?.!]+$/, "");
    return demoAntwort(`Öffne die Akte ${original || kurzName}`, ctx, []);
  }

  // ── Tagesbriefing (dieselben Sätze wie im Cockpit) ──
  if (/was steht (heute )?an|mein tag|briefing|überblick|ueberblick|zusammenfassung des tages|was ist heute/.test(q)) {
    if (!ctx.werkzeuge.includes("tagesbriefing")) ctx.werkzeuge.push("tagesbriefing");
    await run("fristen_liste", { zeitraum: "heute" });
    await run("posteingang_status");
    const d = daten();
    return tagesbriefing({ heute: today(), fristen: d.fristen, akten: d.akten, nachrichten: d.nachrichten }).map((s) => briefingText(s)).join(" ");
  }

  // ── Zahlen der Kanzlei: Finanzen, Fremdgeld, 38h-Motor, Akten, Apex Island ──
  // („Öffne die Abrechnung“ bleibt Navigation)
  if (!bedienFrage && !(/^(bitte\s+)?(öffne|oeffne|geh|gehe|wechsle|navigiere|bring mich|springe)\b/.test(q) && findeBereich(frage))) {
    const k = await kennzahlAntwort(q, run);
    if (k) return k;
  }

  // ── Posteingang ──
  if (/posteingang|neue (post|nachrichten|mails?|e-mails?)|nachrichten|\bpost\b|\bbea\b/.test(q) && !bedienFrage && !/(lege|leg |trag|erstelle|setz).*(frist|wiedervorlage|termin)/.test(q)) {
    const p = (await run("posteingang_status")) as { neu: number; ausgewertet: number; wartenAufKi: number; eeb: number; nachrichten: { kanal: string; von: string; betreff: string }[] };
    if (!p.neu) return "Der Posteingang ist aufgeräumt – keine neuen Nachrichten.";
    const ki = p.ausgewertet && p.wartenAufKi
      ? ` – bei ${p.ausgewertet} ist die KI-Analyse fertig, ${p.wartenAufKi} ${p.wartenAufKi === 1 ? "wartet" : "warten"} noch auf die KI-Analyse`
      : p.wartenAufKi ? ` – ${p.wartenAufKi === 1 ? "sie wartet" : "alle warten"} noch auf die KI-Analyse` : " – die KI hat bereits alle ausgewertet";
    return `Sie haben ${anz(p.neu, "neue Nachricht", "neue Nachrichten")}${ki}${p.eeb ? `, darunter ${anz(p.eeb, "Zustellung", "Zustellungen")} gegen eEB` : ""}:\n${liste(p.nachrichten.slice(0, 4).map((n) => `${n.kanal} von ${n.von}: ${n.betreff}`))}${p.neu > 4 ? `\n… und ${p.neu - 4} weitere.` : ""}`;
  }

  // ── „Wo finde ich …?“ ──
  const bereich = findeBereich(frage);
  if (bereich && /\bwo (finde|ist|sind|kann|stelle|richte)|\bwo\b.*\b(finden|einstellen)\b/.test(q)) {
    ctx.links.push({ label: `Zu „${bereich.label}“`, to: bereich.to });
    return `„${bereich.label}“ finden Sie ${bereich.ort}. ${ansprechText(bereich.beschreibung, ctx.sitzung.tenant.ansprechpartner)}`;
  }

  // ── Navigation mit Verb („Öffne den Bankabgleich“) ──
  const navVerb = /^(bitte\s+)?(öffne|oeffne|geh|gehe|wechsle|navigiere|bring mich|springe|zeig|zeige)\b/.test(q);
  const fristenFrage = /heute|morgen|woche|monat|meine|nächste|naechste|anstehend|fällig|faellig|notfrist|kritisch|verlängerbar/.test(q);
  if (navVerb && bereich && !(bereich.to === "/fristen" && (fristenFrage || /^(bitte\s+)?zeig/.test(q)))) {
    const r = (await run("navigiere", { ziel: bereich.label })) as { geoeffnet: string };
    return `Ich habe „${r.geoeffnet}“ für Sie geöffnet.`;
  }

  // ── Argumentationshilfe zu einer bestimmten Entscheidung (z. B. aus der Fall-Datenbank „Mit dem Assistenten besprechen“) ──
  const entscheidung = findeEntscheidung(frage);
  if (entscheidung && !/(lege|leg |trag|erstelle|setz).*(frist|wiedervorlage|termin)/.test(q)) {
    const fuer = /\bakte\b/.test(q) && azAus(q.replace(entscheidung.az.toLowerCase(), " ")) ? findeAkteNachAz(azAus(q.replace(entscheidung.az.toLowerCase(), " "))!) : undefined;
    const h = (await run("entscheidung_erlaeutern", { aktenzeichen: entscheidung.az, akte: fuer?.aktenzeichen })) as ReturnType<typeof argumentationshilfe>;
    const akteZeile = h.akten.length
      ? `\nPasst zu Akte ${h.akten[0].aktenzeichen} ${h.akten[0].titel}${h.akten[0].geheftet ? " (angeheftet)" : ""}${h.akten[0].gemeinsam.length ? ` – gemeinsame Merkmale: ${h.akten[0].gemeinsam.join(", ")}` : ""}.${h.akten.length > 1 ? ` Außerdem: ${h.akten.slice(1).map((a) => a.aktenzeichen).join(", ")}.` : ""}`
      : "";
    const titel = h.titel.includes("„") ? h.titel : `„${h.titel}“`;
    return `**So nutzen Sie ${h.zitat} (${titel}):**\nKernaussage: ${h.leitsatz}\n${liste(h.bausteine)}\nNormen: ${h.normen.join(", ")}.${akteZeile}\nVor Verwendung im Schriftsatz bitte im Original prüfen.`;
  }

  // ── Frist berechnen ──
  const regel = regelAus(q);
  if (regel && /(berechne|wann|bis wann|frist|endet|ablauf)/.test(q) && !/(lege|leg |trag|erstelle)/.test(q) && !/welche|wie viele|als n(ä|ae)chstes|anstehen|stehen.*\ban\b/.test(q)) {
    const datum = datumAus(q) ?? today();
    const akte = azAus(q) ? findeAkteNachAz(azAus(q)!) : undefined;
    const r = (await run("frist_berechnen", { regel, ereignisDatum: datum, aktenzeichen: akte?.aktenzeichen })) as { frist: string; grundlage: string; fristende: string; vorfrist: string; verschoben: boolean; feiertageNach?: string; hinweise: string[] };
    const ort = r.feiertageNach && r.feiertageNach !== "Kanzleisitz" ? ` Feiertage nach dem Gerichtsort (${r.feiertageNach.replace(/ – laut Akte$/, "")}, laut Akte).` : "";
    return `Die ${r.frist} (${r.grundlage}) endet am **${r.fristende}**, ausgehend vom ${fmtDate(datum)}.${r.verschoben ? " Das rechnerische Ende fiel auf ein Wochenende oder einen Feiertag – deshalb verschoben nach § 222 Abs. 2 ZPO." : ""}${ort} Vorfrist: ${r.vorfrist}. Den vollständigen Rechenweg sehen Sie im Fristenrechner.${r.hinweise.length ? ` Hinweis: ${r.hinweise[0]}` : ""}`;
  }

  // ── Berufung zum OLG bzw. LAG ohne Vorfrage („Und bei einer Berufung zum Oberlandesgericht?“): Berufungsfrist statt Ratlosigkeit ──
  if (/berufung/.test(q) && /oberlandesgericht|\bolg\b|kammergericht|landesarbeitsgericht|\blag\b/.test(q) && !/(lege|leg |trag|erstelle|notiz)/.test(q)) {
    const arbeit = /landesarbeitsgericht|\blag\b/.test(q);
    ctx.links.push({ label: "Berufungsfrist berechnen", to: fristenrechnerLink(arbeit ? "berufung_arbg" : "berufung") }, { label: "Wissenskarte beA-Störung", to: "/hilfe?wiki=bea-stoerung" });
    return arbeit
      ? "**Berufung zum Landesarbeitsgericht:** Die Berufungsfrist beträgt einen Monat, die Begründungsfrist zwei Monate (§ 66 Abs. 1 S. 1 ArbGG). Beide beginnen mit der Zustellung des vollständig abgefassten Urteils, spätestens fünf Monate nach der Verkündung (§ 66 Abs. 1 S. 2 ArbGG). Den Fristablauf mit den Feiertagen am Gerichtsort berechnet der Fristenrechner. Ist das beA gestört: Ersatzeinreichung nach § 46g S. 3, 4 ArbGG – siehe Wissenskarte „beA-Störung – was tun?“."
      : "**Berufung zum Oberlandesgericht:** Die Berufungsfrist ist eine Notfrist von einem Monat ab Zustellung des vollständig abgefassten Urteils, spätestens fünf Monate nach der Verkündung (§ 517 ZPO). Eingelegt wird beim Berufungsgericht (§ 519 Abs. 1 ZPO) – gegen Urteile des Landgerichts beim Oberlandesgericht, in Berlin beim Kammergericht. Begründet wird binnen zwei Monaten ab Zustellung (§ 520 Abs. 2 S. 1 ZPO). Den Fristablauf mit den Feiertagen am Gerichtsort berechnet der Fristenrechner. Ist das beA gestört: Ersatzeinreichung nach § 130d S. 2, 3 ZPO – siehe Wissenskarte „beA-Störung – was tun?“.";
  }

  // ── Frist / Wiedervorlage anlegen ──
  // ── Notiz anlegen (Bestätigung vor dem Schreiben) ──
  if (/(lege|leg |schreib|füge|fuege|erstelle|trag|notier|halte).*\bnotiz\b|\bnotiz\b.*(an|ein)legen|^notiz\b/.test(q) && !/^wie\b/.test(q)) {
    const auftrag = auftragAus(frage);
    const ohneAuftrag = auftrag ? frage.replace(auftrag, " ") : frage;
    const kandidaten = akteKandidaten(ohneAuftrag);
    if (kandidaten.length > 1) {
      ctx.auswahl = auswahlFuer(kandidaten, (a) => `Notiz zu Akte ${a.aktenzeichen}: ${auftrag ?? ""}`.trim());
      return `Zu Ihrer Angabe passen ${kandidaten.length} Akten. Zu welcher soll die Notiz?`;
    }
    const akte = kandidaten[0] ?? akteAusText(ohneAuftrag);
    if (!akte) return `Für welche Akte soll ich das eintragen? Nennen Sie mir bitte das Aktenzeichen, z. B. „${beispielAz()}“.`;
    if (!auftrag) return `Was soll in der Notiz zu ${akte.aktenzeichen} stehen? Schreiben Sie z. B. „Notiz zu Akte ${akte.aktenzeichen}: Mandant ruft Montag zurück“.`;
    await run("notiz_anlegen", { aktenzeichen: akte.aktenzeichen, text: auftrag });
    return `Bitte bestätigen Sie die Notiz zu ${akte.aktenzeichen} (${akte.titel}): „${auftrag}“. Gespeichert wird erst nach „Eintragen“.`;
  }

  // ── Frist / Wiedervorlage / Termin anlegen: erst Bestätigungskarte, dann eintragen, danach „Rückgängig“ ──
  if (/(lege|leg |trag|erstelle|setz|erinnere).*(frist|wiedervorlage|termin|erinnerung)|(frist|wiedervorlage|termin).*(an|ein)legen|^erinnere mich/.test(q) && !/^wie\b/.test(q)) {
    const roh = auftragAus(frage) ?? auftragAusNachsatz(frage);
    const ohneTitel = !!roh && OHNE_TITEL.test(kurzform(roh));
    const auftrag = ohneTitel ? undefined : roh;
    const ohneAuftrag = roh ? frage.replace(roh, " ") : frage;
    const datum = datumAus(ohneAuftrag.toLowerCase());
    const typ: VorschlagArt = /termin/.test(q) ? "termin" : /notfrist/.test(q) ? "notfrist" : /frist/.test(q) && !/wiedervorlage/.test(q) ? "frist" : "wiedervorlage";
    const kandidaten = akteKandidaten(ohneAuftrag);
    if (kandidaten.length > 1) {
      ctx.auswahl = auswahlFuer(kandidaten, (a) => `${ART_NAME[typ]} für Akte ${a.aktenzeichen}${datum ? ` am ${fmtDate(datum)}` : ""}${auftrag ? `: ${auftrag}` : ""}`);
      return `Zu Ihrer Angabe passen ${kandidaten.length} Akten. Für welche soll ich die ${ART_NAME[typ]} vorbereiten?`;
    }
    const akte = kandidaten[0] ?? akteAusText(ohneAuftrag);
    if (!akte) {
      return azAus(ohneAuftrag)
        ? `Für welche Akte soll ich das eintragen? Eine Akte ${azAus(ohneAuftrag)} habe ich in Ihrer Kanzlei nicht gefunden – nennen Sie mir bitte das Aktenzeichen, z. B. „${beispielAz()}“.`
        : `Für welche Akte soll ich das eintragen? Nennen Sie mir bitte das Aktenzeichen, z. B. „${beispielAz()}“.`;
    }
    if (!datum) return "Zu welchem Datum? Sagen Sie z. B. „in drei Tagen“ oder „am 30.10.“.";
    // Ohne Auftragstext nicht still „Wiedervorlage“ eintragen, sondern nachfragen – der Auftrag wird zum Titel
    if (!auftrag && !ohneTitel) {
      return `Worum geht es bei der ${ART_NAME[typ]} für ${akte.aktenzeichen} am ${fmtDateWd(datum)}? Nennen Sie mir den Auftrag, z. B. „Zeugen Seifert benennen“ – er wird zum Titel. Oder sagen Sie „ohne Titel“.`;
    }
    const titel = auftrag ?? (typ === "termin" ? "Termin" : typ === "frist" ? "Frist (manuell)" : typ === "notfrist" ? "Notfrist (manuell)" : "Wiedervorlage");
    const r = (await run("frist_anlegen", { aktenzeichen: akte.aktenzeichen, titel, datum, typ, auftrag: (ctx.originalFrage ?? frage).trim() })) as { akte: string; datum: string; werktag: boolean; vorschlagNaechsterWerktag: string | null; doppelung: string | null };
    const hinweis = !r.werktag && r.vorschlagNaechsterWerktag ? ` Achtung: ${r.datum} ist kein Werktag – Vorschlag: ${r.vorschlagNaechsterWerktag}.` : "";
    if (r.doppelung) {
      return `Bitte prüfen Sie zuerst: ${r.doppelung}. Soll trotzdem eine zweite ${ART_NAME[typ]} „${titel}“ für ${r.akte} am ${r.datum} entstehen?${hinweis} Eingetragen wird erst nach „Trotzdem eintragen“ – danach können Sie es rückgängig machen.`;
    }
    return `Bitte bestätigen Sie: ${ART_NAME[typ]} „${titel}“ für ${r.akte} am ${r.datum}.${hinweis} Eingetragen wird erst nach „Eintragen“ – danach können Sie es rückgängig machen.`;
  }

  // ── Fristen auflisten ──
  if (/frist|termin|wiedervorlage|notfrist/.test(q) && !bedienFrage && !/^was (ist|sind|bedeutet) (eine |die )?(not|vor)?frist/.test(q)) {
    return fristenAntwort(q, run);
  }

  // ── RVG ──
  if (/rvg|gebühr|gebuehr|honorar/.test(q) && /\d/.test(q)) {
    const wert = Number((q.match(/(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:,\d+)?\s*(€|euro|eur)?/)?.[1] ?? "0").replace(/[.\s]/g, ""));
    const pos = /au(ß|ss)ergerichtlich/.test(q) ? ["2300"] : /gericht|klage|prozess|verfahren/.test(q) ? ["3100", "3104"] : ["2300"];
    const r = (await run("rvg_berechnen", { gegenstandswert: wert, positionen: pos })) as { zeilen: string[]; brutto: string; netto: string };
    return `Bei einem Gegenstandswert von ${fmtEUR(wert, { cents: false })}:\n${liste(r.zeilen)}\nGesamt ${r.netto} netto, ${r.brutto} brutto inkl. 19 % USt.`;
  }

  // ── Rechtsprechung ──
  if (/urteil|rechtsprechung|präzedenz|praezedenz|\bbgh\b|\bbag\b|entscheidung|gericht hat/.test(q) && !bedienFrage) {
    const begriffe = frage.replace(/(such|finde|zeig|gibt es|mir|bitte|urteile?|rechtsprechung|präzedenzfälle?|entscheidungen?|zu|zum|zur|dem|der|die|das)\b/gi, " ");
    const r = (await run("rechtsprechung_suchen", { suchbegriffe: begriffe })) as { zitat: string; titel: string; bedeutung: string }[];
    if (!r.length) return "Dazu habe ich im Demo-Bestand der Fall-Datenbank keine passende Entscheidung gefunden. Probieren Sie es mit anderen Stichworten, z. B. „Bagatellkündigung“ oder „Schönheitsreparaturen“.";
    return `Passende Entscheidungen aus der Fall-Datenbank:\n${liste(r.slice(0, 3).map((e) => `${e.zitat} – ${e.titel}: ${e.bedeutung}`))}`;
  }

  // ── Fallanalyse ──
  if (/fallanalyse|erfolgsaussicht|chancen|gewinnen/.test(q) && !/^(wie|was) (funktioniert|macht|ist|geht|bedeutet)\b|erklär|erklaer/.test(q)) {
    const a = akteAusText(q);
    if (!a) return `Für welche Akte soll ich die Fallanalyse vorbereiten? Nennen Sie mir das Aktenzeichen oder den Mandanten, z. B. „${beispielAz()}“.`;
    ctx.links.push({ label: `KI-Fallanalyse ${a.aktenzeichen}`, to: `/ki?akte=${a.id}` });
    return `Gern. Die KI-Fallanalyse für ${a.aktenzeichen} (${a.titel}) prüft Sachverhalt, Dokumente und passende Rechtsprechung und schätzt die Erfolgsaussicht. Tippen Sie auf „KI-Fallanalyse ${a.aktenzeichen}“, um sie zu starten.`;
  }

  // ── Navigation zu einer Akte („Öffne die Akte 142/26“, „Zeig mir die Akte Weber“) ──
  const navMatch = q.match(/(öffne|oeffne|zeig|zeige|geh|gehe|wechsle|navigiere|bring mich)\s+(mir\s+)?(zu[mr]?\s+|in\s+(den|die|das)\s+|die\s+|den\s+|das\s+)?(.+)/);
  if (navMatch) {
    const ziel = navMatch[5].replace(/[?.!]+$/, "").replace(/^akte\s+/, "");
    try {
      const r = (await run("navigiere", { ziel })) as { geoeffnet?: string; titel?: string; mehrdeutig?: boolean; treffer?: string[] };
      if (r.mehrdeutig) {
        // Suchbegriff so zeigen, wie er eingegeben wurde („Schneider“, nicht „schneider“)
        const begriff = ziel.replace(/^akte\s+/i, "");
        const i = frage.toLowerCase().lastIndexOf(begriff);
        const original = i >= 0 ? frage.slice(i, i + begriff.length) : begriff;
        return `Zu „${original}“ passen ${r.treffer?.length ?? 0} Akten. Welche soll ich öffnen?`;
      }
      return r.titel ? `Ich habe die ${r.geoeffnet} (${r.titel}) für Sie geöffnet.` : `Ich habe „${r.geoeffnet}“ für Sie geöffnet.`;
    } catch {
      if (/akte/.test(q) || azAus(q)) {
        return `Eine Akte ${azAus(q) ?? `„${ziel}“`} habe ich in Ihrer Kanzlei nicht gefunden. Versuchen Sie es mit einem anderen Aktenzeichen, z. B. „Öffne die Akte ${beispielAz()}“, oder suchen Sie nach dem Namen des Mandanten.`;
      }
    }
  }
  const az = azAus(q);
  const nachAkteGefragt = /\bakte\b|stand|was ist mit|details/.test(q);
  if (nachAkteGefragt && (az || akteAusText(q))) {
    const a = az ? findeAkteNachAz(az) : akteAusText(q);
    if (!a) return `Eine Akte ${az} gibt es in Ihrer Kanzlei nicht. Ein Beispiel aus Ihrem Bestand: „Was ist mit Akte ${beispielAz()}?“`;
    const d = (await run("akte_details", { aktenzeichen: a.aktenzeichen })) as { aktenzeichen: string; titel: string; phase: string; offeneFristen: string[]; wiedervorlagenUndTermine: string[]; sachverhalt: string };
    const fristTeil = d.offeneFristen.length ? `\nOffene Fristen:\n${liste(d.offeneFristen.slice(0, 3))}` : " Keine offenen Fristen.";
    const wvTeil = d.wiedervorlagenUndTermine.length ? `\nWiedervorlagen und Termine:\n${liste(d.wiedervorlagenUndTermine.slice(0, 3))}` : "";
    return `${d.aktenzeichen} – ${d.titel} (${d.phase}). ${d.sachverhalt.split(". ")[0].replace(/\.$/, "")}.${fristTeil}${wvTeil}`;
  }

  // ── Bedienung / Hilfe (nur sichere Wiki-Treffer) ──
  const hilfe = (await run("hilfe_artikel", { frage })) as { titel: string; kurz: string; schritte: string[] }[];
  if (hilfe.length && (bedienFrage || /^(was|wie|kann ich|gibt es)\b|hilfe|funktion/.test(q))) {
    const h = hilfe[0];
    // Neben dem Wiki-Artikel direkt in den gefragten Bereich („Wie funktioniert der Bankabgleich?“ → „Bankabgleich öffnen“)
    const ziel = findeBereich(frage);
    if (ziel) {
      const i = ctx.links.findIndex((l) => l.to === ziel.to);
      const oeffnen = { label: `${ziel.label} öffnen`, to: ziel.to };
      if (i >= 0) ctx.links[i] = oeffnen;
      else ctx.links.unshift(oeffnen);
      const w = wikiFuer(ap).find((x) => x.titel === h.titel);
      if (w) ctx.links.push({ label: `Schnellhilfe „${w.titel}“`, to: `/hilfe?wiki=${w.key}` });
    }
    return `**${h.titel}:** ${h.kurz}\n${liste(h.schritte.slice(0, 3))}`;
  }
  if (bereich) {
    ctx.links.push({ label: `Zu „${bereich.label}“`, to: bereich.to });
    return `„${bereich.label}“ finden Sie ${bereich.ort}. ${ansprechText(bereich.beschreibung, ctx.sitzung.tenant.ansprechpartner)}`;
  }

  // ── Aktensuche als Rückfall (nur aussagekräftige Wörter ab drei Zeichen, nicht bei Bedienfragen) ──
  const suchwoerter = bedienFrage ? "" : tokenize(frage).filter((t) => t.length >= 3 && !FRAGEWORTE.has(t) && !WIKI_STOP.has(t)).join(" ");
  const akten = suchwoerter ? ((await run("suche_akten", { suchbegriff: suchwoerter })) as { aktenzeichen: string; titel: string; naechsteFrist: string | null }[]) : [];
  if (akten.length) {
    const zeilen = liste(akten.slice(0, 4).map((a) => `${a.aktenzeichen} ${a.titel}${a.naechsteFrist ? ` – nächste Frist: ${a.naechsteFrist}` : ""}`));
    return akten.length === 1 ? `Dazu habe ich eine passende Akte gefunden:\n${zeilen}` : `Dazu habe ich ${akten.length} passende Akten gefunden:\n${zeilen}`;
  }
  if (hilfe.length) return `**${hilfe[0].titel}:** ${hilfe[0].kurz}`;

  // ── ehrlich nachfragen statt raten ──
  if (bedienFrage || /\?$/.test(frage.trim())) {
    return `Dazu habe ich im Wiki keine sichere Antwort gefunden. Meinen Sie einen bestimmten Bereich – etwa Fristen, Posteingang, Abrechnung oder den 38h-Motor? Formulieren Sie die Frage gern genauer, z. B. „Wie funktioniert der Bankabgleich?“. Persönlich hilft auch ${ap.name} weiter (${festeAnsprechBezeichnung(ap)}). Soll ich einen Rückruf anfordern?`;
  }
  return `Das kann ich im Demo-Modus noch nicht beantworten. Ich helfe Ihnen gern bei Fristen („Welche Fristen laufen diese Woche ab?“), Akten („Öffne die Akte ${beispielAz()}“), Zahlen („Wie hoch sind die offenen Forderungen?“), RVG („RVG für 10.000 € außergerichtlich“), Rechtsprechung („Urteile zu Schönheitsreparaturen“) oder der Bedienung. Oder ich verbinde Sie mit ${ap.name}.`;
}

/** Eine Frage an den Assistenten. */
export async function frageAssistent(opts: {
  verlauf: LlmMessage[];
  sitzung: SessionInfo;
  nav: (to: string) => void;
  voice: boolean;
  onText?: (t: string) => void;
  onTool?: (label: string) => void;
  signal?: AbortSignal;
}): Promise<AssistentAntwort> {
  const ctx: Kontext = { sitzung: opts.sitzung, nav: opts.nav, links: [], werkzeuge: [] };
  const letzte = opts.verlauf[opts.verlauf.length - 1]?.content ?? "";
  try {
    const text = await llmAgent({
      system: systemPrompt(opts.sitzung, opts.voice),
      messages: opts.verlauf.slice(-12),
      tools: werkzeuge(ctx),
      onText: opts.onText,
      onTool: (name) => opts.onTool?.(werkzeugLabel(name, opts.sitzung.tenant.ansprechpartner)),
      signal: opts.signal,
    });
    return { text: text.trim() || "Erledigt.", links: dedupe(ctx.links), werkzeuge: ctx.werkzeuge.map((w) => werkzeugLabel(w, ctx.sitzung.tenant.ansprechpartner)), auswahl: ctx.auswahl, vorschlag: ctx.vorschlag };
  } catch (e) {
    if (!(e instanceof DemoModus)) {
      if (opts.signal?.aborted) throw e;
      console.warn("Live-Assistent nicht verfügbar – Demo-Antwort", e);
    }
    let text: string;
    try {
      // Gesprächskontext: die letzten Nachrichten genügen für Rückfragen („Ja“, „142/26“)
      text = await demoAntwort(letzte, ctx, opts.verlauf.slice(-8));
    } catch (err) {
      text = `Das hat leider nicht geklappt: ${verstaendlicheMeldung(err)} Versuchen Sie es bitte noch einmal – oder ich verbinde Sie mit ${opts.sitzung.tenant.ansprechpartner.name}.`;
    }
    ctx.werkzeuge.forEach((w) => opts.onTool?.(werkzeugLabel(w, ctx.sitzung.tenant.ansprechpartner)));
    return { text, links: dedupe(ctx.links), werkzeuge: ctx.werkzeuge.map((w) => werkzeugLabel(w, ctx.sitzung.tenant.ansprechpartner)), auswahl: ctx.auswahl, vorschlag: ctx.vorschlag };
  }
}

function dedupe(l: AssistentLink[]): AssistentLink[] {
  const seen = new Set<string>();
  return l.filter((x) => (seen.has(x.to) ? false : (seen.add(x.to), true))).slice(0, 3);
}
