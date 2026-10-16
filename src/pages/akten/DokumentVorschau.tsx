// Dokumentvorschau als Seitenpanel: Papieransicht, Metadaten, KI-Zusammenfassung, Versionen.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Copy, FileStack, PenLine, Sparkles, Trash2 } from "lucide-react";
import type { Akte, Dokument } from "@/core/types";
import { fmtDate, fmtTime, nowLocal } from "@/core/dates";
import { useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { AiChip, Button, Chip, Drawer, IconButton } from "@/components/ui";
import { Highlight } from "@/components/Highlight";
import { kopiere } from "@/pages/kontakte/kontaktHelfer";
import { DOK_ART_LABEL, QUELLE_LABEL, beruehreAkte, fmtKb, useTeam } from "./helfer";

export function DokumentVorschau({
  akte, dok, q, liste, onClose, onWechsel, onLoeschen, onUmbenennen,
}: {
  akte: Akte;
  dok?: Dokument;
  q: string;
  liste: Dokument[];
  onClose: () => void;
  onWechsel: (id: string) => void;
  onLoeschen: (d: Dokument) => void;
  onUmbenennen: (d: Dokument, name: string) => void;
}) {
  const { tenant, user } = useKanzlei();
  const { byId } = useTeam();
  const letzte = useRef<Dokument | undefined>(dok);
  if (dok) letzte.current = dok;
  const d = dok ?? letzte.current;
  const [benennt, setBenennt] = useState(false);
  const versionRef = useRef<HTMLInputElement>(null);
  const idx = d ? liste.findIndex((x) => x.id === d.id) : -1;
  const vor = idx > 0 ? liste[idx - 1] : undefined;
  const nach = idx >= 0 && idx < liste.length - 1 ? liste[idx + 1] : undefined;

  useEffect(() => setBenennt(false), [d?.id]);

  useEffect(() => {
    if (!dok) return;
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input,textarea,select")) return;
      if (e.key === "ArrowLeft" && vor) onWechsel(vor.id);
      if (e.key === "ArrowRight" && nach) onWechsel(nach.id);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [dok, vor, nach, onWechsel]);

  const neueVersion = async (f: File) => {
    if (!d) return;
    const istText = f.name.toLowerCase().endsWith(".txt") || f.type === "text/plain";
    let inhalt = "(Inhalt wird per OCR erkannt)";
    if (istText) {
      inhalt = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result ?? ""));
        r.onerror = () => res("(Text konnte nicht gelesen werden)");
        r.readAsText(f, "utf-8");
      });
    }
    useData.getState().patch("dokumente", d.id, { inhalt, groesseKb: Math.max(1, Math.round(f.size / 1024)), version: d.version + 1, ki: undefined, createdAt: nowLocal() });
    useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Neue Version ${d.version + 1} von „${d.name}“ hochgeladen – ${akte.aktenzeichen}` });
    beruehreAkte(akte.id);
    toast(`Version ${d.version + 1} gespeichert`, { ton: "erfolg", text: d.name });
    if (versionRef.current) versionRef.current.value = "";
  };

  const autor = d?.autorId ? byId.get(d.autorId) : undefined;
  const seiten = d?.seiten ?? 1;

  return (
    <Drawer
      open={!!dok}
      onClose={onClose}
      width={780}
      icon={<FileStack className="size-[18px]" />}
      title={
        d && benennt ? (
          <input
            autoFocus
            defaultValue={d.name}
            aria-label="Neuer Dokumentname"
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onUmbenennen(d, e.currentTarget.value);
                setBenennt(false);
              }
              if (e.key === "Escape") {
                e.stopPropagation();
                setBenennt(false);
              }
            }}
            onBlur={(e) => {
              onUmbenennen(d, e.currentTarget.value);
              setBenennt(false);
            }}
            className="field !h-9 w-full text-[16px] font-semibold"
          />
        ) : (
          <span className="block break-words" onDoubleClick={() => setBenennt(true)} title="Doppelklick zum Umbenennen">
            {d?.name}
          </span>
        )
      }
      subtitle={d ? `${d.ordner} · ${fmtDate(d.createdAt.slice(0, 10))}${fmtTime(d.createdAt) ? `, ${fmtTime(d.createdAt)} Uhr` : ""} · ${QUELLE_LABEL[d.quelle]}${autor ? ` · ${autor.name}` : ""}` : undefined}
      footer={
        d && (
          <>
            <div className="mr-auto flex items-center gap-1">
              <IconButton label="Vorheriges Dokument (←)" disabled={!vor} onClick={() => vor && onWechsel(vor.id)} className="disabled:opacity-30">
                <ChevronLeft className="size-[18px]" />
              </IconButton>
              <span className="num px-1 text-[12px] text-fg-3">
                {idx + 1} / {liste.length}
              </span>
              <IconButton label="Nächstes Dokument (→)" disabled={!nach} onClick={() => nach && onWechsel(nach.id)} className="disabled:opacity-30">
                <ChevronRight className="size-[18px]" />
              </IconButton>
            </div>
            <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => onLoeschen(d)} className="!text-seal">
              Löschen
            </Button>
            <Button size="sm" variant="secondary" icon={<PenLine className="size-4" />} onClick={() => setBenennt(true)}>
              Umbenennen
            </Button>
            <Button size="sm" variant="secondary" icon={<Copy className="size-4" />} onClick={() => void kopiere(d.inhalt, "Dokumenttext")}>
              Text kopieren
            </Button>
          </>
        )
      }
    >
      {d && (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ type: "spring", stiffness: 460, damping: 36 }} className="grid grid-cols-1 gap-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip tone="ink">{DOK_ART_LABEL[d.art]}</Chip>
              <Chip>Version {d.version}</Chip>
              {d.seiten ? <Chip>{d.seiten} {d.seiten === 1 ? "Seite" : "Seiten"}</Chip> : null}
              <Chip>{fmtKb(d.groesseKb)}</Chip>
              <Chip tone="outline">{d.format.toUpperCase()}</Chip>
              <div className="flex-1" />
              <input ref={versionRef} type="file" className="hidden" aria-hidden tabIndex={-1} onChange={(e) => e.target.files?.[0] && void neueVersion(e.target.files[0])} />
              <Button size="sm" variant="ghost" icon={<FileStack className="size-4" />} onClick={() => versionRef.current?.click()}>
                Neue Version
              </Button>
            </div>

            {d.ki?.zusammenfassung && (
              <div className="ai-ring rounded-[18px] bg-[var(--surface)] p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-violet" />
                  <span className="text-[13px] font-semibold">KI-Zusammenfassung</span>
                  <AiChip />
                </div>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-2">{d.ki.zusammenfassung}</p>
                {d.ki.erkannteFristen ? (
                  <p className="mt-2 text-[12px] text-fg-3">
                    {d.ki.erkannteFristen} {d.ki.erkannteFristen === 1 ? "Frist" : "Fristen"} erkannt – berechnet vom Fristenrechner, zu finden im Reiter „Fristen“.
                  </p>
                ) : null}
              </div>
            )}

            <div className="rounded-[18px] bg-[var(--bg-deep)] p-3 sm:p-6">
              <article className="paper mx-auto w-full max-w-[640px] px-6 py-8 sm:px-12 sm:py-12">
                <header className="mb-7 flex items-start justify-between gap-4 border-b border-current/10 pb-3 text-[10.5px] font-semibold uppercase tracking-[0.1em] opacity-55">
                  <span className="truncate">{tenant.name}</span>
                  <span className="mono shrink-0">Az. {akte.aktenzeichen}</span>
                </header>
                <div className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.7]" style={{ fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" }}>
                  <Highlight text={d.inhalt} q={q} />
                </div>
                <footer className="mt-10 flex justify-between border-t border-current/10 pt-3 text-[10.5px] opacity-50">
                  <span className="truncate">{d.name}</span>
                  <span className="num shrink-0">
                    Seite 1 von {seiten}
                  </span>
                </footer>
              </article>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </Drawer>
  );
}
