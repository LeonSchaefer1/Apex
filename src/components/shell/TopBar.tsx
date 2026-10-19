import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Bell, Search, Sun, Moon, MonitorSmartphone, LogOut, Settings, LifeBuoy, Building2, Sparkles, Zap, User as UserIcon, Keyboard, ShieldAlert, RadioTower } from "lucide-react";
import { navFor, SYSTEMSTATUS } from "@/app/nav";
import { useUI, type ThemeWahl } from "@/store/ui";
import { useKanzlei, useSession } from "@/store/session";
import { useData } from "@/store/data";
import { relTime } from "@/core/dates";
import { Avatar, Menu } from "@/components/ui";
import { LogoMark } from "@/components/Logo";
import { ApexIsland } from "./ApexIsland";
import { cn } from "@/lib/cn";
import { useAiStatus } from "@/ai/status";
import { rollenLabel } from "@/lib/rollen";
import { darfVerwalten } from "@/lib/backend";
import { useMedia } from "@/lib/useMedia";

/** Im Prototyp sind beA, E-Mail und Bank simuliert – einheitlicher Wortlaut mit Posteingang, Bankabgleich und Systemstatus. */
import { SIMULIERT_STATUS, SYSTEMSTATUS_NAME } from "@/lib/betriebsstatus";
export { SIMULIERT_STATUS };

/**
 * Geringe Höhe (z. B. 200 % Zoom auf dem Notebook: 720 × 450 CSS-px, I4-T15-03): Die kompakte Kopfleiste blendet sich beim
 * Scrollen nach unten aus und beim Scrollen nach oben wieder ein; Fokus in der Kopfleiste und ein Seitenwechsel blenden sie ein.
 * Ohne Animation bei „Bewegung reduzieren“ (globale CSS-Regel für Übergänge).
 */
function useKopfAusblenden(pfad: string): [boolean, () => void] {
  const niedrig = useMedia("(max-height: 520px)");
  const [weg, setWeg] = useState(false);
  useEffect(() => setWeg(false), [pfad, niedrig]);
  useEffect(() => {
    if (!niedrig) return;
    const el = document.getElementById("haupt-scroll");
    if (!el) return;
    let letzte = el.scrollTop;
    // Nach dem Ein- bzw. Ausblenden ändert sich die Höhe der Scrollfläche – kurz nicht reagieren, sonst flackert es am Seitenende
    let ruheBis = 0;
    const umschalten = (v: boolean) =>
      setWeg((alt) => {
        if (alt !== v) ruheBis = performance.now() + 300;
        return v;
      });
    const h = () => {
      const y = el.scrollTop;
      const d = y - letzte;
      if (performance.now() < ruheBis) {
        letzte = y;
        return;
      }
      if (y < 8) umschalten(false);
      else if (d > 6) umschalten(true);
      else if (d < -6) umschalten(false);
      if (Math.abs(d) > 6) letzte = y;
    };
    el.addEventListener("scroll", h, { passive: true });
    return () => el.removeEventListener("scroll", h);
  }, [niedrig]);
  return [niedrig && weg, () => setWeg(false)];
}

const THEME_ICON: Record<ThemeWahl, React.ReactNode> = {
  system: <MonitorSmartphone className="size-4" />,
  light: <Sun className="size-4" />,
  dark: <Moon className="size-4" />,
};

export function TopBar() {
  const loc = useLocation();
  const nav = useNavigate();
  const item = navFor(loc.pathname);
  const { theme, setTheme, setPalette, setKuerzel } = useUI();
  const [kopfWeg, kopfZeigen] = useKopfAusblenden(loc.pathname);
  const kopfRef = useRef<HTMLElement>(null);
  const { user, tenant } = useKanzlei();
  const logout = useSession((s) => s.logout);
  const clear = useData((s) => s.clear);
  const akt = useData((s) => s.data.aktivitaeten);
  const ai = useAiStatus();
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  const naechstesTheme: ThemeWahl = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  // Anmeldeereignisse gehören ins Kanzleiprotokoll – in die Glocke nur der Hinweis auf gehäufte Fehlversuche (für Partner/Administration)
  const verwalten = darfVerwalten(user.rolle);
  const meldungen = akt.filter((a) => a.akteur !== "nutzer" && (a.kategorie !== "anmeldung" || (a.meldung && verwalten))).slice(0, 8);
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
  // Punkt an der Glocke: Siegelrot nur bei Kritischem (gehäufte Fehlanmeldungen), sonst Text 1
  const ungelesenKritisch = meldungen.some((m) => m.zeit > gesehen && m.kategorie === "anmeldung" && !!m.meldung);
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
    // Kopfleiste (DESIGN-SYSTEM.md 12.11): 56 px, deckend auf dem Grund, Linie unten – immer gleich, auch beim Scrollen.
    <header
      ref={kopfRef}
      className="kopfleiste relative z-40 shrink-0 border-b border-[var(--line)] bg-[var(--bg)] pt-[env(safe-area-inset-top)] transition-[margin-top] duration-200"
      style={kopfWeg ? { marginTop: -(kopfRef.current?.offsetHeight ?? 48) } : undefined}
      data-ausgeblendet={kopfWeg || undefined}
      onFocusCapture={kopfZeigen}
    >
      <div className="kopf-innen flex h-14 items-center gap-1 pl-4 pr-2 sm:gap-1.5 sm:pr-3 md:px-6">
        {/* Mobil: Bildmarke + Seitentitel – unter 360 px ohne Marke, der Titel bricht bei Bedarf in eine zweite Zeile um (I4-T01-01) */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5 md:hidden">
          <LogoMark size={20} className="text-fg max-[359px]:hidden" />
          <span className="truncate text-[15px] font-semibold tracking-[-0.01em] max-[379px]:text-[14px] max-[359px]:overflow-visible max-[359px]:whitespace-normal max-[359px]:text-[13.5px] max-[359px]:leading-[1.15] max-[359px]:hyphens-auto">
            {item?.label ?? "Apex"}
          </span>
        </div>

        {/* Suchfeld: sieht aus wie ein Feld, öffnet die globale Suche (Strg+K) */}
        <button
          type="button"
          onClick={() => setPalette(true)}
          aria-label="Suchen (Strg+K)"
          className="group hidden h-8 min-w-[132px] flex-1 items-center gap-2 rounded-md border border-[var(--line-strong)] bg-[var(--surface)] pl-2.5 pr-1.5 text-left text-[14px] text-fg-4 transition-colors duration-100 hover:border-[var(--fg-3)] md:flex md:max-w-[360px]"
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 truncate">
            <span className="2xl:hidden">Akten, Fristen, Urteile …</span>
            <span className="hidden 2xl:inline">Akten, Dokumente, Fristen, Urteile …</span>
          </span>
          <span className="kbd hidden xl:inline-grid">{isMac ? "⌘" : "Strg"}</span>
          <span className="kbd -ml-1 hidden xl:inline-grid">K</span>
        </button>

        <div className="hidden min-w-0 flex-1 justify-center md:flex md:max-lg:grow-[0.25]">
          <ApexIsland />
        </div>

        {/* Mobil (< 640 px): Bedienflächen der Kopfleiste mindestens 44 × 44 px (Daumen, WCAG 2.5.5) */}
        <button type="button" className="icon-btn md:hidden" aria-label="Suchen" onClick={() => setPalette(true)}>
          <Search className="size-[18px]" />
        </button>

        {/* Mobil: Systemstatus in 1 Tippen (I3-T12-02) – Symbol + Farbpunkt, Name für Screenreader; Desktop nutzt die Textanzeige rechts */}
        <button
          type="button"
          onClick={() => nav(SYSTEMSTATUS.to)}
          className="icon-btn relative md:hidden"
          aria-label={SYSTEMSTATUS_NAME}
          title={`Systemstatus öffnen – ${SIMULIERT_STATUS}`}
        >
          <RadioTower className="size-[18px]" aria-hidden />
          <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-[var(--amber)] max-sm:right-3 max-sm:top-3" aria-hidden />
        </button>

        <button
          type="button"
          onClick={() => nav("/hilfe#status")}
          className="hidden h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-fg-3 transition-colors duration-100 hover:bg-[var(--surface-2)] hover:text-fg xl:inline-flex"
          title={`Systemstatus öffnen – ${SIMULIERT_STATUS}`}
          aria-label={`Systemstatus: simuliert verbunden – ${SIMULIERT_STATUS}. Systemstatus öffnen`}
        >
          <span className="relative inline-flex size-1.5 rounded-full bg-[var(--amber)]" aria-hidden />
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
              {ungelesen > 0 && <span className={cn("absolute right-2 top-2 size-1.5 rounded-full max-sm:right-3 max-sm:top-3", ungelesenKritisch ? "bg-[var(--seal)]" : "bg-[var(--fg)]")} />}
            </button>
          )}
          items={[
            ...meldungen.map((m) => ({
              label: (
                <span className="block max-w-[280px]">
                  <span className="line-clamp-2 text-[13px] leading-snug text-fg">{m.text}</span>
                  <span className="text-[12px] text-fg-4">
                    {relTime(m.zeit)}
                    {m.minutenGespart ? ` · ${m.minutenGespart} Min. gespart` : ""}
                  </span>
                </span>
              ),
              icon: m.kategorie === "anmeldung" ? <ShieldAlert /> : m.akteur === "ki" ? <Sparkles /> : <Zap />,
              onClick: () => (m.kategorie === "anmeldung" ? nav("/einstellungen?tab=datenschutz&abschnitt=protokoll") : m.akteId ? nav(`/akten/${m.akteId}`) : nav("/automatisierung")),
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
            <button type="button" onClick={toggle} className="kopf-knopf ml-1 flex shrink-0 items-center justify-center gap-2 rounded-md p-1 transition-colors duration-100 hover:bg-[var(--surface-2)] max-sm:size-11 xl:pr-2" aria-label="Benutzermenü">
              <Avatar initialen={user.initialen} farbe={user.farbe} size={28} />
              <span className="kopf-optional hidden text-left leading-tight xl:block">
                <span className="block max-w-[150px] truncate text-[13px] font-medium leading-[18px] text-fg">{user.name}</span>
                <span className="block text-[12px] leading-4 text-fg-4">{ai.label}</span>
              </span>
            </button>
          )}
          items={[
            { label: <span className="block"><span className="block font-medium text-fg">{user.name}</span><span className="text-[12px] text-fg-4">{rollenLabel(user)}</span></span>, icon: <UserIcon />, onClick: () => nav("/einstellungen?tab=team") },
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
