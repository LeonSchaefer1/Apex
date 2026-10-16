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
    <div className="sheet mx-auto mt-10 max-w-[560px] rounded-[24px] p-6 text-center sm:p-8" role="alert">
      <span className="mx-auto grid size-12 place-items-center rounded-[16px] bg-amber-soft text-amber">
        <ShieldOff className="size-6" />
      </span>
      <h1 className="title-lg mt-4">Kein Zugriff für Ihre Rolle</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-fg-2">
        Diesen Bereich (Abrechnung, Aktenkonten und Fremdgeld) sehen Sie als {rollenLabel(user)} nicht – bitte wenden Sie sich an Ihre Kanzleiverwaltung (Partner oder Administration).
      </p>
      <Button variant="primary" className="mt-5" onClick={() => nav("/cockpit")}>
        Zum Cockpit
      </Button>
    </div>
  );
}
