import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Einstellungszeile im iOS-Stil: Bezeichnung + Erklärsatz links, Steuerung rechts. */
export function Zeile({ titel, text, children, htmlFor, className }: { titel: ReactNode; text?: ReactNode; children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-3 py-4 first:pt-0 last:pb-0", className)}>
      <div className="min-w-0 flex-1 basis-[240px]">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="block text-[14px] font-semibold">
            {titel}
          </label>
        ) : (
          <div className="text-[14px] font-semibold">{titel}</div>
        )}
        {text && <div className="mt-0.5 text-[12.5px] leading-relaxed text-fg-3">{text}</div>}
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}

export function Abschnitt({ titel, text, icon, children, aktion, className }: { titel: ReactNode; text?: ReactNode; icon?: ReactNode; children: ReactNode; aktion?: ReactNode; className?: string }) {
  return (
    <section className={cn("sheet relative rounded-[22px] p-5 md:p-6", className)}>
      <div className="mb-4 flex flex-wrap items-start gap-3">
        {icon && <div className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">{icon}</div>}
        <div className="min-w-0 flex-1 basis-[200px]">
          <h2 className="title-md">{titel}</h2>
          {text && <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-3">{text}</p>}
        </div>
        {aktion && <div className="shrink-0">{aktion}</div>}
      </div>
      {children}
    </section>
  );
}

export { ROLLE_AUSWAHL as ROLLEN_LABEL } from "@/lib/rollen";
