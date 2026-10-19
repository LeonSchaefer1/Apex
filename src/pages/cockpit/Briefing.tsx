import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { ChevronDown, Square, Volume2 } from "lucide-react";
import { useIsMobile } from "@/lib/useMedia";
import { AiChip } from "@/components/ui";
import { toast } from "@/store/ui";
import { cn } from "@/lib/cn";
import { schuetzeLeerzeichen } from "@/core/dates";
import { anzeigeText, sprechText, type Satz } from "./daten";
import { StatusZeile } from "./KartenArbeit";

/** Hervorhebungen 600 in Text 1; Siegelrot nur, wenn der Satz eine kritische oder überfällige Frist nennt (DESIGN-SYSTEM.md 12.19). */
const TON: Record<string, string> = {
  fg: "font-semibold text-fg",
  seal: "font-semibold text-[var(--seal-text)]",
  amber: "font-semibold text-fg",
  ink: "mono font-medium text-fg",
  violet: "font-semibold text-fg",
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

/**
 * KI-Tagesbriefing. `warnungen` (z. B. pausierte Fristerkennung) stehen immer zuerst und bleiben auch am Smartphone sichtbar;
 * dort steht außerdem der Betriebsstatus (beA, E-Mail) als erste Zeile – die Kopfleiste zeigt ihn mobil nur als Symbol.
 */
export function Briefing({ saetze: tagesSaetze, erstellt, warnungen = [] }: { saetze: Satz[]; erstellt: string; warnungen?: Satz[] }) {
  const saetze = warnungen.length ? [...warnungen, ...tagesSaetze] : tagesSaetze;
  const { aktiv, verfuegbar, start, stopp } = useVorlesen(saetze);
  const spricht = aktiv !== null;
  const mobil = useIsMobile();
  const [offen, setOffen] = useState(false);
  // Auf dem Smartphone zunächst nur der wichtigste Satz (nach den Warnungen) – damit Fristen und Posteingang sofort sichtbar sind.
  const kompakt = mobil && !offen && !spricht;
  const sichtbar = kompakt ? saetze.slice(0, warnungen.length + 1) : saetze;

  return (
    <section className="max-w-[76ch]" aria-label="KI-Tagesbriefing">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <AiChip>KI-Briefing</AiChip>
        <span className="text-[13px] text-fg-4"><span className="hidden sm:inline">Aus Ihren Kanzleidaten erstellt · </span>{erstellt} Uhr</span>
        <div className="ml-auto">
          <button
            type="button"
            onClick={spricht ? stopp : start}
            disabled={!verfuegbar}
            title={verfuegbar ? (spricht ? "Vorlesen beenden" : "Briefing vorlesen lassen") : "Vorlesen wird von diesem Browser nicht unterstützt"}
            className={cn("btn btn-sm", spricht ? "btn-secondary" : "btn-ghost")}
            aria-pressed={spricht}
          >
            {spricht ? <Square className="size-3.5" fill="currentColor" /> : <Volume2 className="size-4" />}
            {spricht ? "Stopp" : "Vorlesen"}
            {spricht && <Pegel />}
          </button>
        </div>
      </div>
      {mobil && <StatusZeile uhrzeit className="mt-2" />}
      <div className="mt-3 space-y-2 text-[15px] leading-6 text-fg-2">
        {sichtbar.map((satz, i) => (
          <p
            key={i}
            className={cn("transition-opacity duration-200", i < warnungen.length && "rounded-md bg-amber-soft px-3 py-1.5", spricht && aktiv !== i && "opacity-40")}
            title={anzeigeText(satz)}
          >
            {satz.map((teil, k) =>
              teil.href ? (
                <Link key={k} to={teil.href} className={cn(TON[teil.ton ?? "ink"], "rounded-sm underline decoration-[var(--line-strong)] decoration-1 underline-offset-[3px] hover:decoration-[var(--fg)]")}>
                  {schuetzeLeerzeichen(teil.t)}
                </Link>
              ) : (
                <span key={k} className={teil.ton ? TON[teil.ton] : undefined}>
                  {schuetzeLeerzeichen(teil.t)}
                </span>
              ),
            )}
          </p>
        ))}
      </div>
      {kompakt && saetze.length > sichtbar.length && (
        <button type="button" onClick={() => setOffen(true)} className="link-leise mt-2 min-h-11 rounded-sm">
          Posteingang und Termine im Briefing
          <ChevronDown className="size-4" />
        </button>
      )}
    </section>
  );
}

/** Kleiner Pegel als Sprech-Anzeige. */
function Pegel() {
  return (
    <span className="ml-0.5 flex h-3 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className="w-[2px] rounded-full bg-current"
          animate={{ height: ["30%", "100%", "45%", "85%", "30%"] }}
          transition={{ duration: 0.9 + i * 0.12, repeat: Infinity, ease: "linear", delay: i * 0.1 }}
        />
      ))}
    </span>
  );
}
