// Rechnungsvorschau als Papier mit Kanzlei-Briefkopf – inkl. Stellen, Storno und Zahlungserfassung.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Ban, BadgeCheck, Banknote, FileCode2, Receipt, Send, Trash2 } from "lucide-react";
import { Button, Drawer, Field, Input, confirmDialog } from "@/components/ui";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { fmtDate, fmtEUR, fmtNum, today } from "@/core/dates";
import { fassungFuerAuftrag } from "@/core/rvg";
import type { Akte, Kontakt, Rechnung, RechnungsPosition, Tenant, User } from "@/core/types";
import { cn } from "@/lib/cn";
import { erfasseZahlung, sendeZahlungserinnerungen, stelleRechnung, storniereRechnung } from "./aktionen";
import { FASSUNG_LABEL, fmtSatz, istOffen, leistungszeitraum, offenerBetrag, parseBetrag } from "./lib";
import { Anschrift, Betrag, Briefkopf, FormatChip, InfoZeile, StatusChip, useLookups } from "./ui";

function vvAnzeige(vv: string) {
  if (vv === "Std") return "Zeit";
  if (vv.startsWith("Vorb.")) return "Vorb. 3 IV";
  return vv;
}

function PositionZeile({ p }: { p: RechnungsPosition }) {
  const std = p.vv === "Std";
  const satz = std ? `${fmtSatz(p.menge ?? 0)} Std.` : p.satz !== undefined ? fmtSatz(p.satz) : "";
  const wert = std ? (p.menge ? `à ${fmtEUR(p.betrag / p.menge)}` : "") : p.gegenstandswert ? fmtEUR(p.gegenstandswert) : "";
  return (
    <tr className="border-b border-black/[0.07] align-top">
      <td className="mono py-2 pr-2 text-[11.5px] opacity-70">{vvAnzeige(p.vv)}</td>
      <td className="py-2 pr-3">{p.bezeichnung}</td>
      <td className="num whitespace-nowrap py-2 pr-3 text-right">{satz}</td>
      <td className="num hidden whitespace-nowrap py-2 pr-3 text-right opacity-70 sm:table-cell">{wert}</td>
      <td className={cn("num whitespace-nowrap py-2 text-right font-medium", p.betrag < 0 && "opacity-75")}>{fmtEUR(p.betrag)}</td>
    </tr>
  );
}

/** Die Rechnung auf Papier – Aufbau nach DIN 5008 mit Pflichtangaben nach § 10 RVG und § 14 UStG. */
export function RechnungPapier({ r, akte, empfaenger, tenant, bearbeiter }: { r: Rechnung; akte?: Akte; empfaenger?: Kontakt; tenant: Tenant; bearbeiter?: User }) {
  const [von, bis] = leistungszeitraum(akte, r);
  const rvg = r.positionen.some((p) => /^\d{4}$/.test(p.vv) && p.vv !== "7002");
  const fassung = akte ? fassungFuerAuftrag(akte.createdAt.slice(0, 10)) : "2025";
  const wert = r.positionen.find((p) => p.gegenstandswert)?.gegenstandswert ?? akte?.gegenstandswert;
  return (
    <div className="paper relative overflow-hidden px-5 py-6 sm:px-10 sm:py-9">
      {r.status === "entwurf" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="-rotate-[24deg] text-[86px] font-black tracking-[0.12em] opacity-[0.05] sm:text-[120px]">ENTWURF</span>
        </div>
      )}
      <Briefkopf tenant={tenant} />

      <div className="mt-2 grid gap-6 sm:grid-cols-[1fr_260px]">
        <Anschrift k={empfaenger} />
        <div className="sm:pt-1">
          <InfoZeile k="Rechnungsnummer" v={r.nummer} mono />
          <InfoZeile k="Rechnungsdatum" v={fmtDate(r.datum)} />
          <InfoZeile k="Leistungszeitraum" v={`${fmtDate(von)} – ${fmtDate(bis)}`} />
          {akte && <InfoZeile k="Unser Zeichen" v={akte.aktenzeichen} mono />}
          {bearbeiter && <InfoZeile k="Bearbeitung" v={bearbeiter.name} />}
        </div>
      </div>

      <div className="relative mt-8">
        {(r.status === "storniert" || r.status === "bezahlt") && (
          <motion.div
            initial={{ scale: 1.6, opacity: 0, rotate: -14 }}
            animate={{ scale: 1, opacity: 1, rotate: -9 }}
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
            className={cn(
              "pointer-events-none absolute -top-1 right-0 rounded-[8px] border-[2.5px] border-current px-3 py-1 text-center font-black uppercase tracking-[0.14em]",
              r.status === "storniert" ? "text-seal" : "text-green",
            )}
          >
            <div className="text-[18px] leading-none">{r.status === "storniert" ? "Storniert" : "Bezahlt"}</div>
            {r.status === "bezahlt" && r.bezahltAm && <div className="mt-1 text-[9px] font-bold tracking-[0.1em]">am {fmtDate(r.bezahltAm)}</div>}
          </motion.div>
        )}
        <div className="text-[19px] font-semibold tracking-[-0.02em]">Rechnung</div>
        {akte && (
          <div className={cn("mt-1 text-[12.5px] opacity-75", (r.status === "storniert" || r.status === "bezahlt") && "pr-32")}>
            In Sachen {akte.titel}
            {wert ? ` · Gegenstandswert ${fmtEUR(wert)}` : ""}
          </div>
        )}
      </div>

      <table className="mt-5 w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-black/15 text-left text-[10.5px] uppercase tracking-[0.06em] opacity-60">
            <th className="py-2 pr-2 font-semibold">Nr. VV</th>
            <th className="py-2 pr-3 font-semibold">Gebührentatbestand</th>
            <th className="py-2 pr-3 text-right font-semibold">Satz</th>
            <th className="hidden py-2 pr-3 text-right font-semibold sm:table-cell">Gegenstandswert</th>
            <th className="py-2 text-right font-semibold">Betrag</th>
          </tr>
        </thead>
        <tbody>
          {r.positionen.map((p, i) => (
            <PositionZeile key={i} p={p} />
          ))}
        </tbody>
      </table>

      <div className="ml-auto mt-4 w-full max-w-[300px] text-[12.5px]">
        <div className="flex justify-between py-1">
          <span className="opacity-65">Summe netto</span>
          <span className="num">{fmtEUR(r.netto)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="opacity-65">19 % Umsatzsteuer (Nr. 7008 VV RVG)</span>
          <span className="num">{fmtEUR(r.ust)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-black/20 pt-2 text-[14px] font-semibold">
          <span>Gesamtbetrag</span>
          <span className="num">{fmtEUR(r.brutto)}</span>
        </div>
        {r.bezahlt > 0 && r.status !== "storniert" && (
          <>
            <div className="flex justify-between py-1 opacity-70">
              <span>bereits gezahlt</span>
              <span className="num">−{fmtEUR(r.bezahlt)}</span>
            </div>
            <div className="flex justify-between py-1 font-semibold">
              <span>noch offen</span>
              <span className="num">{fmtEUR(Math.max(0, r.brutto - r.bezahlt))}</span>
            </div>
          </>
        )}
      </div>

      <div className="mt-7 space-y-2 text-[12px] leading-relaxed">
        <p>
          Bitte überweisen Sie den Gesamtbetrag bis zum <strong>{fmtDate(r.faellig)}</strong> ohne Abzug und geben Sie als Verwendungszweck die Rechnungsnummer{" "}
          <span className="mono font-medium">{r.nummer}</span> an.
        </p>
        <div className="rounded-[6px] bg-black/[0.035] px-3 py-2 text-[11.5px]">
          <span className="font-medium">Bankverbindung</span> · Geschäftskonto {tenant.kurzname} · IBAN <span className="mono">DE00 0000 0000 0000 0000 00</span> · BIC{" "}
          <span className="mono">XXXXDEXXXXX</span> <span className="opacity-55">(Platzhalter)</span>
        </div>
        {rvg && <p className="text-[11px] opacity-60">Abrechnung nach dem Rechtsanwaltsvergütungsgesetz, Gebührentabelle {FASSUNG_LABEL[fassung]} (§ 13 RVG, Übergangsrecht § 60 RVG).</p>}
      </div>

      <div className="mt-6 flex items-center gap-2 border-t border-black/10 pt-3 text-[10.5px] opacity-65">
        <FileCode2 className="size-3.5 shrink-0" />
        {r.format === "PDF" ? "E-Rechnung (XRechnung) verfügbar – strukturiert nach EN 16931." : `Diese Rechnung wird als ${r.format} (EN 16931) übermittelt; diese Ansicht dient der Lesbarkeit.`}
      </div>
    </div>
  );
}

export function RechnungVorschau({ id, onClose }: { id: string | null; onClose: () => void }) {
  const rechnungen = useCol("rechnungen");
  const { tenant, user } = useKanzlei();
  const { akten, kontakte, users } = useLookups();
  const aktuell = id ? rechnungen.find((x) => x.id === id) : undefined;
  const letzte = useRef<Rechnung | undefined>(undefined);
  if (aktuell) letzte.current = aktuell;
  const r = aktuell ?? letzte.current;
  const [zahlung, setZahlung] = useState(false);
  const [betrag, setBetrag] = useState("");
  const [datum, setDatum] = useState(today());

  useEffect(() => {
    setZahlung(false);
    setDatum(today());
  }, [id]);
  useEffect(() => {
    if (aktuell) setBetrag(fmtNum(offenerBetrag(aktuell), 2));
  }, [aktuell?.id, aktuell?.bezahlt]); // eslint-disable-line react-hooks/exhaustive-deps

  const akte = r ? akten.get(r.akteId) : undefined;
  const empfaenger = r ? kontakte.get(r.empfaengerId) : undefined;
  const bearbeiter = akte ? users.get(akte.bearbeiterId) : undefined;

  const stornieren = async () => {
    if (!r) return;
    const ok = await confirmDialog({
      titel: `Rechnung ${r.nummer} stornieren?`,
      text: "Die Rechnung wird storniert und im Aktenkonto durch eine Gegenbuchung ausgeglichen. Die Rechnungsnummer bleibt lückenlos erhalten.",
      bestaetigen: "Stornieren",
      gefahr: true,
    });
    if (!ok) return;
    storniereRechnung(r);
    useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: r.akteId, text: `Rechnung ${r.nummer} storniert – ${akte?.aktenzeichen ?? ""}`.trim() });
    toast("Rechnung storniert", { text: `${r.nummer} · Gegenbuchung über ${fmtEUR(r.brutto)} im Aktenkonto`, ton: "erfolg" });
  };

  const entwurfLoeschen = async () => {
    if (!r) return;
    const ok = await confirmDialog({ titel: "Entwurf löschen?", text: `Der Rechnungsentwurf ${r.nummer} wird endgültig entfernt.`, bestaetigen: "Löschen", gefahr: true });
    if (!ok) return;
    useData.getState().remove("rechnungen", r.id);
    onClose();
    toast("Entwurf gelöscht", { ton: "info" });
  };

  const stellen = () => {
    if (!r) return;
    stelleRechnung(r, user.id);
    useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: r.akteId, text: `Rechnung ${r.nummer} gestellt – ${akte?.aktenzeichen ?? ""}`.trim() });
    toast("Rechnung gestellt", { text: `${r.nummer} · fällig in 14 Tagen · im Aktenkonto gebucht`, ton: "erfolg" });
  };

  const buchen = () => {
    if (!r) return;
    const b = parseBetrag(betrag);
    if (b <= 0) {
      toast("Bitte einen Betrag eingeben", { text: "Zum Beispiel 250,00", ton: "warnung" });
      return;
    }
    const status = erfasseZahlung(r, b, datum || today());
    setZahlung(false);
    toast(status === "bezahlt" ? "Rechnung vollständig bezahlt" : "Teilzahlung erfasst", { text: `${fmtEUR(b)} auf ${r.nummer} gebucht`, ton: "erfolg" });
  };

  const erinnern = () => {
    if (!r) return;
    sendeZahlungserinnerungen([r], user.id);
    toast("Zahlungserinnerung versendet", { text: `${r.nummer} an ${empfaenger?.name ?? "Empfänger"}`, ton: "erfolg" });
  };

  const footer = r ? (
    r.status === "entwurf" ? (
      <>
        <Button variant="ghost" className="mr-auto !text-seal" icon={<Trash2 className="size-4" />} onClick={entwurfLoeschen}>
          Entwurf löschen
        </Button>
        <Button variant="primary" icon={<Send className="size-4" />} onClick={stellen}>
          Rechnung stellen
        </Button>
      </>
    ) : r.status === "storniert" ? (
      <Button variant="ghost" onClick={onClose}>
        Schließen
      </Button>
    ) : (
      <>
        <Button variant="ghost" className="mr-auto" icon={<Ban className="size-4" />} onClick={stornieren}>
          Stornieren
        </Button>
        {istOffen(r) && (
          <>
            <Button variant="secondary" icon={<Send className="size-4" />} onClick={erinnern} className="hidden sm:inline-flex">
              Zahlungserinnerung
            </Button>
            <Button variant="primary" icon={<Banknote className="size-4" />} onClick={() => setZahlung((z) => !z)}>
              Zahlung erfassen
            </Button>
          </>
        )}
      </>
    )
  ) : null;

  return (
    <Drawer
      open={!!aktuell}
      onClose={onClose}
      width={800}
      icon={<Receipt className="size-[18px]" />}
      title={<span className="mono">{r?.nummer}</span>}
      subtitle={akte ? `${akte.aktenzeichen} · ${akte.titel}` : undefined}
      footer={footer}
    >
      {r && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusChip r={r} />
            <FormatChip format={r.format} />
            <span className="text-[12.5px] text-fg-3">
              fällig {fmtDate(r.faellig)}
              {istOffen(r) && (
                <>
                  {" "}
                  · offen <Betrag n={offenerBetrag(r)} className="font-semibold text-fg" />
                </>
              )}
            </span>
          </div>

          <AnimatePresence initial={false}>
            {zahlung && istOffen(r) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
                className="overflow-hidden"
              >
                <div className="mb-4 rounded-[18px] bg-ink-softer p-4">
                  <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
                    <BadgeCheck className="size-4 text-ink" /> Zahlung erfassen
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <Field label="Betrag (€)" htmlFor="zahlung-betrag">
                      <Input id="zahlung-betrag" inputMode="decimal" value={betrag} onChange={(e) => setBetrag(e.target.value)} className="num" />
                    </Field>
                    <Field label="Zahlungsdatum" htmlFor="zahlung-datum">
                      <Input id="zahlung-datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
                    </Field>
                    <Button variant="primary" onClick={buchen}>
                      Zahlung buchen
                    </Button>
                  </div>
                  <p className="mt-2 text-[12px] text-fg-3">Ein geringerer Betrag wird als Teilzahlung gebucht; die Rechnung bleibt dann offen.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <RechnungPapier r={r} akte={akte} empfaenger={empfaenger} tenant={tenant} bearbeiter={bearbeiter} />
        </>
      )}
    </Drawer>
  );
}
