import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Abschnitt des Cockpits (DESIGN-SYSTEM.md 12.3/13): Titel und Untertitel stehen frei über dem Inhalt, rechts ein eigenständiger
 * Link. Der Inhalt ist eine Liste in **einer** Karte (`karte`) oder steht frei mit Linie oben (`flach`, für Nebeninformationen).
 * Keine Icon-Kacheln, kein Schatten, kein gestaffeltes Erscheinen.
 */
export function Abschnitt({
  titel,
  unter,
  mehr,
  extra,
  label,
  className,
  children,
  flach,
}: {
  titel: ReactNode;
  unter?: ReactNode;
  mehr?: { to: string; label: string };
  extra?: ReactNode;
  label: string;
  className?: string;
  children: ReactNode;
  /** ohne Karte: Linie oben, Inhalt auf dem Grund */
  flach?: boolean;
}) {
  return (
    <section aria-label={label} className={cn("flex min-w-0 flex-col", flach && "border-t border-[var(--line)] pt-4", className)}>
      <header className="mb-3 flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1 basis-[12rem]">
          <h2 className="title-md break-words">{titel}</h2>
          {unter && <div className="mt-0.5 text-[13px] leading-[18px] text-fg-3">{unter}</div>}
        </div>
        {extra}
        {mehr && <MehrLink to={mehr.to}>{mehr.label}</MehrLink>}
      </header>
      {children}
    </section>
  );
}

/** Karte für eine Liste: Fläche, 1-px-Linie, Radius 8; Zeilen trennt eine Linie. */
export function ListenKarte({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("sheet flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg", className)}>{children}</div>;
}

/** Gruppenkopf in einer Liste („Heute · Sonntag“): 12/500 Text 3, ohne Linie. */
export function GruppenKopf({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 pb-1 pt-3 text-[12px] font-medium leading-4 text-fg-3", className)}>{children}</div>;
}

/** Eigenständiger Link („Alle Fristen ›“): 13/500 Text 2, ohne Unterstrich; Trefferfläche 32 px, am Telefon 44 px. */
export function MehrLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn("link-leise min-h-8 shrink-0 rounded-sm max-sm:min-h-11", className)}>
      {children}
      <ChevronRight aria-hidden />
    </Link>
  );
}

/** Balken links für kritische Fristen (2 px Siegelrot) – der einzige farbige Randstreifen (DESIGN-SYSTEM.md 8). */
export const KRITISCH_BALKEN = "shadow-[inset_2px_0_0_var(--seal)]";
