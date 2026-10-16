// Fremdgeld weiterleiten (§ 43a Abs. 7 BRAO, § 4 BORA): Empfänger, IBAN mit Prüfziffer, Betrag, Verwendungszweck und Wirkung –
// SEPA-Überweisungsdatei (pain.001) zur Freigabe im Online-Banking oder „bereits überwiesen am …“. Rückgängig per Stornobuchung.
import { useEffect, useState } from "react";
import { ArrowRightLeft, FileCode2, Landmark, ShieldAlert } from "lucide-react";
import type { Akte, Kontakt } from "@/core/types";
import { fmtDate, fmtEUR, fmtNum, round2, today } from "@/core/dates";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Field, Input, Modal } from "@/components/ui";
import { cn } from "@/lib/cn";
import { DateiDialog, type AusgabeDatei } from "@/pages/fristen/dateiAusgabe";
import { leiteFremdgeldWeiter, sepaPain001, storniereWeiterleitung } from "./aktionen";
import { ibanFormatiert, ibanGueltig, ibanKompakt, parseBetrag } from "./lib";

type Wirkung = "sepa-datei" | "bereits-ueberwiesen";

export function WeiterleitungsDialog({ akte, mandant, offen, open, onClose }: { akte?: Akte; mandant?: Kontakt; offen: number; open: boolean; onClose: () => void }) {
  const { user, tenant } = useKanzlei();
  const [empfaenger, setEmpfaenger] = useState("");
  const [iban, setIban] = useState("");
  const [betrag, setBetrag] = useState("");
  const [zweck, setZweck] = useState("");
  const [wirkung, setWirkung] = useState<Wirkung>("sepa-datei");
  const [am, setAm] = useState(today());
  const [zeigeFehler, setZeigeFehler] = useState(false);
  const [datei, setDatei] = useState<AusgabeDatei | null>(null);

  useEffect(() => {
    if (!open || !akte) return;
    setEmpfaenger(mandant?.name ?? "");
    setIban("");
    setBetrag(fmtNum(offen, 2));
    setZweck(`Weiterleitung Fremdgeld – unser Zeichen ${akte.aktenzeichen} – ${akte.titel}`.slice(0, 140));
    setWirkung("sepa-datei");
    setAm(today());
    setZeigeFehler(false);
  }, [open, akte?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const wert = round2(parseBetrag(betrag));
  const ibanOk = ibanGueltig(iban);
  const fehler = !empfaenger.trim()
    ? "Bitte den Empfänger eintragen."
    : !iban.trim()
      ? "Bitte die IBAN des Empfängers eintragen (Pflicht)."
      : !ibanOk
        ? "Die IBAN ist ungültig – Prüfziffer oder Länge stimmen nicht."
        : !(wert > 0)
          ? "Bitte einen Betrag eingeben."
          : wert > offen + 0.004
            ? `Höchstens ${fmtEUR(offen)} – mehr Fremdgeld liegt für diese Akte nicht vor.`
            : !zweck.trim()
              ? "Bitte einen Verwendungszweck eintragen."
              : wirkung === "bereits-ueberwiesen" && !/^\d{4}-\d{2}-\d{2}$/.test(am)
                ? "Bitte das Datum der Überweisung eintragen."
                : undefined;

  const buchen = () => {
    if (!akte) return;
    if (fehler) {
      setZeigeFehler(true);
      return;
    }
    const res = leiteFremdgeldWeiter(akte, wert, { empfaenger: empfaenger.trim(), iban: ibanKompakt(iban), verwendungszweck: zweck.trim(), wirkung, ueberwiesenAm: am }, user.id);
    onClose();
    if (wirkung === "sepa-datei") {
      setDatei({
        name: `SEPA_Fremdgeld_${akte.aktenzeichen.replace("/", "-")}_${today()}.xml`,
        mime: "application/xml",
        inhalt: sepaPain001({ betrag: wert, empfaenger: empfaenger.trim(), iban, verwendungszweck: zweck.trim(), kanzlei: tenant.name, ausfuehrung: today() }),
        beschreibung: "SEPA-Überweisung pain.001 – im Online-Banking des Anderkontos hochladen und freigeben",
      });
    }
    toast("Fremdgeld-Weiterleitung gebucht", {
      text: `${fmtEUR(wert)} an ${empfaenger.trim()} · ${wirkung === "sepa-datei" ? "SEPA-Datei zur Freigabe erzeugt" : `überwiesen am ${fmtDate(am)}`} · im Aktenkonto und Protokoll`,
      ton: "erfolg",
      aktion: { label: "Rückgängig", onClick: () => storniereWeiterleitung(res.buchungId, user.id) },
    });
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Fremdgeld weiterleiten"
        subtitle={akte ? `${akte.aktenzeichen} · ${akte.titel} · offen ${fmtEUR(offen)}` : undefined}
        icon={<ArrowRightLeft className="size-[18px]" />}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Abbrechen
            </Button>
            <Button variant="primary" icon={wirkung === "sepa-datei" ? <FileCode2 className="size-4" /> : <Landmark className="size-4" />} onClick={buchen} aria-describedby={zeigeFehler && fehler ? "wl-fehler" : undefined}>
              {wirkung === "sepa-datei" ? "Buchen und SEPA-Datei erzeugen" : "Als überwiesen buchen"}
            </Button>
          </>
        }
      >
        <div className="grid gap-3.5">
          <p className="flex items-start gap-2 rounded-[14px] bg-amber-soft px-3.5 py-2.5 text-[12.5px] text-fg-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber" />
            <span>Fremdgeld unverzüglich weiterleiten (§ 43a Abs. 7 BRAO, § 4 BORA). AnwaltApex leitet nie selbstständig weiter – die Überweisung geben Sie im Online-Banking frei.</span>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Empfänger *" htmlFor="wl-empfaenger">
              <Input id="wl-empfaenger" value={empfaenger} onChange={(e) => setEmpfaenger(e.target.value)} autoComplete="off" />
            </Field>
            <Field
              label="IBAN *"
              htmlFor="wl-iban"
              hint={iban.trim() ? (ibanOk ? <span className="text-green">Prüfziffer korrekt</span> : <span className="text-seal">Prüfziffer oder Länge stimmt nicht</span>) : "Pflicht – wird mit Prüfziffer geprüft"}
            >
              <Input id="wl-iban" value={iban} onChange={(e) => setIban(e.target.value)} onBlur={() => ibanOk && setIban(ibanFormatiert(iban))} placeholder="DE00 0000 0000 0000 0000 00" className="mono" autoComplete="off" inputMode="text" />
            </Field>
            <Field label="Betrag (€) *" htmlFor="wl-betrag" hint={`offen: ${fmtEUR(offen)}`}>
              <Input id="wl-betrag" value={betrag} onChange={(e) => setBetrag(e.target.value)} inputMode="decimal" className="num" />
            </Field>
            <Field label="Verwendungszweck *" htmlFor="wl-zweck" hint="Höchstens 140 Zeichen (SEPA)">
              <Input id="wl-zweck" value={zweck} maxLength={140} onChange={(e) => setZweck(e.target.value)} />
            </Field>
          </div>
          <fieldset>
            <legend className="label">Wirkung</legend>
            <div className="grid gap-2" role="radiogroup" aria-label="Wirkung der Weiterleitung">
              {(
                [
                  ["sepa-datei", "SEPA-Überweisungsdatei erzeugen", "pain.001 – Freigabe im Online-Banking des Anderkontos"],
                  ["bereits-ueberwiesen", "Bereits überwiesen", "Die Überweisung ist schon erfolgt – nur buchen"],
                ] as const
              ).map(([w, titel, sub]) => (
                <button
                  key={w}
                  type="button"
                  role="radio"
                  aria-checked={wirkung === w}
                  onClick={() => setWirkung(w)}
                  className={cn(
                    "min-h-11 rounded-[14px] px-3.5 py-2.5 text-left ring-1 ring-inset transition-colors",
                    wirkung === w ? "bg-ink-soft text-fg ring-transparent" : "text-fg-2 ring-[var(--line)] hover:bg-ink-softer",
                  )}
                >
                  <span className="block text-[13.5px] font-semibold">{titel}</span>
                  <span className="block text-[12.5px] text-fg-3">{sub}</span>
                </button>
              ))}
            </div>
          </fieldset>
          {wirkung === "bereits-ueberwiesen" && (
            <Field label="Überwiesen am" htmlFor="wl-am">
              <Input id="wl-am" type="date" value={am} max={today()} onChange={(e) => setAm(e.target.value)} />
            </Field>
          )}
          {zeigeFehler && fehler && (
            <p id="wl-fehler" role="alert" className="rounded-[12px] bg-seal-soft px-3 py-2 text-[13px] font-medium text-seal">
              {fehler}
            </p>
          )}
          <p className="text-[12.5px] text-fg-3">Die Weiterleitung steht mit Empfänger, IBAN und Wirkung im Aktenkonto und im Protokoll. Rückgängig ist dort jederzeit per Stornobuchung möglich.</p>
        </div>
      </Modal>
      <DateiDialog datei={datei} onClose={() => setDatei(null)} />
    </>
  );
}
