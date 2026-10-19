import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { motion } from "motion/react";
import { CalendarClock, ChevronDown, PanelLeftClose, PanelLeftOpen, Infinity as InfinityIcon } from "lucide-react";
import { beschreibungFuer, navFor, navFuer } from "@/app/nav";
import { useUI } from "@/store/ui";
import { useKanzlei } from "@/store/session";
import { cn } from "@/lib/cn";
import { LogoMark, Wordmark } from "@/components/Logo";
import { BEWEGUNG } from "@/lib/bewegung";
import { useMedia } from "@/lib/useMedia";
import { fmtDate } from "@/core/dates";
import { useBadges } from "./useBadges";

const GRUPPEN = ["Arbeiten", "Intelligenz", "Kanzlei", "Service"] as const;

/** Breite der beschrifteten schmalen Leiste (Tablet, eingeklappt) bzw. der vollen Leiste (DESIGN-SYSTEM.md 12.10: 232 px). */
const BREITE_SCHMAL = 76;
const BREITE_VOLL = 232;

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
      transition={BEWEGUNG.dialog}
      className="relative z-30 hidden h-full shrink-0 flex-col border-r border-[var(--line)] bg-[var(--bg)] md:flex"
      style={{ width: kompakt ? BREITE_SCHMAL : BREITE_VOLL }}
    >
      {/* Kopf 56 px – bündig mit der Kopfleiste: Bildmarke + „Apex“, darunter der Kanzleiname */}
      <div className={cn("flex h-14 shrink-0 items-center gap-2.5 px-5", kompakt && "justify-center px-0")}>
        <LogoMark size={20} className="text-fg" />
        {!kompakt && (
          <div className="min-w-0 flex-1 leading-tight">
            <Wordmark size={15} className="block" />
            <div className="truncate text-[12px] leading-4 text-fg-4" title={tenant.name}>
              {tenant.kurzname}
            </div>
          </div>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        <nav
          ref={verlauf.ref}
          className={cn("no-scrollbar h-full overflow-y-auto pb-2", kompakt ? "px-2" : "px-3", dicht || schmalDicht ? "pt-0" : "pt-1")}
          style={{ maskImage: verlauf.maske, WebkitMaskImage: verlauf.maske }}
          aria-label="Hauptnavigation"
        >
          <div>
            {GRUPPEN.map((g) => (
              <div key={g} className={dicht ? "mb-0.5" : "mb-1"}>
                {!kompakt && !ohneTitel && g !== "Arbeiten" && (
                  g === "Service" ? (
                    <div className={dicht ? "h-3" : "h-5"} aria-hidden />
                  ) : (
                    <div className={cn("px-2.5 pb-1 text-[12px] font-medium leading-4 text-fg-4", dicht ? "pt-3" : "pt-6")}>{g}</div>
                  )
                )}
                {(kompakt || ohneTitel) && g !== "Arbeiten" && <div className={cn("mx-auto h-px bg-[var(--line)]", kompakt ? "w-8" : "mx-2.5", schmalDicht || ohneTitel ? "my-1" : "my-2")} />}
                {nav.filter((n) => n.gruppe === g).map((n) => {
                  const isActive = active === n.to;
                  const badge = badges[n.to];
                  // Zugänglicher Name aus Bereich und Bedeutung des Zählers („Posteingang, 6 neu“) statt nur der Zahl
                  const name = badge?.anzahl ? `${n.label}, ${badge.bedeutung}` : n.label;
                  const kritisch = badge?.ton === "seal";
                  return (
                    <NavLink
                      key={n.to}
                      to={n.to}
                      aria-label={name}
                      title={kompakt ? `${name} – ${beschreibungFuer(n, tenant.ansprechpartner)}` : beschreibungFuer(n, tenant.ansprechpartner)}
                      className={cn(
                        "group relative flex rounded-md transition-colors duration-100",
                        kompakt
                          ? cn("w-full flex-col items-center justify-center gap-1 px-0.5", schmalDicht ? "min-h-[46px] py-1" : "min-h-[52px] py-1.5")
                          : cn("items-center gap-2.5 px-2.5 text-[14px] leading-5", sehrDicht ? "h-7" : dicht ? "h-[30px]" : "h-8"),
                        isActive ? "font-semibold text-fg" : "font-medium text-fg-3 hover:bg-[var(--surface-2)] hover:text-fg",
                      )}
                    >
                      {isActive && (
                        <motion.span layoutId="nav-pill" transition={BEWEGUNG.standard} className="absolute inset-0 -z-10 rounded-md bg-[var(--surface-3)]" />
                      )}
                      <span aria-hidden className={cn("relative", isActive ? "text-fg" : "text-fg-4 group-hover:text-fg")}>
                        <n.icon className="size-4" />
                        {kompakt && badge?.anzahl ? (
                          <span className={cn("num absolute -right-3 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[12px] font-semibold leading-none", kritisch ? "bg-[var(--seal)] text-[var(--on-seal)]" : "bg-[var(--fg)] text-[var(--bg)]")}>{badge.anzahl}</span>
                        ) : null}
                      </span>
                      {kompakt ? (
                        <span aria-hidden className={cn("max-w-full truncate text-[12px] leading-4", isActive ? "font-semibold text-fg" : "font-medium text-fg-3")}>
                          {n.kurz ?? n.label}
                        </span>
                      ) : (
                        <span aria-hidden className="flex-1 truncate">{n.label}</span>
                      )}
                      {!kompakt && badge?.anzahl ? (
                        <span aria-hidden className={cn("num text-[12px] leading-4", kritisch ? "font-semibold text-seal-text" : "font-medium text-fg-4")}>
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
            <span className="grid size-6 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-fg-3">
              <ChevronDown className="size-4" />
            </span>
          </span>
        )}
      </div>

      <div className={cn("shrink-0 px-3 pb-3", kompakt && "px-2", (dicht || schmalDicht) && "pb-2")}>
        {lizenz !== "aus" && (
          <NavLink
            to={darfLizenz ? "/einstellungen?tab=lizenz" : "/einstellungen?tab=team"}
            className={cn("mb-1 block border-t border-[var(--line)] px-2.5 text-[12px] leading-4 text-fg-4 transition-colors duration-100 hover:text-fg-2", lizenz === "voll" ? "pb-2 pt-3" : "pb-1.5 pt-2")}
          >
            {tenant.status === "test" ? (
              <>
                <div className="flex items-center gap-1.5 font-medium text-fg-2">
                  <CalendarClock className="size-3.5 shrink-0 text-amber" />
                  <span className="truncate">{tenant.testBis ? `Testzugang bis ${fmtDate(tenant.testBis)}` : "Testzugang"}</span>
                </div>
                {lizenz === "voll" && <div className="mt-0.5">{tenant.lizenz.arbeitsplaetze} Arbeitsplätze · alle Funktionen frei</div>}
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 font-medium text-fg-2">
                  <InfinityIcon className="size-3.5 shrink-0 text-fg-4" />
                  <span className="truncate">Lifetime-Lizenz{lizenz === "zeile" ? <span className="font-normal text-fg-4"> · {tenant.lizenz.arbeitsplaetze} Plätze</span> : null}</span>
                </div>
                {lizenz === "voll" && <div className="mt-0.5">{tenant.lizenz.arbeitsplaetze} Arbeitsplätze · keine Monatsgebühren</div>}
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
                ? "icon-btn w-full"
                : cn("flex w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-fg-3 transition-colors duration-100 hover:bg-[var(--surface-2)] hover:text-fg", dicht ? "h-7" : "h-8"),
            )}
            aria-label={kompakt ? "Seitenleiste ausklappen" : "Seitenleiste einklappen"}
            title={kompakt ? "Seitenleiste ausklappen" : undefined}
          >
            {kompakt ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4 text-fg-4" />}
            {!kompakt && "Einklappen"}
          </button>
        )}
      </div>
    </motion.aside>
  );
}
