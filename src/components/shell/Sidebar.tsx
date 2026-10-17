import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { motion } from "motion/react";
import { CalendarClock, ChevronDown, PanelLeftClose, PanelLeftOpen, Infinity as InfinityIcon } from "lucide-react";
import { beschreibungFuer, navFor, navFuer } from "@/app/nav";
import { useUI } from "@/store/ui";
import { useKanzlei } from "@/store/session";
import { cn } from "@/lib/cn";
import { AppIcon, Wordmark } from "@/components/Logo";
import { useMedia } from "@/lib/useMedia";
import { fmtDate } from "@/core/dates";
import { useBadges } from "./useBadges";

const GRUPPEN = ["Arbeiten", "Intelligenz", "Kanzlei", "Service"] as const;

/** Breite der beschrifteten schmalen Leiste (Tablet, eingeklappt) bzw. der vollen Leiste. */
const BREITE_SCHMAL = 88;
const BREITE_VOLL = 252;

/**
 * Dichtestufen der Leiste, gemessen an der verfügbaren Höhe (auch bei 112 % und 125 % Schrift, die per `zoom` skaliert –
 * Höhen-Media-Queries sehen dabei die unvergrößerte Fensterhöhe). Stufe für Stufe, bis alle Einträge ohne Scrollen passen:
 * volle Leiste: 0 normal · 1 Lizenz-Kachel einzeilig · 2 ohne Lizenz-Kachel · 3 dichtere Einträge · 4 Trennlinien statt Gruppentitel · 5 32 px hohe Einträge
 * schmale Leiste: 0 normal · 1 dichtere Einträge (≥ 44 px) – reicht auch das nicht, scrollt die Leiste mit sichtbarem Hinweis.
 */
const MAX_STUFE = { voll: 5, schmal: 1 } as const;

/** Verlauf am Rand der Navigation, solange dort weitere Einträge verborgen sind (niedrige Fensterhöhe). */
function useScrollVerlauf() {
  const ref = useRef<HTMLElement>(null);
  const [rand, setRand] = useState({ oben: false, unten: false });
  const pruefe = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const oben = el.scrollTop > 2;
    const unten = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setRand((r) => (r.oben === oben && r.unten === unten ? r : { oben, unten }));
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    pruefe();
    el.addEventListener("scroll", pruefe, { passive: true });
    const ro = new ResizeObserver(pruefe);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", pruefe);
      ro.disconnect();
    };
  }, [pruefe]);
  const maske = rand.oben || rand.unten ? `linear-gradient(to bottom, ${rand.oben ? "transparent, #000 28px" : "#000"}, ${rand.unten ? "#000 calc(100% - 36px), transparent" : "#000"})` : undefined;
  return { ref, maske, unten: rand.unten, pruefe };
}

/** Schriftgröße (data-schrift am Wurzelelement) und Fenstergröße – Anlass, die Dichte neu zu bestimmen. */
function useLayoutSchluessel(): string {
  const [schluessel, setSchluessel] = useState(() => (typeof window === "undefined" ? "" : `${window.innerWidth}x${window.innerHeight}|${document.documentElement.getAttribute("data-schrift") ?? "100"}`));
  useEffect(() => {
    const neu = () => setSchluessel(`${window.innerWidth}x${window.innerHeight}|${document.documentElement.getAttribute("data-schrift") ?? "100"}`);
    window.addEventListener("resize", neu);
    const mo = new MutationObserver(neu);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-schrift"] });
    return () => {
      window.removeEventListener("resize", neu);
      mo.disconnect();
    };
  }, []);
  return schluessel;
}

export function Sidebar() {
  const { sidebarKompakt, toggleSidebar } = useUI();
  const { tenant, user } = useKanzlei();
  const nav = navFuer(user.rolle);
  const darfLizenz = user.rolle === "partner" || user.rolle === "admin";
  const loc = useLocation();
  const active = navFor(loc.pathname)?.to;
  const badges = useBadges();
  // Tablet hoch und quer (768–1179 px): immer die schmale, beschriftete Leiste – die volle Leiste ließe dem Inhalt
  // am iPad quer nur ~700 px (Aktenliste, Fallanalyse). Ab 1180 px volle Leiste, manuell einklappbar.
  const tablet = useMedia("(min-width: 768px) and (max-width: 1179px)");
  const kompakt = sidebarKompakt || tablet;
  const verlauf = useScrollVerlauf();

  // Dichte: bei jeder Größen- oder Schriftänderung von vorn, dann Stufe für Stufe, bis die Einträge passen (vor dem Zeichnen)
  const layout = useLayoutSchluessel();
  const [stufe, setStufe] = useState(0);
  const max = kompakt ? MAX_STUFE.schmal : MAX_STUFE.voll;
  const startSchluessel = `${layout}|${kompakt}|${nav.length}`;
  const [gemessenFuer, setGemessenFuer] = useState(startSchluessel);
  if (gemessenFuer !== startSchluessel) {
    setGemessenFuer(startSchluessel);
    setStufe(0);
  }
  useLayoutEffect(() => {
    const el = verlauf.ref.current;
    if (!el) return;
    if (el.scrollHeight > el.clientHeight + 1 && stufe < max) setStufe((s) => Math.min(max, s + 1));
    else verlauf.pruefe();
  }, [stufe, max, startSchluessel, verlauf.ref, verlauf.pruefe]);

  const lizenz: "voll" | "zeile" | "aus" = kompakt || stufe >= 2 ? "aus" : stufe === 1 ? "zeile" : "voll";
  const dicht = !kompakt && stufe >= 3;
  const ohneTitel = !kompakt && stufe >= 4;
  const sehrDicht = !kompakt && stufe >= 5;
  const schmalDicht = kompakt && stufe >= 1;

  return (
    <motion.aside
      animate={{ width: kompakt ? BREITE_SCHMAL : BREITE_VOLL }}
      transition={{ type: "spring", stiffness: 380, damping: 38 }}
      className="glass relative z-30 m-3 mr-0 hidden shrink-0 flex-col rounded-[28px] md:flex"
      style={{ width: kompakt ? BREITE_SCHMAL : BREITE_VOLL }}
    >
      <div className={cn("flex items-center gap-2.5 px-4 pb-2 pt-4", kompakt && "justify-center px-0", (dicht || schmalDicht) && "pb-1 pt-3")}>
        <AppIcon size={kompakt || dicht ? 30 : 34} />
        {!kompakt && (
          <div className="min-w-0 flex-1 leading-tight">
            <Wordmark size={16} />
            <div className="truncate text-[12.5px] text-fg-3" title={tenant.name}>
              {tenant.kurzname}
            </div>
          </div>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        <nav
          ref={verlauf.ref}
          className={cn("no-scrollbar h-full overflow-y-auto pb-2", kompakt ? "px-2" : "px-2.5", dicht || schmalDicht ? "mt-0" : "mt-2")}
          style={{ maskImage: verlauf.maske, WebkitMaskImage: verlauf.maske }}
          aria-label="Hauptnavigation"
        >
          <div>
            {GRUPPEN.map((g) => (
              <div key={g} className={dicht ? "mb-1" : "mb-2"}>
                {!kompakt && !ohneTitel && g !== "Arbeiten" && (
                  <div className={cn("eyebrow px-3 pb-1 !text-[12px]", dicht ? "pt-2" : "pt-3")}>{g === "Service" ? "" : g}</div>
                )}
                {(kompakt || ohneTitel) && g !== "Arbeiten" && <div className={cn("mx-auto h-px w-8 bg-[var(--line)]", schmalDicht || ohneTitel ? "my-1" : "my-2")} />}
                {nav.filter((n) => n.gruppe === g).map((n) => {
                  const isActive = active === n.to;
                  const badge = badges[n.to];
                  // Zugänglicher Name aus Bereich und Bedeutung des Zählers („Posteingang, 6 neu“) statt nur der Zahl
                  const name = badge?.anzahl ? `${n.label}, ${badge.bedeutung}` : n.label;
                  return (
                    <NavLink
                      key={n.to}
                      to={n.to}
                      aria-label={name}
                      title={kompakt ? `${name} – ${beschreibungFuer(n, tenant.ansprechpartner)}` : beschreibungFuer(n, tenant.ansprechpartner)}
                      className={cn(
                        "group relative flex rounded-[14px] font-medium transition-colors",
                        kompakt
                          ? cn("w-full flex-col items-center justify-center gap-[3px] px-0.5", schmalDicht ? "min-h-[46px] py-1" : "min-h-[52px] py-1.5")
                          : cn("items-center gap-3 px-3 text-[13.5px]", sehrDicht ? "h-8" : dicht ? "h-9" : "h-10"),
                        isActive ? "text-fg" : "text-fg-2 hover:text-fg",
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="nav-pill"
                          transition={{ type: "spring", stiffness: 500, damping: 38 }}
                          className="absolute inset-0 -z-10 rounded-[14px] bg-[var(--glass-strong)] shadow-[0_1px_0_0_var(--glass-rim-3)_inset,0_4px_14px_-4px_rgba(20,30,80,0.18),0_0_0_1px_var(--line)]"
                        />
                      )}
                      <span aria-hidden className={cn("relative transition-transform duration-300 ease-[var(--spring)] group-hover:scale-110", isActive ? "text-ink" : "text-fg-3 group-hover:text-fg-2")}>
                        <n.icon className="size-[18px]" strokeWidth={isActive ? 2.2 : 1.9} />
                        {kompakt && badge?.anzahl ? (
                          <span className={cn("absolute -right-2.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11.5px] font-bold leading-none text-white", badge.ton === "seal" ? "bg-seal" : "bg-ink")}>{badge.anzahl}</span>
                        ) : null}
                      </span>
                      {kompakt ? (
                        <span aria-hidden className={cn("max-w-full truncate text-[11.5px] leading-[1.15]", isActive ? "font-semibold text-fg" : "text-fg-2")}>
                          {n.kurz ?? n.label}
                        </span>
                      ) : (
                        <span aria-hidden className="flex-1 truncate">{n.label}</span>
                      )}
                      {!kompakt && badge?.anzahl ? (
                        <span aria-hidden className={cn("num grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[12px] font-semibold", badge.ton === "seal" ? "bg-seal text-white" : badge.ton === "ai" ? "ai-fill text-white" : "bg-ink-soft text-ink")}>
                          {badge.anzahl}
                        </span>
                      ) : null}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>
        {/* Scrollt die Leiste trotz aller Verdichtung, zeigt ein Pfeil unten: Hier geht es weiter. */}
        {verlauf.unten && (
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
            <span className="grid size-6 place-items-center rounded-full bg-[var(--glass-strong)] text-fg-3 shadow-[0_2px_8px_-2px_rgba(20,30,80,0.25)]">
              <ChevronDown className="size-4" />
            </span>
          </span>
        )}
      </div>

      <div className={cn("px-3 pb-3", kompakt && "px-2", (dicht || schmalDicht) && "pb-2")}>
        {lizenz !== "aus" && (
          <NavLink
            to={darfLizenz ? "/einstellungen?tab=lizenz" : "/einstellungen?tab=team"}
            className={cn("mb-2 block rounded-[16px] bg-ink-softer text-[12.5px] leading-snug transition-colors hover:bg-ink-soft", lizenz === "voll" ? "p-3" : "px-3 py-2")}
          >
            {tenant.status === "test" ? (
              <>
                <div className="flex items-center gap-1.5 font-semibold text-fg">
                  <CalendarClock className="size-4 shrink-0 text-amber" />
                  <span className="truncate">{tenant.testBis ? `Testzugang bis ${fmtDate(tenant.testBis)}` : "Testzugang"}</span>
                </div>
                {lizenz === "voll" && <div className="mt-0.5 text-fg-3">{tenant.lizenz.arbeitsplaetze} Arbeitsplätze · alle Funktionen frei</div>}
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 font-semibold text-fg">
                  <InfinityIcon className="size-4 shrink-0 text-ink" />
                  <span className="truncate">Lifetime-Lizenz{lizenz === "zeile" ? <span className="font-normal text-fg-3"> · {tenant.lizenz.arbeitsplaetze} Plätze</span> : null}</span>
                </div>
                {lizenz === "voll" && <div className="mt-0.5 text-fg-3">{tenant.lizenz.arbeitsplaetze} Arbeitsplätze · keine Monatsgebühren</div>}
              </>
            )}
          </NavLink>
        )}
        {!tablet && (
          <button
            type="button"
            onClick={toggleSidebar}
            className={cn(
              kompakt
                ? "icon-btn w-full !rounded-[12px]"
                : cn("flex w-full items-center gap-2 rounded-[12px] px-3 text-[12.5px] font-medium text-fg-2 transition-colors hover:bg-ink-softer hover:text-fg", dicht ? "h-8" : "h-9"),
            )}
            aria-label={kompakt ? "Seitenleiste ausklappen" : "Seitenleiste einklappen"}
            title={kompakt ? "Seitenleiste ausklappen" : undefined}
          >
            {kompakt ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
            {!kompakt && "Einklappen"}
          </button>
        )}
      </div>
    </motion.aside>
  );
}
