import { useEffect, useRef, useState, type RefObject } from "react";
import { Link, useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Menu as MenuIcon, X } from "lucide-react";
import { Button } from "@/components/ui";
import { Wortmarke } from "@/components/Logo";
import { useSession } from "@/store/session";
import { istConsole } from "@/lib/backend";
import { BEWEGUNG } from "@/lib/bewegung";
import { cn } from "@/lib/cn";
import { scrollZu } from "./basis";

export const ANKER = [
  { id: "funktionen", label: "Funktionen" },
  { id: "motor", label: "38h-Motor" },
  { id: "vergleich", label: "Vergleich" },
  { id: "lifetime", label: "Lifetime" },
  { id: "ki", label: "KI & Datenschutz" },
  { id: "faq", label: "Fragen" },
  { id: "kontakt", label: "Kontakt" },
];

/**
 * Kopf der Startseite (DESIGN-SYSTEM.md 14.1): 64 px, deckend auf --bg, Linie unten erst nach dem ersten Scrollen. Links die
 * Wortmarke, Mitte die Anker (aktueller Abschnitt: Text 1 und 2-px-Strich unten), rechts „Anmelden“ und „Demo starten“.
 * Telefon: Menü-Knopf 44 px, Menü klappt als Fläche unter dem Kopf auf.
 */
export function Navigation({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  const nav = useNavigate();
  const { sitzung } = useSession();
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [gescrollt, setGescrollt] = useState(false);
  const [offen, setOffen] = useState(false);
  const knopf = useRef<HTMLButtonElement>(null);
  const menue = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const onScroll = () => {
      setGescrollt(root.scrollTop > 8);
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

  // Mobiles Menü: Fokus auf den ersten Eintrag, Escape schließt und gibt den Fokus an den Menü-Knopf zurück
  useEffect(() => {
    if (!offen) return;
    menue.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOffen(false);
      knopf.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [offen]);

  const ziel = sitzung ? (istConsole(sitzung) ? "/console" : "/cockpit") : "/login";
  // Das mobile Menü liegt über dem Inhalt (absolut positioniert) und verschiebt den Seitenfluss nicht –
  // so stimmt die Zielposition auch dann, wenn es sich beim Scrollen schließt.
  const gehe = (id: string) => {
    setOffen(false);
    scrollZu(id);
  };

  return (
    <header className={cn("sticky top-0 z-50 border-b bg-[var(--bg)] pt-[env(safe-area-inset-top)] transition-colors duration-100", gescrollt || offen ? "border-[var(--line)]" : "border-transparent")}>
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-4 sm:px-6 lg:box-content lg:px-8">
        <button type="button" onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })} className="flex min-h-11 shrink-0 items-center rounded-md px-1 -ml-1 sm:min-h-8" aria-label="Apex – nach oben">
          <Wortmarke size={20} />
        </button>

        <nav aria-label="Abschnitte" className="mx-auto hidden h-full items-stretch lg:flex">
          {ANKER.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => gehe(a.id)}
              aria-current={aktiv === a.id ? "location" : undefined}
              className={cn("relative flex items-center px-3 text-[14px] font-medium transition-colors duration-100 focus-visible:outline-offset-[-2px]", aktiv === a.id ? "text-fg" : "text-fg-3 hover:text-fg")}
            >
              {a.label}
              {aktiv === a.id && <motion.span layoutId="landing-anker" aria-hidden className="absolute inset-x-3 -bottom-px h-[2px] bg-[var(--ink)]" transition={BEWEGUNG.standard} />}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          {sitzung ? (
            <Button variant="primary" iconRight={<ArrowRight className="size-4" />} onClick={() => nav(ziel)}>
              {istConsole(sitzung) ? "Zur Console" : "Zur Kanzlei-App"}
            </Button>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost hidden sm:inline-flex">
                Anmelden
              </Link>
              <Button variant="primary" onClick={() => nav("/login")}>
                Demo starten
              </Button>
            </>
          )}
          <button ref={knopf} type="button" className="icon-btn -mr-2 lg:hidden" aria-label={offen ? "Menü schließen" : "Menü öffnen"} aria-expanded={offen} aria-controls="landing-menue" onClick={() => setOffen((o) => !o)}>
            {offen ? <X className="!size-5" /> : <MenuIcon className="!size-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {offen && (
          <motion.div key="abdunkler" aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={BEWEGUNG.standard} onClick={() => setOffen(false)} className="fixed inset-0 top-16 -z-10 bg-[var(--scrim)] lg:hidden" />
        )}
        {offen && (
          <motion.nav
            ref={menue}
            key="menue"
            id="landing-menue"
            aria-label="Abschnitte"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={BEWEGUNG.standard}
            className="absolute inset-x-0 top-full border-b border-[var(--line)] bg-[var(--bg)] px-4 pb-4 sm:px-6 lg:hidden"
          >
            <ul className="mx-auto grid max-w-[1200px] divide-y divide-[var(--line)] sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
              {ANKER.map((a) => (
                <li key={a.id} className="sm:border-b sm:border-[var(--line)]">
                  <button type="button" onClick={() => gehe(a.id)} aria-current={aktiv === a.id ? "location" : undefined} className={cn("flex h-12 w-full items-center justify-between text-left text-[16px] font-medium focus-visible:outline-offset-[-2px]", aktiv === a.id ? "text-fg" : "text-fg-2")}>
                    {a.label}
                    <ArrowRight className="size-4 text-fg-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            {!sitzung && (
              <Link to="/login" className="btn btn-secondary mt-4 w-full sm:hidden">
                Anmelden
              </Link>
            )}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
