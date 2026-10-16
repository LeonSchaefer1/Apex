import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { motion } from "motion/react";
import { CalendarClock, PanelLeftClose, PanelLeftOpen, Infinity as InfinityIcon } from "lucide-react";
import { navFor, navFuer } from "@/app/nav";
import { useUI } from "@/store/ui";
import { useKanzlei } from "@/store/session";
import { cn } from "@/lib/cn";
import { AppIcon, Wordmark } from "@/components/Logo";
import { useMedia } from "@/lib/useMedia";
import { fmtDate } from "@/core/dates";
import { useBadges } from "./useBadges";

const GRUPPEN = ["Arbeiten", "Intelligenz", "Kanzlei", "Service"] as const;

/** Verlauf am Rand der Navigation, solange dort weitere Einträge verborgen sind (niedrige Fensterhöhe). */
function useScrollVerlauf() {
  const ref = useRef<HTMLElement>(null);
  const [rand, setRand] = useState({ oben: false, unten: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pruefe = () => {
      const oben = el.scrollTop > 2;
      const unten = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
      setRand((r) => (r.oben === oben && r.unten === unten ? r : { oben, unten }));
    };
    pruefe();
    el.addEventListener("scroll", pruefe, { passive: true });
    const ro = new ResizeObserver(pruefe);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", pruefe);
      ro.disconnect();
    };
  }, []);
  const maske = rand.oben || rand.unten ? `linear-gradient(to bottom, ${rand.oben ? "transparent, #000 28px" : "#000"}, ${rand.unten ? "#000 calc(100% - 36px), transparent" : "#000"})` : undefined;
  return { ref, maske, unten: rand.unten };
}

export function Sidebar() {
  const { sidebarKompakt, toggleSidebar } = useUI();
  const { tenant, user } = useKanzlei();
  const nav = navFuer(user.rolle);
  const darfLizenz = user.rolle === "partner" || user.rolle === "admin";
  const loc = useLocation();
  const active = navFor(loc.pathname)?.to;
  const badges = useBadges();
  // Tablet hochkant (768–1023 px): immer die kompakte Icon-Leiste – die volle Leiste ließe dem Inhalt nur ~500 px.
  const tablet = useMedia("(min-width: 768px) and (max-width: 1023px)");
  const kompakt = sidebarKompakt || tablet;
  const verlauf = useScrollVerlauf();

  return (
    <motion.aside
      animate={{ width: kompakt ? 76 : 252 }}
      transition={{ type: "spring", stiffness: 380, damping: 38 }}
      className="glass relative z-30 m-3 mr-0 hidden shrink-0 flex-col rounded-[28px] md:flex"
      style={{ width: kompakt ? 76 : 252 }}
    >
      <div className={cn("flex items-center gap-2.5 px-4 pb-2 pt-4", kompakt && "justify-center px-0")}>
        <AppIcon size={34} />
        {!kompakt && (
          <div className="min-w-0 flex-1 leading-tight">
            <Wordmark size={16} />
            <div className="truncate text-[12.5px] text-fg-3" title={tenant.name}>
              {tenant.kurzname}
            </div>
          </div>
        )}
      </div>

      {/* Niedrige Fenster (Beamer 1280×720, Laptop 1366×768): dichtere Einträge, Lizenz-Kachel entfällt,
          verbleibender Überlauf wird am Rand mit einem Verlauf angezeigt. */}
      <nav
        ref={verlauf.ref}
        className="no-scrollbar mt-2 min-h-0 flex-1 overflow-y-auto px-2.5 pb-2 [@media(max-height:760px)]:mt-0"
        style={{ maskImage: verlauf.maske, WebkitMaskImage: verlauf.maske }}
        aria-label="Hauptnavigation"
      >
        <div>
        {GRUPPEN.map((g) => (
          <div key={g} className="mb-2 [@media(max-height:760px)]:mb-1">
            {!kompakt && g !== "Arbeiten" && <div className="eyebrow px-3 pb-1 pt-3 !text-[12px] [@media(max-height:760px)]:pt-2">{g === "Service" ? "" : g}</div>}
            {kompakt && g !== "Arbeiten" && <div className="mx-auto my-2 h-px w-8 bg-[var(--line)] [@media(max-height:760px)]:my-1.5" />}
            {nav.filter((n) => n.gruppe === g).map((n) => {
              const isActive = active === n.to;
              const badge = badges[n.to];
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  title={kompakt ? `${n.label} – ${n.beschreibung}` : n.beschreibung}
                  className={cn(
                    "group relative flex h-10 items-center gap-3 rounded-[14px] px-3 text-[13.5px] font-medium transition-colors [@media(max-height:700px)]:h-9",
                    kompakt && "justify-center px-0",
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
                  <span className={cn("relative transition-transform duration-300 ease-[var(--spring)] group-hover:scale-110", isActive ? "text-ink" : "text-fg-3 group-hover:text-fg-2")}>
                    <n.icon className="size-[18px]" strokeWidth={isActive ? 2.2 : 1.9} />
                    {kompakt && badge?.anzahl ? (
                      <span className={cn("absolute -right-2 -top-1.5 grid h-[19px] min-w-[19px] place-items-center rounded-full px-1 text-[12px] font-bold leading-none text-white", badge.ton === "seal" ? "bg-seal" : "bg-ink")}>{badge.anzahl}</span>
                    ) : null}
                  </span>
                  {!kompakt && <span className="flex-1 truncate">{n.label}</span>}
                  {!kompakt && badge?.anzahl ? (
                    <span className={cn("num grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[12px] font-semibold", badge.ton === "seal" ? "bg-seal text-white" : badge.ton === "ai" ? "ai-fill text-white" : "bg-ink-soft text-ink")}>
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

      <div className={cn("px-3 pb-3", kompakt && "px-2")}>
        {!kompakt && (
          <NavLink to={darfLizenz ? "/einstellungen?tab=lizenz" : "/einstellungen?tab=team"} className="mb-2 block rounded-[16px] bg-ink-softer p-3 text-[12.5px] leading-snug transition-colors hover:bg-ink-soft [@media(max-height:820px)]:hidden">
            {tenant.status === "test" ? (
              <>
                <div className="flex items-center gap-1.5 font-semibold text-fg">
                  <CalendarClock className="size-4 text-amber" /> {tenant.testBis ? `Testzugang bis ${fmtDate(tenant.testBis)}` : "Testzugang"}
                </div>
                <div className="mt-0.5 text-fg-3">
                  {tenant.lizenz.arbeitsplaetze} Arbeitsplätze · alle Funktionen frei
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 font-semibold text-fg">
                  <InfinityIcon className="size-4 text-ink" /> Lifetime-Lizenz
                </div>
                <div className="mt-0.5 text-fg-3">
                  {tenant.lizenz.arbeitsplaetze} Arbeitsplätze · keine Monatsgebühren
                </div>
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
              : "flex h-9 w-full items-center gap-2 rounded-[12px] px-3 text-[12.5px] font-medium text-fg-2 transition-colors hover:bg-ink-softer hover:text-fg",
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
