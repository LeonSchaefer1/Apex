// Ermittelt, welche KI zur Verfügung steht: Claude über den Kanzlei-Server, Claude in der Artefakt-Vorschau oder die Demo-KI (offline).
import { create } from "zustand";
import type { BackendInfo } from "@/lib/backend";

export type KiQuelle = "server" | "artefakt" | "demo";

export interface SampleFn {
  (input: string | { role: "user" | "assistant"; content: string }[], options?: Record<string, unknown>): Promise<{ text: string; truncated: boolean }>;
  json?: <T = unknown>(input: string | { role: "user" | "assistant"; content: string }[], options?: Record<string, unknown>) => Promise<T>;
  limits?: () => Promise<{ maxPromptBytes: number; tools?: { maxCount: number } }>;
}

interface AiStatusState {
  quelle: KiQuelle;
  verfuegbar: KiQuelle[];
  modell?: string;
  label: string;
  sample: SampleFn | null;
  bevorzugeDemo: boolean;
  init: (info: BackendInfo) => Promise<void>;
  setBevorzugeDemo: (v: boolean) => void;
}

/** Einheitlicher Name der Offline-KI in der ganzen App. */
export const DEMO_KI_NAME = "Demo-KI (offline)";

function labelFuer(q: KiQuelle) {
  return q === "demo" ? DEMO_KI_NAME : "KI live · Claude";
}

function readPref(): boolean {
  try {
    return localStorage.getItem("aa:ki-demo") === "1";
  } catch {
    return false;
  }
}

export const useAiStatus = create<AiStatusState>((set, get) => ({
  quelle: "demo",
  verfuegbar: ["demo"],
  label: labelFuer("demo"),
  sample: null,
  bevorzugeDemo: readPref(),
  init: async (info) => {
    const verfuegbar: KiQuelle[] = ["demo"];
    let sample: SampleFn | null = null;
    if (info.ki.server) verfuegbar.unshift("server");
    else {
      const w = window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } };
      if (w.claude?.use) {
        try {
          sample = (await Promise.race([w.claude.use("sample"), new Promise((r) => setTimeout(() => r(null), 12000))])) as SampleFn | null;
        } catch {
          sample = null;
        }
        if (sample) verfuegbar.unshift("artefakt");
      }
    }
    const quelle = get().bevorzugeDemo ? "demo" : verfuegbar[0];
    set({ verfuegbar, sample, quelle, modell: info.ki.modell, label: labelFuer(quelle) });
  },
  setBevorzugeDemo: (v) => {
    try {
      localStorage.setItem("aa:ki-demo", v ? "1" : "0");
    } catch {
      /* optional */
    }
    const quelle = v ? "demo" : get().verfuegbar[0];
    set({ bevorzugeDemo: v, quelle, label: labelFuer(quelle) });
  },
}));

/** Nach einem dauerhaften Fehler (z. B. Zustimmung verweigert) auf Demo-KI zurückfallen. */
export function fallbackAufDemo() {
  useAiStatus.setState({ quelle: "demo", label: labelFuer("demo"), verfuegbar: ["demo"] });
}
