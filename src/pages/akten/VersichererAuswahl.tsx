// Feld „Versicherung“ als Suchauswahl (I4-T04-03) – wie „Bestehender Kontakt“: sichtbare Trefferliste, ↑/↓ wählt,
// Enter übernimmt, Escape schließt nur die Liste. Freitext bleibt möglich, dann mit dem Hinweis „Neuer Versicherer“.
// I5-T04-01: Jede Option nennt ihre Rollen je Akte („RSV in 116/26 · Gegnerin in 131/26“), bekannte Rechtsschutzversicherer
// stehen oben (Gruppen mit Überschrift). Ein nur als Gegner bekannter Versicherer bzw. der Gegner der eigenen Akte braucht
// eine Pflichtbestätigung (rote Warnung am Feld) – sonst ginge die Deckungsanfrage an die Gegenseite.
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AlertTriangle, Check, ShieldCheck, ShieldPlus } from "lucide-react";
import { search } from "@/core/search";
import { useCol } from "@/store/data";
import { Input } from "@/components/ui";
import { Highlight } from "@/components/Highlight";
import { cn } from "@/lib/cn";
import { VERSICHERER_GRUPPE, versichererKontakt, versichererOptionen, versichererWarnung, type EigenerGegner, type VersichererOption } from "./rsv";

export function VersichererAuswahl({
  id,
  value,
  onChange,
  fehler,
  describedBy,
  eigenerGegner,
  bestaetigt = false,
  onBestaetigt,
}: {
  id: string;
  value: string;
  onChange: (name: string) => void;
  fehler?: boolean;
  describedBy?: string;
  /** Gegner der eigenen Akte bzw. des neuen Mandats – Pflichtbestätigung, wenn er gewählt wird */
  eigenerGegner?: EigenerGegner;
  /** Pflichtbestätigung „Versicherer der Gegenseite trotzdem gewählt“ */
  bestaetigt?: boolean;
  onBestaetigt?: (v: boolean) => void;
}) {
  const kontakte = useCol("kontakte");
  const akten = useCol("akten");
  const optionen = useMemo(() => versichererOptionen(kontakte, akten), [kontakte, akten]);
  const warnung = useMemo(() => versichererWarnung(value, kontakte, akten, eigenerGegner), [value, kontakte, akten, eigenerGegner]);
  const [offen, setOffen] = useState(false);
  const [markiert, setMarkiert] = useState(-1);
  // Liste beim Verlassen des Felds erst nach dem Klick schließen: Sie steht im Fluss des Dialogs – schließt sie sofort beim
  // Mausdruck auf „Speichern“, schrumpft der Dialog, der Knopf rutscht unter der Maus weg und der Klick geht verloren.
  const schliessTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(schliessTimer.current), []);
  const basisId = useId().replace(/:/g, "");
  const listId = `${id}-liste-${basisId}`;
  const hinweisId = `${id}-hinweis`;
  const optId = (i: number) => `${id}-opt-${basisId}-${i}`;

  const treffer = useMemo(() => {
    const q = value.trim();
    if (!q) return optionen.slice(0, 8);
    const gefunden = search(optionen, q, [
      { get: (o) => o.name, weight: 3 },
      { get: (o) => o.kontakt?.ort, weight: 1 },
      { get: (o) => o.kontakt?.email, weight: 1 },
    ], 8).map((h) => h.item);
    // Teilwörter („Nordl“) auch ohne Wortanfang finden
    const rest = optionen.filter((o) => !gefunden.includes(o) && o.name.toLowerCase().includes(q.toLowerCase()));
    // Auch in den Treffern: bekannte Rechtsschutzversicherer zuerst (Gruppen), innerhalb der Gruppe nach Relevanz
    const liste = [...gefunden, ...rest].slice(0, 8);
    return [...liste.filter((o) => o.gruppe === "rsv"), ...liste.filter((o) => o.gruppe !== "rsv")];
  }, [optionen, value]);

  const exakt = versichererKontakt(kontakte, value);
  const exaktVorschlag = optionen.find((o) => o.name.toLowerCase() === value.trim().toLowerCase());
  const sichtbar = offen && treffer.length > 0 && !(treffer.length === 1 && treffer[0].name === value.trim());
  const aktiv = sichtbar && markiert >= 0 && markiert < treffer.length ? markiert : -1;

  const waehle = (o: VersichererOption) => {
    onChange(o.name);
    setOffen(false);
    setMarkiert(-1);
  };
  const markiere = (i: number) => {
    setMarkiert(i);
    document.getElementById(optId(i))?.scrollIntoView({ block: "nearest" });
  };
  const taste = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!sichtbar) {
        setOffen(true);
        setMarkiert(e.key === "ArrowDown" ? 0 : treffer.length - 1);
        return;
      }
      const start = aktiv;
      markiere(e.key === "ArrowDown" ? Math.min(treffer.length - 1, start + 1) : Math.max(0, start < 0 ? 0 : start - 1));
    } else if (e.key === "Enter") {
      if (e.repeat) {
        e.preventDefault();
        return;
      }
      const o = aktiv >= 0 ? treffer[aktiv] : sichtbar && value.trim() ? treffer[0] : undefined;
      if (!o) return;
      e.preventDefault();
      waehle(o);
    } else if (e.key === "Escape" && sichtbar) {
      // Escape schließt nur die Liste – nicht den Dialog
      e.preventDefault();
      e.stopPropagation();
      setOffen(false);
      setMarkiert(-1);
    }
  };

  const hinweis = !value.trim()
    ? "Name eintippen oder mit ↓ aus der Liste wählen – Enter übernimmt, Escape schließt die Liste."
    : exakt
      ? `Bestehender Kontakt „${exakt.name}“${exakt.ort ? ` (${exakt.ort})` : ""} wird verknüpft.`
      : exaktVorschlag
        ? `Bekannter Versicherer – wird als Kontakt „${exaktVorschlag.name}“ angelegt.`
        : sichtbar
          ? `${treffer.length} Treffer – mit ↑/↓ wählen, Enter übernimmt, Escape schließt die Liste.`
          : "Neuer Versicherer – wird als Kontakt angelegt. Bitte den vollständigen Namen prüfen.";
  const neuHinweis = !!value.trim() && !exakt && !exaktVorschlag && !sichtbar;

  return (
    <div>
      <Input
        id={id}
        role="combobox"
        aria-expanded={sichtbar}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={aktiv >= 0 ? optId(aktiv) : undefined}
        aria-describedby={[hinweisId, warnung ? `${id}-warnung` : "", describedBy].filter(Boolean).join(" ")}
        aria-invalid={fehler || undefined}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOffen(true);
          setMarkiert(-1);
        }}
        onFocus={() => {
          window.clearTimeout(schliessTimer.current);
          setOffen(true);
        }}
        onBlur={() => {
          window.clearTimeout(schliessTimer.current);
          schliessTimer.current = window.setTimeout(() => {
            setOffen(false);
            setMarkiert(-1);
          }, 200);
        }}
        onKeyDown={taste}
        placeholder="z. B. Nordlicht Rechtsschutz AG"
      />
      {sichtbar && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Versicherer"
          className="mt-1.5 max-h-56 overflow-y-auto rounded-lg bg-[var(--surface)] p-1 shadow-[inset_0_0_0_1px_var(--line)]"
        >
          {(["rsv", "weitere"] as const).map((g) => {
            const inGruppe = treffer.map((o, i) => ({ o, i })).filter((x) => x.o.gruppe === g);
            if (!inGruppe.length) return null;
            return (
              <li key={g} role="presentation">
                <div id={`${listId}-${g}`} aria-hidden className="eyebrow px-2.5 pb-1 pt-2">
                  {VERSICHERER_GRUPPE[g]}
                </div>
                <ul role="group" aria-labelledby={`${listId}-${g}`}>
                  {inGruppe.map(({ o, i }) => (
                    <li
                      key={o.name}
                      id={optId(i)}
                      role="option"
                      aria-selected={i === aktiv}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => waehle(o)}
                      title={o.rsvAkten.length > 2 || o.gegnerAkten.length > 2 ? [o.rsvAkten.length ? `RSV in ${o.rsvAkten.join(", ")}` : "", o.gegnerAkten.length ? `Gegnerin in ${o.gegnerAkten.join(", ")}` : ""].filter(Boolean).join(" · ") : undefined}
                      className={cn("flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px]", i === aktiv ? "bg-[var(--surface)] text-fg shadow-[inset_0_0_0_1.5px_var(--ink)]" : "hover:bg-[var(--surface)]")}
                    >
                      {o.kontakt ? <ShieldCheck className="size-4 shrink-0 text-ink" aria-hidden /> : <ShieldPlus className="size-4 shrink-0 text-fg-3" aria-hidden />}
                      <span className="min-w-0 flex-1">
                        <span className="block break-words font-medium">
                          <Highlight text={o.name} q={value} />
                        </span>
                        {/* Rollen je Akte – „Gegnerin“ hervorgehoben, damit eine Verwechslung auffällt */}
                        {o.rollen && (
                          <span className={cn("num block text-[12px]", o.gegnerAkten.length && !o.rsvAkten.length ? "font-medium text-seal" : "text-fg-2")}>{o.rollen}</span>
                        )}
                        <span className="block text-[12px] text-fg-3">{o.kontakt ? ["Kontakt", o.kontakt.ort, o.kontakt.email].filter(Boolean).join(" · ") : "Noch kein Kontakt – wird beim Speichern angelegt"}</span>
                      </span>
                      {o.name === value.trim() && <Check className="size-4 shrink-0 text-ink" aria-hidden />}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
      <p id={hinweisId} className={cn("mt-1.5 text-[12px]", neuHinweis ? "font-medium text-[var(--amber-text)]" : "text-fg-3")}>
        {hinweis}
      </p>
      {warnung && (
        <div role="alert" className="mt-2 grid gap-2 rounded-lg bg-seal-soft p-3 text-[13px] leading-relaxed text-seal">
          <div id={`${id}-warnung`} className="flex gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong className="font-semibold">Achtung – Versicherer der Gegenseite?</strong> {warnung}
            </span>
          </div>
          <label className="flex min-h-11 items-start gap-2 font-medium sm:min-h-0">
            <input id={`${id}-gegenseite-ok`} type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--seal)]" checked={bestaetigt} onChange={(e) => onBestaetigt?.(e.target.checked)} />
            <span>Ich habe geprüft: {value.trim()} ist hier die Rechtsschutzversicherung unseres Mandanten.</span>
          </label>
        </div>
      )}
    </div>
  );
}
