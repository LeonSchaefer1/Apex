import type { ReactNode } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

type Ton = "ink" | "seal" | "amber" | "green" | "violet";
const TON_KACHEL: Record<Ton, string> = {
  ink: "bg-ink-soft text-ink",
  seal: "bg-seal-soft text-seal",
  amber: "bg-amber-soft text-amber",
  green: "bg-green-soft text-green",
  violet: "bg-violet-soft text-violet",
};

/** Bento-Karte des Cockpits: ruhige Inhaltsfläche mit Lichtreflex und gestaffeltem Erscheinen. */
export function BentoKarte({ i = 0, className, children, label, ai }: { i?: number; className?: string; children: ReactNode; label: string; ai?: boolean }) {
  return (
    <motion.section
      aria-label={label}
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 34, delay: 0.1 + i * 0.045 }}
      className={cn(
        "glow relative flex min-w-0 flex-col rounded-[24px] p-4 sm:p-5",
        ai ? "ai-ring sheet" : "sheet",
        className,
      )}
    >
      {children}
    </motion.section>
  );
}

export function KartenKopf({ icon, ton = "ink", titel, unter, mehr, extra }: { icon: ReactNode; ton?: Ton; titel: ReactNode; unter?: ReactNode; mehr?: { to: string; label: string }; extra?: ReactNode }) {
  return (
    <header className="relative z-[1] mb-3.5 flex items-start gap-3">
      <div className={cn("grid size-9 shrink-0 place-items-center rounded-[12px] [&>svg]:size-[18px]", TON_KACHEL[ton])}>{icon}</div>
      <div className="min-w-0 flex-1">
        <h2 className="title-md truncate">{titel}</h2>
        {unter && <div className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-fg-3 @4xl:truncate">{unter}</div>}
      </div>
      {extra}
      {mehr && <MehrLink to={mehr.to}>{mehr.label}</MehrLink>}
    </header>
  );
}

export function MehrLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "group inline-flex h-8 shrink-0 items-center gap-0.5 rounded-full pl-3 pr-2 text-[12.5px] font-medium text-ink transition-colors hover:bg-ink-softer",
        className,
      )}
    >
      {children}
      <ChevronRight className="size-4 transition-transform duration-300 ease-[var(--spring)] group-hover:translate-x-0.5" />
    </Link>
  );
}

/** Farbstreifen für die Fristen-Ampel. */
export function Streifen({ ton }: { ton: "seal" | "amber" | "ink" | "neutral" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-full",
        ton === "seal" && "bg-seal",
        ton === "amber" && "bg-amber",
        ton === "ink" && "bg-ink",
        ton === "neutral" && "bg-[var(--line-strong)]",
      )}
    />
  );
}
