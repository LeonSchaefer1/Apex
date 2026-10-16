// Animiertes Wiki & Schnellhilfe – zugleich Wissensbasis des Apex Assistenten (Support).
import { DEMO_KI_NAME } from "@/ai/status";

export type WikiVisual =
  | "cockpit" | "akte" | "posteingang" | "frist" | "rechner" | "ki" | "suche" | "motor"
  | "rvg" | "bank" | "umzug" | "assistent" | "team" | "lizenz" | "portal" | "eeb" | "vieraugen" | "status"
  /** Störungsbild beA (Artikel „beA-Störung – was tun?“): dokumentieren → Ersatzeinreichung → glaubhaft machen → nachreichen */
  | "stoerung" | "ersatzeinreichung" | "glaubhaft";

export interface WikiSchritt {
  titel: string;
  text: string;
  visual: WikiVisual;
}

export interface WikiArtikel {
  key: string;
  titel: string;
  kategorie: "Erste Schritte" | "Akten & Fristen" | "Posteingang" | "KI & Recherche" | "Abrechnung" | "Kanzlei & Team" | "Umzug";
  kurz: string;
  dauer: string;
  schritte: WikiSchritt[];
  tipps?: string[];
  pfad?: string; // Bereich in der App
  /** zusätzliche Suchbegriffe (z. B. „Apex Island“) – gelten in der Suche wie der Titel */
  stichworte?: string[];
}

export const WIKI: WikiArtikel[] = [
  {
    key: "cockpit", titel: "Das Cockpit", kategorie: "Erste Schritte", dauer: "1 Min.", pfad: "/cockpit",
    kurz: "Ihr Tagesüberblick: Was ist heute fällig, was ist neu, was hat die Automatisierung bereits erledigt?",
    schritte: [
      { titel: "Tagesbriefing lesen", text: "Oben fasst die KI Ihren Tag in drei Sätzen zusammen: fällige Fristen (Wiedervorlagen und Vorfristen getrennt genannt), neue Post und der nächste Termin.", visual: "cockpit" },
      { titel: "Fristen zuerst", text: "Die Karte „Heute & morgen fällig“ (freitags „Heute & Montag fällig“) zeigt Fristen, Wiedervorlagen und Vorfristen mit Ampel. Ein Klick öffnet die Akte direkt im richtigen Reiter.", visual: "frist" },
      { titel: "Zeitersparnis sehen", text: "Die Karte „38h-Motor“ zeigt, wie viele Stunden in den letzten 7 Tagen automatisch erledigt wurden – und was das im Rechenbeispiel in Euro bedeutet.", visual: "motor" },
    ],
    tipps: ["Mit Strg+K (Mac: ⌘K) erreichen Sie von überall die globale Suche – auch Einstellungen, „Zeit erfassen“ und die Sammelabrechnung.", "Der Status oben rechts zeigt, ob beA, E-Mail, Bank und KI verbunden sind – im Prototyp simuliert."],
  },
  {
    key: "akten", titel: "Akten & E-Akte", kategorie: "Akten & Fristen", dauer: "2 Min.", pfad: "/akten",
    kurz: "Jede Akte bündelt Dokumente, Fristen, Beteiligte, Aktenkonto, Notizen und die KI-Fallanalyse.",
    schritte: [
      { titel: "Akte finden", text: "Filtern Sie nach Sachgebiet, Status oder Bearbeiter. Spaltenbreite, Reihenfolge und Zeilendichte merkt sich AnwaltApex für Sie.", visual: "akte" },
      { titel: "Dokumente stapelweise bearbeiten", text: "In der E-Akte markieren Sie mehrere Dokumente und verschieben, benennen oder löschen sie gemeinsam – Umbenennen geht direkt per Doppelklick.", visual: "akte" },
      { titel: "Im Kontext bleiben", text: "E-Mails und beA-Nachrichten schreiben Sie direkt aus der Akte. Nach dem Senden bleiben Sie genau dort, wo Sie waren.", visual: "posteingang" },
      { titel: "KI-Fallanalyse", text: "Ein Klick auf „KI-Fallanalyse“ liefert Erfolgsaussicht, passende Präzedenzfälle und die nächsten Schritte – mit Quellen.", visual: "ki" },
    ],
    tipps: ["Neue Akten lösen automatisch das Mandatsaufnahme-Paket aus: Vollmacht, Mandatsbestätigung, Datenschutzhinweise."],
  },
  {
    key: "neue-akte", titel: "Neue Akte anlegen (Mandatsaufnahme)", kategorie: "Akten & Fristen", dauer: "1 Min.", pfad: "/akten?neu=1",
    kurz: "Unter „Akten“ → „Neue Akte“ führt die Mandatsaufnahme in vier Schritten zur fertigen Akte – samt Vollmacht und Mandatsbestätigung.",
    schritte: [
      { titel: "Mandant erfassen", text: "Bestehenden Kontakt wählen oder neu anlegen. AnwaltApex prüft dabei automatisch auf Interessenkonflikte (§ 43a Abs. 4 BRAO).", visual: "team" },
      { titel: "Sache beschreiben", text: "Sachgebiet, Gegner, Gegenstandswert und Bearbeiter angeben – das Aktenzeichen wird automatisch vergeben.", visual: "akte" },
      { titel: "Rechtsschutz & Zusammenfassung", text: "Rechtsschutzversicherung eintragen und prüfen. Vollmacht, Mandatsbestätigung und Datenschutzhinweise erstellt AnwaltApex automatisch – mit Rechtsschutz auch die Deckungsanfrage samt Wiedervorlage.", visual: "motor" },
    ],
    tipps: ["Bei einer Mandatsanfrage im Posteingang öffnet „Mandat anlegen“ die Mandatsaufnahme bereits vorausgefüllt."],
  },
  {
    key: "posteingang", titel: "Posteingang mit KI-Fristenerkennung", kategorie: "Posteingang", dauer: "2 Min.", pfad: "/posteingang",
    kurz: "beA und E-Mail in einem Postfach. Die KI ordnet jede Nachricht der richtigen Akte zu und erkennt Fristen.",
    schritte: [
      { titel: "Eine Nachricht öffnen", text: "Neue Nachrichten sind fett markiert. Die KI-Karte zeigt sofort: zu welcher Akte, was drin steht, welche Frist läuft.", visual: "posteingang" },
      { titel: "Fristen übernehmen", text: "Die KI erkennt das fristauslösende Ereignis. Berechnet wird die Frist vom geprüften Fristenrechner nach der jeweiligen Verfahrensordnung (z. B. § 222 ZPO, § 43 StPO) – mit Rechenweg zum Nachlesen.", visual: "frist" },
      { titel: "Empfangsbekenntnis abgeben", text: "Erst wenn die Frist notiert ist, wird „eEB abgeben“ freigeschaltet – ein Klick, fertig. So kann keine Zustellung „verloren gehen“.", visual: "eeb" },
    ],
    tipps: ["Fällt eine Schnittstelle aus, sehen Sie das sofort im Systemstatus – inklusive automatischer Wiederverbindung."],
  },
  {
    key: "bea-stoerung", titel: "beA-Störung – was tun?", kategorie: "Posteingang", dauer: "1 Min.", pfad: "/hilfe#status",
    kurz: "Ist das beA vorübergehend technisch nicht nutzbar, bleibt die Einreichung nach den allgemeinen Vorschriften zulässig (Telefax, Papier, Bote) – Zivilgerichte § 130d S. 2, 3 ZPO, Arbeitsgerichte § 46g S. 3, 4 ArbGG. Die Unmöglichkeit glaubhaft machen und die Störung dokumentieren.",
    stichworte: ["beA gestört", "beA Störung", "beA geht nicht", "beA ausgefallen", "beA nicht erreichbar", "Ersatzeinreichung", "technische Unmöglichkeit", "130d ZPO", "46g ArbGG", "Notfall"],
    schritte: [
      { titel: "Störung dokumentieren", text: "Sofort festhalten: Screenshot mit Uhrzeit, Fehlermeldung, Störungsmeldung der BRAK bzw. beA-Status, Uhrzeiten der Versuche. Das ist die Grundlage der Glaubhaftmachung.", visual: "stoerung" },
      { titel: "Ersatzeinreichung", text: "Bei vorübergehender technischer Unmöglichkeit nach den allgemeinen Vorschriften einreichen: Telefax, Papier oder Bote. Zivilgerichte (AG, LG, OLG, BGH): § 130d S. 2 ZPO; Arbeitsgerichte (ArbG, LAG, BAG): § 46g S. 3 ArbGG; entsprechend § 55d VwGO, § 65d SGG, § 52d FGO, § 32d StPO.", visual: "ersatzeinreichung" },
      { titel: "Glaubhaft machen", text: "Die vorübergehende Unmöglichkeit bei der Ersatzeinreichung oder unverzüglich danach glaubhaft machen – mit anwaltlicher Versicherung und geschlossener Schilderung der Abläufe (§ 130d S. 3 ZPO, § 46g S. 4 ArbGG). Auf Anforderung des Gerichts das elektronische Dokument nachreichen.", visual: "glaubhaft" },
      { titel: "Frist erst nach Nachweis erledigen", text: "Die Frist erst nach Sendebericht bzw. Eingangsbestätigung als erledigt markieren (Ausgangskontrolle). Und: Ihre feste Ansprechperson bei AnwaltApex anrufen.", visual: "frist" },
    ],
    tipps: ["Der Apex Assistent beantwortet „beA gestört – was tun?“ auch für das konkrete Gericht (z. B. LAG oder OLG)."],
  },
  {
    key: "fristen", titel: "Fristenkontrolle", kategorie: "Akten & Fristen", dauer: "2 Min.", pfad: "/fristen",
    kurz: "Fristenkalender mit Vorfristen, Vier-Augen-Kontrolle und einem Fristenrechner, der jeden Rechenschritt zeigt.",
    stichworte: ["Notfrist", "nicht verlängerbar", "kritische Frist", "Vorfrist", "Wiedervorlage", "Fristenkalender"],
    schritte: [
      { titel: "Kennzahlen lesen", text: "Oben stehen „Heute fällig“, „Nächste 7 Tage“, „Kritische Fristen“ und „Vier-Augen-Kontrolle offen“. Gezählt werden nur Notfristen und Fristen – Wiedervorlagen, Vorfristen und Termine stehen getrennt daneben.", visual: "frist" },
      { titel: "Kalender oder Liste", text: "Wechseln Sie zwischen Wochen-, Monats- und Listenansicht. Notfristen und andere nicht verlängerbare Fristen sind rot markiert, Vorfristen gestrichelt. Die Herkunft steht an jeder Frist: „Von KI erkannt“, „Durch Assistent angelegt“ (mit Ihrem Auftrag), „Automatisch angelegt“, „Von Hand eingetragen“ oder „Aus Umzug“.", visual: "frist" },
      { titel: "Frist berechnen", text: "Fristart wählen (z. B. Berufung, § 517 ZPO), Zustelldatum eingeben – fertig. Wochenenden und Feiertage am Gerichtsort bzw. in Ihrem Bundesland werden automatisch berücksichtigt.", visual: "rechner" },
      { titel: "Vier-Augen-Kontrolle", text: "Jede Notfrist und Frist bestätigt eine zweite Person mit „Kontrolle bestätigen“ – bis dahin steht „Vier-Augen-Kontrolle offen“ an der Frist.", visual: "vieraugen" },
    ],
    tipps: ["Regionale Feiertage (z. B. Mariä Himmelfahrt in Teilen Bayerns) verlängern Fristen vorsorglich nicht – Sie erhalten einen Hinweis."],
  },
  {
    key: "ki", titel: "Apex KI", kategorie: "KI & Recherche", dauer: "3 Min.", pfad: "/ki",
    kurz: "KI-Fallanalyse, Dokument-Analyse und Schriftsatz-Entwürfe. Die KI arbeitet nachvollziehbar und nennt ihre Quellen.",
    schritte: [
      { titel: "Akte wählen", text: "Wählen Sie eine Akte. Die KI liest Sachverhalt, Dokumente und Notizen.", visual: "akte" },
      { titel: "Präzedenzfälle finden", text: "Passende Entscheidungen aus der Fall-Datenbank werden gesucht und nach Relevanz bewertet.", visual: "suche" },
      { titel: "Ergebnis prüfen", text: "Sie erhalten Erfolgsaussicht, Argumente dafür und dagegen, Risiken und die nächsten Schritte – plus einen Schriftsatz-Entwurf.", visual: "ki" },
    ],
    tipps: ["Die KI berechnet keine Fristen selbst – das übernimmt immer der geprüfte Fristenrechner.", `Im Demo-Modus antwortet die ${DEMO_KI_NAME} nach festen Regeln. Mit Claude-Anbindung sind die Antworten frei formuliert.`],
  },
  {
    key: "falldb", titel: "Fall-Datenbank", kategorie: "KI & Recherche", dauer: "1 Min.", pfad: "/fall-datenbank",
    kurz: "Präzedenzfälle in Sekunden: Leitentscheidungen von BVerfG, EuGH und Bundesgerichten nach Stichwort, Norm oder Aktenzeichen durchsuchen.",
    stichworte: ["Rechtsprechung", "Urteile", "Präzedenzfälle", "Leitentscheidungen", "Recherche"],
    schritte: [
      { titel: "Suchen wie Sie denken", text: "Geben Sie einen Sachverhalt ein, z. B. „Kündigung wegen Pfandbon nach 30 Jahren“. Die Suche versteht Umlaute, Wortformen und Normen.", visual: "suche" },
      { titel: "Filtern", text: "Nach Gerichtsebene, Rechtsgebiet und Jahr eingrenzen. Im Prototyp ist die Datenbank ein kuratierter Auszug; im Produktivbetrieb wird sie an offene Rechtsprechungsquellen aller Instanzen angebunden (z. B. Open Legal Data, NeuRIS).", visual: "suche" },
      { titel: "In die Akte übernehmen", text: "Eine Entscheidung direkt an eine Akte heften – sie erscheint dann in der Fallanalyse.", visual: "akte" },
    ],
  },
  {
    key: "motor", titel: "Der 38h-Motor", kategorie: "Erste Schritte", dauer: "2 Min.", pfad: "/automatisierung",
    kurz: "Standard-Schriftsätze (z. B. Kostenfestsetzungsantrag) bereitet der 38h-Motor vor – zur Prüfung und Unterschrift. Fristenkontrolle, Zuordnung und Vorfristen laufen im Hintergrund; was die Kanzlei verlässt, geht erst nach Ihrer Freigabe hinaus. Die Apex Island oben zeigt, was zuletzt erledigt wurde.",
    stichworte: ["Apex Island", "Island", "Kapsel", "Automatisierung", "Automatiken", "Zeitersparnis", "gesparte Stunden"],
    schritte: [
      { titel: "Automatiken ein- und ausschalten", text: "Jede Automatik hat einen Schalter, eine klare Beschreibung und zeigt, wie viel Zeit sie pro Lauf spart. Zeitgesteuerte Automatiken laufen nur zu ihrer Uhrzeit (z. B. Mandanten-Update freitags um 14:00 Uhr).", visual: "motor" },
      { titel: "Freigabe vor dem Versand", text: "Jede Automatik nennt ihre Freigabestufe: Entwürfe und Schreiben nach außen (Deckungsanfrage, Zahlungserinnerung, Mandanten-Update) gehen erst nach Ihrer Freigabe hinaus; interne Schritte wie Vorfristen laufen ohne Rückfrage – nichts davon verlässt die Kanzlei.", visual: "motor" },
      { titel: "Mitverfolgen", text: "Die schwarze Kapsel oben – die Apex Island – zeigt, was der 38h-Motor zuletzt erledigt hat, und sonst die in den letzten 7 Tagen gesparte Zeit (im Prototyp Beispielwerte). Ein Klick öffnet den 38h-Motor; das × an der Island blendet sie aus (wieder einschalten unter Einstellungen → Darstellung).", visual: "motor" },
      { titel: "Ersparnis berechnen", text: "Gezählt wird je bearbeitetem Vorgang, nicht je Lauf. Der Rechner zeigt, was die gesparte Zeit im Rechenbeispiel in Euro wert ist. Das Ziel von bis zu 38 Std. je Woche ist ein Richtwert, keine Garantie.", visual: "motor" },
    ],
  },
  {
    key: "abrechnung", titel: "Abrechnung & Finanzen", kategorie: "Abrechnung", dauer: "3 Min.", pfad: "/abrechnung",
    kurz: "RVG-Rechner, Sammelabrechnung, Forderungskonto mit Zinsen nach § 288 BGB und automatischer Bankabgleich.",
    schritte: [
      { titel: "RVG berechnen", text: "Gegenstandswert eingeben, Gebührentatbestände wählen – Anrechnung nach Vorbem. 3 Abs. 4 VV RVG, Auslagenpauschale und Umsatzsteuer werden automatisch ergänzt.", visual: "rvg" },
      { titel: "Sammelabrechnung", text: "Mehrere Akten auswählen und in einem Durchgang abrechnen – als PDF oder, für Unternehmen, als E-Rechnung (XRechnung, ZUGFeRD).", visual: "rvg" },
      { titel: "Bankabgleich", text: "Kontoumsätze werden mit Rechnungen abgeglichen. Sicher erkannte Zahlungen bucht AnwaltApex selbst, unsichere legt es Ihnen vor.", visual: "bank" },
      { titel: "Forderungskonto", text: "Zinsen nach § 288 BGB taggenau, Teilzahlungen nach § 367 BGB verrechnet: erst Kosten, dann Zinsen, dann Hauptforderung.", visual: "rvg" },
    ],
  },
  {
    key: "kontakte", titel: "Kontakte", kategorie: "Akten & Fristen", dauer: "1 Min.", pfad: "/kontakte",
    kurz: "Mandanten, Gegner, Gerichte, Versicherungen – jeder Kontakt mit allen verknüpften Akten.",
    schritte: [
      { titel: "Rollen", text: "Ein Kontakt kann mehrere Rollen haben, z. B. Mandant in der einen und Gegner in einer anderen Akte. AnwaltApex warnt bei Interessenkonflikten.", visual: "team" },
    ],
  },
  {
    key: "umzug", titel: "Umzug aus Ihrer bisherigen Software", kategorie: "Umzug", dauer: "2 Min.", pfad: "/umzug",
    kurz: "Umzug in fünf Schritten – mit Vorschau und Rückgängig: Akten, Kontakte und Fristen aus Ihrer bisherigen Software ziehen vollständig um; Dokumente und Aktenkonten übernehmen Sie gemeinsam mit Ihrer festen Ansprechperson.",
    stichworte: ["Migration", "One-Klick-Migration", "Datenübernahme", "Wechsel", "Import"],
    schritte: [
      { titel: "Bisherige Software wählen", text: "RA-MICRO, ACTAPORT, Advoware, ReNoStar oder eine CSV-/Excel-Datei.", visual: "umzug" },
      { titel: "Vorschau prüfen", text: "Spalten werden automatisch zugeordnet. Sie sehen vorab, was übernommen wird – und was doppelt wäre.", visual: "umzug" },
      { titel: "Übernehmen", text: "Nach Ihrer Prüfung übernehmen – jeder Lauf lässt sich rückgängig machen. Übernommene Fristen tragen „Aus Umzug“ und gehen in die Vier-Augen-Kontrolle.", visual: "frist" },
    ],
    tipps: ["Ihre feste Ansprechperson bei AnwaltApex begleitet den Umzug und prüft mit Ihnen die ersten Akten."],
  },
  {
    key: "hilfe", titel: "Hilfe & Support", kategorie: "Erste Schritte", dauer: "1 Min.", pfad: "/hilfe",
    kurz: "Animiertes Wiki, Schnellhilfe, Systemstatus und eine feste Ansprechperson für Ihre Kanzlei.",
    stichworte: ["Support", "Ansprechpartner", "Ansprechpartnerin", "Rückruf", "Schnellhilfe"],
    schritte: [
      { titel: "Apex Assistent", text: "Unten rechts: Fragen Sie per Text oder Sprache. Der Apex Assistent erklärt, zeigt den Weg und erledigt Aufgaben direkt.", visual: "assistent" },
      { titel: "Feste Ansprechperson", text: "Keine Hotline-Warteschleife: Ihre feste Ansprechperson bei AnwaltApex ist mit Namen, Durchwahl und E-Mail direkt erreichbar – auf Wunsch mit Rückruf.", visual: "team" },
      { titel: "Systemstatus", text: "Offen und ehrlich: Sie sehen jederzeit, ob beA, E-Mail, Bank und KI laufen – und was gerade getan wird.", visual: "status" },
    ],
  },
  {
    key: "einstellungen", titel: "Einstellungen", kategorie: "Kanzlei & Team", dauer: "1 Min.", pfad: "/einstellungen",
    kurz: "Kanzleidaten, Team & Zugänge, Lizenz, KI-Einstellungen und Darstellung.",
    schritte: [
      { titel: "Team einladen", text: "Neue Kolleginnen und Kollegen mit Rolle anlegen – sie erhalten ein Startpasswort.", visual: "team" },
      { titel: "Lizenz", text: "Lifetime-Lizenz: einmal investiert, keine Monatsgebühren. Preis auf Anfrage – verbindlich im Angebot. Wartung ist optional; Umfang und Preis regelt das Angebot. Aktualisierungen werden vorher in einer Testumgebung geprüft.", visual: "lizenz" },
    ],
  },
  {
    key: "frist-berechnen", titel: "Eine Berufungsfrist berechnen", kategorie: "Akten & Fristen", dauer: "30 Sek.", pfad: "/fristen?rechner=1",
    kurz: "Schritt für Schritt: von der Zustellung bis zur eingetragenen Frist samt Vorfrist.",
    schritte: [
      { titel: "Fristenrechner öffnen", text: "Unter „Fristen“ oben rechts „Frist berechnen“ wählen – oder den Assistenten fragen: „Berechne die Berufungsfrist bei Zustellung am 16.10.“", visual: "rechner" },
      { titel: "Zustelldatum eingeben", text: "Die Monatsfrist des § 517 ZPO endet mit dem Tag, der dem Zustelltag zahlenmäßig entspricht (§ 188 Abs. 2 BGB).", visual: "rechner" },
      { titel: "Wochenende & Feiertag", text: "Fällt das Ende auf Samstag, Sonntag oder Feiertag, verschiebt § 222 Abs. 2 ZPO auf den nächsten Werktag. Der Rechenweg wird gespeichert.", visual: "frist" },
    ],
  },
  {
    key: "assistent", titel: "Mit dem Apex Assistenten sprechen", kategorie: "Erste Schritte", dauer: "1 Min.",
    kurz: "Der Apex Assistent beantwortet Fragen zur Software, nennt Zahlen Ihrer Kanzlei, sucht in Ihren Akten und erledigt Aufgaben – auch per Sprache.",
    schritte: [
      { titel: "Öffnen", text: "Tippen Sie unten rechts auf die leuchtende Kugel.", visual: "assistent" },
      { titel: "Sprechen", text: "Mikrofon antippen und frei sprechen, z. B. „Welche Fristen laufen diese Woche ab?“, „Wie hoch sind die offenen Forderungen?“ oder „Lege eine Wiedervorlage für Akte 142 in drei Tagen an.“", visual: "assistent" },
      { titel: "Ergebnis", text: "Der Apex Assistent antwortet hörbar, zeigt Fundstellen und Werkzeug-Chips („Fristenkalender geprüft“). Einträge schlägt er als Karte vor – eingetragen wird erst nach „Eintragen“, danach gibt es „Rückgängig“. Bei mehreren passenden Akten fragt er nach.", visual: "assistent" },
    ],
  },
  {
    key: "bankabgleich", titel: "Zahlungen automatisch zuordnen", kategorie: "Abrechnung", dauer: "1 Min.", pfad: "/abrechnung?tab=bank",
    kurz: "So ordnet AnwaltApex Zahlungseingänge Rechnungen und Aktenkonten zu – eindeutige Treffer ab 90 % gebucht, alle anderen zur Bestätigung.",
    schritte: [
      { titel: "Abgleich starten", text: "„Abgleich starten“ prüft alle offenen Umsätze gegen offene Rechnungen.", visual: "bank" },
      { titel: "Sicherheit prüfen", text: "Rechnungsnummer im Verwendungszweck = sicher. Nur Name und Betrag = Vorschlag zur Bestätigung.", visual: "bank" },
      { titel: "Fremdgeld", text: "Zahlungen Dritter für Mandanten werden als Fremdgeld markiert – mit Erinnerung zur unverzüglichen Weiterleitung (§ 43a Abs. 7 BRAO, § 4 BORA).", visual: "bank" },
    ],
  },
  {
    key: "zugang", titel: "Zugänge für Ihr Team und Testkanzleien", kategorie: "Kanzlei & Team", dauer: "1 Min.",
    kurz: "Jede Kanzlei hat eigene Zugänge und einen streng getrennten Datenbestand.",
    schritte: [
      { titel: "Mandantentrennung", text: "Daten jeder Kanzlei sind vollständig getrennt – technisch auf Datenbankebene erzwungen.", visual: "team" },
      { titel: "Testzugang", text: "Über die Apex Console legt das AnwaltApex-Team Testkanzleien mit eigenem Login an – mit oder ohne Beispieldaten.", visual: "lizenz" },
    ],
  },
];

export function artikel(key: string | null | undefined): WikiArtikel | undefined {
  return WIKI.find((w) => w.key === key);
}
