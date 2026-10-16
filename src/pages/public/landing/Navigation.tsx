import { useEffect, useState, type RefObject } from "react";
import { Link, useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Menu as MenuIcon, X } from "lucide-react";
import { Button } from "@/components/ui";
import { AppIcon, Wordmark } from "@/components/Logo";
import { useSession } from "@/store/session";
import { istConsole } from "@/lib/backend";
import { cn } from "@/lib/cn";
import { scrollZu } from "./basis";

export const ANKER = [
  { id: "funktionen", label: "Funktionen" },
  { id: "motor", label: "38h-Motor" },
  { id: "vergleich", label: "Vergleich" },
  { id: "lifetime", label: "Lifetime" },
  { id: "ki", label: "KI & Datenschutz" },
  { id: "faq", label: "Fragen" },
];

/** Schwebende Glas-Navigation mit gleitender Markierung des aktuellen Abschnitts. */
export function Navigation({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  const nav = useNavigate();
  const { sitzung } = useSession();
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [gescrollt, setGescrollt] = useState(false);
  const [offen, setOffen] = useState(false);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const onScroll = () => {
      setGescrollt(root.scrollTop > 12);
      if (root.scrollTop < 240) setAktiv(null);
    };
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    const io = new IntersectionObserver(
      (entries) => {
        const sichtbar = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (sichtbar[0]) setAktiv(sichtbar[0].target.id);
        else if (root.scrollTop < 300) setAktiv(null);
      },
      { root, rootMargin: "-40% 0px -55% 0px" },
    );
    ANKER.forEach((a) => {
      const el = document.getElementById(a.id);
      if (el) io.observe(el);
    });
    return () => {
      root.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, [scrollRef]);

  // Mobiles Menü mit Escape schließen
  useEffect(() => {
    if (!offen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOffen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [offen]);

  const ziel = sitzung ? (istConsole(sitzung) ? "/console" : "/cockpit") : "/login";
  // Das mobile Menü schwebt über dem Inhalt (absolut positioniert) und verschiebt den Seitenfluss nicht –
  // so stimmt die Zielposition auch dann, wenn es sich beim Scrollen schließt.
  const gehe = (id: string) => {
    setOffen(false);
    scrollZu(id);
  };

  return (
    <header className="sticky top-0 z-50 px-3 pt-[max(10px,env(safe-area-inset-top))] sm:px-5">
      <div
        className={cn(
          "mx-auto flex h-14 max-w-[1200px] items-center gap-2 rounded-[22px] pl-3 pr-2 transition-[background-color,box-shadow] duration-500 sm:pl-4",
          gescrollt ? "glass-strong" : "glass",
        )}
      >
        <button type="button" onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })} className="flex shrink-0 items-center gap-2.5 rounded-[12px]" aria-label="AnwaltApex – nach oben">
          <AppIcon size={32} />
          <Wordmark size={17} />
        </button>

        <nav aria-label="Abschnitte" className="mx-auto hidden items-center gap-0.5 lg:flex">
          {ANKER.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => gehe(a.id)}
              className={cn("relative z-0 h-9 rounded-full px-3.5 text-[13px] font-medium transition-colors", aktiv === a.id ? "text-fg" : "text-fg-3 hover:text-fg")}
            >
              {aktiv === a.id && (
                <motion.span
                  layoutId="landing-nav"
                  className="absolute inset-0 -z-10 rounded-full bg-[var(--surface)] shadow-[0_1px_0_0_var(--glass-rim-3)_inset,0_2px_10px_-2px_rgba(20,30,80,0.16),0_0_0_1px_var(--line)]"
                  transition={{ type: "spring", stiffness: 520, damping: 38 }}
                />
              )}
              <span className="relative">{a.label}</span>
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
          {sitzung ? (
            <Button variant="primary" size="sm" iconRight={<ArrowRight className="size-4" />} onClick={() => nav(ziel)}>
              {istConsole(sitzung) ? "Zur Console" : "Zur Kanzlei-App"}
            </Button>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm hidden sm:inline-flex">
                Anmelden
              </Link>
              <Button variant="primary" size="sm" onClick={() => nav("/login")}>
                Demo starten
              </Button>
            </>
          )}
          <button type="button" className="icon-btn lg:hidden" aria-label={offen ? "Menü schließen" : "Menü öffnen"} aria-expanded={offen} onClick={() => setOffen((o) => !o)}>
            {offen ? <X className="size-[18px]" /> : <MenuIcon className="size-[18px]" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {offen && (
          <motion.div
            key="menue-hintergrund"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOffen(false)}
            className="fixed inset-0 -z-10 lg:hidden"
          />
        )}
        {offen && (
          <motion.nav
            key="menue"
            aria-label="Abschnitte"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 480, damping: 34 }}
            style={{ transformOrigin: "top right" }}
            className="glass-strong absolute inset-x-3 top-full mx-auto mt-2 max-w-[1200px] rounded-[22px] p-2 sm:inset-x-5 lg:hidden"
          >
            <ul className="grid gap-0.5 sm:grid-cols-2">
              {ANKER.map((a, i) => (
                <motion.li key={a.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                  <button type="button" onClick={() => gehe(a.id)} className={cn("flex h-11 w-full items-center justify-between rounded-[14px] px-3.5 text-left text-[15px] font-medium hover:bg-ink-softer", aktiv === a.id && "bg-ink-softer text-ink")}>
                    {a.label}
                    <ArrowRight className="size-4 text-fg-4" />
                  </button>
                </motion.li>
              ))}
            </ul>
            {!sitzung && (
              <div className="mt-2 border-t border-[var(--line)] p-1.5 pt-3 sm:hidden">
                <Link to="/login" className="btn btn-secondary w-full">
                  Anmelden
                </Link>
              </div>
            )}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
