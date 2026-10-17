// Demo-Betrieb: läuft vollständig im Browser (IndexedDB) – ideal für Präsentationen und Artefakt-Vorschau.
import { createStore, get as idbGet, set as idbSet, del as idbDel, type UseStore } from "idb-keyval";
import { fmtDate, today } from "@/core/dates";
import { generateTenantData, SEED_VERSION } from "@/core/seed/generate";
import { DEMO_TENANTS, DEMO_PASSWORT, CONSOLE_DEMO, publicUser, type DemoTenant, type DemoUser } from "@/core/seed/tenants";
import { baueKunde, baueNutzer, profilFuer } from "@/core/seed/kunde";
import type { Aktivitaet, CollectionKey, TenantData, Tenant, User } from "@/core/types";
import { neuerSchluessel, neueWiederherstellungscodes, otpauthUri, pruefeTotp, wiederherstellungNormal } from "@/core/totp";
import {
  ALTES_PASSWORT_FALSCH, ANMELDUNG_FALSCH, AZUBI_GESPERRT, AZUBI_KEIN_ZUGRIFF, BUNDESLAENDER, FRIST_AUTOMATIK_GESPERRT, PASSWORT_MAX, PasswortWechselNoetig, SPERRE_MINUTEN, ZUGANG_DEAKTIVIERT, ZweiFaktorNoetig,
  darfSammlung, darfVerwalten, feldFehler, istEmail, kanzleiSicherheit, pruefeNeuesPasswort, pruefeTeamAenderung,
  type Backend, type ConsoleKunde, type KanzleiProfil, type KanzleiSicherheit, type NeuerKunde, type Rechnungsangaben, type Sitzung, type TeamAenderung,
} from "./types";
import { geaenderteRechnungsangaben, normalisiereRechnungsangaben, pruefeRechnungsangaben } from "@/core/abrechnung";
import { istFristAutomatik } from "@/core/automationen";
import { darfAutomatikSchalten } from "@/lib/rollen";
import { sicheresPasswort, zufallsKennung, zufallsZahl } from "./zufall";
import { ANMELDE_WARN_SCHWELLE, VORGANG, anbieterVorgang, anmeldeVorgang, letzteEchteAktivitaet, mischeVorgaenge, pruefeConsolePasswortAnlass, vorgang, zaehleFehlversuch, zeitBerlin, type FehlGrund } from "./protokoll";
import { festeAnsprechBezeichnung, rollenLabel } from "@/lib/rollen";

const LS_SESSION = "aa:session";
const LS_REGISTRY = "aa:registry";
const LS_OVERRIDES = "aa:tenant-overrides";
const LS_EXTRA_USERS = "aa:extra-users"; // eingeladene Personen in den eingebauten Demo-Kanzleien
const LS_PW = "aa:pw-overrides"; // neu vergebene Passwörter (userId → Passwort)
const LS_PW_WECHSEL = "aa:pw-wechsel"; // Zugänge mit Startpasswort: eigenes Passwort bei der nächsten Anmeldung festlegen
const LS_ENTFERNT = "aa:removed-users"; // entfernte Zugänge der eingebauten Demo-Kanzleien (tenantId → userIds)
const LS_NUTZER_AENDERUNG = "aa:user-aenderungen"; // Abwesenheit, Deaktivierung (userId → Felder) – auch für eingebaute Zugänge
const LS_VORGAENGE = "aa:vorgaenge"; // echte Vorgänge je Kanzlei (Anmeldung, Passwortvergabe …) – überdauern das Neuerzeugen der Beispieldaten
const LS_ANMELDUNG = "aa:letzte-anmeldung"; // userId → Zeitpunkt der letzten Anmeldung
const LS_ZWEIFAKTOR = "aa:zweifaktor"; // userId → Zwei-Faktor-Einrichtung (nur in diesem Browser)
const LS_START_ALT = "aa:pw-start-alt"; // userId → SHA-256 des ersetzten Startpassworts (nur, um „Startpasswort nicht mehr gültig“ zu erkennen)

type NutzerAenderung = Pick<User, "abwesenheit" | "deaktiviert">;
interface ZweiFaktorDaten {
  schluessel: string;
  aktiv: boolean;
  seit?: string;
  /** Wiederherstellungscodes (normalisiert); verbrauchte werden entfernt */
  codes: string[];
  /** zuletzt verwendeter Zeitschritt – derselbe Code gilt nur einmal */
  letzterSchritt?: number;
}

const memory = new Map<string, unknown>();
let idbOk = true;

function lsGet<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return (memory.get(key) as T) ?? null;
  }
}
function lsSet(key: string, value: unknown) {
  memory.set(key, value);
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Speicher nicht verfügbar – Speicher im Arbeitsspeicher genügt für die Sitzung */
  }
}

let kv: UseStore | undefined;
/** Wie der Standardspeicher von idb-keyval, schreibt aber sofort fest (`commit()`), damit Schreibvorgänge auch beim Neuladen oder Schließen des Tabs ankommen. */
function kvStore(): UseStore {
  if (!kv) {
    const basis = createStore("keyval-store", "keyval");
    kv = (modus, cb) =>
      basis(modus, (s) => {
        const r = cb(s);
        if (modus === "readwrite") {
          try {
            s.transaction.commit?.();
          } catch {
            /* ältere Browser schreiben beim Ende der Aufgabe fest */
          }
        }
        return r;
      });
  }
  return kv;
}

async function store<T>(key: string, value?: T | null): Promise<T | undefined> {
  if (value === undefined) {
    if (idbOk) {
      try {
        return (await idbGet(key, kvStore())) as T | undefined;
      } catch {
        idbOk = false;
      }
    }
    return memory.get(key) as T | undefined;
  }
  memory.set(key, value);
  if (idbOk) {
    try {
      if (value === null) await idbDel(key, kvStore());
      else await idbSet(key, value, kvStore());
    } catch {
      idbOk = false;
    }
  }
  return undefined;
}

interface StoredData {
  data: TenantData;
  dirty: boolean;
  seededFor: string;
  seedVersion: number;
}

type DemoSession = { kind: "tenant"; tenantId: string; userId: string } | { kind: "console" };

/** Überschreibungen anwenden; `null` entfernt ein Feld (z. B. den Testzeitraum nach dem Lizenzkauf). */
function mitOverrides(t: Tenant, o: Partial<Record<keyof Tenant, unknown>> | undefined): Tenant {
  const out = { ...t, ...(o ?? {}) } as Record<string, unknown>;
  for (const k of Object.keys(out)) if (out[k] === null) delete out[k];
  return out as unknown as Tenant;
}

function registry(): DemoTenant[] {
  const extra = lsGet<DemoTenant[]>(LS_REGISTRY) ?? [];
  const overrides = lsGet<Record<string, Partial<Tenant>>>(LS_OVERRIDES) ?? {};
  const extraUsers = lsGet<Record<string, DemoUser[]>>(LS_EXTRA_USERS) ?? {};
  const entfernt = lsGet<Record<string, string[]>>(LS_ENTFERNT) ?? {};
  const pw = lsGet<Record<string, string>>(LS_PW) ?? {};
  const aend = lsGet<Record<string, NutzerAenderung>>(LS_NUTZER_AENDERUNG) ?? {};
  return [...DEMO_TENANTS, ...extra].map((t) => ({
    ...t,
    tenant: mitOverrides(t.tenant, overrides[t.tenant.id]),
    users: [...t.users, ...(extraUsers[t.tenant.id] ?? []).filter((u) => !t.users.some((x) => x.id === u.id))]
      .filter((u) => !(entfernt[t.tenant.id] ?? []).includes(u.id))
      .map((u) => (pw[u.id] ? { ...u, passwort: pw[u.id] } : u))
      .map((u) => (aend[u.id] ? mitAenderung(u, aend[u.id]) : u)),
  }));
}

function mitAenderung(u: DemoUser, a: NutzerAenderung): DemoUser {
  const out: DemoUser = { ...u };
  if (a.abwesenheit) out.abwesenheit = a.abwesenheit;
  else delete out.abwesenheit;
  if (a.deaktiviert) out.deaktiviert = true;
  else delete out.deaktiviert;
  return out;
}

// ───────────── Kanzleiprotokoll: echte Vorgänge ─────────────

function vorgaengeVon(tenantId: string): Aktivitaet[] {
  return (lsGet<Record<string, Aktivitaet[]>>(LS_VORGAENGE) ?? {})[tenantId] ?? [];
}
/** Protokolliert einen echten Vorgang bei der Kanzlei (neueste zuerst, höchstens 300 je Kanzlei). */
function protokolliere(tenantId: string, a: Aktivitaet) {
  const alle = lsGet<Record<string, Aktivitaet[]>>(LS_VORGAENGE) ?? {};
  alle[tenantId] = [a, ...(alle[tenantId] ?? [])].slice(0, 300);
  lsSet(LS_VORGAENGE, alle);
}
/** Anmeldung festhalten: die erste Anmeldung als „Erste Anmeldung“, jede weitere als „Anmeldung“ (Filter „Anmeldungen“). */
function merkeAnmeldung(t: DemoTenant, u: DemoUser) {
  const m = lsGet<Record<string, string>>(LS_ANMELDUNG) ?? {};
  const erste = !m[u.id];
  m[u.id] = zeitBerlin();
  lsSet(LS_ANMELDUNG, m);
  protokolliere(t.tenant.id, anmeldeVorgang(erste ? VORGANG.ersteAnmeldung(u.name) : VORGANG.anmeldung(u.name), { akteur: "nutzer", userId: u.id }));
}

/** Fehlversuche je Konto für den Hinweis an Partner und Administration (nur im Arbeitsspeicher). */
const kontoFehler = new Map<string, number[]>();

/**
 * Fehlgeschlagene Anmeldung protokollieren – nur, wenn die E-Mail-Adresse zu einem Konto der Kanzlei gehört; nie das Passwort.
 * Beim dritten Fehlversuch innerhalb von 15 Minuten zusätzlich ein Hinweis für Partner und Administration.
 */
function protokolliereFehlversuch(t: DemoTenant, u: DemoUser, grund: FehlGrund) {
  protokolliere(t.tenant.id, anmeldeVorgang(VORGANG.anmeldungFehlgeschlagen(u.name, grund), { akteur: "system", userId: u.id }));
  if (zaehleFehlversuch(kontoFehler, u.id) === ANMELDE_WARN_SCHWELLE) {
    protokolliere(t.tenant.id, anmeldeVorgang(VORGANG.fehlversucheWarnung(u.name, ANMELDE_WARN_SCHWELLE), { akteur: "system", userId: u.id, meldung: true }));
  }
}

/** SHA-256 (hex) im Browser – fehlt WebCrypto (unsicherer Kontext), gibt es keine Erkennung des alten Startpassworts. */
async function sha256Hex(text: string): Promise<string | null> {
  try {
    const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}
async function istAltesStartpasswort(userId: string, passwort: string): Promise<boolean> {
  const alt = (lsGet<Record<string, string>>(LS_START_ALT) ?? {})[userId];
  if (!alt) return false;
  return (await sha256Hex(passwort)) === alt;
}
async function merkeAltesStartpasswort(userId: string, startPasswort: string) {
  const h = await sha256Hex(startPasswort);
  const m = lsGet<Record<string, string>>(LS_START_ALT) ?? {};
  if (h) m[userId] = h;
  else delete m[userId];
  lsSet(LS_START_ALT, m);
}

// ───────────── Zwei-Faktor-Anmeldung (TOTP) ─────────────

function zfDaten(userId: string): ZweiFaktorDaten | undefined {
  return (lsGet<Record<string, ZweiFaktorDaten>>(LS_ZWEIFAKTOR) ?? {})[userId];
}
function zfSetzen(userId: string, d: ZweiFaktorDaten | null) {
  const alle = lsGet<Record<string, ZweiFaktorDaten>>(LS_ZWEIFAKTOR) ?? {};
  if (d) alle[userId] = d;
  else delete alle[userId];
  lsSet(LS_ZWEIFAKTOR, alle);
}
const zfAktiv = (userId: string) => !!zfDaten(userId)?.aktiv;

/** Prüft einen Code (TOTP oder Wiederherstellungscode) und verbraucht ihn. */
async function zfPruefen(userId: string, code: string): Promise<"totp" | "wiederherstellung" | null> {
  const d = zfDaten(userId);
  if (!d?.aktiv) return null;
  const schritt = await pruefeTotp(d.schluessel, code, Date.now(), { nichtVor: d.letzterSchritt });
  if (schritt !== null) {
    zfSetzen(userId, { ...d, letzterSchritt: schritt });
    return "totp";
  }
  const n = wiederherstellungNormal(code);
  if (n.length === 8 && d.codes.includes(n)) {
    zfSetzen(userId, { ...d, codes: d.codes.filter((x) => x !== n) });
    return "wiederherstellung";
  }
  return null;
}

/** Laufende Anmeldungen zwischen Passwort und Code (nur im Arbeitsspeicher, 5 Minuten gültig). */
const zfVorgaenge = new Map<string, { tenantId: string; userId: string; bis: number }>();
const ZF_VORGANG_MS = 5 * 60_000;

// ───────────── Begrenzung von Fehlversuchen (wie auf dem Server: 8 je Zugang in 15 Minuten) ─────────────

const fehlversuche = new Map<string, number[]>();
const FEHL_MAX = 8;
const FEHL_FENSTER = 15 * 60_000;
function gesperrtNachFehlversuchen(key: string): boolean {
  const jetzt = Date.now();
  const arr = (fehlversuche.get(key) ?? []).filter((t) => jetzt - t < FEHL_FENSTER);
  fehlversuche.set(key, arr);
  return arr.length >= FEHL_MAX;
}
function fehlversuch(key: string) {
  fehlversuche.set(key, [...(fehlversuche.get(key) ?? []), Date.now()]);
}
const ZU_VIELE = "Zu viele Fehlversuche für diesen Zugang. Bitte warten Sie 15 Minuten – oder lassen Sie über „Passwort vergessen?“ ein neues Startpasswort vergeben.";

function mussPasswortWechseln(userId: string): boolean {
  return (lsGet<string[]>(LS_PW_WECHSEL) ?? []).includes(userId);
}
function setzePasswortWechsel(userId: string, an: boolean) {
  const liste = (lsGet<string[]>(LS_PW_WECHSEL) ?? []).filter((x) => x !== userId);
  lsSet(LS_PW_WECHSEL, an ? [...liste, userId] : liste);
}

/** Angemeldete Person der Kanzlei-Sitzung – mit derselben Rechteprüfung wie auf dem Server. */
function kanzleiSitzung(verwalten = false): { t: DemoTenant; u: DemoUser } {
  const s = lsGet<DemoSession>(LS_SESSION);
  if (!s || s.kind !== "tenant") throw new Error("Nicht angemeldet – bitte melden Sie sich an.");
  const t = findTenant(s.tenantId);
  const u = t?.users.find((x) => x.id === s.userId);
  if (!t || !u) throw new Error("Sitzung ungültig – bitte melden Sie sich erneut an.");
  if (u.deaktiviert) throw new Error(ZUGANG_DEAKTIVIERT);
  if (verwalten && !darfVerwalten(u.rolle)) throw new Error("Diese Aktion ist Partnern und der Administration Ihrer Kanzlei vorbehalten – bitte wenden Sie sich an sie.");
  return { t, u };
}

/** Kanzlei verlangt Zwei-Faktor, die Person hat sie noch nicht eingerichtet (Präsentationskanzleien: nie erzwungen). */
function zweiFaktorFehlt(t: DemoTenant, u: DemoUser): boolean {
  return kanzleiSicherheit(t.tenant).zweiFaktorPflicht && !istPraesentationskanzlei(t.tenant.id) && !zfAktiv(u.id);
}

function starteSitzung(t: DemoTenant, u: DemoUser): Sitzung {
  const s: DemoSession = { kind: "tenant", tenantId: t.tenant.id, userId: u.id };
  lsSet(LS_SESSION, s);
  merkeAnmeldung(t, u);
  return sitzungFuer(s)!;
}

function findTenant(id: string) {
  return registry().find((t) => t.tenant.id === id);
}

function sitzungFuer(s: DemoSession): Sitzung | null {
  if (s.kind === "console") return { console: true, email: CONSOLE_DEMO.email, name: CONSOLE_DEMO.name };
  const t = findTenant(s.tenantId);
  const u = t?.users.find((x) => x.id === s.userId);
  if (!t || !u || u.deaktiviert) return null;
  const leer = (t as DemoTenant & { leer?: boolean }).leer ?? false;
  return {
    user: publicUser(u),
    tenant: t.tenant,
    team: t.users.map(publicUser),
    betrieb: { praesentation: istPraesentationskanzlei(t.tenant.id), beispieldaten: !leer, ...(zweiFaktorFehlt(t, u) ? { zweiFaktorFehlt: true } : {}) },
  };
}

/** Prüft mit einem Probe-Schreibzugriff, ob Änderungen dauerhaft im Browser landen (gesperrter Speicher, Sandbox ohne Speicher …). */
async function speicherProbe(): Promise<boolean> {
  try {
    localStorage.setItem("aa:probe", "1");
    const ok = localStorage.getItem("aa:probe") === "1";
    localStorage.removeItem("aa:probe");
    if (!ok) return false;
  } catch {
    return false;
  }
  if (!idbOk) return false;
  const probe = (async () => {
    try {
      await idbSet("aa:probe", 1, kvStore());
      const ok = (await idbGet("aa:probe", kvStore())) === 1;
      await idbDel("aa:probe", kvStore());
      return ok;
    } catch {
      idbOk = false;
      return false;
    }
  })();
  // Manche Umgebungen beantworten IndexedDB nie – dann gilt der Speicher als nicht dauerhaft.
  return Promise.race([probe, new Promise<boolean>((r) => setTimeout(() => r(false), 1500))]);
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let current: { tenantId: string; stored: StoredData } | null = null;
let ausstehend: { key: string; stored: StoredData } | null = null;

/** Schreibt einen ausstehenden Speichervorgang sofort weg (Ende der Wartezeit, Neuladen, Tab schließen, Abmelden). */
function flushSave(): Promise<unknown> {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  const p = ausstehend;
  ausstehend = null;
  return p ? store(p.key, p.stored) : Promise.resolve();
}

function scheduleSave() {
  if (!current) return;
  clearTimeout(saveTimer);
  ausstehend = { key: `aa:data:${current.tenantId}`, stored: current.stored };
  saveTimer = setTimeout(() => void flushSave(), 250);
}

let flushHorcher = false;
/** Beim Verlassen der Seite (Neuladen, Tab schließen, App wechseln) nicht auf die Wartezeit warten. */
function registriereFlush() {
  if (flushHorcher || typeof window === "undefined") return;
  flushHorcher = true;
  const sofort = () => void flushSave();
  window.addEventListener("pagehide", sofort);
  window.addEventListener("beforeunload", sofort);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") sofort();
  });
}

/** Präsentationskanzleien sind fest eingebaut – ihr Testzeitraum läuft nicht ab (wie im Server-Betrieb). */
function istPraesentationskanzlei(tenantId: string) {
  return DEMO_TENANTS.some((t) => t.tenant.id === tenantId);
}

/** Gleiche Zugangsprüfung wie im Server-Betrieb: pausierte Kanzleien und abgelaufene Testzugänge werden abgewiesen. */
function zugangsSperre(t: Tenant): string | null {
  const ap = t.ansprechpartner;
  const kontakt = `${festeAnsprechBezeichnung(ap)}: ${ap.name} (${ap.telefon}).`;
  if (t.status === "pausiert") return `Der Zugang dieser Kanzlei ist pausiert. ${kontakt}`;
  if (t.status === "test" && t.testBis && t.testBis < today() && !istPraesentationskanzlei(t.id)) {
    return `Der Testzeitraum ist am ${fmtDate(t.testBis)} abgelaufen. ${kontakt} ${ap.name} verlängert den Zugang gern.`;
  }
  return null;
}

async function ladeOderSeed(t: DemoTenant, force = false): Promise<StoredData> {
  const key = `aa:data:${t.tenant.id}`;
  const existing = force ? undefined : await store<StoredData>(key);
  const heute = today();
  // Unveränderte Demodaten werden jeden Tag neu relativ zu „heute" erzeugt – die Demo bleibt aktuell.
  if (existing && existing.seedVersion === SEED_VERSION && (existing.dirty || existing.seededFor === heute)) return existing;
  const leer = (t as DemoTenant & { leer?: boolean }).leer ?? false;
  const data = generateTenantData({ tenant: t.tenant, users: t.users.map(publicUser), profil: t.profil }, heute, { leer, kundentest: !istPraesentationskanzlei(t.tenant.id) });
  const stored: StoredData = { data, dirty: false, seededFor: heute, seedVersion: SEED_VERSION };
  await store(key, stored);
  return stored;
}

/** Kennzahlen je Kanzlei für die Console. „Letzte Aktivität“ nur aus echten Vorgängen und Anmeldungen – nie aus Beispieleinträgen (wie auf dem Server). */
function statsFuer(t: DemoTenant, data?: TenantData): ConsoleKunde["stats"] {
  const anmeldungen = lsGet<Record<string, string>>(LS_ANMELDUNG) ?? {};
  const letzte = letzteEchteAktivitaet([...t.users.map((u) => anmeldungen[u.id]), vorgaengeVon(t.tenant.id)[0]?.zeit]);
  if (!data) return { akten: 0, offeneFristen: 0, nachrichten: 0, letzteAktivitaet: letzte };
  return {
    akten: data.akten.length,
    offeneFristen: data.fristen.filter((f) => f.status === "offen").length,
    nachrichten: data.nachrichten.length,
    letzteAktivitaet: letzte,
  };
}

/** Datenbestand für die Person: echte Vorgänge eingemischt; Auszubildende erhalten Abrechnung, Aktenkonten und Bank nicht. */
function sichtFuer(t: DemoTenant, u: DemoUser, data: TenantData): TenantData {
  const out: TenantData = { ...data, aktivitaeten: mischeVorgaenge(data.aktivitaeten, vorgaengeVon(t.tenant.id)) };
  if (u.rolle === "azubi") for (const col of AZUBI_GESPERRT) (out[col] as unknown[]) = [];
  return out;
}

function findeNutzer(userId: string): { t: DemoTenant; u: DemoUser } | undefined {
  for (const t of registry()) {
    const u = t.users.find((x) => x.id === userId);
    if (u) return { t, u };
  }
  return undefined;
}

function aktuelleRolle(): User["rolle"] | undefined {
  const s = lsGet<DemoSession>(LS_SESSION);
  if (!s || s.kind !== "tenant") return undefined;
  return findTenant(s.tenantId)?.users.find((x) => x.id === s.userId)?.rolle;
}

export function createDemoBackend(): Backend {
  registriereFlush();
  return {
    modus: "demo",
    async info() {
      return { modus: "demo", schnellLogin: true, ki: { server: false }, version: "0.9.0", speicherDauerhaft: await speicherProbe() };
    },
    async schnellLogins() {
      // Gleiche Regel wie auf dem Server (/api/auth/schnell): nur die fest eingebauten Präsentationskanzleien, je Kanzlei der erste
      // Zugang, für den das öffentliche Demo-Passwort noch gilt (kein eigenes Passwort, kein ausstehender Wechsel, keine Zwei-Faktor-
      // Anmeldung, nicht deaktiviert). Kundentests aus der Apex Console erscheinen nie – ihr Passwort kennt nur die Kanzlei.
      const list = registry()
        .filter((t) => istPraesentationskanzlei(t.tenant.id) && !zugangsSperre(t.tenant))
        .flatMap((t) => {
          const u = t.users.find((x) => x.passwort === DEMO_PASSWORT && !mussPasswortWechseln(x.id) && !zfAktiv(x.id) && !x.deaktiviert);
          return u ? [{ email: u.email, passwort: DEMO_PASSWORT, name: u.name, kanzlei: t.tenant.kurzname, stadt: t.tenant.stadt, titel: u.titel, initialen: u.initialen, farbe: u.farbe }] : [];
        });
      return [
        ...list,
        { email: CONSOLE_DEMO.email, passwort: CONSOLE_DEMO.passwort, name: CONSOLE_DEMO.name, kanzlei: "Anbieterzugang (Demo)", stadt: "Apex Console", titel: "Kundenverwaltung", initialen: "AA", farbe: "#0B1020", console: true },
      ];
    },
    async login(email, passwort) {
      const e = email.trim().toLowerCase();
      if (!e || !passwort) throw new Error("Bitte geben Sie E-Mail-Adresse und Passwort ein.");
      if (e.length > 254 || passwort.length > PASSWORT_MAX) throw new Error("E-Mail-Adresse oder Passwort sind zu lang. Bitte prüfen Sie die Eingabe.");
      if (e === CONSOLE_DEMO.email && passwort === CONSOLE_DEMO.passwort) {
        const s: DemoSession = { kind: "console" };
        lsSet(LS_SESSION, s);
        return sitzungFuer(s)!;
      }
      const key = `login:${e}`;
      if (gesperrtNachFehlversuchen(key)) throw new Error(ZU_VIELE);
      const t = registry().find((x) => x.users.some((u) => u.email.toLowerCase() === e));
      const u = t?.users.find((x) => x.email.toLowerCase() === e);
      // Gleiche Meldung für unbekannte Adresse und falsches Passwort – wie auf dem Server (kein Hinweis auf bestehende Zugänge).
      if (!t || !u || u.passwort !== passwort) {
        fehlversuch(key);
        if (t && u) protokolliereFehlversuch(t, u, (await istAltesStartpasswort(u.id, passwort)) ? "startpasswort" : "passwort");
        throw new Error(ANMELDUNG_FALSCH);
      }
      fehlversuche.delete(key);
      const sperre = zugangsSperre(t.tenant);
      if (sperre) throw new Error(sperre);
      if (u.deaktiviert) throw new Error(ZUGANG_DEAKTIVIERT);
      if (mussPasswortWechseln(u.id)) throw new PasswortWechselNoetig(u.email);
      if (zfAktiv(u.id)) {
        const v = zufallsKennung(24);
        zfVorgaenge.set(v, { tenantId: t.tenant.id, userId: u.id, bis: Date.now() + ZF_VORGANG_MS });
        throw new ZweiFaktorNoetig(u.email, v);
      }
      return starteSitzung(t, u);
    },
    async zweiFaktorAnmelden(vorgangId, code) {
      const v = zfVorgaenge.get(vorgangId);
      if (!v || v.bis < Date.now()) {
        zfVorgaenge.delete(vorgangId);
        throw new Error("Der Anmeldevorgang ist abgelaufen (nach 5 Minuten). Bitte melden Sie sich erneut mit E-Mail-Adresse und Passwort an.");
      }
      const key = `zf:${v.userId}`;
      if (gesperrtNachFehlversuchen(key)) throw new Error("Zu viele falsche Codes. Bitte warten Sie 15 Minuten – oder melden Sie sich mit einem Wiederherstellungscode an.");
      const t = findTenant(v.tenantId);
      const u = t?.users.find((x) => x.id === v.userId);
      if (!t || !u) throw new Error("Der Zugang ist nicht mehr vorhanden. Bitte wenden Sie sich an Ihre Kanzleiverwaltung.");
      if (u.deaktiviert) throw new Error(ZUGANG_DEAKTIVIERT);
      const art = await zfPruefen(u.id, code);
      if (!art) {
        fehlversuch(key);
        protokolliereFehlversuch(t, u, "zweifaktor");
        throw new Error("Der Code stimmt nicht. Bitte geben Sie den aktuellen 6-stelligen Code aus Ihrer Authenticator-App ein (er wechselt alle 30 Sekunden) – oder einen Ihrer Wiederherstellungscodes.");
      }
      fehlversuche.delete(key);
      zfVorgaenge.delete(vorgangId);
      if (art === "wiederherstellung") protokolliere(t.tenant.id, vorgang(VORGANG.zweiFaktorWiederherstellung(u.name), { akteur: "nutzer", userId: u.id }));
      return starteSitzung(t, u);
    },
    async passwortErsetzen(email, startPasswort, neuesPasswort) {
      const e = email.trim().toLowerCase();
      const key = `login:${e}`;
      if (gesperrtNachFehlversuchen(key)) throw new Error(ZU_VIELE);
      const t = registry().find((x) => x.users.some((u) => u.email.toLowerCase() === e));
      const u = t?.users.find((x) => x.email.toLowerCase() === e);
      if (!t || !u || u.passwort !== startPasswort) {
        fehlversuch(key);
        if (t && u) protokolliereFehlversuch(t, u, "startpasswort");
        throw new Error("Das Startpasswort stimmt nicht mehr (z. B. inzwischen neu vergeben). Bitte melden Sie sich erneut mit dem zuletzt erhaltenen Startpasswort an.");
      }
      const sperre = zugangsSperre(t.tenant);
      if (sperre) throw new Error(sperre);
      if (u.deaktiviert) throw new Error(ZUGANG_DEAKTIVIERT);
      const regel = pruefeNeuesPasswort(neuesPasswort, startPasswort);
      if (regel) throw new Error(regel);
      const map = lsGet<Record<string, string>>(LS_PW) ?? {};
      map[u.id] = neuesPasswort;
      lsSet(LS_PW, map);
      setzePasswortWechsel(u.id, false);
      await merkeAltesStartpasswort(u.id, startPasswort);
      if (zfAktiv(u.id)) {
        protokolliere(t.tenant.id, vorgang(VORGANG.eigenesPasswort(u.name), { akteur: "nutzer", userId: u.id }));
        const v = zufallsKennung(24);
        zfVorgaenge.set(v, { tenantId: t.tenant.id, userId: u.id, bis: Date.now() + ZF_VORGANG_MS });
        throw new ZweiFaktorNoetig(u.email, v);
      }
      // Reihenfolge im Protokoll: erst „Erste Anmeldung“, darüber „Eigenes Passwort festgelegt“
      const sitzung = starteSitzung(t, u);
      protokolliere(t.tenant.id, vorgang(VORGANG.eigenesPasswort(u.name), { akteur: "nutzer", userId: u.id }));
      return sitzung;
    },
    async entsperren(passwort) {
      const { u } = kanzleiSitzung();
      const key = `entsperren:${u.id}`;
      if (gesperrtNachFehlversuchen(key)) throw new Error("Zu viele Fehlversuche. Bitte melden Sie sich ab und wieder an – oder warten Sie 15 Minuten.");
      if (passwort !== u.passwort) {
        fehlversuch(key);
        throw new Error("Das Passwort stimmt nicht. Bitte prüfen Sie Groß- und Kleinschreibung – oder melden Sie sich ab und neu an.");
      }
      fehlversuche.delete(key);
    },
    async passwortAendern(altesPasswort, neuesPasswort) {
      const { t, u } = kanzleiSitzung();
      // gleiche Begrenzung und Zählung wie bei der Anmeldung (ein falsches altes Passwort ist ein Fehlversuch)
      const key = `login:${u.email.toLowerCase()}`;
      if (gesperrtNachFehlversuchen(key)) throw feldFehler(ZU_VIELE, "alt");
      if (altesPasswort.length > PASSWORT_MAX || neuesPasswort.length > PASSWORT_MAX) throw feldFehler(`Bitte höchstens ${PASSWORT_MAX} Zeichen verwenden.`, "neu");
      if (altesPasswort !== u.passwort) {
        fehlversuch(key);
        protokolliereFehlversuch(t, u, "passwort");
        throw feldFehler(ALTES_PASSWORT_FALSCH, "alt");
      }
      fehlversuche.delete(key);
      const regel = pruefeNeuesPasswort(neuesPasswort, altesPasswort, "dem bisherigen Passwort");
      if (regel) throw feldFehler(regel, "neu");
      const map = lsGet<Record<string, string>>(LS_PW) ?? {};
      map[u.id] = neuesPasswort;
      lsSet(LS_PW, map);
      setzePasswortWechsel(u.id, false);
      protokolliere(t.tenant.id, vorgang(VORGANG.eigenesPasswortGeaendert(u.name), { akteur: "nutzer", userId: u.id }));
    },
    async me() {
      const s = lsGet<DemoSession>(LS_SESSION);
      if (!s) return null;
      const out = sitzungFuer(s);
      if (!out) lsSet(LS_SESSION, null); // z. B. Zugang deaktiviert oder entfernt
      return out;
    },
    async logout() {
      await flushSave();
      const s = lsGet<DemoSession>(LS_SESSION);
      if (s?.kind === "tenant") {
        const t = findTenant(s.tenantId);
        const u = t?.users.find((x) => x.id === s.userId);
        if (t && u) protokolliere(t.tenant.id, anmeldeVorgang(VORGANG.abmeldung(u.name), { akteur: "nutzer", userId: u.id }));
      }
      lsSet(LS_SESSION, null);
      current = null;
    },
    async sperreProtokollieren() {
      const s = lsGet<DemoSession>(LS_SESSION);
      if (s?.kind !== "tenant") return null;
      const t = findTenant(s.tenantId);
      const u = t?.users.find((x) => x.id === s.userId);
      if (!t || !u) return null;
      const a = anmeldeVorgang(VORGANG.sperreInaktivitaet(u.name), { akteur: "system", userId: u.id });
      protokolliere(t.tenant.id, a);
      return a;
    },
    async loadData() {
      const { t, u } = kanzleiSitzung();
      if (zweiFaktorFehlt(t, u)) throw new Error("Ihre Kanzlei verlangt die Zwei-Faktor-Anmeldung. Bitte richten Sie sie zuerst ein.");
      await flushSave();
      const stored = await ladeOderSeed(t);
      current = { tenantId: t.tenant.id, stored };
      return sichtFuer(t, u, stored.data);
    },
    async putDoc(col, doc, opts) {
      if (!current) return;
      if (!darfSammlung(aktuelleRolle(), col)) throw new Error(AZUBI_KEIN_ZUGRIFF);
      // Fristautomatiken (Fristerkennung, Vorfristen, eEB) schalten nur Partner und Administration – wie auf dem Server (I3-T10-01)
      if (col === "automationen") {
        const neu = doc as { id: string; key?: string; aktiv?: boolean };
        const alt = (current.stored.data.automationen ?? []).find((x) => x.id === neu.id);
        const rolle = aktuelleRolle();
        if (neu.key && istFristAutomatik(neu.key) && (alt?.aktiv ?? true) !== neu.aktiv && !darfAutomatikSchalten(rolle ? { rolle } : undefined, neu.key)) throw new Error(FRIST_AUTOMATIK_GESPERRT);
      }
      // Sammlung fehlt in älteren gespeicherten Beständen (z. B. Umzugsprotokoll) – dann neu anlegen
      const sammlungen = current.stored.data as unknown as Record<string, { id: string }[] | undefined>;
      const arr = (sammlungen[col] ??= []);
      const i = arr.findIndex((x) => x.id === doc.id);
      if (i >= 0) arr[i] = doc;
      else arr.unshift(doc);
      // Hintergrundläufe (simulierter 38h-Motor) werden gespeichert, gelten aber nicht als Änderung durch die Kanzlei –
      // sonst würden die Demodaten nicht mehr täglich relativ zu „heute" neu erzeugt.
      if (!opts?.system) current.stored.dirty = true;
      scheduleSave();
    },
    async deleteDoc(col: CollectionKey, id: string) {
      if (!current) return;
      if (!darfSammlung(aktuelleRolle(), col)) throw new Error(AZUBI_KEIN_ZUGRIFF);
      const arr = (current.stored.data[col] as { id: string }[] | undefined) ?? [];
      const i = arr.findIndex((x) => x.id === id);
      if (i >= 0) arr.splice(i, 1);
      current.stored.dirty = true;
      scheduleSave();
    },
    async resetData() {
      const { t, u } = kanzleiSitzung(true);
      // Präsentationskanzleien: entfernte Beispiel-Zugänge kehren mit den Beispieldaten zurück.
      const entfernt = lsGet<Record<string, string[]>>(LS_ENTFERNT) ?? {};
      if (entfernt[t.tenant.id]) {
        delete entfernt[t.tenant.id];
        lsSet(LS_ENTFERNT, entfernt);
      }
      ausstehend = null;
      clearTimeout(saveTimer);
      const stored = await ladeOderSeed(t, true);
      current = { tenantId: t.tenant.id, stored };
      protokolliere(t.tenant.id, vorgang(VORGANG.beispieldatenZurueckgesetzt(u.name), { akteur: "nutzer", userId: u.id }));
      return sichtFuer(t, u, stored.data);
    },
    kanzlei: {
      async profilSpeichern(p: KanzleiProfil) {
        const { t } = kanzleiSitzung(true);
        const profil: KanzleiProfil = {
          name: p.name.trim().slice(0, 160),
          kurzname: (p.kurzname.trim() || p.name.trim()).slice(0, 60),
          adresse: p.adresse.trim().slice(0, 200),
          stadt: p.stadt.trim().slice(0, 80),
          schwerpunkte: p.schwerpunkte.map((x) => x.trim()).filter(Boolean).slice(0, 12),
        };
        if (!profil.name) throw new Error("Bitte geben Sie den Namen der Kanzlei an.");
        if (!profil.adresse) throw new Error("Bitte geben Sie die Anschrift an.");
        if (p.bundesland !== undefined) {
          if (!BUNDESLAENDER.includes(p.bundesland)) throw new Error("Bitte wählen Sie ein Bundesland aus der Liste.");
          profil.bundesland = p.bundesland;
        }
        const o = lsGet<Record<string, Partial<Tenant>>>(LS_OVERRIDES) ?? {};
        o[t.tenant.id] = { ...(o[t.tenant.id] ?? {}), ...profil };
        lsSet(LS_OVERRIDES, o);
        return { ...t.tenant, ...profil };
      },
      async rechnungsangabenSpeichern(a: Rechnungsangaben) {
        const { t, u } = kanzleiSitzung(true);
        const fehler = Object.entries(pruefeRechnungsangaben(a))[0];
        if (fehler) throw feldFehler(fehler[1], fehler[0]);
        const neu = normalisiereRechnungsangaben(a);
        const geaendert = geaenderteRechnungsangaben(t.tenant, neu);
        const o = lsGet<Record<string, Partial<Record<keyof Tenant, unknown>>>>(LS_OVERRIDES) ?? {};
        // leere Angaben entfernen (null löscht das Feld beim Einlesen)
        o[t.tenant.id] = { ...(o[t.tenant.id] ?? {}), steuernummer: neu.steuernummer ?? null, ustIdNr: neu.ustIdNr ?? null, geschaeftskonto: neu.geschaeftskonto ?? null, anderkonto: neu.anderkonto ?? null };
        lsSet(LS_OVERRIDES, o);
        if (geaendert.length) protokolliere(t.tenant.id, vorgang(VORGANG.rechnungsangabenGeaendert(geaendert, u.name), { akteur: "nutzer", userId: u.id }));
        return findTenant(t.tenant.id)?.tenant ?? { ...t.tenant, ...neu };
      },
      async sicherheitSpeichern(x: KanzleiSicherheit) {
        const { t } = kanzleiSitzung(true);
        if (!(SPERRE_MINUTEN as readonly number[]).includes(x.sperreMinuten)) throw new Error("Bitte wählen Sie 5, 10, 15 oder 30 Minuten.");
        if (x.zweiFaktorPflicht && istPraesentationskanzlei(t.tenant.id)) throw new Error("In Präsentationskanzleien wird die Zwei-Faktor-Anmeldung nicht erzwungen – ihre Zugangsdaten sind öffentlich. Bitte nutzen Sie dafür Ihren Kundentest.");
        const sicherheit = { zweiFaktorPflicht: !!x.zweiFaktorPflicht, sperreMinuten: x.sperreMinuten };
        const o = lsGet<Record<string, Partial<Tenant>>>(LS_OVERRIDES) ?? {};
        o[t.tenant.id] = { ...(o[t.tenant.id] ?? {}), sicherheit };
        lsSet(LS_OVERRIDES, o);
        return { ...t.tenant, sicherheit };
      },
    },
    zweiFaktor: {
      async status() {
        const { t, u } = kanzleiSitzung();
        const d = zfDaten(u.id);
        return {
          aktiv: !!d?.aktiv,
          pflicht: kanzleiSicherheit(t.tenant).zweiFaktorPflicht && !istPraesentationskanzlei(t.tenant.id),
          eingerichtetAm: d?.aktiv ? d.seit : undefined,
          wiederherstellungUebrig: d?.aktiv ? d.codes.length : undefined,
        };
      },
      async einrichten() {
        const { u } = kanzleiSitzung();
        if (zfAktiv(u.id)) throw new Error("Die Zwei-Faktor-Anmeldung ist bereits eingerichtet. Zum Wechsel des Telefons schalten Sie sie zuerst ab.");
        const schluessel = neuerSchluessel();
        zfSetzen(u.id, { schluessel, aktiv: false, codes: [] });
        return { schluessel, uri: otpauthUri(schluessel, u.email) };
      },
      async bestaetigen(code) {
        const { u } = kanzleiSitzung();
        const d = zfDaten(u.id);
        if (!d || d.aktiv) throw new Error("Es läuft keine Einrichtung. Bitte starten Sie die Einrichtung erneut.");
        const key = `zf:${u.id}`;
        if (gesperrtNachFehlversuchen(key)) throw new Error("Zu viele falsche Codes. Bitte warten Sie 15 Minuten und starten Sie die Einrichtung dann neu.");
        const schritt = await pruefeTotp(d.schluessel, code);
        if (schritt === null) {
          fehlversuch(key);
          throw new Error("Der Code stimmt nicht. Bitte prüfen Sie, ob der Schlüssel vollständig in der App steht, und geben Sie den aktuell angezeigten 6-stelligen Code ein.");
        }
        fehlversuche.delete(key);
        const codes = neueWiederherstellungscodes();
        zfSetzen(u.id, { schluessel: d.schluessel, aktiv: true, seit: zeitBerlin(), codes: codes.map(wiederherstellungNormal), letzterSchritt: schritt });
        const { t } = kanzleiSitzung();
        protokolliere(t.tenant.id, vorgang(VORGANG.zweiFaktorEingerichtet(u.name), { akteur: "nutzer", userId: u.id }));
        return { wiederherstellungscodes: codes };
      },
      async deaktivieren(code) {
        const { t, u } = kanzleiSitzung();
        if (kanzleiSicherheit(t.tenant).zweiFaktorPflicht && !istPraesentationskanzlei(t.tenant.id)) throw new Error("Ihre Kanzlei verlangt die Zwei-Faktor-Anmeldung für alle – abschalten ist nicht möglich. Bei einem neuen Telefon setzen Partner oder Administration sie unter Team zurück.");
        const key = `zf:${u.id}`;
        if (gesperrtNachFehlversuchen(key)) throw new Error("Zu viele falsche Codes. Bitte warten Sie 15 Minuten.");
        if (!(await zfPruefen(u.id, code))) {
          fehlversuch(key);
          throw new Error("Der Code stimmt nicht. Bitte geben Sie den aktuellen Code aus Ihrer Authenticator-App oder einen Wiederherstellungscode ein.");
        }
        fehlversuche.delete(key);
        zfSetzen(u.id, null);
        protokolliere(t.tenant.id, vorgang(VORGANG.zweiFaktorDeaktiviert(u.name), { akteur: "nutzer", userId: u.id }));
      },
    },
    team: {
      async add(input) {
        const { t } = kanzleiSitzung(true);
        if (!istEmail(input.email.trim().toLowerCase())) throw new Error("Bitte geben Sie eine gültige E-Mail-Adresse an, z. B. anna.schulz@kanzlei.de.");
        const extra = lsGet<DemoTenant[]>(LS_REGISTRY) ?? [];
        const all = registry();
        if (all.some((x) => x.users.some((u) => u.email.toLowerCase() === input.email.trim().toLowerCase()))) {
          throw new Error("Diese E-Mail-Adresse ist bereits vergeben. Bitte prüfen Sie die Adresse oder vergeben Sie dem bestehenden Zugang ein neues Startpasswort.");
        }
        if (t.users.length >= t.tenant.lizenz.arbeitsplaetze) throw new Error(`Alle ${t.tenant.lizenz.arbeitsplaetze} Arbeitsplätze der Lizenz sind belegt. Weitere Arbeitsplätze erhalten Sie über ${t.tenant.ansprechpartner.name}.`);
        const passwort = sicheresPasswort();
        // Kennung ohne Kollision mit bestehenden Zugängen der Kanzlei
        let user: DemoUser = { ...baueNutzer(t.tenant.id, input, t.users.length + 1 + zufallsZahl(900)), passwort };
        while (all.some((x) => x.users.some((y) => y.id === user.id))) user = { ...baueNutzer(t.tenant.id, input, t.users.length + 1 + zufallsZahl(9000)), passwort };
        const builtin = DEMO_TENANTS.some((x) => x.tenant.id === t.tenant.id);
        if (builtin) {
          const eu = lsGet<Record<string, DemoUser[]>>(LS_EXTRA_USERS) ?? {};
          eu[t.tenant.id] = [...(eu[t.tenant.id] ?? []), user];
          lsSet(LS_EXTRA_USERS, eu);
        } else {
          const idx = extra.findIndex((x) => x.tenant.id === t.tenant.id);
          if (idx >= 0) extra[idx].users.push(user);
          lsSet(LS_REGISTRY, extra);
        }
        setzePasswortWechsel(user.id, true);
        return { user: publicUser(user), passwort };
      },
      async remove(id) {
        // Nur innerhalb der eigenen Kanzlei und nie den eigenen Zugang – wie auf dem Server.
        const { t, u } = kanzleiSitzung(true);
        if (id === u.id) throw new Error("Sie können sich nicht selbst entfernen.");
        const ziel = t.users.find((x) => x.id === id);
        if (!ziel) throw new Error("Dieser Zugang gehört nicht zu Ihrer Kanzlei.");
        if (ziel.rolle === "partner" && u.rolle !== "partner") throw new Error("Partner-Zugänge können nur Partner verwalten.");
        if (ziel.rolle === "partner" && t.users.filter((x) => x.rolle === "partner" && !x.deaktiviert).length <= 1) throw new Error("Mindestens ein aktiver Partner-Zugang muss bestehen bleiben.");
        const extra = lsGet<DemoTenant[]>(LS_REGISTRY) ?? [];
        for (const x of extra) if (x.tenant.id === t.tenant.id) x.users = x.users.filter((y) => y.id !== id);
        lsSet(LS_REGISTRY, extra);
        const eu = lsGet<Record<string, DemoUser[]>>(LS_EXTRA_USERS) ?? {};
        if (eu[t.tenant.id]) eu[t.tenant.id] = eu[t.tenant.id].filter((y) => y.id !== id);
        lsSet(LS_EXTRA_USERS, eu);
        // fest eingebaute Beispiel-Zugänge dauerhaft ausblenden (kehren erst mit „Demo-Daten zurücksetzen" zurück)
        const eingebaut = DEMO_TENANTS.find((x) => x.tenant.id === t.tenant.id)?.users.some((y) => y.id === id);
        if (eingebaut) {
          const entfernt = lsGet<Record<string, string[]>>(LS_ENTFERNT) ?? {};
          entfernt[t.tenant.id] = [...new Set([...(entfernt[t.tenant.id] ?? []), id])];
          lsSet(LS_ENTFERNT, entfernt);
        }
        setzePasswortWechsel(id, false);
        zfSetzen(id, null);
        const aend = lsGet<Record<string, NutzerAenderung>>(LS_NUTZER_AENDERUNG) ?? {};
        delete aend[id];
        lsSet(LS_NUTZER_AENDERUNG, aend);
      },
      async neuesPasswort(id) {
        const { t, u } = kanzleiSitzung(true);
        if (id === u.id) throw new Error("Ihr eigenes Passwort können Sie hier nicht neu vergeben.");
        const ziel = t.users.find((x) => x.id === id);
        if (!ziel) throw new Error("Dieser Zugang gehört nicht zu Ihrer Kanzlei.");
        if (ziel.rolle === "partner" && u.rolle !== "partner") throw new Error("Partner-Zugänge können nur Partner verwalten.");
        const pw = sicheresPasswort();
        const map = lsGet<Record<string, string>>(LS_PW) ?? {};
        map[id] = pw;
        lsSet(LS_PW, map);
        setzePasswortWechsel(id, true);
        return pw;
      },
      async aendern(id, a: TeamAenderung) {
        const { t, u } = kanzleiSitzung();
        const ziel = t.users.find((x) => x.id === id);
        if (!ziel) throw new Error("Dieser Zugang gehört nicht zu Ihrer Kanzlei.");
        pruefeTeamAenderung(t, u, ziel, a);
        const aend = lsGet<Record<string, NutzerAenderung>>(LS_NUTZER_AENDERUNG) ?? {};
        const neu: NutzerAenderung = { ...(aend[id] ?? { abwesenheit: ziel.abwesenheit, deaktiviert: ziel.deaktiviert }) };
        if (a.abwesenheit !== undefined) neu.abwesenheit = a.abwesenheit ?? undefined;
        if (a.deaktiviert !== undefined) neu.deaktiviert = a.deaktiviert || undefined;
        aend[id] = neu;
        lsSet(LS_NUTZER_AENDERUNG, aend);
        if (a.zweiFaktorZuruecksetzen) {
          zfSetzen(id, null);
          protokolliere(t.tenant.id, vorgang(VORGANG.zweiFaktorZurueckgesetzt(ziel.name, u.name), { akteur: "nutzer", userId: u.id }));
        }
        return publicUser(mitAenderung(ziel, neu));
      },
    },
    console: {
      async list() {
        const out: ConsoleKunde[] = [];
        for (const t of registry()) {
          const stored = await store<StoredData>(`aa:data:${t.tenant.id}`);
          out.push({ tenant: t.tenant, users: t.users.map(publicUser), stats: statsFuer(t, stored?.data) });
        }
        return out;
      },
      async create(input: NeuerKunde) {
        const email = input.adminEmail.trim().toLowerCase();
        if (!input.kanzlei.trim() || !input.adminName.trim() || !input.bundesland) throw new Error("Bitte Kanzlei, Bundesland sowie Name und E-Mail-Adresse der Hauptnutzerin bzw. des Hauptnutzers angeben.");
        if (!istEmail(email)) throw new Error("Bitte geben Sie eine gültige E-Mail-Adresse an, z. B. c.reinholz@kanzlei.de.");
        if (email === CONSOLE_DEMO.email) throw new Error("Die Adresse der Apex Console kann keiner Kanzlei zugeordnet werden – bitte eine andere Adresse wählen.");
        if (registry().some((t) => t.users.some((u) => u.email.toLowerCase() === email))) throw new Error("Diese E-Mail-Adresse ist bereits einem Zugang zugeordnet. Bitte prüfen Sie die Adresse oder vergeben Sie dem bestehenden Zugang ein neues Passwort.");
        const suffix = zufallsKennung(6);
        const { tenant, admin } = baueKunde(input, suffix);
        const passwort = sicheresPasswort();
        const neu: DemoTenant & { leer?: boolean } = {
          tenant,
          users: [{ ...admin, passwort }],
          profil: profilFuer(input.schwerpunkte, input.bundesland),
          leer: !input.beispieldaten,
        };
        const extra = lsGet<DemoTenant[]>(LS_REGISTRY) ?? [];
        extra.push(neu);
        lsSet(LS_REGISTRY, extra);
        // Startpasswort: Bei der ersten Anmeldung legt die Kanzlei ein eigenes Passwort fest (wie im Server-Betrieb).
        setzePasswortWechsel(admin.id, true);
        // Anbieter-Eingriffe (I4-T16-01): eigener Urheber „AnwaltApex (Apex Console)“ im Kanzleiprotokoll
        protokolliere(tenant.id, anbieterVorgang(VORGANG.zugangAngelegt(admin.name, rollenLabel(admin)), { userId: admin.id, anbieterPerson: CONSOLE_DEMO.name }));
        protokolliere(tenant.id, anbieterVorgang(VORGANG.startpasswortVergeben(admin.name), { userId: admin.id, anbieterPerson: CONSOLE_DEMO.name }));
        return { tenant, admin, passwort };
      },
      async remove(tenantId) {
        const extra = (lsGet<DemoTenant[]>(LS_REGISTRY) ?? []).filter((t) => t.tenant.id !== tenantId);
        lsSet(LS_REGISTRY, extra);
        await store(`aa:data:${tenantId}`, null);
        const alle = lsGet<Record<string, Aktivitaet[]>>(LS_VORGAENGE) ?? {};
        delete alle[tenantId];
        lsSet(LS_VORGAENGE, alle);
      },
      async reset(tenantId) {
        await store(`aa:data:${tenantId}`, null);
        protokolliere(tenantId, anbieterVorgang(VORGANG.beispieldatenZurueckgesetzt(), { anbieterPerson: CONSOLE_DEMO.name }));
      },
      async setStatus(tenantId, status) {
        const o = lsGet<Record<string, Partial<Record<keyof Tenant, unknown>>>>(LS_OVERRIDES) ?? {};
        const t = findTenant(tenantId)?.tenant;
        // Testzugang → Kunde: Die Lifetime-Lizenz gilt ab heute, der Testzeitraum entfällt.
        const kauf = t && t.status === "test" && status === "aktiv" ? { lizenz: { ...t.lizenz, seit: today() }, testBis: null } : {};
        o[tenantId] = { ...(o[tenantId] ?? {}), status, ...kauf };
        lsSet(LS_OVERRIDES, o);
      },
      async neuesPasswort(userId, anlass) {
        const ziel = findeNutzer(userId);
        if (!ziel) throw new Error("Nutzer nicht gefunden – bitte laden Sie die Kundenliste neu.");
        // Pflichtangaben: wer in der Kanzlei hat angefordert, aus welchem Anlass (I3-T21-02)
        const fehler = Object.entries(pruefeConsolePasswortAnlass(anlass))[0];
        if (fehler) throw feldFehler(fehler[1], fehler[0]);
        const pw = sicheresPasswort();
        const map = lsGet<Record<string, string>>(LS_PW) ?? {};
        map[userId] = pw;
        lsSet(LS_PW, map);
        setzePasswortWechsel(userId, true);
        // Anbieter-Eingriff: Die Kanzlei sieht ihn in ihrem Protokoll (Einstellungen → Datenschutz); Partner und Administration
        // erhalten zusätzlich einen Hinweis in der Glocke (statt einer E-Mail – der Prototyp versendet keine).
        protokolliere(
          ziel.t.tenant.id,
          anbieterVorgang(VORGANG.consolePasswort(ziel.u.name, anlass, CONSOLE_DEMO.name), { userId, anbieterPerson: anlass.bearbeiter?.trim() || CONSOLE_DEMO.name, kategorie: "anmeldung", meldung: true }),
        );
        return pw;
      },
      async standardPasswort(userId) {
        const eingebaut = DEMO_TENANTS.some((t) => t.users.some((u) => u.id === userId && u.passwort === DEMO_PASSWORT));
        if (!eingebaut) throw new Error("Nur Zugänge der eingebauten Präsentationskanzleien haben ein Standardpasswort.");
        const ziel = findeNutzer(userId);
        const map = lsGet<Record<string, string>>(LS_PW) ?? {};
        delete map[userId];
        lsSet(LS_PW, map);
        setzePasswortWechsel(userId, false);
        // öffentliche Demo wiederherstellen: auch eine hier eingerichtete Zwei-Faktor-Anmeldung entfällt
        zfSetzen(userId, null);
        if (ziel) protokolliere(ziel.t.tenant.id, anbieterVorgang(VORGANG.standardPasswort(ziel.u.name), { userId, anbieterPerson: CONSOLE_DEMO.name }));
      },
    },
  };
}
