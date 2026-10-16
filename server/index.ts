// AnwaltApex Server: Mehrmandanten-Betrieb mit Anmeldung, strikt getrennten Kanzleidaten, Apex Console und Claude-Proxy.
import { Hono, type Context } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { getConnInfo } from "@hono/node-server/conninfo";
import { bodyLimit } from "hono/body-limit";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { streamSSE } from "hono/streaming";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { COLLECTIONS, type Aktivitaet, type Bundesland, type CollectionKey, type Rolle, type Sachgebiet, type Tenant, type TenantData, type User } from "../src/core/types";
import { DEMO_TENANTS, DEMO_PASSWORT, publicUser } from "../src/core/seed/tenants";
import { generateTenantData, SEED_VERSION, type SeedInput } from "../src/core/seed/generate";
import { baueKunde, baueNutzer, profilFuer } from "../src/core/seed/kunde";
import { fmtDate, today } from "../src/core/dates";
import { neuerSchluessel, neueWiederherstellungscodes, otpauthUri, pruefeTotp, wiederherstellungNormal } from "../src/core/totp";
import {
  ANMELDUNG_FALSCH, AZUBI_GESPERRT, AZUBI_KEIN_ZUGRIFF, BUNDESLAENDER, CODE_SITZUNG_GEWECHSELT, PASSWORT_MAX, ROLLEN, SACHGEBIETE_ALLE, SPERRE_MINUTEN, VERWALTUNGS_ROLLEN, ZUGANG_DEAKTIVIERT,
  darfSammlung, istEmail, kanzleiSicherheit, pruefeNeuesPasswort, pruefeTeamAenderung, type KanzleiSitzung, type SperreMinuten, type TeamAenderung,
} from "../src/lib/backend/types";
import { pruefeDokument } from "../src/lib/backend/schema";
import { sicheresPasswort, zufallsZahl } from "../src/lib/backend/zufall";
import { ANMELDE_WARN_SCHWELLE, VORGANG, anmeldeVorgang, letzteEchteAktivitaet, mischeVorgaenge, vorgang, zaehleFehlversuch, zeitBerlin, type FehlGrund } from "../src/lib/backend/protokoll";
import { festeAnsprechperson, rollenLabel } from "../src/lib/rollen";

// ───────────── Konfiguration ─────────────
function zahlAusUmgebung(name: string, standard: number, min: number, max: number): number {
  const roh = process.env[name];
  if (roh === undefined || roh === "") return standard;
  const n = Number(roh);
  if (!Number.isFinite(n) || n < min) {
    console.warn(`⚠ ${name}=${roh} ist ungültig – es gilt ${standard}.`);
    return standard;
  }
  return Math.min(Math.floor(n), max);
}

const PORT = Number(process.env.PORT ?? 8787);
const DB_PATH = process.env.DATABASE_PATH ?? "./data/anwaltapex.db";
const CONSOLE_EMAIL = (process.env.CONSOLE_ADMIN_EMAIL ?? "admin@anwaltapex.de").trim().toLowerCase();
const CONSOLE_PASSWORD = process.env.CONSOLE_ADMIN_PASSWORD ?? "";
const QUICK_LOGIN = (process.env.DEMO_QUICK_LOGIN ?? "true") === "true";
const SEED_DEMO = (process.env.SEED_DEMO ?? "true") === "true";
const AI_MODEL = process.env.AI_MODEL ?? "claude-opus-5-5";
const COOKIE_SECURE = (process.env.COOKIE_SECURE ?? "false") === "true";
/** Hinter einem Reverse Proxy (Render, nginx …): Client-IP aus dem vom Proxy angehängten X-Forwarded-For-Eintrag lesen. */
const TRUST_PROXY = (process.env.TRUST_PROXY ?? "false") === "true";
const STATIC_DIR = process.env.STATIC_DIR ?? "./dist";
/** Live-KI auch für die eingebauten Präsentationskanzleien (öffentliche Demo-Zugangsdaten)? Auf öffentlichen Servern ggf. „off“. */
const AI_DEMO_TENANTS = (process.env.AI_DEMO_TENANTS ?? "on").trim().toLowerCase() !== "off";
/** Obergrenze für die Antwortlänge je KI-Anfrage (inkl. Denkanteil des Modells). */
const AI_MAX_TOKENS = zahlAusUmgebung("AI_MAX_TOKENS", 16000, 1024, 64000);
/** Tageskontingente (0 = unbegrenzt): Anfragen und Tokens je Kanzlei, Tokens für den ganzen Server. */
const AI_TAG_ANFRAGEN_KANZLEI = zahlAusUmgebung("AI_DAILY_REQUESTS_PER_TENANT", 400, 0, 10_000_000);
const AI_TAG_TOKENS_KANZLEI = zahlAusUmgebung("AI_DAILY_TOKENS_PER_TENANT", 3_000_000, 0, 1e12);
const AI_TAG_TOKENS_GESAMT = zahlAusUmgebung("AI_DAILY_TOKENS_TOTAL", 15_000_000, 0, 1e13);
const SESSION_HOURS = 12;
const VERSION = "0.9.0";

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

// Console-Passwort: Platzhalter aus .env.example, öffentlich bekannte Demo-Passwörter und zu kurze Werte schalten die Console ab.
const UNSICHERE_CONSOLE_PASSWOERTER = new Set(["bitte-ein-langes-passwort-setzen", "apex-console-2026", DEMO_PASSWORT.toLowerCase(), "changeme", "password", "passwort", "admin"]);
const CONSOLE_AKTIV = CONSOLE_PASSWORD.length >= 12 && !UNSICHERE_CONSOLE_PASSWOERTER.has(CONSOLE_PASSWORD.trim().toLowerCase());
if (!CONSOLE_PASSWORD) console.warn("⚠ CONSOLE_ADMIN_PASSWORD ist nicht gesetzt – die Apex Console ist deaktiviert.");
else if (!CONSOLE_AKTIV) console.warn("⚠ CONSOLE_ADMIN_PASSWORD ist ein Platzhalter, öffentlich bekannt oder kürzer als 12 Zeichen – die Apex Console bleibt deaktiviert.");
if (!COOKIE_SECURE) console.warn("ℹ COOKIE_SECURE=false – Sitzungs-Cookies auch über HTTP. Hinter HTTPS bitte COOKIE_SECURE=true setzen.");

// ───────────── Datenbank ─────────────
if (DB_PATH !== ":memory:") mkdirSync(dirname(resolve(DB_PATH)), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, json TEXT NOT NULL, profil TEXT NOT NULL, demo INTEGER NOT NULL DEFAULT 0, leer INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, email TEXT NOT NULL UNIQUE, pw_hash TEXT NOT NULL, json TEXT NOT NULL, last_login TEXT);
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, kind TEXT NOT NULL, user_id TEXT, tenant_id TEXT, expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS docs (tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, col TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (tenant_id, col, id));
  CREATE TABLE IF NOT EXISTS tenant_state (tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE, seeded_for TEXT, seed_version INTEGER, dirty INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, zeit TEXT NOT NULL, tenant_id TEXT, user_id TEXT, aktion TEXT NOT NULL, detail TEXT);
  CREATE TABLE IF NOT EXISTS ki_nutzung (tag TEXT NOT NULL, tenant_id TEXT NOT NULL, anfragen INTEGER NOT NULL DEFAULT 0, tokens INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (tag, tenant_id));
`);
// Spalte für Startpasswörter (Einladung/Neuvergabe): eigenes Passwort bei der nächsten Anmeldung festlegen
if (!(db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).some((c) => c.name === "pw_wechsel")) {
  db.exec("ALTER TABLE users ADD COLUMN pw_wechsel INTEGER NOT NULL DEFAULT 0");
}
// Zwei-Faktor-Anmeldung (TOTP): Schlüssel, Status, Wiederherstellungscodes (SHA-256), zuletzt verwendeter Zeitschritt
{
  const spalten = (db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map((c) => c.name);
  const neu: [string, string][] = [["mfa_secret", "TEXT"], ["mfa_aktiv", "INTEGER NOT NULL DEFAULT 0"], ["mfa_codes", "TEXT"], ["mfa_seit", "TEXT"], ["mfa_schritt", "INTEGER"]];
  for (const [name, typ] of neu) if (!spalten.includes(name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${typ}`);
}
// Hash des zuletzt ersetzten Startpassworts – nur, um im Protokoll „Startpasswort nicht mehr gültig“ statt „falsches Passwort“ zu nennen
if (!(db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).some((c) => c.name === "pw_start_alt")) {
  db.exec("ALTER TABLE users ADD COLUMN pw_start_alt TEXT");
}
// Kanzleiprotokoll: echte Vorgänge (Anmeldung, Passwortvergaben, Anbieter-Eingriffe) – getrennt von den Beispieldaten, überdauern das Neuerzeugen
db.exec("CREATE TABLE IF NOT EXISTS vorgaenge (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, zeit TEXT NOT NULL, json TEXT NOT NULL)");
db.exec("CREATE INDEX IF NOT EXISTS vorgaenge_tenant ON vorgaenge (tenant_id, zeit)");

function protokolliere(tenantId: string, a: Aktivitaet) {
  db.prepare("INSERT OR IGNORE INTO vorgaenge (id, tenant_id, zeit, json) VALUES (?, ?, ?, ?)").run(a.id, tenantId, a.zeit, JSON.stringify(a));
}
function vorgaengeVon(tenantId: string): Aktivitaet[] {
  // neueste zuerst; bei gleicher Sekunde der zuletzt eingetragene oben
  return (db.prepare("SELECT json FROM vorgaenge WHERE tenant_id = ? ORDER BY zeit DESC, rowid DESC LIMIT 300").all(tenantId) as { json: string }[]).map((r) => JSON.parse(r.json));
}

function hashPw(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}
function pruefePw(pw: string, stored: string): boolean {
  const [alg, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(pw, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}
/** Für unbekannte E-Mail-Adressen wird gegen diesen Hash geprüft – gleiche Laufzeit, kein Hinweis auf existierende Zugänge. */
const DUMMY_HASH = hashPw(randomBytes(24).toString("hex"));

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest();
function consolePasswortOk(pw: string): boolean {
  return CONSOLE_AKTIV && timingSafeEqual(sha256(pw), sha256(CONSOLE_PASSWORD));
}

function audit(aktion: string, detail: string, tenantId?: string | null, userId?: string | null) {
  db.prepare("INSERT INTO audit (zeit, tenant_id, user_id, aktion, detail) VALUES (?, ?, ?, ?, ?)").run(new Date().toISOString(), tenantId ?? null, userId ?? null, aktion, detail.slice(0, 500));
}

type TenantRow = { id: string; json: string; profil: string; demo: number; leer: number };
type UserRow = {
  id: string; tenant_id: string; email: string; pw_hash: string; json: string; last_login: string | null; pw_wechsel: number; pw_start_alt?: string | null;
  mfa_secret: string | null; mfa_aktiv: number; mfa_codes: string | null; mfa_seit: string | null; mfa_schritt: number | null;
};

function tenantById(id: string): (TenantRow & { tenant: Tenant }) | undefined {
  const r = db.prepare("SELECT * FROM tenants WHERE id = ?").get(id) as TenantRow | undefined;
  return r ? { ...r, tenant: JSON.parse(r.json) } : undefined;
}
function usersOf(tenantId: string): User[] {
  return (db.prepare("SELECT json FROM users WHERE tenant_id = ? ORDER BY id").all(tenantId) as { json: string }[]).map((r) => JSON.parse(r.json));
}

function speichereTenant(t: Tenant, profil: SeedInput["profil"], demo: boolean, leer: boolean) {
  db.prepare("INSERT OR REPLACE INTO tenants (id, json, profil, demo, leer, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(t.id, JSON.stringify(t), JSON.stringify(profil), demo ? 1 : 0, leer ? 1 : 0, t.createdAt);
  db.prepare("INSERT OR IGNORE INTO tenant_state (tenant_id, dirty) VALUES (?, 0)").run(t.id);
}
function speichereUser(u: User, pw: string, wechsel = false) {
  db.prepare("INSERT INTO users (id, tenant_id, email, pw_hash, json, pw_wechsel) VALUES (?, ?, ?, ?, ?, ?)").run(u.id, u.tenantId, u.email.toLowerCase(), hashPw(pw), JSON.stringify(u), wechsel ? 1 : 0);
}
const darfVerwalten = (u: User) => VERWALTUNGS_ROLLEN.includes(u.rolle);
const userJson = (row: { json: string }) => JSON.parse(row.json) as User;
const sha256hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/**
 * Präsentationskanzleien: entfernte eingebaute Zugänge mit dem öffentlichen Demo-Passwort wiederherstellen
 * (beim Start sowie bei jedem Neuerzeugen bzw. Zurücksetzen der Beispieldaten). Bestehende Zugänge bleiben unverändert.
 */
function stelleDemoNutzerHer(tenantId: string): number {
  const dt = DEMO_TENANTS.find((t) => t.tenant.id === tenantId);
  if (!dt) return 0;
  let n = 0;
  for (const u of dt.users) {
    if (db.prepare("SELECT 1 FROM users WHERE id = ?").get(u.id)) continue;
    if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(u.email.toLowerCase())) continue;
    speichereUser(publicUser(u), u.passwort);
    n++;
  }
  if (n) audit("demo.nutzer.wiederhergestellt", `${n} Zugänge`, tenantId);
  return n;
}

// Demo-Kanzleien beim ersten Start anlegen bzw. auf den aktuellen Stand bringen
if (SEED_DEMO) {
  for (const dt of DEMO_TENANTS) {
    const vorhanden = tenantById(dt.tenant.id);
    if (!vorhanden) {
      speichereTenant(dt.tenant, dt.profil, true, false);
      for (const u of dt.users) speichereUser(publicUser(u), u.passwort);
      console.log(`Demo-Kanzlei angelegt: ${dt.tenant.name}`);
    } else {
      // Stand der eingebauten Präsentationskanzleien nachziehen: Ansprechpartner und Lizenzstatus
      // (früher als Testzugang bis 31.12.2026 angelegt, jetzt mit erworbener Lifetime-Lizenz). Vom Kunden gepflegte Profilfelder bleiben.
      const t = { ...vorhanden.tenant, ansprechpartner: dt.tenant.ansprechpartner };
      if (t.status === "test" && t.testBis === "2026-12-31" && dt.tenant.status === "aktiv") {
        t.status = "aktiv";
        delete t.testBis;
      }
      db.prepare("UPDATE tenants SET json = ? WHERE id = ?").run(JSON.stringify(t), dt.tenant.id);
      stelleDemoNutzerHer(dt.tenant.id);
      // Anrede der eingebauten Personen nachtragen (förmliche Anrede „Frau Dr. Hartmann“, Rollenbezeichnung)
      for (const u of dt.users) {
        const row = db.prepare("SELECT json FROM users WHERE id = ?").get(u.id) as { json: string } | undefined;
        if (!row || !u.anrede) continue;
        const gespeichert = userJson(row);
        if (gespeichert.anrede) continue;
        db.prepare("UPDATE users SET json = ? WHERE id = ?").run(JSON.stringify({ ...gespeichert, anrede: u.anrede }), u.id);
      }
    }
  }
}

// Bestehende Kunden-Kanzleien: Bezeichnung des Standard-Ansprechpartners an die aktuelle Fassung angleichen (S15).
{
  const standard = baueKunde({ kanzlei: "Migration", stadt: "", bundesland: "BE", adminName: "Migration Prüfung", adminEmail: "migration@example.invalid", arbeitsplaetze: 1, schwerpunkte: [] }, "migration").tenant.ansprechpartner;
  const rows = db.prepare("SELECT id, json FROM tenants WHERE demo = 0").all() as { id: string; json: string }[];
  let n = 0;
  for (const r of rows) {
    const t = JSON.parse(r.json) as Tenant;
    const ap = t.ansprechpartner;
    if (!ap || (ap.rolle === standard.rolle && ap.bezeichnung === standard.bezeichnung)) continue;
    if (ap.email !== standard.email && ap.name !== standard.name) continue; // individuell vergebener Ansprechpartner bleibt
    // Bezeichnung („Ansprechpartnerin“) auch dann setzen, wenn sie in älteren Datensätzen fehlt – alle Texte formulieren daraus.
    t.ansprechpartner = { ...ap, rolle: standard.rolle, bezeichnung: standard.bezeichnung };
    db.prepare("UPDATE tenants SET json = ? WHERE id = ?").run(JSON.stringify(t), r.id);
    n++;
  }
  if (n) console.log(`Ansprechpartner-Bezeichnung in ${n} Kanzlei(en) angeglichen.`);
}

const textFeld = (v: unknown) => (typeof v === "string" ? v : "");
const gemeldetKaputt = new Set<string>();

/**
 * Datenbestand einer Kanzlei laden. Neu erzeugt (relativ zu „heute“) wird nur, was niemandem gehört:
 * - Präsentationskanzleien (demo = 1): täglich frisch; Änderungen während einer Präsentation bleiben bis zum Tagesende.
 * - Kunden-Kanzleien: nur unveränderte Beispieldaten. Sobald die Kanzlei etwas geändert hat (dirty), wird nie automatisch
 *   gelöscht – auch nicht bei einer neuen SEED_VERSION (dann wird nur die Versionsnummer nachgezogen).
 */
function ladeDaten(tenantId: string, force = false): TenantData {
  const t = tenantById(tenantId);
  if (!t) throw new Error("Kanzlei nicht gefunden");
  const st = db.prepare("SELECT * FROM tenant_state WHERE tenant_id = ?").get(tenantId) as { seeded_for: string | null; seed_version: number | null; dirty: number } | undefined;
  const heute = today();
  const versionAlt = !!st && st.seed_version !== SEED_VERSION;
  let neu: boolean;
  if (force) neu = true;
  else if (t.demo) neu = !st || !st.seeded_for || st.seeded_for !== heute || versionAlt;
  else if (!st || !st.seeded_for) neu = !db.prepare("SELECT 1 FROM docs WHERE tenant_id = ? LIMIT 1").get(tenantId);
  else neu = !st.dirty && (st.seeded_for !== heute || versionAlt);

  if (neu) {
    if (t.demo) stelleDemoNutzerHer(tenantId);
    const data = generateTenantData({ tenant: t.tenant, users: usersOf(tenantId), profil: JSON.parse(t.profil) }, heute, { leer: !!t.leer, kundentest: !t.demo });
    db.exec("BEGIN");
    try {
      db.prepare("DELETE FROM docs WHERE tenant_id = ?").run(tenantId);
      const ins = db.prepare("INSERT INTO docs (tenant_id, col, id, json, updated_at) VALUES (?, ?, ?, ?, ?)");
      const now = Date.now();
      for (const col of COLLECTIONS) for (const doc of data[col] as { id: string }[]) ins.run(tenantId, col, doc.id, JSON.stringify(doc), now);
      db.prepare("INSERT OR REPLACE INTO tenant_state (tenant_id, seeded_for, seed_version, dirty) VALUES (?, ?, ?, 0)").run(tenantId, heute, SEED_VERSION);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    data.aktivitaeten = mischeVorgaenge(data.aktivitaeten, vorgaengeVon(tenantId));
    return data;
  }
  if (!st) db.prepare("INSERT OR IGNORE INTO tenant_state (tenant_id, seeded_for, seed_version, dirty) VALUES (?, ?, ?, 1)").run(tenantId, heute, SEED_VERSION);
  else if (versionAlt) {
    db.prepare("UPDATE tenant_state SET seed_version = ? WHERE tenant_id = ?").run(SEED_VERSION, tenantId);
    audit("data.seed.beibehalten", `Datenbestand bleibt (SEED_VERSION ${st.seed_version ?? "–"} → ${SEED_VERSION})`, tenantId);
  }
  const rows = db.prepare("SELECT col, json FROM docs WHERE tenant_id = ?").all(tenantId) as { col: CollectionKey; json: string }[];
  const data = Object.fromEntries(COLLECTIONS.map((c) => [c, [] as unknown[]])) as unknown as TenantData;
  data.meta = [{ seedVersion: SEED_VERSION, seededAt: `${st?.seeded_for ?? heute}T06:00:00` }];
  // Beschädigte Altbestände überspringen statt die ganze Kanzlei zu blockieren
  let kaputt = 0;
  for (const r of rows) {
    if (!COLLECTIONS.includes(r.col)) continue;
    let doc: unknown;
    try {
      doc = JSON.parse(r.json);
    } catch {
      kaputt++;
      continue;
    }
    if (pruefeDokument(r.col, doc)) {
      kaputt++;
      continue;
    }
    (data[r.col] as unknown[]).push(doc);
  }
  if (kaputt && !gemeldetKaputt.has(tenantId)) {
    gemeldetKaputt.add(tenantId);
    console.warn(`⚠ Kanzlei ${tenantId}: ${kaputt} beschädigte Dokumente beim Laden übersprungen.`);
    audit("data.uebersprungen", `${kaputt} beschädigte Dokumente`, tenantId);
  }
  data.akten.sort((a, b) => textFeld(b.aktenzeichen).localeCompare(textFeld(a.aktenzeichen), "de", { numeric: true }));
  data.nachrichten.sort((a, b) => textFeld(b.eingang).localeCompare(textFeld(a.eingang)));
  data.aktivitaeten.sort((a, b) => textFeld(b.zeit).localeCompare(textFeld(a.zeit)));
  data.fristen.sort((a, b) => textFeld(a.datum).localeCompare(textFeld(b.datum)));
  data.aktivitaeten = mischeVorgaenge(data.aktivitaeten, vorgaengeVon(tenantId));
  return data;
}

// ───────────── Sitzungen ─────────────
type TenantSess = { kind: "tenant"; userId: string; tenantId: string };
type Sess = TenantSess | { kind: "console" };

function setzeSitzungsCookie(c: Context, token: string) {
  setCookie(c, "aa_sid", token, { httpOnly: true, sameSite: "Lax", secure: COOKIE_SECURE, path: "/", maxAge: SESSION_HOURS * 3600 });
}

function neueSitzung(c: Context, s: Sess) {
  const token = randomBytes(32).toString("hex");
  const expires = Date.now() + SESSION_HOURS * 3600_000;
  db.prepare("INSERT INTO sessions (token, kind, user_id, tenant_id, expires) VALUES (?, ?, ?, ?, ?)").run(token, s.kind, s.kind === "tenant" ? s.userId : null, s.kind === "tenant" ? s.tenantId : null, expires);
  setzeSitzungsCookie(c, token);
  sitzungsMemo.delete(c);
}

/** Pausierte Kanzleien und abgelaufene Testzugänge werden abgewiesen (Präsentationskanzleien, demo = 1, laufen nicht ab). */
function zugangsSperre(tenantId: string): string | null {
  const t = tenantById(tenantId);
  if (!t) return "Kanzlei nicht gefunden.";
  const ap = t.tenant.ansprechpartner;
  const kontakt = `${festeAnsprechperson(ap)}: ${ap.name} (${ap.telefon}).`;
  if (t.tenant.status === "pausiert") return `Der Zugang dieser Kanzlei ist pausiert. ${kontakt}`;
  if (t.tenant.testBis && t.tenant.testBis < today() && t.tenant.status === "test" && !t.demo) return `Der Testzeitraum ist am ${fmtDate(t.tenant.testBis)} abgelaufen. ${kontakt} ${ap.name} verlängert den Zugang gern.`;
  return null;
}

const sitzungsMemo = new WeakMap<Context, Sess | null>();

/**
 * Sitzung der Anfrage. Gültig nur, solange es den Zugang noch gibt, kein Startpasswort aussteht und die Kanzlei weder pausiert
 * noch ihr Testzeitraum abgelaufen ist – entfernte Personen und gesperrte Kanzleien verlieren den Zugriff sofort (S1).
 * Gleitende Gültigkeit: Bei Nutzung verlängert sich die Sitzung (spätestens stündlich) auf 12 Stunden ab jetzt.
 */
function sitzung(c: Context): Sess | null {
  if (sitzungsMemo.has(c)) return sitzungsMemo.get(c) ?? null;
  const ergebnis = ermittleSitzung(c);
  sitzungsMemo.set(c, ergebnis);
  return ergebnis;
}

function ermittleSitzung(c: Context): Sess | null {
  const token = getCookie(c, "aa_sid");
  if (!token || token.length > 128) return null;
  const r = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token) as { kind: string; user_id: string; tenant_id: string; expires: number } | undefined;
  if (!r) return null;
  const now = Date.now();
  const beenden = () => {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  };
  if (r.expires < now) return beenden();
  if (r.kind === "console") {
    if (!CONSOLE_AKTIV) return beenden();
  } else {
    const u = db.prepare("SELECT pw_wechsel, json FROM users WHERE id = ? AND tenant_id = ?").get(r.user_id, r.tenant_id) as { pw_wechsel: number; json: string } | undefined;
    // deaktivierte Zugänge verlieren die Sitzung sofort (umkehrbar über „Reaktivieren“)
    if (!u || u.pw_wechsel || userJson(u).deaktiviert || zugangsSperre(r.tenant_id)) return beenden();
  }
  if (r.expires - now < (SESSION_HOURS - 1) * 3600_000) {
    db.prepare("UPDATE sessions SET expires = ? WHERE token = ?").run(now + SESSION_HOURS * 3600_000, token);
    setzeSitzungsCookie(c, token);
  }
  return r.kind === "console" ? { kind: "console" } : { kind: "tenant", userId: r.user_id, tenantId: r.tenant_id };
}

function sessionInfo(s: TenantSess): KanzleiSitzung | null {
  const t = tenantById(s.tenantId);
  const u = db.prepare("SELECT json, mfa_aktiv FROM users WHERE id = ? AND tenant_id = ?").get(s.userId, s.tenantId) as { json: string; mfa_aktiv: number } | undefined;
  if (!t || !u) return null;
  const zweiFaktorFehlt = kanzleiSicherheit(t.tenant).zweiFaktorPflicht && !t.demo && !u.mfa_aktiv;
  return {
    user: JSON.parse(u.json),
    tenant: t.tenant,
    team: usersOf(s.tenantId),
    betrieb: { praesentation: !!t.demo, beispieldaten: !t.leer, kiLive: !!anthropic && (AI_DEMO_TENANTS || !t.demo), ...(zweiFaktorFehlt ? { zweiFaktorFehlt: true } : {}) },
  };
}

const fehler = (c: Context, status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 | 503, text: string) => c.json({ fehler: text }, status);

/**
 * Zugriff auf Kanzleidaten: angemeldet UND an genau diese Kanzlei/Person gebunden (Kopfzeilen X-Kanzlei, X-Nutzer).
 * Hat sich im selben Browser inzwischen jemand anderes angemeldet (anderer Tab), wird abgewiesen – sonst würden Daten der
 * alten Kanzlei in die neue geschrieben (S0).
 */
function kanzleiZugriff(c: Context, opts: { zweiFaktorEinrichtung?: boolean } = {}): TenantSess | Response {
  const s = sitzung(c);
  if (!s || s.kind !== "tenant") return fehler(c, 401, "Ihre Anmeldung ist abgelaufen oder wurde beendet. Bitte melden Sie sich erneut an.");
  if (c.req.header("x-kanzlei") !== s.tenantId || c.req.header("x-nutzer") !== s.userId) {
    return c.json({ fehler: "In diesem Browser ist inzwischen ein anderer Zugang angemeldet (z. B. in einem anderen Tab). Die Anfrage wurde nicht ausgeführt.", code: CODE_SITZUNG_GEWECHSELT }, 409);
  }
  // Zwei-Faktor-Pflicht der Kanzlei: Bis die Person sie eingerichtet hat, gibt es nur die Einrichtung – keine Kanzleidaten.
  if (!opts.zweiFaktorEinrichtung && sessionInfo(s)?.betrieb?.zweiFaktorFehlt) {
    return fehler(c, 403, "Ihre Kanzlei verlangt die Zwei-Faktor-Anmeldung. Bitte richten Sie sie zuerst ein (Authenticator-App auf Ihrem Telefon).");
  }
  return s;
}

// ───────────── Begrenzungen gegen Passwort-Raten und KI-Missbrauch ─────────────
const buckets = new Map<string, number[]>();
function treffer(key: string, fensterMs: number): number[] {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < fensterMs);
  if (arr.length) buckets.set(key, arr);
  else buckets.delete(key);
  return arr;
}
/** Gesperrt, wenn im Fenster bereits `max` gezählte Ereignisse liegen. Abgewiesene Versuche zählen nicht (verlängern die Sperre nicht). */
const gesperrt = (key: string, max: number, fensterMs: number) => treffer(key, fensterMs).length >= max;
function zaehle(key: string, fensterMs: number) {
  const arr = treffer(key, fensterMs);
  arr.push(Date.now());
  buckets.set(key, arr);
  if (buckets.size > 50_000) {
    // Speicher begrenzen: älteste Einträge verwerfen
    let n = 0;
    for (const k of buckets.keys()) {
      buckets.delete(k);
      if (++n >= 5_000) break;
    }
  }
}
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of buckets) if (!arr.length || now - arr[arr.length - 1] > 3600_000) buckets.delete(k);
}, 5 * 60_000).unref();

/** Client-IP: Socket-Adresse; hinter einem vertrauenswürdigen Proxy (TRUST_PROXY=true) der vom Proxy angehängte letzte X-Forwarded-For-Eintrag. */
function clientIp(c: Context): string {
  if (TRUST_PROXY) {
    const teile = (c.req.header("x-forwarded-for") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    if (teile.length) return teile[teile.length - 1];
  }
  try {
    return getConnInfo(c).remote.address ?? "unbekannt";
  } catch {
    return "unbekannt";
  }
}

const LOGIN_IP_MAX = 12;
const LOGIN_IP_FENSTER = 60_000;
const LOGIN_MAIL_MAX = 8;
const LOGIN_MAIL_FENSTER = 15 * 60_000;

/** Prüft die Sperren vor einem Anmeldeversuch; `fehlversuch()` zählt einen gescheiterten Versuch für IP und E-Mail. */
function anmeldeSperre(c: Context, email: string): { sperre: Response | null; fehlversuch: () => void; erfolg: () => void } {
  const ipKey = `login:ip:${clientIp(c)}`;
  const mailKey = `login:mail:${email}`;
  let sperre: Response | null = null;
  if (gesperrt(ipKey, LOGIN_IP_MAX, LOGIN_IP_FENSTER)) sperre = fehler(c, 429, "Zu viele Anmeldeversuche von diesem Gerät. Bitte warten Sie eine Minute und versuchen Sie es dann erneut.");
  else if (email && gesperrt(mailKey, LOGIN_MAIL_MAX, LOGIN_MAIL_FENSTER)) sperre = fehler(c, 429, "Zu viele Fehlversuche für diesen Zugang. Bitte warten Sie 15 Minuten – oder lassen Sie über „Passwort vergessen?“ ein neues Startpasswort vergeben.");
  return {
    sperre,
    fehlversuch: () => {
      zaehle(ipKey, LOGIN_IP_FENSTER);
      if (email) zaehle(mailKey, LOGIN_MAIL_FENSTER);
    },
    erfolg: () => buckets.delete(mailKey),
  };
}

// Schnell-Login: Prüfergebnis „Demo-Passwort gilt noch“ je gespeichertem Hash (scrypt nur einmal je Passwortstand)
const demoPwGilt = new Map<string, boolean>();
function giltDemoPasswort(hash: string): boolean {
  let ok = demoPwGilt.get(hash);
  if (ok === undefined) {
    ok = pruefePw(DEMO_PASSWORT, hash);
    if (demoPwGilt.size > 1000) demoPwGilt.clear();
    demoPwGilt.set(hash, ok);
  }
  return ok;
}

// ───────────── Prüfhilfen ─────────────
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
function istIsoDatum(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

// ───────────── API ─────────────
const app = new Hono();

/** Inline-Styles sind nötig: motion/react setzt Stil-Attribute und für AnimatePresence „popLayout“ ein <style>-Element. Skripte nur vom eigenen Server. */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "same-origin");
  c.header("X-Frame-Options", "SAMEORIGIN");
  c.header("Permissions-Policy", "camera=(), geolocation=(), microphone=(self)");
  c.header("Content-Security-Policy", CSP);
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  if (COOKIE_SECURE) c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  const pfad = c.req.path;
  if (pfad.startsWith("/api/")) c.header("Cache-Control", "no-store");
  else if (pfad.startsWith("/assets/") && c.res.status === 200) c.header("Cache-Control", "public, max-age=31536000, immutable");
  else if ((c.res.headers.get("content-type") ?? "").startsWith("text/html")) c.header("Cache-Control", "no-cache");
});

// Größenbegrenzung vor dem Einlesen: 64 KB allgemein, 3 MB für Dokumente und KI-Anfragen (S3)
const zuGross = (c: Context) => fehler(c, 413, "Die Anfrage ist zu groß.");
const limitKlein = bodyLimit({ maxSize: 64 * 1024, onError: zuGross });
const limitGross = bodyLimit({ maxSize: 3 * 1024 * 1024, onError: zuGross });
app.use("/api/*", (c, next) => {
  const gross = (c.req.method === "PUT" && c.req.path.startsWith("/api/data/")) || c.req.path === "/api/ai/messages";
  return (gross ? limitGross : limitKlein)(c, next);
});

app.onError((e, c) => {
  console.error("Serverfehler", c.req.method, c.req.path, e);
  return fehler(c, 500, "Auf dem Server ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.");
});

app.get("/api/info", (c) => c.json({ modus: "server", schnellLogin: QUICK_LOGIN, ki: { server: !!anthropic, modell: anthropic ? AI_MODEL : undefined }, version: VERSION }));
app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/auth/schnell", (c) => {
  if (!QUICK_LOGIN) return c.json([]);
  // Nur die eingebauten Demo-Kanzleien (deren Passwort öffentlich ist) – nie echte Kunden oder die Console.
  // Je Kanzlei der erste Zugang, für den das öffentliche Demo-Passwort tatsächlich noch gilt (S10).
  const karten = [];
  for (const t of DEMO_TENANTS) {
    if (!tenantById(t.tenant.id) || zugangsSperre(t.tenant.id)) continue;
    for (const u of t.users) {
      const row = db.prepare("SELECT pw_hash, pw_wechsel, mfa_aktiv, json FROM users WHERE id = ? AND tenant_id = ?").get(u.id, t.tenant.id) as { pw_hash: string; pw_wechsel: number; mfa_aktiv: number; json: string } | undefined;
      // Ein-Klick nur, solange das öffentliche Demo-Passwort allein genügt (kein zweiter Faktor, nicht deaktiviert)
      if (!row || row.pw_wechsel || row.mfa_aktiv || userJson(row).deaktiviert || !giltDemoPasswort(row.pw_hash)) continue;
      karten.push({ email: u.email, passwort: DEMO_PASSWORT, name: u.name, kanzlei: t.tenant.kurzname, stadt: t.tenant.stadt, titel: u.titel, initialen: u.initialen, farbe: u.farbe });
      break;
    }
  }
  return c.json(karten);
});

app.post("/api/auth/login", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { email?: unknown; passwort?: unknown };
  const email = String(body.email ?? "").trim().toLowerCase();
  const pw = String(body.passwort ?? "");
  const grenze = anmeldeSperre(c, email.slice(0, 254));
  if (grenze.sperre) return grenze.sperre;
  if (!email || !pw) return fehler(c, 400, "Bitte geben Sie E-Mail-Adresse und Passwort ein.");
  if (email.length > 254 || pw.length > PASSWORT_MAX) {
    grenze.fehlversuch();
    return fehler(c, 400, "E-Mail-Adresse oder Passwort sind zu lang. Bitte prüfen Sie die Eingabe.");
  }
  if (email === CONSOLE_EMAIL) {
    if (!CONSOLE_AKTIV) return fehler(c, 403, "Die Apex Console ist auf diesem Server nicht aktiviert. Der Betreiber schaltet sie mit CONSOLE_ADMIN_PASSWORD (mindestens 12 Zeichen) frei.");
    if (!consolePasswortOk(pw)) {
      grenze.fehlversuch();
      audit("console.login.fehlgeschlagen", clientIp(c));
      return fehler(c, 401, "Das Passwort der Apex Console stimmt nicht. Bitte prüfen Sie Groß- und Kleinschreibung.");
    }
    grenze.erfolg();
    neueSitzung(c, { kind: "console" });
    audit("console.login", email);
    return c.json({ console: true, email, name: "AnwaltApex Team" });
  }
  const u = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
  // Auch für unbekannte Adressen wird ein Hash geprüft – gleiche Antwortzeit, kein Hinweis auf bestehende Zugänge.
  const ok = pruefePw(pw, u?.pw_hash ?? DUMMY_HASH);
  if (!u || !ok) {
    grenze.fehlversuch();
    audit("login.fehlgeschlagen", email, u?.tenant_id, u?.id);
    // zweite Prüfung immer (auch ohne Konto) – gleiche Laufzeit; erkennt das ersetzte Startpasswort fürs Protokoll
    const altesStart = pruefePw(pw, u?.pw_start_alt ?? DUMMY_HASH) && !!u?.pw_start_alt;
    if (u) protokolliereFehlversuch(u, altesStart ? "startpasswort" : "passwort");
    return fehler(c, 401, ANMELDUNG_FALSCH);
  }
  grenze.erfolg();
  const sperre = zugangsSperre(u.tenant_id);
  if (sperre) return fehler(c, 403, sperre);
  if (userJson(u).deaktiviert) return fehler(c, 403, ZUGANG_DEAKTIVIERT);
  // Startpasswort (Einladung/Neuvergabe): erst nach eigenem Passwort gibt es eine Sitzung.
  if (u.pw_wechsel) return c.json({ fehler: "Bitte legen Sie zuerst ein eigenes Passwort fest.", passwortWechsel: true, email: u.email }, 403);
  // Zwei-Faktor: Sitzung erst nach dem Code aus der Authenticator-App
  if (u.mfa_aktiv) return c.json({ fehler: "Bitte geben Sie den Code aus Ihrer Authenticator-App ein.", zweiFaktor: true, vorgang: neuerZfVorgang(u), email: u.email }, 403);
  return c.json(anmelden(c, u));
});

/** Fehlversuche je Konto für den Hinweis an Partner und Administration (nur im Arbeitsspeicher). */
const kontoFehler = new Map<string, number[]>();

/**
 * Fehlgeschlagene Anmeldung im Kanzleiprotokoll – nur für bestehende Konten der Kanzlei, nie mit Passwort. Beim dritten
 * Fehlversuch innerhalb von 15 Minuten zusätzlich ein Hinweis für Partner und Administration (Glocke).
 */
function protokolliereFehlversuch(u: UserRow, grund: FehlGrund) {
  const name = userJson(u).name;
  protokolliere(u.tenant_id, anmeldeVorgang(VORGANG.anmeldungFehlgeschlagen(name, grund), { akteur: "system", userId: u.id }));
  if (zaehleFehlversuch(kontoFehler, u.id) === ANMELDE_WARN_SCHWELLE) {
    protokolliere(u.tenant_id, anmeldeVorgang(VORGANG.fehlversucheWarnung(name, ANMELDE_WARN_SCHWELLE), { akteur: "system", userId: u.id, meldung: true }));
  }
}

/** Sitzung anlegen und die Anmeldung im Kanzleiprotokoll festhalten (erste Anmeldung gesondert). */
function anmelden(c: Context, u: UserRow): KanzleiSitzung | null {
  const name = userJson(u).name;
  protokolliere(u.tenant_id, anmeldeVorgang(u.last_login ? VORGANG.anmeldung(name) : VORGANG.ersteAnmeldung(name), { akteur: "nutzer", userId: u.id }));
  db.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(new Date().toISOString(), u.id);
  const s = { kind: "tenant" as const, userId: u.id, tenantId: u.tenant_id };
  neueSitzung(c, s);
  audit("login", u.email, u.tenant_id, u.id);
  return sessionInfo(s);
}

// Anmeldevorgänge zwischen Passwort und Zwei-Faktor-Code (5 Minuten gültig)
const zfVorgaenge = new Map<string, { userId: string; bis: number }>();
const ZF_VORGANG_MS = 5 * 60_000;
function neuerZfVorgang(u: UserRow): string {
  const token = randomBytes(24).toString("hex");
  zfVorgaenge.set(token, { userId: u.id, bis: Date.now() + ZF_VORGANG_MS });
  if (zfVorgaenge.size > 10_000) for (const [k, v] of zfVorgaenge) if (v.bis < Date.now()) zfVorgaenge.delete(k);
  return token;
}

/** Prüft einen TOTP- oder Wiederherstellungscode und verbraucht ihn (Wiederverwendung ausgeschlossen). */
async function pruefeZweitenFaktor(u: UserRow, code: string): Promise<"totp" | "wiederherstellung" | null> {
  if (!u.mfa_aktiv || !u.mfa_secret) return null;
  const schritt = await pruefeTotp(u.mfa_secret, code, Date.now(), { nichtVor: u.mfa_schritt ?? undefined });
  if (schritt !== null) {
    db.prepare("UPDATE users SET mfa_schritt = ? WHERE id = ?").run(schritt, u.id);
    return "totp";
  }
  const n = wiederherstellungNormal(code);
  const codes = JSON.parse(u.mfa_codes ?? "[]") as string[];
  const h = sha256hex(n);
  if (n.length === 8 && codes.includes(h)) {
    db.prepare("UPDATE users SET mfa_codes = ? WHERE id = ?").run(JSON.stringify(codes.filter((x) => x !== h)), u.id);
    return "wiederherstellung";
  }
  return null;
}

app.post("/api/auth/zweifaktor", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { vorgang?: unknown; code?: unknown };
  const token = text(body.vorgang, 128);
  const code = text(body.code, 32);
  const v = zfVorgaenge.get(token);
  if (!v || v.bis < Date.now()) {
    zfVorgaenge.delete(token);
    return fehler(c, 401, "Der Anmeldevorgang ist abgelaufen (nach 5 Minuten). Bitte melden Sie sich erneut mit E-Mail-Adresse und Passwort an.");
  }
  const u = db.prepare("SELECT * FROM users WHERE id = ?").get(v.userId) as UserRow | undefined;
  if (!u) return fehler(c, 401, "Der Zugang ist nicht mehr vorhanden. Bitte wenden Sie sich an Ihre Kanzleiverwaltung.");
  // gleiche Begrenzung wie für Passwörter (je Gerät und je Zugang)
  const grenze = anmeldeSperre(c, u.email);
  if (grenze.sperre) return grenze.sperre;
  const sperre = zugangsSperre(u.tenant_id);
  if (sperre) return fehler(c, 403, sperre);
  if (userJson(u).deaktiviert) return fehler(c, 403, ZUGANG_DEAKTIVIERT);
  const art = await pruefeZweitenFaktor(u, code);
  if (!art) {
    grenze.fehlversuch();
    audit("zweifaktor.fehlgeschlagen", u.email, u.tenant_id, u.id);
    protokolliereFehlversuch(u, "zweifaktor");
    return fehler(c, 401, "Der Code stimmt nicht. Bitte geben Sie den aktuellen 6-stelligen Code aus Ihrer Authenticator-App ein (er wechselt alle 30 Sekunden) – oder einen Ihrer Wiederherstellungscodes.");
  }
  grenze.erfolg();
  zfVorgaenge.delete(token);
  if (art === "wiederherstellung") protokolliere(u.tenant_id, vorgang(VORGANG.zweiFaktorWiederherstellung(userJson(u).name), { akteur: "nutzer", userId: u.id }));
  return c.json(anmelden(c, u));
});

app.post("/api/auth/passwort", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { email?: unknown; passwort?: unknown; neuesPasswort?: unknown };
  const email = String(body.email ?? "").trim().toLowerCase();
  const pw = String(body.passwort ?? "");
  const neu = String(body.neuesPasswort ?? "");
  const grenze = anmeldeSperre(c, email.slice(0, 254));
  if (grenze.sperre) return grenze.sperre;
  if (email.length > 254 || pw.length > PASSWORT_MAX || neu.length > PASSWORT_MAX) return fehler(c, 400, `Bitte höchstens ${PASSWORT_MAX} Zeichen verwenden.`);
  const u = email ? (db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined) : undefined;
  const ok = pruefePw(pw, u?.pw_hash ?? DUMMY_HASH);
  if (!u || !ok) {
    grenze.fehlversuch();
    audit("passwort.fehlgeschlagen", email, u?.tenant_id, u?.id);
    if (u) protokolliereFehlversuch(u, "startpasswort");
    return fehler(c, 401, "Das Startpasswort stimmt nicht mehr (z. B. inzwischen neu vergeben). Bitte melden Sie sich erneut mit dem zuletzt erhaltenen Startpasswort an.");
  }
  grenze.erfolg();
  const sperre = zugangsSperre(u.tenant_id);
  if (sperre) return fehler(c, 403, sperre);
  if (userJson(u).deaktiviert) return fehler(c, 403, ZUGANG_DEAKTIVIERT);
  const regel = pruefeNeuesPasswort(neu, pw);
  if (regel) return fehler(c, 400, regel);
  db.prepare("UPDATE users SET pw_hash = ?, pw_wechsel = 0, pw_start_alt = ? WHERE id = ?").run(hashPw(neu), hashPw(pw), u.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(u.id);
  audit("passwort.eigenes", u.email, u.tenant_id, u.id);
  const name = userJson(u).name;
  if (u.mfa_aktiv) {
    protokolliere(u.tenant_id, vorgang(VORGANG.eigenesPasswort(name), { akteur: "nutzer", userId: u.id }));
    return c.json({ fehler: "Bitte geben Sie den Code aus Ihrer Authenticator-App ein.", zweiFaktor: true, vorgang: neuerZfVorgang(u), email: u.email }, 403);
  }
  // Reihenfolge im Protokoll: „Erste Anmeldung“, darüber „Eigenes Passwort festgelegt“
  const info = anmelden(c, u);
  protokolliere(u.tenant_id, vorgang(VORGANG.eigenesPasswort(name), { akteur: "nutzer", userId: u.id }));
  return c.json(info);
});

// Wiederanmeldung nach der Sperre bei Inaktivität: Passwort der angemeldeten Person prüfen (gleiche Begrenzung wie bei der Anmeldung)
app.post("/api/auth/entsperren", async (c) => {
  const s = kanzleiZugriff(c, { zweiFaktorEinrichtung: true });
  if (s instanceof Response) return s;
  const u = db.prepare("SELECT * FROM users WHERE id = ? AND tenant_id = ?").get(s.userId, s.tenantId) as UserRow | undefined;
  if (!u) return fehler(c, 401, "Sitzung ungültig – bitte melden Sie sich erneut an.");
  const body = (await c.req.json().catch(() => ({}))) as { passwort?: unknown };
  const pw = String(body.passwort ?? "").slice(0, PASSWORT_MAX);
  const grenze = anmeldeSperre(c, u.email);
  if (grenze.sperre) return grenze.sperre;
  if (!pruefePw(pw, u.pw_hash)) {
    grenze.fehlversuch();
    audit("entsperren.fehlgeschlagen", u.email, u.tenant_id, u.id);
    return fehler(c, 403, "Das Passwort stimmt nicht. Bitte prüfen Sie Groß- und Kleinschreibung – oder melden Sie sich ab und neu an.");
  }
  grenze.erfolg();
  return c.body(null, 204);
});

// Sperre wegen Inaktivität (die Sperre selbst setzt der Browser) – nur protokollieren, für die angemeldete Person
app.post("/api/auth/sperre", (c) => {
  const s = kanzleiZugriff(c, { zweiFaktorEinrichtung: true });
  if (s instanceof Response) return s;
  const u = db.prepare("SELECT json FROM users WHERE id = ? AND tenant_id = ?").get(s.userId, s.tenantId) as { json: string } | undefined;
  if (!u) return fehler(c, 401, "Sitzung ungültig – bitte melden Sie sich erneut an.");
  const a = anmeldeVorgang(VORGANG.sperreInaktivitaet(userJson(u).name), { akteur: "system", userId: s.userId });
  protokolliere(s.tenantId, a);
  return c.json(a);
});

app.get("/api/auth/me", (c) => {
  const s = sitzung(c);
  if (!s) return fehler(c, 401, "Nicht angemeldet");
  if (s.kind === "console") return c.json({ console: true, email: CONSOLE_EMAIL, name: "AnwaltApex Team" });
  const info = sessionInfo(s);
  return info ? c.json(info) : fehler(c, 401, "Sitzung ungültig");
});

app.post("/api/auth/logout", (c) => {
  const token = getCookie(c, "aa_sid");
  const s = sitzung(c);
  if (s && s.kind === "tenant") {
    const u = db.prepare("SELECT json FROM users WHERE id = ? AND tenant_id = ?").get(s.userId, s.tenantId) as { json: string } | undefined;
    if (u) protokolliere(s.tenantId, anmeldeVorgang(VORGANG.abmeldung(userJson(u).name), { akteur: "nutzer", userId: s.userId }));
  }
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  deleteCookie(c, "aa_sid", { path: "/" });
  return c.body(null, 204);
});

// ── Kanzleidaten (strikt auf die Kanzlei der Sitzung begrenzt) ──
const MAX_DOKUMENT_BYTES = 2_000_000;

/** Rolle der angemeldeten Person (für die Sperren der Auszubildenden). */
function rolleVon(s: TenantSess): Rolle | undefined {
  const r = db.prepare("SELECT json FROM users WHERE id = ? AND tenant_id = ?").get(s.userId, s.tenantId) as { json: string } | undefined;
  return r ? userJson(r).rolle : undefined;
}

app.get("/api/data", (c) => {
  const s = kanzleiZugriff(c);
  if (s instanceof Response) return s;
  const data = ladeDaten(s.tenantId);
  // Auszubildende: Abrechnung, Aktenkonten (Fremdgeld) und Bankumsätze werden gar nicht erst ausgeliefert
  if (rolleVon(s) === "azubi") for (const col of AZUBI_GESPERRT) (data[col] as unknown[]) = [];
  return c.json(data);
});

app.put("/api/data/:col/:id", async (c) => {
  const s = kanzleiZugriff(c);
  if (s instanceof Response) return s;
  const col = c.req.param("col") as CollectionKey;
  const id = c.req.param("id");
  if (!COLLECTIONS.includes(col)) return fehler(c, 400, "Unbekannte Sammlung");
  if (!darfSammlung(rolleVon(s), col)) return fehler(c, 403, AZUBI_KEIN_ZUGRIFF);
  const raw = await c.req.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_DOKUMENT_BYTES) return fehler(c, 413, "Dokument zu groß");
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    return fehler(c, 400, "Ungültige Daten");
  }
  if (!doc || typeof doc !== "object" || (doc as { id?: unknown }).id !== id) return fehler(c, 400, "ID stimmt nicht überein");
  const problem = pruefeDokument(col, doc);
  if (problem) return fehler(c, 400, `Die Änderung wurde nicht gespeichert: ${problem}`);
  db.prepare("INSERT OR REPLACE INTO docs (tenant_id, col, id, json, updated_at) VALUES (?, ?, ?, ?, ?)").run(s.tenantId, col, id, raw, Date.now());
  // Hintergrundläufe (simulierter 38h-Motor, automatische Posteingangs-Analyse, ?system=1) zählen nicht als Änderung durch die
  // Kanzlei – unveränderte Beispieldaten werden dann weiter täglich relativ zu „heute" neu erzeugt.
  if (c.req.query("system") !== "1") db.prepare("UPDATE tenant_state SET dirty = 1 WHERE tenant_id = ?").run(s.tenantId);
  return c.body(null, 204);
});

app.delete("/api/data/:col/:id", (c) => {
  const s = kanzleiZugriff(c);
  if (s instanceof Response) return s;
  const col = c.req.param("col") as CollectionKey;
  if (!COLLECTIONS.includes(col)) return fehler(c, 400, "Unbekannte Sammlung");
  if (!darfSammlung(rolleVon(s), col)) return fehler(c, 403, AZUBI_KEIN_ZUGRIFF);
  db.prepare("DELETE FROM docs WHERE tenant_id = ? AND col = ? AND id = ?").run(s.tenantId, col, c.req.param("id"));
  db.prepare("UPDATE tenant_state SET dirty = 1 WHERE tenant_id = ?").run(s.tenantId);
  audit("data.delete", `${col}/${c.req.param("id")}`, s.tenantId, s.userId);
  return c.body(null, 204);
});

app.post("/api/data/reset", (c) => {
  const s = kanzleiZugriff(c);
  if (s instanceof Response) return s;
  const me = sessionInfo(s);
  if (!me || !darfVerwalten(me.user)) return fehler(c, 403, "Nur Partner und Administration dürfen den Datenbestand zurücksetzen.");
  // Echter Datenbestand (Kanzlei ohne Beispieldaten) wird nie per Knopfdruck verworfen (S8).
  if (!me.betrieb?.praesentation && !me.betrieb?.beispieldaten) return fehler(c, 403, "Kanzleien mit eigenem Datenbestand lassen sich nicht auf Beispieldaten zurücksetzen.");
  audit("data.reset", "", s.tenantId, s.userId);
  protokolliere(s.tenantId, vorgang(VORGANG.beispieldatenZurueckgesetzt(me.user.name), { akteur: "nutzer", userId: s.userId }));
  const data = ladeDaten(s.tenantId, true);
  if (me.user.rolle === "azubi") for (const col of AZUBI_GESPERRT) (data[col] as unknown[]) = [];
  return c.json(data);
});

// ── Kanzleiprofil ──
app.put("/api/kanzlei/profil", async (c) => {
  const s = kanzleiZugriff(c);
  if (s instanceof Response) return s;
  const me = sessionInfo(s);
  if (!me || !darfVerwalten(me.user)) return fehler(c, 403, "Nur Partner und Administration dürfen das Kanzleiprofil ändern.");
  const b = (await c.req.json().catch(() => ({}))) as { name?: unknown; kurzname?: unknown; adresse?: unknown; stadt?: unknown; schwerpunkte?: unknown; bundesland?: unknown };
  const name = text(b.name, 160);
  const adresse = text(b.adresse, 200);
  if (!name || !adresse) return fehler(c, 400, "Bitte Name und Anschrift der Kanzlei angeben.");
  if (b.bundesland !== undefined && !BUNDESLAENDER.includes(b.bundesland as Bundesland)) return fehler(c, 400, "Bitte wählen Sie ein Bundesland aus der Liste.");
  const bundesland = b.bundesland !== undefined ? (b.bundesland as Bundesland) : me.tenant.bundesland;
  const schwerpunkte = Array.isArray(b.schwerpunkte) ? b.schwerpunkte.map((x) => text(x, 60)).filter(Boolean).slice(0, 12) : me.tenant.schwerpunkte;
  const tenant: Tenant = { ...me.tenant, name, kurzname: text(b.kurzname, 60) || name.slice(0, 60), adresse, stadt: text(b.stadt, 80), schwerpunkte, bundesland };
  db.prepare("UPDATE tenants SET json = ? WHERE id = ?").run(JSON.stringify(tenant), s.tenantId);
  audit("kanzlei.profil", tenant.name, s.tenantId, s.userId);
  if (bundesland !== me.tenant.bundesland) audit("kanzlei.bundesland", `${me.tenant.bundesland} → ${bundesland}`, s.tenantId, s.userId);
  return c.json(tenant);
});

app.put("/api/kanzlei/sicherheit", async (c) => {
  const s = kanzleiZugriff(c);
  if (s instanceof Response) return s;
  const me = sessionInfo(s);
  if (!me || !darfVerwalten(me.user)) return fehler(c, 403, "Nur Partner und Administration dürfen die Sicherheitseinstellungen ändern.");
  const b = (await c.req.json().catch(() => ({}))) as { zweiFaktorPflicht?: unknown; sperreMinuten?: unknown };
  const minuten = Number(b.sperreMinuten);
  if (!(SPERRE_MINUTEN as readonly number[]).includes(minuten)) return fehler(c, 400, "Bitte wählen Sie 5, 10, 15 oder 30 Minuten.");
  const pflicht = b.zweiFaktorPflicht === true;
  if (pflicht && me.betrieb?.praesentation) return fehler(c, 400, "In Präsentationskanzleien wird die Zwei-Faktor-Anmeldung nicht erzwungen – ihre Zugangsdaten sind öffentlich. Bitte nutzen Sie dafür Ihren Kundentest.");
  const tenant: Tenant = { ...me.tenant, sicherheit: { zweiFaktorPflicht: pflicht, sperreMinuten: minuten as SperreMinuten } };
  db.prepare("UPDATE tenants SET json = ? WHERE id = ?").run(JSON.stringify(tenant), s.tenantId);
  audit("kanzlei.sicherheit", `2FA-Pflicht ${pflicht ? "an" : "aus"}, Sperre ${minuten} Min.`, s.tenantId, s.userId);
  return c.json(tenant);
});

// ── Zwei-Faktor-Anmeldung (TOTP) der angemeldeten Person ──
const ZF_DEMO_GESPERRT = "In den öffentlichen Präsentationskanzleien ist die Zwei-Faktor-Anmeldung abgeschaltet – sonst könnte jemand den gemeinsamen Zugang sperren. Bitte richten Sie sie in Ihrem eigenen Kundentest ein.";

function zfNutzer(c: Context): { s: TenantSess; u: UserRow; demo: boolean } | Response {
  const s = kanzleiZugriff(c, { zweiFaktorEinrichtung: true });
  if (s instanceof Response) return s;
  const u = db.prepare("SELECT * FROM users WHERE id = ? AND tenant_id = ?").get(s.userId, s.tenantId) as UserRow | undefined;
  if (!u) return fehler(c, 401, "Sitzung ungültig – bitte melden Sie sich erneut an.");
  return { s, u, demo: !!tenantById(s.tenantId)?.demo };
}

app.get("/api/zweifaktor", (c) => {
  const r = zfNutzer(c);
  if (r instanceof Response) return r;
  const t = tenantById(r.s.tenantId);
  return c.json({
    aktiv: !!r.u.mfa_aktiv,
    pflicht: !!t && kanzleiSicherheit(t.tenant).zweiFaktorPflicht && !t.demo,
    eingerichtetAm: r.u.mfa_aktiv ? r.u.mfa_seit ?? undefined : undefined,
    wiederherstellungUebrig: r.u.mfa_aktiv ? (JSON.parse(r.u.mfa_codes ?? "[]") as string[]).length : undefined,
    gesperrt: r.demo ? ZF_DEMO_GESPERRT : undefined,
  });
});

app.post("/api/zweifaktor/einrichten", (c) => {
  const r = zfNutzer(c);
  if (r instanceof Response) return r;
  if (r.demo) return fehler(c, 403, ZF_DEMO_GESPERRT);
  if (r.u.mfa_aktiv) return fehler(c, 409, "Die Zwei-Faktor-Anmeldung ist bereits eingerichtet. Zum Wechsel des Telefons schalten Sie sie zuerst ab.");
  const schluessel = neuerSchluessel();
  db.prepare("UPDATE users SET mfa_secret = ?, mfa_aktiv = 0, mfa_codes = NULL, mfa_schritt = NULL WHERE id = ?").run(schluessel, r.u.id);
  return c.json({ schluessel, uri: otpauthUri(schluessel, r.u.email) });
});

app.post("/api/zweifaktor/bestaetigen", async (c) => {
  const r = zfNutzer(c);
  if (r instanceof Response) return r;
  if (r.demo) return fehler(c, 403, ZF_DEMO_GESPERRT);
  if (r.u.mfa_aktiv || !r.u.mfa_secret) return fehler(c, 409, "Es läuft keine Einrichtung. Bitte starten Sie die Einrichtung erneut.");
  const grenze = anmeldeSperre(c, r.u.email);
  if (grenze.sperre) return grenze.sperre;
  const body = (await c.req.json().catch(() => ({}))) as { code?: unknown };
  const schritt = await pruefeTotp(r.u.mfa_secret, text(body.code, 32));
  if (schritt === null) {
    grenze.fehlversuch();
    return fehler(c, 400, "Der Code stimmt nicht. Bitte prüfen Sie, ob der Schlüssel vollständig in der App steht, und geben Sie den aktuell angezeigten 6-stelligen Code ein.");
  }
  grenze.erfolg();
  const codes = neueWiederherstellungscodes();
  db.prepare("UPDATE users SET mfa_aktiv = 1, mfa_seit = ?, mfa_codes = ?, mfa_schritt = ? WHERE id = ?").run(zeitBerlin(), JSON.stringify(codes.map((x) => sha256hex(wiederherstellungNormal(x)))), schritt, r.u.id);
  audit("zweifaktor.eingerichtet", r.u.email, r.s.tenantId, r.u.id);
  protokolliere(r.s.tenantId, vorgang(VORGANG.zweiFaktorEingerichtet(userJson(r.u).name), { akteur: "nutzer", userId: r.u.id }));
  return c.json({ wiederherstellungscodes: codes });
});

app.post("/api/zweifaktor/deaktivieren", async (c) => {
  const r = zfNutzer(c);
  if (r instanceof Response) return r;
  const t = tenantById(r.s.tenantId);
  if (t && kanzleiSicherheit(t.tenant).zweiFaktorPflicht && !t.demo) return fehler(c, 403, "Ihre Kanzlei verlangt die Zwei-Faktor-Anmeldung für alle – abschalten ist nicht möglich. Bei einem neuen Telefon setzen Partner oder Administration sie unter Team zurück.");
  const grenze = anmeldeSperre(c, r.u.email);
  if (grenze.sperre) return grenze.sperre;
  const body = (await c.req.json().catch(() => ({}))) as { code?: unknown };
  if (!(await pruefeZweitenFaktor(r.u, text(body.code, 32)))) {
    grenze.fehlversuch();
    return fehler(c, 400, "Der Code stimmt nicht. Bitte geben Sie den aktuellen Code aus Ihrer Authenticator-App oder einen Wiederherstellungscode ein.");
  }
  grenze.erfolg();
  db.prepare("UPDATE users SET mfa_secret = NULL, mfa_aktiv = 0, mfa_codes = NULL, mfa_seit = NULL, mfa_schritt = NULL WHERE id = ?").run(r.u.id);
  audit("zweifaktor.deaktiviert", r.u.email, r.s.tenantId, r.u.id);
  protokolliere(r.s.tenantId, vorgang(VORGANG.zweiFaktorDeaktiviert(userJson(r.u).name), { akteur: "nutzer", userId: r.u.id }));
  return c.body(null, 204);
});

// ── Team ──
app.post("/api/team", async (c) => {
  const s = kanzleiZugriff(c);
  if (s instanceof Response) return s;
  const me = sessionInfo(s);
  if (!me || !darfVerwalten(me.user)) return fehler(c, 403, "Nur Partner und Administration können Zugänge anlegen.");
  const body = (await c.req.json().catch(() => ({}))) as { name?: unknown; email?: unknown; rolle?: unknown; titel?: unknown; anrede?: unknown };
  const name = text(body.name, 120);
  const email = text(body.email, 300).toLowerCase();
  const rolle = body.rolle as Rolle;
  const anrede: User["anrede"] = body.anrede === "Frau" || body.anrede === "Herr" ? body.anrede : undefined;
  if (!name || !email || !body.rolle) return fehler(c, 400, "Bitte Name, E-Mail-Adresse und Rolle angeben.");
  if (!istEmail(email)) return fehler(c, 400, "Bitte eine gültige E-Mail-Adresse angeben, z. B. anna.schulz@kanzlei.de.");
  if (!ROLLEN.includes(rolle)) return fehler(c, 400, "Unbekannte Rolle. Möglich sind Partner, Anwalt, Fachangestellte, Auszubildende und Administration.");
  if (email === CONSOLE_EMAIL || db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) return fehler(c, 409, "Diese E-Mail-Adresse ist bereits vergeben. Bitte prüfen Sie die Adresse oder vergeben Sie dem bestehenden Zugang ein neues Startpasswort.");
  const anzahl = usersOf(s.tenantId).length;
  const lizenz = me.tenant.lizenz.arbeitsplaetze;
  if (anzahl >= lizenz) return fehler(c, 403, `Alle ${lizenz} Arbeitsplätze der Lizenz sind belegt. Weitere Arbeitsplätze erhalten Sie über ${me.tenant.ansprechpartner.name}.`);
  // Kollisionsfreie Kennung (früher zufällig ohne Prüfung → Absturz bei doppelter ID)
  const eingabe = { name, email, rolle, titel: text(body.titel, 120), anrede };
  let user = baueNutzer(s.tenantId, eingabe, anzahl + 1 + zufallsZahl(900));
  for (let i = 0; i < 50 && db.prepare("SELECT 1 FROM users WHERE id = ?").get(user.id); i++) user = baueNutzer(s.tenantId, eingabe, anzahl + 1 + zufallsZahl(90_000));
  const passwort = sicheresPasswort();
  speichereUser(user, passwort, true);
  audit("team.add", `${user.email} (${rolle})`, s.tenantId, s.userId);
  return c.json({ user, passwort });
});

/** Zielzugang in der eigenen Kanzlei; Partner-Zugänge verwalten nur Partner (S8). */
function teamZiel(c: Context, s: TenantSess, me: KanzleiSitzung, id: string): User | Response {
  const row = db.prepare("SELECT json FROM users WHERE id = ? AND tenant_id = ?").get(id, s.tenantId) as { json: string } | undefined;
  if (!row) return fehler(c, 404, "Dieser Zugang gehört nicht zu Ihrer Kanzlei.");
  const ziel = JSON.parse(row.json) as User;
  if (ziel.rolle === "partner" && me.user.rolle !== "partner") return fehler(c, 403, "Partner-Zugänge können nur Partner verwalten.");
  return ziel;
}

app.delete("/api/team/:id", (c) => {
  const s = kanzleiZugriff(c);
  if (s instanceof Response) return s;
  const me = sessionInfo(s);
  if (!me || !darfVerwalten(me.user)) return fehler(c, 403, "Nur Partner und Administration können Zugänge entfernen.");
  const id = c.req.param("id");
  if (id === s.userId) return fehler(c, 400, "Sie können sich nicht selbst entfernen.");
  const ziel = teamZiel(c, s, me, id);
  if (ziel instanceof Response) return ziel;
  if (ziel.rolle === "partner" && me.team.filter((u) => u.rolle === "partner" && !u.deaktiviert).length <= 1) return fehler(c, 400, "Mindestens ein aktiver Partner-Zugang muss bestehen bleiben.");
  // Sitzungen sofort beenden – die Person verliert den Zugriff nicht erst nach Ablauf (S1)
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND tenant_id = ?").run(id, s.tenantId);
  db.prepare("DELETE FROM users WHERE id = ? AND tenant_id = ?").run(id, s.tenantId);
  audit("team.remove", `${ziel.email} (${ziel.rolle})`, s.tenantId, s.userId);
  return c.body(null, 204);
});

app.post("/api/team/:id/passwort", (c) => {
  const s = kanzleiZugriff(c);
  if (s instanceof Response) return s;
  const me = sessionInfo(s);
  if (!me || !darfVerwalten(me.user)) return fehler(c, 403, "Nur Partner und Administration können Passwörter neu vergeben.");
  const id = c.req.param("id");
  if (id === s.userId) return fehler(c, 400, "Ihr eigenes Passwort können Sie hier nicht neu vergeben.");
  const ziel = teamZiel(c, s, me, id);
  if (ziel instanceof Response) return ziel;
  const pw = sicheresPasswort();
  db.prepare("UPDATE users SET pw_hash = ?, pw_wechsel = 1 WHERE id = ? AND tenant_id = ?").run(hashPw(pw), id, s.tenantId);
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND tenant_id = ?").run(id, s.tenantId);
  audit("team.passwort", ziel.email, s.tenantId, s.userId);
  return c.json({ passwort: pw });
});

// Abwesenheit & Vertretung (§ 53 BRAO), Deaktivieren/Reaktivieren, Zwei-Faktor zurücksetzen – gleiche Regeln wie im Demo-Backend
app.patch("/api/team/:id", async (c) => {
  const s = kanzleiZugriff(c);
  if (s instanceof Response) return s;
  const me = sessionInfo(s);
  if (!me) return fehler(c, 401, "Sitzung ungültig – bitte melden Sie sich erneut an.");
  const id = c.req.param("id");
  const row = db.prepare("SELECT json FROM users WHERE id = ? AND tenant_id = ?").get(id, s.tenantId) as { json: string } | undefined;
  if (!row) return fehler(c, 404, "Dieser Zugang gehört nicht zu Ihrer Kanzlei.");
  const ziel = userJson(row);
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const a: TeamAenderung = {};
  if (b.abwesenheit === null) a.abwesenheit = null;
  else if (b.abwesenheit && typeof b.abwesenheit === "object") {
    const x = b.abwesenheit as Record<string, unknown>;
    a.abwesenheit = {
      von: text(x.von, 10),
      bis: text(x.bis, 10),
      ...(text(x.vertretungId, 80) ? { vertretungId: text(x.vertretungId, 80) } : {}),
      ...(text(x.sachbearbeitungId, 80) ? { sachbearbeitungId: text(x.sachbearbeitungId, 80) } : {}),
      ...(text(x.grund, 200) ? { grund: text(x.grund, 200) } : {}),
    };
  }
  if (typeof b.deaktiviert === "boolean") a.deaktiviert = b.deaktiviert;
  if (b.zweiFaktorZuruecksetzen === true) a.zweiFaktorZuruecksetzen = true;
  try {
    pruefeTeamAenderung({ users: me.team }, me.user, ziel, a);
  } catch (e) {
    return fehler(c, 400, e instanceof Error ? e.message : "Die Änderung ist nicht zulässig.");
  }
  const neu: User = { ...ziel };
  if (a.abwesenheit !== undefined) {
    if (a.abwesenheit) neu.abwesenheit = a.abwesenheit;
    else delete neu.abwesenheit;
  }
  if (a.deaktiviert !== undefined) {
    if (a.deaktiviert) neu.deaktiviert = true;
    else delete neu.deaktiviert;
  }
  db.prepare("UPDATE users SET json = ? WHERE id = ? AND tenant_id = ?").run(JSON.stringify(neu), id, s.tenantId);
  if (a.deaktiviert) db.prepare("DELETE FROM sessions WHERE user_id = ? AND tenant_id = ?").run(id, s.tenantId);
  if (a.zweiFaktorZuruecksetzen) {
    db.prepare("UPDATE users SET mfa_secret = NULL, mfa_aktiv = 0, mfa_codes = NULL, mfa_seit = NULL, mfa_schritt = NULL WHERE id = ?").run(id);
    protokolliere(s.tenantId, vorgang(VORGANG.zweiFaktorZurueckgesetzt(ziel.name, me.user.name), { akteur: "nutzer", userId: s.userId }));
  }
  audit("team.aendern", `${ziel.email}: ${Object.keys(a).join(", ")}`, s.tenantId, s.userId);
  return c.json(neu);
});

// ── Apex Console (Anbieter) ──
function consoleOk(c: Context) {
  return sitzung(c)?.kind === "console";
}
const STATUS_WERTE: readonly NonNullable<Tenant["status"]>[] = ["aktiv", "test", "pausiert"];

app.get("/api/console/kunden", (c) => {
  if (!consoleOk(c)) return fehler(c, 403, "Nur für das AnwaltApex-Team");
  const tenants = db.prepare("SELECT * FROM tenants ORDER BY created_at").all() as TenantRow[];
  return c.json(
    tenants.map((r) => {
      const stats = (col: string) => (db.prepare("SELECT COUNT(*) AS n FROM docs WHERE tenant_id = ? AND col = ?").get(r.id, col) as { n: number }).n;
      const offen = (db.prepare("SELECT COUNT(*) AS n FROM docs WHERE tenant_id = ? AND col = 'fristen' AND json LIKE '%\"status\":\"offen\"%'").get(r.id) as { n: number }).n;
      // „Letzte Aktivität“: letzte echte Anmeldung oder letzter echter Vorgang – nie Beispieleinträge (wie im Demo-Backend)
      const login = db.prepare("SELECT MAX(last_login) AS t FROM users WHERE tenant_id = ?").get(r.id) as { t: string | null };
      const vg = db.prepare("SELECT MAX(zeit) AS t FROM vorgaenge WHERE tenant_id = ?").get(r.id) as { t: string | null };
      const letzte = letzteEchteAktivitaet([login.t ? zeitBerlin(new Date(login.t)) : null, vg.t]);
      return { tenant: JSON.parse(r.json), users: usersOf(r.id), stats: { akten: stats("akten"), offeneFristen: offen, nachrichten: stats("nachrichten"), letzteAktivitaet: letzte } };
    }),
  );
});

app.post("/api/console/kunden", async (c) => {
  if (!consoleOk(c)) return fehler(c, 403, "Nur für das AnwaltApex-Team");
  const b = (await c.req.json().catch(() => ({}))) as { kanzlei?: unknown; stadt?: unknown; bundesland?: unknown; adminName?: unknown; adminEmail?: unknown; arbeitsplaetze?: unknown; schwerpunkte?: unknown; beispieldaten?: unknown; testBis?: unknown; adminAnrede?: unknown };
  const kanzlei = text(b.kanzlei, 160);
  const adminName = text(b.adminName, 120);
  const adminEmail = text(b.adminEmail, 300).toLowerCase();
  const stadt = text(b.stadt, 80);
  if (!kanzlei || !adminName || !adminEmail || !b.bundesland) return fehler(c, 400, "Bitte Kanzlei, Bundesland sowie Name und E-Mail-Adresse der Hauptnutzerin bzw. des Hauptnutzers angeben.");
  if (!BUNDESLAENDER.includes(b.bundesland as Bundesland)) return fehler(c, 400, "Bitte ein gültiges Bundesland wählen.");
  if (!istEmail(adminEmail)) return fehler(c, 400, "Bitte geben Sie eine gültige E-Mail-Adresse an, z. B. c.reinholz@kanzlei.de.");
  if (adminEmail === CONSOLE_EMAIL) return fehler(c, 400, "Die Adresse der Apex Console kann keiner Kanzlei zugeordnet werden – bitte eine andere Adresse wählen.");
  const adminAnrede: User["anrede"] = b.adminAnrede === "Frau" || b.adminAnrede === "Herr" ? b.adminAnrede : undefined;
  const plaetze = b.arbeitsplaetze === undefined || b.arbeitsplaetze === null || b.arbeitsplaetze === "" ? 5 : Number(b.arbeitsplaetze);
  if (!Number.isInteger(plaetze) || plaetze < 1 || plaetze > 500) return fehler(c, 400, "Arbeitsplätze: bitte eine ganze Zahl von 1 bis 500.");
  let testBis: string | undefined;
  if (b.testBis !== undefined && b.testBis !== null && b.testBis !== "") {
    if (!istIsoDatum(b.testBis)) return fehler(c, 400, "Bitte ein gültiges Datum für das Ende des Testzeitraums angeben.");
    if (b.testBis < today()) return fehler(c, 400, "Das Ende des Testzeitraums liegt in der Vergangenheit.");
    testBis = b.testBis;
  }
  const schwerpunkte = Array.isArray(b.schwerpunkte) ? [...new Set(b.schwerpunkte.filter((x): x is Sachgebiet => SACHGEBIETE_ALLE.includes(x as Sachgebiet)))] : [];
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(adminEmail)) return fehler(c, 409, "Diese E-Mail-Adresse ist bereits vergeben.");
  const bundesland = b.bundesland as Bundesland;
  let suffix = randomBytes(4).toString("hex");
  while (tenantById(`t-${suffix}`)) suffix = randomBytes(4).toString("hex");
  const { tenant, admin } = baueKunde({ kanzlei, stadt, bundesland, adminName, adminEmail, arbeitsplaetze: plaetze, schwerpunkte, testBis, adminAnrede }, suffix);
  const passwort = sicheresPasswort();
  speichereTenant(tenant, profilFuer(schwerpunkte, bundesland), false, b.beispieldaten !== true);
  // Startpasswort: Bei der ersten Anmeldung legt die Kanzlei ein eigenes Passwort fest (wie bei Team-Einladungen).
  speichereUser(admin, passwort, true);
  audit("console.kunde.neu", `${tenant.name} / ${admin.email}`, tenant.id);
  protokolliere(tenant.id, vorgang(VORGANG.zugangAngelegt(admin.name, rollenLabel(admin)), { akteur: "system", userId: admin.id }));
  protokolliere(tenant.id, vorgang(VORGANG.startpasswortVergeben(admin.name), { akteur: "system", userId: admin.id }));
  return c.json({ tenant, admin, passwort });
});

app.delete("/api/console/kunden/:id", (c) => {
  if (!consoleOk(c)) return fehler(c, 403, "Nur für das AnwaltApex-Team");
  const id = c.req.param("id");
  const t = tenantById(id);
  if (!t) return fehler(c, 404, "Kanzlei nicht gefunden");
  if (t.demo) return fehler(c, 400, "Präsentationskanzleien lassen sich zurücksetzen, aber nicht löschen.");
  db.prepare("DELETE FROM sessions WHERE tenant_id = ?").run(id);
  db.prepare("DELETE FROM tenants WHERE id = ?").run(id);
  audit("console.kunde.geloescht", t.tenant.name, id);
  return c.body(null, 204);
});

app.post("/api/console/kunden/:id/reset", (c) => {
  if (!consoleOk(c)) return fehler(c, 403, "Nur für das AnwaltApex-Team");
  const id = c.req.param("id");
  const t = tenantById(id);
  if (!t) return fehler(c, 404, "Kanzlei nicht gefunden");
  ladeDaten(id, true);
  audit("console.kunde.reset", t.tenant.name, id);
  protokolliere(id, vorgang(VORGANG.beispieldatenZurueckgesetzt(), { akteur: "system" }));
  return c.body(null, 204);
});

app.post("/api/console/kunden/:id/status", async (c) => {
  if (!consoleOk(c)) return fehler(c, 403, "Nur für das AnwaltApex-Team");
  const { status } = (await c.req.json().catch(() => ({}))) as { status?: unknown };
  const t = tenantById(c.req.param("id"));
  if (!t) return fehler(c, 404, "Kanzlei nicht gefunden");
  if (!STATUS_WERTE.includes(status as NonNullable<Tenant["status"]>)) return fehler(c, 400, "Unbekannter Status. Möglich sind aktiv, test und pausiert.");
  const neu: Tenant = { ...t.tenant, status: status as Tenant["status"] };
  // Testzugang → Kunde: Die Lifetime-Lizenz gilt ab heute, der Testzeitraum entfällt.
  if (t.tenant.status === "test" && status === "aktiv") {
    neu.lizenz = { ...t.tenant.lizenz, seit: today() };
    delete neu.testBis;
  }
  db.prepare("UPDATE tenants SET json = ? WHERE id = ?").run(JSON.stringify(neu), t.id);
  if (status === "pausiert") db.prepare("DELETE FROM sessions WHERE tenant_id = ?").run(t.id);
  audit("console.kunde.status", `${t.tenant.status ?? "aktiv"} → ${String(status)}`, t.id);
  return c.body(null, 204);
});

app.post("/api/console/nutzer/:id/standardpasswort", (c) => {
  if (!consoleOk(c)) return fehler(c, 403, "Nur für das AnwaltApex-Team");
  const id = c.req.param("id");
  const demoNutzer = DEMO_TENANTS.some((t) => t.users.some((u) => u.id === id));
  if (!demoNutzer) return fehler(c, 400, "Nur Zugänge der eingebauten Präsentationskanzleien haben ein Standardpasswort.");
  const r = db.prepare("UPDATE users SET pw_hash = ?, pw_wechsel = 0, mfa_secret = NULL, mfa_aktiv = 0, mfa_codes = NULL, mfa_seit = NULL, mfa_schritt = NULL WHERE id = ?").run(hashPw(DEMO_PASSWORT), id);
  if (!r.changes) return fehler(c, 404, "Nutzer nicht gefunden – bitte laden Sie die Kundenliste neu.");
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  audit("console.standardpasswort", id);
  const u = db.prepare("SELECT tenant_id, json FROM users WHERE id = ?").get(id) as { tenant_id: string; json: string } | undefined;
  if (u) protokolliere(u.tenant_id, vorgang(VORGANG.standardPasswort(userJson(u).name), { akteur: "system", userId: id }));
  return c.body(null, 204);
});

app.post("/api/console/nutzer/:id/passwort", (c) => {
  if (!consoleOk(c)) return fehler(c, 403, "Nur für das AnwaltApex-Team");
  const id = c.req.param("id");
  const pw = sicheresPasswort();
  const r = db.prepare("UPDATE users SET pw_hash = ?, pw_wechsel = 1 WHERE id = ?").run(hashPw(pw), id);
  if (!r.changes) return fehler(c, 404, "Nutzer nicht gefunden – bitte laden Sie die Kundenliste neu.");
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  const u = db.prepare("SELECT tenant_id, email, json FROM users WHERE id = ?").get(id) as { tenant_id: string; email: string; json: string } | undefined;
  audit("console.passwort", u?.email ?? id, u?.tenant_id);
  // Anbieter-Eingriff: Die Kanzlei sieht ihn in ihrem Protokoll (Einstellungen → Datenschutz).
  if (u) protokolliere(u.tenant_id, vorgang(VORGANG.consolePasswort(userJson(u).name), { akteur: "system", userId: id }));
  return c.json({ passwort: pw });
});

// ── KI-Proxy (Claude über die Anthropic API) ──
type KiAnfrage = {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  tools: { name: string; description: string; input_schema: Anthropic.Beta.BetaTool["input_schema"] }[];
  effort: "low" | "medium" | "high";
  maxTokens: number;
};

const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const KI_MAX_NACHRICHTEN = 120;
const KI_MAX_SYSTEM = 200_000;
const KI_MAX_TEXT = 400_000;

/** Prüft einen Inhaltsblock; Rückgabe: bereinigter Block (nur bekannte Felder) oder Fehlertext. */
function kiBlock(b: unknown, rolle: "user" | "assistant"): Anthropic.Beta.BetaContentBlockParam | string {
  if (!istObjekt(b) || typeof b.type !== "string") return "Ungültiger Inhaltsblock.";
  const kurz = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
  if (b.type === "text") return kurz(b.text, KI_MAX_TEXT) ? { type: "text", text: b.text as string } : "Ungültiger Textblock.";
  if (rolle === "user" && b.type === "tool_result") {
    if (!kurz(b.tool_use_id, 200)) return "Ungültiges Werkzeug-Ergebnis.";
    let content: string | { type: "text"; text: string }[];
    if (typeof b.content === "string") content = b.content.slice(0, KI_MAX_TEXT);
    else if (Array.isArray(b.content) && b.content.every((x) => istObjekt(x) && x.type === "text" && kurz(x.text, KI_MAX_TEXT))) content = (b.content as { text: string }[]).map((x) => ({ type: "text" as const, text: x.text }));
    else return "Ungültiges Werkzeug-Ergebnis.";
    return { type: "tool_result", tool_use_id: b.tool_use_id as string, content, ...(b.is_error === true ? { is_error: true } : {}) };
  }
  if (rolle === "assistant") {
    if (b.type === "tool_use") return kurz(b.id, 200) && kurz(b.name, 64) && istObjekt(b.input) ? { type: "tool_use", id: b.id as string, name: b.name as string, input: b.input } : "Ungültiger Werkzeugaufruf.";
    // Denk- und Fallback-Blöcke der vorigen Antwort unverändert zurückgeben (vom Modell signiert bzw. vom Server erzeugt)
    if (b.type === "thinking") return kurz(b.thinking, KI_MAX_TEXT) && kurz(b.signature, 100_000) ? { type: "thinking", thinking: b.thinking as string, signature: b.signature as string } : "Ungültiger Denkblock.";
    if (b.type === "redacted_thinking") return kurz(b.data, 200_000) ? { type: "redacted_thinking", data: b.data as string } : "Ungültiger Denkblock.";
    if (b.type === "fallback") return JSON.stringify(b).length <= 4000 ? (b as unknown as Anthropic.Beta.BetaContentBlockParam) : "Ungültiger Block.";
  }
  return `Inhaltsart „${b.type.slice(0, 40)}“ wird nicht unterstützt.`;
}

/** Validiert die Anfrage der App (S4): nur Text, Werkzeugaufrufe und -ergebnisse; Antwortlänge serverseitig begrenzt. */
function pruefeKiAnfrage(b: unknown): KiAnfrage | string {
  if (!istObjekt(b)) return "Ungültige KI-Anfrage.";
  if (b.system !== undefined && (typeof b.system !== "string" || b.system.length > KI_MAX_SYSTEM)) return "Ungültige Systemanweisung.";
  if (!Array.isArray(b.messages) || !b.messages.length) return "Keine Nachrichten übergeben.";
  if (b.messages.length > KI_MAX_NACHRICHTEN) return "Das Gespräch ist zu lang. Bitte beginnen Sie ein neues.";
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of b.messages) {
    if (!istObjekt(m) || (m.role !== "user" && m.role !== "assistant")) return "Ungültige Nachricht.";
    const rolle = m.role;
    if (typeof m.content === "string") {
      if (m.content.length > KI_MAX_TEXT) return "Eine Nachricht ist zu lang.";
      messages.push({ role: rolle, content: m.content });
      continue;
    }
    if (!Array.isArray(m.content) || !m.content.length || m.content.length > 100) return "Ungültiger Nachrichteninhalt.";
    const bloecke: Anthropic.Beta.BetaContentBlockParam[] = [];
    for (const x of m.content) {
      const r = kiBlock(x, rolle);
      if (typeof r === "string") return r;
      bloecke.push(r);
    }
    messages.push({ role: rolle, content: bloecke });
  }
  if (messages[0].role !== "user") return "Das Gespräch muss mit einer Nutzernachricht beginnen.";
  let tools: KiAnfrage["tools"] = [];
  if (b.tools !== undefined) {
    if (!Array.isArray(b.tools) || b.tools.length > 32) return "Ungültige Werkzeugliste.";
    for (const t of b.tools) {
      if (!istObjekt(t) || typeof t.name !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(t.name)) return "Ungültiger Werkzeugname.";
      if (typeof t.description !== "string" || t.description.length > 4000) return "Ungültige Werkzeugbeschreibung.";
      if (!istObjekt(t.input_schema) || t.input_schema.type !== "object" || JSON.stringify(t.input_schema).length > 16_000) return "Ungültiges Werkzeugschema.";
      tools.push({ name: t.name, description: t.description, input_schema: t.input_schema as Anthropic.Beta.BetaTool["input_schema"] });
    }
  }
  tools = tools.slice(0, 32);
  if (b.effort !== undefined && b.effort !== "low" && b.effort !== "medium" && b.effort !== "high") return "Ungültige KI-Einstellung (effort).";
  if (b.maxTokens !== undefined && (typeof b.maxTokens !== "number" || !Number.isInteger(b.maxTokens) || b.maxTokens < 1)) return "Ungültige Antwortlänge (maxTokens).";
  const maxTokens = Math.min(Math.max((b.maxTokens as number | undefined) ?? AI_MAX_TOKENS, 1024), AI_MAX_TOKENS);
  return { system: (b.system as string | undefined) ?? "", messages, tools, effort: (b.effort as KiAnfrage["effort"] | undefined) ?? "medium", maxTokens };
}

/** Tageskontingent: `null`, wenn die Anfrage laufen darf – sonst der Hinweis für die Oberfläche. */
function kiKontingent(tenantId: string): string | null {
  const tag = today();
  const k = db.prepare("SELECT anfragen, tokens FROM ki_nutzung WHERE tag = ? AND tenant_id = ?").get(tag, tenantId) as { anfragen: number; tokens: number } | undefined;
  const gesamt = (db.prepare("SELECT COALESCE(SUM(tokens), 0) AS t FROM ki_nutzung WHERE tag = ?").get(tag) as { t: number }).t;
  if ((AI_TAG_ANFRAGEN_KANZLEI && (k?.anfragen ?? 0) >= AI_TAG_ANFRAGEN_KANZLEI) || (AI_TAG_TOKENS_KANZLEI && (k?.tokens ?? 0) >= AI_TAG_TOKENS_KANZLEI)) {
    return "Das heutige Live-KI-Kontingent Ihrer Kanzlei ist ausgeschöpft. Ab morgen steht Claude wieder zur Verfügung – bis dahin arbeitet die Demo-KI.";
  }
  if (AI_TAG_TOKENS_GESAMT && gesamt >= AI_TAG_TOKENS_GESAMT) return "Das heutige Live-KI-Kontingent dieses Servers ist ausgeschöpft. Bis morgen arbeitet die Demo-KI.";
  return null;
}
function kiVerbrauch(tenantId: string, anfragen: number, tokens: number) {
  db.prepare("INSERT INTO ki_nutzung (tag, tenant_id, anfragen, tokens) VALUES (?, ?, ?, ?) ON CONFLICT(tag, tenant_id) DO UPDATE SET anfragen = anfragen + excluded.anfragen, tokens = tokens + excluded.tokens").run(today(), tenantId, anfragen, tokens);
}

app.post("/api/ai/messages", async (c) => {
  const s = kanzleiZugriff(c);
  if (s instanceof Response) return s;
  if (!anthropic) return fehler(c, 503, "Auf diesem Server ist keine Live-KI konfiguriert.");
  const t = tenantById(s.tenantId);
  if (!t) return fehler(c, 401, "Sitzung ungültig");
  if (t.demo && !AI_DEMO_TENANTS) return fehler(c, 503, "Die Live-KI ist für die Beispielkanzleien auf diesem Server abgeschaltet – es arbeitet die Demo-KI.");
  const aiKey = `ai:${s.tenantId}`;
  if (gesperrt(aiKey, 120, 10 * 60_000)) return fehler(c, 429, "Zu viele KI-Anfragen. Bitte kurz warten.");
  const kontingent = kiKontingent(s.tenantId);
  if (kontingent) return fehler(c, 429, kontingent);
  const roh = await c.req.json().catch(() => null);
  const req = pruefeKiAnfrage(roh);
  if (typeof req === "string") return fehler(c, 400, req);
  zaehle(aiKey, 10 * 60_000);
  kiVerbrauch(s.tenantId, 1, 0);
  audit("ai.request", `${req.messages.length} Nachrichten, ${req.tools.length} Werkzeuge, max. ${req.maxTokens} Tokens`, s.tenantId, s.userId);

  const ki = anthropic;
  return streamSSE(c, async (stream) => {
    try {
      const st = ki.beta.messages.stream({
        model: AI_MODEL,
        max_tokens: req.maxTokens,
        system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
        messages: req.messages,
        ...(req.tools.length ? { tools: req.tools } : {}),
        output_config: { effort: req.effort },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
      // Bricht der Browser ab (Tab geschlossen, Abbrechen), wird auch die Anfrage an Claude beendet – keine Kosten ins Leere.
      stream.onAbort(() => st.abort());
      st.on("text", (delta) => {
        void stream.writeSSE({ data: JSON.stringify({ type: "text", text: delta }) });
      });
      const msg = await st.finalMessage();
      const u = msg.usage;
      kiVerbrauch(s.tenantId, 0, (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.output_tokens ?? 0));
      if (msg.stop_reason === "refusal") {
        await stream.writeSSE({ data: JSON.stringify({ type: "error", fehler: "Die KI hat diese Anfrage abgelehnt. Bitte formulieren Sie sie anders." }) });
        return;
      }
      await stream.writeSSE({ data: JSON.stringify({ type: "final", message: { content: msg.content, stop_reason: msg.stop_reason, model: msg.model } }) });
    } catch (e) {
      if (stream.aborted) return;
      const text = e instanceof Anthropic.APIConnectionError ? "Die KI ist nicht erreichbar." : e instanceof Anthropic.RateLimitError ? "Die KI ist gerade ausgelastet – bitte gleich noch einmal versuchen." : e instanceof Anthropic.AuthenticationError ? "Der KI-Zugang des Servers ist ungültig (API-Schlüssel prüfen)." : e instanceof Anthropic.APIError ? `KI-Fehler (${e.status ?? "?"})` : "Die KI ist nicht erreichbar.";
      console.error("KI-Fehler", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
      await stream.writeSSE({ data: JSON.stringify({ type: "error", fehler: text }) });
    }
  });
});

app.all("/api/*", (c) => fehler(c, 404, "Unbekannter Endpunkt"));

// ── Web-App ausliefern (SPA) ──
const indexPath = resolve(STATIC_DIR, "index.html");
app.use("/*", serveStatic({ root: STATIC_DIR }));
app.get("*", (c) => {
  if (!existsSync(indexPath)) return c.text("Web-App nicht gebaut. Bitte `npm run build` ausführen.", 404);
  c.header("Cache-Control", "no-cache");
  return c.html(readFileSync(indexPath, "utf8"));
});

// abgelaufene Sitzungen aufräumen
setInterval(() => db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now()), 3600_000).unref();

serve({ fetch: app.fetch, port: PORT }, (i) => {
  console.log(`AnwaltApex läuft auf http://localhost:${i.port}  ·  KI: ${anthropic ? `Claude (${AI_MODEL})${AI_DEMO_TENANTS ? "" : " – nicht für Präsentationskanzleien"}` : "Demo-Modus (kein ANTHROPIC_API_KEY)"}  ·  Console: ${CONSOLE_AKTIV ? "aktiv" : "deaktiviert"}`);
});
