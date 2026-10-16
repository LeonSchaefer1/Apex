// „Wie wurde die Frist gewahrt?“ – Erledigen von Notfristen und Fristen nur mit Nachweis oder Grund (Ausgangskontrolle),
// Streichen mit Pflichtgrund. Die Vier-Augen-Kontrolle ist keine harte Sperre, ihr Übergehen wird aber bestätigt und protokolliert.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Landmark, Send, Trash2 } from "lucide-react";
import { fmtDate, fmtTime, today } from "@/core/dates";
import type { Frist, User } from "@/core/types";
import { useCol } from "@/store/data";
import { toast } from "@/store/ui";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { NACHWEIS_ART, TYP_META, brauchtKontrolle, erledigeFrist, oeffneFristWieder, streicheFrist, type Nachweis } from "./logik";

type Art = Nachweis["art"];
const WAHL: Art[] = ["bea", "fax", "bote", "post", "persoenlich", "gestrichen"];

/**
 * Dialog „Wie wurde die Frist gewahrt?“. `modus = "streichen"` zeigt nur den Pflichtgrund (auch für Wiedervorlagen).
 */
export function ErledigenDialog({ f, user, open, onClose, modus = "erledigen", onFertig }: { f: Frist; user: User; open: boolean; onClose: () => void; modus?: "erledigen" | "streichen"; onFertig?: () => void }) {
  const nachrichten = useCol("nachrichten");
  const heute = today();
  // Ausgehende beA-Nachrichten der Akte von heute (Versandnachweis)
  const beaHeute = useMemo(
    () => nachrichten.filter((n) => n.akteId === f.akteId && n.richtung === "aus" && n.kanal === "bea" && n.eingang.slice(0, 10) === heute).sort((a, b) => b.eingang.localeCompare(a.eingang)),
    [nachrichten, f.akteId, heute],
  );
  const [art, setArt] = useState<Art>(modus === "streichen" ? "gestrichen" : "bea");
  const [nachrichtId, setNachrichtId] = useState("");
  const [text, setText] = useState("");
  const [trotzdem, setTrotzdem] = useState(false);
  useEffect(() => {
    if (!open) return;
    setArt(modus === "streichen" ? "gestrichen" : "bea");
    setNachrichtId(beaHeute[0]?.id ?? "");
    setText("");
    setTrotzdem(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, modus, f.id]);

  const kontrolleOffen = brauchtKontrolle(f) && art !== "gestrichen";
  const textPflicht = art === "gestrichen" || (art === "bea" && !nachrichtId);
  const fehlt = textPflicht && !text.trim()
    ? art === "gestrichen"
      ? "Bitte den Grund angeben, z. B. „Berufung wird nicht eingelegt – Mandant hat verzichtet“."
      : "Keine ausgehende beA-Nachricht von heute in dieser Akte – bitte den Versand kurz beschreiben (z. B. Uhrzeit und Nachrichten-ID)."
    : kontrolleOffen && !trotzdem
      ? "Die Vier-Augen-Kontrolle steht noch aus – bitte bestätigen."
      : undefined;

  const abschliessen = () => {
    if (fehlt) return;
    const n: Nachweis = {
      art,
      ...(text.trim() ? { text: text.trim() } : {}),
      ...(art === "bea" && nachrichtId ? { nachrichtId } : {}),
      ...(kontrolleOffen && trotzdem ? { kontrolleOffenBestaetigt: true } : {}),
    };
    if (art === "gestrichen") streicheFrist(f, user.id, text, n.kontrolleOffenBestaetigt);
    else erledigeFrist(f, user.id, n);
    onClose();
    onFertig?.();
    toast(art === "gestrichen" ? `${TYP_META[f.typ].label} gestrichen` : `${TYP_META[f.typ].label} erledigt`, {
      text: art === "gestrichen" ? `${f.titel} – Grund protokolliert` : `${f.titel} · Nachweis: ${NACHWEIS_ART[art]}`,
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
            {WAHL.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={art === a}
                onClick={() => setArt(a)}
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
          {beaHeute.length ? (
            <Field label="Ausgehende beA-Nachricht von heute" htmlFor="nachweis-bea">
              <Select id="nachweis-bea" value={nachrichtId} onChange={(e) => setNachrichtId(e.target.value)}>
                {beaHeute.map((n) => (
                  <option key={n.id} value={n.id}>
                    {fmtTime(n.eingang)} Uhr · {n.betreff}
                  </option>
                ))}
                <option value="">Andere Sendung (Freitext)</option>
              </Select>
            </Field>
          ) : (
            <p className="flex items-start gap-2 rounded-[12px] bg-ink-softer px-3 py-2 text-[12.5px] text-fg-2">
              <Landmark className="mt-0.5 size-3.5 shrink-0" /> In dieser Akte gibt es heute keine ausgehende beA-Nachricht. Bitte den Versand beschreiben.
            </p>
          )}
          {(!nachrichtId || !beaHeute.length) && (
            <Field label="Versand (Pflicht)" htmlFor="nachweis-text">
              <Input id="nachweis-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="z. B. Berufungsschrift per beA um 16:42 Uhr, Nachricht-ID …" />
            </Field>
          )}
        </div>
      )}
      {(art === "fax" || art === "bote" || art === "post" || art === "persoenlich") && (
        <Field label={art === "fax" ? "Sendebericht" : "Angaben zum Versand"} htmlFor="nachweis-text" className="mt-4" hint="Optional – z. B. Uhrzeit, Empfangsbestätigung, Sendebericht">
          <Input id="nachweis-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={art === "fax" ? "z. B. Sendebericht OK, 16:42 Uhr, 12 Seiten" : "z. B. Einwurf Nachtbriefkasten 18:10 Uhr"} />
        </Field>
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
      <p className="mt-3 text-[12.5px] text-fg-3">Nachweis bzw. Grund, Person und Zeitpunkt stehen im Verlauf der Akte und in der Ausgangskontrolle.</p>
    </Modal>
  );
}
