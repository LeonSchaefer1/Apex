import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Bell, Search, Sun, Moon, MonitorSmartphone, LogOut, Settings, LifeBuoy, Building2, Sparkles, Zap, User as UserIcon, Keyboard } from "lucide-react";
import { navFor } from "@/app/nav";
import { useUI, type ThemeWahl } from "@/store/ui";
import { useKanzlei, useSession } from "@/store/session";
import { useData } from "@/store/data";
import { relTime } from "@/core/dates";
import { Avatar, Menu } from "@/components/ui";
import { AppIcon } from "@/components/Logo";
import { ApexIsland } from "./ApexIsland";
import { cn } from "@/lib/cn";
import { useAiStatus } from "@/ai/status";
import { rollenLabel } from "@/lib/rollen";

/** Im Prototyp sind beA, E-Mail und Bank simuliert – einheitlicher Wortlaut mit Posteingang, Bankabgleich und Systemstatus. */
import { SIMULIERT_STATUS } from "@/lib/betriebsstatus";
export { SIMULIERT_STATUS };

/** Kopfleiste wird deckend, sobald Inhalt darunter durchläuft (kein Text schimmert durch). */
function useGescrollt(): boolean {
  const [gescrollt, setGescrollt] = useState(false);
  useEffect(() => {
    const el = document.getElementById("haupt-scroll");
    if (!el) return;
    const pruefe = () => setGescrollt(el.scrollTop > 4);
    pruefe();
    el.addEventListener("scroll", pruefe, { passive: true });
    return () => el.removeEventListener("scroll", pruefe);
  }, []);
  return gescrollt;
}

const THEME_ICON: Record<ThemeWahl, React.ReactNode> = {
  system: <MonitorSmartphone className="size-[18px]" />,
  light: <Sun className="size-[18px]" />,
  dark: <Moon className="size-[18px]" />,
};

export function TopBar() {
  const loc = useLocation();
  const nav = useNavigate();
  const item = navFor(loc.pathname);
  const { theme, setTheme, setPalette, setKuerzel } = useUI();
  const gescrollt = useGescrollt();
  const { user, tenant } = useKanzlei();
  const logout = useSession((s) => s.logout);
  const clear = useData((s) => s.clear);
  const akt = useData((s) => s.data.aktivitaeten);
  const ai = useAiStatus();
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  const naechstesTheme: ThemeWahl = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  const meldungen = akt.filter((a) => a.akteur !== "nutzer").slice(0, 8);
  // Gelesen-Zustand der Glocke: Zeitpunkt der neuesten gesehenen Meldung je Person (nur in diesem Browser).
  const gesehenKey = `aa:meldungen-gesehen:${user.id}`;
  const [gesehen, setGesehen] = useState(() => {
    try {
      return localStorage.getItem(gesehenKey) ?? "";
    } catch {
      return "";
    }
  });
  const neuesteMeldung = meldungen.reduce((max, m) => (m.zeit > max ? m.zeit : max), "");
  const ungelesen = meldungen.filter((m) => m.zeit > gesehen).length;
  const alsGelesenMarkieren = () => {
    if (!neuesteMeldung || neuesteMeldung <= gesehen) return;
    setGesehen(neuesteMeldung);
    try {
      localStorage.setItem(gesehenKey, neuesteMeldung);
    } catch {
      /* optional – dann gilt der Zustand nur für diese Sitzung */
    }
  };

  return (
    <header className={cn("kopfleiste sticky top-0 z-40 px-3 pt-[max(12px,env(safe-area-inset-top))] md:px-5", gescrollt && "kopfleiste-gescrollt")}>
      <div className={cn("glass flex h-14 items-center gap-2 rounded-[22px] pl-3 pr-2 md:pl-4", gescrollt && "glass-deckend")}>
        {/* Mobil: App-Icon + Seitentitel */}
        <div className="flex min-w-0 items-center gap-2.5 md:hidden">
          <AppIcon size={30} />
          <span className="truncate text-[15px] font-semibold tracking-[-0.02em]">{item?.label ?? "AnwaltApex"}</span>
        </div>

        <button
          type="button"
          onClick={() => setPalette(true)}
          aria-label="Suchen (Strg+K)"
          className="group hidden h-10 min-w-[132px] flex-1 items-center gap-2.5 rounded-full bg-[var(--ink-softer)] px-4 text-left text-[13.5px] text-fg-3 shadow-[inset_0_0_0_1px_var(--line)] transition-colors hover:bg-[var(--ink-soft)] md:flex md:max-w-[460px]"
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 truncate">
            <span className="2xl:hidden">Akten, Fristen, Urteile …</span>
            <span className="hidden 2xl:inline">Akten, Dokumente, Fristen, Urteile durchsuchen …</span>
          </span>
          <span className="kbd hidden xl:inline-grid">{isMac ? "⌘" : "Strg"}</span>
          <span className="kbd -ml-1.5 hidden xl:inline-grid">K</span>
        </button>

        <div className="flex min-w-0 flex-1 justify-center md:max-lg:grow-[0.25]">
          <ApexIsland />
        </div>

        <button type="button" className="icon-btn md:hidden" aria-label="Suchen" onClick={() => setPalette(true)}>
          <Search className="size-[18px]" />
        </button>

        <button
          type="button"
          onClick={() => nav("/hilfe#status")}
          className="hidden h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-fg-3 hover:bg-ink-softer xl:inline-flex"
          title={`Systemstatus öffnen – ${SIMULIERT_STATUS}`}
          aria-label={`Systemstatus: simuliert verbunden – ${SIMULIERT_STATUS}. Systemstatus öffnen`}
        >
          <span className="relative inline-flex size-2 rounded-full bg-[var(--amber)]" aria-hidden />
          <span className="2xl:hidden">Simuliert verbunden</span>
          <span className="hidden 2xl:inline">{SIMULIERT_STATUS}</span>
        </button>

        <Menu
          trigger={({ open, toggle }) => (
            <button
              type="button"
              onClick={() => {
                if (!open) alsGelesenMarkieren();
                toggle();
              }}
              className="icon-btn relative"
              aria-label={ungelesen ? `Benachrichtigungen – ${ungelesen} neu` : "Benachrichtigungen"}
            >
              <Bell className="size-[18px]" />
              {ungelesen > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-seal ring-2 ring-[var(--glass-strong)]" />}
            </button>
          )}
          items={[
            ...meldungen.map((m) => ({
              label: (
                <span className="block max-w-[280px]">
                  <span className="line-clamp-2 text-[13px] leading-snug">{m.text}</span>
                  <span className="text-[12.5px] text-fg-3">
                    {relTime(m.zeit)}
                    {m.minutenGespart ? ` · ${m.minutenGespart} Min. gespart` : ""}
                  </span>
                </span>
              ),
              icon: m.akteur === "ki" ? <Sparkles /> : <Zap />,
              onClick: () => (m.akteId ? nav(`/akten/${m.akteId}`) : nav("/automatisierung")),
            })),
            "sep" as const,
            { label: "Alle Aktivitäten im 38h-Motor", icon: <Zap />, onClick: () => nav("/automatisierung") },
          ]}
        />

        <button type="button" className="icon-btn hidden sm:inline-grid" onClick={() => setTheme(naechstesTheme)} aria-label={`Darstellung: ${theme === "system" ? "System" : theme === "light" ? "Hell" : "Dunkel"} – wechseln`} title="Darstellung wechseln (System / Hell / Dunkel)">
          {THEME_ICON[theme]}
        </button>

        <Menu
          trigger={({ toggle }) => (
            <button type="button" onClick={toggle} className="ml-0.5 flex shrink-0 items-center gap-2 rounded-full p-0.5 pr-0.5 transition-colors hover:bg-ink-softer xl:pr-3" aria-label="Benutzermenü">
              <Avatar initialen={user.initialen} farbe={user.farbe} size={34} />
              <span className="kopf-optional hidden text-left leading-tight xl:block">
                <span className="block max-w-[150px] truncate text-[13px] font-semibold">{user.name}</span>
                <span className={cn("block text-[12.5px]", ai.quelle === "demo" ? "text-fg-3" : "text-green")}>{ai.label}</span>
              </span>
            </button>
          )}
          items={[
            { label: <span className="block"><span className="block font-semibold">{user.name}</span><span className="text-[12.5px] text-fg-3">{rollenLabel(user)}</span></span>, icon: <UserIcon />, onClick: () => nav("/einstellungen?tab=team") },
            { label: tenant.name, icon: <Building2 />, onClick: () => nav("/einstellungen") },
            "sep",
            { label: "Einstellungen", icon: <Settings />, onClick: () => nav("/einstellungen") },
            { label: "Hilfe & Support", icon: <LifeBuoy />, onClick: () => nav("/hilfe") },
            { label: "Apex Assistent öffnen", icon: <Sparkles />, onClick: () => useUI.getState().oeffneAssistent() },
            { label: "Tastaturkürzel (?)", icon: <Keyboard />, onClick: () => setKuerzel(true) },
            { label: `Darstellung: ${theme === "system" ? "System" : theme === "light" ? "Hell" : "Dunkel"}`, icon: THEME_ICON[theme], onClick: () => setTheme(naechstesTheme) },
            "sep",
            {
              label: "Abmelden",
              icon: <LogOut />,
              danger: true,
              onClick: async () => {
                await logout();
                clear();
                nav("/login");
              },
            },
          ]}
        />
      </div>
    </header>
  );
}
