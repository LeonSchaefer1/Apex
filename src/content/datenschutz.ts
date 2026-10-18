// Einheitlicher Wortlaut zu KI-Verarbeitungsort, Unterauftragnehmern und Löschfristen – Einstellungen → KI/Datenschutz und Landing.
// Wahrheitsgemäß: Der Kanzlei-Server spricht die Anthropic-API direkt an. Eine EU-Verarbeitung wird nicht behauptet; ob es sie gibt,
// entscheidet der Auftraggeber (neutral: „auf Anfrage“, src/content/lizenz.ts).
import { KI_EU_HINWEIS } from "./lizenz";

/**
 * § 43e Abs. 4 BRAO ist eine Voraussetzung (vergleichbarer Geheimnisschutz im Ausland), keine Vertragsklausel –
 * deshalb kein „vertraglich geregelt“, sondern der Hinweis auf die Prüfung durch die Kanzlei.
 */
export const DRITTLAND = "Für die Übermittlung in die USA gelten Art. 44 ff. DSGVO. Nach § 43e Abs. 4 BRAO muss der Geheimnisschutz in den USA dem Schutz im Inland vergleichbar sein – das prüft die Kanzlei vor dem Einschalten der Live-KI.";

export const VERARBEITUNGSORT = {
  titel: "Verarbeitungsort",
  live: `Live-KI: Anthropic, PBC (USA). Ihr Kanzlei-Server sendet nur die für die jeweilige Aufgabe nötigen Inhalte – ohne Nutzung zum Training. ${DRITTLAND}`,
  demo: "Demo-KI (offline): keine Übermittlung – die Verarbeitung erfolgt lokal nach festen Regeln.",
  eu: `${KI_EU_HINWEIS}.`,
} as const;

export interface Unterauftragnehmer {
  wer: string;
  zweck: string;
  ort: string;
  wann: string;
}

/** Ohne erfundene Firmennamen – offene Punkte sind als solche gekennzeichnet. */
export const UNTERAUFTRAGNEHMER: Unterauftragnehmer[] = [
  { wer: "Rechenzentrum (deutsches Rechenzentrum)", zweck: "Hosting des Kanzlei-Servers, verschlüsselte Backups", ort: "Betreiber in Deutschland – im Prototyp noch nicht festgelegt", wann: "nur beim Betrieb im deutschen Rechenzentrum (nicht beim eigenen Server in der Kanzlei)" },
  { wer: "Anthropic, PBC", zweck: "KI-Verarbeitung (Fallanalyse, Assistent, Dokumentanalyse)", ort: "USA", wann: "nur bei eingeschalteter Live-KI" },
];

export interface Loeschfrist {
  was: string;
  frist: string;
  grundlage: string;
}

export const LOESCHKONZEPT: Loeschfrist[] = [
  { was: "Handakten", frist: "6 Jahre ab Ende des Kalenderjahres, in dem das Mandat endete", grundlage: "§ 50 Abs. 1 S. 2, 3 BRAO" },
  { was: "Bücher, Inventare, Jahresabschlüsse", frist: "10 Jahre", grundlage: "§ 147 Abs. 3 AO" },
  { was: "Buchungsbelege inkl. Rechnungen", frist: "8 Jahre", grundlage: "§ 147 Abs. 3 AO" },
  { was: "Empfangene und gesendete Handels- und Geschäftsbriefe", frist: "6 Jahre", grundlage: "§ 147 Abs. 1 Nr. 2, 3, Abs. 3 AO" },
  { was: "Protokolle (Anmeldungen, Zugriffe, KI-Anfragen ohne Inhalte)", frist: "nach Zweck, regelmäßig 1 Jahr", grundlage: "Art. 5 Abs. 1 lit. e DSGVO" },
  { was: "Testzugänge mit allen Daten", frist: "Löschung nach Testende (spätestens 30 Tage danach)", grundlage: "Art. 17 DSGVO" },
];

export const MUSTER_KENNZEICHNUNG = "Muster – Entwurf, verbindlich ist der unterzeichnete Vertrag";

export interface MusterVertrag {
  key: "43e" | "avv";
  titel: string;
  datei: string;
  beschreibung: string;
  inhalt: (k: { kanzlei: string; anschrift?: string; datum: string }) => string;
}

const KOPF = (titel: string, k: { kanzlei: string; anschrift?: string; datum: string }) =>
  [
    `${MUSTER_KENNZEICHNUNG.toUpperCase()}`,
    "",
    titel,
    "=".repeat(titel.length),
    "",
    "zwischen",
    `  ${k.kanzlei}${k.anschrift ? `, ${k.anschrift}` : ""}`,
    "  – nachfolgend „Kanzlei“ –",
    "und",
    "  Apex (Anbieter; Angaben im Prototyp nicht festgelegt)",
    "  – nachfolgend „Dienstleister“ –",
    "",
    `Stand des Musters: ${k.datum}`,
    "",
  ].join("\n");

const FUSS = [
  "",
  "-----",
  `${MUSTER_KENNZEICHNUNG}. Dieses Muster dient der Vorbereitung und ersetzt keine Rechtsberatung;`,
  "maßgeblich ist allein der von beiden Seiten unterzeichnete Vertrag.",
].join("\n");

export const MUSTER: MusterVertrag[] = [
  {
    key: "43e",
    titel: "Vertrag nach § 43e BRAO (Muster)",
    datei: "Muster-Vertrag-43e-BRAO.txt",
    beschreibung: "Inanspruchnahme von Dienstleistungen – Verschwiegenheit",
    inhalt: (k) =>
      [
        KOPF("Vereinbarung über die Inanspruchnahme von Dienstleistungen nach § 43e BRAO", k),
        "§ 1 Gegenstand",
        "Der Dienstleister stellt der Kanzlei die Kanzleisoftware Apex bereit (Betrieb auf einem eigenen Server der Kanzlei oder in einem deutschen Rechenzentrum) und erbringt Wartung und Support. Dabei kann er Kenntnis von Tatsachen erhalten, die der anwaltlichen Verschwiegenheit unterliegen.",
        "",
        "§ 2 Verschwiegenheit (§ 43e Abs. 3 BRAO, § 203 Abs. 3, 4 StGB)",
        "(1) Der Dienstleister verpflichtet sich zur Verschwiegenheit über alle Tatsachen, die ihm bei der Tätigkeit für die Kanzlei bekannt werden. Er ist über die strafrechtlichen Folgen einer Pflichtverletzung belehrt.",
        "(2) Er verpflichtet alle Personen, die er zur Vertragserfüllung heranzieht, in Textform zur Verschwiegenheit.",
        "",
        "§ 3 Zugriff nur soweit erforderlich",
        "Der Dienstleister verschafft sich Kenntnis von fremden Geheimnissen nur, soweit dies zur Vertragserfüllung erforderlich ist (§ 43e Abs. 3 Nr. 2 BRAO). Jeder Zugriff auf Mandatsdaten wird protokolliert und ist für die Kanzlei einsehbar (Einstellungen → Datenschutz → Protokoll).",
        "",
        "§ 4 Unterauftragnehmer",
        "Weitere Personen dürfen nur nach vorheriger Information der Kanzlei und nur bei entsprechender Verpflichtung zur Verschwiegenheit herangezogen werden (§ 43e Abs. 3 Nr. 3 BRAO). Die aktuelle Liste steht in Einstellungen → Datenschutz.",
        "",
        "§ 5 Dienstleistungen im Ausland (§ 43e Abs. 4 BRAO)",
        "Eine Verarbeitung außerhalb der EU erfolgt nur bei eingeschalteter Live-KI (Anthropic, PBC, USA) und nur, wenn der dort bestehende Schutz der Geheimnisse dem Schutz im Inland vergleichbar ist. Ohne Live-KI findet keine Übermittlung ins Ausland statt.",
        "",
        "§ 6 Dauer und Beendigung",
        "Die Pflichten zur Verschwiegenheit bestehen nach Vertragsende fort. Nach Vertragsende gibt der Dienstleister alle Daten heraus bzw. löscht sie nach Weisung der Kanzlei.",
        "",
        "§ 7 Form",
        "Dieser Vertrag bedarf der Textform (§ 43e Abs. 3 BRAO).",
        "",
        "Ort, Datum                         Ort, Datum",
        "__________________________         __________________________",
        "Kanzlei                            Dienstleister",
        FUSS,
      ].join("\n"),
  },
  {
    key: "avv",
    titel: "Auftragsverarbeitungsvertrag nach Art. 28 DSGVO (Muster)",
    datei: "Muster-AVV-Art-28-DSGVO.txt",
    beschreibung: "Auftragsverarbeitung mit TOM und Unterauftragnehmern",
    inhalt: (k) =>
      [
        KOPF("Vertrag über eine Auftragsverarbeitung nach Art. 28 DSGVO", k),
        "§ 1 Gegenstand und Dauer",
        "Der Auftragsverarbeiter (Dienstleister) verarbeitet personenbezogene Daten im Auftrag der Kanzlei (Verantwortliche) im Rahmen von Betrieb, Wartung und Support der Kanzleisoftware Apex. Die Dauer entspricht der Laufzeit des Lizenz- bzw. Wartungsvertrags.",
        "",
        "§ 2 Art der Daten, Kreis der Betroffenen",
        "Daten von Mandanten, Gegnern, Beteiligten, Gerichten und Behörden sowie der Beschäftigten der Kanzlei; Akteninhalte, Kommunikationsdaten, Abrechnungsdaten. Besondere Kategorien (Art. 9 DSGVO) können in Akteninhalten enthalten sein.",
        "",
        "§ 3 Weisungsgebundenheit",
        "Der Auftragsverarbeiter verarbeitet die Daten ausschließlich auf dokumentierte Weisung der Kanzlei (Art. 28 Abs. 3 lit. a DSGVO).",
        "",
        "§ 4 Vertraulichkeit",
        "Zur Verarbeitung befugte Personen sind zur Vertraulichkeit und zur Verschwiegenheit nach § 203 StGB verpflichtet (Art. 28 Abs. 3 lit. b DSGVO).",
        "",
        "§ 5 Technische und organisatorische Maßnahmen (Art. 32 DSGVO)",
        "- verschlüsselte Übertragung (TLS 1.3) und Speicherung (AES-256)",
        "- strikte Mandantentrennung auf Datenbankebene",
        "- Zwei-Faktor-Anmeldung und Sperre bei Inaktivität",
        "- tägliche, verschlüsselte Backups mit Wiederherstellungstest",
        "- Protokollierung von Zugriffen und KI-Anfragen ohne Inhalte",
        "",
        "§ 6 Unterauftragnehmer (Art. 28 Abs. 2, 4 DSGVO)",
        ...UNTERAUFTRAGNEHMER.map((u) => `- ${u.wer}: ${u.zweck}; Ort: ${u.ort}; ${u.wann}`),
        "Änderungen teilt der Auftragsverarbeiter vorab mit; die Kanzlei kann widersprechen.",
        "",
        "§ 7 Drittlandübermittlung (Art. 44 ff. DSGVO)",
        "Eine Übermittlung in die USA findet nur bei eingeschalteter Live-KI statt, auf Grundlage geeigneter Garantien (z. B. EU-Standardvertragsklauseln bzw. Angemessenheitsbeschluss) und nur mit den für die jeweilige Aufgabe nötigen Inhalten, ohne Nutzung zum Training.",
        "",
        "§ 8 Unterstützungspflichten",
        "Der Auftragsverarbeiter unterstützt die Kanzlei bei Betroffenenrechten, Meldungen nach Art. 33, 34 DSGVO und Datenschutz-Folgenabschätzungen.",
        "",
        "§ 9 Löschung und Rückgabe",
        "Nach Ende der Leistungen werden die Daten nach Wahl der Kanzlei zurückgegeben oder gelöscht, soweit keine Aufbewahrungspflicht besteht. Löschkonzept:",
        ...LOESCHKONZEPT.map((l) => `- ${l.was}: ${l.frist} (${l.grundlage})`),
        "",
        "§ 10 Kontrollrechte",
        "Die Kanzlei kann die Einhaltung dieses Vertrags überprüfen oder durch beauftragte Prüfer überprüfen lassen (Art. 28 Abs. 3 lit. h DSGVO).",
        "",
        "Ort, Datum                         Ort, Datum",
        "__________________________         __________________________",
        "Kanzlei (Verantwortliche)          Dienstleister (Auftragsverarbeiter)",
        FUSS,
      ].join("\n"),
  },
];
