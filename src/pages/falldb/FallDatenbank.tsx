import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Building2, Database, Globe, Library, Search, SearchX, ShieldCheck, Sparkles, X, Zap } from "lucide-react";
import { ENTSCHEIDUNGEN, GERICHTSEBENEN, RECHTSPRECHUNG_HINWEIS } from "@/core/rechtsprechung";
import { search } from "@/core/search";
import { fmtDate, fmtNum } from "@/core/dates";
import type { Entscheidung } from "@/core/types";
import { useData } from "@/store/data";
import { findePraezedenzfaelle, relevanzProzent } from "@/ai/kontext";
import { Button, Card, CardHeader, Chip, Empty, PageHeader, Segmented, Select } from "@/components/ui";
import { useIsMobile } from "@/lib/useMedia";
import { cn } from "@/lib/cn";
import { BEISPIEL_SUCHEN, ENTSCHEIDUNG_FELDER, entscheidung, jahr, type Ebene } from "./recherche";
import { EntscheidungKarte, EntscheidungKompakt, GerichtSiegel } from "./EntscheidungKarte";
import { EntscheidungDrawer } from "./EntscheidungDrawer";
import { KiRecherche } from "./KiRecherche";
import { BEWEGUNG } from "@/lib/bewegung";

type Modus = "stichwort" | "ki";

const JAHRE = [2020, 2015, 2010, 2000];

const EBENEN_ANZAHL = ENTSCHEIDUNGEN.reduce<Record<string, number>>((acc, e) => ((acc[e.ebene] = (acc[e.ebene] ?? 0) + 1), acc), {});
const RECHTSGEBIETE = Array.from(new Set(ENTSCHEIDUNGEN.map((e) => e.rechtsgebiet))).sort((a, b) => a.localeCompare(b, "de"));
const GERICHTE_IM_AUSZUG = Object.keys(EBENEN_ANZAHL).length;
/** Filter nur für Gerichte, die im Demo-Auszug vorkommen – leere Filter wirken wie ein Defekt. */
const EBENEN_IM_AUSZUG = GERICHTSEBENEN.filter((eb) => EBENEN_ANZAHL[eb]);
/** Instanzgerichte, die erst die Produktivversion anbindet – ausdrücklich mit den Arbeitsgerichten. */
const EBENEN_SPAETER = (["OLG", "LG", "AG", "LAG", "ArbG"] as const).filter((eb) => !EBENEN_ANZAHL[eb]);
/** „OLG, LG, AG, LAG und ArbG“ */
const EBENEN_SPAETER_TEXT = EBENEN_SPAETER.length > 1 ? `${EBENEN_SPAETER.slice(0, -1).join(", ")} und ${EBENEN_SPAETER[EBENEN_SPAETER.length - 1]}` : EBENEN_SPAETER.join("");
/** Jüngste Entscheidung im Auszug – statt eines „Stand“-Datums, das nur das heutige Datum wäre. */
const JUENGSTE_ENTSCHEIDUNG = ENTSCHEIDUNGEN.reduce((max, e) => (e.datum > max ? e.datum : max), "");

/** Fall-Datenbank: Präzedenzfälle in Sekunden – Stichwortsuche mit Live-Treffern und KI-Recherche nach Sachverhalt. */
export default function FallDatenbank() {
  const [params, setParams] = useSearchParams();
  const isMobile = useIsMobile();
  const daten = useData((s) => s.data);
  const [q, setQ] = useState(params.get("q") ?? "");
  const [ebenen, setEbenen] = useState<Ebene[]>([]);
  const [gebiet, setGebiet] = useState("");
  const [jahrAb, setJahrAb] = useState(0);
  const [kiStart, setKiStart] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);

  const modus: Modus = params.get("modus") === "ki" ? "ki" : "stichwort";
  const offen = entscheidung(params.get("id"));

  const setParam = (key: string, value: string | null) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (value) n.set(key, value);
        else n.delete(key);
        return n;
      },
      { replace: key !== "id" },
    );
  const oeffne = (id: string) => setParam("id", id);

  const geheftet = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of daten.akten) for (const id of a.entscheidungen ?? []) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [daten.akten]);

  const filterAktiv = ebenen.length > 0 || !!gebiet || jahrAb > 0;
  const suche = q.trim().length >= 2;

  const ergebnis = useMemo(() => {
    const t0 = performance.now();
    const pool = ENTSCHEIDUNGEN.filter((e) => (!ebenen.length || ebenen.includes(e.ebene)) && (!gebiet || e.rechtsgebiet === gebiet) && (!jahrAb || jahr(e) >= jahrAb));
    const hits = suche ? search(pool, q, ENTSCHEIDUNG_FELDER, 60) : pool.slice().sort((a, b) => b.datum.localeCompare(a.datum)).map((item) => ({ item, score: 0 }));
    return { hits, ms: performance.now() - t0, pool: pool.length, max: hits[0]?.score || 1 };
  }, [q, suche, ebenen, gebiet, jahrAb]);

  const zeigeListe = modus === "stichwort" && (suche || filterAktiv);

  const toggleEbene = (e: Ebene) => setEbenen((cur) => (cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e]));
  const filterZuruecksetzen = () => {
    setEbenen([]);
    setGebiet("");
    setJahrAb(0);
  };

  const msText = ergebnis.ms < 0.1 ? "< 0,1 ms" : `${fmtNum(ergebnis.ms, ergebnis.ms < 10 ? 1 : 0)} ms`;

  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Intelligenz"
        title="Fall-Datenbank"
        hilfe="falldb"
        subtitle="Präzedenzfälle in Sekunden: Leitentscheidungen von BVerfG, EuGH und Bundesgerichten – nach Sachverhalt, Norm oder Aktenzeichen durchsuchen und mit einem Klick an die Akte heften."
      />

      {/* ───────── Suche ───────── */}
      {/* Suche frei auf dem Grund – keine schwebende Karte (DESIGN-SYSTEM.md 12.3) */}
      <section aria-label="Suche" className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented<Modus>
            value={modus}
            onChange={(m) => {
              if (m === "ki" && q.trim()) setKiStart(q.trim());
              setParam("modus", m === "ki" ? "ki" : null);
            }}
            options={[
              { value: "stichwort", label: "Stichwortsuche", icon: <Search className="size-3.5" /> },
              { value: "ki", label: "KI-Recherche", icon: <Sparkles className="size-3.5" /> },
            ]}
          />
          {/* Abdeckung oben in normaler Textfarbe (I3-T06-06) – nicht erst am Seitenende */}
          <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-fg-3">
            <Database className="size-3.5 shrink-0 text-fg-4" aria-hidden />
            <span className="num font-medium text-fg">{ENTSCHEIDUNGEN.length} Leitentscheidungen</span>
            <span aria-hidden>·</span>
            <span>Demo-Auszug</span>
            <span aria-hidden>·</span>
            <span className="num">jüngste vom {fmtDate(JUENGSTE_ENTSCHEIDUNG)}</span>
            {EBENEN_SPAETER.length > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>+ {EBENEN_SPAETER_TEXT} in der Produktivversion</span>
              </>
            )}
          </p>
        </div>

        <div>
          {modus === "stichwort" ? (
            <>
              <div className="relative mt-4 sm:mt-5">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-4" aria-hidden />
                <input
                  ref={inputRef}
                  id="falldb-suche"
                  type="search"
                  autoComplete="off"
                  spellCheck={false}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && q && (e.preventDefault(), setQ(""))}
                  placeholder={isMobile ? "Sachverhalt, Norm oder Az. …" : "Sachverhalt, Norm oder Aktenzeichen eingeben – z. B. Kündigung wegen Bagatelle nach langer Betriebszugehörigkeit"}
                  aria-label="Fall-Datenbank durchsuchen"
                  className="field !h-12 !pl-10 !pr-12 !text-[16px] [&::-webkit-search-cancel-button]:hidden"
                />
                {q && (
                  <button
                    type="button"
                    aria-label="Suche leeren"
                    onClick={() => {
                      setQ("");
                      inputRef.current?.focus();
                    }}
                    className="icon-btn absolute right-1.5 top-1/2 -translate-y-1/2"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              <div className="mt-3 flex min-h-7 flex-wrap items-center gap-x-3 gap-y-2">
                <AnimatePresence mode="wait" initial={false}>
                  {suche ? (
                    <motion.div key="stat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={BEWEGUNG.schnell} className="flex items-center gap-2 text-[13px]" aria-live="polite">
                      <Zap className="size-3.5 text-fg-4" aria-hidden />
                      <span className="font-medium text-fg">
                        <span className="num">{ergebnis.hits.length}</span> Treffer in <span className="num">{msText}</span>
                      </span>
                      <span className="hidden text-fg-3 sm:inline">· {ergebnis.pool} Entscheidungen lokal durchsucht</span>
                    </motion.div>
                  ) : (
                    <motion.div key="beispiele" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={BEWEGUNG.schnell} className="flex min-w-0 flex-1 items-center">
                      <span className="shrink-0 text-[13px] text-fg-3">Beispiele:</span>
                      {/* Wischleiste: Innenabstand = Breite der Kantenmaske, damit der erste Vorschlag voll sichtbar ist */}
                      <div className="fade-x -mr-4 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-0.5 pl-3 pr-6 no-scrollbar sm:-mr-0">
                      {BEISPIEL_SUCHEN.map((b) => (
                        <button key={b} type="button" onClick={() => setQ(b)} className={cn("chip chip-outline !h-7 shrink-0 !px-2.5 transition-colors duration-100 hover:bg-[var(--surface-2)] hover:text-fg", /\d/.test(b) && "mono")}>
                          {b}
                        </button>
                      ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Filter */}
              <div className="mt-4 flex flex-col gap-2.5 border-t border-[var(--line)] pt-4 lg:flex-row lg:items-center">
                <div className="fade-x -mx-4 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-4 py-0.5 no-scrollbar sm:-mx-0 sm:px-3 lg:px-0 lg:[-webkit-mask-image:none] lg:[mask-image:none]" role="group" aria-label="Gerichtsebene">
                  <FilterChip aktiv={!ebenen.length} onClick={() => setEbenen([])}>
                    Alle Gerichte
                  </FilterChip>
                  {EBENEN_IM_AUSZUG.map((eb) => {
                    const n = EBENEN_ANZAHL[eb] ?? 0;
                    return (
                      <FilterChip key={eb} aktiv={ebenen.includes(eb)} onClick={() => toggleEbene(eb)} title={`${n} Entscheidungen im Demo-Auszug`} anzahl={n}>
                        {eb}
                      </FilterChip>
                    );
                  })}
                  {EBENEN_SPAETER.length > 0 && (
                    <span
                      className="w-[180px] shrink-0 pl-1.5 text-[13px] leading-tight text-fg-3"
                      title={`${EBENEN_SPAETER_TEXT}: im Demo-Auszug nicht enthalten – die Produktivversion bindet die Instanzrechtsprechung über Open Legal Data an.`}
                    >
                      + {EBENEN_SPAETER_TEXT} in der Produktivversion
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Select id="falldb-rechtsgebiet" aria-label="Rechtsgebiet" value={gebiet} onChange={(e) => setGebiet(e.target.value)} className="!h-8 min-w-0 flex-1 text-[13px] lg:!w-[200px] lg:flex-none">
                    <option value="">Alle Rechtsgebiete</option>
                    {RECHTSGEBIETE.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </Select>
                  <Select id="falldb-jahr" aria-label="Zeitraum" value={jahrAb} onChange={(e) => setJahrAb(Number(e.target.value))} className="!h-8 min-w-0 flex-1 text-[13px] lg:!w-[150px] lg:flex-none">
                    <option value={0}>Alle Jahre</option>
                    {JAHRE.map((j) => (
                      <option key={j} value={j}>
                        ab {j}
                      </option>
                    ))}
                  </Select>
                  <AnimatePresence>
                    {filterAktiv && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={BEWEGUNG.schnell}>
                        <button type="button" onClick={filterZuruecksetzen} className="icon-btn" aria-label="Filter zurücksetzen" title="Filter zurücksetzen">
                          <X className="size-4" />
                        </button>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </>
          ) : (
            <KiRecherche startText={kiStart} onOpen={oeffne} />
          )}
        </div>
      </section>

      {/* ───────── Ergebnisse oder Übersicht ───────── */}
      <div className="mt-8">
        {zeigeListe ? (
          <section aria-label="Suchergebnisse">
            {!suche && (
              <div className="mb-3 text-[14px] text-fg-3">
                <span className="num font-semibold text-fg">{ergebnis.hits.length}</span> {ergebnis.hits.length === 1 ? "Entscheidung" : "Entscheidungen, neueste zuerst"}
              </div>
            )}
            {ergebnis.hits.length ? (
              <ul className="sheet divide-y divide-[var(--line)] overflow-hidden rounded-lg">
                {ergebnis.hits.map((h, i) => (
                    <EntscheidungKarte
                      key={h.item.id}
                      e={h.item}
                      q={suche ? q : ""}
                      index={i}
                      relevanz={suche ? Math.round(Math.max(8, Math.min(100, (h.score / ergebnis.max) * 100))) : undefined}
                      geheftet={geheftet.get(h.item.id)}
                      onOpen={() => oeffne(h.item.id)}
                    />
                ))}
              </ul>
            ) : (
              <Card>
                <Empty
                  icon={<SearchX />}
                  title="Keine Entscheidung gefunden"
                  text={
                    filterAktiv
                      ? "Mit den gewählten Filtern gibt es keinen Treffer. Setzen Sie die Filter zurück oder suchen Sie mit anderen Begriffen."
                      : "Versuchen Sie weniger oder andere Begriffe, eine Norm (z. B. „§ 626 BGB“) – oder beschreiben Sie den Fall der KI-Recherche, die Sachverhalte versteht."
                  }
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      {filterAktiv && (
                        <Button variant="secondary" onClick={filterZuruecksetzen}>
                          Filter zurücksetzen
                        </Button>
                      )}
                      <Button
                        variant="ai"
                        icon={<Sparkles className="size-4" />}
                        onClick={() => {
                          setKiStart(q.trim() || undefined);
                          setParam("modus", "ki");
                        }}
                      >
                        Mit KI-Recherche suchen
                      </Button>
                    </div>
                  }
                />
              </Card>
            )}
          </section>
        ) : (
          <Uebersicht
            onOpen={oeffne}
            onGebiet={(g) => {
              setParam("modus", null);
              setGebiet(g);
              document.getElementById("haupt-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}
      </div>

      <EntscheidungDrawer e={offen} onClose={() => setParam("id", null)} onOpen={oeffne} />
    </div>
  );
}

/** Filter (Mehrfachauswahl): Umriss in Linie stark, gewählt = Akzentfläche; Radius 6, ohne Kapsel und Schatten. */
function FilterChip({ aktiv, onClick, children, disabled, title, anzahl }: { aktiv: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean; title?: string; anzahl?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={aktiv}
      className={cn(
        "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors duration-100",
        aktiv ? "bg-[var(--ink)] text-[var(--on-ink)] hover:bg-[var(--ink-hover)]" : "text-fg-2 shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-[var(--surface-2)] hover:text-fg",
        disabled && "pointer-events-auto !cursor-not-allowed opacity-40",
      )}
    >
      {children}
      {anzahl !== undefined && anzahl > 0 && <span className={cn("num text-[12px]", aktiv ? "text-[var(--on-ink)]" : "text-fg-4")}>{anzahl}</span>}
    </button>
  );
}

// ───────────────────────── Übersicht ohne Suchbegriff ─────────────────────────

function Uebersicht({ onOpen, onGebiet }: { onOpen: (id: string) => void; onGebiet: (g: string) => void }) {
  const data = useData((s) => s.data);

  // Zuletzt bearbeitete offene Akten – solche mit passenden Entscheidungen zuerst, damit die Karte nicht leer wirkt;
  // Akten ohne Treffer füllen nur auf (stabile Sortierung: innerhalb der Gruppen bleibt „zuletzt bearbeitet“).
  const fuerAkten = useMemo(() => {
    const neueste = data.akten.filter((a) => a.status === "offen").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 12);
    return neueste
      .map((akte) => {
        const treffer = findePraezedenzfaelle(akte, data, 2);
        const max = treffer[0]?.score ?? 1;
        return { akte, treffer: treffer.map((t) => ({ ...t, prozent: relevanzProzent(t.score, max) })) };
      })
      .sort((a, b) => Number(b.treffer.length > 0) - Number(a.treffer.length > 0))
      .slice(0, 3);
  }, [data]);

  const gruppen = useMemo(() => {
    const m = new Map<string, Entscheidung[]>();
    for (const e of ENTSCHEIDUNGEN) m.set(e.rechtsgebiet, [...(m.get(e.rechtsgebiet) ?? []), e]);
    const alle = [...m.entries()].map(([g, list]) => ({ gebiet: g, list: list.sort((a, b) => b.datum.localeCompare(a.datum)), sammel: false })).sort((a, b) => b.list.length - a.list.length || a.gebiet.localeCompare(b.gebiet, "de"));
    // Kleine Rechtsgebiete zusammenfassen, damit keine halbleeren Reihen entstehen
    const gross = alle.filter((g) => g.list.length >= 3);
    const klein = alle.filter((g) => g.list.length < 3).flatMap((g) => g.list);
    return klein.length ? [...gross, { gebiet: "Weitere Rechtsgebiete", list: klein, sammel: true }] : gross;
  }, []);

  return (
    <div className="grid gap-12">
      {fuerAkten.length > 0 && (
        <section>
          <AbschnittKopf titel="Für Ihre Akten" text="Passende Entscheidungen zu Ihren zuletzt bearbeiteten Akten – automatisch mit Sachverhalt, Schlagworten und Dokumenten abgeglichen." />
          <div className="grid gap-4 md:grid-cols-3">
            {fuerAkten.map(({ akte, treffer }) => (
              <Card key={akte.id} className="flex h-full min-w-0 flex-col !p-0">
                <div className="px-4 pb-3 pt-4">
                  <div className="flex items-center gap-2">
                    <span className="mono text-[13px] text-fg-3">{akte.aktenzeichen}</span>
                    <Chip className="ml-auto">{akte.sachgebiet}</Chip>
                  </div>
                  <Link to={`/akten/${akte.id}`} className="mt-1 block truncate text-[14px] font-semibold hover:underline">
                    {akte.titel}
                  </Link>
                </div>
                {/* Treffer als Zeilen mit Linien – keine Kästen in der Karte */}
                <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
                  {treffer.length ? (
                    treffer.map((t) => (
                      <li key={t.entscheidung.id} className="min-w-0">
                        <button type="button" onClick={() => onOpen(t.entscheidung.id)} className="group flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors duration-100 hover:bg-[var(--surface-2)] focus-visible:outline-offset-[-2px]">
                          <GerichtSiegel e={t.entscheidung} groesse="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium leading-5">{t.entscheidung.titel}</span>
                            <span className="mono block truncate text-[13px] text-fg-3">{t.entscheidung.az}</span>
                          </span>
                          <span className="num shrink-0 text-[13px] font-medium text-fg-2">{t.prozent} %</span>
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="px-4 py-3 text-[13px] text-fg-3">Im Demo-Auszug noch keine passende Entscheidung.</li>
                  )}
                </ul>
                <Link to={`/ki?tab=fallanalyse&akte=${akte.id}`} className="link-leise mt-auto border-t border-[var(--line)] px-4 py-3">
                  <Sparkles aria-hidden /> KI-Fallanalyse öffnen <ArrowRight aria-hidden />
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          <AbschnittKopf titel="Leitentscheidungen nach Rechtsgebiet" text="Die Entscheidungen, die in der Praxis am häufigsten zitiert werden – sortiert nach Rechtsgebiet." />
          <div className="grid gap-8">
            {gruppen.map((g) => (
              <div key={g.gebiet} className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="title-md">{g.gebiet}</h3>
                  <span className="num text-[13px] text-fg-4">{g.list.length}</span>
                  {!g.sammel && (
                    <button type="button" onClick={() => onGebiet(g.gebiet)} className="link-leise ml-auto">
                      Nur {g.gebiet} <ArrowRight aria-hidden />
                    </button>
                  )}
                </div>
                <ul className="sheet divide-y divide-[var(--line)] overflow-hidden rounded-lg">
                  {g.list.map((e, i) => (
                    <EntscheidungKompakt key={e.id} e={e} index={i} zeigeGebiet={g.sammel} onOpen={() => onOpen(e.id)} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <aside className="min-w-0">
          <div className="xl:sticky xl:top-7">
            <QuellenKarte />
          </div>
        </aside>
      </div>
    </div>
  );
}

function AbschnittKopf({ titel, text }: { titel: string; text?: string }) {
  return (
    <div className="mb-4">
      <h2 className="title-lg">{titel}</h2>
      {text && <p className="mt-1 max-w-[72ch] text-[14px] leading-5 text-fg-3">{text}</p>}
    </div>
  );
}

const QUELLEN = [
  { icon: <Globe className="size-4" />, name: "Open Legal Data", umfang: "≈ 424.000 Entscheidungen aller Instanzen", wie: "Schnittstelle und Massenimport in den lokalen Suchindex" },
  { icon: <Library className="size-4" />, name: "NeuRIS · rechtsprechung-im-internet.de", umfang: "Amtliche Veröffentlichungen der Bundesgerichte", wie: "Regelmäßiger Abgleich neuer Entscheidungen" },
  { icon: <Building2 className="size-4" />, name: "Lizenzierte Verlagsdatenbanken", umfang: "Kommentierte Rechtsprechung und Fachzeitschriften", wie: "Über die bestehenden Lizenzen Ihrer Kanzlei" },
];


/** Ehrliche Einordnung: was heute im Demo-Auszug steckt und was die Produktivversion anbindet. */
function QuellenKarte() {
  return (
    <Card className="!p-5">
      <CardHeader icon={<Database />} title="Zentrale Fall-Datenbank" subtitle="Woher die Entscheidungen stammen" className="!mb-4" />

      <div className="border-b border-[var(--line)] pb-4">
        <div className="flex items-center gap-2">
          <Chip tone="green">Heute aktiv</Chip>
          <span className="text-[14px] font-medium text-fg">Demo-Auszug</span>
        </div>
        <p className="num mt-2 text-[13px] font-medium text-fg">
          Auszug, jüngste Entscheidung: {fmtDate(JUENGSTE_ENTSCHEIDUNG)} · {ENTSCHEIDUNGEN.length} Leitentscheidungen
        </p>
        <p className="mt-1.5 text-[13px] leading-[18px] text-fg-3">
          <span className="num font-medium text-fg-2">{ENTSCHEIDUNGEN.length}</span> echte Leitentscheidungen von {GERICHTE_IM_AUSZUG} Gerichten (BVerfG, EuGH und Bundesgerichte). {RECHTSPRECHUNG_HINWEIS.replace(/^Demo-Auszug aus der Fall-Datenbank: echte Entscheidungen, /, "")}
        </p>
      </div>

      <div className="eyebrow mb-1 mt-4">In der Produktivversion</div>
      <ul className="divide-y divide-[var(--line)]">
        {QUELLEN.map((q) => (
          <li key={q.name} className="flex items-start gap-3 py-3">
            <span className="mt-0.5 shrink-0 text-fg-4 [&>svg]:size-4" aria-hidden>
              {q.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium leading-5">{q.name}</span>
              <span className="block text-[13px] leading-[18px] text-fg-2">{q.umfang}</span>
              <span className="block text-[13px] leading-[18px] text-fg-4">{q.wie}</span>
            </span>
            <Chip tone="outline" className="shrink-0">
              geplant
            </Chip>
          </li>
        ))}
      </ul>

      <div className="mt-1 flex items-start gap-2 border-t border-[var(--line)] pt-3.5 text-[13px] leading-[18px] text-fg-3">
        <ShieldCheck className="mt-px size-4 shrink-0 text-fg-4" aria-hidden />
        <span>Die Suche läuft lokal. Auch künftig wird der Index in Ihre Infrastruktur importiert – Suchanfragen und Akteninhalte verlassen die Kanzlei nicht.</span>
      </div>
    </Card>
  );
}
