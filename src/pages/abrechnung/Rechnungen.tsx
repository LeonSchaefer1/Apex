// Reiter „Rechnungen“: Liste aller Rechnungen mit Mehrfachaktionen und dem Einstieg in die Sammelabrechnung.
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { motion } from "motion/react";
import { ArrowRight, BadgeCheck, Info, Layers, Receipt, Send } from "lucide-react";
import { Button, Card, Chip, DataTable, Empty, SearchField, Segmented, type ColumnDef } from "@/components/ui";
import { useCol } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { fmtDate, fmtEUR, round2, today } from "@/core/dates";
import type { Rechnung } from "@/core/types";
import { cn } from "@/lib/cn";
import { markiereBezahlt, sendeZahlungserinnerungen } from "./aktionen";
import { istOffen, istUeberfaellig, MINUTEN_JE_EINZELRECHNUNG, offenerBetrag } from "./lib";
import { useSammelKandidaten } from "./Sammelabrechnung";
import { useAbrechnungUI } from "./store";
import { AkteLabel, Betrag, FormatChip, StatusChip, TabKopf, useLookups } from "./ui";

type Filter = "alle" | "offen" | "ueberfaellig" | "bezahlt" | "entwurf" | "storno";
const FILTER: Filter[] = ["alle", "offen", "ueberfaellig", "bezahlt", "entwurf", "storno"];

/** Zeile der Rechnungsliste – Stornorechnungen erscheinen als eigene Zeile mit Bezug auf die stornierte Rechnung. */
type Zeile = Rechnung & { stornoZu?: Rechnung };

/** Stornorechnung (eigene Nummer aus dem Nummernkreis) als Listenzeile mit negativem Betrag. */
function stornoZeile(r: Rechnung): Zeile {
  const datum = r.storniertAm ?? r.datum;
  return { ...r, id: `${r.id}#storno`, nummer: r.stornoNummer ?? "", datum, faellig: datum, netto: -r.netto, ust: -r.ust, brutto: -r.brutto, bezahlt: 0, status: "storniert", stornoZu: r };
}

function passt(r: Zeile, f: Filter, heute: string) {
  if (f === "alle") return true;
  if (f === "storno") return r.status === "storniert";
  if (r.stornoZu) return false;
  if (f === "offen") return istOffen(r);
  if (f === "ueberfaellig") return istUeberfaellig(r, heute);
  if (f === "bezahlt") return r.status === "bezahlt";
  return r.status === "entwurf";
}

function SammelBanner() {
  const { vorschlaege } = useSammelKandidaten();
  const setSammel = useAbrechnungUI((s) => s.setSammel);
  const n = vorschlaege.length;
  const summe = round2(vorschlaege.reduce((s, v) => s + v.summen.brutto, 0));
  return (
    <Card className="glow mb-5 overflow-hidden !p-0">
      <div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-[var(--ink-soft)] blur-3xl" />
      <div className="relative flex flex-wrap items-center gap-x-6 gap-y-4 p-5">
        <div className="flex min-w-0 flex-1 basis-[320px] items-start gap-3.5">
          <div className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-ink text-white shadow-[0_8px_20px_-8px_var(--ink)]">
            <Layers className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="title-md">{n ? `Sammelabrechnung: ${n} ${n === 1 ? "Akte" : "Akten"} bereit` : "Sammelabrechnung: alles abgerechnet"}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-fg-3">
              Statt jede Akte einzeln abzurechnen, erstellen Sie alle Rechnungen in einem Durchgang – mit RVG-Vorschlag je Verfahrensphase, als PDF, XRechnung oder ZUGFeRD.
            </p>
          </div>
        </div>
        {n > 0 && (
          <div className="flex flex-wrap items-center gap-5">
            <div>
              <div className="eyebrow">Volumen</div>
              <div className="num text-[17px] font-semibold">{fmtEUR(summe, { cents: false })}</div>
            </div>
            <div>
              <div className="eyebrow">Zeitersparnis</div>
              <div className="num text-[17px] font-semibold text-green">≈ {n * MINUTEN_JE_EINZELRECHNUNG} Min.</div>
            </div>
            <Button variant="secondary" iconRight={<ArrowRight className="size-4" />} onClick={() => setSammel(true)}>
              Akten auswählen
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export function RechnungenTab() {
  const rechnungen = useCol("rechnungen");
  const { akten, kontakte } = useLookups();
  const { user } = useKanzlei();
  const oeffne = useAbrechnungUI((s) => s.oeffneRechnung);
  const [params] = useSearchParams();
  const start = params.get("filter") as Filter | null;
  const [filter, setFilter] = useState<Filter>(start && FILTER.includes(start) ? start : "alle");
  const [q, setQ] = useState("");
  const heute = today();

  const alleZeilen = useMemo<Zeile[]>(() => [...rechnungen, ...rechnungen.filter((r) => r.stornoNummer).map(stornoZeile)], [rechnungen]);

  const zaehler = useMemo(() => {
    const c: Record<Filter, number> = { alle: 0, offen: 0, ueberfaellig: 0, bezahlt: 0, entwurf: 0, storno: 0 };
    for (const r of alleZeilen) for (const f of FILTER) if (passt(r, f, heute)) c[f]++;
    return c;
  }, [alleZeilen, heute]);

  const zeilen = useMemo(() => {
    const s = q.trim().toLowerCase();
    return alleZeilen.filter((r) => {
      if (!passt(r, filter, heute)) return false;
      if (!s) return true;
      const a = akten.get(r.akteId);
      const k = kontakte.get(r.empfaengerId);
      return [r.nummer, r.stornoZu?.nummer, a?.aktenzeichen, a?.titel, k?.name].some((x) => x?.toLowerCase().includes(s));
    });
  }, [alleZeilen, filter, q, akten, kontakte, heute]);

  const offenSumme = round2(zeilen.reduce((s, r) => s + offenerBetrag(r), 0));

  const columns = useMemo<ColumnDef<Zeile, unknown>[]>(
    () => [
      {
        id: "nummer",
        header: "Nummer",
        accessorKey: "nummer",
        size: 150,
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="mono text-[12.5px] font-medium">{row.original.nummer}</span>
            {row.original.stornoZu && <div className="mono truncate text-[12px] text-fg-3">zu {row.original.stornoZu.nummer}</div>}
            {!row.original.stornoZu && row.original.stornoNummer && <div className="mono truncate text-[12px] text-fg-3">Storno {row.original.stornoNummer}</div>}
          </div>
        ),
      },
      {
        id: "akte",
        header: "Akte",
        size: 202,
        accessorFn: (r) => akten.get(r.akteId)?.aktenzeichen ?? "",
        sortingFn: (a, b) => (a.getValue<string>("akte") ?? "").localeCompare(b.getValue<string>("akte") ?? "", "de", { numeric: true }),
        cell: ({ row }) => <AkteLabel akte={akten.get(row.original.akteId)} />,
      },
      { id: "empfaenger", header: "Empfänger", size: 156, accessorFn: (r) => kontakte.get(r.empfaengerId)?.name ?? "", cell: ({ getValue }) => <span className="truncate">{getValue<string>()}</span> },
      { id: "datum", header: "Datum", accessorKey: "datum", size: 100, cell: ({ row }) => <span className="num text-fg-2">{fmtDate(row.original.datum)}</span> },
      {
        id: "faellig",
        header: "Fällig",
        accessorKey: "faellig",
        size: 100,
        cell: ({ row }) =>
          row.original.stornoZu ? (
            <span className="text-fg-3">–</span>
          ) : (
            <span className={cn("num", istUeberfaellig(row.original, heute) ? "font-semibold text-seal" : "text-fg-2")}>{fmtDate(row.original.faellig)}</span>
          ),
      },
      {
        id: "brutto",
        header: "Betrag brutto",
        accessorKey: "brutto",
        size: 122,
        cell: ({ row }) => (
          <div className="text-right" title={istOffen(row.original) ? `offen: ${fmtEUR(offenerBetrag(row.original))}` : undefined}>
            <Betrag n={row.original.brutto} className={cn("font-semibold", row.original.status === "storniert" && !row.original.stornoZu && "text-fg-3 line-through")} />
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        size: 126,
        accessorFn: (r) => (r.stornoZu ? "storno" : r.status),
        cell: ({ row }) =>
          row.original.stornoZu ? (
            <Chip tone="seal" title={`Stornorechnung zu ${row.original.stornoZu.nummer}`}>
              Storno
            </Chip>
          ) : (
            <StatusChip r={row.original} />
          ),
      },
      { id: "format", header: "Format", size: 138, accessorKey: "format", cell: ({ row }) => <FormatChip format={row.original.format} /> },
    ],
    [akten, kontakte, heute],
  );

  const labels: Record<Filter, string> = { alle: "Alle", offen: "Offen", ueberfaellig: "Überfällig", bezahlt: "Bezahlt", entwurf: "Entwürfe", storno: "Storniert" };

  return (
    <>
      <TabKopf
        icon={<Receipt className="size-[18px]" />}
        titel="Rechnungen"
        text="Alle Rechnungen mit Status, Fälligkeit und E-Rechnungsformat – Zahlungserinnerungen als Entwurf zur Freigabe, Zahlungseingänge direkt erfassen."
      />
      <SammelBanner />
      <DataTable
        id="rechnungen"
        data={zeilen}
        columns={columns}
        getRowId={(r) => r.id}
        initialSort={[{ id: "datum", desc: true }]}
        onRowClick={(r) => oeffne(r.stornoZu?.id ?? r.id)}
        // Zugängliche Namen für Öffnen-Ziel und Häkchen (I4-T07-01): „Rechnung RE-2026-0024 öffnen“, „RE-2026-0024 auswählen“
        rowLabel={(r) => (r.stornoZu ? `Stornorechnung ${r.nummer} zu ${r.stornoZu.nummer} öffnen` : r.status === "entwurf" ? `Entwurf ${r.nummer} öffnen` : `Rechnung ${r.nummer} öffnen`)}
        selectLabel={(r) => `${r.nummer} auswählen`}
        selectable
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchField id="rechnungen-suche" value={q} onChange={setQ} placeholder="Nummer, Akte, Empfänger …" className="w-full sm:w-[260px]" />
            <Segmented size="sm" options={FILTER.map((f) => ({ value: f, label: labels[f], count: zaehler[f] }))} value={filter} onChange={setFilter} />
            {offenSumme > 0 && (
              <span className="ml-auto hidden text-[12.5px] text-fg-3 lg:inline">
                offen in dieser Ansicht <Betrag n={offenSumme} className="font-semibold text-fg" />
              </span>
            )}
          </div>
        }
        bulkActions={(rows, clear) => {
          // Erinnern und „bezahlt“ nur für gestellte oder teilbezahlte Rechnungen – sonst gesperrt mit Grund (I4-T07-04)
          const offen = rows.filter((r) => !r.stornoZu && istOffen(r));
          const keine = offen.length === 0;
          const gemischt = !keine && offen.length < rows.length;
          const nurEntwuerfe = rows.every((r) => !r.stornoZu && r.status === "entwurf");
          const grund = nurEntwuerfe ? "Nur für gestellte oder teilbezahlte Rechnungen – die Auswahl enthält nur Entwürfe" : "Nur für gestellte oder teilbezahlte Rechnungen – die Auswahl enthält keine offene Rechnung";
          const hinweisId = keine ? "rechnungen-bulk-grund" : gemischt ? "rechnungen-bulk-hinweis" : undefined;
          return (
            <>
              <Button
                size="sm"
                variant="secondary"
                icon={<Send className="size-4" />}
                disabled={keine}
                aria-describedby={hinweisId}
                onClick={() => {
                  const n = sendeZahlungserinnerungen(offen, user.id);
                  if (n) toast(`${n} ${n === 1 ? "Zahlungserinnerung" : "Zahlungserinnerungen"} versendet`, { text: "Im Aktivitätenprotokoll vermerkt", ton: "erfolg" });
                  clear();
                }}
              >
                {gemischt ? `${offen.length} erinnern` : "Zahlungserinnerung senden"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<BadgeCheck className="size-4" />}
                disabled={keine}
                aria-describedby={hinweisId}
                onClick={() => {
                  const n = markiereBezahlt(offen);
                  if (n) toast(`${n} ${n === 1 ? "Rechnung" : "Rechnungen"} als bezahlt markiert`, { text: "Zahlungseingang im Aktenkonto gebucht", ton: "erfolg" });
                  clear();
                }}
              >
                {gemischt ? `${offen.length} als bezahlt markieren` : "Als bezahlt markieren"}
              </Button>
              {keine && (
                <span id="rechnungen-bulk-grund" className="flex items-center gap-1.5 self-center text-[12.5px] text-fg-2">
                  <Info className="size-3.5 shrink-0 text-fg-3" aria-hidden />
                  {grund}
                </span>
              )}
              {gemischt && (
                <span id="rechnungen-bulk-hinweis" className="self-center text-[12.5px] text-fg-3">
                  {offen.length} von {rows.length} ausgewählten sind offen – Entwürfe, bezahlte und stornierte bleiben unberührt.
                </span>
              )}
            </>
          );
        }}
        mobileRow={(r) => {
          const a = akten.get(r.akteId);
          return (
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono text-[12.5px] font-semibold">{r.nummer}</span>
                  {r.stornoZu ? <Chip tone="seal">Storno zu {r.stornoZu.nummer}</Chip> : <StatusChip r={r} />}
                </div>
                <div className="mt-1 line-clamp-2 break-words text-[13.5px]">{a?.titel}</div>
                <div className={cn("mt-0.5 truncate text-[12.5px]", istUeberfaellig(r, heute) ? "text-seal" : "text-fg-3")}>
                  {kontakte.get(r.empfaengerId)?.name} · {r.stornoZu ? `storniert am ${fmtDate(r.datum)}` : `fällig ${fmtDate(r.faellig)}`}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <Betrag n={r.brutto} className="text-[14px] font-semibold" />
                <div className="mt-1 text-[12px] text-fg-3">{r.format}</div>
              </div>
            </div>
          );
        }}
        empty={
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Empty icon={<Receipt className="size-6" />} title="Keine Rechnungen in dieser Ansicht" text="Ändern Sie den Filter oder erstellen Sie Rechnungen über die Sammelabrechnung." />
          </motion.div>
        }
      />
    </>
  );
}
