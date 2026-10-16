import { motion } from "motion/react";
import { ArrowRight, BookCheck, Calculator, CalendarClock, Contact, FileStack, FileText, FolderOpen, Landmark, Lock, ScanSearch, ServerCog, ShieldCheck, UserCheck, Wallet } from "lucide-react";
import { AiChip } from "@/components/ui";
import { AppIcon } from "@/components/Logo";
import { cn } from "@/lib/cn";
import { Abschnitt, Kopf, Reveal } from "./basis";

/** „Umzug in einem Klick" – Band mit fließenden Datenpaketen. */
export function UmzugBand() {
  const pakete = [
    { i: <FolderOpen className="size-3.5" />, t: "Akten" },
    { i: <Contact className="size-3.5" />, t: "Kontakte" },
    { i: <CalendarClock className="size-3.5" />, t: "Fristen" },
    { i: <FileStack className="size-3.5" />, t: "Dokumente" },
    { i: <Wallet className="size-3.5" />, t: "Aktenkonten" },
  ];
  return (
    <section aria-labelledby="umzug-titel" className="px-4 py-6 sm:px-6 md:py-10">
      <Reveal className="glass mx-auto max-w-[1200px] overflow-hidden rounded-[30px] p-6 sm:p-8">
        <div className="relative z-[2] grid items-center gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div>
            <div className="eyebrow mb-3 !text-ink">One-Klick-Migration</div>
            <h2 id="umzug-titel" className="text-[clamp(26px,3.2vw,38px)] font-bold leading-[1.06] tracking-[-0.04em]">
              Umzug in einem Klick.
            </h2>
            <p className="mt-3 max-w-[48ch] text-[15px] leading-relaxed text-fg-2">
              Akten, Kontakte, Fristen und Dokumente ziehen vollständig mit um. Sie sehen vorab eine Vorschau, Dubletten werden erkannt, Fristen nachgerechnet und zur Vier-Augen-Kontrolle vorgelegt. Bei Bedarf laufen beide Systeme parallel.
            </p>
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:gap-5">
            <div className="flex w-[64px] shrink-0 flex-col items-center gap-2 text-center sm:w-[118px]">
              <span className="grid size-12 place-items-center rounded-[16px] bg-[var(--ink-softer)] text-fg-3 shadow-[inset_0_0_0_1px_var(--line-strong)] sm:size-14 sm:rounded-[18px]">
                <FileText className="size-6" />
              </span>
              <span className="text-[11px] leading-tight text-fg-3 sm:text-[11.5px]">
                <span className="sm:hidden">Bisherige Software</span>
                <span className="hidden sm:inline">Ihre bisherige Kanzleisoftware</span>
              </span>
            </div>
            <div className="relative h-[150px] min-w-0 flex-1 overflow-hidden fade-x" aria-hidden>
              <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--line-strong)]" />
              {pakete.map((p, k) => (
                <motion.span
                  key={p.t}
                  className="absolute left-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--surface)] px-2 py-1 text-[11px] font-medium sm:px-2.5 sm:text-[11.5px] text-fg-2 shadow-[0_4px_12px_-6px_rgba(20,30,80,0.3),0_0_0_1px_var(--line)]"
                  style={{ top: `${14 + ((k * 2) % 5) * 26}px` }}
                  initial={{ left: `${k * 20 - 10}%` }}
                  animate={{ left: ["-25%", "100%"] }}
                  transition={{ duration: 7, repeat: Infinity, ease: "linear", delay: -k * 1.4 }}
                >
                  <span className="text-ink">{p.i}</span>
                  {p.t}
                </motion.span>
              ))}
            </div>
            <div className="flex w-[64px] shrink-0 flex-col items-center gap-2 text-center sm:w-[118px]">
              <AppIcon size={52} />
              <span className="text-[11.5px] font-semibold leading-tight">AnwaltApex</span>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

const PRINZIPIEN = [
  { i: <Calculator className="size-5" />, t: "KI erkennt – Rechenkern berechnet", s: "Fristen rät keine KI. Sie erkennt das auslösende Ereignis, der geprüfte Fristenrechner rechnet nach §§ 187 ff. BGB und § 222 ZPO – mit Rechenweg und Feiertagen je Bundesland." },
  { i: <BookCheck className="size-5" />, t: "Nur geprüfte Quellen", s: "Analysen stützen sich auf Entscheidungen mit Gericht, Datum und Aktenzeichen. Jede Aussage ist nachprüfbar – nichts wird erfunden." },
  { i: <ServerCog className="size-5" />, t: "Daten in Deutschland oder On-Premise", s: "Betrieb in deutschen Rechenzentren oder auf Ihrem eigenen Server. Keine externen Schriften, kein Tracking." },
  { i: <Lock className="size-5" />, t: "Verschwiegenheit nach § 203 StGB", s: "Strikte Mandantentrennung auf Datenbankebene, verschlüsselte Übertragung, Rollen und Rechte. Sie behalten die Kontrolle über jede Freigabe." },
];

export function Vertrauen() {
  const schritte = [
    { i: <Landmark className="size-4" />, t: "beA-Zustellung", s: "Urteil geht ein" },
    { i: <ScanSearch className="size-4" />, t: "KI erkennt", s: "Ereignis & Akte", ai: true },
    { i: <Calculator className="size-4" />, t: "Rechenkern", s: "§ 222 ZPO, Feiertage" },
    { i: <UserCheck className="size-4" />, t: "Sie prüfen", s: "Vier-Augen-Prinzip" },
  ];
  return (
    <Abschnitt id="ki">
      <Kopf
        eyebrow="KI, der Sie vertrauen können"
        titel={
          <>
            Die KI schlägt vor.
            <br /> <span className="text-fg-3">Sie entscheiden.</span>
          </>
        }
        text="AnwaltApex setzt KI dort ein, wo sie Zeit spart – und hält sie dort heraus, wo es auf Exaktheit ankommt. Jede KI-Aktion ist klar gekennzeichnet und bleibt ein Vorschlag, bis Sie ihn übernehmen."
      />

      <Reveal className="sheet mb-4 rounded-[28px] p-5 sm:p-7">
        <ol className="grid gap-3 sm:grid-cols-4 sm:gap-2">
          {schritte.map((x, k) => (
            <li key={x.t} className="relative flex items-center gap-3 sm:flex-col sm:text-center">
              <motion.span
                initial={{ scale: 0.85 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 420, damping: 20, delay: k * 0.12 }}
                className={cn("relative z-[1] grid size-12 shrink-0 place-items-center rounded-[16px]", x.ai ? "ai-fill text-white shadow-[0_8px_20px_-8px_var(--ai-2)]" : "bg-ink-soft text-ink")}
              >
                {x.i}
              </motion.span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-[14px] font-semibold sm:justify-center">
                  {x.t}
                  {x.ai && <AiChip className="!h-[18px] !text-[9.5px]" />}
                </span>
                <span className="block text-[12.5px] text-fg-3">{x.s}</span>
              </span>
              {k < schritte.length - 1 && <ArrowRight className="absolute -right-3 top-4 hidden size-4 text-fg-4 sm:block" />}
            </li>
          ))}
        </ol>
      </Reveal>

      <div className="grid gap-4 md:grid-cols-2">
        {PRINZIPIEN.map((p, k) => (
          <Reveal key={p.t} delay={k * 0.05} className="sheet glow relative rounded-[24px] p-6">
            <div className="relative z-[1] flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-ink-soft text-ink">{p.i}</span>
              <div className="min-w-0">
                <h3 className="text-[17px] font-semibold tracking-[-0.02em]">{p.t}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-fg-2">{p.s}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-4 flex items-center gap-3 rounded-[20px] bg-green-soft px-5 py-4 text-[14px] text-fg-2">
        <ShieldCheck className="size-5 shrink-0 text-green" />
        <span>
          <span className="font-semibold text-fg">Sie behalten die Hoheit:</span> In den Einstellungen legen Sie fest, welche KI-Funktionen Ihre Kanzlei nutzt.
        </span>
      </Reveal>
    </Abschnitt>
  );
}
