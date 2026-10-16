import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";

/** Sanftes Erscheinen beim Scrollen – Inhalte sind im Ruhezustand immer sichtbar (nur Versatz/Skalierung). */
export function Reveal({ children, className, delay = 0, y = 26, as = "div" }: { children: ReactNode; className?: string; delay?: number; y?: number; as?: "div" | "li" | "article" }) {
  const Comp = as === "li" ? motion.li : as === "article" ? motion.article : motion.div;
  return (
    <Comp
      className={className}
      initial={{ y, scale: 0.985 }}
      whileInView={{ y: 0, scale: 1 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ type: "spring", stiffness: 260, damping: 30, delay }}
    >
      {children}
    </Comp>
  );
}

export function Abschnitt({ id, children, className, innerClassName }: { id?: string; children: ReactNode; className?: string; innerClassName?: string }) {
  return (
    <section id={id} className={cn("relative scroll-mt-20 px-4 py-16 sm:px-6 md:py-24", className)}>
      <div className={cn("mx-auto w-full max-w-[1200px]", innerClassName)}>{children}</div>
    </section>
  );
}

export function Kopf({ eyebrow, titel, text, className, aktion }: { eyebrow: ReactNode; titel: ReactNode; text?: ReactNode; className?: string; aktion?: ReactNode }) {
  return (
    <Reveal className={cn("mb-10 flex flex-wrap items-end gap-x-10 gap-y-5 md:mb-14", className)}>
      <div className="min-w-0 max-w-[760px] flex-1 basis-[420px]">
        <div className="eyebrow mb-3 !text-ink">{eyebrow}</div>
        <h2 className="text-[clamp(30px,4.2vw,50px)] font-bold leading-[1.04] tracking-[-0.042em]">{titel}</h2>
        {text && <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-fg-2 md:text-[17px]">{text}</p>}
      </div>
      {aktion && <div className="shrink-0">{aktion}</div>}
    </Reveal>
  );
}

/** Scrollt im Seitencontainer zu einem Abschnitt (statt Hash-Navigation – funktioniert auch in eingebetteten Ansichten). */
export function scrollZu(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
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
