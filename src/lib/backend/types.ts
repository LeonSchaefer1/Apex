import type { Aktivitaet, CollectionKey, ConsoleSession, SessionInfo, Tenant, TenantData, User, Rolle, Sachgebiet, Bundesland } from "@/core/types";
import { istBerufstraeger } from "../../core/vertretung";
import type { Rechnungsangaben } from "../../core/abrechnung";
import type { ConsolePasswortAnlass } from "./protokoll";
export type { Rechnungsangaben } from "../../core/abrechnung";
export type { ConsolePasswortAnlass } from "./protokoll";

export interface BackendInfo {
  modus: "demo" | "server";
  schnellLogin: boolean;
  ki: { server: boolean; modell?: string };
  version: string;
  /** Nur Demo-Betrieb: Änderungen werden dauerhaft im Browser gespeichert (false: Speicher gesperrt, Daten nur für diese Sitzung). */
  speicherDauerhaft?: boolean;
}

export interface SchnellLogin {
  email: string;
  passwort: string;
  name: string;
  kanzlei: string;
  stadt: string;
  titel: string;
  initialen: string;
  farbe: string;
  /** Anbieterzugang (nur im Browser-Demo-Betrieb). */
  console?: boolean;
}

export interface ConsoleKunde {
  tenant: Tenant;
  users: User[];
  stats: { akten: number; offeneFristen: number; nachrichten: number; letzteAktivitaet?: string };
}

export interface NeuerKunde {
  kanzlei: string;
  stadt: string;
  bundesland: Bundesland;
  adminName: string;
  adminEmail: string;
  arbeitsplaetze: number;
  schwerpunkte: Sachgebiet[];
  beispieldaten: boolean;
  testBis?: string;
  /** Förmliche Anrede der Hauptnutzerin bzw. des Hauptnutzers („Sehr geehrte Frau …“); fehlt = keine Anrede. */
  adminAnrede?: "Frau" | "Herr";
}

export interface NeuerKundeErgebnis {
  tenant: Tenant;
  admin: User;
  passwort: string;
}

export interface NeuerNutzer {
  name: string;
  email: string;
  rolle: Rolle;
  titel: string;
  anrede?: "Frau" | "Herr";
}

/** Änderungen an einem Zugang der eigenen Kanzlei (Einstellungen → Team). `null` entfernt die Abwesenheit. */
export interface TeamAenderung {
  abwesenheit?: NonNullable<User["abwesenheit"]> | null;
  deaktiviert?: boolean;
  /** Zwei-Faktor-Anmeldung zurücksetzen (z. B. Telefon verloren) – die Person richtet sie danach neu ein. */
  zweiFaktorZuruecksetzen?: boolean;
}

/** Zwei-Faktor-Anmeldung (TOTP) der angemeldeten Person. */
export interface ZweiFaktorStatus {
  aktiv: boolean;
  /** Kanzlei verlangt Zwei-Faktor für alle (in Präsentationskanzleien nie erzwungen). */
  pflicht: boolean;
  eingerichtetAm?: string;
  wiederherstellungUebrig?: number;
  /** Einrichtung hier nicht möglich (z. B. öffentliche Präsentationskanzlei im Server-Betrieb) – mit Begründung. */
  gesperrt?: string;
}

export interface ZweiFaktorEinrichtung {
  /** Geheimer Schlüssel (Base32) zum Abtippen */
  schluessel: string;
  /** otpauth-URI zum Kopieren in die Authenticator-App */
  uri: string;
}

export const SPERRE_MINUTEN = [5, 10, 15, 30] as const;
export type SperreMinuten = (typeof SPERRE_MINUTEN)[number];
export const SPERRE_STANDARD: SperreMinuten = 15;

export interface KanzleiSicherheit {
  zweiFaktorPflicht: boolean;
  sperreMinuten: SperreMinuten;
}

/** Sicherheitseinstellung der Kanzlei mit Standardwerten. */
export function kanzleiSicherheit(t: Pick<Tenant, "sicherheit"> | undefined): KanzleiSicherheit {
  const m = t?.sicherheit?.sperreMinuten;
  return { zweiFaktorPflicht: !!t?.sicherheit?.zweiFaktorPflicht, sperreMinuten: m && (SPERRE_MINUTEN as readonly number[]).includes(m) ? m : SPERRE_STANDARD };
}

/** Betriebsart der angemeldeten Kanzlei – vom Server bzw. Demo-Backend mit der Sitzung geliefert. */
export interface KanzleiBetrieb {
  /** Fest eingebaute Präsentationskanzlei (öffentliche Demo-Zugangsdaten). */
  praesentation: boolean;
  /** Kanzlei mit Beispieldaten (Präsentations- oder Testkanzlei). Nur hier laufen der simulierte 38h-Motor und „Demo-Daten zurücksetzen“. */
  beispieldaten: boolean;
  /** Server-Betrieb: Live-KI ist für diese Kanzlei freigegeben (z. B. per AI_DEMO_TENANTS=off für Präsentationskanzleien abgeschaltet). */
  kiLive?: boolean;
  /** Die Kanzlei verlangt Zwei-Faktor, die Person hat sie noch nicht eingerichtet: erst einrichten, dann arbeiten. */
  zweiFaktorFehlt?: boolean;
}

export type KanzleiSitzung = SessionInfo & { betrieb?: KanzleiBetrieb };

export type Sitzung = KanzleiSitzung | ConsoleSession;

/** Beispiel- bzw. Präsentationsdaten? Ältere Server ohne Angabe gelten als Beispielkanzlei (bisheriges Verhalten). */
export function hatBeispieldaten(s: Sitzung | null | undefined): boolean {
  if (!s || "console" in s) return false;
  return s.betrieb?.beispieldaten ?? true;
}

/** Gleiche Kanzlei und gleiche Person (z. B. nach einem Abgleich mit dem Server oder einem anderen Tab)? */
export function gleicheSitzung(a: Sitzung | null | undefined, b: Sitzung | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  if ("console" in a || "console" in b) return "console" in a && "console" in b;
  return a.tenant.id === b.tenant.id && a.user.id === b.user.id;
}

/** Fehlercode des Servers, wenn die Anfrage nicht zur aktuell angemeldeten Kanzlei bzw. Person passt (anderer Tab). */
export const CODE_SITZUNG_GEWECHSELT = "sitzung_gewechselt";

/** Felder des Kanzleiprofils, die die Kanzlei selbst pflegt (Einstellungen → Kanzlei). */
export interface KanzleiProfil {
  name: string;
  kurzname: string;
  adresse: string;
  stadt: string;
  schwerpunkte: string[];
  /** Bundesland des Kanzleisitzes – Voreinstellung der Feiertage im Fristenrechner (fehlt = unverändert). */
  bundesland?: Bundesland;
}

export const ROLLEN: readonly Rolle[] = ["partner", "anwalt", "refa", "admin", "azubi"];

/** Sammlungen, die Auszubildende weder lesen noch schreiben (Abrechnung, Aktenkonten, Fremdgeld) – gleiche Regel in Demo-Backend und Server. */
export const AZUBI_GESPERRT: readonly CollectionKey[] = ["rechnungen", "buchungen", "transaktionen"];

export const AZUBI_KEIN_ZUGRIFF = "Kein Zugriff für Ihre Rolle: Abrechnung, Aktenkonten und Fremdgeld sind Auszubildenden nicht freigegeben – bitte wenden Sie sich an Ihre Kanzleiverwaltung.";

export function darfSammlung(rolle: Rolle | undefined, col: CollectionKey): boolean {
  return rolle !== "azubi" || !AZUBI_GESPERRT.includes(col);
}

/** Abrechnung & Aktenkonten (Navigation, Route /abrechnung, Akten-Reiter „Aktenkonto“). */
export function darfAbrechnung(rolle: Rolle | undefined): boolean {
  return rolle !== "azubi";
}

/** eEB abgeben dürfen nur Berufsträger (Partner, Anwältinnen und Anwälte). */
export function darfEebAbgeben(rolle: Rolle | undefined): boolean {
  return rolle === "partner" || rolle === "anwalt";
}

/** Lizenznummer und Teamliste mit E-Mail-Adressen sehen nur Partner und Administration. */
export function darfLizenzSehen(rolle: Rolle | undefined): boolean {
  return rolle === "partner" || rolle === "admin";
}

export const BUNDESLAENDER: readonly Bundesland[] = ["BW", "BY", "BE", "BB", "HB", "HH", "HE", "MV", "NI", "NW", "RP", "SL", "SN", "ST", "SH", "TH"];

export const SACHGEBIETE_ALLE: readonly Sachgebiet[] = ["Arbeitsrecht", "Mietrecht", "Verkehrsrecht", "Familienrecht", "Erbrecht", "Strafrecht", "Forderungseinzug", "Vertragsrecht", "Baurecht", "Verwaltungsrecht"];

/** Einfache Formatprüfung für E-Mail-Adressen (gleiche Regel in Oberfläche, Demo-Backend und Server). */
export function istEmail(v: string): boolean {
  return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

/** Rollen, die Team & Zugänge, Kanzleiprofil und Datenbestand verwalten dürfen – gleiche Regel im Demo-Backend und auf dem Server. */
export const VERWALTUNGS_ROLLEN: readonly Rolle[] = ["partner", "admin"];

export function darfVerwalten(rolle: Rolle | undefined): boolean {
  return !!rolle && VERWALTUNGS_ROLLEN.includes(rolle);
}

/** Anmeldung mit einem Startpasswort (Einladung oder Neuvergabe): Zuerst muss die Person ein eigenes Passwort festlegen. */
export class PasswortWechselNoetig extends Error {
  readonly email: string;
  constructor(email: string) {
    super("Bitte legen Sie zuerst ein eigenes Passwort fest.");
    this.name = "PasswortWechselNoetig";
    this.email = email;
  }
}

export const PASSWORT_MIN = 10;

/** Mindestanforderung an ein selbst gewähltes Passwort (gleiche Regel im Demo-Backend und auf dem Server). Jede Meldung nennt Ursache und nächsten Schritt. */
export function pruefeNeuesPasswort(neu: string, alt?: string, altBezeichnung = "dem Startpasswort"): string | null {
  if (neu.length < PASSWORT_MIN) return `Das neue Passwort ist zu kurz (${neu.length} von mindestens ${PASSWORT_MIN} Zeichen). Bitte verlängern Sie es – z. B. mit einem weiteren Wort.`;
  if (!/[A-Za-zÄÖÜäöüß]/.test(neu) || !/\d/.test(neu)) return "Das neue Passwort braucht Buchstaben und mindestens eine Ziffer. Bitte ergänzen Sie, was fehlt – z. B. eine Zahl am Ende.";
  if (alt && neu === alt) return `Das neue Passwort ist identisch mit ${altBezeichnung}. Bitte wählen Sie ein anderes, nur Ihnen bekanntes Passwort.`;
  return null;
}

/** Meldung, wenn eine andere Rolle als Partner/Administration eine Fristautomatik schalten will (Demo-Backend und Server). */
export const FRIST_AUTOMATIK_GESPERRT = "Fristautomatiken (Fristerkennung, Vorfristen, eEB) schalten nur Partner und Administration – an ihnen hängt die Fristenkontrolle der Kanzlei. Bitte wenden Sie sich an sie.";

/** Anmeldung braucht den zweiten Faktor: Passwort war richtig, jetzt folgt der Code aus der Authenticator-App. */
export class ZweiFaktorNoetig extends Error {
  readonly email: string;
  /** Kurzlebige Kennung des Anmeldevorgangs (nur zusammen mit dem Code gültig). */
  readonly vorgang: string;
  constructor(email: string, vorgang: string) {
    super("Bitte geben Sie den Code aus Ihrer Authenticator-App ein.");
    this.name = "ZweiFaktorNoetig";
    this.email = email;
    this.vorgang = vorgang;
  }
}

/** Gesperrter Zugang (vorübergehend deaktiviert) – gleiche Meldung in Demo-Backend und Server. */
export const ZUGANG_DEAKTIVIERT = "Ihr Zugang ist deaktiviert – bitte wenden Sie sich an Ihre Kanzleiverwaltung (Partner oder Administration).";

/** Falsche Zugangsdaten – ohne Hinweis darauf, ob es die E-Mail-Adresse gibt. */
export const ANMELDUNG_FALSCH = "E-Mail-Adresse oder Passwort stimmen nicht. Bitte prüfen Sie Schreibweise sowie Groß- und Kleinschreibung – oder lassen Sie über „Passwort vergessen?“ ein neues Startpasswort vergeben.";

/** Fehler mit Bezug zu einem Formularfeld (Meldung am Feld statt allgemein) – Demo-Backend wirft ihn, der Server liefert `feld` mit. */
export function feldFehler<F extends string>(text: string, feld: F): Error & { feld: F } {
  return Object.assign(new Error(text), { feld });
}
/** Feld eines Fehlers aus `feldFehler` bzw. der Serverantwort (oder undefined). */
export function fehlerFeld(e: unknown): string | undefined {
  const f = (e as { feld?: unknown } | null)?.feld;
  return typeof f === "string" ? f : undefined;
}

/** Falsches aktuelles Passwort beim Ändern des eigenen Passworts – Ursache und nächster Schritt. */
export const ALTES_PASSWORT_FALSCH = "Das aktuelle Passwort stimmt nicht. Bitte prüfen Sie Groß- und Kleinschreibung. Passwort vergessen? Partner oder Administration vergeben Ihnen unter Team & Zugänge ein Startpasswort.";

/** Längstes zulässiges Passwort – längere Eingaben werden vor dem (teuren) Hashen abgewiesen. */
export const PASSWORT_MAX = 256;

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;

/** Gleiche Regeln wie auf dem Server: Abwesenheit für sich selbst oder als Verwaltung; Deaktivieren und Zwei-Faktor-Rücksetzen nur durch die Verwaltung. */
export function pruefeTeamAenderung(t: { users: User[] }, ich: User, ziel: User, a: TeamAenderung): void {
  const verwalten = darfVerwalten(ich.rolle);
  if (ziel.rolle === "partner" && ich.rolle !== "partner" && ziel.id !== ich.id) throw new Error("Partner-Zugänge können nur Partner verwalten.");
  if (a.abwesenheit !== undefined) {
    if (ziel.id !== ich.id && !verwalten) throw new Error("Die Abwesenheit anderer Personen tragen Partner und Administration ein – Ihre eigene können Sie selbst eintragen.");
    const ab = a.abwesenheit;
    if (ab) {
      if (!ISO_TAG.test(ab.von) || !ISO_TAG.test(ab.bis)) throw new Error("Bitte geben Sie Beginn und Ende der Abwesenheit als Datum an.");
      if (ab.bis < ab.von) throw new Error("Das Ende der Abwesenheit liegt vor dem Beginn. Bitte prüfen Sie die Daten.");
      if (ab.vertretungId) {
        const v = t.users.find((x) => x.id === ab.vertretungId);
        if (!v || v.id === ziel.id) throw new Error("Bitte wählen Sie als Vertretung eine andere Person aus Ihrem Team.");
        if (v.deaktiviert) throw new Error(`${v.name} ist deaktiviert und kann nicht vertreten. Bitte wählen Sie eine andere Vertretung.`);
        if (istBerufstraeger(ziel) && !istBerufstraeger(v)) {
          throw new Error(`Vertretung nach § 53 BRAO nur durch eine Rechtsanwältin oder einen Rechtsanwalt. ${v.name} kann stattdessen die Sachbearbeitung übernehmen.`);
        }
      }
      if (ab.sachbearbeitungId) {
        const sb = t.users.find((x) => x.id === ab.sachbearbeitungId);
        if (!sb || sb.id === ziel.id) throw new Error("Bitte wählen Sie für die Sachbearbeitung eine andere Person aus Ihrem Team.");
        if (sb.deaktiviert) throw new Error(`${sb.name} ist deaktiviert. Bitte wählen Sie eine andere Person für die Sachbearbeitung.`);
      }
      if (ab.grund && ab.grund.length > 200) throw new Error("Der Grund ist zu lang (höchstens 200 Zeichen).");
    }
  }
  if (a.deaktiviert !== undefined || a.zweiFaktorZuruecksetzen) {
    if (!verwalten) throw new Error("Zugänge deaktivieren oder zurücksetzen dürfen Partner und Administration Ihrer Kanzlei.");
    if (ziel.id === ich.id) throw new Error("Ihren eigenen Zugang können Sie nicht deaktivieren oder zurücksetzen.");
    if (a.deaktiviert && ziel.rolle === "partner" && t.users.filter((x) => x.rolle === "partner" && !x.deaktiviert && x.id !== ziel.id).length < 1) {
      throw new Error("Mindestens ein aktiver Partner-Zugang muss bestehen bleiben.");
    }
  }
}

export interface SchreibOptionen {
  /** Hintergrund- bzw. Systemschreibvorgang: zählt nicht als Änderung durch die Kanzlei (Demodaten werden weiter täglich neu erzeugt). */
  system?: boolean;
}

export function istConsole(s: Sitzung | null | undefined): s is ConsoleSession {
  return !!s && "console" in s;
}

export interface AiStreamRequest {
  system: string;
  messages: unknown[];
  tools?: unknown[];
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}

export interface AiStreamResult {
  content: { type: string; text?: string; id?: string; name?: string; input?: unknown }[];
  stop_reason: string | null;
  model?: string;
}

export interface Backend {
  modus: "demo" | "server";
  info(): Promise<BackendInfo>;
  schnellLogins(): Promise<SchnellLogin[]>;
  /** Wirft `PasswortWechselNoetig`, wenn zuerst ein eigenes Passwort festgelegt werden muss, und `ZweiFaktorNoetig`, wenn der Code folgt. */
  login(email: string, passwort: string): Promise<Sitzung>;
  /** Zweiter Schritt der Anmeldung: Code aus der Authenticator-App (oder ein Wiederherstellungscode). */
  zweiFaktorAnmelden(vorgang: string, code: string): Promise<Sitzung>;
  /** Ersetzt das Startpasswort durch ein eigenes und meldet an (wirft `ZweiFaktorNoetig`, wenn die Person Zwei-Faktor nutzt). */
  passwortErsetzen(email: string, startPasswort: string, neuesPasswort: string): Promise<Sitzung>;
  /**
   * Eigenes Passwort ändern (jede Rolle, an die Sitzung gebunden): altes Passwort prüfen (falsch = Fehlversuch wie bei der
   * Anmeldung), gleiche Regeln wie bei der ersten Anmeldung; Protokoll „Eigenes Passwort geändert – …“.
   */
  passwortAendern(altesPasswort: string, neuesPasswort: string): Promise<void>;
  /** Wiederanmeldung nach der Sperre bei Inaktivität: prüft das Passwort der angemeldeten Person. */
  entsperren(passwort: string): Promise<void>;
  me(): Promise<Sitzung | null>;
  logout(): Promise<void>;
  /** Sperre wegen Inaktivität im Kanzleiprotokoll festhalten – liefert den Eintrag (für die sofortige Anzeige). */
  sperreProtokollieren?(): Promise<Aktivitaet | null>;
  /**
   * Bindet alle folgenden Daten-, Team- und KI-Anfragen an diese Sitzung (Kanzlei + Person). Der Server weist Anfragen ab,
   * wenn inzwischen – z. B. in einem anderen Tab – eine andere Kanzlei angemeldet ist (Schutz vor kanzleiübergreifendem Schreiben).
   */
  bindeSitzung?(s: Sitzung | null): void;
  loadData(): Promise<TenantData>;
  /** `system`: Hintergrundlauf (z. B. simulierter 38h-Motor) – wird gespeichert, markiert die Daten aber nicht als „von der Kanzlei geändert". */
  putDoc(col: CollectionKey, doc: { id: string }, opts?: SchreibOptionen): Promise<void>;
  deleteDoc(col: CollectionKey, id: string): Promise<void>;
  resetData(): Promise<TenantData>;
  kanzlei: {
    /** Speichert das Kanzleiprofil dauerhaft (nur Partner und Administration). */
    profilSpeichern(p: KanzleiProfil): Promise<Tenant>;
    /** Zwei-Faktor-Pflicht und Sperre bei Inaktivität (nur Partner und Administration). */
    sicherheitSpeichern(s: KanzleiSicherheit): Promise<Tenant>;
    /** Rechnungsangaben (Steuernummer, USt-IdNr., Geschäftskonto) – nur Partner und Administration; leere Felder entfernen die Angabe. */
    rechnungsangabenSpeichern(a: Rechnungsangaben): Promise<Tenant>;
  };
  zweiFaktor: {
    status(): Promise<ZweiFaktorStatus>;
    /** Neuen Schlüssel erzeugen – aktiv erst nach `bestaetigen` mit dem ersten Code. */
    einrichten(): Promise<ZweiFaktorEinrichtung>;
    /** Erster Code aus der App bestätigt die Einrichtung; liefert die Wiederherstellungscodes (nur jetzt sichtbar). */
    bestaetigen(code: string): Promise<{ wiederherstellungscodes: string[] }>;
    /** Abschalten mit aktuellem Code oder Wiederherstellungscode. */
    deaktivieren(code: string): Promise<void>;
  };
  team: {
    add(input: NeuerNutzer): Promise<{ user: User; passwort: string }>;
    remove(id: string): Promise<void>;
    /** Vergibt ein neues Startpasswort – die Person legt bei der nächsten Anmeldung ein eigenes fest. */
    neuesPasswort(id: string): Promise<string>;
    /** Abwesenheit & Vertretung, Deaktivieren/Reaktivieren, Zwei-Faktor zurücksetzen. */
    aendern(id: string, a: TeamAenderung): Promise<User>;
  };
  console: {
    list(): Promise<ConsoleKunde[]>;
    create(input: NeuerKunde): Promise<NeuerKundeErgebnis>;
    remove(tenantId: string): Promise<void>;
    reset(tenantId: string): Promise<void>;
    setStatus(tenantId: string, status: Tenant["status"]): Promise<void>;
    /** Neues Startpasswort – nur mit Angabe, wer es angefordert hat und warum (Kanzleiprotokoll, Hinweis an Partner/Administration). */
    neuesPasswort(userId: string, anlass: ConsolePasswortAnlass): Promise<string>;
    /** Stellt für Zugänge der fest eingebauten Beispielkanzleien das öffentliche Demo-Passwort wieder her. */
    standardPasswort(userId: string): Promise<void>;
  };
  aiStream?: (req: AiStreamRequest, onText: (delta: string) => void, signal?: AbortSignal) => Promise<AiStreamResult>;
}
