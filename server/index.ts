// AnwaltApex Server: Mehrmandanten-Betrieb mit Anmeldung, strikt getrennten Kanzleidaten, Apex Console und Claude-Proxy.
import { Hono, type Context } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { streamSSE } from "hono/streaming";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { COLLECTIONS, type CollectionKey, type SessionInfo, type Tenant, type TenantData, type User, type Sachgebiet } from "../src/core/types";
import { DEMO_TENANTS, DEMO_PASSWORT, publicUser } from "../src/core/seed/tenants";
import { generateTenantData, SEED_VERSION, type SeedInput } from "../src/core/seed/generate";
import { baueKunde, baueNutzer, profilFuer, zufallsPasswort } from "../src/core/seed/kunde";
import { fmtDate, today } from "../src/core/dates";
import { VERWALTUNGS_ROLLEN, pruefeNeuesPasswort } from "../src/lib/backend/types";

// ───────────── Konfiguration ─────────────
const PORT = Number(process.env.PORT ?? 8787);
const DB_PATH = process.env.DATABASE_PATH ?? "./data/anwaltapex.db";
const CONSOLE_EMAIL = (process.env.CONSOLE_ADMIN_EMAIL ?? "admin@anwaltapex.de").toLowerCase();
const CONSOLE_PASSWORD = process.env.CONSOLE_ADMIN_PASSWORD ?? "";
const QUICK_LOGIN = (process.env.DEMO_QUICK_LOGIN ?? "true") === "true";
const SEED_DEMO = (process.env.SEED_DEMO ?? "true") === "true";
const AI_MODEL = process.env.AI_MODEL ?? "claude-opus-5-5";
const COOKIE_SECURE = (process.env.COOKIE_SECURE ?? "false") === "true";
const STATIC_DIR = process.env.STATIC_DIR ?? "./dist";
const SESSION_HOURS = 12;
const VERSION = "0.9.0";

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

if (!CONSOLE_PASSWORD) console.warn("⚠ CONSOLE_ADMIN_PASSWORD ist nicht gesetzt – die Apex Console ist deaktiviert.");

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
`);
// Spalte für Startpasswörter (Einladung/Neuvergabe): eigenes Passwort bei der nächsten Anmeldung festlegen
if (!(db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).some((c) => c.name === "pw_wechsel")) {
  db.exec("ALTER TABLE users ADD COLUMN pw_wechsel INTEGER NOT NULL DEFAULT 0");
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

function audit(aktion: string, detail: string, tenantId?: string | null, userId?: string | null) {
  db.prepare("INSERT INTO audit (zeit, tenant_id, user_id, aktion, detail) VALUES (?, ?, ?, ?, ?)").run(new Date().toISOString(), tenantId ?? null, userId ?? null, aktion, detail.slice(0, 500));
}

type TenantRow = { id: string; json: string; profil: string; demo: number; leer: number };
type UserRow = { id: string; tenant_id: string; email: string; pw_hash: string; json: string; last_login: string | null; pw_wechsel: number };

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

// Demo-Kanzleien beim ersten Start anlegen
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
    }
  }
}

/** Datenbestand einer Kanzlei laden; unveränderte Demodaten werden täglich relativ zu „heute" neu erzeugt. */
function ladeDaten(tenantId: string, force = false): TenantData {
  const t = tenantById(tenantId);
  if (!t) throw new Error("Kanzlei nicht gefunden");
  const st = db.prepare("SELECT * FROM tenant_state WHERE tenant_id = ?").get(tenantId) as { seeded_for: string | null; seed_version: number | null; dirty: number } | undefined;
  const heute = today();
  const brauchtSeed = force || !st || st.seed_version !== SEED_VERSION || (!st.dirty && st.seeded_for !== heute);
  if (brauchtSeed) {
    const data = generateTenantData({ tenant: t.tenant, users: usersOf(tenantId), profil: JSON.parse(t.profil) }, heute, { leer: !!t.leer });
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
    return data;
  }
  const rows = db.prepare("SELECT col, json FROM docs WHERE tenant_id = ?").all(tenantId) as { col: CollectionKey; json: string }[];
  const data = Object.fromEntries(COLLECTIONS.map((c) => [c, [] as unknown[]])) as unknown as TenantData;
  data.meta = [{ seedVersion: SEED_VERSION, seededAt: `${st!.seeded_for}T06:00:00` }];
  for (const r of rows) (data[r.col] as unknown[]).push(JSON.parse(r.json));
  data.akten.sort((a, b) => b.aktenzeichen.localeCompare(a.aktenzeichen, "de", { numeric: true }));
  data.nachrichten.sort((a, b) => b.eingang.localeCompare(a.eingang));
  data.aktivitaeten.sort((a, b) => b.zeit.localeCompare(a.zeit));
  data.fristen.sort((a, b) => a.datum.localeCompare(b.datum));
  return data;
}

// ───────────── Sitzungen ─────────────
type Sess = { kind: "tenant"; userId: string; tenantId: string } | { kind: "console" };

function neueSitzung(c: Context, s: Sess) {
  const token = randomBytes(32).toString("hex");
  const expires = Date.now() + SESSION_HOURS * 3600_000;
  db.prepare("INSERT INTO sessions (token, kind, user_id, tenant_id, expires) VALUES (?, ?, ?, ?, ?)").run(token, s.kind, s.kind === "tenant" ? s.userId : null, s.kind === "tenant" ? s.tenantId : null, expires);
  setCookie(c, "aa_sid", token, { httpOnly: true, sameSite: "Lax", secure: COOKIE_SECURE, path: "/", maxAge: SESSION_HOURS * 3600 });
}

function sitzung(c: Context): Sess | null {
  const token = getCookie(c, "aa_sid");
  if (!token) return null;
  const r = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token) as { kind: string; user_id: string; tenant_id: string; expires: number } | undefined;
  if (!r || r.expires < Date.now()) return null;
  if (r.kind === "console") return { kind: "console" };
  return { kind: "tenant", userId: r.user_id, tenantId: r.tenant_id };
}

function sessionInfo(s: Extract<Sess, { kind: "tenant" }>): SessionInfo | null {
  const t = tenantById(s.tenantId);
  const u = db.prepare("SELECT json FROM users WHERE id = ? AND tenant_id = ?").get(s.userId, s.tenantId) as { json: string } | undefined;
  if (!t || !u) return null;
  return { user: JSON.parse(u.json), tenant: t.tenant, team: usersOf(s.tenantId) };
}

const fehler = (c: Context, status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 | 503, text: string) => c.json({ fehler: text }, status);

/** Pausierte Kanzleien und abgelaufene Testzugänge werden abgewiesen (Präsentationskanzleien, demo = 1, laufen nicht ab). */
function zugangsSperre(tenantId: string): string | null {
  const t = tenantById(tenantId);
  if (!t) return "Kanzlei nicht gefunden.";
  const ap = t.tenant.ansprechpartner;
  const kontakt = `Ihr fester Ansprechpartner: ${ap.name} (${ap.telefon}).`;
  if (t.tenant.status === "pausiert") return `Der Zugang dieser Kanzlei ist pausiert. ${kontakt}`;
  if (t.tenant.testBis && t.tenant.testBis < today() && t.tenant.status === "test" && !t.demo) return `Der Testzeitraum ist am ${fmtDate(t.tenant.testBis)} abgelaufen. ${kontakt} ${ap.name} verlängert den Zugang gern.`;
  return null;
}

// einfache Begrenzung gegen Passwort-Raten und KI-Missbrauch
const buckets = new Map<string, number[]>();
function begrenzt(key: string, max: number, fensterMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < fensterMs);
  arr.push(now);
  buckets.set(key, arr);
  return arr.length > max;
}
const ip = (c: Context) => c.req.header("x-forwarded-for")?.split(",")[0].trim() ?? "lokal";

// ───────────── API ─────────────
const app = new Hono();

app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "same-origin");
  c.header("X-Frame-Options", "SAMEORIGIN");
  c.header("Permissions-Policy", "camera=(), geolocation=(), microphone=(self)");
});

app.get("/api/info", (c) => c.json({ modus: "server", schnellLogin: QUICK_LOGIN, ki: { server: !!anthropic, modell: anthropic ? AI_MODEL : undefined }, version: VERSION }));
app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/auth/schnell", (c) => {
  if (!QUICK_LOGIN) return c.json([]);
  // Nur die eingebauten Demo-Kanzleien (deren Passwort öffentlich ist) – nie echte Kunden oder die Console.
  return c.json(
    DEMO_TENANTS.filter((t) => tenantById(t.tenant.id)).map((t) => {
      const u = t.users[0];
      return { email: u.email, passwort: DEMO_PASSWORT, name: u.name, kanzlei: t.tenant.kurzname, stadt: t.tenant.stadt, titel: u.titel, initialen: u.initialen, farbe: u.farbe };
    }),
  );
});

app.post("/api/auth/login", async (c) => {
  if (begrenzt(`login:${ip(c)}`, 12, 60_000)) return fehler(c, 429, "Zu viele Anmeldeversuche. Bitte warten Sie eine Minute.");
  const body = (await c.req.json().catch(() => ({}))) as { email?: string; passwort?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  const pw = String(body.passwort ?? "");
  if (!email || !pw) return fehler(c, 400, "Bitte E-Mail-Adresse und Passwort eingeben.");
  if (email === CONSOLE_EMAIL) {
    if (!CONSOLE_PASSWORD) return fehler(c, 403, "Die Apex Console ist auf diesem Server nicht aktiviert.");
    const a = Buffer.from(pw);
    const b = Buffer.from(CONSOLE_PASSWORD);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return fehler(c, 401, "Das Passwort stimmt nicht.");
    neueSitzung(c, { kind: "console" });
    audit("console.login", email);
    return c.json({ console: true, email, name: "AnwaltApex Team" });
  }
  const u = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
  if (!u || !pruefePw(pw, u.pw_hash)) return fehler(c, 401, "E-Mail-Adresse oder Passwort stimmen nicht.");
  const sperre = zugangsSperre(u.tenant_id);
  if (sperre) return fehler(c, 403, sperre);
  // Startpasswort (Einladung/Neuvergabe): erst nach eigenem Passwort gibt es eine Sitzung.
  if (u.pw_wechsel) return c.json({ fehler: "Bitte legen Sie zuerst ein eigenes Passwort fest.", passwortWechsel: true, email: u.email }, 403);
  db.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(new Date().toISOString(), u.id);
  const s = { kind: "tenant" as const, userId: u.id, tenantId: u.tenant_id };
  neueSitzung(c, s);
  audit("login", email, u.tenant_id, u.id);
  return c.json(sessionInfo(s));
});

app.post("/api/auth/passwort", async (c) => {
  if (begrenzt(`login:${ip(c)}`, 12, 60_000)) return fehler(c, 429, "Zu viele Anmeldeversuche. Bitte warten Sie eine Minute.");
  const body = (await c.req.json().catch(() => ({}))) as { email?: string; passwort?: string; neuesPasswort?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  const pw = String(body.passwort ?? "");
  const neu = String(body.neuesPasswort ?? "");
  const u = email ? (db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined) : undefined;
  if (!u || !pruefePw(pw, u.pw_hash)) return fehler(c, 401, "Das Startpasswort stimmt nicht. Bitte melden Sie sich erneut an.");
  const sperre = zugangsSperre(u.tenant_id);
  if (sperre) return fehler(c, 403, sperre);
  const regel = pruefeNeuesPasswort(neu, pw);
  if (regel) return fehler(c, 400, regel);
  db.prepare("UPDATE users SET pw_hash = ?, pw_wechsel = 0, last_login = ? WHERE id = ?").run(hashPw(neu), new Date().toISOString(), u.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(u.id);
  const s = { kind: "tenant" as const, userId: u.id, tenantId: u.tenant_id };
  neueSitzung(c, s);
  audit("passwort.eigenes", u.email, u.tenant_id, u.id);
  return c.json(sessionInfo(s));
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
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  deleteCookie(c, "aa_sid", { path: "/" });
  return c.body(null, 204);
});

// ── Kanzleidaten (strikt auf die Kanzlei der Sitzung begrenzt) ──
function tenantSitzung(c: Context) {
  const s = sitzung(c);
  return s && s.kind === "tenant" ? s : null;
}

app.get("/api/data", (c) => {
  const s = tenantSitzung(c);
  if (!s) return fehler(c, 401, "Nicht angemeldet");
  return c.json(ladeDaten(s.tenantId));
});

app.put("/api/data/:col/:id", async (c) => {
  const s = tenantSitzung(c);
  if (!s) return fehler(c, 401, "Nicht angemeldet");
  const col = c.req.param("col") as CollectionKey;
  const id = c.req.param("id");
  if (!COLLECTIONS.includes(col)) return fehler(c, 400, "Unbekannte Sammlung");
  const raw = await c.req.text();
  if (raw.length > 2_000_000) return fehler(c, 413, "Dokument zu groß");
  let doc: { id?: string };
  try {
    doc = JSON.parse(raw);
  } catch {
    return fehler(c, 400, "Ungültige Daten");
  }
  if (!doc || doc.id !== id) return fehler(c, 400, "ID stimmt nicht überein");
  db.prepare("INSERT OR REPLACE INTO docs (tenant_id, col, id, json, updated_at) VALUES (?, ?, ?, ?, ?)").run(s.tenantId, col, id, raw, Date.now());
  // Hintergrundläufe (simulierter 38h-Motor, ?system=1) zählen nicht als Änderung durch die Kanzlei –
  // unveränderte Demodaten werden dann weiter täglich relativ zu „heute" neu erzeugt.
  if (c.req.query("system") !== "1") db.prepare("UPDATE tenant_state SET dirty = 1 WHERE tenant_id = ?").run(s.tenantId);
  return c.body(null, 204);
});

app.delete("/api/data/:col/:id", (c) => {
  const s = tenantSitzung(c);
  if (!s) return fehler(c, 401, "Nicht angemeldet");
  const col = c.req.param("col") as CollectionKey;
  if (!COLLECTIONS.includes(col)) return fehler(c, 400, "Unbekannte Sammlung");
  db.prepare("DELETE FROM docs WHERE tenant_id = ? AND col = ? AND id = ?").run(s.tenantId, col, c.req.param("id"));
  db.prepare("UPDATE tenant_state SET dirty = 1 WHERE tenant_id = ?").run(s.tenantId);
  audit("data.delete", `${col}/${c.req.param("id")}`, s.tenantId, s.userId);
  return c.body(null, 204);
});

app.post("/api/data/reset", (c) => {
  const s = tenantSitzung(c);
  if (!s) return fehler(c, 401, "Nicht angemeldet");
  const me = sessionInfo(s);
  if (!me || !darfVerwalten(me.user)) return fehler(c, 403, "Nur Partner und Administration dürfen den Datenbestand zurücksetzen.");
  audit("data.reset", "", s.tenantId, s.userId);
  return c.json(ladeDaten(s.tenantId, true));
});

// ── Kanzleiprofil ──
app.put("/api/kanzlei/profil", async (c) => {
  const s = tenantSitzung(c);
  if (!s) return fehler(c, 401, "Nicht angemeldet");
  const me = sessionInfo(s);
  if (!me || !darfVerwalten(me.user)) return fehler(c, 403, "Nur Partner und Administration dürfen das Kanzleiprofil ändern.");
  const b = (await c.req.json().catch(() => ({}))) as { name?: unknown; kurzname?: unknown; adresse?: unknown; stadt?: unknown; schwerpunkte?: unknown };
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const name = text(b.name, 160);
  const adresse = text(b.adresse, 200);
  if (!name || !adresse) return fehler(c, 400, "Bitte Name und Anschrift der Kanzlei angeben.");
  const schwerpunkte = Array.isArray(b.schwerpunkte) ? b.schwerpunkte.map((x) => text(x, 60)).filter(Boolean).slice(0, 12) : me.tenant.schwerpunkte;
  const tenant: Tenant = { ...me.tenant, name, kurzname: text(b.kurzname, 60) || name.slice(0, 60), adresse, stadt: text(b.stadt, 80), schwerpunkte };
  db.prepare("UPDATE tenants SET json = ? WHERE id = ?").run(JSON.stringify(tenant), s.tenantId);
  audit("kanzlei.profil", tenant.name, s.tenantId, s.userId);
  return c.json(tenant);
});

// ── Team ──
app.post("/api/team", async (c) => {
  const s = tenantSitzung(c);
  if (!s) return fehler(c, 401, "Nicht angemeldet");
  const me = sessionInfo(s);
  if (!me || !darfVerwalten(me.user)) return fehler(c, 403, "Nur Partner und Administration können Zugänge anlegen.");
  const body = (await c.req.json().catch(() => ({}))) as { name?: string; email?: string; rolle?: User["rolle"]; titel?: string };
  if (!body.name || !body.email || !body.rolle) return fehler(c, 400, "Bitte Name, E-Mail und Rolle angeben.");
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(body.email.trim().toLowerCase())) return fehler(c, 409, "Diese E-Mail-Adresse ist bereits vergeben.");
  const anzahl = usersOf(s.tenantId).length;
  const lizenz = me.tenant.lizenz.arbeitsplaetze;
  if (anzahl >= lizenz) return fehler(c, 403, `Alle ${lizenz} Arbeitsplätze der Lizenz sind belegt.`);
  const user = baueNutzer(s.tenantId, { name: body.name, email: body.email, rolle: body.rolle, titel: body.titel ?? "" }, anzahl + 1 + Math.floor(Math.random() * 900));
  const passwort = zufallsPasswort();
  speichereUser(user, passwort, true);
  audit("team.add", user.email, s.tenantId, s.userId);
  return c.json({ user, passwort });
});

app.delete("/api/team/:id", (c) => {
  const s = tenantSitzung(c);
  if (!s) return fehler(c, 401, "Nicht angemeldet");
  const me = sessionInfo(s);
  if (!me || !darfVerwalten(me.user)) return fehler(c, 403, "Nur Partner und Administration können Zugänge entfernen.");
  if (c.req.param("id") === s.userId) return fehler(c, 400, "Sie können sich nicht selbst entfernen.");
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND tenant_id = ?").run(c.req.param("id"), s.tenantId);
  db.prepare("DELETE FROM users WHERE id = ? AND tenant_id = ?").run(c.req.param("id"), s.tenantId);
  audit("team.remove", c.req.param("id"), s.tenantId, s.userId);
  return c.body(null, 204);
});

app.post("/api/team/:id/passwort", (c) => {
  const s = tenantSitzung(c);
  if (!s) return fehler(c, 401, "Nicht angemeldet");
  const me = sessionInfo(s);
  if (!me || !darfVerwalten(me.user)) return fehler(c, 403, "Nur Partner und Administration können Passwörter neu vergeben.");
  const id = c.req.param("id");
  if (id === s.userId) return fehler(c, 400, "Ihr eigenes Passwort können Sie hier nicht neu vergeben.");
  const pw = zufallsPasswort();
  const r = db.prepare("UPDATE users SET pw_hash = ?, pw_wechsel = 1 WHERE id = ? AND tenant_id = ?").run(hashPw(pw), id, s.tenantId);
  if (!r.changes) return fehler(c, 404, "Dieser Zugang gehört nicht zu Ihrer Kanzlei.");
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND tenant_id = ?").run(id, s.tenantId);
  audit("team.passwort", id, s.tenantId, s.userId);
  return c.json({ passwort: pw });
});

// ── Apex Console (Anbieter) ──
function consoleOk(c: Context) {
  return sitzung(c)?.kind === "console";
}

app.get("/api/console/kunden", (c) => {
  if (!consoleOk(c)) return fehler(c, 403, "Nur für das AnwaltApex-Team");
  const tenants = db.prepare("SELECT * FROM tenants ORDER BY created_at").all() as TenantRow[];
  return c.json(
    tenants.map((r) => {
      const stats = (col: string) => (db.prepare("SELECT COUNT(*) AS n FROM docs WHERE tenant_id = ? AND col = ?").get(r.id, col) as { n: number }).n;
      const offen = (db.prepare("SELECT COUNT(*) AS n FROM docs WHERE tenant_id = ? AND col = 'fristen' AND json LIKE '%\"status\":\"offen\"%'").get(r.id) as { n: number }).n;
      const letzte = db.prepare("SELECT MAX(last_login) AS t FROM users WHERE tenant_id = ?").get(r.id) as { t: string | null };
      return { tenant: JSON.parse(r.json), users: usersOf(r.id), stats: { akten: stats("akten"), offeneFristen: offen, nachrichten: stats("nachrichten"), letzteAktivitaet: letzte.t ?? undefined } };
    }),
  );
});

app.post("/api/console/kunden", async (c) => {
  if (!consoleOk(c)) return fehler(c, 403, "Nur für das AnwaltApex-Team");
  const b = (await c.req.json().catch(() => ({}))) as { kanzlei?: string; stadt?: string; bundesland?: Tenant["bundesland"]; adminName?: string; adminEmail?: string; arbeitsplaetze?: number; schwerpunkte?: Sachgebiet[]; beispieldaten?: boolean; testBis?: string };
  if (!b.kanzlei || !b.adminName || !b.adminEmail || !b.bundesland) return fehler(c, 400, "Bitte Kanzlei, Bundesland, Name und E-Mail angeben.");
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(b.adminEmail.trim().toLowerCase())) return fehler(c, 409, "Diese E-Mail-Adresse ist bereits vergeben.");
  const suffix = randomBytes(4).toString("hex");
  const { tenant, admin } = baueKunde({ kanzlei: b.kanzlei, stadt: b.stadt ?? "", bundesland: b.bundesland, adminName: b.adminName, adminEmail: b.adminEmail, arbeitsplaetze: Number(b.arbeitsplaetze) || 5, schwerpunkte: b.schwerpunkte ?? [], testBis: b.testBis }, suffix);
  const passwort = zufallsPasswort();
  speichereTenant(tenant, profilFuer(b.schwerpunkte ?? [], b.bundesland), false, !b.beispieldaten);
  speichereUser(admin, passwort);
  audit("console.kunde.neu", `${tenant.name} / ${admin.email}`, tenant.id);
  return c.json({ tenant, admin, passwort });
});

app.delete("/api/console/kunden/:id", (c) => {
  if (!consoleOk(c)) return fehler(c, 403, "Nur für das AnwaltApex-Team");
  const id = c.req.param("id");
  db.prepare("DELETE FROM sessions WHERE tenant_id = ?").run(id);
  db.prepare("DELETE FROM tenants WHERE id = ?").run(id);
  audit("console.kunde.geloescht", id, id);
  return c.body(null, 204);
});

app.post("/api/console/kunden/:id/reset", (c) => {
  if (!consoleOk(c)) return fehler(c, 403, "Nur für das AnwaltApex-Team");
  ladeDaten(c.req.param("id"), true);
  return c.body(null, 204);
});

app.post("/api/console/kunden/:id/status", async (c) => {
  if (!consoleOk(c)) return fehler(c, 403, "Nur für das AnwaltApex-Team");
  const { status } = (await c.req.json().catch(() => ({}))) as { status?: Tenant["status"] };
  const t = tenantById(c.req.param("id"));
  if (!t || !status) return fehler(c, 404, "Kanzlei nicht gefunden");
  const neu: Tenant = { ...t.tenant, status };
  // Testzugang → Kunde: Die Lifetime-Lizenz gilt ab heute, der Testzeitraum entfällt.
  if (t.tenant.status === "test" && status === "aktiv") {
    neu.lizenz = { ...t.tenant.lizenz, seit: today() };
    delete neu.testBis;
  }
  db.prepare("UPDATE tenants SET json = ? WHERE id = ?").run(JSON.stringify(neu), t.id);
  if (status === "pausiert") db.prepare("DELETE FROM sessions WHERE tenant_id = ?").run(t.id);
  return c.body(null, 204);
});

app.post("/api/console/nutzer/:id/standardpasswort", (c) => {
  if (!consoleOk(c)) return fehler(c, 403, "Nur für das AnwaltApex-Team");
  const id = c.req.param("id");
  const demoNutzer = DEMO_TENANTS.some((t) => t.users.some((u) => u.id === id));
  if (!demoNutzer) return fehler(c, 400, "Nur Zugänge der eingebauten Beispielkanzleien haben ein Standardpasswort.");
  const r = db.prepare("UPDATE users SET pw_hash = ?, pw_wechsel = 0 WHERE id = ?").run(hashPw(DEMO_PASSWORT), id);
  if (!r.changes) return fehler(c, 404, "Nutzer nicht gefunden");
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  audit("console.standardpasswort", id);
  return c.body(null, 204);
});

app.post("/api/console/nutzer/:id/passwort", (c) => {
  if (!consoleOk(c)) return fehler(c, 403, "Nur für das AnwaltApex-Team");
  const pw = zufallsPasswort();
  const r = db.prepare("UPDATE users SET pw_hash = ? WHERE id = ?").run(hashPw(pw), c.req.param("id"));
  if (!r.changes) return fehler(c, 404, "Nutzer nicht gefunden");
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(c.req.param("id"));
  return c.json({ passwort: pw });
});

// ── KI-Proxy (Claude über die Anthropic API) ──
app.post("/api/ai/messages", async (c) => {
  const s = tenantSitzung(c);
  if (!s) return fehler(c, 401, "Nicht angemeldet");
  if (!anthropic) return fehler(c, 503, "Auf diesem Server ist keine Live-KI konfiguriert.");
  if (begrenzt(`ai:${s.tenantId}`, 120, 10 * 60_000)) return fehler(c, 429, "Zu viele KI-Anfragen. Bitte kurz warten.");
  const body = (await c.req.json().catch(() => null)) as { system?: string; messages?: Anthropic.Beta.BetaMessageParam[]; tools?: { name: string; description: string; input_schema: Anthropic.Beta.BetaTool["input_schema"] }[]; effort?: "low" | "medium" | "high"; maxTokens?: number } | null;
  if (!body?.messages?.length) return fehler(c, 400, "Keine Nachrichten übergeben.");
  const tools = (body.tools ?? []).slice(0, 20).map((t) => ({ name: String(t.name).slice(0, 64), description: String(t.description).slice(0, 2000), input_schema: t.input_schema }));
  audit("ai.request", `${body.messages.length} Nachrichten, ${tools.length} Werkzeuge`, s.tenantId, s.userId);

  return streamSSE(c, async (stream) => {
    try {
      const st = anthropic.beta.messages.stream({
        model: AI_MODEL,
        max_tokens: Math.min(body.maxTokens ?? 16000, 32000),
        system: [{ type: "text", text: String(body.system ?? ""), cache_control: { type: "ephemeral" } }],
        messages: body.messages!,
        ...(tools.length ? { tools } : {}),
        output_config: { effort: body.effort ?? "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
      st.on("text", (delta) => {
        void stream.writeSSE({ data: JSON.stringify({ type: "text", text: delta }) });
      });
      const msg = await st.finalMessage();
      if (msg.stop_reason === "refusal") {
        await stream.writeSSE({ data: JSON.stringify({ type: "error", fehler: "Die KI hat diese Anfrage abgelehnt. Bitte formulieren Sie sie anders." }) });
        return;
      }
      await stream.writeSSE({ data: JSON.stringify({ type: "final", message: { content: msg.content, stop_reason: msg.stop_reason, model: msg.model } }) });
    } catch (e) {
      const text = e instanceof Anthropic.RateLimitError ? "Die KI ist gerade ausgelastet – bitte gleich noch einmal versuchen." : e instanceof Anthropic.AuthenticationError ? "Der KI-Zugang des Servers ist ungültig (API-Schlüssel prüfen)." : e instanceof Anthropic.APIError ? `KI-Fehler (${e.status ?? "?"})` : "Die KI ist nicht erreichbar.";
      console.error("KI-Fehler", e);
      await stream.writeSSE({ data: JSON.stringify({ type: "error", fehler: text }) });
    }
  });
});

app.all("/api/*", (c) => fehler(c, 404, "Unbekannter Endpunkt"));

// ── Web-App ausliefern (SPA) ──
const indexPath = resolve(STATIC_DIR, "index.html");
app.use("/*", serveStatic({ root: STATIC_DIR }));
app.get("*", (c) => (existsSync(indexPath) ? c.html(readFileSync(indexPath, "utf8")) : c.text("Web-App nicht gebaut. Bitte `npm run build` ausführen.", 404)));

// abgelaufene Sitzungen aufräumen
setInterval(() => db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now()), 3600_000).unref();

serve({ fetch: app.fetch, port: PORT }, (i) => {
  console.log(`AnwaltApex läuft auf http://localhost:${i.port}  ·  KI: ${anthropic ? `Claude (${AI_MODEL})` : "Demo-Modus (kein ANTHROPIC_API_KEY)"}`);
});
