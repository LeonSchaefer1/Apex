import { motion } from "motion/react";
import { Check, FileText, Folder, Mail, Search, Sparkles, X, ShieldCheck, Infinity as InfinityIcon, Zap, Landmark, Receipt, ArrowRight } from "lucide-react";
import type { WikiVisual } from "@/content/wiki";
import { LogoMark } from "@/components/Logo";
import { fmtEUR } from "@/core/dates";
import { berechneRvg } from "@/core/rvg";

const spring = { type: "spring" as const, stiffness: 260, damping: 22 };
const loop = { repeat: Infinity, repeatDelay: 1.6 };

function Mini({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`glass-strong rounded-[14px] px-3 py-2 text-[12px] font-medium text-fg ${className}`}>{children}</div>;
}

export function WikiVisualScene({ visual }: { visual: WikiVisual }) {
  switch (visual) {
    case "frist":
    case "vieraugen":
      return <FristScene vier={visual === "vieraugen"} />;
    case "rechner":
      return <RechnerScene />;
    case "posteingang":
    case "eeb":
      return <PostScene eeb={visual === "eeb"} />;
    case "ki":
    case "assistent":
      return <OrbScene />;
    case "suche":
      return <SucheScene />;
    case "motor":
    case "cockpit":
      return <MotorScene />;
    case "rvg":
      return <RvgScene />;
    case "bank":
      return <BankScene />;
    case "umzug":
      return <UmzugScene />;
    case "akte":
      return <AkteScene />;
    default:
      return <StatusScene />;
  }
}

function FristScene({ vier }: { vier: boolean }) {
  const tage = ["Fr", "Sa", "So", "Mo"];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <div className="flex gap-2.5">
        {tage.map((t, k) => (
          <motion.div
            key={t}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: k * 0.08, ...spring }}
            className={`grid h-16 w-14 place-items-center rounded-[14px] text-[13px] font-semibold ${k === 1 || k === 2 ? "bg-seal-soft text-seal" : "glass-strong"}`}
          >
            <div className="text-center leading-tight">
              <div className="text-[10px] font-medium opacity-70">{t}</div>
              <div className="num text-[17px]">{14 + k}</div>
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div
        className="relative h-1.5 w-[248px] rounded-full bg-[var(--line)]"
        initial={false}
      >
        <motion.div
          className="absolute -top-[9px] grid size-6 place-items-center rounded-full bg-ink text-white shadow-lg"
          animate={{ left: ["0%", "28%", "28%", "92%"], backgroundColor: ["var(--ink)", "var(--seal)", "var(--seal)", "var(--green)"] }}
          transition={{ duration: 3.2, times: [0, 0.3, 0.55, 1], ease: "easeInOut", ...loop }}
        >
          <motion.span animate={{ opacity: [1, 1, 0, 0] }} transition={{ duration: 3.2, times: [0, 0.5, 0.6, 1], ...loop }} className="absolute">
            <X className="size-3.5" />
          </motion.span>
          <motion.span animate={{ opacity: [0, 0, 1, 1] }} transition={{ duration: 3.2, times: [0, 0.6, 0.7, 1], ...loop }} className="absolute">
            <Check className="size-3.5" />
          </motion.span>
        </motion.div>
      </motion.div>
      <div className="flex items-center gap-2 text-[12px] text-fg-3">
        {vier ? (
          <>
            <span className="grid size-6 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">JH</span>
            <ArrowRight className="size-3.5" />
            <span className="grid size-6 place-items-center rounded-full bg-[#C2410C] text-[10px] font-bold text-white">MB</span>
            <span className="chip chip-green"><Check className="size-3" /> kontrolliert</span>
          </>
        ) : (
          <span className="chip chip-ink">§ 222 Abs. 2 ZPO → nächster Werktag</span>
        )}
      </div>
    </div>
  );
}

function RechnerScene() {
  return (
    <div className="flex h-full items-center justify-center gap-4 px-4">
      <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={spring}>
        <Mini>
          <div className="text-[10px] text-fg-3">Zustellung</div>
          <div className="num text-[16px]">16.10.2026</div>
        </Mini>
      </motion.div>
      <motion.div animate={{ x: [0, 6, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
        <ArrowRight className="size-5 text-ink" />
      </motion.div>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5, ...spring }}>
        <Mini className="ring-2 ring-[var(--ink)]">
          <div className="text-[10px] text-fg-3">Berufungsfrist · § 517 ZPO</div>
          <div className="num text-[16px] text-ink">Mo, 16.11.2026</div>
          <div className="text-[10px] text-fg-3">Vorfrist: Mo, 09.11.</div>
        </Mini>
      </motion.div>
    </div>
  );
}

function PostScene({ eeb }: { eeb: boolean }) {
  return (
    <div className="relative flex h-full items-center justify-center gap-8">
      <div className="relative h-24 w-24">
        {[0, 1, 2].map((k) => (
          <motion.div
            key={k}
            className="absolute left-0 top-6"
            animate={{ x: [0, 120, 120], y: [k * 6, 0, 0], opacity: [0, 1, 0], scale: [1, 1, 0.6] }}
            transition={{ duration: 2.4, delay: k * 0.7, repeat: Infinity, repeatDelay: 0.6 }}
          >
            <Mini className="flex items-center gap-1.5 !py-1.5">
              <Mail className="size-3.5 text-ink" /> {k === 0 ? "beA" : "E-Mail"}
            </Mini>
          </motion.div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-2">
        <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 0.7, repeat: Infinity, repeatDelay: 1.7 }} className="grid size-16 place-items-center rounded-[18px] bg-ink-soft text-ink">
          <Folder className="size-8" />
        </motion.div>
        <span className="mono text-[12px] font-semibold">Akte 142/26</span>
        {eeb ? <span className="chip chip-green"><ShieldCheck className="size-3" /> eEB abgegeben</span> : <span className="chip ai-ring !bg-transparent"><span className="ai-text font-semibold">KI: Frist erkannt</span></span>}
      </div>
    </div>
  );
}

function OrbScene() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <motion.div
        className="ai-fill size-20 rounded-full"
        style={{ boxShadow: "0 0 50px -6px var(--ai-2)" }}
        animate={{ scale: [1, 1.08, 0.98, 1.05, 1], borderRadius: ["50%", "46% 54% 50% 50%", "52% 48% 46% 54%", "50%"] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      <div className="flex h-6 items-end gap-1">
        {Array.from({ length: 14 }).map((_, k) => (
          <motion.span key={k} className="w-1 rounded-full bg-ink" animate={{ height: [4, 8 + ((k * 7) % 18), 4] }} transition={{ duration: 0.8, delay: k * 0.05, repeat: Infinity }} />
        ))}
      </div>
      <Mini className="flex items-center gap-1.5"><Sparkles className="size-3.5 text-violet" /> „Welche Fristen laufen diese Woche ab?“</Mini>
    </div>
  );
}

function SucheScene() {
  const text = "kündigung pfandbon";
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
      <div className="glass-strong flex w-full max-w-[320px] items-center gap-2 rounded-full px-3.5 py-2 text-[13px]">
        <Search className="size-4 text-fg-3" />
        <span className="overflow-hidden whitespace-nowrap">
          {text.split("").map((c, k) => (
            <motion.span key={k} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 * k }}>
              {c}
            </motion.span>
          ))}
        </span>
        <span className="ml-auto text-[10px] text-fg-4">4 ms</span>
      </div>
      {["BAG 2 AZR 541/09 · „Emmely“", "BAG 2 AZR 133/18 · Videoaufzeichnung", "Akte 142/26 · Weber ./. Kröger"].map((r, k) => (
        <motion.div key={r} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 + k * 0.15 }} className="w-full max-w-[320px]">
          <Mini className="flex items-center gap-2"><FileText className="size-3.5 text-ink" />{r}</Mini>
        </motion.div>
      ))}
    </div>
  );
}

function MotorScene() {
  return (
    <div className="flex h-full items-center justify-center gap-6">
      <div className="relative grid size-28 place-items-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
          <circle cx="50" cy="50" r="42" stroke="var(--line)" strokeWidth="8" fill="none" />
          <motion.circle cx="50" cy="50" r="42" stroke="var(--green)" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray="264" animate={{ strokeDashoffset: [264, 26] }} transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1], ...loop }} />
        </svg>
        <div className="text-center">
          <div className="num text-[22px] font-bold">38 h</div>
          <div className="text-[10px] text-fg-3">pro Woche</div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {["Frist erkannt", "Vollmacht erstellt", "Zahlung gebucht"].map((t, k) => (
          <motion.div key={t} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + k * 0.4 }}>
            <Mini className="flex items-center gap-1.5"><Zap className="size-3.5 text-amber" /> {t}</Mini>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Beispiel aus dem Rechner: 10.000 €, 2300 + 3100 mit Anrechnung – Pauschale 7002 je Angelegenheit.
const RVG_BEISPIEL = berechneRvg({ positionen: [{ nr: "2300" }, { nr: "3100" }], gegenstandswert: 10_000 });

function RvgScene() {
  const satz = (n: number) => Math.abs(n).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  const rows = RVG_BEISPIEL.angelegenheiten.flatMap((a) => [
    ...a.zeilen.map((z) => [z.anrechnung ? `Anrechnung ${satz(z.satz)}` : `${z.nr} ${z.titel.replace(/ \(.*\)$/, "")} ${satz(z.satz)}`, fmtEUR(z.betrag)]),
    [`7002 Pauschale ${a.key === "aussergerichtlich" ? "außergerichtl." : "gerichtl."}`, fmtEUR(a.auslagenpauschale)],
  ]);
  return (
    <div className="flex h-full items-center justify-center">
      <div className="glass-strong w-[290px] rounded-[16px] p-3 text-[11.5px]">
        <div className="mb-2 flex items-center gap-1.5 font-semibold"><Receipt className="size-3.5 text-ink" /> RVG · Gegenstandswert 10.000 €</div>
        {rows.map((r, k) => (
          <motion.div key={r[0]} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + k * 0.25 }} className="flex justify-between border-b border-[var(--line)] py-1">
            <span className="text-fg-2">{r[0]}</span>
            <span className="num">{r[1]}</span>
          </motion.div>
        ))}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} className="mt-1.5 flex justify-between font-semibold">
          <span>Gesamt inkl. USt.</span>
          <span className="num text-ink">{fmtEUR(RVG_BEISPIEL.brutto)}</span>
        </motion.div>
      </div>
    </div>
  );
}

function BankScene() {
  return (
    <div className="relative flex h-full items-center justify-center gap-10">
      <motion.div initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
        <Mini>
          <div className="flex items-center gap-1.5"><Landmark className="size-3.5 text-ink" /> Eingang 1.539,44 €</div>
          <div className="text-[10px] text-fg-3">„RE-2026-0042 AZ 118/26“</div>
        </Mini>
      </motion.div>
      <motion.div className="absolute left-1/2 top-1/2 h-0.5 w-10 -translate-x-1/2 bg-green" initial={{ scaleX: 0 }} animate={{ scaleX: [0, 1, 1] }} transition={{ duration: 1.4, ...loop }} />
      <motion.div initial={{ x: 10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
        <Mini>
          <div className="flex items-center gap-1.5"><Receipt className="size-3.5 text-ink" /> RE-2026-0042</div>
          <motion.div animate={{ opacity: [0, 1] }} transition={{ delay: 1, ...loop, duration: 0.4 }} className="mt-1"><span className="chip chip-green"><Check className="size-3" /> bezahlt · 99 %</span></motion.div>
        </Mini>
      </motion.div>
    </div>
  );
}

function UmzugScene() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-6">
        <Mini className="text-fg-3">Altsystem</Mini>
        <div className="relative h-8 w-28 overflow-hidden">
          {[0, 1, 2, 3].map((k) => (
            <motion.div key={k} className="absolute top-1.5" animate={{ x: [-20, 120] }} transition={{ duration: 1.6, delay: k * 0.4, repeat: Infinity, ease: "easeInOut" }}>
              <FileText className="size-5 text-ink" />
            </motion.div>
          ))}
        </div>
        <div className="glass-strong grid size-12 place-items-center rounded-[14px]"><LogoMark size={28} /></div>
      </div>
      <div className="bar w-64"><motion.span animate={{ width: ["0%", "100%"] }} transition={{ duration: 3, ...loop }} /></div>
      <div className="text-[12px] text-fg-3">Akten · Kontakte · Fristen · Dokumente</div>
    </div>
  );
}

function AkteScene() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="glass-strong w-[290px] rounded-[16px] p-2.5">
        {["Kündigungsschreiben.pdf", "Arbeitsvertrag.pdf", "Gesprächsnotiz.docx"].map((d, k) => (
          <motion.div key={d} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.2 }} className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-[12px]">
            <motion.span animate={{ backgroundColor: ["var(--surface)", "var(--ink)"] }} transition={{ delay: 1 + k * 0.3, duration: 0.2 }} className="grid size-4 place-items-center rounded-[5px] ring-1 ring-[var(--line-strong)]">
              <Check className="size-3 text-white" />
            </motion.span>
            <FileText className="size-3.5 text-fg-3" />
            {d}
          </motion.div>
        ))}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.1 }} className="mt-1 flex gap-1.5 border-t border-[var(--line)] pt-2">
          <span className="chip chip-ink">3 ausgewählt</span>
          <span className="chip">Verschieben</span>
          <span className="chip">Umbenennen</span>
        </motion.div>
      </div>
    </div>
  );
}

function StatusScene() {
  const items = [["beA", "verbunden"], ["E-Mail (Microsoft 365)", "verbunden"], ["Bank (CAMT.053)", "verbunden"], ["KI", "bereit"]];
  return (
    <div className="flex h-full items-center justify-center">
      <div className="glass-strong w-[270px] rounded-[16px] p-3">
        {items.map((it, k) => (
          <motion.div key={it[0]} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: k * 0.15 }} className="flex items-center justify-between py-1.5 text-[12px]">
            <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-green" />{it[0]}</span>
            <span className="text-fg-3">{it[1]}</span>
          </motion.div>
        ))}
        <div className="mt-2 flex items-center gap-1.5 border-t border-[var(--line)] pt-2 text-[11px] text-fg-3"><InfinityIcon className="size-3.5 text-ink" /> Lifetime-Lizenz aktiv</div>
      </div>
    </div>
  );
}
