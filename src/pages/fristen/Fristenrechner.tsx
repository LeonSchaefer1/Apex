import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { AlertTriangle, ArrowRightLeft, Calculator, CalendarPlus, Check, Info, Landmark, ShieldAlert } from "lucide-react";
import { berechneNachRegel, FRIST_REGELN, fristArt, gerichtsortDerAkte, type Einheit, type FristRegel } from "@/core/fristen";
import { BUNDESLAENDER, bundeslandAusGericht, bundeslandAusOrt, bundeslandName } from "@/core/feiertage";
import { fmtDateLong, relDays, today, wochentagName, fmtDateWd } from "@/core/dates";
import { normalize } from "@/core/search";
import type { Bundesland } from "@/core/types";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Chip, Field, Input, Modal, SearchField, Segmented, Select } from "@/components/ui";
import { cn } from "@/lib/cn";
import { RechenwegListe } from "./FristZeile";
import { MiniKalender } from "./MiniKalender";
import { legeFristAn, rohesEnde } from "./logik";

const GEBIETE: FristRegel["gebiet"][] = ["Zivilprozess", "Arbeitsrecht", "Familienrecht", "Mahnverfahren", "Strafrecht", "Verwaltungsrecht", "Materielles Recht", "Vertraglich vereinbart"];

function einheitLabelVon(einheit: Einheit, n: number) {
  if (einheit === "tage") return n === 1 ? "Tag" : "Tage";
  if (einheit === "wochen") return n === 1 ? "Woche" : "Wochen";
  if (einheit === "monate") return n === 1 ? "Monat" : "Monate";
  return "Jahre (ab Jahresende)";
}

function einheitLabel(r: FristRegel, n: number) {
  return einheitLabelVon(r.einheit, n);
}

function dauerText(r: FristRegel) {
  if (r.festesDatum === "pflicht") return "festes Datum";
  if (r.dauerPflicht) return "Dauer laut Vorgabe";
  return `${r.dauer} ${einheitLabel(r, r.dauer)}`;
}

/** Rechtsmittel- und Begründungsfristen: ohne Gericht bzw. Bundesland keine Berechnung (Feiertage am Gerichtsort). */
export function istRechtsmittelfrist(r: FristRegel): boolean {
  return /berufung|revision|beschwerde|begruendung|einspruch_vu|einspruch_vb/.test(r.key) && !r.handlungsort;
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
  const kontakte = useCol("kontakte");
  const nav = useNavigate();
  const [suche, setSuche] = useState("");
  const [key, setKey] = useState(startRegel && FRIST_REGELN.some((r) => r.key === startRegel) ? startRegel : "berufung");
  const [ereignis, setEreignis] = useState(() => (istIsoDatum(startEreignis) ? startEreignis : today()));
  const [dauer, setDauer] = useState("");
  const [einheitWahl, setEinheitWahl] = useState<Exclude<Einheit, "jahresende">>("tage");
  const [modus, setModus] = useState<"dauer" | "datum">("dauer");
  const [festesEnde, setFestesEnde] = useState("");
  // Gericht (Gerichtsort): Suche und Freitext, das Bundesland folgt automatisch – sichtbar und überschreibbar.
  const [gericht, setGericht] = useState("");
  // Von Hand gewähltes Bundesland ("" = keines) – keine stille Vorbelegung mit dem Kanzleisitz.
  const [landWahl, setLandWahl] = useState<Bundesland | "">("");
  const [akteId, setAkteId] = useState(startAkteId ?? "");
  const [eingetragen, setEingetragen] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEingetragen(null);
    setLandWahl("");
    setGericht("");
    if (startAkteId) setAkteId(startAkteId);
    if (startRegel && FRIST_REGELN.some((r) => r.key === startRegel)) {
      setKey(startRegel);
      setDauer("");
      setFestesEnde("");
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

  const gefiltert = useMemo(() => {
    const q = normalize(suche.trim());
    if (!q) return FRIST_REGELN;
    return FRIST_REGELN.filter((r) => normalize([r.titel, r.grundlage, r.ereignis, r.gebiet, ...r.stichworte].join(" ")).includes(q));
  }, [suche]);
  // Gewählt ist nur eine Fristart, die in der (gefilterten) Liste steht – nie ein altes Ergebnis stehen lassen.
  const gewaehlt = gefiltert.find((r) => r.key === key);
  const regel = gewaehlt ?? FRIST_REGELN.find((r) => r.key === key) ?? FRIST_REGELN[0];
  const art = fristArt(regel);
  const mitDatum = regel.festesDatum === "pflicht" || (regel.festesDatum === "moeglich" && modus === "datum");
  const dauerNum = dauer.trim() ? Math.max(1, Math.min(999, parseInt(dauer, 10) || 0)) || undefined : undefined;
  const einheit: Einheit = regel.dauerPflicht && regel.einheit !== "jahresende" ? einheitWahl : regel.einheit;
  const gueltig = /^\d{4}-\d{2}-\d{2}$/.test(ereignis);
  const akte = akten.find((a) => a.id === akteId);
  const gerichtsort = useMemo(() => gerichtsortDerAkte(akte, kontakte), [akte, kontakte]);
  const ausGericht = useMemo(() => {
    const t = gericht.trim();
    if (t.length < 3) return undefined;
    return bundeslandAusGericht(t)?.land ?? bundeslandAusOrt(t.replace(/^(?:amts|land|oberlandes|arbeits|landesarbeits|sozial|verwaltungs)gericht\s+/i, ""));
  }, [gericht]);
  /** Bundesland samt Herkunft: Ort der Handlung > Auswahl von Hand > Gericht (Eingabe) > Gericht der Akte > (nur ohne Pflicht) Kanzleisitz */
  const ort = useMemo((): { land: Bundesland; label: string; quelle: "handlung" | "wahl" | "gericht" | "akte" | "kanzlei" } | undefined => {
    if (regel.handlungsort) return { land: regel.handlungsort.land, label: `Ort der Handlung: ${regel.handlungsort.ort}`, quelle: "handlung" };
    if (landWahl) return { land: landWahl, label: gericht.trim() ? `${gericht.trim()} – Bundesland gewählt` : "Bundesland gewählt", quelle: "wahl" };
    if (ausGericht) return { land: ausGericht, label: gericht.trim(), quelle: "gericht" };
    if (gerichtsort) return { land: gerichtsort.land, label: `${gerichtsort.gericht} – laut Akte`, quelle: "akte" };
    if (istRechtsmittelfrist(regel)) return undefined;
    return { land: tenant.bundesland, label: "Kanzleisitz – kein Gericht angegeben", quelle: "kanzlei" };
  }, [regel, landWahl, gericht, ausGericht, gerichtsort, tenant.bundesland]);
  const effLand = ort?.land;
  const fehlt = !gewaehlt
    ? "Bitte Fristart wählen"
    : !gueltig
      ? "Bitte ein gültiges Datum eingeben."
      : !ort
        ? "Bitte Gericht oder Bundesland wählen – maßgeblich sind die Feiertage am Gerichtsort"
        : mitDatum && !/^\d{4}-\d{2}-\d{2}$/.test(festesEnde)
          ? `Bitte das Fristende laut ${regel.key === "widerruf_vergleich" ? "Vergleich" : "Vereinbarung"} eingeben`
          : !mitDatum && regel.dauerPflicht && !dauerNum
            ? "Bitte die Dauer eingeben – AnwaltApex setzt keinen Standardwert"
            : undefined;
  const erg = useMemo(
    () =>
      !fehlt && ort
        ? berechneNachRegel(key, ereignis, ort.land, mitDatum ? undefined : dauerNum, {
            feiertagsOrt: ort.quelle === "handlung" ? undefined : ort.label,
            kanzleiLand: tenant.bundesland,
            einheit: regel.dauerPflicht && einheit !== "jahresende" ? einheit : undefined,
            festesEnde: mitDatum ? festesEnde : undefined,
          })
        : null,
    [fehlt, ort, key, ereignis, mitDatum, dauerNum, tenant.bundesland, regel.dauerPflicht, einheit, festesEnde],
  );
  const roh = erg ? (mitDatum ? erg.rohesEnde : rohesEnde(ereignis, dauerNum ?? regel.dauer, einheit)) : null;
  const landHinweis = regel.handlungsort
    ? `Diese Frist wird beim ${regel.handlungsort.ort} gewahrt – es gelten dessen Feiertage.`
    : ort?.quelle === "akte"
      ? `Gerichtsort laut Akte: ${gerichtsort?.gericht}.`
      : ort?.quelle === "gericht"
        ? `Aus dem Gericht erkannt${ort.land !== tenant.bundesland ? ` – abweichend vom Kanzleisitz (${bundeslandName(tenant.bundesland)})` : ""}.`
        : ort?.quelle === "wahl"
          ? `Von Hand gewählt${ort.land !== tenant.bundesland ? ` – abweichend vom Kanzleisitz (${bundeslandName(tenant.bundesland)})` : ""}.`
          : istRechtsmittelfrist(regel)
            ? "Pflichtangabe bei Rechtsmitteln: Maßgeblich sind die Feiertage am Ort des Gerichts."
            : `Ohne Angabe gelten die Feiertage am Kanzleisitz (${bundeslandName(tenant.bundesland)}).`;
  const gerichtVorschlaege = useMemo(
    () => [...new Set([...kontakte.filter((k) => k.rollen.includes("gericht")).map((k) => k.name), "Hessisches LAG", "LAG Hessen Frankfurt", "OLG Brandenburg", "Kammergericht", "Landesarbeitsgericht Hamm", "Oberlandesgericht Hamm"])].sort((a, b) => a.localeCompare(b, "de")),
    [kontakte],
  );

  const offeneAkten = useMemo(() => akten.filter((a) => a.status !== "abgeschlossen").sort((a, b) => b.aktenzeichen.localeCompare(a.aktenzeichen, "de", { numeric: true })), [akten]);
  // rot hervorheben: Notfrist oder gesetzlich nicht verlängerbare Frist (§ 4 KSchG, StPO, OWiG, VwGO)
  const kritisch = art.kritisch;

  const eintragen = () => {
    if (!erg || !akte) return;
    const titel = mitDatum
      ? `${regel.titel} (bis ${fmtDateWd(festesEnde)})`
      : dauerNum && (dauerNum !== regel.dauer || regel.dauerPflicht)
        ? `${regel.titel} (${dauerNum} ${einheitLabelVon(einheit, dauerNum)})`
        : regel.titel;
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
      notiz: effLand && ort ? `Berechnet mit den Feiertagen in ${bundeslandName(effLand)} (${ort.label}).` : undefined,
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
      subtitle="Nach § 222 ZPO, §§ 187 ff. BGB bzw. §§ 42, 43 StPO – mit Feiertagen am Gerichtsort und vollständigem Rechenweg."
      icon={<Calculator className="size-[18px]" />}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {erg && (
            <div className="num flex w-full items-baseline gap-2 text-[12.5px] lg:hidden">
              <span className="text-fg-3">Fristende</span>
              <span className={cn("font-semibold", kritisch ? "text-seal" : "text-fg")}>{fmtDateWd(erg.ende)}</span>
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
                  <div key={g} role="group" aria-label={g} className="mb-1 last:mb-0">
                    <div aria-hidden className="eyebrow sticky top-0 z-10 rounded-[10px] bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] px-2.5 py-1.5 backdrop-blur">{g}</div>
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
                            setFestesEnde("");
                            setModus(r.festesDatum === "pflicht" ? "datum" : "dauer");
                            if (r.einheit !== "jahresende") setEinheitWahl(r.einheit);
                            setEingetragen(null);
                          }}
                          className={cn("relative isolate flex w-full items-center gap-2 rounded-[12px] px-2.5 py-2 text-left", !aktiv && "hover:bg-[var(--ink-softer)]")}
                        >
                          {aktiv && <motion.span layoutId="rechner-regel" className="absolute inset-0 -z-10 rounded-[12px] bg-surface shadow-[0_2px_10px_-4px_rgba(20,30,80,0.2),0_0_0_1px_var(--line)]" transition={{ type: "spring", stiffness: 520, damping: 38 }} />}
                          <div className="min-w-0 flex-1">
                            <div className={cn("text-[13px] leading-snug", aktiv ? "font-semibold text-fg" : "font-medium text-fg-2")}>{r.titel}</div>
                            <div className="text-[12.5px] leading-snug text-fg-3">
                              {r.grundlage} · {dauerText(r)}
                            </div>
                          </div>
                          {fristArt(r).kritisch && <ShieldAlert className="size-3.5 shrink-0 text-seal" aria-label={r.typ === "notfrist" ? "Notfrist" : "nicht verlängerbar"} />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              {!gefiltert.length && (
                <div role="option" aria-selected={false} aria-disabled className="px-3 py-6 text-center text-[12.5px] text-fg-3">
                  Keine Fristart gefunden. Tipp: „Frei bestimmte Frist“ für richterliche Fristen, „FamFG“ für Familiensachen.
                </div>
              )}
            </div>
          </div>
          {regel.festesDatum === "moeglich" && (
            <Segmented
              size="sm"
              value={modus}
              onChange={(m) => { setModus(m); setEingetragen(null); }}
              options={[
                { value: "dauer", label: "Dauer ab Ereignis" },
                { value: "datum", label: "Festes Datum laut Vergleich" },
              ]}
            />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={regel.ereignis} htmlFor="rechner-ereignis">
              <Input id="rechner-ereignis" type="date" value={ereignis} onChange={(e) => { setEreignis(e.target.value); setEingetragen(null); }} />
            </Field>
            {mitDatum ? (
              <Field label={`Fristende laut ${regel.key === "widerruf_vergleich" ? "Vergleich" : "Vereinbarung"}`} htmlFor="rechner-festes-ende">
                <Input id="rechner-festes-ende" type="date" required aria-required="true" value={festesEnde} min={ereignis} onChange={(e) => { setFestesEnde(e.target.value); setEingetragen(null); }} />
              </Field>
            ) : regel.dauerPflicht ? (
              <Field label="Dauer (Pflichtangabe)" htmlFor="rechner-dauer">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-2">
                  <Input id="rechner-dauer" type="number" inputMode="numeric" min={1} max={999} required aria-required="true" value={dauer} placeholder="z. B. 2" onChange={(e) => { setDauer(e.target.value); setEingetragen(null); }} />
                  <Select id="rechner-einheit" aria-label="Einheit der Dauer" value={einheitWahl} onChange={(e) => { setEinheitWahl(e.target.value as Exclude<Einheit, "jahresende">); setEingetragen(null); }}>
                    <option value="tage">Tage</option>
                    <option value="wochen">Wochen</option>
                    <option value="monate">Monate</option>
                  </Select>
                </div>
              </Field>
            ) : (
              <Field label="Abweichende Dauer (optional)" htmlFor="rechner-dauer">
                <div className="relative">
                  <Input id="rechner-dauer" type="number" inputMode="numeric" min={1} max={999} value={dauer} placeholder={String(regel.dauer)} onChange={(e) => { setDauer(e.target.value); setEingetragen(null); }} className="!pr-24" />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[12.5px] text-fg-3">{einheitLabel(regel, dauerNum ?? regel.dauer)}</span>
                </div>
              </Field>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Gericht (Gerichtsort)" htmlFor="rechner-gericht" hint={regel.handlungsort ? `Feste Stelle: ${regel.handlungsort.ort}` : gerichtsort && !gericht ? `Laut Akte: ${gerichtsort.gericht}` : "Suche oder Freitext, z. B. „Hessisches LAG“"}>
              <Input
                id="rechner-gericht"
                list="rechner-gerichte"
                value={gericht}
                disabled={!!regel.handlungsort}
                placeholder={gerichtsort?.gericht ?? "z. B. OLG Brandenburg"}
                onChange={(e) => { setGericht(e.target.value); setLandWahl(""); setEingetragen(null); }}
              />
              <datalist id="rechner-gerichte">
                {gerichtVorschlaege.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </Field>
            <Field label="Bundesland (Gerichtsort)" htmlFor="rechner-land" hint={landHinweis}>
              <Select
                id="rechner-land"
                value={landWahl || effLand || ""}
                disabled={!!regel.handlungsort}
                aria-invalid={!ort}
                onChange={(e) => { setLandWahl(e.target.value as Bundesland | ""); setEingetragen(null); }}
              >
                <option value="">{istRechtsmittelfrist(regel) ? "Bitte wählen …" : `Kanzleisitz (${bundeslandName(tenant.bundesland)})`}</option>
                {BUNDESLAENDER.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                    {ort?.land === b.code && ort.quelle === "gericht" && !landWahl ? " – aus Gericht erkannt" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {regel.hinweis && (
            <div className="flex gap-2 rounded-[14px] bg-ink-softer p-3 text-[12.5px] leading-relaxed text-fg-2 ring-1 ring-inset ring-[var(--line)]">
              <Info className="mt-0.5 size-3.5 shrink-0 text-ink" />
              <span>{regel.hinweis}</span>
            </div>
          )}
        </div>

        {/* Ergebnis */}
        <div className="min-w-0 space-y-4">
          {erg && roh && ort ? (
            <>
              <motion.div
                key={`${erg.ende}-${regel.key}`}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className={cn("relative overflow-hidden rounded-[22px] p-5", kritisch ? "bg-seal-soft" : "bg-ink-soft")}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("eyebrow", kritisch ? "!text-seal" : "!text-ink")}>Fristende</span>
                  <Chip tone={kritisch ? "seal" : "ink"} icon={kritisch ? <ShieldAlert className="size-3" /> : undefined} title={art.kurz}>
                    {regel.typ === "notfrist" ? "Notfrist" : kritisch ? "Frist · nicht verlängerbar" : "Frist"}
                  </Chip>
                  {erg.verschoben && (
                    <Chip tone="amber" icon={<ArrowRightLeft className="size-3" />} title={`Ende fiel auf Wochenende/Feiertag – verschoben auf den nächsten Werktag (${erg.verschiebungsNorm})`}>
                      verschoben · {erg.verschiebungsNorm.replace(/^.* i\. V\. m\. /, "").split(",")[0]}
                    </Chip>
                  )}
                </div>
                <div className={cn("mt-2 text-[15px] font-medium", kritisch ? "text-seal" : "text-ink")}>{wochentagName(erg.ende)}</div>
                <div className={cn("text-[clamp(26px,3.6vw,36px)] font-bold leading-[1.05] tracking-[-0.035em]", kritisch ? "text-seal" : "text-fg")}>{fmtDateLong(erg.ende)}</div>
                <div className="num mt-1.5 text-[13px] text-fg-2">24:00 Uhr · {relDays(erg.ende)}</div>
                <div className="mt-2 flex items-start gap-1.5 text-[12.5px] font-medium text-fg-2">
                  <Landmark className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    Feiertage: {bundeslandName(ort.land)} (
                    {ort.quelle === "handlung" ? ort.label : ort.quelle === "kanzlei" ? "Kanzleisitz – kein Gericht angegeben" : `Gerichtsort: ${ort.label.replace(/ – (laut Akte|Bundesland gewählt)$/, "")}`})
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[color-mix(in_oklab,var(--fg)_10%,transparent)] pt-3.5 text-[12.5px]">
                  <div>
                    <div className="text-fg-3">Vorfrist ({regel.vorfristTage} Tage)</div>
                    <div className="num mt-0.5 font-semibold">{fmtDateWd(erg.vorfrist)}</div>
                  </div>
                  <div>
                    <div className="text-fg-3">{regel.grundlage}</div>
                    <div className="mt-0.5 font-semibold">{mitDatum ? `bis ${fmtDateWd(festesEnde)}` : dauerNum ? `${dauerNum} ${einheitLabelVon(einheit, dauerNum)}` : dauerText(regel)}</div>
                  </div>
                </div>
              </motion.div>

              {(art.art || art.versaeumnis) && (
                <div className={cn("flex gap-2 rounded-[14px] px-3.5 py-2.5 text-[12.5px] leading-relaxed", kritisch ? "bg-seal-soft text-seal" : "bg-ink-softer text-fg-2 ring-1 ring-inset ring-[var(--line)]")}>
                  {kritisch ? <ShieldAlert className="mt-0.5 size-3.5 shrink-0" /> : <Info className="mt-0.5 size-3.5 shrink-0 text-ink" />}
                  <span>
                    {art.art && <strong className="font-semibold">{art.art} </strong>}
                    {art.versaeumnis}
                  </span>
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
                <MiniKalender marken={{ ereignis, roh, ende: erg.ende, vorfrist: erg.vorfrist, notfrist: kritisch }} land={ort.land} />
              </div>

              <div className="rounded-[18px] p-4 ring-1 ring-inset ring-[var(--line)]">
                <div className="eyebrow mb-3">Rechenweg</div>
                {/* sofort vollständig – ohne zeilenweises Einblenden */}
                <RechenwegListe schritte={erg.rechenweg} />
              </div>
            </>
          ) : (
            <div role="status" className="grid h-full min-h-[220px] place-items-center rounded-[22px] p-10 text-center ring-1 ring-inset ring-[var(--line)]">
              <div className="max-w-[340px]">
                <Calculator className="mx-auto size-6 text-fg-3" />
                <div className="mt-2 text-[14px] font-semibold text-fg">{fehlt ?? "Bitte Eingaben prüfen"}</div>
                <div className="mt-1 text-[12.5px] text-fg-3">Erst mit vollständigen Angaben rechnet AnwaltApex – ein altes Ergebnis bleibt nie stehen.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
