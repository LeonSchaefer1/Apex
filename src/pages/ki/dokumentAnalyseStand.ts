// Dokument-Analyse übersteht den Seitenwechsel (I5-T19-02): letztes Ergebnis je Akte – Akte, Dokument bzw. Text, Analyse,
// eingegebene Fälligkeit der Ausschlussfrist (das Fristende rechnet der Fristenrechner daraus neu). Gehalten wird nur in der
// Sitzung – Speicher des Moduls (wie der KI-Zwischenspeicher im Posteingang), gespiegelt in den sessionStorage dieses Tabs,
// damit auch ein Neuladen nichts verliert –, nicht in den Kanzleidaten. Bis „Vorschlag verwerfen“, „Neues Dokument“ oder
// „Übernehmen“. Je Kanzlei getrennt (Mandantentrennung); Abmelden bzw. Kanzleiwechsel leert den Speicher.
import { create } from "zustand";
import type { DokAnalyse } from "@/ai/dokumentAnalyse";
import { istConsole } from "@/lib/backend";
import { useSession } from "@/store/session";

export interface DokAnalyseSitzung {
  text: string;
  betreff: string;
  von: string;
  beispielAktiv: number | null;
  autoFelder: boolean;
  /** Dokument aus der E-Akte, dessen Text analysiert wurde */
  ausAkte: { akteId: string; dokId: string } | null;
  analyse: DokAnalyse;
  zielAkte: string;
  /** Ausschlussfrist: eingegebene Fälligkeit und Anspruch */
  ausschluss: { faellig: string; anspruch: string };
}

interface Speicher {
  /** Kanzlei der Sitzung – Ergebnisse gelten nur für sie */
  schluessel: string;
  je: Record<string, DokAnalyseSitzung>;
  /** zuletzt bearbeitete Akte (Schlüssel in `je`) */
  letzte?: string;
}

export const useDokAnalyseSpeicher = create<Speicher>(() => ({ schluessel: "", je: {} }));

/** Schlüssel einer Sitzung: Akte des Dokuments, sonst erkannte bzw. gewählte Akte. */
export function sitzungsSchluessel(s: Pick<DokAnalyseSitzung, "ausAkte" | "analyse" | "zielAkte">): string {
  return s.ausAkte?.akteId ?? s.analyse.akteId ?? (s.zielAkte || "ohne-akte");
}

function kanzleiSchluessel(): string {
  const s = useSession.getState().sitzung;
  return s && !istConsole(s) ? s.tenant.id : "-";
}
const SPEICHER_KEY = (k: string) => `apex.dokanalyse.${k}`;

function ausSitzungsspeicher(k: string): Speicher | undefined {
  try {
    const v = JSON.parse(sessionStorage.getItem(SPEICHER_KEY(k)) ?? "null") as Speicher | null;
    return v && v.schluessel === k && typeof v.je === "object" ? v : undefined;
  } catch {
    return undefined;
  }
}

function sichern(st: Speicher) {
  try {
    if (Object.keys(st.je).length) sessionStorage.setItem(SPEICHER_KEY(st.schluessel), JSON.stringify(st));
    else sessionStorage.removeItem(SPEICHER_KEY(st.schluessel));
  } catch {
    /* ohne sessionStorage: nur bis zum Neuladen gehalten */
  }
}

function aktuell(): Speicher {
  const k = kanzleiSchluessel();
  const st = useDokAnalyseSpeicher.getState();
  if (st.schluessel === k) return st;
  const neu: Speicher = ausSitzungsspeicher(k) ?? { schluessel: k, je: {}, letzte: undefined };
  useDokAnalyseSpeicher.setState(neu);
  return neu;
}

// Abmelden bzw. Kanzleiwechsel: gemerkte Ergebnisse der bisherigen Kanzlei verwerfen (auch im sessionStorage)
useSession.subscribe((s, vorher) => {
  if (s.sitzung === vorher.sitzung) return;
  const alt = useDokAnalyseSpeicher.getState().schluessel;
  const neu = s.sitzung && !istConsole(s.sitzung) ? s.sitzung.tenant.id : "-";
  if (alt && alt !== neu) {
    try {
      sessionStorage.removeItem(SPEICHER_KEY(alt));
    } catch {
      /* nichts zu tun */
    }
    useDokAnalyseSpeicher.setState({ schluessel: "", je: {}, letzte: undefined });
  }
});

/** Stand merken (überschreibt den bisherigen Stand derselben Akte). */
export function merkeDokAnalyse(s: DokAnalyseSitzung): void {
  const st = aktuell();
  const key = sitzungsSchluessel(s);
  useDokAnalyseSpeicher.setState({ je: { ...st.je, [key]: s }, letzte: key });
  sichern(useDokAnalyseSpeicher.getState());
}

/** Stand vergessen – nach „Vorschlag verwerfen“, „Neues Dokument“ oder „Übernehmen“. */
export function vergissDokAnalyse(key: string): void {
  const st = aktuell();
  if (!st.je[key]) return;
  const je = { ...st.je };
  delete je[key];
  useDokAnalyseSpeicher.setState({ je, letzte: st.letzte === key ? Object.keys(je).at(-1) : st.letzte });
  sichern(useDokAnalyseSpeicher.getState());
}

/**
 * Gemerkten Stand beim Öffnen wählen: zum Dokument aus dem Deep-Link, sonst zur Akte aus dem Deep-Link, sonst den zuletzt
 * bearbeiteten. Ein Deep-Link auf ein anderes Dokument liefert nichts – dann wird neu analysiert.
 */
export function ladeDokAnalyse(p: { dokId?: string; akteId?: string }): DokAnalyseSitzung | undefined {
  const st = aktuell();
  const alle = Object.values(st.je);
  if (p.dokId) return alle.find((s) => s.ausAkte?.dokId === p.dokId);
  if (p.akteId) return st.je[p.akteId];
  return st.letzte ? st.je[st.letzte] : undefined;
}
