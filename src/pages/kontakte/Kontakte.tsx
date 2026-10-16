import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, AtSign, ChevronRight, FolderOpen, Phone, Plus, UserPlus, Users } from "lucide-react";
import type { Akte, Kontakt, KontaktRolle } from "@/core/types";
import { search } from "@/core/search";
import { useCol } from "@/store/data";
import { Button, Chip, Empty, PageHeader, SearchField, Segmented } from "@/components/ui";
import { Highlight } from "@/components/Highlight";
import { cn } from "@/lib/cn";
import { KontaktAvatar, ROLLE_LABEL, ROLLE_TONE, istTelefonSuche, telefonPasst, useInteressenkonflikte } from "./kontaktHelfer";
import { KontaktDrawer } from "./KontaktDrawer";
import { NeuerKontakt } from "./NeuerKontakt";

type RollenFilter = "alle" | "mandant" | "gegner" | "gericht" | "versicherung" | "sonstige";

const SONSTIGE: KontaktRolle[] = ["gegneranwalt", "behoerde", "sonstige"];

function passt(k: Kontakt, f: RollenFilter): boolean {
  if (f === "alle") return true;
  if (f === "sonstige") return k.rollen.length === 0 || k.rollen.some((r) => SONSTIGE.includes(r));
  return k.rollen.includes(f);
}

function sortName(k: Kontakt): string {
  return k.typ === "person" ? `${k.nachname ?? k.name} ${k.vorname ?? ""}` : k.name;
}

const SEITE = 60;

/** Kontakte – Mandanten, Gegner, Gerichte und Versicherungen mit verknüpften Akten und Kollisionsprüfung. */
export default function Kontakte() {
  const kontakte = useCol("kontakte");
  const akten = useCol("akten");
  const konflikte = useInteressenkonflikte();
  const [params, setParams] = useSearchParams();
  const [rolle, setRolle] = useState<RollenFilter>("alle");
  const [q, setQ] = useState("");
  const [nurKonflikte, setNurKonflikte] = useState(false);
  const [anzahl, setAnzahl] = useState(SEITE);
  const [neu, setNeu] = useState(false);
  const offenId = params.get("id");

  const aktenJeKontakt = useMemo(() => {
    const m = new Map<string, Akte[]>();
    const add = (id: string | undefined, a: Akte) => {
      if (!id) return;
      const l = m.get(id) ?? [];
      if (!l.includes(a)) l.push(a);
      m.set(id, l);
    };
    const nachName = new Map(kontakte.map((k) => [k.name, k.id]));
    for (const a of akten) {
      add(a.mandantId, a);
      add(a.gegnerId, a);
      add(a.gegneranwaltId, a);
      add(a.gerichtId, a);
      add(a.forderung?.schuldnerId, a);
      if (a.rsv) add(nachName.get(a.rsv.versicherung), a);
    }
    return m;
  }, [akten, kontakte]);

  const zaehler = useMemo(() => {
    const c: Record<RollenFilter, number> = { alle: kontakte.length, mandant: 0, gegner: 0, gericht: 0, versicherung: 0, sonstige: 0 };
    for (const k of kontakte) for (const f of ["mandant", "gegner", "gericht", "versicherung", "sonstige"] as const) if (passt(k, f)) c[f]++;
    return c;
  }, [kontakte]);

  const liste = useMemo(() => {
    let l = kontakte.filter((k) => passt(k, rolle));
    if (nurKonflikte) l = l.filter((k) => konflikte.has(k.id));
    if (q.trim()) {
      const treffer = search(l, q, [
        { get: (k) => k.name, weight: 4 },
        { get: (k) => k.firma, weight: 2 },
        { get: (k) => k.email, weight: 2 },
        { get: (k) => [k.strasse, k.plz, k.ort].filter(Boolean).join(" "), weight: 1 },
        { get: (k) => k.telefon?.replace(/\s/g, ""), weight: 1 },
      ], 500).map((h) => h.item);
      if (!istTelefonSuche(q)) return treffer;
      // Telefonnummern im angezeigten Format („030 1234 …“, „+49 30 …“) ziffernweise vergleichen
      const tel = l.filter((k) => telefonPasst(k.telefon, q));
      const schon = new Set(tel.map((k) => k.id));
      return [...tel, ...treffer.filter((k) => !schon.has(k.id))];
    }
    return [...l].sort((a, b) => sortName(a).localeCompare(sortName(b), "de"));
  }, [kontakte, rolle, q, nurKonflikte, konflikte]);

  const oeffne = (id: string | null) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (id) n.set("id", id);
        else n.delete("id");
        return n;
      },
      { replace: true },
    );

  const offen = offenId ? kontakte.find((k) => k.id === offenId) : undefined;

  return (
    <div>
      <PageHeader
        title="Kontakte"
        hilfe="kontakte"
        subtitle="Mandanten, Gegner, Gerichte und Versicherungen an einem Ort – jeder Kontakt mit allen verknüpften Akten und automatischer Prüfung auf Interessenkonflikte."
        actions={
          <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setNeu(true)}>
            Neuer Kontakt
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Segmented<RollenFilter>
          value={rolle}
          onChange={(v) => {
            setRolle(v);
            setAnzahl(SEITE);
          }}
          options={[
            { value: "alle", label: "Alle", count: zaehler.alle },
            { value: "mandant", label: "Mandanten", count: zaehler.mandant },
            { value: "gegner", label: "Gegner", count: zaehler.gegner },
            { value: "gericht", label: "Gerichte", count: zaehler.gericht },
            { value: "versicherung", label: "Versicherungen", count: zaehler.versicherung },
            { value: "sonstige", label: "Sonstige", count: zaehler.sonstige },
          ]}
        />
        {konflikte.size > 0 && (
          <button
            type="button"
            onClick={() => setNurKonflikte((v) => !v)}
            aria-pressed={nurKonflikte}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold transition-colors",
              nurKonflikte ? "bg-seal text-surface shadow-[0_6px_16px_-8px_var(--seal)]" : "bg-seal-soft text-seal hover:bg-[color-mix(in_oklab,var(--seal)_18%,transparent)]",
            )}
            title="Kontakte, die in einer Akte Mandant und in einer anderen Gegner sind"
          >
            <AlertTriangle className="size-3.5" />
            {konflikte.size} {konflikte.size === 1 ? "möglicher Interessenkonflikt" : "mögliche Interessenkonflikte"}
          </button>
        )}
        <SearchField
          id="kontakte-suche"
          value={q}
          onChange={(v) => {
            setQ(v);
            setAnzahl(SEITE);
          }}
          placeholder="Name, E-Mail, Ort oder Telefon …"
          className="w-full sm:ml-auto sm:w-[300px]"
        />
      </div>

      {liste.length === 0 ? (
        <div className="sheet rounded-[22px]">
          <Empty
            icon={<Users className="size-6" />}
            title={kontakte.length ? "Kein Kontakt gefunden" : "Noch keine Kontakte"}
            text={kontakte.length ? "Ändern Sie die Suche oder wählen Sie eine andere Rolle." : "Kontakte entstehen automatisch bei der Mandatsaufnahme – oder Sie legen sie hier an."}
            action={
              <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => setNeu(true)}>
                Kontakt anlegen
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-4">
            <AnimatePresence initial={false}>
              {liste.slice(0, anzahl).map((k, i) => (
                <motion.li
                  key={k.id}
                  layout="position"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 10) * 0.03, type: "spring", stiffness: 420, damping: 34 } }}
                  exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                  className="min-w-0"
                >
                  <KontaktKarte k={k} q={q} akten={aktenJeKontakt.get(k.id) ?? []} konflikt={konflikte.has(k.id)} aktiv={k.id === offenId} onClick={() => oeffne(k.id)} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1 text-[12px] text-fg-3">
            <span>
              {Math.min(anzahl, liste.length)} von {liste.length} {liste.length === 1 ? "Kontakt" : "Kontakten"}
              {q.trim() ? " · nach Relevanz" : " · alphabetisch nach Nachname"}
            </span>
            {liste.length > anzahl && (
              <Button size="sm" variant="secondary" onClick={() => setAnzahl((a) => a + SEITE)}>
                Weitere {Math.min(SEITE, liste.length - anzahl)} anzeigen
              </Button>
            )}
          </div>
        </>
      )}

      <KontaktDrawer k={offen} akten={offen ? aktenJeKontakt.get(offen.id) ?? [] : []} konflikt={offen ? konflikte.get(offen.id) : undefined} onClose={() => oeffne(null)} />
      {/* Keine stille Vorbelegung der Rolle – der Filter bestimmt nur, ob eine Person oder Organisation vorgeschlagen wird */}
      <NeuerKontakt open={neu} onClose={() => setNeu(false)} rolle={rolle === "alle" || rolle === "sonstige" ? undefined : rolle} onAngelegt={(id) => oeffne(id)} />
    </div>
  );
}

function KontaktKarte({ k, q, akten, konflikt, aktiv, onClick }: { k: Kontakt; q: string; akten: Akte[]; konflikt: boolean; aktiv: boolean; onClick: () => void }) {
  const offene = akten.filter((a) => a.status !== "abgeschlossen");
  const ort = [k.plz, k.ort].filter(Boolean).join(" ");
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "sheet glow group relative flex h-full w-full flex-col rounded-[22px] p-3.5 text-left sm:p-4 transition-[transform,box-shadow] duration-300 ease-[var(--spring)] hover:-translate-y-0.5 hover:shadow-glass active:scale-[0.99]",
        aktiv && "shadow-[0_0_0_1.5px_var(--ink)]",
        konflikt && !aktiv && "shadow-[0_0_0_1px_color-mix(in_oklab,var(--seal)_45%,transparent)]",
      )}
    >
      <div className="relative flex w-full items-start gap-3">
        <KontaktAvatar k={k} size={44} />
        <div className="min-w-0 flex-1">
          <div className="title-md truncate">
            <Highlight text={k.name} q={q} />
          </div>
          <div className="truncate text-[12.5px] text-fg-3">{[ort, k.typ === "person" ? "Person" : "Organisation"].filter(Boolean).join(" · ")}</div>
        </div>
        {konflikt && (
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-seal-soft text-seal" title="Möglicher Interessenkonflikt">
            <AlertTriangle className="size-3.5" />
          </span>
        )}
      </div>
      <div className="relative mt-2.5 flex flex-wrap gap-1 sm:mt-3">
        {k.rollen.map((r) => (
          <Chip key={r} tone={ROLLE_TONE[r]}>
            {ROLLE_LABEL[r]}
          </Chip>
        ))}
      </div>
      <div className="relative mt-2 truncate text-[12.5px] text-fg-3 sm:hidden">{[k.email, k.telefon].filter(Boolean).join(" · ") || "keine Kontaktdaten"}</div>
      <div className="relative mt-3 hidden w-full grid-cols-1 gap-1 text-[12.5px] text-fg-2 sm:grid">
        <span className="flex min-w-0 items-center gap-2">
          <AtSign className="size-3.5 shrink-0 text-fg-3" />
          <span className={cn("truncate", !k.email && "text-fg-3")}>{k.email ? <Highlight text={k.email} q={q} /> : "keine E-Mail"}</span>
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <Phone className="size-3.5 shrink-0 text-fg-3" />
          <span className={cn("num truncate", !k.telefon && "text-fg-3", istTelefonSuche(q) && telefonPasst(k.telefon, q) && "rounded-[6px] bg-ink-soft px-1 font-medium text-ink")}>{k.telefon ?? "kein Telefon"}</span>
        </span>
      </div>
      <div className="flex-1" />
      <div className="relative mt-3 flex w-full items-center gap-2 border-t border-[var(--line)] pt-2.5 text-[12.5px] sm:mt-3.5 sm:pt-3">
        <FolderOpen className="size-3.5 text-fg-3" />
        <span className="text-fg-2">
          {akten.length === 0 ? (
            <span className="text-fg-3">keine Akte</span>
          ) : (
            <>
              <span className="num font-semibold text-fg">{akten.length}</span> {akten.length === 1 ? "Akte" : "Akten"}
              {offene.length !== akten.length && <span className="text-fg-3">, {offene.length === 0 ? "keine offen" : `davon ${offene.length} offen`}</span>}
            </>
          )}
        </span>
        {akten[0] && <span className="mono ml-1 truncate text-[12.5px] text-fg-3">{akten.slice(0, 3).map((a) => a.aktenzeichen).join(" · ")}</span>}
        <ChevronRight className="ml-auto size-4 shrink-0 text-fg-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
      </div>
    </button>
  );
}
