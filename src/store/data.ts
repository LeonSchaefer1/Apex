import { create } from "zustand";
import { getBackend } from "@/lib/backend";
import { nowLocal, uid } from "@/core/dates";
import type { Aktivitaet, CollectionKey, TenantData } from "@/core/types";

type Doc<K extends CollectionKey> = TenantData[K][number];

interface DataState {
  status: "leer" | "laedt" | "bereit" | "fehler";
  fehler?: string;
  data: TenantData;
  load: () => Promise<void>;
  reset: () => Promise<void>;
  clear: () => void;
  upsert: <K extends CollectionKey>(col: K, doc: Doc<K>) => void;
  patch: <K extends CollectionKey>(col: K, id: string, patch: Partial<Doc<K>>) => void;
  remove: <K extends CollectionKey>(col: K, id: string) => void;
  log: (a: Omit<Aktivitaet, "id" | "zeit"> & { zeit?: string }) => void;
}

const empty: TenantData = {
  kontakte: [], akten: [], fristen: [], dokumente: [], nachrichten: [], rechnungen: [],
  buchungen: [], transaktionen: [], zeiten: [], automationen: [], aktivitaeten: [], notizen: [], meta: [],
};

function persist(col: CollectionKey, doc: { id: string }) {
  getBackend().putDoc(col, structuredClone(doc)).catch((e) => console.warn("Speichern fehlgeschlagen", e));
}

export const useData = create<DataState>((set, get) => ({
  status: "leer",
  data: empty,
  load: async () => {
    set({ status: "laedt" });
    try {
      const data = await getBackend().loadData();
      set({ data: structuredClone(data), status: "bereit" });
    } catch (e) {
      set({ status: "fehler", fehler: e instanceof Error ? e.message : String(e) });
    }
  },
  reset: async () => {
    set({ status: "laedt" });
    const data = await getBackend().resetData();
    set({ data: structuredClone(data), status: "bereit" });
  },
  clear: () => set({ data: empty, status: "leer" }),
  upsert: (col, doc) => {
    const arr = get().data[col] as Doc<typeof col>[];
    const i = arr.findIndex((x) => x.id === doc.id);
    const next = i >= 0 ? arr.map((x, j) => (j === i ? doc : x)) : [doc, ...arr];
    set({ data: { ...get().data, [col]: next } });
    persist(col, doc);
  },
  patch: (col, id, patch) => {
    const arr = get().data[col] as Doc<typeof col>[];
    const cur = arr.find((x) => x.id === id);
    if (!cur) return;
    const doc = { ...cur, ...patch } as Doc<typeof col>;
    set({ data: { ...get().data, [col]: arr.map((x) => (x.id === id ? doc : x)) } });
    persist(col, doc);
  },
  remove: (col, id) => {
    const arr = get().data[col] as { id: string }[];
    set({ data: { ...get().data, [col]: arr.filter((x) => x.id !== id) } });
    getBackend().deleteDoc(col, id).catch((e) => console.warn("Löschen fehlgeschlagen", e));
  },
  log: (a) => {
    const doc: Aktivitaet = { id: uid("ak"), zeit: a.zeit ?? nowLocal(), ...a };
    get().upsert("aktivitaeten", doc);
  },
}));

/** Bequemer Selektor für eine Sammlung. */
export function useCol<K extends CollectionKey>(col: K): TenantData[K] {
  return useData((s) => s.data[col]);
}
