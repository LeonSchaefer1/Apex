// Der 38h-Motor: Routineprozesse, die im Hintergrund vorbereitet werden. Nach außen geht nichts ohne Freigabe.
import type { Automation, Bundesland, ISODateTime } from "./types";
import { addDays, weekday } from "./dates";
import { istWerktag } from "./feiertage";

/**
 * Jede Automatik nennt ihre Freigabestufe (`freigabe`) und was als ein Vorgang zählt (`vorgang`). Die Zeitersparnis
 * (`minutenProLauf`) gilt je tatsächlich bearbeitetem Vorgang – ein Bankabruf ohne neue Zahlung spart nichts.
 */
export const AUTOMATION_DEFS: Omit<Automation, "id" | "laeufe" | "letzterLauf" | "aktiv">[] = [
  {
    key: "posteingang-fristen", name: "Fristen aus Posteingang erkennen", kategorie: "Posteingang",
    beschreibung: "Liest jede beA-Nachricht und E-Mail, ordnet sie der Akte zu und schlägt Fristen samt Vorfrist vor – berechnet vom geprüften Fristenrechner, eingetragen erst nach der Vier-Augen-Kontrolle.",
    ausloeser: "Neue beA-Nachricht oder E-Mail", minutenProLauf: 6, vorgang: "je erkannter Frist",
    freigabe: "Vier-Augen-Kontrolle",
    schritte: ["Dokument lesen (OCR)", "Akte über Aktenzeichen & Parteien erkennen", "Fristauslösendes Ereignis bestimmen", "Frist nach § 222 ZPO berechnen", "Zur Vier-Augen-Kontrolle vorlegen"],
  },
  {
    key: "mandatsaufnahme", name: "Mandatsaufnahme-Paket", kategorie: "Mandanten",
    beschreibung: "Erstellt beim Anlegen einer Akte Vollmacht, Mandatsbestätigung und Datenschutzhinweise und dokumentiert die vor Übernahme erteilten Hinweise zur Abrechnung nach Gegenstandswert (§ 49b Abs. 5 BRAO) – in Arbeitssachen auch zum Ausschluss der Kostenerstattung (§ 12a Abs. 1 S. 2 ArbGG). Die Unterschriftsanfrage geht erst nach Ihrer Freigabe an die Mandantschaft.",
    ausloeser: "Neue Akte angelegt", minutenProLauf: 25, vorgang: "je neuer Akte",
    freigabe: "Unterschriftsanfrage an den Mandanten nach Ihrer Freigabe",
    schritte: ["Mandantendaten übernehmen", "Vollmacht erzeugen", "Mandatsbestätigung & Datenschutzhinweise", "Hinweise § 49b BRAO / § 12a ArbGG zur Bestätigung", "Zur Freigabe vorlegen", "Unterschriftsanfrage nach Freigabe"],
  },
  {
    key: "deckungsanfrage", name: "Deckungsanfrage an Rechtsschutzversicherung", kategorie: "Mandanten",
    beschreibung: "Bereitet eine vollständige Deckungsanfrage mit Sachverhalt und Unterlagen vor und legt sie Ihnen zur Freigabe vor. Nach dem Versand überwacht sie die Antwort der Rechtsschutzversicherung.",
    ausloeser: "Akte mit Rechtsschutzversicherung angelegt", minutenProLauf: 15, vorgang: "je Anfrage",
    freigabe: "Entwurf – Versand erst nach Ihrer Freigabe",
    schritte: ["Sachverhalt zusammenfassen", "Versicherungsdaten prüfen", "Zur Freigabe vorlegen", "Versand nach Freigabe", "Wiedervorlage in 7 Tagen setzen"],
  },
  {
    key: "mandanten-update", name: "Wöchentliches Mandanten-Update", kategorie: "Mandanten",
    beschreibung: "Bereitet jeden Freitag für Mandantinnen und Mandanten eine verständliche Nachricht zum Stand ihrer Sache vor – über das Mandantenportal oder per E-Mail, versendet nach Ihrer Freigabe.",
    ausloeser: "Jeden Freitag, 14:00 Uhr", minutenProLauf: 10, vorgang: "je Mandanteninformation",
    freigabe: "Versand nach Ihrer Freigabe",
    schritte: ["Neue Ereignisse der Woche sammeln", "Laienverständlich formulieren", "Zur Freigabe vorlegen", "Versand nach Freigabe"],
  },
  {
    key: "vorfristen", name: "Vorfristen & Wiedervorlagen setzen", kategorie: "Fristen",
    beschreibung: "Legt zu jeder Frist eine Vorfrist an (Standard: 7 Tage vorher, je nach Fristart kürzer oder länger, auf einen Werktag gelegt) und erinnert die Verantwortlichen – mit Eskalation an die Vertretung.",
    ausloeser: "Frist eingetragen", minutenProLauf: 4, vorgang: "je Vorfrist",
    freigabe: "intern – nichts verlässt die Kanzlei",
    schritte: ["Vorfrist berechnen", "Verantwortliche benachrichtigen", "Eskalation bei Abwesenheit"],
  },
  {
    key: "eeb", name: "Empfangsbekenntnis (eEB) vorbereiten", kategorie: "Posteingang",
    beschreibung: "Bereitet das elektronische Empfangsbekenntnis vor, sobald die Frist notiert ist. Abgeben kann es nur eine Anwältin oder ein Anwalt.",
    ausloeser: "Zustellung gegen eEB", minutenProLauf: 5, vorgang: "je Zustellung",
    freigabe: "Abgabe nur durch Anwältin/Anwalt",
    schritte: ["Zustellungsdatum prüfen", "Frist notiert?", "eEB vorbereiten", "Abgabe durch Anwältin/Anwalt"],
  },
  {
    key: "bankabgleich", name: "Bankabgleich & Zahlungszuordnung", kategorie: "Finanzen",
    beschreibung: "Gleicht Kontoumsätze (CAMT.053) mit offenen Rechnungen und Aktenkonten ab. Eindeutige Treffer ab 90 % Sicherheit werden gebucht, alle anderen legt er Ihnen zur Bestätigung vor – jede Buchung lässt sich lösen.",
    ausloeser: "Neue Kontoumsätze (Abruf stündlich)", minutenProLauf: 3, vorgang: "je zugeordnetem Umsatz",
    freigabe: "ab 90 % automatisch gebucht, darunter Ihre Bestätigung – jede Buchung lösbar",
    schritte: ["Umsätze abrufen", "Rechnungsnummer & Aktenzeichen erkennen", "Betrag und Zahler abgleichen", "Ab 90 % buchen, sonst zur Bestätigung vorlegen"],
  },
  {
    key: "mahnwesen", name: "Zahlungserinnerung nach 14 Tagen", kategorie: "Finanzen",
    beschreibung: "Bereitet höfliche Erinnerungen an offene Rechnungen vor – versendet nach Ihrer Freigabe, auch als Sammelfreigabe – und setzt nach erfolgloser zweiter Erinnerung eine Wiedervorlage für die Anwältin oder den Anwalt.",
    ausloeser: "Rechnung 14 Tage überfällig", minutenProLauf: 7, vorgang: "je Erinnerung",
    freigabe: "Versand nach Ihrer Freigabe (Sammelfreigabe möglich)",
    schritte: ["Überfällige Rechnungen finden", "Erinnerung erzeugen", "Zur Freigabe vorlegen", "Versand nach Freigabe", "Wiedervorlage setzen"],
  },
  {
    key: "kostenfestsetzung", name: "Kostenfestsetzungsantrag nach Urteil", kategorie: "Dokumente",
    beschreibung: "Bereitet nach einem obsiegenden Urteil den Kostenfestsetzungsantrag (§ 104 ZPO) aus den Gebühren der Akte vor – zur Prüfung und Unterschrift.",
    ausloeser: "Obsiegendes Urteil in Akte eingegangen", minutenProLauf: 20, vorgang: "je Antrag",
    freigabe: "zur Prüfung und Unterschrift",
    schritte: ["Kostengrundentscheidung lesen", "Gebühren aus Aktenkonto übernehmen", "Antrag erzeugen", "Zur Prüfung und Unterschrift vorlegen"],
  },
  {
    key: "archivierung", name: "Archivierung mit Aufbewahrungsfrist", kategorie: "Dokumente",
    beschreibung: "Schlägt für erledigte Akten den Abschluss vor, prüft offene Posten und merkt die Aufbewahrungsfrist der Handakte (§ 50 BRAO) vor – Sie bestätigen.",
    ausloeser: "Akte auf „abgeschlossen“ gesetzt", minutenProLauf: 6, vorgang: "je Akte",
    freigabe: "Vorschlag – Sie bestätigen",
    schritte: ["Offene Fristen & Posten prüfen", "Archivierung vorschlagen", "Nach Bestätigung revisionssicher archivieren", "Löschfrist vormerken"],
  },
  {
    key: "zeiterfassung", name: "Zeiterfassung vorschlagen", kategorie: "Finanzen",
    beschreibung: "Schlägt aus Telefonaten, E-Mails und bearbeiteten Dokumenten Zeiteinträge vor – Sie bestätigen, nichts Abrechenbares geht mehr verloren.",
    ausloeser: "Werktags, 18:00 Uhr", minutenProLauf: 2, vorgang: "je vorgeschlagenem Zeiteintrag",
    freigabe: "Vorschlag – Sie bestätigen",
    schritte: ["Tätigkeiten des Tages sammeln", "Akten zuordnen", "Vorschläge zur Bestätigung"],
  },
  {
    key: "zuordnung", name: "Posteingang den Akten zuordnen", kategorie: "Posteingang",
    beschreibung: "Erkennt Aktenzeichen, Parteien und Gerichtsaktenzeichen und schlägt für jede Nachricht die richtige E-Akte vor – Sie bestätigen die Ablage.",
    ausloeser: "Neue Nachricht", minutenProLauf: 3, vorgang: "je Nachricht",
    freigabe: "Vorschlag – Sie bestätigen",
    schritte: ["Absender & Aktenzeichen erkennen", "Akte vorschlagen", "Nach Bestätigung ablegen"],
  },
];

/** Automatiken, deren Ergebnis die Kanzlei verlässt – sie legen immer zur Freigabe vor. */
export const AUSGEHEND = new Set(["mandatsaufnahme", "deckungsanfrage", "mandanten-update", "mahnwesen"]);

/**
 * Automatiken, an denen die Fristenkontrolle der Kanzlei hängt (§ 85 Abs. 2 ZPO: Verschulden des Anwalts wird zugerechnet).
 * Pausieren und Einschalten nur durch Partner bzw. Administration, mit Rückfrage; solange pausiert, warnen Cockpit und Fristen.
 */
export const FRIST_AUTOMATIKEN = ["posteingang-fristen", "vorfristen", "eeb"] as const;
export type FristAutomatikKey = (typeof FRIST_AUTOMATIKEN)[number];

export function istFristAutomatik(key: string): key is FristAutomatikKey {
  return (FRIST_AUTOMATIKEN as readonly string[]).includes(key);
}

const FOLGE_BEIM_PAUSIEREN: Record<FristAutomatikKey, string> = {
  "posteingang-fristen": "Neue beA-Nachrichten werden dann nicht mehr auf Fristen geprüft – Sie notieren Fristen von Hand.",
  vorfristen: "Vorfristen und Wiedervorlagen zu neuen Fristen werden nicht mehr gesetzt.",
  eeb: "Empfangsbekenntnisse werden nicht mehr vorbereitet – die Frist beginnt trotzdem mit der Zustellung.",
};

/** Was das Pausieren einer Automatik bewirkt – ein Satz für Rückfrage, Hinweisband und Protokoll. */
export function folgeBeimPausieren(key: string): string {
  if (istFristAutomatik(key)) return FOLGE_BEIM_PAUSIEREN[key];
  const d = automationDef(key);
  return d ? `„${d.name}“ bereitet dann nichts mehr vor, bis sie wieder eingeschaltet ist.` : "Die Automatik bereitet dann nichts mehr vor, bis sie wieder eingeschaltet ist.";
}

/** Folge als Zustand, solange die Automatik pausiert ist (Hinweisband, Briefing): ohne das „dann“ der Rückfrage. */
export function folgeWaehrendPause(key: string): string {
  return folgeBeimPausieren(key).replace(/ dann (?=nicht|nichts)/, " ");
}

const FRIST_AUTOMATIK_KURZ: Record<FristAutomatikKey, string> = {
  "posteingang-fristen": "Fristerkennung",
  vorfristen: "Vorfristen & Wiedervorlagen",
  eeb: "eEB-Vorbereitung",
};

/** Kurzbezeichnung für Hinweise: „Fristerkennung pausiert seit …“, „Vorfristen & Wiedervorlagen pausiert seit …“. */
export function fristAutomatikKurzname(key: string): string {
  return istFristAutomatik(key) ? FRIST_AUTOMATIK_KURZ[key] : automationDef(key)?.name ?? key;
}

/** Pausierte Fristautomatiken in der Reihenfolge von FRIST_AUTOMATIKEN (Posteingang zuerst). */
export function pausierteFristAutomatiken<T extends Pick<Automation, "key" | "aktiv">>(automationen: readonly T[]): T[] {
  return FRIST_AUTOMATIKEN.map((k) => automationen.find((a) => a.key === k)).filter((a): a is T => !!a && !a.aktiv);
}

/** Gesparte Minuten für `vorgaenge` tatsächlich bearbeitete Vorgänge (0 Vorgänge → 0 Minuten). */
export function ersparnisMinuten(key: string, vorgaenge: number): number {
  const d = automationDef(key);
  return d ? d.minutenProLauf * Math.max(0, Math.floor(vorgaenge)) : 0;
}

export function automationDef(key: string) {
  return AUTOMATION_DEFS.find((a) => a.key === key);
}

/**
 * Zeitgesteuerte Automationen laufen nur zu ihren Auslösezeiten (siehe `ausloeser`) – nicht bei beliebigen Ereignissen.
 * Gemeinsame Grundlage für die Demodaten (src/core/seed) und den simulierten Live-Betrieb (src/lib/motor.ts).
 */
export interface Zeitplan {
  /** Wochentage, an denen die Automation läuft (0 = Sonntag … 6 = Samstag) */
  wochentage: number[];
  /** Uhrzeit „HH:MM“ (Ortszeit der Kanzlei) */
  uhrzeit: string;
  /** an gesetzlichen Feiertagen auslassen (nur, wenn ein Bundesland bekannt ist) */
  nurWerktags?: boolean;
}

const ZEITPLAENE: Record<string, Zeitplan> = {
  "mandanten-update": { wochentage: [5], uhrzeit: "14:00" },
  "zeiterfassung": { wochentage: [1, 2, 3, 4, 5], uhrzeit: "18:00", nurWerktags: true },
};

/** Zeitplan einer Automation – `undefined` bei ereignisgesteuerten Automationen (z. B. „Neue beA-Nachricht“). */
export function zeitplan(key: string): Zeitplan | undefined {
  return ZEITPLAENE[key];
}

/** Planmäßige Auslösung an einem Tag (lokaler Zeitstempel „YYYY-MM-DDTHH:MM:00“) oder `undefined`, wenn sie an dem Tag nicht läuft. */
export function ausloesungAm(key: string, datum: string, land?: Bundesland): ISODateTime | undefined {
  const plan = ZEITPLAENE[key];
  if (!plan || !plan.wochentage.includes(weekday(datum))) return undefined;
  if (plan.nurWerktags && land && !istWerktag(datum, land)) return undefined;
  return `${datum}T${plan.uhrzeit}:00`;
}

/** Letzte planmäßige Auslösung bis einschließlich `jetzt` (lokaler Zeitstempel) – höchstens 14 Tage zurück. */
export function letzteAusloesung(key: string, jetzt: ISODateTime, land?: Bundesland): ISODateTime | undefined {
  if (!ZEITPLAENE[key]) return undefined;
  const tag = jetzt.slice(0, 10);
  for (let i = 0; i <= 14; i++) {
    const z = ausloesungAm(key, addDays(tag, -i), land);
    if (z && z <= jetzt) return z;
  }
  return undefined;
}

/**
 * Ist ein zeitgesteuerter Lauf fällig? Ja, wenn die letzte planmäßige Auslösung nach dem letzten Lauf liegt.
 * Ereignisgesteuerte Automationen sind nie „fällig“ – sie laufen bei ihrem Ereignis.
 */
export function laufFaellig(key: string, letzterLauf: ISODateTime | undefined, jetzt: ISODateTime, land?: Bundesland): boolean {
  const z = letzteAusloesung(key, jetzt, land);
  return !!z && (!letzterLauf || letzterLauf.slice(0, 19) < z);
}

// ───────────── Bewertung der gesparten Zeit ─────────────

export const WOCHEN_PRO_JAHR = 48;
/** Briefing-Zielwerte des 38h-Motors */
export const ZIEL_STUNDEN_WOCHE = 38;
export const ZIEL_EURO_JAHR = 36_000;

/**
 * Interner Kostensatz je gesparter Stunde – bewusst niedrig angesetzter Zielwert aus dem Briefing:
 * 36.000 € ÷ (38 Std. × 48 Wochen) = 19,74 €/Std. Er liegt unter den Vollkosten einer Fachangestellten (siehe unten),
 * damit die Hochrechnung „≈ 36.000 € pro Jahr“ eher zu niedrig als zu hoch ist.
 */
export const WERT_PRO_STUNDE = ZIEL_EURO_JAHR / (ZIEL_STUNDEN_WOCHE * WOCHEN_PRO_JAHR);

/** Annahme für die Rechner: Personalkosten einer ReFa (Arbeitgeber-Bruttokosten) pro Jahr. */
export const PERSONALKOSTEN_JAHR = 50_000;
/** Annahme: produktive Jahresarbeitsstunden (40 Std. × 48 Wochen). */
export const JAHRESARBEITSSTUNDEN = 1_920;

/** Kostensatz je Stunde aus Personalkosten und Jahresarbeitsstunden – Standard 50.000 € ÷ 1.920 Std. = 26,04 €/Std. */
export function kostensatz(personalkostenJahr = PERSONALKOSTEN_JAHR, jahresstunden = JAHRESARBEITSSTUNDEN): number {
  return jahresstunden > 0 ? personalkostenJahr / jahresstunden : 0;
}

/** ReFa-Vollkosten je Stunde (Annahme): 26,04 €. */
export const REFA_VOLLKOSTEN_STUNDE = kostensatz();

/** Jahreswert gesparter Zeit: Std. je Woche × 48 Wochen × Kostensatz. */
export function jahreswert(stundenProWoche: number, satz = WERT_PRO_STUNDE): number {
  return stundenProWoche * WOCHEN_PRO_JAHR * satz;
}
