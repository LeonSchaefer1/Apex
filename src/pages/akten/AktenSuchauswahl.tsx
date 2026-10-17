// Aktenwahl mit Suche (I4-T02-01) – wie „Bestehender Kontakt“ in der Mandatsaufnahme: ein Eingabefeld (Combobox mit
// aria-activedescendant), Treffer nach Aktenzeichen, Mandant bzw. Gegner, Gerichtsaktenzeichen und Titel (Volltext über
// `search`), KI-Vorschlag und zuletzt geöffnete Akten oben. ↑/↓ markiert, Enter übernimmt, Escape leert die Suche.
// `autoFokus` (I5-T02-01): Wird die Auswahl ausdrücklich aufgeklappt („Andere Akte wählen“), liegt der Fokus sofort im
// Suchfeld – Tippen landet dort, Einzeltasten-Kürzel ruhen – und Feld samt Trefferliste scrollen ins Bild.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Check, History, Sparkles } from "lucide-react";
import type { Akte, Kontakt } from "@/core/types";
import { search } from "@/core/search";
import { Chip, SearchField } from "@/components/ui";
import { Highlight } from "@/components/Highlight";
import { cn } from "@/lib/cn";

// ───────────── Zuletzt geöffnete Akten (je Person, nur in diesem Browser; nur Akten-IDs) ─────────────
const ZULETZT_KEY = (userId: string) => `apex.akten.zuletzt.${userId}`;

export function ladeZuletzt(userId: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(ZULETZT_KEY(userId)) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}

/** Beim Öffnen einer Akte aufrufen – die Aktenwahl zeigt sie danach unter „Zuletzt geöffnet“. */
export function merkeAkteGeoeffnet(userId: string, akteId: string) {
  try {
    const neu = [akteId, ...ladeZuletzt(userId).filter((id) => id !== akteId)].slice(0, 8);
    localStorage.setItem(ZULETZT_KEY(userId), JSON.stringify(neu));
  } catch {
    /* ohne Speicher keine Liste „Zuletzt geöffnet“ */
  }
}

interface Option {
  akte: Akte;
  gruppe: "ki" | "zuletzt" | "alle" | "treffer";
}

export function AktenSuchauswahl({
  id,
  akten,
  kontakte,
  value,
  onChange,
  vorschlagId,
  userId,
  hoehe = 280,
  label = "Akte wählen",
  autoFokus = false,
  onEscape,
}: {
  id: string;
  akten: Akte[];
  kontakte: Map<string, Kontakt> | Kontakt[];
  value: string;
  onChange: (akteId: string) => void;
  /** KI-Vorschlag – steht oben, mit „KI-Vorschlag“ gekennzeichnet */
  vorschlagId?: string;
  /** für „Zuletzt geöffnet“ */
  userId?: string;
  hoehe?: number;
  label?: string;
  /** Fokus beim Erscheinen ins Suchfeld, danach Feld und Liste ins Bild (nur bei ausdrücklich aufgeklappter Auswahl) */
  autoFokus?: boolean;
  /** Escape bei leerer Suche – z. B. Auswahl schließen und den Fokus zurückgeben */
  onEscape?: () => void;
}) {
  const [q, setQ] = useState("");
  const rahmen = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!autoFokus) return;
    document.getElementById(id)?.focus({ preventScroll: true });
    // Nach dem Aufklappen (Höhenanimation) Feld und Trefferliste ins Bild – bei reduzierter Bewegung sofort
    const ruhig = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => rahmen.current?.scrollIntoView({ block: "nearest", behavior: ruhig ? "auto" : "smooth" }), ruhig ? 0 : 360);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [markiert, setMarkiert] = useState(-1);
  const kMap = useMemo(() => (kontakte instanceof Map ? kontakte : new Map(kontakte.map((k) => [k.id, k]))), [kontakte]);
  const name = (kid?: string) => (kid ? kMap.get(kid)?.name ?? "" : "");
  const zuletzt = useMemo(() => (userId ? ladeZuletzt(userId) : []), [userId]);

  const optionen = useMemo((): Option[] => {
    const s = q.trim();
    if (s) {
      return search(akten, s, [
        { get: (a) => a.aktenzeichen, weight: 6 },
        { get: (a) => a.gerichtsAz, weight: 5 },
        { get: (a) => `${name(a.mandantId)} ${name(a.gegnerId)}`, weight: 4 },
        { get: (a) => a.titel, weight: 3 },
        { get: (a) => a.schlagworte.join(" "), weight: 1 },
      ], 30).map((h) => ({ akte: h.item, gruppe: "treffer" as const }));
    }
    const ki = vorschlagId ? akten.find((a) => a.id === vorschlagId) : undefined;
    const zl = zuletzt.map((zid) => akten.find((a) => a.id === zid)).filter((a): a is Akte => !!a && a.id !== ki?.id).slice(0, 5);
    const rest = akten.filter((a) => a.id !== ki?.id && !zl.includes(a)).slice(0, 40);
    return [...(ki ? [{ akte: ki, gruppe: "ki" as const }] : []), ...zl.map((akte) => ({ akte, gruppe: "zuletzt" as const })), ...rest.map((akte) => ({ akte, gruppe: "alle" as const }))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, akten, vorschlagId, zuletzt, kMap]);

  const listId = `${id}-liste`;
  const optId = (a: Akte) => `${id}-opt-${a.id}`;
  const aktiv = markiert >= 0 && markiert < optionen.length ? optionen[markiert] : undefined;
  const gewaehlt = akten.find((a) => a.id === value);

  const markiere = (i: number) => {
    setMarkiert(i);
    const o = optionen[i];
    if (o) document.getElementById(optId(o.akte))?.scrollIntoView({ block: "nearest" });
  };
  const waehle = (a: Akte) => {
    onChange(a.id);
    setQ("");
    setMarkiert(-1);
  };
  const taste = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!optionen.length) return;
      const start = markiert >= 0 ? markiert : Math.max(-1, optionen.findIndex((o) => o.akte.id === value));
      markiere(e.key === "ArrowDown" ? Math.min(optionen.length - 1, start + 1) : Math.max(0, start < 0 ? 0 : start - 1));
    } else if (e.key === "Enter") {
      if (e.repeat) return e.preventDefault();
      const o = aktiv ?? (q.trim() ? optionen[0] : undefined);
      if (!o) return;
      e.preventDefault();
      waehle(o.akte);
    } else if (e.key === "Escape" && (q || markiert >= 0)) {
      // Escape leert nur die Suche – erst das nächste schließt den Dialog
      e.preventDefault();
      e.stopPropagation();
      setQ("");
      setMarkiert(-1);
    } else if (e.key === "Escape" && onEscape) {
      e.preventDefault();
      e.stopPropagation();
      onEscape();
    }
  };

  const GRUPPE: Record<Option["gruppe"], string> = { ki: "KI-Vorschlag", zuletzt: "Zuletzt geöffnet", alle: "Offene Akten", treffer: "Treffer" };
  let letzteGruppe = "";

  return (
    <div ref={rahmen} className="grid grid-cols-1 gap-2 scroll-my-3">
      <label htmlFor={id} className="label !mb-0">
        {label}
      </label>
      <SearchField
        id={id}
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={aktiv ? optId(aktiv.akte) : undefined}
        aria-describedby={`${id}-tipp`}
        autoComplete="off"
        value={q}
        onChange={(v) => {
          setQ(v);
          setMarkiert(-1);
        }}
        onKeyDown={taste}
        placeholder="Az., Mandant, Gegner, Gerichts-Az. …"
        leerenFokussierbar={false}
        className="max-sm:[&_input]:!h-11"
      />
      <p id={`${id}-tipp`} className="-mt-1 px-1 text-[12px] text-fg-3">
        {gewaehlt ? (
          <>
            Gewählt: <span className="mono font-medium text-fg-2">{gewaehlt.aktenzeichen}</span> {gewaehlt.titel} ·{" "}
          </>
        ) : null}
        ↑/↓ wählt, Enter übernimmt{q.trim() ? " – ohne Auswahl den ersten Treffer" : ""}, Escape {q || markiert >= 0 || !onEscape ? "leert die Suche" : "schließt die Auswahl"}.
      </p>
      {optionen.length === 0 ? (
        <div role="status" className="rounded-[16px] bg-ink-softer px-4 py-6 text-center text-[13px] text-fg-3 shadow-[inset_0_0_0_1px_var(--line)]">
          Keine Akte gefunden – Aktenzeichen, Namen oder Gerichtsaktenzeichen prüfen.
        </div>
      ) : (
        <div id={listId} role="listbox" aria-label="Akten" tabIndex={-1} className="overflow-y-auto rounded-[16px] bg-ink-softer p-1 shadow-[inset_0_0_0_1px_var(--line)] outline-none" style={{ maxHeight: hoehe }}>
          {optionen.map((o, i) => {
            const a = o.akte;
            const zeigeGruppe = !q.trim() && o.gruppe !== letzteGruppe;
            letzteGruppe = o.gruppe;
            const istGewaehlt = a.id === value;
            const istMarkiert = i === markiert;
            return (
              <div key={a.id} role="presentation">
                {zeigeGruppe && (
                  <div aria-hidden className="eyebrow flex items-center gap-1.5 px-2.5 pb-1 pt-2">
                    {o.gruppe === "ki" ? <Sparkles className="size-3 text-violet" /> : o.gruppe === "zuletzt" ? <History className="size-3" /> : null}
                    {GRUPPE[o.gruppe]}
                  </div>
                )}
                <div
                  id={optId(a)}
                  role="option"
                  aria-selected={istGewaehlt}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setMarkiert(i);
                    waehle(a);
                    document.getElementById(id)?.focus();
                  }}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-start gap-2.5 rounded-[12px] px-2.5 py-2 text-left",
                    istGewaehlt ? "bg-[var(--surface)] shadow-[0_0_0_1.5px_var(--ink)]" : "hover:bg-[var(--surface)]",
                    istMarkiert && !istGewaehlt && "bg-[var(--surface)] shadow-[inset_0_0_0_1.5px_var(--line-strong)]",
                    istMarkiert && istGewaehlt && "outline outline-2 outline-offset-1 outline-[var(--ink)]",
                  )}
                >
                  <span className="mono w-[58px] shrink-0 pt-px text-[12.5px] font-semibold text-ink">
                    <Highlight text={a.aktenzeichen} q={q} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-[13px] font-medium">
                      <Highlight text={a.titel} q={q} />
                    </span>
                    {(a.gerichtsAz || name(a.mandantId)) && (
                      <span className="block break-words text-[12px] text-fg-3">
                        {[name(a.mandantId), a.gerichtsAz ? `Gericht ${a.gerichtsAz}` : ""].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    {/* Ohne Suche steht der Vorschlag unter der Überschrift „KI-Vorschlag“; in den Treffern als Chip unter dem Titel
                        (nicht als eigene Spalte – sonst bleibt bei 360 px kaum Platz für den Aktentitel) */}
                    {q.trim() && a.id === vorschlagId && (
                      <Chip tone="violet" icon={<Sparkles className="size-3" aria-hidden />} className="mt-1 !h-5 !px-1.5 !text-[11px]">
                        KI-Vorschlag
                      </Chip>
                    )}
                  </span>
                  {istGewaehlt && <Check className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
