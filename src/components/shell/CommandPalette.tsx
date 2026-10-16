import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { Command } from "cmdk";
import { AnimatePresence, motion } from "motion/react";
import { FolderOpen, FileText, User, CalendarClock, CalendarPlus, Inbox, Keyboard, Library, Sparkles, Plus, Calculator, CornerDownLeft, Zap, Landmark, Percent, Receipt, Scale, Timer, UsersRound, Palette, X, Building2, Infinity as InfinityIcon, KeyRound, FileStack } from "lucide-react";
import { toast, useUI } from "@/store/ui";
import { useData } from "@/store/data";
import { useSession } from "@/store/session";
import { bereichErlaubt, navFuer } from "@/app/nav";
import { darfLizenzSehen, darfVerwalten, istConsole } from "@/lib/backend";
import type { Rolle } from "@/core/types";
import { akteAusPfad, oeffneZeiterfassung } from "./Tastenkuerzel";
import { search, snippet } from "@/core/search";
import { ENTSCHEIDUNGEN } from "@/core/rechtsprechung";
import { fmtDate } from "@/core/dates";
import { Highlight } from "@/components/Highlight";
import type { Akte } from "@/core/types";

/** Sprungziel der Suche: Schnellaktion, Bereich (Navigation) oder Unterbereich (Reiter). */
interface Ziel {
  to: string;
  label: string;
  sub: string;
  icon: ReactNode;
  /** zusätzliche Suchbegriffe (Synonyme) */
  stichworte?: string;
  /** Tastaturkürzel außerhalb der Suche (z. B. „W“) */
  kuerzel?: string;
  /** statt Navigation: Aktion im Rahmen (Dialog, Übersicht) */
  aktion?: "wiedervorlage" | "zeit" | "kuerzel" | "assistent";
}

/** Schnellaktionen – die KI-Fallanalyse startet direkt für die zuletzt bearbeitete offene Akte. */
function schnellaktionen(akten: Akte[]): Ziel[] {
  const zuletzt = akten.filter((a) => a.status === "offen").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return [
    { to: "/akten?neu=1", label: "Neue Akte anlegen", sub: "Mandatsaufnahme mit automatischer Vollmacht & Deckungsanfrage", icon: <Plus />, stichworte: "Mandat Mandatsaufnahme" },
    { to: "#wiedervorlage", aktion: "wiedervorlage", label: "Wiedervorlage anlegen", sub: "Akte, Datum, Titel – in einer Akte für diese Akte", icon: <CalendarPlus />, kuerzel: "W", stichworte: "Wiedervorlage WV Erinnerung" },
    { to: "#zeit", aktion: "zeit", label: "Zeit erfassen", sub: "Minuten tippen, Enter – in einer Akte für diese Akte, abrechenbar", icon: <Timer />, kuerzel: "Z", stichworte: "Zeiteintrag Zeiterfassung Stunden buchen Zeit buchen Arbeitszeit Minuten erfassen" },
    { to: "/fristen?rechner=1", label: "Frist berechnen", sub: "Fristenrechner nach § 222 ZPO mit Feiertagen Ihres Bundeslands", icon: <Calculator />, kuerzel: "F", stichworte: "Fristenrechner Rechner" },
    { to: "/abrechnung?tab=rvg", label: "RVG-Gebühren berechnen", sub: "Gebührentabelle 2025 inkl. Anrechnung und Auslagen", icon: <Calculator />, stichworte: "RVG-Rechner Gebührenrechner" },
    { to: "/abrechnung?tab=zinsen", label: "Zinsrechner", sub: "Verzugszinsen nach § 288 BGB mit Basiszins", icon: <Percent />, stichworte: "Zinsen Verzugszinsen Basiszins Zinsrechner" },
    zuletzt
      ? { to: `/ki?akte=${encodeURIComponent(zuletzt.id)}&start=1`, label: "KI-Fallanalyse starten", sub: `Zuletzt bearbeitet: ${zuletzt.aktenzeichen} · ${zuletzt.titel}`, icon: <Sparkles />, stichworte: "Erfolgsaussicht Präzedenzfälle Analyse" }
      : { to: "/ki", label: "Apex KI öffnen – Fallanalyse", sub: "Akte wählen – Erfolgsaussicht, Präzedenzfälle, nächste Schritte", icon: <Sparkles />, stichworte: "Erfolgsaussicht Präzedenzfälle Analyse" },
    { to: "/automatisierung", label: "38h-Motor öffnen", sub: "Automatiken, Protokoll und gesparte Zeit der letzten 7 Tage", icon: <Zap />, stichworte: "Automatisierung Automatiken" },
    { to: "#assistent", aktion: "assistent", label: "Apex Assistent öffnen", sub: "Fragen, suchen, Wiedervorlagen vorschlagen – per Text oder Sprache", icon: <Sparkles className="text-violet" />, stichworte: "Assistent Kugel Sprache KI fragen" },
    { to: "#kuerzel", aktion: "kuerzel", label: "Tastaturkürzel", sub: "Alle Kürzel auf einen Blick", icon: <Keyboard />, kuerzel: "?", stichworte: "Shortcuts Tasten Kürzel" },
  ];
}

/** Nur Ziele, die die Rolle öffnen darf (Auszubildende: keine Abrechnung, kein Zinsrechner, kein RVG, kein Bankabgleich). */
function erlaubt(z: Ziel, rolle: Rolle | undefined): boolean {
  if (z.aktion === "zeit") return bereichErlaubt("/abrechnung", rolle);
  if (z.to.startsWith("#")) return true;
  // Lizenz nur für Partner und Administration
  if (z.to.startsWith("/einstellungen?tab=lizenz")) return darfLizenzSehen(rolle);
  return bereichErlaubt(z.to.split("?")[0], rolle);
}

/** Reiter, die nur bei passender Suche erscheinen („Bankabgleich", „Team" …). */
const UNTERBEREICHE: Ziel[] = [
  { to: "/abrechnung?tab=rechnungen", label: "Rechnungen", sub: "Abrechnung · alle Rechnungen mit Zahlungsstatus", icon: <Receipt /> },
  { to: "/abrechnung?tab=bank", label: "Bankabgleich", sub: "Abrechnung · Kontoumsätze automatisch zuordnen", icon: <Landmark />, stichworte: "Bank Kontoumsätze Zahlungen" },
  { to: "/abrechnung?tab=forderung", label: "Forderungskonto", sub: "Abrechnung · Hauptforderung, Zinsen und Kosten", icon: <Scale />, stichworte: "Forderung Kosten" },
  { to: "/abrechnung?tab=zeit", label: "Zeiterfassung", sub: "Abrechnung · Stoppuhr und Zeiteinträge", icon: <Timer />, stichworte: "Zeiten Stoppuhr Zeitliste" },
  { to: "/abrechnung?aktion=sammelabrechnung", label: "Sammelabrechnung", sub: "Abrechnung · mehrere Akten in einem Durchgang abrechnen", icon: <FileStack />, stichworte: "Sammelrechnung Stapelabrechnung RSV-Akten abrechnen mehrere Akten" },
  // Einstellungen: jeder Reiter mit Direktlink und Synonymen
  { to: "/einstellungen?tab=kanzlei", label: "Kanzlei", sub: "Einstellungen · Name, Anschrift, Bundesland (Feiertage), Steuernummer", icon: <Building2 />, stichworte: "Kanzleidaten Anschrift Adresse Bundesland Kanzleisitz Steuernummer USt-IdNr Briefkopf" },
  { to: "/einstellungen?tab=team", label: "Team & Zugänge", sub: "Einstellungen · Personen einladen, Rollen, Abwesenheit und Vertretung", icon: <UsersRound />, stichworte: "Benutzer Nutzer Mitarbeiter Einladen Rolle Abwesenheit Vertretung Startpasswort" },
  { to: "/einstellungen?tab=lizenz", label: "Lizenz", sub: "Einstellungen · Lifetime-Lizenz, Arbeitsplätze, Wartung, Übertragbarkeit", icon: <InfinityIcon />, stichworte: "Lizenz Lifetime Wartung Arbeitsplätze Lizenznummer Escrow Übertragbarkeit Preis" },
  { to: "/einstellungen?tab=datenschutz", label: "Datenschutz & Verträge", sub: "Einstellungen · § 43e BRAO, AVV, Unterauftragnehmer, Löschkonzept, Protokoll", icon: <Scale />, stichworte: "Datenschutz 43e BRAO AVV Auftragsverarbeitung Art. 28 DSGVO Unterauftragnehmer Löschkonzept Aufbewahrung Protokoll Verschwiegenheit 203 Verträge Muster" },
  { to: "/einstellungen?tab=ki", label: "KI-Einstellungen", sub: "Einstellungen · Live-KI oder Demo-KI, Datenfluss, Verarbeitungsort", icon: <Sparkles />, stichworte: "KI Künstliche Intelligenz Claude Anthropic Demo-KI Live-KI Verarbeitungsort Datenfluss" },
  { to: "/einstellungen?tab=darstellung", label: "Darstellung", sub: "Einstellungen · Hell, Dunkel, Schriftgröße, Apex Island, Kugel, Tastaturkürzel", icon: <Palette />, stichworte: "Dunkelmodus Hellmodus Theme Schriftgröße Schrift größer Kugel Apex Island Live-Meldungen Tastaturkürzel Einzeltasten Kürzel abschalten" },
  { to: "/einstellungen?tab=datenschutz&abschnitt=sicherheit", label: "Anmeldung & Sicherheit", sub: "Einstellungen · Passwort, Zwei-Faktor-Anmeldung, Sperre bei Inaktivität", icon: <KeyRound />, stichworte: "Sicherheit Passwort Passwort ändern Kennwort Zwei-Faktor 2FA MFA Authenticator Sperre Inaktivität Anmeldung" },
];

function bereicheFuer(rolle: Rolle | undefined): Ziel[] {
  return navFuer(rolle).map((n) => {
    const Icon = n.icon;
    return { to: n.to, label: n.label, sub: n.beschreibung, icon: <Icon />, stichworte: n.kurz };
  });
}


/** Globale Suche (⌘K / Strg+K): Volltext über Akten, Dokumente (OCR), Kontakte, Fristen, Posteingang und Rechtsprechung – lokal, ohne Wartezeit. */
export function CommandPalette() {
  const { paletteOffen, setPalette, oeffneAssistent } = useUI();
  const nav = useNavigate();
  const loc = useLocation();
  const data = useData((s) => s.data);
  const sitzung = useSession((s) => s.sitzung);
  const kanzlei = sitzung && !istConsole(sitzung) ? sitzung : null;
  const rolle = kanzlei?.user.rolle;
  const verwalten = !!rolle && darfVerwalten(rolle);
  const [q, setQ] = useState("");
  const aktionen = useMemo(() => schnellaktionen(data.akten).filter((z) => erlaubt(z, rolle)), [data.akten, rolle]);
  const bereiche = useMemo(() => bereicheFuer(rolle), [rolle]);
  const unterbereiche = useMemo(
    () =>
      UNTERBEREICHE.filter((z) => erlaubt(z, rolle)).map((z) =>
        z.to === "/einstellungen?tab=team" && !verwalten ? { ...z, label: "Ihr Zugang", sub: "Einstellungen · Profil, Lizenztyp, Abwesenheit" } : z,
      ),
    [rolle, verwalten],
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        // gesperrter Bildschirm: keine Suche über verborgenen Inhalten
        if (useSession.getState().gesperrt) return;
        // Ein modaler Dialog hält den Fokus (Hintergrund inert) – die Suche öffnet erst nach dem Schließen
        if (!useUI.getState().paletteOffen && document.querySelector('[aria-modal="true"]')) {
          toast("Suche gerade nicht verfügbar", { text: "Bitte schließen Sie zuerst den offenen Dialog (Esc).", ton: "info" });
          return;
        }
        setPalette(!useUI.getState().paletteOffen);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [setPalette]);

  // Escape schließt die Suche – vor allen anderen Ebenen (Assistent, Dialoge darunter bleiben offen).
  useEffect(() => {
    if (!paletteOffen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setPalette(false);
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [paletteOffen, setPalette]);

  useEffect(() => {
    if (!paletteOffen) setQ("");
  }, [paletteOffen]);

  const res = useMemo(() => {
    const t0 = performance.now();
    if (q.trim().length < 2) return null;
    const kontaktName = (id?: string) => data.kontakte.find((k) => k.id === id)?.name ?? "";
    const akten = search(data.akten, q, [
      { get: (a) => a.aktenzeichen, weight: 4 },
      { get: (a) => a.titel, weight: 3 },
      { get: (a) => a.gerichtsAz, weight: 3 },
      { get: (a) => kontaktName(a.mandantId), weight: 2 },
      { get: (a) => a.beschreibung, weight: 1 },
      { get: (a) => a.schlagworte.join(" "), weight: 1 },
    ], 6);
    const dokumente = search(data.dokumente, q, [
      { get: (d) => d.name, weight: 3 },
      { get: (d) => d.inhalt, weight: 1 },
    ], 6);
    const kontakte = search(data.kontakte, q, [
      { get: (k) => k.name, weight: 3 },
      { get: (k) => k.email, weight: 1 },
      { get: (k) => k.ort, weight: 1 },
    ], 5);
    const fristen = search(data.fristen.filter((f) => f.status === "offen"), q, [
      { get: (f) => f.titel, weight: 3 },
      { get: (f) => f.grundlage, weight: 2 },
      { get: (f) => data.akten.find((a) => a.id === f.akteId)?.titel, weight: 1 },
    ], 5);
    const nachrichten = search(data.nachrichten, q, [
      { get: (n) => n.betreff, weight: 3 },
      { get: (n) => n.von, weight: 2 },
      { get: (n) => n.text, weight: 1 },
    ], 4);
    const urteile = search(ENTSCHEIDUNGEN, q, [
      { get: (e) => e.az, weight: 4 },
      { get: (e) => e.titel, weight: 3 },
      { get: (e) => e.schlagworte.join(" "), weight: 2 },
      { get: (e) => e.leitsatz, weight: 1 },
    ], 4);
    // Bereiche, Schnellaktionen und Reiter („Fristen", „Abrechnung", „38h-Motor", „Bankabgleich" …)
    const gesehen = new Set<string>();
    const ziele = search([...bereiche, ...aktionen, ...unterbereiche], q, [
      { get: (z) => z.label, weight: 5 },
      { get: (z) => z.stichworte, weight: 3 },
      { get: (z) => z.sub, weight: 1 },
    ], 10)
      .filter(({ item }) => {
        // gleiche Zielseite nur einmal (z. B. „38h-Motor" und „38h-Motor öffnen")
        if (gesehen.has(item.to)) return false;
        gesehen.add(item.to);
        return true;
      })
      .slice(0, 5);
    // Passt der Name eines Bereichs, steht er ganz oben – sonst hinter den Inhalten.
    const zieleZuerst = ziele.length > 0 && search([ziele[0].item], q, [{ get: (z) => `${z.label} ${z.stichworte ?? ""}`, weight: 1 }]).length > 0;
    const total = ziele.length + akten.length + dokumente.length + kontakte.length + fristen.length + nachrichten.length + urteile.length;
    return { ziele, zieleZuerst, akten, dokumente, kontakte, fristen, nachrichten, urteile, total, ms: performance.now() - t0 };
  }, [q, data, aktionen, bereiche, unterbereiche]);

  const go = (path: string) => {
    setPalette(false);
    nav(path);
  };
  const waehle = (z: Ziel) => {
    if (!z.aktion) return go(z.to);
    setPalette(false);
    const ui = useUI.getState();
    if (z.aktion === "wiedervorlage") ui.setWiedervorlage({ akteId: akteAusPfad(loc.pathname) });
    else if (z.aktion === "zeit") oeffneZeiterfassung(loc.pathname);
    else if (z.aktion === "kuerzel") ui.setKuerzel(true);
    else oeffneAssistent();
  };

  const zielGruppe = res && res.ziele.length > 0 && (
    <Command.Group heading="Bereiche & Aktionen">
      {res.ziele.map(({ item: z }) => (
        <Item key={z.to} icon={z.icon} onSelect={() => waehle(z)} title={<Highlight text={z.label} q={q} />} sub={z.sub} kuerzel={z.kuerzel} />
      ))}
    </Command.Group>
  );

  const akteTitel = (id: string) => {
    const a = data.akten.find((x) => x.id === id);
    return a ? `${a.aktenzeichen} · ${a.titel}` : "";
  };

  return (
    <AnimatePresence>
      {paletteOffen && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center px-3 pt-[max(10vh,env(safe-area-inset-top))]">
          <motion.div className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPalette(false)} />
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 36 }}
            className="glass-strong relative w-full max-w-[680px] overflow-hidden rounded-[26px]"
            style={{ boxShadow: "var(--glass-shadow-lg)" }}
          >
            <Command shouldFilter={false} label="Globale Suche" className="flex max-h-[min(70vh,620px)] flex-col">
              <div className="flex items-center gap-3 border-b border-[var(--line)] px-5">
                <Sparkles className="size-[18px] shrink-0 text-ink" />
                <Command.Input
                  autoFocus
                  value={q}
                  onValueChange={setQ}
                  placeholder="Suchen oder fragen – z. B. „Kündigung Weber“ oder „142/26“"
                  className="h-14 flex-1 bg-transparent text-[15.5px] outline-none placeholder:text-fg-4"
                />
                {res && (
                  <span className="num shrink-0 text-[12.5px] text-fg-3">
                    {res.total} Treffer<span className="hidden sm:inline"> · {res.ms < 1 ? "<1" : Math.round(res.ms)} ms</span>
                  </span>
                )}
                <button type="button" onClick={() => setPalette(false)} className="-mr-2 grid h-8 shrink-0 place-items-center rounded-full px-1.5 text-fg-3 transition-colors hover:bg-ink-softer hover:text-fg" aria-label="Suche schließen" title="Schließen (Esc)">
                  <span className="kbd hidden sm:inline-flex">Esc</span>
                  <X className="size-[18px] sm:hidden" />
                </button>
              </div>
              <Command.List className="min-h-0 flex-1 overflow-y-auto p-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[12.5px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-heading]]:text-fg-3">
                {!res && (
                  <>
                    <Command.Group heading="Schnellaktionen">
                      {aktionen.map((z) => (
                        <Item key={z.to} icon={z.icon} onSelect={() => waehle(z)} title={z.label} sub={z.sub} kuerzel={z.kuerzel} />
                      ))}
                    </Command.Group>
                    <Command.Group heading="Bereiche">
                      {bereiche.map((z) => (
                        <Item key={z.to} icon={z.icon} onSelect={() => go(z.to)} title={z.label} sub={z.sub} />
                      ))}
                    </Command.Group>
                  </>
                )}
                {res && res.zieleZuerst && zielGruppe}
                {res && res.akten.length > 0 && (
                  <Command.Group heading="Akten">
                    {res.akten.map(({ item: a }) => (
                      <Item key={a.id} icon={<FolderOpen />} onSelect={() => go(`/akten/${a.id}`)} title={<><span className="mono mr-2 text-fg-3">{a.aktenzeichen}</span><Highlight text={a.titel} q={q} /></>} sub={`${a.sachgebiet} · ${a.phase}`} />
                    ))}
                  </Command.Group>
                )}
                {res && res.dokumente.length > 0 && (
                  <Command.Group heading="Dokumente (Volltext)">
                    {res.dokumente.map(({ item: d }) => (
                      <Item key={d.id} icon={<FileText />} onSelect={() => go(`/akten/${d.akteId}?tab=dokumente&dok=${d.id}`)} title={<Highlight text={d.name} q={q} />} sub={<Highlight text={snippet(d.inhalt, q, 60)} q={q} />} meta={akteTitel(d.akteId)} />
                    ))}
                  </Command.Group>
                )}
                {res && res.fristen.length > 0 && (
                  <Command.Group heading="Fristen">
                    {res.fristen.map(({ item: f }) => (
                      <Item key={f.id} icon={<CalendarClock />} onSelect={() => go(`/akten/${f.akteId}?tab=fristen`)} title={<Highlight text={f.titel} q={q} />} sub={`${fmtDate(f.datum)} · ${akteTitel(f.akteId)}`} />
                    ))}
                  </Command.Group>
                )}
                {res && res.kontakte.length > 0 && (
                  <Command.Group heading="Kontakte">
                    {res.kontakte.map(({ item: k }) => (
                      <Item key={k.id} icon={<User />} onSelect={() => go(`/kontakte?id=${k.id}`)} title={<Highlight text={k.name} q={q} />} sub={[k.rollen.join(", "), k.ort].filter(Boolean).join(" · ")} />
                    ))}
                  </Command.Group>
                )}
                {res && res.nachrichten.length > 0 && (
                  <Command.Group heading="Posteingang">
                    {res.nachrichten.map(({ item: n }) => (
                      <Item key={n.id} icon={<Inbox />} onSelect={() => go(`/posteingang?id=${n.id}`)} title={<Highlight text={n.betreff} q={q} />} sub={`${n.kanal === "bea" ? "beA" : "E-Mail"} · ${n.von}`} />
                    ))}
                  </Command.Group>
                )}
                {res && res.urteile.length > 0 && (
                  <Command.Group heading="Fall-Datenbank">
                    {res.urteile.map(({ item: e }) => (
                      <Item key={e.id} icon={<Library />} onSelect={() => go(`/fall-datenbank?id=${e.id}`)} title={<><span className="mono mr-2 text-fg-3">{e.gericht} {e.az}</span><Highlight text={e.titel} q={q} /></>} sub={e.leitsatz.slice(0, 110) + "…"} />
                    ))}
                  </Command.Group>
                )}
                {res && !res.zieleZuerst && zielGruppe}
                {res && (
                  <Command.Group heading="Apex Assistent">
                    <Item
                      icon={<Sparkles className="text-violet" />}
                      onSelect={() => {
                        setPalette(false);
                        oeffneAssistent(q);
                      }}
                      title={<>„{q}“ den Assistenten fragen</>}
                      sub={res.total === 0 ? "Keine Treffer im lokalen Index – der Assistent hilft weiter" : "Antwortet, sucht und erledigt Aufgaben – per Text oder Sprache"}
                    />
                  </Command.Group>
                )}
              </Command.List>
              <div className="flex items-center gap-4 border-t border-[var(--line)] px-5 py-2.5 text-[12.5px] text-fg-3">
                {/* Tastaturhinweise nur dort, wo es eine Tastatur gibt */}
                <span className="hidden items-center gap-1.5 sm:flex"><span className="kbd">↑</span><span className="kbd">↓</span> auswählen</span>
                <span className="hidden items-center gap-1.5 sm:flex"><span className="kbd"><CornerDownLeft className="size-3" /></span> öffnen</span>
                <span className="min-w-0 sm:ml-auto">Lokaler Index – Mandantendaten verlassen das Gerät nicht</span>
              </div>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Item({ icon, title, sub, meta, kuerzel, onSelect }: { icon: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; meta?: React.ReactNode; kuerzel?: string; onSelect: () => void }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-[14px] px-3 py-2.5 data-[selected=true]:bg-ink-soft"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[var(--ink-softer)] text-fg-2 [&>svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium">{title}</span>
        {sub && <span className="block truncate text-[12.5px] text-fg-3">{sub}</span>}
      </span>
      {meta && <span className="hidden max-w-[180px] shrink-0 truncate text-[12.5px] text-fg-3 sm:block">{meta}</span>}
      {kuerzel && (
        <span className="hidden shrink-0 items-center gap-1 sm:inline-flex">
          <span className="sr-only">Tastaturkürzel</span>
          <span className="kbd">{kuerzel}</span>
        </span>
      )}
    </Command.Item>
  );
}
