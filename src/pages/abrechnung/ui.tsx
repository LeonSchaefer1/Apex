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
      <Chip tone="seal" dot title={`fällig seit ${fmtDate(r.faellig)}`}>
        {r.status === "teilbezahlt" ? "Teilbezahlt" : "Überfällig"}
      </Chip>
    );
  }
  const m = STATUS_META[r.status];
  return (
    <Chip tone={m.tone} dot={r.status !== "storniert"}>
      {m.label}
    </Chip>
  );
}

export const FORMAT_INFO: Record<Rechnung["format"], { text: string; icon: ReactNode }> = {
  PDF: { text: "Klassische Rechnung als PDF – per E-Mail, Mandantenportal oder Post.", icon: <FileText className="size-3.5" /> },
  XRechnung: { text: "Strukturierte E-Rechnung (EN 16931) – Pflichtformat für Behörden, ideal für Unternehmen.", icon: <FileCode2 className="size-3.5" /> },
  ZUGFeRD: { text: "Hybrid: lesbares PDF mit eingebetteten XML-Daten – für Mensch und Buchhaltung.", icon: <FileStack className="size-3.5" /> },
};

export function FormatChip({ format }: { format: Rechnung["format"] }) {
  return (
    <Chip tone={format === "PDF" ? "outline" : "violet"} icon={FORMAT_INFO[format].icon}>
      {format}
    </Chip>
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
  if (!akte) return <span className="text-fg-4">–</span>;
  return (
    <span className={cn("flex min-w-0 items-baseline gap-2", className)}>
      <span className="mono shrink-0 text-[12px] text-fg-3">{akte.aktenzeichen}</span>
      <span className="truncate">{akte.titel}</span>
    </span>
  );
}

/** Kopf eines Reiters: klarer Name, ein Satz Erklärung, optionale Aktionen. */
export function TabKopf({ titel, text, aktionen, icon }: { titel: string; text: string; aktionen?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-x-6 gap-y-3">
      <div className="flex min-w-0 flex-1 basis-[300px] items-start gap-3">
        {icon && <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">{icon}</div>}
        <div className="min-w-0">
          <h2 className="title-lg">{titel}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-fg-3">{text}</p>
        </div>
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
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[11px] text-[13px] font-bold tracking-[0.02em] text-white" style={{ background: tenant.farbe }}>
            {kanzleiInitialen(tenant)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em]">{tenant.name}</div>
            <div className="mt-0.5 truncate text-[10.5px] tracking-[0.04em] opacity-55">{tenant.schwerpunkte.join(" · ")}</div>
          </div>
        </div>
        <div className="hidden shrink-0 text-right text-[11px] leading-snug opacity-60 sm:block">
          {strasse}
          <br />
          {ort}
        </div>
      </div>
      <div className="mt-4 h-[2px] rounded-full" style={{ background: `linear-gradient(90deg, ${tenant.farbe}, transparent)` }} />
      {absenderZeile && (
        <div className="mt-6 truncate text-[9.5px] underline decoration-black/20 underline-offset-2 opacity-60">
          {tenant.name} · {strasse} · {ort}
        </div>
      )}
    </div>
  );
}

export function Anschrift({ k }: { k?: Kontakt }) {
  if (!k) return <div className="opacity-50">Empfänger unbekannt</div>;
  return (
    <div className="text-[12.5px] leading-[1.55]">
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
    <div className="flex justify-between gap-4 text-[11.5px] leading-[1.7]">
      <span className="opacity-55">{k}</span>
      <span className={cn("text-right font-medium", mono && "mono")}>{v}</span>
    </div>
  );
}
