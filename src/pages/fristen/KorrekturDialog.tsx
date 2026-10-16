// „Korrigieren …“: notierte Frist neu berechnen (Fristart und Ereignisdatum über den Fristenrechner) oder das Datum direkt
// setzen – immer mit Pflichtgrund. Der vorherige Stand bleibt erhalten, die Vier-Augen-Kontrolle ist danach wieder offen.
// „Korrektur anfordern“: die Kontrolleurin gibt die Frist mit Grund an die Verantwortliche zurück.
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Calculator, PenLine, Undo2 } from "lucide-react";
import { addDays, diffDays, fmtDate, fmtDateWd } from "@/core/dates";
import { FRIST_REGELN, berechneNachRegel, gerichtsortDerAkte } from "@/core/fristen";
import type { Frist, User } from "@/core/types";
import { useCol } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Field, Input, Modal, Segmented, Select, Textarea } from "@/components/ui";
import { RechenwegListe } from "./FristZeile";
import { TYP_META, fordereKorrekturAn, korrigiereFrist, type FristKorrektur } from "./logik";

const berechenbar = FRIST_REGELN.filter((r) => !r.dauerPflicht && r.festesDatum !== "pflicht");

export function KorrekturDialog({ f, user, open, onClose }: { f: Frist; user: User; open: boolean; onClose: () => void }) {
  const { tenant } = useKanzlei();
  const akten = useCol("akten");
  const kontakte = useCol("kontakte");
  const akte = akten.find((a) => a.id === f.akteId);
  const land = gerichtsortDerAkte(akte, kontakte)?.land ?? tenant.bundesland;
  const mitRegel = !!f.regelKey && berechenbar.some((r) => r.key === f.regelKey);
  const [modus, setModus] = useState<"rechner" | "datum">(mitRegel ? "rechner" : "datum");
  const [regelKey, setRegelKey] = useState(f.regelKey ?? "");
  const [ereignis, setEreignis] = useState(f.ereignisDatum ?? "");
  const [datum, setDatum] = useState(f.datum);
  const [grund, setGrund] = useState("");
  useEffect(() => {
    if (!open) return;
    setModus(mitRegel ? "rechner" : "datum");
    setRegelKey(f.regelKey ?? "");
    setEreignis(f.ereignisDatum ?? "");
    setDatum(f.datum);
    setGrund("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, f.id]);

  const erg = useMemo(() => {
    if (modus !== "rechner" || !regelKey || !/^\d{4}-\d{2}-\d{2}$/.test(ereignis)) return null;
    try {
      return berechneNachRegel(regelKey, ereignis, land, undefined, { kanzleiLand: tenant.bundesland });
    } catch {
      return null;
    }
  }, [modus, regelKey, ereignis, land, tenant.bundesland]);

  const neu: FristKorrektur | null =
    modus === "rechner"
      ? erg
        ? {
            datum: erg.ende,
            vorfrist: erg.vorfrist,
            ereignisDatum: ereignis,
            regelKey,
            titel: regelKey !== f.regelKey ? erg.regel.titel : undefined,
            grundlage: erg.regel.grundlage,
            rechenweg: erg.rechenweg,
            typ: erg.regel.typ,
          }
        : null
      : /^\d{4}-\d{2}-\d{2}$/.test(datum)
        ? {
            datum,
            // Vorfrist im gleichen Abstand mitverschieben
            vorfrist: f.vorfrist ? addDays(f.vorfrist, diffDays(f.datum, datum)) : undefined,
            rechenweg: [...(f.rechenweg ?? []), `Fristende von Hand korrigiert auf ${fmtDateWd(datum)} (vorher ${fmtDateWd(f.datum)}).`],
          }
        : null;
  const fehlt = !neu ? (modus === "rechner" ? "Bitte Fristart und Ereignisdatum angeben." : "Bitte das neue Datum angeben.") : !grund.trim() ? "Bitte den Grund der Korrektur angeben (Pflicht)." : undefined;

  const speichern = () => {
    if (!neu || fehlt) return;
    korrigiereFrist(f, user.id, neu, grund);
    onClose();
    toast("Frist korrigiert", { text: `${f.titel}: ${fmtDate(f.datum)} → ${fmtDate(neu.datum)} · Vier-Augen-Kontrolle wieder offen`, ton: "erfolg" });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`${TYP_META[f.typ].label} korrigieren`}
      subtitle={`${f.titel} · bisher ${fmtDateWd(f.datum)}`}
      icon={<PenLine className="size-[18px]" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" disabled={!!fehlt} onClick={speichern}>
            Korrektur speichern
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {f.korrekturAngefordert && (
          <p className="rounded-[14px] bg-amber-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-fg-2">
            <strong className="font-semibold text-fg">Korrektur angefordert:</strong> {f.korrekturAngefordert.grund}
          </p>
        )}
        {(f.typ === "notfrist" || f.typ === "frist") && (
          <Segmented
            size="sm"
            value={modus}
            onChange={setModus}
            options={[
              { value: "rechner", label: "Neu berechnen (Fristenrechner)" },
              { value: "datum", label: "Datum direkt setzen" },
            ]}
          />
        )}
        {modus === "rechner" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fristart" htmlFor="korr-regel">
              <Select id="korr-regel" value={regelKey} onChange={(e) => setRegelKey(e.target.value)}>
                <option value="">Fristart wählen …</option>
                {berechenbar.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.titel} ({r.grundlage})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={FRIST_REGELN.find((r) => r.key === regelKey)?.ereignis ?? "Ereignisdatum"} htmlFor="korr-ereignis">
              <Input id="korr-ereignis" type="date" value={ereignis} onChange={(e) => setEreignis(e.target.value)} />
            </Field>
          </div>
        ) : (
          <Field label="Neues Datum" htmlFor="korr-datum" hint={f.vorfrist ? "Die Vorfrist wird im gleichen Abstand verschoben." : undefined}>
            <Input id="korr-datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
          </Field>
        )}
        {neu && (
          <div className="rounded-[16px] bg-ink-softer p-3.5 ring-1 ring-inset ring-[var(--line)]">
            <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
              <span className="num text-fg-3 line-through">{fmtDateWd(f.datum)}</span>
              <ArrowRight className="size-4 text-fg-3" aria-hidden />
              <span className="num font-semibold text-fg">{fmtDateWd(neu.datum)}</span>
              {neu.vorfrist && <span className="num text-[12.5px] text-fg-3">· Vorfrist {fmtDateWd(neu.vorfrist)}</span>}
            </div>
            {modus === "rechner" && erg && (
              <div className="mt-3">
                <div className="eyebrow mb-2 inline-flex items-center gap-1.5">
                  <Calculator className="size-3.5" /> Rechenweg
                </div>
                <RechenwegListe schritte={erg.rechenweg} />
              </div>
            )}
          </div>
        )}
        <Field label="Grund der Korrektur (Pflicht)" htmlFor="korr-grund">
          <Textarea id="korr-grund" rows={2} value={grund} onChange={(e) => setGrund(e.target.value)} placeholder="z. B. Zustellung laut eEB erst am 19.10.2026" />
        </Field>
        {fehlt && <p className="text-[12.5px] text-fg-3" role="status">{fehlt}</p>}
        <p className="text-[12.5px] text-fg-3">Der vorherige Stand bleibt nachvollziehbar gespeichert; die Korrektur steht im Verlauf der Akte. Danach ist die Vier-Augen-Kontrolle wieder offen.</p>
      </div>
    </Modal>
  );
}

/** Kontrolle: Frist mit Grund an die verantwortliche Person zurückgeben. */
export function KorrekturAnfordernDialog({ f, user, open, onClose, verantwortlich }: { f: Frist; user: User; open: boolean; onClose: () => void; verantwortlich?: User }) {
  const [grund, setGrund] = useState("");
  useEffect(() => {
    if (open) setGrund("");
  }, [open]);
  const senden = () => {
    if (!grund.trim()) return;
    fordereKorrekturAn(f, user.id, grund);
    onClose();
    toast("Korrektur angefordert", { text: `${verantwortlich?.name ?? "Die verantwortliche Person"} sieht den Hinweis an der Frist.`, ton: "erfolg" });
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Korrektur anfordern"
      subtitle={`${f.titel} · ${fmtDateWd(f.datum)}`}
      icon={<Undo2 className="size-[18px]" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" disabled={!grund.trim()} onClick={senden}>
            Zurück an {verantwortlich?.name ?? "Verantwortliche"}
          </Button>
        </>
      }
    >
      <Field label="Was ist zu korrigieren? (Pflicht)" htmlFor="korr-anf-grund">
        <Textarea id="korr-anf-grund" rows={3} value={grund} onChange={(e) => setGrund(e.target.value)} placeholder="z. B. Zustellung laut eEB am 19.10., nicht am 16.10. – Fristende neu berechnen" />
      </Field>
      <p className="mt-3 text-[12.5px] text-fg-3">Die Frist bleibt bis zur Korrektur unkontrolliert; der Hinweis erscheint an der Frist und im Verlauf.</p>
    </Modal>
  );
}
