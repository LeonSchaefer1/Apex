import { useNavigate } from "react-router";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui";
import { useKanzlei } from "@/store/session";
import { rollenLabel } from "@/lib/rollen";

/** Bereich für die eigene Rolle gesperrt (z. B. Abrechnung für Auszubildende) – mit Erklärung und nächstem Schritt. */
export function KeinZugriff() {
  const nav = useNavigate();
  const { user } = useKanzlei();
  return (
    <div className="sheet mx-auto mt-10 max-w-[560px] rounded-lg p-6 text-center sm:p-8" role="alert">
      <ShieldOff className="mx-auto size-5 text-fg-4" aria-hidden />
      <h1 className="title-lg mt-3">Kein Zugriff für Ihre Rolle</h1>
      <p className="mt-2 text-[14px] leading-5 text-fg-2">
        Diesen Bereich (Abrechnung, Aktenkonten und Fremdgeld) sehen Sie als {rollenLabel(user)} nicht – bitte wenden Sie sich an Ihre Kanzleiverwaltung (Partner oder Administration).
      </p>
      <Button variant="primary" className="mt-5" onClick={() => nav("/cockpit")}>
        Zum Cockpit
      </Button>
    </div>
  );
}
