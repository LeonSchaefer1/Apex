import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { ChevronDown, Square, Volume2 } from "lucide-react";
import { useIsMobile } from "@/lib/useMedia";
import { AiChip } from "@/components/ui";
import { toast } from "@/store/ui";
import { cn } from "@/lib/cn";
import { anzeigeText, sprechText, type Satz } from "./daten";

const TON: Record<string, string> = {
  fg: "font-semibold text-fg",
  seal: "font-semibold text-seal",
  amber: "font-semibold text-amber",
  ink: "mono font-semibold text-ink",
  violet: "font-semibold text-violet",
};

function sprachausgabeVerfuegbar() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
}

function deutscheStimme(): SpeechSynthesisVoice | undefined {
  try {
    const voices = window.speechSynthesis.getVoices();
    const de = voices.filter((v) => v.lang?.toLowerCase().startsWith("de"));
    return (
      de.find((v) => /anna|helena|petra|google deutsch|katja|marlene|vicki/i.test(v.name)) ??
      de.find((v) => v.lang.toLowerCase() === "de-de") ??
      de[0]
    );
  } catch {
    return undefined;
  }
}

/** Liest das Briefing Satz für Satz vor und hebt den gesprochenen Satz hervor. */
function useVorlesen(saetze: Satz[]) {
  const [aktiv, setAktiv] = useState<number | null>(null);
  const verfuegbar = sprachausgabeVerfuegbar();
  const lauf = useRef(0);

  useEffect(() => {
    if (!verfuegbar) return;
    // Stimmen werden in manchen Browsern asynchron geladen
    const s = window.speechSynthesis;
    const vorher = s.onvoiceschanged;
    s.onvoiceschanged = () => void s.getVoices();
    return () => {
      s.onvoiceschanged = vorher;
      try {
        s.cancel();
      } catch {
        /* egal */
      }
    };
  }, [verfuegbar]);

  const stopp = () => {
    lauf.current++;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* egal */
    }
    setAktiv(null);
  };

  const start = () => {
    if (!verfuegbar) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const id = ++lauf.current;
    const stimme = deutscheStimme();
    saetze.forEach((satz, i) => {
      const u = new SpeechSynthesisUtterance(sprechText(satz));
      u.lang = stimme?.lang ?? "de-DE";
      if (stimme) u.voice = stimme;
      u.rate = 1.02;
      u.pitch = 1;
      u.onstart = () => lauf.current === id && setAktiv(i);
      u.onend = () => {
        if (lauf.current === id && i === saetze.length - 1) setAktiv(null);
      };
      u.onerror = (ev) => {
        if (lauf.current !== id) return;
        setAktiv(null);
        if (ev.error !== "interrupted" && ev.error !== "canceled" && i === 0) {
          lauf.current++;
          toast("Vorlesen nicht möglich", { text: "Ihr Browser stellt gerade keine Sprachausgabe bereit. Prüfen Sie die Lautstärke oder installierte Stimmen.", ton: "warnung" });
        }
      };
      synth.speak(u);
    });
    setAktiv(0);
  };

  return { aktiv, verfuegbar, start, stopp };
}

export function Briefing({ saetze, erstellt }: { saetze: Satz[]; erstellt: string }) {
  const { aktiv, verfuegbar, start, stopp } = useVorlesen(saetze);
  const spricht = aktiv !== null;
  const mobil = useIsMobile();
  const [offen, setOffen] = useState(false);
  // Auf dem Smartphone zunächst nur der wichtigste Satz – damit Fristen und Posteingang sofort sichtbar sind.
  const kompakt = mobil && !offen && !spricht;
  const sichtbar = kompakt ? saetze.slice(0, 1) : saetze;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 36, delay: 0.04 }}
      className="sheet relative overflow-hidden rounded-[26px] p-5 sm:p-6"
      aria-label="KI-Tagesbriefing"
    >
      {/* zarter irisierender Lichtschein oben rechts */}
      <div aria-hidden className="ai-fill pointer-events-none absolute -right-24 -top-28 size-72 rounded-full opacity-[0.13] blur-3xl" />
      <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2">
        <AiChip>KI-Briefing</AiChip>
        <span className="text-[12px] text-fg-3"><span className="hidden sm:inline">Aus Ihren Kanzleidaten erstellt · </span>{erstellt} Uhr</span>
        <div className="ml-auto">
          <button
            type="button"
            onClick={spricht ? stopp : start}
            disabled={!verfuegbar}
            title={verfuegbar ? (spricht ? "Vorlesen beenden" : "Briefing vorlesen lassen") : "Vorlesen wird von diesem Browser nicht unterstützt"}
            className={cn(
              "btn btn-sm",
              spricht ? "btn-secondary !text-ink" : "btn-ghost",
            )}
            aria-pressed={spricht}
          >
            {spricht ? <Square className="size-3.5" fill="currentColor" /> : <Volume2 className="size-4" />}
            {spricht ? "Stopp" : "Vorlesen"}
            {spricht && <Pegel />}
          </button>
        </div>
      </div>
      <div className="relative mt-3.5 space-y-1.5 text-[15px] leading-[1.6] text-fg-2 sm:text-[16px]">
        {sichtbar.map((satz, i) => (
          <p
            key={i}
            className={cn("transition-[opacity,filter] duration-500", spricht && aktiv !== i && "opacity-40")}
            title={anzeigeText(satz)}
          >
            {satz.map((teil, k) =>
              teil.href ? (
                <Link key={k} to={teil.href} className={cn(TON[teil.ton ?? "ink"], "rounded-[6px] px-0.5 underline decoration-[var(--ink-soft)] decoration-2 underline-offset-[3px] hover:decoration-ink")}>
                  {teil.t}
                </Link>
              ) : (
                <span key={k} className={teil.ton ? TON[teil.ton] : undefined}>
                  {teil.t}
                </span>
              ),
            )}
          </p>
        ))}
      </div>
      {kompakt && saetze.length > 1 && (
        <button type="button" onClick={() => setOffen(true)} className="relative mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-ink">
          Posteingang und Termine im Briefing
          <ChevronDown className="size-4" />
        </button>
      )}
    </motion.section>
  );
}

/** Kleiner Pegel als Sprech-Anzeige. */
function Pegel() {
  return (
    <span className="ml-0.5 flex h-3 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className="w-[2.5px] rounded-full bg-current"
          animate={{ height: ["30%", "100%", "45%", "85%", "30%"] }}
          transition={{ duration: 0.9 + i * 0.12, repeat: Infinity, ease: "easeInOut", delay: i * 0.1 }}
        />
      ))}
    </span>
  );
}
