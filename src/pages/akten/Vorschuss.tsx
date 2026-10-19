// „Vorschuss anfordern (§ 9 RVG)“ aus der Akte: Vorschussrechnung an den Mandanten mit RSV-Aufteilung, dazu der Entwurf
// „Zahlungsaufforderung an <RSV>“ mit Versicherungs- und Schadennummer in der E-Akte. Höchstens drei Aktionen.
import { useMemo } from "react";
import { FileText, HandCoins, ShieldCheck } from "lucide-react";
import type { Akte } from "@/core/types";
import { fmtEUR } from "@/core/dates";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Modal } from "@/components/ui";
import { baueRechnung, legeRechnungAn } from "@/pages/abrechnung/aktionen";
import { entwurfsKennung, FASSUNG_LABEL, formatVorbelegung, naechsteNummern, rsvAufteilung, rsvBlockText, vorschussVorschlag } from "@/pages/abrechnung/lib";
import { beruehreAkte, useKontaktMap } from "./helfer";

export function VorschussDialog({ akte, open, onClose }: { akte: Akte; open: boolean; onClose: () => void }) {
  const rechnungen = useCol("rechnungen");
  const kontakte = useKontaktMap();
  const { user } = useKanzlei();
  const mandant = kontakte.get(akte.mandantId);
  const vorschlag = useMemo(() => vorschussVorschlag(akte, rechnungen.filter((r) => r.akteId === akte.id)), [akte, rechnungen]);
  const ok = "positionen" in vorschlag;
  const rsv = ok ? rsvAufteilung(akte, vorschlag.summen.brutto) : undefined;

  const anlegen = (status: "entwurf" | "gestellt") => {
    if (!ok) return;
    const alle = useData.getState().data.rechnungen;
    const r = baueRechnung({
      nummer: status === "gestellt" ? naechsteNummern(alle, 1)[0] : entwurfsKennung(alle),
      akte,
      positionen: vorschlag.positionen,
      summen: vorschlag.summen,
      format: formatVorbelegung(mandant),
      status,
      vorschuss: true,
    });
    legeRechnungAn(r, user.id);
    useData.getState().log({
      akteur: "nutzer",
      userId: user.id,
      akteId: akte.id,
      text: `Vorschussrechnung nach § 9 RVG ${status === "gestellt" ? `${r.nummer} gestellt` : `als Entwurf angelegt (${r.nummer})`} über ${fmtEUR(r.brutto)}${r.rsv ? ` – davon ${r.rsv.versicherung} ${fmtEUR(r.rsv.anteilVersicherung)}, Selbstbeteiligung ${fmtEUR(r.rsv.selbstbeteiligung)}` : ""} – ${akte.aktenzeichen}`,
    });
    beruehreAkte(akte.id);
    onClose();
    toast(status === "gestellt" ? "Vorschussrechnung gestellt" : "Vorschussrechnung als Entwurf angelegt", {
      text: `${r.nummer} · ${fmtEUR(r.brutto)}${r.rsv && status === "gestellt" ? ` · Zahlungsaufforderung an ${r.rsv.versicherung} als Entwurf in der E-Akte` : ""}`,
      ton: "erfolg",
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Vorschuss anfordern (§ 9 RVG)"
      subtitle={`${akte.aktenzeichen} · ${akte.titel}`}
      icon={<HandCoins className="size-[18px]" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className="mr-auto">
            Abbrechen
          </Button>
          <Button variant="secondary" disabled={!ok} onClick={() => anlegen("entwurf")}>
            Als Entwurf anlegen
          </Button>
          <Button variant="primary" icon={<HandCoins className="size-4" />} disabled={!ok} onClick={() => anlegen("gestellt")}>
            Vorschussrechnung stellen
          </Button>
        </>
      }
    >
      {!ok ? (
        <p className="rounded-lg bg-amber-soft px-3.5 py-3 text-[13px] text-fg-2">{vorschlag.grund}</p>
      ) : (
        <div className="grid gap-3.5 text-[13px]">
          <p className="text-fg-2">
            Vorschussrechnung an <span className="font-semibold text-fg">{mandant?.name ?? "den Mandanten"}</span> (Leistungsempfänger, § 14 UStG) auf die entstandenen und voraussichtlich entstehenden Gebühren – Gegenstandswert{" "}
            {fmtEUR(akte.gegenstandswert)}, RVG {FASSUNG_LABEL[vorschlag.fassung]}.
          </p>
          <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-lg ring-1 ring-[var(--line)]">
            {vorschlag.positionen.map((p, i) => (
              <li key={i} className="flex items-baseline gap-3 px-3.5 py-2">
                <span className="mono w-11 shrink-0 text-[13px] text-fg-3">{p.vv}</span>
                <span className="min-w-0 flex-1 break-words">{p.bezeichnung}</span>
                <span className="num shrink-0 font-medium">{fmtEUR(p.betrag)}</span>
              </li>
            ))}
            <li className="flex items-baseline gap-3 bg-ink-softer px-3.5 py-2">
              <span className="min-w-0 flex-1 font-semibold">Gesamt brutto (inkl. 19 % USt.)</span>
              <span className="num shrink-0 font-semibold">{fmtEUR(vorschlag.summen.brutto)}</span>
            </li>
          </ul>
          {rsv ? (
            <div className="flex items-start gap-2 rounded-md bg-[var(--surface-2)] px-3.5 py-2.5 text-fg-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink" />
              <span>
                {rsvBlockText(rsv, fmtEUR)}.
                <span className="mt-1 flex items-start gap-1.5 text-[13px] text-fg-3">
                  <FileText className="mt-0.5 size-3.5 shrink-0" />
                  Beim Stellen entsteht in der E-Akte der Entwurf „Zahlungsaufforderung an {rsv.versicherung}“ mit Versicherungs- und Schadennummer.
                </span>
              </span>
            </div>
          ) : (
            <p className="text-[13px] text-fg-3">Keine Rechtsschutzversicherung mit Deckung hinterlegt – der Mandant zahlt den Vorschuss selbst.</p>
          )}
          <p className="text-[13px] text-fg-3">Elektronischer Austausch mit Rechtsschutzversicherern (drebis): im Prototyp nicht angebunden – Versand per E-Mail oder Brief.</p>
        </div>
      )}
    </Modal>
  );
}
