import { useEffect } from "react";
import { useLocation, useSearchParams } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { MessageCircleQuestion, Mic, Sparkles } from "lucide-react";
import { useKanzlei } from "@/store/session";
import { useUI } from "@/store/ui";
import { AiChip, Button, Card, PageHeader } from "@/components/ui";
import { AnsprechpartnerKarte } from "./Ansprechpartner";
import { WikiBibliothek } from "./WikiBibliothek";
import { Systemstatus } from "./Systemstatus";
import { GepruefteUpdates } from "./Updates";
import { festeAnsprechBezeichnung } from "@/lib/rollen";
import { useIsMobile } from "@/lib/useMedia";

const BEISPIELE = ["Wie berechne ich eine Berufungsfrist?", "Wie lade ich eine Kollegin ins Team ein?", "Was erledigt der 38h-Motor für mich?"];

export default function Hilfe() {
  const { tenant } = useKanzlei();
  const loc = useLocation();
  const [params] = useSearchParams();

  // Direktlink auf einen Wiki-Artikel (z. B. vom Assistenten: /hilfe?wiki=bea-stoerung) öffnet die Schnellhilfe
  useEffect(() => {
    const w = params.get("wiki");
    if (w) useUI.getState().zeigeHilfe(w);
  }, [params]);

  // Sprung zum Systemstatus (Kopfleiste, Mehr-Menü, Cockpit) – sofort, ohne Gleitanimation. Weil Seitenübergang und
  // nachladende Abschnitte die Lage noch verschieben, wird der Sprung kurz danach wiederholt, solange niemand selbst scrollt.
  useEffect(() => {
    if (loc.hash !== "#status") return;
    let n = 0;
    let raf = 0;
    let selbst = false;
    const timer: number[] = [];
    const nutzer = () => {
      selbst = true;
    };
    const opts = { passive: true, capture: true } as const;
    window.addEventListener("wheel", nutzer, opts);
    window.addEventListener("touchmove", nutzer, opts);
    window.addEventListener("keydown", nutzer, opts);
    const springe = (fokus: boolean) => {
      const el = document.getElementById("status");
      if (!el) return false;
      if (!selbst) el.scrollIntoView({ block: "start" });
      if (fokus) el.focus({ preventScroll: true });
      return true;
    };
    const erst = () => {
      if (springe(true)) {
        for (const ms of [180, 450, 900]) timer.push(window.setTimeout(() => springe(false), ms));
      } else if (n++ < 60) raf = requestAnimationFrame(erst);
    };
    raf = requestAnimationFrame(erst);
    return () => {
      cancelAnimationFrame(raf);
      timer.forEach((t) => clearTimeout(t));
      window.removeEventListener("wheel", nutzer, opts);
      window.removeEventListener("touchmove", nutzer, opts);
      window.removeEventListener("keydown", nutzer, opts);
    };
  }, [loc.hash, loc.key]);
  // Am Smartphone steht der Systemstatus vor dem Wiki – dort sucht man ihn unterwegs zuerst (I3-T12-02)
  const mobil = useIsMobile();

  return (
    <div>
      <PageHeader title="Hilfe & Support" hilfe="hilfe" subtitle={`Animiertes Wiki, Schnellhilfe, Systemstatus und ${festeAnsprechBezeichnung(tenant.ansprechpartner)} – Hilfe, die wirklich hilft: direkt und ohne Warteschleife.`} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AnsprechpartnerKarte ap={tenant.ansprechpartner} className="lg:col-span-2" />
        <AssistentKarte />
      </div>

      {mobil && (
        <div className="mt-10">
          <Systemstatus />
        </div>
      )}
      <div className="mt-10">
        <WikiBibliothek />
      </div>
      {!mobil && (
        <div className="mt-10">
          <Systemstatus />
        </div>
      )}
      <div className="mt-10">
        <GepruefteUpdates />
      </div>
    </div>
  );
}

function AssistentKarte() {
  const oeffne = useUI((s) => s.oeffneAssistent);
  const reduziert = useReducedMotion();
  return (
    <Card className="ai-ring flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="relative grid size-16 place-items-center">
          <motion.span
            aria-hidden
            className="ai-fill absolute inset-1 rounded-full opacity-45 blur-[14px]"
            animate={reduziert ? undefined : { scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            aria-hidden
            className="ai-fill relative size-12 rounded-full shadow-[inset_0_2px_6px_rgba(255,255,255,0.55),inset_0_-6px_12px_rgba(0,0,0,0.18)]"
            animate={reduziert ? undefined : { scale: [1, 1.04, 1], rotate: [0, 8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <AiChip>KI</AiChip>
      </div>
      <div className="mt-4">
        <div className="title-lg">Apex Assistent</div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-fg-3">Ihr KI-Avatar für Live-Support: Fragen Sie per Text oder Sprache. Der Assistent erklärt, zeigt den Weg, erledigt Aufgaben – und verbindet Sie bei Bedarf mit einem Menschen.</p>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-1.5">
        {BEISPIELE.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => oeffne(b)}
            className="flex items-center gap-2 rounded-[12px] bg-[var(--ink-softer)] px-3 py-2 text-left text-[13px] text-fg-2 transition-colors hover:bg-[var(--ink-soft)] hover:text-fg"
          >
            <MessageCircleQuestion className="size-3.5 shrink-0 text-violet" />
            <span className="min-w-0 truncate">{b}</span>
          </button>
        ))}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        <Button variant="ai" icon={<Sparkles className="size-4" />} onClick={() => oeffne()}>
          Assistent öffnen
        </Button>
        <span className="flex items-center gap-1 text-[13px] text-fg-3">
          <Mic className="size-3.5" /> auch per Sprache
        </span>
      </div>
    </Card>
  );
}
