import type { CollectionKey, ConsoleSession, SessionInfo, Tenant, TenantData, User, Rolle, Sachgebiet, Bundesland } from "@/core/types";

export interface BackendInfo {
  modus: "demo" | "server";
  schnellLogin: boolean;
  ki: { server: boolean; modell?: string };
  version: string;
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

export type Sitzung = SessionInfo | ConsoleSession;

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
  login(email: string, passwort: string): Promise<Sitzung>;
  me(): Promise<Sitzung | null>;
  logout(): Promise<void>;
  loadData(): Promise<TenantData>;
  putDoc(col: CollectionKey, doc: { id: string }): Promise<void>;
  deleteDoc(col: CollectionKey, id: string): Promise<void>;
  resetData(): Promise<TenantData>;
  team: {
    add(input: NeuerNutzer): Promise<{ user: User; passwort: string }>;
    remove(id: string): Promise<void>;
  };
  console: {
    list(): Promise<ConsoleKunde[]>;
    create(input: NeuerKunde): Promise<NeuerKundeErgebnis>;
    remove(tenantId: string): Promise<void>;
    reset(tenantId: string): Promise<void>;
    setStatus(tenantId: string, status: Tenant["status"]): Promise<void>;
    neuesPasswort(userId: string): Promise<string>;
  };
  aiStream?: (req: AiStreamRequest, onText: (delta: string) => void, signal?: AbortSignal) => Promise<AiStreamResult>;
}
