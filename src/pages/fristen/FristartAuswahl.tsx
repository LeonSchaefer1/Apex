// Fristart wählen: Suchfeld als Kombifeld mit Trefferliste (Listbox, aria-activedescendant) – ein Tab-Stopp,
// ↑/↓ markieren, Enter übernimmt den markierten bzw. ersten Treffer und springt ins nächste Feld (I2-T18-02).
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { ShieldAlert } from "lucide-react";
import { SearchField } from "@/components/ui";
import { FRIST_REGELN, fristArt, type FristRegel } from "@/core/fristen";
import { cn } from "@/lib/cn";
import { sucheFristarten } from "./fristartSuche";

const GEBIETE_REIHENFOLGE: FristRegel["gebiet"][] = ["Zivilprozess", "Arbeitsrecht", "Familienrecht", "Mahnverfahren", "Strafrecht", "Verwaltungsrecht", "Materielles Recht", "Vertraglich vereinbart"];

function einheitText(r: FristRegel) {
  if (r.festesDatum === "pflicht") return "festes Datum";
  if (r.dauerPflicht) return "Dauer laut Vorgabe";
  const n = r.dauer;
  const e = r.einheit === "tage" ? (n === 1 ? "Tag" : "Tage") : r.einheit === "wochen" ? (n === 1 ? "Woche" : "Wochen") : r.einheit === "monate" ? (n === 1 ? "Monat" : "Monate") : "Jahre (ab Jahresende)";
  return `${n} ${e}`;
}

/** Treffer nach Gebiet gruppiert; Gebiete nach ihrem besten Treffer, innerhalb in Trefferreihenfolge. */
export function gruppiereFristarten(treffer: FristRegel[], mitSuche: boolean): { gebiet: string; regeln: FristRegel[] }[] {
  const gebiete = [...new Set([...GEBIETE_REIHENFOLGE, ...treffer.map((r) => r.gebiet)])];
  const gruppen = gebiete.map((g) => ({ gebiet: g, regeln: treffer.filter((r) => r.gebiet === g), rang: treffer.findIndex((r) => r.gebiet === g) })).filter((g) => g.regeln.length);
  if (mitSuche) gruppen.sort((a, b) => a.rang - b.rang);
  return gruppen.map(({ gebiet, regeln }) => ({ gebiet, regeln }));
}

export function FristartAuswahl({
  id,
  suche,
  onSuche,
  value,
  onWaehle,
  naechstesFeldId,
  label = "Fristart",
  hoehe = "max-h-[220px] sm:max-h-[300px]",
  pflicht,
}: {
  id: string;
  suche: string;
  onSuche: (s: string) => void;
  /** gewählte Fristart ("" = keine) */
  value: string;
  onWaehle: (r: FristRegel) => void;
  /** Feld, das nach Enter den Fokus erhält (z. B. Ereignisdatum) */
  naechstesFeldId?: string;
  label?: string;
  hoehe?: string;
  pflicht?: boolean;
}) {
  const treffer = useMemo(() => sucheFristarten(suche, FRIST_REGELN), [suche]);
  const gruppen = useMemo(() => gruppiereFristarten(treffer, !!suche.trim()), [treffer, suche]);
  // Sichtbare Reihenfolge (für ↑/↓) = Reihenfolge der Gruppen
  const sichtbar = useMemo(() => gruppen.flatMap((g) => g.regeln), [gruppen]);
  const [aktivKey, setAktivKey] = useState<string>("");
  const listeRef = useRef<HTMLDivElement>(null);
  const tastatur = useRef(false);

  // Neue Suche → erster Treffer markiert; ohne Suche die gewählte Fristart
  useEffect(() => {
    setAktivKey(suche.trim() ? (sichtbar[0]?.key ?? "") : value);
  }, [suche]); // eslint-disable-line react-hooks/exhaustive-deps

  const aktivIndex = sichtbar.findIndex((r) => r.key === aktivKey);

  // Vorgewählte Fristart beim Öffnen sichtbar machen (nur innerhalb der Liste scrollen, Gebietsüberschrift mit anzeigen)
  useEffect(() => {
    const t = setTimeout(() => {
      const box = listeRef.current;
      const el = box?.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!box || !el) return;
      const r = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      if (r.top >= b.top + 30 && r.bottom <= b.bottom) return;
      const g = el.parentElement?.getBoundingClientRect();
      box.scrollTop += g && r.bottom - g.top + 6 <= b.height ? g.top - b.top - 6 : r.top - b.top - 34;
    }, 220);
    return () => clearTimeout(t);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const optId = (k: string) => `${id}-opt-${k}`;

  // Markierten Treffer nur innerhalb der Liste sichtbar halten
  useEffect(() => {
    if (!tastatur.current || !aktivKey) return;
    tastatur.current = false;
    const box = listeRef.current;
    const el = box?.querySelector<HTMLElement>(`#${CSS.escape(optId(aktivKey))}`);
    if (!box || !el) return;
    const r = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    if (r.top < b.top + 32) box.scrollTop -= b.top + 32 - r.top;
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom + 4;
  }, [aktivKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const waehle = (r: FristRegel, weiter: boolean) => {
    onWaehle(r);
    setAktivKey(r.key);
    if (weiter && naechstesFeldId) requestAnimationFrame(() => document.getElementById(naechstesFeldId)?.focus());
  };

  const taste = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!sichtbar.length) return;
      const i = aktivIndex < 0 ? (e.key === "ArrowDown" ? 0 : sichtbar.length - 1) : Math.max(0, Math.min(sichtbar.length - 1, aktivIndex + (e.key === "ArrowDown" ? 1 : -1)));
      tastatur.current = true;
      setAktivKey(sichtbar[i].key);
    } else if (e.key === "Enter") {
      const r = sichtbar[aktivIndex] ?? sichtbar[0];
      if (!r) return;
      e.preventDefault();
      waehle(r, true);
    } else if (e.key === "Escape" && suche) {
      // erst die Suche leeren, erst das nächste Escape schließt den Dialog
      e.preventDefault();
      e.stopPropagation();
      onSuche("");
    }
  };

  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
        {pflicht && <span className="text-fg-3"> (Pflicht)</span>}
      </label>
      <SearchField
        id={id}
        role="combobox"
        aria-expanded="true"
        aria-controls={`${id}-liste`}
        aria-autocomplete="list"
        aria-activedescendant={aktivIndex >= 0 ? optId(sichtbar[aktivIndex].key) : undefined}
        aria-describedby={`${id}-tipp`}
        autoComplete="off"
        value={suche}
        onChange={onSuche}
        onKeyDown={taste}
        placeholder="z. B. Berufung ArbG, Kündigung, 517, Mahnbescheid …"
      />
      <p id={`${id}-tipp`} className="mt-1 text-[12px] text-fg-3">
        Wörter in beliebiger Reihenfolge, auch Abkürzungen (ArbG, LAG, OLG) · <span className="kbd">↑</span> <span className="kbd">↓</span> markieren · <span className="kbd">Enter</span> übernehmen
      </p>
      <div
        ref={listeRef}
        id={`${id}-liste`}
        className={cn("mt-2 overflow-y-auto rounded-[16px] bg-[var(--ink-softer)] p-1.5 ring-1 ring-inset ring-[var(--line)]", hoehe)}
        role="listbox"
        aria-label="Fristarten"
        tabIndex={-1}
      >
        {gruppen.map((g) => (
          <div key={g.gebiet} role="group" aria-label={g.gebiet} className="mb-1 last:mb-0">
            <div aria-hidden className="eyebrow sticky top-0 z-10 rounded-[10px] bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] px-2.5 py-1.5 backdrop-blur">
              {g.gebiet}
            </div>
            {g.regeln.map((r) => {
              const gewaehlt = r.key === value;
              const markiert = r.key === aktivKey && (!!suche.trim() || aktivKey !== value);
              return (
                <div
                  key={r.key}
                  id={optId(r.key)}
                  role="option"
                  aria-selected={gewaehlt}
                  onClick={() => waehle(r, false)}
                  onMouseDown={(e) => e.preventDefault()}
                  className={cn(
                    "relative isolate flex min-h-[44px] w-full cursor-pointer items-center gap-2 rounded-[12px] px-2.5 py-2 text-left",
                    !gewaehlt && "hover:bg-[var(--ink-softer)]",
                    markiert && "ring-2 ring-inset ring-[var(--ink)]",
                  )}
                >
                  {gewaehlt && (
                    <motion.span layoutId={`${id}-gewaehlt`} className="absolute inset-0 -z-10 rounded-[12px] bg-surface shadow-[0_2px_10px_-4px_rgba(20,30,80,0.2),0_0_0_1px_var(--line)]" transition={{ type: "spring", stiffness: 520, damping: 38 }} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-[13px] leading-snug", gewaehlt ? "font-semibold text-fg" : "font-medium text-fg-2")}>{r.titel}</div>
                    <div className="text-[12.5px] leading-snug text-fg-3">
                      {r.grundlage} · {einheitText(r)}
                    </div>
                  </div>
                  {fristArt(r).kritisch && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-medium text-seal">
                      <ShieldAlert className="size-3.5" aria-hidden />
                      {r.typ === "notfrist" ? "Notfrist" : "nicht verlängerbar"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {!sichtbar.length && (
          <div role="option" aria-selected={false} aria-disabled className="px-3 py-6 text-center text-[12.5px] text-fg-3">
            Keine Fristart gefunden. Tipp: „Frei bestimmte Frist“ für richterliche Fristen, „FamFG“ für Familiensachen.
          </div>
        )}
      </div>
    </div>
  );
}
