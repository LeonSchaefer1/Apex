import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRightLeft, BookOpen, CircleHelp, Clock, FolderOpen, Inbox, Play, ReceiptEuro, Rocket, Sparkles, Users } from "lucide-react";
import { WIKI, type WikiArtikel } from "@/content/wiki";
import { search } from "@/core/search";
import { useUI } from "@/store/ui";
import { Button, Card, Chip, Empty, Modal, SearchField, Segmented } from "@/components/ui";
import { Highlight } from "@/components/Highlight";
import { WikiPlayer } from "@/components/wiki/WikiPlayer";

type Kat = WikiArtikel["kategorie"];
const KAT_ICON: Record<Kat, React.ReactNode> = {
  "Erste Schritte": <Rocket className="size-[18px]" />,
  "Akten & Fristen": <FolderOpen className="size-[18px]" />,
  Posteingang: <Inbox className="size-[18px]" />,
  "KI & Recherche": <Sparkles className="size-[18px]" />,
  Abrechnung: <ReceiptEuro className="size-[18px]" />,
  "Kanzlei & Team": <Users className="size-[18px]" />,
  Umzug: <ArrowRightLeft className="size-[18px]" />,
};

/** Animiertes Wiki: durchsuchbar, nach Themen gefiltert, jeder Artikel als kurze, animierte Anleitung. */
export function WikiBibliothek() {
  const [q, setQ] = useState("");
  const [kat, setKat] = useState<"alle" | Kat>("alle");
  const [offen, setOffenRoh] = useState<WikiArtikel | null>(null);
  const [zuletzt, setZuletzt] = useState<WikiArtikel | null>(null);
  const setOffen = (w: WikiArtikel | null) => {
    if (w) setZuletzt(w);
    setOffenRoh(w);
  };
  const gezeigt = offen ?? zuletzt;
  const { zeigeHilfe, oeffneAssistent } = useUI();

  const kategorien = useMemo(() => [...new Set(WIKI.map((w) => w.kategorie))], []);
  const treffer = useMemo(() => {
    const basis = kat === "alle" ? WIKI : WIKI.filter((w) => w.kategorie === kat);
    if (!q.trim()) return basis;
    return search(basis, q, [
      { get: (w) => w.titel, weight: 3 },
      { get: (w) => w.kurz, weight: 2 },
      { get: (w) => w.schritte.map((s) => `${s.titel} ${s.text}`).join(" "), weight: 1 },
      { get: (w) => (w.tipps ?? []).join(" "), weight: 1 },
    ]).map((h) => h.item);
  }, [q, kat]);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="title-lg">Animiertes Wiki</h2>
          <p className="mt-1 text-[13px] text-fg-3">Kurze Anleitungen, die Schritt für Schritt von selbst ablaufen – anhalten, vor- und zurückspulen, direkt zur Funktion springen.</p>
        </div>
        <SearchField id="wiki-suche" value={q} onChange={setQ} placeholder="Wiki durchsuchen, z. B. „Berufungsfrist“" className="w-full sm:w-[320px]" />
      </div>
      <div className="mb-4 max-w-full">
        <Segmented<"alle" | Kat>
          size="sm"
          value={kat}
          onChange={setKat}
          options={[{ value: "alle", label: "Alle", count: WIKI.length }, ...kategorien.map((k) => ({ value: k, label: k, count: WIKI.filter((w) => w.kategorie === k).length }))]}
        />
      </div>

      <button
        type="button"
        onClick={() => zeigeHilfe("hilfe")}
        className="mb-4 flex w-full items-center gap-3 rounded-[18px] bg-[var(--ink-softer)] px-4 py-3 text-left ring-1 ring-[var(--line)] transition-colors hover:bg-[var(--ink-soft)]"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--surface)] text-ink shadow-[0_0_0_1px_var(--line)]">
          <CircleHelp className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold">Schnellhilfe überall: das ?-Symbol neben jedem Seitentitel</span>
          <span className="block text-[12.5px] text-fg-3">Es öffnet genau die Anleitung zur Ansicht, in der Sie gerade arbeiten – ohne die Seite zu verlassen. Probieren Sie es hier aus.</span>
        </span>
      </button>

      {treffer.length === 0 ? (
        <Card>
          <Empty
            icon={<BookOpen className="size-6" />}
            title="Kein Artikel gefunden"
            text="Versuchen Sie ein anderes Stichwort – oder fragen Sie den Apex Assistenten, er kennt das ganze Wiki."
            action={
              <Button variant="ai" icon={<Sparkles className="size-4" />} onClick={() => oeffneAssistent(q ? `Wie funktioniert: ${q}?` : undefined)}>
                Assistent fragen
              </Button>
            }
          />
        </Card>
      ) : (
        <motion.div layout className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false} mode="popLayout">
            {treffer.map((w, i) => (
              <motion.button
                key={w.key}
                type="button"
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 460, damping: 36, delay: Math.min(i, 10) * 0.025 }}
                onClick={() => setOffen(w)}
                className="sheet group relative flex min-w-0 flex-col gap-2.5 rounded-[20px] p-4 text-left transition-[transform,box-shadow] duration-300 ease-[var(--spring)] hover:-translate-y-0.5 hover:shadow-glass"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-ink-soft text-ink">{KAT_ICON[w.kategorie]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold leading-snug">
                      <Highlight text={w.titel} q={q} />
                    </span>
                    <span className="block text-[11.5px] text-fg-4">{w.kategorie}</span>
                  </span>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--ink-softer)] text-ink transition-all duration-300 ease-[var(--spring)] group-hover:scale-110 group-hover:bg-ink group-hover:text-[var(--on-ink)]">
                    <Play className="ml-0.5 size-3.5" fill="currentColor" />
                  </span>
                </div>
                <p className="line-clamp-2 text-[12.5px] leading-relaxed text-fg-3">
                  <Highlight text={w.kurz} q={q} />
                </p>
                <div className="mt-auto flex flex-wrap gap-1.5">
                  <Chip icon={<Clock className="size-3" />}>{w.dauer}</Chip>
                  <Chip>{w.schritte.length === 1 ? "1 Schritt" : `${w.schritte.length} Schritte`}</Chip>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <Modal
        open={!!offen}
        onClose={() => setOffen(null)}
        title={gezeigt?.titel ?? ""}
        subtitle={gezeigt?.kurz}
        icon={gezeigt ? KAT_ICON[gezeigt.kategorie] : undefined}
        size="lg"
        footer={
          <Button
            variant="ai"
            icon={<Sparkles className="size-4" />}
            onClick={() => {
              const t = offen?.titel;
              setOffen(null);
              useUI.getState().oeffneAssistent(t ? `Erkläre mir bitte „${t}“ in AnwaltApex.` : undefined);
            }}
          >
            Assistent fragen
          </Button>
        }
      >
        {gezeigt && <WikiPlayer artikel={gezeigt} onNavigate={() => setOffen(null)} />}
      </Modal>
    </section>
  );
}
