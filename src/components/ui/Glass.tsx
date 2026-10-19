import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface GlassProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "regular" | "strong" | "thin";
  /** ohne Wirkung (früher Lichtreflex) – bleibt aus Kompatibilität */
  glow?: boolean;
}

/**
 * Früher Glas-Ebene, jetzt eine deckende Fläche mit 1-px-Linie (DESIGN-SYSTEM.md 12.3) – alle Töne sehen gleich aus.
 * Für schwebende Ebenen (Menü, Popover) die Klasse `glass-menu` ergänzen.
 */
export const Glass = forwardRef<HTMLDivElement, GlassProps>(function Glass({ tone = "regular", glow: _glow, className, ...rest }, ref) {
  return <div ref={ref} className={cn(tone === "strong" ? "glass-strong" : tone === "thin" ? "glass-thin" : "glass", className)} {...rest} />;
});

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padded?: boolean;
}

/** Inhaltsfläche: Fläche, 1-px-Linie, Radius 8, kein Schatten. Innenabstand 20 px (`padded`). Keine Karte in einer Karte. */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card({ interactive, padded = true, className, ...rest }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "sheet relative rounded-lg",
        padded && "p-5",
        interactive && "cursor-pointer transition-[border-color] duration-100 hover:border-[var(--line-strong)]",
        className,
      )}
      {...rest}
    />
  );
});

/** Kartenkopf: Titel 15/600, Untertitel 13 Text 3, Aktion rechts; Symbol 16 px ohne Kachel vor dem Titel (optional). */
export function CardHeader({ title, subtitle, action, icon, className }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    // Schmal (z. B. 320 px): Reicht der Platz neben Symbol und Aktion nicht für den Titel (mind. 9rem), rückt die Aktion in die
    // nächste Zeile – statt den Titel abzuschneiden oder mitten im Wort zu trennen (I4-T14-02, Rest aus B-10).
    <div className={cn("mb-4 flex flex-wrap items-start gap-x-2.5 gap-y-2", className)}>
      {icon && <div className="mt-[3px] shrink-0 text-fg-4 [&>svg]:size-4" aria-hidden>{icon}</div>}
      <div className="min-w-0 flex-1 basis-[9rem]">
        <div className="title-md line-clamp-2 break-words hyphens-auto">{title}</div>
        {subtitle && <div className="mt-0.5 text-[13px] leading-[18px] text-fg-3">{subtitle}</div>}
      </div>
      {action && <div className="ml-auto max-w-full shrink-0">{action}</div>}
    </div>
  );
}
