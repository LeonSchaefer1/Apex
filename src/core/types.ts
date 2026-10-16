// AnwaltApex Domänenmodell – gemeinsam genutzt von Web-App und Server.

export type ID = string;
export type ISODate = string; // "2026-10-16"
export type ISODateTime = string; // "2026-10-16T09:30:00.000Z"

export type Bundesland =
  | "BW" | "BY" | "BE" | "BB" | "HB" | "HH" | "HE" | "MV"
  | "NI" | "NW" | "RP" | "SL" | "SN" | "ST" | "SH" | "TH";

export type Rolle = "partner" | "anwalt" | "refa" | "admin";

export interface Ansprechpartner {
  name: string;
  rolle: string;
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
  kiAnalyse?: { erstelltAm: string; prozent: number; quelle: string }; // letzte KI-Fallanalyse (Kurzinfo)
  /** Vergütungsvereinbarung (§ 3a RVG, Textform) – Voraussetzung für die Abrechnung nach Zeitaufwand. */
  verguetungsvereinbarung?: { datum: ISODate; stundensatz?: number; erfasstVon?: ID };
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
}

export type DokumentArt =
  | "schriftsatz" | "brief" | "urteil" | "beschluss" | "vollmacht" | "rechnung"
  | "email" | "bea" | "notiz" | "anlage" | "vertrag" | "gutachten";

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
}

export interface Transaktion {
  id: ID;
  datum: ISODate;
  betrag: number;
  gegenpartei: string;
  iban: string;
  verwendungszweck: string;
  status: "offen" | "zugeordnet" | "ignoriert";
  zuordnung?: { rechnungId?: ID; akteId?: ID; sicherheit: number; durch: "auto" | "manuell"; grund: string };
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
  minutenProLauf: number;
  laeufe: number;
  letzterLauf?: ISODateTime;
  kategorie: "Fristen" | "Mandanten" | "Dokumente" | "Finanzen" | "Posteingang";
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
}

export interface Notiz {
  id: ID;
  akteId: ID;
  userId: ID;
  text: string;
  zeit: ISODateTime;
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
  meta: { seedVersion: number; seededAt: ISODateTime; letzteMigration?: ISODateTime }[];
}

export type CollectionKey = Exclude<keyof TenantData, "meta">;

export const COLLECTIONS: CollectionKey[] = [
  "kontakte", "akten", "fristen", "dokumente", "nachrichten", "rechnungen",
  "buchungen", "transaktionen", "zeiten", "automationen", "aktivitaeten", "notizen",
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
