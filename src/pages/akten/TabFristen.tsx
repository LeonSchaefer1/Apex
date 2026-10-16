// Reiter „Fristen“: offene und erledigte Fristen der Akte mit Ampel, Rechenweg und Vier-Augen-Kontrolle.
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Calculator, CalendarCheck2, CalendarPlus, Check, ChevronDown, Clock, MapPin, RotateCcw, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import type { Akte, Frist } from "@/core/types";
import { fmtDate, fmtDateWd, monatName, nowLocal, relTime, wochentagName, fromISO } from "@/core/dates";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Avatar, Button, Card, Chip, Empty, Segmented, confirmDialog } from "@/components/ui";
import { cn } from "@/lib/cn";
import { FRIST_TYP_LABEL, beruehreAkte, dringlichkeit, useTeam } from "./helfer";

export function TabFristen({ akte, onNeu }: { akte: Akte; onNeu: () => void }) {
  const alle = useCol("fristen");
  const [ansicht, setAnsicht] = useState<"offen" | "erledigt">("offen");
  // Vorfristen erscheinen in der Karte ihrer Hauptfrist – nur „verwaiste“ Vorfristen als eigene Karte
  const fristen = useMemo(() => {
    const eigene = alle.filter((f) => f.akteId === akte.id);
    const haupt = new Set(eigene.filter((f) => f.typ !== "vorfrist").map((f) => `Vorfrist: ${f.titel}`));
    return eigene.filter((f) => f.typ !== "vorfrist" || !haupt.has(f.titel));
  }, [alle, akte.id]);
  const offen = useMemo(() => fristen.filter((f) => f.status === "offen").sort((a, b) => a.datum.localeCompare(b.datum)), [fristen]);
  const erledigt = useMemo(() => fristen.filter((f) => f.status === "erledigt").sort((a, b) => (b.erledigtAm ?? b.datum).localeCompare(a.erledigtAm ?? a.datum)), [fristen]);
  const liste = ansicht === "offen" ? offen : erledigt;
  const ohneKontrolle = offen.filter((f) => !f.kontrolliertVon && (f.typ === "notfrist" || f.typ === "frist") && f.regelKey).length;

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={ansicht}
          onChange={setAnsicht}
          options={[
            { value: "offen", label: "Offen", count: offen.length },
            { value: "erledigt", label: "Erledigt", count: erledigt.length },
          ]}
        />
        {ohneKontrolle > 0 && ansicht === "offen" && (
          <Chip tone="amber" icon={<ShieldAlert className="size-3" />}>
            {ohneKontrolle} {ohneKontrolle === 1 ? "Frist wartet" : "Fristen warten"} auf Vier-Augen-Kontrolle
          </Chip>
        )}
        <div className="flex-1" />
        <Link
          to={`/fristen?rechner=1&akte=${akte.id}`}
          className="inline-flex h-[38px] items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-medium text-fg-2 transition-colors hover:bg-ink-softer hover:text-fg"
          title="Fristenrechner mit dieser Akte öffnen – mit Kalender aller Fristen der Kanzlei"
        >
          <Calculator className="size-4" /> Im Fristenrechner öffnen
        </Link>
        <Button variant="primary" icon={<CalendarPlus className="size-4" />} onClick={onNeu}>
          Frist anlegen
        </Button>
      </div>

      {liste.length === 0 ? (
        <Card>
          <Empty
            icon={<CalendarCheck2 className="size-6" />}
            title={ansicht === "offen" ? "Keine offenen Fristen" : "Noch keine erledigten Fristen"}
            text={ansicht === "offen" ? "Legen Sie gesetzliche Fristen mit dem Fristenrechner an – Rechenweg und Vorfrist werden automatisch notiert." : "Erledigte Fristen erscheinen hier mit Datum und Bearbeiter."}
            action={
              ansicht === "offen" ? (
                <Button variant="secondary" icon={<CalendarPlus className="size-4" />} onClick={onNeu}>
                  Frist anlegen
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-2.5">
          <AnimatePresence initial={false}>
            {liste.map((f, i) => (
              <motion.li
                key={f.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 10) * 0.03, type: "spring", stiffness: 460, damping: 36 } }}
                exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
              >
                <FristKarte f={f} akte={akte} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function FristKarte({ f, akte }: { f: Frist; akte: Akte }) {
  const { user } = useKanzlei();
  const { byId } = useTeam();
  const [rechenweg, setRechenweg] = useState(false);
  const verantw = byId.get(f.verantwortlichId);
  const kontrolleur = f.kontrolliertVon ? byId.get(f.kontrolliertVon) : undefined;
  const erledigtVon = f.erledigtVon ? byId.get(f.erledigtVon) : undefined;
  const d = dringlichkeit(f.datum);
  const istOffen = f.status === "offen";
  const kontrollPflicht = (f.typ === "notfrist" || f.typ === "frist") && !!f.regelKey;
  const dt = fromISO(f.datum);
  const tonDatum = !istOffen ? "bg-green-soft text-green" : d.tone === "seal" ? "bg-seal-soft text-seal" : d.tone === "amber" ? "bg-amber-soft text-amber" : "bg-ink-softer text-fg";

  const erledige = () => {
    const st = useData.getState();
    st.patch("fristen", f.id, { status: "erledigt", erledigtAm: nowLocal(), erledigtVon: user.id });
    // zugehörige Vorfrist mit erledigen
    const vf = st.data.fristen.find((x) => x.akteId === f.akteId && x.typ === "vorfrist" && x.status === "offen" && x.titel === `Vorfrist: ${f.titel}`);
    if (vf) st.patch("fristen", vf.id, { status: "erledigt", erledigtAm: nowLocal(), erledigtVon: user.id });
    st.log({ akteur: "nutzer", userId: user.id, akteId: f.akteId, text: `${FRIST_TYP_LABEL[f.typ]} erledigt: ${f.titel} – ${akte.aktenzeichen}` });
    beruehreAkte(akte.id);
    toast(`${FRIST_TYP_LABEL[f.typ]} erledigt`, {
      ton: "erfolg",
      text: f.titel,
      aktion: {
        label: "Rückgängig",
        onClick: () => {
          const s = useData.getState();
          s.patch("fristen", f.id, { status: "offen", erledigtAm: undefined, erledigtVon: undefined });
          if (vf) s.patch("fristen", vf.id, { status: "offen", erledigtAm: undefined, erledigtVon: undefined });
        },
      },
    });
  };

  const wiederOeffnen = () => {
    useData.getState().patch("fristen", f.id, { status: "offen", erledigtAm: undefined, erledigtVon: undefined });
    toast("Frist wieder geöffnet", { ton: "info", text: f.titel });
  };

  const kontrolliere = async () => {
    if (user.id === f.verantwortlichId) {
      const ok = await confirmDialog({
        titel: "Kontrolle durch eine zweite Person?",
        text: "Sie sind für diese Frist selbst verantwortlich. Nach dem Vier-Augen-Prinzip sollte eine andere Person Fristart, Ereignisdatum und Rechenweg prüfen. Trotzdem bestätigen?",
        bestaetigen: "Ich habe unabhängig geprüft",
      });
      if (!ok) return;
    }
    useData.getState().patch("fristen", f.id, { kontrolliertVon: user.id });
    useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: f.akteId, text: `Fristkontrolle bestätigt (Vier-Augen-Prinzip): ${f.titel} – ${akte.aktenzeichen}` });
    toast("Kontrolle bestätigt", { ton: "erfolg", text: `${f.titel} · geprüft von ${user.name}` });
  };

  return (
    <Card padded={false} className={cn("p-4", !istOffen && "opacity-90")}>
      <div className="flex items-start gap-3.5">
        <div className={cn("grid w-[60px] shrink-0 place-items-center rounded-[14px] py-2 text-center", tonDatum)}>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] opacity-80">{wochentagName(f.datum, true)}</div>
          <div className="num text-[22px] font-semibold leading-none tracking-[-0.03em]">{dt.getUTCDate()}</div>
          <div className="text-[10.5px] font-medium opacity-80">{monatName(dt.getUTCMonth(), true)}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone={f.typ === "notfrist" ? "seal" : f.typ === "termin" ? "ink" : "neutral"}>{FRIST_TYP_LABEL[f.typ]}</Chip>
            {istOffen && (
              <Chip tone={d.tone} dot={d.stufe !== "normal"}>
                {d.label}
              </Chip>
            )}
            {f.quelle === "ki" && (
              <Chip tone="violet" icon={<Sparkles className="size-3" />}>
                Von KI erkannt
              </Chip>
            )}
            {f.quelle === "automatisch" && <Chip tone="outline">Automatisch</Chip>}
          </div>
          <div className="mt-1.5 text-[14.5px] font-semibold leading-snug">{f.titel}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-fg-3">
            <span>{fmtDateWd(f.datum)}</span>
            {f.uhrzeit && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" /> {f.uhrzeit} Uhr
              </span>
            )}
            {f.ort && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="size-3.5 shrink-0" /> <span className="truncate">{f.ort}</span>
              </span>
            )}
            {f.grundlage && <span className="font-medium text-fg-2">{f.grundlage}</span>}
            {f.vorfrist && <span>Vorfrist {fmtDate(f.vorfrist)}</span>}
          </div>
          {f.notiz && <p className="mt-1.5 text-[12.5px] text-fg-2">{f.notiz}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {verantw && (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-fg-3">
                <Avatar initialen={verantw.initialen} farbe={verantw.farbe} size={20} /> {verantw.name}
              </span>
            )}
            {kontrollPflicht &&
              (kontrolleur ? (
                <Chip tone="green" icon={<ShieldCheck className="size-3" />}>
                  Kontrolliert von {kontrolleur.name}
                </Chip>
              ) : (
                <Chip tone="amber" icon={<ShieldAlert className="size-3" />}>
                  Kontrolle ausstehend
                </Chip>
              ))}
            {!istOffen && (
              <span className="text-[12px] text-fg-3">
                Erledigt {f.erledigtAm ? relTime(f.erledigtAm) : ""}
                {erledigtVon ? ` von ${erledigtVon.name}` : ""}
              </span>
            )}
          </div>

          {f.rechenweg && f.rechenweg.length > 0 && (
            <div className="mt-3">
              <button type="button" onClick={() => setRechenweg((v) => !v)} className="inline-flex items-center gap-1 rounded-full text-[12.5px] font-medium text-ink hover:underline" aria-expanded={rechenweg}>
                <motion.span animate={{ rotate: rechenweg ? 180 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}>
                  <ChevronDown className="size-3.5" />
                </motion.span>
                {rechenweg ? "Rechenweg ausblenden" : "Rechenweg anzeigen"}
              </button>
              <AnimatePresence initial={false}>
                {rechenweg && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 38 }}
                    className="overflow-hidden"
                  >
                    <ol className="mt-2 grid grid-cols-1 gap-1.5 rounded-[14px] bg-ink-softer p-3">
                      {f.rechenweg.map((s, i) => (
                        <li key={i} className="flex gap-2.5 text-[12.5px] leading-snug text-fg-2">
                          <span className="num mt-px grid grid-cols-1 size-[18px] shrink-0 place-items-center rounded-full bg-ink-soft text-[10px] font-semibold text-ink">{i + 1}</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ol>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {istOffen ? (
            <>
              <Button size="sm" variant="secondary" icon={<Check className="size-4" />} onClick={erledige} aria-label="Als erledigt markieren" title="Als erledigt markieren">
                <span className="hidden sm:inline">Erledigt</span>
              </Button>
              {kontrollPflicht && !kontrolleur && (
                <Button size="sm" variant="ghost" icon={<ShieldCheck className="size-4" />} onClick={() => void kontrolliere()} className="!px-2.5 sm:!px-3" aria-label="Kontrolle bestätigen (Vier-Augen-Prinzip)" title="Kontrolle bestätigen (Vier-Augen-Prinzip)">
                  <span className="hidden sm:inline">Kontrolle bestätigen</span>
                </Button>
              )}
            </>
          ) : (
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-4" />} onClick={wiederOeffnen} aria-label="Frist wieder öffnen" title="Frist wieder öffnen">
              <span className="hidden sm:inline">Wieder öffnen</span>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
