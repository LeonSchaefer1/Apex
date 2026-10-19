// Reiter „Fristen“: offene und erledigte Fristen der Akte mit Ampel, Rechenweg und Vier-Augen-Kontrolle.
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Calculator, CalendarCheck2, CalendarClock, CalendarPlus, Check, ChevronDown, Clock, MapPin, PenLine, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import type { Akte, Frist } from "@/core/types";
import { fristArtZu } from "@/core/fristen";
import { istKritisch } from "@/core/fristenLage";
import { fmtDate, fmtDateWd, monatName, relTime, wochentagName, fromISO } from "@/core/dates";
import { useCol } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { useUI } from "@/store/ui";
import { Avatar, Button, Card, Chip, Empty, Segmented } from "@/components/ui";
import { cn } from "@/lib/cn";
// Erledigen, Wiederöffnen und Vier-Augen-Kontrolle laufen über dieselben Helfer wie im Fristenkalender –
// damit gelten in Akte und Kalender dieselben Regeln (u. a. keine Selbstkontrolle der verantwortlichen Person).
import { brauchtKontrolle } from "@/pages/fristen/logik";
import { EebAbweichungChip, KontrolleAktion, KontrollStatus, KorrekturHinweis, NachweisZeile, QuelleChip, korrigierbar, useFristAktionen } from "@/pages/fristen/FristZeile";
import { DateiDialog, type AusgabeDatei } from "@/pages/fristen/dateiAusgabe";
import { erzeugeIcs, icsDateiname } from "@/pages/fristen/ics";
import { TYP_META } from "@/pages/fristen/logik";
import { FRIST_TYP_LABEL, beruehreAkte, dringlichkeit, useTeam } from "./helfer";
import { BEWEGUNG } from "@/lib/bewegung";

export function TabFristen({ akte, onNeu }: { akte: Akte; onNeu: (modus?: "regel" | "frei") => void }) {
  const alle = useCol("fristen");
  const [ansicht, setAnsicht] = useState<"offen" | "erledigt">("offen");
  // Vorfristen erscheinen in der Karte ihrer Hauptfrist – nur „verwaiste“ Vorfristen als eigene Karte
  const fristen = useMemo(() => {
    const eigene = alle.filter((f) => f.akteId === akte.id);
    const hauptIds = new Set(eigene.filter((f) => f.typ !== "vorfrist").map((f) => f.id));
    const haupt = new Set(eigene.filter((f) => f.typ !== "vorfrist").map((f) => `Vorfrist: ${f.titel}`));
    // Zuordnung wie `vorfristenZu`: über bezugId, bei älteren Einträgen ohne Bezug über den Titel
    return eigene.filter((f) => f.typ !== "vorfrist" || !(f.bezugId ? hauptIds.has(f.bezugId) : haupt.has(f.titel)));
  }, [alle, akte.id]);
  const offen = useMemo(() => fristen.filter((f) => f.status === "offen").sort((a, b) => a.datum.localeCompare(b.datum)), [fristen]);
  const erledigt = useMemo(() => fristen.filter((f) => f.status === "erledigt").sort((a, b) => (b.erledigtAm ?? b.datum).localeCompare(a.erledigtAm ?? a.datum)), [fristen]);
  const liste = ansicht === "offen" ? offen : erledigt;
  // gleiche Regel wie im Fristenkalender: jede offene Notfrist/Frist ohne Kontrolle – auch KI-Fristen ohne Fristregel
  const ohneKontrolle = offen.filter(brauchtKontrolle).length;

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={ansicht}
          onChange={setAnsicht}
          mobilGross
          options={[
            { value: "offen", label: "Offen", count: offen.length },
            { value: "erledigt", label: "Erledigt", count: erledigt.length },
          ]}
        />
        {ohneKontrolle > 0 && ansicht === "offen" && (
          <Chip tone="amber" icon={<TriangleAlert className="size-3" />}>
            Vier-Augen-Kontrolle offen: {ohneKontrolle} {ohneKontrolle === 1 ? "Frist" : "Fristen"}
          </Chip>
        )}
        <div className="flex-1" />
        <Link
          to={`/fristen?rechner=1&akte=${akte.id}`}
          className="inline-flex h-[38px] items-center gap-1.5 rounded-md px-3 text-[14px] font-medium text-fg-2 transition-colors duration-100 hover:bg-[var(--surface-2)] hover:text-fg max-sm:h-11"
          title="Fristenrechner mit dieser Akte öffnen – mit Kalender aller Fristen der Kanzlei"
        >
          <Calculator className="size-4" /> Im Fristenrechner öffnen
        </Link>
        <Button
          variant="secondary"
          icon={<CalendarClock className="size-4" />}
          onClick={() => useUI.getState().setWiedervorlage({ akteId: akte.id })}
          className="max-sm:[--h:44px]"
          aria-keyshortcuts="W"
          title="Wiedervorlage anlegen (Taste W)"
        >
          Wiedervorlage <kbd className="kbd ml-1 hidden sm:inline-flex">W</kbd>
        </Button>
        <Button variant="primary" icon={<CalendarPlus className="size-4" />} onClick={() => onNeu("regel")} className="max-sm:[--h:44px]" aria-keyshortcuts="F" title="Frist anlegen (Taste F öffnet den Fristenrechner für diese Akte)">
          Frist anlegen <kbd className="kbd ml-1 hidden sm:inline-flex">F</kbd>
        </Button>
      </div>

      {liste.length === 0 ? (
        <Card>
          <Empty
            icon={<CalendarCheck2 className="size-6" />}
            title={ansicht === "offen" ? "Keine offenen Fristen" : "Noch keine erledigten Fristen"}
            text={ansicht === "offen" ? "Legen Sie gesetzliche Fristen mit dem Fristenrechner an – Rechenweg und Vorfrist werden automatisch notiert." : "Erledigte Fristen erscheinen hier mit Datum und Bearbeiter."}
            action={
              ansicht === "offen" ? (
                <Button variant="secondary" icon={<CalendarPlus className="size-4" />} onClick={() => onNeu("regel")}>
                  Frist anlegen
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <ul className="sheet grid grid-cols-1 divide-y divide-[var(--line)] overflow-hidden rounded-lg">
          <AnimatePresence initial={false}>
            {liste.map((f) => (
              <motion.li
                key={f.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: BEWEGUNG.standard }}
                exit={{ opacity: 0, transition: BEWEGUNG.standard }}
              >
                <FristKarte f={f} akte={akte} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function FristKarte({ f, akte }: { f: Frist; akte: Akte }) {
  const { user } = useKanzlei();
  const { team, byId } = useTeam();
  const [rechenweg, setRechenweg] = useState(false);
  // Dieselben Regeln wie im Fristenkalender: Notfristen/Fristen nur mit Nachweis oder Grund erledigen, Wiederöffnen protokolliert
  const { umschalten, kontrollieren, streichen, korrigieren, korrekturAnfordern, dialog } = useFristAktionen(f, user);
  // „In Kalender (.ics)“ – jede Frist bzw. jeder Termin der Akte als Kalenderdatei
  const [datei, setDatei] = useState<AusgabeDatei | null>(null);
  const ics = () =>
    setDatei({
      name: icsDateiname(f, akte),
      mime: "text/calendar",
      inhalt: erzeugeIcs([{ f, akte }], `${TYP_META[f.typ].label} ${akte.aktenzeichen}`),
      beschreibung: "Kalendereintrag zum Übernehmen in Outlook, Apple oder Google Kalender",
    });
  const verantw = byId.get(f.verantwortlichId);
  const erledigtVon = f.erledigtVon ? byId.get(f.erledigtVon) : undefined;
  const d = dringlichkeit(f.datum, istKritisch(f));
  const istOffen = f.status === "offen";
  const dt = fromISO(f.datum);
  // Datum als ruhiger Textblock – die Lage nennt der Chip daneben (keine farbige Kachel)
  const tonDatum = !istOffen ? "text-fg-3" : d.tone === "seal" ? "text-[var(--seal-text)]" : "text-fg";
  // Rechtsnatur aus der Fristregel: Notfrist bzw. nicht verlängerbare Frist (§ 4 KSchG, StPO, OWiG) rot – wie im Fristenkalender
  const art = f.typ === "notfrist" || f.typ === "frist" ? fristArtZu(f) : undefined;
  const kritisch = istKritisch(f);

  const erledige = () => {
    umschalten();
    beruehreAkte(akte.id);
  };
  const wiederOeffnen = () => {
    umschalten();
    beruehreAkte(akte.id);
  };
  const kontrolliere = () => {
    kontrollieren();
    beruehreAkte(akte.id);
  };

  return (
    <div className={cn("relative p-4", kritisch && istOffen && "shadow-[inset_2px_0_0_var(--seal)]")}>
      <div className="flex items-start gap-3.5">
        <div className={cn("grid w-12 shrink-0 place-items-center pt-0.5 text-center", tonDatum)}>
          <div className="text-[12px] font-medium text-fg-3">{wochentagName(f.datum, true)}</div>
          <div className="num text-[22px] font-semibold leading-7 tracking-[-0.02em]">{dt.getUTCDate()}</div>
          <div className="text-[12px] text-fg-3">{monatName(dt.getUTCMonth(), true)}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone={kritisch ? "seal" : f.typ === "termin" ? "outline" : "neutral"} title={art?.kurz}>
              {/* „Frist · nicht verlängerbar“ wie Kalender und Liste – Text, nicht nur Farbe (I2-T04-01) */}
              {kritisch && art && art.label !== "Notfrist" ? `${art.label} · nicht verlängerbar` : (art?.label ?? FRIST_TYP_LABEL[f.typ])}
            </Chip>
            {istOffen && (
              <Chip tone={d.tone}>
                {d.label}
              </Chip>
            )}
            <QuelleChip quelle={f.quelle} notiz={f.notiz} />
          </div>
          <div className="mt-1.5 text-[15px] font-medium leading-snug text-fg">{f.titel}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg-3">
            <span>{fmtDateWd(f.datum)}</span>
            {f.uhrzeit && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" /> {f.uhrzeit} Uhr
              </span>
            )}
            {f.ort && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="size-3.5 shrink-0" /> <span className="min-w-0 break-words">{f.ort}</span>
              </span>
            )}
            {f.grundlage && <span className="font-medium text-fg-2">{f.grundlage}</span>}
            {f.vorfrist && <span>Vorfrist {fmtDate(f.vorfrist)}</span>}
          </div>
          {f.notiz && <p className="mt-1.5 text-[13px] text-fg-2">{f.notiz}</p>}
          <KorrekturHinweis f={f} team={team} />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {verantw && (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-fg-3">
                <Avatar initialen={verantw.initialen} farbe={verantw.farbe} size={20} /> {verantw.name}
              </span>
            )}
            <KontrollStatus f={f} team={team} />
            <EebAbweichungChip f={f} />
            {istOffen && <KontrolleAktion f={f} user={user} kontrollieren={kontrolliere} verantwortlich={verantw} anfordern={korrekturAnfordern} />}
            {!istOffen && (
              <span className="text-[13px] text-fg-3">
                Erledigt {f.erledigtAm ? relTime(f.erledigtAm) : ""}
                {erledigtVon ? ` von ${erledigtVon.name}` : ""}
              </span>
            )}
            <NachweisZeile f={f} team={team} />
          </div>

          {f.rechenweg && f.rechenweg.length > 0 && (
            <div className="mt-3">
              <button type="button" onClick={() => setRechenweg((v) => !v)} className="link-leise rounded-sm max-sm:min-h-11" aria-expanded={rechenweg}>
                <motion.span animate={{ rotate: rechenweg ? 180 : 0 }} transition={BEWEGUNG.standard}>
                  <ChevronDown className="size-3.5" />
                </motion.span>
                {rechenweg ? "Rechenweg ausblenden" : "Rechenweg anzeigen"}
              </button>
              <AnimatePresence initial={false}>
                {rechenweg && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={BEWEGUNG.standard}
                    className="overflow-hidden"
                  >
                    <ol className="mt-2 grid grid-cols-1 gap-1.5 border-l-2 border-[var(--line)] py-1 pl-3">
                      {f.rechenweg.map((s, i) => (
                        <li key={i} className="flex gap-2.5 text-[13px] leading-snug text-fg-2">
                          <span className="num mt-px grid grid-cols-1 size-[18px] shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[12px] font-semibold text-fg-2" aria-hidden>{i + 1}</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ol>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {istOffen ? (
            <>
              <Button size="sm" variant="secondary" className="max-sm:[--h:44px] max-sm:min-w-11" icon={<Check className="size-4" />} onClick={erledige} aria-label="Als erledigt markieren" title={f.typ === "notfrist" || f.typ === "frist" ? "Erledigen – mit Nachweis, wie die Frist gewahrt wurde" : "Als erledigt markieren"}>
                <span className="hidden sm:inline">Erledigt</span>
              </Button>
              {korrigierbar(f) && (
                <Button size="sm" variant="ghost" className="max-sm:[--h:44px] max-sm:min-w-11" icon={<PenLine className="size-4" />} onClick={korrigieren} aria-label="Korrigieren – mit Grund" title="Datum bzw. Fristart und Ereignisdatum korrigieren – mit Pflichtgrund, danach erneute Vier-Augen-Kontrolle">
                  <span className="hidden sm:inline">Korrigieren</span>
                </Button>
              )}
              {f.typ !== "termin" && f.typ !== "vorfrist" && (
                <Button size="sm" variant="ghost" className="max-sm:[--h:44px] max-sm:min-w-11" icon={<Trash2 className="size-4" />} onClick={streichen} aria-label="Streichen – mit Grund" title="Streichen – mit Pflichtgrund, protokolliert">
                  <span className="hidden sm:inline">Streichen</span>
                </Button>
              )}
            </>
          ) : (
            <Button size="sm" variant="ghost" className="max-sm:[--h:44px] max-sm:min-w-11" icon={<RotateCcw className="size-4" />} onClick={wiederOeffnen} aria-label="Frist wieder öffnen" title="Frist wieder öffnen">
              <span className="hidden sm:inline">Wieder öffnen</span>
            </Button>
          )}
          <Button size="sm" variant="ghost" className="max-sm:[--h:44px] max-sm:min-w-11" icon={<CalendarPlus className="size-4" />} onClick={ics} aria-label={`${f.titel} in Kalender übernehmen (.ics)`} title="In Kalender übernehmen (.ics)">
            <span className="hidden sm:inline">.ics</span>
          </Button>
        </div>
      </div>
      {dialog}
      <DateiDialog datei={datei} onClose={() => setDatei(null)} />
    </div>
  );
}
