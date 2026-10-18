import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Bell, Search, Sun, Moon, MonitorSmartphone, LogOut, Settings, LifeBuoy, Building2, Sparkles, Zap, User as UserIcon, Keyboard, ShieldAlert, RadioTower } from "lucide-react";
import { navFor, SYSTEMSTATUS } from "@/app/nav";
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
import { darfVerwalten } from "@/lib/backend";
import { useMedia } from "@/lib/useMedia";

/** Im Prototyp sind beA, E-Mail und Bank simuliert – einheitlicher Wortlaut mit Posteingang, Bankabgleich und Systemstatus. */
import { SIMULIERT_STATUS, SYSTEMSTATUS_NAME } from "@/lib/betriebsstatus";
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
    <header
      ref={kopfRef}
      className={cn("kopfleiste relative z-40 shrink-0 px-3 pt-[max(12px,env(safe-area-inset-top))] transition-[margin-top] duration-200 md:px-5", gescrollt && "kopfleiste-gescrollt")}
      style={kopfWeg ? { marginTop: -(kopfRef.current?.offsetHeight ?? 48) } : undefined}
      data-ausgeblendet={kopfWeg || undefined}
      onFocusCapture={kopfZeigen}
    >
      <div className={cn("kopf-innen glass flex h-14 items-center gap-1 rounded-[22px] pl-3 pr-2 sm:gap-2 md:pl-4", gescrollt && "glass-deckend")}>
        {/* Mobil: App-Icon + Seitentitel – unter 360 px ohne App-Icon, der Titel bricht bei Bedarf in eine zweite Zeile um (I4-T01-01) */}
        <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
          <AppIcon size={28} className="max-[359px]:hidden" />
          <span className="truncate text-[15px] font-semibold tracking-[-0.02em] max-[379px]:text-[14px] max-[379px]:tracking-[-0.03em] max-[359px]:overflow-visible max-[359px]:whitespace-normal max-[359px]:text-[13.5px] max-[359px]:leading-[1.15] max-[359px]:hyphens-auto">
            {item?.label ?? "Apex"}
          </span>
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

        <div className="hidden min-w-0 flex-1 justify-center md:flex md:max-lg:grow-[0.25]">
          <ApexIsland />
        </div>

        {/* Mobil (< 640 px): Bedienflächen der Kopfleiste mindestens 44 × 44 px (Daumen, WCAG 2.5.5) */}
        <button type="button" className="icon-btn md:hidden max-sm:!size-11" aria-label="Suchen" onClick={() => setPalette(true)}>
          <Search className="size-[18px]" />
        </button>

        {/* Mobil: Systemstatus in 1 Tippen (I3-T12-02) – Symbol + Farbpunkt, Name für Screenreader; Desktop nutzt die Textanzeige rechts */}
        <button
          type="button"
          onClick={() => nav(SYSTEMSTATUS.to)}
          className="icon-btn relative md:hidden max-sm:!size-11"
          aria-label={SYSTEMSTATUS_NAME}
          title={`Systemstatus öffnen – ${SIMULIERT_STATUS}`}
        >
          <RadioTower className="size-[18px]" aria-hidden />
          <span className="absolute right-2 top-2 size-2 rounded-full bg-[var(--amber)] ring-2 ring-[var(--glass-strong)] max-sm:right-2.5 max-sm:top-2.5" aria-hidden />
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
              className="icon-btn relative max-sm:!size-11"
              aria-label={ungelesen ? `Benachrichtigungen – ${ungelesen} neu` : "Benachrichtigungen"}
            >
              <Bell className="size-[18px]" />
              {ungelesen > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-seal ring-2 ring-[var(--glass-strong)] max-sm:right-2.5 max-sm:top-2.5" />}
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
            <button type="button" onClick={toggle} className="kopf-knopf ml-0.5 flex shrink-0 items-center justify-center gap-2 rounded-full p-0.5 pr-0.5 transition-colors hover:bg-ink-softer max-sm:size-11 xl:pr-3" aria-label="Benutzermenü">
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
