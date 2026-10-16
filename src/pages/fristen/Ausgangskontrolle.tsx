// Ausgangskontrolle am Abend: alle fälligen Notfristen und Fristen des Tages mit Status „versandt – Nachweis …“ oder „offen“.
// Dazu die Druckansicht „Fristen heute und nächster Arbeitstag“ (papierweiß, schwarz) mit der Zeile „Ausgangskontrolle durchgeführt: ____“.
// „Nächster Arbeitstag“ statt „morgen“: Freitagabend zeigt Montag (bzw. den Tag nach einem Feiertag am Kanzleisitz).
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, CircleAlert, Printer, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { fmtDate, fmtDateWd, wochentagName } from "@/core/dates";
import { fristArtZu } from "@/core/fristen";
import { naechsterArbeitstag } from "@/core/feiertage";
import { useKanzlei } from "@/store/session";
import type { Akte, Frist, User } from "@/core/types";
import { useCol } from "@/store/data";
import { Avatar, Button, Card, Chip, Empty, Modal, Segmented } from "@/components/ui";
import { cn } from "@/lib/cn";
import { TYP_META, erfordertNachweis, nachweisText } from "./logik";
import { NachweisZeile, useFristAktionen } from "./FristZeile";

/** Notfristen und Fristen eines Tages (für „heute“ zusätzlich überfällige offene) – erledigte bleiben mit Nachweis sichtbar. */
export function ausgangsListe(fristen: Frist[], tag: string, heute: string): Frist[] {
  return fristen
    .filter((f) => erfordertNachweis(f) && (f.datum === tag || (tag === heute && f.datum < heute && f.status === "offen")))
    .sort((a, b) => Number(a.status === "erledigt") - Number(b.status === "erledigt") || a.datum.localeCompare(b.datum));
}

function statusVon(f: Frist): "versandt" | "gestrichen" | "ohne" | "offen" {
  if (f.status === "offen") return "offen";
  if (!f.erledigtNachweis) return "ohne";
  return f.erledigtNachweis.art === "gestrichen" ? "gestrichen" : "versandt";
}

function AusgangsZeile({ f, akte, team, user, heute }: { f: Frist; akte?: Akte; team: User[]; user: User; heute: string }) {
  const { umschalten, dialog } = useFristAktionen(f, user);
  const v = team.find((u) => u.id === f.verantwortlichId);
  const art = fristArtZu(f);
  const status = statusVon(f);
  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3.5">
      <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", status === "offen" ? "bg-seal-soft text-seal" : status === "versandt" ? "bg-green-soft text-green" : "bg-ink-softer text-fg-2")} aria-hidden>
        {status === "offen" ? <XCircle className="size-4" /> : status === "versandt" ? <CheckCircle2 className="size-4" /> : status === "gestrichen" ? <Trash2 className="size-4" /> : <CircleAlert className="size-4" />}
      </span>
      <div className="min-w-[220px] flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone={art?.kritisch ? "seal" : "ink"}>{art?.label ?? TYP_META[f.typ].label}</Chip>
          <span className="text-[14px] font-semibold">{f.titel}</span>
          {f.status === "offen" && f.datum < heute && <Chip tone="seal">überfällig seit {fmtDate(f.datum)}</Chip>}
        </div>
        <div className="mt-1 text-[12.5px] text-fg-3">
          {akte ? (
            <>
              <span className="mono font-medium text-fg-2">{akte.aktenzeichen}</span> {akte.titel}
            </>
          ) : (
            "Akte nicht gefunden"
          )}
          {f.grundlage ? ` · ${f.grundlage}` : ""}
        </div>
        <div className="mt-1.5">
          {status === "offen" ? (
            <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-seal">
              <XCircle className="size-3.5" /> offen – noch kein Versandnachweis
            </span>
          ) : (
            <NachweisZeile f={f} team={team} />
          )}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {v && <Avatar initialen={v.initialen} farbe={v.farbe} size={26} title={`Verantwortlich: ${v.name}`} />}
        {f.status === "offen" ? (
          <Button size="sm" variant="primary" icon={<ShieldCheck className="size-4" />} onClick={umschalten}>
            Erledigt …
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={umschalten} title="Wieder öffnen (wird protokolliert)">
            Wieder öffnen
          </Button>
        )}
      </div>
      {dialog}
    </li>
  );
}

/** „Mo, 19.10.“ */
export const kurzTag = (iso: string) => `${wochentagName(iso, true)}, ${fmtDate(iso).slice(0, 6)}`;

export function Ausgangskontrolle({ fristen, akten, team, user, heute }: { fristen: Frist[]; akten: Map<string, Akte>; team: User[]; user: User; heute: string }) {
  const { tenant } = useKanzlei();
  const [wann, setWann] = useState<"heute" | "naechster">("heute");
  const [druck, setDruck] = useState(false);
  const naechster = naechsterArbeitstag(heute, tenant.bundesland);
  const tag = wann === "heute" ? heute : naechster;
  const liste = useMemo(() => ausgangsListe(fristen, tag, heute), [fristen, tag, heute]);
  const zahl = (s: ReturnType<typeof statusVon>) => liste.filter((f) => statusVon(f) === s).length;
  const offen = zahl("offen");
  return (
    <div className="grid gap-4">
      <Card className="!p-4 sm:!p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 basis-[260px]">
            <h2 className="title-md">Ausgangskontrolle · {fmtDateWd(tag)}</h2>
            <p className="mt-0.5 text-[12.5px] text-fg-3">Jede fällige Notfrist und Frist: versandt mit Nachweis oder offen. „Erledigt“ geht nur mit Nachweis oder Grund.</p>
          </div>
          <Segmented
            size="sm"
            value={wann}
            onChange={setWann}
            options={[
              { value: "heute", label: "Heute" },
              { value: "naechster", label: `Nächster Arbeitstag (${kurzTag(naechster)})` },
            ]}
          />
          <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => setDruck(true)}>
            Drucken
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" aria-live="polite">
          <Chip tone={offen ? "seal" : "green"} icon={offen ? <XCircle className="size-3" /> : <CheckCircle2 className="size-3" />}>
            {offen} offen
          </Chip>
          <Chip tone="green" icon={<CheckCircle2 className="size-3" />}>
            {zahl("versandt")} versandt mit Nachweis
          </Chip>
          {zahl("gestrichen") > 0 && <Chip>{zahl("gestrichen")} gestrichen</Chip>}
          {zahl("ohne") > 0 && <Chip tone="amber">{zahl("ohne")} erledigt ohne Nachweis</Chip>}
        </div>
      </Card>
      {liste.length === 0 ? (
        <Card>
          <Empty icon={<ShieldCheck className="size-6" />} title={`${wann === "heute" ? "Heute" : `Am nächsten Arbeitstag (${kurzTag(naechster)})`} keine fälligen Fristen`} text="Wiedervorlagen und Termine erscheinen im Kalender – die Ausgangskontrolle betrifft Notfristen und Fristen." />
        </Card>
      ) : (
        <Card padded={false} className="overflow-hidden">
          <ul className="divide-y divide-[var(--line)]">
            {liste.map((f) => (
              <AusgangsZeile key={f.id} f={f} akte={akten.get(f.akteId)} team={team} user={user} heute={heute} />
            ))}
          </ul>
        </Card>
      )}
      <Druckansicht open={druck} onClose={() => setDruck(false)} fristen={fristen} akten={akten} team={team} heute={heute} />
    </div>
  );
}

/** Druckansicht „Fristen heute und nächster Arbeitstag“ – Vorschau im Dialog, gedruckt wird nur das Blatt (print-CSS). */
export function Druckansicht({ open, onClose, fristen, akten, team, heute }: { open: boolean; onClose: () => void; fristen: Frist[]; akten: Map<string, Akte>; team: User[]; heute: string }) {
  const nachrichten = useCol("nachrichten");
  const transaktionen = useCol("transaktionen");
  const { tenant } = useKanzlei();
  // Nächster Arbeitstag am Kanzleisitz (Freitag → Montag); dazwischen liegende Tage (Wochenende, Feiertag) mitnehmen
  const morgen = naechsterArbeitstag(heute, tenant.bundesland);
  const zeilen = useMemo(
    () =>
      fristen
        .filter((f) => f.typ !== "vorfrist" && ((f.datum >= heute && f.datum <= morgen) || (f.status === "offen" && f.datum < heute)))
        .sort((a, b) => a.datum.localeCompare(b.datum) || (a.uhrzeit ?? "").localeCompare(b.uhrzeit ?? "")),
    [fristen, heute, morgen],
  );
  const blatt = (
    <div className="druck-blatt">
      <h1>Fristen heute und nächster Arbeitstag</h1>
      <p className="druck-unter">
        {fmtDateWd(heute)} und nächster Arbeitstag {fmtDateWd(morgen)} · Stand {fmtDate(heute)}
      </p>
      <table>
        <thead>
          <tr>
            <th>Datum</th>
            <th>Akte</th>
            <th>Frist</th>
            <th>Art</th>
            <th>Verantwortlich</th>
            <th>Status/Nachweis</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((f) => {
            const a = akten.get(f.akteId);
            const art = fristArtZu(f)?.label ?? TYP_META[f.typ].label;
            return (
              <tr key={f.id}>
                <td>
                  {fmtDate(f.datum)}
                  {f.uhrzeit ? `, ${f.uhrzeit} Uhr` : ""}
                </td>
                <td>{a ? `${a.aktenzeichen} ${a.titel}` : "–"}</td>
                <td>{f.titel}</td>
                <td>{art}</td>
                <td>{team.find((u) => u.id === f.verantwortlichId)?.name ?? "–"}</td>
                <td>{f.status === "offen" ? "offen" : erfordertNachweis(f) ? nachweisText(f, team, nachrichten, transaktionen) : "erledigt"}</td>
              </tr>
            );
          })}
          {!zeilen.length && (
            <tr>
              <td colSpan={6}>Keine Einträge.</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="druck-unterschrift">Ausgangskontrolle durchgeführt: ______________________________ (Name, Uhrzeit)</p>
    </div>
  );
  const css = `
    #apex-druck { display: none; }
    .druck-blatt { background: white; color: black; font: 12px/1.45 system-ui, sans-serif; padding: 18px; }
    .druck-blatt h1 { font-size: 18px; margin: 0 0 2px; }
    .druck-unter { margin: 0 0 12px; }
    .druck-blatt table { width: 100%; border-collapse: collapse; }
    .druck-blatt th, .druck-blatt td { border: 1px solid black; padding: 4px 6px; text-align: left; vertical-align: top; }
    .druck-blatt th { font-weight: 700; }
    .druck-unterschrift { margin-top: 28px; }
    @media print {
      body > *:not(#apex-druck) { display: none !important; }
      #apex-druck { display: block !important; }
      @page { size: A4 landscape; margin: 12mm; }
    }`;
  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="xl"
        title="Druckansicht: Fristen heute und nächster Arbeitstag"
        subtitle="Papierweiß, schwarz – mit Zeile für die abendliche Ausgangskontrolle"
        icon={<Printer className="size-[18px]" />}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Schließen
            </Button>
            <Button variant="primary" icon={<Printer className="size-4" />} onClick={() => window.print()}>
              Drucken
            </Button>
          </>
        }
      >
        <style>{css}</style>
        <div className="overflow-x-auto rounded-[12px] ring-1 ring-[var(--line)]">{blatt}</div>
      </Modal>
      {open && createPortal(<div id="apex-druck">{blatt}</div>, document.body)}
    </>
  );
}
