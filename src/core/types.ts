// AnwaltApex Domänenmodell – gemeinsam genutzt von Web-App und Server.

export type ID = string;
export type ISODate = string; // "2026-10-16"
export type ISODateTime = string; // "2026-10-16T09:30:00.000Z"

export type Bundesland =
  | "BW" | "BY" | "BE" | "BB" | "HB" | "HH" | "HE" | "MV"
  | "NI" | "NW" | "RP" | "SL" | "SN" | "ST" | "SH" | "TH";

export type Rolle = "partner" | "anwalt" | "refa" | "admin" | "azubi";

export interface Ansprechpartner {
  name: string;
  /** Angezeigte Funktion, z. B. „Ihre feste Ansprechpartnerin“ */
  rolle: string;
  /** Grammatisch passende Bezeichnung – alle Texte formulieren daraus („Ihre feste Ansprechpartnerin: …“) */
  bezeichnung?: "Ansprechpartner" | "Ansprechpartnerin";
  telefon: string;
  email: string;
  initialen: string;
  verfuegbar: string; // z. B. "Mo–Fr 8–19 Uhr"
}

export interface Tenant {
  id: ID;
  name: string;
  kurzname: string;
  stadt: string;
  adresse: string;
  bundesland: Bundesland;
  schwerpunkte: string[];
  lizenz: { typ: "lifetime"; seit: ISODate; arbeitsplaetze: number; lizenzNr: string };
  ansprechpartner: Ansprechpartner;
  farbe: string; // Akzent im Kanzlei-Logo
  createdAt: ISODateTime;
  status?: "aktiv" | "test" | "pausiert";
  testBis?: ISODate;
  /** Pflichtangabe auf Rechnungen (§ 14 Abs. 4 S. 1 Nr. 2 UStG): Steuernummer oder USt-IdNr. der Kanzlei. */
  steuernummer?: string;
  ustIdNr?: string;
  /** Geschäftskonto der Kanzlei für Rechnungen (IBAN mit Prüfziffer, optional BIC und Bank). */
  geschaeftskonto?: { iban: string; bic?: string; bank?: string };
  /** Sicherheitseinstellungen der Kanzlei: Zwei-Faktor-Pflicht und Sperre bei Inaktivität (Minuten, Standard 15). */
  sicherheit?: { zweiFaktorPflicht?: boolean; sperreMinuten?: 5 | 10 | 15 | 30 };
}

export interface User {
  id: ID;
  tenantId: ID;
  name: string;
  email: string;
  rolle: Rolle;
  titel: string; // "Rechtsanwältin", "Rechtsanwaltsfachangestellte"
  initialen: string;
  farbe: string;
  stundensatz?: number;
  /** Förmliche Anrede („Sehr geehrte Frau …“, „Guten Tag, Frau …“). Fehlt = keine Anrede bestimmbar. */
  anrede?: "Frau" | "Herr";
  /** Abwesenheit mit Vertretung (§ 53 BRAO). */
  /**
   * Abwesenheit (§ 53 BRAO): `vertretungId` vertritt – bei Berufsträgern nur Partner oder Rechtsanwälte;
   * `sachbearbeitungId` übernimmt optional die Sachbearbeitung (z. B. eine Fachangestellte).
   */
  abwesenheit?: { von: ISODate; bis: ISODate; vertretungId?: ID; sachbearbeitungId?: ID; grund?: string };
  /** Zugang vorübergehend gesperrt (umkehrbar) – Anmeldung und Sitzung verweigert. */
  deaktiviert?: boolean;
}

export type KontaktRolle = "mandant" | "gegner" | "gegneranwalt" | "gericht" | "versicherung" | "behoerde" | "sonstige";

export interface Kontakt {
  id: ID;
  typ: "person" | "organisation";
  name: string; // Anzeigename
  vorname?: string;
  nachname?: string;
  firma?: string;
  anrede?: "Herr" | "Frau" | "";
  email?: string;
  telefon?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  rollen: KontaktRolle[];
  notiz?: string;
  safeId?: string; // beA SAFE-ID
  createdAt: ISODateTime;
  /** Zusatzangaben für die Rolle „Versicherung“ (Rechtsschutz). */
  versicherung?: { schadenabteilung?: string; postfach?: string; ansprechpartner?: string; drebisKennung?: string };
  /** Herkunft aus einem Umzugslauf (für Rückgängig). */
  umzugLaufId?: string;
}

export type Sachgebiet =
  | "Arbeitsrecht" | "Mietrecht" | "Verkehrsrecht" | "Familienrecht" | "Erbrecht"
  | "Strafrecht" | "Forderungseinzug" | "Vertragsrecht" | "Baurecht" | "Verwaltungsrecht";

export type AktenPhase =
  | "Mandatsaufnahme" | "Außergerichtlich" | "Gerichtlich" | "Beweisaufnahme"
  | "Urteil" | "Vollstreckung" | "Abgeschlossen";

export interface Rechtsschutz {
  versicherung: string;
  versicherungsnummer: string;
  schadennummer?: string;
  deckung: "angefragt" | "erteilt" | "abgelehnt" | "offen";
  selbstbeteiligung?: number;
}

export interface Akte {
  id: ID;
  aktenzeichen: string; // "142/26"
  titel: string; // "Weber ./. Kröger Logistik GmbH"
  sachgebiet: Sachgebiet;
  phase: AktenPhase;
  status: "offen" | "ruhend" | "abgeschlossen";
  mandantId: ID;
  gegnerId?: ID;
  gegneranwaltId?: ID;
  gerichtId?: ID;
  gerichtsAz?: string;
  gegenstandswert: number;
  bearbeiterId: ID; // Rechtsanwalt
  sachbearbeiterId?: ID; // ReFa
  rsv?: Rechtsschutz;
  beschreibung: string;
  schlagworte: string[];
  prioritaet: "hoch" | "normal" | "niedrig";
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  abgeschlossenAm?: ISODate;
  forderung?: Forderungsdaten; // nur Forderungseinzug
  mandantenportal?: boolean;
  entscheidungen?: string[]; // an die Akte geheftete Entscheidungen (Fall-Datenbank)
  /** letzte KI-Fallanalyse: Kurzinfo (prozent = KI-Schätzwert, Anzeige verbal über `stufe`) und vollständiges Ergebnis zum Wiederanzeigen */
  kiAnalyse?: { erstelltAm: string; prozent: number; quelle: string; stufe?: "hoch" | "mittel" | "gering"; ergebnis?: KiAnalyseErgebnis };
  /** Vergütungsvereinbarung (§ 3a RVG, Textform) – Voraussetzung für die Abrechnung nach Zeitaufwand. */
  verguetungsvereinbarung?: { datum: ISODate; stundensatz?: number; erfasstVon?: ID };
  /** Dokumentierte Kollisionsprüfung (§ 43a Abs. 4 BRAO) mit Entscheidung und Vermerk. */
  kollisionspruefung?: { am: ISODateTime; von: ID; treffer: string[]; entscheidung: "uebernommen" | "abgelehnt"; vermerk: string };
  /** Herkunft aus einem Umzugslauf (für Rückgängig). */
  umzugLaufId?: string;
  /** Abrechnung geprüft (z. B. nach Umzug vor der Sammelabrechnung). */
  abrechnungGeprueft?: boolean;
  /** Abschlussdatum unbekannt (z. B. Archivakte aus dem Umzug) – `abgeschlossenAm` ist dann nur das Übernahmedatum. */
  abschlussdatumUnbekannt?: boolean;
}

export interface Forderungsdaten {
  hauptforderung: number;
  faelligAb: ISODate; // Verzugsbeginn
  verbraucher: boolean; // § 288 Abs. 1 (5 PP) vs. Abs. 2 (9 PP)
  schuldnerId?: ID;
  titel?: string; // z. B. Vollstreckungsbescheid AG Coburg
}

export type FristTyp = "notfrist" | "frist" | "vorfrist" | "wiedervorlage" | "termin";

export interface Frist {
  id: ID;
  akteId: ID;
  titel: string;
  typ: FristTyp;
  datum: ISODate;
  uhrzeit?: string;
  ort?: string;
  vorfrist?: ISODate;
  regelKey?: string; // Verweis auf FRIST_REGELN
  grundlage?: string; // "§ 517 ZPO"
  ereignisDatum?: ISODate;
  rechenweg?: string[];
  status: "offen" | "erledigt";
  erledigtAm?: ISODateTime;
  erledigtVon?: ID;
  verantwortlichId: ID;
  quelle: "manuell" | "ki" | "automatisch" | "migration";
  kontrolliertVon?: ID; // Vier-Augen-Prinzip
  bezugId?: ID; // Vorfrist → zugehörige Frist
  notiz?: string;
  createdAt: ISODateTime;
  /** Ausgangskontrolle: Nachweis bzw. Grund der Erledigung. */
  erledigtNachweis?: {
    art: "bea" | "fax" | "bote" | "post" | "persoenlich" | "ueberweisung" | "gestrichen" | "sonstiges";
    text?: string;
    nachrichtId?: ID;
    kontrolleOffenBestaetigt?: boolean;
    /** Tatsächliche Versand- bzw. Zahlungszeit (nicht die Zeit des Eintrags). */
    versandAm?: ISODateTime;
    /** Nachweis über einen Bankumsatz (z. B. Weiterleitung von Fremdgeld). */
    transaktionId?: ID;
  };
  /** Vier-Augen-Kontrolle: Korrektur der notierten Frist angefordert (mit Grund). */
  korrekturAngefordert?: { vonId: ID; am: ISODateTime; grund: string };
  /** Korrekturen der notierten Frist mit vorherigem Stand (nachvollziehbar, nicht überschrieben). */
  korrekturen?: { am: ISODateTime; vonId: ID; grund: string; vorher: { datum: ISODate; ereignisDatum?: ISODate; regelKey?: string; titel: string } }[];
  /** Herkunft aus einem Umzugslauf (für Rückgängig). */
  umzugLaufId?: string;
  /**
   * Ort, mit dessen Feiertagen die Frist berechnet wurde (§ 222 Abs. 2 ZPO): Bundesland, optional Gericht,
   * und woher der Ort stammt – Gericht der Nachricht, Gericht der Akte, Kanzleisitz oder von Hand gewählt.
   */
  gerichtsort?: FristGerichtsort;
}

export interface FristGerichtsort {
  land: Bundesland;
  gericht?: string;
  quelle: "gericht" | "akte" | "kanzleisitz" | "hand";
}

export type DokumentArt =
  | "schriftsatz" | "brief" | "urteil" | "beschluss" | "vollmacht" | "rechnung"
  | "email" | "bea" | "notiz" | "anlage" | "vertrag" | "gutachten";

/** Vollständig gespeicherte KI-Fallanalyse einer Akte (gleiche Form wie `Fallanalyse` in src/ai/fallanalyse.ts). */
export interface KiAnalyseErgebnis {
  zusammenfassung: string;
  rechtsfragen: string[];
  erfolgsaussicht: { prozent: number; stufe: "hoch" | "mittel" | "gering"; begruendung: string };
  argumentePro: string[];
  argumenteContra: string[];
  praezedenzfaelle: { id: string; gericht: string; az: string; titel: string; relevanz: number; warum: string }[];
  naechsteSchritte: { titel: string; detail: string }[];
  risiken: string[];
  entwurf: { titel: string; text: string };
  quelle: "server" | "artefakt" | "demo";
  dauerMs: number;
  erstelltAm: string;
}

export interface Dokument {
  id: ID;
  akteId: ID;
  name: string;
  art: DokumentArt;
  ordner: "Korrespondenz" | "Schriftsätze" | "Gericht" | "Mandant" | "Rechnungen" | "Anlagen";
  format: "pdf" | "docx" | "eml" | "txt";
  groesseKb: number;
  seiten?: number;
  inhalt: string; // Volltext (OCR) für Suche & Vorschau
  quelle: "bea" | "email" | "upload" | "generiert" | "scan" | "migration";
  autorId?: ID;
  version: number;
  createdAt: ISODateTime;
  ki?: { zusammenfassung?: string; erkannteFristen?: number };
  /** Herkunft aus einem Umzugslauf (für Rückgängig). */
  umzugLaufId?: string;
  /** Entwurf aus der KI-Fallanalyse vom … (Zeitstempel `erstelltAm` der Analyse) – erkennt „schon gespeichert“ und neue Versionen. */
  kiAnalyseVom?: string;
  /** Bearbeitungsstand eigener Dokumente. Fehlt = abgeschlossen bzw. eingegangen. */
  status?: "entwurf" | "freigegeben" | "versandt";
  /** Im Mandantenportal freigegeben (wann, von wem). Nur Dokumente mit diesem Feld sieht der Mandant. */
  portal?: { am: ISODateTime; vonId: ID };
}

export interface Anhang {
  name: string;
  groesseKb: number;
}

export interface KiFristVorschlag {
  regelKey: string;
  titel: string;
  ereignisDatum: ISODate;
  datum: ISODate;
  vorfrist?: ISODate;
  grundlage: string;
  rechenweg: string[];
  typ: FristTyp;
}

export interface KiVorschlag {
  akteId?: ID;
  sicherheit: number; // 0..1
  zusammenfassung: string;
  frist?: KiFristVorschlag; // erste (wichtigste) Frist
  fristen?: KiFristVorschlag[]; // alle erkannten Fristen
  termin?: { datum: ISODate; uhrzeit?: string; ort?: string; titel: string };
  akteGrund?: string;
  typ?: string;
  aktionen?: string[];
  aktion?: string;
  dokumentArt?: DokumentArt;
}

export interface Nachricht {
  id: ID;
  kanal: "bea" | "email";
  richtung: "ein" | "aus";
  von: string;
  vonAdresse?: string;
  an: string;
  betreff: string;
  text: string;
  eingang: ISODateTime;
  akteId?: ID;
  anhaenge: Anhang[];
  status: "neu" | "gelesen" | "erledigt";
  zugeordnet: boolean;
  eebErforderlich?: boolean; // elektronisches Empfangsbekenntnis
  eebAbgegeben?: ISODateTime;
  ki?: KiVorschlag;
  kiStatus?: "ausstehend" | "analysiert" | "uebernommen" | "verworfen";
  /** Erster Lesezeitpunkt (eEB-Protokoll). */
  geoeffnetAm?: ISODateTime;
  geoeffnetVon?: ID;
  /** Im eEB angegebenes Zustellungsdatum (Standard: Eingangstag, änderbar). */
  eebZustellungsdatum?: ISODate;
  /** Berufsträger, der das eEB abgegeben hat. */
  eebAbgegebenVon?: ID;
  /** „Zur Abgabe vorlegen“ (z. B. durch die ReFa an die Anwältin). */
  eebVorlage?: { von: ID; am: ISODateTime; an?: ID; notiz?: string };
}

export interface RechnungsPosition {
  vv: string; // Nr. VV RVG oder "Std"
  bezeichnung: string;
  satz?: number;
  gegenstandswert?: number;
  menge?: number;
  betrag: number;
}

export interface Rechnung {
  id: ID;
  nummer: string; // "RE-2026-0142"
  akteId: ID;
  empfaengerId: ID;
  datum: ISODate;
  faellig: ISODate;
  positionen: RechnungsPosition[];
  netto: number;
  ust: number;
  brutto: number;
  status: "entwurf" | "gestellt" | "bezahlt" | "teilbezahlt" | "storniert";
  bezahlt: number;
  bezahltAm?: ISODate;
  format: "PDF" | "XRechnung" | "ZUGFeRD";
  createdAt: ISODateTime;
  /** „vorschuss“: Vorschussrechnung nach § 9 RVG (Vergütung noch nicht fällig, § 8 Abs. 1 RVG). Fehlt = Rechnung. */
  art?: "rechnung" | "vorschuss";
  /** Mit dieser Rechnung abgerechnete Zeiteinträge – werden bei Löschen des Entwurfs bzw. Storno wieder freigegeben. */
  zeitIds?: ID[];
  /** Storno: eigene Belegnummer aus dem Rechnungsnummernkreis und Datum der Stornorechnung. */
  stornoNummer?: string;
  storniertAm?: ISODate;
  /** Aufteilung bei Rechtsschutz: RSV-Anteil und Selbstbeteiligung des Mandanten. */
  /** Aufteilung bei Rechtsschutz; `zugesagt: false` = Deckungszusage stand bei der Abrechnung noch aus (Text „vorbehaltlich der Deckungszusage“). */
  rsv?: { versicherung: string; versicherungsnummer?: string; schadennummer?: string; selbstbeteiligung: number; anteilVersicherung: number; zugesagt?: boolean };
  /** Korrekturrechnung: Verweis auf die stornierte Ursprungsrechnung. */
  korrekturVon?: ID;
}

export type BuchungsArt = "honorar" | "vorschuss" | "fremdgeld" | "auslage" | "zahlung" | "gerichtskosten" | "zinsen" | "kosten";

export interface Buchung {
  id: ID;
  akteId: ID;
  datum: ISODate;
  art: BuchungsArt;
  betrag: number; // + Eingang / Forderung, − Ausgang
  text: string;
  rechnungId?: ID;
  transaktionId?: ID;
  fremdgeld?: boolean; // § 43a Abs. 7 BRAO
  /** Weiterleitung von Fremdgeld mit Empfänger, IBAN und Wirkung. */
  weiterleitung?: {
    empfaenger: string;
    iban: string;
    verwendungszweck: string;
    wirkung: "sepa-datei" | "bereits-ueberwiesen";
    am: ISODateTime;
    von: ID;
  };
}

export interface Transaktion {
  id: ID;
  datum: ISODate;
  betrag: number;
  gegenpartei: string;
  iban: string;
  verwendungszweck: string;
  status: "offen" | "zugeordnet" | "ignoriert";
  /** Zuordnung im Bankabgleich – mit Zeitpunkt (`am`) und Person (`von`, bei manueller Zuordnung) für den Reiter „Gebucht“. */
  zuordnung?: {
    rechnungId?: ID;
    akteId?: ID;
    sicherheit: number;
    durch: "auto" | "manuell";
    grund: string;
    am?: ISODateTime;
    von?: ID;
    /** Buchungsart der Zuordnung: Rechnungszahlung, Vorschuss/Honorar, Fremdgeld (§ 43a Abs. 7 BRAO) oder Kosten. */
    art?: "rechnung" | "vorschuss" | "fremdgeld" | "kosten";
  };
  /** Gespeicherter Zuordnungsvorschlag des Bankabgleichs (übersteht Reiterwechsel und Neuladen). */
  vorschlag?: { rechnungId?: ID; akteId?: ID; sicherheit: number; grund: string; am: ISODateTime };
  /** Abgelehnte Vorschläge – werden nicht erneut angeboten. */
  abgelehnt?: { rechnungId?: ID; akteId?: ID; am: ISODateTime; von?: ID }[];
}

export interface Zeiteintrag {
  id: ID;
  akteId: ID;
  userId: ID;
  datum: ISODate;
  minuten: number;
  taetigkeit: string;
  abrechenbar: boolean;
  abgerechnet?: boolean;
}

export interface Automation {
  id: ID;
  key: string;
  name: string;
  beschreibung: string;
  ausloeser: string;
  schritte: string[];
  aktiv: boolean;
  /** Gesparte Minuten je tatsächlich bearbeitetem Vorgang (nicht je Lauf) – der Name ist historisch. */
  minutenProLauf: number;
  /** Was als ein Vorgang zählt, z. B. „je zugeordnetem Umsatz“ */
  vorgang?: string;
  laeufe: number;
  letzterLauf?: ISODateTime;
  kategorie: "Fristen" | "Mandanten" | "Dokumente" | "Finanzen" | "Posteingang";
  /** Freigabestufe in Worten, z. B. „Entwurf – Versand erst nach Ihrer Freigabe“. */
  freigabe?: string;
  /** Pausiert seit (Zeitpunkt) und von wem – gesetzt beim Ausschalten, gelöscht beim Einschalten. */
  pausiertAm?: ISODateTime;
  pausiertVon?: ID;
}

export interface Aktivitaet {
  id: ID;
  zeit: ISODateTime;
  akteur: "nutzer" | "ki" | "automation" | "system";
  userId?: ID;
  akteId?: ID;
  automationKey?: string;
  text: string;
  minutenGespart?: number;
  icon?: string;
  /** Beispieleintrag aus den Demodaten – nicht von einer echten Person ausgelöst. */
  beispiel?: boolean;
  /** Kategorie im Kanzleiprotokoll – „anmeldung“: Anmeldungen, Abmeldungen, Fehlversuche, Sperre wegen Inaktivität. */
  kategorie?: "anmeldung";
  /** Zusätzlich als Benachrichtigung (Glocke) für Partner und Administration, z. B. „3 fehlgeschlagene Anmeldungen für …“. */
  meldung?: boolean;
}

export interface Notiz {
  id: ID;
  akteId: ID;
  userId: ID;
  text: string;
  zeit: ISODateTime;
}

/**
 * Umzugsprotokoll (Datenübernahme aus der Altsoftware): je Lauf Datum, Datei, Zahlen und die Daten für „Rückgängig“ –
 * gespeichert beim Datenbestand der Kanzlei, damit ein Lauf auch nach dem Neuladen und an jedem Arbeitsplatz umkehrbar ist.
 */
export interface UmzugLauf {
  id: ID;
  datum: ISODateTime;
  system: string;
  datei: string;
  userId: ID;
  zahlen: {
    aktenNeu: number;
    aktenAktualisiert: number;
    archiviert: number;
    kontakteNeu: number;
    fristen: number;
    zusammengefuehrt: number;
    uebersprungen: number;
  };
  /** Angelegte Datensätze und vorheriger Stand aktualisierter Akten/Kontakte (nach dem Rückgängigmachen geleert). */
  undo: { erstellt: { col: CollectionKey; id: ID }[]; vorher: { col: "akten" | "kontakte"; doc: Akte | Kontakt }[] };
  rueckgaengig?: { am: ISODateTime; von: ID };
  /** Unterbrochener Lauf (Fenster geschlossen oder neu geladen): vollständig zurückgenommen, nichts übernommen. */
  abgebrochen?: boolean;
}

export interface TenantData {
  kontakte: Kontakt[];
  akten: Akte[];
  fristen: Frist[];
  dokumente: Dokument[];
  nachrichten: Nachricht[];
  rechnungen: Rechnung[];
  buchungen: Buchung[];
  transaktionen: Transaktion[];
  zeiten: Zeiteintrag[];
  automationen: Automation[];
  aktivitaeten: Aktivitaet[];
  notizen: Notiz[];
  umzugLaeufe: UmzugLauf[];
  meta: { seedVersion: number; seededAt: ISODateTime; letzteMigration?: ISODateTime }[];
}

export type CollectionKey = Exclude<keyof TenantData, "meta">;

export const COLLECTIONS: CollectionKey[] = [
  "kontakte", "akten", "fristen", "dokumente", "nachrichten", "rechnungen",
  "buchungen", "transaktionen", "zeiten", "automationen", "aktivitaeten", "notizen", "umzugLaeufe",
];

export interface SessionInfo {
  user: User;
  tenant: Tenant;
  team: User[];
  isConsoleAdmin?: boolean;
}

export interface ConsoleSession {
  console: true;
  email: string;
  name: string;
}

export interface Entscheidung {
  id: ID;
  gericht: string; // "BGH"
  ebene: "BVerfG" | "BGH" | "BAG" | "BVerwG" | "BFH" | "BSG" | "EuGH" | "OLG" | "LAG" | "LG" | "AG" | "ArbG";
  spruchkoerper?: string;
  datum: ISODate;
  az: string;
  art: "Urteil" | "Beschluss";
  rechtsgebiet: Sachgebiet | "Verfassungsrecht" | "Datenschutz" | "Gesellschaftsrecht";
  titel: string; // Stichwort
  leitsatz: string; // sinngemäß
  normen: string[];
  schlagworte: string[];
  bedeutung: string; // praktische Bedeutung für die Kanzlei
}
