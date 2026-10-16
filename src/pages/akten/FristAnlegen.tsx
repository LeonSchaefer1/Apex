// „Frist anlegen“: gesetzliche Frist mit Rechenweg (Fristenrechner) oder freie Wiedervorlage / Termin.
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, CalendarClock, CalendarPlus, Calculator, Info } from "lucide-react";
import type { Akte, Bundesland, Frist, FristTyp } from "@/core/types";
import { FRIST_REGELN, berechneNachRegel, type FristRegel } from "@/core/fristen";
import { bundeslandName, feiertagAm, istWerktag } from "@/core/feiertage";
import { fmtDate, fmtDateWd, nowLocal, relDays, today, uid, wochentagName } from "@/core/dates";
import { useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Chip, Field, Input, Modal, Segmented, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { FRIST_TYP_LABEL, beruehreAkte, dringlichkeit, useTeam } from "./helfer";

const GEBIETE = [...new Set(FRIST_REGELN.map((r) => r.gebiet))];

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

export function FristAnlegen({ akte, open, onClose }: { akte: Akte; open: boolean; onClose: () => void }) {
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

  useEffect(() => {
    if (!open) return;
    setModus("regel");
    setRegelKey(startRegel(akte));
    setEreignis(today());
    setTitel("");
    setFreiTyp("wiedervorlage");
    setDatum("");
    setUhrzeit("10:00");
    setOrt("");
    setVerantwortlich(akte.bearbeiterId);
    setNotiz("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, akte.id]);

  const ergebnis = useMemo(() => {
    if (modus !== "regel" || !/^\d{4}-\d{2}-\d{2}$/.test(ereignis)) return null;
    try {
      return berechneNachRegel(regelKey, ereignis, tenant.bundesland);
    } catch {
      return null;
    }
  }, [modus, regelKey, ereignis, tenant.bundesland]);

  const freiDatumOk = /^\d{4}-\d{2}-\d{2}$/.test(datum);
  const freiFeiertag = freiDatumOk ? feiertagAm(datum, tenant.bundesland) : undefined;
  const freiKeinWerktag = freiDatumOk && !istWerktag(datum, tenant.bundesland);

  const kannSpeichern = modus === "regel" ? !!ergebnis : freiDatumOk && !!titel.trim();

  const speichere = () => {
    const st = useData.getState();
    const jetzt = nowLocal();
    const sb = akte.sachbearbeiterId ?? akte.bearbeiterId;
    if (modus === "regel" && ergebnis) {
      const r = ergebnis.regel;
      const f: Frist = {
        id: uid("f"), akteId: akte.id, titel: titel.trim() || r.titel, typ: r.typ, datum: ergebnis.ende, vorfrist: ergebnis.vorfrist,
        regelKey: r.key, grundlage: r.grundlage, ereignisDatum: ereignis, rechenweg: ergebnis.rechenweg, status: "offen",
        verantwortlichId: verantwortlich, quelle: "manuell", notiz: notiz.trim() || undefined, createdAt: jetzt,
      };
      st.upsert("fristen", f);
      st.upsert("fristen", {
        id: uid("f"), akteId: akte.id, titel: `Vorfrist: ${f.titel}`, typ: "vorfrist", datum: ergebnis.vorfrist, status: "offen",
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
        <Segmented
          full
          value={modus}
          onChange={setModus}
          options={[
            { value: "regel", label: "Gesetzliche Frist berechnen", icon: <Calculator className="size-3.5" /> },
            { value: "frei", label: "Wiedervorlage / Termin", icon: <CalendarClock className="size-3.5" /> },
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
              <Field label={ergebnis?.regel.ereignis ?? "Fristauslösendes Ereignis"} htmlFor="fa-ereignis" hint={ereignis ? `${wochentagName(ereignis)} – dieser Tag zählt nicht mit (§ 187 Abs. 1 BGB).` : undefined}>
                <Input id="fa-ereignis" type="date" value={ereignis} onChange={(e) => setEreignis(e.target.value)} />
              </Field>
              <Field label="Bezeichnung (optional)" htmlFor="fa-titel">
                <Input id="fa-titel" value={titel} onChange={(e) => setTitel(e.target.value)} placeholder={ergebnis?.regel.titel} />
              </Field>
              <Verantwortlich id="fa-verantw" value={verantwortlich} onChange={setVerantwortlich} team={team} />
              <Field label="Notiz" htmlFor="fa-notiz">
                <Textarea id="fa-notiz" rows={2} value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. Zustellung per beA, eEB abgegeben" />
              </Field>
            </div>
            <Vorschau ergebnis={ergebnis} land={tenant.bundesland} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            <Segmented
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

function Vorschau({ ergebnis, land }: { ergebnis: (ReturnType<typeof berechneNachRegel> & { regel: FristRegel }) | null; land: Bundesland }) {
  if (!ergebnis) {
    return (
      <div className="grid grid-cols-1 place-items-center rounded-[18px] bg-ink-softer p-6 text-center text-[13px] text-fg-3 shadow-[inset_0_0_0_1px_var(--line)]">
        Bitte ein gültiges Datum wählen – das Fristende erscheint sofort hier.
      </div>
    );
  }
  const d = dringlichkeit(ergebnis.ende);
  return (
    <div className="rounded-[18px] bg-[var(--surface)] p-4 shadow-[0_0_0_1px_var(--line)]">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow !text-[10.5px]">Fristende</span>
        <Chip tone={ergebnis.regel.typ === "notfrist" ? "seal" : "ink"}>{FRIST_TYP_LABEL[ergebnis.regel.typ]}</Chip>
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
      <div className="mt-4 text-[12px] font-semibold text-fg-2">
        Rechenweg <span className="font-normal text-fg-3">· {ergebnis.regel.grundlage} · Feiertage {bundeslandName(land)}</span>
      </div>
      <ol className="mt-2 grid grid-cols-1 gap-1.5">
        {ergebnis.rechenweg.map((s, i) => (
          <motion.li key={`${ergebnis.ende}-${i}`} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex gap-2.5 text-[12.5px] leading-snug text-fg-2">
            <span className="num mt-px grid grid-cols-1 size-[18px] shrink-0 place-items-center rounded-full bg-ink-soft text-[10px] font-semibold text-ink">{i + 1}</span>
            <span>{s}</span>
          </motion.li>
        ))}
      </ol>
      {ergebnis.warnungen.map((w) => (
        <div key={w} className="mt-3 flex gap-2 rounded-[12px] bg-amber-soft p-2.5 text-[12px] text-amber">
          <AlertTriangle className="mt-px size-3.5 shrink-0" /> {w}
        </div>
      ))}
      {ergebnis.regel.hinweis && (
        <div className="mt-3 flex gap-2 rounded-[12px] bg-ink-softer p-2.5 text-[12px] text-fg-2">
          <Info className="mt-px size-3.5 shrink-0 text-ink" /> {ergebnis.regel.hinweis}
        </div>
      )}
    </div>
  );
}
