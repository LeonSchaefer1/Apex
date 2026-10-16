import { createDemoBackend } from "./demo";
import { createServerBackend, serverErreichbar } from "./server";
import type { Backend, BackendInfo } from "./types";

export * from "./types";
export { sicheresPasswort, zufallsKennung, zufallsZahl } from "./zufall";
export { beiSitzungsproblem, meldeSitzungsproblem, type SitzungsProblem } from "./ereignisse";


let backend: Backend | null = null;
let info: BackendInfo | null = null;

/** Wählt den Betriebsmodus: Server (falls erreichbar) oder Browser-Demo. */
export async function initBackend(): Promise<{ backend: Backend; info: BackendInfo }> {
  if (backend && info) return { backend, info };
  const mode = (import.meta.env.VITE_APP_MODE as string | undefined) ?? "auto";
  if (mode !== "demo") {
    const srv = await serverErreichbar(mode === "server" ? 8000 : 1500);
    if (srv) {
      backend = createServerBackend();
      info = srv;
      return { backend, info };
    }
  }
  backend = createDemoBackend();
  info = await backend.info();
  return { backend, info };
}

export function getBackend(): Backend {
  if (!backend) throw new Error("Backend nicht initialisiert");
  return backend;
}

export function getInfo(): BackendInfo | null {
  return info;
}
