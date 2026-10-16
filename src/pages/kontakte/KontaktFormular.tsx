// Kontakt anlegen & auswählen – gemeinsam genutzt von Kontakte, Mandatsaufnahme und Beteiligte.
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import type { Kontakt, KontaktRolle } from "@/core/types";
import { nowLocal, uid } from "@/core/dates";
import { search } from "@/core/search";
import { useCol } from "@/store/data";
import { Chip, Field, Input, SearchField, Select, Segmented } from "@/components/ui";
import { Highlight } from "@/components/Highlight";
import { cn } from "@/lib/cn";
import { KontaktAvatar, ROLLE_LABEL } from "./kontaktHelfer";

export interface KontaktEntwurf {
  typ: "person" | "organisation";
  anrede: "" | "Herr" | "Frau";
  vorname: string;
  nachname: string;
  firma: string;
  email: string;
  telefon: string;
  strasse: string;
  plz: string;
  ort: string;
}

export function leererEntwurf(typ: KontaktEntwurf["typ"] = "person"): KontaktEntwurf {
  return { typ, anrede: "", vorname: "", nachname: "", firma: "", email: "", telefon: "", strasse: "", plz: "", ort: "" };
}

export function entwurfName(e: KontaktEntwurf): string {
  return e.typ === "person" ? [e.vorname.trim(), e.nachname.trim()].filter(Boolean).join(" ") : e.firma.trim();
}

export function entwurfGueltig(e: KontaktEntwurf): boolean {
  if (e.typ === "person") return !!e.nachname.trim();
  return !!e.firma.trim();
}

export function emailUngueltig(email: string): boolean {
  return !!email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function entwurfZuKontakt(e: KontaktEntwurf, rollen: KontaktRolle[]): Kontakt {
  const opt = (s: string) => (s.trim() ? s.trim() : undefined);
  return {
    id: uid("k"),
    typ: e.typ,
    name: entwurfName(e),
    vorname: e.typ === "person" ? opt(e.vorname) : undefined,
    nachname: e.typ === "person" ? opt(e.nachname) : undefined,
    firma: e.typ === "organisation" ? opt(e.firma) : undefined,
    anrede: e.typ === "person" ? e.anrede : undefined,
    email: opt(e.email),
    telefon: opt(e.telefon),
    strasse: opt(e.strasse),
    plz: opt(e.plz),
    ort: opt(e.ort),
    rollen,
    createdAt: nowLocal(),
  };
}

/** Eingabefelder für Person oder Organisation. */
export function KontaktFelder({ value, onChange, idPrefix, typWaehlbar = true }: { value: KontaktEntwurf; onChange: (v: KontaktEntwurf) => void; idPrefix: string; typWaehlbar?: boolean }) {
  const set = (p: Partial<KontaktEntwurf>) => onChange({ ...value, ...p });
  const id = (s: string) => `${idPrefix}-${s}`;
  return (
    <div className="grid grid-cols-1 gap-3.5">
      {typWaehlbar && (
        <Segmented
          full
          value={value.typ}
          onChange={(typ) => set({ typ })}
          options={[
            { value: "person", label: "Person" },
            { value: "organisation", label: "Firma / Organisation" },
          ]}
        />
      )}
      {value.typ === "person" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr_1fr]">
          <Field label="Anrede" htmlFor={id("anrede")}>
            <Select id={id("anrede")} value={value.anrede} onChange={(e) => set({ anrede: e.target.value as KontaktEntwurf["anrede"] })}>
              <option value="">–</option>
              <option value="Frau">Frau</option>
              <option value="Herr">Herr</option>
            </Select>
          </Field>
          <Field label="Vorname" htmlFor={id("vorname")}>
            <Input id={id("vorname")} value={value.vorname} onChange={(e) => set({ vorname: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Nachname *" htmlFor={id("nachname")}>
            <Input id={id("nachname")} value={value.nachname} onChange={(e) => set({ nachname: e.target.value })} autoComplete="off" />
          </Field>
        </div>
      ) : (
        <Field label="Firmenname *" htmlFor={id("firma")}>
          <Input id={id("firma")} value={value.firma} onChange={(e) => set({ firma: e.target.value })} placeholder="z. B. Berger Haustechnik GmbH" autoComplete="off" />
        </Field>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="E-Mail" htmlFor={id("email")} hint={emailUngueltig(value.email) ? <span className="text-seal">Bitte eine gültige E-Mail-Adresse eingeben.</span> : undefined}>
          <Input id={id("email")} type="email" value={value.email} onChange={(e) => set({ email: e.target.value })} autoComplete="off" />
        </Field>
        <Field label="Telefon" htmlFor={id("telefon")}>
          <Input id={id("telefon")} type="tel" value={value.telefon} onChange={(e) => set({ telefon: e.target.value })} autoComplete="off" />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_110px_1fr]">
        <Field label="Straße und Hausnummer" htmlFor={id("strasse")}>
          <Input id={id("strasse")} value={value.strasse} onChange={(e) => set({ strasse: e.target.value })} autoComplete="off" />
        </Field>
        <Field label="PLZ" htmlFor={id("plz")}>
          <Input id={id("plz")} inputMode="numeric" value={value.plz} onChange={(e) => set({ plz: e.target.value })} autoComplete="off" />
        </Field>
        <Field label="Ort" htmlFor={id("ort")}>
          <Input id={id("ort")} value={value.ort} onChange={(e) => set({ ort: e.target.value })} autoComplete="off" />
        </Field>
      </div>
    </div>
  );
}

/** Durchsuchbare Kontaktliste zur Auswahl (bevorzugte Rollen zuerst). */
const LEER: never[] = [];

export function KontaktAuswahl({ value, onSelect, bevorzugt = LEER, id, hoehe = 300, ausblenden = LEER }: { value?: string; onSelect: (k: Kontakt) => void; bevorzugt?: KontaktRolle[]; id: string; hoehe?: number; ausblenden?: string[] }) {
  const kontakte = useCol("kontakte");
  const [q, setQ] = useState("");
  const liste = useMemo(() => {
    const basis = kontakte.filter((k) => !ausblenden.includes(k.id));
    if (q.trim()) {
      return search(basis, q, [
        { get: (k) => k.name, weight: 3 },
        { get: (k) => k.email, weight: 1 },
        { get: (k) => k.ort, weight: 1 },
      ], 60).map((h) => h.item);
    }
    const rang = (k: Kontakt) => (bevorzugt.some((r) => k.rollen.includes(r)) ? 0 : 1);
    return [...basis].sort((a, b) => rang(a) - rang(b) || a.name.localeCompare(b.name, "de")).slice(0, 60);
  }, [kontakte, q, bevorzugt, ausblenden]);

  return (
    <div className="grid grid-cols-1 gap-2.5">
      <SearchField id={id} value={q} onChange={setQ} placeholder="Name, E-Mail oder Ort suchen …" />
      <div className="overflow-y-auto rounded-[16px] bg-ink-softer p-1 shadow-[inset_0_0_0_1px_var(--line)]" style={{ maxHeight: hoehe }}>
        {liste.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-fg-3">Kein Kontakt gefunden. Legen Sie einen neuen an.</div>
        ) : (
          liste.map((k) => {
            const aktiv = k.id === value;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => onSelect(k)}
                className={cn("relative flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2 text-left transition-colors", aktiv ? "" : "hover:bg-[var(--surface)]")}
                aria-pressed={aktiv}
              >
                {aktiv && (
                  <motion.span layoutId={`${id}-wahl`} transition={{ type: "spring", stiffness: 520, damping: 38 }} className="absolute inset-0 -z-0 rounded-[12px] bg-[var(--surface)] shadow-[0_0_0_1.5px_var(--ink),0_6px_16px_-10px_var(--ink)]" />
                )}
                <KontaktAvatar k={k} size={32} className="relative" />
                <span className="relative min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">
                    <Highlight text={k.name} q={q} />
                  </span>
                  <span className="block truncate text-[12px] text-fg-3">{[k.email, k.ort].filter(Boolean).join(" · ") || "Keine Kontaktdaten"}</span>
                </span>
                <span className="relative hidden gap-1 sm:flex">
                  {k.rollen.slice(0, 2).map((r) => (
                    <Chip key={r} tone={r === "mandant" ? "ink" : "neutral"}>
                      {ROLLE_LABEL[r]}
                    </Chip>
                  ))}
                </span>
                {aktiv && <Check className="relative size-4 shrink-0 text-ink" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
