import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { AlertTriangle, ArrowRightLeft, Calculator, CalendarPlus, Check, Info, Landmark, Lock, ShieldAlert, X } from "lucide-react";
import { berechneNachRegel, FRIST_REGELN, fristArt, gerichtsortDerAkte, type Einheit, type FristRegel } from "@/core/fristen";
import { BUNDESLAENDER, bundeslandAusGericht, bundeslandAusOrt, bundeslandName } from "@/core/feiertage";
import { fmtDateLong, relDays, today, wochentagName, fmtDateWd } from "@/core/dates";
import type { Bundesland } from "@/core/types";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Chip, Field, Input, Modal, Segmented, Select, Switch } from "@/components/ui";
import { cn } from "@/lib/cn";
import { RechenwegListe } from "./FristZeile";
import { MiniKalender } from "./MiniKalender";
import { legeFristAn, rohesEnde } from "./logik";
import { FristartAuswahl } from "./FristartAuswahl";
import { sucheFristarten } from "./fristartSuche";
import { ereignisFehlt, ereignisHerkunftText, rechenwegMitHerkunft, startEreignisZustand, type EreignisHerkunft } from "./rechnerEingabe";

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


/**
 * Fristenrechner (Modal). Deep-Link-Vertrag der Fristen-Seite:
 * /fristen?rechner=1&regel=<regelKey>&ereignis=<YYYY-MM-DD>&akte=<akteId>[&herkunft=<Text>] – alle Parameter außer `rechner` optional;
 * der Rechner öffnet dann vorbefüllt und zeigt das Ergebnis sofort. Ohne `ereignis` ist das Ereignisfeld leer und Pflicht –
 * „heute“ nur als Schnellwahl, nie still vorbelegt (I3-T18-02, wie im Akten-Dialog seit I2-T14-01).
 */
export function Fristenrechner({
  open,
  onClose,
  startAkteId,
  startRegel,
  startEreignis,
  startQuelle,
}: {
  open: boolean;
  onClose: () => void;
  startAkteId?: string;
  startRegel?: string;
  startEreignis?: string;
  /** Woher das übergebene Ereignisdatum stammt, z. B. „dem Posteingang“ (Rechenweg: „Ereignisdatum aus … übernommen“). */
  startQuelle?: string;
}) {
  const { tenant, user } = useKanzlei();
  const akten = useCol("akten");
  const kontakte = useCol("kontakte");
  const nav = useNavigate();
  const [suche, setSuche] = useState("");
  // Ohne `regel`-Parameter keine Vorwahl (I4-T18-03) – die Fristart wählt die Nutzerin bewusst
  const [key, setKey] = useState(startRegel && FRIST_REGELN.some((r) => r.key === startRegel) ? startRegel : "");
  // Ereignisdatum leer und Pflicht – vorbelegt nur, wenn es ausdrücklich übergeben wird (startEreignis)
  const [ereignis, setEreignis] = useState(() => startEreignisZustand(startEreignis).ereignis);
  const [ereignisHerkunft, setEreignisHerkunft] = useState<EreignisHerkunft>(() => startEreignisZustand(startEreignis).herkunft);
  const [dauer, setDauer] = useState("");
  const [einheitWahl, setEinheitWahl] = useState<Exclude<Einheit, "jahresende">>("tage");
  const [modus, setModus] = useState<"dauer" | "datum">("dauer");
  const [festesEnde, setFestesEnde] = useState("");
  // Gericht (Gerichtsort): Suche und Freitext, das Bundesland folgt automatisch – sichtbar und überschreibbar.
  const [gericht, setGericht] = useState("");
  // Von Hand gewähltes Bundesland ("" = keines) – keine stille Vorbelegung mit dem Kanzleisitz.
  const [landWahl, setLandWahl] = useState<Bundesland | "">("");
  // Ist ein Gericht mit bekanntem Land erkannt, ist das Bundesland gesperrt („aus dem Gericht abgeleitet“). Abweichen nur
  // bewusst: Schalter „Abweichenden Gerichtsort wählen“ mit Warnung und Pflichtbestätigung (I2-T18-04).
  const [abweichend, setAbweichend] = useState(false);
  const [abweichendBestaetigt, setAbweichendBestaetigt] = useState(false);
  // Gericht der Akte für diese Berechnung nicht verwenden („Gericht entfernen“)
  const [ohneAktenGericht, setOhneAktenGericht] = useState(false);
  // Reihenfolge Land → Gericht: das Gericht gewinnt; die ersetzte Auswahl wird genannt
  const [ersetzteWahl, setErsetzteWahl] = useState<Bundesland | "">("");
  const [akteId, setAkteId] = useState(startAkteId ?? "");
  const [eingetragen, setEingetragen] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEingetragen(null);
    setLandWahl("");
    setGericht("");
    setAbweichend(false);
    setAbweichendBestaetigt(false);
    setOhneAktenGericht(false);
    setErsetzteWahl("");
    if (startAkteId) setAkteId(startAkteId);
    // Mit `?regel=` (Akte, Posteingang, Assistent) vorgewählt, sonst ohne Vorwahl – nie die Fristart einer früheren Berechnung
    setKey(startRegel && FRIST_REGELN.some((r) => r.key === startRegel) ? startRegel : "");
    setDauer("");
    setFestesEnde("");
    setSuche("");
    // Ohne übergebenes Ereignis beim Öffnen leer – kein Datum aus einer früheren Berechnung stehen lassen
    const start = startEreignisZustand(startEreignis);
    setEreignis(start.ereignis);
    setEreignisHerkunft(start.herkunft);
  }, [open, startAkteId, startRegel, startEreignis]);

  const gefiltert = useMemo(() => sucheFristarten(suche, FRIST_REGELN), [suche]);
  // Gewählt ist nur eine Fristart, die in der (gefilterten) Liste steht – nie ein altes Ergebnis stehen lassen.
  const gewaehlt = gefiltert.find((r) => r.key === key);
  const regel = gewaehlt ?? FRIST_REGELN.find((r) => r.key === key) ?? FRIST_REGELN[0];
  const art = fristArt(regel);
  const mitDatum = regel.festesDatum === "pflicht" || (regel.festesDatum === "moeglich" && modus === "datum");
  const dauerNum = dauer.trim() ? Math.max(1, Math.min(999, parseInt(dauer, 10) || 0)) || undefined : undefined;
  const einheit: Einheit = regel.dauerPflicht && regel.einheit !== "jahresende" ? einheitWahl : regel.einheit;
  const gueltig = /^\d{4}-\d{2}-\d{2}$/.test(ereignis);
  const akte = akten.find((a) => a.id === akteId);
  const aktenGerichtsort = useMemo(() => gerichtsortDerAkte(akte, kontakte), [akte, kontakte]);
  const gerichtsort = ohneAktenGericht ? undefined : aktenGerichtsort;
  const ausGericht = useMemo(() => {
    const t = gericht.trim();
    if (t.length < 3) return undefined;
    return bundeslandAusGericht(t)?.land ?? bundeslandAusOrt(t.replace(/^(?:amts|land|oberlandes|arbeits|landesarbeits|sozial|verwaltungs)gericht\s+/i, ""));
  }, [gericht]);
  /** Gericht mit bekanntem Land: eingegebenes Gericht, sonst (ohne Eingabe) das Gericht der Akte. */
  const gerichtLand = useMemo((): { land: Bundesland; label: string; gericht: string; quelle: "gericht" | "akte" } | undefined => {
    if (ausGericht) return { land: ausGericht, label: gericht.trim(), gericht: gericht.trim(), quelle: "gericht" };
    if (!gericht.trim() && gerichtsort) return { land: gerichtsort.land, label: `${gerichtsort.gericht} – laut Akte`, gericht: gerichtsort.gericht, quelle: "akte" };
    return undefined;
  }, [ausGericht, gericht, gerichtsort]);
  /**
   * Bundesland samt Herkunft: Ort der Handlung > Gericht mit bekanntem Land (gesperrt) > bewusst abweichende bzw. von Hand
   * gewählte Auswahl > (nur ohne Pflicht) Kanzleisitz.
   */
  const ort = useMemo((): { land: Bundesland; label: string; quelle: "handlung" | "wahl" | "abweichend" | "gericht" | "akte" | "kanzlei" } | undefined => {
    if (regel.handlungsort) return { land: regel.handlungsort.land, label: `Ort der Handlung: ${regel.handlungsort.ort}`, quelle: "handlung" };
    if (gerichtLand && !(abweichend && landWahl)) return gerichtLand;
    if (gerichtLand && landWahl && landWahl !== gerichtLand.land) return { land: landWahl, label: `abweichend gewählt – ${gerichtLand.gericht} liegt in ${bundeslandName(gerichtLand.land)}`, quelle: "abweichend" };
    if (landWahl) return { land: landWahl, label: gericht.trim() ? `${gericht.trim()} – Bundesland gewählt` : "Bundesland gewählt", quelle: "wahl" };
    if (istRechtsmittelfrist(regel)) return undefined;
    return { land: tenant.bundesland, label: "Kanzleisitz – kein Gericht angegeben", quelle: "kanzlei" };
  }, [regel, landWahl, gericht, gerichtLand, abweichend, tenant.bundesland]);
  /** Bundesland weicht bewusst vom erkannten Gericht ab – Eintragen erst nach Bestätigung. */
  const widerspruch = ort?.quelle === "abweichend";
  const landGesperrt = !!gerichtLand && !abweichend && !regel.handlungsort;
  const effLand = ort?.land;
  const fehlt = !gewaehlt
    ? "Bitte die Fristart wählen"
    : ereignisFehlt(ereignis, regel.ereignis)
      ? ereignisFehlt(ereignis, regel.ereignis)
      : !ort
        ? "Bitte Gericht oder Bundesland wählen – maßgeblich sind die Feiertage am Gerichtsort"
        : mitDatum && !/^\d{4}-\d{2}-\d{2}$/.test(festesEnde)
          ? `Bitte das Fristende laut ${regel.key === "widerruf_vergleich" ? "Vergleich" : "Vereinbarung"} eingeben`
          : !mitDatum && regel.dauerPflicht && !dauerNum
            ? "Bitte die Dauer eingeben – Apex setzt keinen Standardwert"
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
  // Rechenweg mit Herkunft des Ereignisdatums (erste Zeile), z. B. „… · heute (Schnellwahl)“
  const herkunftText = ereignisHerkunftText(ereignisHerkunft, startQuelle);
  const rechenweg = erg ? rechenwegMitHerkunft(erg.rechenweg, herkunftText) : [];
  const landHinweis = regel.handlungsort
    ? `Diese Frist wird beim ${regel.handlungsort.ort} gewahrt – es gelten dessen Feiertage.`
    : ort?.quelle === "akte"
      ? `Gerichtsort laut Akte: ${gerichtsort?.gericht}.`
      : ort?.quelle === "gericht"
        ? `Aus dem Gericht abgeleitet${ort.land !== tenant.bundesland ? ` – abweichend vom Kanzleisitz (${bundeslandName(tenant.bundesland)})` : ""}.`
        : ort?.quelle === "abweichend"
          ? `Abweichend vom Gericht (${bundeslandName(gerichtLand?.land ?? ort.land)}) – nur nach Bestätigung eintragbar.`
          : ort?.quelle === "wahl"
          ? `Von Hand gewählt${ort.land !== tenant.bundesland ? ` – abweichend vom Kanzleisitz (${bundeslandName(tenant.bundesland)})` : ""}.`
          : !gewaehlt
            ? "Maßgeblich sind die Feiertage am Ort des Gerichts (§ 222 Abs. 2 ZPO)."
            : istRechtsmittelfrist(regel)
            ? "Pflichtangabe bei Rechtsmitteln: Maßgeblich sind die Feiertage am Ort des Gerichts."
            : `Ohne Angabe gelten die Feiertage am Kanzleisitz (${bundeslandName(tenant.bundesland)}).`;
  const gerichtAendern = (wert: string) => {
    const neuLand = wert.trim().length >= 3 ? (bundeslandAusGericht(wert.trim())?.land ?? bundeslandAusOrt(wert.trim().replace(/^(?:amts|land|oberlandes|arbeits|landesarbeits|sozial|verwaltungs)gericht\s+/i, ""))) : undefined;
    // Land → Gericht: Das Gericht gewinnt; eine abweichende Auswahl von Hand wird ersetzt und genannt.
    if (neuLand && landWahl && landWahl !== neuLand) setErsetzteWahl(landWahl);
    else if (!neuLand) setErsetzteWahl("");
    if (neuLand) setLandWahl("");
    setGericht(wert);
    setAbweichend(false);
    setAbweichendBestaetigt(false);
    setEingetragen(null);
  };
  const gerichtEntfernen = () => {
    if (gericht.trim()) setGericht("");
    else setOhneAktenGericht(true);
    setAbweichend(false);
    setAbweichendBestaetigt(false);
    setErsetzteWahl("");
    setEingetragen(null);
  };
  const gerichtVorschlaege = useMemo(
    () => [...new Set([...kontakte.filter((k) => k.rollen.includes("gericht")).map((k) => k.name), "Hessisches LAG", "LAG Hessen Frankfurt", "OLG Brandenburg", "Kammergericht", "Landesarbeitsgericht Hamm", "Oberlandesgericht Hamm"])].sort((a, b) => a.localeCompare(b, "de")),
    [kontakte],
  );

  // Grund, warum „Als Frist in Akte eintragen“ gesperrt ist – sichtbar am Knopf (I4-T18-01, Teil B)
  const sperrGruende = [
    !gewaehlt ? "die Fristart wählen" : ereignisFehlt(ereignis, regel.ereignis) ? "das Datum eintragen" : !ort ? "Gericht oder Bundesland wählen" : mitDatum && !/^\d{4}-\d{2}-\d{2}$/.test(festesEnde) ? "das Fristende eintragen" : !mitDatum && regel.dauerPflicht && !dauerNum ? "die Dauer eintragen" : "",
    !akte ? "eine Akte wählen" : "",
  ].filter(Boolean);
  const sperrGrund = sperrGruende.length ? `Erst ${sperrGruende.join(" und ")}` : widerspruch && !abweichendBestaetigt ? "Erst die Abweichung vom Gerichtsort bestätigen" : "";

  const offeneAkten = useMemo(() => akten.filter((a) => a.status !== "abgeschlossen").sort((a, b) => b.aktenzeichen.localeCompare(a.aktenzeichen, "de", { numeric: true })), [akten]);
  // rot hervorheben: Notfrist oder gesetzlich nicht verlängerbare Frist (§ 4 KSchG, StPO, OWiG, VwGO)
  const kritisch = art.kritisch;

  const eintragen = () => {
    if (!erg || !akte || !ort || (widerspruch && !abweichendBestaetigt)) return;
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
      rechenweg,
      // Verwendeter Gerichtsort – Korrekturen rechnen mit denselben Feiertagen weiter (I3-T03-02)
      gerichtsort:
        ort.quelle === "gericht" || ort.quelle === "akte"
          ? { land: ort.land, gericht: gerichtLand?.gericht ?? ort.label, quelle: ort.quelle }
          : ort.quelle === "handlung"
            ? { land: ort.land, gericht: regel.handlungsort?.ort, quelle: "gericht" }
            : ort.quelle === "kanzlei"
              ? { land: ort.land, quelle: "kanzleisitz" }
              : { land: ort.land, ...(gericht.trim() ? { gericht: gericht.trim() } : {}), quelle: "hand" },
      quelle: "manuell",
      verantwortlichId: akte.bearbeiterId,
      vorfristVerantwortlichId: akte.sachbearbeiterId ?? akte.bearbeiterId,
      notiz: effLand && ort ? `Berechnet mit den Feiertagen in ${bundeslandName(effLand)} (${ort.label})${widerspruch ? " – Abweichung vom Gerichtsort bestätigt" : ""}.` : undefined,
    });
    useData.getState().log({
      akteur: "nutzer",
      userId: user.id,
      akteId: akte.id,
      text: `${titel} mit Fristenrechner eingetragen: ${fmtDateWd(erg.ende)} (Vorfrist ${fmtDateWd(erg.vorfrist)})${widerspruch && gerichtLand ? ` – Feiertage ${bundeslandName(ort!.land)} abweichend vom Gerichtsort ${gerichtLand.gericht} (${bundeslandName(gerichtLand.land)}) bestätigt` : ""}`,
    });
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
            <div className="flex min-w-0 flex-col items-stretch gap-1 sm:items-end">
              <Button variant="primary" icon={<CalendarPlus className="size-4" />} disabled={!akte || !erg || (widerspruch && !abweichendBestaetigt)} onClick={eintragen} aria-describedby={sperrGrund ? "rechner-sperrgrund" : undefined}>
                Als Frist in Akte eintragen
              </Button>
              {sperrGrund && (
                <p id="rechner-sperrgrund" className="flex items-center gap-1.5 text-[12px] text-fg-2 sm:justify-end">
                  <Info className="size-3.5 shrink-0 text-fg-3" aria-hidden />
                  {sperrGrund}
                </p>
              )}
            </div>
          )}
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        {/* Eingaben */}
        <div className="min-w-0 space-y-4">
          <FristartAuswahl
            id="rechner-suche"
            suche={suche}
            onSuche={setSuche}
            value={gewaehlt ? key : ""}
            naechstesFeldId="rechner-ereignis"
            onWaehle={(r) => {
              setKey(r.key);
              setDauer("");
              setFestesEnde("");
              setModus(r.festesDatum === "pflicht" ? "datum" : "dauer");
              if (r.einheit !== "jahresende") setEinheitWahl(r.einheit);
              setEingetragen(null);
            }}
          />
          {startRegel && gewaehlt && key === startRegel && (
            <p className="-mt-2 flex items-start gap-1.5 text-[12px] text-fg-3">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Fristart vorgewählt aus {startQuelle?.trim() || "dem Aufruf"} – bitte prüfen.
            </p>
          )}
          {gewaehlt && regel.festesDatum === "moeglich" && (
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
            <Field
              label={`${gewaehlt ? regel.ereignis : "Fristauslösendes Ereignis"} (Pflicht)`}
              htmlFor="rechner-ereignis"
              hint={ereignisHerkunft === "start" && gueltig ? `Aus ${startQuelle?.trim() || "dem Aufruf"} übernommen – bitte prüfen.` : ereignisHerkunft === "heute" && gueltig ? "heute (Schnellwahl)" : undefined}
            >
              <div className="flex gap-2">
                <Input
                  id="rechner-ereignis"
                  type="date"
                  required
                  aria-required="true"
                  aria-invalid={!ereignis ? undefined : !gueltig}
                  value={ereignis}
                  onChange={(e) => {
                    setEreignis(e.target.value);
                    setEreignisHerkunft("hand");
                    setEingetragen(null);
                  }}
                  className="min-w-0 flex-1"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="!h-11 shrink-0"
                  title="Heutiges Datum eintragen"
                  onClick={() => {
                    setEreignis(today());
                    setEreignisHerkunft("heute");
                    setEingetragen(null);
                  }}
                >
                  heute
                </Button>
              </div>
            </Field>
            {!gewaehlt ? null : mitDatum ? (
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
            <Field
              label="Gericht (Gerichtsort)"
              htmlFor="rechner-gericht"
              hint={regel.handlungsort ? `Feste Stelle: ${regel.handlungsort.ort}` : gerichtsort && !gericht ? `Laut Akte: ${gerichtsort.gericht}` : aktenGerichtsort && ohneAktenGericht && !gericht ? "Gericht der Akte entfernt – Gericht eingeben oder Bundesland wählen" : "Suche oder Freitext, z. B. „Hessisches LAG“"}
            >
              <div className="relative">
                <Input
                  id="rechner-gericht"
                  list="rechner-gerichte"
                  value={gericht}
                  disabled={!!regel.handlungsort}
                  placeholder={gerichtsort?.gericht ?? "z. B. OLG Brandenburg"}
                  onChange={(e) => gerichtAendern(e.target.value)}
                  className={gerichtLand && !regel.handlungsort ? "!pr-10" : undefined}
                />
                {gerichtLand && !regel.handlungsort && (
                  <button
                    type="button"
                    onClick={gerichtEntfernen}
                    aria-label={gerichtLand.quelle === "akte" ? "Gericht der Akte für diese Berechnung entfernen" : "Gericht entfernen"}
                    title="Gericht entfernen"
                    className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-fg-3 hover:bg-ink-softer hover:text-fg"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <datalist id="rechner-gerichte">
                {gerichtVorschlaege.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </Field>
            <Field
              label="Bundesland (Gerichtsort)"
              htmlFor="rechner-land"
              hint={
                landGesperrt ? (
                  <span className="inline-flex items-start gap-1">
                    <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
                    <span>Aus dem Gericht abgeleitet – {gerichtLand!.gericht}. Abweichen nur über „Gericht entfernen“ oder den Schalter unten.</span>
                  </span>
                ) : (
                  landHinweis
                )
              }
            >
              <Select
                id="rechner-land"
                value={landGesperrt ? gerichtLand!.land : landWahl || effLand || ""}
                disabled={!!regel.handlungsort || landGesperrt}
                aria-invalid={!ort || widerspruch}
                onChange={(e) => { setLandWahl(e.target.value as Bundesland | ""); setAbweichendBestaetigt(false); setErsetzteWahl(""); setEingetragen(null); }}
              >
                <option value="">{istRechtsmittelfrist(regel) ? "Bitte wählen …" : `Kanzleisitz (${bundeslandName(tenant.bundesland)})`}</option>
                {BUNDESLAENDER.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                    {gerichtLand?.land === b.code ? " – aus dem Gericht abgeleitet" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {ersetzteWahl && gerichtLand && !abweichend && (
            <div role="status" className="flex gap-2 rounded-[14px] bg-ink-softer p-3 text-[12.5px] leading-relaxed text-fg-2 ring-1 ring-inset ring-[var(--line)]">
              <Info className="mt-0.5 size-3.5 shrink-0 text-ink" />
              <span>
                Das Gericht gewinnt: Bundesland {bundeslandName(gerichtLand.land)} aus „{gerichtLand.gericht}“ übernommen – Ihre Auswahl {bundeslandName(ersetzteWahl)} gilt nicht mehr.
              </span>
            </div>
          )}
          {gerichtLand && !regel.handlungsort && (
            <div className="grid gap-2">
              <div className="flex items-center gap-3">
                <label htmlFor="rechner-abweichend" className="flex-1 text-[13px] text-fg-2">
                  Abweichenden Gerichtsort wählen
                </label>
                <Switch
                  id="rechner-abweichend"
                  checked={abweichend}
                  label="Abweichenden Gerichtsort wählen"
                  onChange={(v) => {
                    setAbweichend(v);
                    setAbweichendBestaetigt(false);
                    setErsetzteWahl("");
                    if (!v) setLandWahl("");
                    setEingetragen(null);
                  }}
                />
              </div>
              {widerspruch && gerichtLand && ort && (
                <div role="alert" className="grid gap-2 rounded-[14px] bg-seal-soft p-3 text-[12.5px] leading-relaxed text-seal">
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                      <strong className="font-semibold">Achtung – Feiertage passen nicht zum Gericht.</strong> {gerichtLand.gericht} liegt in {bundeslandName(gerichtLand.land)}; gerechnet wird mit den Feiertagen in {bundeslandName(ort.land)}. Maßgeblich sind die Feiertage am Ort des Gerichts (§ 222 Abs. 2 ZPO) – ein abweichendes Fristende kann die Frist versäumen lassen.
                    </span>
                  </div>
                  <label className="flex items-start gap-2 font-medium">
                    <input type="checkbox" className="mt-0.5 size-4 accent-[var(--seal)]" checked={abweichendBestaetigt} onChange={(e) => setAbweichendBestaetigt(e.target.checked)} />
                    <span>Ich habe geprüft: Der Gerichtsort liegt tatsächlich in {bundeslandName(ort.land)}.</span>
                  </label>
                </div>
              )}
            </div>
          )}
          {gewaehlt && regel.hinweis && (
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
                <div className={cn("mt-2 flex items-start gap-1.5 text-[12.5px] font-medium", widerspruch ? "text-seal" : "text-fg-2")}>
                  {widerspruch ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : <Landmark className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
                  <span>
                    Feiertage: {bundeslandName(ort.land)} (
                    {ort.quelle === "handlung" ? ort.label : ort.quelle === "kanzlei" ? "Kanzleisitz – kein Gericht angegeben" : ort.quelle === "abweichend" ? ort.label : `Gerichtsort: ${ort.label.replace(/ – (laut Akte|Bundesland gewählt)$/, "")}`})
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
                <RechenwegListe schritte={rechenweg} />
              </div>
            </>
          ) : (
            <div role="status" className="grid h-full min-h-[220px] place-items-center rounded-[22px] p-10 text-center ring-1 ring-inset ring-[var(--line)]">
              <div className="max-w-[340px]">
                <Calculator className="mx-auto size-6 text-fg-3" />
                <div className="mt-2 text-[14px] font-semibold text-fg">{fehlt ?? "Bitte Eingaben prüfen"}</div>
                <div className="mt-1 text-[12.5px] text-fg-3">Erst mit vollständigen Angaben rechnet Apex – ein altes Ergebnis bleibt nie stehen.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
