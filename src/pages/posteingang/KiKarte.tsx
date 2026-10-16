import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle, ArrowRight, CalendarDays, CalendarPlus, Check, CheckCircle2, ChevronDown, FolderInput, FolderOpen, ListChecks, Loader2,
  RotateCcw, ShieldAlert, ShieldCheck, Sparkles, UserPlus,
} from "lucide-react";
import { fmtDate, fmtDateWd, fmtTime, relDays, wochentagName } from "@/core/dates";
import type { FristVorschlag } from "@/ai/dokumentAnalyse";
import type { Nachricht } from "@/core/types";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast, useToasts } from "@/store/ui";
import { AiChip, Button, Chip, ProgressRing, Select, confirmDialog } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  SCHRITTE, ablegbareAnhaenge, alsErledigt, anhaengeAblegen, anhaengeAbgelegt, eebAbgeben, fristenUebernehmen, istGerichtspost, istNotiert, terminEintragen, zuordnen, type KiAnsicht,
} from "./analyse";
import { TYP_META } from "@/pages/fristen/logik";
import { fristArtZu } from "@/core/fristen";

const spring = { type: "spring", stiffness: 460, damping: 36 } as const;

function ScanPapier() {
  return (
    <div className="relative hidden h-[104px] w-[80px] shrink-0 overflow-hidden rounded-[10px] bg-surface shadow-[0_8px_22px_-12px_rgba(20,30,80,0.35)] ring-1 ring-[var(--line)] min-[420px]:block" aria-hidden>
      <div className="space-y-[6px] p-2.5 pt-3">
        {[70, 92, 84, 96, 60, 88, 76, 50].map((w, i) => (
          <div key={i} className="h-[3px] rounded-full bg-[var(--line-strong)]" style={{ width: `${w}%` }} />
        ))}
      </div>
      <motion.div
        className="absolute inset-x-0 h-8"
        style={{ background: "linear-gradient(180deg, transparent, color-mix(in oklab, var(--ai-2) 30%, transparent) 60%, color-mix(in oklab, var(--ai-1) 55%, transparent) 92%, transparent)" }}
        initial={{ y: -32 }}
        animate={{ y: 104 }}
        transition={{ repeat: Infinity, duration: 1.3, ease: "easeInOut" }}
      />
    </div>
  );
}

/** Animierter Ablauf: Dokument lesen → Akte erkennen → Fristen prüfen → Rechenweg erstellen. */
export function AnalyseAblauf({ schritt }: { schritt: number }) {
  const fortschritt = Math.min(1, (schritt + (schritt < SCHRITTE.length ? 0.55 : 0)) / SCHRITTE.length);
  return (
    <div>
      <div className="flex items-start gap-5">
        <ScanPapier />
        <ol className="min-w-0 flex-1 space-y-2.5">
          {SCHRITTE.map((s, i) => {
            const fertig = i < schritt;
            const aktiv = i === schritt;
            return (
              <motion.li key={s.titel} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay: i * 0.07 }} className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full transition-colors duration-300",
                    fertig ? "bg-green text-[var(--surface)]" : aktiv ? "bg-violet-soft text-violet" : "bg-[var(--line)] text-fg-4",
                  )}
                >
                  {fertig ? (
                    <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 22 }}>
                      <Check className="size-3.5" strokeWidth={3} />
                    </motion.span>
                  ) : aktiv ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <span className="num text-[10.5px] font-semibold">{i + 1}</span>
                  )}
                </span>
                <div className="min-w-0">
                  <div className={cn("text-[13.5px] font-semibold leading-tight", aktiv ? "ai-text" : fertig ? "text-fg" : "text-fg-4")}>{s.titel}</div>
                  <div className={cn("truncate text-[11.5px]", aktiv || fertig ? "text-fg-3" : "text-fg-4")}>{s.text}</div>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--line)]" role="progressbar" aria-valuenow={Math.round(fortschritt * 100)} aria-valuemin={0} aria-valuemax={100}>
        <motion.div className="ai-fill h-full rounded-full" initial={{ width: "4%" }} animate={{ width: `${fortschritt * 100}%` }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
      </div>
    </div>
  );
}

function sicherheitFarbe(s: number) {
  return s >= 0.9 ? "var(--green)" : s >= 0.6 ? "var(--amber)" : "var(--seal)";
}

function Rechenweg({ schritte }: { schritte: string[] }) {
  return (
    <ol className="relative mt-3 space-y-2 pl-1">
      {schritte.map((s, i) => (
        <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.06 }} className="relative flex gap-3">
          {i < schritte.length - 1 && <span className="absolute left-[10px] top-6 h-[calc(100%-12px)] w-px bg-[var(--line-strong)]" aria-hidden />}
          <span className="num relative grid size-[21px] shrink-0 place-items-center rounded-full bg-surface text-[10.5px] font-semibold text-ink ring-1 ring-[var(--line-strong)]">{i + 1}</span>
          <span className="pt-px text-[12.5px] leading-relaxed text-fg-2">{s}</span>
        </motion.li>
      ))}
    </ol>
  );
}

function FristVorschlagKarte({ p, notiert, index }: { p: FristVorschlag; notiert: boolean; index: number }) {
  const [offen, setOffen] = useState(false);
  const meta = TYP_META[p.typ];
  // Rechtsnatur aus der Fristregel: Notfrist (§ 224 ZPO) bzw. nicht verlängerbare Frist (z. B. § 4 KSchG, StPO, OWiG)
  const art = fristArtZu(p);
  const notfrist = !!art?.kritisch;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.1 + index * 0.08 }}
      className={cn("rounded-[18px] bg-surface/80 p-4 ring-1 ring-inset", notfrist ? "ring-[color-mix(in_oklab,var(--seal)_28%,transparent)]" : "ring-[var(--line)]")}
    >
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone={notfrist ? "seal" : meta.tone} icon={notfrist ? <ShieldAlert className="size-3" /> : undefined} title={art?.kurz}>
              {art?.label ?? meta.label}
            </Chip>
            <span className="text-[14px] font-semibold">{p.titel}</span>
          </div>
          <div className="mt-1 text-[12px] text-fg-3">
            {p.grundlage}
            {art?.kritisch && p.typ !== "notfrist" ? " · nicht verlängerbar" : ""}
          </div>
        </div>
        {notiert && (
          <motion.span initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 600, damping: 24 }}>
            <Chip tone="green" icon={<CheckCircle2 className="size-3" />}>
              Im Kalender
            </Chip>
          </motion.span>
        )}
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1.35fr_1fr]">
        <div className="min-w-0">
          <div className="eyebrow !text-[10px]">Zustellung</div>
          <div className="num mt-1 text-[13px] font-medium">{fmtDateWd(p.ereignisDatum)}</div>
        </div>
        <div className="order-first col-span-2 min-w-0 rounded-[14px] bg-[var(--ink-softer)] px-3 py-2 sm:order-none sm:col-span-1">
          <div className={cn("eyebrow !text-[10px]", notfrist && "!text-seal")}>Fristende</div>
          <div className={cn("num mt-0.5 text-[16px] font-semibold tracking-[-0.01em]", notfrist && "text-seal")}>
            {wochentagName(p.ende)}, {fmtDate(p.ende)}
          </div>
          <div className="num text-[11.5px] text-fg-3">24:00 Uhr · {relDays(p.ende)}</div>
        </div>
        <div className="min-w-0">
          <div className="eyebrow !text-[10px]">Vorfrist</div>
          <div className="num mt-1 text-[13px] font-medium">{fmtDateWd(p.vorfrist)}</div>
        </div>
      </div>

      {p.warnungen.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {p.warnungen.map((w) => (
            <div key={w} className="flex gap-2 rounded-[12px] bg-amber-soft px-3 py-2 text-[12.5px] text-amber">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={() => setOffen((o) => !o)} aria-expanded={offen} className="mt-3 inline-flex items-center gap-1.5 rounded-full px-1 text-[12.5px] font-medium text-ink hover:underline">
        <ChevronDown className={cn("size-3.5 transition-transform duration-300", offen && "rotate-180")} />
        {offen ? "Rechenweg ausblenden" : "Rechenweg anzeigen"}
      </button>
      <AnimatePresence initial={false}>
        {offen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <Rechenweg schritte={p.rechenweg} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Abschnitt({ titel, icon, children, className, delay = 0 }: { titel: string; icon: React.ReactNode; children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay }} className={className}>
      <div className="mb-2.5 flex items-center gap-2 text-fg-3">
        <span className="[&>svg]:size-3.5">{icon}</span>
        <span className="eyebrow">{titel}</span>
      </div>
      {children}
    </motion.section>
  );
}

export function KiKarte({ n, ansicht, schritt, fehler, onAnalyse }: { n: Nachricht; ansicht: KiAnsicht | null; schritt?: number; fehler?: string; onAnalyse: () => void }) {
  const { user } = useKanzlei();
  const akten = useCol("akten");
  const fristen = useCol("fristen");
  const dokumente = useCol("dokumente");
  const nav = useNavigate();
  const vorschlagId = n.akteId ?? ansicht?.akteId ?? "";
  const [wahl, setWahl] = useState(vorschlagId);
  const [andere, setAndere] = useState(false);
  useEffect(() => {
    setWahl(vorschlagId);
    setAndere(false);
  }, [n.id, vorschlagId]);

  const offeneAkten = useMemo(() => akten.filter((a) => a.status !== "abgeschlossen").sort((a, b) => b.aktenzeichen.localeCompare(a.aktenzeichen, "de", { numeric: true })), [akten]);
  const ziel = akten.find((a) => a.id === wahl);
  const vorgeschlagen = ansicht?.akteId ? akten.find((a) => a.id === ansicht.akteId) : undefined;
  const laeuft = schritt !== undefined;

  const zugeordnet = !!n.akteId && n.akteId === wahl;
  const notiert = ansicht ? ansicht.fristen.map((p) => istNotiert(p, ziel?.id, fristen)) : [];
  const alleNotiert = !!ansicht && ansicht.fristen.length > 0 && notiert.every(Boolean);
  const eebFrei = !!ansicht && (ansicht.fristen.length === 0 || alleNotiert);
  const terminDa = !!ansicht?.termin && !!ziel && fristen.some((f) => f.akteId === ziel.id && f.typ === "termin" && f.datum === ansicht.termin!.datum);
  const mandatsanfrage = !!ansicht && !ansicht.akteId && !n.akteId && /mandat/i.test(ansicht.typ);
  /** Aus dieser Anfrage wurde eine neue Akte angelegt (Mandatsaufnahme), statt sie einer bestehenden zuzuordnen. */
  const akteAngelegt = !!ansicht && !ansicht.akteId && /mandat/i.test(ansicht.typ) && zugeordnet && !!ziel && ziel.createdAt >= n.eingang;
  const offeneKontrollen = ziel ? fristen.filter((f) => f.akteId === ziel.id && f.quelle === "ki" && f.status === "offen" && !f.kontrolliertVon && f.typ !== "vorfrist" && ansicht?.fristen.some((p) => p.ende === f.datum)) : [];
  const unkontrolliert = offeneKontrollen.length;
  const nurEigene = unkontrolliert > 0 && offeneKontrollen.every((f) => f.verantwortlichId === user.id);
  const anhaenge = ablegbareAnhaenge(n);
  const anhaengeDa = zugeordnet && anhaengeAbgelegt(n, ziel?.id, dokumente);

  const quelleText = ansicht?.frisch
    ? `${ansicht.quelle === "demo" ? "Demo-KI (offline)" : "Claude · live"}${ansicht.dauerMs ? ` · ${(ansicht.dauerMs / 1000).toFixed(1).replace(".", ",")} s` : ""}`
    : "Gespeicherter KI-Vorschlag";

  const uebernehmen = () => {
    if (!ziel || !ansicht) return;
    const { anzahl, rueckgaengig } = fristenUebernehmen(n, ziel, user, ansicht, fristen);
    toast(anzahl === 1 ? "Frist eingetragen" : `${anzahl} Fristen eingetragen`, {
      text: `In Akte ${ziel.aktenzeichen} mit Vorfristen notiert. Vier-Augen-Kontrolle offen.`,
      ton: "erfolg",
      aktion: {
        label: "Rückgängig",
        onClick: () => {
          if (!rueckgaengig())
            toast("Rückgängig nicht mehr möglich", {
              ton: "warnung",
              text: "Das Empfangsbekenntnis ist bereits abgegeben – die Fristen laufen und bleiben im Kalender. Einzelne Fristen bearbeiten Sie im Fristenkalender.",
            });
        },
      },
    });
  };

  const zuordnenKlick = () => {
    if (!ziel) return;
    const r = zuordnen(n, ziel, user, ansicht);
    setAndere(false);
    toast("Akte zugeordnet", {
      text: `In ${ziel.aktenzeichen} · Ordner „${r.ordner}“ abgelegt${r.anhaenge ? `, ${r.anhaenge} ${r.anhaenge === 1 ? "Anhang" : "Anhänge"} in „${r.anhangOrdner}“` : ""}.`,
      ton: "erfolg",
    });
  };

  const anhaengeKlick = () => {
    if (!ziel) return;
    const r = anhaengeAblegen(n, ziel, user);
    toast(r.anzahl === 1 ? "Anhang abgelegt" : `${r.anzahl} Anhänge abgelegt`, { text: `In ${ziel.aktenzeichen} · Ordner „${r.ordner}“`, ton: "erfolg", aktion: { label: "E-Akte öffnen", onClick: () => nav(`/akten/${ziel.id}?tab=dokumente`) } });
  };

  const eebKlick = async () => {
    const ok = await confirmDialog({
      titel: "Empfangsbekenntnis abgeben?",
      text: `Zustellungsdatum im eEB: ${fmtDate(n.eingang.slice(0, 10))} (Eingangstag). Maßgeblich ist der Tag, an dem Sie das Schriftstück empfangsbereit zur Kenntnis genommen haben – ab diesem Tag laufen die Fristen. Sie sind vorsorglich ab dem Eingangstag berechnet und bereits im Kalender notiert.`,
      bestaetigen: "eEB abgeben",
    });
    if (!ok) return;
    // Während des Dialogs kann sich der Stand geändert haben (z. B. „Rückgängig“ im Toast) – Fristen erneut prüfen.
    const st = useData.getState().data;
    const aktuell = st.nachrichten.find((x) => x.id === n.id);
    const nochNotiert = !!ansicht && ansicht.fristen.every((p) => istNotiert(p, ziel?.id, st.fristen));
    if (!aktuell || aktuell.eebAbgegeben) return;
    if (!nochNotiert) {
      toast("Erst Frist notieren, dann eEB", { ton: "warnung", text: "Die erkannten Fristen stehen nicht (mehr) im Kalender. Bitte zuerst übernehmen." });
      return;
    }
    eebAbgeben(n, user);
    // Offene „Rückgängig“-Angebote der Fristübernahme schließen – nach dem eEB laufen die Fristen.
    const t = useToasts.getState();
    t.toasts.filter((x) => x.aktion?.label === "Rückgängig" && /Fristen? eingetragen/.test(x.titel)).forEach((x) => t.dismiss(x.id));
    toast("eEB abgegeben", { text: "Empfang gegenüber dem Gericht bestätigt – Fristen sind gesichert.", ton: "erfolg" });
  };

  return (
    <div className="ai-ring rounded-[22px]">
      <div className="relative overflow-hidden rounded-[22px] bg-[linear-gradient(160deg,var(--violet-soft),transparent_55%)] p-4 sm:p-5">
        {/* Kopf */}
        <div className="flex items-start gap-3">
          <span className="ai-fill grid size-9 shrink-0 place-items-center rounded-[12px] text-white shadow-[0_6px_18px_-8px_var(--ai-2)]">
            <Sparkles className="size-[17px]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="title-md">KI-Analyse</h3>
              {ansicht && !laeuft && <AiChip>{ansicht.typ}</AiChip>}
            </div>
            <div className="mt-0.5 text-[12px] text-fg-3">{laeuft ? "Die KI liest die Nachricht …" : ansicht ? quelleText : "Akte, Fristen und nächste Schritte in Sekunden"}</div>
          </div>
          {ansicht && !laeuft && (
            <button type="button" onClick={onAnalyse} className="icon-btn !size-8 shrink-0 text-fg-3" aria-label="Erneut analysieren" title="Erneut analysieren">
              <RotateCcw className="size-4" />
            </button>
          )}
        </div>

        <div className="mt-4">
          <AnimatePresence mode="wait" initial={false}>
            {laeuft ? (
              <motion.div key="lauf" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
                <AnalyseAblauf schritt={schritt!} />
              </motion.div>
            ) : !ansicht ? (
              <motion.div key="start" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
                <p className="max-w-[56ch] text-[13.5px] leading-relaxed text-fg-2">
                  Die KI liest die Nachricht, erkennt die passende Akte und fristauslösende Ereignisse. Berechnet wird ausschließlich mit dem geprüften Fristenrechner – jeder Schritt nachvollziehbar.
                </p>
                {fehler && (
                  <div className="mt-3 flex gap-2 rounded-[12px] bg-seal-soft px-3 py-2 text-[12.5px] text-seal" role="alert">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <span>Die Analyse konnte nicht abgeschlossen werden ({fehler}). Bitte erneut starten – Ihre Nachricht bleibt unverändert.</span>
                  </div>
                )}
                <Button variant="ai" className="mt-4" icon={<Sparkles className="size-4" />} onClick={onAnalyse}>
                  Mit KI analysieren
                </Button>
              </motion.div>
            ) : (
              <motion.div key="ergebnis" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-5">
                {/* Zusammenfassung */}
                <Abschnitt titel="Zusammenfassung" icon={<Sparkles />}>
                  <p className="text-[14px] leading-relaxed text-fg">{ansicht.zusammenfassung}</p>
                </Abschnitt>

                {/* Akte */}
                <Abschnitt titel={akteAngelegt ? "Neu angelegte Akte" : zugeordnet ? "Akte" : "Erkannte Akte"} icon={<FolderOpen />} delay={0.05}>
                  {mandatsanfrage && !andere ? (
                    <div className="rounded-[18px] bg-surface/80 p-4 ring-1 ring-inset ring-[var(--line)]">
                      <div className="flex items-start gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">
                          <UserPlus className="size-[17px]" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] font-semibold">Neue Mandatsanfrage – noch keine Akte</div>
                          <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-3">Legen Sie das Mandat mit einem Klick an. Vollmacht und Deckungsanfrage erzeugt AnwaltApex automatisch.</p>
                        </div>
                      </div>
                      <div className="mt-3.5 flex flex-wrap gap-2">
                        {/* Kein replace: Der Assistent ersetzt seinen eigenen Verlaufseintrag beim Anlegen (AktenListe → onErstellt mit replace),
                            Browser-Zurück führt so von der neuen Akte zurück in den Posteingang statt erneut in den Assistenten. */}
                        <Button variant="primary" size="sm" icon={<UserPlus className="size-4" />} onClick={() => nav(`/akten?neu=1&nachricht=${encodeURIComponent(n.id)}`)}>
                          Mandat anlegen
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setAndere(true)}>
                          Bestehender Akte zuordnen
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[18px] bg-surface/80 p-4 ring-1 ring-inset ring-[var(--line)]">
                      {ziel ? (
                        <div className="flex items-center gap-3">
                          {ansicht.akteId === ziel.id && !zugeordnet ? (
                            <ProgressRing value={ansicht.sicherheit} size={44} stroke={4} color={sicherheitFarbe(ansicht.sicherheit)}>
                              <span className="num text-[11px] font-semibold">{Math.round(ansicht.sicherheit * 100)}%</span>
                            </ProgressRing>
                          ) : (
                            <span className={cn("grid size-11 shrink-0 place-items-center rounded-full", zugeordnet ? "bg-green-soft text-green" : "bg-ink-soft text-ink")}>
                              {akteAngelegt ? <UserPlus className="size-5" /> : zugeordnet ? <Check className="size-5" strokeWidth={2.5} /> : <FolderOpen className="size-5" />}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <Link to={`/akten/${ziel.id}`} className="group flex min-w-0 items-baseline gap-2">
                              <span className="mono shrink-0 text-[13px] font-semibold text-ink">{ziel.aktenzeichen}</span>
                              <span className="truncate text-[13.5px] font-medium group-hover:underline">{ziel.titel}</span>
                            </Link>
                            {akteAngelegt && (
                              <div className="mt-1">
                                <Chip tone="green" icon={<CheckCircle2 className="size-3" />}>
                                  Akte angelegt
                                </Chip>
                              </div>
                            )}
                            <div className="mt-0.5 truncate text-[12px] text-fg-3">
                              {akteAngelegt
                                ? "Aus dieser Anfrage angelegt · Anfrage in der E-Akte abgelegt (Korrespondenz)"
                                : zugeordnet
                                ? `Zugeordnet · in der E-Akte abgelegt (${istGerichtspost(n) ? "Gericht" : "Korrespondenz"})`
                                : ansicht.akteId === ziel.id
                                  ? `${Math.round(ansicht.sicherheit * 100)} % sicher · erkannt über ${ansicht.akteGrund ?? "Inhalt"}`
                                  : "Von Ihnen gewählt"}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-amber-soft text-amber">
                            <FolderInput className="size-5" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-[13.5px] font-semibold">Keine Akte sicher erkannt</div>
                            <div className="text-[12px] text-fg-3">Wählen Sie die passende Akte – die KI lernt aus Ihrer Zuordnung.</div>
                          </div>
                        </div>
                      )}
                      {(andere || !ziel) && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 overflow-hidden">
                          <label htmlFor={`akte-wahl-${n.id}`} className="label">
                            Akte wählen
                          </label>
                          <Select id={`akte-wahl-${n.id}`} value={wahl} onChange={(e) => setWahl(e.target.value)}>
                            <option value="">Akte auswählen …</option>
                            {vorgeschlagen && <option value={vorgeschlagen.id}>{`★ ${vorgeschlagen.aktenzeichen} – ${vorgeschlagen.titel} (KI-Vorschlag)`}</option>}
                            {offeneAkten
                              .filter((a) => a.id !== vorgeschlagen?.id)
                              .map((a) => (
                                <option key={a.id} value={a.id}>{`${a.aktenzeichen} – ${a.titel}`}</option>
                              ))}
                          </Select>
                        </motion.div>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {ziel && !zugeordnet && (
                          <Button size="sm" variant={ansicht.fristen.length ? "secondary" : "primary"} icon={<FolderInput className="size-4" />} onClick={zuordnenKlick}>
                            Akte zuordnen
                          </Button>
                        )}
                        {!andere && ziel && (
                          <Button size="sm" variant="ghost" onClick={() => setAndere(true)}>
                            Andere Akte wählen
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </Abschnitt>

                {/* Fristen */}
                {ansicht.fristen.length > 0 && (
                  <Abschnitt titel={`Erkannte ${ansicht.fristen.length === 1 ? "Frist" : "Fristen"}`} icon={<CalendarDays />} delay={0.1}>
                    <div className="space-y-2.5">
                      {ansicht.fristen.map((p, i) => (
                        <FristVorschlagKarte key={`${p.regelKey}-${p.ende}`} p={p} notiert={notiert[i]} index={i} />
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {alleNotiert ? (
                        <div className="flex min-w-0 flex-wrap items-center gap-2 text-[12.5px] text-fg-2">
                          <Chip tone="green" icon={<CheckCircle2 className="size-3" />}>
                            Fristen notiert
                          </Chip>
                          {unkontrolliert > 0 && ziel ? (
                            <span>
                              {nurEigene ? "Vier-Augen-Kontrolle offen – bestätigt eine Kollegin oder ein Kollege" : "Vier-Augen-Kontrolle offen"} ·{" "}
                              <Link to={`/fristen?filter=kontrolle&akte=${encodeURIComponent(ziel.id)}`} className="font-medium text-ink hover:underline">
                                {nurEigene ? "im Fristenkalender ansehen" : "im Fristenkalender bestätigen"}
                              </Link>
                            </span>
                          ) : (
                            <span>Vier-Augen-Kontrolle erledigt</span>
                          )}
                        </div>
                      ) : (
                        <>
                          <Button variant="primary" icon={<CalendarPlus className="size-4" />} onClick={uebernehmen} disabled={!ziel}>
                            {ansicht.fristen.length === 1 ? "Frist übernehmen" : "Fristen übernehmen"}
                          </Button>
                          <span className="text-[12px] text-fg-3">{ziel ? `inkl. Vorfristen in ${ziel.aktenzeichen}` : "Bitte zuerst eine Akte wählen"}</span>
                        </>
                      )}
                    </div>
                  </Abschnitt>
                )}

                {/* Termin */}
                {ansicht.termin && (
                  <Abschnitt titel="Erkannter Termin" icon={<CalendarDays />} delay={0.14}>
                    <div className="flex flex-wrap items-center gap-3 rounded-[18px] bg-surface/80 p-4 ring-1 ring-inset ring-[var(--line)]">
                      <div className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-violet-soft text-center leading-none text-violet">
                        <div>
                          <div className="text-[9.5px] font-semibold uppercase">{wochentagName(ansicht.termin.datum, true)}</div>
                          <div className="num mt-0.5 text-[17px] font-bold">{Number(ansicht.termin.datum.slice(8, 10))}</div>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold">{ansicht.termin.titel}</div>
                        <div className="num text-[12.5px] text-fg-3">
                          {fmtDateWd(ansicht.termin.datum)}
                          {ansicht.termin.uhrzeit ? `, ${ansicht.termin.uhrzeit} Uhr` : ""}
                          {ansicht.termin.ort ? ` · ${ansicht.termin.ort}` : ""}
                        </div>
                      </div>
                      {terminDa ? (
                        <Chip tone="green" icon={<CheckCircle2 className="size-3" />}>
                          Eingetragen
                        </Chip>
                      ) : (
                        <Button
                          size="sm"
                          icon={<CalendarPlus className="size-4" />}
                          disabled={!ziel}
                          onClick={() => {
                            if (!ziel || !ansicht.termin) return;
                            if (n.akteId !== ziel.id) zuordnen(n, ziel, user, ansicht, { leise: true });
                            terminEintragen(n, ziel, user, ansicht.termin);
                            toast("Termin eingetragen", { text: `${fmtDateWd(ansicht.termin.datum)}${ansicht.termin.uhrzeit ? `, ${ansicht.termin.uhrzeit} Uhr` : ""} · ${ziel.aktenzeichen}`, ton: "erfolg" });
                          }}
                        >
                          Termin eintragen
                        </Button>
                      )}
                    </div>
                  </Abschnitt>
                )}

                {/* eEB */}
                {ansicht.eeb && (
                  <Abschnitt titel="Empfangsbekenntnis" icon={<ShieldCheck />} delay={0.16}>
                    {n.eebAbgegeben ? (
                      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 520, damping: 30 }} className="flex items-center gap-3 rounded-[18px] bg-green-soft p-4">
                        <motion.span initial={{ rotate: -20, scale: 0.5 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }} className="grid size-10 shrink-0 place-items-center rounded-full bg-green text-[var(--surface)]">
                          <ShieldCheck className="size-5" />
                        </motion.span>
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-semibold text-green">eEB abgegeben</div>
                          <div className="num text-[12px] text-fg-2">
                            am {fmtDate(n.eebAbgegeben.slice(0, 10))}, {fmtTime(n.eebAbgegeben)} Uhr{ansicht.fristen.length ? " – nachdem die Fristen notiert waren." : "."}
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <div className={cn("flex flex-wrap items-center gap-3 rounded-[18px] p-4 ring-1 ring-inset", eebFrei ? "bg-surface/80 ring-[var(--line)]" : "bg-amber-soft ring-transparent")}>
                        <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", eebFrei ? "bg-ink-soft text-ink" : "bg-surface text-amber")}>
                          <ShieldCheck className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1 basis-[220px]">
                          <div className={cn("text-[13.5px] font-semibold", !eebFrei && "text-amber")}>{eebFrei ? "Bereit zur Abgabe" : "Erst Frist notieren, dann eEB"}</div>
                          <div className="text-[12px] leading-relaxed text-fg-2">
                            {eebFrei
                              ? "Alle Fristen stehen im Kalender. Mit dem eEB weisen Sie dem Gericht das Zustellungsdatum nach – den Tag, an dem Sie das Schriftstück empfangsbereit zur Kenntnis genommen haben."
                              : "Das eEB weist das Zustellungsdatum nach – ab diesem Tag läuft die Frist. AnwaltApex gibt die Abgabe erst frei, wenn die Frist notiert ist – Schutz vor Haftungsfällen."}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={eebFrei ? "primary" : "secondary"}
                          icon={<ShieldCheck className="size-4" />}
                          disabled={!eebFrei}
                          onClick={eebKlick}
                          title={eebFrei ? "Elektronisches Empfangsbekenntnis abgeben" : "Erst Frist notieren, dann eEB"}
                        >
                          eEB abgeben
                        </Button>
                      </div>
                    )}
                  </Abschnitt>
                )}

                {/* Aktionen */}
                {ansicht.aktionen.length > 0 && (
                  <Abschnitt titel="Empfohlene nächste Schritte" icon={<ListChecks />} delay={0.18}>
                    <ul className="space-y-2">
                      {ansicht.aktionen.map((a, i) => {
                        const anhangSchritt = /anh(a|ä)ng/i.test(a);
                        const erledigt = anhangSchritt
                          ? anhaengeDa
                          : (/empfangsbekenntnis/i.test(a) && !!n.eebAbgegeben) ||
                            (/frist eintragen/i.test(a) && alleNotiert) ||
                            (/termin in den kalender/i.test(a) && terminDa) ||
                            (/akte anlegen|mandatsaufnahme/i.test(a) && !!n.akteId) ||
                            (/e-akte/i.test(a) && zugeordnet);
                        return (
                          <motion.li key={a} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay: 0.2 + i * 0.05 }} className="flex gap-2.5 text-[13px] leading-relaxed">
                            {erledigt ? <CheckCircle2 className="mt-[3px] size-3.5 shrink-0 text-green" /> : <ArrowRight className="mt-[3px] size-3.5 shrink-0 text-violet" />}
                            <span className="min-w-0 flex-1">
                              <span className={erledigt ? "text-fg-3 line-through decoration-[var(--line-strong)]" : "text-fg-2"}>{a}</span>
                              {anhangSchritt && !erledigt && zugeordnet && anhaenge.length > 0 && (
                                <button type="button" onClick={anhaengeKlick} className="ml-1.5 inline-flex items-center gap-1 rounded-full px-1.5 text-[12.5px] font-medium text-ink hover:underline">
                                  <FolderInput className="size-3.5" />
                                  {anhaenge.length === 1 ? "Jetzt ablegen" : `${anhaenge.length} Anhänge jetzt ablegen`}
                                </button>
                              )}
                            </span>
                          </motion.li>
                        );
                      })}
                    </ul>
                  </Abschnitt>
                )}

                {/* Abschluss */}
                <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-4">
                  {n.status !== "erledigt" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<CheckCircle2 className="size-4" />}
                      onClick={() => {
                        alsErledigt(n, user);
                        toast("Als erledigt markiert", { ton: "erfolg", aktion: { label: "Rückgängig", onClick: () => alsErledigt(n, user, false) } });
                      }}
                    >
                      Als erledigt markieren
                    </Button>
                  ) : (
                    <Chip tone="green" icon={<CheckCircle2 className="size-3" />}>
                      Erledigt
                    </Chip>
                  )}
                  <span className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] text-fg-3">
                    <ShieldCheck className="size-3.5 text-green" />
                    Die KI erkennt – berechnet wird mit dem geprüften Fristenrechner.
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
