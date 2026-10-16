import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowRightLeft, Calculator, CalendarPlus, Check, Info, ShieldAlert } from "lucide-react";
import { berechneNachRegel, FRIST_REGELN, type FristRegel } from "@/core/fristen";
import { BUNDESLAENDER, bundeslandName } from "@/core/feiertage";
import { fmtDateLong, relDays, today, wochentagName, fmtDateWd } from "@/core/dates";
import { normalize } from "@/core/search";
import type { Bundesland } from "@/core/types";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Chip, Field, Input, Modal, SearchField, Select } from "@/components/ui";
import { cn } from "@/lib/cn";
import { RechenwegListe } from "./FristZeile";
import { MiniKalender } from "./MiniKalender";
import { legeFristAn, rohesEnde } from "./logik";

const GEBIETE: FristRegel["gebiet"][] = ["Zivilprozess", "Arbeitsrecht", "Mahnverfahren", "Strafrecht", "Verwaltungsrecht", "Materielles Recht"];

function einheitLabel(r: FristRegel, n: number) {
  if (r.einheit === "tage") return n === 1 ? "Tag" : "Tage";
  if (r.einheit === "wochen") return n === 1 ? "Woche" : "Wochen";
  if (r.einheit === "monate") return n === 1 ? "Monat" : "Monate";
  return "Jahre (ab Jahresende)";
}

function dauerText(r: FristRegel) {
  return `${r.dauer} ${einheitLabel(r, r.dauer)}`;
}

const istIsoDatum = (d?: string): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T12:00:00Z`));

/**
 * Fristenrechner (Modal). Deep-Link-Vertrag der Fristen-Seite:
 * /fristen?rechner=1&regel=<regelKey>&ereignis=<YYYY-MM-DD>&akte=<akteId> – alle Parameter außer `rechner` optional;
 * der Rechner öffnet dann vorbefüllt und zeigt das Ergebnis sofort.
 */
export function Fristenrechner({ open, onClose, startAkteId, startRegel, startEreignis }: { open: boolean; onClose: () => void; startAkteId?: string; startRegel?: string; startEreignis?: string }) {
  const { tenant, user } = useKanzlei();
  const akten = useCol("akten");
  const nav = useNavigate();
  const [suche, setSuche] = useState("");
  const [key, setKey] = useState(startRegel && FRIST_REGELN.some((r) => r.key === startRegel) ? startRegel : "berufung");
  const [ereignis, setEreignis] = useState(() => (istIsoDatum(startEreignis) ? startEreignis : today()));
  const [dauer, setDauer] = useState("");
  const [land, setLand] = useState<Bundesland>(tenant.bundesland);
  const [akteId, setAkteId] = useState(startAkteId ?? "");
  const [eingetragen, setEingetragen] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEingetragen(null);
    if (startAkteId) setAkteId(startAkteId);
    if (startRegel && FRIST_REGELN.some((r) => r.key === startRegel)) {
      setKey(startRegel);
      setDauer("");
      setSuche("");
    }
    if (istIsoDatum(startEreignis)) setEreignis(startEreignis);
  }, [open, startAkteId, startRegel, startEreignis]);

  // Vorgewählte Fristart in der Liste sichtbar machen (nur innerhalb der Liste scrollen)
  const listeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const box = listeRef.current;
      const el = box?.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!box || !el) return;
      const r = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      if (r.top >= b.top + 30 && r.bottom <= b.bottom) return;
      // Gebietsüberschrift mit anzeigen; bei langen Gebieten direkt unter der (klebenden) Überschrift einordnen
      const g = el.parentElement?.getBoundingClientRect();
      const ziel = g && r.bottom - g.top + 6 <= b.height ? g.top - b.top - 6 : r.top - b.top - 34;
      box.scrollTop += ziel;
    }, 220);
    return () => clearTimeout(t);
  }, [open, startRegel]);

  const regel = FRIST_REGELN.find((r) => r.key === key) ?? FRIST_REGELN[0];
  const dauerNum = dauer.trim() ? Math.max(1, Math.min(999, parseInt(dauer, 10) || regel.dauer)) : undefined;
  const gueltig = /^\d{4}-\d{2}-\d{2}$/.test(ereignis);
  const erg = useMemo(() => (gueltig ? berechneNachRegel(key, ereignis, land, dauerNum) : null), [gueltig, key, ereignis, land, dauerNum]);
  const roh = gueltig ? rohesEnde(ereignis, dauerNum ?? regel.dauer, regel.einheit) : null;

  const gefiltert = useMemo(() => {
    const q = normalize(suche.trim());
    if (!q) return FRIST_REGELN;
    return FRIST_REGELN.filter((r) => normalize([r.titel, r.grundlage, r.ereignis, r.gebiet, ...r.stichworte].join(" ")).includes(q));
  }, [suche]);

  const offeneAkten = useMemo(() => akten.filter((a) => a.status !== "abgeschlossen").sort((a, b) => b.aktenzeichen.localeCompare(a.aktenzeichen, "de", { numeric: true })), [akten]);
  const akte = akten.find((a) => a.id === akteId);
  const notfrist = regel.typ === "notfrist";

  const eintragen = () => {
    if (!erg || !akte) return;
    const titel = dauerNum && dauerNum !== regel.dauer ? `${regel.titel} (${dauerNum} ${einheitLabel(regel, dauerNum)})` : regel.titel;
    const { frist } = legeFristAn({
      akteId: akte.id,
      titel,
      typ: regel.typ,
      datum: erg.ende,
      vorfrist: erg.vorfrist,
      regelKey: regel.key,
      grundlage: regel.grundlage,
      ereignisDatum: ereignis,
      rechenweg: erg.rechenweg,
      quelle: "manuell",
      verantwortlichId: akte.bearbeiterId,
      vorfristVerantwortlichId: akte.sachbearbeiterId ?? akte.bearbeiterId,
      notiz: land !== tenant.bundesland ? `Berechnet für ${bundeslandName(land)} (Gerichtsort).` : undefined,
    });
    useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `${titel} mit Fristenrechner eingetragen: ${fmtDateWd(erg.ende)} (Vorfrist ${fmtDateWd(erg.vorfrist)})` });
    setEingetragen(frist.id);
    toast("Frist eingetragen", {
      text: `${titel} bis ${fmtDateWd(erg.ende)} in ${akte.aktenzeichen} – inkl. Vorfrist.`,
      ton: "erfolg",
      aktion: { label: "Zur Akte", onClick: () => nav(`/akten/${akte.id}?tab=fristen`) },
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Fristenrechner"
      subtitle="Nach §§ 187, 188 BGB und § 222 ZPO – mit Feiertagen je Bundesland und vollständigem Rechenweg."
      icon={<Calculator className="size-[18px]" />}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {erg && (
            <div className="num flex w-full items-baseline gap-2 text-[12.5px] lg:hidden">
              <span className="text-fg-3">Fristende</span>
              <span className={cn("font-semibold", notfrist ? "text-seal" : "text-fg")}>{fmtDateWd(erg.ende)}</span>
              <span className="text-fg-3">· Vorfrist {fmtDateWd(erg.vorfrist)}</span>
            </div>
          )}
          <div className="min-w-0 flex-1 basis-[260px]">
            <Select id="rechner-akte" aria-label="Akte für die Frist" value={akteId} onChange={(e) => { setAkteId(e.target.value); setEingetragen(null); }}>
              <option value="">Akte wählen, um die Frist einzutragen …</option>
              {offeneAkten.map((a) => (
                <option key={a.id} value={a.id}>{`${a.aktenzeichen} – ${a.titel}`}</option>
              ))}
            </Select>
          </div>
          {eingetragen ? (
            <Button variant="secondary" icon={<Check className="size-4 text-green" />} onClick={onClose}>
              Eingetragen · Schließen
            </Button>
          ) : (
            <Button variant="primary" icon={<CalendarPlus className="size-4" />} disabled={!akte || !erg} onClick={eintragen}>
              Als Frist in Akte eintragen
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        {/* Eingaben */}
        <div className="min-w-0 space-y-4">
          <div>
            <label className="label" htmlFor="rechner-suche">
              Fristart
            </label>
            <SearchField id="rechner-suche" value={suche} onChange={setSuche} placeholder="z. B. Berufung, Kündigung, 517, Mahnbescheid …" />
            <div ref={listeRef} className="mt-2 max-h-[220px] overflow-y-auto rounded-[16px] sm:max-h-[300px] bg-[var(--ink-softer)] p-1.5 ring-1 ring-inset ring-[var(--line)]" role="listbox" aria-label="Fristarten">
              {GEBIETE.map((g) => {
                const regeln = gefiltert.filter((r) => r.gebiet === g);
                if (!regeln.length) return null;
                return (
                  <div key={g} className="mb-1 last:mb-0">
                    <div className="eyebrow sticky top-0 z-10 rounded-[10px] bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] px-2.5 py-1.5 !text-[10px] backdrop-blur">{g}</div>
                    {regeln.map((r) => {
                      const aktiv = r.key === key;
                      return (
                        <button
                          key={r.key}
                          type="button"
                          role="option"
                          aria-selected={aktiv}
                          onClick={() => {
                            setKey(r.key);
                            setDauer("");
                            setEingetragen(null);
                          }}
                          className={cn("relative isolate flex w-full items-center gap-2 rounded-[12px] px-2.5 py-2 text-left", !aktiv && "hover:bg-[var(--ink-softer)]")}
                        >
                          {aktiv && <motion.span layoutId="rechner-regel" className="absolute inset-0 -z-10 rounded-[12px] bg-surface shadow-[0_2px_10px_-4px_rgba(20,30,80,0.2),0_0_0_1px_var(--line)]" transition={{ type: "spring", stiffness: 520, damping: 38 }} />}
                          <div className="min-w-0 flex-1">
                            <div className={cn("truncate text-[13px]", aktiv ? "font-semibold text-fg" : "font-medium text-fg-2")}>{r.titel}</div>
                            <div className="truncate text-[11.5px] text-fg-3">
                              {r.grundlage} · {dauerText(r)}
                            </div>
                          </div>
                          {r.typ === "notfrist" && <ShieldAlert className="size-3.5 shrink-0 text-seal" aria-label="Notfrist" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              {!gefiltert.length && <div className="px-3 py-6 text-center text-[12.5px] text-fg-3">Keine Fristart gefunden. Tipp: „Frei bestimmte Frist“ für richterliche Fristen.</div>}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={regel.ereignis} htmlFor="rechner-ereignis">
              <Input id="rechner-ereignis" type="date" value={ereignis} onChange={(e) => { setEreignis(e.target.value); setEingetragen(null); }} />
            </Field>
            <Field label="Abweichende Dauer (optional)" htmlFor="rechner-dauer">
              <div className="relative">
                <Input id="rechner-dauer" type="number" inputMode="numeric" min={1} max={999} value={dauer} placeholder={String(regel.dauer)} onChange={(e) => { setDauer(e.target.value); setEingetragen(null); }} className="!pr-24" />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[12.5px] text-fg-3">{einheitLabel(regel, dauerNum ?? regel.dauer)}</span>
              </div>
            </Field>
          </div>
          <Field label="Bundesland (Gerichtsort)" htmlFor="rechner-land" hint={land !== tenant.bundesland ? `Abweichend vom Kanzleisitz (${bundeslandName(tenant.bundesland)}).` : "Maßgeblich sind die Feiertage am Gerichtsort."}>
            <Select id="rechner-land" value={land} onChange={(e) => { setLand(e.target.value as Bundesland); setEingetragen(null); }}>
              {BUNDESLAENDER.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          {regel.hinweis && (
            <div className="flex gap-2 rounded-[14px] bg-ink-softer p-3 text-[12.5px] leading-relaxed text-fg-2 ring-1 ring-inset ring-[var(--line)]">
              <Info className="mt-0.5 size-3.5 shrink-0 text-ink" />
              <span>{regel.hinweis}</span>
            </div>
          )}
        </div>

        {/* Ergebnis */}
        <div className="min-w-0 space-y-4">
          {erg && roh ? (
            <>
              <motion.div
                key={`${erg.ende}-${regel.key}`}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className={cn("relative overflow-hidden rounded-[22px] p-5", notfrist ? "bg-seal-soft" : "bg-ink-soft")}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("eyebrow", notfrist ? "!text-seal" : "!text-ink")}>Fristende</span>
                  <Chip tone={notfrist ? "seal" : "ink"} icon={notfrist ? <ShieldAlert className="size-3" /> : undefined}>
                    {notfrist ? "Notfrist" : "Frist"}
                  </Chip>
                  {erg.verschoben && (
                    <Chip tone="amber" icon={<ArrowRightLeft className="size-3" />} title="Ende fiel auf Wochenende/Feiertag – verschoben auf den nächsten Werktag">
                      verschoben · § 222 Abs. 2 ZPO
                    </Chip>
                  )}
                </div>
                <div className={cn("mt-2 text-[15px] font-medium", notfrist ? "text-seal" : "text-ink")}>{wochentagName(erg.ende)}</div>
                <div className={cn("text-[clamp(26px,3.6vw,36px)] font-bold leading-[1.05] tracking-[-0.035em]", notfrist ? "text-seal" : "text-fg")}>{fmtDateLong(erg.ende)}</div>
                <div className="num mt-1.5 text-[13px] text-fg-2">24:00 Uhr · {relDays(erg.ende)}</div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[color-mix(in_oklab,var(--fg)_10%,transparent)] pt-3.5 text-[12.5px]">
                  <div>
                    <div className="text-fg-3">Vorfrist ({regel.vorfristTage} Tage)</div>
                    <div className="num mt-0.5 font-semibold">{fmtDateWd(erg.vorfrist)}</div>
                  </div>
                  <div>
                    <div className="text-fg-3">{regel.grundlage}</div>
                    <div className="mt-0.5 font-semibold">{dauerNum ? `${dauerNum} ${einheitLabel(regel, dauerNum)}` : dauerText(regel)}</div>
                  </div>
                </div>
              </motion.div>

              {notfrist && (
                <div className="flex gap-2 rounded-[14px] bg-seal-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-seal">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                  <span>Notfrist: nicht verlängerbar (§ 224 Abs. 1 S. 2 ZPO). Bei Versäumnis hilft nur die Wiedereinsetzung (§ 233 ZPO).</span>
                </div>
              )}
              {erg.warnungen.map((w) => (
                <div key={w} className="flex gap-2 rounded-[14px] bg-amber-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}

              <div className="rounded-[18px] p-4 ring-1 ring-inset ring-[var(--line)]">
                <div className="eyebrow mb-3">Kalender</div>
                <MiniKalender marken={{ ereignis, roh, ende: erg.ende, vorfrist: erg.vorfrist, notfrist }} land={land} />
              </div>

              <div className="rounded-[18px] p-4 ring-1 ring-inset ring-[var(--line)]">
                <div className="eyebrow mb-3">Rechenweg</div>
                <AnimatePresence mode="wait">
                  <motion.div key={erg.rechenweg.join("|")} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    <RechenwegListe schritte={erg.rechenweg} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className="grid h-full place-items-center rounded-[22px] p-10 text-center text-[13px] text-fg-3 ring-1 ring-inset ring-[var(--line)]">Bitte ein gültiges Datum eingeben.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}
