// Animiertes Wiki & Schnellhilfe – zugleich Wissensbasis des Apex Assistenten (Support).

export type WikiVisual =
  | "cockpit" | "akte" | "posteingang" | "frist" | "rechner" | "ki" | "suche" | "motor"
  | "rvg" | "bank" | "umzug" | "assistent" | "team" | "lizenz" | "portal" | "eeb" | "vieraugen" | "status";

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
}

export const WIKI: WikiArtikel[] = [
  {
    key: "cockpit", titel: "Das Cockpit", kategorie: "Erste Schritte", dauer: "1 Min.", pfad: "/cockpit",
    kurz: "Ihr Tagesüberblick: Was ist heute fällig, was ist neu, was hat die Automatisierung bereits erledigt?",
    schritte: [
      { titel: "Tagesbriefing lesen", text: "Oben fasst die KI Ihren Tag in drei Sätzen zusammen: fällige Fristen, neue Post und anstehende Termine.", visual: "cockpit" },
      { titel: "Fristen zuerst", text: "Die Karte „Heute fällig“ zeigt alle Fristen mit Ampel. Ein Klick öffnet die Akte direkt im richtigen Reiter.", visual: "frist" },
      { titel: "Zeitersparnis sehen", text: "Der 38h-Motor zeigt, wie viele Stunden diese Woche automatisch erledigt wurden – und was das in Euro bedeutet.", visual: "motor" },
    ],
    tipps: ["Mit ⌘K bzw. Strg+K erreichen Sie von überall die globale Suche.", "Der Status oben rechts zeigt, ob beA, E-Mail, Bank und KI verbunden sind."],
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
    key: "posteingang", titel: "Posteingang mit KI-Fristenerkennung", kategorie: "Posteingang", dauer: "2 Min.", pfad: "/posteingang",
    kurz: "beA und E-Mail in einem Postfach. Die KI ordnet jede Nachricht der richtigen Akte zu und erkennt Fristen.",
    schritte: [
      { titel: "Eine Nachricht öffnen", text: "Neue Nachrichten sind fett markiert. Die KI-Karte zeigt sofort: zu welcher Akte, was drin steht, welche Frist läuft.", visual: "posteingang" },
      { titel: "Frist übernehmen", text: "Die KI erkennt das fristauslösende Ereignis. Berechnet wird die Frist vom geprüften Fristenrechner nach § 222 ZPO – mit Rechenweg zum Nachlesen.", visual: "frist" },
      { titel: "Empfangsbekenntnis abgeben", text: "Erst wenn die Frist notiert ist, wird das eEB freigegeben – ein Klick, fertig. So kann keine Zustellung „verloren gehen“.", visual: "eeb" },
    ],
    tipps: ["Fällt eine Schnittstelle aus, sehen Sie das sofort im Systemstatus – inklusive automatischer Wiederverbindung."],
  },
  {
    key: "fristen", titel: "Fristenkontrolle", kategorie: "Akten & Fristen", dauer: "2 Min.", pfad: "/fristen",
    kurz: "Fristenkalender mit Vorfristen, Vier-Augen-Prinzip und einem Fristenrechner, der jeden Rechenschritt zeigt.",
    schritte: [
      { titel: "Kalender oder Liste", text: "Wechseln Sie zwischen Wochen-, Monats- und Listenansicht. Notfristen sind rot markiert, Vorfristen gestrichelt.", visual: "frist" },
      { titel: "Frist berechnen", text: "Fristart wählen (z. B. Berufung, § 517 ZPO), Zustelldatum eingeben – fertig. Wochenenden und Feiertage Ihres Bundeslands werden automatisch berücksichtigt.", visual: "rechner" },
      { titel: "Vier-Augen-Kontrolle", text: "Jede von der KI erkannte Frist wird von einer zweiten Person bestätigt. Erst dann gilt sie als kontrolliert.", visual: "vieraugen" },
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
    tipps: ["Die KI berechnet keine Fristen selbst – das übernimmt immer der geprüfte Fristenrechner.", "Im Demo-Modus antwortet eine Offline-KI. Mit Claude-Anbindung sind die Antworten frei formuliert."],
  },
  {
    key: "falldb", titel: "Fall-Datenbank", kategorie: "KI & Recherche", dauer: "1 Min.", pfad: "/fall-datenbank",
    kurz: "Rechtsprechung von BGH bis Amtsgericht in Sekunden durchsuchen – nach Stichwort, Norm oder Aktenzeichen.",
    schritte: [
      { titel: "Suchen wie Sie denken", text: "Geben Sie einen Sachverhalt ein, z. B. „Kündigung wegen Pfandbon nach 30 Jahren“. Die Suche versteht Umlaute, Wortformen und Normen.", visual: "suche" },
      { titel: "Filtern", text: "Nach Gericht, Rechtsgebiet und Jahr eingrenzen.", visual: "suche" },
      { titel: "In die Akte übernehmen", text: "Eine Entscheidung mit einem Klick an eine Akte heften – sie erscheint dann in der Fallanalyse.", visual: "akte" },
    ],
  },
  {
    key: "motor", titel: "Der 38h-Motor", kategorie: "Erste Schritte", dauer: "2 Min.", pfad: "/automatisierung",
    kurz: "Standard-Schriftsätze, Fristenkontrolle und Mandanten-Updates laufen autonom im Hintergrund.",
    schritte: [
      { titel: "Automationen ein- und ausschalten", text: "Jede Automation hat einen Schalter, eine klare Beschreibung und zeigt, wie viel Zeit sie pro Lauf spart.", visual: "motor" },
      { titel: "Live zusehen", text: "Die schwarze Kapsel oben („Apex Island“) zeigt, was gerade erledigt wird.", visual: "motor" },
      { titel: "Ersparnis berechnen", text: "Der Rechner zeigt, was die gesparte Zeit in Euro wert ist – auf Basis Ihres Stundensatzes.", visual: "motor" },
    ],
  },
  {
    key: "abrechnung", titel: "Abrechnung & Finanzen", kategorie: "Abrechnung", dauer: "3 Min.", pfad: "/abrechnung",
    kurz: "RVG-Rechner, Sammelabrechnung, Forderungskonto mit Zinsen nach § 288 BGB und automatischer Bankabgleich.",
    schritte: [
      { titel: "RVG berechnen", text: "Gegenstandswert eingeben, Gebührentatbestände wählen – Anrechnung nach Vorbem. 3 Abs. 4 VV RVG, Auslagenpauschale und Umsatzsteuer werden automatisch ergänzt.", visual: "rvg" },
      { titel: "Sammelabrechnung", text: "Mehrere Akten auswählen und in einem Durchgang abrechnen – als PDF, XRechnung oder ZUGFeRD.", visual: "rvg" },
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
    key: "umzug", titel: "One-Klick-Migration", kategorie: "Umzug", dauer: "2 Min.", pfad: "/umzug",
    kurz: "Wechseln Sie mit einem Klick: Akten, Kontakte und Fristen ziehen vollständig um.",
    schritte: [
      { titel: "Altsystem wählen", text: "RA-MICRO, Actaport, Advoware, ReNoStar oder eine CSV-Datei.", visual: "umzug" },
      { titel: "Vorschau prüfen", text: "Spalten werden automatisch zugeordnet. Sie sehen vorab, was übernommen wird – und was doppelt wäre.", visual: "umzug" },
      { titel: "Übernehmen", text: "Ein Klick – alle Daten sind da. Fristen werden nachgerechnet und zur Kontrolle vorgelegt.", visual: "frist" },
    ],
    tipps: ["Ihr persönlicher Ansprechpartner begleitet den Umzug und prüft mit Ihnen die ersten Akten."],
  },
  {
    key: "hilfe", titel: "Hilfe & Support", kategorie: "Erste Schritte", dauer: "1 Min.", pfad: "/hilfe",
    kurz: "Animiertes Wiki, Systemstatus und ein fester, direkter Ansprechpartner für Ihre Kanzlei.",
    schritte: [
      { titel: "Apex Assistent", text: "Unten rechts: Fragen Sie per Text oder Sprache. Der Assistent erklärt, zeigt den Weg und erledigt Aufgaben direkt.", visual: "assistent" },
      { titel: "Ihr Ansprechpartner", text: "Keine Hotline-Warteschleife: Sie erreichen Ihre persönliche Ansprechpartnerin direkt.", visual: "team" },
      { titel: "Systemstatus", text: "Offen und ehrlich: Sie sehen jederzeit, ob beA, E-Mail, Bank und KI laufen – und was gerade getan wird.", visual: "status" },
    ],
  },
  {
    key: "einstellungen", titel: "Einstellungen", kategorie: "Kanzlei & Team", dauer: "1 Min.", pfad: "/einstellungen",
    kurz: "Kanzleidaten, Team & Zugänge, Lizenz, KI-Einstellungen und Darstellung.",
    schritte: [
      { titel: "Team einladen", text: "Neue Kolleginnen und Kollegen mit Rolle anlegen – sie erhalten ein Startpasswort.", visual: "team" },
      { titel: "Lizenz", text: "Lifetime-Lizenz: einmal investiert, keine Monatsgebühren. Updates werden vorher in einer Testumgebung geprüft.", visual: "lizenz" },
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
    kurz: "Der Assistent beantwortet Fragen zur Software, sucht in Ihren Akten und erledigt Aufgaben – per Sprache.",
    schritte: [
      { titel: "Öffnen", text: "Tippen Sie unten rechts auf die leuchtende Kugel.", visual: "assistent" },
      { titel: "Sprechen", text: "Mikrofon antippen und frei sprechen, z. B. „Welche Fristen laufen diese Woche ab?“ oder „Lege eine Wiedervorlage für Akte 142 in drei Tagen an.“", visual: "assistent" },
      { titel: "Ergebnis", text: "Der Assistent antwortet hörbar, zeigt Fundstellen und fragt vor jeder Änderung nach.", visual: "assistent" },
    ],
  },
  {
    key: "bankabgleich", titel: "Zahlungen automatisch zuordnen", kategorie: "Abrechnung", dauer: "1 Min.", pfad: "/abrechnung?tab=bank",
    kurz: "So bucht AnwaltApex Zahlungseingänge selbstständig auf Rechnungen und Aktenkonten.",
    schritte: [
      { titel: "Abgleich starten", text: "„Abgleich starten“ prüft alle offenen Umsätze gegen offene Rechnungen.", visual: "bank" },
      { titel: "Sicherheit prüfen", text: "Rechnungsnummer im Verwendungszweck = sicher. Nur Name und Betrag = Vorschlag zur Bestätigung.", visual: "bank" },
      { titel: "Fremdgeld", text: "Zahlungen Dritter für Mandanten werden als Fremdgeld markiert – mit Erinnerung zur unverzüglichen Weiterleitung (§ 43a Abs. 5 BRAO).", visual: "bank" },
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
