// Hinweisband im Cockpit, solange offene Fristen auf einen deaktivierten Zugang zeigen (I5-T23-01, Organisationspflicht).
// Für Partner und Anwälte; rendert nichts, wenn alle offenen Einträge bei aktiven Personen liegen.
import { Link } from "react-router";
import { ArrowRight, UserX } from "lucide-react";
import { useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { darfVerwalten } from "@/lib/backend";
import { fristenDeaktivierterZugaenge, istBerufstraeger, verantwortungText } from "@/core/vertretung";
import { cn } from "@/lib/cn";

export function VerwaisteFristenHinweis({ className }: { className?: string }) {
  const fristen = useData((s) => s.data.fristen);
  const { user, team } = useKanzlei();
  if (!istBerufstraeger(user)) return null;
  const liste = fristenDeaktivierterZugaenge(fristen, team);
  if (!liste.length) return null;
  const verwalten = darfVerwalten(user.rolle);

  return (
    <section
      role="status"
      aria-label="Offene Fristen eines deaktivierten Zugangs"
      className={cn("flex flex-col gap-2 rounded-[18px] border border-amber/35 bg-amber-soft px-4 py-3", className)}
    >
      {liste.map(({ person, offen }) => {
        const n = offen.fristen.length;
        const kopf = n
          ? `${n === 1 ? "1 offene Frist" : `${n} offene Fristen`} eines deaktivierten Zugangs (${person.name})`
          : `${verantwortungText(offen)} eines deaktivierten Zugangs (${person.name})`;
        const dazu = n && offen.alle.length > n ? verantwortungText({ ...offen, fristen: [] }) : "";
        return (
          <div key={person.id} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
            <UserX className="mt-0.5 size-5 shrink-0 text-amber" aria-hidden />
            <p className="min-w-0 flex-1 text-[14px] leading-snug text-fg-2">
              <span className="font-semibold text-fg">{kopf}</span>
              {dazu ? `, dazu ${dazu}` : ""} – jede Frist braucht eine aktive verantwortliche Person.
            </p>
            {verwalten ? (
              <Link
                to={`/einstellungen?tab=team&uebertragen=${encodeURIComponent(person.id)}`}
                className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 self-start rounded-[12px] px-2 text-[14px] font-semibold text-ink underline decoration-[var(--ink-soft)] decoration-2 underline-offset-[3px] hover:decoration-ink sm:min-h-0 sm:py-1"
              >
                Verantwortung übertragen
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : (
              <Link
                to={`/fristen?verantwortlich=${encodeURIComponent(person.id)}`}
                className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 self-start rounded-[12px] px-2 text-[14px] font-semibold text-ink underline decoration-[var(--ink-soft)] decoration-2 underline-offset-[3px] hover:decoration-ink sm:min-h-0 sm:py-1"
              >
                Fristen von {person.name}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>
        );
      })}
      {!verwalten && <p className="text-[13px] text-fg-3 sm:pl-8">Übertragen können Partner und Administration unter Einstellungen → Team.</p>}
    </section>
  );
}
