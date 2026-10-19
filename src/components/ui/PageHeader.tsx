import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { useUI } from "@/store/ui";

/**
 * Seitenkopf (DESIGN-SYSTEM.md 13): optionale Überzeile 12/500, Titel 24/600 mit Schnellhilfe daneben, Untertitel 14 Text 3
 * (höchstens 72 Zeichen breit). Aktionen rechts auf der Titelzeile – schmal rutschen sie unter den Untertitel. 24 px zum Inhalt.
 */
export function PageHeader({ title, subtitle, actions, hilfe, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; hilfe?: string; eyebrow?: ReactNode }) {
  const zeigeHilfe = useUI((s) => s.zeigeHilfe);
  return (
    <header className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-4">
      <div className="min-w-0 flex-1 basis-[320px]">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <div className="flex items-center gap-1">
          <h1 className="title-xl">{title}</h1>
          {hilfe && (
            <button
              type="button"
              onClick={() => zeigeHilfe(hilfe)}
              className="icon-btn text-fg-4"
              aria-label="Was ist das? Schnellhilfe öffnen"
              title="Was ist das? Schnellhilfe öffnen"
            >
              <CircleHelp className="size-4" />
            </button>
          )}
        </div>
        {subtitle && <p className="mt-1 max-w-[72ch] text-[14px] leading-5 text-fg-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
