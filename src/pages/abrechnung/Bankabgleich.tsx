// Reiter „Bankabgleich“: Kontoumsätze werden automatisch Rechnungen zugeordnet – mit sichtbarem Abgleich.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Building2, Check, CheckCircle2, Clock, Landmark, Link2, ShieldCheck, Sparkles, Upload, X } from "lucide-react";
import { AnimatedNumber, Button, Card, CardHeader, Chip, ProgressRing, Select, Stat } from "@/components/ui";
import { useCol, useData } from "@/store/data";
import { toast } from "@/store/ui";
import { fmtDateShort, fmtEUR, nowLocal, round2 } from "@/core/dates";
import type { Transaktion } from "@/core/types";
import { cn } from "@/lib/cn";
import { AUTO_SCHWELLE, bucheTreffer, gleicheAb, REGELN, type Treffer } from "./abgleich";
import { istOffen, offenerBetrag } from "./lib";
import { AkteLabel, TabKopf, useLookups } from "./ui";

type Zustand = "gebucht" | "vorschlag" | "kosten" | "keine" | "bestaetigt" | "abgelehnt" | "manuell";
type Ergebnis = Treffer & { zustand: Zustand };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MIN_GESPART = 8;

function tonVon(z: Zustand | undefined): "green" | "amber" | "neutral" | "seal" {
  if (z === "gebucht" || z === "bestaetigt" || z === "manuell") return "green";
  if (z === "vorschlag") return "amber";
  if (z === "keine" || z === "abgelehnt") return "seal";
  return "neutral";
}

function Verbinder({ ton, sichtbar, scannt }: { ton: ReturnType<typeof tonVon>; sichtbar: boolean; scannt: boolean }) {
  const farbe = ton === "green" ? "var(--green)" : ton === "amber" ? "var(--amber)" : ton === "seal" ? "var(--fg-4)" : "var(--fg-3)";
  return (
    <div className="relative flex h-full items-center justify-center" aria-hidden>
      {/* Desktop: waagerecht */}
      <svg width="64" height="24" viewBox="0 0 64 24" className="hidden md:block">
        <line x1="4" y1="12" x2="60" y2="12" stroke="var(--line-strong)" strokeDasharray="2 4" />
        {sichtbar && (
          <>
            <motion.path
              d="M4 12 H56"
              stroke={farbe}
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.path
              d="M51 7 L57 12 L51 17"
              stroke={farbe}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.32 }}
            />
          </>
        )}
      </svg>
      {/* Mobil: senkrecht */}
      <svg width="24" height="26" viewBox="0 0 24 26" className="md:hidden">
        <line x1="12" y1="2" x2="12" y2="24" stroke="var(--line-strong)" strokeDasharray="2 4" />
        {sichtbar && (
          <>
            <motion.path d="M12 2 V20" stroke={farbe} strokeWidth={2} strokeLinecap="round" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} />
            <motion.path
              d="M7 16 L12 21 L17 16"
              stroke={farbe}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            />
          </>
        )}
      </svg>
      {scannt && (
        <div className="absolute inset-0 flex items-center justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="size-1.5 rounded-full bg-ink"
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.15, 0.8] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Ziel({ children, ton, gestrichelt }: { children: ReactNode; ton?: ReturnType<typeof tonVon>; gestrichelt?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, x: -8 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 460, damping: 32 }}
      className={cn(
        "flex min-h-[76px] min-w-0 items-center gap-3 rounded-[18px] px-3.5 py-3",
        gestrichelt ? "border border-dashed border-[var(--line-strong)]" : "border border-[var(--line)] bg-[var(--surface)]",
        ton === "green" && "shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--green)_35%,transparent)]",
        ton === "amber" && "shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--amber)_40%,transparent)]",
      )}
    >
      {children}
    </motion.div>
  );
}

export function BankabgleichTab() {
  const transaktionen = useCol("transaktionen");
  const rechnungen = useCol("rechnungen");
  const { akten, kontakte } = useLookups();
  const [phase, setPhase] = useState<"bereit" | "laeuft" | "fertig">("bereit");
  const [reihenfolge, setReihenfolge] = useState<string[]>([]);
  const [aktuell, setAktuell] = useState(-1);
  const [ergebnisse, setErgebnisse] = useState<Record<string, Ergebnis>>({});
  const [manuell, setManuell] = useState<Record<string, string>>({});
  const alive = useRef(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const zeilenRef = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const tById = useMemo(() => new Map(transaktionen.map((t) => [t.id, t])), [transaktionen]);
  const rById = useMemo(() => new Map(rechnungen.map((r) => [r.id, r])), [rechnungen]);
  const sortiert = (ts: Transaktion[]) => [...ts].sort((a, b) => b.datum.localeCompare(a.datum) || b.betrag - a.betrag);
  const offen = useMemo(() => sortiert(transaktionen.filter((t) => t.status === "offen")), [transaktionen]);
  const liste = phase === "bereit" ? offen.map((t) => t.id) : [...reihenfolge, ...offen.map((t) => t.id).filter((id) => !reihenfolge.includes(id))];
  const historie = useMemo(() => sortiert(transaktionen.filter((t) => t.status !== "offen" && !reihenfolge.includes(t.id))), [transaktionen, reihenfolge]);
  const offeneRechnungen = useMemo(() => rechnungen.filter(istOffen).sort((a, b) => a.nummer.localeCompare(b.nummer)), [rechnungen]);

  const eingaengeOffen = round2(offen.filter((t) => t.betrag > 0).reduce((s, t) => s + t.betrag, 0));
  const autoGesamt = transaktionen.filter((t) => t.zuordnung?.durch === "auto").length;
  const werte = Object.values(ergebnisse);
  const anz = {
    gebucht: werte.filter((e) => e.zustand === "gebucht").length,
    vorschlag: werte.filter((e) => e.zustand === "vorschlag").length,
    kosten: werte.filter((e) => e.zustand === "kosten").length,
    keine: werte.filter((e) => e.zustand === "keine").length,
    bestaetigt: werte.filter((e) => e.zustand === "bestaetigt" || e.zustand === "manuell").length,
  };

  const starten = async () => {
    const st = useData.getState();
    const offeneT = sortiert(st.data.transaktionen.filter((t) => t.status === "offen"));
    if (!offeneT.length) {
      toast("Keine offenen Kontoumsätze", { text: "Alle Umsätze sind bereits zugeordnet.", ton: "info" });
      return;
    }
    const treffer = gleicheAb({ transaktionen: offeneT, rechnungen: st.data.rechnungen, akten: st.data.akten, kontakte: st.data.kontakte });
    setReihenfolge(offeneT.map((t) => t.id));
    setErgebnisse({});
    setManuell({});
    setPhase("laeuft");
    let gebucht = 0;
    let vorschlaege = 0;
    let kosten = 0;
    for (let i = 0; i < offeneT.length; i++) {
      const t = offeneT[i];
      const tr = treffer[i];
      if (alive.current) {
        setAktuell(i);
        zeilenRef.current[t.id]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        await sleep(560);
      }
      let zustand: Zustand;
      if (tr.art === "kosten") {
        bucheTreffer(t, tr, "auto");
        zustand = "kosten";
        kosten++;
      } else if (tr.art === "rechnung" && tr.sicherheit >= AUTO_SCHWELLE) {
        bucheTreffer(t, tr, "auto");
        zustand = "gebucht";
        gebucht++;
      } else if (tr.art === "rechnung") {
        zustand = "vorschlag";
        vorschlaege++;
      } else zustand = "keine";
      if (alive.current) {
        setErgebnisse((e) => ({ ...e, [t.id]: { ...tr, zustand } }));
        await sleep(300);
      }
    }
    if (alive.current) {
      setAktuell(-1);
      setPhase("fertig");
    }
    const auto = st.data.automationen.find((a) => a.key === "bankabgleich");
    if (auto) useData.getState().patch("automationen", auto.id, { laeufe: auto.laeufe + 1, letzterLauf: nowLocal() });
    useData.getState().log({
      akteur: "automation",
      automationKey: "bankabgleich",
      text: `Bankabgleich: ${gebucht} ${gebucht === 1 ? "Zahlung" : "Zahlungen"} automatisch gebucht, ${vorschlaege} ${vorschlaege === 1 ? "Vorschlag" : "Vorschläge"} zur Prüfung, ${kosten} Kanzleikosten erfasst`,
      minutenGespart: MIN_GESPART,
    });
    toast("Bankabgleich abgeschlossen", { text: `${gebucht} gebucht · ${vorschlaege} ${vorschlaege === 1 ? "Vorschlag" : "Vorschläge"} · ${kosten} Kanzleikosten`, ton: "erfolg" });
  };

  const setZustand = (id: string, zustand: Zustand, patch: Partial<Ergebnis> = {}) => setErgebnisse((e) => (e[id] ? { ...e, [id]: { ...e[id], ...patch, zustand } } : e));

  const zahlungsToast = (titel: string, t: Transaktion, nummer: string, erg: ReturnType<typeof bucheTreffer>) =>
    erg && erg.guthaben > 0
      ? toast(`${titel} – mit Überzahlung`, { text: `${fmtEUR(erg.verrechnet)} auf ${nummer} verrechnet · ${fmtEUR(erg.guthaben)} als Guthaben der Mandantschaft im Aktenkonto (erstatten oder verrechnen)`, ton: "warnung" })
      : toast(titel, { text: `${fmtEUR(t.betrag)} auf ${nummer}`, ton: "erfolg" });

  const bestaetigen = (t: Transaktion, e: Ergebnis) => {
    const erg = bucheTreffer(t, e, "manuell");
    setZustand(t.id, "bestaetigt");
    const r = e.rechnungId ? rById.get(e.rechnungId) : undefined;
    zahlungsToast("Zahlung gebucht", t, r?.nummer ?? "Rechnung", erg);
  };

  const zuordnen = (t: Transaktion) => {
    const rid = manuell[t.id];
    const r = rid ? rById.get(rid) : undefined;
    if (!r) return;
    const ueber = round2(t.betrag - offenerBetrag(r));
    const tr: Treffer = {
      transaktionId: t.id,
      art: "rechnung",
      regel: "keine",
      sicherheit: 1,
      grund: "Manuell zugeordnet",
      rechnungId: r.id,
      akteId: r.akteId,
      ...(ueber > 0.004 ? { ueberzahlung: ueber } : {}),
    };
    const erg = bucheTreffer(t, tr, "manuell");
    setErgebnisse((e) => ({ ...e, [t.id]: { ...tr, zustand: "manuell" } }));
    zahlungsToast("Zahlung zugeordnet", t, r.nummer, erg);
  };

  const importieren = (f: File | undefined) => {
    if (!f) return;
    toast(`Kontoauszug „${f.name}“ ausgewählt`, { text: "In dieser Demo werden Beispielumsätze verwendet – die Datei wird nicht eingelesen.", ton: "info" });
    if (fileRef.current) fileRef.current.value = "";
  };

  const zielInhalt = (t: Transaktion, e: Ergebnis | undefined, idx: number) => {
    const scannt = phase === "laeuft" && idx === aktuell;
    const wartet = phase === "laeuft" && idx > aktuell && !e;
    if (scannt)
      return (
        <Ziel gestrichelt>
          <div className="min-w-0 flex-1">
            <div className="shimmer h-3 w-2/3 rounded-full" />
            <div className="mt-2 text-[12px] text-fg-3">Prüfe Rechnungsnummer, Aktenzeichen, Zahler und Betrag …</div>
          </div>
        </Ziel>
      );
    if (!e) {
      if (t.status !== "offen") return historieZiel(t);
      return (
        <div className={cn("min-h-[76px] items-center rounded-[18px] border border-dashed border-[var(--line)] px-3.5 text-[12.5px] text-fg-4", wartet ? "flex" : "hidden md:flex")}>
          {wartet ? "wartet …" : "Noch nicht abgeglichen"}
        </div>
      );
    }
    if (e.art === "kosten")
      return (
        <Ziel>
          <div className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-[var(--line)] text-fg-2">
            <Building2 className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium">Kanzleikosten (keine Rechnung)</div>
            <div className="mt-1">
              <Chip>{e.kategorie}</Chip>
            </div>
          </div>
        </Ziel>
      );
    const r = e.rechnungId ? rById.get(e.rechnungId) : undefined;
    const akte = r ? akten.get(r.akteId) : undefined;
    if (e.art === "rechnung" && r && e.zustand !== "abgelehnt") {
      const ton = tonVon(e.zustand);
      const farbe = ton === "green" ? "var(--green)" : "var(--amber)";
      return (
        <Ziel ton={ton}>
          <ProgressRing value={e.sicherheit} size={44} stroke={4} color={farbe}>
            <span className="num text-[11px] font-semibold">{Math.round(e.sicherheit * 100)}%</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="mono text-[12.5px] font-semibold">{r.nummer}</span>
              {e.zustand === "gebucht" && (
                <Chip tone="green" icon={<Check className="size-3" />}>
                  Automatisch gebucht
                </Chip>
              )}
              {(e.zustand === "bestaetigt" || e.zustand === "manuell") && (
                <Chip tone="green" icon={<Check className="size-3" />}>
                  {e.zustand === "manuell" ? "Manuell zugeordnet" : "Bestätigt"}
                </Chip>
              )}
              {e.zustand === "vorschlag" && <Chip tone="amber">Vorschlag</Chip>}
              {e.teilzahlung && <Chip tone="outline">Teilzahlung</Chip>}
              {e.ueberzahlung && <Chip tone="amber">Überzahlung {fmtEUR(e.ueberzahlung)}</Chip>}
            </div>
            <AkteLabel akte={akte} className="mt-0.5 text-[12.5px]" />
            <div className="mt-0.5 truncate text-[11.5px] text-fg-3" title={e.grund}>
              {e.grund}
            </div>
            {e.zustand === "vorschlag" && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="primary" icon={<Check className="size-4" />} onClick={() => bestaetigen(t, e)}>
                  Bestätigen
                </Button>
                <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={() => setZustand(t.id, "abgelehnt")}>
                  Ablehnen
                </Button>
              </div>
            )}
          </div>
        </Ziel>
      );
    }
    // keine Zuordnung / abgelehnt → manuell zuordnen
    const gewaehlt = manuell[t.id] ? rById.get(manuell[t.id]) : undefined;
    const mehr = gewaehlt ? round2(t.betrag - offenerBetrag(gewaehlt)) : 0;
    return (
      <Ziel gestrichelt>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">{e.zustand === "abgelehnt" ? "Vorschlag abgelehnt – manuell zuordnen" : "Keine passende Rechnung"}</div>
          {gewaehlt && mehr > 0.004 && (
            <p className="mt-1 text-[11.5px] leading-snug text-amber">
              Der Umsatz übersteigt den offenen Rest von {gewaehlt.nummer} um {fmtEUR(mehr)} – der Mehrbetrag wird als Guthaben der Mandantschaft gebucht.
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <Select aria-label="Rechnung wählen" value={manuell[t.id] ?? ""} onChange={(ev) => setManuell((m) => ({ ...m, [t.id]: ev.target.value }))} className="!h-8 !rounded-[10px] !text-[12.5px]">
              <option value="">Rechnung wählen …</option>
              {offeneRechnungen.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nummer} · {fmtEUR(offenerBetrag(x))} · {kontakte.get(x.empfaengerId)?.name ?? ""}
                </option>
              ))}
            </Select>
            <Button size="sm" variant="secondary" disabled={!manuell[t.id]} onClick={() => zuordnen(t)}>
              Zuordnen
            </Button>
          </div>
        </div>
      </Ziel>
    );
  };

  const historieZiel = (t: Transaktion) => {
    const z = t.zuordnung;
    if (t.status === "ignoriert")
      return (
        <div className="flex min-h-[64px] items-center gap-3 rounded-[18px] border border-[var(--line)] px-3.5 py-2.5">
          <Building2 className="size-4 shrink-0 text-fg-3" />
          <span className="min-w-0 truncate text-[12.5px] text-fg-2">{z?.grund ?? "Ohne Rechnungsbezug"}</span>
        </div>
      );
    const r = z?.rechnungId ? rById.get(z.rechnungId) : undefined;
    return (
      <div className="flex min-h-[64px] items-center gap-3 rounded-[18px] border border-[var(--line)] px-3.5 py-2.5">
        <CheckCircle2 className="size-4 shrink-0 text-green" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono text-[12.5px] font-medium">{r?.nummer ?? "Rechnung"}</span>
            {z && (
              <span className="num text-[11.5px] text-fg-3">
                {Math.round(z.sicherheit * 100)} % · {z.durch === "auto" ? "automatisch" : "manuell"}
              </span>
            )}
          </div>
          <div className="truncate text-[11.5px] text-fg-3">{z?.grund}</div>
        </div>
      </div>
    );
  };

  const umsatzKarte = (t: Transaktion, scannt: boolean) => (
    <div className={cn("relative flex min-h-[76px] min-w-0 items-center gap-3 overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3", scannt && "ai-ring")}>
      {scannt && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-[var(--ink-soft)] to-transparent"
          initial={{ left: "-35%" }}
          animate={{ left: "105%" }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <div className="w-[52px] shrink-0 text-center">
        <div className="num text-[12px] font-semibold text-fg-2">{fmtDateShort(t.datum)}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium">{t.gegenpartei}</div>
        <div className="mono truncate text-[11.5px] text-fg-3" title={t.verwendungszweck}>
          {t.verwendungszweck}
        </div>
      </div>
      <div className={cn("num shrink-0 text-right text-[14px] font-semibold", t.betrag > 0 ? "text-green" : "text-fg-2")}>
        {t.betrag > 0 ? "+" : "−"}
        {fmtEUR(Math.abs(t.betrag))}
      </div>
    </div>
  );

  return (
    <>
      <TabKopf
        icon={<Landmark className="size-[18px]" />}
        titel="Bankabgleich"
        text="Kontoumsätze werden automatisch Rechnungen zugeordnet – sichere Treffer bucht AnwaltApex selbst, unsichere legt es Ihnen zur Bestätigung vor."
        aktionen={
          <>
            <input ref={fileRef} type="file" accept=".xml,.sta,.mt940,.csv" className="hidden" onChange={(e) => importieren(e.target.files?.[0])} />
            <Button variant="secondary" icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>
              Kontoauszug importieren
            </Button>
            <Button variant="ai" icon={<Sparkles className="size-4" />} loading={phase === "laeuft"} onClick={starten} disabled={phase === "laeuft"}>
              {phase === "laeuft" ? "Gleiche ab …" : "Abgleich starten"}
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid grid-cols-1 min-w-0 gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 [&>*:last-child]:col-span-2 md:[&>*:last-child]:col-span-1">
            <Stat label="Offene Umsätze" icon={<Clock className="size-4" />} tone="amber" value={<AnimatedNumber value={offen.length} />} sub="warten auf Zuordnung" />
            <Stat
              label="Offene Eingänge"
              icon={<Landmark className="size-4" />}
              tone="ink"
              value={<AnimatedNumber value={eingaengeOffen} format={(n) => fmtEUR(n, { cents: false })} className="text-[20px] sm:text-[28px]" />}
              sub="Zahlungseingänge"
            />
            <Stat label="Automatisch zugeordnet" icon={<Link2 className="size-4" />} tone="green" value={<AnimatedNumber value={autoGesamt} />} sub="Umsätze insgesamt" />
          </div>

          <AnimatePresence>
            {phase === "fertig" && (
              <motion.div initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 32 }}>
                <Card>
                  <div className="flex flex-wrap items-center gap-3">
                    <motion.div
                      initial={{ scale: 0.4 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 520, damping: 18 }}
                      className="grid size-11 shrink-0 place-items-center rounded-full bg-green-soft text-green"
                    >
                      <CheckCircle2 className="size-6" />
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <div className="title-md">Abgleich abgeschlossen</div>
                      <div className="text-[12.5px] text-fg-3">
                        {anz.gebucht} {anz.gebucht === 1 ? "Zahlung" : "Zahlungen"} automatisch gebucht · {anz.vorschlag} {anz.vorschlag === 1 ? "Vorschlag" : "Vorschläge"} · {anz.kosten}{" "}
                        Kanzleikosten
                      </div>
                    </div>
                    <Chip tone="green" icon={<Clock className="size-3.5" />}>
                      {MIN_GESPART} Min. gespart
                    </Chip>
                  </div>
                  <div className={cn("mt-4 grid grid-cols-2 gap-2", anz.keine > 0 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
                    {[
                      { n: anz.gebucht + anz.bestaetigt, label: "gebucht", sub: anz.bestaetigt ? `davon ${anz.bestaetigt} bestätigt` : "automatisch", cls: "text-green" },
                      { n: anz.vorschlag, label: anz.vorschlag === 1 ? "Vorschlag" : "Vorschläge", sub: "warten auf Sie", cls: "text-amber" },
                      { n: anz.kosten, label: "Kanzleikosten", sub: "ohne Rechnung", cls: "text-fg" },
                      ...(anz.keine > 0 ? [{ n: anz.keine, label: "ohne Zuordnung", sub: "manuell zuordnen", cls: "text-seal" }] : []),
                    ].map((x, i) => (
                      <motion.div
                        key={x.label}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.06, type: "spring", stiffness: 460, damping: 32 }}
                        className="rounded-[16px] bg-[var(--ink-softer)] px-4 py-3"
                      >
                        <AnimatedNumber value={x.n} className={cn("text-[26px] font-semibold leading-none tracking-[-0.03em]", x.cls)} />
                        <div className="mt-1.5 text-[12.5px] font-medium">{x.label}</div>
                        <div className="text-[11.5px] text-fg-3">{x.sub}</div>
                      </motion.div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <Card padded={false} className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
              <div className="text-[13px] font-semibold">{phase === "bereit" ? "Offene Kontoumsätze" : "Ergebnis des Abgleichs"}</div>
              <div className="hidden text-[12px] text-fg-3 md:block">Umsatz → zugeordnete Rechnung</div>
            </div>
            {liste.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <div className="grid size-12 place-items-center rounded-[16px] bg-green-soft text-green">
                  <CheckCircle2 className="size-6" />
                </div>
                <div className="title-md mt-3">Alle Umsätze zugeordnet</div>
                <p className="mt-1 max-w-sm text-[12.5px] text-fg-3">Neue Kontoumsätze erscheinen hier automatisch und werden stündlich abgeglichen.</p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-2 p-3">
                {liste.map((id, idx) => {
                  const t = tById.get(id);
                  if (!t) return null;
                  const e = ergebnisse[id];
                  const scannt = phase === "laeuft" && idx === aktuell;
                  return (
                    <motion.li
                      key={id}
                      ref={(el) => {
                        zeilenRef.current[id] = el;
                      }}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: phase === "laeuft" && idx > aktuell && !e ? 0.6 : 1, y: 0 }}
                      transition={{ delay: phase === "bereit" ? Math.min(idx, 10) * 0.03 : 0 }}
                      className="grid items-stretch gap-1 md:grid-cols-[minmax(0,1.1fr)_64px_minmax(0,1fr)] md:gap-0"
                    >
                      {umsatzKarte(t, scannt)}
                      <div className={cn(!e && !scannt && phase !== "laeuft" && t.status === "offen" && "hidden md:block")}>
                        <Verbinder ton={tonVon(e?.zustand)} sichtbar={!!e} scannt={scannt} />
                      </div>
                      {zielInhalt(t, e, idx)}
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </Card>

          {historie.length > 0 && (
            <Card padded={false} className="overflow-hidden">
              <div className="border-b border-[var(--line)] px-4 py-3 text-[13px] font-semibold">Bereits zugeordnet</div>
              <ul className="grid grid-cols-1 gap-2 p-3">
                {historie.slice(0, 12).map((t) => (
                  <li key={t.id} className="grid items-stretch gap-1 opacity-90 md:grid-cols-[minmax(0,1.1fr)_64px_minmax(0,1fr)] md:gap-0">
                    {umsatzKarte(t, false)}
                    <Verbinder ton={t.status === "ignoriert" ? "neutral" : "green"} sichtbar scannt={false} />
                    {historieZiel(t)}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:sticky xl:top-24">
          <Card>
            <CardHeader
              icon={<ShieldCheck className="size-4" />}
              title="Wie sicher ist die Zuordnung?"
              subtitle={`Ab ${Math.round(AUTO_SCHWELLE * 100)} % bucht AnwaltApex selbst – darunter entscheiden Sie.`}
            />
            <ul className="grid grid-cols-1 gap-3">
              {REGELN.map((r) => (
                <li key={r.regel} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "num mt-0.5 grid h-6 w-11 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                      r.folge === "auto" ? "bg-green-soft text-green" : r.folge === "vorschlag" ? "bg-amber-soft text-amber" : "bg-[var(--line)] text-fg-2",
                    )}
                  >
                    {r.sicherheit ? `${Math.round(r.sicherheit * 100)}%` : "–"}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium">{r.titel}</div>
                    <div className="text-[12px] leading-snug text-fg-3">{r.text}</div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-[var(--line)] pt-3">
              <Chip tone="green">automatisch gebucht</Chip>
              <Chip tone="amber">Vorschlag zur Bestätigung</Chip>
              <Chip>Kanzleikosten</Chip>
            </div>
          </Card>
          <Card>
            <CardHeader icon={<Upload className="size-4" />} title="Kontoauszüge" subtitle="Import im Format CAMT.053 (XML), MT940 (.sta) oder CSV." />
            <p className="text-[12.5px] leading-relaxed text-fg-3">
              Jeder Umsatz wird gegen offene Rechnungen und Aktenkonten geprüft. Jede Zuordnung bleibt nachvollziehbar – mit Regel, Sicherheit und wer gebucht hat. In dieser Demo werden
              Beispielumsätze verwendet.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
