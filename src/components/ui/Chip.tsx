import type { ReactNode } from "react";
import { Check, Clock, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Töne (DESIGN-SYSTEM.md 12.6): neutral = Typ/Kategorie, outline = Filter/„Beispiel“, ink = hervorgehobene Info, seal = Notfrist/kritisch,
 * amber = bald fällig, green = erledigt, violet = KI (wie outline). `voll` (nur mit seal): kritische Frist überfällig/heute/morgen –
 * vollflächig rot, das Lauteste auf dem Bildschirm (Klasse `chip-seal-voll`).
 */
export type Tone = "neutral" | "ink" | "seal" | "amber" | "green" | "violet" | "outline";

/** Formcodiertes Symbol je Signalton – der Zustand steht nie nur in Farbe (Farbfehlsicht). */
const SYMBOL: Partial<Record<Tone, ReactNode>> = {
  seal: <TriangleAlert aria-hidden />,
  amber: <Clock aria-hidden />,
  green: <Check aria-hidden />,
};

/**
 * Status-Chip. Signaltöne (seal, amber, green) bekommen ohne eigenes `icon` automatisch ihr Symbol (TriangleAlert, Clock, Check);
 * `dot` ersetzt das Symbol dabei nicht. `symbol={false}` unterdrückt das automatische Symbol.
 */
export function Chip({ tone = "neutral", dot, icon, children, className, title, symbol = true, voll }: { tone?: Tone; dot?: boolean; icon?: ReactNode; children: ReactNode; className?: string; title?: string; symbol?: boolean; voll?: boolean }) {
  const auto = symbol && icon === undefined ? SYMBOL[tone] : undefined;
  return (
    <span title={title} className={cn("chip", tone !== "neutral" && `chip-${tone}`, voll && tone === "seal" && "chip-seal-voll", className)}>
      {dot && !auto && <span className="dot" />}
      {icon ?? auto}
      {children}
    </span>
  );
}

/** KI-Kennzeichnung: Umriss-Chip mit Sparkles und „KI“ (bzw. dem übergebenen Text) – ohne Farbe, ohne Verlauf. */
export function AiChip({ children = "KI", className }: { children?: ReactNode; className?: string }) {
  return (
    <span className={cn("chip chip-outline", className)}>
      <Sparkles aria-hidden />
      <span>{children}</span>
    </span>
  );
}
