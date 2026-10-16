// Dokumentvorschau als Seitenpanel: Papieransicht, Metadaten, KI-Zusammenfassung, Versionen, Bearbeitungsstand und
// Mandantenportal. Eigene Schreiben tragen den Kanzleikopf; Eingänge (beA, E-Mail, Scan, Umzug, Upload) erscheinen wie das
// Original – Aktenzeichen und Eingangsvermerk stehen außerhalb des Blattes.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, BadgeCheck, ChevronLeft, ChevronRight, Copy, FileStack, Globe, Inbox, PenLine, Save, Sparkles, Trash2, X } from "lucide-react";
import type { Akte, Dokument } from "@/core/types";
import { fmtDate, fmtTime, nowLocal } from "@/core/dates";
import { istBerufstraeger } from "@/core/vertretung";
import { useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { AiChip, Button, Chip, Drawer, IconButton, Textarea } from "@/components/ui";
import { Highlight } from "@/components/Highlight";
import { kopiere } from "@/pages/kontakte/kontaktHelfer";
import { DOK_ART_LABEL, DOK_STATUS_INFO, QUELLE_LABEL, beruehreAkte, eigenesSchreiben, fmtKb, offenePlatzhalter, useTeam } from "./helfer";
import { imPortal, portalSperrgrund, setzePortal } from "./Mandantenportal";

/** Eingangsvermerk außerhalb des Blattes: „Eingang 14.10.2026 · Scan“ */
function eingangsVermerk(d: Dokument): string {
  const art = d.quelle === "bea" ? "beA" : d.quelle === "email" ? "E-Mail" : d.quelle === "scan" ? "Scan" : d.quelle === "migration" ? "Umzug" : "Upload";
  return `Eingang ${fmtDate(d.createdAt.slice(0, 10))} · ${art}`;
}

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
  const nav = useNavigate();
  const letzte = useRef<Dokument | undefined>(dok);
  if (dok) letzte.current = dok;
  const d = dok ?? letzte.current;
  const [benennt, setBenennt] = useState(false);
  // Text bearbeiten (nur eigene Schreiben, nicht nach dem Versand) – gespeichert als neue Version
  const [params, setParams] = useSearchParams();
  const [bearbeitet, setBearbeitet] = useState<string | null>(null);
  const versionRef = useRef<HTMLInputElement>(null);
  const idx = d ? liste.findIndex((x) => x.id === d.id) : -1;
  const vor = idx > 0 ? liste[idx - 1] : undefined;
  const nach = idx >= 0 && idx < liste.length - 1 ? liste[idx + 1] : undefined;

  useEffect(() => setBenennt(false), [d?.id]);
  // „Platzhalter ausfüllen“ aus der Freigabe (…&bearbeiten=1): Bearbeitung direkt öffnen
  useEffect(() => {
    if (!dok) return setBearbeitet(null);
    if (params.get("bearbeiten") === "1" && eigenesSchreiben(dok) && dok.status !== "versandt") {
      setBearbeitet(dok.inhalt);
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          n.delete("bearbeiten");
          return n;
        },
        { replace: true },
      );
    } else setBearbeitet(null);
  }, [dok?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const eigen = !!d && eigenesSchreiben(d);
  const platzhalter = d && eigen && d.status !== "versandt" ? offenePlatzhalter(d.inhalt) : [];
  const darfFreigeben = istBerufstraeger(user);

  /** Bearbeiteten Text als neue Version speichern; eine Freigabe muss danach erneuert werden. */
  const speichereText = () => {
    if (!d || bearbeitet === null) return;
    if (bearbeitet === d.inhalt) return setBearbeitet(null);
    const neu = d.version + 1;
    const offen = offenePlatzhalter(bearbeitet).length;
    useData.getState().patch("dokumente", d.id, {
      inhalt: bearbeitet,
      version: neu,
      createdAt: nowLocal(),
      autorId: user.id,
      status: d.status === "freigegeben" ? "entwurf" : d.status,
      ki: d.ki?.zusammenfassung ? { ...d.ki, zusammenfassung: `${d.ki.zusammenfassung.replace(/, \d+ Platzhalter offen/, "")}${offen ? `, ${offen} Platzhalter offen` : ""}` } : d.ki,
    });
    useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `„${d.name}“ bearbeitet – Version ${neu}${offen ? ` (${offen} Platzhalter offen)` : ""}${d.status === "freigegeben" ? ", Freigabe zurückgesetzt" : ""} – ${akte.aktenzeichen}` });
    beruehreAkte(akte.id);
    setBearbeitet(null);
    toast(`Version ${neu} gespeichert`, { ton: "erfolg", text: offen ? `${offen} Platzhalter noch offen` : "Keine offenen Platzhalter" });
  };

  /** Entwurf freigeben (Berufsträger, keine offenen Platzhalter) – danach versand- und portalfähig. */
  const freigeben = () => {
    if (!d || d.status !== "entwurf" || platzhalter.length || !darfFreigeben) return;
    useData.getState().patch("dokumente", d.id, { status: "freigegeben" });
    useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `„${d.name}“ (Version ${d.version}) freigegeben – ${akte.aktenzeichen}` });
    beruehreAkte(akte.id);
    toast("Freigegeben", { ton: "erfolg", text: `${d.name} · Version ${d.version}` });
  };

  const portalUmschalten = () => {
    if (!d) return;
    const an = !imPortal(d);
    if (!setzePortal(d, akte, user.id, an)) return;
    toast(an ? "Im Mandantenportal bereitgestellt" : "Aus dem Portal genommen", { ton: "erfolg", text: d.name });
  };

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
              {d.status && <Chip tone={DOK_STATUS_INFO[d.status].tone}>{DOK_STATUS_INFO[d.status].label}</Chip>}
              {akte.mandantenportal && imPortal(d) && (
                <Chip tone="green" icon={<Globe className="size-3" />}>
                  im Portal
                </Chip>
              )}
              <Chip>Version {d.version}</Chip>
              {d.seiten ? <Chip>{d.seiten} {d.seiten === 1 ? "Seite" : "Seiten"}</Chip> : null}
              <Chip>{fmtKb(d.groesseKb)}</Chip>
              <Chip tone="outline">{d.format.toUpperCase()}</Chip>
              <div className="flex-1" />
              {d.inhalt.trim().length >= 20 && (
                <Button
                  size="sm"
                  variant="ai"
                  icon={<Sparkles className="size-4" />}
                  onClick={() => nav(`/ki?tab=dokument&akte=${encodeURIComponent(akte.id)}&dok=${encodeURIComponent(d.id)}`)}
                  title="Text dieses Dokuments in der Dokument-Analyse prüfen – Fristen, Ausschlussfristen, nächste Schritte"
                >
                  Mit KI analysieren
                </Button>
              )}
              <input ref={versionRef} type="file" className="hidden" aria-hidden tabIndex={-1} onChange={(e) => e.target.files?.[0] && void neueVersion(e.target.files[0])} />
              <Button size="sm" variant="ghost" icon={<FileStack className="size-4" />} onClick={() => versionRef.current?.click()}>
                Neue Version
              </Button>
            </div>

            {/* Bearbeitungsstand und Mandantenportal */}
            {(eigen || akte.mandantenportal) && (
              <div className="flex flex-wrap items-center gap-2 rounded-[16px] bg-ink-softer px-3.5 py-2.5 text-[12.5px] text-fg-2 ring-1 ring-inset ring-[var(--line)]">
                {eigen && d.status !== "versandt" && bearbeitet === null && (
                  <Button size="sm" variant="secondary" icon={<PenLine className="size-4" />} onClick={() => setBearbeitet(d.inhalt)}>
                    Text bearbeiten
                  </Button>
                )}
                {d.status === "entwurf" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<BadgeCheck className="size-4" />}
                    disabled={!!platzhalter.length || !darfFreigeben}
                    onClick={freigeben}
                    title={platzhalter.length ? "Erst alle Platzhalter ausfüllen" : !darfFreigeben ? "Freigabe durch die Anwältin bzw. den Anwalt" : undefined}
                  >
                    Freigeben
                  </Button>
                )}
                {d.status === "versandt" && <span>Versandt – Änderungen nur als neues Dokument.</span>}
                {akte.mandantenportal && (
                  <>
                    <span className="flex-1" />
                    {imPortal(d) ? (
                      <Button size="sm" variant="ghost" icon={<Globe className="size-4" />} onClick={portalUmschalten}>
                        Aus dem Portal nehmen
                      </Button>
                    ) : portalSperrgrund(d) ? (
                      <span className="inline-flex items-center gap-1.5 text-fg-3">
                        <Globe className="size-3.5" /> Mandantenportal: {portalSperrgrund(d)}
                      </span>
                    ) : (
                      <Button size="sm" variant="ghost" icon={<Globe className="size-4" />} onClick={portalUmschalten}>
                        Im Mandantenportal bereitstellen
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}

            {platzhalter.length > 0 && bearbeitet === null && (
              <div role="status" className="flex gap-2 rounded-[14px] bg-amber-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-fg-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />
                <span>
                  <strong className="font-semibold text-fg">
                    {platzhalter.length} {platzhalter.length === 1 ? "Platzhalter" : "Platzhalter"} offen
                  </strong>{" "}
                  – vor Freigabe und Versand ausfüllen: {platzhalter.join(", ")}
                </span>
              </div>
            )}

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
              {/* Eingänge: Aktenzeichen und Eingangsvermerk außerhalb des Blattes – das Blatt zeigt nur das Original */}
              {!eigen && (
                <div className="mx-auto mb-2.5 flex w-full max-w-[640px] flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-fg-2">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Inbox className="size-3.5 text-ink" aria-hidden />
                    {eingangsVermerk(d)}
                  </span>
                  <span className="mono text-fg-3">Az. {akte.aktenzeichen}</span>
                  <span className="text-fg-3">Eingegangenes Dokument – unverändert</span>
                </div>
              )}
              <article className="paper mx-auto w-full max-w-[640px] px-6 py-8 sm:px-12 sm:py-12">
                {eigen && (
                  <header className="mb-7 flex items-start justify-between gap-4 border-b border-current/10 pb-3 text-[12px] font-semibold uppercase tracking-[0.1em] opacity-55">
                    <span className="truncate">{tenant.name}</span>
                    <span className="mono shrink-0">Az. {akte.aktenzeichen}</span>
                  </header>
                )}
                {bearbeitet !== null ? (
                  <div className="grid gap-2">
                    <label htmlFor="dok-bearbeiten" className="text-[12.5px] font-semibold opacity-70">
                      Text bearbeiten – Platzhalter in [eckigen Klammern] ersetzen
                    </label>
                    <Textarea
                      id="dok-bearbeiten"
                      autoFocus
                      rows={18}
                      value={bearbeitet}
                      onChange={(e) => setBearbeitet(e.target.value)}
                      className="text-[13.5px] leading-[1.6]"
                      style={{ fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" }}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="primary" icon={<Save className="size-4" />} onClick={speichereText}>
                        Als Version {d.version + 1} speichern
                      </Button>
                      <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={() => setBearbeitet(null)}>
                        Verwerfen
                      </Button>
                      <span className="text-[12.5px] opacity-65">
                        {offenePlatzhalter(bearbeitet).length ? `${offenePlatzhalter(bearbeitet).length} Platzhalter offen` : "Keine offenen Platzhalter"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.7]" style={{ fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" }}>
                    <Highlight text={d.inhalt} q={q} />
                  </div>
                )}
                <footer className="mt-10 flex justify-between border-t border-current/10 pt-3 text-[12px] opacity-50">
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
