import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
import { merkeAkteGeoeffnet } from "./AktenSuchauswahl";
import { darfAbrechnung } from "@/lib/backend";
import { useMedia } from "@/lib/useMedia";

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
  // Desktop-Hinweise (Ziehen, Doppelklick, Tastenkürzel) nur mit Maus bzw. Trackpad
  const feinZeiger = useMedia("(pointer: fine)");
  const [params, setParams] = useSearchParams();
  const roh = params.get("tab") as TabKey | null;
  const tab: TabKey = roh && TABS.includes(roh) && !(roh === "aktenkonto" && !darfAbrechnung(user.rolle)) ? roh : "uebersicht";
  const [emailOffen, setEmailOffen] = useState(false);
  const [fristOffen, setFristOffen] = useState<false | "regel" | "frei">(false);
  const [notizOffen, setNotizOffen] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  // Aktenkonto ist für Auszubildende ausgeblendet (Rechte laut Rolle)
  const ohneAktenkonto = !darfAbrechnung(user.rolle);
  // „Zuletzt geöffnet“ für die Aktenwahl mit Suche (Posteingang u. a., I4-T02-01)
  useEffect(() => {
    if (akte?.id) merkeAkteGeoeffnet(user.id, akte.id);
  }, [akte?.id, user.id]);
  // Telefon (< sm): Aktionsleiste „Notiz · Frist · Wiedervorlage“ im Daumenbereich, sobald die Knopfreihe des Aktenkopfs aus
  // dem Bild gescrollt ist – verschwindet wieder, wenn der Kopf sichtbar ist (I5-T14-01)
  const telefon = useMedia("(max-width: 639px)");
  const [kopfAktionenWeg, setKopfAktionenWeg] = useState(false);
  useEffect(() => {
    if (!telefon) return setKopfAktionenWeg(false);
    const el = document.getElementById("akte-kopf-aktionen");
    const root = document.getElementById("haupt-scroll");
    if (!el || typeof IntersectionObserver === "undefined") return;
    // Nur „nach oben weggescrollt“ zählt (Reihe liegt über dem sichtbaren Bereich), nicht „noch unterhalb“
    const io = new IntersectionObserver(([e]) => setKopfAktionenWeg(!e.isIntersecting && e.boundingClientRect.top < (e.rootBounds?.top ?? 0) + 1), { root, threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [akte?.id, telefon]);
  // Kompakter Kurzkopf, sobald der Aktenkopf aus dem Bild gescrollt ist
  const kopfRef = useRef<HTMLDivElement>(null);
  const [kompakt, setKompakt] = useState(false);
  useEffect(() => {
    const el = kopfRef.current;
    const root = document.getElementById("haupt-scroll");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setKompakt(!e.isIntersecting), { root, rootMargin: "-22px 0px 0px 0px", threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [akte?.id]);

  // Kurzkopf in der Ebene unter der Kopfleiste (AppShell, außerhalb der Scrollfläche) – gleiche Lage wie bisher, aber keine
  // Bedienelemente der Akte laufen in derselben Ebene unter seine Knöpfe; Breite der Scrollleiste wird ausgespart.
  const [ebene, setEbene] = useState<HTMLElement | null>(null);
  useEffect(() => setEbene(document.getElementById("kopf-ebene")), []);
  const [leiste, setLeiste] = useState(0);
  useEffect(() => {
    const sc = document.getElementById("haupt-scroll");
    if (kompakt && sc) setLeiste(sc.offsetWidth - sc.clientWidth);
  }, [kompakt]);

  // Fokus nie unter dem Kurzkopf (WCAG 2.4.11): Solange er steht (ab md), hält die Scrollfläche oben seinen Platz frei
  useEffect(() => {
    const sc = document.getElementById("haupt-scroll");
    if (!sc) return;
    const breit = window.matchMedia("(min-width: 768px)").matches;
    sc.style.scrollPaddingTop = kompakt && breit ? "64px" : "";
    return () => {
      sc.style.scrollPaddingTop = "";
    };
  }, [kompakt]);

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
        // Platz für den Kurzkopf (Desktop) lassen – die Kopfleiste liegt über der Scrollfläche
        const versatz = window.matchMedia("(min-width: 768px)").matches ? 72 : 20;
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
    // Ein Deep-Link auf ein Dokument (…&dok=…, ggf. &bearbeiten=1) bleibt erhalten – die Vorschau öffnet sich direkt
    const dok = params.get("dok");
    const bearbeiten = params.get("bearbeiten");
    const extra = { ...(dok ? { dok } : {}), ...(bearbeiten ? { bearbeiten } : {}) };
    if (tab !== "uebersicht") setTimeout(() => zuTabs(tab, extra, { sofort: true }), 60);
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
      {/* Kurzkopf (ohne Layoutsprung): Aktenzeichen, Titel und die wichtigsten Aktionen – über der Scrollfläche */}
      {ebene &&
        createPortal(
          <div style={{ paddingRight: leiste }}>
            <div className="mx-auto w-full max-w-[1480px] px-4 pt-2.5 md:px-8">
              <div className="relative">
                <AnimatePresence>
                  {kompakt && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ type: "spring", stiffness: 460, damping: 36 }}
                      className="glass-strong glass-deckend pointer-events-auto absolute inset-x-0 top-0 hidden items-center gap-3 rounded-full py-1.5 pl-4 pr-1.5 md:flex"
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
            </div>
          </div>,
          ebene,
        )}
      <div className="-mb-1 flex items-center gap-2">
        <Link to={`/akten${listenKontext.suche}`} className="inline-flex h-8 items-center gap-1 rounded-full pl-1.5 pr-3 text-[13px] font-medium text-fg-3 transition-colors hover:bg-ink-softer hover:text-fg max-sm:h-11">
          <ChevronLeft className="size-4" /> Alle Akten
        </Link>
      </div>

      <motion.div ref={kopfRef} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 380, damping: 34 }}>
        <AkteKopf akte={akte} onEmail={() => setEmailOffen(true)} onFrist={() => setFristOffen("regel")} onKi={() => zuTabs("ki")} onNotiz={() => setNotizOffen(true)} onWiedervorlage={() => setFristOffen("frei")} />
      </motion.div>

      <div ref={tabsRef} className="grid grid-cols-1 gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Segmented<TabKey>
            value={tab}
            onChange={(t) => zuTabs(t)}
            className="max-w-full"
            mobilGross
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
        <p className="-mt-1 px-1 text-[12.5px] text-fg-3">{tab === "dokumente" && !feinZeiger ? TAB_ERKLAERUNG_TOUCH : TAB_ERKLAERUNG[tab]}</p>

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

      {/* Telefon: Notiz, Frist und Wiedervorlage im Aktenkopf (44 px, I4-T14-01) – nach dem Scrollen zusätzlich als schmale Leiste
          im Daumenbereich über der Tab-Leiste, rechts frei für die Assistent-Kugel (wie die Ergebnisleiste des RVG-Rechners).
          Der untere Innenabstand des Inhalts (Tab-Leiste + 76 px) hält das letzte Dokument darüber scrollbar. */}
      {telefon &&
        createPortal(
          <AnimatePresence>
            {kopfAktionenWeg && (
              <motion.div
                key="akte-aktionsleiste"
                role="group"
                aria-label={`Schnellaktionen ${akte.aktenzeichen}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ type: "spring", stiffness: 480, damping: 36 }}
                data-akte-aktionsleiste
                className="glass-strong tabbar-deckend fixed bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+12px)] left-3 right-[84px] z-30 flex items-center gap-1 rounded-full p-1 sm:hidden"
                style={{ boxShadow: "var(--glass-shadow-lg)" }}
              >
                <AktionsKnopf icon={<StickyNote className="size-4" />} onClick={() => setNotizOffen(true)}>
                  Notiz
                </AktionsKnopf>
                <AktionsKnopf icon={<CalendarPlus className="size-4" />} onClick={() => setFristOffen("regel")}>
                  Frist
                </AktionsKnopf>
                <AktionsKnopf icon={<CalendarClock className="size-4" />} onClick={() => setFristOffen("frei")}>
                  <span className="min-[380px]:hidden" aria-hidden>
                    WV
                  </span>
                  <span className="max-[379px]:sr-only">Wiedervorlage</span>
                </AktionsKnopf>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
      <EmailComposer akte={akte} open={emailOffen} onClose={() => setEmailOffen(false)} onGesendet={(dokId) => setTab("dokumente", { dok: dokId })} />
    </div>
  );
}

/** Knopf der Aktionsleiste am Telefon: 44 px hoch, Symbol und sichtbare Beschriftung. */
function AktionsKnopf({ icon, onClick, children }: { icon: ReactNode; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 min-w-0 flex-auto items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[13px] font-medium text-fg transition-colors hover:bg-ink-softer active:bg-ink-soft"
    >
      <span className="shrink-0 text-ink">{icon}</span>
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

/** Ohne Maus (Tablet, Telefon): keine Hinweise auf Ziehen und Doppelklick. */
const TAB_ERKLAERUNG_TOUCH = "Die E-Akte: alle Schriftstücke in Ordnern – durchsuchbar im Volltext; verschieben und umbenennen über das Menü „⋯“ am Dokument.";

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
