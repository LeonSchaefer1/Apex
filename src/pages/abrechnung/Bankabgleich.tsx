// Reiter „Bankabgleich“: Kontoumsätze werden automatisch Rechnungen zugeordnet – mit sichtbarem Abgleich.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowRight, Building2, Check, CheckCircle2, ChevronDown, Clock, FilePenLine, HandCoins, Landmark, Link2, Send, ShieldCheck, Sparkles, Unlink, Upload, Vault, Wallet, X } from "lucide-react";
import { AnimatedNumber, Button, Card, Chip, ProgressRing, Segmented, Select, confirmDialog } from "@/components/ui";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { fmtDate, fmtDateShort, fmtEUR, fmtTime, nowLocal, round2 } from "@/core/dates";
import { automationDef, ersparnisMinuten } from "@/core/automationen";
import type { Transaktion } from "@/core/types";
import { cn } from "@/lib/cn";
import {
  AKTEN_BUCHUNGSART,
  AKTEN_BUCHUNGSART_KURZ,
  AUTO_SCHWELLE,
  bucheTreffer,
  buchungsartVorschlag,
  fremdgeldMeldung,
  KONTO_NAME,
  kontoVon,
  type KontoArt,
  gleicheAb,
  lehneVorschlagAb,
  loeseZuordnung,
  mandantenIbans,
  REGELN,
  speichereVorschlag,
  stornierteRechnungImZweck,
  trefferAusVorschlag,
  zuordnungsProtokoll,
  type AktenBuchungsart,
  type Treffer,
} from "./abgleich";
import { belegArt, stelleRechnung } from "./aktionen";
import { istOffen, offenerBetrag } from "./lib";
import { StellenDialog } from "./StellenDialog";
import { useAbrechnungUI } from "./store";
import { AkteLabel, TabKopf, useLookups } from "./ui";

type Zustand = "gebucht" | "vorschlag" | "kosten" | "keine" | "bestaetigt" | "abgelehnt" | "manuell";
type Ergebnis = Treffer & { zustand: Zustand };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ergebnis des letzten Abgleichs (je Kanzlei, nur Zahlen) – nach Reiterwechsel, Neuladen oder Neustart des Browsers sichtbar; gebucht ist sofort beim Start. */
interface LaufStand {
  am: string;
  gebucht: number;
  vorschlaege: number;
  kosten: number;
  fremd: number;
  keine: number;
  gespart: number;
  /** false = Anzeige-Animation lief beim Seitenwechsel noch – die Buchungen sind trotzdem vollständig */
  angezeigt: boolean;
  /**
   * Buchung des Laufs abgeschlossen (I5-T08-01). Nur `false`, wenn die Buchung selbst beim Verlassen noch lief; ältere
   * Einträge ohne Feld wurden erst nach der Buchung gespeichert und gelten als abgeschlossen.
   */
  abgeschlossen?: boolean;
}
const laufKey = (tenantId: string) => `apex.bankabgleich.lauf.${tenantId}`;
function ladeLauf(tenantId: string): LaufStand | null {
  try {
    const v = JSON.parse(localStorage.getItem(laufKey(tenantId)) ?? "null") as LaufStand | null;
    return v && typeof v.am === "string" ? v : null;
  } catch {
    return null;
  }
}
function speichereLauf(tenantId: string, l: LaufStand) {
  try {
    localStorage.setItem(laufKey(tenantId), JSON.stringify(l));
  } catch {
    /* ohne Speicher: Ergebnis nur bis zum Neuladen sichtbar – die Buchungen selbst sind gespeichert */
  }
}
/** Minuten manuelle Zuordnung je automatisch zugeordnetem Umsatz – aus der Automatik-Definition (je Vorgang gezählt). */
const MIN_JE_UMSATZ = automationDef("bankabgleich")?.minutenProLauf ?? 3;

/** Erklärkarte „Wie sicher ist die Zuordnung?“ – auf-/zugeklappt je Gerät; ohne eigene Wahl nach dem ersten Abgleich eingeklappt (I3-T08-03). */
const ERKLAER_KEY = "apex.bankabgleich.erklaerung";
function ladeErklaerung(): "auf" | "zu" | null {
  try {
    const v = localStorage.getItem(ERKLAER_KEY);
    return v === "auf" || v === "zu" ? v : null;
  } catch {
    return null;
  }
}

/** Ersparnis als Schätzung gekennzeichnet – wie in der Sammelabrechnung (I3-T08-04, I3-T22-02). */
function GespartSchaetzung({ minuten }: { minuten: number }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <Chip tone="green" icon={<Clock className="size-3.5" />} title={`Schätzung: ${MIN_JE_UMSATZ} Min. manuelle Zuordnung je automatisch zugeordnetem Umsatz`}>
        ≈ {minuten} Min. gespart
      </Chip>
      <Chip tone="amber" className="!h-5 !px-1.5 !text-[11px]">
        Schätzung
      </Chip>
      <span className="text-[12.5px] text-fg-3">Annahme: {MIN_JE_UMSATZ} Min. je zugeordnetem Umsatz</span>
    </span>
  );
}
const plural = (n: number, eins: string, mehr: string) => `${n} ${n === 1 ? eins : mehr}`;

function tonVon(z: Zustand | undefined): "green" | "amber" | "neutral" | "seal" {
  if (z === "gebucht" || z === "bestaetigt" || z === "manuell") return "green";
  if (z === "vorschlag") return "amber";
  if (z === "keine" || z === "abgelehnt") return "seal";
  return "neutral";
}

function Verbinder({ ton, sichtbar, scannt }: { ton: ReturnType<typeof tonVon>; sichtbar: boolean; scannt: boolean }) {
  const farbe = ton === "green" ? "var(--green)" : ton === "amber" ? "var(--amber)" : ton === "seal" ? "var(--fg-4)" : "var(--fg-3)";
  return (
    <div className="relative flex h-full items-center justify-center" aria-hidden>
      {/* Desktop: waagerecht */}
      <svg width="64" height="24" viewBox="0 0 64 24" className="hidden 2xl:block">
        <line x1="4" y1="12" x2="60" y2="12" stroke="var(--line-strong)" strokeDasharray="2 4" />
        {sichtbar && (
          <>
            <motion.path
              d="M4 12 H56"
              stroke={farbe}
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.path
              d="M51 7 L57 12 L51 17"
              stroke={farbe}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.32 }}
            />
          </>
        )}
      </svg>
      {/* Mobil: senkrecht */}
      <svg width="24" height="26" viewBox="0 0 24 26" className="2xl:hidden">
        <line x1="12" y1="2" x2="12" y2="24" stroke="var(--line-strong)" strokeDasharray="2 4" />
        {sichtbar && (
          <>
            <motion.path d="M12 2 V20" stroke={farbe} strokeWidth={2} strokeLinecap="round" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} />
            <motion.path
              d="M7 16 L12 21 L17 16"
              stroke={farbe}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            />
          </>
        )}
      </svg>
      {scannt && (
        <div className="absolute inset-0 flex items-center justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="size-1.5 rounded-full bg-ink"
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.15, 0.8] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Ziel({ children, ton, gestrichelt }: { children: ReactNode; ton?: ReturnType<typeof tonVon>; gestrichelt?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, x: -8 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 460, damping: 32 }}
      className={cn(
        "flex min-h-[76px] min-w-0 items-center gap-3 rounded-[18px] px-3.5 py-3",
        gestrichelt ? "border border-dashed border-[var(--line-strong)]" : "border border-[var(--line)] bg-[var(--surface)]",
        ton === "green" && "shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--green)_35%,transparent)]",
        ton === "amber" && "shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--amber)_40%,transparent)]",
      )}
    >
      {children}
    </motion.div>
  );
}

export function BankabgleichTab() {
  const transaktionen = useCol("transaktionen");
  const rechnungen = useCol("rechnungen");
  const aktivitaeten = useCol("aktivitaeten");
  const { akten, kontakte, users } = useLookups();
  const { user, tenant } = useKanzlei();
  const nav = useNavigate();
  const [ansicht, setAnsicht] = useState<"offen" | "gebucht">("offen");
  // Filter „Konto: Alle · Geschäftskonto · Anderkonto“ (I4-T08-01)
  const [kontoFilter, setKontoFilter] = useState<"alle" | KontoArt>("alle");
  const kontoPasst = (t: Transaktion) => kontoFilter === "alle" || kontoVon(t) === kontoFilter;
  const [gespartLauf, setGespartLauf] = useState(0);
  const [phase, setPhase] = useState<"bereit" | "laeuft" | "fertig">("bereit");
  const [reihenfolge, setReihenfolge] = useState<string[]>([]);
  const [aktuell, setAktuell] = useState(-1);
  const [ergebnisse, setErgebnisse] = useState<Record<string, Ergebnis>>({});
  const [manuell, setManuell] = useState<Record<string, string>>({});
  // Handzuordnung zu einer Akte: Buchungsart (Pflichtauswahl, vorbelegt nach Zahler) und Bestätigung „Fremdgeld trotz Mandant“ (I3-T08-01)
  const [artWahl, setArtWahl] = useState<Record<string, AktenBuchungsart>>({});
  const [fremdOk, setFremdOk] = useState<Record<string, boolean>>({});
  // „Korrekturrechnung stellen und Zahlung zuordnen“ (I3-T08-02) – Rückfrage wie beim Stellen
  const [korrekturStellen, setKorrekturStellen] = useState<{ t: Transaktion; entwurfId: string } | null>(null);
  const [letzterLauf, setLetzterLauf] = useState<LaufStand | null>(() => ladeLauf(tenant.id));
  const [erklaerungWahl, setErklaerungWahl] = useState<"auf" | "zu" | null>(ladeErklaerung);
  const erklaerungOffen = erklaerungWahl ? erklaerungWahl === "auf" : !letzterLauf;
  const erklaerungUmschalten = () => {
    const neu = erklaerungOffen ? "zu" : "auf";
    setErklaerungWahl(neu);
    try {
      localStorage.setItem(ERKLAER_KEY, neu);
    } catch {
      /* ohne Speicher: Zustand nur bis zum Neuladen */
    }
  };
  const alive = useRef(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const zeilenRef = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const tById = useMemo(() => new Map(transaktionen.map((t) => [t.id, t])), [transaktionen]);
  const rById = useMemo(() => new Map(rechnungen.map((r) => [r.id, r])), [rechnungen]);
  const sortiert = (ts: Transaktion[]) => [...ts].sort((a, b) => b.datum.localeCompare(a.datum) || b.betrag - a.betrag);
  const offen = useMemo(() => sortiert(transaktionen.filter((t) => t.status === "offen")), [transaktionen]);
  const liste = phase === "bereit" ? offen.map((t) => t.id) : [...reihenfolge, ...offen.map((t) => t.id).filter((id) => !reihenfolge.includes(id))];
  // Reiter „Gebucht“: alle zugeordneten Umsätze – auch nach dem Neuladen, mit Grund, Sicherheit, wer und wann
  const gebuchtListe = useMemo(() => sortiert(transaktionen.filter((t) => t.status !== "offen")), [transaktionen]);
  const offeneRechnungen = useMemo(() => rechnungen.filter(istOffen).sort((a, b) => a.nummer.localeCompare(b.nummer)), [rechnungen]);

  const eingaengeOffen = round2(offen.filter((t) => t.betrag > 0).reduce((s, t) => s + t.betrag, 0));
  const autoGesamt = transaktionen.filter((t) => t.zuordnung?.durch === "auto").length;
  const werte = Object.values(ergebnisse);
  const anz = {
    gebucht: werte.filter((e) => e.zustand === "gebucht").length,
    vorschlag: werte.filter((e) => e.zustand === "vorschlag").length,
    kosten: werte.filter((e) => e.zustand === "kosten").length,
    keine: werte.filter((e) => e.zustand === "keine").length,
    bestaetigt: werte.filter((e) => e.zustand === "bestaetigt" || e.zustand === "manuell").length,
  };

  /**
   * Abgleich: Alle Entscheidungen werden sofort gebucht bzw. als Vorschlag am Umsatz gespeichert – erst danach läuft die
   * Anzeige Umsatz für Umsatz ab. Ein Reiterwechsel oder Neuladen unterbricht so nur die Anzeige, nie die Buchung.
   */
  const starten = async () => {
    const st = useData.getState();
    const offeneT = sortiert(st.data.transaktionen.filter((t) => t.status === "offen"));
    if (!offeneT.length) {
      toast("Keine offenen Kontoumsätze", { text: "Alle Umsätze sind bereits zugeordnet.", ton: "info" });
      return;
    }
    // Lauf beginnt: als „Buchung läuft“ vermerken – nur wenn sie nicht zu Ende kommt, nennt die Statuszeile das Verlassen
    speichereLauf(tenant.id, { am: nowLocal(), gebucht: 0, vorschlaege: 0, kosten: 0, fremd: 0, keine: 0, gespart: 0, angezeigt: false, abgeschlossen: false });
    const treffer = gleicheAb({ transaktionen: offeneT, rechnungen: st.data.rechnungen, akten: st.data.akten, kontakte: st.data.kontakte });
    let gebucht = 0;
    let vorschlaege = 0;
    let kosten = 0;
    let fremd = 0;
    let keine = 0;
    const ergebnisAlle: Record<string, Ergebnis> = {};
    offeneT.forEach((t, i) => {
      const tr = treffer[i];
      let zustand: Zustand;
      if (tr.art === "kosten") {
        bucheTreffer(t, tr, "auto");
        zustand = "kosten";
        kosten++;
      } else if (tr.art === "rechnung" && tr.sicherheit >= AUTO_SCHWELLE) {
        bucheTreffer(t, tr, "auto");
        zustand = "gebucht";
        gebucht++;
      } else if (tr.art === "rechnung" || tr.art === "fremdgeld") {
        // Vorschlag bzw. Fremdgeld (nie automatisch buchen oder weiterleiten) – am Umsatz gespeichert bis zur Entscheidung
        speichereVorschlag(t, tr);
        zustand = "vorschlag";
        if (tr.art === "fremdgeld") fremd++;
        else vorschlaege++;
      } else {
        zustand = "keine";
        keine++;
      }
      ergebnisAlle[t.id] = { ...tr, zustand };
    });
    // Ersparnis je Vorgang: nur automatisch erledigte Umsätze zählen (je Umsatz ca. MIN_JE_UMSATZ Min.); ein Lauf ohne Zuordnung zählt 0
    const vorgaenge = gebucht + kosten;
    const gespart = ersparnisMinuten("bankabgleich", vorgaenge);
    const auto = st.data.automationen.find((a) => a.key === "bankabgleich");
    if (auto) useData.getState().patch("automationen", auto.id, { laeufe: auto.laeufe + vorgaenge, letzterLauf: nowLocal() });
    useData.getState().log({
      akteur: "automation",
      automationKey: "bankabgleich",
      text: `Bankabgleich: ${plural(gebucht, "Zahlung", "Zahlungen")} automatisch gebucht, ${plural(vorschlaege, "Vorschlag", "Vorschläge")} zur Prüfung, ${kosten} Kanzleikosten erfasst${fremd ? `, ${fremd} Fremdgeld markiert` : ""}`,
      ...(gespart ? { minutenGespart: gespart } : {}),
    });
    const stand: LaufStand = { am: nowLocal(), gebucht, vorschlaege, kosten, fremd, keine, gespart, angezeigt: false, abgeschlossen: true };
    speichereLauf(tenant.id, stand);
    setLetzterLauf(stand);
    setGespartLauf(gespart);
    toast("Bankabgleich abgeschlossen", { text: `${gebucht} gebucht · ${plural(vorschlaege, "Vorschlag", "Vorschläge")} · ${kosten} Kanzleikosten${fremd ? ` · ${fremd} Fremdgeld` : ""}`, ton: "erfolg" });

    // Anzeige: Umsatz für Umsatz
    setAnsicht("offen");
    setReihenfolge(offeneT.map((t) => t.id));
    setErgebnisse({});
    setManuell({});
    setPhase("laeuft");
    for (let i = 0; i < offeneT.length; i++) {
      if (!alive.current) break;
      const t = offeneT[i];
      setAktuell(i);
      zeilenRef.current[t.id]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      await sleep(560);
      if (!alive.current) break;
      setErgebnisse((e) => ({ ...e, [t.id]: ergebnisAlle[t.id] }));
      await sleep(300);
    }
    if (alive.current) {
      setAktuell(-1);
      setPhase("fertig");
      const fertig = { ...stand, angezeigt: true };
      speichereLauf(tenant.id, fertig);
      setLetzterLauf(fertig);
    }
  };


  const zahlungsToast = (titel: string, t: Transaktion, nummer: string, erg: ReturnType<typeof bucheTreffer>) =>
    erg && erg.guthaben > 0
      ? toast(`${titel} – mit Überzahlung`, { text: `${fmtEUR(erg.verrechnet)} auf ${nummer} verrechnet · ${fmtEUR(erg.guthaben)} als Guthaben der Mandantschaft im Aktenkonto (erstatten oder verrechnen)`, ton: "warnung" })
      : toast(titel, { text: `${fmtEUR(t.betrag)} auf ${nummer}`, ton: "erfolg" });

  const ablehnen = (t: Transaktion, e: Ergebnis) => {
    lehneVorschlagAb(t, e, user.id);
    setErgebnisse((x) => ({ ...x, [t.id]: { ...e, zustand: "abgelehnt" } }));
    toast("Vorschlag abgelehnt", { text: "Wird bei künftigen Abgleichen nicht erneut vorgeschlagen – jetzt von Hand zuordnen oder offen lassen.", ton: "info" });
  };

  const bestaetigen = (t: Transaktion, e: Ergebnis) => {
    const erg = bucheTreffer(t, e, "manuell", user.id);
    setErgebnisse((x) => ({ ...x, [t.id]: { ...e, zustand: "bestaetigt" } }));
    if (e.art === "fremdgeld") {
      const a = e.akteId ? akten.get(e.akteId) : undefined;
      toast("Als Fremdgeld gebucht", {
        // Text nach dem tatsächlichen Konto des Umsatzes (I4-T08-01)
        text: fremdgeldMeldung(t.betrag, kontoVon(t), a?.aktenzeichen),
        ton: "warnung",
        aktion: { label: "Fremdgeld-Wächter", onClick: zumWaechter },
      });
      return;
    }
    const r = e.rechnungId ? rById.get(e.rechnungId) : undefined;
    zahlungsToast("Zahlung gebucht", t, r?.nummer ?? "Rechnung", erg);
  };

  const zumWaechter = () => {
    nav("/abrechnung?tab=uebersicht");
    window.setTimeout(() => document.getElementById("fremdgeld-waechter")?.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
  };

  const zuordnungLoesen = async (t: Transaktion) => {
    const z = t.zuordnung;
    const r = z?.rechnungId ? rById.get(z.rechnungId) : undefined;
    const ok = await confirmDialog({
      titel: "Zuordnung lösen?",
      text: r
        ? `Die Zahlung über ${fmtEUR(t.betrag)} auf ${r.nummer} wird im Aktenkonto gegengebucht, die Rechnung ist wieder offen und der Umsatz erscheint wieder unter „Offen“. Der Vorgang wird protokolliert.`
        : `Der Umsatz über ${fmtEUR(Math.abs(t.betrag))} erscheint wieder unter „Offen“${t.status === "ignoriert" ? "" : "; ein gebuchter Fremdgeld-Eingang wird storniert"}. Der Vorgang wird protokolliert.`,
      bestaetigen: "Zuordnung lösen",
      gefahr: true,
    });
    if (!ok) return;
    const text = loeseZuordnung(t, user.id);
    setErgebnisse((e) => {
      const n = { ...e };
      delete n[t.id];
      return n;
    });
    toast("Zuordnung gelöst", { text, ton: "info" });
  };

  /** Vorbelegung der Buchungsart nach Zahler (Mandant → Honorar/Vorschuss, Dritter → Fremdgeld). */
  const artVorschlag = (t: Transaktion, a: NonNullable<ReturnType<typeof akten.get>>) =>
    buchungsartVorschlag(t, a, kontakte, mandantenIbans(a.mandantId, transaktionen, rechnungen, [...akten.values()]));

  /** Verwendungszweck nennt eine stornierte Rechnung? (I3-T08-02) */
  const stornoInfo = (t: Transaktion) => stornierteRechnungImZweck(t, rechnungen);

  /** Vorbelegte Wahl im Feld „Zuordnen zu …“: gestellte Korrektur → diese Rechnung; stornierte Rechnung ohne gestellte
   *  Korrektur (keine oder nur ein Entwurf) → Akte der Rechnung mit Buchungsart Honorar/Vorschuss (I3-T08-02). */
  const vorbelegteWahl = (t: Transaktion): string => {
    const s0 = stornoInfo(t);
    if (!s0 || t.betrag <= 0) return "";
    if (s0.korrektur && istOffen(s0.korrektur)) return s0.korrektur.id;
    if (!s0.korrektur || s0.korrektur.status === "entwurf") return `akte:${s0.storniert.akteId}`;
    return "";
  };

  /** Korrekturentwurf stellen (nach Rückfrage) und den Umsatz der neuen Rechnung zuordnen. */
  const korrekturStellenUndZuordnen = (t: Transaktion, entwurfId: string) => {
    const entwurf = rById.get(entwurfId);
    if (!entwurf || entwurf.status !== "entwurf") return;
    const g = stelleRechnung(entwurf, user.id);
    const a = akten.get(g.akteId);
    useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: g.akteId, text: `${belegArt(g)} ${g.nummer} gestellt (Korrektur aus dem Bankabgleich) – ${a?.aktenzeichen ?? ""}`.trim() });
    const ueber = round2(t.betrag - g.brutto);
    const tr: Treffer = { transaktionId: t.id, art: "rechnung", regel: "keine", sicherheit: 1, grund: `Manuell zugeordnet – Korrekturrechnung ${g.nummer} gestellt`, rechnungId: g.id, akteId: g.akteId, ...(ueber > 0.004 ? { ueberzahlung: ueber } : {}) };
    const erg = bucheTreffer(t, tr, "manuell", user.id);
    setErgebnisse((e) => ({ ...e, [t.id]: { ...tr, zustand: "manuell" } }));
    zahlungsToast(`${g.nummer} gestellt und Zahlung zugeordnet`, t, g.nummer, erg);
  };

  /** Handzuordnung – ohne Lauf: Rechnung (Zahlungseingang), Akte (Honorar/Vorschuss oder Fremdgeld) oder Kanzleikosten (Ausgang). */
  const zuordnen = (t: Transaktion) => {
    const wahl = manuell[t.id] ?? vorbelegteWahl(t);
    if (wahl.startsWith("akte:")) {
      const akteId = wahl.slice(5);
      const a = akten.get(akteId);
      if (!a) return;
      const vorschlag = artVorschlag(t, a);
      const art = artWahl[t.id] ?? vorschlag.art;
      // Fremdgeld trotz Zahlung des Mandanten selbst nur mit Bestätigung
      if (art === "fremdgeld" && vorschlag.zahlerIstMandant && !fremdOk[t.id]) return;
      const tr: Treffer =
        art === "vorschuss"
          ? { transaktionId: t.id, art: "vorschuss", regel: "keine", sicherheit: 1, grund: `Manuell zugeordnet: ${AKTEN_BUCHUNGSART.vorschuss}`, akteId }
          : { transaktionId: t.id, art: "fremdgeld", regel: "fremdgeld", sicherheit: 1, grund: `Manuell als Fremdgeld zugeordnet${vorschlag.zahlerIstMandant ? " – Zahlung des Mandanten selbst, bewusst bestätigt" : ""}`, akteId };
      bucheTreffer(t, tr, "manuell", user.id);
      setErgebnisse((e) => ({ ...e, [t.id]: { ...tr, zustand: "bestaetigt" } }));
      if (art === "vorschuss") toast(`Als ${AKTEN_BUCHUNGSART_KURZ.vorschuss} gebucht`, { text: `${fmtEUR(t.betrag)} · ${a.aktenzeichen} – Guthaben im Aktenkonto, kein Fremdgeld`, ton: "erfolg" });
      else toast("Als Fremdgeld gebucht", { text: fremdgeldMeldung(t.betrag, kontoVon(t), a.aktenzeichen), ton: "warnung", aktion: { label: "Fremdgeld-Wächter", onClick: zumWaechter } });
      return;
    }
    if (wahl === "kosten") {
      const tr: Treffer = { transaktionId: t.id, art: "kosten", regel: "kosten", sicherheit: 1, grund: "Manuell als Kanzleikosten erfasst", kategorie: "Kanzleikosten" };
      bucheTreffer(t, tr, "manuell", user.id);
      setErgebnisse((e) => ({ ...e, [t.id]: { ...tr, zustand: "kosten" } }));
      toast("Als Kanzleikosten erfasst", { text: `${fmtEUR(t.betrag)} · ${t.gegenpartei}`, ton: "erfolg" });
      return;
    }
    const r = wahl ? rById.get(wahl) : undefined;
    if (!r) return;
    const ueber = round2(t.betrag - offenerBetrag(r));
    const tr: Treffer = {
      transaktionId: t.id,
      art: "rechnung",
      regel: "keine",
      sicherheit: 1,
      grund: "Manuell zugeordnet",
      rechnungId: r.id,
      akteId: r.akteId,
      ...(ueber > 0.004 ? { ueberzahlung: ueber } : {}),
    };
    const erg = bucheTreffer(t, tr, "manuell", user.id);
    setErgebnisse((e) => ({ ...e, [t.id]: { ...tr, zustand: "manuell" } }));
    zahlungsToast("Zahlung zugeordnet", t, r.nummer, erg);
  };

  const importieren = (f: File | undefined) => {
    if (!f) return;
    toast(`Kontoauszug „${f.name}“ ausgewählt`, { text: "In dieser Demo werden Beispielumsätze verwendet – die Datei wird nicht eingelesen.", ton: "info" });
    if (fileRef.current) fileRef.current.value = "";
  };

  /** Ergebnis eines Umsatzes: aus dem laufenden Abgleich, sonst aus dem am Umsatz gespeicherten Vorschlag bzw. der Ablehnung. */
  const ergebnisVon = (t: Transaktion): Ergebnis | undefined => {
    const lokal = ergebnisse[t.id];
    if (lokal) return lokal;
    if (phase === "laeuft" && reihenfolge.includes(t.id)) return undefined;
    const v = trefferAusVorschlag(t);
    if (v) return { ...v, zustand: "vorschlag" };
    if (t.status === "offen" && t.abgelehnt?.length) return { transaktionId: t.id, art: "keine", regel: "keine", sicherheit: 0, grund: "Vorschlag abgelehnt", zustand: "abgelehnt" };
    return undefined;
  };

  const zielInhalt = (t: Transaktion, e: Ergebnis | undefined, idx: number) => {
    const scannt = phase === "laeuft" && idx === aktuell;
    const wartet = phase === "laeuft" && idx > aktuell && !e;
    if (wartet)
      return <div className="flex min-h-[76px] items-center rounded-[18px] border border-dashed border-[var(--line)] px-3.5 text-[12.5px] text-fg-3">wartet …</div>;
    if (scannt)
      return (
        <Ziel gestrichelt>
          <div className="min-w-0 flex-1">
            <div className="shimmer h-3 w-2/3 rounded-full" />
            <div className="mt-2 text-[12px] text-fg-3">Prüfe Rechnungsnummer, Aktenzeichen, Zahler und Betrag …</div>
          </div>
        </Ziel>
      );
    if (!e) {
      if (t.status !== "offen") return historieZiel(t);
      return handZiel(t, "Noch nicht abgeglichen – von Hand zuordnen oder Abgleich starten");
    }
    if (e.art === "kosten")
      return (
        <Ziel>
          <div className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-[var(--line)] text-fg-2">
            <Building2 className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium">Kanzleikosten (keine Rechnung)</div>
            <div className="mt-0.5 text-[12.5px] text-fg-3">automatisch erfasst</div>
            <div className="mt-1">
              <Chip>{e.kategorie}</Chip>
            </div>
          </div>
        </Ziel>
      );
    if (e.art === "vorschuss") {
      const va = e.akteId ? akten.get(e.akteId) : undefined;
      return (
        <Ziel ton="green">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-green-soft text-green">
            <Wallet className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Chip tone="green" icon={<Check className="size-3" />}>
                {AKTEN_BUCHUNGSART_KURZ.vorschuss} – {user.name}
              </Chip>
            </div>
            <AkteLabel akte={va} className="mt-0.5 text-[12.5px]" />
            <div className="mt-0.5 break-words text-[12.5px] text-fg-3">Guthaben der Mandantschaft im Aktenkonto – kein Fremdgeld, keine Weiterleitung.</div>
          </div>
        </Ziel>
      );
    }
    if (e.art === "fremdgeld" && e.zustand !== "abgelehnt") {
      const fa = e.akteId ? akten.get(e.akteId) : undefined;
      const gebucht = e.zustand === "bestaetigt";
      return (
        <Ziel ton="amber">
          <div className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-amber-soft text-amber">
            <HandCoins className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Chip tone="amber">Fremdgeld</Chip>
              {gebucht ? <Chip tone="ink" icon={<Check className="size-3" />}>Eingang gebucht – weiterleiten</Chip> : <Chip tone="outline">Vorschlag</Chip>}
            </div>
            <AkteLabel akte={fa} className="mt-0.5 text-[12.5px]" />
            <div className="mt-0.5 break-words text-[12.5px] text-fg-3">{e.grund}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {!gebucht && (
                <>
                  <Button size="sm" variant="primary" icon={<Check className="size-4" />} onClick={() => bestaetigen(t, e)}>
                    Als Fremdgeld buchen
                  </Button>
                  <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={() => ablehnen(t, e)}>
                    Ablehnen
                  </Button>
                </>
              )}
              <Button size="sm" variant="secondary" iconRight={<ArrowRight className="size-4" />} onClick={zumWaechter}>
                Fremdgeld-Wächter
              </Button>
            </div>
          </div>
        </Ziel>
      );
    }
    const r = e.rechnungId ? rById.get(e.rechnungId) : undefined;
    const akte = r ? akten.get(r.akteId) : undefined;
    if (e.art === "rechnung" && r && e.zustand !== "abgelehnt") {
      const ton = tonVon(e.zustand);
      const farbe = ton === "green" ? "var(--green)" : "var(--amber)";
      // Menschliche Entscheidung: kein Prozentring, sondern ein Haken
      const mensch = e.zustand === "bestaetigt" || e.zustand === "manuell";
      return (
        <Ziel ton={ton}>
          {mensch ? (
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-green-soft text-green">
              <Check className="size-5" strokeWidth={2.5} />
            </span>
          ) : (
            <ProgressRing value={e.sicherheit} size={44} stroke={4} color={farbe}>
              <span className="num text-[11px] font-semibold">{Math.round(e.sicherheit * 100)}%</span>
            </ProgressRing>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="mono text-[12.5px] font-semibold">{r.nummer}</span>
              {e.zustand === "gebucht" && (
                <Chip tone="green" icon={<Check className="size-3" />}>
                  Automatisch gebucht
                </Chip>
              )}
              {mensch && (
                <Chip tone="green" icon={<Check className="size-3" />}>
                  {e.zustand === "manuell" ? `manuell – ${user.name}` : `bestätigt – ${user.name}`}
                </Chip>
              )}
              {e.zustand === "bestaetigt" && e.sicherheit < 1 && <span className="text-[12.5px] text-fg-3">Vorschlag war {Math.round(e.sicherheit * 100)} %</span>}
              {e.zustand === "vorschlag" && <Chip tone="amber">Vorschlag</Chip>}
              {e.teilzahlung && <Chip tone="outline">Teilzahlung</Chip>}
              {e.ueberzahlung && <Chip tone="amber">Überzahlung {fmtEUR(e.ueberzahlung)}</Chip>}
            </div>
            <AkteLabel akte={akte} className="mt-0.5 text-[12.5px]" />
            <div className="mt-0.5 break-words text-[12.5px] text-fg-3">{e.grund}</div>
            {e.zustand === "vorschlag" && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="primary" icon={<Check className="size-4" />} onClick={() => bestaetigen(t, e)}>
                  Bestätigen
                </Button>
                <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={() => ablehnen(t, e)}>
                  Ablehnen
                </Button>
              </div>
            )}
          </div>
        </Ziel>
      );
    }
    // keine Zuordnung / abgelehnt → manuell zuordnen
    return handZiel(t, e.zustand === "abgelehnt" ? "Vorschlag abgelehnt – von Hand zuordnen" : "Keine passende Rechnung – von Hand zuordnen");
  };

  /** Handzuordnung: Rechnung (Eingang), Akte mit Buchungsart (Eingang) oder Kanzleikosten (Ausgang) – in zwei Schritten. */
  const handZiel = (t: Transaktion, titel: string) => {
    const wahl = manuell[t.id] ?? vorbelegteWahl(t);
    const gewaehlt = wahl && !wahl.startsWith("akte:") && wahl !== "kosten" ? rById.get(wahl) : undefined;
    const mehr = gewaehlt ? round2(t.betrag - offenerBetrag(gewaehlt)) : 0;
    const selId = `zuordnen-${t.id}`;
    const zielAkte = wahl.startsWith("akte:") ? akten.get(wahl.slice(5)) : undefined;
    const vorschlag = zielAkte ? artVorschlag(t, zielAkte) : undefined;
    const art = zielAkte ? (artWahl[t.id] ?? vorschlag!.art) : undefined;
    const fremdTrotzMandant = art === "fremdgeld" && !!vorschlag?.zahlerIstMandant;
    const gesperrt = !wahl || (fremdTrotzMandant && !fremdOk[t.id]);
    const storno = stornoInfo(t);
    return (
      <Ziel gestrichelt>
        <div className="min-w-0 flex-1">
          {storno && (
            <div role="note" className="mb-2 rounded-[12px] bg-amber-soft px-3 py-2 text-[12.5px] leading-snug text-fg-2">
              <div className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber" aria-hidden />
                <span>
                  <span className="mono font-semibold text-fg">{storno.storniert.nummer}</span> ist storniert
                  {storno.storniert.stornoNummer ? (
                    <>
                      {" "}
                      (Storno <span className="mono">{storno.storniert.stornoNummer}</span>)
                    </>
                  ) : null}
                  {storno.korrektur
                    ? storno.korrektur.status === "entwurf"
                      ? ` – Korrekturentwurf ${storno.korrektur.nummer} offen`
                      : ` – Korrekturrechnung ${storno.korrektur.nummer}`
                    : ` – kein Korrekturentwurf; vorbelegt: ${AKTEN_BUCHUNGSART_KURZ.vorschuss} auf Akte ${akten.get(storno.storniert.akteId)?.aktenzeichen ?? ""}`}
                </span>
              </div>
              {storno.korrektur?.status === "entwurf" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="primary" icon={<Send className="size-4" />} onClick={() => setKorrekturStellen({ t, entwurfId: storno.korrektur!.id })}>
                    Korrekturrechnung stellen und Zahlung zuordnen
                  </Button>
                  <Button size="sm" variant="ghost" icon={<FilePenLine className="size-4" />} onClick={() => useAbrechnungUI.getState().oeffneRechnung(storno.korrektur!.id)}>
                    Entwurf öffnen
                  </Button>
                </div>
              )}
            </div>
          )}
          <label htmlFor={selId} className="text-[13px] font-medium">
            {titel}
          </label>
          {gewaehlt && mehr > 0.004 && (
            <p className="mt-1 text-[12.5px] leading-snug text-amber">
              Der Umsatz übersteigt den offenen Rest von {gewaehlt.nummer} um {fmtEUR(mehr)} – der Mehrbetrag wird als Guthaben der Mandantschaft gebucht.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Select
              id={selId}
              value={wahl}
              onChange={(ev) => {
                const v = ev.target.value;
                setManuell((m) => ({ ...m, [t.id]: v }));
                // Neue Akte → Buchungsart wieder nach Zahler vorbelegen
                setArtWahl((x) => {
                  const n = { ...x };
                  delete n[t.id];
                  return n;
                });
                setFremdOk((x) => ({ ...x, [t.id]: false }));
              }}
              className="!h-9 min-w-0 flex-1 !rounded-[10px] !text-[12.5px]"
            >
              <option value="">Zuordnen zu …</option>
              {t.betrag > 0 && (
                <optgroup label="Offene Rechnungen">
                  {offeneRechnungen.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nummer} · {fmtEUR(offenerBetrag(x))} · {kontakte.get(x.empfaengerId)?.name ?? ""}
                    </option>
                  ))}
                </optgroup>
              )}
              {t.betrag > 0 && (
                <optgroup label="Akte (Buchungsart wählen)">
                  {[...akten.values()]
                    .filter((a) => a.status === "offen")
                    .sort((a, b) => b.aktenzeichen.localeCompare(a.aktenzeichen, "de", { numeric: true }))
                    .map((a) => (
                      <option key={a.id} value={`akte:${a.id}`}>
                        {a.aktenzeichen} · {a.titel}
                      </option>
                    ))}
                </optgroup>
              )}
              {t.betrag < 0 && <option value="kosten">Kanzleikosten (ohne Rechnung)</option>}
            </Select>
            <Button size="sm" variant="secondary" className="!h-9" disabled={gesperrt} onClick={() => zuordnen(t)}>
              Zuordnen
            </Button>
          </div>
          {zielAkte && vorschlag && art && (
            <fieldset className="mt-2.5 grid gap-1">
              <legend className="mb-1 text-[12.5px] font-semibold text-fg-2">Buchungsart (Pflicht)</legend>
              {(["vorschuss", "fremdgeld"] as const).map((k) => (
                <label key={k} className="flex min-h-9 cursor-pointer items-start gap-2 text-[12.5px] leading-snug">
                  <input
                    type="radio"
                    name={`buchungsart-${t.id}`}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--ink)]"
                    checked={art === k}
                    onChange={() => {
                      setArtWahl((x) => ({ ...x, [t.id]: k }));
                      setFremdOk((x) => ({ ...x, [t.id]: false }));
                    }}
                  />
                  <span>
                    {AKTEN_BUCHUNGSART[k]}
                    {vorschlag.art === k && <span className="text-fg-3"> · vorgeschlagen</span>}
                  </span>
                </label>
              ))}
              <p className="text-[12px] text-fg-3">{vorschlag.grund}.</p>
              {fremdTrotzMandant && (
                <div role="alert" className="mt-1 rounded-[12px] bg-amber-soft px-3 py-2 text-[12.5px] leading-snug text-fg-2">
                  <div className="flex items-start gap-1.5 font-semibold text-fg">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber" aria-hidden />
                    Zahlung des Mandanten selbst – in der Regel kein Fremdgeld
                  </div>
                  <label className="mt-1.5 flex min-h-9 items-start gap-2">
                    <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--amber)]" checked={!!fremdOk[t.id]} onChange={(ev) => setFremdOk((x) => ({ ...x, [t.id]: ev.target.checked }))} />
                    <span>Trotzdem als Fremdgeld buchen – das Geld ist für die Mandantschaft bestimmt und wird weitergeleitet</span>
                  </label>
                </div>
              )}
            </fieldset>
          )}
        </div>
      </Ziel>
    );
  };

  /** Gebuchter Umsatz: Ziel, Grund, Sicherheit, automatisch/manuell, wer und wann – mit „Zuordnung lösen“. */
  const historieZiel = (t: Transaktion) => {
    const z = t.zuordnung;
    const r = z?.rechnungId ? rById.get(z.rechnungId) : undefined;
    const a = z?.akteId ? akten.get(z.akteId) : r ? akten.get(r.akteId) : undefined;
    // Wer und wann: aus der Zuordnung selbst (seit Iteration 1 gespeichert), sonst aus dem Protokoll
    const log = z?.am ? undefined : zuordnungsProtokoll(aktivitaeten, t);
    const zeit = z?.am ?? log?.zeit;
    const vonId = z?.am ? z.von : log?.userId;
    const automatisch = z?.am ? z.durch === "auto" : log?.akteur === "automation";
    const wer = zeit ? (vonId ? users.get(vonId)?.name ?? "Nutzer" : automatisch ? "38h-Motor (automatisch)" : "System") : undefined;
    const art = z?.art ?? (r ? "rechnung" : t.status === "ignoriert" ? "kosten" : "fremdgeld");
    const fremd = !r && t.status === "zugeordnet" && art === "fremdgeld";
    const vorschussArt = !r && art === "vorschuss";
    return (
      <div className="flex min-h-[64px] min-w-0 items-start gap-3 rounded-[18px] border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5">
        {t.status === "ignoriert" ? (
          <Building2 className="mt-0.5 size-4 shrink-0 text-fg-3" />
        ) : fremd ? (
          <HandCoins className="mt-0.5 size-4 shrink-0 text-amber" />
        ) : vorschussArt ? (
          <Wallet className="mt-0.5 size-4 shrink-0 text-green" />
        ) : (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium">
              {t.status === "ignoriert" ? "Kanzleikosten" : fremd ? AKTEN_BUCHUNGSART_KURZ.fremdgeld : vorschussArt ? `${AKTEN_BUCHUNGSART_KURZ.vorschuss} (Aktenkonto)` : <span className="mono">{r?.nummer ?? "Rechnung"}</span>}
            </span>
            {r && <Chip tone="outline">Rechnungszahlung</Chip>}
            {z &&
              (z.durch === "auto" ? (
                <Chip tone="ink">{Math.round(z.sicherheit * 100)} % · automatisch</Chip>
              ) : (
                <Chip tone="green" icon={<Check className="size-3" />}>
                  manuell{wer && wer !== "System" ? ` – ${wer}` : ""}
                  {zeit ? `, ${fmtTime(zeit)} Uhr` : ""}
                </Chip>
              ))}
            {z && z.durch === "manuell" && z.sicherheit < 1 && <span className="text-[12.5px] text-fg-3">Vorschlag war {Math.round(z.sicherheit * 100)} %</span>}
          </div>
          {a && <AkteLabel akte={a} className="mt-0.5 text-[12.5px]" />}
          <div className="mt-0.5 break-words text-[12.5px] text-fg-3">{z?.grund ?? "Ohne Rechnungsbezug"}</div>
          <div className="mt-0.5 text-[12.5px] text-fg-3">
            {zeit ? `${wer} · ${fmtDate(zeit.slice(0, 10))}, ${fmtTime(zeit)} Uhr` : "Beispieldaten – Zuordnung vor Beginn des Protokolls"}
          </div>
          <Button size="sm" variant="ghost" icon={<Unlink className="size-4" />} className="mt-1 !px-2" onClick={() => void zuordnungLoesen(t)}>
            Zuordnung lösen
          </Button>
        </div>
      </div>
    );
  };

  const umsatzKarte = (t: Transaktion, scannt: boolean) => (
    <div className={cn("relative flex min-h-[76px] min-w-0 items-center gap-3 overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3", scannt && "ai-ring")}>
      {scannt && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-[var(--ink-soft)] to-transparent"
          initial={{ left: "-35%" }}
          animate={{ left: "105%" }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <div className="w-[52px] shrink-0 text-center">
        <div className="num text-[12px] font-semibold text-fg-2">{fmtDateShort(t.datum)}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="break-words text-[13.5px] font-medium">{t.gegenpartei}</div>
        <div className="mono break-words text-[12px] text-fg-3">{t.verwendungszweck}</div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className={cn("num text-right text-[14px] font-semibold", t.betrag > 0 ? "text-green" : "text-fg-2")}>
          {t.betrag > 0 ? "+" : "−"}
          {fmtEUR(Math.abs(t.betrag))}
        </div>
        <KontoChip konto={kontoVon(t)} />
      </div>
    </div>
  );

  return (
    <>
      <TabKopf
        icon={<Landmark className="size-[18px]" />}
        titel="Bankabgleich"
        plakette={<Chip tone="amber" title="In dieser Demo stammen die Kontoumsätze aus Beispieldaten – kein echtes Bankkonto angebunden.">Beispielumsätze (simuliert)</Chip>}
        text="Kontoumsätze werden automatisch Rechnungen zugeordnet – sichere Treffer bucht AnwaltApex selbst, unsichere legt es Ihnen zur Bestätigung vor. Jede Buchung lässt sich unter „Gebucht“ lösen."
        aktionen={
          <>
            <input ref={fileRef} type="file" accept=".xml,.sta,.mt940,.csv" className="hidden" onChange={(e) => importieren(e.target.files?.[0])} />
            <Button variant="secondary" icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>
              Kontoauszug importieren
            </Button>
            <Button variant="ai" icon={<Sparkles className="size-4" />} loading={phase === "laeuft"} onClick={starten} disabled={phase === "laeuft"}>
              {phase === "laeuft" ? "Gleiche ab …" : "Abgleich starten"}
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid grid-cols-1 min-w-0 gap-3">
          {/* Kennzahlen kompakt in einer Zeile – die offenen Umsätze stehen im ersten Bildschirm (I3-T08-03) */}
          <div className="sheet grid grid-cols-3 gap-x-3 gap-y-2 rounded-[18px] px-4 py-2.5 min-[480px]:gap-x-4" role="group" aria-label="Kennzahlen Bankabgleich">
            {[
              { icon: <Clock className="size-4" />, cls: "bg-amber-soft text-amber", wert: <AnimatedNumber value={offen.length} />, label: "offene Umsätze", sub: "warten auf Zuordnung" },
              { icon: <Landmark className="size-4" />, cls: "bg-ink-soft text-ink", wert: <AnimatedNumber value={eingaengeOffen} format={(n) => fmtEUR(n, { cents: false })} />, label: "offene Eingänge", sub: "Zahlungseingänge" },
              { icon: <Link2 className="size-4" />, cls: "bg-green-soft text-green", wert: <AnimatedNumber value={autoGesamt} />, label: "automatisch zugeordnet", sub: "Umsätze insgesamt" },
            ].map((k) => (
              <div key={k.label} className="flex min-w-0 items-center gap-2.5" title={k.sub}>
                {/* Handy: drei schmale Spalten ohne Symbol – die Kennzahlen kosten nur eine Zeile */}
                <span className={cn("hidden size-8 shrink-0 place-items-center rounded-[10px] min-[480px]:grid", k.cls)}>{k.icon}</span>
                <span className="min-w-0">
                  <span className="num block text-[18px] font-semibold leading-tight tracking-[-0.02em]">{k.wert}</span>
                  <span className="block text-[12px] leading-tight text-fg-3 min-[480px]:text-[12.5px]">{k.label}</span>
                </span>
              </div>
            ))}
          </div>

          {phase === "bereit" && letzterLauf && (
            <div role="status" className="flex flex-wrap items-start gap-2.5 rounded-[16px] bg-ink-softer px-4 py-2.5 text-[12.5px] leading-relaxed text-fg-2 ring-1 ring-inset ring-[var(--line)]">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green" aria-hidden />
              <span className="min-w-0 flex-1">
                {/* „Verlassen“ nur, wenn die Buchung selbst noch lief – nicht, wenn nur die Anzeige noch lief (I5-T08-01, I4-T08-02) */}
                {letzterLauf.abgeschlossen === false ? (
                  <>
                    <strong className="font-semibold text-fg">
                      Abgleich vom {fmtDate(letzterLauf.am.slice(0, 10))}, {fmtTime(letzterLauf.am)} Uhr nicht abgeschlossen.
                    </strong>{" "}
                    Sie haben die Seite während des Abgleichs verlassen – die bis dahin gebuchten Umsätze und Vorschläge sind gespeichert; offene Umsätze gleicht ein neuer Lauf ab.
                  </>
                ) : (
                  <>
                    <strong className="font-semibold text-fg">
                      Abgleich abgeschlossen am {fmtDate(letzterLauf.am.slice(0, 10))}, {fmtTime(letzterLauf.am)} Uhr
                    </strong>{" "}
                    – {letzterLauf.gebucht} gebucht · {plural(letzterLauf.vorschlaege, "Vorschlag", "Vorschläge")} · {letzterLauf.kosten} Kanzleikosten
                    {letzterLauf.fremd ? ` · ${letzterLauf.fremd} Fremdgeld` : ""}.
                    {letzterLauf.vorschlaege + letzterLauf.fremd > 0 ? " Offene Vorschläge stehen unten bis zu Ihrer Entscheidung." : ""}
                  </>
                )}
                {letzterLauf.gespart > 0 && (
                  <span className="mt-1 block">
                    <GespartSchaetzung minuten={letzterLauf.gespart} />
                  </span>
                )}
              </span>
            </div>
          )}

          <AnimatePresence>
            {phase === "fertig" && (
              <motion.div initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 32 }}>
                <div role="status" className="sheet flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[18px] px-4 py-3">
                  <motion.div
                    initial={{ scale: 0.4 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 520, damping: 18 }}
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-green-soft text-green"
                  >
                    <CheckCircle2 className="size-5" />
                  </motion.div>
                  <div className="min-w-0 flex-1 basis-[260px]">
                    <div className="text-[14px] font-semibold">Abgleich abgeschlossen</div>
                    <div className="text-[12.5px] text-fg-2">
                      <span className="font-semibold text-green">{anz.gebucht + anz.bestaetigt} gebucht</span>
                      {anz.bestaetigt ? ` (davon ${anz.bestaetigt} bestätigt)` : " automatisch"} · <span className="font-semibold text-amber">{plural(anz.vorschlag, "Vorschlag", "Vorschläge")}</span> warten auf Sie ·{" "}
                      {anz.kosten} Kanzleikosten
                      {anz.keine > 0 ? (
                        <>
                          {" "}
                          · <span className="font-semibold text-seal">{anz.keine} ohne Zuordnung</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <GespartSchaetzung minuten={gespartLauf} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {ansicht === "gebucht" ? (
            <Card padded={false} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-2.5">
                <Segmented
                  size="sm"
                  value={ansicht}
                  onChange={setAnsicht}
                  options={[
                    { value: "offen", label: "Offen", count: offen.length },
                    { value: "gebucht", label: "Gebucht", count: gebuchtListe.length },
                  ]}
                />
                <KontoFilter value={kontoFilter} onChange={setKontoFilter} umsaetze={gebuchtListe} />
                <div className="text-[12.5px] text-fg-3">Gebuchte Umsätze mit Grund, Art, wer und wann – jede Zuordnung lässt sich lösen</div>
              </div>
              {gebuchtListe.length === 0 ? (
                <p className="px-4 py-10 text-center text-[13px] text-fg-3">Noch keine zugeordneten Umsätze.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-2 p-3">
                  {gebuchtListe.filter(kontoPasst).map((t) => (
                    <li key={t.id} className="grid items-stretch gap-1 2xl:grid-cols-[minmax(0,1.1fr)_64px_minmax(0,1fr)] 2xl:gap-0">
                      {umsatzKarte(t, false)}
                      <Verbinder ton={t.status === "ignoriert" ? "neutral" : "green"} sichtbar scannt={false} />
                      {historieZiel(t)}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : (
          <Card padded={false} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-2.5">
              <Segmented
                  size="sm"
                  value={ansicht}
                  onChange={setAnsicht}
                  options={[
                    { value: "offen", label: "Offen", count: offen.length },
                    { value: "gebucht", label: "Gebucht", count: gebuchtListe.length },
                  ]}
                />
              <KontoFilter value={kontoFilter} onChange={setKontoFilter} umsaetze={liste.map((id) => tById.get(id)).filter((t): t is Transaktion => !!t)} />
              <div className="text-[12.5px] text-fg-3">{phase === "bereit" ? "Offene Kontoumsätze" : "Ergebnis des Abgleichs"}<span className="hidden md:inline"> · Umsatz → zugeordnete Rechnung</span></div>
            </div>
            {liste.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <div className="grid size-12 place-items-center rounded-[16px] bg-green-soft text-green">
                  <CheckCircle2 className="size-6" />
                </div>
                <div className="title-md mt-3">Alle Umsätze zugeordnet</div>
                <p className="mt-1 max-w-sm text-[12.5px] text-fg-3">Neue Kontoumsätze erscheinen hier automatisch und werden stündlich abgeglichen.</p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-2 p-3">
                {liste.map((id, idx) => {
                  const t = tById.get(id);
                  if (!t || !kontoPasst(t)) return null;
                  const e = ergebnisVon(t);
                  const scannt = phase === "laeuft" && idx === aktuell;
                  return (
                    <motion.li
                      key={id}
                      ref={(el) => {
                        zeilenRef.current[id] = el;
                      }}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: phase === "laeuft" && idx > aktuell && !e ? 0.6 : 1, y: 0 }}
                      transition={{ delay: phase === "bereit" ? Math.min(idx, 10) * 0.03 : 0 }}
                      className="grid items-stretch gap-1 2xl:grid-cols-[minmax(0,1.1fr)_64px_minmax(0,1fr)] 2xl:gap-0"
                    >
                      {umsatzKarte(t, scannt)}
                      <div className={cn(!e && !scannt && phase !== "laeuft" && t.status === "offen" && "hidden 2xl:block")}>
                        <Verbinder ton={tonVon(e?.zustand)} sichtbar={!!e} scannt={scannt} />
                      </div>
                      {zielInhalt(t, e, idx)}
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </Card>

          )}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:sticky xl:top-7">
          <Card>
            <button type="button" onClick={erklaerungUmschalten} aria-expanded={erklaerungOffen} aria-controls="bank-erklaerung" className="-m-1 flex w-[calc(100%+8px)] items-start gap-3 rounded-[16px] p-1 text-left">
              <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">
                <ShieldCheck className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="title-md block">Wie sicher ist die Zuordnung?</span>
                <span className="mt-0.5 block text-[12.5px] text-fg-3">Ab {Math.round(AUTO_SCHWELLE * 100)} % bucht AnwaltApex selbst – darunter entscheiden Sie.</span>
              </span>
              <ChevronDown className={cn("mt-2 size-4 shrink-0 text-fg-3 transition-transform duration-300", erklaerungOffen && "rotate-180")} aria-hidden />
            </button>
            {erklaerungOffen && (
            <div id="bank-erklaerung" className="mt-4">
            <ul className="grid grid-cols-1 gap-3">
              {REGELN.map((r) => (
                <li key={r.regel} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "num mt-0.5 grid h-6 w-11 shrink-0 place-items-center rounded-full text-[12px] font-semibold",
                      r.folge === "auto" ? "bg-green-soft text-green" : r.folge === "vorschlag" ? "bg-amber-soft text-amber" : "bg-[var(--line)] text-fg-2",
                    )}
                  >
                    {r.sicherheit ? `${Math.round(r.sicherheit * 100)} %` : "–"}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium">{r.titel}</div>
                    <div className="text-[12.5px] leading-snug text-fg-3">{r.text}</div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-[var(--line)] pt-3">
              <Chip tone="green">automatisch gebucht</Chip>
              <Chip tone="amber">Vorschlag zur Bestätigung</Chip>
              <Chip>Kanzleikosten</Chip>
              <Chip tone="amber">Fremdgeld</Chip>
            </div>
            </div>
            )}
          </Card>
          <StellenDialog
            open={!!korrekturStellen}
            anzahl={1}
            onClose={() => setKorrekturStellen(null)}
            onStellen={() => {
              const k = korrekturStellen;
              setKorrekturStellen(null);
              if (k) korrekturStellenUndZuordnen(k.t, k.entwurfId);
            }}
            zusatz={korrekturStellen ? `Danach wird der Umsatz ${fmtEUR(korrekturStellen.t.betrag)} (${korrekturStellen.t.gegenpartei}) der neuen Rechnung zugeordnet.` : undefined}
          />
          <Card>
            <div className="mb-3 flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">
                <Upload className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="title-md block">Kontoauszüge</span>
                <span className="mt-0.5 block text-[12.5px] text-fg-3">Import im Format CAMT.053 (XML), MT940 (.sta) oder CSV.</span>
              </span>
            </div>
            <p className="text-[12.5px] leading-relaxed text-fg-3">
              Jeder Umsatz wird gegen offene Rechnungen und Aktenkonten geprüft. Jede Zuordnung bleibt nachvollziehbar – mit Regel, Sicherheit und wer gebucht hat – und lässt sich unter „Gebucht“ lösen. In
              dieser Demo werden Beispielumsätze (simuliert) verwendet; es ist kein Bankkonto angebunden.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}

/** Konto des Umsatzes als Text und Symbol – nicht nur Farbe (I4-T08-01). */
function KontoChip({ konto }: { konto: KontoArt }) {
  return konto === "ander" ? (
    <Chip tone="violet" icon={<Vault className="size-3" aria-hidden />} title="Anderkonto (Treuhand) – Fremdgeld nach § 43a Abs. 7 BRAO, § 4 BORA">
      {KONTO_NAME.ander}
    </Chip>
  ) : (
    <Chip tone="neutral" icon={<Building2 className="size-3" aria-hidden />} title="Geschäftskonto der Kanzlei">
      {KONTO_NAME.geschaeft}
    </Chip>
  );
}

/** Filter „Konto: Alle · Geschäftskonto · Anderkonto“ mit Anzahl je Konto. */
function KontoFilter({ value, onChange, umsaetze }: { value: "alle" | KontoArt; onChange: (v: "alle" | KontoArt) => void; umsaetze: Transaktion[] }) {
  const ander = umsaetze.filter((t) => kontoVon(t) === "ander").length;
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Konto-Filter">
      <span className="text-[12.5px] font-medium text-fg-3" aria-hidden>
        Konto:
      </span>
      <Segmented
        size="sm"
        value={value}
        onChange={onChange}
        options={[
          { value: "alle", label: "Alle", count: umsaetze.length },
          { value: "geschaeft", label: KONTO_NAME.geschaeft, count: umsaetze.length - ander },
          { value: "ander", label: KONTO_NAME.ander, count: ander },
        ]}
      />
    </div>
  );
}
