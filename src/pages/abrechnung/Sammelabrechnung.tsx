// Sammelabrechnung: alle abrechenbaren Akten in einem Durchgang abrechnen.
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, ChevronDown, Clock, History, Layers, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { AnimatedNumber, Button, Checkbox, Chip, Modal, Segmented } from "@/components/ui";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { addDays, fmtEUR, nowLocal, round2, today } from "@/core/dates";
import type { Rechnung } from "@/core/types";
import { cn } from "@/lib/cn";
import { erstelleRechnungen } from "./aktionen";
import {
  abrechnungUngeprueft,
  auswahlFuerAbrechnung,
  auswahlFuerFilter,
  ERECHNUNG_PFLICHT,
  FASSUNG_LABEL,
  fmtSatz,
  formatVorbelegung,
  istVorschlag,
  kopfUmschalten,
  kopfZustand,
  MINUTEN_JE_EINZELRECHNUNG,
  rsvAufteilung,
  rsvStand,
  RSV_FILTER_LABEL,
  RSV_STAND_LABEL,
  sichtbareVorschlaege,
  STANDARD_STUNDENSATZ,
  vorschlagFuerAkte,
  type Ausschluss,
  type RsvFilter,
  type RsvStand,
  type Vorschlag,
} from "./lib";
import { FORMAT_INFO, useLookups } from "./ui";
import { StellenDialog } from "./StellenDialog";

/** Akten, die abgerechnet werden können (offen, in den letzten 30 Tagen nicht abgerechnet, mit offenen Gebühren). */
export function useSammelKandidaten() {
  const akten = useCol("akten");
  const rechnungen = useCol("rechnungen");
  const zeiten = useCol("zeiten");
  const fristen = useCol("fristen");
  const dokumente = useCol("dokumente");
  const kontakte = useCol("kontakte");
  const { team } = useKanzlei();
  return useMemo(() => {
    const heute = today();
    const grenze = addDays(heute, -30);
    const usersById = new Map(team.map((u) => [u.id, u]));
    const kontaktById = new Map(kontakte.map((k) => [k.id, k]));
    const rProAkte = new Map<string, Rechnung[]>();
    for (const r of rechnungen) rProAkte.set(r.akteId, [...(rProAkte.get(r.akteId) ?? []), r]);
    const gruppe = <T extends { akteId: string }>(xs: T[]) => {
      const m = new Map<string, T[]>();
      for (const x of xs) m.set(x.akteId, [...(m.get(x.akteId) ?? []), x]);
      return m;
    };
    const fProAkte = gruppe(fristen);
    const dProAkte = gruppe(dokumente);
    const zProAkte = gruppe(zeiten);
    const vorschlaege: Vorschlag[] = [];
    const ausgeschlossen: Ausschluss[] = [];
    for (const a of akten) {
      if (a.status !== "offen") continue;
      const rs = rProAkte.get(a.id) ?? [];
      if (rs.some((r) => r.status === "entwurf")) {
        ausgeschlossen.push({ akte: a, grund: "Rechnungsentwurf liegt bereits vor" });
        continue;
      }
      if (rs.some((r) => r.status !== "storniert" && r.datum >= grenze)) {
        ausgeschlossen.push({ akte: a, grund: "In den letzten 30 Tagen abgerechnet" });
        continue;
      }
      const v = vorschlagFuerAkte(a, rs, zProAkte.get(a.id) ?? [], usersById, STANDARD_STUNDENSATZ, {
        gericht: a.gerichtId ? kontaktById.get(a.gerichtId) : undefined,
        fristen: fProAkte.get(a.id) ?? [],
        dokumente: dProAkte.get(a.id) ?? [],
        heute,
      });
      if (istVorschlag(v)) vorschlaege.push(v);
      else ausgeschlossen.push(v);
    }
    vorschlaege.sort((x, y) => y.summen.brutto - x.summen.brutto);
    return { vorschlaege, ausgeschlossen };
  }, [akten, rechnungen, zeiten, fristen, dokumente, kontakte, team]);
}

type FormatWahl = Rechnung["format"] | "auto";
const FORMATE: FormatWahl[] = ["auto", "PDF", "XRechnung", "ZUGFeRD"];
const FORMAT_LABEL: Record<FormatWahl, string> = { auto: "Automatisch", PDF: "PDF", XRechnung: "XRechnung", ZUGFeRD: "ZUGFeRD" };

export function Sammelabrechnung({ open, onClose, onAnsehen }: { open: boolean; onClose: () => void; onAnsehen: (rechnungId?: string) => void }) {
  const { vorschlaege, ausgeschlossen } = useSammelKandidaten();
  const { kontakte, akten } = useLookups();
  const { user } = useKanzlei();
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<FormatWahl>("auto");
  const [erstellt, setErstellt] = useState<Rechnung[] | null>(null);
  const [zeigeAusgeschlossen, setZeigeAusgeschlossen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  // Standard: Entwürfe wie bei der Einzelrechnung – „sofort stellen“ nur auf Wunsch und mit Rückfrage
  const [sofortStellen, setSofortStellen] = useState(false);
  const [rsvFilter, setRsvFilter] = useState<RsvFilter>("alle");
  const [filterHinweis, setFilterHinweis] = useState<string | null>(null);
  // Rückfrage vor „Sofort stellen“: Anzahl, Filter, nächste Nummern und Pflichtangaben (I3-T07-01, I3-T07-03)
  const [stellenFrage, setStellenFrage] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErstellt(null);
    setLaeuft(false);
    setZeigeAusgeschlossen(false);
    setSofortStellen(false);
    setRsvFilter("alle");
    setFilterHinweis(null);
    // Akten aus dem Umzug mit unbekanntem Abrechnungsstand nicht vorauswählen
    setAuswahl(auswahlFuerFilter(vorschlaege, "alle"));
    // nur beim Öffnen vorbelegen
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Abgerechnet, gezählt und summiert wird nur Auswahl ∩ sichtbar (I3-T07-01) – Ausgeblendetes nie.
  const sichtbar = sichtbareVorschlaege(vorschlaege, rsvFilter);
  const gewaehlt = auswahlFuerAbrechnung(vorschlaege, auswahl, rsvFilter);
  const summe = round2(gewaehlt.reduce((s, v) => s + v.summen.brutto, 0));
  const kopf = kopfZustand(vorschlaege, auswahl, rsvFilter);
  const rsvZahl = (f: RsvStand) => vorschlaege.filter((v) => rsvStand(v.akte) === f).length;
  const gefiltert = rsvFilter !== "alle";
  const filterName = RSV_FILTER_LABEL[rsvFilter];

  /** Filterwechsel: Auswahl = sichtbare Akten des neuen Filters (ohne Umzugsakten mit ungeprüftem Abrechnungsstand). */
  const filterWechsel = (f: RsvFilter) => {
    if (f === rsvFilter) return;
    setRsvFilter(f);
    setAuswahl(auswahlFuerFilter(vorschlaege, f));
    setFilterHinweis(`Auswahl an Filter ‚${RSV_FILTER_LABEL[f]}‘ angepasst`);
  };
  useEffect(() => {
    if (!filterHinweis) return;
    const t = setTimeout(() => setFilterHinweis(null), 4000);
    return () => clearTimeout(t);
  }, [filterHinweis]);

  /** „Abrechnungsstand geprüft“ – Akte aus dem Umzug wird wie jede andere vorgeschlagen. */
  const abrechnungGeprueft = (id: string) => {
    const a = akten.get(id);
    useData.getState().patch("akten", id, { abrechnungGeprueft: true, updatedAt: nowLocal() });
    useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: id, text: `Abrechnungsstand nach Umzug geprüft${a ? ` – ${a.aktenzeichen}` : ""}` });
    setAuswahl((s0) => new Set(s0).add(id));
  };
  const toggle = (id: string) =>
    setAuswahl((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const erstellen = (bestaetigt = false) => {
    if (!gewaehlt.length) return;
    if (sofortStellen && !bestaetigt) {
      setStellenFrage(true);
      return;
    }
    setStellenFrage(false);
    const status = sofortStellen ? "gestellt" : "entwurf";
    setLaeuft(true);
    setTimeout(() => {
      // XRechnung ist reines XML – Privatpersonen erhalten sie nicht (B2C), sondern die PDF-Rechnung.
      const rs = erstelleRechnungen(
        gewaehlt.map((v) => {
          const typ = kontakte.get(v.akte.mandantId)?.typ;
          return {
            akte: v.akte,
            positionen: v.positionen,
            summen: v.summen,
            zeitIds: v.zeitIds,
            vorschuss: v.vorschuss,
            format: format === "auto" ? formatVorbelegung({ typ: typ ?? "person" }) : format === "XRechnung" && typ === "person" ? ("PDF" as const) : format,
          };
        }),
        format,
        status,
        user.id,
      );
      const gesamt = round2(rs.reduce((s, r) => s + r.brutto, 0));
      const vorschuesse = rs.filter((r) => r.art === "vorschuss").length;
      useData.getState().log({
        akteur: "automation",
        userId: user.id,
        text: `Sammelabrechnung: ${rs.length} ${rs.length === 1 ? (status === "entwurf" ? "Rechnungsentwurf" : "Rechnung") : status === "entwurf" ? "Rechnungsentwürfe" : "Rechnungen"} in einem Durchgang ${status === "entwurf" ? "angelegt" : "gestellt"}${vorschuesse ? `, davon ${vorschuesse} ${vorschuesse === 1 ? "Vorschussrechnung" : "Vorschussrechnungen"} (§ 9 RVG)` : ""} (${FORMAT_LABEL[format]}, gesamt ${fmtEUR(gesamt)})`,
        minutenGespart: rs.length * MINUTEN_JE_EINZELRECHNUNG,
      });
      setErstellt(rs);
      setLaeuft(false);
    }, 650);
  };

  const gespart = (erstellt?.length ?? gewaehlt.length) * MINUTEN_JE_EINZELRECHNUNG;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon={<Layers className="size-[18px]" />}
      title={erstellt ? "Sammelabrechnung abgeschlossen" : "Sammelabrechnung"}
      subtitle={
        erstellt
          ? erstellt.every((r) => r.status === "entwurf")
            ? "Die Rechnungsentwürfe liegen unter „Rechnungen → Entwürfe“ – prüfen und einzeln oder gesammelt stellen."
            : "Alle Rechnungen sind gestellt, im Aktenkonto gebucht und in der E-Akte abgelegt."
          : "Alle abrechenbaren Akten in einem Durchgang abrechnen – statt jede Rechnung einzeln zu erstellen."
      }
      footer={
        erstellt ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Fertig
            </Button>
            <Button variant="primary" iconRight={<ArrowRight className="size-4" />} onClick={() => onAnsehen()}>
              Rechnungen ansehen
            </Button>
          </>
        ) : (
          <>
            <div className="mr-auto min-w-0 text-[12.5px] text-fg-3">
              Summe der Auswahl{gefiltert ? ` (${filterName})` : ""} <AnimatedNumber value={summe} format={(n) => fmtEUR(n)} className="ml-1 text-[15px] font-semibold text-fg" />
            </div>
            <Button variant="ghost" onClick={onClose}>
              Abbrechen
            </Button>
            <Button variant="primary" icon={<Zap className="size-4" />} disabled={!gewaehlt.length} loading={laeuft} onClick={() => erstellen()}>
              {sofortStellen
                ? `${gewaehlt.length} ${gewaehlt.length === 1 ? "Rechnung" : "Rechnungen"} stellen`
                : `${gewaehlt.length} ${gewaehlt.length === 1 ? "Entwurf" : "Entwürfe"} anlegen`}
              {gefiltert && gewaehlt.length > 0 && ` – ${filterName}`}
            </Button>
          </>
        )
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {erstellt ? (
          <motion.div key="fertig" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34 }}>
            <div className="flex flex-col items-center py-4 text-center">
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 480, damping: 22 }}
                className="grid size-16 place-items-center rounded-full bg-green-soft text-green"
              >
                <Check className="size-8" strokeWidth={2.6} />
              </motion.div>
              <div className="mt-4 text-[26px] font-semibold tracking-[-0.03em]">
                <AnimatedNumber value={erstellt.length} />{" "}
                {erstellt.every((r) => r.status === "entwurf") ? (erstellt.length === 1 ? "Entwurf angelegt" : "Entwürfe angelegt") : erstellt.length === 1 ? "Rechnung gestellt" : "Rechnungen gestellt"}
              </div>
              <div className="mt-1 text-[13px] text-fg-3">
                Gesamt <AnimatedNumber value={round2(erstellt.reduce((s, r) => s + r.brutto, 0))} format={(n) => fmtEUR(n)} className="font-semibold text-fg" /> brutto · Format {FORMAT_LABEL[format]}
                {format === "auto"
                  ? ` (${erstellt.filter((r) => r.format !== "PDF").length} E-Rechnung, ${erstellt.filter((r) => r.format === "PDF").length} PDF)`
                  : erstellt.some((r) => r.format !== format) && ` · ${erstellt.filter((r) => r.format !== format).length} an Privatpersonen als PDF`}
              </div>
              <Chip tone="green" icon={<Clock className="size-3.5" />} className="mt-3" title={`Schätzung: ${erstellt.length} Rechnungen × ${MINUTEN_JE_EINZELRECHNUNG} Min. je Einzelrechnung`}>
                ≈ {gespart} Min. gegenüber Einzelabrechnung gespart · Schätzung
              </Chip>
              <div className="mt-1.5 text-[12.5px] text-fg-3">
                Annahme: {MINUTEN_JE_EINZELRECHNUNG} Min. je Einzelrechnung ({erstellt.length} × {MINUTEN_JE_EINZELRECHNUNG} Min.)
              </div>
            </div>
            <ul className="mt-2 divide-y divide-[var(--line)] overflow-hidden rounded-[18px] border border-[var(--line)]">
              {erstellt.map((r, i) => {
                const akte = akten.get(r.akteId);
                return (
                  <motion.li
                    key={r.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + Math.min(i, 10) * 0.06, type: "spring", stiffness: 460, damping: 34 }}
                  >
                    <button type="button" onClick={() => onAnsehen(r.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-softer">
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.25 + Math.min(i, 10) * 0.06, type: "spring", stiffness: 600, damping: 20 }}
                        className="grid size-6 shrink-0 place-items-center rounded-full bg-green text-[var(--on-green)]"
                      >
                        <Check className="size-3.5" strokeWidth={3} />
                      </motion.span>
                      <span className="mono w-[108px] shrink-0 text-[12.5px] font-medium">{r.nummer}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        <span className="mono mr-2 text-[12px] text-fg-3">{akte?.aktenzeichen}</span>
                        {akte?.titel}
                      </span>
                      <span className="num shrink-0 text-[13px] font-semibold">{fmtEUR(r.brutto)}</span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          </motion.div>
        ) : (
          <motion.div key="auswahl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }}>
            {/* Engpass sichtbar machen */}
            <div className="grid gap-2 rounded-[20px] bg-ink-softer p-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <div className="rounded-[16px] px-4 py-3">
                <div className="eyebrow flex flex-wrap items-center gap-1.5">
                  Einzeln abrechnen <Chip tone="amber" className="!h-5 !px-1.5 !text-[11px] !normal-case !tracking-normal">Schätzung</Chip>
                </div>
                <div className="mt-1 text-[14px] text-fg-2">
                  <span className="num font-semibold text-fg">{vorschlaege.length}</span> {vorschlaege.length === 1 ? "Durchgang" : "Durchgänge"} · ≈ <span className="num">{vorschlaege.length * MINUTEN_JE_EINZELRECHNUNG}</span> Min.
                </div>
                <div className="mt-0.5 text-[12px] text-fg-3">Annahme: {MINUTEN_JE_EINZELRECHNUNG} Min. je Einzelrechnung</div>
              </div>
              <ArrowRight className="mx-auto hidden size-5 text-fg-3 sm:block" />
              <div className="glass-thin rounded-[16px] px-4 py-3">
                <div className="eyebrow flex items-center gap-1.5 !text-ink">
                  <Sparkles className="size-3" /> Sammelabrechnung
                </div>
                <div className="mt-1 text-[14px] text-fg-2">
                  <span className="font-semibold text-fg">1 Durchgang</span> · unter einer Minute
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="text-[12.5px] font-semibold text-fg-3">Format</span>
              <Segmented size="sm" options={FORMATE.map((f) => ({ value: f, label: FORMAT_LABEL[f] }))} value={format} onChange={setFormat} />
              <span className="min-w-0 basis-full text-[12.5px] text-fg-3 sm:basis-auto sm:flex-1">
                {format === "auto" ? "E-Rechnung (XRechnung) für Unternehmen und Organisationen, PDF für Privatpersonen – im Entwurf änderbar." : FORMAT_INFO[format].text}
                {format === "XRechnung" && " Privatmandanten erhalten die Rechnung als PDF."}
              </span>
              <span className="basis-full text-[12.5px] text-fg-3">{ERECHNUNG_PFLICHT}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                <input type="checkbox" className="size-4 accent-[var(--ink)]" checked={sofortStellen} onChange={(e) => setSofortStellen(e.target.checked)} />
                Sofort stellen (statt Entwürfe anzulegen)
              </label>
              <span className="text-[12.5px] text-fg-3">{sofortStellen ? "Endgültige Nummern, Buchung im Aktenkonto, Ablage in der E-Akte – mit Rückfrage." : "Standard: Entwürfe zur Prüfung, wie bei der Einzelrechnung."}</span>
            </div>
            {vorschlaege.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-semibold text-fg-3">RSV</span>
                <Segmented<RsvFilter>
                  size="sm"
                  value={rsvFilter}
                  onChange={filterWechsel}
                  options={[
                    { value: "alle", label: "Alle", count: vorschlaege.length },
                    { value: "erteilt", label: "Deckung erteilt", count: rsvZahl("erteilt") },
                    { value: "angefragt", label: "angefragt", count: rsvZahl("angefragt") },
                    { value: "keine", label: "keine", count: rsvZahl("keine") },
                  ]}
                />
                <span role="status" aria-live="polite" className="text-[12.5px] text-fg-3">
                  {filterHinweis && (
                    <span className="inline-flex items-center gap-1">
                      <Check className="size-3.5 text-green" /> {filterHinweis}
                    </span>
                  )}
                </span>
              </div>
            )}

            {vorschlaege.length === 0 ? (
              <div className="mt-6 rounded-[18px] border border-dashed border-[var(--line-strong)] px-6 py-10 text-center">
                <div className="title-md">Alles abgerechnet</div>
                <p className="mt-1 text-[13px] text-fg-3">Für keine offene Akte stehen derzeit Gebühren zur Abrechnung an.</p>
              </div>
            ) : (
              <div className="mt-5 overflow-hidden rounded-[18px] border border-[var(--line)]">
                <div className="flex items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-2.5 text-[12px] font-semibold text-fg-3">
                  <Checkbox
                    checked={kopf === "an"}
                    indeterminate={kopf === "teilweise"}
                    onChange={() => setAuswahl((s0) => kopfUmschalten(vorschlaege, s0, rsvFilter))}
                    label={gefiltert ? `Alle sichtbaren Akten (${filterName}) auswählen` : "Alle auswählen"}
                  />
                  <span className="flex-1">
                    {gewaehlt.length} von {sichtbar.length} {gefiltert ? "sichtbaren " : ""}
                    {sichtbar.length === 1 ? "Akte" : "Akten"} ausgewählt
                  </span>
                  <span className="hidden w-[132px] sm:inline">RSV</span>
                  <span className="hidden w-[96px] text-right sm:inline">Vorschau brutto</span>
                </div>
                <ul className="max-h-[46dvh] divide-y divide-[var(--line)] overflow-y-auto">
                  {sichtbar.map((v, i) => {
                    const an = auswahl.has(v.akte.id);
                    const mandant = kontakte.get(v.akte.mandantId);
                    const stand = rsvStand(v.akte);
                    const aufteilung = rsvAufteilung(v.akte, v.summen.brutto);
                    const umzug = abrechnungUngeprueft(v.akte);
                    return (
                      <motion.li
                        key={v.akte.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i, 10) * 0.03 }}
                        className={cn("flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors", an ? "bg-transparent" : "opacity-70", "hover:bg-ink-softer")}
                        onClick={() => toggle(v.akte.id)}
                      >
                        <div className="pt-0.5">
                          <Checkbox checked={an} onChange={() => toggle(v.akte.id)} label={`Akte ${v.akte.aktenzeichen} auswählen`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-baseline gap-2">
                            <span className="mono shrink-0 text-[12.5px] text-fg-3">{v.akte.aktenzeichen}</span>
                            <span className="line-clamp-2 break-words text-[13.5px] font-medium">{v.akte.titel}</span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {umzug && (
                              <>
                                <Chip tone="amber" icon={<History className="size-3" />} title="Aus dem Umzug übernommen – Abrechnungsstand der Altsoftware unbekannt">
                                  Abrechnungsstand unbekannt (Umzug)
                                </Chip>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    abrechnungGeprueft(v.akte.id);
                                  }}
                                >
                                  Abrechnungsstand geprüft
                                </Button>
                              </>
                            )}
                            <Chip tone="outline">{v.akte.phase}</Chip>
                            {v.vorschuss && (
                              <Chip tone="violet" title="Vergütung im laufenden Verfahren noch nicht fällig (§ 8 Abs. 1 RVG) – Vorschuss nach § 9 RVG">
                                Vorschuss § 9
                              </Chip>
                            )}
                            {v.positionen
                              .filter((p) => p.vv !== "7002")
                              .map((p, pi) => (
                                <Chip key={`${p.vv}-${pi}`} tone={p.betrag < 0 ? "amber" : "ink"} title={p.bezeichnung}>
                                  <span className="mono">{p.vv === "Std" ? `${fmtSatz(p.menge ?? 0)} Std.` : p.vv}</span>
                                  {p.satz !== undefined && p.vv !== "Std" && <span className="opacity-70">{fmtSatz(Math.abs(p.satz))}</span>}
                                </Chip>
                              ))}
                            {v.fassung && <span className="text-[12px] text-fg-3">RVG · {FASSUNG_LABEL[v.fassung]}</span>}
                            {v.hinweis && <span className="text-[12px] text-fg-3">· {v.hinweis}</span>}
                          </div>
                          <div className="mt-1 break-words text-[12.5px] text-fg-3">
                            an {mandant?.name ?? "Mandant"}
                            {aufteilung && ` · davon ${aufteilung.versicherung} ${fmtEUR(aufteilung.anteilVersicherung)}, SB ${fmtEUR(aufteilung.selbstbeteiligung)}`}
                          </div>
                        </div>
                        <div className="hidden w-[132px] shrink-0 pt-0.5 sm:block">
                          <Chip tone={stand === "erteilt" ? "green" : stand === "angefragt" ? "amber" : "outline"} icon={stand !== "keine" ? <ShieldCheck className="size-3" /> : undefined}>
                            {RSV_STAND_LABEL[stand]}
                          </Chip>
                        </div>
                        <div className="num w-[96px] shrink-0 pt-0.5 text-right text-[13.5px] font-semibold">{fmtEUR(v.summen.brutto)}</div>
                      </motion.li>
                    );
                  })}
                </ul>
              </div>
            )}

            {ausgeschlossen.length > 0 && (
              <div className="mt-4">
                <button type="button" onClick={() => setZeigeAusgeschlossen((x) => !x)} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-fg-3 hover:text-fg">
                  <ChevronDown className={cn("size-4 transition-transform duration-300", zeigeAusgeschlossen && "rotate-180")} />
                  Nicht berücksichtigt ({ausgeschlossen.length}) – nur entstandene, noch nicht berechnete Gebühren (§ 15 Abs. 2 RVG)
                </button>
                <AnimatePresence initial={false}>
                  {zeigeAusgeschlossen && (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 420, damping: 38 }}
                      className="overflow-hidden"
                    >
                      {ausgeschlossen.map((a) => (
                        <li key={a.akte.id} className="flex min-w-0 flex-wrap items-baseline gap-x-2 py-1 text-[12.5px] first:pt-2">
                          <span className="mono shrink-0 text-fg-3">{a.akte.aktenzeichen}</span>
                          <span className="min-w-0 flex-1 break-words">{a.akte.titel}</span>
                          <span className="min-w-0 basis-full text-[12.5px] text-fg-3 sm:basis-auto sm:max-w-[62%] sm:text-right" title={a.grund}>
                            {a.grund}
                          </span>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <StellenDialog
        open={stellenFrage}
        anzahl={gewaehlt.length}
        onClose={() => setStellenFrage(false)}
        onStellen={() => erstellen(true)}
        zusatz={
          <>
            {gefiltert ? `Filter „${filterName}“: ` : ""}
            {gewaehlt.length} von {sichtbar.length} {gefiltert ? "sichtbaren " : ""}
            {sichtbar.length === 1 ? "Akte" : "Akten"} ausgewählt · Summe {fmtEUR(summe)}.
          </>
        }
      />
    </Modal>
  );
}
