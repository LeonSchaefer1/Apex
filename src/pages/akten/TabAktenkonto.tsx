// Reiter „Aktenkonto“: Buchungen mit laufendem Saldo, Fremdgeld-Wächter (§ 43a Abs. 7 BRAO) und Forderungskonto (§§ 288, 367 BGB).
import { useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { AlertTriangle, ArrowRightLeft, Calculator, Copy, Info, Landmark, Plus, ReceiptEuro, Scale, Wallet } from "lucide-react";
import type { Akte, Buchung, BuchungsArt } from "@/core/types";
import { fmtDate, fmtEUR, fmtNum, round2, today, uid } from "@/core/dates";
import { basiszinsAm, forderungskonto, type ForderungsVorgang } from "@/core/zinsen";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { AnimatedNumber, Button, Card, CardHeader, Chip, Empty, Field, Input, Modal, Segmented, Select, Switch, type Tone } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useIsMobile } from "@/lib/useMedia";
import { kopiere } from "@/pages/kontakte/kontaktHelfer";
import { parseEuro } from "./Mandatsaufnahme";
import { erledigeFrist } from "@/pages/fristen/logik";
import { beruehreAkte, useKontaktMap } from "./helfer";

export const ART_INFO: Record<BuchungsArt, { label: string; tone: Tone }> = {
  honorar: { label: "Honorar", tone: "ink" },
  vorschuss: { label: "Vorschuss", tone: "violet" },
  fremdgeld: { label: "Fremdgeld", tone: "amber" },
  auslage: { label: "Auslage", tone: "neutral" },
  zahlung: { label: "Zahlung", tone: "green" },
  gerichtskosten: { label: "Gerichtskosten", tone: "neutral" },
  zinsen: { label: "Zinsen", tone: "neutral" },
  kosten: { label: "Kosten", tone: "neutral" },
};

/** Betrag mit typografischem Minus (U+2212) – überall im Aktenkonto gleich, auch für Salden. */
const eur = (n: number) => {
  const r = round2(n);
  return r < 0 ? `−${fmtEUR(-r)}` : fmtEUR(r === 0 ? 0 : r);
};

/** Vorschuss: − = eingegangen (Zahlung des Mandanten), + = angefordert, noch nicht bezahlt (Forderung). */
const istVorschussAnforderung = (b: Buchung) => b.art === "vorschuss" && b.betrag > 0;
const artLabel = (b: Buchung) => (istVorschussAnforderung(b) ? "Vorschuss angefordert" : ART_INFO[b.art].label);

export function TabAktenkonto({ akte }: { akte: Akte }) {
  const alle = useCol("buchungen");
  const { user } = useKanzlei();
  const kontakte = useKontaktMap();
  const mobile = useIsMobile();
  const [neu, setNeu] = useState(false);
  const mandant = kontakte.get(akte.mandantId);

  const buchungen = useMemo(() => alle.filter((b) => b.akteId === akte.id).sort((a, b) => a.datum.localeCompare(b.datum) || a.id.localeCompare(b.id)), [alle, akte.id]);

  // Laufender Saldo des Honorarkontos – Fremdgeld wird getrennt geführt (Treuhand)
  const zeilen = useMemo(() => {
    let saldo = 0;
    return buchungen.map((b) => {
      const fremd = b.fremdgeld || b.art === "fremdgeld";
      if (!fremd) saldo = round2(saldo + b.betrag);
      return { b, fremd, saldo };
    });
  }, [buchungen]);

  const summen = useMemo(() => {
    let honorar = 0, bezahlt = 0, vorschuss = 0, angefordert = 0, fremdEin = 0, fremdAus = 0, auslagen = 0;
    for (const b of buchungen) {
      const fremd = b.fremdgeld || b.art === "fremdgeld";
      if (fremd) {
        if (b.art === "fremdgeld" && b.betrag < 0) fremdAus += -b.betrag;
        else fremdEin += Math.abs(b.betrag);
        continue;
      }
      if (b.art === "honorar") honorar += b.betrag;
      else if (b.art === "zahlung") bezahlt += -b.betrag;
      else if (b.art === "vorschuss") {
        // nur eingegangene Vorschüsse mindern das Offene – ein angeforderter ist eine Forderung, kein Guthaben
        if (b.betrag < 0) vorschuss += -b.betrag;
        else angefordert += b.betrag;
      } else auslagen += b.betrag;
    }
    const fremdOffen = round2(fremdEin - fremdAus);
    return {
      honorar: round2(honorar), bezahlt: round2(bezahlt), vorschuss: round2(vorschuss), angefordert: round2(angefordert), auslagen: round2(auslagen),
      offen: round2(honorar + auslagen + angefordert - bezahlt - vorschuss), fremdEin: round2(fremdEin), fremdOffen,
    };
  }, [buchungen]);

  const fremdgeldWeiterleiten = () => {
    const st = useData.getState();
    st.upsert("buchungen", { id: uid("b"), akteId: akte.id, datum: today(), art: "fremdgeld", betrag: -summen.fremdOffen, text: `Weiterleitung Fremdgeld an ${mandant?.name ?? "Mandant"}`, fremdgeld: true });
    const frist = st.data.fristen.find((f) => f.akteId === akte.id && f.status === "offen" && /fremdgeld/i.test(f.titel));
    if (frist) erledigeFrist(frist, user.id);
    st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Fremdgeld ${eur(summen.fremdOffen)} an ${mandant?.name ?? "Mandant"} weitergeleitet – ${akte.aktenzeichen}` });
    beruehreAkte(akte.id);
    toast("Fremdgeld weitergeleitet", { ton: "erfolg", text: `${eur(summen.fremdOffen)} an ${mandant?.name ?? "den Mandanten"}${frist ? " · zugehörige Frist erledigt" : ""}` });
  };

  return (
    <div className="grid grid-cols-1 gap-5">
      {/* Kennzahlen */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kachel label="Honorar gestellt" wert={summen.honorar} icon={<ReceiptEuro className="size-4" />} />
        <Kachel label="Bezahlt" wert={summen.bezahlt} icon={<Wallet className="size-4" />} tone="green" />
        <Kachel
          label="Vorschüsse"
          wert={summen.vorschuss}
          icon={<ArrowRightLeft className="size-4" />}
          tone="violet"
          sub={summen.angefordert > 0 ? `eingegangen · ${eur(summen.angefordert)} angefordert` : summen.vorschuss > 0 ? "eingegangen" : undefined}
        />
        <Kachel
          label="Offen"
          wert={Math.max(0, summen.offen)}
          icon={<Scale className="size-4" />}
          tone={summen.offen > 0 ? "amber" : "green"}
          sub={summen.offen < 0 ? `Guthaben ${eur(-summen.offen)}` : summen.angefordert > 0 ? `inkl. ${eur(summen.angefordert)} Vorschussanforderung` : undefined}
        />
        <Kachel
          label="Fremdgeld (Treuhand)"
          wert={summen.fremdOffen}
          icon={<Landmark className="size-4" />}
          tone={summen.fremdOffen > 0 ? "seal" : "green"}
          sub={summen.fremdOffen > 0 ? "nicht weitergeleitet" : summen.fremdEin > 0 ? "vollständig weitergeleitet" : "kein Fremdgeld"}
          className="col-span-2 lg:col-span-1"
          hervorheben={summen.fremdOffen > 0}
        />
      </div>

      {summen.fremdOffen > 0 && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 rounded-[22px] bg-seal-soft p-4 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--seal)_25%,transparent)]" role="alert">
          <span className="grid grid-cols-1 size-10 shrink-0 place-items-center rounded-[12px] bg-[var(--surface)] text-seal">
            <AlertTriangle className="size-5" />
          </span>
          <div className="min-w-0 flex-1 basis-[260px]">
            <div className="text-[14px] font-semibold text-seal">Fremdgeld unverzüglich weiterleiten</div>
            <p className="text-[12.5px] leading-snug text-fg-2">
              Auf dem Anderkonto liegen <span className="num font-semibold">{eur(summen.fremdOffen)}</span>, die {mandant?.name ?? "dem Mandanten"} zustehen. Fremdgeld ist nach § 43a Abs. 7 BRAO unverzüglich an den Berechtigten weiterzuleiten.
            </p>
          </div>
          <Button variant="danger" icon={<ArrowRightLeft className="size-4" />} onClick={fremdgeldWeiterleiten}>
            Weiterleitung buchen
          </Button>
        </motion.div>
      )}

      {/* Buchungen */}
      <Card padded={false}>
        <div className="flex flex-wrap items-start gap-3 p-5 pb-3">
          <CardHeader className="!mb-0 min-w-0 flex-1 basis-[260px]" icon={<ReceiptEuro className="size-4" />} title="Buchungen" subtitle="Honorar, Zahlungen, Vorschüsse und Auslagen · + Forderung an den Mandanten, − Zahlung oder Gutschrift" />
          <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setNeu(true)}>
            Buchung erfassen
          </Button>
        </div>
        {zeilen.length === 0 ? (
          <Empty icon={<ReceiptEuro className="size-6" />} title="Noch keine Buchungen" text="Rechnungen, Zahlungseingänge aus dem Bankabgleich und Vorschüsse erscheinen hier automatisch." />
        ) : mobile ? (
          <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
            {zeilen.map(({ b, fremd, saldo }) => (
              <li key={b.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Chip tone={ART_INFO[b.art].tone}>{artLabel(b)}</Chip>
                    {fremd && b.art !== "fremdgeld" && <Chip tone="amber">Fremdgeld</Chip>}
                  </div>
                  <div className="mt-1 truncate text-[13.5px]">{b.text}</div>
                  <div className="text-[12px] text-fg-3">{fmtDate(b.datum)}</div>
                </div>
                <div className="text-right">
                  <Betrag n={b.betrag} />
                  <div className="num text-[11.5px] text-fg-4">{fremd ? "Treuhand" : `Saldo ${eur(saldo)}`}</div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="overflow-x-auto border-t border-[var(--line)]">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Datum</th>
                  <th style={{ width: 150 }}>Art</th>
                  <th>Buchungstext</th>
                  <th className="!text-right" style={{ width: 140 }}>Betrag</th>
                  <th className="!text-right" style={{ width: 150 }}>Saldo Honorar</th>
                </tr>
              </thead>
              <tbody>
                {zeilen.map(({ b, fremd, saldo }) => (
                  <tr key={b.id}>
                    <td className="num whitespace-nowrap text-fg-2">{fmtDate(b.datum)}</td>
                    <td className="whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <Chip tone={ART_INFO[b.art].tone}>{artLabel(b)}</Chip>
                        {fremd && b.art !== "fremdgeld" && <Chip tone="amber">Fremdgeld</Chip>}
                      </span>
                    </td>
                    <td className="w-full max-w-0 truncate" title={b.text}>{b.text}</td>
                    <td className="whitespace-nowrap text-right">
                      <Betrag n={b.betrag} />
                    </td>
                    <td className="num whitespace-nowrap text-right text-fg-2">{fremd ? <span className="text-[12px] text-fg-4">getrennt (Treuhand)</span> : eur(saldo)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="px-3 py-3 text-[12.5px] font-semibold text-fg-2">
                    Saldo Honorarkonto
                  </td>
                  <td />
                  <td className={cn("num px-3 py-3 text-right text-[14px] font-semibold", summen.offen > 0 ? "text-amber" : "text-green")}>{eur(summen.offen)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {akte.forderung && <Forderungskonto akte={akte} buchungen={buchungen} />}

      <BuchungErfassen akte={akte} open={neu} onClose={() => setNeu(false)} />
    </div>
  );
}

function Betrag({ n }: { n: number }) {
  return <span className={cn("num font-medium", n < 0 ? "text-green" : "text-fg")}>{n > 0 ? "+" : ""}{eur(n)}</span>;
}

function Kachel({ label, wert, icon, tone = "ink", sub, className, hervorheben }: { label: string; wert: number; icon: ReactNode; tone?: Tone; sub?: string; className?: string; hervorheben?: boolean }) {
  const toneCls = { ink: "bg-ink-soft text-ink", seal: "bg-seal-soft text-seal", amber: "bg-amber-soft text-amber", green: "bg-green-soft text-green", violet: "bg-violet-soft text-violet", neutral: "bg-ink-softer text-fg-2", outline: "bg-ink-softer text-fg-2" }[tone];
  return (
    <div className={cn("sheet relative min-w-0 rounded-[22px] p-4", hervorheben && "shadow-[0_0_0_1.5px_var(--seal),0_12px_32px_-18px_var(--seal)]", className)}>
      <div className="flex items-center gap-2">
        <span className={cn("grid size-7 place-items-center rounded-[9px]", toneCls)}>{icon}</span>
        <span className="truncate text-[12px] font-medium text-fg-3">{label}</span>
      </div>
      <div className={cn("mt-2.5 text-[21px] font-semibold tracking-[-0.03em]", hervorheben && "text-seal")}>
        <AnimatedNumber value={wert} format={eur} />
      </div>
      {sub && (
        <div className="mt-0.5 truncate text-[11.5px] text-fg-3" title={sub}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Forderungskonto({ akte, buchungen }: { akte: Akte; buchungen: Buchung[] }) {
  const f = akte.forderung!;
  const kontakte = useKontaktMap();
  const mobile = useIsMobile();
  const stichtag = today();
  const schuldner = kontakte.get(f.schuldnerId ?? akte.gegnerId ?? "");

  const stand = useMemo(() => {
    const vorgaenge: ForderungsVorgang[] = [
      { datum: f.faelligAb, art: "hauptforderung", betrag: f.hauptforderung, text: f.titel ?? "Forderung bei Verzugseintritt" },
      ...buchungen.filter((b) => b.art === "kosten").map((b) => ({ datum: b.datum, art: "kosten" as const, betrag: Math.abs(b.betrag), text: b.text })),
      ...buchungen.filter((b) => b.art === "zahlung" && b.fremdgeld).map((b) => ({ datum: b.datum, art: "zahlung" as const, betrag: Math.abs(b.betrag), text: b.text })),
    ];
    return forderungskonto({ vorgaenge, verzugAb: f.faelligAb, stichtag, verbraucher: f.verbraucher });
  }, [f, buchungen, stichtag]);

  const aufschlag = f.verbraucher ? 5 : 9;

  // Verzugszinsen: insgesamt aufgelaufen, davon durch Teilzahlungen verrechnet (§ 367 BGB), und seit wann der offene Rest läuft
  const zinsInfo = useMemo(() => {
    const gesamt = round2(stand.zinsAbschnitte.reduce((s, z) => s + z.zinsen, 0));
    const verrechnet = round2(stand.verlauf.reduce((s, v) => s + (v.aufZinsen ?? 0), 0));
    let kosten = 0;
    let offenSeit = f.faelligAb;
    for (const v of stand.verlauf) {
      if (v.art === "kosten") kosten = round2(kosten + v.betrag);
      if (v.art !== "zahlung") continue;
      kosten = round2(kosten - (v.aufKosten ?? 0));
      // Zinsen nach dieser Zahlung vollständig getilgt → der offene Rest läuft ab dem Zahlungstag
      if (round2(v.saldoGesamt - v.saldoHaupt - kosten) <= 0) offenSeit = v.datum;
    }
    return { gesamt, verrechnet, offenSeit };
  }, [stand, f.faelligAb]);

  const aufstellung = () => {
    const z = [
      `Forderungsaufstellung – ${akte.aktenzeichen} ${akte.titel}`,
      `Schuldner: ${schuldner?.name ?? "–"} · Stichtag ${fmtDate(stichtag)}`,
      `Verzugszinsen: ${aufschlag} Prozentpunkte über dem Basiszinssatz (§ 288 Abs. ${f.verbraucher ? 1 : 2} BGB)`,
      "",
      ...stand.verlauf.map((v) => `${fmtDate(v.datum)}  ${v.text.padEnd(46).slice(0, 46)}  ${fmtEUR(v.betrag).padStart(14)}${v.art === "zahlung" ? `  (Kosten ${fmtEUR(v.aufKosten ?? 0)}, Zinsen ${fmtEUR(v.aufZinsen ?? 0)}, Hauptforderung ${fmtEUR(v.aufHaupt ?? 0)})` : ""}`),
      "",
      `Hauptforderung offen: ${fmtEUR(stand.hauptforderung)}`,
      `Zinsen offen:         ${fmtEUR(stand.zinsen)}`,
      `Kosten offen:         ${fmtEUR(stand.kosten)}`,
      `Gesamtforderung:      ${fmtEUR(stand.gesamt)}`,
    ];
    void kopiere(z.join("\n"), "Forderungsaufstellung");
  };

  const ART_LABEL = { hauptforderung: "Hauptforderung", kosten: "Kosten", zahlung: "Zahlung", zinsen: "Zinsen" } as const;

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-start gap-3 p-5 pb-4">
        <CardHeader
          className="!mb-0 min-w-0 flex-1 basis-[260px]"
          icon={<Calculator className="size-4" />}
          title="Forderungskonto"
          subtitle={`Taggenaue Verzugszinsen nach § 288 Abs. ${f.verbraucher ? 1 : 2} BGB (${aufschlag} Prozentpunkte über Basiszinssatz) · Zahlungen verrechnet nach § 367 BGB · Stichtag ${fmtDate(stichtag)}`}
        />
        <Button size="sm" variant="secondary" icon={<Copy className="size-4" />} onClick={aufstellung}>
          Aufstellung kopieren
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 lg:grid-cols-4">
        <Wert label="Hauptforderung" wert={stand.hauptforderung} sub={`ursprünglich ${eur(f.hauptforderung)}`} />
        <Wert
          label="Zinsen offen"
          wert={stand.zinsen}
          sub={`seit ${fmtDate(zinsInfo.offenSeit)}${zinsInfo.offenSeit !== f.faelligAb ? " (nach Verrechnung)" : ""}`}
          titel={`Offene Verzugszinsen für ${fmtDate(zinsInfo.offenSeit)} bis ${fmtDate(stichtag)}. Seit Verzugsbeginn am ${fmtDate(f.faelligAb)} insgesamt ${eur(zinsInfo.gesamt)}${zinsInfo.verrechnet > 0 ? `, davon ${eur(zinsInfo.verrechnet)} mit Teilzahlungen verrechnet (§ 367 BGB)` : ""}.`}
        />
        <Wert label="Kosten" wert={stand.kosten} sub="verauslagt, offen" />
        <Wert label="Gesamtforderung" wert={stand.gesamt} sub={`bereits gezahlt ${eur(stand.bezahlt)}`} gross />
      </div>

      <div className="mx-5 mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[14px] bg-ink-softer px-3.5 py-2.5 text-[12.5px] text-fg-2">
        <span>
          Schuldner: <span className="font-medium text-fg">{schuldner?.name ?? "–"}</span> {f.verbraucher ? <Chip>Verbraucher</Chip> : <Chip>Unternehmer</Chip>}
        </span>
        {f.titel && (
          <span>
            Titel: <span className="font-medium text-fg">{f.titel}</span>
          </span>
        )}
        <span>
          Verzug seit <span className="num font-medium text-fg">{fmtDate(f.faelligAb)}</span>
        </span>
        <span>
          Zinsen seit Verzugsbeginn <span className="num font-medium text-fg">{eur(zinsInfo.gesamt)}</span>
          {zinsInfo.verrechnet > 0 && (
            <>
              , davon <span className="num font-medium text-fg">{eur(zinsInfo.verrechnet)}</span> verrechnet
            </>
          )}
        </span>
      </div>

      <div className="mt-5 border-t border-[var(--line)]">
        <div className="flex items-center gap-2 px-5 pb-2 pt-4">
          <span className="title-md">Verlauf</span>
          <span className="text-[12px] text-fg-3">Jede Zahlung wird zuerst auf die Kosten, dann auf die Zinsen und zuletzt auf die Hauptforderung angerechnet.</span>
        </div>
        {mobile ? (
          <ul className="divide-y divide-[var(--line)]">
            {stand.verlauf.map((v, i) => (
              <li key={i} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Chip tone={v.art === "zahlung" ? "green" : v.art === "zinsen" ? "amber" : v.art === "kosten" ? "neutral" : "ink"}>{ART_LABEL[v.art]}</Chip>
                    <div className="mt-1 text-[13px]">{v.text}</div>
                    <div className="text-[12px] text-fg-3">{fmtDate(v.datum)}</div>
                  </div>
                  <div className="text-right">
                    <span className={cn("num text-[13.5px] font-semibold", v.betrag < 0 && "text-green")}>{eur(v.betrag)}</span>
                    <div className="num text-[11.5px] text-fg-4">Saldo {eur(v.saldoGesamt)}</div>
                  </div>
                </div>
                {v.art === "zahlung" && (
                  <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-[12px] bg-ink-softer p-2 text-center text-[11px]">
                    <Verrechnung label="auf Kosten" n={v.aufKosten} />
                    <Verrechnung label="auf Zinsen" n={v.aufZinsen} />
                    <Verrechnung label="auf Hauptford." n={v.aufHaupt} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[860px]">
              <thead>
                <tr>
                  <th rowSpan={2} style={{ width: 104 }} className="!align-bottom">
                    Datum
                  </th>
                  <th rowSpan={2} className="!align-bottom">
                    Vorgang
                  </th>
                  <th rowSpan={2} className="!text-right !align-bottom" style={{ width: 120 }}>
                    Betrag
                  </th>
                  <th colSpan={3} className="!border-b-0 !pb-0 !text-center" style={{ color: "var(--ink)" }}>
                    <span className="inline-block rounded-full bg-ink-soft px-2.5 py-0.5 text-[11px]">Verrechnung nach § 367 BGB</span>
                  </th>
                  <th rowSpan={2} className="!text-right !align-bottom" style={{ width: 130 }}>
                    Hauptforderung
                  </th>
                  <th rowSpan={2} className="!text-right !align-bottom" style={{ width: 130 }}>
                    Gesamt offen
                  </th>
                </tr>
                <tr>
                  <th className="!top-[37px] !text-right" style={{ width: 100 }}>
                    auf Kosten
                  </th>
                  <th className="!top-[37px] !text-right" style={{ width: 100 }}>
                    auf Zinsen
                  </th>
                  <th className="!top-[37px] !text-right" style={{ width: 116 }}>
                    auf Hauptford.
                  </th>
                </tr>
              </thead>
              <tbody>
                {stand.verlauf.map((v, i) => (
                  <tr key={i} className={cn(v.art === "zinsen" && "bg-amber-soft/40")}>
                    <td className="num whitespace-nowrap text-fg-2">{fmtDate(v.datum)}</td>
                    <td className="w-full max-w-0">
                      <span className="flex min-w-0 items-center gap-2" title={v.text}>
                        <Chip tone={v.art === "zahlung" ? "green" : v.art === "zinsen" ? "amber" : v.art === "kosten" ? "neutral" : "ink"}>{ART_LABEL[v.art]}</Chip>
                        <span className="truncate">{v.text}</span>
                      </span>
                    </td>
                    <td className={cn("num whitespace-nowrap text-right font-medium", v.betrag < 0 && "text-green")}>{eur(v.betrag)}</td>
                    <td className="num text-right text-fg-2">{v.aufKosten !== undefined ? eur(v.aufKosten) : <span className="text-fg-4">–</span>}</td>
                    <td className="num text-right text-fg-2">{v.aufZinsen !== undefined ? eur(v.aufZinsen) : <span className="text-fg-4">–</span>}</td>
                    <td className="num text-right text-fg-2">{v.aufHaupt !== undefined ? eur(v.aufHaupt) : <span className="text-fg-4">–</span>}</td>
                    <td className="num text-right">{eur(v.saldoHaupt)}</td>
                    <td className="num text-right font-semibold">{eur(v.saldoGesamt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--line)] px-5 pb-5 pt-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="title-md">Zinsperioden</span>
          <span className="text-[12px] text-fg-3">Basiszinssatz nach § 247 BGB (Deutsche Bundesbank) – neuer Abschnitt bei jeder Zahlung und jeder Änderung des Basiszinssatzes.</span>
        </div>
        <div className="overflow-x-auto rounded-[16px] shadow-[0_0_0_1px_var(--line)]">
          <table className="table min-w-[640px]">
            <thead>
              <tr>
                <th>Zeitraum</th>
                <th className="!text-right">Tage</th>
                <th className="!text-right">Kapital</th>
                <th className="!text-right">Basiszinssatz</th>
                <th className="!text-right">Zinssatz</th>
                <th className="!text-right">Zinsen</th>
              </tr>
            </thead>
            <tbody>
              {stand.zinsAbschnitte.map((z, i) => (
                <tr key={i}>
                  <td className="num">
                    {fmtDate(z.von)} – {fmtDate(z.bis)}
                  </td>
                  <td className="num text-right text-fg-2">{z.tage}</td>
                  <td className="num text-right text-fg-2">{eur(z.kapital)}</td>
                  <td className="num text-right text-fg-2">{fmtNum(basiszinsAm(z.von), 2)} %</td>
                  <td className="num text-right">{fmtNum(z.zinssatz, 2)} %</td>
                  <td className="num text-right font-medium">{eur(z.zinsen)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="px-3 py-2.5 text-[12.5px] font-semibold text-fg-2">
                  Zinsen insgesamt (vor Verrechnung)
                </td>
                <td className="num px-3 py-2.5 text-right font-semibold">{eur(round2(stand.zinsAbschnitte.reduce((s, z) => s + z.zinsen, 0)))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-3 flex gap-2 text-[12px] text-fg-3">
          <Info className="mt-px size-3.5 shrink-0" /> Zinsberechnung taggenau (act/365), Fristbeginn mit Verzugseintritt. Teilzahlungen des Schuldners sind Fremdgeld und gehen an den Mandanten.
        </p>
      </div>
    </Card>
  );
}

function Verrechnung({ label, n }: { label: string; n?: number }) {
  return (
    <div>
      <div className="text-fg-4">{label}</div>
      <div className="num font-medium text-fg-2">{eur(n ?? 0)}</div>
    </div>
  );
}

function Wert({ label, wert, sub, gross, titel }: { label: string; wert: number; sub?: string; gross?: boolean; titel?: string }) {
  return (
    <div className={cn("min-w-0 rounded-[16px] p-3.5", gross ? "bg-ink text-on-ink shadow-[0_10px_24px_-12px_var(--ink)]" : "bg-[var(--surface)] shadow-[0_0_0_1px_var(--line)]")}>
      <div className={cn("truncate text-[12px] font-medium", gross ? "opacity-80" : "text-fg-3")}>{label}</div>
      <div className="mt-1 text-[20px] font-semibold tracking-[-0.03em]">
        <AnimatedNumber value={wert} format={eur} />
      </div>
      {sub && (
        <div className={cn("text-[11.5px] leading-snug", gross ? "opacity-75" : "text-fg-3")} title={titel ?? sub}>
          {sub}
        </div>
      )}
    </div>
  );
}

function BuchungErfassen({ akte, open, onClose }: { akte: Akte; open: boolean; onClose: () => void }) {
  const { user } = useKanzlei();
  const [art, setArt] = useState<BuchungsArt>("auslage");
  const [datum, setDatum] = useState(today());
  const [text, setText] = useState("");
  const [betrag, setBetrag] = useState("");
  const [fremd, setFremd] = useState(false);
  const [vorschussStand, setVorschussStand] = useState<"eingegangen" | "angefordert">("eingegangen");
  const wert = parseEuro(betrag);
  const ok = !!text.trim() && !Number.isNaN(wert) && wert > 0 && /^\d{4}-\d{2}-\d{2}$/.test(datum);
  // Vorzeichen: Forderungen an den Mandanten positiv, Zahlungseingänge/Vorschüsse negativ
  // Ein angeforderter Vorschuss ist eine Forderung (+), erst der Eingang mindert das Offene (−).
  const vorzeichen = art === "zahlung" || (art === "vorschuss" && vorschussStand === "eingegangen") ? -1 : 1;

  const speichern = () => {
    const b: Buchung = { id: uid("b"), akteId: akte.id, datum, art, betrag: round2(vorzeichen * wert), text: text.trim(), fremdgeld: art === "fremdgeld" || fremd || undefined };
    useData.getState().upsert("buchungen", b);
    useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Buchung erfasst: ${ART_INFO[art].label} ${fmtEUR(wert)} – ${akte.aktenzeichen}` });
    beruehreAkte(akte.id);
    toast("Buchung erfasst", { ton: "erfolg", text: `${art === "vorschuss" && vorzeichen > 0 ? "Vorschuss angefordert" : ART_INFO[art].label} · ${fmtEUR(wert)}` });
    setText("");
    setBetrag("");
    setFremd(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      icon={<Plus className="size-[18px]" />}
      title="Buchung erfassen"
      subtitle={`${akte.aktenzeichen} · Aktenkonto`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" disabled={!ok} onClick={speichern}>
            Buchen
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Art" htmlFor="bu-art">
            <Select id="bu-art" value={art} onChange={(e) => setArt(e.target.value as BuchungsArt)}>
              {(Object.keys(ART_INFO) as BuchungsArt[]).map((a) => (
                <option key={a} value={a}>
                  {ART_INFO[a].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Datum" htmlFor="bu-datum">
            <Input id="bu-datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
          </Field>
        </div>
        {art === "vorschuss" && (
          <div>
            <div className="label">Vorschuss</div>
            <Segmented
              full
              value={vorschussStand}
              onChange={setVorschussStand}
              options={[
                { value: "eingegangen", label: "Eingegangen" },
                { value: "angefordert", label: "Angefordert (§ 9 RVG)" },
              ]}
            />
          </div>
        )}
        <Field label="Buchungstext" htmlFor="bu-text">
          <Input id="bu-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="z. B. Aktenversendungspauschale" />
        </Field>
        <Field label="Betrag" htmlFor="bu-betrag" hint={Number.isNaN(wert) ? <span className="text-seal">Bitte einen Betrag wie 12,00 eingeben.</span> : vorzeichen < 0 ? "Wird als Eingang (−) gebucht." : art === "vorschuss" ? "Wird als offene Vorschussforderung (+) gebucht – noch kein Guthaben." : "Wird als Forderung (+) gebucht."}>
          <div className="relative">
            <Input id="bu-betrag" inputMode="decimal" value={betrag} onChange={(e) => setBetrag(e.target.value)} placeholder="0,00" className="num !pr-9" />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-fg-4">€</span>
          </div>
        </Field>
        {art !== "fremdgeld" && (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">Fremdgeld</div>
              <div className="text-[12px] text-fg-3">Gehört dem Mandanten (§ 43a Abs. 7 BRAO) – wird getrennt geführt.</div>
            </div>
            <Switch id="bu-fremd" checked={fremd} onChange={setFremd} label="Fremdgeld" />
          </div>
        )}
      </div>
    </Modal>
  );
}
