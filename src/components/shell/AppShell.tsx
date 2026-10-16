import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useOutlet } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { useSession } from "@/store/session";
import { useData } from "@/store/data";
import { hatBeispieldaten, istConsole } from "@/lib/backend";
import { usePointerGlow } from "@/lib/usePointerGlow";
import { useMotor } from "@/lib/motor";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileTabBar } from "./MobileTabBar";
import { CommandPalette } from "./CommandPalette";
import { QuickHelp } from "./QuickHelp";
import { AssistantDock } from "@/components/assistant/AssistantDock";
import { LadeBildschirm } from "./LadeBildschirm";
import { Sperrbildschirm } from "./Sperrbildschirm";
import { ZweiFaktorPflicht } from "./ZweiFaktorPflicht";
import { WiedervorlageDialog, useTastenkuerzel } from "./Tastenkuerzel";
import { KeinZugriff } from "./KeinZugriff";
import { bereichErlaubt } from "@/app/nav";
import { useUI } from "@/store/ui";

/** Rahmen der Kanzlei-App: schwebende Glas-Navigation über dem belichteten Arbeitsgrund. */
export function AppShell() {
  const { sitzung, status, gesperrt } = useSession();
  const dataStatus = useData((s) => s.status);
  const load = useData((s) => s.load);
  const loc = useLocation();
  const nav = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  usePointerGlow();
  const zweiFaktorFehlt = !!sitzung && !istConsole(sitzung) && !!sitzung.betrieb?.zweiFaktorFehlt;
  // Simulierter 38h-Motor nur für Präsentations- und Beispieldaten-Kanzleien – nie in echten Kundendaten.
  useMotor(dataStatus === "bereit" && hatBeispieldaten(sitzung) && !gesperrt);
  useTastenkuerzel();

  useEffect(() => {
    if (sitzung && !istConsole(sitzung) && dataStatus === "leer" && !zweiFaktorFehlt) void load();
  }, [sitzung, dataStatus, load, zweiFaktorFehlt]);

  // Gesperrt: Suche, Assistent und Dialoge schließen – nichts bleibt hinter dem Sperrbildschirm offen.
  useEffect(() => {
    if (!gesperrt) return;
    const ui = useUI.getState();
    ui.setPalette(false);
    ui.schliesseAssistent();
    ui.setWiedervorlage(null);
    ui.setKuerzel(false);
    ui.zeigeHilfe(null);
  }, [gesperrt]);

  // Sitzung wurde in einem anderen Tab gewechselt: Die bisherige Seite (z. B. eine Akte) gehört zur alten Kanzlei → Cockpit.
  const kanzleiSchluessel = sitzung && !istConsole(sitzung) ? `${sitzung.tenant.id}:${sitzung.user.id}` : null;
  const vorherSchluessel = useRef(kanzleiSchluessel);
  useEffect(() => {
    if (vorherSchluessel.current && kanzleiSchluessel && vorherSchluessel.current !== kanzleiSchluessel && loc.pathname !== "/cockpit") nav("/cockpit", { replace: true });
    vorherSchluessel.current = kanzleiSchluessel;
  }, [kanzleiSchluessel, loc.pathname, nav]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [loc.pathname]);

  if (status !== "angemeldet" || !sitzung) return <Navigate to="/login" replace />;
  if (istConsole(sitzung)) return <Navigate to="/console" replace />;
  if (zweiFaktorFehlt) return <ZweiFaktorPflicht />;
  if (dataStatus !== "bereit")
    return (
      <LadeBildschirm
        fehler={dataStatus === "fehler" ? useData.getState().fehler ?? "Die Kanzleidaten konnten nicht geladen werden." : undefined}
        onErneut={() => void load()}
        onAbmelden={() =>
          void (async () => {
            await useSession.getState().logout();
            useData.getState().clear();
          })()
        }
      />
    );

  const erlaubt = bereichErlaubt(loc.pathname, sitzung.user.rolle);
  return (
    <>
      {/* Gesperrt: Inhalte unsichtbar und nicht bedienbar, darüber der Sperrbildschirm */}
      <div className={gesperrt ? "invisible relative flex h-full" : "relative flex h-full"} aria-hidden={gesperrt || undefined} inert={gesperrt || undefined}>
        <Sidebar />
        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          {/* Unten Freiraum für die Assistent-Kugel (Kugel + 16 px): Fokus und letzte Inhalte liegen nie unter ihr (WCAG 2.4.11). */}
          <div ref={scrollRef} className="haupt-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden" id="haupt-scroll">
            <TopBar />
            <main className="mx-auto w-full max-w-[1480px] px-4 pb-36 pt-6 md:px-8 md:pb-28">
              <AnimatePresence mode="wait">
                <motion.div
                  key={loc.pathname}
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -6, filter: "blur(3px)" }}
                  transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                >
                  {erlaubt ? <FrozenOutlet /> : <KeinZugriff />}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </div>
        <MobileTabBar />
        <CommandPalette />
        <QuickHelp />
        <WiedervorlageDialog />
        <AssistantDock />
      </div>
      {gesperrt && <Sperrbildschirm />}
    </>
  );
}

/**
 * Hält die Route fest, mit der der Seitenübergang begonnen hat. Ohne das würde die neue Seite schon im
 * ausblendenden Element gerendert und danach ein zweites Mal montiert (Deep-Link-Zustand ginge verloren).
 */
function FrozenOutlet() {
  const outlet = useOutlet();
  const [frozen] = useState(outlet);
  return frozen;
}
