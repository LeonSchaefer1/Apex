import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Building2, CircleHelp, Copy, FlaskConical, FolderOpen, KeyRound, LogOut, Moon, Plus, RefreshCw, ShieldCheck, Sun, MonitorSmartphone, Users } from "lucide-react";
import { AnimatedNumber, Button, Chip, Drawer, Empty, Modal, PageHeader, SearchField, Segmented, Stat, confirmDialog } from "@/components/ui";
import { AppIcon } from "@/components/Logo";
import { WikiPlayer } from "@/components/wiki/WikiPlayer";
import { artikel } from "@/content/wiki";
import { useSession } from "@/store/session";
import { useData } from "@/store/data";
import { toast, useUI, type ThemeWahl } from "@/store/ui";
import { getBackend, getInfo, istConsole, type ConsoleKunde } from "@/lib/backend";
import { today } from "@/core/dates";
import type { Tenant, User } from "@/core/types";
import { DEMO_PASSWORT } from "@/core/seed/tenants";
import { KundenKarte, type KartenAktionen } from "./KundenKarte";
import { NeuerZugang } from "./NeuerZugang";
import { kopieren } from "./helfer";

type Filter = "alle" | "test" | "aktiv" | "pausiert";

/** Apex Console – Anbieter-Bereich: Kunden-Kanzleien und Testzugänge anlegen und verwalten. */
export default function ConsolePage() {
  const nav = useNavigate();
  const { sitzung, logout } = useSession();
  const [kunden, setKunden] = useState<ConsoleKunde[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [suche, setSuche] = useState("");
  const [filter, setFilter] = useState<Filter>("alle");
  const [neu, setNeu] = useState(false);
  const [beschaeftigt, setBeschaeftigt] = useState<string | null>(null);
  const [pw, setPw] = useState<{ user: User; tenant: Tenant; passwort: string } | null>(null);
  const info = getInfo();

  const laden = useCallback(async () => {
    setLaedt(true);
    try {
      const l = await getBackend().console.list();
      setKunden(l);
      setFehler(null);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Die Kundenliste konnte nicht geladen werden.");
    } finally {
      setLaedt(false);
    }
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  const heute = today();
  const kpi = useMemo(() => {
    const l = kunden ?? [];
    return {
      kunden: l.length,
      tests: l.filter((k) => k.tenant.status === "test" && (!k.tenant.testBis || k.tenant.testBis >= heute)).length,
      nutzer: l.reduce((s, k) => s + k.users.length, 0),
      akten: l.reduce((s, k) => s + k.stats.akten, 0),
      aktiv: l.filter((k) => (k.tenant.status ?? "aktiv") === "aktiv").length,
      pausiert: l.filter((k) => k.tenant.status === "pausiert").length,
    };
  }, [kunden, heute]);

  const sichtbar = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return (kunden ?? [])
      .filter((k) => filter === "alle" || (k.tenant.status ?? "aktiv") === filter)
      .filter((k) => !q || [k.tenant.name, k.tenant.stadt, k.tenant.lizenz.lizenzNr, ...k.users.flatMap((u) => [u.name, u.email])].some((x) => x.toLowerCase().includes(q)))
      .sort((a, b) => (b.tenant.createdAt ?? "").localeCompare(a.tenant.createdAt ?? ""));
  }, [kunden, suche, filter]);

  /** Führt eine Aktion aus und lädt die Liste neu – `false`, wenn sie fehlschlug (Fehler wird angezeigt). */
  const mitSperre = async (id: string, fn: () => Promise<void>): Promise<boolean> => {
    setBeschaeftigt(id);
    try {
      await fn();
      await laden();
      return true;
    } catch (e) {
      toast("Das hat nicht geklappt", { text: e instanceof Error ? e.message : String(e), ton: "fehler" });
      return false;
    } finally {
      setBeschaeftigt(null);
    }
  };

  const aktionen: KartenAktionen = {
    status: (k, s) =>
      void (async () => {
        if (s === "pausiert") {
          const ok = await confirmDialog({
            titel: `${k.tenant.kurzname} pausieren?`,
            text: "Niemand aus dieser Kanzlei kann sich anmelden, bis Sie den Zugang reaktivieren. Die Daten bleiben vollständig erhalten.",
            bestaetigen: "Zugang pausieren",
            gefahr: true,
          });
          if (!ok) return;
        }
        if (!(await mitSperre(k.tenant.id, () => getBackend().console.setStatus(k.tenant.id, s)))) return;
        toast(s === "pausiert" ? "Zugang pausiert" : s === "aktiv" ? "Als Kunde freigeschaltet" : "Zugang reaktiviert", { text: k.tenant.name, ton: s === "pausiert" ? "warnung" : "erfolg" });
      })(),
    zuruecksetzen: (k) =>
      void (async () => {
        const ok = await confirmDialog({
          titel: `Daten von ${k.tenant.kurzname} zurücksetzen?`,
          text: "Alle Akten, Fristen, Nachrichten und Buchungen dieser Kanzlei werden verworfen. Beim nächsten Login entsteht ein frischer Datenbestand. Die Zugänge bleiben bestehen.",
          bestaetigen: "Daten zurücksetzen",
          gefahr: true,
        });
        if (!ok) return;
        if (!(await mitSperre(k.tenant.id, () => getBackend().console.reset(k.tenant.id)))) return;
        toast("Daten zurückgesetzt", { text: `${k.tenant.name} startet beim nächsten Login frisch.`, ton: "erfolg" });
      })(),
    loeschen: (k) =>
      void (async () => {
        const ok = await confirmDialog({
          titel: `${k.tenant.name} endgültig löschen?`,
          text: `Die Kanzlei, ihre ${k.users.length} ${k.users.length === 1 ? "Zugang" : "Zugänge"} und alle Daten werden unwiderruflich entfernt.`,
          bestaetigen: "Endgültig löschen",
          gefahr: true,
        });
        if (!ok) return;
        if (!(await mitSperre(k.tenant.id, () => getBackend().console.remove(k.tenant.id)))) return;
        toast("Kanzlei gelöscht", { text: k.tenant.name, ton: "info" });
      })(),
    passwort: (k, u) =>
      void (async () => {
        const ok = await confirmDialog({
          titel: `Neues Passwort für ${u.name}?`,
          text: "Das bisherige Passwort wird sofort ungültig. Das neue Passwort sehen Sie nur einmal – geben Sie es direkt weiter.",
          bestaetigen: "Neues Passwort erzeugen",
        });
        if (!ok) return;
        setBeschaeftigt(k.tenant.id);
        try {
          const passwort = await getBackend().console.neuesPasswort(u.id);
          setPw({ user: u, tenant: k.tenant, passwort });
        } catch (e) {
          toast("Passwort konnte nicht erzeugt werden", { text: e instanceof Error ? e.message : String(e), ton: "fehler" });
        } finally {
          setBeschaeftigt(null);
        }
      })(),
    standardPasswort: (k, u) =>
      void (async () => {
        const ok = await confirmDialog({
          titel: `Standardpasswort für ${u.name} wiederherstellen?`,
          text: `Ein zuvor vergebenes Passwort wird ungültig. Danach gilt wieder das öffentliche Demo-Passwort ${DEMO_PASSWORT} – auch für die Schnellanmeldung.`,
          bestaetigen: "Standardpasswort wiederherstellen",
        });
        if (!ok) return;
        if (!(await mitSperre(k.tenant.id, () => getBackend().console.standardPasswort(u.id)))) return;
        toast("Standardpasswort wiederhergestellt", { text: `${u.name} meldet sich wieder mit ${DEMO_PASSWORT} an.`, ton: "erfolg" });
      })(),
  };

  const abmelden = async () => {
    await logout();
    useData.getState().clear();
    nav("/login", { replace: true });
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative z-10 h-full overflow-y-auto overflow-x-hidden" id="console-scroll">
        <ConsoleKopf name={sitzung && istConsole(sitzung) ? sitzung.name : "AnwaltApex Team"} email={sitzung && istConsole(sitzung) ? sitzung.email : ""} onAbmelden={() => void abmelden()} />

        <main className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-6 sm:px-6 md:pt-8">
          <PageHeader
            eyebrow="Anbieter-Bereich"
            title="Kunden & Testzugänge"
            hilfe="zugang"
            subtitle="Legen Sie Testzugänge für interessierte Kanzleien an und verwalten Sie bestehende Kunden. Jede Kanzlei hat einen streng getrennten Datenbestand – niemand sieht die Daten einer anderen Kanzlei."
            actions={
              <>
                <Button variant="ghost" icon={<RefreshCw className={laedt ? "size-4 animate-spin" : "size-4"} />} onClick={() => void laden()} disabled={laedt}>
                  Aktualisieren
                </Button>
                <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setNeu(true)}>
                  Neuen Testzugang anlegen
                </Button>
              </>
            }
          />

          {/* Kennzahlen */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Kanzleien", wert: kpi.kunden, icon: <Building2 className="size-4" />, ton: "ink" as const, sub: `${kpi.aktiv} aktiv · ${kpi.pausiert} pausiert` },
              { label: "Aktive Tests", wert: kpi.tests, icon: <FlaskConical className="size-4" />, ton: "violet" as const, sub: "Testzugang läuft" },
              { label: "Nutzer gesamt", wert: kpi.nutzer, icon: <Users className="size-4" />, ton: "green" as const, sub: "über alle Kanzleien" },
              { label: "Akten gesamt", wert: kpi.akten, icon: <FolderOpen className="size-4" />, ton: "amber" as const, sub: "streng getrennt" },
            ].map((x, i) => (
              <motion.div key={x.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34, delay: 0.05 + i * 0.04 }}>
                <Stat label={x.label} icon={x.icon} tone={x.ton} value={kunden ? <AnimatedNumber value={x.wert} /> : <span className="shimmer inline-block h-7 w-12 rounded-[8px]" />} sub={x.sub} />
              </motion.div>
            ))}
          </div>

          {/* Werkzeugleiste */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <SearchField id="console-suche" value={suche} onChange={setSuche} placeholder="Kanzlei, Stadt, Lizenz oder E-Mail suchen …" className="min-w-0 flex-1 basis-[260px] sm:max-w-[380px]" />
            <Segmented<Filter>
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "alle", label: "Alle", count: kunden?.length },
                { value: "test", label: "Test", count: kunden?.filter((k) => k.tenant.status === "test").length },
                { value: "aktiv", label: "Aktiv", count: kunden?.filter((k) => (k.tenant.status ?? "aktiv") === "aktiv").length },
                { value: "pausiert", label: "Pausiert", count: kunden?.filter((k) => k.tenant.status === "pausiert").length },
              ]}
            />
            {info && (
              <Chip tone="outline" className="ml-auto hidden md:inline-flex" title={info.modus === "demo" ? "Demo-Betrieb: Zugänge werden in diesem Browser gespeichert." : "Server-Betrieb"}>
                <ShieldCheck className="size-3 text-green" />
                {info.modus === "demo" ? "Demo-Betrieb · Daten im Browser" : "Server-Betrieb"}
              </Chip>
            )}
          </div>

          {fehler && (
            <div className="mb-4 rounded-[16px] bg-seal-soft px-4 py-3 text-[13.5px] text-seal" role="alert">
              {fehler} <button type="button" className="ml-2 font-semibold underline" onClick={() => void laden()}>Erneut versuchen</button>
            </div>
          )}

          {!kunden ? (
            <div className="grid gap-3">
              {[0, 1, 2].map((k) => (
                <div key={k} className="shimmer h-[190px] rounded-[24px]" />
              ))}
            </div>
          ) : sichtbar.length === 0 ? (
            <div className="sheet rounded-[24px]">
              <Empty
                icon={<Building2 className="size-6" />}
                title={kunden.length ? "Keine Kanzlei passt zur Suche" : "Noch keine Kunden"}
                text={kunden.length ? "Ändern Sie den Suchbegriff oder den Filter." : "Legen Sie den ersten Testzugang an – in einer Minute ist die Kanzlei startklar."}
                action={
                  kunden.length ? (
                    <Button variant="secondary" onClick={() => { setSuche(""); setFilter("alle"); }}>
                      Filter zurücksetzen
                    </Button>
                  ) : (
                    <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setNeu(true)}>
                      Neuen Testzugang anlegen
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <div className="grid gap-3">
              <AnimatePresence initial={false}>
                {sichtbar.map((k, i) => (
                  <KundenKarte key={k.tenant.id} k={k} i={i} aktionen={aktionen} beschaeftigt={beschaeftigt === k.tenant.id} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </main>

        <NeuerZugang open={neu} onClose={() => setNeu(false)} onAngelegt={() => void laden()} />
        <PasswortDialog daten={pw} onClose={() => setPw(null)} />
        <ConsoleHilfe />
      </div>
    </MotionConfig>
  );
}

const THEME_ICON: Record<ThemeWahl, React.ReactNode> = {
  system: <MonitorSmartphone className="size-[18px]" />,
  light: <Sun className="size-[18px]" />,
  dark: <Moon className="size-[18px]" />,
};

function ConsoleKopf({ name, email, onAbmelden }: { name: string; email: string; onAbmelden: () => void }) {
  const { theme, setTheme } = useUI();
  const naechstes: ThemeWahl = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  return (
    <header className="sticky top-0 z-40 px-3 pt-[max(10px,env(safe-area-inset-top))] sm:px-5">
      <div className="glass mx-auto flex h-14 max-w-[1200px] items-center gap-2 rounded-[22px] pl-3 pr-2 sm:gap-3 sm:pl-4">
        <AppIcon size={32} />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[15px] font-semibold tracking-[-0.02em]">Apex Console</div>
          <div className="hidden truncate text-[11.5px] text-fg-3 sm:block">{name}</div>
        </div>
        <Chip tone="violet" className="hidden sm:inline-flex">
          Anbieter-Bereich
        </Chip>
        <div className="ml-auto flex items-center gap-1">
          {email && <span className="mono mr-2 hidden text-[12px] text-fg-3 md:inline">{email}</span>}
          <button type="button" className="icon-btn" onClick={() => setTheme(naechstes)} aria-label={`Darstellung: ${theme === "system" ? "wie System" : theme === "light" ? "hell" : "dunkel"} – umschalten`} title="Darstellung umschalten">
            {THEME_ICON[theme]}
          </button>
          <Button variant="secondary" size="sm" icon={<LogOut className="size-4" />} onClick={onAbmelden}>
            Abmelden
          </Button>
        </div>
      </div>
    </header>
  );
}

function PasswortDialog({ daten, onClose }: { daten: { user: User; tenant: Tenant; passwort: string } | null; onClose: () => void }) {
  return (
    <Modal
      open={!!daten}
      onClose={onClose}
      size="sm"
      icon={<KeyRound className="size-5" />}
      title="Neues Passwort erzeugt"
      subtitle={daten ? `${daten.user.name} · ${daten.tenant.kurzname}` : undefined}
      footer={
        <Button variant="primary" onClick={onClose}>
          Fertig
        </Button>
      }
    >
      {daten && (
        <div className="grid gap-3">
          <div className="flex items-center gap-3 rounded-[16px] bg-[var(--ink-softer)] p-3.5 shadow-[inset_0_0_0_1px_var(--line)]">
            <span className="mono min-w-0 flex-1 select-all truncate text-[18px] font-semibold tracking-[0.02em]">{daten.passwort}</span>
            <Button size="sm" variant="secondary" icon={<Copy className="size-3.5" />} onClick={() => void kopieren(daten.passwort, "Passwort")}>
              Kopieren
            </Button>
          </div>
          <div className="grid gap-1 text-[13px] text-fg-2">
            <div>
              Anmeldung mit <span className="mono text-fg">{daten.user.email}</span>
            </div>
            <div className="text-fg-3">Das bisherige Passwort ist ab sofort ungültig. Dieses Passwort wird nicht noch einmal angezeigt.</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="justify-self-start"
            icon={<Copy className="size-3.5" />}
            onClick={() => void kopieren(`Ihre neuen Zugangsdaten für AnwaltApex\n\nAnmeldung: ${window.location.origin}/login\nE-Mail: ${daten.user.email}\nPasswort: ${daten.passwort}`, "Zugangsdaten")}
          >
            Zugangsdaten als Text kopieren
          </Button>
        </div>
      )}
    </Modal>
  );
}

/** Schnellhilfe für die Console (die Kanzlei-App bringt ihre eigene mit). */
function ConsoleHilfe() {
  const { hilfeThema, zeigeHilfe } = useUI();
  const a = artikel(hilfeThema);
  return (
    <Drawer open={!!a} onClose={() => zeigeHilfe(null)} title={a ? `Schnellhilfe: ${a.titel}` : ""} subtitle={a?.kurz} icon={<CircleHelp className="size-5" />} width={480}>
      {a && <WikiPlayer artikel={a} kompakt onNavigate={() => zeigeHilfe(null)} />}
    </Drawer>
  );
}
