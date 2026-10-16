import { create } from "zustand";
import { CODE_SITZUNG_GEWECHSELT, getBackend, type SchreibOptionen } from "@/lib/backend";
import { nowLocal, uid } from "@/core/dates";
import { COLLECTIONS, type Aktivitaet, type CollectionKey, type TenantData } from "@/core/types";
import { toast } from "@/store/ui";

type Doc<K extends CollectionKey> = TenantData[K][number];

interface DataState {
  status: "leer" | "laedt" | "bereit" | "fehler";
  fehler?: string;
  data: TenantData;
  /** Zählt jeden vollständigen Datenwechsel (Laden, Zurücksetzen, Abmelden) – Caches außerhalb des Stores (z. B. KI-Ergebnisse) verwerfen sich bei einer neuen Epoche. */
  epoch: number;
  load: () => Promise<void>;
  reset: () => Promise<void>;
  clear: () => void;
  /** `opts.system`: Hintergrundlauf (z. B. simulierter 38h-Motor) – zählt nicht als Änderung durch die Kanzlei. */
  upsert: <K extends CollectionKey>(col: K, doc: Doc<K>, opts?: SchreibOptionen) => void;
  patch: <K extends CollectionKey>(col: K, id: string, patch: Partial<Doc<K>>, opts?: SchreibOptionen) => void;
  remove: <K extends CollectionKey>(col: K, id: string) => void;
  log: (a: Omit<Aktivitaet, "id" | "zeit"> & { zeit?: string }, opts?: SchreibOptionen) => void;
  /** Nur anzeigen, nicht speichern – z. B. einen Protokolleintrag, den das Backend bereits selbst festgehalten hat. */
  einfuegenLokal: <K extends CollectionKey>(col: K, doc: Doc<K>) => void;
}

const empty: TenantData = {
  kontakte: [], akten: [], fristen: [], dokumente: [], nachrichten: [], rechnungen: [],
  buchungen: [], transaktionen: [], zeiten: [], automationen: [], aktivitaeten: [], notizen: [], umzugLaeufe: [], meta: [],
};

/** Fehlende Sammlungen (älterer Datenbestand, z. B. vor dem Umzugsprotokoll) als leere Listen ergänzen. */
function vollstaendig(data: TenantData): TenantData {
  const out = { ...data };
  for (const col of COLLECTIONS) if (!Array.isArray(out[col])) (out[col] as unknown[]) = [];
  return out;
}

/** Sitzungsfehler (401/409) behandelt die Sitzungsverwaltung (Abgleich, Hinweis, Anmeldung) – hier kein zweiter Hinweis. */
function istSitzungsfehler(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  return status === 401 || (status === 409 && (e as { code?: unknown }).code === CODE_SITZUNG_GEWECHSELT);
}

// Fehlgeschlagene Schreibvorgänge eines kurzen Zeitraums (z. B. Änderung + Protokolleintrag) ergeben einen gemeinsamen Hinweis.
let buendel: { wiederholen: (() => void)[]; text: string } | null = null;

function meldeSpeicherfehler(e: unknown, wiederholen: () => void) {
  if (!buendel) {
    buendel = { wiederholen: [], text: e instanceof Error && e.message ? e.message : "Der Server hat die Änderung nicht angenommen." };
    setTimeout(() => {
      const b = buendel;
      buendel = null;
      if (!b) return;
      toast("Änderung nicht gespeichert", {
        text: `${b.text} Die Anzeige zeigt wieder den gespeicherten Stand.`,
        ton: "fehler",
        aktion: { label: "Erneut versuchen", onClick: () => b.wiederholen.forEach((f) => f()) },
      });
    }, 150);
  }
  buendel.wiederholen.push(wiederholen);
}

/**
 * Speichert im Backend. Schlägt das fehl, wird der lokale Stand zurückgerollt (`zurueck`) und – außer bei Hintergrundläufen –
 * ein Hinweis mit „Erneut versuchen“ angezeigt. Die Oberfläche meldet so nie einen Erfolg, der nicht gespeichert wurde.
 */
function speichere(lauf: () => Promise<void>, zurueck: () => void, wiederholen: () => void, system?: boolean) {
  const fehlschlag = (e: unknown) => {
    zurueck();
    if (istSitzungsfehler(e)) return;
    if (system) {
      console.warn("Hintergrund-Speichern fehlgeschlagen", e);
      return;
    }
    console.warn("Speichern fehlgeschlagen", e);
    meldeSpeicherfehler(e, wiederholen);
  };
  try {
    lauf().catch(fehlschlag);
  } catch (e) {
    fehlschlag(e);
  }
}

export const useData = create<DataState>((set, get) => {
  /** Stellt `vorher` wieder her, solange der fehlgeschlagene Stand noch angezeigt wird (keine spätere Änderung, kein Datenwechsel). */
  const rollback = (col: CollectionKey, geschrieben: { id: string }, vorher: { id: string } | undefined, epoch: number) => {
    const st = get();
    if (st.epoch !== epoch) return;
    const arr = st.data[col] as { id: string }[];
    const i = arr.findIndex((x) => x.id === geschrieben.id);
    if (i < 0 || arr[i] !== geschrieben) return;
    const next = vorher ? arr.map((x, j) => (j === i ? vorher : x)) : arr.filter((_, j) => j !== i);
    set({ data: { ...st.data, [col]: next } });
  };

  const schreibe = (col: CollectionKey, doc: { id: string }, vorher: { id: string } | undefined, opts?: SchreibOptionen) => {
    const epoch = get().epoch;
    speichere(
      () => getBackend().putDoc(col, structuredClone(doc), opts),
      () => rollback(col, doc, vorher, epoch),
      () => {
        if (get().epoch === epoch) get().upsert(col as never, doc as never, opts);
      },
      opts?.system,
    );
  };

  return {
    status: "leer",
    data: empty,
    epoch: 0,
    load: async () => {
      set({ status: "laedt", fehler: undefined });
      try {
        const data = await getBackend().loadData();
        set({ data: vollstaendig(structuredClone(data)), status: "bereit", epoch: get().epoch + 1 });
      } catch (e) {
        set({ status: "fehler", fehler: e instanceof Error ? e.message : String(e) });
      }
    },
    reset: async () => {
      const vorher = get().status;
      set({ status: "laedt" });
      try {
        const data = await getBackend().resetData();
        set({ data: vollstaendig(structuredClone(data)), status: "bereit", epoch: get().epoch + 1 });
      } catch (e) {
        // Zurücksetzen abgelehnt (z. B. fehlende Rechte): bisheriger Stand bleibt sichtbar
        if (get().status === "laedt") set({ status: vorher });
        throw e;
      }
    },
    clear: () => set({ data: empty, status: "leer", fehler: undefined, epoch: get().epoch + 1 }),
    upsert: (col, doc, opts) => {
      const arr = get().data[col] as Doc<typeof col>[];
      const i = arr.findIndex((x) => x.id === doc.id);
      const vorher = i >= 0 ? arr[i] : undefined;
      const next = i >= 0 ? arr.map((x, j) => (j === i ? doc : x)) : [doc, ...arr];
      set({ data: { ...get().data, [col]: next } });
      schreibe(col, doc, vorher, opts);
    },
    patch: (col, id, patch, opts) => {
      const arr = get().data[col] as Doc<typeof col>[];
      const cur = arr.find((x) => x.id === id);
      if (!cur) return;
      const doc = { ...cur, ...patch } as Doc<typeof col>;
      set({ data: { ...get().data, [col]: arr.map((x) => (x.id === id ? doc : x)) } });
      schreibe(col, doc, cur, opts);
    },
    remove: (col, id) => {
      const arr = get().data[col] as { id: string }[];
      const i = arr.findIndex((x) => x.id === id);
      const entfernt = i >= 0 ? arr[i] : undefined;
      set({ data: { ...get().data, [col]: arr.filter((x) => x.id !== id) } });
      const epoch = get().epoch;
      speichere(
        () => getBackend().deleteDoc(col, id),
        () => {
          // Gelöschtes Dokument an alter Stelle wieder einsetzen, sofern es nicht inzwischen neu angelegt wurde
          const st = get();
          if (!entfernt || st.epoch !== epoch) return;
          const jetzt = st.data[col] as { id: string }[];
          if (jetzt.some((x) => x.id === id)) return;
          const next = [...jetzt];
          next.splice(Math.min(i, next.length), 0, entfernt);
          set({ data: { ...st.data, [col]: next } });
        },
        () => {
          if (get().epoch === epoch) get().remove(col, id);
        },
      );
    },
    log: (a, opts) => {
      const doc: Aktivitaet = { id: uid("ak"), zeit: a.zeit ?? nowLocal(), ...a };
      get().upsert("aktivitaeten", doc, opts);
    },
    einfuegenLokal: (col, doc) => {
      const arr = get().data[col] as Doc<typeof col>[];
      if (arr.some((x) => x.id === doc.id)) return;
      set({ data: { ...get().data, [col]: [doc, ...arr] } });
    },
  };
});

/** Bequemer Selektor für eine Sammlung. */
export function useCol<K extends CollectionKey>(col: K): TenantData[K] {
  return useData((s) => s.data[col]);
}
