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
import { WiedervorlageDialog, ZeiterfassungDialog, useTastenkuerzel } from "./Tastenkuerzel";
import { PasswortAendernDialog } from "@/components/sicherheit/PasswortAendern";
import { KeinZugriff } from "./KeinZugriff";
import { bereichErlaubt } from "@/app/nav";
import { useUI } from "@/store/ui";
import { pausiereDialoge } from "@/components/ui/Modal";

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

  // Gesperrt: Fokusfallen offener Fachdialoge ruhen (inert), damit der Sperrbildschirm bedienbar bleibt.
  useEffect(() => {
    pausiereDialoge(gesperrt);
    return () => pausiereDialoge(false);
  }, [gesperrt]);

  // Gesperrt: Suche, Assistent und Dialoge schließen – nichts bleibt hinter dem Sperrbildschirm offen.
  useEffect(() => {
    if (!gesperrt) return;
    const ui = useUI.getState();
    ui.setPalette(false);
    ui.schliesseAssistent();
    ui.setWiedervorlage(null);
    ui.setZeiterfassung(null);
    ui.setPasswortAendern(false);
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
        {/* Erster Tab-Stopp: direkt zum Inhalt (WCAG 2.4.1) – nur bei Fokus sichtbar */}
        <a
          href="#inhalt"
          onClick={(e) => {
            e.preventDefault();
            const ziel = document.getElementById("inhalt");
            ziel?.focus({ preventScroll: true });
            ziel?.scrollIntoView({ block: "start" });
          }}
          className="sr-only z-[120] rounded-full bg-[var(--surface)] px-4 py-2 text-[14px] font-semibold text-ink shadow-[var(--glass-shadow)] ring-2 ring-[var(--focus)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:inline-flex focus:min-h-11 focus:items-center"
        >
          Zum Inhalt springen
        </a>
        <Sidebar />
        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          {/* Kopfleiste über (nicht in) der Scrollfläche: Inhalt läuft nie unter ihre Knöpfe – kein verdecktes Bedienelement
              beim Scrollen (WCAG 2.4.11, 2.5.8; I3-T07-02). Ihr Verlauf blendet die oberste Inhaltskante weich aus. */}
          <TopBar />
          {/* Ebene für Kurzköpfe einzelner Seiten (z. B. Akte): liegt wie die Kopfleiste über der Scrollfläche, nicht darin */}
          <div id="kopf-ebene" className="pointer-events-none relative z-30 h-0 shrink-0" />
          {/* Unten Freiraum für die Assistent-Kugel bzw. mobil für Tab-Leiste und schwebende Aktionsleiste: Fokus und letzte Inhalte liegen nie darunter (WCAG 2.4.11). */}
          <div ref={scrollRef} className="haupt-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden" id="haupt-scroll">
            <main id="inhalt" tabIndex={-1} className="mx-auto w-full max-w-[1480px] px-4 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+76px)] pt-6 outline-none md:px-8 md:pb-28">
              <AnimatePresence mode="wait">
                <motion.div
                  key={loc.pathname}
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  // Nach dem Einblenden filter/transform entfernen: Sonst wird der Seitenrahmen zum Bezugsrahmen für
                  // position: fixed (z. B. die mobile Aktionsleiste der Akte klebte am Seitenende statt über der Tab-Leiste).
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none", transform: "none" } }}
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
        <ZeiterfassungDialog />
        <PasswortAendernDialog />
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
