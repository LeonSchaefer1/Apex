import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { motion } from "motion/react";
import { MoreHorizontal } from "lucide-react";
import { MOBILE_TABS, navFor, navFuer } from "@/app/nav";
import { cn } from "@/lib/cn";
import { Drawer, useDialogOffen } from "@/components/ui";
import { useKanzlei } from "@/store/session";
import { useUI } from "@/store/ui";
import { ApexOrb } from "@/components/assistant/ApexOrb";
import { useBadges } from "./useBadges";

/** Schwebende Tab-Leiste (iOS 26) für das Smartphone. */
export function MobileTabBar() {
  const loc = useLocation();
  const nav = useNavigate();
  const active = navFor(loc.pathname)?.to;
  const [mehr, setMehr] = useState(false);
  const badges = useBadges();
  const { user } = useKanzlei();
  const nachRolle = navFuer(user.rolle);
  const tabs = nachRolle.filter((n) => MOBILE_TABS.includes(n.to));
  // Auf dem Smartphone sitzt die Assistent-Kugel neben der Tab-Leiste – in deren Zone, ohne Listeneinträge zu verdecken.
  const { kugel, assistentOffen, oeffneAssistent } = useUI();
  const mehrAktiv = !!active && !MOBILE_TABS.includes(active);
  // Hinter Dialogen und Drawern würde die Leiste durch deren Glas-Fußzeile scheinen – solange einer offen ist, taucht sie ab.
  const dialogOffen = useDialogOffen();

  return (
    <>
      <motion.nav
        aria-label="Hauptnavigation"
        aria-hidden={dialogOffen || undefined}
        inert={dialogOffen || undefined}
        initial={false}
        animate={{ y: dialogOffen ? "130%" : "0%", opacity: dialogOffen ? 0 : 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 38 }}
        className="tabbar-zone fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(10px,env(safe-area-inset-bottom))] md:hidden"
      >
        <div className="flex w-full max-w-[520px] items-center gap-2">
        {/* deckend (kein Glas hinter Text): Inhalte scrollen nicht sichtbar unter der Leiste durch */}
        <div className="glass-strong tabbar-deckend flex h-[62px] min-w-0 flex-1 items-center gap-1 rounded-full px-1.5">
          {tabs.map((t) => {
            const isActive = active === t.to;
            const badge = badges[t.to];
            return (
              <NavLink key={t.to} to={t.to} className="relative flex h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[12px] font-medium">
                {isActive && (
                  <motion.span layoutId="tab-pill" transition={{ type: "spring", stiffness: 520, damping: 36 }} className="absolute inset-0 -z-10 rounded-full bg-ink-soft" />
                )}
                <span className="relative">
                  <t.icon className={cn("size-[21px]", isActive ? "text-ink" : "text-fg-2")} strokeWidth={isActive ? 2.3 : 1.9} />
                  {badge?.anzahl ? (
                    <span className={cn("absolute -right-2.5 -top-1.5 grid h-[19px] min-w-[19px] place-items-center rounded-full px-1 text-[12px] font-bold leading-none text-white", badge.ton === "seal" ? "bg-seal" : "bg-ink")}>{badge.anzahl}</span>
                  ) : null}
                </span>
                <span className={cn("tab-text max-w-full truncate px-0.5", isActive ? "text-ink" : "text-fg-2")}>{t.kurz ?? t.label}</span>
              </NavLink>
            );
          })}
          <button type="button" onClick={() => setMehr(true)} className="relative flex h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[12px] font-medium">
            {mehrAktiv && <motion.span layoutId="tab-pill" className="absolute inset-0 -z-10 rounded-full bg-ink-soft" />}
            <MoreHorizontal className={cn("size-[21px]", mehrAktiv ? "text-ink" : "text-fg-2")} />
            <span className={cn("tab-text", mehrAktiv ? "text-ink" : "text-fg-2")}>Mehr</span>
          </button>
        </div>
        {kugel && !assistentOffen && (
          <button type="button" onClick={() => oeffneAssistent()} className="grid size-[56px] shrink-0 place-items-center rounded-full" aria-label="Apex Assistent öffnen – per Sprache oder Text fragen">
            <ApexOrb size={52} />
          </button>
        )}
        </div>
      </motion.nav>
      <Drawer open={mehr} onClose={() => setMehr(false)} title="Alle Bereiche" subtitle="Jede Funktion mit einem Satz erklärt.">
        <div className="grid gap-2">
          {nachRolle.filter((n) => !MOBILE_TABS.includes(n.to)).map((n) => (
            <button
              key={n.to}
              type="button"
              onClick={() => {
                setMehr(false);
                nav(n.to);
              }}
              className="flex items-start gap-3 rounded-[18px] p-3 text-left transition-colors hover:bg-ink-softer"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">
                <n.icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[14.5px] font-semibold">{n.label}</span>
                <span className="block text-[12.5px] leading-snug text-fg-3">{n.beschreibung}</span>
              </span>
            </button>
          ))}
        </div>
      </Drawer>
    </>
  );
}
