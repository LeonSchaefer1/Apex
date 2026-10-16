// Simulierter Live-Betrieb des 38h-Motors: Während die App geöffnet ist, laufen Automationen sichtbar im Hintergrund.
import { useEffect } from "react";
import { create } from "zustand";
import { useData } from "@/store/data";
import { nowLocal } from "@/core/dates";

interface MotorState {
  aktuell: { text: string; minuten: number } | null;
  zeige: (text: string, minuten: number) => void;
}

export const useMotorStore = create<MotorState>((set) => ({
  aktuell: null,
  zeige: (text, minuten) => {
    set({ aktuell: { text, minuten } });
    setTimeout(() => set({ aktuell: null }), 5200);
  },
}));

const TEXTE: Record<string, (az: string) => string> = {
  "zuordnung": (az) => `Nachricht der Akte ${az} zugeordnet`,
  "vorfristen": (az) => `Vorfrist gesetzt – Akte ${az}`,
  "mandanten-update": (az) => `Mandanten-Update vorbereitet – Akte ${az}`,
  "zeiterfassung": () => `3 Zeiteinträge vorgeschlagen`,
  "bankabgleich": () => `Kontoumsätze abgerufen und geprüft`,
  "posteingang-fristen": (az) => `Posteingang geprüft – Akte ${az}`,
};

export function useMotor(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      timer = setTimeout(() => {
        if (document.visibilityState === "visible") {
          const st = useData.getState();
          const autos = st.data.automationen.filter((a) => a.aktiv && TEXTE[a.key]);
          const akten = st.data.akten.filter((a) => a.status === "offen");
          if (autos.length && akten.length) {
            const a = autos[Math.floor(Math.random() * autos.length)];
            const akte = akten[Math.floor(Math.random() * akten.length)];
            const text = TEXTE[a.key](akte.aktenzeichen);
            st.patch("automationen", a.id, { laeufe: a.laeufe + 1, letzterLauf: nowLocal() });
            st.log({ akteur: "automation", automationKey: a.key, akteId: ["bankabgleich", "zeiterfassung"].includes(a.key) ? undefined : akte.id, text, minutenGespart: a.minutenProLauf });
            useMotorStore.getState().zeige(text, a.minutenProLauf);
          }
        }
        tick();
      }, 38000 + Math.random() * 30000);
    };
    tick();
    return () => clearTimeout(timer);
  }, [enabled]);
}
