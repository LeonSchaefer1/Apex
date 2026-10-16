import { LogOut, ShieldCheck } from "lucide-react";
import { getBackend } from "@/lib/backend";
import { useKanzlei, useSession } from "@/store/session";
import { useData } from "@/store/data";
import { Button } from "@/components/ui";
import { AppIcon } from "@/components/Logo";
import { ZweiFaktorEinrichtung } from "@/components/sicherheit/ZweiFaktorEinrichtung";

/** Die Kanzlei verlangt Zwei-Faktor: Vor dem ersten Arbeiten richtet die Person sie ein – Kanzleidaten gibt es erst danach. */
export function ZweiFaktorPflicht() {
  const { user, tenant } = useKanzlei();
  const fertig = async () => {
    const s = await getBackend().me().catch(() => null);
    useSession.getState().setSitzung(s);
  };
  return (
    <div className="relative z-10 h-full overflow-y-auto px-4 py-10">
      <div className="glass-strong mx-auto w-full max-w-[640px] rounded-[30px] p-6 sm:p-8" style={{ boxShadow: "var(--glass-shadow-lg)" }}>
        <div className="flex items-center gap-3">
          <AppIcon size={34} />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-soft px-2.5 py-1 text-[13px] font-medium text-ink">
            <ShieldCheck className="size-3.5" /> Anmeldung & Sicherheit
          </span>
        </div>
        <h1 className="title-lg mt-5">Zwei-Faktor-Anmeldung einrichten</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-2">
          {tenant.kurzname} verlangt für alle Zugänge die Zwei-Faktor-Anmeldung. Bitte richten Sie sie jetzt für {user.name} ein – danach geht es direkt weiter ins Cockpit.
        </p>
        <div className="mt-5">
          <ZweiFaktorEinrichtung pflichtModus onFertig={() => void fertig()} />
        </div>
        <Button
          variant="ghost"
          icon={<LogOut className="size-4" />}
          className="mt-5"
          onClick={() =>
            void (async () => {
              await useSession.getState().logout();
              useData.getState().clear();
            })()
          }
        >
          Abmelden
        </Button>
      </div>
    </div>
  );
}
