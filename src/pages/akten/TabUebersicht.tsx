// Reiter „Übersicht“: Sachverhalt, nächste Fristen, letzte Dokumente, Notizen, Mandantenportal, Entscheidungen.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { BookMarked, CalendarClock, CalendarPlus, ChevronRight, Eye, FileText, Globe, Hourglass, Library, NotebookPen, PenLine, ReceiptEuro, Send, StickyNote } from "lucide-react";
import type { Akte } from "@/core/types";
import { istKritisch, zaehltAlsFrist } from "@/core/fristenLage";
import { ENTSCHEIDUNGEN } from "@/core/rechtsprechung";
import { fmtDate, fmtDateWd, fmtEUR, nowLocal, relTime, uid } from "@/core/dates";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Avatar, Button, Card, CardHeader, Chip, Switch, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { DOK_ART_LABEL, FRIST_TYP_LABEL, FristChip, beruehreAkte, schlagwortAnzeige, useKontaktMap, useTeam } from "./helfer";
import { DokIcon } from "./TabDokumente";
import { DiktatKnopf } from "./Diktat";
import { useMandantenportal } from "./Mandantenportal";

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
  const [bearbeite, setBearbeite] = useState(false);
  const [sachverhalt, setSachverhalt] = useState(akte.beschreibung);
  const mandant = kontakte.get(akte.mandantId);
  const portalAktionen = useMandantenportal(akte);
  // Aktenkonto-Kennzahl nur für Rollen mit Zugriff (Auszubildende sehen das Aktenkonto nicht)
  const mitAktenkonto = user.rolle !== "azubi";

  const offen = useMemo(() => fristen.filter((f) => f.akteId === akte.id && f.status === "offen" && f.typ !== "vorfrist").sort((a, b) => a.datum.localeCompare(b.datum)), [fristen, akte.id]);
  const doks = useMemo(() => dokumente.filter((d) => d.akteId === akte.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [dokumente, akte.id]);
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
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kennzahlen.map((k, i) => (
          <motion.button
            key={k.label}
            type="button"
            disabled={!k.on}
            onClick={k.on}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={cn("sheet flex min-w-0 items-center gap-3 rounded-[18px] p-3.5 text-left transition-transform duration-300 ease-[var(--spring)] disabled:cursor-default", k.on && "hover:-translate-y-0.5 active:scale-[0.98]")}
          >
            <span className="grid grid-cols-1 size-9 shrink-0 place-items-center rounded-[11px] bg-ink-soft text-ink">{k.icon}</span>
            <span className="min-w-0">
              <span className="block text-[12.5px] text-fg-3">{k.label}</span>
              <span className="num block truncate text-[16px] font-semibold tracking-[-0.02em]">{k.wert}</span>
            </span>
          </motion.button>
        ))}
      </div>

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
                  E-Akte öffnen
                </Button>
              }
            />
            {doks.length === 0 ? (
              <p className="text-[13px] text-fg-3">Noch keine Dokumente. Laden Sie Unterlagen im Reiter „Dokumente“ hoch.</p>
            ) : (
              <ul className="-mx-2 grid grid-cols-1 gap-0.5">
                {doks.slice(0, 5).map((d) => (
                  <li key={d.id}>
                    <button type="button" onClick={() => onDok(d.id)} className="flex w-full items-center gap-3 rounded-[14px] px-2 py-2 text-left transition-colors hover:bg-ink-softer">
                      <DokIcon d={d} size={34} />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-[13.5px] font-medium">{d.name}</span>
                        <span className="block text-[12.5px] text-fg-3">
                          {DOK_ART_LABEL[d.art]} · {d.ordner} · {relTime(d.createdAt)}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-fg-3" />
                    </button>
                  </li>
                ))}
              </ul>
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
                placeholder="Notiz hinzufügen … (⌘/Strg + Enter speichert)"
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
            <ul className="mt-3 grid grid-cols-1 gap-2">
              <AnimatePresence initial={false}>
                {notizen.map((n) => {
                  const u = byId.get(n.userId);
                  return (
                    <motion.li key={n.id} layout initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 460, damping: 34 }} className="rounded-[14px] bg-ink-softer p-3">
                      <div className="flex items-center gap-2 text-[12.5px] text-fg-3">
                        {u && <Avatar initialen={u.initialen} farbe={u.farbe} size={20} />}
                        <span className="font-medium text-fg-2">{u?.name ?? "Unbekannt"}</span>
                        <span>· {relTime(n.zeit)}</span>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-fg">{n.text}</p>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
              {notizen.length === 0 && <li className="text-[12.5px] text-fg-3">Noch keine Notizen.</li>}
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
                    <button type="button" onClick={() => onTab("fristen")} className="flex w-full items-start gap-3 rounded-[14px] px-2 py-2 text-left transition-colors hover:bg-ink-softer">
                      <span className={cn("mt-1 size-2 shrink-0 rounded-full", istKritisch(f) ? "bg-seal" : f.typ === "termin" ? "bg-ink" : "bg-[var(--line-strong)]")} />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-[13.5px] font-medium">{f.titel}</span>
                        <span className="block text-[12.5px] text-fg-3">
                          {FRIST_TYP_LABEL[f.typ]} · {fmtDateWd(f.datum)}
                          {f.uhrzeit ? `, ${f.uhrzeit} Uhr` : ""}
                        </span>
                      </span>
                      <FristChip datum={f.datum} className="shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {offen.length > 4 && (
              <button type="button" onClick={() => onTab("fristen")} className="mt-2 text-[12.5px] font-medium text-ink hover:underline">
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
              <div className="mt-3 flex items-center gap-2 break-all rounded-[12px] bg-green-soft px-3 py-2 text-[12.5px] text-green">
                <Send className="size-3.5 shrink-0" /> Zugang an {mandant.email}
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
              <ul className="grid grid-cols-1 gap-2.5">
                {entscheidungen.map((e) => (
                  <li key={e.id} className="rounded-[14px] bg-ink-softer p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Chip tone="ink">{e.gericht}</Chip>
                      <span className="mono text-[12px] text-fg-2">{e.az}</span>
                      <span className="text-[12.5px] text-fg-3">· {fmtDate(e.datum)}</span>
                    </div>
                    <div className="mt-1.5 text-[13.5px] font-semibold">{e.titel}</div>
                    <p className="mt-1 line-clamp-3 text-[12.5px] leading-relaxed text-fg-2">{e.leitsatz}</p>
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
