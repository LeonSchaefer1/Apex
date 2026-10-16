import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle, ArrowRight, CalendarClock, Check, CheckCircle2, FileSpreadsheet, FileText, FolderOpen, Info, RotateCcw,
  UploadCloud, Users, Wand2, X,
} from "lucide-react";
import { fmtDate, fmtEUR, fmtNum } from "@/core/dates";
import type { Ansprechpartner, Kontakt } from "@/core/types";
import { AnimatedNumber, Avatar, Button, Chip, DataTable, Segmented, Select, type ColumnDef } from "@/components/ui";
import { cn } from "@/lib/cn";
import { TRENNZEICHEN_NAME, type CsvErgebnis, type DateiInfo } from "./csv";
import { SYSTEME, ZIELFELDER, normName, type DublettenAktion, type MigZeile, type QuellSystem, type ZielFeld } from "./zuordnung";
import type { Entitaet, Ergebnis, Fortschritt } from "./uebernahme";

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
      <p className="mt-4 text-[12.5px] text-fg-3">Ihr Programm ist nicht dabei? Fast jede Kanzleisoftware kann Akten als CSV exportieren – oder Ihr Ansprechpartner übernimmt den Export gemeinsam mit Ihnen.</p>
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
          <p className="text-[12px] text-fg-4">„Beispiel-Export laden“ erzeugt Beispieldaten im Stil eines {systemName}-Exports – ideal zum Ausprobieren, ohne echte Mandantendaten.</p>
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
              <table className="mono w-max text-[11.5px] leading-relaxed">
                <tbody>
                  {[csv.kopf, ...csv.zeilen.slice(0, 4)].map((r, i) => (
                    <tr key={i} className={i === 0 ? "font-semibold text-fg" : "text-fg-2"}>
                      {r.map((v, k) => (
                        <td key={k} className="max-w-[220px] truncate whitespace-nowrap pr-5">
                          {v || <span className="text-fg-4">–</span>}
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

export function SchrittZuordnung({
  csv, zuordnung, auto, setZuordnung, zeilen, kontakte, modus, setModus, ausnahmen, setAusnahme,
}: {
  csv: CsvErgebnis;
  zuordnung: (ZielFeld | null)[];
  auto: (ZielFeld | null)[];
  setZuordnung: (z: (ZielFeld | null)[]) => void;
  zeilen: MigZeile[];
  kontakte: Kontakt[];
  modus: DublettenAktion;
  setModus: (m: DublettenAktion) => void;
  ausnahmen: Record<number, DublettenAktion>;
  setAusnahme: (nr: number, a: DublettenAktion) => void;
}) {
  const dubletten = zeilen.filter((z) => z.dublette && !z.fehler);
  const fehler = zeilen.filter((z) => z.fehler);
  const hinweise = zeilen.filter((z) => z.hinweis && !z.fehler);
  const ohneKern = !zuordnung.includes("titel") && !zuordnung.includes("aktenzeichen") && !zuordnung.includes("mandant");

  const kontaktZahl = useMemo(() => {
    const vorhanden = new Set(kontakte.map((k) => normName(k.name)));
    const namen = new Set<string>();
    let bekannt = 0;
    for (const z of zeilen) {
      for (const n of [z.mandant, z.gegner]) {
        const k = normName(n);
        if (!k || namen.has(k)) continue;
        namen.add(k);
        if (vorhanden.has(k)) bekannt++;
      }
    }
    return { gesamt: namen.size, bekannt };
  }, [zeilen, kontakte]);

  const setze = (spalte: number, wert: ZielFeld | null) => {
    const next = zuordnung.map((z, i) => (i === spalte ? wert : wert && z === wert ? null : z));
    setZuordnung(next);
  };

  const spalten = useMemo<ColumnDef<MigZeile, unknown>[]>(
    () => [
      { id: "nr", header: "Zeile", size: 64, accessorFn: (z) => z.nr, cell: ({ row }) => <span className="num text-fg-4">{row.original.nr}</span> },
      { id: "az", header: "Aktenzeichen", size: 120, accessorFn: (z) => z.quellAz, cell: ({ row }) => <span className="mono">{row.original.quellAz || "neu"}</span> },
      {
        id: "titel", header: "Bezeichnung", size: 260, accessorFn: (z) => z.titel,
        cell: ({ row }) => (
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate">{row.original.titel || "–"}</span>
            {row.original.dublette && <Chip tone="amber">Dublette</Chip>}
          </span>
        ),
      },
      { id: "mandant", header: "Mandant", size: 170, accessorFn: (z) => z.mandant, cell: ({ row }) => <span className="truncate">{row.original.mandant || "–"}</span> },
      { id: "gegner", header: "Gegner", size: 170, accessorFn: (z) => z.gegner, cell: ({ row }) => <span className="truncate">{row.original.gegner || "–"}</span> },
      { id: "sg", header: "Sachgebiet", size: 130, accessorFn: (z) => z.sachgebiet, cell: ({ row }) => <span title={row.original.sachgebietRoh ? `Original: ${row.original.sachgebietRoh}` : undefined}>{row.original.sachgebiet}</span> },
      { id: "wert", header: "Gegenstandswert", size: 130, accessorFn: (z) => z.gegenstandswert, cell: ({ row }) => <span className="num">{row.original.gegenstandswert ? fmtEUR(row.original.gegenstandswert) : "–"}</span> },
      {
        id: "frist", header: "Frist", size: 210, accessorFn: (z) => z.fristDatum ?? "",
        cell: ({ row }) => (row.original.fristDatum ? <span className="truncate"><span className="num font-medium">{fmtDate(row.original.fristDatum)}</span> <span className="text-fg-3">{row.original.fristTitel}</span></span> : <span className="text-fg-4">–</span>),
      },
    ],
    [],
  );

  const mitFrist = zeilen.filter((z) => z.fristDatum && !z.fehler).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="title-lg">Zuordnung prüfen</h2>
        <p className="mt-1 text-[13.5px] text-fg-3">Die Spalten wurden automatisch erkannt. Sie können jede Zuordnung ändern – die Vorschau aktualisiert sich sofort.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip tone="ink" icon={<FolderOpen className="size-3" />}>{zeilen.length - fehler.length} Akten</Chip>
          <Chip tone="ink" icon={<Users className="size-3" />}>
            {kontaktZahl.gesamt} Kontakte{kontaktZahl.bekannt ? ` · ${kontaktZahl.bekannt} bereits vorhanden` : ""}
          </Chip>
          <Chip tone="ink" icon={<CalendarClock className="size-3" />}>{mitFrist} Fristen</Chip>
          {dubletten.length > 0 && <Chip tone="amber">{dubletten.length} Dubletten</Chip>}
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
                  <div className="truncate text-[11.5px] text-fg-4" title={beispiel}>
                    z. B. {beispiel || "–"}
                  </div>
                </div>
                <ArrowRight className={cn("hidden size-4 shrink-0 sm:block", zuordnung[i] ? "text-ink" : "text-fg-4")} />
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
        <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-fg-4">
          <Wand2 className="size-3 text-ink" /> automatisch erkannt (über bekannte Spaltennamen und Synonyme)
        </p>
      </section>

      {dubletten.length > 0 && (
        <section>
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="eyebrow">Dubletten</div>
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
          <p className="mt-2 text-[11.5px] text-fg-4">„Überschreiben“ aktualisiert Bezeichnung, Beteiligte, Sachgebiet und Gegenstandswert der vorhandenen Akte. Dokumente, Notizen und Fristen bleiben erhalten.</p>
        </section>
      )}

      {(fehler.length > 0 || hinweise.length > 0) && (
        <section className="grid grid-cols-1 gap-2">
          {[...fehler, ...hinweise].slice(0, 6).map((z) => (
            <div key={z.nr} className={cn("flex gap-2.5 rounded-[14px] px-3.5 py-2.5 text-[12.5px]", z.fehler ? "bg-seal-soft text-seal" : "bg-[var(--ink-softer)] text-fg-2")}>
              {z.fehler ? <X className="mt-0.5 size-3.5 shrink-0" /> : <Info className="mt-0.5 size-3.5 shrink-0 text-ink" />}
              <span>
                Zeile {z.nr}: {z.fehler ?? z.hinweis}
              </span>
            </div>
          ))}
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
                {z.fristDatum ? ` · Frist ${fmtDate(z.fristDatum)}` : ""}
              </div>
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
  { key: "dokumente", label: "Dokumente-Verweise", icon: <FileText className="size-4" /> },
];

export function SchrittUebernahme({
  plan, fortschritt, laeuft, onStart, systemName,
}: {
  plan: { akten: number; aktualisieren: number; ueberspringen: number; fristen: number; kontakte: number };
  fortschritt: Partial<Record<Entitaet, Fortschritt>>;
  laeuft: boolean;
  onStart: () => void;
  systemName: string;
}) {
  const gestartet = laeuft || Object.keys(fortschritt).length > 0;
  return (
    <div>
      <h2 className="title-lg">{gestartet ? "Übernahme läuft …" : "Bereit zur Übernahme"}</h2>
      <p className="mt-1 text-[13.5px] text-fg-3">
        {gestartet ? "Bitte lassen Sie dieses Fenster geöffnet. Es dauert nur einen Moment." : `Ein Klick übernimmt alles aus ${systemName}. Sie können den Umzug danach jederzeit rückgängig machen.`}
      </p>

      {!gestartet && (
        <div className="mt-5 grid grid-cols-1 gap-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <PlanZahl label="Neue Akten" wert={plan.akten} />
            <PlanZahl label="Akten aktualisieren" wert={plan.aktualisieren} />
            <PlanZahl label="Kontakte" wert={plan.kontakte} />
            <PlanZahl label="Fristen zur Kontrolle" wert={plan.fristen} />
          </div>
          {plan.ueberspringen > 0 && <p className="text-[12.5px] text-fg-3">{plan.ueberspringen} Dublette(n) werden übersprungen.</p>}
          <div className="flex flex-col items-center gap-3 rounded-[22px] bg-[radial-gradient(120%_140%_at_50%_0%,var(--ink-soft),transparent_70%)] px-5 py-8 text-center ring-1 ring-[var(--line)]">
            <Button variant="primary" size="lg" icon={<ArrowRight className="size-4" />} onClick={onStart} data-autofocus>
              Jetzt mit einem Klick übernehmen
            </Button>
            <p className="max-w-[48ch] text-[12px] text-fg-3">Fristen werden mit Vorfrist angelegt und als „aus Umzug“ markiert – eine zweite Person bestätigt sie im Vier-Augen-Prinzip.</p>
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

function PlanZahl({ label, wert }: { label: string; wert: number }) {
  return (
    <div className="rounded-[16px] bg-[var(--surface-2)] px-3.5 py-3 ring-1 ring-[var(--line)]">
      <div className="text-[24px] font-semibold leading-none tracking-[-0.03em]">{fmtNum(wert)}</div>
      <div className="mt-1.5 text-[12px] text-fg-3">{label}</div>
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
    { label: "Akten übernommen", wert: e.aktenNeu + e.aktenAktualisiert, sub: e.aktenAktualisiert ? `${e.aktenAktualisiert} davon aktualisiert` : "alle neu angelegt", icon: <FolderOpen className="size-4" /> },
    { label: "Kontakte angelegt", wert: e.kontakteNeu, sub: e.kontakteZusammengefuehrt ? `${e.kontakteZusammengefuehrt} mit vorhandenen zusammengeführt` : "ohne Dubletten", icon: <Users className="size-4" /> },
    { label: "Fristen zur Kontrolle", wert: e.fristen, sub: "mit Vorfrist, Vier-Augen-Prinzip", icon: <CalendarClock className="size-4" /> },
    { label: "Dokumente-Verweise", wert: e.dokumente, sub: "Datenblatt je Akte", icon: <FileText className="size-4" /> },
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
            <div className="mt-1 text-[11.5px] leading-snug text-fg-3">{z.sub}</div>
          </motion.div>
        ))}
      </div>
      {(e.uebersprungen > 0 || e.aktenUmbenannt > 0 || e.fehlerhaft > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {e.uebersprungen > 0 && <Chip>{e.uebersprungen} Dublette(n) übersprungen</Chip>}
          {e.aktenUmbenannt > 0 && <Chip tone="amber">{e.aktenUmbenannt} Aktenzeichen ergänzt (bereits vergeben)</Chip>}
          {e.fehlerhaft > 0 && <Chip tone="seal">{e.fehlerhaft} Zeile(n) nicht übernommen</Chip>}
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
          <div className="text-[13.5px] font-semibold">Ihr Ansprechpartner prüft mit Ihnen die ersten Akten</div>
          <div className="text-[12.5px] text-fg-3">
            {ansprechpartner.name} · <span className="select-all">{ansprechpartner.telefon}</span> · {ansprechpartner.verfuegbar}
          </div>
        </div>
        <Button size="sm" onClick={onTermin}>
          Durchsicht vereinbaren
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-4">
        <Button variant="ghost" size="sm" icon={<RotateCcw className="size-3.5" />} onClick={onRueckgaengig} className="!text-seal">
          Umzug rückgängig machen
        </Button>
        <Button variant="ghost" size="sm" icon={<UploadCloud className="size-3.5" />} onClick={onNeu}>
          Weiteren Export übernehmen
        </Button>
      </div>
    </div>
  );
}
