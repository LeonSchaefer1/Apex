// Reiter „Dokumente“ – die E-Akte: Ordner, Volltextsuche, Stapelaktionen, Drag & Drop, Umbenennen per Doppelklick.
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  FileText, Files, FolderInput, Gavel, Mail, MoreHorizontal, Paperclip, PenLine, Receipt, Send, StickyNote, Trash2, Upload, FileSignature, FileSearch, X, FileUp,
} from "lucide-react";
import type { Akte, Dokument } from "@/core/types";
import { fmtDate, nowLocal, uid } from "@/core/dates";
import { search, snippet } from "@/core/search";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { AiChip, Button, Card, Checkbox, Chip, Empty, Menu, SearchField, confirmDialog } from "@/components/ui";
import { Highlight } from "@/components/Highlight";
import { cn } from "@/lib/cn";
import { DOK_ART_LABEL, ORDNER, ORDNER_ICON, QUELLE_LABEL, beruehreAkte, fmtKb } from "./helfer";
import { DokumentVorschau } from "./DokumentVorschau";

type Ordner = Dokument["ordner"];
const DND_TYP = "application/x-apex-dokumente";

const ART_ICON: Partial<Record<Dokument["art"], typeof FileText>> = {
  email: Mail,
  bea: Send,
  urteil: Gavel,
  beschluss: Gavel,
  vollmacht: FileSignature,
  vertrag: FileSignature,
  rechnung: Receipt,
  notiz: StickyNote,
  anlage: Paperclip,
  gutachten: FileSearch,
  schriftsatz: PenLine,
};

export function DokIcon({ d, size = 38 }: { d: Dokument; size?: number }) {
  const Icon = ART_ICON[d.art] ?? FileText;
  return (
    <span className="relative inline-grid shrink-0 place-items-center rounded-[11px] bg-ink-soft text-ink" style={{ width: size, height: size }}>
      <Icon className="size-[18px]" strokeWidth={1.8} />
      <span className="absolute -bottom-1 -right-1 rounded-[5px] bg-[var(--surface)] px-1 text-[8.5px] font-bold uppercase leading-[13px] tracking-[0.04em] text-fg-3 shadow-[0_0_0_1px_var(--line)]">{d.format}</span>
    </span>
  );
}

/** Kontext-Ausschnitt um den ersten Treffer – an Wortgrenzen gekürzt. */
function ausschnitt(text: string, q: string): string {
  let s = snippet(text.replace(/\s+/g, " "), q, 80);
  if (s.startsWith("… ")) s = "… " + s.slice(2).replace(/^\S*\s/, "");
  if (s.endsWith(" …")) s = s.slice(0, -2).replace(/\s\S*$/, "") + " …";
  return s;
}

function leseText(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error);
    r.readAsText(f, "utf-8");
  });
}

export function TabDokumente({ akte }: { akte: Akte }) {
  const { user } = useKanzlei();
  const alle = useCol("dokumente");
  const [params, setParams] = useSearchParams();
  const dokId = params.get("dok");
  const [ordner, setOrdner] = useState<Ordner | "alle">("alle");
  const [q, setQ] = useState("");
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [umbenennen, setUmbenennen] = useState<string | null>(null);
  const [dropZiel, setDropZiel] = useState<string | null>(null);
  const [zieht, setZieht] = useState<string[]>([]);
  const [dateiDrag, setDateiDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const klickTimer = useRef<number | undefined>(undefined);
  // Erster Klick auf einen Dokumentnamen: öffnet die Vorschau verzögert – ein Doppelklick benennt stattdessen um
  const ersterKlick = useRef<{ id: string; zeit: number; vorher: string | null; geoeffnet: boolean } | null>(null);

  const doks = useMemo(() => alle.filter((d) => d.akteId === akte.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [alle, akte.id]);
  const zaehler = useMemo(() => {
    const c: Record<string, number> = { alle: doks.length };
    for (const o of ORDNER) c[o] = 0;
    for (const d of doks) c[d.ordner]++;
    return c;
  }, [doks]);

  const sichtbar = useMemo(() => {
    if (q.trim()) {
      return search(doks, q, [
        { get: (d) => d.name, weight: 3 },
        { get: (d) => d.ki?.zusammenfassung, weight: 2 },
        { get: (d) => d.inhalt, weight: 1 },
      ], 300).map((h) => h.item);
    }
    return ordner === "alle" ? doks : doks.filter((d) => d.ordner === ordner);
  }, [doks, q, ordner]);

  // Auswahl auf sichtbare Dokumente beschränken
  useEffect(() => {
    setAuswahl((prev) => {
      const ids = new Set(sichtbar.map((d) => d.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [sichtbar]);

  const oeffne = (id: string | null) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (id) n.set("dok", id);
        else n.delete("dok");
        return n;
      },
      { replace: true },
    );

  const offenesDok = dokId ? doks.find((d) => d.id === dokId) : undefined;

  const nameKlick = (id: string) => {
    window.clearTimeout(klickTimer.current);
    ersterKlick.current = { id, zeit: Date.now(), vorher: dokId, geoeffnet: false };
    klickTimer.current = window.setTimeout(() => {
      if (ersterKlick.current?.id === id) ersterKlick.current.geoeffnet = true;
      oeffne(id);
    }, 230);
  };

  const starteUmbenennen = (id: string) => {
    window.clearTimeout(klickTimer.current);
    const k = ersterKlick.current;
    ersterKlick.current = null;
    // Langsamer Doppelklick: Die Vorschau, die der erste Klick schon geöffnet hat, wieder schließen
    if (k && k.id === id && k.geoeffnet && Date.now() - k.zeit < 1200) oeffne(k.vorher);
    setUmbenennen(id);
  };
  const umbenennenRef = useRef(starteUmbenennen);
  umbenennenRef.current = starteUmbenennen;

  // Landet der zweite Klick eines langsamen Doppelklicks schon auf der eben geöffneten Vorschau (Abdunklung),
  // gilt er trotzdem als Doppelklick auf den Namen: Vorschau zu, Umbenennen an.
  useEffect(() => {
    const abfangen = (e: MouseEvent) => {
      const k = ersterKlick.current;
      if (!k || !k.geoeffnet || e.detail < 2 || Date.now() - k.zeit > 1200) return;
      e.stopPropagation();
      e.preventDefault();
      umbenennenRef.current(k.id);
    };
    document.addEventListener("click", abfangen, true);
    return () => {
      document.removeEventListener("click", abfangen, true);
      window.clearTimeout(klickTimer.current);
    };
  }, []);

  const verschiebe = (ids: string[], ziel: Ordner) => {
    const st = useData.getState();
    let n = 0;
    for (const id of ids) {
      const d = doks.find((x) => x.id === id);
      if (d && d.ordner !== ziel) {
        st.patch("dokumente", id, { ordner: ziel });
        n++;
      }
    }
    setAuswahl(new Set());
    if (!n) {
      toast(`Bereits im Ordner „${ziel}“`, { ton: "info" });
      return;
    }
    beruehreAkte(akte.id);
    toast(n === 1 ? `Nach „${ziel}“ verschoben` : `${n} Dokumente nach „${ziel}“ verschoben`, { ton: "erfolg" });
  };

  const loesche = async (ids: string[]) => {
    const namen = doks.filter((d) => ids.includes(d.id)).map((d) => d.name);
    const ok = await confirmDialog({
      titel: ids.length === 1 ? `„${namen[0]}“ löschen?` : `${ids.length} Dokumente löschen?`,
      text: "Die Dokumente werden aus der E-Akte entfernt. Dieser Schritt kann nicht rückgängig gemacht werden.",
      bestaetigen: "Endgültig löschen",
      gefahr: true,
    });
    if (!ok) return;
    const st = useData.getState();
    for (const id of ids) st.remove("dokumente", id);
    st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `${ids.length === 1 ? `Dokument „${namen[0]}“` : `${ids.length} Dokumente`} gelöscht – ${akte.aktenzeichen}` });
    beruehreAkte(akte.id);
    setAuswahl(new Set());
    if (dokId && ids.includes(dokId)) oeffne(null);
    toast(ids.length === 1 ? "Dokument gelöscht" : `${ids.length} Dokumente gelöscht`, { ton: "erfolg" });
  };

  const benenneUm = (d: Dokument, name: string) => {
    setUmbenennen(null);
    const n = name.trim();
    if (!n || n === d.name) return;
    useData.getState().patch("dokumente", d.id, { name: n });
    beruehreAkte(akte.id);
    toast("Umbenannt", { ton: "erfolg", text: n });
  };

  const ladeHoch = async (files: FileList | File[], zielOrdner?: Ordner) => {
    const list = Array.from(files);
    if (!list.length) return;
    const ziel: Ordner = zielOrdner ?? (ordner === "alle" ? "Anlagen" : ordner);
    const st = useData.getState();
    let texte = 0;
    for (const f of list) {
      const ext = f.name.includes(".") ? f.name.split(".").pop()!.toLowerCase() : "";
      const istText = ext === "txt" || f.type === "text/plain";
      let inhalt = "(Inhalt wird per OCR erkannt)";
      if (istText) {
        try {
          inhalt = (await leseText(f)).slice(0, 200_000) || "(leere Textdatei)";
          texte++;
        } catch {
          inhalt = "(Text konnte nicht gelesen werden)";
        }
      }
      const format: Dokument["format"] = ext === "docx" || ext === "doc" ? "docx" : ext === "eml" || ext === "msg" ? "eml" : istText ? "txt" : "pdf";
      const d: Dokument = {
        id: uid("d"), akteId: akte.id, name: f.name.replace(/\.[^.]+$/, "") || f.name, art: format === "eml" ? "email" : "anlage", ordner: ziel, format,
        groesseKb: Math.max(1, Math.round(f.size / 1024)), inhalt, quelle: "upload", autorId: user.id, version: 1, createdAt: nowLocal(),
      };
      st.upsert("dokumente", d);
    }
    st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `${list.length === 1 ? `Dokument „${list[0].name}“` : `${list.length} Dokumente`} hochgeladen – ${akte.aktenzeichen}` });
    beruehreAkte(akte.id);
    toast(list.length === 1 ? "Dokument hochgeladen" : `${list.length} Dokumente hochgeladen`, {
      ton: "erfolg",
      text: `Ordner „${ziel}“ · ${texte === list.length ? "Text sofort durchsuchbar" : texte ? `${texte} sofort durchsuchbar, Rest per OCR` : "Texterkennung (OCR) läuft im Hintergrund"}`,
    });
    if (inputRef.current) inputRef.current.value = "";
  };

  // Drag & Drop
  const dragStart = (e: DragEvent, d: Dokument) => {
    const ids = auswahl.has(d.id) ? [...auswahl] : [d.id];
    e.dataTransfer.setData(DND_TYP, JSON.stringify(ids));
    e.dataTransfer.effectAllowed = "move";
    const ghost = document.createElement("div");
    ghost.textContent = ids.length === 1 ? d.name : `${ids.length} Dokumente`;
    Object.assign(ghost.style, {
      position: "fixed", top: "-1000px", left: "-1000px", padding: "8px 14px", borderRadius: "999px", background: "var(--ink)", color: "var(--on-ink)",
      font: "600 13px var(--font-ui)", whiteSpace: "nowrap", maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis",
    });
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 18, 18);
    setTimeout(() => ghost.remove(), 0);
    setZieht(ids);
  };
  const dragEnd = () => {
    setZieht([]);
    setDropZiel(null);
  };
  const ordnerDnD = (ziel: Ordner) => ({
    onDragOver: (e: DragEvent) => {
      const typen = e.dataTransfer.types;
      if (!typen.includes(DND_TYP) && !typen.includes("Files")) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = typen.includes("Files") ? "copy" : "move";
      if (dropZiel !== ziel) setDropZiel(ziel);
    },
    onDragLeave: (e: DragEvent) => {
      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDropZiel((z) => (z === ziel ? null : z));
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDropZiel(null);
      setDateiDrag(false);
      if (e.dataTransfer.files?.length) {
        void ladeHoch(e.dataTransfer.files, ziel);
        return;
      }
      try {
        const ids = JSON.parse(e.dataTransfer.getData(DND_TYP)) as string[];
        if (Array.isArray(ids) && ids.length) verschiebe(ids, ziel);
      } catch {
        /* kein gültiger Inhalt */
      }
      setZieht([]);
    },
  });

  const alleGewaehlt = sichtbar.length > 0 && sichtbar.every((d) => auswahl.has(d.id));
  const einige = auswahl.size > 0 && !alleGewaehlt;
  const toggle = (id: string) =>
    setAuswahl((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const ordnerListe: { key: Ordner | "alle"; label: string; Icon: typeof Files }[] = [{ key: "alle", label: "Alle Dokumente", Icon: Files }, ...ORDNER.map((o) => ({ key: o, label: o, Icon: ORDNER_ICON[o] }))];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[230px_minmax(0,1fr)]">
      {/* Ordner */}
      <div className="min-w-0">
        <Card padded={false} className="p-2 md:sticky md:top-[84px]">
          <div className="eyebrow hidden px-3 pb-1.5 pt-2 !text-[10.5px] md:block">Ordner</div>
          <ul className="no-scrollbar flex gap-1 overflow-x-auto md:grid md:grid-cols-1 md:gap-0.5 md:overflow-visible">
            {ordnerListe.map(({ key, label, Icon }) => {
              const aktiv = !q.trim() && ordner === key;
              const ziel = key !== "alle" && dropZiel === key;
              return (
                <li key={key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setOrdner(key);
                      setQ("");
                    }}
                    {...(key !== "alle" ? ordnerDnD(key) : {})}
                    className={cn(
                      "relative flex h-10 w-full items-center gap-2.5 rounded-[12px] px-3 text-left text-[13px] font-medium transition-[color,transform,box-shadow] duration-200",
                      aktiv ? "text-fg" : "text-fg-2 hover:bg-ink-softer hover:text-fg",
                      ziel && "scale-[1.03] bg-ink-soft text-ink shadow-[0_0_0_2px_var(--ink)]",
                    )}
                  >
                    {aktiv && !ziel && (
                      <motion.span layoutId={`ordner-pill-${akte.id}`} transition={{ type: "spring", stiffness: 520, damping: 38 }} className="absolute inset-0 rounded-[12px] bg-[var(--surface)] shadow-[0_1px_0_0_var(--glass-rim-3)_inset,0_3px_12px_-4px_rgba(20,30,80,0.18),0_0_0_1px_var(--line)]" />
                    )}
                    <Icon className={cn("relative size-4 shrink-0", aktiv || ziel ? "text-ink" : "text-fg-3")} />
                    <span className="relative flex-1 truncate">{label}</span>
                    <span className={cn("num relative rounded-full px-1.5 text-[11px]", aktiv ? "bg-ink-soft text-ink" : "text-fg-4")}>{zaehler[key] ?? 0}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="hidden px-3 pb-2 pt-3 text-[11.5px] leading-snug text-fg-4 md:block">Dokumente auf einen Ordner ziehen, um sie zu verschieben. Doppelklick auf einen Namen benennt um.</p>
        </Card>
      </div>

      {/* Liste */}
      <Card
        padded={false}
        className={cn("relative min-w-0 transition-shadow", dateiDrag && "shadow-[0_0_0_2px_var(--ink)]")}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDateiDrag(true);
        }}
        onDragLeave={(e) => {
          if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDateiDrag(false);
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.files?.length) return;
          e.preventDefault();
          setDateiDrag(false);
          void ladeHoch(e.dataTransfer.files);
        }}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] p-3">
          <SearchField id="dok-suche" value={q} onChange={setQ} placeholder="In dieser Akte suchen …" className="min-w-0 flex-1" />
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && void ladeHoch(e.target.files)} aria-hidden tabIndex={-1} />
          <Button variant="secondary" icon={<Upload className="size-4" />} onClick={() => inputRef.current?.click()} aria-label="Dateien hochladen" title="Dateien hochladen (Textdateien sofort durchsuchbar)">
            <span className="hidden sm:inline">Hochladen</span>
          </Button>
        </div>

        <AnimatePresence initial={false}>
          {auswahl.size > 0 && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }} transition={{ type: "spring", stiffness: 520, damping: 36 }} className="relative z-10 border-b border-[var(--line)] bg-ink-softer">
              <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-[13px]">
                <span className="num font-semibold">{auswahl.size} ausgewählt</span>
                <Menu
                  align="start"
                  trigger={({ toggle: t }) => (
                    <Button size="sm" variant="secondary" icon={<FolderInput className="size-4" />} onClick={t}>
                      Verschieben nach …
                    </Button>
                  )}
                  items={ORDNER.map((o) => {
                    const I = ORDNER_ICON[o];
                    return { label: o, icon: <I />, onClick: () => verschiebe([...auswahl], o) };
                  })}
                />
                <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => void loesche([...auswahl])} className="!text-seal">
                  Löschen
                </Button>
                <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={() => setAuswahl(new Set())}>
                  Aufheben
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {sichtbar.length > 0 && (
          <div className="flex items-center gap-3 px-4 pb-1 pt-3 text-[12px] text-fg-3">
            <Checkbox
              checked={alleGewaehlt}
              indeterminate={einige}
              label="Alle auswählen"
              onChange={() => setAuswahl(alleGewaehlt ? new Set() : new Set(sichtbar.map((d) => d.id)))}
            />
            <span className="flex-1">
              {q.trim() ? (
                <>
                  <span className="num font-semibold text-fg-2">{sichtbar.length}</span> {sichtbar.length === 1 ? "Treffer" : "Treffer"} für „{q.trim()}“ in allen Ordnern
                </>
              ) : (
                <>
                  <span className="num font-semibold text-fg-2">{sichtbar.length}</span> {sichtbar.length === 1 ? "Dokument" : "Dokumente"} · neueste zuerst
                </>
              )}
            </span>
          </div>
        )}

        {sichtbar.length === 0 ? (
          <Empty
            icon={q.trim() ? <FileSearch className="size-6" /> : <FileUp className="size-6" />}
            title={q.trim() ? "Kein Dokument enthält diesen Begriff" : ordner === "alle" ? "Noch keine Dokumente" : `Ordner „${ordner}“ ist leer`}
            text={q.trim() ? "Die Suche durchsucht Namen, Volltext (OCR) und KI-Zusammenfassungen aller Dokumente dieser Akte." : "Dateien hierher ziehen oder hochladen. Textdateien sind sofort durchsuchbar, PDFs nach der Texterkennung."}
            action={
              !q.trim() ? (
                <Button variant="secondary" icon={<Upload className="size-4" />} onClick={() => inputRef.current?.click()}>
                  Dateien hochladen
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-0.5 p-2">
            <AnimatePresence initial={false}>
              {sichtbar.map((d, i) => {
                const gewaehlt = auswahl.has(d.id);
                const benennt = umbenennen === d.id;
                return (
                  <motion.li
                    key={d.id}
                    layout="position"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: zieht.includes(d.id) ? 0.45 : 1, y: 0, transition: { delay: Math.min(i, 10) * 0.025, type: "spring", stiffness: 460, damping: 36 } }}
                    exit={{ opacity: 0, x: -16, transition: { duration: 0.18 } }}
                  >
                    <div
                      draggable={!benennt}
                      onDragStart={(e) => dragStart(e, d)}
                      onDragEnd={dragEnd}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("button,input,[role=menu]")) return;
                        oeffne(d.id);
                      }}
                      className={cn(
                        "group flex cursor-pointer items-center gap-3 rounded-[14px] px-2.5 py-2.5 transition-colors",
                        gewaehlt ? "bg-ink-soft" : "hover:bg-ink-softer",
                        dokId === d.id && !gewaehlt && "bg-ink-softer",
                      )}
                    >
                      <Checkbox checked={gewaehlt} onChange={() => toggle(d.id)} label={`${d.name} auswählen`} />
                      <DokIcon d={d} />
                      <div className="min-w-0 flex-1">
                        {benennt ? (
                          <input
                            autoFocus
                            defaultValue={d.name}
                            aria-label="Neuer Dokumentname"
                            onFocus={(e) => e.currentTarget.select()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") benenneUm(d, e.currentTarget.value);
                              if (e.key === "Escape") {
                                e.stopPropagation();
                                setUmbenennen(null);
                              }
                            }}
                            onBlur={(e) => benenneUm(d, e.currentTarget.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="field !h-8 !rounded-[9px] !px-2.5 text-[13.5px] font-medium"
                          />
                        ) : (
                          <div
                            className="truncate text-[13.5px] font-medium"
                            title="Doppelklick zum Umbenennen"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (e.detail >= 2) starteUmbenennen(d.id);
                              else nameKlick(d.id);
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              starteUmbenennen(d.id);
                            }}
                          >
                            <Highlight text={d.name} q={q} />
                          </div>
                        )}
                        <div className="mt-0.5 truncate text-[12px] text-fg-3">
                          {DOK_ART_LABEL[d.art]} · {fmtDate(d.createdAt.slice(0, 10))}
                          {d.seiten ? ` · ${d.seiten} ${d.seiten === 1 ? "Seite" : "Seiten"}` : ""} · {fmtKb(d.groesseKb)}
                          {d.version > 1 ? ` · Version ${d.version}` : ""}
                        </div>
                        {q.trim() && (
                          <div className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-fg-2">
                            <Highlight text={ausschnitt(d.inhalt, q)} q={q} />
                          </div>
                        )}
                      </div>
                      <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
                        {(ordner === "alle" || q.trim()) && <Chip tone="outline">{d.ordner}</Chip>}
                        <Chip tone={d.quelle === "bea" ? "ink" : d.quelle === "generiert" ? "green" : "neutral"}>{QUELLE_LABEL[d.quelle]}</Chip>
                        {d.ki?.zusammenfassung && <AiChip />}
                      </div>
                      <Menu
                        trigger={({ toggle: t }) => (
                          <button type="button" onClick={t} className="icon-btn !size-8 text-fg-3 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100" aria-label={`Aktionen für ${d.name}`}>
                            <MoreHorizontal className="size-4" />
                          </button>
                        )}
                        items={[
                          { label: "Vorschau öffnen", icon: <FileText />, onClick: () => oeffne(d.id) },
                          { label: "Umbenennen", icon: <PenLine />, onClick: () => setUmbenennen(d.id) },
                          "sep",
                          { label: "Löschen", icon: <Trash2 />, danger: true, onClick: () => void loesche([d.id]) },
                        ]}
                      />
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}

        <AnimatePresence>
          {dateiDrag && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-2 grid grid-cols-1 place-items-center rounded-[18px] border-2 border-dashed border-[var(--ink)] bg-[color-mix(in_oklab,var(--surface)_85%,transparent)]">
              <div className="text-center">
                <Upload className="mx-auto size-7 text-ink" />
                <div className="title-md mt-2">Dateien hier ablegen</div>
                <div className="text-[12.5px] text-fg-3">Sie landen im Ordner „{ordner === "alle" ? "Anlagen" : ordner}“</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <DokumentVorschau
        akte={akte}
        dok={offenesDok}
        q={q}
        liste={sichtbar.some((d) => d.id === dokId) ? sichtbar : doks}
        onClose={() => oeffne(null)}
        onWechsel={(id) => oeffne(id)}
        onLoeschen={(d) => void loesche([d.id])}
        onUmbenennen={(d, n) => benenneUm(d, n)}
      />
    </div>
  );
}
