import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BadgeCheck, Check, Infinity as InfinityIcon, Minus, Server, Wrench } from "lucide-react";
import { Button } from "@/components/ui";
import { ESCROW_HINWEIS, LIZENZ_KENNZEICHNUNG, PREIS_HINWEIS, UEBERTRAGBARKEIT_HINWEIS, WARTUNG_HINWEIS, WARTUNG_INHALT } from "@/content/lizenz";
import { BEWEGUNG } from "@/lib/bewegung";
import { Abschnitt, Kopf, Leise } from "./basis";
import { useAnfrage } from "./Anfrage";

// Schematische Kurven (ohne Zahlen): kumulierte Kosten über fünf Jahre
const abo = (t: number) => 0.15 + 1.0 * t + 0.1 * t * t;
const LIFETIME = 2.6;
/** Wartung im Schema: gleichmäßige jährliche Steigung – rein schematisch, Umfang und Preis regelt das Angebot. */
const WARTUNG_JAHR = 0.39;
const lifetimeWartung = (t: number) => LIFETIME + WARTUNG_JAHR * Math.max(0, t);
const MAX_Y = 8.2;
/** Geometrie in echten Pixeln der Containerbreite – Schrift bleibt auf jedem Gerät lesbar. */
function geometrie(W: number) {
  const schmal = W < 460;
  const H = schmal ? 250 : 300;
  const P = schmal ? { l: 24, r: 88, t: 20, b: 36 } : { l: 28, r: 112, t: 24, b: 40 };
  const x = (t: number) => P.l + (t / 5) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - (v / MAX_Y) * (H - P.t - P.b);
  return { W, H, P, x, y, schmal };
}
/** Ausgleichspunkt inkl. Wartung: abo(t) = LIFETIME + w·t → 0,1t² + (1 − w)t + 0,15 − LIFETIME = 0 */
const break_even = (() => {
  const a = 0.1,
    b = 1 - WARTUNG_JAHR,
    c = 0.15 - LIFETIME;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
})();

const TOOLTIP: Record<number, { abo: string; apex: string; wartung: string }> = {
  0: { abo: "Einrichtung und erste Monatsgebühr", apex: "Einmalige Investition nach Kanzleigröße", wartung: "Wartung optional – Umfang und Preis laut Angebot" },
  1: { abo: "Zwölf Monatsgebühren bezahlt", apex: "Keine laufenden Lizenzgebühren", wartung: "Mit Wartung: jährlicher Betrag laut Angebot" },
  2: { abo: "Gebühren laufen weiter – Preiserhöhung möglich", apex: "Ohne Wartung: keine weiteren Kosten", wartung: "Mit Wartung: jährlicher Betrag laut Angebot" },
  3: { abo: "Kosten steigen weiter", apex: "Software und Daten bleiben nutzbar", wartung: "Investition inkl. Wartung ist ausgeglichen" },
  4: { abo: "Kosten steigen weiter", apex: "Software gehört weiterhin Ihnen", wartung: "Wartung bleibt optional – Sie entscheiden jedes Jahr" },
  5: { abo: "Nach fünf Jahren: höchste Gesamtkosten", apex: "Keine Abo-Falle, keine Anbieterbindung", wartung: "Auch mit Wartung deutlich unter dem Abo" },
};

const PUNKTE = [
  { i: <InfinityIcon className="size-4" />, t: "Lifetime-Lizenz", s: "Kauflizenz ohne Laufzeit, ohne Monatsgebühren" },
  { i: <Server className="size-4" />, t: "Ihr Betrieb, Ihre Wahl", s: "Eigener Server in der Kanzlei oder deutsches Rechenzentrum" },
  { i: <Wrench className="size-4" />, t: "Wartung optional", s: "Umfang und Preis regelt das Angebot" },
  { i: <BadgeCheck className="size-4" />, t: "Keine Anbieterbindung", s: "Ihre Daten bleiben exportierbar" },
];

/**
 * Lifetime (DESIGN-SYSTEM.md 14.7): Text und vier Punkte links, die schematische Kostenkurve rechts (Diagramm nach 12.15:
 * Abo in Linie stark, Apex in Akzent, nur waagerechtes Gitter). Darunter der Preisblock – Rand 1 px, Radius 12, ein Primärknopf –
 * mit Wartung, Übertragbarkeit und Escrow im Wortlaut aus src/content/lizenz.ts.
 */
export function Lifetime() {
  const nav = useNavigate();
  return (
    <Abschnitt id="lifetime" labelledBy="lifetime-titel">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16">
        <div className="min-w-0">
          <Kopf
            id="lifetime-titel"
            className="!mb-10"
            eyebrow="Lifetime statt Abo"
            titel={
              <>
                Einmal investieren.
                <br /> <Leise>Für immer nutzen.</Leise>
              </>
            }
            text="Klassische Kanzleisoftware kostet jeden Monat – und wird mit jeder Preiserhöhung teurer. Apex kaufen Sie einmal; die Wartung ist optional, Umfang und Preis regelt das Angebot. Danach arbeitet die Software für Sie, nicht Ihre Kanzlei für die Software."
          />
          <ul className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
            {PUNKTE.map((x) => (
              <li key={x.t} className="flex items-start gap-3 border-t border-[var(--line)] pt-4">
                <span className="mt-0.5 shrink-0 text-fg-3" aria-hidden>
                  {x.i}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold leading-[22px] text-fg">{x.t}</span>
                  <span className="block text-[14px] leading-5 text-fg-3">{x.s}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <KostenKurve />
      </div>

      {/* Preisblock: ein Block, ein Primärknopf */}
      <div className="mt-16 rounded-xl border border-[var(--line)] p-6 sm:p-8 lg:mt-20">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="min-w-0 max-w-[640px] flex-1 basis-[300px]">
            <h3 className="text-[20px] font-semibold leading-7 tracking-[-0.015em] text-fg">Einmalige Investition nach Kanzleigröße</h3>
            <p className="mt-1 text-[15px] font-medium leading-6 text-fg-2">{PREIS_HINWEIS}.</p>
            <p className="mt-1 text-[14px] leading-[22px] text-fg-3">Ihre Ansprechpartnerin meldet sich im Echtbetrieb innerhalb eines Werktags mit Ihrem Angebot.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="lg" onClick={() => useAnfrage.getState().oeffne("angebot")}>
              Angebot anfordern
            </Button>
            <Button variant="secondary" size="lg" iconRight={<ArrowRight className="size-4" />} onClick={() => nav("/login")}>
              Demo starten
            </Button>
          </div>
        </div>
        <Wartung />
      </div>
    </Abschnitt>
  );
}

function KostenKurve() {
  const [jahr, setJahr] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [breite, setBreite] = useState(560);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBreite(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { W, H, P, x, y, schmal } = geometrie(breite);
  const pfadAbo = Array.from({ length: 51 }, (_, i) => i / 10)
    .map((t, i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(abo(t)).toFixed(1)}`)
    .join(" ");
  const pfadApex = `M${x(0)},${y(0)} L${x(0)},${y(LIFETIME)} L${x(5)},${y(LIFETIME)}`;
  const pfadWartung = `M${x(1)},${y(LIFETIME)} L${x(5)},${y(lifetimeWartung(5))}`;
  // Vorteil gegenüber dem Abo – konservativ gerechnet inkl. Wartung
  const vorteil =
    Array.from({ length: 31 }, (_, i) => break_even + ((5 - break_even) * i) / 30)
      .map((t, i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(abo(t)).toFixed(1)}`)
      .join(" ") + ` L${x(5)},${y(lifetimeWartung(5))} L${x(break_even)},${y(lifetimeWartung(break_even))} Z`;

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const t = Math.round(((px - P.l) / (W - P.l - P.r)) * 5);
    setJahr(Math.max(0, Math.min(5, t)));
  };
  const tip = jahr !== null ? TOOLTIP[jahr] : null;
  // Waagerechtes Gitter: vier Linien, Grundlinie in Linie stark
  const gitter = [2, 4, 6, 8].map((v) => y(v));

  return (
    <figure className="min-w-0">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="title-md mr-auto">Kosten über fünf Jahre</span>
        <span className="flex items-center gap-1.5 text-[12px] text-fg-3">
          <span className="h-[2px] w-4 bg-[var(--chart-2)]" aria-hidden /> Abo-Modell
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-fg-3">
          <span className="h-[2px] w-4 bg-[var(--chart-1)]" aria-hidden /> Lifetime ohne Wartung
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-fg-3">
          <svg width="16" height="2" aria-hidden>
            <line x1="0" y1="1" x2="16" y2="1" stroke="var(--chart-1)" strokeWidth="2" strokeDasharray="4 3" />
          </svg>{" "}
          Lifetime inkl. Wartung
        </span>
        <span className="chip chip-outline">schematisch</span>
      </figcaption>
      <div ref={box} className="relative mt-4 w-full min-w-0">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block touch-none select-none"
          width={W}
          height={H}
          role="img"
          aria-label="Schematischer Vergleich über fünf Jahre ohne Preisangaben: Die kumulierten Kosten eines Abo-Modells steigen Jahr für Jahr. Die Lifetime-Lizenz ohne Wartung bleibt nach der einmaligen Investition flach; mit Wartung (Umfang und Preis laut Angebot) steigt sie im Schema leicht und bleibt unter dem Abo."
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setJahr(null)}
        >
          {gitter.map((gy) => (
            <line key={gy} x1={P.l} x2={W - P.r} y1={gy} y2={gy} stroke="var(--chart-grid)" strokeWidth={1} />
          ))}
          <line x1={P.l} x2={W - P.r} y1={H - P.b} y2={H - P.b} stroke="var(--line-strong)" strokeWidth={1} />
          {[0, 1, 2, 3, 4, 5].map((t) => (
            <text key={t} x={x(t)} y={H - P.b + 22} textAnchor="middle" fontSize={12} fill="var(--fg-4)">
              {t === 0 ? "Start" : schmal ? `${t} J.` : `Jahr ${t}`}
            </text>
          ))}
          <text x={P.l - 14} y={P.t + 4} fontSize={12} fill="var(--fg-4)" transform={`rotate(-90 ${P.l - 14} ${P.t + 4})`} textAnchor="end">
            Kosten, kumuliert
          </text>

          {/* Vorteil – neutrale Fläche, keine Signalfarbe */}
          <path d={vorteil} fill="var(--surface-3)" />
          <text x={x(3.9)} y={(y(abo(3.9)) + y(lifetimeWartung(3.9))) / 2 + 4} textAnchor="middle" fontSize={12} fontWeight={500} fill="var(--fg-2)">
            Ihr Vorteil
          </text>

          {/* Linien */}
          <path d={pfadAbo} fill="none" stroke="var(--chart-2)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <path d={pfadApex} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinejoin="round" />
          <path d={pfadWartung} fill="none" stroke="var(--chart-1)" strokeWidth={1.5} strokeDasharray="5 4" />

          {/* Ausgleichspunkt (inkl. Wartung) */}
          <circle cx={x(break_even)} cy={y(lifetimeWartung(break_even))} r={4} fill="var(--bg)" stroke="var(--chart-1)" strokeWidth={1.5} />
          <text x={x(break_even) + 8} y={y(LIFETIME) + 22} textAnchor="start" fontSize={12} fill="var(--fg-2)" fontWeight={500}>
            Ausgeglichen inkl. Wartung
          </text>

          {/* Direktbeschriftung an den Linienenden */}
          <circle cx={x(5)} cy={y(abo(5))} r={3} fill="var(--chart-2)" />
          <text x={x(5) + 10} y={y(abo(5)) + 4} fontSize={12} fontWeight={500} fill="var(--fg-2)">
            Abo-Modell
          </text>
          <circle cx={x(5)} cy={y(lifetimeWartung(5))} r={3} fill="var(--chart-1)" />
          <text x={x(5) + 10} y={y(lifetimeWartung(5)) + 4} fontSize={12} fontWeight={500} fill="var(--fg)">
            mit Wartung
          </text>
          <circle cx={x(5)} cy={y(LIFETIME)} r={3} fill="var(--chart-1)" />
          <text x={x(5) + 10} y={y(LIFETIME) + 8} fontSize={12} fontWeight={500} fill="var(--fg)">
            ohne Wartung
          </text>

          {/* Fadenkreuz */}
          {jahr !== null && (
            <g pointerEvents="none">
              <line x1={x(jahr)} x2={x(jahr)} y1={P.t} y2={H - P.b} stroke="var(--fg-4)" strokeWidth={1} />
              <circle cx={x(jahr)} cy={y(abo(jahr))} r={4} fill="var(--chart-2)" stroke="var(--bg)" strokeWidth={2} />
              <circle cx={x(jahr)} cy={y(LIFETIME)} r={4} fill="var(--chart-1)" stroke="var(--bg)" strokeWidth={2} />
              <circle cx={x(jahr)} cy={y(lifetimeWartung(jahr))} r={3.5} fill="var(--bg)" stroke="var(--chart-1)" strokeWidth={1.5} />
            </g>
          )}
          {/* große Trefferfläche */}
          <rect x={P.l} y={P.t} width={W - P.l - P.r} height={H - P.t - P.b} fill="transparent" />
        </svg>
        <AnimatePresence>
          {tip && jahr !== null && (
            <motion.div
              key="tip"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, left: `${(x(jahr) / W) * 100}%` }}
              exit={{ opacity: 0 }}
              transition={BEWEGUNG.standard}
              className="pointer-events-none absolute top-0 z-10 w-[230px] -translate-x-1/2 rounded-lg border border-[var(--line)] bg-[var(--surface-pop)] p-3 text-[12px] leading-[18px] shadow-[var(--shadow-pop)]"
              style={{ marginLeft: jahr <= 1 ? 90 : jahr >= 4 ? -60 : 0 }}
            >
              <div className="mb-1.5 font-medium text-fg-3">{jahr === 0 ? "Start" : `Jahr ${jahr}`}</div>
              <div className="flex gap-2">
                <span className="mt-2 h-[2px] w-3 shrink-0 bg-[var(--chart-2)]" />
                <span className="text-fg-2">{tip.abo}</span>
              </div>
              <div className="mt-1 flex gap-2">
                <span className="mt-2 h-[2px] w-3 shrink-0 bg-[var(--chart-1)]" />
                <span className="font-medium text-fg">{tip.apex}</span>
              </div>
              <div className="mt-1 flex gap-2">
                <span className="mt-2 h-0 w-3 shrink-0 border-t-2 border-dashed border-[var(--chart-1)]" />
                <span className="text-fg-2">{tip.wartung}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="mt-3 text-[13px] leading-5 text-fg-3">
        Schematische Darstellung ohne Preisangaben. „Lifetime inkl. Wartung“: jährliche Wartung laut Angebot. Der tatsächliche Verlauf hängt von Kanzleigröße, Modulen und dem bisherigen Abo ab. {PREIS_HINWEIS}.
      </p>
    </figure>
  );
}

/** Wartung, Folgen ohne Wartung, Übertragbarkeit und Escrow – derselbe Wortlaut wie im Lizenz-Tab (src/content/lizenz.ts). */
function Wartung() {
  return (
    <div className="mt-8 border-t border-[var(--line)] pt-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="title-md">{WARTUNG_INHALT.titel}</h3>
        <span className="text-[13px] text-fg-3">{WARTUNG_HINWEIS}.</span>
      </div>
      <div className="mt-4 grid gap-6 sm:grid-cols-2 sm:gap-10">
        <ul className="grid content-start gap-2 text-[14px] leading-5 text-fg-2" aria-label="Umfang der Wartung">
          {WARTUNG_INHALT.enthalten.map((x) => (
            <li key={x} className="flex gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-fg" aria-hidden />
              {x}
            </li>
          ))}
        </ul>
        <ul className="grid content-start gap-2 text-[14px] leading-5 text-fg-2" aria-label="Ohne Wartung">
          {WARTUNG_INHALT.ohne.map((x, i) => (
            <li key={x} className="flex gap-2.5">
              {i === 0 ? <Check className="mt-0.5 size-4 shrink-0 text-fg" aria-hidden /> : <Minus className="mt-0.5 size-4 shrink-0 text-fg-4" aria-hidden />}
              <span>
                {i === 0 && <span className="font-semibold text-fg">Ohne Wartung: </span>}
                {x}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-6 text-[13px] leading-5 text-fg-3">
        {UEBERTRAGBARKEIT_HINWEIS}. {ESCROW_HINWEIS}. {LIZENZ_KENNZEICHNUNG}.
      </p>
    </div>
  );
}
