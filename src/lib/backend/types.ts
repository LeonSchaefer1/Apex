import type { CollectionKey, ConsoleSession, SessionInfo, Tenant, TenantData, User, Rolle, Sachgebiet, Bundesland } from "@/core/types";

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
  console?: boolean;
  /** In der Apex Console angelegter Kundentest (keine fest eingebaute Beispielkanzlei). */
  kundentest?: boolean;
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
}

/** Betriebsart der angemeldeten Kanzlei – vom Server bzw. Demo-Backend mit der Sitzung geliefert. */
export interface KanzleiBetrieb {
  /** Fest eingebaute Präsentationskanzlei (öffentliche Demo-Zugangsdaten). */
  praesentation: boolean;
  /** Kanzlei mit Beispieldaten (Präsentations- oder Testkanzlei). Nur hier laufen der simulierte 38h-Motor und „Demo-Daten zurücksetzen“. */
  beispieldaten: boolean;
  /** Server-Betrieb: Live-KI ist für diese Kanzlei freigegeben (z. B. per AI_DEMO_TENANTS=off für Präsentationskanzleien abgeschaltet). */
  kiLive?: boolean;
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
}

export const ROLLEN: readonly Rolle[] = ["partner", "anwalt", "refa", "admin"];

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

/** Mindestanforderung an ein selbst gewähltes Passwort (gleiche Regel im Demo-Backend und auf dem Server). */
export function pruefeNeuesPasswort(neu: string, alt?: string): string | null {
  if (neu.length < PASSWORT_MIN) return `Bitte mindestens ${PASSWORT_MIN} Zeichen verwenden.`;
  if (!/[A-Za-zÄÖÜäöüß]/.test(neu) || !/\d/.test(neu)) return "Bitte Buchstaben und mindestens eine Ziffer verwenden.";
  if (alt && neu === alt) return "Das neue Passwort muss sich vom Startpasswort unterscheiden.";
  return null;
}

/** Längstes zulässiges Passwort – längere Eingaben werden vor dem (teuren) Hashen abgewiesen. */
export const PASSWORT_MAX = 256;

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
  /** Wirft `PasswortWechselNoetig`, wenn zuerst ein eigenes Passwort festgelegt werden muss. */
  login(email: string, passwort: string): Promise<Sitzung>;
  /** Ersetzt das Startpasswort durch ein eigenes und meldet an. */
  passwortErsetzen(email: string, startPasswort: string, neuesPasswort: string): Promise<Sitzung>;
  me(): Promise<Sitzung | null>;
  logout(): Promise<void>;
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
  };
  team: {
    add(input: NeuerNutzer): Promise<{ user: User; passwort: string }>;
    remove(id: string): Promise<void>;
    /** Vergibt ein neues Startpasswort – die Person legt bei der nächsten Anmeldung ein eigenes fest. */
    neuesPasswort(id: string): Promise<string>;
  };
  console: {
    list(): Promise<ConsoleKunde[]>;
    create(input: NeuerKunde): Promise<NeuerKundeErgebnis>;
    remove(tenantId: string): Promise<void>;
    reset(tenantId: string): Promise<void>;
    setStatus(tenantId: string, status: Tenant["status"]): Promise<void>;
    neuesPasswort(userId: string): Promise<string>;
    /** Stellt für Zugänge der fest eingebauten Beispielkanzleien das öffentliche Demo-Passwort wieder her. */
    standardPasswort(userId: string): Promise<void>;
  };
  aiStream?: (req: AiStreamRequest, onText: (delta: string) => void, signal?: AbortSignal) => Promise<AiStreamResult>;
}
