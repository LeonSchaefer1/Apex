import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui";
import { kopiereText } from "@/lib/zwischenablage";
import { cn } from "@/lib/cn";

/**
 * Kopierknopf mit Bestätigung am Knopf selbst (I4-T21-02): „✓ Kopiert“ für etwa 2 Sekunden, angesagt über eine
 * aria-live-Region – keine zusätzliche Meldung, die über einem offenen Dialog liegt. Geht das Kopieren nicht, wird der
 * Text (falls angegeben) markiert und ein Hinweis direkt am Knopf genannt.
 */
export function KopierKnopf({
  text, was, children, icon, variant = "secondary", size = "sm", markieren, className, ...rest
}: Omit<ButtonProps, "onClick" | "children"> & {
  /** Zu kopierender Text. */
  text: string;
  /** Was kopiert wird – für die Ansage („Einladung kopiert“). */
  was: string;
  children: ReactNode;
  /** Element, dessen Text markiert wird, wenn die Zwischenablage gesperrt ist. */
  markieren?: () => HTMLElement | null;
}) {
  const [status, setStatus] = useState<"" | "kopiert" | "markiert" | "fehler">("");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const klick = async () => {
    const r = await kopiereText(text, markieren?.());
    setStatus(r);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus(""), r === "kopiert" ? 2000 : 8000);
  };
  const kopiert = status === "kopiert";
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <Button {...rest} size={size} variant={variant} icon={kopiert ? <Check className="size-3.5" strokeWidth={3} /> : icon} onClick={() => void klick()}>
        {/* beide Beschriftungen belegen denselben Platz – der Knopf springt beim Wechsel nicht */}
        <span className="grid">
          <span className={cn("col-start-1 row-start-1", kopiert && "invisible")}>{children}</span>
          <span className={cn("col-start-1 row-start-1 text-left", !kopiert && "invisible")} aria-hidden={!kopiert}>
            Kopiert
          </span>
        </span>
      </Button>
      <span aria-live="polite" className={status === "markiert" || status === "fehler" ? "text-[12.5px] leading-snug text-[var(--amber-text)]" : "sr-only"}>
        {kopiert
          ? `${was} kopiert`
          : status === "markiert"
            ? "Zwischenablage gesperrt – der Text ist markiert, bitte mit Strg+C bzw. ⌘C kopieren."
            : status === "fehler"
              ? "Kopieren nicht möglich – bitte den Text markieren und mit Strg+C bzw. ⌘C kopieren."
              : ""}
      </span>
    </span>
  );
}
