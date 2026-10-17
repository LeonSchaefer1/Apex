import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarCheck2, ChevronDown } from "lucide-react";
import { addDays, diffDays, fmtDate, fmtDateWd, relDays } from "@/core/dates";
import { feiertagAm } from "@/core/feiertage";
import type { Akte, Bundesland, Frist, User } from "@/core/types";
import { toast } from "@/store/ui";
import { altKuerzel, dialogOffen, einzeltasteErlaubt, istEingabeElement } from "@/lib/tastatur";
import { Button, Card, Empty } from "@/components/ui";
import { cn } from "@/lib/cn";
import { FristZeile } from "./FristZeile";
import { bestaetigeKontrolle, brauchtKontrolle, darfKontrollieren } from "./logik";

const sichtbarEl = (el: Element) => el.getClientRects().length > 0;

/** Fokusziel einer Fristzeile: die gewünschte Aktion (z. B. „Kontrolle bestätigen“), sonst das Öffnen-Ziel (Titel). */
function zielInZeile(zeile: HTMLElement, aktion: string): HTMLElement | null {
  const finde = (a: string) => Array.from(zeile.querySelectorAll<HTMLElement>(`[data-aktion="${a}"]`)).find((el) => sichtbarEl(el) && !(el as HTMLButtonElement).disabled) ?? null;
  return finde(aktion) ?? finde("titel") ?? finde("erledigt") ?? zeile.querySelector<HTMLElement>("button:not([disabled])");
}

interface Gruppe {
  key: string;
  titel: string;
  sub?: string;
  ton?: "seal" | "ink" | "green";
  items: Frist[];
}

const HORIZONT_TAGE = 21;

function gruppiere(fristen: Frist[], heute: string, land: Bundesland): Gruppe[] {
  const offen = fristen.filter((f) => f.status === "offen").sort((a, b) => a.datum.localeCompare(b.datum) || (a.uhrzeit ?? "").localeCompare(b.uhrzeit ?? ""));
  const erledigt = fristen.filter((f) => f.status === "erledigt").sort((a, b) => (b.erledigtAm ?? b.datum).localeCompare(a.erledigtAm ?? a.datum));
  const gruppen: Gruppe[] = [];
  const ueber = offen.filter((f) => f.datum < heute);
  if (ueber.length) gruppen.push({ key: "ueber", titel: "Überfällig", sub: "Sofort prüfen", ton: "seal", items: ueber });
  const map = new Map<string, Frist[]>();
  for (const f of offen.filter((x) => x.datum >= heute)) map.set(f.datum, [...(map.get(f.datum) ?? []), f]);
  for (const [datum, items] of map) {
    const n = diffDays(heute, datum);
    const ft = feiertagAm(datum, land);
    const titel = n === 0 ? "Heute" : n === 1 ? "Morgen" : fmtDateWd(datum);
    const sub = [n <= 1 ? fmtDateWd(datum) : relDays(datum, heute), ft?.name].filter(Boolean).join(" · ");
    gruppen.push({ key: datum, titel, sub, ton: n === 0 ? "ink" : undefined, items });
  }
  if (erledigt.length) gruppen.push({ key: "erledigt", titel: "Erledigt", sub: "zuletzt abgeschlossen", ton: "green", items: erledigt.slice(0, 40) });
  return gruppen;
}

export function FristListe({
  fristen, akten, team, user, heute, land, gefiltert, ohneHorizont, markiert, vertretungFuer, vertretungVorab, onOpen, leerTitel,
}: {
  fristen: Frist[];
  akten: Map<string, Akte>;
  team: User[];
  user: User;
  heute: string;
  land: Bundesland;
  gefiltert: boolean;
  /** Alle späteren Fristen sofort zeigen (z. B. bei Akten- oder Kontrollfilter aus einem Deep-Link) */
  ohneHorizont?: boolean;
  /** Per Deep-Link angesprungener Tag: Gruppe hervorheben und hinscrollen */
  markiert?: string;
  /** Vertretene Personen (heute abwesend, ich bin Vertretung): ID → Name */
  vertretungFuer?: Map<string, string>;
  /** Vorab eingeblendete Vertretungsfristen: Frist-ID → „Jonas Brandt ab Mo, 19.10.“ (I4-T18-04) */
  vertretungVorab?: Map<string, string>;
  /** Klick auf eine Fristzeile öffnet das Fristdetail */
  onOpen?: (f: Frist) => void;
  /** Überschrift der leeren Liste – Fokusziel, wenn die letzte Zeile wegfällt (z. B. „Keine offene Kontrolle mehr“) */
  leerTitel?: string;
}) {
  const [alle, setAlle] = useState(false);
  const gruppen = useMemo(() => gruppiere(fristen, heute, land), [fristen, heute, land]);
  const grenze = addDays(heute, HORIZONT_TAGE);
  const ohneGrenze = alle || ohneHorizont || (!!markiert && markiert > grenze);
  const sichtbar = ohneGrenze ? gruppen : gruppen.filter((g) => g.key === "ueber" || g.key === "erledigt" || g.key <= grenze);
  const versteckt = gruppen.filter((g) => !sichtbar.includes(g)).reduce((s, g) => s + g.items.length, 0);
  const markRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!markiert) return;
    const t = setTimeout(() => markRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 260);
    return () => clearTimeout(t);
  }, [markiert]);

  // ───── Tastatur (I4-T03-02, I4-T03-05): J/↓ nächste, K/↑ vorige Frist, Enter Details, B Vier-Augen-Kontrolle ─────
  const containerRef = useRef<HTMLDivElement>(null);
  /** Zuletzt fokussierte Zeile mit Aktion und Reihenfolge – für den Fokus nach „Kontrolle bestätigen“, „Erledigt“, „Streichen“ */
  const letzter = useRef<{ id: string; aktion: string; reihenfolge: string[]; aktiv: boolean } | null>(null);
  const fristenRef = useRef(fristen);
  fristenRef.current = fristen;
  const zeilen = () => Array.from(containerRef.current?.querySelectorAll<HTMLElement>("[data-frist-zeile]") ?? []).filter(sichtbarEl);

  useEffect(() => {
    const box = containerRef.current;
    if (!box) return;
    const fokusIn = (e: FocusEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (!ziel) return;
      if (box.contains(ziel)) {
        const zeile = ziel.closest<HTMLElement>("[data-frist-zeile]");
        if (!zeile) return;
        letzter.current = { id: zeile.dataset.fristZeile ?? "", aktion: ziel.closest<HTMLElement>("[data-aktion]")?.dataset.aktion ?? "titel", reihenfolge: zeilen().map((z) => z.dataset.fristZeile ?? ""), aktiv: true };
      } else if (letzter.current && !ziel.closest('[aria-modal="true"], [role="menu"]')) {
        // Fokus bewusst woanders hin gesetzt – dann nicht zurückholen
        letzter.current.aktiv = false;
      }
    };
    /** Fokus verloren (Zeile entfernt, Knopf weg, Dialog geschlossen)? Dann auf dieselbe Aktion der folgenden, sonst der vorigen Zeile. */
    const pruefe = () => {
      const l = letzter.current;
      if (!l?.aktiv || dialogOffen()) return;
      const akt = document.activeElement;
      if (akt && akt !== document.body && akt.isConnected) return;
      const da = new Map(zeilen().map((z) => [z.dataset.fristZeile ?? "", z]));
      let ziel: HTMLElement | null = null;
      const selbst = da.get(l.id);
      if (selbst) ziel = zielInZeile(selbst, l.aktion === "kontrolle" ? "erledigt" : l.aktion);
      else {
        // Dieselbe Aktion (z. B. „Kontrolle bestätigen“) in der nächsten Zeile, die sie anbietet – sonst in der vorigen,
        // sonst das Öffnen-Ziel der direkten Nachbarzeile
        const i = l.reihenfolge.indexOf(l.id);
        const danach = l.reihenfolge.slice(i + 1).filter((id) => da.has(id));
        const davor = [...l.reihenfolge.slice(0, Math.max(0, i))].reverse().filter((id) => da.has(id));
        const mitAktion = (id: string) => Array.from(da.get(id)!.querySelectorAll<HTMLElement>(`[data-aktion="${l.aktion}"]`)).find((el) => sichtbarEl(el) && !(el as HTMLButtonElement).disabled);
        const gleich = l.aktion !== "titel" ? [...danach, ...davor].map(mitAktion).find(Boolean) : undefined;
        const nachbar = danach[0] ?? davor[0];
        ziel = gleich ?? (nachbar ? zielInZeile(da.get(nachbar)!, l.aktion) : null);
      }
      if (!ziel) ziel = document.getElementById("fristen-liste-leer");
      if (ziel) ziel.focus({ preventScroll: false });
    };
    const zeiten: number[] = [];
    const planen = () => {
      for (const ms of [60, 420, 900]) zeiten.push(window.setTimeout(pruefe, ms));
    };
    const mo = new MutationObserver(planen);
    mo.observe(box, { childList: true, subtree: true });
    // Dialoge (Nachweis, Streichen) liegen als Portal direkt im body – ihr Schließen prüft ebenfalls
    const moBody = new MutationObserver(planen);
    moBody.observe(document.body, { childList: true });
    document.addEventListener("focusin", fokusIn);
    return () => {
      mo.disconnect();
      moBody.disconnect();
      document.removeEventListener("focusin", fokusIn);
      zeiten.forEach((t) => window.clearTimeout(t));
    };
    // Neu verbinden, wenn die Liste leer wird bzw. wieder Einträge hat (anderer Container)
  }, [gruppen.length === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const alt = altKuerzel(e);
      const einzel = einzeltasteErlaubt(e);
      const taste = e.key.toLowerCase();
      const box = containerRef.current;
      if (!box) return;
      const imListe = !!document.activeElement && box.contains(document.activeElement);
      const pfeil = (e.key === "ArrowDown" || e.key === "ArrowUp") && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && imListe && !istEingabeElement(e.target) && !dialogOffen();
      const befehl =
        (einzel && taste === "j") || alt === "j" || (pfeil && e.key === "ArrowDown")
          ? "naechste"
          : (einzel && taste === "k") || alt === "k" || (pfeil && e.key === "ArrowUp")
            ? "vorige"
            : (einzel && taste === "b") || alt === "b"
              ? "kontrolle"
              : null;
      if (!befehl) return;
      const liste = zeilen();
      if (!liste.length) return;
      const aktZeile = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-frist-zeile]") ?? (letzter.current ? liste.find((z) => z.dataset.fristZeile === letzter.current!.id) : undefined);
      const i = aktZeile ? liste.indexOf(aktZeile) : -1;
      e.preventDefault();
      if (befehl === "kontrolle") {
        const f = aktZeile ? fristenRef.current.find((x) => x.id === aktZeile.dataset.fristZeile) : undefined;
        if (!f) {
          toast("Erst eine Frist wählen", { text: "Mit J bzw. K oder den Pfeiltasten eine Zeile wählen – dann B.", ton: "info" });
          return;
        }
        if (darfKontrollieren(f, user.id)) {
          if (bestaetigeKontrolle(f, user.id)) toast("Kontrolle bestätigt", { text: `Vier-Augen-Kontrolle erfüllt: ${f.titel} (${fmtDate(f.datum)})`, ton: "erfolg" });
          return;
        }
        toast("Keine Kontrolle möglich", {
          text: !brauchtKontrolle(f)
            ? f.kontrolliertVon
              ? "Diese Frist ist bereits kontrolliert."
              : "Für diesen Eintrag ist keine Vier-Augen-Kontrolle vorgesehen – nur für Notfristen und Fristen."
            : "Eigene Frist – die Vier-Augen-Kontrolle bestätigt eine zweite Person.",
          ton: "info",
        });
        return;
      }
      const j = befehl === "naechste" ? (i < 0 ? 0 : Math.min(liste.length - 1, i + 1)) : i < 0 ? 0 : Math.max(0, i - 1);
      const ziel = zielInZeile(liste[j], "titel");
      ziel?.focus();
      ziel?.scrollIntoView({ block: "nearest" });
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!gruppen.length)
    return (
      <div ref={containerRef}>
        <Card
          id={leerTitel ? undefined : "fristen-liste-leer"}
          tabIndex={leerTitel ? undefined : -1}
          aria-label={leerTitel ? undefined : gefiltert ? "Keine Fristen für diesen Filter" : "Keine offenen Fristen"}
          className="outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
        >
          {leerTitel && (
            <h2 id="fristen-liste-leer" tabIndex={-1} className="title-md rounded-[10px] px-1 pt-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]">
              {leerTitel}
            </h2>
          )}
          <Empty
            icon={<CalendarCheck2 className="size-6" />}
            title={gefiltert ? "Keine Fristen für diesen Filter" : "Keine offenen Fristen"}
            text={gefiltert ? "Ändern Sie die Filter, um weitere Fristen zu sehen." : "Alles erledigt. Neue Fristen erkennt die KI automatisch im Posteingang – oder Sie berechnen sie mit dem Fristenrechner."}
          />
        </Card>
      </div>
    );

  let zaehler = 0;
  return (
    <div className="space-y-6" ref={containerRef}>
      <AnimatePresence initial={false}>
        {sichtbar.map((g) => {
          const start = zaehler;
          zaehler += g.items.length;
          return (
            <motion.section
              key={g.key}
              ref={g.key === markiert ? markRef : undefined}
              data-gruppe={g.key}
              layout="position"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
              className={cn(g.key === markiert && "-m-2 rounded-[24px] bg-ink-softer p-2 ring-2 ring-[var(--ink)]")}
            >
              <div className="mb-2 flex items-baseline gap-2.5 px-1">
                <h3 className={cn("title-md", g.ton === "seal" && "text-seal", g.ton === "ink" && "text-ink", g.ton === "green" && "text-green")}>{g.titel}</h3>
                {g.sub && <span className="num min-w-0 text-[12.5px] text-fg-3">{g.sub}</span>}
                <span className="num ml-auto rounded-full bg-[var(--ink-softer)] px-2 py-0.5 text-[12.5px] font-medium text-fg-3">{g.items.length}</span>
              </div>
              <Card padded={false} className={cn("overflow-hidden", g.ton === "seal" && "ring-1 ring-[color-mix(in_oklab,var(--seal)_25%,transparent)]")}>
                <div className="divide-y divide-[var(--line)]">
                  <AnimatePresence initial={false}>
                    {g.items.map((f, i) => (
                      <FristZeile key={f.id} f={f} akte={akten.get(f.akteId)} team={team} user={user} index={start + i} zeigeDatum={g.key === "ueber" || g.key === "erledigt"} vertretungFuer={vertretungFuer?.get(f.verantwortlichId)} vertretungVorab={vertretungVorab?.get(f.id)} onOpen={onOpen} />
                    ))}
                  </AnimatePresence>
                </div>
              </Card>
            </motion.section>
          );
        })}
      </AnimatePresence>
      {versteckt > 0 && (
        <div className="flex justify-center">
          <Button variant="ghost" icon={<ChevronDown className="size-4" />} onClick={() => setAlle(true)}>
            {versteckt} spätere {versteckt === 1 ? "Frist" : "Fristen"} anzeigen (nach {fmtDateWd(grenze)})
          </Button>
        </div>
      )}
    </div>
  );
}
