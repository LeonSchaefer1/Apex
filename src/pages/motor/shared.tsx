// Gemeinsame Hilfen des 38h-Motors (nur innerhalb von /automatisierung verwendet).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CalendarClock, FileText, Inbox, ReceiptEuro, Users, type LucideIcon } from "lucide-react";
import type { Automation } from "@/core/types";

export const ZIEL_STUNDEN = 38;
export const ARBEITSWOCHEN = 46;

export const KATEGORIE_ICON: Record<Automation["kategorie"], LucideIcon> = {
  Posteingang: Inbox,
  Fristen: CalendarClock,
  Mandanten: Users,
  Dokumente: FileText,
  Finanzen: ReceiptEuro,
};

export const KATEGORIEN: Automation["kategorie"][] = ["Posteingang", "Fristen", "Mandanten", "Dokumente", "Finanzen"];

/** Rendert regelmäßig neu, damit relative Zeitangaben („vor 2 Min.") aktuell bleiben. */
export function useNow(intervalMs = 20000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Misst die Breite eines Elements (für maßstabsgetreue SVG-Diagramme ohne verzerrte Schrift). */
export function useBreite<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [breite, setBreite] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setBreite(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setBreite(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, breite] as const;
}

/** Stunden mit einer Nachkommastelle: 37,6 */
export function fmtStd(min: number): string {
  return (min / 60).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Lokale Keyframes für die wandernden Punkte in den Ablauf-Diagrammen (eine Variante je Anzahl Verbindungen). */
export const FLOW_CSS = [1, 2, 3, 4, 5, 6, 7]
  .map((k) => {
    const ende = 100 / k;
    const p = (x: number) => `${x.toFixed(2)}%`;
    return `@keyframes aa-flow-${k}{0%{transform:translateX(0);opacity:0}${p(ende * 0.18)}{opacity:1}${p(ende * 0.82)}{opacity:1}${p(ende)}{transform:translateX(100%);opacity:0}100%{transform:translateX(100%);opacity:0}}`;
  })
  .join("");

export const FLOW_SEGMENT_S = 0.9;
