// Demo-Betrieb: läuft vollständig im Browser (IndexedDB) – ideal für Präsentationen und Artefakt-Vorschau.
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import { today } from "@/core/dates";
import { generateTenantData, SEED_VERSION } from "@/core/seed/generate";
import { DEMO_TENANTS, CONSOLE_DEMO, publicUser, type DemoTenant, type DemoUser } from "@/core/seed/tenants";
import { baueKunde, baueNutzer, profilFuer, zufallsPasswort } from "@/core/seed/kunde";
import type { CollectionKey, TenantData, Tenant } from "@/core/types";
import type { Backend, ConsoleKunde, NeuerKunde, Sitzung } from "./types";

const LS_SESSION = "aa:session";
const LS_REGISTRY = "aa:registry";
const LS_OVERRIDES = "aa:tenant-overrides";
const LS_EXTRA_USERS = "aa:extra-users"; // eingeladene Personen in den eingebauten Demo-Kanzleien
const LS_PW = "aa:pw-overrides"; // neu vergebene Passwörter (userId → Passwort)

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

async function store<T>(key: string, value?: T | null): Promise<T | undefined> {
  if (value === undefined) {
    if (idbOk) {
      try {
        return (await idbGet(key)) as T | undefined;
      } catch {
        idbOk = false;
      }
    }
    return memory.get(key) as T | undefined;
  }
  memory.set(key, value);
  if (idbOk) {
    try {
      if (value === null) await idbDel(key);
      else await idbSet(key, value);
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

function registry(): DemoTenant[] {
  const extra = lsGet<DemoTenant[]>(LS_REGISTRY) ?? [];
  const overrides = lsGet<Record<string, Partial<Tenant>>>(LS_OVERRIDES) ?? {};
  const extraUsers = lsGet<Record<string, DemoUser[]>>(LS_EXTRA_USERS) ?? {};
  const pw = lsGet<Record<string, string>>(LS_PW) ?? {};
  return [...DEMO_TENANTS, ...extra].map((t) => ({
    ...t,
    tenant: { ...t.tenant, ...(overrides[t.tenant.id] ?? {}) },
    users: [...t.users, ...(extraUsers[t.tenant.id] ?? []).filter((u) => !t.users.some((x) => x.id === u.id))].map((u) => (pw[u.id] ? { ...u, passwort: pw[u.id] } : u)),
  }));
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

function scheduleSave() {
  if (!current) return;
  clearTimeout(saveTimer);
  const snap = current;
  saveTimer = setTimeout(() => void store(`aa:data:${snap.tenantId}`, snap.stored), 250);
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
  return {
    modus: "demo",
    async info() {
      return { modus: "demo", schnellLogin: true, ki: { server: false }, version: "0.9.0" };
    },
    async schnellLogins() {
      const list = registry().flatMap((t) =>
        t.users.slice(0, 1).map((u) => ({
          email: u.email, passwort: u.passwort, name: u.name, kanzlei: t.tenant.kurzname, stadt: t.tenant.stadt,
          titel: u.titel, initialen: u.initialen, farbe: u.farbe,
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
          if (t.tenant.status === "pausiert") throw new Error("Der Zugang dieser Kanzlei ist pausiert. Bitte wenden Sie sich an Ihre Ansprechpartnerin.");
          const s: DemoSession = { kind: "tenant", tenantId: t.tenant.id, userId: u.id };
          lsSet(LS_SESSION, s);
          return sitzungFuer(s)!;
        }
      }
      throw new Error("Zu dieser E-Mail-Adresse gibt es keinen Zugang.");
    },
    async me() {
      const s = lsGet<DemoSession>(LS_SESSION);
      return s ? sitzungFuer(s) : null;
    },
    async logout() {
      lsSet(LS_SESSION, null);
      current = null;
    },
    async loadData() {
      const s = lsGet<DemoSession>(LS_SESSION);
      if (!s || s.kind !== "tenant") throw new Error("Nicht angemeldet");
      const t = findTenant(s.tenantId)!;
      const stored = await ladeOderSeed(t);
      current = { tenantId: t.tenant.id, stored };
      return stored.data;
    },
    async putDoc(col, doc) {
      if (!current) return;
      const arr = current.stored.data[col] as { id: string }[];
      const i = arr.findIndex((x) => x.id === doc.id);
      if (i >= 0) arr[i] = doc;
      else arr.unshift(doc);
      current.stored.dirty = true;
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
      const s = lsGet<DemoSession>(LS_SESSION);
      if (!s || s.kind !== "tenant") throw new Error("Nicht angemeldet");
      const t = findTenant(s.tenantId)!;
      const stored = await ladeOderSeed(t, true);
      current = { tenantId: t.tenant.id, stored };
      return stored.data;
    },
    team: {
      async add(input) {
        const s = lsGet<DemoSession>(LS_SESSION);
        if (!s || s.kind !== "tenant") throw new Error("Nicht angemeldet");
        const extra = lsGet<DemoTenant[]>(LS_REGISTRY) ?? [];
        const all = registry();
        if (all.some((t) => t.users.some((u) => u.email.toLowerCase() === input.email.trim().toLowerCase()))) {
          throw new Error("Diese E-Mail-Adresse ist bereits vergeben.");
        }
        const t = all.find((x) => x.tenant.id === s.tenantId)!;
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
        return { user: publicUser(user), passwort };
      },
      async remove(id) {
        const extra = lsGet<DemoTenant[]>(LS_REGISTRY) ?? [];
        for (const t of extra) t.users = t.users.filter((u) => u.id !== id || u.rolle === "partner");
        lsSet(LS_REGISTRY, extra);
        const eu = lsGet<Record<string, DemoUser[]>>(LS_EXTRA_USERS) ?? {};
        for (const k of Object.keys(eu)) eu[k] = eu[k].filter((u) => u.id !== id);
        lsSet(LS_EXTRA_USERS, eu);
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
        const o = lsGet<Record<string, Partial<Tenant>>>(LS_OVERRIDES) ?? {};
        o[tenantId] = { ...(o[tenantId] ?? {}), status };
        lsSet(LS_OVERRIDES, o);
      },
      async neuesPasswort(userId) {
        const pw = zufallsPasswort();
        const map = lsGet<Record<string, string>>(LS_PW) ?? {};
        map[userId] = pw;
        lsSet(LS_PW, map);
        return pw;
      },
    },
  };
}
