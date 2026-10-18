import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Building2, CircleHelp, FileClock, FlaskConical, FolderOpen, KeyRound, LogOut, Moon, Plus, RefreshCw, ShieldCheck, Sun, MonitorSmartphone, Users } from "lucide-react";
import { Button, Chip, Drawer, Empty, Field, Input, Modal, PageHeader, SearchField, Segmented, Select, Stat, confirmDialog } from "@/components/ui";
import { AppIcon } from "@/components/Logo";
import { WikiPlayer } from "@/components/wiki/WikiPlayer";
import { artikel } from "@/content/wiki";
import { useSession } from "@/store/session";
import { useData } from "@/store/data";
import { toast, useUI, type ThemeWahl } from "@/store/ui";
import { getBackend, getInfo, istConsole, type ConsoleKunde } from "@/lib/backend";
import { fehlerFeld } from "@/lib/backend/types";
import { ANBIETER_TEAM, pruefeConsolePasswortAnlass, type ConsolePasswortAnlass } from "@/lib/backend/protokoll";
import { rollenLabel } from "@/lib/rollen";
import { today } from "@/core/dates";
import type { Tenant, User } from "@/core/types";
import { DEMO_PASSWORT } from "@/core/seed/tenants";
import { fmtNum } from "@/core/dates";
import { KundenKarte, type KartenAktionen } from "./KundenKarte";
import { NeuerZugang, ZugangsDaten } from "./NeuerZugang";
import { einladungsText, kopieren } from "./helfer";
import { kanzleiStatusText, kanzleiStatusZahlen } from "@/core/kennzahlen";

/** Offenlegung gegenüber der Kanzlei – steht in Bestätigung und Ergebnis jeder Passwortvergabe durch Apex. */
const PROTOKOLL_SATZ = "Die Kanzlei sieht diesen Vorgang in ihrem Protokoll (Einstellungen → Datenschutz). Die Person muss bei der nächsten Anmeldung ein eigenes Passwort festlegen.";

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
  const [pw, setPw] = useState<{ user: User; tenant: Tenant; passwort: string; hauptnutzer: boolean } | null>(null);
  const [anforderung, setAnforderung] = useState<{ k: ConsoleKunde; u: User } | null>(null);
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
      // Aufteilung nach Status – aktiv + im Test + pausiert ergibt die Gesamtzahl (I5-T21-01)
      status: kanzleiStatusZahlen(l.map((k) => k.tenant)),
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
          text: "Alle Akten, Fristen, Nachrichten und Buchungen dieser Kanzlei werden verworfen. Beim nächsten Login entsteht ein frischer Datenbestand. Die Zugänge bleiben bestehen. Die Kanzlei sieht diesen Vorgang in ihrem Protokoll (Einstellungen → Datenschutz).",
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
    // Neues Startpasswort nur mit Angabe, wer es angefordert hat und warum (I3-T21-02) – Dialog statt einfacher Rückfrage
    passwort: (k, u) => setAnforderung({ k, u }),
    standardPasswort: (k, u) =>
      void (async () => {
        const ok = await confirmDialog({
          titel: `Demo-Passwort für ${u.name} wiederherstellen?`,
          text: `Nur für Präsentationskanzleien: Ein zuvor vergebenes Passwort und eine eingerichtete Zwei-Faktor-Anmeldung werden ungültig. Danach gilt wieder das öffentliche Demo-Passwort ${DEMO_PASSWORT} – auch für die Schnellanmeldung. Die Kanzlei sieht diesen Vorgang in ihrem Protokoll (Einstellungen → Datenschutz).`,
          bestaetigen: "Demo-Passwort wiederherstellen",
        });
        if (!ok) return;
        if (!(await mitSperre(k.tenant.id, () => getBackend().console.standardPasswort(u.id)))) return;
        toast("Demo-Passwort wiederhergestellt", { text: `${u.name} meldet sich wieder mit ${DEMO_PASSWORT} an.`, ton: "erfolg" });
      })(),
    einladung: (k, u) => void kopieren(einladungsText({ tenant: k.tenant, user: u, hauptnutzer: k.users[0]?.id === u.id, beispieldaten: k.stats.akten > 0 ? true : undefined }), "Einladung"),
  };

  const abmelden = async () => {
    await logout();
    useData.getState().clear();
    nav("/login", { replace: true });
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative z-10 h-full overflow-y-auto overflow-x-hidden" id="console-scroll">
        <ConsoleKopf name={sitzung && istConsole(sitzung) ? sitzung.name : ANBIETER_TEAM} email={sitzung && istConsole(sitzung) ? sitzung.email : ""} onAbmelden={() => void abmelden()} />

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

          {/* Kennzahlen – aus derselben Liste wie die Karten; vor dem Laden „–“ statt vorläufiger Werte */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy={!kunden}>
            {[
              { label: "Kanzleien", wert: kpi.kunden, icon: <Building2 className="size-4" />, ton: "ink" as const, sub: kunden ? kanzleiStatusText(kpi.status) : "wird geladen …" },
              { label: "Aktive Tests", wert: kpi.tests, icon: <FlaskConical className="size-4" />, ton: "violet" as const, sub: "Testzugang läuft" },
              { label: "Nutzer gesamt", wert: kpi.nutzer, icon: <Users className="size-4" />, ton: "green" as const, sub: "über alle Kanzleien" },
              { label: "Akten gesamt", wert: kpi.akten, icon: <FolderOpen className="size-4" />, ton: "amber" as const, sub: "streng getrennt" },
            ].map((x, i) => (
              <motion.div key={x.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34, delay: 0.05 + i * 0.04 }}>
                <Stat label={x.label} icon={x.icon} tone={x.ton} value={kunden ? <span className="num">{fmtNum(x.wert)}</span> : <span className="text-fg-4" aria-label="wird geladen">–</span>} sub={x.sub} />
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
        <AnforderungDialog
          daten={anforderung}
          consoleName={sitzung && istConsole(sitzung) ? sitzung.name : ANBIETER_TEAM}
          onClose={() => setAnforderung(null)}
          onErzeugt={(k, u, passwort) => {
            setAnforderung(null);
            setPw({ user: u, tenant: k.tenant, passwort, hauptnutzer: k.users[0]?.id === u.id });
            void laden();
          }}
        />
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
          <div className="hidden truncate text-[12.5px] text-fg-3 sm:block">{name}</div>
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

const ANDERE = "__andere__";

/**
 * Neues Startpasswort: Pflichtangaben „Angefordert von“ (Person der Kanzlei – bevorzugt Partner/Administration – oder
 * Freitext) und „Anlass“; dazu, wer bei Apex es vergibt. Alles steht im Kanzleiprotokoll; Partner und Administration
 * erhalten einen Hinweis in der Glocke.
 */
function AnforderungDialog({ daten, consoleName, onClose, onErzeugt }: { daten: { k: ConsoleKunde; u: User } | null; consoleName: string; onClose: () => void; onErzeugt: (k: ConsoleKunde, u: User, passwort: string) => void }) {
  const [wer, setWer] = useState("");
  const [werFrei, setWerFrei] = useState("");
  const [anlass, setAnlass] = useState("");
  const [bearbeiter, setBearbeiter] = useState("");
  const [fehler, setFehler] = useState<Partial<Record<"angefordertVon" | "anlass" | "allgemein", string>>>({});
  const [laeuft, setLaeuft] = useState(false);
  const personen = useMemo(() => {
    if (!daten) return [];
    const rang = (x: User) => (x.rolle === "partner" ? 0 : x.rolle === "admin" ? 1 : 2);
    return [...daten.k.users].sort((a, b) => rang(a) - rang(b) || a.name.localeCompare(b.name, "de"));
  }, [daten]);

  useEffect(() => {
    if (!daten) return;
    setWer("");
    setWerFrei("");
    setAnlass("");
    // Vorschlag: die feste Ansprechpartnerin dieser Kanzlei bei Apex (änderbar)
    setBearbeiter(daten.k.tenant.ansprechpartner?.name ?? consoleName);
    setFehler({});
  }, [daten, consoleName]);

  const angefordertVon = wer === ANDERE ? werFrei : personen.find((p) => p.id === wer)?.name ?? "";
  const erzeugen = async () => {
    if (!daten) return;
    const angabe: ConsolePasswortAnlass = { angefordertVon, anlass, bearbeiter: bearbeiter.trim() || consoleName };
    const f = pruefeConsolePasswortAnlass(angabe);
    setFehler(f);
    if (Object.keys(f).length) {
      document.getElementById(f.angefordertVon ? (wer === ANDERE ? "sp-wer-frei" : "sp-wer") : "sp-anlass")?.focus();
      return;
    }
    setLaeuft(true);
    try {
      const passwort = await getBackend().console.neuesPasswort(daten.u.id, angabe);
      onErzeugt(daten.k, daten.u, passwort);
    } catch (e) {
      const feld = fehlerFeld(e);
      const text = e instanceof Error ? e.message : String(e);
      setFehler(feld === "angefordertVon" || feld === "anlass" ? { [feld]: text } : { allgemein: text });
    } finally {
      setLaeuft(false);
    }
  };
  const fehlerText = (id: string, t?: string) =>
    t ? (
      <span id={id} className="text-seal">
        {t}
      </span>
    ) : undefined;

  return (
    <Modal
      open={!!daten}
      onClose={onClose}
      size="md"
      icon={<KeyRound className="size-5" />}
      title={daten ? `Neues Startpasswort für ${daten.u.name}` : "Neues Startpasswort"}
      subtitle={daten ? `${daten.k.tenant.name} · nur auf Wunsch der Kanzlei` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" icon={<KeyRound className="size-4" />} loading={laeuft} onClick={() => void erzeugen()}>
            Neues Startpasswort erzeugen
          </Button>
        </>
      }
    >
      {daten && (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void erzeugen();
          }}
        >
          <p className="text-[13px] leading-relaxed text-fg-2">
            Das bisherige Passwort wird sofort ungültig. Das neue Startpasswort sehen Sie nur einmal – geben Sie es getrennt weiter (telefonisch oder per SMS). {PROTOKOLL_SATZ}
          </p>
          <Field label="Angefordert von (Name in der Kanzlei)" htmlFor="sp-wer" hint={fehlerText("sp-wer-fehler", fehler.angefordertVon) ?? "Bevorzugt Partner bzw. Administration der Kanzlei."}>
            <Select id="sp-wer" value={wer} onChange={(e) => setWer(e.target.value)} aria-invalid={!!fehler.angefordertVon && wer !== ANDERE} aria-describedby={fehler.angefordertVon ? "sp-wer-fehler" : undefined} data-autofocus>
              <option value="">Bitte wählen …</option>
              {personen.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {rollenLabel(p)}
                </option>
              ))}
              <option value={ANDERE}>Andere Person (Name eingeben) …</option>
            </Select>
            {wer === ANDERE && (
              <Input id="sp-wer-frei" className="mt-2" value={werFrei} onChange={(e) => setWerFrei(e.target.value)} placeholder="Vor- und Nachname" maxLength={120} aria-label="Name der anfordernden Person" aria-invalid={!!fehler.angefordertVon} aria-describedby={fehler.angefordertVon ? "sp-wer-fehler" : undefined} autoComplete="off" />
            )}
          </Field>
          <Field label="Anlass" htmlFor="sp-anlass" hint={fehlerText("sp-anlass-fehler", fehler.anlass) ?? "Steht im Kanzleiprotokoll, z. B. „Passwort vergessen – telefonisch angefordert“."}>
            <Input id="sp-anlass" value={anlass} onChange={(e) => setAnlass(e.target.value)} placeholder="z. B. Passwort vergessen – telefonisch angefordert" maxLength={200} aria-invalid={!!fehler.anlass} aria-describedby={fehler.anlass ? "sp-anlass-fehler" : undefined} autoComplete="off" />
          </Field>
          <Field label="Vergeben durch (Apex)" htmlFor="sp-bearbeiter" hint="Ihr Name – die Kanzlei sieht, wer bei Apex das Passwort vergeben hat.">
            <Input id="sp-bearbeiter" value={bearbeiter} onChange={(e) => setBearbeiter(e.target.value)} maxLength={120} autoComplete="name" />
          </Field>
          {fehler.allgemein && (
            <div role="alert" className="rounded-[12px] bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal">
              {fehler.allgemein}
            </div>
          )}
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      )}
    </Modal>
  );
}

function PasswortDialog({ daten, onClose }: { daten: { user: User; tenant: Tenant; passwort: string; hauptnutzer: boolean } | null; onClose: () => void }) {
  return (
    <Modal
      open={!!daten}
      onClose={onClose}
      size="md"
      icon={<KeyRound className="size-5" />}
      title="Neues Startpasswort erzeugt"
      subtitle={daten ? `${daten.user.name} · ${daten.tenant.kurzname}` : undefined}
      footer={
        <Button variant="primary" onClick={onClose}>
          Fertig
        </Button>
      }
    >
      {daten && (
        <div className="grid gap-4">
          <p className="flex items-start gap-2 rounded-[14px] bg-[var(--ink-softer)] px-3.5 py-2.5 text-[13px] leading-relaxed text-fg-2 ring-1 ring-[var(--line)]">
            <FileClock className="mt-0.5 size-4 shrink-0 text-ink" />
            <span>
              Das bisherige Passwort ist ab sofort ungültig. {PROTOKOLL_SATZ} Dieses Startpasswort wird nicht noch einmal angezeigt.
            </span>
          </p>
          <ZugangsDaten user={daten.user} passwort={daten.passwort} text={einladungsText({ tenant: daten.tenant, user: daten.user, hauptnutzer: daten.hauptnutzer, neuesPasswort: true })} />
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
