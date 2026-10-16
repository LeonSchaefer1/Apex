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
    <div className={cn("mb-4 flex items-start gap-3", className)}>
      {icon && <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[10px] bg-ink-soft text-ink">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="title-md truncate">{title}</div>
        {subtitle && <div className="mt-0.5 text-[12.5px] text-fg-3">{subtitle}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
