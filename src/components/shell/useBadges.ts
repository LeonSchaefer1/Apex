import { useMemo } from "react";
import { useData } from "@/store/data";
import { today } from "@/core/dates";
import { fristenLage } from "@/core/fristenLage";

export interface Badge {
  anzahl: number;
  ton?: "ink" | "seal" | "ai";
  /** Bedeutung des Zählers für Screenreader und Tooltip: „6 neu“, „1 heute fällig“, „9 Bankumsätze offen“. */
  bedeutung: string;
}

/** Zähler für die Navigation: neue Nachrichten, fällige Fristen, offene Bankumsätze. */
export function useBadges(): Record<string, Badge | undefined> {
  const nachrichten = useData((s) => s.data.nachrichten);
  const fristen = useData((s) => s.data.fristen);
  const transaktionen = useData((s) => s.data.transaktionen);
  return useMemo(() => {
    const neu = nachrichten.filter((n) => n.status === "neu").length;
    // Einheitliche Zählweise wie Cockpit, Fristenkalender und Assistent (fristenLage): fällige Fristen = Notfristen und Fristen,
    // heute fällig + überfällig. Wiedervorlagen, Vorfristen und Termine zählen nicht mit.
    const lage = fristenLage(fristen, today());
    const faellig = lage.faellig.length;
    const ueber = lage.ueberfaellig.length;
    const bank = transaktionen.filter((t) => t.status === "offen").length;
    const fristText = ueber === 0 ? `${faellig} heute fällig` : ueber === faellig ? `${faellig} überfällig` : `${faellig} fällig, davon ${ueber} überfällig`;
    return {
      "/posteingang": neu ? { anzahl: neu, ton: "ink", bedeutung: `${neu} neu` } : undefined,
      "/fristen": faellig ? { anzahl: faellig, ton: "seal", bedeutung: fristText } : undefined,
      "/abrechnung": bank ? { anzahl: bank, ton: "ink", bedeutung: `${bank} ${bank === 1 ? "Bankumsatz" : "Bankumsätze"} offen` } : undefined,
    };
  }, [nachrichten, fristen, transaktionen]);
}
