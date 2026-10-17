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
import { NACHWEIS_ART, TYP_META, brauchtKontrolle, erledigeFrist, fremdHinweis, istVersandArt, nachweisArtenFuer, nachweisUmsaetze, oeffneFristWieder, streicheFrist, type Nachweis } from "./logik";

type Art = Nachweis["art"];
const zweistellig = (n: number) => String(n).padStart(2, "0");

/**
 * Dialog „Wie wurde die Frist gewahrt?“. `modus = "streichen"` zeigt nur den Pflichtgrund (auch für Wiedervorlagen).
 */
export function ErledigenDialog({ f, user, open, onClose, modus = "erledigen", onFertig }: { f: Frist; user: User; open: boolean; onClose: () => void; modus?: "erledigen" | "streichen"; onFertig?: () => void }) {
  const nachrichten = useCol("nachrichten");
  const transaktionen = useCol("transaktionen");
  const buchungen = useCol("buchungen");
  const akten = useCol("akten");
  const heute = today();
  const arten = useMemo(() => nachweisArtenFuer(f), [f]);
  // Ausgehende beA-Nachrichten der Akte der letzten Tage (Versandnachweis mit Zeitstempel)
  const beaNachrichten = useMemo(
    () => nachrichten.filter((n) => n.akteId === f.akteId && n.richtung === "aus" && n.kanal === "bea" && n.eingang.slice(0, 10) >= addDays(heute, -3)).sort((a, b) => b.eingang.localeCompare(a.eingang)),
    [nachrichten, f.akteId, heute],
  );
  // Überweisungsnachweis (I3-T15-01): nur Ausgänge – zuerst Fremdgeld-Weiterleitungen und Ausgänge dieser Akte; Gutschriften nie
  const quellen = useMemo(() => nachweisUmsaetze(f, transaktionen, buchungen, akten), [f, transaktionen, buchungen, akten]);
  const aktenzeichen = akten.find((a) => a.id === f.akteId)?.aktenzeichen;
  const startArt = (): Art => (modus === "streichen" ? "gestrichen" : arten[0]);
  const [art, setArt] = useState<Art>(startArt);
  const [nachrichtId, setNachrichtId] = useState("");
  const [quelleId, setQuelleId] = useState("");
  const [andererUmsatz, setAndererUmsatz] = useState(false);
  const [begruendung, setBegruendung] = useState("");
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
    setQuelleId(quellen.passend[0]?.id ?? "");
    setAndererUmsatz(false);
    setBegruendung("");
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
  const quelle = (andererUmsatz ? quellen.fremd : quellen.passend).find((q) => q.id === quelleId);
  const quelleFremd = !!quelle && quelle.akteId !== f.akteId;
  const betragAbweichend = !!quelle && quellen.erwartet !== undefined && Math.abs(-quelle.betrag - quellen.erwartet) > 0.005;
  const keinAusgang = art === "ueberweisung" && !quellen.passend.length && !andererUmsatz;
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
            : keinAusgang
              ? "Noch keine Überweisung gebucht – die Frist bleibt offen."
              : art === "ueberweisung" && !quelle
                ? "Bitte den Nachweis der Überweisung wählen (Weiterleitung oder Kontoumsatz)."
                : art === "ueberweisung" && quelleFremd && !begruendung.trim()
                  ? "Der Umsatz gehört nicht zu dieser Akte – bitte begründen, warum er die Zahlung nachweist."
                  : kontrolleOffen && !trotzdem
                ? "Die Vier-Augen-Kontrolle steht noch aus – bitte bestätigen."
                : undefined;

  const abschliessen = () => {
    if (fehlt) return;
    const q = art === "ueberweisung" ? quelle : undefined;
    const t = q?.transaktionId ? transaktionen.find((x) => x.id === q.transaktionId) : undefined;
    // Nachweistext: Weiterleitung beim Namen, abweichender Umsatz mit Begründung (steht im Nachweis und im Protokoll)
    const nachweisText = [
      q?.art === "weiterleitung" ? q.label : "",
      q && quelleFremd ? `${fremdHinweis(q, aktenzeichen)} – Begründung: ${begruendung.trim()}` : "",
      text.trim(),
    ]
      .filter(Boolean)
      .join(" · ");
    const n: Nachweis = {
      art,
      ...(art === "ueberweisung" ? (nachweisText ? { text: nachweisText } : {}) : text.trim() ? { text: text.trim() } : {}),
      ...(mitNachricht ? { nachrichtId } : {}),
      ...(versand && versandAm ? { versandAm } : {}),
      ...(art === "ueberweisung" && t ? { transaktionId: t.id, versandAm: t.datum } : {}),
      ...(art === "ueberweisung" && q?.art === "weiterleitung" ? { versandAm: q.datum } : {}),
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
          : `${f.titel} · ${NACHWEIS_ART[art]}${versand && versandAm ? ` am ${fmtDate(versandDatum)} um ${versandZeit} Uhr` : q ? ` am ${fmtDate(q.datum)}` : ""}`,
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
          {quellen.passend.length > 0 && !andererUmsatz && (
            <Field label="Nachweis der Überweisung (Pflicht)" htmlFor="nachweis-umsatz" hint="Nur Ausgänge dieser Akte: Fremdgeld-Weiterleitungen aus dem Aktenkonto und gebuchte Umsätze aus dem Bankabgleich. Gutschriften sind kein Nachweis.">
              <Select id="nachweis-umsatz" value={quelleId} onChange={(e) => setQuelleId(e.target.value)}>
                <option value="">Nachweis wählen …</option>
                {quellen.passend.some((q) => q.art === "weiterleitung") && (
                  <optgroup label="Fremdgeld-Weiterleitungen dieser Akte">
                    {quellen.passend
                      .filter((q) => q.art === "weiterleitung")
                      .map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.label}
                        </option>
                      ))}
                  </optgroup>
                )}
                {quellen.passend.some((q) => q.art === "umsatz") && (
                  <optgroup label="Ausgänge dieser Akte (Bankabgleich)">
                    {quellen.passend
                      .filter((q) => q.art === "umsatz")
                      .map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.label}
                        </option>
                      ))}
                  </optgroup>
                )}
              </Select>
            </Field>
          )}
          {keinAusgang && (
            <div className="flex items-start gap-2 rounded-[12px] bg-ink-softer px-3 py-2.5 text-[13px] text-fg-2" role="status">
              <Banknote className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-semibold text-fg">Noch keine Überweisung gebucht – die Frist bleibt offen.</span> Erst eine Weiterleitung oder ein Ausgang dieser Akte weist die Zahlung nach.{" "}
                <Link to="/abrechnung?fokus=fremdgeld" className="inline-flex min-h-6 items-center font-medium text-ink underline" onClick={onClose}>
                  Fremdgeld auszahlen
                </Link>
              </span>
            </div>
          )}
          {andererUmsatz ? (
            <>
              <Field label="Anderer Kontoumsatz (Ausgang)" htmlFor="nachweis-umsatz-fremd" hint="Ausgänge anderer Akten oder ohne Akte – nur mit Begründung.">
                <Select id="nachweis-umsatz-fremd" value={quelleId} onChange={(e) => setQuelleId(e.target.value)}>
                  <option value="">Umsatz wählen …</option>
                  {quellen.fremd.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.aktenzeichen ? `${q.aktenzeichen} · ` : "ohne Akte · "}
                      {q.label}
                    </option>
                  ))}
                </Select>
              </Field>
              {quelle && quelleFremd && (
                <div className="rounded-[14px] bg-seal-soft px-3.5 py-3 text-[12.5px] leading-relaxed text-fg-2" role="alert">
                  <div className="flex items-center gap-1.5 font-semibold text-seal">
                    <AlertTriangle className="size-4 shrink-0" /> {fremdHinweis(quelle, aktenzeichen)}
                  </div>
                  <Field label="Begründung (Pflicht – steht im Nachweis und im Protokoll)" htmlFor="nachweis-begruendung" className="mt-2">
                    <Textarea id="nachweis-begruendung" rows={2} value={begruendung} onChange={(e) => setBegruendung(e.target.value)} placeholder="z. B. Sammelüberweisung für beide Akten" />
                  </Field>
                </div>
              )}
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAndererUmsatz(false);
                    setQuelleId(quellen.passend[0]?.id ?? "");
                    setBegruendung("");
                  }}
                >
                  Zurück zu den Ausgängen dieser Akte
                </Button>
              </div>
            </>
          ) : (
            quellen.fremd.length > 0 && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAndererUmsatz(true);
                    setQuelleId("");
                  }}
                >
                  Anderen Umsatz wählen …
                </Button>
              </div>
            )
          )}
          {quelle && betragAbweichend && quellen.erwartet !== undefined && (
            <p className="flex items-start gap-2 rounded-[12px] bg-amber-soft px-3 py-2 text-[12.5px] text-fg-2" role="status">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber" />
              <span>
                Betrag weicht ab: Nachweis {fmtEUR(-quelle.betrag)}, {/fremdgeld/i.test(f.titel) ? "Fremdgeld" : "Fristbetrag"} {fmtEUR(quellen.erwartet)} – bitte prüfen (Teilzahlung?).
              </span>
            </p>
          )}
          {(quellen.passend.length > 0 || andererUmsatz) && (
            <Field label="Vermerk (optional)" htmlFor="nachweis-text">
              <Input id="nachweis-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="z. B. Auszahlung an Mandantin, Verwendungszweck" />
            </Field>
          )}
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
