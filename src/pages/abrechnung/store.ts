// Seitenzustand der Abrechnung (überlebt Reiterwechsel): offene Dialoge und die laufende Stoppuhr.
import { create } from "zustand";
import { istConsole, type Sitzung } from "@/lib/backend";
import { useData } from "@/store/data";
import { useSession } from "@/store/session";

/**
 * Mandantentrennung: Die Stoppuhr gehört genau einer Kanzlei und einem Nutzer. Sie wird deshalb unter
 * Kanzlei- und Nutzer-ID gespeichert und beim Abmelden, beim Wechsel der Sitzung und bei jedem neuen
 * Datenstand (z. B. „Demo-Daten zurücksetzen“) verworfen – nur das erste Laden nach einem Neuladen der Seite
 * übernimmt sie (sie läuft über das Neuladen hinweg weiter).
 */
const TIMER_PREFIX = "aa:abrechnung:timer";

function timerKey(s: Sitzung | null | undefined): string | null {
  if (!s || istConsole(s)) return null;
  return `${TIMER_PREFIX}:${s.tenant.id}:${s.user.id}`;
}

const LEER = { start: null as number | null, akteId: "" };

function ladeTimer(key: string | null): { start: number | null; akteId: string } {
  if (!key) return LEER;
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null") as { start?: number; akteId?: string } | null;
    return { start: typeof v?.start === "number" ? v.start : null, akteId: v?.akteId ?? "" };
  } catch {
    return LEER;
  }
}

function entferne(key: string | null) {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* optional */
  }
}

// Früher kanzleiübergreifend gespeicherte Stoppuhr verwerfen – sie lässt sich keiner Kanzlei sicher zuordnen.
entferne(TIMER_PREFIX);

const gespeichert = ladeTimer(timerKey(useSession.getState().sitzung));

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
    const key = timerKey(useSession.getState().sitzung);
    if (key) {
      try {
        localStorage.setItem(key, JSON.stringify({ start, akteId }));
      } catch {
        /* optional */
      }
    }
    set({ timerStart: start, timerAkteId: akteId });
  },
  stoppeTimer: () => {
    const start = get().timerStart;
    entferne(timerKey(useSession.getState().sitzung));
    set({ timerStart: null });
    if (!start) return 0;
    return Math.max(1, Math.ceil((Date.now() - start) / 60000));
  },
}));

const ZURUECK = { timerStart: null, timerAkteId: "", rechnungId: null, sammelOffen: false };

// Abmelden bzw. Wechsel von Kanzlei oder Nutzer: alte Stoppuhr verwerfen, die der neuen Sitzung laden.
useSession.subscribe((s, vorher) => {
  const alt = timerKey(vorher.sitzung);
  const neu = timerKey(s.sitzung);
  if (alt === neu) return; // z. B. nur das Team wurde aktualisiert
  entferne(alt);
  const t = ladeTimer(neu);
  useAbrechnungUI.setState({ ...ZURUECK, timerStart: t.start, timerAkteId: t.akteId });
});

// Neuer Datenstand bei bestehender Sitzung (Zurücksetzen, Abmelden, neue Anmeldung): Stoppuhr gehört zum alten Stand.
useData.subscribe((s, vorher) => {
  if (s.epoch === vorher.epoch || vorher.epoch === 0) return;
  entferne(timerKey(useSession.getState().sitzung));
  useAbrechnungUI.setState(ZURUECK);
});
