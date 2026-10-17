import { create } from "zustand";

export type ThemeWahl = "system" | "light" | "dark";
/** Vorbelegte Akte für W/Z-Dialoge – aus der Akte der Seite oder aus der im Posteingang geöffneten Nachricht. */
export type AkteVorbelegung = { akteId?: string; herkunft?: "akte" | "nachricht" };
export type Dichte = "comfortable" | "compact";
/** Schriftgröße der Oberfläche (je Gerät): 100 %, 112 % oder 125 %. */
export type Schriftgroesse = 100 | 112 | 125;
export const SCHRIFTGROESSEN: readonly Schriftgroesse[] = [100, 112, 125];

/** Schriftgröße anwenden – die Oberfläche nutzt überwiegend px-Größen, deshalb skaliert `zoom` am Wurzelelement alles gleichmäßig. */
export function applySchrift(g: Schriftgroesse) {
  const root = document.documentElement;
  if (g === 100) root.removeAttribute("data-schrift");
  else root.setAttribute("data-schrift", String(g));
}

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

/** Vom einbettenden Viewer gesetztes data-theme (Ausgangswert bzw. seine spätere Änderung); null = keins. */
let viewerTheme: string | null | undefined;
/** Zuletzt von der App gesetztes data-theme; null = App steht auf „System“. */
let appTheme: string | null = null;
let beobachter: MutationObserver | null = null;

function beobachteViewer(root: HTMLElement) {
  if (beobachter || typeof MutationObserver === "undefined") return;
  // Änderungen, die nicht von der App stammen, gehören dem Viewer – auch wenn er sein Schema später umschaltet.
  beobachter = new MutationObserver(() => {
    const v = root.getAttribute("data-theme");
    if (appTheme === null || v !== appTheme) viewerTheme = v;
  });
  beobachter.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
}

/** Setzt das Farbschema. „System" stellt ein vom einbettenden Viewer gesetztes data-theme wieder her (statt es zu löschen). */
export function applyTheme(t: ThemeWahl) {
  const root = document.documentElement;
  if (viewerTheme === undefined) viewerTheme = root.getAttribute("data-theme");
  beobachteViewer(root);
  if (t === "system") {
    appTheme = null;
    const ziel = viewerTheme ?? null;
    if (root.getAttribute("data-theme") !== ziel) {
      if (ziel === null) root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", ziel);
    }
  } else {
    appTheme = t;
    root.setAttribute("data-theme", t);
  }
}

interface UIState {
  theme: ThemeWahl;
  dichte: Dichte;
  schrift: Schriftgroesse;
  /** Apex Island in der Kopfleiste anzeigen (ausblendbar direkt an der Island und unter Einstellungen → Darstellung). */
  island: boolean;
  setIsland: (an: boolean) => void;
  /** Apex Island zeigt Live-Meldungen des 38h-Motors (aus = ruhige, statische Anzeige ohne Aus- und Einklappen). */
  liveMeldungen: boolean;
  /** Assistent-Kugel unten rechts anzeigen (ausgeblendet bleibt der Assistent über Strg+K bzw. das Menü erreichbar). */
  kugel: boolean;
  /** Kugel an den Rand eingeklappt (kleiner Griff) – verdeckt dann keine Inhalte. */
  kugelEingeklappt: boolean;
  sidebarKompakt: boolean;
  assistentOffen: boolean;
  assistentPrompt: string | null;
  paletteOffen: boolean;
  hilfeThema: string | null;
  setTheme: (t: ThemeWahl) => void;
  setDichte: (d: Dichte) => void;
  setSchrift: (g: Schriftgroesse) => void;
  setLiveMeldungen: (an: boolean) => void;
  setKugel: (an: boolean) => void;
  setKugelEingeklappt: (an: boolean) => void;
  /** Kürzel-Übersicht (Taste „?“) */
  kuerzelOffen: boolean;
  setKuerzel: (o: boolean) => void;
  /** Schnelle Wiedervorlage (Taste „W“) – optional mit vorbelegter Akte; `herkunft` „nachricht“: Akte der geöffneten Nachricht */
  wiedervorlage: AkteVorbelegung | null;
  setWiedervorlage: (w: AkteVorbelegung | null) => void;
  /** Schnelle Zeiterfassung (Taste „Z“) – optional mit vorbelegter Akte */
  zeiterfassung: AkteVorbelegung | null;
  setZeiterfassung: (z: AkteVorbelegung | null) => void;
  /** Dialog „Passwort ändern“ (Einstellungen → Datenschutz, Strg+K) */
  passwortAendern: boolean;
  setPasswortAendern: (o: boolean) => void;
  /** Kürzel mit einzelnen Buchstaben (W, F, Z, ?, Posteingang J/K/U/E) – abschaltbar (WCAG 2.1.4); Alt+Taste wirkt immer. */
  einzeltastenKuerzel: boolean;
  setEinzeltastenKuerzel: (an: boolean) => void;
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
  schrift: ((g) => (SCHRIFTGROESSEN.includes(g) ? g : 100))(read<Schriftgroesse>("aa:schrift", 100)),
  island: read<boolean>("aa:island", true) !== false,
  liveMeldungen: read<boolean>("aa:live-meldungen", true),
  kugel: read<boolean>("aa:kugel", true),
  kugelEingeklappt: read<boolean>("aa:kugel-eingeklappt", false),
  kuerzelOffen: false,
  wiedervorlage: null,
  zeiterfassung: null,
  passwortAendern: false,
  einzeltastenKuerzel: read<boolean>("aa:einzeltasten", true) !== false,
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
  setSchrift: (g) => {
    write("aa:schrift", g);
    applySchrift(g);
    set({ schrift: g });
  },
  setIsland: (an) => {
    write("aa:island", an);
    set({ island: an });
  },
  setLiveMeldungen: (an) => {
    write("aa:live-meldungen", an);
    set({ liveMeldungen: an });
  },
  setKugel: (an) => {
    write("aa:kugel", an);
    set({ kugel: an });
  },
  setKugelEingeklappt: (an) => {
    write("aa:kugel-eingeklappt", an);
    set({ kugelEingeklappt: an });
  },
  setKuerzel: (o) => set({ kuerzelOffen: o }),
  setWiedervorlage: (w) => set({ wiedervorlage: w }),
  setZeiterfassung: (z) => set({ zeiterfassung: z }),
  setPasswortAendern: (o) => set({ passwortAendern: o }),
  setEinzeltastenKuerzel: (an) => {
    write("aa:einzeltasten", an);
    set({ einzeltastenKuerzel: an });
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
  /** Zeitgeber anhalten, solange die Maus über der Meldung liegt oder der Fokus darin ist. */
  pause: (id: number) => void;
  weiter: (id: number) => void;
}

/** Anzeigedauer: Meldungen mit Aktion (z. B. „Rückgängig“) mindestens 8 s, sonst mindestens 5 s. */
export const TOAST_DAUER_AKTION = 9000;
export const TOAST_DAUER = 5500;

let toastId = 0;
const zeitgeber = new Map<number, { timer?: ReturnType<typeof setTimeout>; rest: number; start: number }>();
export const useToasts = create<ToastState>((set, get) => {
  const starte = (id: number, ms: number) => {
    const z = { rest: ms, start: Date.now(), timer: setTimeout(() => get().dismiss(id), ms) };
    zeitgeber.set(id, z);
  };
  return {
    toasts: [],
    push: (t) => {
      const id = ++toastId;
      const weg = get().toasts.slice(0, -2);
      for (const x of weg) zeitgeber.delete(x.id);
      set({ toasts: [...get().toasts.slice(-2), { ...t, id }] });
      starte(id, t.aktion ? TOAST_DAUER_AKTION : TOAST_DAUER);
    },
    dismiss: (id) => {
      const z = zeitgeber.get(id);
      if (z?.timer) clearTimeout(z.timer);
      zeitgeber.delete(id);
      set({ toasts: get().toasts.filter((x) => x.id !== id) });
    },
    pause: (id) => {
      const z = zeitgeber.get(id);
      if (!z?.timer) return;
      clearTimeout(z.timer);
      z.timer = undefined;
      z.rest = Math.max(1500, z.rest - (Date.now() - z.start));
    },
    weiter: (id) => {
      const z = zeitgeber.get(id);
      if (!z || z.timer) return;
      z.start = Date.now();
      z.timer = setTimeout(() => get().dismiss(id), z.rest);
    },
  };
});

export function toast(titel: string, opts: Omit<Toast, "id" | "titel"> = {}) {
  useToasts.getState().push({ titel, ...opts });
}
