// Reiter „Übersicht“: Sachverhalt, nächste Fristen, letzte Dokumente, Notizen, Mandantenportal, Entscheidungen.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { BookMarked, CalendarClock, CalendarPlus, ChevronDown, ChevronRight, Eye, FileText, Globe, Hourglass, Library, NotebookPen, PenLine, Pin, ReceiptEuro, Send, StickyNote } from "lucide-react";
import type { Akte, Dokument } from "@/core/types";
import { istKritisch, zaehltAlsFrist } from "@/core/fristenLage";
import { ENTSCHEIDUNGEN } from "@/core/rechtsprechung";
import { fmtDate, fmtDateWd, fmtEUR, nowLocal, relTime, uid } from "@/core/dates";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Avatar, Button, Card, CardHeader, Chip, Stat, StatLeiste, Switch, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useMedia } from "@/lib/useMedia";
import { DOK_ART_LABEL, FRIST_TYP_LABEL, FristChip, MOBIL_TREFFER, beruehreAkte, schlagwortAnzeige, useKontaktMap, useTeam } from "./helfer";
import { DokIcon } from "./TabDokumente";
import { DiktatKnopf } from "./Diktat";
import { useMandantenportal } from "./Mandantenportal";
import { BEWEGUNG } from "@/lib/bewegung";

/** Kerndokumente einer Akte – in dieser Reihenfolge vorn angeheftet (Kündigung, Klage, Ladung, Urteil). */
const KERN: RegExp[] = [/kündigung(?!sschutz)|kuendigung/i, /klage(?!erwiderung)|kündigungsschutz/i, /ladung/i, /urteil/i];
function kernRang(d: Pick<Dokument, "name" | "art">): number {
  const i = KERN.findIndex((re) => re.test(d.name));
  if (i >= 0) return i;
  return d.art === "urteil" ? 3 : KERN.length;
}

export function TabUebersicht({ akte, onTab, onDok, onFrist }: { akte: Akte; onTab: (t: string) => void; onDok: (id: string) => void; onFrist: () => void }) {
  const nav = useNavigate();
  const { user } = useKanzlei();
  const { byId } = useTeam();
  const kontakte = useKontaktMap();
  const fristen = useCol("fristen");
  const dokumente = useCol("dokumente");
  const notizenAlle = useCol("notizen");
  const zeiten = useCol("zeiten");
  const buchungen = useCol("buchungen");
  const [notiz, setNotiz] = useState("");
  const feinZeiger = useMedia("(pointer: fine)");
  const [bearbeite, setBearbeite] = useState(false);
  const [sachverhalt, setSachverhalt] = useState(akte.beschreibung);
  const mandant = kontakte.get(akte.mandantId);
  const portalAktionen = useMandantenportal(akte);
  // Aktenkonto-Kennzahl nur für Rollen mit Zugriff (Auszubildende sehen das Aktenkonto nicht)
  const mitAktenkonto = user.rolle !== "azubi";

  const offen = useMemo(() => fristen.filter((f) => f.akteId === akte.id && f.status === "offen" && f.typ !== "vorfrist").sort((a, b) => a.datum.localeCompare(b.datum)), [fristen, akte.id]);
  const doks = useMemo(() => dokumente.filter((d) => d.akteId === akte.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [dokumente, akte.id]);
  // Kerndokumente (Kündigung, Klage, Ladung, Urteil) vorn angeheftet, danach die neuesten – „Alle … anzeigen“ klappt auf (I4-T14-02)
  const [alleDoks, setAlleDoks] = useState(false);
  const dokListe = useMemo(() => {
    const kern = doks.filter((d) => kernRang(d) < KERN.length).sort((a, b) => kernRang(a) - kernRang(b) || b.createdAt.localeCompare(a.createdAt));
    return [...kern, ...doks.filter((d) => !kern.includes(d))];
  }, [doks]);
  const DOKS_KURZ = 5;
  const notizen = useMemo(() => notizenAlle.filter((n) => n.akteId === akte.id).sort((a, b) => b.zeit.localeCompare(a.zeit)), [notizenAlle, akte.id]);
  const minuten = useMemo(() => zeiten.filter((z) => z.akteId === akte.id).reduce((s, z) => s + z.minuten, 0), [zeiten, akte.id]);
  const honorarOffen = useMemo(() => {
    const b = buchungen.filter((x) => x.akteId === akte.id && !x.fremdgeld && x.art !== "fremdgeld");
    return Math.max(0, b.reduce((s, x) => s + x.betrag, 0));
  }, [buchungen, akte.id]);
  const entscheidungen = (akte.entscheidungen ?? []).map((id) => ENTSCHEIDUNGEN.find((e) => e.id === id)).filter((e): e is NonNullable<typeof e> => !!e);

  const speichereNotiz = () => {
    const t = notiz.trim();
    if (!t) return;
    useData.getState().upsert("notizen", { id: uid("no"), akteId: akte.id, userId: user.id, text: t, zeit: nowLocal() });
    beruehreAkte(akte.id);
    setNotiz("");
    toast("Notiz gespeichert", { ton: "erfolg" });
  };

  const speichereSachverhalt = () => {
    useData.getState().patch("akten", akte.id, { beschreibung: sachverhalt.trim(), updatedAt: nowLocal() });
    setBearbeite(false);
    toast("Sachverhalt aktualisiert", { ton: "erfolg" });
  };

  // Freischalten nur nach Rückfrage (Empfängeradresse, sichtbare Inhalte), Sperren sofort – beides protokolliert
  const portal = (an: boolean) => (an ? portalAktionen.freischalten() : portalAktionen.sperren());

  const kennzahlen = [
    // gezählt wie überall (fristenLage): nur Notfristen und Fristen – Wiedervorlagen und Termine stehen in der Liste darunter
    { label: "Offene Fristen", wert: String(offen.filter(zaehltAlsFrist).length), icon: <CalendarClock className="size-4" />, on: () => onTab("fristen") },
    { label: "Dokumente", wert: String(doks.length), icon: <FileText className="size-4" />, on: () => onTab("dokumente") },
    { label: "Erfasste Zeit", wert: `${(minuten / 60).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Std.`, icon: <Hourglass className="size-4" />, on: undefined },
    ...(mitAktenkonto ? [{ label: "Honorar offen", wert: fmtEUR(honorarOffen), icon: <ReceiptEuro className="size-4" />, on: () => onTab("aktenkonto") }] : []),
  ];

  return (
    <div className={cn("grid grid-cols-1 gap-4", MOBIL_TREFFER)}>
      {/* Kennzahlen in einer Leiste, getrennt durch Linien (DESIGN-SYSTEM.md 12.14) – antippen öffnet den passenden Reiter */}
      <StatLeiste>
        {kennzahlen.map((k) => (
          <Stat key={k.label} label={k.label} icon={k.icon} value={k.wert} onClick={k.on} className="[&>div:nth-child(2)]:text-[20px] [&>div:nth-child(2)]:leading-7" />
        ))}
      </StatLeiste>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="grid grid-cols-1 min-w-0 content-start gap-4 lg:col-span-2">
          <Card>
            <CardHeader
              icon={<NotebookPen className="size-4" />}
              title="Sachverhalt"
              subtitle="Worum es geht und was der Mandant erreichen möchte"
              action={
                !bearbeite && (
                  <Button size="sm" variant="ghost" icon={<PenLine className="size-4" />} onClick={() => { setSachverhalt(akte.beschreibung); setBearbeite(true); }}>
                    Bearbeiten
                  </Button>
                )
              }
            />
            {bearbeite ? (
              <div className="grid grid-cols-1 gap-2">
                <Textarea id="ue-sachverhalt" rows={5} value={sachverhalt} onChange={(e) => setSachverhalt(e.target.value)} autoFocus />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setBearbeite(false)}>
                    Abbrechen
                  </Button>
                  <Button size="sm" variant="primary" onClick={speichereSachverhalt}>
                    Speichern
                  </Button>
                </div>
              </div>
            ) : akte.beschreibung ? (
              <p className="prose-apex max-w-[75ch]">{akte.beschreibung}</p>
            ) : (
              <p className="text-[13px] text-fg-3">Noch kein Sachverhalt erfasst.</p>
            )}
            {akte.schlagworte.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {akte.schlagworte.map((s) => (
                  <Chip key={s} tone="outline">
                    {schlagwortAnzeige(s)}
                  </Chip>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              icon={<FileText className="size-4" />}
              title="Letzte Dokumente"
              subtitle={`${doks.length} ${doks.length === 1 ? "Dokument" : "Dokumente"} in der E-Akte`}
              action={
                <Button size="sm" variant="ghost" iconRight={<ChevronRight className="size-4" />} onClick={() => onTab("dokumente")}>
                  {/* unter 380 px nur „E-Akte“ – sonst wird die Überschrift „Letzte Dokumente“ abgeschnitten */}
                  E-Akte<span className="max-[379px]:sr-only"> öffnen</span>
                </Button>
              }
            />
            {doks.length === 0 ? (
              <p className="text-[13px] text-fg-3">Noch keine Dokumente. Laden Sie Unterlagen im Reiter „Dokumente“ hoch.</p>
            ) : (
              <>
                <ul id="ue-dokumente" className="-mx-2 grid grid-cols-1 gap-0.5">
                  {(alleDoks ? dokListe : dokListe.slice(0, DOKS_KURZ)).map((d) => (
                    <li key={d.id}>
                      <button type="button" onClick={() => onDok(d.id)} className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-100 hover:bg-[var(--surface-2)]">
                        <DokIcon d={d} size={34} />
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-[14px] font-medium">{d.name}</span>
                          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-fg-3">
                            {kernRang(d) < KERN.length && (
                              <Chip tone="ink" icon={<Pin className="size-3" aria-hidden />}>
                                Kerndokument
                              </Chip>
                            )}
                            <span>
                              {DOK_ART_LABEL[d.art]} · {d.ordner} · {relTime(d.createdAt)}
                            </span>
                          </span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-fg-3" />
                      </button>
                    </li>
                  ))}
                </ul>
                {doks.length > DOKS_KURZ && (
                  <Button size="sm" variant="ghost" className="mt-1.5 max-sm:[--h:44px]" aria-expanded={alleDoks} aria-controls="ue-dokumente" icon={<ChevronDown className={cn("size-4 transition-transform", alleDoks && "rotate-180")} />} onClick={() => setAlleDoks((x) => !x)}>
                    {alleDoks ? "Weniger anzeigen" : `Alle ${doks.length} anzeigen`}
                  </Button>
                )}
              </>
            )}
          </Card>

          <Card>
            <CardHeader icon={<StickyNote className="size-4" />} title="Notizen" subtitle="Interne Vermerke – für Mandanten nicht sichtbar" />
            <div className="grid grid-cols-1 gap-2">
              <Textarea
                id="ue-notiz"
                rows={2}
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                placeholder={feinZeiger ? "Notiz hinzufügen … (⌘/Strg + Enter speichert)" : "Notiz hinzufügen …"}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) speichereNotiz();
                }}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <DiktatKnopf onText={(t) => setNotiz((v) => (v.trim() ? `${v.trim()} ${t}` : t))} />
                <Button size="sm" variant="primary" disabled={!notiz.trim()} onClick={speichereNotiz}>
                  Notiz speichern
                </Button>
              </div>
            </div>
            <ul className="mt-3 grid grid-cols-1 divide-y divide-[var(--line)]">
              <AnimatePresence initial={false}>
                {notizen.map((n) => {
                  const u = byId.get(n.userId);
                  return (
                    <motion.li key={n.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={BEWEGUNG.standard} className="py-3 first:pt-0">
                      <div className="flex items-center gap-2 text-[13px] text-fg-3">
                        {u && <Avatar initialen={u.initialen} farbe={u.farbe} size={20} />}
                        <span className="font-medium text-fg-2">{u?.name ?? "Unbekannt"}</span>
                        <span>· {relTime(n.zeit)}</span>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-fg">{n.text}</p>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
              {notizen.length === 0 && <li className="text-[13px] text-fg-3">Noch keine Notizen.</li>}
            </ul>
          </Card>
        </div>

        <div className="grid grid-cols-1 min-w-0 content-start gap-4">
          <Card>
            <CardHeader
              icon={<CalendarClock className="size-4" />}
              title="Nächste Fristen & Termine"
              action={
                <Button size="sm" variant="ghost" icon={<CalendarPlus className="size-4" />} onClick={onFrist}>
                  Anlegen
                </Button>
              }
            />
            {offen.length === 0 ? (
              <p className="text-[13px] text-fg-3">Keine offenen Fristen – gut so, oder fehlt eine?</p>
            ) : (
              <ul className="-mx-2 grid grid-cols-1 gap-0.5">
                {offen.slice(0, 4).map((f) => (
                  <li key={f.id}>
                    <button type="button" onClick={() => onTab("fristen")} className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors duration-100 hover:bg-[var(--surface-2)]">
                      <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", istKritisch(f) ? "bg-[var(--seal)]" : "bg-[var(--fg-4)]")} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-[14px] font-medium">{f.titel}</span>
                        <span className="block text-[13px] text-fg-3">
                          {FRIST_TYP_LABEL[f.typ]} · {fmtDateWd(f.datum)}
                          {f.uhrzeit ? `, ${f.uhrzeit} Uhr` : ""}
                        </span>
                      </span>
                      <FristChip datum={f.datum} kritisch={istKritisch(f)} className="shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {offen.length > 4 && (
              <button type="button" onClick={() => onTab("fristen")} className="link-leise mt-2 min-h-8 rounded-sm">
                Alle {offen.length} offenen Fristen anzeigen
              </button>
            )}
          </Card>

          <Card>
            <CardHeader
              icon={<Globe className="size-4" />}
              title="Mandantenportal"
              subtitle={akte.mandantenportal ? "Freigeschaltet" : "Nicht freigeschaltet"}
              action={<Switch id="ue-portal" checked={!!akte.mandantenportal} onChange={portal} label="Mandantenportal" />}
            />
            <p className="text-[13px] leading-relaxed text-fg-2">
              {akte.mandantenportal
                ? `${mandant?.name ?? "Der Mandant"} sieht den Stand der Sache, freigegebene Dokumente und kann Unterlagen sicher hochladen – das spart Rückfragen per Telefon.`
                : `Schalten Sie das Portal frei, damit ${mandant?.name ?? "der Mandant"} den Stand jederzeit selbst einsehen und Unterlagen sicher hochladen kann.`}
            </p>
            {akte.mandantenportal && mandant?.email && (
              <div className="mt-3 flex items-center gap-2 break-all text-[13px] text-fg-2">
                <Send className="size-3.5 shrink-0 text-fg-4" aria-hidden /> Zugang an {mandant.email}
              </div>
            )}
            <Button size="sm" variant="ghost" icon={<Eye className="size-4" />} className="mt-3" onClick={portalAktionen.ansehen}>
              Als Mandant ansehen
            </Button>
            {portalAktionen.dialoge}
          </Card>

          <Card>
            <CardHeader icon={<BookMarked className="size-4" />} title="Angeheftete Entscheidungen" subtitle="Rechtsprechung aus der Fall-Datenbank" />
            {entscheidungen.length === 0 ? (
              <div>
                <p className="text-[13px] text-fg-3">Noch keine Entscheidung angeheftet. Die KI-Fallanalyse und die Fall-Datenbank schlagen passende Urteile vor.</p>
                <Button size="sm" variant="secondary" icon={<Library className="size-4" />} className="mt-3" onClick={() => nav(`/fall-datenbank?q=${encodeURIComponent(akte.schlagworte.slice(0, 3).join(" "))}`)}>
                  Fall-Datenbank öffnen
                </Button>
              </div>
            ) : (
              <ul className="grid grid-cols-1 divide-y divide-[var(--line)]">
                {entscheidungen.map((e) => (
                  <li key={e.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Chip>{e.gericht}</Chip>
                      <span className="mono text-[12px] text-fg-2">{e.az}</span>
                      <span className="text-[13px] text-fg-3">· {fmtDate(e.datum)}</span>
                    </div>
                    <div className="mt-1.5 text-[14px] font-medium text-fg">{e.titel}</div>
                    <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-fg-2">{e.leitsatz}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
