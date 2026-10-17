import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface GlassProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "regular" | "strong" | "thin";
  glow?: boolean;
}

/** Glas-Ebene für Steuerung & schwebende Elemente (Navigation, Leisten, Popover). */
export const Glass = forwardRef<HTMLDivElement, GlassProps>(function Glass({ tone = "regular", glow, className, ...rest }, ref) {
  return <div ref={ref} className={cn(tone === "strong" ? "glass-strong" : tone === "thin" ? "glass-thin" : "glass", glow && "glow", className)} {...rest} />;
});

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padded?: boolean;
}

/** Inhaltsfläche: ruhig, fast opak – für Lesbares. */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card({ interactive, padded = true, className, ...rest }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "sheet relative rounded-[22px]",
        padded && "p-5",
        interactive && "glow cursor-pointer transition-[transform,box-shadow] duration-300 ease-[var(--spring)] hover:-translate-y-0.5 hover:shadow-glass",
        className,
      )}
      {...rest}
    />
  );
});

export function CardHeader({ title, subtitle, action, icon, className }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    // Schmal (z. B. 320 px): Reicht der Platz neben Symbol und Aktion nicht für den Titel (mind. 9rem), rückt die Aktion in die
    // nächste Zeile – statt den Titel abzuschneiden oder mitten im Wort zu trennen (I4-T14-02, Rest aus B-10).
    <div className={cn("mb-4 flex flex-wrap items-start gap-x-3 gap-y-2", className)}>
      {icon && <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[10px] bg-ink-soft text-ink">{icon}</div>}
      <div className="min-w-0 flex-1 basis-[9rem]">
        <div className="title-md line-clamp-2 break-words hyphens-auto">{title}</div>
        {subtitle && <div className="mt-0.5 text-[12.5px] text-fg-3">{subtitle}</div>}
      </div>
      {action && <div className="ml-auto max-w-full shrink-0">{action}</div>}
    </div>
  );
}
