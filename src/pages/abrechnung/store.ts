// Seitenzustand der Abrechnung (überlebt Reiterwechsel): offene Dialoge und die laufende Stoppuhr.
import { create } from "zustand";

const TIMER_KEY = "aa:abrechnung:timer";

function ladeTimer(): { start: number | null; akteId: string } {
  try {
    const v = JSON.parse(localStorage.getItem(TIMER_KEY) ?? "null") as { start?: number; akteId?: string } | null;
    return { start: typeof v?.start === "number" ? v.start : null, akteId: v?.akteId ?? "" };
  } catch {
    return { start: null, akteId: "" };
  }
}
const gespeichert = ladeTimer();

interface AbrechnungUI {
  rechnungId: string | null;
  sammelOffen: boolean;
  timerStart: number | null;
  timerAkteId: string;
  oeffneRechnung: (id: string | null) => void;
  setSammel: (o: boolean) => void;
  starteTimer: (akteId: string) => void;
  stoppeTimer: () => number; // Minuten
}

export const useAbrechnungUI = create<AbrechnungUI>((set, get) => ({
  rechnungId: null,
  sammelOffen: false,
  timerStart: gespeichert.start,
  timerAkteId: gespeichert.akteId,
  oeffneRechnung: (id) => set({ rechnungId: id }),
  setSammel: (o) => set({ sammelOffen: o }),
  starteTimer: (akteId) => {
    const start = Date.now();
    try {
      localStorage.setItem(TIMER_KEY, JSON.stringify({ start, akteId }));
    } catch {
      /* optional */
    }
    set({ timerStart: start, timerAkteId: akteId });
  },
  stoppeTimer: () => {
    const start = get().timerStart;
    try {
      localStorage.removeItem(TIMER_KEY);
    } catch {
      /* optional */
    }
    set({ timerStart: null });
    if (!start) return 0;
    return Math.max(1, Math.ceil((Date.now() - start) / 60000));
  },
}));
