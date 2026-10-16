import { useEffect } from "react";

/** Lässt den Lichtreflex auf allen `.glow`-Elementen dem Zeiger folgen (eine einzige, passive Ereignisbehandlung). */
export function usePointerGlow() {
  useEffect(() => {
    let raf = 0;
    let last: HTMLElement | null = null;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = (e.target as HTMLElement | null)?.closest?.(".glow") as HTMLElement | null;
        if (last && last !== el) last.style.removeProperty("--glow-o");
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
        last = el;
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
}
