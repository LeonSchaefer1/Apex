// „Wie wurde die Frist gewahrt?“ – Erledigen von Notfristen und Fristen nur mit Nachweis oder Grund (Ausgangskontrolle),
// Streichen mit Pflichtgrund. Die Vier-Augen-Kontrolle ist keine harte Sperre, ihr Übergehen wird aber bestätigt und protokolliert.
// Versandzeit (tatsächlicher Versand) und Protokollzeit (Zeitpunkt des Eintrags) werden getrennt festgehalten.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, Banknote, CheckCircle2, Landmark, Send, Trash2 } from "lucide-react";
import { addDays, fmtDate, fmtEUR, fmtTime, nowLocal, today } from "@/core/dates";
import type { Frist, User } from "@/core/types";
import { useCol } from "@/store/data";
import { toast } from "@/store/ui";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { NACHWEIS_ART, TYP_META, brauchtKontrolle, erledigeFrist, istVersandArt, nachweisArtenFuer, oeffneFristWieder, streicheFrist, type Nachweis } from "./logik";

type Art = Nachweis["art"];
const zweistellig = (n: number) => String(n).padStart(2, "0");

/**
 * Dialog „Wie wurde die Frist gewahrt?“. `modus = "streichen"` zeigt nur den Pflichtgrund (auch für Wiedervorlagen).
 */
export function ErledigenDialog({ f, user, open, onClose, modus = "erledigen", onFertig }: { f: Frist; user: User; open: boolean; onClose: () => void; modus?: "erledigen" | "streichen"; onFertig?: () => void }) {
  const nachrichten = useCol("nachrichten");
  const transaktionen = useCol("transaktionen");
  const heute = today();
  const arten = useMemo(() => nachweisArtenFuer(f), [f]);
  // Ausgehende beA-Nachrichten der Akte der letzten Tage (Versandnachweis mit Zeitstempel)
  const beaNachrichten = useMemo(
    () => nachrichten.filter((n) => n.akteId === f.akteId && n.richtung === "aus" && n.kanal === "bea" && n.eingang.slice(0, 10) >= addDays(heute, -3)).sort((a, b) => b.eingang.localeCompare(a.eingang)),
    [nachrichten, f.akteId, heute],
  );
  // Gebuchte Umsätze des Bankabgleichs – zuerst die dieser Akte, Ausgänge vor Eingängen
  const umsaetze = useMemo(
    () =>
      transaktionen
        .filter((t) => t.status !== "offen")
        .sort((a, b) => Number(b.zuordnung?.akteId === f.akteId) - Number(a.zuordnung?.akteId === f.akteId) || Number(a.betrag >= 0) - Number(b.betrag >= 0) || b.datum.localeCompare(a.datum))
        .slice(0, 40),
    [transaktionen, f.akteId],
  );
  const startArt = (): Art => (modus === "streichen" ? "gestrichen" : arten[0]);
  const [art, setArt] = useState<Art>(startArt);
  const [nachrichtId, setNachrichtId] = useState("");
  const [transaktionId, setTransaktionId] = useState("");
  const [text, setText] = useState("");
  const [versandDatum, setVersandDatum] = useState(heute);
  const [versandZeit, setVersandZeit] = useState("");
  const [trotzdem, setTrotzdem] = useState(false);

  const uebernimmZeit = (iso?: string) => {
    if (!iso) return;
    setVersandDatum(iso.slice(0, 10));
    setVersandZeit(fmtTime(iso));
  };

  useEffect(() => {
    if (!open) return;
    setArt(startArt());
    const n = beaNachrichten[0];
    setNachrichtId(n?.id ?? "");
    setTransaktionId("");
    setText("");
    setVersandDatum(heute);
    setVersandZeit("");
    if (n && modus !== "streichen" && arten[0] === "bea") uebernimmZeit(n.eingang);
    setTrotzdem(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, modus, f.id]);

  const versand = istVersandArt(art);
  const mitNachricht = art === "bea" && !!nachrichtId;
  const versandAm = /^\d{4}-\d{2}-\d{2}$/.test(versandDatum) && /^\d{2}:\d{2}$/.test(versandZeit) ? `${versandDatum}T${versandZeit}:00` : "";
  const inZukunft = !!versandAm && versandAm > nowLocal();
  const kontrolleOffen = brauchtKontrolle(f) && art !== "gestrichen";
  const textPflicht = art === "gestrichen" || (art === "bea" && !nachrichtId);
  const fehlt =
    art === "gestrichen" && !text.trim()
      ? "Bitte den Grund angeben, z. B. „Berufung wird nicht eingelegt – Mandant hat verzichtet“."
      : versand && !versandAm
        ? "Bitte die Versandzeit angeben – Datum und Uhrzeit des tatsächlichen Versands (nicht die Zeit dieses Eintrags)."
        : versand && inZukunft
          ? "Die Versandzeit liegt in der Zukunft – bitte prüfen."
          : textPflicht && !text.trim()
            ? "Bitte den Versand kurz beschreiben (z. B. Nachrichten-ID bzw. Sendebericht)."
            : art === "ueberweisung" && !transaktionId
              ? "Bitte den Kontoumsatz der Überweisung wählen."
              : kontrolleOffen && !trotzdem
                ? "Die Vier-Augen-Kontrolle steht noch aus – bitte bestätigen."
                : undefined;

  const abschliessen = () => {
    if (fehlt) return;
    const t = transaktionen.find((x) => x.id === transaktionId);
    const n: Nachweis = {
      art,
      ...(text.trim() ? { text: text.trim() } : {}),
      ...(mitNachricht ? { nachrichtId } : {}),
      ...(versand && versandAm ? { versandAm } : {}),
      ...(art === "ueberweisung" && t ? { transaktionId: t.id, versandAm: t.datum } : {}),
      ...(kontrolleOffen && trotzdem ? { kontrolleOffenBestaetigt: true } : {}),
    };
    if (art === "gestrichen") streicheFrist(f, user.id, text, n.kontrolleOffenBestaetigt);
    else erledigeFrist(f, user.id, n);
    onClose();
    onFertig?.();
    toast(art === "gestrichen" ? `${TYP_META[f.typ].label} gestrichen` : `${TYP_META[f.typ].label} erledigt`, {
      text:
        art === "gestrichen"
          ? `${f.titel} – Grund protokolliert`
          : `${f.titel} · ${NACHWEIS_ART[art]}${versand && versandAm ? ` am ${fmtDate(versandDatum)} um ${versandZeit} Uhr` : t ? ` am ${fmtDate(t.datum)}` : ""}`,
      ton: "erfolg",
      aktion: { label: "Rückgängig", onClick: () => oeffneFristWieder(f, today(), user.id) },
    });
  };

  const streichen = modus === "streichen";
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={streichen ? `${TYP_META[f.typ].label} streichen` : "Wie wurde die Frist gewahrt?"}
      subtitle={`${f.titel} · ${fmtDate(f.datum)}`}
      icon={streichen ? <Trash2 className="size-[18px]" /> : <CheckCircle2 className="size-[18px]" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant={art === "gestrichen" ? "danger" : "primary"} disabled={!!fehlt} onClick={abschliessen}>
            {art === "gestrichen" ? "Streichen" : "Als erledigt protokollieren"}
          </Button>
        </>
      }
    >
      {!streichen && (
        <fieldset>
          <legend className="label">Nachweis</legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label="Art des Nachweises">
            {arten.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={art === a}
                onClick={() => {
                  setArt(a);
                  if (a === "bea" && nachrichtId) uebernimmZeit(beaNachrichten.find((n) => n.id === nachrichtId)?.eingang);
                }}
                className={cn(
                  "min-h-11 rounded-[14px] px-3 py-2 text-left text-[13px] font-medium ring-1 ring-inset transition-colors",
                  art === a ? (a === "gestrichen" ? "bg-seal-soft text-seal ring-transparent" : "bg-ink-soft text-ink ring-transparent") : "text-fg-2 ring-[var(--line)] hover:bg-ink-softer",
                )}
              >
                {a === "gestrichen" ? "gestrichen/gegenstandslos, weil …" : NACHWEIS_ART[a]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {art === "bea" && (
        <div className="mt-4 grid gap-3">
          {beaNachrichten.length ? (
            <Field label="Ausgehende beA-Nachricht" htmlFor="nachweis-bea" hint="Die Versandzeit wird aus dem Zeitstempel der Nachricht übernommen.">
              <Select
                id="nachweis-bea"
                value={nachrichtId}
                onChange={(e) => {
                  setNachrichtId(e.target.value);
                  uebernimmZeit(beaNachrichten.find((n) => n.id === e.target.value)?.eingang);
                }}
              >
                {beaNachrichten.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.eingang.slice(0, 10) === heute ? "heute" : fmtDate(n.eingang.slice(0, 10))}, {fmtTime(n.eingang)} Uhr · {n.betreff}
                  </option>
                ))}
                <option value="">Andere Sendung (Freitext)</option>
              </Select>
            </Field>
          ) : (
            <p className="flex items-start gap-2 rounded-[12px] bg-ink-softer px-3 py-2 text-[12.5px] text-fg-2">
              <Landmark className="mt-0.5 size-3.5 shrink-0" /> In dieser Akte gibt es keine ausgehende beA-Nachricht der letzten Tage. Bitte Versandzeit und Sendung angeben.
            </p>
          )}
          {!mitNachricht && (
            <Field label="Sendung (Pflicht)" htmlFor="nachweis-text">
              <Input id="nachweis-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="z. B. Berufungsschrift, Nachricht-ID …" />
            </Field>
          )}
        </div>
      )}
      {(art === "fax" || art === "bote" || art === "post" || art === "persoenlich") && (
        <Field label={art === "fax" ? "Sendebericht" : "Angaben zum Versand"} htmlFor="nachweis-text" className="mt-4" hint="Optional – z. B. Empfangsbestätigung, Sendebericht">
          <Input id="nachweis-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={art === "fax" ? "z. B. Sendebericht OK, 12 Seiten" : "z. B. Einwurf Nachtbriefkasten"} />
        </Field>
      )}
      {versand && (
        <fieldset className="mt-4">
          <legend className="label">Versandzeit (Pflicht)</legend>
          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-2">
            <Input id="nachweis-datum" type="date" aria-label="Versanddatum" required aria-required="true" max={heute} value={versandDatum} disabled={mitNachricht} onChange={(e) => setVersandDatum(e.target.value)} />
            <Input id="nachweis-zeit" type="time" aria-label="Versanduhrzeit" required aria-required="true" value={versandZeit} disabled={mitNachricht} onChange={(e) => setVersandZeit(e.target.value)} />
          </div>
          <p className="mt-1 text-[12.5px] text-fg-3">
            {mitNachricht ? "Aus dem Zeitstempel der beA-Nachricht." : "Wann ging die Sendung tatsächlich hinaus?"} Protokolliert wird zusätzlich der Zeitpunkt dieses Eintrags ({zweistellig(new Date().getHours())}:{zweistellig(new Date().getMinutes())} Uhr).
          </p>
        </fieldset>
      )}
      {art === "ueberweisung" && (
        <div className="mt-4 grid gap-3">
          {umsaetze.length ? (
            <Field label="Kontoumsatz der Überweisung (Pflicht)" htmlFor="nachweis-umsatz" hint="Gebuchte Umsätze aus dem Bankabgleich – zuerst die dieser Akte.">
              <Select id="nachweis-umsatz" value={transaktionId} onChange={(e) => setTransaktionId(e.target.value)}>
                <option value="">Umsatz wählen …</option>
                {umsaetze.map((t) => (
                  <option key={t.id} value={t.id}>
                    {fmtDate(t.datum)} · {fmtEUR(t.betrag)} · {t.gegenpartei} · {t.verwendungszweck}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <p className="flex items-start gap-2 rounded-[12px] bg-ink-softer px-3 py-2 text-[12.5px] text-fg-2">
              <Banknote className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Noch kein gebuchter Umsatz vorhanden – die Überweisung erscheint nach dem Abgleich im{" "}
                <Link to="/abrechnung?tab=bank" className="font-medium text-ink underline" onClick={onClose}>
                  Bankabgleich
                </Link>
                .
              </span>
            </p>
          )}
          <Field label="Vermerk (optional)" htmlFor="nachweis-text">
            <Input id="nachweis-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="z. B. Auszahlung an Mandantin, Verwendungszweck" />
          </Field>
        </div>
      )}
      {art === "gestrichen" && (
        <Field label="Grund (Pflicht)" htmlFor="nachweis-grund" className="mt-4">
          <Textarea id="nachweis-grund" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="gestrichen/gegenstandslos, weil …" />
        </Field>
      )}

      {kontrolleOffen && (
        <div className="mt-4 rounded-[14px] bg-amber-soft px-3.5 py-3 text-[12.5px] leading-relaxed text-fg-2">
          <div className="flex items-center gap-1.5 font-semibold text-amber">
            <AlertTriangle className="size-4" /> Vier-Augen-Kontrolle steht noch aus
          </div>
          <label className="mt-2 flex items-start gap-2 text-fg">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--amber)]" checked={trotzdem} onChange={(e) => setTrotzdem(e.target.checked)} />
            <span>Kontrolle steht noch aus – trotzdem erledigen</span>
          </label>
        </div>
      )}
      {fehlt && (
        <p className="mt-3 flex items-start gap-1.5 text-[12.5px] text-fg-3" role="status">
          <Send className="mt-0.5 size-3.5 shrink-0" /> {fehlt}
        </p>
      )}
      <p className="mt-3 text-[12.5px] text-fg-3">Nachweis bzw. Grund, Versandzeit, Person und Zeitpunkt des Eintrags stehen im Verlauf der Akte und in der Ausgangskontrolle.</p>
    </Modal>
  );
}
