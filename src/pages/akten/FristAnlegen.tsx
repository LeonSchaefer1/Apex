// „Frist anlegen“: gesetzliche Frist mit Rechenweg (Fristenrechner) oder freie Wiedervorlage / Termin.
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, CalendarClock, CalendarPlus, Calculator, Info, ShieldAlert } from "lucide-react";
import type { Akte, Bundesland, Frist, FristTyp } from "@/core/types";
import { FRIST_REGELN, berechneNachRegel, berechnungsNormen, fristArt, gerichtsortDerAkte, type Einheit, type FristRegel } from "@/core/fristen";
import { bundeslandName, feiertagAm, istWerktag } from "@/core/feiertage";
import { fmtDate, fmtDateWd, nowLocal, relDays, schuetzeLeerzeichen, today, uid, wochentagName } from "@/core/dates";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Chip, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { FRIST_TYP_LABEL, beruehreAkte, dringlichkeit, useTeam } from "./helfer";

const GEBIETE = [...new Set(FRIST_REGELN.map((r) => r.gebiet))];

/**
 * Umschalter, der auf schmalen Bildschirmen umbricht statt abzuschneiden (Optionsfeld-Gruppe mit Pillen).
 */
function Wahl<T extends string>({ value, onChange, options, label, full }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: React.ReactNode }[]; label: string; full?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-1 rounded-[18px] bg-[var(--ink-softer)] p-1 shadow-[inset_0_0_0_1px_var(--line)]", full ? "w-full" : "w-fit max-w-full")}>
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
              "inline-flex min-h-[36px] min-w-0 flex-1 basis-[130px] items-center justify-center gap-1.5 rounded-[14px] px-3 py-1.5 text-center text-[13px] font-medium leading-tight transition-colors",
              aktiv ? "bg-[var(--glass-strong)] text-fg shadow-[0_2px_10px_-2px_rgba(20,30,80,0.18),0_0_0_1px_var(--line)]" : "text-fg-3 hover:text-fg-2",
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

/** Passende Startregel nach Sachgebiet. */
function startRegel(akte: Akte): string {
  switch (akte.sachgebiet) {
    case "Arbeitsrecht":
      return akte.phase === "Urteil" ? "berufung_arbg" : "kschg_klage";
    case "Strafrecht":
      return "einspruch_strafbefehl";
    case "Forderungseinzug":
      return "widerspruch_mb";
    case "Verwaltungsrecht":
      return "widerspruch_va";
    default:
      return akte.phase === "Urteil" ? "berufung" : "klageerwiderung";
  }
}

export function FristAnlegen({ akte, open, onClose, startModus = "regel" }: { akte: Akte; open: boolean; onClose: () => void; startModus?: "regel" | "frei" }) {
  const { tenant, user } = useKanzlei();
  const { team } = useTeam();
  const [modus, setModus] = useState<"regel" | "frei">("regel");
  const [regelKey, setRegelKey] = useState(startRegel(akte));
  const [ereignis, setEreignis] = useState(today());
  const [titel, setTitel] = useState("");
  const [freiTyp, setFreiTyp] = useState<Extract<FristTyp, "wiedervorlage" | "termin" | "frist">>("wiedervorlage");
  const [datum, setDatum] = useState("");
  const [uhrzeit, setUhrzeit] = useState("10:00");
  const [ort, setOrt] = useState("");
  const [verantwortlich, setVerantwortlich] = useState(akte.bearbeiterId);
  const [notiz, setNotiz] = useState("");
  // Dauer bei frei bestimmten bzw. vereinbarten Fristen – Pflichtangabe ohne Standardwert
  const [dauer, setDauer] = useState("");
  const [einheit, setEinheit] = useState<Exclude<Einheit, "jahresende">>("wochen");
  const [festModus, setFestModus] = useState<"dauer" | "datum">("dauer");
  const [festesEnde, setFestesEnde] = useState("");
  // Feiertage am Gerichtsort laut Akte (§ 222 Abs. 2 ZPO, § 43 Abs. 2 StPO) – sonst Kanzleisitz
  const kontakte = useCol("kontakte");
  const gerichtsort = useMemo(() => gerichtsortDerAkte(akte, kontakte), [akte, kontakte]);
  const land: Bundesland = gerichtsort?.land ?? tenant.bundesland;

  useEffect(() => {
    if (!open) return;
    setModus(startModus);
    setRegelKey(startRegel(akte));
    setEreignis(today());
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

  const regel = FRIST_REGELN.find((r) => r.key === regelKey) ?? FRIST_REGELN[0];
  useEffect(() => {
    setDauer("");
    setFestesEnde("");
    setFestModus(regel.festesDatum === "pflicht" ? "datum" : "dauer");
    if (regel.einheit !== "jahresende") setEinheit(regel.einheit);
  }, [regelKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const mitDatum = regel.festesDatum === "pflicht" || (regel.festesDatum === "moeglich" && festModus === "datum");
  const dauerNum = dauer.trim() ? Math.max(0, Math.min(999, parseInt(dauer, 10) || 0)) || undefined : undefined;
  /** Was fehlt noch? – nennt den nächsten Schritt statt still einen Standardwert anzunehmen */
  const fehlt =
    !/^\d{4}-\d{2}-\d{2}$/.test(ereignis)
      ? "Bitte das Datum des fristauslösenden Ereignisses wählen."
      : mitDatum && !/^\d{4}-\d{2}-\d{2}$/.test(festesEnde)
        ? `Bitte das Fristende laut ${regel.key === "widerruf_vergleich" ? "Vergleich" : "Vereinbarung"} eintragen – dann erscheint die Frist mit Vorfrist.`
        : !mitDatum && regel.dauerPflicht && !dauerNum
          ? "Bitte die Dauer eingeben (Zahl und Einheit, z. B. 2 Wochen laut Verfügung) – AnwaltApex nimmt keinen Standardwert an."
          : undefined;

  const ergebnis = useMemo(() => {
    if (modus !== "regel" || fehlt) return null;
    try {
      return berechneNachRegel(regelKey, ereignis, land, mitDatum ? undefined : regel.dauerPflicht ? dauerNum : undefined, {
        feiertagsOrt: gerichtsort ? `${gerichtsort.gericht} – laut Akte` : "Kanzleisitz",
        kanzleiLand: tenant.bundesland,
        einheit: regel.dauerPflicht ? einheit : undefined,
        festesEnde: mitDatum ? festesEnde : undefined,
      });
    } catch {
      return null;
    }
  }, [modus, fehlt, regelKey, ereignis, land, gerichtsort, tenant.bundesland, mitDatum, regel.dauerPflicht, dauerNum, einheit, festesEnde]);

  const freiDatumOk = /^\d{4}-\d{2}-\d{2}$/.test(datum);
  const freiFeiertag = freiDatumOk ? feiertagAm(datum, land) : undefined;
  const freiKeinWerktag = freiDatumOk && !istWerktag(datum, land);

  const kannSpeichern = modus === "regel" ? !!ergebnis : freiDatumOk && !!titel.trim();

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
      };
      st.upsert("fristen", f);
      st.upsert("fristen", {
        id: uid("f"), akteId: akte.id, titel: `Vorfrist: ${f.titel}`, typ: "vorfrist", datum: ergebnis.vorfrist, bezugId: f.id, status: "offen",
        verantwortlichId: sb, quelle: "automatisch", createdAt: jetzt,
      });
      st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Frist eingetragen: ${f.titel} bis ${fmtDate(f.datum)} – ${akte.aktenzeichen}` });
      st.log({ akteur: "automation", automationKey: "vorfristen", akteId: akte.id, minutenGespart: 4, text: `Vorfrist am ${fmtDate(ergebnis.vorfrist)} gesetzt und Verantwortliche informiert – ${akte.aktenzeichen}` });
      toast("Frist eingetragen", { ton: "erfolg", text: `${FRIST_TYP_LABEL[r.typ]} bis ${fmtDateWd(ergebnis.ende)} · Vorfrist ${fmtDateWd(ergebnis.vorfrist)}` });
    } else {
      const f: Frist = {
        id: uid("f"), akteId: akte.id, titel: titel.trim(), typ: freiTyp, datum, uhrzeit: freiTyp === "termin" ? uhrzeit : undefined,
        ort: freiTyp === "termin" && ort.trim() ? ort.trim() : undefined, status: "offen", verantwortlichId: verantwortlich, quelle: "manuell",
        notiz: notiz.trim() || undefined, createdAt: jetzt,
      };
      st.upsert("fristen", f);
      st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `${FRIST_TYP_LABEL[freiTyp]} eingetragen: ${f.titel} am ${fmtDate(datum)} – ${akte.aktenzeichen}` });
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
              <Field label="Fristart" htmlFor="fa-regel">
                <Select id="fa-regel" value={regelKey} onChange={(e) => setRegelKey(e.target.value)}>
                  {GEBIETE.map((g) => (
                    <optgroup key={g} label={g}>
                      {FRIST_REGELN.filter((r) => r.gebiet === g).map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.titel} ({r.grundlage})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </Field>
              {regel.festesDatum === "moeglich" && (
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
                label={regel.ereignis}
                htmlFor="fa-ereignis"
                hint={/^\d{4}-\d{2}-\d{2}$/.test(ereignis) ? `${wochentagName(ereignis)} – der Tag des Ereignisses zählt nicht mit (${berechnungsNormen(regel)}).` : undefined}
              >
                <Input id="fa-ereignis" type="date" value={ereignis} onChange={(e) => setEreignis(e.target.value)} />
              </Field>
              {mitDatum ? (
                <Field label={`Fristende laut ${regel.key === "widerruf_vergleich" ? "Vergleich" : "Vereinbarung"} (Pflicht)`} htmlFor="fa-festes-ende">
                  <Input id="fa-festes-ende" type="date" required aria-required="true" min={ereignis} value={festesEnde} onChange={(e) => setFestesEnde(e.target.value)} />
                </Field>
              ) : regel.dauerPflicht ? (
                <Field label="Dauer (Pflicht)" htmlFor="fa-dauer" hint={regel.key === "widerruf_vergleich" ? "Laut Vergleich, z. B. 3 Wochen ab Verkündung bzw. Zustellung des Protokolls" : regel.key === "ausschlussfrist_vertrag" ? "Laut Vertrag, z. B. 3 Monate ab Fälligkeit" : "Laut Verfügung bzw. Schreiben"}>
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
                    <Input id="fa-dauer" type="number" inputMode="numeric" min={1} max={999} required aria-required="true" value={dauer} onChange={(e) => setDauer(e.target.value)} placeholder="z. B. 2" />
                    <Select id="fa-einheit" aria-label="Einheit der Dauer" value={einheit} onChange={(e) => setEinheit(e.target.value as Exclude<Einheit, "jahresende">)}>
                      <option value="tage">Tage</option>
                      <option value="wochen">Wochen</option>
                      <option value="monate">Monate</option>
                    </Select>
                  </div>
                </Field>
              ) : null}
              <Field label="Bezeichnung (optional)" htmlFor="fa-titel">
                <Input id="fa-titel" value={titel} onChange={(e) => setTitel(e.target.value)} placeholder={ergebnis?.regel.titel} />
              </Field>
              <Verantwortlich id="fa-verantw" value={verantwortlich} onChange={setVerantwortlich} team={team} />
              <Field label="Notiz" htmlFor="fa-notiz">
                <Textarea id="fa-notiz" rows={2} value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. Zustellung per beA, eEB abgegeben" />
              </Field>
            </div>
            <Vorschau ergebnis={ergebnis} land={ergebnis?.land ?? land} fehlt={fehlt} />
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Verantwortlich id="fa-frei-verantw" value={verantwortlich} onChange={setVerantwortlich} team={team} />
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

function Verantwortlich({ id, value, onChange, team }: { id: string; value: string; onChange: (v: string) => void; team: { id: string; name: string; titel: string }[] }) {
  return (
    <Field label="Verantwortlich" htmlFor={id}>
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
      <div role="status" className="grid grid-cols-1 place-items-center gap-1 rounded-[18px] bg-ink-softer p-6 text-center shadow-[inset_0_0_0_1px_var(--line)]">
        <Calculator className="size-5 text-fg-3" />
        <div className="text-[13.5px] font-semibold text-fg">Noch kein Fristende</div>
        <div className="text-[12.5px] text-fg-2">{fehlt ?? "Bitte ein gültiges Datum wählen – das Fristende erscheint sofort hier."}</div>
      </div>
    );
  }
  const d = dringlichkeit(ergebnis.ende);
  // Rechtsnatur aus der Fristregel: „Notfrist“ nur, wo das Gesetz sie so nennt; nicht verlängerbare Fristen ebenfalls rot
  const art = fristArt(ergebnis.regel);
  return (
    <div className="rounded-[18px] bg-[var(--surface)] p-4 shadow-[0_0_0_1px_var(--line)]">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">Fristende</span>
        <Chip tone={art.kritisch ? "seal" : "ink"} icon={art.kritisch ? <ShieldAlert className="size-3" /> : undefined} title={art.kurz}>
          {art.kritisch && ergebnis.regel.typ !== "notfrist" ? "Frist · nicht verlängerbar" : art.label}
        </Chip>
      </div>
      <motion.div key={ergebnis.ende} initial={{ opacity: 0.2, y: 6, filter: "blur(3px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ type: "spring", stiffness: 520, damping: 34 }}>
          <div className="mt-1 text-[24px] font-semibold tracking-[-0.03em]">{fmtDateWd(ergebnis.ende)}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-fg-3">
            <Chip tone={d.tone} dot={d.stufe !== "normal"}>
              {d.label}
            </Chip>
            <span>Vorfrist {fmtDateWd(ergebnis.vorfrist)}</span>
          </div>
      </motion.div>
      <div className="mt-4 text-[12.5px] font-semibold text-fg-2">
        Rechenweg <span className="font-normal text-fg-3">· {ergebnis.regel.grundlage} · Feiertage {bundeslandName(land)}</span>
      </div>
      <ol className="mt-2 grid grid-cols-1 gap-1.5">
        {ergebnis.rechenweg.map((s, i) => (
          <li key={`${ergebnis.ende}-${i}`} className="flex gap-2.5 text-[12.5px] leading-snug text-fg-2">
            <span className="num mt-px grid grid-cols-1 size-[18px] shrink-0 place-items-center rounded-full bg-ink-soft text-[11px] font-semibold text-ink" aria-hidden>
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      {ergebnis.warnungen.map((w) => (
        <div key={w} className="mt-3 flex gap-2 rounded-[12px] bg-amber-soft p-2.5 text-[12.5px] text-amber">
          <AlertTriangle className="mt-px size-3.5 shrink-0" /> {w}
        </div>
      ))}
      {art.kritisch && (
        <div className="mt-3 flex gap-2 rounded-[12px] bg-seal-soft p-2.5 text-[12.5px] text-seal">
          <ShieldAlert className="mt-px size-3.5 shrink-0" />
          <span>
            {art.art && <strong className="font-semibold">{schuetzeLeerzeichen(art.art)} </strong>}
            {schuetzeLeerzeichen(art.versaeumnis)}
          </span>
        </div>
      )}
      {ergebnis.regel.hinweis && (
        <div className="mt-3 flex gap-2 rounded-[12px] bg-ink-softer p-2.5 text-[12.5px] text-fg-2">
          <Info className="mt-px size-3.5 shrink-0 text-ink" /> {ergebnis.regel.hinweis}
        </div>
      )}
    </div>
  );
}
