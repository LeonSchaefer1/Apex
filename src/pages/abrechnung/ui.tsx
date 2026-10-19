// Gemeinsame Bausteine der Abrechnung (Status-Chips, Nachschlage-Tabellen, Briefkopf, Messung).
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { FileCode2, FileText, FileStack } from "lucide-react";
import { Chip, type Tone } from "@/components/ui";
import { useCol } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { fmtDate, fmtEUR, today } from "@/core/dates";
import type { Akte, Kontakt, Rechnung, Tenant, User } from "@/core/types";
import { cn } from "@/lib/cn";
import { istUeberfaellig } from "./lib";

export const STATUS_META: Record<Rechnung["status"], { label: string; tone: Tone }> = {
  entwurf: { label: "Entwurf", tone: "neutral" },
  gestellt: { label: "Gestellt", tone: "ink" },
  teilbezahlt: { label: "Teilbezahlt", tone: "amber" },
  bezahlt: { label: "Bezahlt", tone: "green" },
  storniert: { label: "Storniert", tone: "outline" },
};

export function StatusChip({ r, mitUeberfaellig = true }: { r: Rechnung; mitUeberfaellig?: boolean }) {
  if (mitUeberfaellig && istUeberfaellig(r, today())) {
    return (
      <Chip tone="seal" title={`fällig seit ${fmtDate(r.faellig)}`}>
        {r.status === "teilbezahlt" ? "Teilbezahlt" : "Überfällig"}
      </Chip>
    );
  }
  const m = STATUS_META[r.status];
  return (
    <Chip tone={m.tone}>
      {m.label}
    </Chip>
  );
}

export const FORMAT_INFO: Record<Rechnung["format"], { text: string; icon: ReactNode }> = {
  PDF: { text: "Klassische Rechnung als PDF – per E-Mail, Mandantenportal oder Post.", icon: <FileText className="size-3.5" /> },
  XRechnung: { text: "Strukturierte E-Rechnung (EN 16931) – Pflichtformat für Behörden, ideal für Unternehmen.", icon: <FileCode2 className="size-3.5" /> },
  ZUGFeRD: { text: "Hybrid: lesbares PDF mit eingebetteten XML-Daten – für Mensch und Buchhaltung.", icon: <FileStack className="size-3.5" /> },
};

/** Format der Rechnung als leise Angabe (Symbol + Name in Text 3) – kein Rahmen je Tabellenzeile. */
export function FormatChip({ format }: { format: Rechnung["format"] }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-fg-3 [&>svg]:size-3.5 [&>svg]:text-fg-4">
      {FORMAT_INFO[format].icon}
      {format}
    </span>
  );
}

export function Betrag({ n, className, vorzeichen }: { n: number; className?: string; vorzeichen?: boolean }) {
  return (
    <span className={cn("num whitespace-nowrap", className)}>
      {vorzeichen && n > 0 ? "+" : ""}
      {fmtEUR(n)}
    </span>
  );
}

export function AkteLabel({ akte, className }: { akte?: Akte; className?: string }) {
  if (!akte) return <span className="text-fg-3">–</span>;
  return (
    <span className={cn("flex min-w-0 items-baseline gap-2", className)}>
      <span className="mono shrink-0 text-[13px] text-fg-3">{akte.aktenzeichen}</span>
      <span className="truncate">{akte.titel}</span>
    </span>
  );
}

/** Kopf eines Reiters: klarer Name, ein Satz Erklärung, optionale Aktionen – ohne Symbolkachel (`icon` bleibt ohne Wirkung). */
export function TabKopf({ titel, text, aktionen, plakette }: { titel: string; text: string; aktionen?: ReactNode; icon?: ReactNode; plakette?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1 basis-[300px]">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="title-lg">{titel}</h2>
          {plakette}
        </div>
        <p className="mt-1 max-w-[72ch] text-[14px] leading-5 text-fg-3">{text}</p>
      </div>
      {aktionen && <div className="flex flex-wrap items-center gap-2">{aktionen}</div>}
    </div>
  );
}

export interface Lookups {
  akten: Map<string, Akte>;
  kontakte: Map<string, Kontakt>;
  users: Map<string, User>;
}

export function useLookups(): Lookups {
  const akten = useCol("akten");
  const kontakte = useCol("kontakte");
  const { team } = useKanzlei();
  return useMemo(
    () => ({
      akten: new Map(akten.map((a) => [a.id, a])),
      kontakte: new Map(kontakte.map((k) => [k.id, k])),
      users: new Map(team.map((u) => [u.id, u])),
    }),
    [akten, kontakte, team],
  );
}

/** Breite eines Elements beobachten (für maßstabsgetreue SVG-Diagramme). */
export function useMeasure<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setW(Math.round(entries[0].contentRect.width)));
    ro.observe(el);
    setW(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function kanzleiInitialen(t: Tenant) {
  const w = t.kurzname.split(/\s+/).filter((x) => /^[A-ZÄÖÜ]/.test(x));
  return (
    w
      .map((x) => x[0])
      .join("")
      .slice(0, 2) || t.kurzname.slice(0, 2)
  ).toUpperCase();
}

/** Briefkopf für Dokumentvorschauen auf `.paper` (Papier bleibt in beiden Modi hell). */
export function Briefkopf({ tenant, absenderZeile = true }: { tenant: Tenant; absenderZeile?: boolean }) {
  const [strasse, ort] = tenant.adresse.split(",").map((s) => s.trim());
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2.5">
          {/* Kanzleifarbe aus den Daten nur als 8-px-Punkt, nie als Fläche hinter Schrift (DESIGN-SYSTEM.md 4.1) */}
          <span className="mt-[7px] size-2 shrink-0 rounded-full" style={{ background: tenant.farbe }} aria-hidden />
          {/* Voller Name und alle Schwerpunkte – umbrechen statt kürzen, wie die Vorschau im Kanzleiprofil (I5-T16-01) */}
          <div className="min-w-0">
            <div className="text-[15px] font-semibold leading-snug [overflow-wrap:anywhere]">{tenant.name}</div>
            <div className="mt-0.5 text-[13px] leading-snug text-[#68645e] [overflow-wrap:anywhere]">{tenant.schwerpunkte.join(" · ")}</div>
          </div>
        </div>
        <div className="hidden shrink-0 text-right text-[13px] leading-snug text-[#55524d] sm:block">
          {strasse}
          <br />
          {ort}
        </div>
      </div>
      {/* Papier: feste Papierwerte (DESIGN-SYSTEM.md 12.18) – Linie statt Farbverlauf */}
      <div className="mt-4 h-px bg-[#e6e5e2]" />
      {absenderZeile && (
        <div className="mt-6 text-[12px] leading-snug text-[#55524d] underline decoration-[#e6e5e2] underline-offset-2 [overflow-wrap:anywhere]">
          {tenant.name} · {strasse} · {ort}
        </div>
      )}
    </div>
  );
}

export function Anschrift({ k }: { k?: Kontakt }) {
  if (!k) return <div className="opacity-50">Empfänger unbekannt</div>;
  return (
    <div className="text-[13px] leading-[1.55]">
      {k.typ === "person" && k.anrede && <div>{k.anrede}</div>}
      <div className="font-medium">{k.name}</div>
      {k.strasse && <div>{k.strasse}</div>}
      {(k.plz || k.ort) && (
        <div>
          {k.plz} {k.ort}
        </div>
      )}
    </div>
  );
}

/** Schlüssel-Wert-Zeile im Infoblock eines Papiers. */
export function InfoZeile({ k, v, mono }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-[13px] leading-[1.7]">
      <span className="text-[#55524d]">{k}</span>
      <span className={cn("text-right font-medium", mono && "mono")}>{v}</span>
    </div>
  );
}
