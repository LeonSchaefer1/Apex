// „Korrigieren …“: notierte Frist neu berechnen (Fristart und Ereignisdatum über den Fristenrechner) oder das Datum direkt
// setzen – immer mit Pflichtgrund. Der vorherige Stand bleibt erhalten, die Vier-Augen-Kontrolle ist danach wieder offen.
// Stammt die Frist aus einer Nachricht mit eEB, ist die Korrektur an das Zustellungsdatum laut eEB gebunden (I5-T03-01):
// keine Zustellung in der Zukunft oder vor dem Eingang, spätere Abweichung nur mit Pflichtbestätigung, Geschwisterfristen
// derselben Nachricht werden mit angeboten. Pflichtangaben melden sich erst nach dem ersten Speicherversuch (I5-T17-02).
// „Korrektur anfordern“: die Kontrolleurin gibt die Frist mit Grund an die Verantwortliche zurück.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Calculator, Info, Landmark, PenLine, ShieldCheck, Undo2 } from "lucide-react";
import { addDays, diffDays, fmtDate, fmtDateWd, fmtTime, today } from "@/core/dates";
import { FRIST_REGELN, feiertagsortFuerFrist } from "@/core/fristen";
import { BUNDESLAENDER, bundeslandName } from "@/core/feiertage";
import type { Bundesland, Frist, FristGerichtsort, User } from "@/core/types";
import { useCol } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Field, Input, Modal, Segmented, Select, Switch, Textarea } from "@/components/ui";
import { RechenwegListe } from "./FristZeile";
import {
  EEB_ABWEICHUNG_VERMERK,
  TYP_META,
  eebZurFrist,
  fordereKorrekturAn,
  geschwisterFristen,
  korrekturNeuBerechnet,
  korrigiereMitGeschwistern,
  nachrichtZurFrist,
  pruefeKorrekturDatum,
  type FristKorrektur,
} from "./logik";

const berechenbar = FRIST_REGELN.filter((r) => !r.dauerPflicht && r.festesDatum !== "pflicht");
const istDatum = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

type Ort = { land: Bundesland; feiertagsOrt?: string; gerichtsort: FristGerichtsort };
/** Ort wie bei der ursprünglichen Berechnung samt dem an der Frist zu speichernden Gerichtsort. */
function ortVon(o: ReturnType<typeof feiertagsortFuerFrist>): Ort {
  const gericht = o.feiertagsOrt?.replace(/ – laut Akte$/, "");
  return { land: o.land, feiertagsOrt: o.feiertagsOrt, gerichtsort: { land: o.land, ...(gericht ? { gericht } : {}), quelle: o.quelle } };
}

export function KorrekturDialog({ f, user, open, onClose }: { f: Frist; user: User; open: boolean; onClose: () => void }) {
  const { tenant, team } = useKanzlei();
  const akten = useCol("akten");
  const kontakte = useCol("kontakte");
  const nachrichten = useCol("nachrichten");
  const fristen = useCol("fristen");
  const akte = akten.find((a) => a.id === f.akteId);
  // Gerichtsort wie bei der ursprünglichen Berechnung: gespeicherter Ort der Frist → Gericht der Akte → Kanzleisitz (I3-T03-02)
  const ortFrist = useMemo(() => feiertagsortFuerFrist(f, akte, kontakte, tenant.bundesland), [f, akte, kontakte, tenant.bundesland]);
  const ortText = ortFrist.feiertagsOrt ? `${bundeslandName(ortFrist.land)} (${ortFrist.feiertagsOrt})` : ortFrist.quelle === "hand" ? `${bundeslandName(ortFrist.land)} (von Hand gewählt)` : `${bundeslandName(ortFrist.land)} (Kanzleisitz – kein Gericht bekannt)`;
  // Nachricht, aus der die Frist stammt, und ihr eEB (Zustellungsdatum, wer, wann)
  const herkunft = useMemo(() => nachrichtZurFrist(f, nachrichten), [f, nachrichten]);
  const eeb = useMemo(() => eebZurFrist(f, nachrichten), [f, nachrichten]);
  const eebDatum = eeb?.eebZustellungsdatum;
  const eebVon = eeb ? (team.find((u) => u.id === eeb.eebAbgegebenVon)?.name ?? (eeb.eebAbgegebenVon === user.id ? user.name : "unbekannt")) : undefined;
  // Eingangstag nur bei Zustellung an die Kanzlei (gegen eEB) – sonst kann z. B. der Zugang beim Mandanten früher liegen
  const eingang = herkunft?.eebErforderlich ? herkunft.eingang.slice(0, 10) : undefined;
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
  const [eebOk, setEebOk] = useState(false);
  /** Abgewählte Geschwisterfristen (Standard: alle mit neu berechnen) */
  const [ohneGeschwister, setOhneGeschwister] = useState<string[]>([]);
  /** Erst nach dem ersten Speicherversuch melden sich fehlende Pflichtangaben als Fehler (I5-T17-02) */
  const [versucht, setVersucht] = useState(false);
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
    setEebOk(false);
    setOhneGeschwister([]);
    setVersucht(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, f.id]);

  const heute = today();
  const regelWahl = FRIST_REGELN.find((r) => r.key === regelKey);
  const widerspruch = abweichend && !!landWahl && landWahl !== ortFrist.land;
  /** Ort für die Neuberechnung samt dem an der Frist zu speichernden Gerichtsort */
  const ort = useMemo((): Ort => {
    if (widerspruch && landWahl)
      return { land: landWahl, feiertagsOrt: `abweichend gewählt – ${ortFrist.feiertagsOrt ?? "bisheriger Ort"} liegt in ${bundeslandName(ortFrist.land)}`, gerichtsort: { land: landWahl, quelle: "hand" } };
    return ortVon(ortFrist);
  }, [widerspruch, landWahl, ortFrist]);

  const rechne = (key: string, tag: string, o: Ort = ort): FristKorrektur | null => {
    if (!key || !istDatum(tag)) return null;
    try {
      return korrekturNeuBerechnet(f, key, tag, o, tenant.bundesland);
    } catch {
      return null;
    }
  };
  const neuRechner = useMemo(() => (modus === "rechner" ? rechne(regelKey, ereignis) : null), [modus, regelKey, ereignis, ort, tenant.bundesland, f]); // eslint-disable-line react-hooks/exhaustive-deps
  // Fristende laut eEB: dieselbe Fristart mit dem Zustellungsdatum laut eEB (Rechner: gewählte Fristart, Datum: Fristart der Frist)
  const endeEeb = useMemo(() => {
    if (!eebDatum) return undefined;
    const key = modus === "rechner" ? regelKey : mitRegel ? f.regelKey! : "";
    return rechne(key, eebDatum)?.datum;
  }, [eebDatum, modus, regelKey, mitRegel, ort, f]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prüfung des Ereignisdatums: Zukunft/vor Eingang gesperrt, Abweichung vom eEB (I5-T03-01)
  const pruefung = useMemo(
    () => (modus === "rechner" && regelWahl && istDatum(ereignis) ? pruefeKorrekturDatum({ ereignis, heute, eingang, eebDatum, regel: regelWahl, endeNeu: neuRechner?.datum, endeEeb }) : {}),
    [modus, regelWahl, ereignis, heute, eingang, eebDatum, neuRechner?.datum, endeEeb],
  );
  const ereignisSperre = pruefung.sperre;
  const erg = ereignisSperre ? null : neuRechner;

  const datumNeu: FristKorrektur | null = istDatum(datum)
    ? {
        datum,
        // Vorfrist im gleichen Abstand mitverschieben
        vorfrist: f.vorfrist ? addDays(f.vorfrist, diffDays(f.datum, datum)) : undefined,
        rechenweg: [...(f.rechenweg ?? []).filter((z) => !z.startsWith(EEB_ABWEICHUNG_VERMERK)), `Fristende von Hand korrigiert auf ${fmtDateWd(datum)} (vorher ${fmtDateWd(f.datum)}).`],
      }
    : null;
  // „Datum direkt setzen“ bei Notfristen: später als das Fristende laut eEB nur mit Pflichtbestätigung
  const datumNachEeb = modus === "datum" && f.typ === "notfrist" && !!endeEeb && !!datumNeu && datumNeu.datum > endeEeb;
  const neu: FristKorrektur | null =
    modus === "rechner"
      ? erg
      : datumNeu && datumNachEeb && eebDatum && endeEeb
        ? { ...datumNeu, rechenweg: [...(datumNeu.rechenweg ?? []), `${EEB_ABWEICHUNG_VERMERK} (${fmtDateWd(endeEeb)}, Zustellung ${fmtDate(eebDatum)}) – geprüft und bestätigt.`] }
        : datumNeu;

  const spaeterAlsEeb = (modus === "rechner" && !!pruefung.abweichung?.spaeter) || datumNachEeb;
  const neuText = modus === "rechner" ? fmtDate(ereignis) : neu ? fmtDateWd(neu.datum) : "";

  // Geschwisterfristen derselben Nachricht – mit neu berechnen, sobald sich das Ereignis ändert
  const geschwister = useMemo(() => {
    if (modus !== "rechner" || !erg || !istDatum(ereignis) || ereignis === f.ereignisDatum) return [];
    return geschwisterFristen(f, fristen, nachrichten)
      .filter((g) => !!g.regelKey && berechenbar.some((r) => r.key === g.regelKey))
      .map((g) => {
        try {
          return { f: g, neu: korrekturNeuBerechnet(g, g.regelKey!, ereignis, ortVon(feiertagsortFuerFrist(g, akte, kontakte, tenant.bundesland)), tenant.bundesland) };
        } catch {
          return null;
        }
      })
      .filter((x): x is { f: Frist; neu: FristKorrektur } => !!x);
  }, [modus, erg, ereignis, f, fristen, nachrichten, akte, kontakte, tenant.bundesland]);
  const gewaehlt = geschwister.filter((g) => !ohneGeschwister.includes(g.f.id));

  // Pflichtangaben (Fehler am Feld erst nach dem ersten Speicherversuch) und echte Sperren (sofort, mit Grund am Knopf)
  const fehler = {
    regel: modus === "rechner" && !regelKey ? "Bitte die Fristart wählen." : undefined,
    ereignis: modus === "rechner" && regelKey && !istDatum(ereignis) ? "Bitte das Ereignisdatum eintragen." : undefined,
    datum: modus === "datum" && !istDatum(datum) ? "Bitte das neue Datum eintragen." : undefined,
    grund: !grund.trim() ? "Bitte den Grund der Korrektur angeben." : undefined,
  };
  const ersterFehler = (["regel", "ereignis", "datum", "grund"] as const).find((k) => fehler[k]);
  const feldId = { regel: "korr-regel", ereignis: "korr-ereignis", datum: "korr-datum", grund: "korr-grund" } as const;
  const sperrGrund = ereignisSperre
    ? `Erst das Datum korrigieren – ${ereignisSperre.replace(/\.$/, "")}`
    : spaeterAlsEeb && !eebOk
      ? "Erst die Abweichung vom Zustellungsdatum laut eEB bestätigen"
      : modus === "rechner" && widerspruch && !abweichendOk
        ? "Erst die Abweichung vom Gerichtsort bestätigen"
        : undefined;
  const zeigeFehler = (k: keyof typeof fehler) => versucht && !!fehler[k];

  const speichern = () => {
    if (sperrGrund) return;
    if (ersterFehler || !neu) {
      setVersucht(true);
      // Fokus ins erste fehlerhafte Feld (nach dem Rendern der Meldung)
      const id = feldId[ersterFehler ?? (modus === "rechner" ? "ereignis" : "datum")];
      requestAnimationFrame(() => {
        document.getElementById(id)?.focus();
        // Feld samt Meldung ins Bild (die Meldung steht unter dem Feld)
        document.getElementById(`${id}-fehler`)?.scrollIntoView({ block: "nearest" });
      });
      return;
    }
    const anzahl = korrigiereMitGeschwistern(f, user.id, neu, grund, gewaehlt, { eebDatum, eebAbweichungBestaetigt: spaeterAlsEeb && eebOk ? true : undefined });
    onClose();
    toast(anzahl > 1 ? `${anzahl} Fristen korrigiert` : "Frist korrigiert", {
      text: `${f.titel}: ${fmtDate(f.datum)} → ${fmtDate(neu.datum)}${gewaehlt.map((g) => ` · ${g.f.titel}: ${fmtDate(g.f.datum)} → ${fmtDate(g.neu.datum)}`).join("")} · Vier-Augen-Kontrolle wieder offen`,
      ton: "erfolg",
    });
  };

  const fehlerText = (k: keyof typeof fehler) =>
    zeigeFehler(k) ? (
      <p id={`${feldId[k]}-fehler`} className="mt-1.5 flex items-start gap-1.5 text-[12.5px] font-medium text-seal">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {fehler[k]}
      </p>
    ) : null;
  const fehlerAttr = (k: keyof typeof fehler, extra?: string) => ({
    "aria-invalid": zeigeFehler(k) || undefined,
    "aria-describedby": [zeigeFehler(k) ? `${feldId[k]}-fehler` : "", extra ?? ""].filter(Boolean).join(" ") || undefined,
  });

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
          <Button variant="primary" disabled={!!sperrGrund} onClick={speichern} aria-describedby={sperrGrund ? "korr-sperrgrund" : undefined}>
            Korrektur speichern
          </Button>
          {sperrGrund && (
            <p id="korr-sperrgrund" className="flex basis-full items-start justify-end gap-1.5 text-right text-[12px] text-fg-2">
              <Info className="mt-px size-3.5 shrink-0 text-fg-3" aria-hidden />
              {sperrGrund}
            </p>
          )}
        </>
      }
    >
      <div className="grid gap-4">
        {f.korrekturAngefordert && (
          <p className="rounded-[14px] bg-amber-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-fg-2">
            <strong className="font-semibold text-fg">Korrektur angefordert:</strong> {f.korrekturAngefordert.grund}
          </p>
        )}
        {eeb && eebDatum && (
          <p id="korr-eeb" className="flex items-start gap-2 rounded-[14px] bg-[var(--ink-softer)] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-fg-2 ring-1 ring-inset ring-[var(--line)]">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-green" aria-hidden />
            <span>
              <strong className="num font-semibold text-fg">Zustellungsdatum laut eEB: {fmtDateWd(eebDatum)}</strong>
              {eeb.eebAbgegeben ? (
                <span className="num">
                  {" "}
                  (abgegeben von {eebVon} am {fmtDate(eeb.eebAbgegeben.slice(0, 10))}, {fmtTime(eeb.eebAbgegeben)} Uhr)
                </span>
              ) : null}
              {endeEeb ? <span className="num"> · Fristende laut eEB {fmtDateWd(endeEeb)}</span> : null}
            </span>
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
              <Select id="korr-regel" value={regelKey} onChange={(e) => setRegelKey(e.target.value)} {...fehlerAttr("regel")}>
                <option value="">Fristart wählen …</option>
                {berechenbar.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.titel} ({r.grundlage})
                  </option>
                ))}
              </Select>
              {fehlerText("regel")}
            </Field>
            <Field label={regelWahl?.ereignis ?? "Ereignisdatum"} htmlFor="korr-ereignis">
              <Input
                id="korr-ereignis"
                type="date"
                value={ereignis}
                onChange={(e) => setEreignis(e.target.value)}
                aria-invalid={!!ereignisSperre || zeigeFehler("ereignis") || undefined}
                aria-describedby={[ereignisSperre ? "korr-ereignis-sperre" : "", zeigeFehler("ereignis") ? "korr-ereignis-fehler" : "", eebDatum ? "korr-eeb" : ""].filter(Boolean).join(" ") || undefined}
              />
              {ereignisSperre && (
                <p id="korr-ereignis-sperre" className="mt-1.5 flex items-start gap-1.5 text-[12.5px] font-medium text-seal">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {ereignisSperre}
                </p>
              )}
              {!ereignisSperre && fehlerText("ereignis")}
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
            <Input id="korr-datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} {...fehlerAttr("datum", eebDatum ? "korr-eeb" : undefined)} />
            {fehlerText("datum")}
          </Field>
        )}
        {/* Abweichung vom Zustellungsdatum laut eEB: später → rote Warnung mit Pflichthäkchen, früher → Hinweis */}
        {spaeterAlsEeb && eebDatum && (
          <div role="alert" className="grid gap-2 rounded-[14px] bg-seal-soft p-3 text-[12.5px] leading-relaxed text-seal">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <strong className="font-semibold">Achtung – später als das Zustellungsdatum laut eEB ({fmtDate(eebDatum)}).</strong>{" "}
                {modus === "rechner"
                  ? pruefung.abweichung?.text
                  : endeEeb && neu
                    ? `Das neue Fristende liegt ${diffDays(endeEeb, neu.datum)}\u00a0${diffDays(endeEeb, neu.datum) === 1 ? "Tag" : "Tage"} nach dem Fristende laut eEB (${fmtDateWd(endeEeb)} → ${fmtDateWd(neu.datum)}). Eine Notfrist kann nicht verlängert werden (§\u00a0224 Abs.\u00a02 ZPO).`
                    : null}
              </span>
            </div>
            <label className="flex items-start gap-2 font-medium">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--seal)]" checked={eebOk} onChange={(e) => setEebOk(e.target.checked)} />
              <span className="num">
                Ich habe geprüft: Das Zustellungsdatum laut eEB ist unrichtig; maßgeblich ist {modus === "rechner" ? `der ${neuText}` : `das Fristende ${neuText}`}.
              </span>
            </label>
          </div>
        )}
        {modus === "rechner" && pruefung.abweichung && !pruefung.abweichung.spaeter && !ereignisSperre && (
          <p role="status" className="flex items-start gap-2 rounded-[14px] bg-amber-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-fg-2">
            <Info className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />
            <span>
              <strong className="font-semibold text-fg">Früher als das Zustellungsdatum laut eEB ({fmtDate(eebDatum)}).</strong> {pruefung.abweichung.text}
            </span>
          </p>
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
        {geschwister.length > 0 && (
          <fieldset className="grid gap-1.5 rounded-[16px] p-3.5 ring-1 ring-inset ring-[var(--line)]">
            <legend className="eyebrow px-1">Fristen aus derselben Nachricht</legend>
            {geschwister.map((g) => (
              <label key={g.f.id} className="flex min-h-11 items-start gap-2 py-1 text-[13px] text-fg sm:min-h-0">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-[var(--ink)]"
                  checked={!ohneGeschwister.includes(g.f.id)}
                  onChange={(e) => setOhneGeschwister((l) => (e.target.checked ? l.filter((x) => x !== g.f.id) : [...l, g.f.id]))}
                />
                <span className="num">
                  Auch neu berechnen: <strong className="font-semibold">{g.f.titel}</strong> ({fmtDateWd(g.f.datum)} → {fmtDateWd(g.neu.datum)})
                </span>
              </label>
            ))}
            <p className="text-[12px] text-fg-3">Gleiches Ereignis, gleicher Grund – je Frist ein Verlaufseintrag, die Vier-Augen-Kontrolle ist danach wieder offen.</p>
          </fieldset>
        )}
        <Field label="Grund der Korrektur (Pflicht)" htmlFor="korr-grund" hint={zeigeFehler("grund") ? undefined : "Pflichtangabe – steht in der Korrektur-Historie und im Verlauf der Akte."}>
          <Textarea id="korr-grund" rows={2} value={grund} onChange={(e) => setGrund(e.target.value)} placeholder="z. B. Fristart falsch gewählt" {...fehlerAttr("grund")} />
          {fehlerText("grund")}
        </Field>
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
        <Textarea id="korr-anf-grund" rows={3} value={grund} onChange={(e) => setGrund(e.target.value)} placeholder="z. B. Fristart oder Ereignisdatum prüfen" />
      </Field>
      <p className="mt-3 text-[12.5px] text-fg-3">Die Frist bleibt bis zur Korrektur unkontrolliert; der Hinweis erscheint an der Frist und im Verlauf.</p>
    </Modal>
  );
}
