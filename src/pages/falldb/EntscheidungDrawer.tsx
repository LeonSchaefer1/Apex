import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { BookMarked, Check, ChevronRight, Copy, FolderOpen, Gavel, Lightbulb, Paperclip, Scale, Sparkles, X } from "lucide-react";
import type { Akte, Entscheidung } from "@/core/types";
import { RECHTSPRECHUNG_HINWEIS } from "@/core/rechtsprechung";
import { fmtDateLong, nowLocal } from "@/core/dates";
import { useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast, useUI } from "@/store/ui";
import { Button, Chip, Drawer, Field, Select } from "@/components/ui";
import { GERICHT_NAME, aehnlicheEntscheidungen, passendeAkten, zitat } from "./recherche";
import { GerichtSiegel } from "./EntscheidungKarte";
import { kopiereText } from "./zwischenablage";
import { titelInKlammern } from "@/pages/ki/schriftsatz";

/** Detailansicht einer Entscheidung: Leitsatz, Bedeutung, Zitat, Anheften an Akte, ähnliche Entscheidungen. */
export function EntscheidungDrawer({ e, onClose, onOpen }: { e: Entscheidung | undefined; onClose: () => void; onOpen: (id: string) => void }) {
  // Letzte Entscheidung festhalten, damit der Drawer beim Schließen nicht leer animiert.
  const [letzte, setLetzte] = useState<Entscheidung | undefined>(e);
  useEffect(() => {
    if (e) setLetzte(e);
  }, [e]);
  const shown = e ?? letzte;
  return (
    <Drawer
      open={!!e}
      onClose={onClose}
      width={600}
      icon={<Scale className="size-[18px]" />}
      title={shown?.titel ?? ""}
      subtitle={shown ? <span className="mono">{zitat(shown)}</span> : undefined}
    >
      {shown && <Inhalt key={shown.id} e={shown} onOpen={onOpen} onClose={onClose} />}
    </Drawer>
  );
}

function Inhalt({ e, onOpen, onClose }: { e: Entscheidung; onOpen: (id: string) => void; onClose: () => void }) {
  const nav = useNavigate();
  const { user } = useKanzlei();
  const akten = useData((s) => s.data.akten);
  const zitatRef = useRef<HTMLDivElement>(null);
  const [kopiert, setKopiert] = useState(false);

  const offene = useMemo(() => akten.filter((a) => a.status === "offen").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [akten]);
  const vorschlaege = useMemo(() => passendeAkten(e, offene).slice(0, 5), [e, offene]);
  const geheftetAn = useMemo(() => akten.filter((a) => a.entscheidungen?.includes(e.id)), [akten, e.id]);
  const aehnliche = useMemo(() => aehnlicheEntscheidungen(e, 3), [e]);
  const [akteId, setAkteId] = useState<string>(() => (vorschlaege.find((a) => !a.entscheidungen?.includes(e.id)) ?? offene[0])?.id ?? "");

  const z = zitat(e);

  const kopieren = async () => {
    const r = await kopiereText(z, zitatRef.current);
    if (r === "kopiert") {
      setKopiert(true);
      setTimeout(() => setKopiert(false), 1800);
      toast("Zitat kopiert", { text: z, ton: "erfolg" });
    } else if (r === "markiert") {
      toast("Zitat markiert", { text: "Kopieren Sie es mit ⌘C bzw. Strg+C.", ton: "info" });
    } else {
      toast("Kopieren nicht möglich", { text: "Bitte markieren Sie das Zitat von Hand.", ton: "warnung" });
    }
  };

  const anheften = () => {
    const akte = akten.find((a) => a.id === akteId);
    if (!akte) {
      toast("Bitte eine Akte wählen", { ton: "warnung" });
      return;
    }
    if (akte.entscheidungen?.includes(e.id)) {
      toast("Bereits an dieser Akte", { text: `${akte.aktenzeichen} · ${akte.titel}`, ton: "info" });
      return;
    }
    const liste = Array.from(new Set([...(akte.entscheidungen ?? []), e.id]));
    useData.getState().patch("akten", akte.id, { entscheidungen: liste, updatedAt: nowLocal() });
    useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Entscheidung ${z} („${e.titel}“) an Akte ${akte.aktenzeichen} geheftet`, minutenGespart: 5, icon: "library" });
    toast("An Akte geheftet", {
      text: `${e.gericht} ${e.az} → ${akte.aktenzeichen}`,
      ton: "erfolg",
      aktion: { label: "Akte öffnen", onClick: () => nav(`/akten/${akte.id}`) },
    });
  };

  const loesen = (akte: Akte) => {
    useData.getState().patch("akten", akte.id, { entscheidungen: (akte.entscheidungen ?? []).filter((x) => x !== e.id), updatedAt: nowLocal() });
    useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Entscheidung ${z} von Akte ${akte.aktenzeichen} gelöst` });
    toast("Von Akte gelöst", { text: akte.aktenzeichen, ton: "info" });
  };

  const bereitsGewaehlt = !!akten.find((a) => a.id === akteId)?.entscheidungen?.includes(e.id);
  const rest = offene.filter((a) => !vorschlaege.includes(a));

  return (
    <div className="grid gap-5 pt-1">
      {/* Kopf: Gericht, Spruchkörper, Art, Datum */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
        <GerichtSiegel e={e} />
        <div className="min-w-0 flex-1 text-[13px]">
          <div className="font-semibold">{GERICHT_NAME[e.gericht] ?? e.gericht}</div>
          <div className="text-fg-3">
            {[e.spruchkoerper, e.art, fmtDateLong(e.datum)].filter(Boolean).join(" · ")}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip tone="ink" className="mono">
              {e.az}
            </Chip>
            <Chip>{e.rechtsgebiet}</Chip>
          </div>
        </div>
      </motion.div>

      <section>
        <div className="eyebrow mb-2 flex items-center gap-1.5">
          <Gavel className="size-3.5" /> Leitsatz (sinngemäß)
        </div>
        <blockquote className="rounded-[16px] border-l-2 border-[var(--ink)] bg-[var(--ink-softer)] px-4 py-3 text-[14px] leading-relaxed text-fg">{e.leitsatz}</blockquote>
      </section>

      <section>
        <div className="eyebrow mb-2 flex items-center gap-1.5">
          <Lightbulb className="size-3.5" /> Bedeutung für die Praxis
        </div>
        <p className="text-[14px] leading-relaxed text-fg-2">{e.bedeutung}</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <div className="eyebrow mb-2">Normen</div>
          <div className="flex flex-wrap gap-1.5">
            {e.normen.map((n) => (
              <Chip key={n} tone="outline" className="mono !font-normal">
                {n}
              </Chip>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <div className="eyebrow mb-2">Schlagworte</div>
          <div className="flex flex-wrap gap-1.5">
            {e.schlagworte.map((s) => (
              <Chip key={s}>{s}</Chip>
            ))}
          </div>
        </div>
      </section>

      {/* Zitat */}
      <section className="sheet rounded-[18px] p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="eyebrow flex items-center gap-1.5">
            <BookMarked className="size-3.5" /> Zitierfähig
          </div>
          <Button size="sm" variant="secondary" onClick={kopieren} icon={kopiert ? <Check className="size-4 text-green" /> : <Copy className="size-4" />}>
            {kopiert ? "Kopiert" : "Zitierfähig kopieren"}
          </Button>
        </div>
        <div ref={zitatRef} className="mono select-all break-words rounded-[10px] bg-[var(--ink-softer)] px-3 py-2.5 text-[13px] text-fg">
          {z}
        </div>
      </section>

      {/* Anheften */}
      <section className="sheet rounded-[18px] p-4">
        <div className="eyebrow mb-3 flex items-center gap-1.5">
          <Paperclip className="size-3.5" /> An Akte heften
        </div>
        {offene.length ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Offene Akte" htmlFor="falldb-akte" className="flex-1">
              <Select id="falldb-akte" value={akteId} onChange={(ev) => setAkteId(ev.target.value)}>
                {vorschlaege.length > 0 && (
                  <optgroup label="Passend zu dieser Entscheidung">
                    {vorschlaege.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.aktenzeichen} · {a.titel}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label={vorschlaege.length ? "Weitere offene Akten" : "Offene Akten"}>
                  {rest.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.aktenzeichen} · {a.titel}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </Field>
            <Button variant="primary" onClick={anheften} disabled={!akteId || bereitsGewaehlt} icon={bereitsGewaehlt ? <Check className="size-4" /> : <Paperclip className="size-4" />}>
              {bereitsGewaehlt ? "Bereits geheftet" : "An Akte heften"}
            </Button>
          </div>
        ) : (
          <p className="text-[13px] text-fg-3">Keine offene Akte vorhanden.</p>
        )}
        <AnimatePresence initial={false}>
          {geheftetAn.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-3 border-t border-[var(--line)] pt-3">
                <div className="mb-2 text-[12px] text-fg-3">Geheftet an</div>
                <ul className="grid gap-1.5">
                  {geheftetAn.map((a) => (
                    <motion.li layout key={a.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex min-w-0 items-center gap-2 rounded-[12px] bg-[var(--ink-softer)] py-1.5 pl-3 pr-1.5">
                      <FolderOpen className="size-4 shrink-0 text-ink" />
                      <button type="button" className="min-w-0 flex-1 truncate text-left text-[13px] hover:underline" onClick={() => nav(`/akten/${a.id}`)}>
                        <span className="mono mr-1.5 text-fg-3">{a.aktenzeichen}</span>
                        {a.titel}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          nav(`/ki?tab=fallanalyse&akte=${a.id}`);
                        }}
                        className="hidden shrink-0 rounded-full px-2 py-1 text-[12px] font-medium text-violet hover:bg-violet-soft sm:inline-flex sm:items-center sm:gap-1"
                      >
                        <Sparkles className="size-3.5" /> Fallanalyse
                      </button>
                      <button type="button" aria-label={`Von ${a.aktenzeichen} lösen`} title="Von Akte lösen" onClick={() => loesen(a)} className="icon-btn !size-7 shrink-0 text-fg-3">
                        <X className="size-3.5" />
                      </button>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Ähnliche */}
      {aehnliche.length > 0 && (
        <section>
          <div className="eyebrow mb-2">Ähnliche Entscheidungen</div>
          <ul className="grid gap-2">
            {aehnliche.map((x, i) => (
              <motion.li key={x.id} className="min-w-0" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.04 }}>
                <button type="button" onClick={() => onOpen(x.id)} className="group flex w-full items-center gap-3 rounded-[16px] p-2.5 text-left ring-1 ring-[var(--line)] transition-colors hover:bg-[var(--ink-softer)]">
                  <GerichtSiegel e={x} groesse="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{x.titel}</span>
                    <span className="mono block truncate text-[12.5px] text-fg-3">{zitat(x)}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-fg-3 transition-transform group-hover:translate-x-0.5" />
                </button>
              </motion.li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-4">
        <Button
          variant="ghost"
          size="sm"
          icon={<Sparkles className="size-4 text-violet" />}
          onClick={() => {
            onClose();
            // Bezug zur Akte: die angeheftete bzw. am besten passende offene Akte – dann antwortet der Assistent konkret dazu
            const bezug = geheftetAn.find((a) => a.status === "offen") ?? vorschlaege[0];
            useUI.getState().oeffneAssistent(`Wie nutze ich ${z} ${titelInKlammern(e.titel)} in meiner Argumentation${bezug ? ` für Akte ${bezug.aktenzeichen}` : ""}?`);
          }}
        >
          Mit dem Assistenten besprechen
        </Button>
      </div>
      <p className="-mt-2 text-[12.5px] leading-snug text-fg-3">{RECHTSPRECHUNG_HINWEIS}</p>
    </div>
  );
}
