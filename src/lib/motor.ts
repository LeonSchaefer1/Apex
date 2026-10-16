// Simulierter Live-Betrieb des 38h-Motors: Während die App geöffnet ist, laufen Automationen sichtbar im Hintergrund.
import { useEffect } from "react";
import { create } from "zustand";
import { useData } from "@/store/data";
import { useSession } from "@/store/session";
import { istConsole } from "@/lib/backend";
import { nowLocal } from "@/core/dates";
import { laufFaellig, zeitplan } from "@/core/automationen";
import type { Akte, Automation } from "@/core/types";

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
  "mandanten-update": (az) => `Mandanten-Update versendet – Akte ${az}`,
  "zeiterfassung": () => `3 Zeiteinträge vorgeschlagen`,
  "bankabgleich": () => `Kontoumsätze abgerufen und geprüft`,
  "posteingang-fristen": (az) => `Posteingang geprüft – Akte ${az}`,
};

/** Läufe ohne Aktenbezug (Kanzlei-weit). */
const OHNE_AKTE = ["bankabgleich", "zeiterfassung"];

function zufall<T>(liste: T[]): T {
  return liste[Math.floor(Math.random() * liste.length)];
}

/**
 * Ein simulierter Lauf: Zähler und „letzter Lauf“ der Automation, Eintrag im Verlauf, Anzeige in der Apex Island.
 * Simulierte Läufe sind Systemschreibvorgänge: Sie markieren die Demodaten nicht als geändert,
 * damit sie weiterhin täglich relativ zu „heute“ neu erzeugt werden.
 */
function lauf(a: Automation, akte: Akte) {
  const st = useData.getState();
  const text = TEXTE[a.key](akte.aktenzeichen);
  const system = { system: true };
  st.patch("automationen", a.id, { laeufe: a.laeufe + 1, letzterLauf: nowLocal() }, system);
  st.log({ akteur: "automation", automationKey: a.key, akteId: OHNE_AKTE.includes(a.key) ? undefined : akte.id, text, minutenGespart: a.minutenProLauf }, system);
  useMotorStore.getState().zeige(text, a.minutenProLauf);
}

export function useMotor(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      timer = setTimeout(() => {
        if (document.visibilityState === "visible") {
          const st = useData.getState();
          const sitzung = useSession.getState().sitzung;
          const land = sitzung && !istConsole(sitzung) ? sitzung.tenant.bundesland : undefined;
          const autos = st.data.automationen.filter((a) => a.aktiv && TEXTE[a.key]);
          const akten = st.data.akten.filter((a) => a.status === "offen");
          if (autos.length && akten.length) {
            // Zeitgesteuerte Automationen (Mandanten-Update freitags 14:00 Uhr, Zeiterfassung werktags 18:00 Uhr) laufen nur zu
            // ihren Auslösezeiten: Ist ein solcher Lauf fällig, wird genau dieser eine ausgeführt.
            const jetzt = nowLocal();
            const faellig = autos.find((a) => zeitplan(a.key) && laufFaellig(a.key, a.letzterLauf, jetzt, land));
            if (faellig) {
              const portal = akten.filter((a) => a.mandantenportal);
              lauf(faellig, zufall(faellig.key === "mandanten-update" && portal.length ? portal : akten));
            } else {
              // sonst ein ereignisgesteuerter Lauf (neue Nachricht, Frist eingetragen, Kontoumsätze …)
              const ereignis = autos.filter((a) => !zeitplan(a.key));
              if (ereignis.length) lauf(zufall(ereignis), zufall(akten));
            }
          }
        }
        tick();
      }, 38000 + Math.random() * 30000);
    };
    tick();
    return () => clearTimeout(timer);
  }, [enabled]);
}
