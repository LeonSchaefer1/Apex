import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, CalendarPlus, ChevronLeft, FolderSearch, Mail, Sparkles, StickyNote } from "lucide-react";
import { nowLocal, uid } from "@/core/dates";
import type { Akte } from "@/core/types";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Card, Empty, Field, Modal, Segmented, Textarea } from "@/components/ui";
import { FallanalysePanel } from "@/components/ki/FallanalysePanel";
import { AkteKopf } from "./AkteKopf";
import { TabUebersicht } from "./TabUebersicht";
import { TabDokumente } from "./TabDokumente";
import { TabFristen } from "./TabFristen";
import { TabBeteiligte } from "./TabBeteiligte";
import { TabAktenkonto } from "./TabAktenkonto";
import { TabVerlauf } from "./TabVerlauf";
import { FristAnlegen } from "./FristAnlegen";
import { EmailComposer } from "./EmailComposer";
import { beruehreAkte, listenKontext } from "./helfer";
import { DiktatKnopf } from "./Diktat";
import { darfAbrechnung } from "@/lib/backend";

const TABS = ["uebersicht", "dokumente", "fristen", "beteiligte", "aktenkonto", "verlauf", "ki"] as const;
type TabKey = (typeof TABS)[number];

/** Akte – alles zu einem Mandat an einem Ort: E-Akte, Fristen, Beteiligte, Aktenkonto, Verlauf und KI-Fallanalyse. */
export default function AkteDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const akte = useData((s) => s.data.akten.find((a) => a.id === id));
  const dokumente = useCol("dokumente");
  const fristen = useCol("fristen");
  const { user } = useKanzlei();
  const [params, setParams] = useSearchParams();
  const roh = params.get("tab") as TabKey | null;
  const tab: TabKey = roh && TABS.includes(roh) && !(roh === "aktenkonto" && !darfAbrechnung(user.rolle)) ? roh : "uebersicht";
  const [emailOffen, setEmailOffen] = useState(false);
  const [fristOffen, setFristOffen] = useState<false | "regel" | "frei">(false);
  const [notizOffen, setNotizOffen] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  // Aktenkonto ist für Auszubildende ausgeblendet (Rechte laut Rolle)
  const ohneAktenkonto = !darfAbrechnung(user.rolle);
  // Kompakter Kurzkopf, sobald der Aktenkopf aus dem Bild gescrollt ist
  const kopfRef = useRef<HTMLDivElement>(null);
  const [kompakt, setKompakt] = useState(false);
  useEffect(() => {
    const el = kopfRef.current;
    const root = document.getElementById("haupt-scroll");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setKompakt(!e.isIntersecting), { root, rootMargin: "-90px 0px 0px 0px", threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [akte?.id]);

  const zahlen = useMemo(
    () => ({
      doks: dokumente.filter((d) => d.akteId === id).length,
      fristen: fristen.filter((f) => f.akteId === id && f.status === "offen" && f.typ !== "vorfrist").length,
    }),
    [dokumente, fristen, id],
  );

  const setTab = useCallback(
    (t: string, extra?: Record<string, string>) => {
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (t === "uebersicht") n.delete("tab");
          else n.set("tab", t);
          n.delete("dok");
          for (const [k, v] of Object.entries(extra ?? {})) n.set(k, v);
          return n;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  /** Reiter wechseln; bei Arbeitsreitern (E-Akte, Fristen …) rücken die Reiter nach oben – der Kurzkopf bleibt sichtbar. */
  const zuTabs = (t: string, extra?: Record<string, string>, opts: { sofort?: boolean } = {}) => {
    setTab(t, extra);
    requestAnimationFrame(() => {
      const el = tabsRef.current;
      const sc = document.getElementById("haupt-scroll");
      if (el && sc) {
        // Platz für Kopfleiste und Kurzkopf (Desktop) lassen
        const versatz = window.matchMedia("(min-width: 768px)").matches ? 140 : 88;
        const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - versatz;
        const behavior = opts.sofort || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        if (t !== "uebersicht" || top < sc.scrollTop) sc.scrollTo({ top: Math.max(0, top), behavior });
      }
    });
  };
  // Deep-Link direkt in einen Arbeitsreiter (z. B. ?tab=dokumente): Reiter sofort oben – die E-Akte ist ohne Scrollen sichtbar
  const ersterReiter = useRef(true);
  useEffect(() => {
    if (!ersterReiter.current || !akte) return;
    ersterReiter.current = false;
    if (tab !== "uebersicht") setTimeout(() => zuTabs(tab, undefined, { sofort: true }), 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [akte?.id]);

  if (!akte) {
    return (
      <Card className="mt-6">
        <Empty
          icon={<FolderSearch className="size-6" />}
          title="Akte nicht gefunden"
          text="Diese Akte gibt es nicht (mehr) oder sie gehört zu einer anderen Kanzlei. Über die Aktenliste finden Sie alle Mandate."
          action={
            <Button variant="primary" onClick={() => nav("/akten")}>
              Zur Aktenliste
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5">
      {/* Kurzkopf (sticky, ohne Layoutsprung): Aktenzeichen, Titel und die wichtigsten Aktionen */}
      <div className="sticky top-[78px] z-30 -mb-5 h-0">
        <AnimatePresence>
          {kompakt && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 460, damping: 36 }}
              className="glass-strong glass-deckend absolute inset-x-0 top-0 hidden items-center gap-3 rounded-full py-1.5 pl-4 pr-1.5 md:flex"
              style={{ boxShadow: "var(--glass-shadow)" }}
            >
              <span className="mono shrink-0 text-[13.5px] font-semibold">{akte.aktenzeichen}</span>
              <span className="line-clamp-1 min-w-0 flex-1 text-[13.5px] font-medium text-fg-2" title={akte.titel}>
                {akte.titel}
              </span>
              <Button size="sm" variant="ghost" icon={<Mail className="size-4" />} onClick={() => setEmailOffen(true)}>
                E-Mail
              </Button>
              <Button size="sm" variant="ghost" icon={<CalendarPlus className="size-4" />} onClick={() => setFristOffen("regel")}>
                Frist
              </Button>
              <Button size="sm" variant="ghost" icon={<CalendarClock className="size-4" />} onClick={() => setFristOffen("frei")}>
                Wiedervorlage
              </Button>
              <Button size="sm" variant="ai" icon={<Sparkles className="size-4" />} onClick={() => zuTabs("ki")}>
                KI
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="-mb-1 flex items-center gap-2">
        <Link to={`/akten${listenKontext.suche}`} className="inline-flex h-8 items-center gap-1 rounded-full pl-1.5 pr-3 text-[13px] font-medium text-fg-3 transition-colors hover:bg-ink-softer hover:text-fg">
          <ChevronLeft className="size-4" /> Alle Akten
        </Link>
      </div>

      <motion.div ref={kopfRef} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 380, damping: 34 }}>
        <AkteKopf akte={akte} onEmail={() => setEmailOffen(true)} onFrist={() => setFristOffen("regel")} onKi={() => zuTabs("ki")} />
      </motion.div>

      <div ref={tabsRef} className="grid grid-cols-1 gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Segmented<TabKey>
            value={tab}
            onChange={(t) => zuTabs(t)}
            className="max-w-full"
            options={[
              { value: "uebersicht", label: "Übersicht" },
              { value: "dokumente", label: "Dokumente", count: zahlen.doks },
              { value: "fristen", label: "Fristen", count: zahlen.fristen },
              { value: "beteiligte", label: "Beteiligte" },
              ...(ohneAktenkonto ? [] : [{ value: "aktenkonto" as const, label: akte.forderung ? "Aktenkonto & Forderung" : "Aktenkonto" }]),
              { value: "verlauf", label: "Verlauf" },
              { value: "ki", label: <span className={tab === "ki" ? "ai-text font-semibold" : undefined}>KI-Fallanalyse</span>, icon: <Sparkles className={tab === "ki" ? "size-3.5 text-violet" : "size-3.5"} /> },
            ]}
          />
        </div>
        <p className="-mt-1 px-1 text-[12.5px] text-fg-3">{TAB_ERKLAERUNG[tab]}</p>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} className="min-w-0">
            {tab === "uebersicht" && <TabUebersicht akte={akte} onTab={(t) => zuTabs(t)} onDok={(d) => zuTabs("dokumente", { dok: d })} onFrist={() => setFristOffen("regel")} />}
            {tab === "dokumente" && <TabDokumente akte={akte} />}
            {tab === "fristen" && <TabFristen akte={akte} onNeu={(m) => setFristOffen(m ?? "regel")} />}
            {tab === "beteiligte" && <TabBeteiligte akte={akte} />}
            {tab === "aktenkonto" && <TabAktenkonto akte={akte} />}
            {tab === "verlauf" && <TabVerlauf akte={akte} />}
            {tab === "ki" && <FallanalysePanel akteId={akte.id} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <FristAnlegen akte={akte} open={!!fristOffen} startModus={fristOffen || "regel"} onClose={() => setFristOffen(false)} />
      <NotizDialog akte={akte} open={notizOffen} onClose={() => setNotizOffen(false)} />

      {/* Mobil: feste Aktionsleiste über der Tab-Leiste, rechts mit Abstand zur Assistent-Kugel */}
      <div className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] left-3 right-[84px] z-30 md:hidden">
        <div className="glass-strong flex items-center gap-1 rounded-full p-1" style={{ boxShadow: "var(--glass-shadow)" }} role="toolbar" aria-label="Schnellaktionen der Akte">
          <button type="button" onClick={() => setNotizOffen(true)} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-medium text-fg-2 hover:bg-ink-softer">
            <StickyNote className="size-4" /> Notiz
          </button>
          <button type="button" onClick={() => setFristOffen("regel")} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-medium text-fg-2 hover:bg-ink-softer">
            <CalendarPlus className="size-4" /> Frist
          </button>
          <button type="button" onClick={() => setFristOffen("frei")} className="flex min-h-11 flex-[1.4] items-center justify-center gap-1.5 rounded-full text-[13px] font-medium text-fg-2 hover:bg-ink-softer">
            <CalendarClock className="size-4" /> Wiedervorlage
          </button>
        </div>
      </div>
      <EmailComposer akte={akte} open={emailOffen} onClose={() => setEmailOffen(false)} onGesendet={(dokId) => setTab("dokumente", { dok: dokId })} />
    </div>
  );
}

const TAB_ERKLAERUNG: Record<TabKey, string> = {
  uebersicht: "Das Wichtigste auf einen Blick: Sachverhalt, anstehende Fristen, neue Dokumente und interne Notizen.",
  dokumente: "Die E-Akte: alle Schriftstücke in Ordnern – durchsuchbar im Volltext, per Drag & Drop sortierbar, per Doppelklick umbenennbar.",
  fristen: "Alle Fristen, Wiedervorlagen und Termine dieser Akte – berechnet je Verfahrensordnung (z. B. § 222 ZPO, § 43 StPO) mit Rechenweg und Vier-Augen-Kontrolle.",
  beteiligte: "Wer an der Sache beteiligt ist – mit Kontaktdaten zum Kopieren und Verknüpfung ins Kontaktverzeichnis.",
  aktenkonto: "Honorar, Zahlungen, Vorschüsse und Fremdgeld dieser Akte – bei Forderungseinzug mit taggenauem Forderungskonto.",
  verlauf: "Lückenlose Chronik: was Ihr Team, die KI und der 38h-Motor in dieser Akte getan haben.",
  ki: "Erfolgsaussicht, passende Präzedenzfälle und nächste Schritte – nachvollziehbar mit Quellen.",
};

/** Schnelle Notiz (mobil aus der Aktionsleiste) – auch per Diktat. */
function NotizDialog({ akte, open, onClose }: { akte: Akte; open: boolean; onClose: () => void }) {
  const { user } = useKanzlei();
  const [text, setText] = useState("");
  useEffect(() => {
    if (open) setText("");
  }, [open]);
  const speichern = () => {
    const t = text.trim();
    if (!t) return;
    useData.getState().upsert("notizen", { id: uid("no"), akteId: akte.id, userId: user.id, text: t, zeit: nowLocal() });
    beruehreAkte(akte.id);
    onClose();
    toast("Notiz gespeichert", { ton: "erfolg", text: akte.aktenzeichen });
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Notiz zur Akte"
      subtitle={`${akte.aktenzeichen} · intern, für Mandanten nicht sichtbar`}
      icon={<StickyNote className="size-[18px]" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" disabled={!text.trim()} onClick={speichern}>
            Notiz speichern
          </Button>
        </>
      }
    >
      <Field label="Notiz" htmlFor="akte-notiz-schnell">
        <Textarea id="akte-notiz-schnell" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="z. B. Termin verlegt, Zeuge benannt …" />
      </Field>
      <div className="mt-2">
        <DiktatKnopf onText={(t) => setText((v) => (v.trim() ? `${v.trim()} ${t}` : t))} />
      </div>
    </Modal>
  );
}
