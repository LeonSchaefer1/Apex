import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "ink" | "seal" | "amber" | "green" | "violet" | "outline";

export function Chip({ tone = "neutral", dot, icon, children, className, title }: { tone?: Tone; dot?: boolean; icon?: ReactNode; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("chip", tone !== "neutral" && `chip-${tone}`, className)}>
      {dot && <span className="dot" />}
      {icon}
      {children}
    </span>
  );
}

export function AiChip({ children = "KI", className }: { children?: ReactNode; className?: string }) {
  return (
    <span className={cn("chip ai-ring !bg-transparent", className)}>
      <span className="ai-text font-semibold">{children}</span>
    </span>
  );
}
