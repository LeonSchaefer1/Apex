// Rückfrage vor dem Stellen einer Rechnung (I3-T07-03): nennt die nächste Rechnungsnummer, warnt vor fehlenden Pflichtangaben
// (§ 14 Abs. 4 UStG) und sperrt das Stellen in Kundenkanzleien bzw. im Serverbetrieb, bis das Kanzleiprofil ergänzt ist.
// In Präsentationskanzleien bleibt Stellen mit Pflichthäkchen möglich, damit Storno, Zeithonorar und Sammelabrechnung vorführbar sind.
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { AlertTriangle, Lock, Send } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { fehlendeRechnungsangaben } from "@/core/abrechnung";
import { useCol } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { fehlendKurz, naechsteNummern, stellenErlaubt, stellenTitel } from "./lib";

/** Link ins Kanzleiprofil, Abschnitt Rechnungsangaben (A-16). */
export const RECHNUNGSANGABEN_LINK = "/einstellungen?tab=kanzlei&abschnitt=rechnung";

export function StellenDialog({
  open,
  anzahl,
  onClose,
  onStellen,
  zusatz,
}: {
  open: boolean;
  /** Anzahl der Rechnungen, die jetzt endgültige Nummern erhalten */
  anzahl: number;
  onClose: () => void;
  onStellen: () => void;
  /** z. B. Filter der Sammelabrechnung oder Zuordnung des Bankumsatzes */
  zusatz?: ReactNode;
}) {
  const { tenant, betrieb } = useKanzlei();
  const rechnungen = useCol("rechnungen");
  const praesentation = betrieb?.praesentation === true;
  const fehlend = fehlendeRechnungsangaben(tenant);
  const nummern = naechsteNummern(rechnungen, Math.max(1, anzahl));
  const [haekchen, setHaekchen] = useState(false);
  useEffect(() => {
    if (open) setHaekchen(false);
  }, [open]);
  const erlaubt = stellenErlaubt(fehlend, praesentation, haekchen);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      icon={<Send className="size-[18px]" />}
      title={stellenTitel(nummern)}
      footer={
        <>
          {/* Anfangsfokus auf der sicheren Wahl – Enter stellt nichts versehentlich */}
          <Button variant="ghost" onClick={onClose} data-autofocus>
            Abbrechen
          </Button>
          <Button
            variant="primary"
            icon={!erlaubt && fehlend.length && !praesentation ? <Lock className="size-4" /> : undefined}
            disabled={!erlaubt}
            onClick={() => {
              if (!erlaubt) return;
              onStellen();
            }}
          >
            {anzahl > 1 ? `${anzahl} Rechnungen stellen` : "Rechnung stellen"}
          </Button>
        </>
      }
    >
      <p className="text-[14px] text-fg-2">
        {anzahl > 1
          ? `Danach sind die Rechnungen festgeschrieben – Änderungen nur noch per Storno. Sie erhalten die nächsten fortlaufenden Nummern (${nummern[0]} bis ${nummern[nummern.length - 1]}), werden im Aktenkonto gebucht und in der E-Akte abgelegt.`
          : `Danach ist die Rechnung festgeschrieben – Änderungen nur noch per Storno. Sie erhält die nächste fortlaufende Nummer (${nummern[0]}), wird im Aktenkonto gebucht und in der E-Akte abgelegt.`}
      </p>
      {zusatz && <div className="mt-2 text-[13px] text-fg-2">{zusatz}</div>}
      {fehlend.length > 0 && (
        <div role="alert" className="mt-4 grid gap-2 rounded-md bg-[var(--seal-soft)] p-3.5 text-[13px] leading-[18px] text-seal-text">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong className="font-semibold">{fehlendKurz(fehlend)}</strong> –{" "}
              <Link to={RECHNUNGSANGABEN_LINK} className="font-semibold underline" onClick={onClose}>
                Kanzleiprofil ergänzen
              </Link>
              .{" "}
              {praesentation
                ? "In dieser Präsentationskanzlei stehen auf der Rechnung gekennzeichnete Platzhalter."
                : "Ohne diese Angaben ist die Rechnung nicht ordnungsgemäß – Stellen ist gesperrt, bis das Kanzleiprofil ergänzt ist."}
            </span>
          </div>
          {praesentation && (
            <label className="flex min-h-11 items-start gap-2 font-medium">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--seal)]" checked={haekchen} onChange={(e) => setHaekchen(e.target.checked)} />
              <span>Präsentationskanzlei – Platzhalter bleiben auf der Rechnung gekennzeichnet</span>
            </label>
          )}
        </div>
      )}
    </Modal>
  );
}
