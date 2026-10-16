// Gemeinsame Bausteine rund um Kontakte – genutzt von Kontakte, Akte (Beteiligte) und Mandatsaufnahme.
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Building2, Check, Copy, Landmark, ShieldCheck, Scale } from "lucide-react";
import type { Akte, Kontakt, KontaktRolle } from "@/core/types";
import { useCol } from "@/store/data";
import { toast } from "@/store/ui";
import { Avatar, type Tone } from "@/components/ui";
import { cn } from "@/lib/cn";

export const ROLLE_LABEL: Record<KontaktRolle, string> = {
  mandant: "Mandant",
  gegner: "Gegner",
  gegneranwalt: "Gegneranwalt",
  gericht: "Gericht",
  versicherung: "Versicherung",
  behoerde: "Behörde",
  sonstige: "Sonstige",
};

export const ROLLE_TONE: Record<KontaktRolle, Tone> = {
  mandant: "ink",
  gegner: "neutral",
  gegneranwalt: "neutral",
  gericht: "outline",
  versicherung: "outline",
  behoerde: "outline",
  sonstige: "outline",
};

export function kontaktInitialen(k: Pick<Kontakt, "name" | "vorname" | "nachname">): string {
  if (k.vorname && k.nachname) return (k.vorname[0] + k.nachname[0]).toUpperCase();
  const w = k.name.replace(/^(Dr\.|Prof\.)\s+/g, "").split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? "?") + (w[1]?.[0] ?? "")).toUpperCase();
}

export function kontaktAdresse(k: Kontakt): string {
  const ort = [k.plz, k.ort].filter(Boolean).join(" ");
  return [k.strasse, ort].filter(Boolean).join(", ");
}

/** Symbol bzw. Initialen eines Kontakts – Organisationen bekommen ein Gebäude-, Gerichte ein Justiz-Symbol. */
export function KontaktAvatar({ k, size = 40, className }: { k: Kontakt; size?: number; className?: string }) {
  if (k.typ === "person") return <Avatar initialen={kontaktInitialen(k)} farbe="var(--ink)" size={size} className={className} />;
  const Icon = k.rollen.includes("gericht") || k.rollen.includes("behoerde") ? Landmark : k.rollen.includes("versicherung") ? ShieldCheck : k.rollen.includes("gegneranwalt") ? Scale : Building2;
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center bg-ink-soft text-ink", className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.32) }}
      aria-hidden
    >
      <Icon style={{ width: size * 0.46, height: size * 0.46 }} strokeWidth={1.8} />
    </span>
  );
}

/** Kopiert Text in die Zwischenablage – mit Ausweichweg für eingebettete Ansichten. */
export async function kopiere(text: string, was = "Text"): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${was} kopiert`, { ton: "erfolg" });
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (!ok) throw new Error("copy");
      toast(`${was} kopiert`, { ton: "erfolg" });
      return true;
    } catch {
      toast("Kopieren nicht möglich", { ton: "fehler", text: "Bitte den Text markieren und mit Strg+C bzw. ⌘C kopieren." });
      return false;
    }
  }
}

export function CopyButton({ text, was, className }: { text: string; was: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      aria-label={`${was} kopieren`}
      title={`${was} kopieren`}
      onClick={async (e) => {
        e.stopPropagation();
        if (await kopiere(text, was)) {
          setOk(true);
          setTimeout(() => setOk(false), 1400);
        }
      }}
      className={cn("icon-btn !size-7 shrink-0 text-fg-3", className)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={ok ? "ok" : "copy"} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ type: "spring", stiffness: 520, damping: 30 }}>
          {ok ? <Check className="size-3.5 text-green" /> : <Copy className="size-3.5" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export type BeteiligtenRolle = "Mandant" | "Gegner" | "Gegneranwalt" | "Gericht" | "Versicherung" | "Schuldner";

/** Alle Akten, in denen ein Kontakt vorkommt – mit seiner Rolle in der jeweiligen Akte. */
export function aktenVonKontakt(k: Kontakt, akten: Akte[]): { akte: Akte; rolle: BeteiligtenRolle }[] {
  const out: { akte: Akte; rolle: BeteiligtenRolle }[] = [];
  for (const a of akten) {
    if (a.mandantId === k.id) out.push({ akte: a, rolle: "Mandant" });
    else if (a.gegnerId === k.id) out.push({ akte: a, rolle: "Gegner" });
    else if (a.forderung?.schuldnerId === k.id) out.push({ akte: a, rolle: "Schuldner" });
    else if (a.gegneranwaltId === k.id) out.push({ akte: a, rolle: "Gegneranwalt" });
    else if (a.gerichtId === k.id) out.push({ akte: a, rolle: "Gericht" });
    else if (a.rsv?.versicherung && a.rsv.versicherung === k.name) out.push({ akte: a, rolle: "Versicherung" });
  }
  return out;
}

export interface Konflikt {
  alsMandant: Akte[];
  alsGegner: Akte[];
}

/** Interessenkonflikt-Prüfung (§ 43a Abs. 4 BRAO): Kontakt ist in einer Akte Mandant und in einer anderen Gegner. */
export function useInteressenkonflikte(): Map<string, Konflikt> {
  const akten = useCol("akten");
  return useMemo(() => {
    const mandant = new Map<string, Akte[]>();
    const gegner = new Map<string, Akte[]>();
    for (const a of akten) {
      if (a.status === "abgeschlossen") continue;
      mandant.set(a.mandantId, [...(mandant.get(a.mandantId) ?? []), a]);
      const g = new Set([a.gegnerId, a.forderung?.schuldnerId].filter(Boolean) as string[]);
      for (const id of g) gegner.set(id, [...(gegner.get(id) ?? []), a]);
    }
    const out = new Map<string, Konflikt>();
    for (const [id, alsMandant] of mandant) {
      const alsGegner = (gegner.get(id) ?? []).filter((a) => !alsMandant.some((m) => m.id === a.id));
      if (alsGegner.length) out.set(id, { alsMandant, alsGegner });
    }
    return out;
  }, [akten]);
}

const FIRMEN_MUSTER = /\b(GmbH|AG|KG|OHG|GbR|UG|e\.\s?V\.|eG|SE|mbB|PartG|Versicherung|VVaG|Verwaltung|Gericht|Amtsgericht|Landgericht|Rechtsanw|Kanzlei|Stadt|Landkreis|Hausverwaltung|Bank|Sparkasse|& )/i;

/** Rät aus einem Namen, ob es sich um eine Person oder eine Organisation handelt. */
export function istOrganisationsName(name: string): boolean {
  return FIRMEN_MUSTER.test(name);
}

/** Findet einen bestehenden Kontakt per Name (ohne Groß-/Kleinschreibung). */
export function findeKontaktNachName(kontakte: Kontakt[], name: string): Kontakt | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return kontakte.find((k) => k.name.trim().toLowerCase() === n);
}
