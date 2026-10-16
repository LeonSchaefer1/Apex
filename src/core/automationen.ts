// Der 38h-Automatisierungs-Motor: Routineprozesse, die autonom im Hintergrund laufen.
import type { Automation } from "./types";

export const AUTOMATION_DEFS: Omit<Automation, "id" | "laeufe" | "letzterLauf" | "aktiv">[] = [
  {
    key: "posteingang-fristen", name: "Fristen aus Posteingang erkennen", kategorie: "Posteingang",
    beschreibung: "Liest jede beA-Nachricht und E-Mail, ordnet sie der Akte zu und schlägt Fristen samt Vorfrist vor – berechnet vom geprüften Fristenrechner.",
    ausloeser: "Neue beA-Nachricht oder E-Mail", minutenProLauf: 6,
    schritte: ["Dokument lesen (OCR)", "Akte über Aktenzeichen & Parteien erkennen", "Fristauslösendes Ereignis bestimmen", "Frist nach § 222 ZPO berechnen", "Zur Vier-Augen-Kontrolle vorlegen"],
  },
  {
    key: "mandatsaufnahme", name: "Mandatsaufnahme-Paket", kategorie: "Mandanten",
    beschreibung: "Erstellt beim Anlegen einer Akte Vollmacht, Mandatsbestätigung und Datenschutzhinweise und dokumentiert die vor Übernahme erteilten Hinweise zur Abrechnung nach Gegenstandswert (§ 49b Abs. 5 BRAO) – in Arbeitssachen auch zum Ausschluss der Kostenerstattung (§ 12a Abs. 1 S. 2 ArbGG).",
    ausloeser: "Neue Akte angelegt", minutenProLauf: 25,
    schritte: ["Mandantendaten übernehmen", "Vollmacht erzeugen", "Mandatsbestätigung & Datenschutzhinweise", "Hinweise § 49b BRAO / § 12a ArbGG zur Bestätigung", "Zur digitalen Unterschrift senden"],
  },
  {
    key: "deckungsanfrage", name: "Deckungsanfrage an Rechtsschutzversicherung", kategorie: "Mandanten",
    beschreibung: "Sendet automatisch eine vollständige Deckungsanfrage mit Sachverhalt und Unterlagen an die Rechtsschutzversicherung und überwacht die Antwort.",
    ausloeser: "Akte mit Rechtsschutzversicherung angelegt", minutenProLauf: 15,
    schritte: ["Sachverhalt zusammenfassen", "Versicherungsdaten prüfen", "Anfrage versenden", "Wiedervorlage in 7 Tagen setzen"],
  },
  {
    key: "mandanten-update", name: "Wöchentliches Mandanten-Update", kategorie: "Mandanten",
    beschreibung: "Informiert Mandantinnen und Mandanten jeden Freitag verständlich über den Stand ihrer Sache – über das Mandantenportal oder per E-Mail.",
    ausloeser: "Jeden Freitag, 14:00 Uhr", minutenProLauf: 10,
    schritte: ["Neue Ereignisse der Woche sammeln", "Laienverständlich formulieren", "Durch Anwalt freigeben lassen (optional)", "Versenden"],
  },
  {
    key: "vorfristen", name: "Vorfristen & Wiedervorlagen setzen", kategorie: "Fristen",
    beschreibung: "Legt zu jeder Frist automatisch eine Vorfrist auf den vorherigen Werktag und erinnert Verantwortliche – mit Eskalation an die Vertretung.",
    ausloeser: "Frist eingetragen", minutenProLauf: 4,
    schritte: ["Vorfrist berechnen", "Verantwortliche benachrichtigen", "Eskalation bei Abwesenheit"],
  },
  {
    key: "eeb", name: "Empfangsbekenntnis (eEB) vorbereiten", kategorie: "Posteingang",
    beschreibung: "Bereitet das elektronische Empfangsbekenntnis vor, sobald die Frist notiert ist – Abgabe mit einem Klick.",
    ausloeser: "Zustellung gegen eEB", minutenProLauf: 5,
    schritte: ["Zustellungsdatum prüfen", "Frist notiert?", "eEB vorbereiten", "Abgabe nach Freigabe"],
  },
  {
    key: "bankabgleich", name: "Bankabgleich & Zahlungszuordnung", kategorie: "Finanzen",
    beschreibung: "Gleicht Kontoumsätze (CAMT.053) mit offenen Rechnungen und Aktenkonten ab und bucht Zahlungen automatisch.",
    ausloeser: "Neue Kontoumsätze (stündlich)", minutenProLauf: 8,
    schritte: ["Umsätze abrufen", "Rechnungsnummer & Aktenzeichen erkennen", "Betrag und Zahler abgleichen", "Buchen oder zur Prüfung vorlegen"],
  },
  {
    key: "mahnwesen", name: "Zahlungserinnerung nach 14 Tagen", kategorie: "Finanzen",
    beschreibung: "Erinnert höflich an offene Rechnungen und setzt nach erfolgloser zweiter Erinnerung eine Wiedervorlage für die Anwältin.",
    ausloeser: "Rechnung 14 Tage überfällig", minutenProLauf: 7,
    schritte: ["Überfällige Rechnungen finden", "Erinnerung erzeugen", "Versenden", "Wiedervorlage setzen"],
  },
  {
    key: "kostenfestsetzung", name: "Kostenfestsetzungsantrag nach Urteil", kategorie: "Dokumente",
    beschreibung: "Erstellt nach einem obsiegenden Urteil den Kostenfestsetzungsantrag (§ 104 ZPO) aus den Gebühren der Akte.",
    ausloeser: "Urteil in Akte eingegangen", minutenProLauf: 20,
    schritte: ["Kostengrundentscheidung lesen", "Gebühren aus Aktenkonto übernehmen", "Antrag erzeugen", "Zur Unterschrift vorlegen"],
  },
  {
    key: "archivierung", name: "Archivierung mit Aufbewahrungsfrist", kategorie: "Dokumente",
    beschreibung: "Schließt erledigte Akten ab, prüft offene Posten und überwacht die Aufbewahrungsfrist der Handakte (§ 50 BRAO).",
    ausloeser: "Akte auf „abgeschlossen“ gesetzt", minutenProLauf: 6,
    schritte: ["Offene Fristen & Posten prüfen", "Akte revisionssicher archivieren", "Löschfrist vormerken"],
  },
  {
    key: "zeiterfassung", name: "Zeiterfassung vorschlagen", kategorie: "Finanzen",
    beschreibung: "Schlägt aus Telefonaten, E-Mails und bearbeiteten Dokumenten Zeiteinträge vor – nichts Abrechenbares geht mehr verloren.",
    ausloeser: "Täglich, 18:00 Uhr", minutenProLauf: 5,
    schritte: ["Tätigkeiten des Tages sammeln", "Akten zuordnen", "Vorschläge zur Bestätigung"],
  },
  {
    key: "zuordnung", name: "Posteingang den Akten zuordnen", kategorie: "Posteingang",
    beschreibung: "Erkennt Aktenzeichen, Parteien und Gerichtsaktenzeichen und legt jede Nachricht in der richtigen E-Akte ab.",
    ausloeser: "Neue Nachricht", minutenProLauf: 3,
    schritte: ["Absender & Aktenzeichen erkennen", "Akte vorschlagen", "Ablegen"],
  },
];

export function automationDef(key: string) {
  return AUTOMATION_DEFS.find((a) => a.key === key);
}

/**
 * Bewertung einer automatisch erledigten Stunde mit internen Personalkosten (Kanzleimitarbeiter):
 * 38 Std./Woche × 48 Wochen ≈ 1.824 Std. ≙ ca. 36.000 € pro Jahr (Werbeaussage AnwaltApex).
 */
export const WOCHEN_PRO_JAHR = 48;
export const WERT_PRO_STUNDE = 36_000 / (38 * WOCHEN_PRO_JAHR);
