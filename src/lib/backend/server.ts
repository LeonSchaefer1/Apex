// Server-Betrieb: echte Mehrmandanten-Instanz mit Anmeldung, Datenhaltung je Kanzlei und KI-Proxy.
import type { CollectionKey, Tenant, TenantData } from "@/core/types";
import { CODE_SITZUNG_GEWECHSELT, PasswortWechselNoetig, ZweiFaktorNoetig, istConsole, type AiStreamRequest, type AiStreamResult, type Backend, type BackendInfo, type Sitzung, type ZweiFaktorEinrichtung, type ZweiFaktorStatus } from "./types";
import { meldeSitzungsproblem } from "./ereignisse";

const NICHT_ERREICHBAR = "Der Server ist gerade nicht erreichbar. Bitte prüfen Sie die Verbindung und versuchen Sie es erneut.";

/**
 * Kanzlei und Person, für die diese Seite Daten geladen hat. Jede Daten-, Team- und KI-Anfrage trägt sie mit (X-Kanzlei, X-Nutzer):
 * Hat sich inzwischen – etwa in einem anderen Tab – eine andere Kanzlei angemeldet, weist der Server die Anfrage ab (409),
 * statt Daten der alten Kanzlei in die neue zu schreiben.
 */
let bindung: { tenantId: string; userId: string } | null = null;

function bindungsKoepfe(): Record<string, string> {
  return bindung ? { "x-kanzlei": bindung.tenantId, "x-nutzer": bindung.userId } : {};
}

/** Sitzungsfehler (401/409) an die Sitzungsverwaltung melden – sie gleicht mit dem Server ab, leert veraltete Daten und informiert. */
function pruefeSitzungsfehler(status: number, code: unknown) {
  if (status === 409 && code === CODE_SITZUNG_GEWECHSELT) meldeSitzungsproblem("gewechselt");
  else if (status === 401) meldeSitzungsproblem("abgelaufen");
}

async function api<T>(path: string, init: RequestInit = {}, gebunden = false): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: "include",
      ...init,
      headers: { "content-type": "application/json", ...(gebunden ? bindungsKoepfe() : {}), ...(init.headers ?? {}) },
    });
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") throw e;
    throw new Error(NICHT_ERREICHBAR);
  }
  if (!res.ok) {
    let msg = res.status === 413 ? "Die Daten sind zu groß zum Speichern." : res.status >= 500 ? "Auf dem Server ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut." : `Fehler ${res.status}`;
    let wechsel: string | null = null;
    let zweiFaktor: { email: string; vorgang: string } | null = null;
    let code: unknown;
    try {
      const body = await res.json();
      if (body?.fehler) msg = body.fehler;
      if (body?.passwortWechsel) wechsel = String(body.email ?? "");
      if (body?.zweiFaktor && typeof body.vorgang === "string") zweiFaktor = { email: String(body.email ?? ""), vorgang: body.vorgang };
      code = body?.code;
    } catch {
      /* keine JSON-Antwort */
    }
    if (gebunden) pruefeSitzungsfehler(res.status, code);
    if (wechsel !== null) throw new PasswortWechselNoetig(wechsel);
    if (zweiFaktor) throw new ZweiFaktorNoetig(zweiFaktor.email, zweiFaktor.vorgang);
    throw Object.assign(new Error(msg), { status: res.status, code });
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function serverErreichbar(timeoutMs = 1500): Promise<BackendInfo | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch("/api/info", { signal: ctl.signal, credentials: "include" });
    clearTimeout(t);
    if (!res.ok) return null;
    const info = (await res.json()) as BackendInfo;
    return info?.modus === "server" ? info : null;
  } catch {
    return null;
  }
}

export function createServerBackend(): Backend {
  return {
    modus: "server",
    info: () => api("/info"),
    schnellLogins: () => api("/auth/schnell"),
    login: (email, passwort) => api("/auth/login", { method: "POST", body: JSON.stringify({ email, passwort }) }),
    zweiFaktorAnmelden: (vorgang, code) => api<Sitzung>("/auth/zweifaktor", { method: "POST", body: JSON.stringify({ vorgang, code }) }),
    passwortErsetzen: (email, startPasswort, neuesPasswort) => api<Sitzung>("/auth/passwort", { method: "POST", body: JSON.stringify({ email, passwort: startPasswort, neuesPasswort }) }),
    entsperren: (passwort) => api("/auth/entsperren", { method: "POST", body: JSON.stringify({ passwort }) }, true),
    // null nur, wenn der Server „nicht angemeldet“ meldet – Netz- und Serverfehler werfen, damit ein kurzer Aussetzer niemanden abmeldet.
    me: async () => {
      try {
        return await api<Sitzung>("/auth/me");
      } catch (e) {
        if ((e as { status?: number }).status === 401) return null;
        throw e;
      }
    },
    logout: () => api("/auth/logout", { method: "POST" }),
    bindeSitzung(s) {
      bindung = s && !istConsole(s) ? { tenantId: s.tenant.id, userId: s.user.id } : null;
    },
    loadData: () => api<TenantData>("/data", {}, true),
    putDoc: (col: CollectionKey, doc, opts) => api(`/data/${col}/${encodeURIComponent(doc.id)}${opts?.system ? "?system=1" : ""}`, { method: "PUT", body: JSON.stringify(doc) }, true),
    deleteDoc: (col: CollectionKey, id) => api(`/data/${col}/${encodeURIComponent(id)}`, { method: "DELETE" }, true),
    resetData: () => api<TenantData>("/data/reset", { method: "POST" }, true),
    kanzlei: {
      profilSpeichern: (p) => api<Tenant>("/kanzlei/profil", { method: "PUT", body: JSON.stringify(p) }, true),
      sicherheitSpeichern: (x) => api<Tenant>("/kanzlei/sicherheit", { method: "PUT", body: JSON.stringify(x) }, true),
    },
    zweiFaktor: {
      status: () => api<ZweiFaktorStatus>("/zweifaktor", {}, true),
      einrichten: () => api<ZweiFaktorEinrichtung>("/zweifaktor/einrichten", { method: "POST" }, true),
      bestaetigen: (code) => api<{ wiederherstellungscodes: string[] }>("/zweifaktor/bestaetigen", { method: "POST", body: JSON.stringify({ code }) }, true),
      deaktivieren: (code) => api("/zweifaktor/deaktivieren", { method: "POST", body: JSON.stringify({ code }) }, true),
    },
    team: {
      add: (input) => api("/team", { method: "POST", body: JSON.stringify(input) }, true),
      remove: (id) => api(`/team/${encodeURIComponent(id)}`, { method: "DELETE" }, true),
      neuesPasswort: async (id) => (await api<{ passwort: string }>(`/team/${encodeURIComponent(id)}/passwort`, { method: "POST" }, true)).passwort,
      aendern: (id, a) => api(`/team/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(a) }, true),
    },
    console: {
      list: () => api("/console/kunden"),
      create: (input) => api("/console/kunden", { method: "POST", body: JSON.stringify(input) }),
      remove: (id) => api(`/console/kunden/${encodeURIComponent(id)}`, { method: "DELETE" }),
      reset: (id) => api(`/console/kunden/${encodeURIComponent(id)}/reset`, { method: "POST" }),
      setStatus: (id, status) => api(`/console/kunden/${encodeURIComponent(id)}/status`, { method: "POST", body: JSON.stringify({ status }) }),
      neuesPasswort: async (userId) => (await api<{ passwort: string }>(`/console/nutzer/${encodeURIComponent(userId)}/passwort`, { method: "POST" })).passwort,
      standardPasswort: (userId) => api(`/console/nutzer/${encodeURIComponent(userId)}/standardpasswort`, { method: "POST" }),
    },
    async aiStream(req: AiStreamRequest, onText, signal): Promise<AiStreamResult> {
      let res: Response;
      try {
        res = await fetch("/api/ai/messages", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json", ...bindungsKoepfe() },
          body: JSON.stringify(req),
          signal,
        });
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") throw e;
        throw new Error(NICHT_ERREICHBAR);
      }
      if (!res.ok || !res.body) {
        let msg = `KI-Fehler ${res.status}`;
        try {
          const body = await res.json();
          msg = body.fehler ?? msg;
          pruefeSitzungsfehler(res.status, body.code);
        } catch {
          /* ignorieren */
        }
        throw new Error(msg);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let final: AiStreamResult | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const evt = JSON.parse(line.slice(6));
          if (evt.type === "text") onText(evt.text);
          else if (evt.type === "final") final = evt.message;
          else if (evt.type === "error") throw new Error(evt.fehler);
        }
      }
      if (!final) throw new Error("Die KI-Antwort wurde unterbrochen.");
      return final;
    },
  };
}
