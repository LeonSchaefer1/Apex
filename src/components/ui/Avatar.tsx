import { cn } from "@/lib/cn";

/**
 * Avatar: rund, Fläche Fläche 3, Initialen 600 in Text 2 (DESIGN-SYSTEM.md 12.20). Personenfarben aus den Daten erscheinen nicht
 * als Fläche hinter Text – `farbe` bleibt aus Kompatibilität und wird als zugänglicher Hinweis nicht benötigt.
 */
export function Avatar({ initialen, size = 28, className, title }: { initialen: string; farbe?: string; size?: number; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn("relative inline-grid shrink-0 place-items-center rounded-full bg-[var(--surface-3)] font-semibold text-fg-2", className)}
      style={{ width: size, height: size, fontSize: Math.min(16, Math.max(11, Math.round(size * 0.43))), lineHeight: 1 }}
    >
      {initialen}
    </span>
  );
}

/** Personenstapel: Überlappung −6 px, Ring 2 px in der Untergrund-Farbe. */
export function AvatarStack({ items, size = 24 }: { items: { initialen: string; farbe?: string; name?: string }[]; size?: number }) {
  return (
    <div className="flex -space-x-1.5">
      {items.map((i, k) => (
        <Avatar key={k} initialen={i.initialen} size={size} title={i.name} className="ring-2 ring-[var(--surface)]" />
      ))}
    </div>
  );
}
