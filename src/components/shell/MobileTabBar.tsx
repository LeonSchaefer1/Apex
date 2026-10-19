import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { motion } from "motion/react";
import { Ellipsis, RadioTower } from "lucide-react";
import { MOBILE_TABS, SYSTEMSTATUS, beschreibungFuer, navFor, navFuer } from "@/app/nav";
import { cn } from "@/lib/cn";
import { Drawer, useDialogOffen } from "@/components/ui";
import { useKanzlei } from "@/store/session";
import { useUI } from "@/store/ui";
import { ApexOrb } from "@/components/assistant/ApexOrb";
import { useBadges } from "./useBadges";
import { BEWEGUNG } from "@/lib/bewegung";

/** Tab-Leiste für das Smartphone: bündig am unteren Rand, Assistent-Knopf in der Mitte. */
export function MobileTabBar() {
  const loc = useLocation();
  const nav = useNavigate();
  const active = navFor(loc.pathname)?.to;
  const [mehr, setMehr] = useState(false);
  const badges = useBadges();
  const { user, tenant } = useKanzlei();
  const nachRolle = navFuer(user.rolle);
  const tabs = nachRolle.filter((n) => MOBILE_TABS.includes(n.to));
  // Auf dem Smartphone sitzt der Assistent-Knopf in der Mitte der Tab-Leiste – ohne Listeneinträge zu verdecken.
  const { kugel, assistentOffen, oeffneAssistent } = useUI();
  const mehrAktiv = !!active && !MOBILE_TABS.includes(active);
  // Hinter Dialogen und Drawern liegt die Leiste unter dem Abdunkler – solange einer offen ist, taucht sie ab.
  const dialogOffen = useDialogOffen();

  const tabKnopf = (t: (typeof tabs)[number]) => {
    const isActive = active === t.to;
    const badge = badges[t.to];
    return (
      <NavLink
        key={t.to}
        to={t.to}
        aria-label={badge?.anzahl ? `${t.label}, ${badge.bedeutung}` : t.label}
        className={cn("tabbar-tab relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[12px] leading-4 focus-visible:outline-offset-[-2px]", isActive ? "font-semibold text-fg" : "font-medium text-fg-4")}
      >
        {isActive && <motion.span layoutId="tab-pill" transition={BEWEGUNG.standard} className="absolute inset-x-3 top-0 h-0.5 bg-[var(--ink)]" aria-hidden />}
        <span className="tab-symbol relative">
          <t.icon className="size-5" />
          {badge?.anzahl ? (
            <span className={cn("tab-badge num absolute -right-2.5 -top-1 grid h-4 min-w-4 place-items-center rounded-lg px-1 text-[12px] font-semibold leading-none", badge.ton === "seal" ? "bg-[var(--seal)] text-[var(--on-seal)]" : "bg-[var(--fg)] text-[var(--bg)]")}>{badge.anzahl}</span>
          ) : null}
        </span>
        <span className="tab-text max-w-full truncate px-0.5">{t.kurz ?? t.label}</span>
      </NavLink>
    );
  };
  const mitte = Math.ceil(tabs.length / 2);
  const assistentKnopf =
    kugel && !assistentOffen ? (
      <button type="button" onClick={() => oeffneAssistent()} className="tabbar-kugel grid size-11 shrink-0 place-items-center self-center rounded-full" aria-label="Apex Assistent öffnen – per Sprache oder Text fragen">
        <ApexOrb size={44} className="!shadow-none" />
      </button>
    ) : null;

  return (
    <>
      {/* Tab-Leiste (DESIGN-SYSTEM.md 12.11): bündig am unteren Rand, deckend auf dem Grund, Linie oben; Assistent-Knopf in der Mitte */}
      <motion.nav
        aria-label="Hauptnavigation"
        aria-hidden={dialogOffen || undefined}
        inert={dialogOffen || undefined}
        initial={false}
        animate={{ y: dialogOffen ? "100%" : "0%", opacity: dialogOffen ? 0 : 1 }}
        transition={BEWEGUNG.dialog}
        className="tabbar-zone fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--bg)] pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="tabbar-leiste mx-auto flex h-14 w-full max-w-[560px] items-stretch gap-0.5 px-1">
          {tabs.slice(0, mitte).map(tabKnopf)}
          {assistentKnopf}
          {tabs.slice(mitte).map(tabKnopf)}
          <button type="button" data-tab="mehr" onClick={() => setMehr(true)} aria-label="Mehr – alle Bereiche" className={cn("tabbar-tab relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[12px] leading-4 focus-visible:outline-offset-[-2px]", mehrAktiv ? "font-semibold text-fg" : "font-medium text-fg-4")}>
            {mehrAktiv && <motion.span layoutId="tab-pill" transition={BEWEGUNG.standard} className="absolute inset-x-3 top-0 h-0.5 bg-[var(--ink)]" aria-hidden />}
            <Ellipsis className="size-5" />
            <span className="tab-text">Mehr</span>
          </button>
        </div>
      </motion.nav>
      <Drawer open={mehr} onClose={() => setMehr(false)} title="Alle Bereiche" subtitle="Jede Funktion mit einem Satz erklärt.">
        <div className="-mx-2 grid">
          {/* Systemstatus direkt (beA, E-Mail, Bank) – als erster Eintrag, sonst läge er tief in „Hilfe & Support“ */}
          <button
            type="button"
            onClick={() => {
              setMehr(false);
              nav(SYSTEMSTATUS.to);
            }}
            className="flex min-h-11 items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors duration-100 hover:bg-[var(--surface-pop-hover)]"
          >
            <span className="relative mt-0.5 shrink-0 text-fg-4">
              <RadioTower className="size-5" />
              <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-[var(--amber)]" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-medium leading-5 text-fg">{SYSTEMSTATUS.label}</span>
              <span className="block text-[13px] leading-[18px] text-fg-3">{SYSTEMSTATUS.beschreibung}</span>
            </span>
          </button>
          {nachRolle.filter((n) => !MOBILE_TABS.includes(n.to)).map((n) => (
            <button
              key={n.to}
              type="button"
              onClick={() => {
                setMehr(false);
                nav(n.to);
              }}
              className="flex min-h-11 items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors duration-100 hover:bg-[var(--surface-pop-hover)]"
            >
              <span className="mt-0.5 shrink-0 text-fg-4">
                <n.icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-medium leading-5 text-fg">{n.label}</span>
                <span className="block text-[13px] leading-[18px] text-fg-3">{beschreibungFuer(n, tenant.ansprechpartner)}</span>
              </span>
            </button>
          ))}
        </div>
      </Drawer>
    </>
  );
}
