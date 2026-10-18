// Diktat-Knopf für Notizen und E-Mail-Text: Spracheingabe über die Web Speech API des Browsers (src/lib/speech.ts).
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { hoeren, spracheingabeVerfuegbar } from "@/lib/speech";
import { toast } from "@/store/ui";
import { cn } from "@/lib/cn";

/**
 * Mikrofon-Knopf: hängt den erkannten Text (de-DE) an das Feld an. Ohne Browserunterstützung erklärt ein Hinweis,
 * warum das Diktat nicht geht – das Feld bleibt per Tastatur nutzbar.
 */
export function DiktatKnopf({ onText, label = "Diktieren", className }: { onText: (t: string) => void; label?: string; className?: string }) {
  const [aktiv, setAktiv] = useState(false);
  const [zwischen, setZwischen] = useState("");
  const stopp = useRef<(() => void) | null>(null);
  useEffect(() => () => stopp.current?.(), []);

  const umschalten = () => {
    if (aktiv) {
      stopp.current?.();
      stopp.current = null;
      setAktiv(false);
      setZwischen("");
      return;
    }
    if (!spracheingabeVerfuegbar()) {
      toast("Diktat in diesem Browser nicht verfügbar", {
        text: "Die Spracheingabe nutzt die Spracherkennung des Browsers (z. B. Chrome oder Edge) und braucht die Freigabe des Mikrofons. Bitte tippen Sie den Text – oder öffnen Sie Apex in einem unterstützten Browser.",
        ton: "info",
      });
      return;
    }
    setAktiv(true);
    stopp.current = hoeren({
      onInterim: (t) => setZwischen(t),
      onFinal: (t) => {
        setZwischen("");
        if (t.trim()) onText(t.trim());
      },
      onEnde: () => {
        setAktiv(false);
        setZwischen("");
        stopp.current = null;
      },
      onFehler: (msg) => {
        setAktiv(false);
        setZwischen("");
        stopp.current = null;
        toast("Diktat nicht möglich", { text: msg, ton: "warnung" });
      },
    });
  };

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <button
        type="button"
        onClick={umschalten}
        aria-pressed={aktiv}
        aria-label={aktiv ? "Diktat beenden" : label}
        title={aktiv ? "Diktat beenden" : `${label} (Spracheingabe, Deutsch)`}
        className={cn(
          "inline-flex h-9 min-w-[36px] shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium transition-colors max-sm:h-11 max-sm:min-w-11",
          aktiv ? "bg-seal-soft text-seal" : "text-fg-2 shadow-[inset_0_0_0_1px_var(--line)] hover:bg-ink-softer hover:text-fg",
        )}
      >
        {aktiv ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        <span className="hidden sm:inline">{aktiv ? "Beenden" : label}</span>
      </button>
      {aktiv && (
        <span className="min-w-0 truncate text-[12.5px] italic text-fg-3" aria-live="polite">
          {zwischen || "Ich höre zu …"}
        </span>
      )}
    </span>
  );
}
