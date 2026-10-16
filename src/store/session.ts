import { create } from "zustand";
import { beiSitzungsproblem, getBackend, getInfo, gleicheSitzung, istConsole, type KanzleiSitzung, type Sitzung, type SitzungsProblem } from "@/lib/backend";
import { useAiStatus } from "@/ai/status";
import { useData } from "@/store/data";
import { toast } from "@/store/ui";

interface SessionState {
  status: "unbekannt" | "abgemeldet" | "angemeldet";
  sitzung: Sitzung | null;
  setSitzung: (s: Sitzung | null) => void;
  login: (email: string, passwort: string) => Promise<Sitzung>;
  /** Erste Anmeldung mit Startpasswort: eigenes Passwort festlegen und anmelden. */
  passwortErsetzen: (email: string, startPasswort: string, neuesPasswort: string) => Promise<Sitzung>;
  logout: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  status: "unbekannt",
  sitzung: null,
  setSitzung: (s) => set({ sitzung: s, status: s ? "angemeldet" : "abgemeldet" }),
  login: async (email, passwort) => {
    const s = await getBackend().login(email, passwort);
    set({ sitzung: s, status: "angemeldet" });
    sendeSignal();
    return s;
  },
  passwortErsetzen: async (email, startPasswort, neuesPasswort) => {
    const s = await getBackend().passwortErsetzen(email, startPasswort, neuesPasswort);
    set({ sitzung: s, status: "angemeldet" });
    sendeSignal();
    return s;
  },
  logout: async () => {
    try {
      await getBackend().logout();
    } catch (e) {
      // Abmelden darf nie hängen bleiben – die Sitzung im Browser wird in jedem Fall beendet.
      console.warn("Abmelden am Server fehlgeschlagen", e);
    }
    set({ sitzung: null, status: "abgemeldet" });
    sendeSignal();
  },
}));

/** Kanzlei-Sitzung (wirft, wenn Console-Sitzung) – nur innerhalb der Kanzlei-App verwenden. */
export function useKanzlei(): KanzleiSitzung {
  const s = useSession((st) => st.sitzung);
  if (!s || istConsole(s)) throw new Error("Keine Kanzlei-Sitzung");
  return s;
}

// ───────────── Bindung der Anfragen an die Sitzung, KI-Freigabe je Kanzlei ─────────────

let kiLiveZuletzt: boolean | null = null;

useSession.subscribe((s, vorher) => {
  if (s.sitzung === vorher.sitzung) return;
  try {
    getBackend().bindeSitzung?.(s.sitzung);
  } catch {
    /* Backend noch nicht bereit */
  }
  // Server-Betrieb: Live-KI kann für einzelne Kanzleien abgeschaltet sein (z. B. Präsentationskanzleien auf öffentlichen Servern).
  const info = getInfo();
  if (info?.modus !== "server") return;
  const k = s.sitzung && !istConsole(s.sitzung) ? s.sitzung : null;
  const live = info.ki.server && k?.betrieb?.kiLive !== false;
  if (live === kiLiveZuletzt) return;
  kiLiveZuletzt = live;
  void useAiStatus.getState().init({ ...info, ki: { ...info.ki, server: live } });
});

// ───────────── Abgleich zwischen Tabs (S0) ─────────────
// Die Anmeldung gilt für alle Tabs (Cookie bzw. Browser-Speicher), die geladenen Daten nur für einen. Meldet sich ein Tab ab
// oder bei einer anderen Kanzlei an, gleichen die übrigen Tabs ab: veraltete Daten werden verworfen, nie weitergeschrieben.

const KANAL = "aa-sitzung";
const SIGNAL_KEY = "aa:sitzung-signal";
let kanal: BroadcastChannel | null = null;

function sendeSignal() {
  const nachricht = { t: Date.now(), r: Math.random() };
  try {
    kanal?.postMessage(nachricht);
  } catch {
    /* optional */
  }
  try {
    localStorage.setItem(SIGNAL_KEY, JSON.stringify(nachricht));
  } catch {
    /* Speicher gesperrt – dann gleicht der Tab beim nächsten Fokus ab */
  }
}

let abgleichLaeuft = false;
let letzterAbgleich = 0;

type Anlass = SitzungsProblem | "signal" | "fokus";

/** Fragt die Sitzung beim Backend ab und übernimmt sie, falls sie sich geändert hat (anderer Tab, abgelaufen, entfernt). */
export async function gleicheSitzungAb(anlass: Anlass): Promise<void> {
  const st = useSession.getState();
  if (st.status === "unbekannt" || abgleichLaeuft) return;
  abgleichLaeuft = true;
  letzterAbgleich = Date.now();
  try {
    let neu: Sitzung | null;
    try {
      neu = await getBackend().me();
    } catch {
      return; // Netz- oder Serverfehler: nichts verwerfen
    }
    const alt = useSession.getState().sitzung;
    if (gleicheSitzung(alt, neu)) {
      if (anlass === "gewechselt" || anlass === "abgelaufen") {
        toast("Änderung nicht gespeichert", { text: "Bitte versuchen Sie es erneut.", ton: "fehler" });
      }
      return;
    }
    const nichtGespeichert = anlass === "gewechselt" || anlass === "abgelaufen" ? " Ihre letzte Änderung wurde nicht gespeichert." : "";
    // Erst die Daten der alten Sitzung verwerfen, dann die neue Sitzung übernehmen – im selben Takt, damit nichts dazwischen schreibt.
    useData.getState().clear();
    useSession.getState().setSitzung(neu);
    if (!alt) return; // z. B. Anmeldeseite: in einem anderen Tab wurde angemeldet – einfach übernehmen
    if (!neu) {
      toast(anlass === "signal" ? "In einem anderen Tab abgemeldet" : "Sitzung beendet", {
        text: anlass === "signal" ? "Bitte melden Sie sich erneut an." : `Ihre Anmeldung ist abgelaufen oder wurde beendet. Bitte melden Sie sich erneut an.${nichtGespeichert}`,
        ton: "warnung",
      });
    } else {
      const wer = istConsole(neu) ? "Apex Console" : `${neu.user.name} · ${neu.tenant.kurzname}`;
      toast("In einem anderen Tab neu angemeldet", { text: `Jetzt angemeldet: ${wer}. Die Ansicht wurde neu geladen.${nichtGespeichert}`, ton: "warnung" });
    }
  } finally {
    abgleichLaeuft = false;
  }
}

beiSitzungsproblem((art) => void gleicheSitzungAb(art));

if (typeof window !== "undefined") {
  try {
    kanal = new BroadcastChannel(KANAL);
    kanal.onmessage = () => void gleicheSitzungAb("signal");
  } catch {
    kanal = null; // z. B. Sandbox ohne eigenen Ursprung
  }
  window.addEventListener("storage", (e) => {
    // Signal der Sitzungsverwaltung bzw. Sitzungswechsel im Demo-Backend (gleicher Browser-Speicher)
    if (e.key === SIGNAL_KEY || e.key === "aa:session") void gleicheSitzungAb("signal");
  });
  const beimZurueckkehren = () => {
    if (document.visibilityState !== "visible" || Date.now() - letzterAbgleich < 3000) return;
    void gleicheSitzungAb("fokus");
  };
  document.addEventListener("visibilitychange", beimZurueckkehren);
  window.addEventListener("focus", beimZurueckkehren);
}
