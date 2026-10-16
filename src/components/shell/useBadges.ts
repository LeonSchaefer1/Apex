import { useMemo } from "react";
import { useData } from "@/store/data";
import { today } from "@/core/dates";
import { fristenLage } from "@/core/fristenLage";

export interface Badge {
  anzahl: number;
  ton?: "ink" | "seal" | "ai";
}

/** Zähler für die Navigation: neue Nachrichten, fällige Fristen, offene Bankumsätze. */
export function useBadges(): Record<string, Badge | undefined> {
  const nachrichten = useData((s) => s.data.nachrichten);
  const fristen = useData((s) => s.data.fristen);
  const transaktionen = useData((s) => s.data.transaktionen);
  return useMemo(() => {
    const neu = nachrichten.filter((n) => n.status === "neu").length;
    // Einheitliche Zählweise wie Cockpit, Fristenkalender und Assistent: heute fällig + überfällig, ohne Vorfristen und Termine.
    const faellig = fristenLage(fristen, today()).faellig.length;
    const bank = transaktionen.filter((t) => t.status === "offen").length;
    return {
      "/posteingang": neu ? { anzahl: neu, ton: "ink" } : undefined,
      "/fristen": faellig ? { anzahl: faellig, ton: "seal" } : undefined,
      "/abrechnung": bank ? { anzahl: bank, ton: "ink" } : undefined,
    };
  }, [nachrichten, fristen, transaktionen]);
}
