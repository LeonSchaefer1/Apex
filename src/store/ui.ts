import { create } from "zustand";

export type ThemeWahl = "system" | "light" | "dark";
export type Dichte = "comfortable" | "compact";

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* optional */
  }
}

let themeVonApp = false;

/** Setzt das Farbschema. „System" lässt ein vom einbettenden Viewer gesetztes data-theme unangetastet. */
export function applyTheme(t: ThemeWahl) {
  const root = document.documentElement;
  if (t === "system") {
    if (themeVonApp) root.removeAttribute("data-theme");
    themeVonApp = false;
  } else {
    root.setAttribute("data-theme", t);
    themeVonApp = true;
  }
}

interface UIState {
  theme: ThemeWahl;
  dichte: Dichte;
  sidebarKompakt: boolean;
  assistentOffen: boolean;
  assistentPrompt: string | null;
  paletteOffen: boolean;
  hilfeThema: string | null;
  setTheme: (t: ThemeWahl) => void;
  setDichte: (d: Dichte) => void;
  toggleSidebar: () => void;
  oeffneAssistent: (prompt?: string) => void;
  schliesseAssistent: () => void;
  konsumierePrompt: () => string | null;
  setPalette: (o: boolean) => void;
  zeigeHilfe: (thema: string | null) => void;
}

export const useUI = create<UIState>((set, get) => ({
  theme: read<ThemeWahl>("aa:theme", "system"),
  dichte: read<Dichte>("aa:dichte", "comfortable"),
  sidebarKompakt: read<boolean>("aa:sidebar", false),
  assistentOffen: false,
  assistentPrompt: null,
  paletteOffen: false,
  hilfeThema: null,
  setTheme: (t) => {
    write("aa:theme", t);
    applyTheme(t);
    set({ theme: t });
  },
  setDichte: (d) => {
    write("aa:dichte", d);
    document.documentElement.setAttribute("data-density", d);
    set({ dichte: d });
  },
  toggleSidebar: () => {
    const v = !get().sidebarKompakt;
    write("aa:sidebar", v);
    set({ sidebarKompakt: v });
  },
  oeffneAssistent: (prompt) => set({ assistentOffen: true, assistentPrompt: prompt ?? null }),
  schliesseAssistent: () => set({ assistentOffen: false }),
  konsumierePrompt: () => {
    const p = get().assistentPrompt;
    if (p) set({ assistentPrompt: null });
    return p;
  },
  setPalette: (o) => set({ paletteOffen: o }),
  zeigeHilfe: (thema) => set({ hilfeThema: thema }),
}));

// Toasts im Stil einer „Dynamic Island"
export interface Toast {
  id: number;
  titel: string;
  text?: string;
  ton?: "info" | "erfolg" | "warnung" | "fehler" | "ki";
  icon?: import("react").ReactNode;
  aktion?: { label: string; onClick: () => void };
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

let toastId = 0;
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = ++toastId;
    set({ toasts: [...get().toasts.slice(-2), { ...t, id }] });
    setTimeout(() => get().dismiss(id), t.aktion ? 7000 : 4200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));

export function toast(titel: string, opts: Omit<Toast, "id" | "titel"> = {}) {
  useToasts.getState().push({ titel, ...opts });
}
