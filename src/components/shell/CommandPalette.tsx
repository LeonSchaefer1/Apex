import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Command } from "cmdk";
import { AnimatePresence, motion } from "motion/react";
import { FolderOpen, FileText, User, CalendarClock, Inbox, Library, Sparkles, Plus, Calculator, CornerDownLeft, Zap } from "lucide-react";
import { useUI } from "@/store/ui";
import { useData } from "@/store/data";
import { NAV } from "@/app/nav";
import { search, snippet } from "@/core/search";
import { ENTSCHEIDUNGEN } from "@/core/rechtsprechung";
import { fmtDate } from "@/core/dates";
import { Highlight } from "@/components/Highlight";

/** Globale Suche (⌘K / Strg+K): Volltext über Akten, Dokumente (OCR), Kontakte, Fristen, Posteingang und Rechtsprechung – lokal, ohne Wartezeit. */
export function CommandPalette() {
  const { paletteOffen, setPalette, oeffneAssistent } = useUI();
  const nav = useNavigate();
  const data = useData((s) => s.data);
  const [q, setQ] = useState("");

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(!useUI.getState().paletteOffen);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [setPalette]);

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
    const total = akten.length + dokumente.length + kontakte.length + fristen.length + nachrichten.length + urteile.length;
    return { akten, dokumente, kontakte, fristen, nachrichten, urteile, total, ms: performance.now() - t0 };
  }, [q, data]);

  const go = (path: string) => {
    setPalette(false);
    nav(path);
  };

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
                  <span className="num shrink-0 text-[11.5px] text-fg-4">
                    {res.total} Treffer · {res.ms < 1 ? "<1" : Math.round(res.ms)} ms
                  </span>
                )}
              </div>
              <Command.List className="min-h-0 flex-1 overflow-y-auto p-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-fg-3">
                <Command.Empty className="px-4 py-8 text-center text-[13px] text-fg-3">Keine Treffer. Fragen Sie den Apex Assistenten.</Command.Empty>
                {q.trim().length >= 2 && (
                  <Command.Group heading="Apex Assistent">
                    <Item
                      icon={<Sparkles className="text-violet" />}
                      onSelect={() => {
                        setPalette(false);
                        oeffneAssistent(q);
                      }}
                      title={<>„{q}“ den Assistenten fragen</>}
                      sub="Antwortet, sucht und erledigt Aufgaben – per Text oder Sprache"
                    />
                  </Command.Group>
                )}
                {!res && (
                  <>
                    <Command.Group heading="Schnellaktionen">
                      <Item icon={<Plus />} onSelect={() => go("/akten?neu=1")} title="Neue Akte anlegen" sub="Mandatsaufnahme mit automatischer Vollmacht & Deckungsanfrage" />
                      <Item icon={<Calculator />} onSelect={() => go("/fristen?rechner=1")} title="Frist berechnen" sub="Fristenrechner nach § 222 ZPO mit Feiertagen Ihres Bundeslands" />
                      <Item icon={<Calculator />} onSelect={() => go("/abrechnung?tab=rvg")} title="RVG-Gebühren berechnen" sub="Gebührentabelle 2025 inkl. Anrechnung und Auslagen" />
                      <Item icon={<Sparkles />} onSelect={() => go("/ki")} title="KI-Fallanalyse starten" sub="Akte wählen – Erfolgsaussicht, Präzedenzfälle, nächste Schritte" />
                      <Item icon={<Zap />} onSelect={() => go("/automatisierung")} title="38h-Motor öffnen" sub="Was heute automatisch erledigt wurde" />
                    </Command.Group>
                    <Command.Group heading="Bereiche">
                      {NAV.map((n) => (
                        <Item key={n.to} icon={<n.icon />} onSelect={() => go(n.to)} title={n.label} sub={n.beschreibung} />
                      ))}
                    </Command.Group>
                  </>
                )}
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
              </Command.List>
              <div className="flex items-center gap-4 border-t border-[var(--line)] px-5 py-2.5 text-[11.5px] text-fg-4">
                <span className="flex items-center gap-1.5"><span className="kbd">↑</span><span className="kbd">↓</span> auswählen</span>
                <span className="flex items-center gap-1.5"><span className="kbd"><CornerDownLeft className="size-3" /></span> öffnen</span>
                <span className="ml-auto">Lokaler Index – Mandantendaten verlassen das Gerät nicht</span>
              </div>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Item({ icon, title, sub, meta, onSelect }: { icon: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; meta?: React.ReactNode; onSelect: () => void }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-[14px] px-3 py-2.5 data-[selected=true]:bg-ink-soft"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[var(--ink-softer)] text-fg-2 [&>svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium">{title}</span>
        {sub && <span className="block truncate text-[12px] text-fg-3">{sub}</span>}
      </span>
      {meta && <span className="hidden max-w-[180px] shrink-0 truncate text-[11px] text-fg-4 sm:block">{meta}</span>}
    </Command.Item>
  );
}
