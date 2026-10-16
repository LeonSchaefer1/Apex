// Umzugsprotokoll: jeder Lauf mit Datum, Datei, Zahlen und den Rückgängig-Daten – gespeichert beim Datenbestand der Kanzlei
// (Sammlung `umzugLaeufe`, Demo: Browser-Datenbank, Server: SQLite), damit „Rückgängig machen“ auch nach dem Neuladen und an
// jedem Arbeitsplatz möglich bleibt. Dazu der Zwischenstand des Assistenten (sessionStorage).
import type { ISODateTime, UmzugLauf } from "@/core/types";
import { useData } from "@/store/data";
import type { Ergebnis } from "./uebernahme";
import type { CsvErgebnis, DateiInfo } from "./csv";
import type { DateiDublettenAktion, DublettenAktion, QuellSystem, Umfang, ZielFeld } from "./zuordnung";

export type { UmzugLauf };

/** Protokoll der Kanzlei, neueste Läufe zuerst. */
export function sortiereLaeufe(laeufe: UmzugLauf[]): UmzugLauf[] {
  return [...laeufe].sort((a, b) => b.datum.localeCompare(a.datum));
}

/** Früherer Speicherort (Iteration 1: localStorage je Kanzlei) – wird einmalig in den Datenbestand übernommen. */
const altKey = (tenantId: string) => `apex.umzug.laeufe.${tenantId}`;

export function uebernehmeAlteLaeufe(tenantId: string): void {
  try {
    const roh = localStorage.getItem(altKey(tenantId));
    if (!roh) return;
    const alt = JSON.parse(roh) as UmzugLauf[];
    const st = useData.getState();
    const vorhanden = new Set(st.data.umzugLaeufe.map((l) => l.id));
    if (Array.isArray(alt)) for (const l of alt) if (l?.id && !vorhanden.has(l.id)) st.upsert("umzugLaeufe", l);
    localStorage.removeItem(altKey(tenantId));
  } catch {
    /* Browserspeicher gesperrt – dann gibt es nichts zu übernehmen */
  }
}

export function laufAusErgebnis(e: Ergebnis, p: { datum: ISODateTime; system: string; datei: string; userId: string }): UmzugLauf {
  return {
    id: e.laufId,
    ...p,
    zahlen: {
      aktenNeu: e.aktenNeu,
      aktenAktualisiert: e.aktenAktualisiert,
      archiviert: e.archiviert,
      kontakteNeu: e.kontakteNeu,
      fristen: e.fristen,
      zusammengefuehrt: e.zusammengefuehrt,
      uebersprungen: e.uebersprungen,
    },
    undo: e.undo,
  };
}

export function speichereLauf(lauf: UmzugLauf): void {
  useData.getState().upsert("umzugLaeufe", lauf);
}

export function markiereRueckgaengig(id: string, p: { am: ISODateTime; von: string }): void {
  // Rückgängig-Daten werden nach dem Rückgängigmachen nicht mehr gebraucht – nur das Protokoll bleibt
  useData.getState().patch("umzugLaeufe", id, { rueckgaengig: p, undo: { erstellt: [], vorher: [] } });
}

/** Zwischenstand des Assistenten – übersteht ein Neuladen (sessionStorage). */
export interface AssistentStand {
  schritt: number;
  system: QuellSystem | null;
  csv: CsvErgebnis | null;
  datei: DateiInfo | null;
  auto: (ZielFeld | null)[];
  zuordnung: (ZielFeld | null)[];
  modus: DublettenAktion;
  ausnahmen: Record<number, DublettenAktion>;
  dateiAktionen: Record<number, DateiDublettenAktion>;
  umfang: Umfang;
}

const standKey = (tenantId: string) => `apex.umzug.assistent.${tenantId}`;

export function ladeStand(tenantId: string): AssistentStand | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(standKey(tenantId)) ?? "null") as AssistentStand | null;
    return v && typeof v.schritt === "number" ? v : null;
  } catch {
    return null;
  }
}

export function speichereStand(tenantId: string, s: AssistentStand | null) {
  try {
    if (!s) sessionStorage.removeItem(standKey(tenantId));
    else sessionStorage.setItem(standKey(tenantId), JSON.stringify(s));
  } catch {
    /* Speicher voll oder gesperrt – der Assistent beginnt dann nach dem Neuladen neu */
  }
}
