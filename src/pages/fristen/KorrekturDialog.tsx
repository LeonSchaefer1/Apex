// „Korrigieren …“: notierte Frist neu berechnen (Fristart und Ereignisdatum über den Fristenrechner) oder das Datum direkt
// setzen – immer mit Pflichtgrund. Der vorherige Stand bleibt erhalten, die Vier-Augen-Kontrolle ist danach wieder offen.
// „Korrektur anfordern“: die Kontrolleurin gibt die Frist mit Grund an die Verantwortliche zurück.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Calculator, Landmark, PenLine, Undo2 } from "lucide-react";
import { addDays, diffDays, fmtDate, fmtDateWd } from "@/core/dates";
import { FRIST_REGELN, feiertagsortFuerFrist } from "@/core/fristen";
import { BUNDESLAENDER, bundeslandName } from "@/core/feiertage";
import type { Bundesland, Frist, FristGerichtsort, User } from "@/core/types";
import { useCol } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Field, Input, Modal, Segmented, Select, Switch, Textarea } from "@/components/ui";
import { RechenwegListe } from "./FristZeile";
import { TYP_META, fordereKorrekturAn, korrekturNeuBerechnet, korrigiereFrist, type FristKorrektur } from "./logik";

const berechenbar = FRIST_REGELN.filter((r) => !r.dauerPflicht && r.festesDatum !== "pflicht");

export function KorrekturDialog({ f, user, open, onClose }: { f: Frist; user: User; open: boolean; onClose: () => void }) {
  const { tenant } = useKanzlei();
  const akten = useCol("akten");
  const kontakte = useCol("kontakte");
  const akte = akten.find((a) => a.id === f.akteId);
  // Gerichtsort wie bei der ursprünglichen Berechnung: gespeicherter Ort der Frist → Gericht der Akte → Kanzleisitz (I3-T03-02)
  const ortFrist = useMemo(() => feiertagsortFuerFrist(f, akte, kontakte, tenant.bundesland), [f, akte, kontakte, tenant.bundesland]);
  const ortText = ortFrist.feiertagsOrt ? `${bundeslandName(ortFrist.land)} (${ortFrist.feiertagsOrt})` : ortFrist.quelle === "hand" ? `${bundeslandName(ortFrist.land)} (von Hand gewählt)` : `${bundeslandName(ortFrist.land)} (Kanzleisitz – kein Gericht bekannt)`;
  // Abweichen nur bewusst – wie im Fristenrechner: Schalter, rote Warnung, Pflichthäkchen
  const [abweichend, setAbweichend] = useState(false);
  const [landWahl, setLandWahl] = useState<Bundesland | "">("");
  const [abweichendOk, setAbweichendOk] = useState(false);
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
    setAbweichend(false);
    setLandWahl("");
    setAbweichendOk(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, f.id]);

  const widerspruch = abweichend && !!landWahl && landWahl !== ortFrist.land;
  /** Ort für die Neuberechnung samt dem an der Frist zu speichernden Gerichtsort */
  const ort = useMemo((): { land: Bundesland; feiertagsOrt?: string; gerichtsort: FristGerichtsort } => {
    if (widerspruch && landWahl)
      return { land: landWahl, feiertagsOrt: `abweichend gewählt – ${ortFrist.feiertagsOrt ?? "bisheriger Ort"} liegt in ${bundeslandName(ortFrist.land)}`, gerichtsort: { land: landWahl, quelle: "hand" } };
    const gericht = ortFrist.feiertagsOrt?.replace(/ – laut Akte$/, "");
    return { land: ortFrist.land, feiertagsOrt: ortFrist.feiertagsOrt, gerichtsort: { land: ortFrist.land, ...(gericht ? { gericht } : {}), quelle: ortFrist.quelle } };
  }, [widerspruch, landWahl, ortFrist]);

  const neuRechner = useMemo(() => {
    if (modus !== "rechner" || !regelKey || !/^\d{4}-\d{2}-\d{2}$/.test(ereignis)) return null;
    try {
      return korrekturNeuBerechnet(f, regelKey, ereignis, ort, tenant.bundesland);
    } catch {
      return null;
    }
  }, [modus, regelKey, ereignis, ort, tenant.bundesland, f]);
  const erg = neuRechner;

  const neu: FristKorrektur | null =
    modus === "rechner"
      ? neuRechner
      : /^\d{4}-\d{2}-\d{2}$/.test(datum)
        ? {
            datum,
            // Vorfrist im gleichen Abstand mitverschieben
            vorfrist: f.vorfrist ? addDays(f.vorfrist, diffDays(f.datum, datum)) : undefined,
            rechenweg: [...(f.rechenweg ?? []), `Fristende von Hand korrigiert auf ${fmtDateWd(datum)} (vorher ${fmtDateWd(f.datum)}).`],
          }
        : null;
  const fehlt = !neu
    ? modus === "rechner"
      ? "Bitte Fristart und Ereignisdatum angeben."
      : "Bitte das neue Datum angeben."
    : !grund.trim()
      ? "Bitte den Grund der Korrektur angeben (Pflicht)."
      : modus === "rechner" && widerspruch && !abweichendOk
        ? "Bitte die Abweichung vom Gerichtsort bestätigen."
        : undefined;

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
            <div className="sm:col-span-2">
              <Field
                label="Gerichtsort (Bundesland)"
                htmlFor="korr-land"
                hint={
                  ortFrist.quelle === "kanzleisitz"
                    ? "Kein Gericht an Frist oder Akte – Feiertage am Kanzleisitz. Weicht der Gerichtsort ab, Schalter unten nutzen."
                    : `Wie bei der ursprünglichen Berechnung${ortFrist.quelle === "akte" ? " (Gericht der Akte)" : ortFrist.quelle === "hand" ? " (von Hand gewählt)" : ""} – maßgeblich sind die Feiertage am Ort der Fristwahrung (§ 222 Abs. 2 ZPO).`
                }
              >
                <div id="korr-land" className="flex min-h-11 items-center gap-2 rounded-[14px] bg-ink-softer px-3.5 py-2 text-[13.5px] ring-1 ring-inset ring-[var(--line)]">
                  <Landmark className="size-4 shrink-0 text-fg-3" aria-hidden />
                  <span className="min-w-0 break-words font-medium">{ortText}</span>
                </div>
              </Field>
              <div className="mt-2 flex items-center gap-3">
                <label htmlFor="korr-abweichend" className="flex-1 text-[13px] text-fg-2">
                  Abweichender Gerichtsort
                </label>
                <Switch
                  id="korr-abweichend"
                  checked={abweichend}
                  label="Abweichender Gerichtsort"
                  onChange={(v) => {
                    setAbweichend(v);
                    setLandWahl("");
                    setAbweichendOk(false);
                  }}
                />
              </div>
              {abweichend && (
                <div className="mt-2 grid gap-2">
                  <Select id="korr-land-wahl" aria-label="Abweichendes Bundesland des Gerichtsorts" value={landWahl} onChange={(e) => { setLandWahl(e.target.value as Bundesland | ""); setAbweichendOk(false); }}>
                    <option value="">Bundesland wählen …</option>
                    {BUNDESLAENDER.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                  {widerspruch && landWahl && (
                    <div role="alert" className="grid gap-2 rounded-[14px] bg-seal-soft p-3 text-[12.5px] leading-relaxed text-seal">
                      <div className="flex gap-2">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>
                          <strong className="font-semibold">Achtung – Feiertage weichen vom bisherigen Gerichtsort ab.</strong> Bisher: {ortText}; gerechnet wird mit den Feiertagen in {bundeslandName(landWahl)}. Ein abweichendes Fristende kann die Frist versäumen lassen.
                        </span>
                      </div>
                      <label className="flex items-start gap-2 font-medium">
                        <input type="checkbox" className="mt-0.5 size-4 accent-[var(--seal)]" checked={abweichendOk} onChange={(e) => setAbweichendOk(e.target.checked)} />
                        <span>Ich habe geprüft: Der Gerichtsort liegt tatsächlich in {bundeslandName(landWahl)}.</span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
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
                <RechenwegListe schritte={erg.rechenweg ?? []} />
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
