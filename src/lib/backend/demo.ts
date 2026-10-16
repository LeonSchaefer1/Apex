// Demo-Betrieb: läuft vollständig im Browser (IndexedDB) – ideal für Präsentationen und Artefakt-Vorschau.
import { createStore, get as idbGet, set as idbSet, del as idbDel, type UseStore } from "idb-keyval";
import { fmtDate, today } from "@/core/dates";
import { generateTenantData, SEED_VERSION } from "@/core/seed/generate";
import { DEMO_TENANTS, DEMO_PASSWORT, CONSOLE_DEMO, publicUser, type DemoTenant, type DemoUser } from "@/core/seed/tenants";
import { baueKunde, baueNutzer, profilFuer, zufallsPasswort } from "@/core/seed/kunde";
import type { CollectionKey, TenantData, Tenant } from "@/core/types";
import { PasswortWechselNoetig, darfVerwalten, pruefeNeuesPasswort, type Backend, type ConsoleKunde, type KanzleiProfil, type NeuerKunde, type Sitzung } from "./types";

const LS_SESSION = "aa:session";
const LS_REGISTRY = "aa:registry";
const LS_OVERRIDES = "aa:tenant-overrides";
const LS_EXTRA_USERS = "aa:extra-users"; // eingeladene Personen in den eingebauten Demo-Kanzleien
const LS_PW = "aa:pw-overrides"; // neu vergebene Passwörter (userId → Passwort)
const LS_PW_WECHSEL = "aa:pw-wechsel"; // Zugänge mit Startpasswort: eigenes Passwort bei der nächsten Anmeldung festlegen
const LS_ENTFERNT = "aa:removed-users"; // entfernte Zugänge der eingebauten Demo-Kanzleien (tenantId → userIds)

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
  return [...DEMO_TENANTS, ...extra].map((t) => ({
    ...t,
    tenant: mitOverrides(t.tenant, overrides[t.tenant.id]),
    users: [...t.users, ...(extraUsers[t.tenant.id] ?? []).filter((u) => !t.users.some((x) => x.id === u.id))]
      .filter((u) => !(entfernt[t.tenant.id] ?? []).includes(u.id))
      .map((u) => (pw[u.id] ? { ...u, passwort: pw[u.id] } : u)),
  }));
}

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
  if (!s || s.kind !== "tenant") throw new Error("Nicht angemeldet");
  const t = findTenant(s.tenantId);
  const u = t?.users.find((x) => x.id === s.userId);
  if (!t || !u) throw new Error("Sitzung ungültig – bitte erneut anmelden.");
  if (verwalten && !darfVerwalten(u.rolle)) throw new Error("Diese Aktion ist Partnern und der Administration Ihrer Kanzlei vorbehalten.");
  return { t, u };
}

function findTenant(id: string) {
  return registry().find((t) => t.tenant.id === id);
}

function sitzungFuer(s: DemoSession): Sitzung | null {
  if (s.kind === "console") return { console: true, email: CONSOLE_DEMO.email, name: CONSOLE_DEMO.name };
  const t = findTenant(s.tenantId);
  const u = t?.users.find((x) => x.id === s.userId);
  if (!t || !u) return null;
  return { user: publicUser(u), tenant: t.tenant, team: t.users.map(publicUser) };
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
  const kontakt = `Ihr fester Ansprechpartner: ${ap.name} (${ap.telefon}).`;
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
  const data = generateTenantData({ tenant: t.tenant, users: t.users.map(publicUser), profil: t.profil }, heute, { leer });
  const stored: StoredData = { data, dirty: false, seededFor: heute, seedVersion: SEED_VERSION };
  await store(key, stored);
  return stored;
}

function statsFuer(data?: TenantData): ConsoleKunde["stats"] {
  if (!data) return { akten: 0, offeneFristen: 0, nachrichten: 0 };
  return {
    akten: data.akten.length,
    offeneFristen: data.fristen.filter((f) => f.status === "offen").length,
    nachrichten: data.nachrichten.length,
    letzteAktivitaet: data.aktivitaeten[0]?.zeit,
  };
}

export function createDemoBackend(): Backend {
  registriereFlush();
  return {
    modus: "demo",
    async info() {
      return { modus: "demo", schnellLogin: true, ki: { server: false }, version: "0.9.0" };
    },
    async schnellLogins() {
      const list = registry().flatMap((t) =>
        t.users.slice(0, 1).map((u) => ({
          email: u.email, passwort: u.passwort, name: u.name, kanzlei: t.tenant.kurzname, stadt: t.tenant.stadt,
          titel: u.titel, initialen: u.initialen, farbe: u.farbe, kundentest: !istPraesentationskanzlei(t.tenant.id),
        })),
      );
      return [
        ...list,
        { email: CONSOLE_DEMO.email, passwort: CONSOLE_DEMO.passwort, name: CONSOLE_DEMO.name, kanzlei: "Apex Console", stadt: "Anbieter", titel: "Kundenverwaltung", initialen: "AA", farbe: "#0B1020", console: true },
      ];
    },
    async login(email, passwort) {
      const e = email.trim().toLowerCase();
      if (e === CONSOLE_DEMO.email && passwort === CONSOLE_DEMO.passwort) {
        const s: DemoSession = { kind: "console" };
        lsSet(LS_SESSION, s);
        return sitzungFuer(s)!;
      }
      for (const t of registry()) {
        const u = t.users.find((x) => x.email.toLowerCase() === e);
        if (u) {
          if (u.passwort !== passwort) throw new Error("Das Passwort stimmt nicht. Bitte prüfen Sie die Groß- und Kleinschreibung.");
          const sperre = zugangsSperre(t.tenant);
          if (sperre) throw new Error(sperre);
          if (mussPasswortWechseln(u.id)) throw new PasswortWechselNoetig(u.email);
          const s: DemoSession = { kind: "tenant", tenantId: t.tenant.id, userId: u.id };
          lsSet(LS_SESSION, s);
          return sitzungFuer(s)!;
        }
      }
      throw new Error("Zu dieser E-Mail-Adresse gibt es keinen Zugang.");
    },
    async passwortErsetzen(email, startPasswort, neuesPasswort) {
      const e = email.trim().toLowerCase();
      const t = registry().find((x) => x.users.some((u) => u.email.toLowerCase() === e));
      const u = t?.users.find((x) => x.email.toLowerCase() === e);
      if (!t || !u || u.passwort !== startPasswort) throw new Error("Das Startpasswort stimmt nicht. Bitte melden Sie sich erneut an.");
      const sperre = zugangsSperre(t.tenant);
      if (sperre) throw new Error(sperre);
      const regel = pruefeNeuesPasswort(neuesPasswort, startPasswort);
      if (regel) throw new Error(regel);
      const map = lsGet<Record<string, string>>(LS_PW) ?? {};
      map[u.id] = neuesPasswort;
      lsSet(LS_PW, map);
      setzePasswortWechsel(u.id, false);
      const s: DemoSession = { kind: "tenant", tenantId: t.tenant.id, userId: u.id };
      lsSet(LS_SESSION, s);
      return sitzungFuer(s)!;
    },
    async me() {
      const s = lsGet<DemoSession>(LS_SESSION);
      return s ? sitzungFuer(s) : null;
    },
    async logout() {
      await flushSave();
      lsSet(LS_SESSION, null);
      current = null;
    },
    async loadData() {
      const s = lsGet<DemoSession>(LS_SESSION);
      if (!s || s.kind !== "tenant") throw new Error("Nicht angemeldet");
      const t = findTenant(s.tenantId)!;
      await flushSave();
      const stored = await ladeOderSeed(t);
      current = { tenantId: t.tenant.id, stored };
      return stored.data;
    },
    async putDoc(col, doc, opts) {
      if (!current) return;
      const arr = current.stored.data[col] as { id: string }[];
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
      const arr = current.stored.data[col] as { id: string }[];
      const i = arr.findIndex((x) => x.id === id);
      if (i >= 0) arr.splice(i, 1);
      current.stored.dirty = true;
      scheduleSave();
    },
    async resetData() {
      const { t } = kanzleiSitzung(true);
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
      return stored.data;
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
        const o = lsGet<Record<string, Partial<Tenant>>>(LS_OVERRIDES) ?? {};
        o[t.tenant.id] = { ...(o[t.tenant.id] ?? {}), ...profil };
        lsSet(LS_OVERRIDES, o);
        return { ...t.tenant, ...profil };
      },
    },
    team: {
      async add(input) {
        const { t } = kanzleiSitzung(true);
        const extra = lsGet<DemoTenant[]>(LS_REGISTRY) ?? [];
        const all = registry();
        if (all.some((x) => x.users.some((u) => u.email.toLowerCase() === input.email.trim().toLowerCase()))) {
          throw new Error("Diese E-Mail-Adresse ist bereits vergeben.");
        }
        if (t.users.length >= t.tenant.lizenz.arbeitsplaetze) throw new Error(`Alle ${t.tenant.lizenz.arbeitsplaetze} Arbeitsplätze der Lizenz sind belegt.`);
        const passwort = zufallsPasswort();
        const user: DemoUser = { ...baueNutzer(t.tenant.id, input, t.users.length + 1 + Math.floor(Math.random() * 900)), passwort };
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
        if (!t.users.some((x) => x.id === id)) throw new Error("Dieser Zugang gehört nicht zu Ihrer Kanzlei.");
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
      },
      async neuesPasswort(id) {
        const { t, u } = kanzleiSitzung(true);
        if (id === u.id) throw new Error("Ihr eigenes Passwort können Sie hier nicht neu vergeben.");
        if (!t.users.some((x) => x.id === id)) throw new Error("Dieser Zugang gehört nicht zu Ihrer Kanzlei.");
        const pw = zufallsPasswort();
        const map = lsGet<Record<string, string>>(LS_PW) ?? {};
        map[id] = pw;
        lsSet(LS_PW, map);
        setzePasswortWechsel(id, true);
        return pw;
      },
    },
    console: {
      async list() {
        const out: ConsoleKunde[] = [];
        for (const t of registry()) {
          const stored = await store<StoredData>(`aa:data:${t.tenant.id}`);
          out.push({ tenant: t.tenant, users: t.users.map(publicUser), stats: statsFuer(stored?.data) });
        }
        return out;
      },
      async create(input: NeuerKunde) {
        const email = input.adminEmail.trim().toLowerCase();
        if (registry().some((t) => t.users.some((u) => u.email.toLowerCase() === email))) throw new Error("Diese E-Mail-Adresse ist bereits einem Zugang zugeordnet.");
        const suffix = Math.random().toString(36).slice(2, 8);
        const { tenant, admin } = baueKunde(input, suffix);
        const passwort = zufallsPasswort();
        const neu: DemoTenant & { leer?: boolean } = {
          tenant,
          users: [{ ...admin, passwort }],
          profil: profilFuer(input.schwerpunkte, input.bundesland),
          leer: !input.beispieldaten,
        };
        const extra = lsGet<DemoTenant[]>(LS_REGISTRY) ?? [];
        extra.push(neu);
        lsSet(LS_REGISTRY, extra);
        return { tenant, admin, passwort };
      },
      async remove(tenantId) {
        const extra = (lsGet<DemoTenant[]>(LS_REGISTRY) ?? []).filter((t) => t.tenant.id !== tenantId);
        lsSet(LS_REGISTRY, extra);
        await store(`aa:data:${tenantId}`, null);
      },
      async reset(tenantId) {
        await store(`aa:data:${tenantId}`, null);
      },
      async setStatus(tenantId, status) {
        const o = lsGet<Record<string, Partial<Record<keyof Tenant, unknown>>>>(LS_OVERRIDES) ?? {};
        const t = findTenant(tenantId)?.tenant;
        // Testzugang → Kunde: Die Lifetime-Lizenz gilt ab heute, der Testzeitraum entfällt.
        const kauf = t && t.status === "test" && status === "aktiv" ? { lizenz: { ...t.lizenz, seit: today() }, testBis: null } : {};
        o[tenantId] = { ...(o[tenantId] ?? {}), status, ...kauf };
        lsSet(LS_OVERRIDES, o);
      },
      async neuesPasswort(userId) {
        const pw = zufallsPasswort();
        const map = lsGet<Record<string, string>>(LS_PW) ?? {};
        map[userId] = pw;
        lsSet(LS_PW, map);
        return pw;
      },
      async standardPasswort(userId) {
        const eingebaut = DEMO_TENANTS.some((t) => t.users.some((u) => u.id === userId && u.passwort === DEMO_PASSWORT));
        if (!eingebaut) throw new Error("Nur Zugänge der eingebauten Beispielkanzleien haben ein Standardpasswort.");
        const map = lsGet<Record<string, string>>(LS_PW) ?? {};
        delete map[userId];
        lsSet(LS_PW, map);
        setzePasswortWechsel(userId, false);
      },
    },
  };
}
