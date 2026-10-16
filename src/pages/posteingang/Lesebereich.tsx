import { useMemo, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { ChevronDown, ChevronLeft, CheckCircle2, CornerUpLeft, FileText, Landmark, Loader2, Paperclip, Reply, ShieldCheck, Sparkles, Undo2 } from "lucide-react";
import { fmtDateWd, fmtTime, relTime } from "@/core/dates";
import { TYP_META } from "@/pages/fristen/logik";
import type { Nachricht } from "@/core/types";
import { useCol } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Chip, IconButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { KanalChip } from "./NachrichtenListe";
import { KiKarte } from "./KiKarte";
import { AntwortDrawer } from "./AntwortDrawer";
import { SCHRITTE, alsErledigt, antwortBetreff, istGerichtspost, type KiAnsicht } from "./analyse";

function initialen(name: string) {
  const teile = name.replace(/[–-].*$/, "").replace(/\b(GmbH|AG|KG|eG|mbH|Co\.|&)\b/g, "").trim().split(/\s+/).filter(Boolean);
  if (!teile.length) return "?";
  return ((teile[0][0] ?? "") + (teile.length > 1 ? teile[teile.length - 1][0] : "")).toUpperCase();
}

function groesse(kb: number) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1).replace(".", ",")} MB` : `${kb} KB`;
}

/** Schmale KI-Leiste im Kopf: das Wichtigste der Analyse auf einen Blick – Klick springt zur KI-Karte. */
function KiLeiste({ ansicht, schritt, akteAz, eeb }: { ansicht: KiAnsicht | null; schritt?: number; akteAz?: string; eeb: boolean }) {
  const springe = () => {
    const el = document.getElementById("ki-karte");
    const sc = (el?.closest("[data-lesescroll]") as HTMLElement | null) ?? document.getElementById("haupt-scroll");
    if (!el || !sc) return;
    const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - (sc.id === "haupt-scroll" ? 88 : 16);
    sc.scrollTo({ top, behavior: "smooth" });
  };
  const laeuft = schritt !== undefined;
  const notfrist = ansicht?.fristen.find((f) => f.typ === "notfrist") ?? ansicht?.fristen[0];
  return (
    <motion.button
      type="button"
      onClick={springe}
      layout
      className="ai-ring group mt-4 flex w-full items-center gap-3 rounded-[16px] bg-[linear-gradient(100deg,var(--violet-soft),transparent_70%)] px-3.5 py-2.5 text-left"
    >
      <span className="ai-fill grid size-7 shrink-0 place-items-center rounded-[9px] text-white">
        {laeuft ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
      </span>
      <span className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug sm:line-clamp-1">
        {laeuft ? (
          <>
            <span className="ai-text font-semibold">KI analysiert …</span>
            <span className="text-fg-3"> {SCHRITTE[Math.min(schritt!, SCHRITTE.length - 1)].titel}</span>
          </>
        ) : ansicht ? (
          <>
            <span className="font-semibold">{ansicht.typ}</span>
            {akteAz && <span className="text-fg-3"> · Akte <span className="mono text-fg-2">{akteAz}</span> ({Math.round(ansicht.sicherheit * 100)} %)</span>}
            {notfrist ? (
              <span className={notfrist.typ === "notfrist" ? "text-seal" : "text-fg-2"}>
                {" "}· {TYP_META[notfrist.typ].label} bis {fmtDateWd(notfrist.ende)}
              </span>
            ) : ansicht.termin ? (
              <span className="text-violet"> · Termin {fmtDateWd(ansicht.termin.datum)}{ansicht.termin.uhrzeit ? `, ${ansicht.termin.uhrzeit} Uhr` : ""}</span>
            ) : (
              <span className="text-fg-3"> · keine Frist</span>
            )}
            {eeb && <span className="text-amber"> · eEB offen</span>}
          </>
        ) : (
          <span className="text-fg-2">Noch nicht analysiert – Akte & Fristen erkennen lassen</span>
        )}
      </span>
      <span className="hidden shrink-0 items-center gap-1 text-[12px] font-medium text-ink sm:inline-flex">
        KI-Analyse
        <ChevronDown className="size-3.5 transition-transform group-hover:translate-y-0.5" />
      </span>
    </motion.button>
  );
}

export function Lesebereich({
  n, ansicht, schritt, fehler, onAnalyse, onBack,
}: {
  n: Nachricht;
  ansicht: KiAnsicht | null;
  schritt?: number;
  fehler?: string;
  onAnalyse: () => void;
  onBack?: () => void;
}) {
  const { user, tenant } = useKanzlei();
  const akten = useCol("akten");
  const nachrichten = useCol("nachrichten");
  const [antworten, setAntworten] = useState(false);
  const akte = n.akteId ? akten.find((a) => a.id === n.akteId) : undefined;
  const verlauf = useMemo(() => {
    const b = antwortBetreff(n.betreff);
    return nachrichten.filter((m) => m.richtung === "aus" && m.betreff === b && m.eingang >= n.eingang).sort((a, c) => a.eingang.localeCompare(c.eingang));
  }, [nachrichten, n.betreff, n.eingang]);

  return (
    <article className="min-w-0">
      <header className="border-b border-[var(--line)] px-4 pb-4 pt-4 sm:px-6 sm:pt-5">
        {onBack && (
          <button type="button" onClick={onBack} className="-ml-2 mb-3 inline-flex h-9 items-center gap-1 rounded-full pl-1 pr-3 text-[14px] font-medium text-ink hover:bg-ink-softer">
            <ChevronLeft className="size-5" />
            Posteingang
          </button>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <KanalChip kanal={n.kanal} />
          {akte && (
            <Link to={`/akten/${akte.id}`} className="chip mono hover:bg-ink-soft" title={akte.titel}>
              {akte.aktenzeichen}
            </Link>
          )}
          {n.eebErforderlich && (n.eebAbgegeben ? <Chip tone="green" icon={<ShieldCheck className="size-3" />}>eEB abgegeben</Chip> : <Chip tone="amber">eEB angefordert</Chip>)}
          {n.status === "erledigt" && (
            <Chip tone="green" icon={<CheckCircle2 className="size-3" />}>
              Erledigt
            </Chip>
          )}
        </div>
        <h2 className="title-lg mt-2.5 break-words">{n.betreff}</h2>
        <div className="mt-3.5 flex flex-wrap items-center gap-3">
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-semibold", n.kanal === "bea" ? "bg-ink-soft text-ink" : "bg-[var(--ink-softer)] text-fg-2 ring-1 ring-inset ring-[var(--line)]")}>
            {istGerichtspost(n) ? <Landmark className="size-[18px]" /> : initialen(n.von)}
          </span>
          <div className="min-w-0 flex-1 basis-[200px]">
            <div className="truncate text-[13.5px] font-semibold">
              {n.von}
              {n.vonAdresse && <span className="ml-1.5 font-normal text-fg-3">{n.kanal === "bea" ? `SAFE-ID ${n.vonAdresse}` : n.vonAdresse}</span>}
            </div>
            <div className="num truncate text-[12px] text-fg-3">
              an {n.an || tenant.kurzname} · {fmtDateWd(n.eingang.slice(0, 10))}, {fmtTime(n.eingang)} Uhr{new Date(n.eingang).getTime() <= Date.now() ? ` · ${relTime(n.eingang)}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" icon={<Reply className="size-4" />} onClick={() => setAntworten(true)}>
              Antworten
            </Button>
            {n.status !== "erledigt" ? (
              <IconButton
                label="Als erledigt markieren"
                onClick={() => {
                  alsErledigt(n, user);
                  toast("Als erledigt markiert", { ton: "erfolg", aktion: { label: "Rückgängig", onClick: () => alsErledigt(n, user, false) } });
                }}
              >
                <CheckCircle2 className="size-[18px]" />
              </IconButton>
            ) : (
              <IconButton label="Wieder öffnen" onClick={() => alsErledigt(n, user, false)}>
                <Undo2 className="size-[18px]" />
              </IconButton>
            )}
          </div>
        </div>
        <KiLeiste ansicht={ansicht} schritt={schritt} akteAz={ansicht?.akteId ? akten.find((a) => a.id === ansicht.akteId)?.aktenzeichen : undefined} eeb={!!n.eebErforderlich && !n.eebAbgegeben} />
      </header>

      <div className="space-y-5 px-4 pb-8 pt-5 sm:px-6 xl:pb-24">
        <div className="whitespace-pre-line break-words text-[13.5px] leading-[1.65] text-fg-2">{n.text}</div>

        {n.anhaenge.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-fg-3">
              <Paperclip className="size-3.5" />
              <span className="eyebrow">
                {n.anhaenge.length} {n.anhaenge.length === 1 ? "Anhang" : "Anhänge"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {n.anhaenge.map((a) => (
                <span key={a.name} className="inline-flex max-w-full items-center gap-2 rounded-[12px] bg-surface/80 py-1.5 pl-2 pr-3 ring-1 ring-inset ring-[var(--line)]">
                  <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-seal-soft text-seal">
                    <FileText className="size-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-medium">{a.name}</span>
                    <span className="num block text-[11px] text-fg-3">{groesse(a.groesseKb)}</span>
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div id="ki-karte" className="scroll-mt-4">
          <KiKarte n={n} ansicht={ansicht} schritt={schritt} fehler={fehler} onAnalyse={onAnalyse} />
        </div>

        {verlauf.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-fg-3">
              <CornerUpLeft className="size-3.5" />
              <span className="eyebrow">Ihre Antwort{verlauf.length > 1 ? "en" : ""}</span>
            </div>
            <div className="space-y-2.5">
              {verlauf.map((m) => (
                <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="ml-auto max-w-[92%] rounded-[18px] rounded-br-[6px] bg-ink-soft p-4">
                  <div className="num mb-1.5 text-[11.5px] text-fg-3">
                    {m.von} · {fmtTime(m.eingang)} Uhr · {m.kanal === "bea" ? "per beA" : "per E-Mail"} an {m.an}
                  </div>
                  <div className="whitespace-pre-line text-[13.5px] leading-relaxed text-fg">{m.text}</div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AntwortDrawer n={n} open={antworten} onClose={() => setAntworten(false)} />
    </article>
  );
}
