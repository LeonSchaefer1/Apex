// Gemeinsame Bausteine der Akten-Seiten (Liste, Akte, Mandatsaufnahme).
import { useMemo } from "react";
import {
  Briefcase, Home, Car, HeartHandshake, ScrollText, Gavel, Coins, FileSignature, HardHat, Landmark,
  Mail, PenLine, UserRound, Receipt, Paperclip, type LucideIcon,
} from "lucide-react";
import type { Akte, AktenPhase, Dokument, Frist, FristTyp, Kontakt, Sachgebiet, User } from "@/core/types";
import { fristDringlichkeit } from "@/core/fristen";
import { fristenJeAkte } from "@/core/fristenLage";
import { addDays, diffDays, nowLocal, relDays, today } from "@/core/dates";
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
  generiert: "Automatisch erstellt",
  scan: "Scan",
  migration: "Aus Umzug",
};

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
export function dringlichkeit(datum: string): { tone: Tone; label: string; stufe: ReturnType<typeof fristDringlichkeit> } {
  const heute = today();
  const stufe = fristDringlichkeit(datum, heute);
  if (stufe === "ueberfaellig") {
    const n = -diffDays(heute, datum);
    return { tone: "seal", label: n === 1 ? "seit gestern überfällig" : `seit ${n} Tagen überfällig`, stufe };
  }
  if (stufe === "kritisch") return { tone: "seal", label: relDays(datum, heute), stufe };
  if (stufe === "bald") return { tone: "amber", label: relDays(datum, heute), stufe };
  return { tone: "neutral", label: relDays(datum, heute), stufe };
}

export function FristChip({ datum, className }: { datum: string; className?: string }) {
  const d = dringlichkeit(datum);
  return (
    <Chip tone={d.tone} dot={d.stufe !== "normal"} className={className}>
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
