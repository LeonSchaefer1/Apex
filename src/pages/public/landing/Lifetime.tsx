import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BadgeCheck, Clock3, Infinity as InfinityIcon, Server, Wrench } from "lucide-react";
import { Button } from "@/components/ui";
import { Abschnitt, Kopf, Reveal } from "./basis";

// Schematische Kurven (ohne Zahlen): kumulierte Kosten über fünf Jahre
const abo = (t: number) => 0.15 + 1.0 * t + 0.1 * t * t;
const LIFETIME = 2.6;
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
const break_even = (() => {
  // abo(t) = LIFETIME → 0.1t² + t + 0.15 − 2.6 = 0
  const a = 0.1, b = 1, c = 0.15 - LIFETIME;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
})();

const TOOLTIP: Record<number, { abo: string; apex: string }> = {
  0: { abo: "Einrichtung und erste Monatsgebühr", apex: "Einmalige Investition nach Kanzleigröße" },
  1: { abo: "Zwölf Monatsgebühren bezahlt", apex: "Keine laufenden Lizenzgebühren" },
  2: { abo: "Gebühren laufen weiter – Preiserhöhung möglich", apex: "Investition ist ausgeglichen" },
  3: { abo: "Kosten steigen weiter", apex: "Sie sparen jeden Monat" },
  4: { abo: "Kosten steigen weiter", apex: "Software gehört weiterhin Ihnen" },
  5: { abo: "Nach fünf Jahren: höchste Gesamtkosten", apex: "Keine Abo-Falle, keine Anbieterbindung" },
};

export function Lifetime() {
  const nav = useNavigate();
  return (
    <Abschnitt id="lifetime">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-14">
        <div>
          <Kopf
            className="!mb-8"
            eyebrow="Lifetime statt Abo"
            titel={
              <>
                Einmal investieren.
                <br /> <span className="text-fg-3">Für immer nutzen.</span>
              </>
            }
            text="Klassische Kanzleisoftware kostet jeden Monat – und wird mit jeder Preiserhöhung teurer. AnwaltApex kaufen Sie einmal. Danach arbeitet die Software für Sie, nicht Ihre Kanzlei für die Software."
          />
          <Reveal>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { i: <InfinityIcon className="size-4" />, t: "Lifetime-Lizenz", s: "Unbefristet nutzen, ohne Monatsgebühren" },
                { i: <Server className="size-4" />, t: "Ihr Betrieb, Ihre Wahl", s: "On-Premise oder Private Cloud in Deutschland" },
                { i: <Wrench className="size-4" />, t: "Wartung transparent", s: "Optional und klar geregelt" },
                { i: <BadgeCheck className="size-4" />, t: "Keine Anbieterbindung", s: "Ihre Daten bleiben exportierbar" },
              ].map((x) => (
                <li key={x.t} className="glass-thin flex items-start gap-3 rounded-[18px] p-3.5">
                  <span className="relative z-[2] grid size-8 shrink-0 place-items-center rounded-[10px] bg-ink-soft text-ink">{x.i}</span>
                  <span className="relative z-[2]">
                    <span className="block text-[13.5px] font-semibold">{x.t}</span>
                    <span className="block text-[12px] text-fg-3">{x.s}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="sheet mt-5 flex flex-wrap items-center gap-4 rounded-[22px] p-4 sm:p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-green-soft text-green">
                <Clock3 className="size-5" />
              </span>
              <div className="min-w-0 flex-1 basis-[220px]">
                <div className="text-[15px] font-semibold tracking-[-0.01em]">Einmalige Investition nach Kanzleigröße</div>
                <div className="text-[13px] text-fg-3">Ihr persönliches Angebot erhalten Sie innerhalb von 24 Stunden.</div>
              </div>
              <Button variant="primary" iconRight={<ArrowRight className="size-4" />} onClick={() => nav("/login")}>
                Demo starten
              </Button>
            </div>
          </Reveal>
        </div>
        <Reveal delay={0.08} className="min-w-0">
          <KostenKurve />
        </Reveal>
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
  const vorteil =
    Array.from({ length: 31 }, (_, i) => break_even + ((5 - break_even) * i) / 30)
      .map((t, i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(abo(t)).toFixed(1)}`)
      .join(" ") + ` L${x(5)},${y(LIFETIME)} L${x(break_even)},${y(LIFETIME)} Z`;

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const t = Math.round(((px - P.l) / (W - P.l - P.r)) * 5);
    setJahr(Math.max(0, Math.min(5, t)));
  };
  const tip = jahr !== null ? TOOLTIP[jahr] : null;

  return (
    <figure className="sheet relative overflow-hidden rounded-[28px] p-5 sm:p-6">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="title-md mr-auto">Kosten über fünf Jahre</span>
        <span className="flex items-center gap-1.5 text-[12px] text-fg-2">
          <span className="h-[2px] w-4 rounded-full bg-fg-3" /> Abo-Modell
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-fg-2">
          <span className="h-[2px] w-4 rounded-full bg-ink" /> AnwaltApex Lifetime
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
          aria-label="Schematischer Vergleich: Die kumulierten Kosten eines Abo-Modells steigen Jahr für Jahr, die Lifetime-Lizenz bleibt nach der einmaligen Investition flach."
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setJahr(null)}
        >
          {/* Raster */}
          {[0, 1, 2, 3, 4, 5].map((t) => (
            <line key={t} x1={x(t)} x2={x(t)} y1={P.t} y2={H - P.b} stroke="var(--line)" strokeWidth={1} />
          ))}
          <line x1={P.l} x2={W - P.r} y1={H - P.b} y2={H - P.b} stroke="var(--line-strong)" strokeWidth={1} />
          {[0, 1, 2, 3, 4, 5].map((t) => (
            <text key={t} x={x(t)} y={H - P.b + 22} textAnchor="middle" fontSize={12} fill="var(--fg-3)">
              {t === 0 ? "Start" : schmal ? `${t} J.` : `Jahr ${t}`}
            </text>
          ))}
          <text x={P.l - 14} y={P.t + 4} fontSize={11} fill="var(--fg-4)" transform={`rotate(-90 ${P.l - 14} ${P.t + 4})`} textAnchor="end">
            Kosten, kumuliert
          </text>

          {/* Vorteil */}
          <path d={vorteil} fill="var(--green-soft)" />
          <text x={x(3.9)} y={(y(abo(3.9)) + y(LIFETIME)) / 2 + 4} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--green)">
            Ihr Vorteil
          </text>

          {/* Linien */}
          <path d={pfadAbo} fill="none" stroke="var(--fg-3)" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
          <path d={pfadApex} fill="none" stroke="var(--ink)" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" />

          {/* Ausgleichspunkt */}
          <circle cx={x(break_even)} cy={y(LIFETIME)} r={5} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2} />
          <motion.circle cx={x(break_even)} cy={y(LIFETIME)} r={5} fill="none" stroke="var(--ink)" strokeWidth={1.5} initial={{ r: 5, opacity: 0.6 }} animate={{ r: [5, 14], opacity: [0.6, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }} />
          <text x={x(break_even) + 10} y={y(LIFETIME) + 20} textAnchor="start" fontSize={11.5} fill="var(--fg-2)" fontWeight={600}>
            Investition ausgeglichen
          </text>

          {/* Direktbeschriftung an den Linienenden */}
          <circle cx={x(5)} cy={y(abo(5))} r={4} fill="var(--fg-3)" stroke="var(--surface)" strokeWidth={2} />
          <text x={x(5) + 10} y={y(abo(5)) + 4} fontSize={12.5} fontWeight={600} fill="var(--fg-2)">
            Abo-Modell
          </text>
          <circle cx={x(5)} cy={y(LIFETIME)} r={4} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
          <text x={x(5) + 10} y={y(LIFETIME) + 4} fontSize={12.5} fontWeight={600} fill="var(--fg)">
            Lifetime
          </text>

          {/* Fadenkreuz */}
          {jahr !== null && (
            <g pointerEvents="none">
              <line x1={x(jahr)} x2={x(jahr)} y1={P.t} y2={H - P.b} stroke="var(--fg-4)" strokeWidth={1} />
              <circle cx={x(jahr)} cy={y(abo(jahr))} r={5} fill="var(--fg-3)" stroke="var(--surface)" strokeWidth={2} />
              <circle cx={x(jahr)} cy={y(LIFETIME)} r={5} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
          {/* große Trefferfläche */}
          <rect x={P.l} y={P.t} width={W - P.l - P.r} height={H - P.t - P.b} fill="transparent" />
        </svg>
        <AnimatePresence>
          {tip && jahr !== null && (
            <motion.div
              key="tip"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0, left: `${(x(jahr) / W) * 100}%` }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 38 }}
              className="glass-strong pointer-events-none absolute top-0 z-10 w-[220px] -translate-x-1/2 rounded-[14px] p-3 text-[12px]"
              style={{ marginLeft: jahr <= 1 ? 90 : jahr >= 4 ? -60 : 0 }}
            >
              <div className="relative z-[2] mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-3">{jahr === 0 ? "Start" : `Jahr ${jahr}`}</div>
              <div className="relative z-[2] flex gap-2">
                <span className="mt-1.5 h-[2px] w-3 shrink-0 rounded-full bg-fg-3" />
                <span className="text-fg-2">{tip.abo}</span>
              </div>
              <div className="relative z-[2] mt-1 flex gap-2">
                <span className="mt-1.5 h-[2px] w-3 shrink-0 rounded-full bg-ink" />
                <span className="font-medium text-fg">{tip.apex}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-fg-4">Schematische Darstellung ohne Preisangaben. Der tatsächliche Verlauf hängt von Kanzleigröße, Modulen und dem bisherigen Abo ab.</p>
    </figure>
  );
}
