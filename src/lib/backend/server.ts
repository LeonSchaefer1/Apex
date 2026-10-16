// Server-Betrieb: echte Mehrmandanten-Instanz mit Anmeldung, Datenhaltung je Kanzlei und KI-Proxy.
import type { CollectionKey, TenantData } from "@/core/types";
import type { AiStreamRequest, AiStreamResult, Backend, BackendInfo } from "./types";

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let msg = `Fehler ${res.status}`;
    try {
      const body = await res.json();
      if (body?.fehler) msg = body.fehler;
    } catch {
      /* keine JSON-Antwort */
    }
    throw new Error(msg);
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
    me: async () => {
      try {
        return await api("/auth/me");
      } catch {
        return null;
      }
    },
    logout: () => api("/auth/logout", { method: "POST" }),
    loadData: () => api<TenantData>("/data"),
    putDoc: (col: CollectionKey, doc, opts) => api(`/data/${col}/${encodeURIComponent(doc.id)}${opts?.system ? "?system=1" : ""}`, { method: "PUT", body: JSON.stringify(doc) }),
    deleteDoc: (col: CollectionKey, id) => api(`/data/${col}/${encodeURIComponent(id)}`, { method: "DELETE" }),
    resetData: () => api<TenantData>("/data/reset", { method: "POST" }),
    team: {
      add: (input) => api("/team", { method: "POST", body: JSON.stringify(input) }),
      remove: (id) => api(`/team/${encodeURIComponent(id)}`, { method: "DELETE" }),
    },
    console: {
      list: () => api("/console/kunden"),
      create: (input) => api("/console/kunden", { method: "POST", body: JSON.stringify(input) }),
      remove: (id) => api(`/console/kunden/${encodeURIComponent(id)}`, { method: "DELETE" }),
      reset: (id) => api(`/console/kunden/${encodeURIComponent(id)}/reset`, { method: "POST" }),
      setStatus: (id, status) => api(`/console/kunden/${encodeURIComponent(id)}/status`, { method: "POST", body: JSON.stringify({ status }) }),
      neuesPasswort: async (userId) => (await api<{ passwort: string }>(`/console/nutzer/${encodeURIComponent(userId)}/passwort`, { method: "POST" })).passwort,
    },
    async aiStream(req: AiStreamRequest, onText, signal): Promise<AiStreamResult> {
      const res = await fetch("/api/ai/messages", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
        signal,
      });
      if (!res.ok || !res.body) {
        let msg = `KI-Fehler ${res.status}`;
        try {
          msg = (await res.json()).fehler ?? msg;
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
