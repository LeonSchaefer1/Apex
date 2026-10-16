// Simulierter Live-Betrieb des 38h-Motors: Während die App geöffnet ist, laufen Automationen sichtbar im Hintergrund.
import { useEffect } from "react";
import { create } from "zustand";
import { useData } from "@/store/data";
import { useSession } from "@/store/session";
import { istConsole } from "@/lib/backend";
import { nowLocal } from "@/core/dates";
import { ersparnisMinuten, laufFaellig, zeitplan } from "@/core/automationen";
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

/** Ein simulierter Lauf: Text und Zahl der tatsächlich bearbeiteten Vorgänge (gespart wird nur je Vorgang). */
const LAEUFE: Record<string, (az: string) => { text: string; vorgaenge: number }> = {
  "zuordnung": (az) => ({ text: `Nachricht der Akte ${az} zugeordnet (Vorschlag)`, vorgaenge: 1 }),
  "vorfristen": (az) => ({ text: `Vorfrist gesetzt – Akte ${az}`, vorgaenge: 1 }),
  "mandanten-update": (az) => ({ text: `Mandanten-Update zur Freigabe vorgelegt – Akte ${az}`, vorgaenge: 1 }),
  "zeiterfassung": () => {
    const n = 2 + Math.floor(Math.random() * 4);
    return { text: `${n} Zeiteinträge vorgeschlagen`, vorgaenge: n };
  },
  // Stündlicher Abruf: Minuten nur für zugeordnete Umsätze – ein Abruf ohne neue Zahlung spart nichts
  "bankabgleich": () => {
    const n = Math.random() < 0.45 ? 0 : 1 + Math.floor(Math.random() * 2);
    return { text: n ? `Bankabgleich: ${n} ${n === 1 ? "Zahlung" : "Zahlungen"} zugeordnet` : "Kontoumsätze abgerufen – keine neue Zahlung", vorgaenge: n };
  },
  "posteingang-fristen": (az) => ({ text: `Posteingang geprüft – Akte ${az}, keine neue Frist`, vorgaenge: 0 }),
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
  const { text, vorgaenge } = LAEUFE[a.key](akte.aktenzeichen);
  const minuten = ersparnisMinuten(a.key, vorgaenge);
  const system = { system: true };
  st.patch("automationen", a.id, { laeufe: a.laeufe + 1, letzterLauf: nowLocal() }, system);
  st.log({ akteur: "automation", automationKey: a.key, akteId: OHNE_AKTE.includes(a.key) ? undefined : akte.id, text, minutenGespart: minuten || undefined }, system);
  useMotorStore.getState().zeige(text, minuten);
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
          const autos = st.data.automationen.filter((a) => a.aktiv && LAEUFE[a.key]);
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
