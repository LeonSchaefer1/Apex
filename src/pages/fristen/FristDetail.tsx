import { useState } from "react";
import { useNavigate } from "react-router";
import { CalendarClock, CalendarPlus, Clock, FolderOpen, MapPin, ShieldAlert, Trash2 } from "lucide-react";
import { fmtDateShort, fmtDateWd, relDays, schuetzeLeerzeichen, wochentagName, fmtDateLong } from "@/core/dates";
import { fristArtZu } from "@/core/fristen";
import type { Akte, Frist, User } from "@/core/types";
import { Avatar, Button, Drawer } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ErledigtKnopf, KontrolleAktion, KontrollStatus, NachweisZeile, QuelleChip, RechenwegListe, TypChip, useFristAktionen } from "./FristZeile";
import { TYP_META } from "./logik";
import { DateiDialog, type AusgabeDatei } from "./dateiAusgabe";
import { erzeugeIcs, icsDateiname } from "./ics";

/** Kompakte Kalender-Pille (Woche/Monat). */
export function FristPille({ f, akte, onClick, ohneAz }: { f: Frist; akte?: Akte; onClick: () => void; ohneAz?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${TYP_META[f.typ].label}: ${f.titel}${akte ? ` · ${akte.aktenzeichen} ${akte.titel}` : ""}`}
      className={cn(
        "flex w-full min-w-0 items-start gap-1 rounded-[9px] px-2 py-1.5 text-left text-[12px] leading-tight transition-[transform,box-shadow] duration-300 ease-[var(--spring)] hover:-translate-y-px hover:shadow-[0_4px_12px_-6px_rgba(20,30,80,0.3)]",
        TYP_META[f.typ].pill,
        f.status === "erledigt" && "opacity-50",
      )}
    >
      {(f.typ === "notfrist" || (f.typ === "frist" && fristArtZu(f)?.kritisch)) && <ShieldAlert className="mt-px size-3 shrink-0" aria-label={f.typ === "notfrist" ? "Notfrist" : "nicht verlängerbar"} />}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate font-semibold", f.status === "erledigt" && "line-through")}>
          {f.uhrzeit ? <span className="num font-medium opacity-80">{f.uhrzeit} </span> : null}
          {f.titel.replace(/^Vorfrist: /, "")}
        </span>
        {!ohneAz && akte && <span className="mono mt-0.5 block truncate text-[12px] opacity-80">{akte.aktenzeichen}</span>}
      </span>
    </button>
  );
}

function DetailInhalt({ f, akte, team, user, onClose }: { f: Frist; akte?: Akte; team: User[]; user: User; onClose: () => void }) {
  const nav = useNavigate();
  const { erledigt, umschalten, kontrollieren, streichen, dialog } = useFristAktionen(f, user);
  const [datei, setDatei] = useState<AusgabeDatei | null>(null);
  const ics = () =>
    setDatei({
      name: icsDateiname(f, akte),
      mime: "text/calendar",
      inhalt: erzeugeIcs([{ f, akte }], `${TYP_META[f.typ].label} ${akte?.aktenzeichen ?? ""}`.trim()),
      beschreibung: "Kalendereintrag mit Rechenweg zum Übernehmen in Outlook, Apple oder Google Kalender",
    });
  const v = team.find((u) => u.id === f.verantwortlichId);
  const art = f.typ === "notfrist" || f.typ === "frist" ? fristArtZu(f) : undefined;
  const kritisch = !!art?.kritisch;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <TypChip typ={f.typ} regelKey={f.regelKey} />
        <QuelleChip quelle={f.quelle} notiz={f.notiz} />
        <KontrollStatus f={f} team={team} />
        <NachweisZeile f={f} team={team} />
      </div>
      <div className={cn("rounded-[20px] p-4", kritisch ? "bg-seal-soft" : "bg-[var(--ink-softer)] ring-1 ring-inset ring-[var(--line)]")}>
        <div className={cn("eyebrow", kritisch && "!text-seal")}>{f.typ === "termin" ? "Termin" : f.typ === "vorfrist" ? "Vorfrist" : "Fristende"}</div>
        <div className={cn("mt-1 text-[24px] font-semibold leading-tight tracking-[-0.03em]", kritisch && "text-seal")}>
          {wochentagName(f.datum)}, {fmtDateLong(f.datum)}
        </div>
        <div className="num mt-1 flex flex-wrap items-center gap-x-3 text-[12.5px] text-fg-2">
          <span>{relDays(f.datum)}</span>
          {f.uhrzeit ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {f.uhrzeit} Uhr
            </span>
          ) : f.typ !== "termin" && f.typ !== "wiedervorlage" ? (
            <span>24:00 Uhr</span>
          ) : null}
          {f.ort && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {f.ort}
            </span>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
        {akte && (
          <div className="col-span-2">
            <dt className="eyebrow">Akte</dt>
            <dd className="mt-0.5">
              <span className="mono font-semibold text-ink">{akte.aktenzeichen}</span> {akte.titel}
            </dd>
          </div>
        )}
        {f.grundlage && (
          <div>
            <dt className="eyebrow">Grundlage</dt>
            <dd className="mt-0.5 font-medium">{f.grundlage}</dd>
          </div>
        )}
        {f.ereignisDatum && (
          <div>
            <dt className="eyebrow">Ereignis</dt>
            <dd className="num mt-0.5 font-medium">{fmtDateWd(f.ereignisDatum)}</dd>
          </div>
        )}
        {f.vorfrist && f.typ !== "vorfrist" && (
          <div>
            <dt className="eyebrow">Vorfrist</dt>
            <dd className="num mt-0.5 font-medium">{fmtDateWd(f.vorfrist)}</dd>
          </div>
        )}
        {v && (
          <div>
            <dt className="eyebrow">Verantwortlich</dt>
            <dd className="mt-1 flex items-center gap-2 font-medium">
              <Avatar initialen={v.initialen} farbe={v.farbe} size={22} />
              {v.name}
            </dd>
          </div>
        )}
        {f.erledigtAm && (
          <div>
            <dt className="eyebrow">Erledigt</dt>
            <dd className="num mt-0.5 font-medium text-green">{fmtDateShort(f.erledigtAm.slice(0, 10))}</dd>
          </div>
        )}
      </dl>
      {f.rechenweg?.length ? (
        <div>
          <div className="eyebrow mb-2.5">Rechenweg</div>
          <RechenwegListe schritte={f.rechenweg} />
        </div>
      ) : null}
      {art?.versaeumnis && f.status === "offen" && (
        <p className={cn("flex gap-2 rounded-[14px] p-3 text-[12.5px] leading-relaxed", kritisch ? "bg-seal-soft text-seal" : "bg-[var(--ink-softer)] text-fg-2")}>
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {art.art && <strong className="font-semibold">{schuetzeLeerzeichen(art.art)} </strong>}
            {schuetzeLeerzeichen(art.versaeumnis)}
          </span>
        </p>
      )}
      {f.notiz && <p className="rounded-[14px] bg-[var(--ink-softer)] p-3 text-[12.5px] leading-relaxed text-fg-2">{f.notiz}</p>}
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-4">
        {f.status === "offen" && <KontrolleAktion f={f} user={user} kontrollieren={kontrollieren} verantwortlich={v} />}
        <ErledigtKnopf erledigt={erledigt} onClick={umschalten} />
        {f.status === "offen" && f.typ !== "termin" && f.typ !== "vorfrist" && (
          <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" />} onClick={streichen} title="Streichen – mit Pflichtgrund, protokolliert">
            Streichen
          </Button>
        )}
        <Button size="sm" variant="ghost" icon={<CalendarPlus className="size-4" />} onClick={ics} title="Als Kalenderdatei (.ics) in Outlook, Apple oder Google Kalender übernehmen">
          In Kalender übernehmen (.ics)
        </Button>
        {akte && (
          <Button
            size="sm"
            variant="ghost"
            icon={<FolderOpen className="size-4" />}
            onClick={() => {
              onClose();
              nav(`/akten/${akte.id}?tab=fristen`);
            }}
          >
            Zur Akte
          </Button>
        )}
      </div>
      {dialog}
      <DateiDialog datei={datei} onClose={() => setDatei(null)} />
    </div>
  );
}

export function FristDetail({ f, akte, team, user, onClose }: { f?: Frist; akte?: Akte; team: User[]; user: User; onClose: () => void }) {
  return (
    <Drawer open={!!f} onClose={onClose} width={500} title={f?.titel ?? ""} subtitle={akte ? `${akte.aktenzeichen} · ${akte.titel}` : undefined} icon={<CalendarClock className="size-[18px]" />}>
      {f && <DetailInhalt key={f.id} f={f} akte={akte} team={team} user={user} onClose={onClose} />}
    </Drawer>
  );
}
