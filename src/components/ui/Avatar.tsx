import { cn } from "@/lib/cn";

export function Avatar({ initialen, farbe: farbeRoh = "#2440D8", size = 32, className, title }: { initialen: string; farbe?: string; size?: number; className?: string; title?: string }) {
  // Markenfarbe als Fläche: im Dunkelmodus --ink-fill (weiße Initialen ≥ 4,5 : 1, I4-T09-01), im Hellmodus identisch mit --ink
  const farbe = farbeRoh.replace(/\s/g, "") === "var(--ink)" ? "var(--ink-fill)" : farbeRoh;
  return (
    <span
      title={title}
      className={cn("relative inline-grid shrink-0 place-items-center rounded-full font-semibold text-white", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.36),
        background: `radial-gradient(120% 120% at 30% 15%, color-mix(in oklab, ${farbe} 55%, white) 0%, ${farbe} 55%, color-mix(in oklab, ${farbe} 70%, black) 100%)`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.35), 0 2px 6px -2px rgba(0,0,0,.25)",
        letterSpacing: "0.02em",
      }}
    >
      {initialen}
    </span>
  );
}

export function AvatarStack({ items, size = 26 }: { items: { initialen: string; farbe?: string; name?: string }[]; size?: number }) {
  return (
    <div className="flex -space-x-2">
      {items.map((i, k) => (
        <Avatar key={k} initialen={i.initialen} farbe={i.farbe} size={size} title={i.name} className="ring-2 ring-[var(--surface)]" />
      ))}
    </div>
  );
}
