import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { CalendarPlus, Inbox, Timer, Undo2 } from "lucide-react";
import { useUI, toast, type AkteVorbelegung } from "@/store/ui";
import { useData } from "@/store/data";
import { useKanzlei, useSession } from "@/store/session";
import { istConsole } from "@/lib/backend";
import { addDays, fmtDate, fmtDateWd, fmtEUR, nowLocal, today, uid } from "@/core/dates";
import { istWerktag, naechsterArbeitstag } from "@/core/feiertage";
import type { Frist, Nachricht, Zeiteintrag } from "@/core/types";
import { satzFuerEintrag } from "@/pages/abrechnung/lib";
import { altKuerzel, einzeltasteErlaubt } from "@/lib/tastatur";
import { bereichErlaubt } from "@/app/nav";
import { Button, Field, Input, Modal, Select, Switch } from "@/components/ui";
import { cn } from "@/lib/cn";

export interface Kuerzel {
  tasten: string[];
  was: string;
  wo?: string;
  /** Alternative, die immer wirkt (auch bei abgeschalteten Einzeltasten-Kürzeln) */
  alt?: string[];
  /** Weitere Alternativen, die ebenfalls immer wirken (z. B. Pfeiltaste und Alt-Variante) */
  weitere?: string[][];
}

/** Alle Tastaturkürzel – angezeigt unter „?“ (Schnellhilfe → Tastaturkürzel) und bei den Strg+K-Aktionen. */
export const TASTATURKUERZEL: Kuerzel[] = [
  { tasten: ["Strg", "K"], was: "Globale Suche und Aktionen öffnen (Mac: ⌘ K) – auch Einstellungen, „Zeit erfassen“, „Sammelabrechnung“" },
  { tasten: ["W"], alt: ["Alt", "W"], was: "Wiedervorlage anlegen – in einer Akte für diese Akte", wo: "außerhalb von Eingabefeldern" },
  { tasten: ["F"], alt: ["Alt", "F"], was: "Fristenrechner öffnen – in einer Akte für diese Akte", wo: "außerhalb von Eingabefeldern" },
  { tasten: ["Z"], alt: ["Alt", "Z"], was: "Zeit erfassen – in einer Akte für diese Akte (Minuten tippen, Enter)", wo: "außerhalb von Eingabefeldern" },
  { tasten: ["?"], was: "Diese Übersicht der Tastaturkürzel", wo: "außerhalb von Eingabefeldern" },
  { tasten: ["Esc"], was: "Dialog, Seitenpanel, Suche oder Assistent schließen – immer nur die oberste Ebene" },
  { tasten: ["↑", "↓"], was: "In der Suche (Strg+K) Treffer wählen" },
  { tasten: ["Enter"], was: "Auswahl öffnen bzw. Dialog bestätigen" },
  { tasten: ["Tab"], was: "Zum nächsten Bedienelement springen (Umschalt+Tab zurück); der erste Stopp ist „Zum Inhalt springen“" },
];

/** Kürzel im Posteingang (Schnittstellenvertrag A-00, umgesetzt auf der Posteingang-Seite). */
export const POSTEINGANG_KUERZEL: Kuerzel[] = [
  { tasten: ["J"], was: "Nächste Nachricht" },
  { tasten: ["K"], was: "Vorige Nachricht" },
  { tasten: ["Enter"], was: "Nachricht öffnen" },
  { tasten: ["U"], was: "Vorschlag übernehmen", wo: "Mit Fristvorschlag: Fristen samt Akte übernehmen · ohne Fristvorschlag: Akte zuordnen · sonst nennt eine Meldung den Grund" },
  { tasten: ["E"], was: "eEB-Dialog öffnen" },
];

/** Kürzel in der Fristenliste (Schnittstellenvertrag A-00, umgesetzt auf der Fristen-Seite – I4-T03-05). */
export const FRISTEN_KUERZEL: Kuerzel[] = [
  { tasten: ["J"], alt: ["↓"], weitere: [["Alt", "J"]], was: "Nächste Frist", wo: "J außerhalb von Eingabefeldern, ↓ in der Liste, Alt+J auch in Eingabefeldern" },
  { tasten: ["K"], alt: ["↑"], weitere: [["Alt", "K"]], was: "Vorige Frist", wo: "K außerhalb von Eingabefeldern, ↑ in der Liste, Alt+K auch in Eingabefeldern" },
  { tasten: ["Enter"], was: "Details der gewählten Frist öffnen (J/K setzt den Fokus auf den Titel der Zeile); Esc bringt den Fokus zurück" },
  { tasten: ["B"], alt: ["Alt", "B"], was: "Vier-Augen-Kontrolle der gewählten Frist bestätigen", wo: "B außerhalb von Eingabefeldern, Alt+B auch in Eingabefeldern" },
];

/** Akte der aktuellen Route (/akten/:id). */
export function akteAusPfad(pfad: string): string | undefined {
  const m = pfad.match(/^\/akten\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : undefined;
}

/**
 * Akte aus dem Kontext der Seite (I3-T22-01): in einer Akte (/akten/:id) diese Akte; im Posteingang mit geöffneter Nachricht
 * (/posteingang?id=…) die Akte, der die Nachricht zugeordnet ist. Sonst keine – dann bleibt das Aktenfeld leer.
 */
export function akteAusKontext(loc: { pathname: string; search?: string }, daten: { nachrichten: Pick<Nachricht, "id" | "akteId">[] } = useData.getState().data): AkteVorbelegung {
  const ausPfad = akteAusPfad(loc.pathname);
  if (ausPfad) return { akteId: ausPfad, herkunft: "akte" };
  if (loc.pathname === "/posteingang" && loc.search) {
    const id = new URLSearchParams(loc.search).get("id");
    const n = id ? daten.nachrichten.find((x) => x.id === id) : undefined;
    if (n?.akteId) return { akteId: n.akteId, herkunft: "nachricht" };
  }
  return {};
}

/** Schnelle Zeiterfassung öffnen (Taste Z, Alt+Z, Strg+K „Zeit erfassen“) – mit der Akte der aktuellen Seite bzw. Nachricht. */
export function oeffneZeiterfassung(loc: { pathname: string; search?: string }) {
  useUI.getState().setZeiterfassung(akteAusKontext(loc));
}

/** Hinweis unter dem Aktenfeld, wenn die Akte aus der geöffneten Nachricht stammt. */
function NachrichtHinweis() {
  return (
    <span className="inline-flex items-center gap-1.5 text-fg-3">
      <Inbox className="size-3.5" aria-hidden /> Akte aus der geöffneten Nachricht
    </span>
  );
}

/**
 * Globale Kürzel W (Wiedervorlage), F (Fristenrechner), Z (Zeit erfassen) und ? (Kürzel-Übersicht) – nur über
 * `einzeltasteErlaubt` (abschaltbar, nie in Eingabefeldern oder Dialogen). Alt+W, Alt+F und Alt+Z wirken immer.
 */
export function useTastenkuerzel() {
  const nav = useNavigate();
  const loc = useLocation();
  // AppShell ruft den Hook auch ohne (bzw. vor der) Kanzlei-Sitzung auf – deshalb nicht useKanzlei()
  const rolle = useSession((s) => (s.sitzung && !istConsole(s.sitzung) ? s.sitzung.user.rolle : null));
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const alt = altKuerzel(e);
      const taste = alt ?? (einzeltasteErlaubt(e) ? e.key.toLowerCase() : null);
      if (!taste) return;
      const ui = useUI.getState();
      // Akte der Seite bzw. der im Posteingang geöffneten Nachricht – zum Zeitpunkt des Tastendrucks
      const kontext = akteAusKontext(loc);
      const akteId = kontext.akteId;
      if (!alt && e.key === "?") {
        e.preventDefault();
        ui.setKuerzel(true);
      } else if (taste === "w") {
        e.preventDefault();
        ui.setWiedervorlage(kontext);
      } else if (taste === "f") {
        e.preventDefault();
        nav(`/fristen?rechner=1${akteId ? `&akte=${encodeURIComponent(akteId)}` : ""}`);
      } else if (taste === "z" && rolle && bereichErlaubt("/abrechnung", rolle)) {
        e.preventDefault();
        ui.setZeiterfassung(kontext);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [nav, loc, rolle]);
}

/** Nächster Werktag ab einem Datum (Wochenende, Feiertage des Bundeslands). */
function naechsterWerktag(d: string, land: Parameters<typeof istWerktag>[1]): string {
  let x = d;
  for (let i = 0; i < 10 && !istWerktag(x, land); i++) x = addDays(x, 1);
  return x;
}

/** Offene Akten, neueste zuerst. */
function useOffeneAkten() {
  const akten = useData((s) => s.data.akten);
  return useMemo(() => akten.filter((a) => a.status !== "abgeschlossen").sort((a, b) => b.aktenzeichen.localeCompare(a.aktenzeichen, "de", { numeric: true })), [akten]);
}

/** Schnelle Wiedervorlage (Taste W): Akte, Datum, Titel – in drei Aktionen eingetragen, mit „Rückgängig“. */
export function WiedervorlageDialog() {
  const { wiedervorlage, setWiedervorlage } = useUI();
  const { user, tenant } = useKanzlei();
  const offen = useOffeneAkten();
  const [akteId, setAkteId] = useState("");
  const [datum, setDatum] = useState("");
  const [inTagen, setInTagen] = useState("");
  const [titel, setTitel] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const land = tenant.bundesland;
  // Ist die Akte vorbelegt, beginnt der Fokus direkt bei „Worum geht es?“ (nie im schon gefüllten Aktenfeld)
  const vorbelegt = !!wiedervorlage?.akteId && offen.some((a) => a.id === wiedervorlage.akteId);

  useEffect(() => {
    if (!wiedervorlage) return;
    setAkteId(wiedervorlage.akteId && offen.some((a) => a.id === wiedervorlage.akteId) ? wiedervorlage.akteId : "");
    setDatum(naechsterWerktag(addDays(today(), 7), land));
    setInTagen("");
    setTitel("");
    setFehler(null);
  }, [wiedervorlage, offen, land]);

  const kein = datum && !istWerktag(datum, land);
  const schliessen = () => setWiedervorlage(null);
  const heute = today();
  const schnell: { label: string; ziel: string }[] = [
    { label: "+1 Werktag", ziel: naechsterArbeitstag(heute, land) },
    { label: "+3 Tage", ziel: naechsterWerktag(addDays(heute, 3), land) },
    { label: "+7 Tage", ziel: naechsterWerktag(addDays(heute, 7), land) },
    { label: "+14 Tage", ziel: naechsterWerktag(addDays(heute, 14), land) },
  ];

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
      subtitle="Taste W bzw. Alt+W · Enter trägt ein, Esc bricht ab."
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
        <Field label="Akte" htmlFor="wv-akte" hint={vorbelegt && wiedervorlage?.herkunft === "nachricht" && akteId === wiedervorlage.akteId ? <NachrichtHinweis /> : undefined}>
          <Select id="wv-akte" value={akteId} onChange={(e) => setAkteId(e.target.value)} data-autofocus={vorbelegt ? undefined : true}>
            <option value="">Bitte wählen …</option>
            {offen.map((a) => (
              <option key={a.id} value={a.id}>
                {a.aktenzeichen} · {a.titel}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Worum geht es?" htmlFor="wv-titel" hint="Leer = „Wiedervorlage“. Enter trägt ein.">
          <Input id="wv-titel" value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z. B. Zeugen Seifert benennen" maxLength={160} data-autofocus={vorbelegt ? true : undefined} />
        </Field>
        <Field
          label="Datum"
          htmlFor="wv-datum"
          hint={
            kein ? (
              <span className="flex flex-wrap items-center gap-2 text-amber">
                {fmtDateWd(datum)} ist kein Werktag.
                <button type="button" className="font-semibold underline" onClick={() => setDatum(naechsterWerktag(datum, land))}>
                  Auf {fmtDateWd(naechsterWerktag(datum, land))} legen
                </button>
              </span>
            ) : datum ? (
              fmtDateWd(datum)
            ) : undefined
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <Input id="wv-datum" type="date" value={datum} min={today()} onChange={(e) => setDatum(e.target.value)} className="!w-auto min-w-0 flex-1" />
            <label htmlFor="wv-in-tagen" className="flex shrink-0 items-center gap-1.5 text-[13px] text-fg-2">
              in
              <Input
                id="wv-in-tagen"
                inputMode="numeric"
                value={inTagen}
                onChange={(e) => {
                  const roh = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
                  setInTagen(roh);
                  const n = Number(roh);
                  if (roh && n > 0) setDatum(naechsterWerktag(addDays(heute, n), land));
                }}
                placeholder="7"
                className="!h-9 !w-14 !px-2 text-center"
                aria-describedby="wv-in-tagen-hilfe"
              />
              Tagen
            </label>
          </div>
          <span id="wv-in-tagen-hilfe" className="sr-only">
            Anzahl Tage ab heute; fällt der Tag auf ein Wochenende oder einen Feiertag, gilt der nächste Werktag.
          </span>
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Schnellwahl Datum">
            {schnell.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  setDatum(s.ziel);
                  setInTagen("");
                }}
                aria-pressed={datum === s.ziel}
                title={fmtDateWd(s.ziel)}
                className={cn("h-7 rounded-md px-2.5 text-[13px] font-medium transition-colors duration-100 max-sm:h-9", datum === s.ziel ? "bg-[var(--surface-3)] text-fg shadow-[inset_0_0_0_1px_var(--ink)]" : "text-fg-2 shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-[var(--surface-2)]")}
              >
                {s.label}
              </button>
            ))}
          </div>
        </Field>
        {fehler && (
          <div role="alert" className="rounded-md bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal-text">
            {fehler}
          </div>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}

/** „90“, „1:30“, „1,5 h“, „1,5 Std.“ → Minuten (ganzzahlig); ungültig → null. */
export function minutenAus(eingabe: string): number | null {
  const t = eingabe.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return null;
  const hm = t.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const std = t.match(/^(\d+(?:[.,]\d+)?) ?(h|std\.?|stunden?)$/);
  if (std) return Math.round(Number(std[1].replace(",", ".")) * 60);
  const min = t.match(/^(\d+) ?(min\.?|minuten)?$/);
  if (min) return Number(min[1]);
  return null;
}

const dauerText = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")} Std.`;

/** Schnelle Zeiterfassung (Taste Z bzw. Alt+Z, Strg+K „Zeit erfassen“): Akte vorbelegt, Fokus auf „Minuten“, Enter erfasst. */
export function ZeiterfassungDialog() {
  const { zeiterfassung, setZeiterfassung } = useUI();
  const { user, team } = useKanzlei();
  const offen = useOffeneAkten();
  const nav = useNavigate();
  const [akteId, setAkteId] = useState("");
  const [minuten, setMinuten] = useState("");
  const [taetigkeit, setTaetigkeit] = useState("");
  const [abrechenbar, setAbrechenbar] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const vorbelegt = !!zeiterfassung?.akteId && offen.some((a) => a.id === zeiterfassung.akteId);

  useEffect(() => {
    if (!zeiterfassung) return;
    setAkteId(zeiterfassung.akteId && offen.some((a) => a.id === zeiterfassung.akteId) ? zeiterfassung.akteId : "");
    setMinuten("");
    setTaetigkeit("");
    setAbrechenbar(true);
    setFehler(null);
  }, [zeiterfassung, offen]);

  const schliessen = () => setZeiterfassung(null);
  const m = minutenAus(minuten);

  const erfassen = () => {
    setFehler(null);
    const akte = offen.find((a) => a.id === akteId);
    if (!akte) return setFehler("Bitte wählen Sie die Akte, für die Sie die Zeit erfassen.");
    if (!m || m <= 0) return setFehler("Bitte geben Sie die Dauer an – z. B. 90 (Minuten), 1:30 oder 1,5 h.");
    if (m > 24 * 60) return setFehler("Mehr als 24 Stunden an einem Tag? Bitte prüfen Sie die Dauer.");
    const t = taetigkeit.trim() || "Bearbeitung der Akte";
    const z: Zeiteintrag = { id: uid("z"), akteId: akte.id, userId: user.id, datum: today(), minuten: m, taetigkeit: t, abrechenbar };
    const st = useData.getState();
    st.upsert("zeiten", z);
    st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Zeit erfasst: ${dauerText(m)} – ${t}${abrechenbar ? "" : " (nicht abrechenbar)"} – ${akte.aktenzeichen}` });
    schliessen();
    toast("Zeit erfasst", {
      text: `${akte.aktenzeichen} · ${dauerText(m)} · ${t}`,
      ton: "erfolg",
      aktion: {
        label: "Rückgängig",
        onClick: () => {
          const s = useData.getState();
          const x = s.data.zeiten.find((y) => y.id === z.id);
          if (!x || x.abgerechnet) return;
          s.remove("zeiten", z.id);
          s.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Zeiteintrag ${dauerText(m)} („${t}“) wieder entfernt – ${akte.aktenzeichen}` });
          toast("Zeiteintrag entfernt", { text: `${akte.aktenzeichen} · ${dauerText(m)}`, ton: "info" });
        },
      },
    });
  };

  return (
    <Modal
      open={!!zeiterfassung}
      onClose={schliessen}
      size="sm"
      icon={<Timer className="size-5" />}
      title="Zeit erfassen"
      subtitle="Taste Z bzw. Alt+Z · Minuten tippen, Enter erfasst, Esc bricht ab."
      footer={
        <>
          <Button variant="ghost" onClick={schliessen}>
            Abbrechen
          </Button>
          <Button variant="primary" icon={<Timer className="size-4" />} onClick={erfassen}>
            Erfassen
          </Button>
        </>
      }
    >
      <form
        className="grid gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          erfassen();
        }}
      >
        <Field label="Akte" htmlFor="ze-akte">
          <Select id="ze-akte" value={akteId} onChange={(e) => setAkteId(e.target.value)} data-autofocus={vorbelegt ? undefined : true} aria-describedby={akteId ? "ze-satz" : undefined}>
            <option value="">Bitte wählen …</option>
            {offen.map((a) => (
              <option key={a.id} value={a.id}>
                {a.aktenzeichen} · {a.titel}
              </option>
            ))}
          </Select>
          {vorbelegt && zeiterfassung?.herkunft === "nachricht" && akteId === zeiterfassung.akteId && (
            <div className="mt-1.5 text-[12.5px]">
              <NachrichtHinweis />
            </div>
          )}
          {akteId && (
            <SatzZeile
              akte={offen.find((a) => a.id === akteId)}
              user={user}
              team={team}
              onVereinbarung={(id) => {
                schliessen();
                nav(`/abrechnung?tab=zeit&akte=${encodeURIComponent(id)}`);
              }}
            />
          )}
        </Field>
        <Field label="Minuten" htmlFor="ze-minuten" hint={m ? `= ${dauerText(m)} · heute, ${fmtDateWd(today())}` : "z. B. 90, 1:30 oder 1,5 h"}>
          <Input id="ze-minuten" inputMode="numeric" autoComplete="off" value={minuten} onChange={(e) => setMinuten(e.target.value)} placeholder="z. B. 90" data-autofocus={vorbelegt ? true : undefined} aria-describedby={fehler ? "ze-fehler" : undefined} />
        </Field>
        <Field label="Tätigkeit" htmlFor="ze-taetigkeit" hint="Leer = „Bearbeitung der Akte“.">
          <Input id="ze-taetigkeit" value={taetigkeit} onChange={(e) => setTaetigkeit(e.target.value)} placeholder="z. B. Schriftsatz Klageerwiderung" maxLength={200} />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="ze-abrechenbar" className="text-[13.5px] font-medium">
            Abrechenbar
          </label>
          <Switch id="ze-abrechenbar" checked={abrechenbar} onChange={setAbrechenbar} label="Abrechenbar" />
        </div>
        {fehler && (
          <div id="ze-fehler" role="alert" className="rounded-md bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal-text">
            {fehler}
          </div>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}

/**
 * Satz, zu dem die Zeit läuft (I3-T07-04) – dieselbe Regel wie Zeitliste und Rechnung (`satzFuerEintrag`):
 * „240 €/Std. lt. Vergütungsvereinbarung vom 01.10.2026“ bzw. „280 €/Std. – Satz von …, keine Vergütungsvereinbarung (§ 3a RVG)“.
 */
function SatzZeile({ akte, user, team, onVereinbarung }: {
  akte: Parameters<typeof satzFuerEintrag>[1] & { id: string } | undefined;
  user: { id: string; name: string; stundensatz?: number };
  team: { id: string; stundensatz?: number }[];
  onVereinbarung: (akteId: string) => void;
}) {
  if (!akte) return null;
  const users = new Map(team.map((u) => [u.id, u]));
  if (!users.has(user.id)) users.set(user.id, user);
  const { satz, quelle } = satzFuerEintrag({ userId: user.id }, akte, users);
  const v = akte.verguetungsvereinbarung;
  const betrag = `${fmtEUR(satz, { cents: !Number.isInteger(satz) })}/Std.`;
  return (
    <div id="ze-satz" className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[12.5px] leading-snug text-fg-3" aria-live="polite">
      {quelle === "vereinbarung" && v ? (
        <span>
          <span className="num font-semibold text-fg-2">{betrag}</span> lt. Vergütungsvereinbarung vom {fmtDate(v.datum)}
        </span>
      ) : (
        <>
          <span>
            <span className="num font-semibold text-fg-2">{betrag}</span> – Satz von {user.name},{" "}
            {v ? `Vergütungsvereinbarung vom ${fmtDate(v.datum)} ohne Stundensatz` : "keine Vergütungsvereinbarung (§ 3a RVG)"}
          </span>
          {!v && (
            <span className="whitespace-nowrap">
              <span aria-hidden>· </span>
              <Link
                to={`/abrechnung?tab=zeit&akte=${encodeURIComponent(akte.id)}`}
                onClick={(e) => {
                  e.preventDefault();
                  onVereinbarung(akte.id);
                }}
                className="font-semibold link"
              >
                Vereinbarung erfassen
              </Link>
            </span>
          )}
        </>
      )}
    </div>
  );
}

function Tasten({ tasten }: { tasten: string[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {tasten.map((t) => (
        <span key={t} className="kbd">
          {t}
        </span>
      ))}
    </span>
  );
}

/** Tabelle der Tastaturkürzel (Schnellhilfe → Reiter „Tastaturkürzel“). */
export function KuerzelListe() {
  const { einzeltastenKuerzel, setEinzeltastenKuerzel } = useUI();
  const { pathname } = useLocation();
  const aufFristen = pathname === "/fristen" || pathname.startsWith("/fristen/");
  const zeile = (k: Kuerzel) => (
    <li key={k.was} className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-[var(--surface-pop-hover)]">
      <span className="flex min-w-[96px] shrink-0 flex-col items-start gap-1">
        <Tasten tasten={k.tasten} />
        {k.alt && (
          <span className="flex items-center gap-1 text-[12px] text-fg-3">
            oder <Tasten tasten={k.alt} />
          </span>
        )}
        {k.weitere?.map((w) => (
          <span key={w.join("+")} className="flex items-center gap-1 text-[12px] text-fg-3">
            oder <Tasten tasten={w} />
          </span>
        ))}
      </span>
      <span className="min-w-0 text-[13.5px] leading-snug text-fg-2">
        {k.was}
        {k.wo && <span className="block text-[13px] text-fg-3">{k.wo}</span>}
      </span>
    </li>
  );
  const fristenAbschnitt = (
    <section aria-labelledby="kuerzel-fristen">
      <h3 id="kuerzel-fristen" className="mb-1 px-2 text-[13px] font-semibold text-fg">
        In der Fristenliste (diese Seite)
      </h3>
      <ul className="grid gap-1.5">{FRISTEN_KUERZEL.map(zeile)}</ul>
    </section>
  );
  return (
    <div className="grid gap-4">
      {aufFristen && fristenAbschnitt}
      <ul className="grid gap-1.5">{TASTATURKUERZEL.map(zeile)}</ul>
      <section aria-labelledby="kuerzel-posteingang">
        <h3 id="kuerzel-posteingang" className="mb-1 px-2 text-[13px] font-semibold text-fg">
          Im Posteingang
        </h3>
        <ul className="grid gap-1.5">{POSTEINGANG_KUERZEL.map(zeile)}</ul>
      </section>
      <div className="flex items-start justify-between gap-3 rounded-lg border border-[var(--line)] px-3 py-2.5">
        <label htmlFor="kuerzel-einzeltasten" className="min-w-0 text-[13px] leading-snug text-fg-2">
          <span className="block font-semibold text-fg">Kürzel mit einzelnen Buchstaben</span>
          {einzeltastenKuerzel ? "An – abschalten, wenn Sie oft neben ein Feld tippen. Alt+W, Alt+F und Alt+Z (in der Fristenliste auch Alt+J/K/B) wirken immer." : "Aus – W, F, Z, ? und die Buchstaben-Kürzel in Posteingang und Fristenliste ruhen. Alt+W, Alt+F, Alt+Z, in der Fristenliste Alt+J/K/B und die Pfeiltasten wirken weiter."} Auch unter Einstellungen → Darstellung.
        </label>
        <Switch id="kuerzel-einzeltasten" checked={einzeltastenKuerzel} onChange={setEinzeltastenKuerzel} label="Kürzel mit einzelnen Buchstaben" />
      </div>
      <p className="flex items-start gap-2 px-1 text-[13px] text-fg-3">
        <Undo2 className="mt-0.5 size-3.5 shrink-0 text-fg-4" /> Nach W bzw. Z und Enter bietet die Meldung unten rechts „Rückgängig“ an.
      </p>
    </div>
  );
}
