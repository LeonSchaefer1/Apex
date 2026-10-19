import { useEffect, useState, type ReactNode } from "react";
import { create } from "zustand";
import { cn } from "@/lib/cn";

/**
 * Bausteine der Startseite (DESIGN-SYSTEM.md 14): alles liegt auf --bg, ohne Scroll-Einblendungen. Container 1200 px,
 * Seitenrand 16/24/32 px. Abstand zwischen Abschnitten 128 px (Desktop), 96 px (Tablet), 64 px (Telefon) – jede Hälfte
 * steckt im Polster des Abschnitts.
 */
export function Abschnitt({ id, children, className, innerClassName, labelledBy, label }: { id?: string; children: ReactNode; className?: string; innerClassName?: string; labelledBy?: string; label?: string }) {
  return (
    <section id={id} aria-labelledby={labelledBy} aria-label={label} className={cn("px-4 py-8 sm:px-6 md:py-12 lg:px-8 lg:py-16", className)}>
      <div className={cn("mx-auto w-full max-w-[1200px]", innerClassName)}>{children}</div>
    </section>
  );
}

/** Abschnittskopf: Überzeile 13/500 Text 3, H2 36/44 (Telefon 28/36), zweite Zeile in Text 3, Einleitung 18/28 Text 2. */
export function Kopf({ id, eyebrow, titel, text, className, aktion }: { id?: string; eyebrow: ReactNode; titel: ReactNode; text?: ReactNode; className?: string; aktion?: ReactNode }) {
  return (
    <div className={cn("mb-12 flex flex-wrap items-end gap-x-10 gap-y-6 md:mb-16", className)}>
      <div className="min-w-0 max-w-[720px] flex-1 basis-[420px]">
        <p className="mb-3 text-[13px] font-medium leading-[18px] text-fg-3">{eyebrow}</p>
        <h2 id={id} className="text-[28px] font-semibold leading-9 tracking-[-0.025em] text-fg md:text-[36px] md:leading-[44px]">
          {titel}
        </h2>
        {text && <p className="mt-4 max-w-[62ch] text-[16px] leading-[26px] text-fg-2 md:text-[18px] md:leading-7">{text}</p>}
      </div>
      {aktion && <div className="shrink-0">{aktion}</div>}
    </div>
  );
}

/** Zweite Zeile einer Überschrift in Text 3 (statt Farbe oder Verlauf). */
export function Leise({ children }: { children: ReactNode }) {
  return <span className="text-fg-3">{children}</span>;
}

/** Scrollt im Seitencontainer zu einem Abschnitt (statt Hash-Navigation – funktioniert auch in eingebetteten Ansichten) und setzt den Fokus dorthin. */
export function scrollZu(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  // Tastatur und Screenreader: der Fokus springt mit – auf die Überschrift des Abschnitts (ohne den Bildlauf zu stören)
  const ziel = el.querySelector<HTMLElement>("h2") ?? el;
  if (!ziel.hasAttribute("tabindex")) ziel.setAttribute("tabindex", "-1");
  ziel.focus({ preventScroll: true });
}

export function useReduzierteBewegung() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setR(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
}

/** Zähler, der in festem Takt weiterläuft, solange `aktiv` – startet im Endzustand (nie leer im Ruhezustand). */
export function useTakt(schritte: number, ms: number, aktiv: boolean, startVerzoegerung = 1800) {
  const [s, setS] = useState(schritte - 1);
  const reduce = useReduzierteBewegung();
  useEffect(() => {
    if (!aktiv || reduce) return;
    let iv: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => {
      setS(0);
      iv = setInterval(() => setS((p) => (p + 1) % schritte), ms);
    }, startVerzoegerung);
    return () => {
      clearTimeout(t);
      if (iv) clearInterval(iv);
    };
  }, [aktiv, reduce, schritte, ms, startVerzoegerung]);
  return s;
}

/** Geöffnete Frage im FAQ – andere Abschnitte (z. B. das Umzug-Band) können eine Frage gezielt öffnen. */
export const useFaq = create<{ offen: number | null; setOffen: (i: number | null) => void }>((set) => ({
  offen: 0,
  setOffen: (offen) => set({ offen }),
}));
