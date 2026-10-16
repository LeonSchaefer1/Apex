// Reiter „Forderungskonto“: Zinsen nach § 288 BGB taggenau, Teilzahlungen nach § 367 BGB verrechnet.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Banknote, CalendarDays, Copy, FileSignature, FolderInput, Percent, PiggyBank, Plus, Scale, Wallet } from "lucide-react";
import { AnimatedNumber, Button, Card, CardHeader, Chip, Drawer, Empty, Field, Input, Modal, Segmented, Select, Stat, Switch } from "@/components/ui";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { addDays, diffDays, fmtDate, fmtDateLong, fmtDateShort, fmtEUR, fmtNum, monatName, nowLocal, round2, today, uid } from "@/core/dates";
import { BASISZINS, basiszinsAm, forderungskonto, type ForderungsStand, type ForderungsVorgang } from "@/core/zinsen";
import { berechneRvg, fassungFuerAuftrag } from "@/core/rvg";
import type { Akte, Buchung, Dokument, Kontakt, Tenant, User } from "@/core/types";
import { useIsMobile } from "@/lib/useMedia";
import { cn } from "@/lib/cn";
import { kopiereText } from "@/lib/zwischenablage";
import { fmtEURkompakt, fmtProzent, parseBetrag } from "./lib";
import { niceTicks } from "./UmsatzChart";
import { Anschrift, Briefkopf, TabKopf, useLookups, useMeasure } from "./ui";

const EUR = (n: number) => fmtEUR(n);

function vorgaengeFuer(akte: Akte, buchungen: Buchung[], opts: { pauschale40: boolean; verbraucher: boolean }): ForderungsVorgang[] {
  const f = akte.forderung!;
  const v: ForderungsVorgang[] = [{ datum: f.faelligAb, art: "hauptforderung", betrag: f.hauptforderung, text: "Hauptforderung" }];
  for (const b of buchungen) {
    if (b.akteId !== akte.id) continue;
    if (b.art === "kosten") v.push({ datum: b.datum, art: "kosten", betrag: Math.abs(b.betrag), text: b.text });
    else if (b.art === "zahlung" && b.fremdgeld) v.push({ datum: b.datum, art: "zahlung", betrag: Math.abs(b.betrag), text: b.text });
  }
  if (!opts.verbraucher && opts.pauschale40) v.push({ datum: f.faelligAb, art: "kosten", betrag: 40, text: "Verzugspauschale (§ 288 Abs. 5 BGB)" });
  return v;
}

const FARBE = { haupt: "var(--ink)", zinsen: "var(--amber)", kosten: "var(--violet)" };

/** Überzahlung: Zahlungen, die nach Tilgung von Kosten, Zinsen und Hauptforderung übrig bleiben (an den Schuldner zu erstatten). */
function ueberzahlungVon(stand: ForderungsStand): number {
  const getilgt = stand.verlauf.reduce((s, v) => s + (v.aufKosten ?? 0) + (v.aufZinsen ?? 0) + (v.aufHaupt ?? 0), 0);
  return Math.max(0, round2(stand.bezahlt - getilgt));
}

const MAHN_ANWALTSKOSTEN = /3305|3308|anwalt|verfahrensgebühr/i;

/**
 * Rechtsanwaltskosten des Mahnverfahrens (Nr. 3305, 3308 nach Antrag auf Vollstreckungsbescheid, 7002 VV RVG), die im
 * Vollstreckungsbescheid als Kosten des Verfahrens tituliert sind. Umsatzsteuer nur, wenn der Gläubiger nicht zum
 * Vorsteuerabzug berechtigt ist (§ 104 Abs. 2 S. 3 ZPO) – angenommen für Privatpersonen. `null`, wenn schon erfasst
 * oder kein Vollstreckungsbescheid vorliegt.
 */
function fehlendeMahnkosten(akte: Akte, buchungen: Buchung[], dokumente: Dokument[], glaeubiger?: Kontakt): { betrag: number; datum: string; text: string; ust: boolean } | null {
  const f = akte.forderung;
  if (!f) return null;
  const vbDok = dokumente.find((d) => d.akteId === akte.id && /vollstreckungsbescheid/i.test(d.name));
  if (!/vollstreckungsbescheid/i.test(f.titel ?? "") && !vbDok) return null;
  if (buchungen.some((b) => b.akteId === akte.id && b.art === "kosten" && MAHN_ANWALTSKOSTEN.test(b.text))) return null;
  const erg = berechneRvg({ positionen: [{ nr: "3305" }, { nr: "3308" }], gegenstandswert: f.hauptforderung, fassung: fassungFuerAuftrag(akte.createdAt.slice(0, 10)) });
  const ust = glaeubiger?.typ === "person";
  return {
    betrag: ust ? erg.brutto : erg.netto,
    datum: vbDok ? vbDok.createdAt.slice(0, 10) : today(),
    text: `Rechtsanwaltskosten Mahnverfahren (Nr. 3305, 3308, 7002 VV RVG${ust ? " zzgl. USt." : ""})`,
    ust,
  };
}

function Balken({ teile, hoehe = 14 }: { teile: { key: string; label: string; wert: number; farbe: string }[]; hoehe?: number }) {
  const summe = teile.reduce((s, t) => s + Math.max(0, t.wert), 0);
  return (
    <div>
      <div
        className="flex w-full gap-[2px] overflow-hidden rounded-full bg-[var(--line)]"
        style={{ height: hoehe }}
        role="img"
        aria-label={teile.map((t) => `${t.label} ${fmtEUR(t.wert)}`).join(", ")}
      >
        {summe > 0 &&
          teile.map((t, i) =>
            t.wert > 0 ? (
              <motion.div
                key={t.key}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ background: t.farbe }}
                initial={{ width: 0 }}
                animate={{ width: `${(t.wert / summe) * 100}%` }}
                transition={{ type: "spring", stiffness: 160, damping: 26, delay: 0.1 + i * 0.08 }}
              />
            ) : null,
          )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {teile.map((t) => (
          <div key={t.key} className="flex items-center gap-2 whitespace-nowrap text-[12.5px]">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: t.farbe }} />
            <span className="text-fg-3">{t.label}</span>
            <span className="num font-semibold">{fmtEUR(t.wert)}</span>
            {summe > 0 && <span className="num text-[11.5px] text-fg-4">{(t.wert / summe) * 100 < 1 && t.wert > 0 ? "< 1 %" : `${Math.round((t.wert / summe) * 100)} %`}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Verlauf der Gesamtforderung: Zinsen lassen sie steigen, Zahlungen senken sie – maßstabsgetreu über die Zeit. */
function SaldoChart({ stand, start, ende }: { stand: ForderungsStand; start: string; ende: string }) {
  const [ref, w] = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const h = 176;
  const m = { l: w < 420 ? 50 : 60, r: 14, t: 22, b: 24 };
  const pts: { d: string; v: number; art?: string; betrag?: number; text?: string }[] = [];
  for (const v of stand.verlauf) {
    if (v.art === "zinsen") {
      pts.push({ d: v.datum, v: v.saldoGesamt, art: "ende" });
      continue;
    }
    if (v.art !== "hauptforderung") pts.push({ d: v.datum, v: round2(v.saldoGesamt - v.betrag) });
    pts.push({ d: v.datum, v: v.saldoGesamt, art: v.art, betrag: v.betrag, text: v.text });
  }
  const tage = Math.max(1, diffDays(start, ende));
  const ticks = niceTicks(Math.max(...pts.map((p) => p.v), 0));
  const oben = ticks[ticks.length - 1] || 1;
  const iw = Math.max(0, w - m.l - m.r);
  const ih = h - m.t - m.b;
  const x = (d: string) => m.l + (Math.min(tage, Math.max(0, diffDays(start, d))) / tage) * iw;
  const y = (v: number) => m.t + ih * (1 - v / oben);
  const linie = pts.map((p, i) => `${i ? "L" : "M"}${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const flaeche = pts.length ? `${linie} L${x(pts[pts.length - 1].d).toFixed(1)},${y(0)} L${x(pts[0].d).toFixed(1)},${y(0)} Z` : "";
  const monate: string[] = [];
  for (let d = `${start.slice(0, 7)}-01`; d <= ende; ) {
    const [yy, mm] = d.split("-").map(Number);
    const n = new Date(Date.UTC(yy, mm, 1)).toISOString().slice(0, 10);
    if (n > start && n <= ende) monate.push(n);
    d = n;
  }
  const marker = pts.map((p, i) => ({ ...p, i })).filter((p) => p.art === "zahlung" || p.art === "kosten" || p.art === "ende");
  const aktiv = hover !== null ? marker.find((p) => p.i === hover) : undefined;
  return (
    <div ref={ref} className="relative w-full select-none" style={{ height: h }}>
      {w > 0 && pts.length > 0 && (
        <svg width={w} height={h} role="img" aria-label={`Verlauf der Gesamtforderung von ${fmtDate(start)} bis ${fmtDate(ende)}: zuletzt ${fmtEUR(pts[pts.length - 1].v)}`}>
          <defs>
            <linearGradient id="fk-saldo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--ink)" stopOpacity="0.22" />
              <stop offset="1" stopColor="var(--ink)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--line-strong)" : "var(--line)"} strokeDasharray={t === 0 ? undefined : "2 4"} />
              <text x={m.l - 10} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--fg-3)" className="num">
                {fmtEURkompakt(t)}
              </text>
            </g>
          ))}
          {monate.map((d) => (
            <text key={d} x={x(d)} y={h - 6} textAnchor="middle" fontSize={11} fill="var(--fg-3)">
              {monatName(Number(d.slice(5, 7)) - 1, true)}
            </text>
          ))}
          <motion.path d={flaeche} fill="url(#fk-saldo)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.6 }} />
          <motion.path
            d={linie}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          />
          {marker.map((p) => {
            const ende = p.art === "ende";
            const farbe = p.art === "zahlung" ? "var(--green)" : p.art === "kosten" ? "var(--violet)" : "var(--ink)";
            return (
              <g key={p.i} onPointerEnter={() => setHover(p.i)} onPointerLeave={() => setHover(null)}>
                <circle cx={x(p.d)} cy={y(p.v)} r={12} fill="transparent" />
                <motion.circle
                  cx={x(p.d)}
                  cy={y(p.v)}
                  r={ende ? 4.5 : 3.5}
                  fill={farbe}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  initial={{ scale: 0 }}
                  animate={{ scale: hover === p.i ? 1.4 : 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22, delay: hover === null ? 0.9 : 0 }}
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                />
                {ende && (
                  <text
                    x={x(p.d) - 8}
                    y={y(p.v) - 10}
                    textAnchor="end"
                    fontSize={11.5}
                    fontWeight={650}
                    fill="var(--fg)"
                    stroke="var(--surface)"
                    strokeWidth={4}
                    paintOrder="stroke"
                    strokeLinejoin="round"
                    className="num"
                  >
                    {fmtEUR(p.v)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      <AnimatePresence>
        {aktiv && (
          <motion.div
            key={aktiv.i}
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
            className="glass-strong pointer-events-none absolute z-10 min-w-[160px] rounded-[14px] px-3 py-2 text-[12px]"
            style={{ left: Math.min(Math.max(x(aktiv.d), 90), w - 90), top: Math.max(4, y(aktiv.v) - 14), translateX: "-50%", translateY: "-100%" }}
          >
            <div className="font-semibold">{aktiv.art === "ende" ? "Stand am Stichtag" : aktiv.text}</div>
            <div className="text-fg-3">
              {fmtDateShort(aktiv.d)}
              {aktiv.betrag !== undefined && aktiv.art !== "ende" && <span className="num"> · {fmtEUR(aktiv.betrag)}</span>}
            </div>
            <div className="num mt-0.5 font-semibold">Saldo {fmtEUR(aktiv.v)}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ForderungskontoTab() {
  const akten = useCol("akten");
  const buchungen = useCol("buchungen");
  const dokumente = useCol("dokumente");
  const { kontakte, users } = useLookups();
  const { tenant, user } = useKanzlei();
  const mobil = useIsMobile();

  const fAkten = useMemo(() => {
    const zaehl = (a: Akte) => buchungen.filter((b) => b.akteId === a.id && (b.art === "kosten" || (b.art === "zahlung" && b.fremdgeld))).length;
    return akten.filter((a) => a.forderung).sort((a, b) => zaehl(b) - zaehl(a) || a.aktenzeichen.localeCompare(b.aktenzeichen, "de", { numeric: true }));
  }, [akten, buchungen]);
  const [akteId, setAkteId] = useState("");
  const akte = fAkten.find((a) => a.id === akteId) ?? fAkten[0];
  const f = akte?.forderung;
  const [stichtag, setStichtag] = useState(today());
  const [verbraucherWahl, setVerbraucherWahl] = useState<boolean | null>(null);
  const [pauschale40, setPauschale40] = useState(true);
  const [zahlungOffen, setZahlungOffen] = useState(false);
  const [aufstellung, setAufstellung] = useState(false);

  useEffect(() => setVerbraucherWahl(null), [akte?.id]);
  const verbraucher = verbraucherWahl ?? f?.verbraucher ?? true;
  const stich = stichtag || today();

  const rechne = (vb: boolean, extra: ForderungsVorgang[] = [], bis = stich): ForderungsStand | null => {
    if (!akte || !f) return null;
    const vs = [...vorgaengeFuer(akte, buchungen, { pauschale40, verbraucher: vb }), ...extra].filter((v) => v.datum <= bis);
    return forderungskonto({ vorgaenge: vs, verzugAb: f.faelligAb, stichtag: bis < f.faelligAb ? f.faelligAb : bis, verbraucher: vb });
  };
  const stand = useMemo(() => rechne(verbraucher), [akte, buchungen, stich, verbraucher, pauschale40]); // eslint-disable-line react-hooks/exhaustive-deps
  const gegen = useMemo(() => rechne(!verbraucher), [akte, buchungen, stich, verbraucher, pauschale40]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!akte || !f || !stand) {
    return (
      <>
        <TabKopf icon={<Scale className="size-[18px]" />} titel="Forderungskonto" text="Zinsen nach § 288 BGB taggenau, Teilzahlungen nach § 367 BGB verrechnet." />
        <Card>
          <Empty
            icon={<Scale className="size-6" />}
            title="Keine Forderungssachen"
            text="Sobald eine Akte im Sachgebiet Forderungseinzug mit Hauptforderung und Verzugsbeginn angelegt ist, führt AnwaltApex hier das Forderungskonto."
          />
        </Card>
      </>
    );
  }

  const aufschlag = verbraucher ? 5 : 9;
  const basis = basiszinsAm(stich);
  const satz = round2(basis + aufschlag);
  const schuldner = f.schuldnerId ? kontakte.get(f.schuldnerId) : akte.gegnerId ? kontakte.get(akte.gegnerId) : undefined;
  const mandant = kontakte.get(akte.mandantId);
  const zinsGesamt = round2(stand.zinsAbschnitte.reduce((s, z) => s + z.zinsen, 0));
  const zinsGesamtGegen = gegen ? round2(gegen.zinsAbschnitte.reduce((s, z) => s + z.zinsen, 0)) : zinsGesamt;
  const zinsDelta = round2(zinsGesamtGegen - zinsGesamt);
  const getilgt = stand.verlauf.reduce((s, v) => ({ kosten: s.kosten + (v.aufKosten ?? 0), zinsen: s.zinsen + (v.aufZinsen ?? 0), haupt: s.haupt + (v.aufHaupt ?? 0) }), {
    kosten: 0,
    zinsen: 0,
    haupt: 0,
  });
  const aktuellePeriode = [...BASISZINS].reverse().find((b) => b.ab <= stich)?.ab;
  const ueberzahlung = ueberzahlungVon(stand);
  const mahnkosten = fehlendeMahnkosten(akte, buchungen, dokumente, mandant);
  const mahnkostenUebernehmen = () => {
    if (!mahnkosten) return;
    useData.getState().upsert("buchungen", { id: uid("b"), akteId: akte.id, datum: mahnkosten.datum, art: "kosten", betrag: mahnkosten.betrag, text: mahnkosten.text });
    useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `${mahnkosten.text} ${fmtEUR(mahnkosten.betrag)} ins Forderungskonto übernommen – ${akte.aktenzeichen}` });
    toast("Kosten des Mahnverfahrens übernommen", { text: `${fmtEUR(mahnkosten.betrag)} · Verrechnung nach § 367 BGB neu berechnet`, ton: "erfolg" });
  };

  return (
    <>
      <TabKopf
        icon={<Scale className="size-[18px]" />}
        titel="Forderungskonto"
        text="Zinsen nach § 288 BGB taggenau, Teilzahlungen nach § 367 BGB verrechnet – erst Kosten, dann Zinsen, dann Hauptforderung."
        aktionen={
          <>
            <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => setZahlungOffen(true)}>
              Teilzahlung erfassen
            </Button>
            <Button variant="primary" icon={<FileSignature className="size-4" />} onClick={() => setAufstellung(true)}>
              Forderungsaufstellung erstellen
            </Button>
          </>
        }
      />

      <Card className="mb-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)] md:items-end">
          <Field label="Forderungssache" htmlFor="fk-akte">
            <Select id="fk-akte" value={akte.id} onChange={(e) => setAkteId(e.target.value)}>
              {fAkten.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.aktenzeichen} · {a.titel}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Stichtag" htmlFor="fk-stichtag">
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-4" />
              <Input id="fk-stichtag" type="date" value={stichtag} min={f.faelligAb} onChange={(e) => setStichtag(e.target.value)} className="!pl-10" />
            </div>
          </Field>
          <Field label="Verbraucher beteiligt? (§ 288 BGB)">
            <Segmented
              full
              options={[
                { value: "v", label: "Ja · 5 PP" },
                { value: "u", label: "Nein · 9 PP" },
              ]}
              value={verbraucher ? "v" : "u"}
              onChange={(v) => setVerbraucherWahl(v === "v")}
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-fg-3">
          <span>
            Schuldner <span className="font-medium text-fg-2">{schuldner?.name ?? "–"}</span>
          </span>
          <span>
            Verzug seit <span className="num font-medium text-fg-2">{fmtDate(f.faelligAb)}</span> ({fmtNum(Math.max(0, diffDays(f.faelligAb, stich) + 1))} Zinstage)
          </span>
          {f.titel && <span className="truncate">Titel: {f.titel}</span>}
          {verbraucherWahl !== null && verbraucherWahl !== f.verbraucher && <Chip tone="amber">Vergleichsrechnung – laut Akte {f.verbraucher ? "mit" : "ohne"} Verbraucherbeteiligung</Chip>}
        </div>
        <p className="mt-2 text-[11.5px] leading-snug text-fg-4">
          9 Prozentpunkte nur für Entgeltforderungen aus Rechtsgeschäften, an denen kein Verbraucher beteiligt ist – weder als Gläubiger noch als Schuldner (§ 288 Abs. 2 BGB); sonst 5
          Prozentpunkte (§ 288 Abs. 1 BGB).
        </p>
        {mahnkosten && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[14px] bg-violet-soft px-3.5 py-2.5 text-[12.5px]">
            <span className="min-w-0 flex-1 basis-[260px] text-fg-2">
              <span className="font-semibold text-fg">Kosten des Mahnverfahrens fehlen:</span> Die Rechtsanwaltskosten (Nr. 3305, 3308, 7002 VV RVG
              {mahnkosten.ust ? " zzgl. USt." : ", ohne USt. – Gläubiger vorsteuerabzugsberechtigt"}) sind im Vollstreckungsbescheid tituliert –{" "}
              <span className="num font-semibold text-fg">{fmtEUR(mahnkosten.betrag)}</span>.
            </span>
            <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={mahnkostenUebernehmen}>
              Als Kosten übernehmen
            </Button>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1">
        <Stat
          label="Hauptforderung"
          icon={<Wallet className="size-4" />}
          tone="ink"
          value={<AnimatedNumber value={stand.hauptforderung} format={EUR} className="text-[19px] sm:text-[24px]" />}
          sub={`ursprünglich ${fmtEUR(f.hauptforderung)}`}
        />
        <Stat
          label="Zinsen"
          icon={<Percent className="size-4" />}
          tone="amber"
          value={<AnimatedNumber value={stand.zinsen} format={EUR} className="text-[19px] sm:text-[24px]" />}
          sub={`${fmtProzent(satz)} p. a. am Stichtag`}
        />
        <Stat label="Kosten" icon={<Banknote className="size-4" />} tone="violet" value={<AnimatedNumber value={stand.kosten} format={EUR} className="text-[19px] sm:text-[24px]" />} sub="offen" />
        <Stat
          label="Gesamtforderung"
          icon={<Scale className="size-4" />}
          tone="seal"
          value={<AnimatedNumber value={stand.gesamt} format={EUR} className="text-[19px] sm:text-[24px]" />}
          sub={`Stand ${fmtDate(stich)}`}
        />
        <Stat
          label="Bereits gezahlt"
          icon={<PiggyBank className="size-4" />}
          tone="green"
          value={<AnimatedNumber value={stand.bezahlt} format={EUR} className="text-[19px] sm:text-[24px]" />}
          sub={ueberzahlung > 0 ? `davon ${fmtEUR(ueberzahlung)} Überzahlung` : `${stand.verlauf.filter((v) => v.art === "zahlung").length} Zahlungen`}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="flex flex-col xl:col-span-2">
          <CardHeader title="Zusammensetzung der Gesamtforderung" subtitle="Maßstabsgetreu: Anteil von Hauptforderung, Zinsen und Kosten am offenen Betrag." />
          <Balken
            teile={[
              { key: "h", label: "Hauptforderung", wert: stand.hauptforderung, farbe: FARBE.haupt },
              { key: "z", label: "Zinsen", wert: stand.zinsen, farbe: FARBE.zinsen },
              { key: "k", label: "Kosten", wert: stand.kosten, farbe: FARBE.kosten },
            ]}
          />
          <div className="mt-6 border-t border-[var(--line)] pt-4">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-[13px] font-semibold">Verrechnung der Zahlungen (§ 367 Abs. 1 BGB)</div>
              <div className="text-[12px] text-fg-3">
                gezahlt <span className="num font-semibold text-fg-2">{fmtEUR(stand.bezahlt)}</span>
              </div>
            </div>
            {stand.bezahlt > 0 ? (
              <Balken
                hoehe={8}
                teile={[
                  { key: "k", label: "auf Kosten", wert: round2(getilgt.kosten), farbe: FARBE.kosten },
                  { key: "z", label: "auf Zinsen", wert: round2(getilgt.zinsen), farbe: FARBE.zinsen },
                  { key: "h", label: "auf Hauptforderung", wert: round2(getilgt.haupt), farbe: FARBE.haupt },
                ]}
              />
            ) : (
              <p className="text-[12.5px] text-fg-3">Noch keine Zahlungen eingegangen.</p>
            )}
            {ueberzahlung > 0 && (
              <p className="mt-3 rounded-[12px] bg-amber-soft px-3 py-2 text-[12.5px] text-fg-2" role="status">
                <span className="font-semibold text-amber">Überzahlung {fmtEUR(ueberzahlung)}:</span> Die Zahlungen übersteigen die Forderung. Der Mehrbetrag ist an den Schuldner
                zu erstatten; die Forderung ist ausgeglichen.
              </p>
            )}
          </div>
          <div className="mt-6 border-t border-[var(--line)] pt-4">
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-[13px] font-semibold">Verlauf der Gesamtforderung</div>
              <div className="flex items-center gap-3 text-[11.5px] text-fg-3">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-green" /> Zahlung
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-violet" /> Kosten
                </span>
              </div>
            </div>
            <SaldoChart stand={stand} start={f.faelligAb} ende={stich} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { k: "Verzugstage", v: fmtNum(Math.max(0, diffDays(f.faelligAb, stich) + 1)), s: `seit ${fmtDate(f.faelligAb)}` },
              { k: "Zinsen aufgelaufen", v: fmtEUR(zinsGesamt), s: `davon getilgt ${fmtEUR(round2(getilgt.zinsen))}` },
              { k: "Tageszins aktuell", v: fmtEUR(round2((stand.hauptforderung * satz) / 36500)), s: `aus ${fmtEUR(stand.hauptforderung)}` },
              { k: "Getilgt gesamt", v: `${f.hauptforderung > 0 ? Math.round((getilgt.haupt / f.hauptforderung) * 100) : 0} %`, s: "der Hauptforderung" },
            ].map((x) => (
              <div key={x.k} className="rounded-[16px] bg-[var(--ink-softer)] px-3.5 py-3">
                <div className="text-[11.5px] text-fg-3">{x.k}</div>
                <div className="num mt-0.5 text-[16px] font-semibold tracking-[-0.01em]">{x.v}</div>
                <div className="truncate text-[11px] text-fg-4">{x.s}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            icon={<Percent className="size-4" />}
            title="Zinssatz"
            subtitle={
              verbraucher
                ? "§ 288 Abs. 1 BGB: 5 Prozentpunkte über dem Basiszinssatz."
                : "§ 288 Abs. 2 BGB: 9 Prozentpunkte über dem Basiszinssatz – Entgeltforderung, kein Verbraucher beteiligt."
            }
          />
          <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
            <span className="rounded-[10px] bg-ink-softer px-2.5 py-1.5">
              <span className="block text-[10.5px] text-fg-3">Basiszinssatz</span>
              <span className="num font-semibold">{fmtProzent(basis)}</span>
            </span>
            <span className="text-fg-4">+</span>
            <span className="rounded-[10px] bg-ink-softer px-2.5 py-1.5">
              <span className="block text-[10.5px] text-fg-3">Aufschlag</span>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={aufschlag} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="num block font-semibold">
                  {aufschlag} PP
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="text-fg-4">=</span>
            <span className="rounded-[10px] bg-ink px-2.5 py-1.5 text-white">
              <span className="block text-[10.5px] opacity-75">Zinssatz p. a.</span>
              <span className="num font-semibold">{fmtProzent(satz)}</span>
            </span>
          </div>
          <div className={cn("mt-3 rounded-[12px] px-3 py-2 text-[12px]", zinsDelta > 0 ? "bg-amber-soft text-amber" : "bg-ink-softer text-fg-2")}>
            Zinsen bis zum Stichtag insgesamt <span className="num font-semibold">{fmtEUR(zinsGesamt)}</span> – {verbraucher ? "ohne" : "mit"} Verbraucherbeteiligung{" "}
            <span className="num font-semibold">{fmtEUR(zinsGesamtGegen)}</span> ({zinsDelta >= 0 ? "+" : "−"}
            {fmtEUR(Math.abs(zinsDelta))}).
          </div>
          {!verbraucher && (
            <div className="mt-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <label htmlFor="fk-40" className="text-[13px] font-medium">
                  40-€-Verzugspauschale
                </label>
                <p className="text-[11.5px] leading-snug text-fg-3">§ 288 Abs. 5 BGB – wird auf Rechtsverfolgungskosten angerechnet; nicht im Arbeitsrecht (BAG 8 AZR 26/18).</p>
              </div>
              <Switch id="fk-40" checked={pauschale40} onChange={setPauschale40} label="40-€-Verzugspauschale" />
            </div>
          )}
          <div className="mt-4">
            <div className="eyebrow mb-1.5">Basiszinssatz (§ 247 BGB)</div>
            <ul className="grid grid-cols-1 gap-0.5">
              {[...BASISZINS]
                .reverse()
                .slice(0, 6)
                .map((b) => {
                  const ist = b.ab === aktuellePeriode;
                  return (
                    <li key={b.ab} className={cn("flex items-center justify-between rounded-[10px] px-2.5 py-1.5 text-[12.5px]", ist ? "bg-ink-soft font-semibold text-ink" : "text-fg-2")}>
                      <span className="num">ab {fmtDate(b.ab)}</span>
                      <span className="flex items-center gap-2">
                        {ist && <span className="text-[10.5px] font-medium">am Stichtag</span>}
                        <span className="num">{fmtProzent(b.satz)}</span>
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
        </Card>
      </div>

      <Card className="mt-4" padded={false}>
        <div className="px-5 pt-5">
          <CardHeader title="Verlauf" subtitle="Jede Zahlung wird nach § 367 Abs. 1 BGB zuerst auf die Kosten, dann auf die Zinsen und zuletzt auf die Hauptforderung angerechnet." className="!mb-3" />
        </div>
        {mobil ? (
          <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
            {stand.verlauf.map((v, i) => (
              <li key={i} className="px-5 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[13.5px] font-medium">{v.text}</span>
                  <span className={cn("num shrink-0 text-[13.5px] font-semibold", v.art === "zahlung" && "text-green")}>{fmtEUR(v.betrag)}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-fg-3">
                  <span className="num">{fmtDate(v.datum)}</span>
                  {v.art === "zahlung" && (
                    <span className="num">
                      K {fmtEUR(v.aufKosten ?? 0)} · Z {fmtEUR(v.aufZinsen ?? 0)} · H {fmtEUR(v.aufHaupt ?? 0)}
                    </span>
                  )}
                  <span className="num ml-auto">Saldo {fmtEUR(v.saldoGesamt)}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="!pl-5">Datum</th>
                  <th>Vorgang</th>
                  <th className="!text-right">Betrag</th>
                  <th className="!text-right">auf Kosten</th>
                  <th className="!text-right">auf Zinsen</th>
                  <th className="!text-right">auf Hauptforderung</th>
                  <th className="!pr-5 !text-right">Saldo gesamt</th>
                </tr>
              </thead>
              <tbody>
                {stand.verlauf.map((v, i) => (
                  <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
                    <td className="num !pl-5 text-fg-2">{fmtDate(v.datum)}</td>
                    <td>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: v.art === "zahlung" ? "var(--green)" : v.art === "kosten" ? FARBE.kosten : v.art === "zinsen" ? FARBE.zinsen : FARBE.haupt }}
                        />
                        {v.text}
                      </span>
                    </td>
                    <td className={cn("num text-right font-medium", v.art === "zahlung" && "text-green")}>{fmtEUR(v.betrag)}</td>
                    <td className="num text-right text-fg-3">{v.aufKosten !== undefined ? fmtEUR(v.aufKosten) : ""}</td>
                    <td className="num text-right text-fg-3">{v.aufZinsen !== undefined ? fmtEUR(v.aufZinsen) : ""}</td>
                    <td className="num text-right text-fg-3">{v.aufHaupt !== undefined ? fmtEUR(v.aufHaupt) : ""}</td>
                    <td className="num !pr-5 text-right font-semibold">{fmtEUR(v.saldoGesamt)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-4" padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Zinsabschnitte"
            subtitle={`Taggenau (act/365) – neuer Abschnitt bei jeder Änderung des Basiszinssatzes oder des Kapitals. Summe ${fmtEUR(zinsGesamt)}.`}
            className="!mb-3"
          />
        </div>
        {stand.zinsAbschnitte.length === 0 ? (
          <p className="px-5 pb-5 text-[13px] text-fg-3">Bis zum Stichtag sind noch keine Zinsen angefallen.</p>
        ) : mobil ? (
          <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
            {stand.zinsAbschnitte.map((z, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 px-5 py-2.5 text-[12.5px]">
                <span className="num text-fg-2">
                  {fmtDate(z.von)} – {fmtDate(z.bis)} · {z.tage} T. · {fmtProzent(z.zinssatz)}
                </span>
                <span className="num font-semibold">{fmtEUR(z.zinsen)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="!pl-5">Von</th>
                  <th>Bis</th>
                  <th className="!text-right">Tage</th>
                  <th className="!text-right">Kapital</th>
                  <th className="!text-right">Zinssatz</th>
                  <th className="!pr-5 !text-right">Zinsen</th>
                </tr>
              </thead>
              <tbody>
                {stand.zinsAbschnitte.map((z, i) => (
                  <tr key={i}>
                    <td className="num !pl-5">{fmtDate(z.von)}</td>
                    <td className="num">{fmtDate(z.bis)}</td>
                    <td className="num text-right">{z.tage}</td>
                    <td className="num text-right">{fmtEUR(z.kapital)}</td>
                    <td className="num text-right">{fmtProzent(z.zinssatz)}</td>
                    <td className="num !pr-5 text-right font-semibold">{fmtEUR(z.zinsen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <TeilzahlungModal
        open={zahlungOffen}
        onClose={() => setZahlungOffen(false)}
        akte={akte}
        schuldner={schuldner}
        rechne={(extra, bis) => rechne(verbraucher, extra, bis)}
        stichtag={stich}
        userId={user.id}
      />
      <Forderungsaufstellung
        open={aufstellung}
        onClose={() => setAufstellung(false)}
        akte={akte}
        stand={stand}
        stichtag={stich}
        verbraucher={verbraucher}
        tenant={tenant}
        mandant={mandant}
        schuldner={schuldner}
        bearbeiter={users.get(akte.bearbeiterId)}
        userId={user.id}
        mahnkosten={mahnkosten?.betrag}
        onMahnkosten={mahnkostenUebernehmen}
      />
    </>
  );
}

function TeilzahlungModal({
  open,
  onClose,
  akte,
  schuldner,
  rechne,
  stichtag,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  akte: Akte;
  schuldner?: Kontakt;
  rechne: (extra: ForderungsVorgang[], bis: string) => ForderungsStand | null;
  stichtag: string;
  userId: string;
}) {
  const [betrag, setBetrag] = useState("250,00");
  const [datum, setDatum] = useState(today());
  const [text, setText] = useState("");
  useEffect(() => {
    if (!open) return;
    setBetrag("250,00");
    setDatum(today());
    setText(`Teilzahlung Schuldner ${schuldner?.nachname ?? schuldner?.name ?? ""}`.trim());
  }, [open, schuldner]);
  const b = parseBetrag(betrag);
  const bis = datum > stichtag ? datum : stichtag;
  const vorschau = b > 0 ? rechne([{ datum, art: "zahlung", betrag: b, text: "Vorschau" }], bis) : null;
  const zeile = vorschau?.verlauf.find((v) => v.text === "Vorschau");
  const verrechenbar = zeile ? round2((zeile.aufKosten ?? 0) + (zeile.aufZinsen ?? 0) + (zeile.aufHaupt ?? 0)) : 0;
  const mehr = zeile ? round2(b - verrechenbar) : 0;

  const buchen = () => {
    if (b <= 0) {
      toast("Bitte einen Betrag eingeben", { ton: "warnung" });
      return;
    }
    useData.getState().upsert("buchungen", { id: uid("b"), akteId: akte.id, datum, art: "zahlung", betrag: -round2(b), text: text || "Teilzahlung Schuldner", fremdgeld: true });
    useData.getState().log({ akteur: "nutzer", userId, akteId: akte.id, text: `Teilzahlung ${fmtEUR(b)} im Forderungskonto erfasst – ${akte.aktenzeichen}` });
    toast(mehr > 0.004 ? "Zahlung erfasst – Überzahlung" : "Teilzahlung erfasst", {
      text: zeile
        ? `Verrechnet: ${fmtEUR(zeile.aufKosten ?? 0)} Kosten · ${fmtEUR(zeile.aufZinsen ?? 0)} Zinsen · ${fmtEUR(zeile.aufHaupt ?? 0)} Hauptforderung${mehr > 0.004 ? ` · ${fmtEUR(mehr)} an den Schuldner zu erstatten` : ""}`
        : `${fmtEUR(b)} gebucht`,
      ton: mehr > 0.004 ? "warnung" : "erfolg",
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      icon={<Banknote className="size-[18px]" />}
      title="Teilzahlung erfassen"
      subtitle={`${akte.aktenzeichen} · ${akte.titel}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" onClick={buchen} disabled={b <= 0}>
            {mehr > 0.004 ? "Mit Überzahlung buchen" : "Teilzahlung buchen"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Betrag (€)" htmlFor="tz-betrag">
            <Input id="tz-betrag" inputMode="decimal" value={betrag} onChange={(e) => setBetrag(e.target.value)} className="num" />
          </Field>
          <Field label="Eingang am" htmlFor="tz-datum">
            <Input id="tz-datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
          </Field>
        </div>
        <Field label="Buchungstext" htmlFor="tz-text">
          <Input id="tz-text" value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <div className="rounded-[16px] bg-ink-softer p-3.5">
          <div className="text-[12px] font-semibold text-fg-2">Verrechnung nach § 367 Abs. 1 BGB</div>
          {zeile ? (
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              {[
                { k: "Kosten", v: zeile.aufKosten ?? 0, c: FARBE.kosten },
                { k: "Zinsen", v: zeile.aufZinsen ?? 0, c: FARBE.zinsen },
                { k: "Hauptforderung", v: zeile.aufHaupt ?? 0, c: FARBE.haupt },
              ].map((x) => (
                <div key={x.k} className="rounded-[12px] bg-[var(--surface)] px-2 py-2">
                  <div className="flex items-center justify-center gap-1.5 text-[10.5px] text-fg-3">
                    <span className="size-2 rounded-[2px]" style={{ background: x.c }} />
                    {x.k}
                  </div>
                  <div className="num mt-0.5 text-[13px] font-semibold">{fmtEUR(x.v)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-[12px] text-fg-3">Betrag eingeben, um die Verrechnung zu sehen.</p>
          )}
          {mehr > 0.004 && (
            <div className="mt-2.5 rounded-[12px] bg-amber-soft px-3 py-2 text-[12px] text-fg-2" role="alert">
              <span className="font-semibold text-amber">Überzahlung {fmtEUR(mehr)}:</span> Der Betrag übersteigt die Restforderung am {fmtDate(datum)} ({fmtEUR(verrechenbar)}). Der
              Mehrbetrag wäre an den Schuldner zu erstatten.
              <div className="mt-2">
                <Button size="sm" variant="secondary" onClick={() => setBetrag(fmtNum(verrechenbar, 2))}>
                  Auf Restforderung kürzen
                </Button>
              </div>
            </div>
          )}
          <p className="mt-2 text-[11.5px] text-fg-4">Zahlungen des Schuldners sind Fremdgeld und werden im Aktenkonto entsprechend gekennzeichnet.</p>
        </div>
      </div>
    </Modal>
  );
}

function Z({ k, v, stark, eingerueckt, minus }: { k: ReactNode; v: number; stark?: boolean; eingerueckt?: boolean; minus?: boolean }) {
  return (
    <tr className={cn("border-b border-black/[0.07] align-top", stark && "font-semibold")}>
      <td className={cn("py-1.5 pr-3", eingerueckt && "pl-3 opacity-80")}>{k}</td>
      <td className="num whitespace-nowrap py-1.5 text-right">
        {minus ? "−" : ""}
        {fmtEUR(Math.abs(v))}
      </td>
    </tr>
  );
}

function Forderungsaufstellung({
  open,
  onClose,
  akte,
  stand,
  stichtag,
  verbraucher,
  tenant,
  mandant,
  schuldner,
  bearbeiter,
  userId,
  mahnkosten,
  onMahnkosten,
}: {
  open: boolean;
  onClose: () => void;
  akte: Akte;
  stand: ForderungsStand;
  stichtag: string;
  verbraucher: boolean;
  tenant: Tenant;
  mandant?: Kontakt;
  schuldner?: Kontakt;
  bearbeiter?: User;
  userId: string;
  /** Noch nicht erfasste Rechtsanwaltskosten des Mahnverfahrens (Betrag), falls tituliert. */
  mahnkosten?: number;
  onMahnkosten?: () => void;
}) {
  const f = akte.forderung!;
  const kosten = stand.verlauf.filter((v) => v.art === "kosten");
  const zahlungen = stand.verlauf.filter((v) => v.art === "zahlung");
  const zinsSumme = round2(stand.zinsAbschnitte.reduce((s, z) => s + z.zinsen, 0));
  const kostenSumme = round2(kosten.reduce((s, k) => s + k.betrag, 0));
  const zwischen = round2(f.hauptforderung + zinsSumme + kostenSumme);
  const aufschlag = verbraucher ? 5 : 9;
  const ort = tenant.stadt;
  const ueberzahlung = ueberzahlungVon(stand);
  const weitereZinsen = stand.hauptforderung > 0;

  const textFassung = () =>
    [
      `Forderungsaufstellung – Stand ${fmtDate(stichtag)}`,
      `${akte.titel} (Az. ${akte.aktenzeichen}${akte.gerichtsAz ? `, ${akte.gerichtsAz}` : ""})`,
      f.titel ? `Titel: ${f.titel}` : "",
      `Hauptforderung: ${fmtEUR(f.hauptforderung)}`,
      ...stand.zinsAbschnitte.map((z) => `Zinsen ${fmtProzent(z.zinssatz)} aus ${fmtEUR(z.kapital)} vom ${fmtDate(z.von)} bis ${fmtDate(z.bis)} (${z.tage} Tage): ${fmtEUR(z.zinsen)}`),
      ...kosten.map((k) => `${k.text} (${fmtDate(k.datum)}): ${fmtEUR(k.betrag)}`),
      `Zwischensumme: ${fmtEUR(zwischen)}`,
      ...zahlungen.map((z) => `abzüglich ${z.text} vom ${fmtDate(z.datum)}: ${fmtEUR(Math.abs(z.betrag))}`),
      `Restforderung: ${fmtEUR(stand.gesamt)} (Hauptforderung ${fmtEUR(stand.hauptforderung)}, Zinsen ${fmtEUR(stand.zinsen)}, Kosten ${fmtEUR(stand.kosten)})`,
      ueberzahlung > 0 ? `Überzahlung: ${fmtEUR(ueberzahlung)} – an den Schuldner zu erstatten.` : "",
      weitereZinsen
        ? `Weitere Zinsen in Höhe von ${aufschlag} Prozentpunkten über dem jeweiligen Basiszinssatz aus ${fmtEUR(stand.hauptforderung)} seit ${fmtDate(addDays(stichtag, 1))}.`
        : "Die Forderung ist vollständig ausgeglichen.",
    ]
      .filter(Boolean)
      .join("\n");

  const kopieren = async () => {
    const r = await kopiereText(textFassung(), document.getElementById("forderungsaufstellung-text"));
    if (r === "kopiert") toast("In Zwischenablage kopiert", { text: "Forderungsaufstellung als Text", ton: "erfolg" });
    else if (r === "markiert") toast("Text markiert – jetzt Strg/⌘+C", { text: "Die Zwischenablage ist hier gesperrt. Die Aufstellung ist markiert und lässt sich direkt kopieren.", ton: "info" });
    else toast("Kopieren nicht möglich", { text: "Ihr Browser erlaubt hier keinen Zugriff auf die Zwischenablage.", ton: "warnung" });
  };

  const ablegen = () => {
    useData.getState().upsert("dokumente", {
      id: uid("d"),
      akteId: akte.id,
      name: `Forderungsaufstellung Stand ${fmtDate(stichtag)}`,
      art: "anlage",
      ordner: "Anlagen",
      format: "pdf",
      groesseKb: 44,
      seiten: 1,
      inhalt: textFassung(),
      quelle: "generiert",
      autorId: userId,
      version: 1,
      createdAt: nowLocal(),
    });
    useData.getState().log({ akteur: "nutzer", userId, akteId: akte.id, text: `Forderungsaufstellung (Stand ${fmtDate(stichtag)}) erstellt – ${akte.aktenzeichen}` });
    toast("In der E-Akte abgelegt", { text: `Ordner „Anlagen“ · ${akte.aktenzeichen}`, ton: "erfolg" });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={800}
      icon={<FileSignature className="size-[18px]" />}
      title="Forderungsaufstellung"
      subtitle={`Für den Vollstreckungsauftrag · Stand ${fmtDate(stichtag)}`}
      footer={
        <>
          <Button variant="ghost" className="mr-auto" icon={<Copy className="size-4" />} onClick={kopieren}>
            Text kopieren
          </Button>
          <Button variant="primary" icon={<FolderInput className="size-4" />} onClick={ablegen}>
            In E-Akte ablegen
          </Button>
        </>
      }
    >
      {mahnkosten !== undefined && onMahnkosten && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[16px] bg-violet-soft px-4 py-3 text-[12.5px] text-fg-2">
          <span className="min-w-0 flex-1 basis-[240px]">
            <span className="font-semibold text-fg">Rechtsanwaltskosten des Mahnverfahrens fehlen</span> ({fmtEUR(mahnkosten)}, Nr. 3305, 3308, 7002 VV RVG) – im Vollstreckungsbescheid tituliert.
          </span>
          <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={onMahnkosten}>
            Übernehmen
          </Button>
        </div>
      )}
      <div id="forderungsaufstellung-text" className="paper px-5 py-6 sm:px-10 sm:py-9">
        <Briefkopf tenant={tenant} absenderZeile={false} />
        <div className="mt-6 text-[19px] font-semibold tracking-[-0.02em]">Forderungsaufstellung</div>
        <div className="mt-0.5 text-[12px] opacity-65">zum Antrag auf Zwangsvollstreckung · Stand {fmtDateLong(stichtag)}</div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] opacity-55">Gläubiger</div>
            <Anschrift k={mandant} />
            <div className="mt-1 text-[11.5px] opacity-65">vertreten durch {tenant.name}</div>
          </div>
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] opacity-55">Schuldner</div>
            <Anschrift k={schuldner} />
          </div>
        </div>
        <div className="mt-4 grid gap-x-6 gap-y-0.5 text-[11.5px] sm:grid-cols-2">
          <div>
            <span className="opacity-55">Vollstreckungstitel: </span>
            <span className="font-medium">{f.titel ?? "– (noch nicht tituliert)"}</span>
          </div>
          <div>
            <span className="opacity-55">Unser Zeichen: </span>
            <span className="mono font-medium">{akte.aktenzeichen}</span>
            {akte.gerichtsAz && (
              <>
                <span className="opacity-55"> · Gericht: </span>
                <span className="mono">{akte.gerichtsAz}</span>
              </>
            )}
          </div>
        </div>

        <table className="mt-6 w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-black/15 text-left text-[10.5px] uppercase tracking-[0.06em] opacity-60">
              <th className="py-2 pr-3 font-semibold">Position</th>
              <th className="py-2 text-right font-semibold">Betrag</th>
            </tr>
          </thead>
          <tbody>
            <Z k={`Hauptforderung, fällig seit ${fmtDate(f.faelligAb)}`} v={f.hauptforderung} />
            {stand.zinsAbschnitte.map((z, i) => (
              <Z
                key={`z${i}`}
                eingerueckt
                k={
                  <>
                    Zinsen {fmtProzent(z.zinssatz)} ({aufschlag} PP über Basiszins) aus {fmtEUR(z.kapital)} vom {fmtDate(z.von)} bis {fmtDate(z.bis)}{" "}
                    <span className="opacity-60">({z.tage} Tage)</span>
                  </>
                }
                v={z.zinsen}
              />
            ))}
            {kosten.map((k, i) => (
              <Z key={`k${i}`} eingerueckt k={`${k.text} (${fmtDate(k.datum)})`} v={k.betrag} />
            ))}
            <Z k="Zwischensumme" v={zwischen} stark />
            {zahlungen.map((z, i) => (
              <Z key={`p${i}`} eingerueckt minus k={`abzüglich ${z.text} vom ${fmtDate(z.datum)}`} v={z.betrag} />
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-4 w-full max-w-[320px] text-[12.5px]">
          <div className="flex justify-between py-0.5 opacity-75">
            <span>Resthauptforderung</span>
            <span className="num">{fmtEUR(stand.hauptforderung)}</span>
          </div>
          <div className="flex justify-between py-0.5 opacity-75">
            <span>offene Zinsen</span>
            <span className="num">{fmtEUR(stand.zinsen)}</span>
          </div>
          <div className="flex justify-between py-0.5 opacity-75">
            <span>offene Kosten</span>
            <span className="num">{fmtEUR(stand.kosten)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-black/20 pt-2 text-[14px] font-semibold">
            <span>Gesamtforderung</span>
            <span className="num">{fmtEUR(stand.gesamt)}</span>
          </div>
          {ueberzahlung > 0 && (
            <div className="flex justify-between py-1 font-semibold">
              <span>Überzahlung (an den Schuldner zu erstatten)</span>
              <span className="num">{fmtEUR(ueberzahlung)}</span>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-2 text-[12px] leading-relaxed">
          {weitereZinsen ? (
            <p>
              Zuzüglich weiterer Zinsen in Höhe von {aufschlag} Prozentpunkten über dem jeweiligen Basiszinssatz (§ 288 Abs. {verbraucher ? "1" : "2"} BGB) aus{" "}
              <strong className="num">{fmtEUR(stand.hauptforderung)}</strong> seit dem {fmtDate(addDays(stichtag, 1))} sowie der Kosten der Zwangsvollstreckung.
            </p>
          ) : (
            <p>Die Forderung ist zum Stichtag vollständig ausgeglichen{ueberzahlung > 0 ? "; der überzahlte Betrag wird an den Schuldner erstattet" : ""}.</p>
          )}
          <p className="text-[11px] opacity-60">
            Zahlungen wurden gemäß § 367 Abs. 1 BGB zunächst auf die Kosten, dann auf die Zinsen und zuletzt auf die Hauptforderung angerechnet. Zinsberechnung taggenau (act/365).
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-6 text-[11.5px]">
          <div>
            {ort}, {fmtDate(today())}
          </div>
          <div className="text-right">
            <div className="ml-auto h-px w-44 bg-black/30" />
            <div className="mt-1">{bearbeiter?.name ?? "Rechtsanwalt"}</div>
            <div className="opacity-55">{bearbeiter?.titel?.split(" · ")[0] ?? "Rechtsanwalt"}</div>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
