import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { CalendarPlus, Undo2 } from "lucide-react";
import { useUI, toast } from "@/store/ui";
import { useData } from "@/store/data";
import { useKanzlei, useSession } from "@/store/session";
import { addDays, fmtDateWd, nowLocal, today, uid } from "@/core/dates";
import { istWerktag } from "@/core/feiertage";
import type { Frist } from "@/core/types";
import { Button, Field, Input, Modal, Select } from "@/components/ui";

/** Alle Tastaturkürzel – angezeigt unter „?“ (Schnellhilfe → Tastaturkürzel) und bei den Strg+K-Aktionen. */
export const TASTATURKUERZEL: { tasten: string[]; was: string; wo?: string }[] = [
  { tasten: ["Strg", "K"], was: "Globale Suche und Aktionen öffnen (Mac: ⌘ K)" },
  { tasten: ["W"], was: "Wiedervorlage anlegen – in einer Akte für diese Akte", wo: "überall außerhalb von Eingabefeldern" },
  { tasten: ["F"], was: "Fristenrechner öffnen – in einer Akte für diese Akte", wo: "überall außerhalb von Eingabefeldern" },
  { tasten: ["?"], was: "Diese Übersicht der Tastaturkürzel", wo: "überall außerhalb von Eingabefeldern" },
  { tasten: ["Esc"], was: "Dialog, Seitenpanel, Suche oder Assistent schließen" },
  { tasten: ["↑", "↓"], was: "In der Suche (Strg+K) Treffer wählen" },
  { tasten: ["Enter"], was: "Auswahl öffnen bzw. Dialog bestätigen" },
  { tasten: ["Tab"], was: "Zum nächsten Bedienelement springen (Umschalt+Tab zurück)" },
];

/** Akte der aktuellen Route (/akten/:id). */
export function akteAusPfad(pfad: string): string | undefined {
  const m = pfad.match(/^\/akten\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : undefined;
}

function istEingabe(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!el.closest("[role='combobox'], [cmdk-input]");
}

/** Globale Kürzel W (Wiedervorlage), F (Fristenrechner) und ? (Kürzel-Übersicht) – nur außerhalb von Eingabefeldern und Dialogen. */
export function useTastenkuerzel() {
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      if (istEingabe(e.target)) return;
      const ui = useUI.getState();
      if (useSession.getState().gesperrt || ui.paletteOffen || ui.assistentOffen || ui.wiedervorlage || document.querySelector('[aria-modal="true"], [role="menu"]')) return;
      const akteId = akteAusPfad(loc.pathname);
      if (e.key === "?") {
        e.preventDefault();
        ui.setKuerzel(true);
      } else if (e.key === "w" || e.key === "W") {
        e.preventDefault();
        ui.setWiedervorlage({ akteId });
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        nav(`/fristen?rechner=1${akteId ? `&akte=${encodeURIComponent(akteId)}` : ""}`);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [nav, loc.pathname]);
}

/** Nächster Werktag ab einem Datum (Wochenende, Feiertage des Bundeslands). */
function naechsterWerktag(d: string, land: Parameters<typeof istWerktag>[1]): string {
  let x = d;
  for (let i = 0; i < 10 && !istWerktag(x, land); i++) x = addDays(x, 1);
  return x;
}

/** Schnelle Wiedervorlage (Taste W): Akte, Datum, Titel – in drei Aktionen eingetragen, mit „Rückgängig“. */
export function WiedervorlageDialog() {
  const { wiedervorlage, setWiedervorlage } = useUI();
  const { user, tenant } = useKanzlei();
  const akten = useData((s) => s.data.akten);
  const offen = useMemo(() => akten.filter((a) => a.status !== "abgeschlossen").sort((a, b) => b.aktenzeichen.localeCompare(a.aktenzeichen, "de", { numeric: true })), [akten]);
  const [akteId, setAkteId] = useState("");
  const [datum, setDatum] = useState("");
  const [titel, setTitel] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!wiedervorlage) return;
    setAkteId(wiedervorlage.akteId && offen.some((a) => a.id === wiedervorlage.akteId) ? wiedervorlage.akteId : "");
    setDatum(naechsterWerktag(addDays(today(), 7), tenant.bundesland));
    setTitel("");
    setFehler(null);
  }, [wiedervorlage, offen, tenant.bundesland]);

  const kein = datum && !istWerktag(datum, tenant.bundesland);
  const schliessen = () => setWiedervorlage(null);

  const eintragen = () => {
    setFehler(null);
    const akte = offen.find((a) => a.id === akteId);
    if (!akte) return setFehler("Bitte wählen Sie die Akte, zu der die Wiedervorlage gehört.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return setFehler("Bitte geben Sie ein Datum an, z. B. in einer Woche.");
    if (datum < today()) return setFehler("Das Datum liegt in der Vergangenheit. Bitte wählen Sie heute oder einen späteren Tag.");
    const t = titel.trim() || "Wiedervorlage";
    const f: Frist = { id: uid("f"), akteId: akte.id, titel: t, typ: "wiedervorlage", datum, status: "offen", verantwortlichId: user.id, quelle: "manuell", createdAt: nowLocal() };
    const st = useData.getState();
    st.upsert("fristen", f);
    st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Wiedervorlage „${t}“ für ${fmtDateWd(datum)} angelegt – ${akte.aktenzeichen}` });
    schliessen();
    toast("Wiedervorlage eingetragen", {
      text: `${akte.aktenzeichen} · ${t} · ${fmtDateWd(datum)}`,
      ton: "erfolg",
      aktion: {
        label: "Rückgängig",
        onClick: () => {
          const s = useData.getState();
          if (!s.data.fristen.some((x) => x.id === f.id)) return;
          s.remove("fristen", f.id);
          s.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Wiedervorlage „${t}“ (${fmtDateWd(datum)}) wieder entfernt – ${akte.aktenzeichen}` });
          toast("Wiedervorlage entfernt", { text: `${akte.aktenzeichen} · ${t}`, ton: "info" });
        },
      },
    });
  };

  return (
    <Modal
      open={!!wiedervorlage}
      onClose={schliessen}
      size="sm"
      icon={<CalendarPlus className="size-5" />}
      title="Wiedervorlage anlegen"
      subtitle="Taste W · Enter trägt ein, Esc bricht ab."
      footer={
        <>
          <Button variant="ghost" onClick={schliessen}>
            Abbrechen
          </Button>
          <Button variant="primary" icon={<CalendarPlus className="size-4" />} onClick={eintragen}>
            Eintragen
          </Button>
        </>
      }
    >
      <form
        className="grid gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          eintragen();
        }}
      >
        <Field label="Akte" htmlFor="wv-akte">
          <Select id="wv-akte" value={akteId} onChange={(e) => setAkteId(e.target.value)} autoFocus={!akteId}>
            <option value="">Bitte wählen …</option>
            {offen.map((a) => (
              <option key={a.id} value={a.id}>
                {a.aktenzeichen} · {a.titel}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Datum"
          htmlFor="wv-datum"
          hint={
            kein ? (
              <span className="flex flex-wrap items-center gap-2 text-amber">
                {fmtDateWd(datum)} ist kein Werktag.
                <button type="button" className="font-semibold underline" onClick={() => setDatum(naechsterWerktag(datum, tenant.bundesland))}>
                  Auf {fmtDateWd(naechsterWerktag(datum, tenant.bundesland))} legen
                </button>
              </span>
            ) : datum ? (
              fmtDateWd(datum)
            ) : undefined
          }
        >
          <Input id="wv-datum" type="date" value={datum} min={today()} onChange={(e) => setDatum(e.target.value)} autoFocus={!!akteId} />
        </Field>
        <Field label="Worum geht es?" htmlFor="wv-titel" hint="Leer = „Wiedervorlage“.">
          <Input id="wv-titel" value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z. B. Zeugen Pohl benennen" maxLength={160} />
        </Field>
        {fehler && (
          <div role="alert" className="rounded-[12px] bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal">
            {fehler}
          </div>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}

/** Tabelle der Tastaturkürzel (Schnellhilfe → Reiter „Tastaturkürzel“). */
export function KuerzelListe() {
  return (
    <ul className="grid gap-1.5">
      {TASTATURKUERZEL.map((k) => (
        <li key={k.was} className="flex items-start gap-3 rounded-[14px] px-2 py-2 hover:bg-ink-softer">
          <span className="flex min-w-[88px] shrink-0 items-center gap-1">
            {k.tasten.map((t) => (
              <span key={t} className="kbd">
                {t}
              </span>
            ))}
          </span>
          <span className="min-w-0 text-[13.5px] leading-snug text-fg-2">
            {k.was}
            {k.wo && <span className="block text-[13px] text-fg-3">{k.wo}</span>}
          </span>
        </li>
      ))}
      <li className="mt-1 flex items-start gap-2 rounded-[14px] bg-[var(--ink-softer)] px-3 py-2.5 text-[13px] text-fg-2">
        <Undo2 className="mt-0.5 size-3.5 shrink-0 text-ink" /> Nach W und Enter bietet die Meldung unten rechts „Rückgängig“ an.
      </li>
    </ul>
  );
}
