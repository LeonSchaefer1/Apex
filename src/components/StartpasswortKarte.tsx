import { useRef } from "react";
import { KeyRound, ShieldAlert } from "lucide-react";
import { KopierKnopf } from "@/components/KopierKnopf";

/** Einheitlicher Hinweis zur Weitergabe von Startpasswörtern (Team-Dialog und Apex Console). */
export const STARTPASSWORT_HINWEIS = "Getrennt übermitteln (telefonisch oder per SMS) – nicht per unverschlüsselter E-Mail und nie zusammen mit der Einladung.";

/**
 * Startpasswort groß anzeigen, mit eigenem Knopf „Startpasswort kopieren“ und dem Hinweis zur getrennten Übermittlung.
 * Das Kopieren bestätigt der Knopf selbst („✓ Kopiert“) – keine Meldung über dem Dialog (I4-T21-02).
 */
export function StartpasswortKarte({ passwort, kompakt }: { passwort: string; kompakt?: boolean }) {
  const feld = useRef<HTMLDivElement>(null);
  return (
    <div className="rounded-[18px] bg-[radial-gradient(120%_140%_at_0%_0%,var(--ink-soft),transparent_70%)] p-4 ring-2 ring-[var(--ink)]">
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-fg-3">
        <KeyRound className="size-3.5" /> Startpasswort
      </div>
      <div ref={feld} className={kompakt ? "mono mt-1 select-all break-all text-[18px] font-semibold tracking-[0.02em]" : "mono mt-1 select-all break-all text-[22px] font-semibold tracking-[0.02em]"}>
        {passwort}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <KopierKnopf text={passwort} was="Startpasswort" icon={<KeyRound className="size-3.5" />} markieren={() => feld.current}>
          Startpasswort kopieren
        </KopierKnopf>
        <span className="flex min-w-0 flex-1 basis-[200px] items-start gap-1.5 text-[13px] leading-snug text-fg-2">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber" />
          {STARTPASSWORT_HINWEIS}
        </span>
      </div>
    </div>
  );
}
