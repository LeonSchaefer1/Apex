import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle, Archive, ArrowRight, CalendarClock, Check, CheckCircle2, Copy, FileSpreadsheet, FileText, FolderOpen, Info, RotateCcw,
  UploadCloud, Users, Wand2, X,
} from "lucide-react";
import { fmtDate, fmtEUR, fmtNum, today } from "@/core/dates";
import type { Ansprechpartner, FristTyp } from "@/core/types";
import { AnimatedNumber, Avatar, Button, Chip, DataTable, Segmented, Select, type ColumnDef } from "@/components/ui";
import { cn } from "@/lib/cn";
import { festeAnsprechBezeichnung } from "@/lib/rollen";
import { TRENNZEICHEN_NAME, type CsvErgebnis, type DateiInfo } from "./csv";
import { SYSTEME, ZIELFELDER, type DateiDublettenAktion, type DublettenAktion, type MigZeile, type OhneDatumAktion, type QuellSystem, type Umfang, type ZielFeld } from "./zuordnung";
import type { Entitaet, Ergebnis, Fortschritt, UmzugPlan } from "./uebernahme";

/* ───────── Schritt 1: Altsystem ───────── */

export function SchrittQuelle({ system, onWahl }: { system: QuellSystem | null; onWahl: (s: QuellSystem) => void }) {
  return (
    <div>
      <h2 className="title-lg">Aus welcher Software ziehen Sie um?</h2>
      <p className="mt-1 text-[13.5px] text-fg-3">Wählen Sie Ihr bisheriges Programm. Die Spalten des Exports ordnen wir anschließend automatisch zu.</p>
      <div role="radiogroup" aria-label="Altsystem" className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SYSTEME.map((s, i) => {
          const aktiv = system === s.key;
          return (
            <motion.button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={aktiv}
              onClick={() => onWahl(s.key)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 460, damping: 34, delay: i * 0.04 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "relative flex items-center gap-3.5 rounded-[18px] p-3.5 text-left ring-1 transition-[box-shadow,background-color] duration-300",
                aktiv ? "bg-[var(--ink-softer)] ring-2 ring-[var(--ink)]" : "bg-[var(--surface-2)] ring-[var(--line)] hover:ring-[var(--line-strong)]",
              )}
            >
              <span className={cn("mono grid h-11 min-w-11 shrink-0 place-items-center rounded-[12px] px-2 text-[13px] font-semibold tracking-[0.02em] ring-1 ring-[var(--line)]", aktiv ? "bg-ink text-[var(--on-ink)]" : "bg-[var(--surface)] text-fg-2")}>
                {s.kuerzel}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">{s.name}</span>
                <span className="block text-[12px] leading-snug text-fg-3">{s.text}</span>
              </span>
              <span className={cn("grid size-5 shrink-0 place-items-center rounded-full transition-all duration-300 ease-[var(--spring)]", aktiv ? "scale-100 bg-ink text-[var(--on-ink)]" : "scale-90 ring-1 ring-[var(--line-strong)]")}>
                {aktiv && <Check className="size-3" strokeWidth={3} />}
              </span>
            </motion.button>
          );
        })}
      </div>
      <p className="mt-4 text-[12.5px] text-fg-3">Ihr Programm ist nicht dabei? Fast jede Kanzleisoftware kann Akten als CSV exportieren – oder wir übernehmen den Export gemeinsam mit Ihnen.</p>
    </div>
  );
}

/* ───────── Schritt 2: Daten ───────── */

export function SchrittDaten({
  systemName, csv, datei, fehler, laedt, onDatei, onBeispiel, onReset,
}: {
  systemName: string;
  csv: CsvErgebnis | null;
  datei: DateiInfo | null;
  fehler: string | null;
  laedt: boolean;
  onDatei: (f: File) => void;
  onBeispiel: () => void;
  onReset: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div>
      <h2 className="title-lg">Export bereitstellen</h2>
      <p className="mt-1 text-[13.5px] text-fg-3">Laden Sie die CSV-Datei aus {systemName} hoch. Sie wird ausschließlich hier verarbeitet – nichts verlässt Ihre Kanzlei.</p>

      {!csv ? (
        <div className="mt-5 grid grid-cols-1 gap-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) onDatei(f);
            }}
            className={cn(
              "relative flex flex-col items-center justify-center rounded-[22px] border-2 border-dashed px-6 py-10 text-center transition-colors duration-300",
              drag ? "border-[var(--ink)] bg-[var(--ink-soft)]" : "border-[var(--line-strong)] bg-[var(--surface-2)]",
            )}
          >
            <motion.div animate={drag ? { y: -4, scale: 1.06 } : { y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 420, damping: 24 }} className="mb-3 grid size-14 place-items-center rounded-[18px] bg-ink-soft text-ink">
              <UploadCloud className="size-6" />
            </motion.div>
            <div className="title-md">CSV-Datei hierher ziehen</div>
            <p className="mt-1 max-w-[46ch] text-[12.5px] text-fg-3">Trennzeichen Semikolon, Komma oder Tabulator · UTF-8 oder Windows-Zeichensatz · bis 15 MB</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button variant="primary" icon={<FileSpreadsheet className="size-4" />} loading={laedt} onClick={() => input.current?.click()}>
                Datei auswählen
              </Button>
              <Button icon={<Wand2 className="size-4" />} onClick={onBeispiel}>
                Beispiel-Export laden
              </Button>
            </div>
            <input
              ref={input}
              type="file"
              accept=".csv,.txt,.tsv,text/csv,text/plain"
              className="sr-only"
              aria-label="CSV-Datei auswählen"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onDatei(f);
                e.target.value = "";
              }}
            />
          </div>
          {fehler && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert" className="flex gap-2.5 rounded-[14px] bg-seal-soft px-3.5 py-3 text-[13px] text-seal">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{fehler}</span>
            </motion.div>
          )}
          <p className="text-[12px] text-fg-3">„Beispiel-Export laden“ erzeugt Beispieldaten im Stil eines {systemName}-Exports – ideal zum Ausprobieren, ohne echte Mandantendaten.</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 grid grid-cols-1 gap-4">
          <div className="flex flex-wrap items-center gap-3 rounded-[18px] bg-[var(--surface-2)] p-4 ring-1 ring-[var(--line)]">
            <div className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-green-soft text-green">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[14px] font-semibold">{datei?.name}</span>
                {datei?.beispiel && (
                  <Chip tone="amber" icon={<Info className="size-3" />}>
                    Beispieldaten
                  </Chip>
                )}
              </div>
              <div className="mt-0.5 text-[12.5px] text-fg-3">
                {fmtNum(csv.zeilen.length)} Datenzeilen · {csv.kopf.length} Spalten · Trennzeichen {TRENNZEICHEN_NAME[csv.trennzeichen]} · {datei?.kodierung}
                {csv.bom ? " mit BOM" : ""}
                {datei && datei.groesse > 0 ? ` · ${fmtNum(Math.max(1, datei.groesse / 1024), 1)} KB` : ""}
              </div>
            </div>
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={onReset}>
              Andere Datei
            </Button>
          </div>
          <div>
            <div className="eyebrow mb-2">Erste Zeilen der Datei</div>
            <div className="overflow-x-auto rounded-[16px] bg-[var(--surface-2)] p-3.5 ring-1 ring-[var(--line)]">
              <table className="mono w-max text-[12.5px] leading-relaxed">
                <tbody>
                  {[csv.kopf, ...csv.zeilen.slice(0, 4)].map((r, i) => (
                    <tr key={i} className={i === 0 ? "font-semibold text-fg" : "text-fg-2"}>
                      {r.map((v, k) => (
                        <td key={k} className="max-w-[220px] truncate whitespace-nowrap pr-5">
                          {v || <span className="text-fg-3">–</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ───────── Schritt 3: Zuordnung ───────── */

const FRIST_KURZ: Record<FristTyp, string> = { notfrist: "Notfrist", frist: "Frist", vorfrist: "Vorfrist", wiedervorlage: "WV", termin: "Termin" };
const FRIST_TON: Record<FristTyp, "seal" | "ink" | "outline" | "neutral" | "violet"> = { notfrist: "seal", frist: "ink", vorfrist: "outline", wiedervorlage: "neutral", termin: "violet" };

export function SchrittZuordnung({
  csv, zuordnung, auto, setZuordnung, zeilen, modus, setModus, ausnahmen, setAusnahme, dateiAktionen = {}, setDateiAktion, plan,
}: {
  csv: CsvErgebnis;
  zuordnung: (ZielFeld | null)[];
  auto: (ZielFeld | null)[];
  setZuordnung: (z: (ZielFeld | null)[]) => void;
  zeilen: MigZeile[];
  /** dieselbe Rechnung wie Schritt 4 und die Übernahme – die Zähler stimmen überein */
  plan: UmzugPlan;
  modus: DublettenAktion;
  setModus: (m: DublettenAktion) => void;
  ausnahmen: Record<number, DublettenAktion>;
  setAusnahme: (nr: number, a: DublettenAktion) => void;
  dateiAktionen?: Record<number, DateiDublettenAktion>;
  setDateiAktion?: (nr: number, a: DateiDublettenAktion) => void;
}) {
  const dubletten = zeilen.filter((z) => z.dublette && !z.fehler);
  const dateiDubletten = zeilen.filter((z) => z.dateiDublette && !z.fehler);
  const abgeschlossen = zeilen.filter((z) => !z.fehler && z.status === "abgeschlossen").length;
  const fehler = zeilen.filter((z) => z.fehler);
  const ohneKern = !zuordnung.includes("titel") && !zuordnung.includes("aktenzeichen") && !zuordnung.includes("mandant");
  // Hinweise je Zeile: unlesbares Fristdatum, Plausibilität des Fristendes, unsicheres Sachgebiet
  const hinweise = zeilen
    .filter((z) => !z.fehler)
    .flatMap((z) => [z.hinweis, z.fristWarnung, z.sachgebietHinweis].filter((t): t is string => !!t).map((text) => ({ nr: z.nr, text, warnung: text === z.fristWarnung })));
  const fristWarnungen = zeilen.filter((z) => !z.fehler && z.fristWarnung).length;
  const sgPruefen = zeilen.filter((z) => !z.fehler && !z.sachgebietErkannt).length;
  const [alleHinweise, setAlleHinweise] = useState(false);

  const setze = (spalte: number, wert: ZielFeld | null) => {
    const next = zuordnung.map((z, i) => (i === spalte ? wert : wert && z === wert ? null : z));
    setZuordnung(next);
  };

  const spalten = useMemo<ColumnDef<MigZeile, unknown>[]>(
    () => [
      // Fünf Spalten, die bei 1440 px ohne Querscrollen passen: Akte (zweizeilig), Wert und Frist vorn, Parteien zweizeilig
      {
        id: "akte", header: "Akte", size: 300, accessorFn: (z) => `${z.quellAz} ${z.titel}`,
        cell: ({ row }) => {
          const z = row.original;
          return (
            <span className="block min-w-0 whitespace-normal">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="mono shrink-0 text-[12.5px] font-semibold">{z.quellAz || "neu"}</span>
                <span className="num shrink-0 text-[12px] text-fg-3">Zeile {z.nr}</span>
              </span>
              <span className="mt-0.5 block break-words leading-snug">{z.titel || "–"}</span>
              {(z.dublette || z.dateiDublette || z.status !== "offen") && (
                <span className="mt-1 flex flex-wrap gap-1">
                  {z.dublette && <Chip tone="amber">Dublette</Chip>}
                  {z.dateiDublette && <Chip tone="amber">doppelt in der Datei</Chip>}
                  {z.status !== "offen" && <Chip tone="outline">{z.status}{z.status === "abgeschlossen" && z.abgeschlossenAm ? ` ${fmtDate(z.abgeschlossenAm)}` : z.status === "abgeschlossen" ? " ohne Datum" : ""}</Chip>}
                </span>
              )}
            </span>
          );
        },
      },
      {
        id: "wert", header: "Gegenstandswert", size: 132, meta: { align: "right" }, accessorFn: (z) => z.gegenstandswert,
        cell: ({ row }) => <span className="num">{row.original.gegenstandswert ? fmtEUR(row.original.gegenstandswert) : "–"}</span>,
      },
      {
        id: "frist", header: "Frist", size: 210, accessorFn: (z) => z.fristDatum ?? "",
        cell: ({ row }) => {
          const z = row.original;
          if (!z.fristDatum) return <span className="text-fg-3">–</span>;
          return (
            <span className="block min-w-0 whitespace-normal" title={z.fristWarnung}>
              <span className="flex min-w-0 items-center gap-1.5">
                {z.fristWarnung && <AlertTriangle className="size-3.5 shrink-0 text-amber" aria-label="Fristende prüfen" />}
                <Chip tone={FRIST_TON[z.fristTyp]}>{FRIST_KURZ[z.fristTyp]}</Chip>
                <span className="num font-medium">{fmtDate(z.fristDatum)}</span>
              </span>
              {z.fristTitel && <span className="mt-0.5 block break-words text-[12.5px] leading-snug text-fg-3">{z.fristTitel}</span>}
            </span>
          );
        },
      },
      {
        id: "parteien", header: "Mandant / Gegner", size: 230, accessorFn: (z) => `${z.mandant} ${z.gegner}`,
        cell: ({ row }) => (
          <span className="block min-w-0 whitespace-normal leading-snug">
            <span className="block break-words">{row.original.mandant || "–"}</span>
            <span className="block break-words text-[12.5px] text-fg-3">{row.original.gegner ? `./. ${row.original.gegner}` : "ohne Gegner"}</span>
          </span>
        ),
      },
      {
        id: "sg", header: "Sachgebiet", size: 140, accessorFn: (z) => z.sachgebiet,
        cell: ({ row }) => (
          <span className="block min-w-0 whitespace-normal" title={row.original.sachgebietHinweis ?? (row.original.sachgebietRoh ? `Original: ${row.original.sachgebietRoh}` : undefined)}>
            <span className="block break-words leading-snug">{row.original.sachgebiet}</span>
            {!row.original.sachgebietErkannt && <Chip tone="amber" className="mt-1">prüfen</Chip>}
          </span>
        ),
      },
    ],
    [],
  );

  // Zähler wie in Schritt 4 und in der Übernahme (Umfang, Dubletten, Zusammenführung); Wiedervorlagen/Termine getrennt
  const aktenZahl = plan.akten + plan.aktualisieren;
  const mitFrist = plan.fristen;
  const mitWv = plan.wiedervorlagen;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="title-lg">Zuordnung prüfen</h2>
        <p className="mt-1 text-[13.5px] text-fg-3">Die Spalten wurden automatisch erkannt. Sie können jede Zuordnung ändern – die Vorschau aktualisiert sich sofort.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip tone="ink" icon={<FolderOpen className="size-3" />}>
            {aktenZahl} {aktenZahl === 1 ? "Akte" : "Akten"}
          </Chip>
          <Chip tone="ink" icon={<Users className="size-3" />}>
            {plan.kontakte} {plan.kontakte === 1 ? "Kontakt" : "Kontakte"}
            {plan.kontakteVorhanden ? ` · ${plan.kontakteVorhanden} bereits vorhanden` : ""}
          </Chip>
          <Chip tone="ink" icon={<CalendarClock className="size-3" />}>
            {mitFrist} {mitFrist === 1 ? "Frist" : "Fristen"}
            {mitWv ? ` · ${mitWv} WV/Termine` : ""}
          </Chip>
          {dubletten.length > 0 && <Chip tone="amber">{dubletten.length} {dubletten.length === 1 ? "Dublette" : "Dubletten"} im Bestand</Chip>}
          {dateiDubletten.length > 0 && <Chip tone="amber" icon={<Copy className="size-3" />}>{dateiDubletten.length} {dateiDubletten.length === 1 ? "Dublette" : "Dubletten"} in der Datei</Chip>}
          {abgeschlossen > 0 && <Chip icon={<Archive className="size-3" />}>{abgeschlossen} abgeschlossen</Chip>}
          {fristWarnungen > 0 && <Chip tone="amber" icon={<AlertTriangle className="size-3" />}>{fristWarnungen} {fristWarnungen === 1 ? "Fristende prüfen" : "Fristenden prüfen"}</Chip>}
          {sgPruefen > 0 && <Chip tone="amber">{sgPruefen} {sgPruefen === 1 ? "Sachgebiet prüfen" : "Sachgebiete prüfen"}</Chip>}
          {fehler.length > 0 && <Chip tone="seal">{fehler.length} nicht lesbar</Chip>}
        </div>
      </div>

      <section>
        <div className="eyebrow mb-2.5">Spalten</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {csv.kopf.map((h, i) => {
            const beispiel = csv.zeilen.find((r) => r[i])?.[i] ?? "";
            const istAuto = !!zuordnung[i] && zuordnung[i] === auto[i];
            return (
              <div key={i} className={cn("flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-[16px] px-3 py-2.5 ring-1 transition-colors", zuordnung[i] ? "bg-[var(--surface-2)] ring-[var(--line)]" : "bg-transparent ring-[var(--line)] opacity-80")}>
                <div className="min-w-0 flex-1 basis-[120px]">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-semibold">{h}</span>
                    {istAuto && (
                      <span title="Automatisch erkannt" className="shrink-0">
                        <Wand2 className="size-3 text-ink" />
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[12px] text-fg-3" title={beispiel}>
                    z. B. {beispiel || "–"}
                  </div>
                </div>
                <ArrowRight className={cn("hidden size-4 shrink-0 sm:block", zuordnung[i] ? "text-ink" : "text-fg-3")} />
                <div className="w-full shrink-0 sm:w-[52%] sm:min-w-[156px] sm:max-w-[230px]">
                  <Select
                    id={`umzug-spalte-${i}`}
                    aria-label={`Zielfeld für Spalte ${h}`}
                    value={zuordnung[i] ?? ""}
                    onChange={(e) => setze(i, (e.target.value || null) as ZielFeld | null)}
                    className={cn("!h-9 !pl-3 !text-[13px]", !zuordnung[i] && "text-fg-3")}
                  >
                    <option value="">Nicht übernehmen</option>
                    {ZIELFELDER.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
        {ohneKern && (
          <div role="alert" className="mt-3 flex gap-2.5 rounded-[14px] bg-seal-soft px-3.5 py-3 text-[13px] text-seal">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Bitte ordnen Sie mindestens Aktenzeichen, Bezeichnung oder Mandant zu – sonst lassen sich die Akten nicht eindeutig anlegen.
          </div>
        )}
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-fg-3">
          <Wand2 className="size-3 text-ink" /> automatisch erkannt (über bekannte Spaltennamen und Synonyme)
        </p>
      </section>

      {dateiDubletten.length > 0 && (
        <section>
          <div className="mb-2.5 min-w-0">
            <div className="eyebrow">Dubletten in der Datei</div>
            <p className="mt-1 text-[12.5px] text-fg-3">Diese Zeilen stehen mehrfach im Export (gleiche Bezeichnung, gleicher Mandant und Gegner). Standard: zusammenführen – Fristen werden nicht doppelt angelegt.</p>
          </div>
          <ul className="grid grid-cols-1 gap-2">
            {dateiDubletten.map((z) => {
              const aktion = dateiAktionen[z.nr] ?? "merge";
              const d = z.dateiDublette!;
              return (
                <li key={z.nr} className="flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-[16px] bg-amber-soft px-3.5 py-3">
                  <Copy className="size-4 shrink-0 text-amber" />
                  <div className="min-w-0 flex-1 basis-[220px]">
                    <div className="break-words text-[13px] font-semibold">
                      Zeile {z.nr}: <span className="mono">{z.quellAz || "ohne Az."}</span> · {z.titel}
                    </div>
                    <div className="text-[12.5px] text-fg-2">
                      gleicht Zeile {d.nr} (<span className="mono">{d.az || "ohne Az."}</span>)
                      {d.gleicheFrist && z.fristDatum ? ` – auch die Frist ${fmtDate(z.fristDatum)} ist gleich und wird nur einmal angelegt` : ""}
                    </div>
                  </div>
                  <Segmented<DateiDublettenAktion>
                    size="sm"
                    className="w-full sm:w-auto"
                    full
                    value={aktion}
                    onChange={(a) => setDateiAktion?.(z.nr, a)}
                    options={[
                      { value: "merge", label: "Zusammenführen" },
                      { value: "keep", label: "Beide behalten" },
                      { value: "skip", label: "Überspringen" },
                    ]}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {dubletten.length > 0 && (
        <section>
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="eyebrow">Dubletten im Bestand</div>
              <p className="mt-1 text-[12.5px] text-fg-3">Diese Akten gibt es in AnwaltApex bereits (gleiches Aktenzeichen oder gleiche Bezeichnung).</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-fg-3">Für alle:</span>
              <Segmented<DublettenAktion>
                size="sm"
                value={modus}
                onChange={setModus}
                options={[
                  { value: "skip", label: "Überspringen" },
                  { value: "overwrite", label: "Überschreiben" },
                ]}
              />
            </div>
          </div>
          <ul className="grid grid-cols-1 gap-2">
            {dubletten.map((z) => {
              const aktion = ausnahmen[z.nr] ?? modus;
              return (
                <li key={z.nr} className="flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-[16px] bg-amber-soft px-3.5 py-3">
                  <AlertTriangle className="size-4 shrink-0 text-amber" />
                  <div className="min-w-0 flex-1 basis-[200px]">
                    <div className="truncate text-[13px] font-semibold">
                      Zeile {z.nr}: <span className="mono">{z.quellAz || "ohne Az."}</span> · {z.titel}
                    </div>
                    <div className="text-[12px] text-fg-2">
                      {{ Aktenzeichen: "Gleiches Aktenzeichen", Bezeichnung: "Gleiche Bezeichnung", "Aktenzeichen und Bezeichnung": "Gleiches Aktenzeichen und gleiche Bezeichnung" }[z.dublette!.grund]} wie Akte{" "}
                      <span className="mono">{z.dublette!.az}</span>
                      {z.dublette!.grund === "Aktenzeichen" ? ` („${z.dublette!.titel}“)` : ""}
                    </div>
                  </div>
                  <Segmented<DublettenAktion>
                    size="sm"
                    className="w-full sm:w-auto"
                    full
                    value={aktion}
                    onChange={(a) => setAusnahme(z.nr, a)}
                    options={[
                      { value: "skip", label: "Überspringen" },
                      { value: "overwrite", label: "Überschreiben" },
                    ]}
                  />
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[12.5px] text-fg-3">„Überschreiben“ aktualisiert Bezeichnung, Beteiligte, Sachgebiet und Gegenstandswert der vorhandenen Akte. Dokumente, Notizen und Fristen bleiben erhalten.</p>
        </section>
      )}

      {(fehler.length > 0 || hinweise.length > 0) && (
        <section className="grid grid-cols-1 gap-2">
          <div className="eyebrow">Vor der Übernahme prüfen</div>
          {[...fehler.map((z) => ({ nr: z.nr, text: z.fehler!, fehler: true, warnung: false })), ...hinweise.map((h) => ({ ...h, fehler: false }))]
            .slice(0, alleHinweise ? undefined : 6)
            .map((h, i) => (
              <div key={`${h.nr}-${i}`} className={cn("flex gap-2.5 rounded-[14px] px-3.5 py-2.5 text-[12.5px]", h.fehler ? "bg-seal-soft text-seal" : h.warnung ? "bg-amber-soft text-fg-2" : "bg-[var(--ink-softer)] text-fg-2")}>
                {h.fehler ? <X className="mt-0.5 size-3.5 shrink-0" /> : h.warnung ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber" /> : <Info className="mt-0.5 size-3.5 shrink-0 text-ink" />}
                <span>
                  Zeile {h.nr}: {h.text}
                </span>
              </div>
            ))}
          {fehler.length + hinweise.length > 6 && (
            <button type="button" className="justify-self-start text-[12.5px] font-medium text-ink hover:underline" onClick={() => setAlleHinweise((v) => !v)}>
              {alleHinweise ? "Weniger anzeigen" : `Alle ${fehler.length + hinweise.length} Hinweise anzeigen`}
            </button>
          )}
          {fristWarnungen > 0 && <p className="text-[12.5px] text-fg-3">Übernommen wird das Datum aus dem Altsystem – die Vier-Augen-Kontrolle prüft jede Frist vor der Freigabe.</p>}
        </section>
      )}

      <section>
        <div className="eyebrow mb-2.5">Vorschau · so werden die Akten angelegt</div>
        <DataTable<MigZeile>
          id="umzug-vorschau"
          data={zeilen.filter((z) => !z.fehler)}
          columns={spalten}
          getRowId={(z) => String(z.nr)}
          maxHeight="360px"
          mobileRow={(z) => (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="mono text-[12px] text-fg-3">{z.quellAz || "neu"}</span>
                {z.dublette && <Chip tone="amber">Dublette</Chip>}
              </div>
              <div className="truncate text-[13.5px] font-semibold">{z.titel}</div>
              <div className="truncate text-[12px] text-fg-3">
                {z.sachgebiet}
                {z.gegenstandswert ? ` · ${fmtEUR(z.gegenstandswert, { cents: false })}` : ""}
                {z.fristDatum ? ` · ${FRIST_KURZ[z.fristTyp]} ${fmtDate(z.fristDatum)}` : ""}
              </div>
              {(z.fristWarnung || !z.sachgebietErkannt) && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {z.fristWarnung && <Chip tone="amber" icon={<AlertTriangle className="size-3" />}>Fristende prüfen</Chip>}
                  {!z.sachgebietErkannt && <Chip tone="amber">Sachgebiet prüfen</Chip>}
                </div>
              )}
            </div>
          )}
        />
      </section>
    </div>
  );
}

/* ───────── Schritt 4: Übernahme ───────── */

const ENTITAETEN: { key: Entitaet; label: string; icon: React.ReactNode }[] = [
  { key: "kontakte", label: "Kontakte", icon: <Users className="size-4" /> },
  { key: "akten", label: "Akten", icon: <FolderOpen className="size-4" /> },
  { key: "fristen", label: "Fristen", icon: <CalendarClock className="size-4" /> },
  { key: "dokumente", label: "Datenblatt je Akte", icon: <FileText className="size-4" /> },
];

const umfangOptionen = (jahr: number): { value: Umfang; titel: string; sub: string }[] => [
  { value: "offen", titel: "Nur offene Akten", sub: "Abgeschlossene bleiben im Altsystem." },
  {
    value: "sechsJahre",
    titel: "Offene + abgeschlossene der letzten 6 Jahre",
    sub: `Abgeschlossen ${jahr - 6} oder später. Bezugsdatum: Ende des Kalenderjahres der Auftragsbeendigung (§ 50 Abs. 1 BRAO). Ohne Abschlussdatum entscheiden Sie je Akte.`,
  },
  { value: "alle", titel: "Alle – ältere als Archiv (abgeschlossen)", sub: "Abgeschlossene Akten werden als abgeschlossen angelegt, nie offen." },
];

const OHNE_DATUM: { value: OhneDatumAktion; label: string; hinweis: string }[] = [
  { value: "uebernehmen", label: "Übernehmen (ruhend)", hinweis: "als ruhend zur Prüfung angelegt" },
  { value: "archiv", label: "Als Archiv", hinweis: "als abgeschlossen angelegt, Aufbewahrung ab Übernahme" },
  { value: "auslassen", label: "Auslassen", hinweis: "bleibt im Altsystem" },
];

/** Entscheidung je Akte ohne Abschlussdatum – Gruppe von Umschaltknöpfen (anfangs keiner gewählt). */
function OhneDatumWahl({ nr, wert, onWahl, label }: { nr: number; wert?: OhneDatumAktion; onWahl: (a: OhneDatumAktion) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex w-full flex-wrap gap-1.5 sm:w-auto">
      {OHNE_DATUM.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={wert === o.value}
          id={`ohne-datum-${nr}-${o.value}`}
          onClick={() => onWahl(o.value)}
          className={cn(
            "min-h-9 flex-1 rounded-full px-3 text-[12.5px] font-medium ring-1 ring-inset transition-colors max-sm:min-h-11 sm:flex-none",
            wert === o.value ? "bg-ink-soft text-fg ring-2 ring-[var(--ink)]" : "bg-[var(--surface)] text-fg-2 ring-[var(--line)] hover:bg-ink-softer",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SchrittUebernahme({
  plan, fortschritt, laeuft, onStart, systemName, umfang = "alle", setUmfang, ohneDatum = {}, setOhneDatum, setOhneDatumAlle, heute = today(),
}: {
  plan: UmzugPlan;
  fortschritt: Partial<Record<Entitaet, Fortschritt>>;
  laeuft: boolean;
  onStart: () => void;
  systemName: string;
  umfang?: Umfang;
  setUmfang?: (u: Umfang) => void;
  ohneDatum?: Record<number, OhneDatumAktion>;
  setOhneDatum?: (nr: number, a: OhneDatumAktion) => void;
  setOhneDatumAlle?: (a: OhneDatumAktion) => void;
  heute?: string;
}) {
  const gestartet = laeuft || Object.keys(fortschritt).length > 0;
  const UMFANG = umfangOptionen(Number(heute.slice(0, 4)));
  const offen = plan.ohneDatumOffen;
  const neueKontakte = plan.kontakte - plan.kontakteVorhanden;
  return (
    <div>
      <h2 className="title-lg">{gestartet ? "Übernahme läuft …" : "Bereit zur Übernahme"}</h2>
      <p className="mt-1 text-[13.5px] text-fg-3">
        {gestartet
          ? "Bitte lassen Sie dieses Fenster geöffnet. Wird es geschlossen, nimmt AnwaltApex den unvollständigen Lauf beim nächsten Öffnen vollständig zurück."
          : `Prüfen Sie Umfang und Zahlen für ${systemName}. Jeder Lauf lässt sich danach im Umzugsprotokoll rückgängig machen – auch nach dem Neuladen.`}
      </p>

      {!gestartet && (
        <div className="mt-5 grid grid-cols-1 gap-4">
          {setUmfang && (
            <fieldset>
              <legend className="label">Welche Akten?</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Umfang der Übernahme">
                {UMFANG.map((u) => (
                  <button
                    key={u.value}
                    type="button"
                    role="radio"
                    aria-checked={umfang === u.value}
                    onClick={() => setUmfang(u.value)}
                    className={cn(
                      "min-h-11 rounded-[16px] px-3.5 py-2.5 text-left ring-1 ring-inset transition-colors",
                      umfang === u.value ? "bg-ink-soft text-fg ring-2 ring-[var(--ink)]" : "text-fg-2 ring-[var(--line)] hover:bg-ink-softer",
                    )}
                  >
                    <span className="block text-[13px] font-semibold">{u.titel}</span>
                    <span className="block text-[12.5px] text-fg-3">{u.sub}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <PlanZahl
              label="Neue Akten"
              wert={plan.akten}
              sub={[plan.archiv ? `davon ${plan.archiv} abgeschlossen (Archiv)` : "", plan.ruhendPruefung ? `${plan.ruhendPruefung} ruhend zur Prüfung` : ""].filter(Boolean).join(" · ") || undefined}
            />
            <PlanZahl label="Akten aktualisieren" wert={plan.aktualisieren} />
            <PlanZahl label="Neue Kontakte" wert={neueKontakte} sub={plan.kontakteVorhanden ? `${plan.kontakteVorhanden} mit vorhandenen zusammengeführt` : undefined} />
            <PlanZahl label="Fristen zur Kontrolle" wert={plan.fristen} sub={plan.wiedervorlagen ? `+ ${plan.wiedervorlagen} ${plan.wiedervorlagen === 1 ? "Wiedervorlage/Termin" : "Wiedervorlagen/Termine"}` : undefined} />
          </div>
          {(plan.ueberspringen > 0 || !!plan.zusammengefuehrt || !!plan.ausserhalb) && (
            <p className="text-[12.5px] text-fg-3">
              {[
                plan.zusammengefuehrt ? `${plan.zusammengefuehrt} ${plan.zusammengefuehrt === 1 ? "Dublette der Datei wird" : "Dubletten der Datei werden"} zusammengeführt` : "",
                plan.ueberspringen ? `${plan.ueberspringen} ${plan.ueberspringen === 1 ? "Dublette wird" : "Dubletten werden"} übersprungen` : "",
                plan.ausserhalb ? `${plan.ausserhalb} abgeschlossene ${plan.ausserhalb === 1 ? "Akte liegt" : "Akten liegen"} außerhalb des gewählten Umfangs und ${plan.ausserhalb === 1 ? "bleibt" : "bleiben"} im Altsystem` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
              .
            </p>
          )}
          {plan.ohneDatum.length > 0 && (
            <section aria-labelledby="ohne-datum-titel" className="rounded-[18px] bg-amber-soft px-3.5 py-3.5">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <div className="min-w-0 flex-1 basis-[260px]">
                  <div id="ohne-datum-titel" className="flex items-center gap-1.5 text-[13px] font-semibold">
                    <AlertTriangle className="size-4 shrink-0 text-amber" />
                    {plan.ohneDatum.length === 1 ? "1 abgeschlossene Akte ohne Abschlussdatum" : `${plan.ohneDatum.length} abgeschlossene Akten ohne Abschlussdatum`}
                  </div>
                  <p className="mt-1 text-[12.5px] text-fg-2">Ohne Abschlussdatum lässt sich die Aufbewahrung (§ 50 Abs. 1 BRAO) nicht berechnen. Bitte entscheiden Sie – nichts wird still ausgelassen.</p>
                </div>
                {plan.ohneDatum.length > 1 && setOhneDatumAlle && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
                    <span className="text-fg-3">Für alle:</span>
                    {OHNE_DATUM.map((o) => (
                      <Button key={o.value} size="sm" variant="ghost" onClick={() => setOhneDatumAlle(o.value)}>
                        {o.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              <ul className="mt-3 grid grid-cols-1 gap-2">
                {plan.ohneDatum.map((z) => {
                  const w = ohneDatum[z.nr];
                  const titel = `Zeile ${z.nr}: ${z.quellAz || "ohne Az."} · ${z.titel}`;
                  return (
                    <li key={z.nr} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[14px] bg-[var(--surface)] px-3 py-2.5 ring-1 ring-[var(--line)]">
                      <div className="min-w-0 flex-1 basis-[220px]">
                        <div className="break-words text-[13px] font-semibold">
                          Zeile {z.nr}: <span className="mono">{z.quellAz || "ohne Az."}</span> · {z.titel}
                        </div>
                        <div className="text-[12.5px] text-fg-3">
                          Im Altsystem „{z.statusRoh}“{z.angelegt ? ` · angelegt ${fmtDate(z.angelegt)}` : ""}
                          {w ? ` · ${OHNE_DATUM.find((o) => o.value === w)!.hinweis}` : " · noch nicht entschieden"}
                        </div>
                      </div>
                      <OhneDatumWahl nr={z.nr} wert={w} onWahl={(a) => setOhneDatum?.(z.nr, a)} label={`Entscheidung für ${titel}`} />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <div className="flex flex-col items-center gap-3 rounded-[22px] bg-[radial-gradient(120%_140%_at_50%_0%,var(--ink-soft),transparent_70%)] px-5 py-8 text-center ring-1 ring-[var(--line)]">
            <Button variant="primary" size="lg" icon={<ArrowRight className="size-4" />} onClick={onStart} disabled={offen > 0} aria-describedby="umzug-start-hinweis" data-autofocus>
              Übernahme starten
            </Button>
            <p id="umzug-start-hinweis" className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg-2">
              {offen > 0 && <AlertTriangle className="size-3.5 shrink-0 text-amber" aria-hidden />}
              {offen > 0 ? `Bitte zuerst für ${offen === 1 ? "1 Akte" : `${offen} Akten`} ohne Abschlussdatum entscheiden.` : "mit Vorschau und Rückgängig – Ihr Altsystem bleibt unverändert"}
            </p>
            <p className="max-w-[48ch] text-[12.5px] text-fg-3">Fristen werden mit Vorfrist (eine Woche vorher) angelegt und als aus dem Umzug übernommen gekennzeichnet – eine zweite Person prüft und bestätigt sie in der Vier-Augen-Kontrolle.</p>
          </div>
        </div>
      )}

      {gestartet && (
        <div className="mt-6 grid grid-cols-1 gap-3">
          {ENTITAETEN.map((e, i) => {
            const f = fortschritt[e.key];
            const anteil = f ? (f.total ? f.done / f.total : 1) : 0;
            const fertig = !!f && f.done >= f.total;
            return (
              <motion.div
                key={e.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: f ? 1 : 0.55, y: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 34, delay: i * 0.05 }}
                className="flex items-center gap-3.5 rounded-[18px] bg-[var(--surface-2)] p-3.5 ring-1 ring-[var(--line)]"
              >
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-[12px] transition-colors duration-300", fertig ? "bg-green-soft text-green" : "bg-ink-soft text-ink")}>
                  {fertig ? (
                    <motion.span initial={{ scale: 0.4, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 520, damping: 22 }}>
                      <Check className="size-4" strokeWidth={3} />
                    </motion.span>
                  ) : (
                    e.icon
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13.5px] font-semibold">{e.label}</span>
                    <span className="num text-[12.5px] text-fg-3">{f ? `${fmtNum(f.done)} / ${fmtNum(f.total)}` : "wartet"}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
                    <motion.div
                      className={cn("h-full rounded-full", fertig ? "bg-[var(--green)]" : "bg-[linear-gradient(90deg,var(--ink-bright),var(--ink))]")}
                      initial={{ width: 0 }}
                      animate={{ width: `${anteil * 100}%` }}
                      transition={{ type: "spring", stiffness: 220, damping: 30 }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlanZahl({ label, wert, sub }: { label: string; wert: number; sub?: string }) {
  return (
    <div className="rounded-[16px] bg-[var(--surface-2)] px-3.5 py-3 ring-1 ring-[var(--line)]">
      <div className="text-[24px] font-semibold leading-none tracking-[-0.03em]">{fmtNum(wert)}</div>
      <div className="mt-1.5 text-[12px] text-fg-3">{label}</div>
      {sub && <div className="mt-0.5 text-[12px] leading-snug text-fg-3">{sub}</div>}
    </div>
  );
}

/* ───────── Schritt 5: Fertig ───────── */

export function SchrittFertig({
  ergebnis, ansprechpartner, systemName, onFristen, onAkten, onTermin, onRueckgaengig, onNeu,
}: {
  ergebnis: Ergebnis;
  ansprechpartner: Ansprechpartner;
  systemName: string;
  onFristen: () => void;
  onAkten: () => void;
  onTermin: () => void;
  onRueckgaengig: () => void;
  onNeu: () => void;
}) {
  const e = ergebnis;
  const zahlen = [
    {
      label: "Akten übernommen",
      wert: e.aktenNeu + e.aktenAktualisiert,
      sub: [e.aktenAktualisiert ? `${e.aktenAktualisiert} davon aktualisiert` : "", e.archiviert ? `${e.archiviert} als abgeschlossen (Archiv)` : ""].filter(Boolean).join(" · ") || "alle neu angelegt",
      icon: <FolderOpen className="size-4" />,
    },
    { label: "Kontakte angelegt", wert: e.kontakteNeu, sub: e.kontakteZusammengefuehrt ? `${e.kontakteZusammengefuehrt} mit vorhandenen zusammengeführt` : "ohne Dubletten", icon: <Users className="size-4" /> },
    { label: "Fristen zur Kontrolle", wert: e.fristenKontrolle, sub: e.fristen > e.fristenKontrolle ? `mit Vorfrist · dazu ${e.fristen - e.fristenKontrolle} ${e.fristen - e.fristenKontrolle === 1 ? "Wiedervorlage/Termin" : "Wiedervorlagen/Termine"}` : "mit Vorfrist, Vier-Augen-Prinzip", icon: <CalendarClock className="size-4" /> },
    { label: "Datenblatt je Akte", wert: e.dokumente, sub: "mit allen Originalwerten des Altsystems", icon: <FileText className="size-4" /> },
  ];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 18 }}
          className="relative mb-4 grid size-16 place-items-center rounded-full bg-green-soft text-green"
        >
          <motion.span className="absolute inset-0 rounded-full ring-2 ring-[var(--green)]" initial={{ scale: 1, opacity: 0.6 }} animate={{ scale: 1.6, opacity: 0 }} transition={{ duration: 1.2, ease: "easeOut" }} />
          <Check className="size-8" strokeWidth={2.6} />
        </motion.div>
        <h2 className="title-lg">Umzug abgeschlossen</h2>
        <p className="mt-1 max-w-[52ch] text-[13.5px] text-fg-3">Ihre Daten aus {systemName} sind da. Bitte lassen Sie die übernommenen Fristen jetzt von einer zweiten Person bestätigen.</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {zahlen.map((z, i) => (
          <motion.div
            key={z.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 32, delay: 0.15 + i * 0.06 }}
            className="min-w-0 rounded-[18px] bg-[var(--surface-2)] p-3.5 ring-1 ring-[var(--line)]"
          >
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-fg-3">
              <span className="text-ink">{z.icon}</span>
              <span className="truncate">{z.label}</span>
            </div>
            <div className="mt-1.5 text-[28px] font-semibold leading-none tracking-[-0.03em]">
              <AnimatedNumber value={z.wert} />
            </div>
            <div className="mt-1 text-[12px] leading-snug text-fg-3">{z.sub}</div>
          </motion.div>
        ))}
      </div>
      {(e.uebersprungen > 0 || e.aktenUmbenannt > 0 || e.fehlerhaft > 0 || e.zusammengefuehrt > 0 || e.ausserhalbUmfang > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {e.uebersprungen > 0 && <Chip>{e.uebersprungen} {e.uebersprungen === 1 ? "Dublette" : "Dubletten"} übersprungen</Chip>}
          {e.zusammengefuehrt > 0 && <Chip>{e.zusammengefuehrt} {e.zusammengefuehrt === 1 ? "Dublette" : "Dubletten"} der Datei zusammengeführt</Chip>}
          {e.ausserhalbUmfang > 0 && <Chip>{e.ausserhalbUmfang} außerhalb des Umfangs (im Altsystem)</Chip>}
          {e.aktenUmbenannt > 0 && <Chip tone="amber">{e.aktenUmbenannt} Aktenzeichen ergänzt (bereits vergeben)</Chip>}
          {e.fehlerhaft > 0 && <Chip tone="seal">{e.fehlerhaft} {e.fehlerhaft === 1 ? "Zeile" : "Zeilen"} nicht übernommen</Chip>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" icon={<CalendarClock className="size-4" />} onClick={onFristen}>
          Fristen zur Kontrolle vorgelegt – jetzt prüfen
        </Button>
        <Button icon={<FolderOpen className="size-4" />} onClick={onAkten}>
          Übernommene Akten ansehen
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3.5 rounded-[20px] bg-[var(--ink-softer)] p-4">
        <Avatar initialen={ansprechpartner.initialen} size={44} />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold">{ansprechpartner.name} prüft mit Ihnen die ersten Akten</div>
          <div className="text-[12.5px] text-fg-3">
            {festeAnsprechBezeichnung(ansprechpartner)} ·{" "}
            <a href={`tel:${ansprechpartner.telefon.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-6 select-all items-center font-medium text-ink hover:underline pointer-coarse:min-h-11" aria-label={`${ansprechpartner.name} anrufen: ${ansprechpartner.telefon}`}>
              {ansprechpartner.telefon}
            </a>{" "}
            · {ansprechpartner.verfuegbar}
          </div>
        </div>
        <Button size="sm" onClick={onTermin}>
          Durchsicht vereinbaren
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-4">
        <span className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" icon={<RotateCcw className="size-3.5" />} onClick={onRueckgaengig} className="!text-seal">
            Umzug rückgängig machen
          </Button>
          <span className="text-[12.5px] text-fg-3">auch später im Umzugsprotokoll</span>
        </span>
        <Button variant="ghost" size="sm" icon={<UploadCloud className="size-3.5" />} onClick={onNeu}>
          Weiteren Export übernehmen
        </Button>
      </div>
    </div>
  );
}
