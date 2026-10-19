// Gemeinsame Bausteine der Akten-Seiten (Liste, Akte, Mandatsaufnahme).
import { useMemo } from "react";
import {
  Briefcase, Home, Car, HeartHandshake, ScrollText, Gavel, Coins, FileSignature, HardHat, Landmark,
  Mail, PenLine, UserRound, Receipt, Paperclip, type LucideIcon,
} from "lucide-react";
import type { Akte, AktenPhase, Buchung, Dokument, Frist, FristTyp, Kontakt, Sachgebiet, User } from "@/core/types";
import { fristDringlichkeit } from "@/core/fristen";
import { fristenJeAkte } from "@/core/fristenLage";
import { addDays, diffDays, fmtEUR, nowLocal, relDays, round2, today } from "@/core/dates";
import { istWerktag } from "@/core/feiertage";
import type { Bundesland } from "@/core/types";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { Chip, type Tone } from "@/components/ui";
import { cn } from "@/lib/cn";

export const PHASEN: AktenPhase[] = ["Mandatsaufnahme", "Außergerichtlich", "Gerichtlich", "Beweisaufnahme", "Urteil", "Vollstreckung", "Abgeschlossen"];

export const SACHGEBIETE: Sachgebiet[] = [
  "Arbeitsrecht", "Mietrecht", "Verkehrsrecht", "Familienrecht", "Erbrecht",
  "Strafrecht", "Forderungseinzug", "Vertragsrecht", "Baurecht", "Verwaltungsrecht",
];

export const SACHGEBIET_ICON: Record<Sachgebiet, LucideIcon> = {
  Arbeitsrecht: Briefcase,
  Mietrecht: Home,
  Verkehrsrecht: Car,
  Familienrecht: HeartHandshake,
  Erbrecht: ScrollText,
  Strafrecht: Gavel,
  Forderungseinzug: Coins,
  Vertragsrecht: FileSignature,
  Baurecht: HardHat,
  Verwaltungsrecht: Landmark,
};

export function SachgebietChip({ sg, className }: { sg: Sachgebiet; className?: string }) {
  const Icon = SACHGEBIET_ICON[sg];
  return (
    <Chip className={className} icon={<Icon className="size-3" strokeWidth={2.2} />}>
      {sg}
    </Chip>
  );
}

export const ORDNER: Dokument["ordner"][] = ["Korrespondenz", "Schriftsätze", "Gericht", "Mandant", "Rechnungen", "Anlagen"];

export const ORDNER_ICON: Record<Dokument["ordner"], LucideIcon> = {
  Korrespondenz: Mail,
  Schriftsätze: PenLine,
  Gericht: Landmark,
  Mandant: UserRound,
  Rechnungen: Receipt,
  Anlagen: Paperclip,
};

export const STATUS_INFO: Record<Akte["status"], { label: string; tone: Tone }> = {
  offen: { label: "Offen", tone: "ink" },
  ruhend: { label: "Ruhend", tone: "neutral" },
  abgeschlossen: { label: "Abgeschlossen", tone: "green" },
};

/**
 * Status mit Abschlussdatum für den Aktenkopf: „Abgeschlossen am 12.03.2025“ bzw. bei Umzugsakten ohne Abschlussdatum im
 * Altsystem „Abgeschlossen (Datum im Altsystem unbekannt) · übernommen am 17.10.2026“ (I3-T11-01).
 */
export function abschlussText(akte: Pick<Akte, "status" | "abgeschlossenAm" | "abschlussdatumUnbekannt">): string {
  const label = STATUS_INFO[akte.status].label;
  if (!akte.abgeschlossenAm) return label;
  const datum = akte.abgeschlossenAm.split("-").reverse().join(".");
  return akte.abschlussdatumUnbekannt ? `${label} (Datum im Altsystem unbekannt) · übernommen am ${datum}` : `${label} am ${datum}`;
}

export const PRIO_INFO: Record<Akte["prioritaet"], { label: string; tone: Tone }> = {
  hoch: { label: "Hohe Priorität", tone: "seal" },
  normal: { label: "Normale Priorität", tone: "neutral" },
  niedrig: { label: "Niedrige Priorität", tone: "outline" },
};

export const FRIST_TYP_LABEL: Record<FristTyp, string> = {
  notfrist: "Notfrist",
  frist: "Frist",
  vorfrist: "Vorfrist",
  wiedervorlage: "Wiedervorlage",
  termin: "Termin",
};

export const DECKUNG_INFO: Record<NonNullable<Akte["rsv"]>["deckung"], { label: string; tone: Tone }> = {
  angefragt: { label: "Deckung angefragt", tone: "amber" },
  erteilt: { label: "Deckung erteilt", tone: "green" },
  abgelehnt: { label: "Deckung abgelehnt", tone: "seal" },
  offen: { label: "Deckung offen", tone: "neutral" },
};

export const QUELLE_LABEL: Record<Dokument["quelle"], string> = {
  bea: "beA",
  email: "E-Mail",
  upload: "Hochgeladen",
  generiert: "Automatisch erstellt (38h-Motor)",
  scan: "Scan",
  migration: "Aus Umzug",
};

/**
 * Herkunft eines Dokuments ehrlich benannt (I5-T19-01) – für Chip und Untertitel der E-Akte. Bei „generiert“ wird zwischen
 * Mensch und Maschine unterschieden:
 * - KI-Kennzeichen (`kiAnalyseVom` aus der Fallanalyse bzw. `ki` aus dem Schriftsatz-Entwurf) und Autor → „KI-Entwurf,
 *   gespeichert von …“ (Chip im KI-Ton),
 * - Autor ohne KI-Kennzeichen → „Aus Vorlage erstellt von …“ (eine eigene Notiz: „Erstellt von …“),
 * - ohne Autor → „Automatisch erstellt (38h-Motor)“.
 * Andere Quellen (beA, E-Mail, Hochgeladen, Scan, Umzug) unverändert.
 */
export function quelleLabel(
  d: Pick<Dokument, "quelle" | "autorId" | "kiAnalyseVom" | "ki" | "art">,
  team: Pick<User, "id" | "name">[],
): { text: string; ki: boolean; mitAutor: boolean } {
  if (d.quelle !== "generiert") return { text: QUELLE_LABEL[d.quelle], ki: false, mitAutor: false };
  if (!d.autorId) return { text: QUELLE_LABEL.generiert, ki: false, mitAutor: false };
  const name = team.find((u) => u.id === d.autorId)?.name ?? "einer Person aus dem Team";
  if (d.kiAnalyseVom || d.ki) return { text: `KI-Entwurf, gespeichert von ${name}`, ki: true, mitAutor: true };
  if (d.art === "notiz") return { text: `Erstellt von ${name}`, ki: false, mitAutor: true };
  return { text: `Aus Vorlage erstellt von ${name}`, ki: false, mitAutor: true };
}

const ABKUERZUNGEN: Record<string, string> = { kschg: "KSchG", bgb: "BGB", zpo: "ZPO", stpo: "StPO", owig: "OWiG", stgb: "StGB", rvg: "RVG", rsv: "RSV", vob: "VOB", agb: "AGB", gmbh: "GmbH", bea: "beA", eeb: "eEB" };

/** Kleingeschriebene Wörter in Schlagworten (Verben, Präpositionen, Artikel). */
const KLEIN = new Set(["und", "oder", "wegen", "gegen", "mit", "ohne", "von", "vom", "zur", "zum", "der", "die", "das", "des", "dem", "den", "im", "in", "auf", "bei", "nach", "kürzt", "fehlt", "droht"]);

/**
 * Schlagwort für die Anzeige (gespeichert sind sie klein für die Suche): Wörter groß – „fristlose kündigung“ →
 * „Fristlose Kündigung“ –, Präpositionen/Verben klein, bekannte Abkürzungen richtig („kschg“ → „KSchG“).
 */
export function schlagwortAnzeige(s: string): string {
  return s
    .split(/(\s+|-)/)
    .map((w, i) => ABKUERZUNGEN[w.toLowerCase()] ?? (i > 0 && KLEIN.has(w.toLowerCase()) ? w : w.charAt(0).toLocaleUpperCase("de-DE") + w.slice(1)))
    .join("");
}

/** Ampel einer Frist als Chip-Ton und Klartext. */
/**
 * Zeitliche Ampel einer Frist. Rot (seal) nur für überfällige Einträge und für kritische Fristen (Notfrist oder nicht verlängerbar)
 * in den nächsten zwei Tagen – übrige Fristen zeigen „bald“ in Bernstein (UI-Leitfaden 1.4, DESIGN-SYSTEM.md 4.1).
 */
export function dringlichkeit(datum: string, kritisch = false): { tone: Tone; label: string; stufe: ReturnType<typeof fristDringlichkeit> } {
  const heute = today();
  const stufe = fristDringlichkeit(datum, heute);
  if (stufe === "ueberfaellig") {
    const n = -diffDays(heute, datum);
    return { tone: "seal", label: n === 1 ? "seit gestern überfällig" : `seit ${n} Tagen überfällig`, stufe };
  }
  if (stufe === "kritisch") return { tone: kritisch ? "seal" : "amber", label: relDays(datum, heute), stufe };
  if (stufe === "bald") return { tone: "amber", label: relDays(datum, heute), stufe };
  return { tone: "neutral", label: relDays(datum, heute), stufe };
}

export function FristChip({ datum, kritisch, className }: { datum: string; kritisch?: boolean; className?: string }) {
  const d = dringlichkeit(datum, kritisch);
  return (
    <Chip tone={d.tone} className={className}>
      {d.label}
    </Chip>
  );
}

/**
 * Nächste offene Frist je Akte (Notfrist oder Frist, überfällige zuerst) – dieselbe Zählweise wie die Kennzahl
 * „Akten mit Frist ≤ 7 Tage“ (src/core/fristenLage.ts). Wiedervorlagen, Vorfristen und Termine zählen nicht.
 */
export function useNaechsteFristen(): Map<string, Frist> {
  const fristen = useCol("fristen");
  return useMemo(() => new Map([...fristenJeAkte(fristen)].map(([id, x]) => [id, x.naechste])), [fristen]);
}

export function useKontaktMap(): Map<string, Kontakt> {
  const k = useCol("kontakte");
  return useMemo(() => new Map(k.map((x) => [x.id, x])), [k]);
}

export function useTeam(): { team: User[]; anwaelte: User[]; byId: Map<string, User> } {
  const { team } = useKanzlei();
  return useMemo(
    () => ({ team, anwaelte: team.filter((u) => u.rolle === "partner" || u.rolle === "anwalt"), byId: new Map(team.map((u) => [u.id, u])) }),
    [team],
  );
}

/** Nächstes freies Aktenzeichen „NNN/YY“ – höchste Nummer des laufenden Jahres + 1. */
export function naechstesAktenzeichen(akten: Akte[]): string {
  const yy = today().slice(2, 4);
  let max = 100;
  for (const a of akten) {
    const m = /^(\d+)\/(\d{2})$/.exec(a.aktenzeichen.trim());
    if (m && m[2] === yy) max = Math.max(max, Number(m[1]));
  }
  return `${max + 1}/${yy}`;
}

/** Sortierschlüssel für Aktenzeichen „142/26“. */
export function azSortKey(az: string): number {
  const m = /^(\d+)\/(\d{2})$/.exec(az.trim());
  return m ? Number(m[2]) * 100000 + Number(m[1]) : 0;
}

/** Datum in n Tagen, auf den nächsten Werktag gelegt. */
export function werktagIn(tage: number, land: Bundesland): string {
  let d = addDays(today(), tage);
  let guard = 0;
  while (!istWerktag(d, land) && guard++ < 10) d = addDays(d, 1);
  return d;
}

/** Markiert die Akte als geändert. */
export function beruehreAkte(id: string) {
  useData.getState().patch("akten", id, { updatedAt: nowLocal() });
}

/** Kleiner Phasen-Fortschritt (für Tabellen und Karten). */
export function PhasenBalken({ phase, className }: { phase: AktenPhase; className?: string }) {
  const idx = PHASEN.indexOf(phase);
  return (
    <div className={cn("flex gap-[3px]", className)} role="img" aria-label={`Phase ${idx + 1} von ${PHASEN.length}: ${phase}`}>
      {PHASEN.slice(0, -1).map((p, i) => (
        <span key={p} className={cn("h-[3px] flex-1 rounded-full", i <= idx ? (phase === "Abgeschlossen" ? "bg-green" : "bg-ink") : "bg-[var(--line-strong)]")} />
      ))}
    </div>
  );
}

/** Merkt sich die Filter der Aktenliste, damit „Zurück zu allen Akten“ dort weitermacht. */
export const listenKontext = { suche: "" };

export const DOK_ART_LABEL: Record<Dokument["art"], string> = {
  schriftsatz: "Schriftsatz",
  brief: "Brief",
  urteil: "Urteil",
  beschluss: "Beschluss",
  vollmacht: "Vollmacht",
  rechnung: "Rechnung",
  email: "E-Mail",
  bea: "beA-Nachricht",
  notiz: "Notiz",
  anlage: "Anlage",
  vertrag: "Vertrag",
  gutachten: "Gutachten",
};

export function fmtKb(kb: number): string {
  if (kb >= 1024) return `${(kb / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(kb))} KB`;
}

// ───────────── Eigene Schreiben, Bearbeitungsstand, Platzhalter ─────────────

/** Eigenes Schreiben der Kanzlei (erzeugt bzw. aus eigener Vorlage) – nur diese tragen den Kanzleikopf und lassen sich bearbeiten. */
export function eigenesSchreiben(d: Pick<Dokument, "quelle">): boolean {
  return d.quelle === "generiert";
}

/** Von der Kanzlei gesendete E-Mail bzw. beA-Nachricht (E-Mail schreiben → abgelegt mit Autor) – ein Ausgang, kein Eingang. */
export function istGesendet(d: Pick<Dokument, "quelle" | "autorId">): boolean {
  return (d.quelle === "email" || d.quelle === "bea") && !!d.autorId;
}

/**
 * Eingang von außen (beA, E-Mail, Scan, Umzug, hochgeladenes Fremddokument) – wird nie verändert und nie automatisch freigegeben.
 * Gesendete Nachrichten der Kanzlei zählen nicht als Eingang (Richtung, I4-T23-01).
 */
export function istEingang(d: Pick<Dokument, "quelle"> & Partial<Pick<Dokument, "autorId">>): boolean {
  return !eigenesSchreiben(d) && !istGesendet({ quelle: d.quelle, autorId: d.autorId });
}

export const DOK_STATUS_INFO: Record<NonNullable<Dokument["status"]>, { label: string; tone: Tone }> = {
  entwurf: { label: "Entwurf", tone: "amber" },
  freigegeben: { label: "Freigegeben", tone: "green" },
  versandt: { label: "Versandt", tone: "ink" },
};

/** Offene Platzhalter im Text („[Anschrift der Versicherung]“) – je Platzhalter einmal, in der Reihenfolge des Auftretens. */
export function offenePlatzhalter(text: string): string[] {
  return [...new Set(text.match(/\[[^\]\n]{1,80}\]/g) ?? [])];
}

/** „Deckungsanfrage Nordlicht Rechtsschutz AG (16.10.2026) · Version 2“ – Datum nur, wenn es nicht schon im Namen steht. */
export function dokumentBezeichnung(d: Pick<Dokument, "name" | "createdAt" | "version">): string {
  const datum = d.createdAt.slice(0, 10).split("-").reverse().join(".");
  const name = d.name.includes(datum) ? d.name : `${d.name} (${datum})`;
  return `${name} · Version ${d.version}`;
}

/** „Deckungsanfrage X (Entwurf vom 16.10.2026)“ → „Deckungsanfrage X (16.10.2026)“ – nach Freigabe bzw. Versand. */
export function ohneEntwurfsVermerk(name: string): string {
  return name.replace(/\s*\(Entwurf vom ([\d.]+)\)$/, " ($1)").replace(/\s*\(Entwurf\)$/, "");
}

/** Summen des Aktenkontos: Honorarkonto (offener Saldo) und Fremdgeld (Treuhand) getrennt – für Reiter und Abschließen-Dialog. */
export function kontoSummen(buchungen: Buchung[]) {
  let honorar = 0, bezahlt = 0, vorschuss = 0, angefordert = 0, fremdEin = 0, fremdAus = 0, auslagen = 0;
  for (const b of buchungen) {
    const fremd = b.fremdgeld || b.art === "fremdgeld";
    if (fremd) {
      if (b.art === "fremdgeld" && b.betrag < 0) fremdAus += -b.betrag;
      else fremdEin += Math.abs(b.betrag);
      continue;
    }
    if (b.art === "honorar") honorar += b.betrag;
    else if (b.art === "zahlung") bezahlt += -b.betrag;
    else if (b.art === "vorschuss") {
      // nur eingegangene Vorschüsse mindern das Offene – ein angeforderter ist eine Forderung, kein Guthaben;
      // die Gegenbuchung einer eingegangenen Zahlung („Storno: …“, z. B. Zuordnung im Bankabgleich gelöst) mindert den Eingang
      if (b.betrag < 0) vorschuss += -b.betrag;
      else if (b.text.startsWith("Storno: ")) vorschuss -= b.betrag;
      else angefordert += b.betrag;
    } else auslagen += b.betrag;
  }
  return {
    honorar: round2(honorar), bezahlt: round2(bezahlt), vorschuss: round2(vorschuss), angefordert: round2(angefordert), auslagen: round2(auslagen),
    offen: round2(honorar + auslagen + angefordert - bezahlt - vorschuss), fremdEin: round2(fremdEin), fremdOffen: round2(fremdEin - fremdAus),
  };
}

/**
 * Mobil (≤ 640 px): Bedienflächen der Akte mindestens 44 × 44 px – Schaltflächen höher, Symbolknöpfe größer; Kontrollkästchen
 * und Schalter behalten ihre Optik, bekommen aber eine unsichtbar vergrößerte Trefferfläche.
 */
export const MOBIL_TREFFER =
  "max-sm:[&_.btn]:[--h:44px] max-sm:[&_.icon-btn]:!size-11 max-sm:[&_[role=checkbox]]:relative max-sm:[&_[role=checkbox]]:before:absolute max-sm:[&_[role=checkbox]]:before:-inset-[13px] max-sm:[&_[role=checkbox]]:before:content-[''] max-sm:[&_[role=switch]]:relative max-sm:[&_[role=switch]]:before:absolute max-sm:[&_[role=switch]]:before:-inset-y-[7px] max-sm:[&_[role=switch]]:before:inset-x-0 max-sm:[&_[role=switch]]:before:content-['']";

/** Gerichtsbezeichnung in der üblichen Kurzform: „Arbeitsgericht Paderborn“ → „ArbG Paderborn“, „Landgericht Berlin II“ → „LG Berlin II“. */
const GERICHT_KURZ: [RegExp, string][] = [
  [/^Bundesgerichtshof\b/, "BGH"],
  [/^Bundesarbeitsgericht\b/, "BAG"],
  [/^Bundessozialgericht\b/, "BSG"],
  [/^Bundesverwaltungsgericht\b/, "BVerwG"],
  [/^Bundesfinanzhof\b/, "BFH"],
  [/^Landesarbeitsgericht\b/, "LAG"],
  [/^Landessozialgericht\b/, "LSG"],
  [/^Oberverwaltungsgericht\b/, "OVG"],
  [/^Verwaltungsgerichtshof\b/, "VGH"],
  [/^Oberlandesgericht\b/, "OLG"],
  [/^Kammergericht\b/, "KG"],
  [/^Arbeitsgericht\b/, "ArbG"],
  [/^Sozialgericht\b/, "SG"],
  [/^Verwaltungsgericht\b/, "VG"],
  [/^Finanzgericht\b/, "FG"],
  [/^Landgericht\b/, "LG"],
  [/^Amtsgericht\b/, "AG"],
];
export function gerichtKurz(name: string): string {
  const n = name.trim();
  for (const [re, kurz] of GERICHT_KURZ) if (re.test(n)) return n.replace(re, kurz);
  return n;
}

/** Gegenstandswert in Listen: ganze Euro ohne Nachkommastellen, sonst auf den Cent (2.180,50 €). */
export function wertKurz(v: number): string {
  return fmtEUR(v, { cents: Math.round(v * 100) % 100 !== 0 });
}
