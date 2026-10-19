// „Frist anlegen“: gesetzliche Frist mit Rechenweg (Fristenrechner) oder freie Wiedervorlage / Termin.
// Keine stille Vorbelegung: Fristart per Suche wählen, Ereignisdatum ist Pflicht (Vorschlag nur mit Quelle), Warnung vor Dubletten.
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, CalendarClock, CalendarPlus, Calculator, Info, Sparkles, TriangleAlert } from "lucide-react";
import type { Akte, Bundesland, Frist, FristTyp } from "@/core/types";
import { FRIST_REGELN, berechneNachRegel, berechnungsNormen, fristArt, gerichtsortDerAkte, type Einheit, type FristRegel } from "@/core/fristen";
import { bundeslandName, feiertagAm, istWerktag } from "@/core/feiertage";
import { fmtDate, fmtDateWd, nowLocal, relDays, schuetzeLeerzeichen, today, uid, wochentagName } from "@/core/dates";
import { istBerufstraeger } from "@/core/vertretung";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Chip, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { FRIST_TYP_LABEL, beruehreAkte, dringlichkeit, useTeam } from "./helfer";
import { FristartAuswahl } from "@/pages/fristen/FristartAuswahl";

import { ereignisVorschlaege } from "./fristVorschlaege";
import { BEWEGUNG } from "@/lib/bewegung";

export { ereignisVorschlaege } from "./fristVorschlaege";

/**
 * Umschalter, der auf schmalen Bildschirmen umbricht statt abzuschneiden (Optionsfeld-Gruppe mit Pillen).
 */
function Wahl<T extends string>({ value, onChange, options, label, full }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: React.ReactNode }[]; label: string; full?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-1 rounded-lg bg-[var(--ink-softer)] p-1 shadow-[inset_0_0_0_1px_var(--line)]", full ? "w-full" : "w-fit max-w-full")}>
      {options.map((o) => {
        const aktiv = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={aktiv}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex min-h-[36px] min-w-0 flex-1 basis-[130px] items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-center text-[13px] leading-tight transition-colors duration-100",
              aktiv ? "bg-[var(--surface)] font-semibold text-fg shadow-[inset_0_0_0_1px_var(--line-strong)]" : "font-medium text-fg-3 hover:text-fg",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function FristAnlegen({ akte, open, onClose, startModus = "regel" }: { akte: Akte; open: boolean; onClose: () => void; startModus?: "regel" | "frei" }) {
  const { tenant, user } = useKanzlei();
  const { team } = useTeam();
  const [modus, setModus] = useState<"regel" | "frei">("regel");
  // Keine Vorbelegung nach Sachgebiet: Fristart bewusst wählen (Suche wie im Fristenrechner)
  const [regelKey, setRegelKey] = useState("");
  const [suche, setSuche] = useState("");
  // Ereignisdatum leer und Pflicht – „heute“ nur als Schnellwahl, Vorschläge aus der Akte mit Quelle
  const [ereignis, setEreignis] = useState("");
  const [dubletteOk, setDubletteOk] = useState(false);
  // Fristende vor heute: nur mit ausdrücklicher Bestätigung (I4-T15-02)
  const [vergangenOk, setVergangenOk] = useState(false);
  const [titel, setTitel] = useState("");
  const [freiTyp, setFreiTyp] = useState<Extract<FristTyp, "wiedervorlage" | "termin" | "frist">>("wiedervorlage");
  const [datum, setDatum] = useState("");
  const [uhrzeit, setUhrzeit] = useState("10:00");
  const [ort, setOrt] = useState("");
  const [verantwortlich, setVerantwortlich] = useState(akte.bearbeiterId);
  const [notiz, setNotiz] = useState("");
  // Dauer bei frei bestimmten bzw. vereinbarten Fristen – Pflichtangabe ohne Standardwert
  const [dauer, setDauer] = useState("");
  // Einheit bei Regeln mit Pflicht-Dauer nicht vorbelegt – Tage, Wochen oder Monate bewusst wählen (I4-T15-02)
  const [einheit, setEinheit] = useState<Exclude<Einheit, "jahresende"> | "">("");
  const [festModus, setFestModus] = useState<"dauer" | "datum">("dauer");
  const [festesEnde, setFestesEnde] = useState("");
  // Feiertage am Gerichtsort laut Akte (§ 222 Abs. 2 ZPO, § 43 Abs. 2 StPO) – sonst Kanzleisitz
  const kontakte = useCol("kontakte");
  const alleDoks = useCol("dokumente");
  const alleFristen = useCol("fristen");
  const nachrichten = useCol("nachrichten");
  const gerichtsort = useMemo(() => gerichtsortDerAkte(akte, kontakte), [akte, kontakte]);
  const land: Bundesland = gerichtsort?.land ?? tenant.bundesland;

  useEffect(() => {
    if (!open) return;
    setModus(startModus);
    setRegelKey("");
    setSuche("");
    setEreignis("");
    setDubletteOk(false);
    setVergangenOk(false);
    setTitel("");
    setFreiTyp("wiedervorlage");
    setDatum("");
    setUhrzeit("10:00");
    setOrt("");
    setVerantwortlich(akte.bearbeiterId);
    setNotiz("");
    setDauer("");
    setFestModus("dauer");
    setFestesEnde("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, akte.id, startModus]);

  const gewaehlt = FRIST_REGELN.find((r) => r.key === regelKey);
  const regel = gewaehlt ?? FRIST_REGELN[0];
  useEffect(() => {
    setDauer("");
    setFestesEnde("");
    setDubletteOk(false);
    setFestModus(regel.festesDatum === "pflicht" ? "datum" : "dauer");
    setEinheit(regel.dauerPflicht || regel.einheit === "jahresende" ? "" : regel.einheit);
  }, [regelKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const vorschlaege = useMemo(() => ereignisVorschlaege(gewaehlt, akte, alleDoks, alleFristen, nachrichten), [gewaehlt, akte, alleDoks, alleFristen, nachrichten]);
  // Dublette: offene Frist derselben Fristart in dieser Akte
  const dublette = gewaehlt ? alleFristen.find((f) => f.akteId === akte.id && f.status === "offen" && f.typ !== "vorfrist" && f.regelKey === gewaehlt.key) : undefined;
  const mitDatum = regel.festesDatum === "pflicht" || (regel.festesDatum === "moeglich" && festModus === "datum");
  const dauerNum = dauer.trim() ? Math.max(0, Math.min(999, parseInt(dauer, 10) || 0)) || undefined : undefined;
  /** Was fehlt noch? – nennt den nächsten Schritt statt still einen Standardwert anzunehmen */
  const fehlt = !gewaehlt
    ? "Bitte zuerst die Fristart wählen – Suche oder Liste."
    : !/^\d{4}-\d{2}-\d{2}$/.test(ereignis)
      ? `Bitte das Datum eintragen: ${regel.ereignis}${vorschlaege.length ? " – oder einen Vorschlag aus der Akte übernehmen" : ""}.`
      : mitDatum && !/^\d{4}-\d{2}-\d{2}$/.test(festesEnde)
        ? `Bitte das Fristende laut ${regel.key === "widerruf_vergleich" ? "Vergleich" : "Vereinbarung"} eintragen – dann erscheint die Frist mit Vorfrist.`
        : !mitDatum && regel.dauerPflicht && !dauerNum
          ? "Bitte die Dauer eingeben (Zahl und Einheit, z. B. 2 Wochen laut Verfügung) – Apex nimmt keinen Standardwert an."
          : !mitDatum && regel.dauerPflicht && !einheit
            ? "Bitte die Einheit der Dauer wählen – Tage, Wochen oder Monate. Apex nimmt keinen Standardwert an."
            : undefined;
  const einheitFehlt = !!gewaehlt && !mitDatum && !!regel.dauerPflicht && !!dauerNum && !einheit;

  const ergebnis = useMemo(() => {
    if (modus !== "regel" || fehlt) return null;
    try {
      return berechneNachRegel(regelKey, ereignis, land, mitDatum ? undefined : regel.dauerPflicht ? dauerNum : undefined, {
        feiertagsOrt: gerichtsort ? `${gerichtsort.gericht} – laut Akte` : "Kanzleisitz",
        kanzleiLand: tenant.bundesland,
        einheit: regel.dauerPflicht && einheit ? einheit : undefined,
        festesEnde: mitDatum ? festesEnde : undefined,
      });
    } catch {
      return null;
    }
  }, [modus, fehlt, regelKey, ereignis, land, gerichtsort, tenant.bundesland, mitDatum, regel.dauerPflicht, dauerNum, einheit, festesEnde]);

  // Fristen und Notfristen verantworten nur Berufsträger (§ 53 BRAO, A-14) – Wiedervorlagen und Termine auch Fachangestellte
  const nurBerufstraeger = modus === "regel" || freiTyp === "frist";
  const waehlbar = useMemo(() => team.filter((u) => !u.deaktiviert && (!nurBerufstraeger || istBerufstraeger(u))), [team, nurBerufstraeger]);
  useEffect(() => {
    if (!open || waehlbar.some((u) => u.id === verantwortlich)) return;
    const standard = waehlbar.find((u) => u.id === akte.bearbeiterId) ?? waehlbar.find((u) => u.id === user.id) ?? waehlbar[0];
    if (standard) setVerantwortlich(standard.id);
  }, [open, waehlbar, verantwortlich, akte.bearbeiterId, user.id]);

  const freiDatumOk = /^\d{4}-\d{2}-\d{2}$/.test(datum);
  const freiFeiertag = freiDatumOk ? feiertagAm(datum, land) : undefined;
  const freiKeinWerktag = freiDatumOk && !istWerktag(datum, land);

  // Fristende bzw. Datum vor heute (z. B. falsche Einheit): Pflichtbestätigung wie bei der Doppelung, im Verlauf vermerkt
  const heute = today();
  const vergangenesEnde = modus === "regel" ? (ergebnis && ergebnis.ende < heute ? ergebnis.ende : undefined) : freiDatumOk && datum < heute ? datum : undefined;
  useEffect(() => setVergangenOk(false), [vergangenesEnde]);
  const kannSpeichern = (modus === "regel" ? !!ergebnis && (!dublette || dubletteOk) : freiDatumOk && !!titel.trim()) && (!vergangenesEnde || vergangenOk);
  const vergangenVermerk = vergangenesEnde ? ` – Fristende ${fmtDateWd(vergangenesEnde)} lag beim Eintragen in der Vergangenheit (Eintrag bestätigt)` : "";

  const speichere = () => {
    const st = useData.getState();
    const jetzt = nowLocal();
    const sb = akte.sachbearbeiterId ?? akte.bearbeiterId;
    if (modus === "regel" && ergebnis) {
      const r = ergebnis.regel;
      const standardTitel = mitDatum
        ? `${r.titel} (bis ${fmtDate(festesEnde)})`
        : r.dauerPflicht && dauerNum
          ? `${r.titel} (${dauerNum} ${einheit === "tage" ? (dauerNum === 1 ? "Tag" : "Tage") : einheit === "wochen" ? (dauerNum === 1 ? "Woche" : "Wochen") : dauerNum === 1 ? "Monat" : "Monate"})`
          : r.titel;
      const f: Frist = {
        id: uid("f"), akteId: akte.id, titel: titel.trim() || standardTitel, typ: r.typ, datum: ergebnis.ende, vorfrist: ergebnis.vorfrist,
        regelKey: r.key, grundlage: r.grundlage, ereignisDatum: ereignis, rechenweg: ergebnis.rechenweg, status: "offen",
        verantwortlichId: verantwortlich, quelle: "manuell", notiz: notiz.trim() || undefined, createdAt: jetzt,
        // Ort, mit dessen Feiertagen gerechnet wurde – Korrekturen rechnen damit weiter (I3-T03-02)
        gerichtsort: gerichtsort ? { land: gerichtsort.land, gericht: gerichtsort.gericht, quelle: "akte" } : { land, quelle: "kanzleisitz" },
      };
      st.upsert("fristen", f);
      st.upsert("fristen", {
        id: uid("f"), akteId: akte.id, titel: `Vorfrist: ${f.titel}`, typ: "vorfrist", datum: ergebnis.vorfrist, bezugId: f.id, status: "offen",
        verantwortlichId: sb, quelle: "automatisch", createdAt: jetzt,
      });
      st.log({
        akteur: "nutzer",
        userId: user.id,
        akteId: akte.id,
        text: `Frist eingetragen: ${f.titel} bis ${fmtDate(f.datum)} (Ereignis ${fmtDate(ereignis)})${dublette ? ` – trotz bereits notierter „${dublette.titel}“ bis ${fmtDate(dublette.datum)} (bestätigt)` : ""}${vergangenVermerk} – ${akte.aktenzeichen}`,
      });
      st.log({ akteur: "automation", automationKey: "vorfristen", akteId: akte.id, minutenGespart: 4, text: `Vorfrist am ${fmtDate(ergebnis.vorfrist)} gesetzt und Verantwortliche informiert – ${akte.aktenzeichen}` });
      toast("Frist eingetragen", { ton: "erfolg", text: `${FRIST_TYP_LABEL[r.typ]} bis ${fmtDateWd(ergebnis.ende)} · Vorfrist ${fmtDateWd(ergebnis.vorfrist)}` });
    } else {
      const f: Frist = {
        id: uid("f"), akteId: akte.id, titel: titel.trim(), typ: freiTyp, datum, uhrzeit: freiTyp === "termin" ? uhrzeit : undefined,
        ort: freiTyp === "termin" && ort.trim() ? ort.trim() : undefined, status: "offen", verantwortlichId: verantwortlich, quelle: "manuell",
        notiz: notiz.trim() || undefined, createdAt: jetzt,
      };
      st.upsert("fristen", f);
      st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `${FRIST_TYP_LABEL[freiTyp]} eingetragen: ${f.titel} am ${fmtDate(datum)}${vergangenesEnde ? ` – Datum lag beim Eintragen in der Vergangenheit (Eintrag bestätigt)` : ""} – ${akte.aktenzeichen}` });
      toast(`${FRIST_TYP_LABEL[freiTyp]} eingetragen`, { ton: "erfolg", text: `${f.titel} · ${fmtDateWd(datum)}${f.uhrzeit ? `, ${f.uhrzeit} Uhr` : ""}` });
    }
    beruehreAkte(akte.id);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<CalendarPlus className="size-[18px]" />}
      title="Frist anlegen"
      subtitle={`${akte.aktenzeichen} · ${akte.titel}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" disabled={!kannSpeichern} onClick={speichere} icon={<CalendarClock className="size-4" />}>
            {modus === "regel" ? "Frist übernehmen" : `${FRIST_TYP_LABEL[freiTyp]} eintragen`}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        <Wahl
          full
          label="Art des Eintrags"
          value={modus}
          onChange={setModus}
          options={[
            { value: "regel", label: "Frist berechnen", icon: <Calculator className="size-3.5 shrink-0" /> },
            { value: "frei", label: "Wiedervorlage / Termin", icon: <CalendarClock className="size-3.5 shrink-0" /> },
          ]}
        />
        {modus === "regel" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1.1fr]">
            <div className="grid grid-cols-1 content-start gap-3.5">
              <FristartAuswahl
                id="fa-regel"
                pflicht
                suche={suche}
                onSuche={setSuche}
                value={regelKey}
                onWaehle={(x) => setRegelKey(x.key)}
                naechstesFeldId="fa-ereignis"
                hoehe="max-h-[188px] sm:max-h-[220px]"
              />
              {gewaehlt && regel.festesDatum === "moeglich" && (
                <Wahl
                  label="Fristende bestimmen"
                  value={festModus}
                  onChange={setFestModus}
                  options={[
                    { value: "dauer", label: "Dauer ab Ereignis" },
                    { value: "datum", label: "Festes Datum laut Vergleich" },
                  ]}
                />
              )}
              <Field
                label={`${gewaehlt ? regel.ereignis : "Fristauslösendes Ereignis"} (Pflicht)`}
                htmlFor="fa-ereignis"
                hint={/^\d{4}-\d{2}-\d{2}$/.test(ereignis) && gewaehlt ? `${wochentagName(ereignis)} – der Tag des Ereignisses zählt nicht mit (${berechnungsNormen(regel)}).` : undefined}
              >
                <div className="flex gap-2">
                  <Input id="fa-ereignis" type="date" required aria-required="true" value={ereignis} onChange={(e) => setEreignis(e.target.value)} className="min-w-0 flex-1" />
                  <Button size="sm" variant="secondary" className="!h-11 shrink-0" onClick={() => setEreignis(today())} title="Heutiges Datum eintragen">
                    heute
                  </Button>
                </div>
              </Field>
              {vorschlaege.length > 0 && (
                <ul className="-mt-1.5 grid gap-1.5" aria-label="Vorschläge aus der Akte">
                  {vorschlaege.map((v) => (
                    <li key={v.datum + v.quelle} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-[var(--surface-2)] px-3 py-2 text-[13px] text-fg-2">
                      <Sparkles className="size-3.5 shrink-0 text-ink" aria-hidden />
                      <span className="min-w-0 flex-1">
                        {v.quelle}: <span className="num font-semibold text-fg">{fmtDate(v.datum)}</span>
                      </span>
                      {ereignis === v.datum ? (
                        <span className="font-medium text-green">übernommen</span>
                      ) : (
                        <button type="button" className="min-h-[32px] rounded-md px-2 font-medium text-fg underline decoration-[var(--line-strong)] underline-offset-[3px] hover:bg-[var(--surface-2)]" onClick={() => setEreignis(v.datum)}>
                          übernehmen
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {mitDatum ? (
                <Field label={`Fristende laut ${regel.key === "widerruf_vergleich" ? "Vergleich" : "Vereinbarung"} (Pflicht)`} htmlFor="fa-festes-ende">
                  <Input id="fa-festes-ende" type="date" required aria-required="true" min={ereignis} value={festesEnde} onChange={(e) => setFestesEnde(e.target.value)} />
                </Field>
              ) : regel.dauerPflicht ? (
                <Field label="Dauer (Pflicht)" htmlFor="fa-dauer" hint={regel.key === "widerruf_vergleich" ? "Laut Vergleich, z. B. 3 Wochen ab Verkündung bzw. Zustellung des Protokolls" : regel.key === "ausschlussfrist_vertrag" ? "Laut Vertrag, z. B. 3 Monate ab Fälligkeit" : "Laut Verfügung bzw. Schreiben"}>
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
                    <Input id="fa-dauer" type="number" inputMode="numeric" min={1} max={999} required aria-required="true" value={dauer} onChange={(e) => setDauer(e.target.value)} placeholder="z. B. 2" />
                    <Select
                      id="fa-einheit"
                      aria-label="Einheit der Dauer (Pflicht)"
                      required
                      aria-required="true"
                      aria-invalid={einheitFehlt || undefined}
                      aria-describedby={einheitFehlt ? "fa-einheit-fehler" : undefined}
                      value={einheit}
                      onChange={(e) => setEinheit(e.target.value as Exclude<Einheit, "jahresende"> | "")}
                    >
                      <option value="">Einheit wählen …</option>
                      <option value="tage">Tage</option>
                      <option value="wochen">Wochen</option>
                      <option value="monate">Monate</option>
                    </Select>
                  </div>
                  {einheitFehlt && (
                    <p id="fa-einheit-fehler" className="mt-1.5 flex items-start gap-1.5 text-[13px] font-medium text-seal">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Bitte die Einheit wählen – Tage, Wochen oder Monate.
                    </p>
                  )}
                </Field>
              ) : null}
              <Field label="Bezeichnung (optional)" htmlFor="fa-titel">
                <Input id="fa-titel" value={titel} onChange={(e) => setTitel(e.target.value)} placeholder={ergebnis?.regel.titel} />
              </Field>
              <Verantwortlich id="fa-verantw" value={verantwortlich} onChange={setVerantwortlich} team={waehlbar} nurBerufstraeger />
              <Field label="Notiz" htmlFor="fa-notiz">
                <Textarea id="fa-notiz" rows={2} value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. Zustellung per beA, eEB abgegeben" />
              </Field>
            </div>
            <div className="grid content-start gap-3">
              {dublette && (
                <div role="alert" className="grid gap-2 rounded-lg bg-seal-soft p-3.5 text-[13px] leading-relaxed text-seal">
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                      <strong className="font-semibold">
                        {dublette.titel} bis {fmtDateWd(dublette.datum)} ist schon notiert.
                      </strong>{" "}
                      {dublette.ereignisDatum ? `Ereignis dort: ${fmtDate(dublette.ereignisDatum)}. ` : ""}Eine zweite Frist mit anderem Datum führt leicht zu einer versäumten Frist.
                    </span>
                  </div>
                  <label className="flex items-start gap-2 font-medium">
                    <input type="checkbox" className="mt-0.5 size-4 accent-[var(--seal)]" checked={dubletteOk} onChange={(e) => setDubletteOk(e.target.checked)} />
                    <span>Trotzdem anlegen (wird protokolliert)</span>
                  </label>
                </div>
              )}
              {vergangenesEnde && <VergangenBestaetigung datum={vergangenesEnde} ok={vergangenOk} onOk={setVergangenOk} />}
              <Vorschau ergebnis={ergebnis} land={ergebnis?.land ?? land} fehlt={fehlt} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            <Wahl
              label="Art"
              value={freiTyp}
              onChange={setFreiTyp}
              options={[
                { value: "wiedervorlage", label: "Wiedervorlage" },
                { value: "termin", label: "Termin" },
                { value: "frist", label: "Richterliche Frist" },
              ]}
            />
            <Field label="Bezeichnung" htmlFor="fa-frei-titel">
              <Input
                id="fa-frei-titel"
                value={titel}
                onChange={(e) => setTitel(e.target.value)}
                placeholder={freiTyp === "termin" ? "z. B. Mündliche Verhandlung" : freiTyp === "frist" ? "z. B. Stellungnahme zur Klageerwiderung" : "z. B. Sachstand bei Gegenseite erfragen"}
              />
            </Field>
            <div className={cn("grid gap-3", freiTyp === "termin" ? "sm:grid-cols-[1fr_140px]" : "")}>
              <Field
                label="Datum"
                htmlFor="fa-datum"
                hint={
                  freiKeinWerktag ? (
                    <span className="inline-flex items-center gap-1 text-amber">
                      <AlertTriangle className="size-3.5" /> {freiFeiertag && !freiFeiertag.teilweise ? `${freiFeiertag.name} – ` : ""}kein Werktag. Fristen enden erst am nächsten Werktag (§ 222 Abs. 2 ZPO).
                    </span>
                  ) : freiDatumOk ? (
                    `${fmtDateWd(datum)} · ${relDays(datum)}`
                  ) : undefined
                }
              >
                <Input id="fa-datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
              </Field>
              {freiTyp === "termin" && (
                <Field label="Uhrzeit" htmlFor="fa-uhrzeit">
                  <Input id="fa-uhrzeit" type="time" value={uhrzeit} onChange={(e) => setUhrzeit(e.target.value)} />
                </Field>
              )}
            </div>
            {freiTyp === "termin" && (
              <Field label="Ort" htmlFor="fa-ort">
                <Input id="fa-ort" value={ort} onChange={(e) => setOrt(e.target.value)} placeholder="z. B. Amtsgericht Charlottenburg, Saal 1/215" />
              </Field>
            )}
            {vergangenesEnde && <VergangenBestaetigung datum={vergangenesEnde} ok={vergangenOk} onOk={setVergangenOk} art={FRIST_TYP_LABEL[freiTyp]} />}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Verantwortlich id="fa-frei-verantw" value={verantwortlich} onChange={setVerantwortlich} team={waehlbar} nurBerufstraeger={nurBerufstraeger} />
              <Field label="Notiz" htmlFor="fa-frei-notiz">
                <Input id="fa-frei-notiz" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
              </Field>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Fristende bzw. Datum vor heute – Pflichtbestätigung wie bei der Doppelung; der Eintrag vermerkt sie im Verlauf. */
function VergangenBestaetigung({ datum, ok, onOk, art }: { datum: string; ok: boolean; onOk: (v: boolean) => void; art?: string }) {
  return (
    <div role="alert" className="grid gap-2 rounded-lg bg-seal-soft p-3.5 text-[13px] leading-relaxed text-seal">
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">
            {art ? `Das Datum (${fmtDateWd(datum)})` : `Das Fristende (${fmtDateWd(datum)})`} liegt in der Vergangenheit – trotzdem eintragen?
          </strong>{" "}
          Das wird protokolliert. Prüfen Sie Dauer, Einheit und Ereignisdatum.
        </span>
      </div>
      <label className="flex min-h-[32px] items-start gap-2 font-medium">
        <input type="checkbox" className="mt-0.5 size-4 accent-[var(--seal)]" checked={ok} onChange={(e) => onOk(e.target.checked)} />
        <span>Trotzdem eintragen (wird protokolliert)</span>
      </label>
    </div>
  );
}

function Verantwortlich({ id, value, onChange, team, nurBerufstraeger }: { id: string; value: string; onChange: (v: string) => void; team: { id: string; name: string; titel: string }[]; nurBerufstraeger?: boolean }) {
  return (
    <Field label="Verantwortlich" htmlFor={id} hint={nurBerufstraeger ? "Fristen verantworten Partner und Anwälte (Berufsträger)." : undefined}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {team.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function Vorschau({ ergebnis, land, fehlt }: { ergebnis: (ReturnType<typeof berechneNachRegel> & { regel: FristRegel }) | null; land: Bundesland; fehlt?: string }) {
  if (!ergebnis) {
    return (
      <div role="status" className="grid grid-cols-1 place-items-center gap-1 rounded-md bg-[var(--surface-2)] p-6 text-center">
        <Calculator className="size-5 text-fg-3" />
        <div className="text-[14px] font-semibold text-fg">Noch kein Fristende</div>
        <div className="text-[13px] text-fg-2">{fehlt ?? "Bitte ein gültiges Datum wählen – das Fristende erscheint sofort hier."}</div>
      </div>
    );
  }
  // Rechtsnatur aus der Fristregel: „Notfrist“ nur, wo das Gesetz sie so nennt; nicht verlängerbare Fristen ebenfalls rot
  const art = fristArt(ergebnis.regel);
  const d = dringlichkeit(ergebnis.ende, art.kritisch);
  return (
    <div className="rounded-lg bg-[var(--surface)] p-4 shadow-[0_0_0_1px_var(--line)]">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">Fristende</span>
        <Chip tone={art.kritisch ? "seal" : "ink"} icon={art.kritisch ? <TriangleAlert className="size-3" /> : undefined} title={art.kurz}>
          {art.kritisch && ergebnis.regel.typ !== "notfrist" ? "Frist · nicht verlängerbar" : art.label}
        </Chip>
      </div>
      <motion.div key={ergebnis.ende} initial={{ opacity: 0.2, y: 6, filter: "blur(3px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={BEWEGUNG.standard}>
          <div className="mt-1 text-[24px] font-semibold tracking-[-0.03em]">{fmtDateWd(ergebnis.ende)}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-fg-3">
            <Chip tone={d.tone} dot={d.stufe !== "normal"}>
              {d.label}
            </Chip>
            <span>Vorfrist {fmtDateWd(ergebnis.vorfrist)}</span>
          </div>
      </motion.div>
      <div className="mt-4 text-[13px] font-semibold text-fg-2">
        Rechenweg <span className="font-normal text-fg-3">· {ergebnis.regel.grundlage} · Feiertage {bundeslandName(land)}</span>
      </div>
      <ol className="mt-2 grid grid-cols-1 gap-1.5">
        {ergebnis.rechenweg.map((s, i) => (
          <li key={`${ergebnis.ende}-${i}`} className="flex gap-2.5 text-[13px] leading-snug text-fg-2">
            <span className="num mt-px grid grid-cols-1 size-[18px] shrink-0 place-items-center rounded-full bg-ink-soft text-[12px] font-semibold text-ink" aria-hidden>
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      {ergebnis.warnungen.map((w) => (
        <div key={w} className="mt-3 flex gap-2 rounded-md bg-amber-soft p-2.5 text-[13px] text-amber">
          <AlertTriangle className="mt-px size-3.5 shrink-0" /> {w}
        </div>
      ))}
      {art.kritisch && (
        <div className="mt-3 flex gap-2 rounded-md bg-seal-soft p-2.5 text-[13px] text-seal">
          <TriangleAlert className="mt-px size-3.5 shrink-0" />
          <span>
            {art.art && <strong className="font-semibold">{schuetzeLeerzeichen(art.art)} </strong>}
            {schuetzeLeerzeichen(art.versaeumnis)}
          </span>
        </div>
      )}
      {ergebnis.regel.hinweis && (
        <div className="mt-3 flex gap-2 rounded-md bg-[var(--surface-2)] p-2.5 text-[13px] text-fg-2">
          <Info className="mt-px size-3.5 shrink-0 text-ink" /> {ergebnis.regel.hinweis}
        </div>
      )}
    </div>
  );
}
