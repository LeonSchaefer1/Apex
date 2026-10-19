// Hinweisband, solange eine Fristautomatik (Fristerkennung, Vorfristen, eEB) pausiert ist – im Cockpit und in den Fristen (I3-T10-01).
// Liest den Datenstore selbst und rendert nichts, wenn alle Fristautomatiken laufen.
import { Link } from "react-router";
import { PauseCircle, ArrowRight } from "lucide-react";
import { useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { fmtDate, fmtTime } from "@/core/dates";
import { folgeWaehrendPause, fristAutomatikKurzname, pausierteFristAutomatiken } from "@/core/automationen";
import { darfAutomatikSchalten } from "@/lib/rollen";
import { cn } from "@/lib/cn";
import type { Automation, User } from "@/core/types";

/** „seit 17.10.2026, 01:05 Uhr (Dr. Julia Hartmann)“ – ohne gespeicherten Zeitpunkt nur „pausiert“. */
export function pausiertSeitText(a: Pick<Automation, "pausiertAm" | "pausiertVon">, team: Pick<User, "id" | "name">[]): string {
  const wer = a.pausiertVon ? team.find((u) => u.id === a.pausiertVon)?.name : undefined;
  const wann = a.pausiertAm ? `seit ${fmtDate(a.pausiertAm.slice(0, 10))}, ${fmtTime(a.pausiertAm)} Uhr` : "";
  return [wann, wer ? `(${wer})` : ""].filter(Boolean).join(" ");
}

export function FristAutomatikHinweis({ className }: { className?: string }) {
  const automationen = useData((s) => s.data.automationen);
  const { user, team } = useKanzlei();
  const pausiert = pausierteFristAutomatiken(automationen);
  if (!pausiert.length) return null;
  const darf = pausiert.some((a) => darfAutomatikSchalten(user, a.key));

  return (
    <section
      role="status"
      aria-label="Fristautomatik pausiert"
      className={cn("flex flex-col gap-2 rounded-md bg-amber-soft px-3.5 py-2.5 sm:flex-row sm:items-start sm:gap-2.5", className)}
    >
      <PauseCircle className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1 text-[14px] leading-snug text-fg-2">
        {pausiert.map((a) => {
          const seit = pausiertSeitText(a, team);
          return (
            <p key={a.key}>
              <span className="font-semibold text-fg">{fristAutomatikKurzname(a.key)} pausiert{seit ? ` ${seit}` : ""}</span> – {folgeWaehrendPause(a.key)}
            </p>
          );
        })}
      </div>
      {darf ? (
        <Link
          to="/automatisierung"
          className="link inline-flex min-h-[44px] shrink-0 items-center gap-1.5 self-start rounded-sm px-1 text-[14px] font-medium sm:min-h-0 sm:py-0.5"
        >
          Im 38h-Motor einschalten
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <p className="shrink-0 self-start text-[13.5px] font-medium text-fg-2 sm:py-1">Partner bzw. Administration informieren</p>
      )}
    </section>
  );
}
