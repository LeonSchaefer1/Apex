import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Building2, Database, Globe, Library, Search, SearchX, ShieldCheck, Sparkles, X, Zap } from "lucide-react";
import { ENTSCHEIDUNGEN, GERICHTSEBENEN, RECHTSPRECHUNG_HINWEIS } from "@/core/rechtsprechung";
import { search } from "@/core/search";
import { fmtNum } from "@/core/dates";
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

type Modus = "stichwort" | "ki";

const JAHRE = [2020, 2015, 2010, 2000];

const EBENEN_ANZAHL = ENTSCHEIDUNGEN.reduce<Record<string, number>>((acc, e) => ((acc[e.ebene] = (acc[e.ebene] ?? 0) + 1), acc), {});
const RECHTSGEBIETE = Array.from(new Set(ENTSCHEIDUNGEN.map((e) => e.rechtsgebiet))).sort((a, b) => a.localeCompare(b, "de"));
const GERICHTE_IM_AUSZUG = Object.keys(EBENEN_ANZAHL).length;
/** Filter nur für Gerichte, die im Demo-Auszug vorkommen – leere Filter wirken wie ein Defekt. */
const EBENEN_IM_AUSZUG = GERICHTSEBENEN.filter((eb) => EBENEN_ANZAHL[eb]);
const EBENEN_SPAETER = GERICHTSEBENEN.filter((eb) => !EBENEN_ANZAHL[eb]);

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
        subtitle="Präzedenzfälle in Sekunden: Rechtsprechung von BGH bis Amtsgericht – nach Sachverhalt, Norm oder Aktenzeichen durchsuchen und mit einem Klick an die Akte heften."
      />

      {/* ───────── Suche ───────── */}
      <motion.section
        initial={{ opacity: 0, y: 14, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 30, delay: 0.05 }}
        className="glass-strong glow relative rounded-[30px] p-4 sm:p-6"
        style={{ boxShadow: "var(--glass-shadow-lg)" }}
      >
        <div className="relative z-[2] flex flex-wrap items-center justify-between gap-3">
          <Segmented<Modus>
            value={modus}
            onChange={(m) => {
              if (m === "ki" && q.trim()) setKiStart(q.trim());
              setParam("modus", m === "ki" ? "ki" : null);
            }}
            options={[
              { value: "stichwort", label: "Stichwortsuche", icon: <Search className="size-3.5" /> },
              { value: "ki", label: modus === "ki" ? <span className="ai-text">KI-Recherche</span> : "KI-Recherche", icon: <Sparkles className={cn("size-3.5", modus === "ki" && "text-violet")} /> },
            ]}
          />
          <div className="flex items-center gap-2 text-[12px] text-fg-3">
            <Database className="size-3.5" />
            <span className="num">{ENTSCHEIDUNGEN.length} Leitentscheidungen</span>
            <span aria-hidden>·</span>
            <span>Demo-Auszug</span>
          </div>
        </div>

        <div className="relative z-[2]">
          {modus === "stichwort" ? (
            <>
              <div className="relative mt-4 sm:mt-5">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-fg-4 sm:left-5" />
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
                  className="field !h-14 !rounded-[20px] !pl-12 !pr-12 text-[16px] tracking-[-0.01em] sm:!h-16 sm:!pl-14 sm:text-[17px] [&::-webkit-search-cancel-button]:hidden"
                />
                {q && (
                  <button
                    type="button"
                    aria-label="Suche leeren"
                    onClick={() => {
                      setQ("");
                      inputRef.current?.focus();
                    }}
                    className="icon-btn absolute right-2.5 top-1/2 -translate-y-1/2"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              <div className="mt-3 flex min-h-7 flex-wrap items-center gap-x-3 gap-y-2">
                <AnimatePresence mode="wait" initial={false}>
                  {suche ? (
                    <motion.div key="stat" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex items-center gap-2 text-[13px]" aria-live="polite">
                      <span className="grid size-6 place-items-center rounded-full bg-green-soft text-green">
                        <Zap className="size-3.5" />
                      </span>
                      <span className="font-semibold">
                        <span className="num">{ergebnis.hits.length}</span> Treffer in <span className="num">{msText}</span>
                      </span>
                      <span className="hidden text-fg-3 sm:inline">· {ergebnis.pool} Entscheidungen lokal durchsucht</span>
                    </motion.div>
                  ) : (
                    <motion.div key="beispiele" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="-mx-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 pr-6 no-scrollbar [mask-image:linear-gradient(90deg,#000_calc(100%-28px),transparent)]">
                      <span className="shrink-0 text-[12px] text-fg-3">Beispiele:</span>
                      {BEISPIEL_SUCHEN.map((b, i) => (
                        <motion.button
                          key={b}
                          type="button"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 + i * 0.03 }}
                          onClick={() => setQ(b)}
                          className={cn("chip !h-7 shrink-0 !px-3 transition-colors hover:bg-ink-soft hover:text-ink", /\d/.test(b) && "mono")}
                        >
                          {b}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Filter */}
              <div className="mt-4 flex flex-col gap-2.5 border-t border-[var(--line)] pt-4 lg:flex-row lg:items-center">
                <div className="-mx-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 py-0.5 pr-6 no-scrollbar [mask-image:linear-gradient(90deg,#000_calc(100%-24px),transparent)] lg:[mask-image:none]" role="group" aria-label="Gerichtsebene">
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
                      className="w-[150px] shrink-0 pl-1.5 text-[11.5px] leading-tight text-fg-3"
                      title={`${EBENEN_SPAETER.join(", ")}: im Demo-Auszug nicht enthalten – die Produktivversion bindet die Instanzrechtsprechung über Open Legal Data an.`}
                    >
                      + {EBENEN_SPAETER.join(", ")} in der Produktivversion
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Select id="falldb-rechtsgebiet" aria-label="Rechtsgebiet" value={gebiet} onChange={(e) => setGebiet(e.target.value)} className="!h-9 min-w-0 flex-1 !rounded-full text-[13px] lg:!w-[200px] lg:flex-none">
                    <option value="">Alle Rechtsgebiete</option>
                    {RECHTSGEBIETE.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </Select>
                  <Select id="falldb-jahr" aria-label="Zeitraum" value={jahrAb} onChange={(e) => setJahrAb(Number(e.target.value))} className="!h-9 min-w-0 flex-1 !rounded-full text-[13px] lg:!w-[150px] lg:flex-none">
                    <option value={0}>Alle Jahre</option>
                    {JAHRE.map((j) => (
                      <option key={j} value={j}>
                        ab {j}
                      </option>
                    ))}
                  </Select>
                  <AnimatePresence>
                    {filterAktiv && (
                      <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                        <button type="button" onClick={filterZuruecksetzen} className="icon-btn !size-9" aria-label="Filter zurücksetzen" title="Filter zurücksetzen">
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
      </motion.section>

      {/* ───────── Ergebnisse oder Übersicht ───────── */}
      <div className="mt-6">
        {zeigeListe ? (
          <section aria-label="Suchergebnisse">
            {!suche && (
              <div className="mb-3 text-[13px] text-fg-3">
                <span className="num font-semibold text-fg">{ergebnis.hits.length}</span> {ergebnis.hits.length === 1 ? "Entscheidung" : "Entscheidungen, neueste zuerst"}
              </div>
            )}
            {ergebnis.hits.length ? (
              <div className="grid gap-3 xl:grid-cols-2">
                <AnimatePresence initial={false}>
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
                </AnimatePresence>
              </div>
            ) : (
              <Card>
                <Empty
                  icon={<SearchX className="size-6" />}
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

function FilterChip({ aktiv, onClick, children, disabled, title, anzahl }: { aktiv: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean; title?: string; anzahl?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={aktiv}
      className={cn(
        "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-[background-color,color,box-shadow,transform] duration-200 active:scale-[0.96]",
        aktiv ? "bg-[var(--ink)] text-[var(--on-ink)] shadow-[0_6px_16px_-8px_var(--ink)]" : "bg-[var(--ink-softer)] text-fg-2 hover:bg-ink-soft hover:text-ink",
        disabled && "pointer-events-auto !cursor-not-allowed opacity-40 hover:bg-[var(--ink-softer)] hover:text-fg-2",
      )}
    >
      {children}
      {anzahl !== undefined && anzahl > 0 && <span className={cn("num text-[10.5px]", aktiv ? "text-[var(--on-ink)]/80" : "text-fg-4")}>{anzahl}</span>}
    </button>
  );
}

// ───────────────────────── Übersicht ohne Suchbegriff ─────────────────────────

function Uebersicht({ onOpen, onGebiet }: { onOpen: (id: string) => void; onGebiet: (g: string) => void }) {
  const data = useData((s) => s.data);

  const fuerAkten = useMemo(() => {
    const offene = data.akten.filter((a) => a.status === "offen").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3);
    return offene.map((akte) => {
      const treffer = findePraezedenzfaelle(akte, data, 2);
      const max = treffer[0]?.score ?? 1;
      return { akte, treffer: treffer.map((t) => ({ ...t, prozent: relevanzProzent(t.score, max) })) };
    });
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
    <div className="grid gap-8">
      {fuerAkten.length > 0 && (
        <section>
          <AbschnittKopf titel="Für Ihre Akten" text="Passende Entscheidungen zu Ihren zuletzt bearbeiteten Akten – automatisch mit Sachverhalt, Schlagworten und Dokumenten abgeglichen." />
          <div className="grid gap-3 md:grid-cols-3">
            {fuerAkten.map(({ akte, treffer }, i) => (
              <motion.div key={akte.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34, delay: 0.1 + i * 0.05 }} className="min-w-0">
                <Card className="flex h-full flex-col !p-4">
                  <div className="flex items-center gap-2">
                    <span className="mono text-[12px] text-fg-3">{akte.aktenzeichen}</span>
                    <Chip className="ml-auto">{akte.sachgebiet}</Chip>
                  </div>
                  <Link to={`/akten/${akte.id}`} className="mt-1 block truncate text-[14.5px] font-semibold tracking-[-0.01em] hover:underline">
                    {akte.titel}
                  </Link>
                  <ul className="mt-3 grid gap-1.5">
                    {treffer.length ? (
                      treffer.map((t) => (
                        <li key={t.entscheidung.id} className="min-w-0">
                          <button type="button" onClick={() => onOpen(t.entscheidung.id)} className="group flex w-full items-center gap-2.5 rounded-[14px] p-2 text-left ring-1 ring-[var(--line)] transition-colors hover:bg-[var(--ink-softer)]">
                            <GerichtSiegel e={t.entscheidung} groesse="sm" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium">{t.entscheidung.titel}</span>
                              <span className="mono block truncate text-[11px] text-fg-3">{t.entscheidung.az}</span>
                            </span>
                            <span className="num shrink-0 text-[12px] font-semibold text-ink">{t.prozent} %</span>
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className="rounded-[14px] bg-[var(--ink-softer)] px-3 py-2.5 text-[12.5px] text-fg-3">Im Demo-Auszug noch keine passende Entscheidung.</li>
                    )}
                  </ul>
                  <Link to={`/ki?tab=fallanalyse&akte=${akte.id}`} className="mt-auto inline-flex items-center gap-1.5 pt-3 text-[12.5px] font-medium text-violet hover:underline">
                    <Sparkles className="size-3.5" /> KI-Fallanalyse öffnen <ArrowRight className="size-3.5" />
                  </Link>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-6">
        <section className="min-w-0">
          <AbschnittKopf titel="Leitentscheidungen nach Rechtsgebiet" text="Die Entscheidungen, die in der Praxis am häufigsten zitiert werden – sortiert nach Rechtsgebiet." />
          <div className="grid gap-7">
            {gruppen.map((g) => (
              <div key={g.gebiet} className="min-w-0">
                <div className="mb-2.5 flex items-center gap-2">
                  <h3 className="text-[14px] font-semibold tracking-[-0.01em]">{g.gebiet}</h3>
                  <span className="num text-[12px] text-fg-4">{g.list.length}</span>
                  {!g.sammel && (
                    <button type="button" onClick={() => onGebiet(g.gebiet)} className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-ink hover:underline">
                      Nur {g.gebiet} <ArrowRight className="size-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
                  {g.list.map((e, i) => (
                    <EntscheidungKompakt key={e.id} e={e} index={i} zeigeGebiet={g.sammel} onOpen={() => onOpen(e.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="min-w-0">
          <div className="xl:sticky xl:top-24">
            <QuellenKarte />
          </div>
        </aside>
      </div>
    </div>
  );
}

function AbschnittKopf({ titel, text }: { titel: string; text?: string }) {
  return (
    <div className="mb-3.5">
      <h2 className="title-lg">{titel}</h2>
      {text && <p className="mt-1 max-w-[70ch] text-[13px] text-fg-3">{text}</p>}
    </div>
  );
}

const QUELLEN = [
  { icon: <Globe className="size-4" />, name: "Open Legal Data", umfang: "≈ 424.000 Entscheidungen aller Instanzen", wie: "REST-API und Bulk-Import in den lokalen Index" },
  { icon: <Library className="size-4" />, name: "NeuRIS · rechtsprechung-im-internet.de", umfang: "Amtliche Veröffentlichungen der Bundesgerichte", wie: "Regelmäßiger Abgleich neuer Entscheidungen" },
  { icon: <Building2 className="size-4" />, name: "Lizenzierte Verlagsdatenbanken", umfang: "Kommentierte Rechtsprechung und Fachzeitschriften", wie: "Über die bestehenden Lizenzen Ihrer Kanzlei" },
];

/** Ehrliche Einordnung: was heute im Demo-Auszug steckt und was die Produktivversion anbindet. */
function QuellenKarte() {
  return (
    <Card className="!p-5">
      <CardHeader icon={<Database className="size-4" />} title="Zentrale Fall-Datenbank" subtitle="Woher die Entscheidungen stammen" className="!mb-4" />

      <div className="rounded-[16px] bg-green-soft p-3.5">
        <div className="flex items-center gap-2">
          <Chip tone="green" dot>
            Heute aktiv
          </Chip>
          <span className="text-[12.5px] font-semibold text-fg">Demo-Auszug</span>
        </div>
        <p className="mt-2 text-[12.5px] leading-snug text-fg-2">
          <span className="num font-semibold">{ENTSCHEIDUNGEN.length}</span> echte Leitentscheidungen von {GERICHTE_IM_AUSZUG} Gerichten (BVerfG, EuGH und Bundesgerichte). {RECHTSPRECHUNG_HINWEIS.replace(/^Demo-Auszug aus der Fall-Datenbank: echte Entscheidungen, /, "")}
        </p>
      </div>

      <div className="eyebrow mb-2 mt-5">In der Produktivversion</div>
      <ul className="grid gap-2">
        {QUELLEN.map((q, i) => (
          <motion.li key={q.name} initial={{ opacity: 0, x: 8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06, type: "spring", stiffness: 420, damping: 34 }} className="flex items-start gap-3 rounded-[14px] p-2.5 ring-1 ring-[var(--line)]">
            <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-ink-soft text-ink">{q.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold leading-snug">{q.name}</span>
              <span className="block text-[12px] leading-snug text-fg-2">{q.umfang}</span>
              <span className="block text-[11.5px] leading-snug text-fg-3">{q.wie}</span>
            </span>
            <Chip tone="outline" className="shrink-0 !text-[10.5px]">
              geplant
            </Chip>
          </motion.li>
        ))}
      </ul>

      <div className="mt-4 flex items-start gap-2 border-t border-[var(--line)] pt-3.5 text-[12px] leading-snug text-fg-3">
        <ShieldCheck className="mt-px size-4 shrink-0 text-green" />
        <span>Die Suche läuft lokal. Auch künftig wird der Index in Ihre Infrastruktur importiert – Suchanfragen und Akteninhalte verlassen die Kanzlei nicht.</span>
      </div>
    </Card>
  );
}
