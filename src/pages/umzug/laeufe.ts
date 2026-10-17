// Umzugsprotokoll: jeder Lauf mit Datum, Datei, Zahlen und den Rückgängig-Daten – gespeichert beim Datenbestand der Kanzlei
// (Sammlung `umzugLaeufe`, Demo: Browser-Datenbank, Server: SQLite), damit „Rückgängig machen“ auch nach dem Neuladen und an
// jedem Arbeitsplatz möglich bleibt. Dazu der Zwischenstand des Assistenten (sessionStorage).
import type { ISODateTime, UmzugLauf } from "@/core/types";
import { useData } from "@/store/data";
import { fristenAusErgebnis, type Ergebnis, type LaufZahlen } from "./uebernahme";
import type { CsvErgebnis, DateiInfo } from "./csv";
import type { DateiDublettenAktion, DublettenAktion, OhneDatumAktion, QuellSystem, Umfang, ZielFeld } from "./zuordnung";

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
  // Aufteilung der Fristen mitspeichern – das Protokoll zählt nach „Rückgängig“ gleich (I5-T11-01)
  const zahlen: LaufZahlen = {
    aktenNeu: e.aktenNeu,
    aktenAktualisiert: e.aktenAktualisiert,
    archiviert: e.archiviert,
    kontakteNeu: e.kontakteNeu,
    fristen: e.fristen,
    zusammengefuehrt: e.zusammengefuehrt,
    uebersprungen: e.uebersprungen,
    fristenArt: fristenAusErgebnis(e),
  };
  return { id: e.laufId, ...p, zahlen, undo: e.undo };
}

export function speichereLauf(lauf: UmzugLauf): void {
  useData.getState().upsert("umzugLaeufe", lauf);
}

export function markiereRueckgaengig(id: string, p: { am: ISODateTime; von: string }, fristenArt?: LaufZahlen["fristenArt"]): void {
  // Rückgängig-Daten werden nach dem Rückgängigmachen nicht mehr gebraucht – nur das Protokoll bleibt. Ältere Läufe ohne
  // gespeicherte Aufteilung erhalten sie hier (vor dem Löschen gezählt), damit der Eintrag gleich zählt (I5-T11-01).
  const lauf = useData.getState().data.umzugLaeufe.find((l) => l.id === id);
  const zahlen = lauf && fristenArt && !lauf.zahlen.fristenArt ? ({ ...lauf.zahlen, fristenArt } satisfies LaufZahlen) : undefined;
  useData.getState().patch("umzugLaeufe", id, { rueckgaengig: p, undo: { erstellt: [], vorher: [] }, ...(zahlen ? { zahlen } : {}) });
}

/**
 * Zwischenstand des Assistenten – übersteht ein Neuladen und auch ein geschlossenes Fenster: sessionStorage, dazu eine Kopie
 * im localStorage dieses Browsers (höchstens 24 Stunden, gelöscht nach der Übernahme oder mit „Neu beginnen“).
 */
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
  /** Entscheidungen für abgeschlossene Akten ohne Abschlussdatum (Umfang „letzte 6 Jahre“) */
  ohneDatum?: Record<number, OhneDatumAktion>;
  /** Zeitpunkt der letzten Sicherung (für „Zwischenstand von … wiederhergestellt“) */
  gespeichert?: ISODateTime;
}

const STAND_MAX_MS = 24 * 60 * 60 * 1000;

const standKey = (tenantId: string) => `apex.umzug.assistent.${tenantId}`;

function liesStand(speicher: () => Storage, tenantId: string): AssistentStand | null {
  try {
    const v = JSON.parse(speicher().getItem(standKey(tenantId)) ?? "null") as AssistentStand | null;
    if (!v || typeof v.schritt !== "number") return null;
    if (v.gespeichert && Date.now() - new Date(v.gespeichert).getTime() > STAND_MAX_MS) return null;
    return v;
  } catch {
    return null;
  }
}

export function ladeStand(tenantId: string): AssistentStand | null {
  return liesStand(() => sessionStorage, tenantId) ?? liesStand(() => localStorage, tenantId);
}

/**
 * Laufende Übernahme: Kennung im Browserspeicher (localStorage – übersteht auch ein geschlossenes Fenster). Ist sie beim
 * nächsten Öffnen noch da, wurde der Lauf unterbrochen: Er wird vollständig zurückgenommen und als „abgebrochen – nichts
 * übernommen“ protokolliert. Gespeichert werden nur Kennung, System und Dateiname – keine Mandantendaten.
 */
export interface LaufMarke {
  laufId: string;
  datum: ISODateTime;
  system: string;
  datei: string;
  userId: string;
  /** letzte Sicherung des Zwischenstands – solange frisch, läuft der Lauf wohl noch (z. B. in einem anderen Fenster) */
  puls?: ISODateTime;
}
const markeKey = (tenantId: string) => `apex.umzug.laufend.${tenantId}`;
export function setzeLaufMarke(tenantId: string, m: LaufMarke | null): void {
  try {
    if (m) localStorage.setItem(markeKey(tenantId), JSON.stringify(m));
    else localStorage.removeItem(markeKey(tenantId));
  } catch {
    /* ohne Speicher keine Erkennung abgebrochener Läufe – das Protokoll zeigt dann den Zwischenstand */
  }
}
export function ladeLaufMarke(tenantId: string): LaufMarke | null {
  try {
    const m = JSON.parse(localStorage.getItem(markeKey(tenantId)) ?? "null") as LaufMarke | null;
    return m && typeof m.laufId === "string" ? m : null;
  } catch {
    return null;
  }
}

/** Früheres Kennzeichen abgebrochener Läufe (Sonderwert in `rueckgaengig.von`) – nur noch zum Lesen älterer Protokolle. */
export const ABBRUCH = "abbruch";
/** Abgebrochener Lauf (zurückgenommen, nichts übernommen) – eigenes Feld `abgebrochen`, ältere Läufe am Sonderwert erkennbar. */
export const istAbgebrochen = (l: UmzugLauf) => !!l.abgebrochen || l.rueckgaengig?.von === ABBRUCH;

/** Abgebrochenen Lauf im Protokoll festhalten – mit Zwischenstand oder, falls noch keiner gesichert war, als leerer Lauf. */
export function protokolliereAbbruch(m: Pick<LaufMarke, "laufId" | "datum" | "system" | "datei" | "userId">, am: ISODateTime): void {
  // Zurückgenommen hat die App selbst beim nächsten Öffnen – „von“ ist die Person, deren Lauf unterbrochen wurde
  const abbruch = { am, von: m.userId };
  if (useData.getState().data.umzugLaeufe.some((l) => l.id === m.laufId)) {
    markiereRueckgaengig(m.laufId, abbruch);
    useData.getState().patch("umzugLaeufe", m.laufId, { abgebrochen: true });
  } else
    speichereLauf({
      id: m.laufId, datum: m.datum, system: m.system, datei: m.datei, userId: m.userId,
      zahlen: { aktenNeu: 0, aktenAktualisiert: 0, archiviert: 0, kontakteNeu: 0, fristen: 0, zusammengefuehrt: 0, uebersprungen: 0 },
      undo: { erstellt: [], vorher: [] },
      rueckgaengig: abbruch,
      abgebrochen: true,
    });
}

export function speichereStand(tenantId: string, s: AssistentStand | null, jetzt?: ISODateTime) {
  for (const speicher of [() => sessionStorage, () => localStorage]) {
    try {
      if (!s) speicher().removeItem(standKey(tenantId));
      else speicher().setItem(standKey(tenantId), JSON.stringify({ ...s, gespeichert: jetzt ?? s.gespeichert }));
    } catch {
      /* Speicher voll oder gesperrt – der Assistent beginnt dann nach dem Neuladen neu */
    }
  }
}
