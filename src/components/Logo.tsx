import { useId } from "react";
import { cn } from "@/lib/cn";

const MARK = "M32 5.5C38.6 18 49.6 33.4 52.4 56.5H40.6L32 43.2 23.4 56.5H11.6C14.4 33.4 25.4 18 32 5.5ZM31.15 8h1.7v21.9a.85.85 0 0 1-1.7 0ZM32 29.4a4 4 0 1 0 0 8 4 4 0 1 0 0-8Z";

/** Bildmarke: Füllfederspitze, die zugleich „A" und Gipfel ist. */
export function LogoMark({ size = 28, className, mono }: { size?: number; className?: string; mono?: boolean }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      {!mono && (
        <defs>
          <linearGradient id={id} x1="16" y1="6" x2="50" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--ink-bright)" />
            <stop offset="0.55" stopColor="var(--ink)" />
            <stop offset="1" stopColor="color-mix(in oklab, var(--ink) 60%, #0b1020)" />
          </linearGradient>
        </defs>
      )}
      <path fill={mono ? "currentColor" : `url(#${id})`} fillRule="evenodd" d={MARK} />
    </svg>
  );
}

/** App-Icon (Squircle mit Glas) */
export function AppIcon({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden", className)}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.27,
        background: "radial-gradient(120% 100% at 25% 10%, #8fa4ff 0%, #3d5cff 30%, #1e33b8 62%, #0b1240 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.45), inset 0 -1px 0 rgba(0,0,0,.2), 0 6px 16px -6px rgba(36,64,216,.6)",
      }}
    >
      <svg width={size * 0.66} height={size * 0.66} viewBox="0 0 64 64" aria-hidden>
        <path fill="#fff" fillRule="evenodd" d={MARK} />
      </svg>
    </span>
  );
}

export function Wordmark({ className, size = 17 }: { className?: string; size?: number }) {
  return (
    <span className={cn("font-semibold tracking-[-0.03em]", className)} style={{ fontSize: size }}>
      Anwalt<span className="text-ink">Apex</span>
    </span>
  );
}
