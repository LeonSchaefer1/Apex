import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertTriangle, Info, XCircle, Sparkles, X } from "lucide-react";
import { useToasts, useUI } from "@/store/ui";
import { cn } from "@/lib/cn";
import { useIsMobile } from "@/lib/useMedia";
import { useObersterDialog, type OffenerDialog } from "./Modal";

const ICON = {
  info: <Info className="size-[18px] text-ink" />,
  erfolg: <CheckCircle2 className="size-[18px] text-green" />,
  warnung: <AlertTriangle className="size-[18px] text-amber" />,
  fehler: <XCircle className="size-[18px] text-seal" />,
  ki: <Sparkles className="size-[18px] text-violet" />,
};

/** Lage der Meldungen, solange ein Dialog offen ist – nie über Dialogkopf, Titel, Inhalt, Fuß oder Schließen (I4-T03-03). */
interface DialogLage {
  stil: CSSProperties;
  /** „oben“: Meldungen hängen von oben herab (neue erscheinen von oben); sonst wachsen sie von unten. */
  oben: boolean;
  /** Ausrichtung der Kapseln im Bereich */
  ausrichtung: "mitte" | "rechts" | "links" | "voll";
  maxBreite: number;
  /** Größe der Kapsel: voll; kompakt (Titel, knapper Innenabstand, ohne Zusatztext); mini (einzeilige Plakette) – je nach freiem Platz. */
  groesse?: "voll" | "kompakt" | "mini";
}

const KOPFLEISTE = 80;
const MELDUNG_HOEHE = 72;
const KOMPAKT_HOEHE = 44;
const MINI_HOEHE = 28;
const ABSTAND = 8;
const RAND = 12;
const SEITE_MIN = 280;
const SEITE_SCHMAL = 120;

/** Rechteck eines Dialogs ohne Transformation (Ein- und Ausblendanimation verschiebt ihn sonst noch). */
function dialogRechteck(el: HTMLElement): { left: number; top: number; width: number; height: number } {
  const eltern = el.offsetParent instanceof HTMLElement ? el.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
  return { left: eltern.left + el.offsetLeft, top: eltern.top + el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
}

/**
 * Lage bei offenem Dialog. Reihenfolge (I4-T03-03): (a) über dem Dialog, wenn Platz; (b) darunter; (c) links bzw. rechts daneben,
 * wenn dort mindestens 280 px frei sind; (d) schmal unten links außerhalb des Dialogrechtecks; danach kompakt bzw. als einzeilige
 * Plakette im freien Streifen über oder unter dem Dialog. `hoehe` ist die gemessene Höhe des Meldungsstapels.
 */
export function lageFuerRechteck(
  art: OffenerDialog["art"],
  r: { left: number; top: number; width: number; height: number },
  vw: number,
  vh: number,
  hoehe: number,
): DialogLage {
  const rechts = r.left + r.width;
  const unten = r.top + r.height;
  if (art === "drawer") {
    // Seitenpanel rechts: Meldungen links daneben, unten – passt dort keine Kapsel hin (Smartphone), oben über dem Kopf des Panels
    const frei = r.left - 32;
    if (frei >= SEITE_MIN) return { stil: { right: vw - r.left + 16, bottom: 24 }, oben: false, ausrichtung: "rechts", maxBreite: Math.min(420, frei) };
    return { stil: { top: RAND, left: RAND, right: RAND }, oben: true, ausrichtung: "mitte", maxBreite: Math.max(220, Math.min(420, r.width - 112)) };
  }
  const kopf = vw < 768 ? RAND : KOPFLEISTE;
  const h = Math.max(MELDUNG_HOEHE, hoehe);
  const freiOben = r.top - kopf - ABSTAND;
  const freiUnten = vh - unten - RAND - ABSTAND;
  const freiLinks = r.left - 2 * RAND;
  const freiRechts = vw - rechts - 2 * RAND;
  const mitte = (top: number, groesse: DialogLage["groesse"] = "voll"): DialogLage => ({ stil: { top, left: RAND, right: RAND }, oben: true, ausrichtung: "mitte", maxBreite: 420, groesse });
  // (a) über dem Dialog
  if (freiOben >= h) return mitte(kopf);
  // (b) unter dem Dialog
  if (freiUnten >= h) return mitte(unten + ABSTAND);
  // (c) neben dem Dialog – auf der breiteren Seite
  const obenNeben = Math.max(kopf, Math.min(r.top, vh - h - RAND));
  if (Math.max(freiLinks, freiRechts) >= SEITE_MIN) {
    if (freiRechts >= freiLinks) return { stil: { top: obenNeben, left: rechts + RAND, width: Math.min(420, freiRechts) }, oben: true, ausrichtung: "links", maxBreite: Math.min(420, freiRechts) };
    return { stil: { top: obenNeben, right: vw - r.left + RAND, width: Math.min(420, freiLinks) }, oben: true, ausrichtung: "rechts", maxBreite: Math.min(420, freiLinks) };
  }
  // (d) schmal unten links, außerhalb des Dialogrechtecks (Titel bricht um)
  if (freiLinks >= SEITE_SCHMAL) return { stil: { bottom: RAND, left: RAND, width: freiLinks }, oben: false, ausrichtung: "links", maxBreite: freiLinks, groesse: freiLinks < 240 ? "kompakt" : "voll" };
  // danach: kompakt bzw. einzeilig im größeren freien Streifen über oder unter dem Dialog
  const obenBesser = freiOben >= freiUnten;
  const streifen = Math.max(freiOben, freiUnten);
  const groesse: DialogLage["groesse"] = streifen >= KOMPAKT_HOEHE ? "kompakt" : "mini";
  const hoeheKapsel = groesse === "kompakt" ? KOMPAKT_HOEHE : MINI_HOEHE;
  // im äußersten Fall (Dialog füllt fast den ganzen Bildschirm) bis an den Fensterrand – aber nicht in das Dialogrechteck
  if (obenBesser) return mitte(Math.max(2, Math.min(kopf, r.top - ABSTAND - hoeheKapsel)), groesse);
  return mitte(Math.max(unten, Math.min(unten + ABSTAND, vh - hoeheKapsel - 2)), groesse);
}

function lageFuer(d: OffenerDialog, hoehe: number): DialogLage | null {
  const el = d.el();
  if (!el) return null;
  return lageFuerRechteck(d.art, dialogRechteck(el), window.innerWidth, window.innerHeight, hoehe);
}

// ───────────── Ausweichen vor der fokussierten Zeile (I5-T03-02) ─────────────

/** „Zeile“ des fokussierten Elements: die Einheit, die eine Meldung nicht verdecken soll (Tabellen-, Listen-, Fristzeile, Karte). */
const ZEILE = "[role=row], tr, li, [data-frist], [data-frist-zeile], [data-nachricht], section";
/** Abstand der Meldungen vom rechten Rand und über der Assistent-Kugel (wie die Klassen right-6, bottom-[96px] bzw. bottom-6). */
const RECHTS = 24;
const UNTEN_MIT_KUGEL = 96;
const UNTEN_OHNE_KUGEL = 24;
const MAX_BREITE = 420;

type Rechteck = { left: number; top: number; right: number; bottom: number };
const ueberlappt = (a: Rechteck, b: Rechteck) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** Zuletzt fokussiertes Element samt Zeile – falls der auslösende Knopf beim Bestätigen verschwindet (Fokus dann auf BODY). */
let letzterFokus: { el: Element; zeile: Element | null; rect: Rechteck } | null = null;
function merkeFokus(e: FocusEvent) {
  const el = e.target instanceof Element ? e.target : null;
  if (!el || el.closest("[data-meldungen]")) return;
  const zeile = el.closest(ZEILE);
  const r = (zeile ?? el).getBoundingClientRect();
  letzterFokus = { el, zeile, rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } };
}

/** Rechtecke, die eine neue Meldung nicht verdecken darf: fokussiertes Element und seine Zeile. */
function fokusRechtecke(): Rechteck[] {
  const akt = document.activeElement;
  const fokus = akt && akt !== document.body && akt !== document.documentElement && !akt.closest("[data-meldungen]") ? akt : null;
  if (fokus) {
    const zeile = fokus.closest(ZEILE);
    return [fokus.getBoundingClientRect(), ...(zeile ? [zeile.getBoundingClientRect()] : [])];
  }
  if (!letzterFokus) return [];
  if (letzterFokus.el.isConnected) return [letzterFokus.el.getBoundingClientRect(), ...(letzterFokus.zeile?.isConnected ? [letzterFokus.zeile.getBoundingClientRect()] : [])];
  return [letzterFokus.zeile?.isConnected ? letzterFokus.zeile.getBoundingClientRect() : letzterFokus.rect];
}

/** Würde der Meldungsstapel unten rechts (Breite × Höhe) das fokussierte Element oder seine Zeile überdecken? */
export function verdecktFokus(breite: number, hoehe: number, unten: number, vw: number, vh: number, ziele: Rechteck[]): boolean {
  const platz: Rechteck = { left: vw - RECHTS - breite, right: vw - RECHTS, top: vh - unten - hoehe, bottom: vh - unten };
  return ziele.some((z) => z.bottom > z.top && z.right > z.left && ueberlappt(platz, z));
}

/** Lage für den obersten offenen Dialog – nachgeführt bei Größenänderung von Fenster und Dialog; ohne Dialog `null`. */
function useDialogLage(hoehe: number): DialogLage | null {
  const oben = useObersterDialog();
  const [lage, setLage] = useState<DialogLage | null>(null);
  useEffect(() => {
    if (!oben) {
      setLage(null);
      return;
    }
    let raf = 0;
    const messen = () => setLage(lageFuer(oben, hoehe));
    // erst nach dem Einhängen des Dialogs messen (Element und Inhalt stehen dann)
    raf = requestAnimationFrame(messen);
    const spaeter = window.setTimeout(messen, 250);
    window.addEventListener("resize", messen);
    // Dialog wächst bzw. schrumpft (Inhalt, Schritte): Meldungen nachführen
    const el = oben.el();
    const ro = el && typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => messen()) : null;
    if (el) ro?.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(spaeter);
      window.removeEventListener("resize", messen);
      ro?.disconnect();
    };
  }, [oben, hoehe]);
  return oben ? lage : null;
}

/**
 * Meldungen als Kapseln unten rechts über dem Freiraum der Assistent-Kugel; am Telefon oben unter der Kopfleiste in voller Breite
 * (nicht über Schnellaktions- und Tab-Leiste, I4-T14-01). So verdecken sie weder Suchfeld noch Seitentitel. Ist ein Dialog offen,
 * weichen sie aus – über, unter oder neben den Dialog, nie über Kopf, Titel, Inhalt, Fuß oder Schließen (I4-T03-03); bereits
 * sichtbare Meldungen wandern mit. Meldungen nehmen nie den Fokus; × schließt nur die Meldung, Escape weiter den Dialog.
 * Der Zeitgeber pausiert, solange Maus oder Fokus in der Meldung sind.
 * Ohne Dialog und nicht am Telefon prüft eine neue Meldung, ob sie unten rechts das fokussierte Element oder dessen Zeile
 * überdecken würde – dann weicht der Stapel nach oben rechts unter die Kopfleiste aus, bis alle Meldungen weg sind (I5-T03-02).
 */
export function Toaster() {
  const { toasts, dismiss, pause, weiter } = useToasts();
  const kugel = useUI((s) => s.kugel && !s.kugelEingeklappt);
  const telefon = useIsMobile();
  // gemessene Höhe des Meldungsstapels (mehrere Meldungen, umbrochene Texte) – für die Ausweichlage bei offenem Dialog
  const stapel = useRef<HTMLDivElement>(null);
  const [hoehe, setHoehe] = useState(MELDUNG_HOEHE);
  useLayoutEffect(() => {
    const el = stapel.current;
    if (!el) return;
    const schaetzung = toasts.length * MELDUNG_HOEHE + Math.max(0, toasts.length - 1) * ABSTAND;
    const neu = Math.max(MELDUNG_HOEHE, el.offsetHeight, schaetzung);
    setHoehe((alt) => (Math.abs(alt - neu) > 4 ? neu : alt));
  }, [toasts.length]);
  const dialogLage = useDialogLage(hoehe);
  // Ausweichen vor der fokussierten Zeile (I5-T03-02): beim Erscheinen einer Meldung geprüft, gilt bis der Stapel leer ist
  const [ausgewichen, setAusgewichen] = useState(false);
  const anzahlVorher = useRef(0);
  useEffect(() => {
    document.addEventListener("focusin", merkeFokus, true);
    return () => document.removeEventListener("focusin", merkeFokus, true);
  }, []);
  useLayoutEffect(() => {
    const neu = toasts.length > anzahlVorher.current;
    anzahlVorher.current = toasts.length;
    if (!toasts.length) {
      setAusgewichen(false);
      return;
    }
    if (!neu || ausgewichen || dialogLage || telefon) return;
    const el = stapel.current;
    const breite = Math.min(window.innerWidth * 0.92, el?.offsetWidth || MAX_BREITE);
    const h = Math.max(MELDUNG_HOEHE, el?.offsetHeight ?? 0);
    if (verdecktFokus(breite, h, kugel ? UNTEN_MIT_KUGEL : UNTEN_OHNE_KUGEL, window.innerWidth, window.innerHeight, fokusRechtecke())) setAusgewichen(true);
  }, [toasts.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // Wandert der Fokus, während Meldungen unten rechts stehen (z. B. nach „Kontrolle bestätigen“ auf die nächste Zeile),
  // gilt dieselbe Prüfung mit dem tatsächlichen Rechteck des Stapels.
  useEffect(() => {
    if (!toasts.length || ausgewichen || dialogLage || telefon) return;
    const pruefe = () => {
      const el = stapel.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const platz = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      if (fokusRechtecke().some((z) => z.bottom > z.top && z.right > z.left && ueberlappt(platz, z))) setAusgewichen(true);
    };
    const beiFokus = () => requestAnimationFrame(pruefe);
    document.addEventListener("focusin", beiFokus, true);
    return () => document.removeEventListener("focusin", beiFokus, true);
  }, [toasts.length, ausgewichen, dialogLage, telefon]);
  // Telefon ohne Dialog (I4-T14-01): oben unter der Kopfleiste, volle Breite – nicht unten über Schnellaktions- und Tab-Leiste
  const lage: DialogLage | null =
    dialogLage ??
    (telefon
      ? { stil: { top: "calc(max(12px, env(safe-area-inset-top)) + 64px)", left: RAND, right: RAND }, oben: true, ausrichtung: "voll", maxBreite: 0 }
      : ausgewichen
        ? { stil: { top: KOPFLEISTE, right: RECHTS }, oben: true, ausrichtung: "rechts", maxBreite: MAX_BREITE }
        : null);
  const klein = lage?.groesse && lage.groesse !== "voll" ? lage.groesse : undefined;
  return (
    <div
      ref={stapel}
      className={cn(
        "pointer-events-none fixed z-[100] flex flex-col gap-2",
        lage
          ? lage.ausrichtung === "mitte"
            ? "items-center"
            : lage.ausrichtung === "voll"
              ? "items-stretch"
              : lage.ausrichtung === "links"
                ? "items-start"
                : "items-end"
          : cn(
              "right-6 items-end",
              // über der Kugel (60 px + 16 px Abstand)
              "bottom-[96px]",
              !kugel && "bottom-6",
            ),
      )}
      style={lage?.stil}
      data-meldungen={dialogLage ? (dialogLage.oben ? "dialog-oben" : "dialog-neben") : telefon ? "oben" : ausgewichen ? "ausgewichen" : "unten"}
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: lage?.oben ? -24 : 24, scale: 0.8, borderRadius: 999 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: lage?.oben ? -16 : 16, scale: 0.85, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            className={cn(
              "pointer-events-auto flex w-full items-center bg-[#0b0e18]/95 text-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/10 backdrop-blur-xl",
              klein === "mini" ? "gap-2 rounded-full py-0.5 pl-2.5 pr-1 [&_svg]:!size-3.5" : klein === "kompakt" ? "gap-2.5 rounded-[16px] px-3 py-2" : "gap-3 rounded-[22px] px-4 py-3",
              lage?.ausrichtung !== "voll" && "sm:w-auto",
            )}
            style={{ maxWidth: lage ? (lage.ausrichtung === "voll" ? undefined : `min(92vw, ${lage.maxBreite}px)`) : "min(92vw, 420px)" }}
            role="status"
            onMouseEnter={() => pause(t.id)}
            onMouseLeave={() => weiter(t.id)}
            onFocus={() => pause(t.id)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) weiter(t.id);
            }}
          >
            <div className="shrink-0 [&>svg]:size-[18px]">{t.icon ?? ICON[t.ton ?? "info"]}</div>
            <div className="min-w-0 flex-1">
              <div className={cn("font-semibold leading-tight", klein === "mini" ? "truncate text-[12.5px]" : "text-[13.5px]")}>{t.titel}</div>
              {t.text && <div className={cn("mt-0.5 text-[13px] leading-snug text-white/80", klein && "sr-only")}>{t.text}</div>}
            </div>
            {t.aktion && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  t.aktion!.onClick();
                  dismiss(t.id);
                }}
                className={cn("shrink-0 rounded-full bg-white/14 font-semibold hover:bg-white/22", klein === "mini" ? "px-2 py-0.5 text-[12px]" : "px-3 py-1.5 text-[13px]")}
              >
                {t.aktion.label}
              </button>
            )}
            <button type="button" onClick={() => dismiss(t.id)} className={cn("-mr-1 grid shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white", klein === "mini" ? "size-6" : "size-7")} aria-label="Meldung schließen">
              <X className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
