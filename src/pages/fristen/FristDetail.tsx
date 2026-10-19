import { useState } from "react";
import { useNavigate } from "react-router";
import { CalendarClock, CalendarPlus, Clock, FolderOpen, MapPin, PenLine, Trash2, TriangleAlert } from "lucide-react";
import { fmtDate, fmtDateShort, fmtDateWd, fmtTime, relDays, schuetzeLeerzeichen, wochentagName, fmtDateLong } from "@/core/dates";
import { fristArtZu } from "@/core/fristen";
import type { Akte, Frist, User } from "@/core/types";
import { Avatar, Button, Drawer } from "@/components/ui";
import { cn } from "@/lib/cn";
import { EebAbweichungChip, ErledigtKnopf, KontrolleAktion, KontrollStatus, KorrekturHinweis, NachweisZeile, QuelleChip, RechenwegListe, TypChip, korrigierbar, useEebDatum, useFristAktionen } from "./FristZeile";
import { TYP_META, kalenderMeta } from "./logik";
import { DateiDialog, type AusgabeDatei } from "./dateiAusgabe";
import { erzeugeIcs, icsDateiname } from "./ics";

/**
 * Korrektur-Historie: „17.10.2026, 05:42 Uhr · Dr. Julia Hartmann · 17.11.2026 → 17.11.2026 · Grund: …“ – der neue Wert ist das
 * Datum vor der nächsten Korrektur bzw. das aktuelle Fristende (I4-T03-04).
 */
export function korrekturVerlauf(f: Pick<Frist, "datum" | "titel" | "korrekturen" | "ereignisDatum">, team: Pick<User, "id" | "name">[], eebDatum?: string) {
  const liste = f.korrekturen ?? [];
  return liste.map((k, i) => {
    const naechste = liste[i + 1];
    const neuDatum = naechste ? naechste.vorher.datum : f.datum;
    const neuTitel = naechste ? naechste.vorher.titel : f.titel;
    const neuEreignis = naechste ? naechste.vorher.ereignisDatum : f.ereignisDatum;
    return {
      am: k.am,
      zeit: `${fmtDate(k.am.slice(0, 10))}, ${fmtTime(k.am)} Uhr`,
      person: team.find((u) => u.id === k.vonId)?.name ?? "unbekannte Person",
      alt: fmtDate(k.vorher.datum),
      neu: fmtDate(neuDatum),
      titelAlt: k.vorher.titel && k.vorher.titel !== neuTitel ? k.vorher.titel : undefined,
      // Ereignis alt → neu und das Zustellungsdatum laut eEB daneben (I5-T03-01)
      ereignis: k.vorher.ereignisDatum && neuEreignis && k.vorher.ereignisDatum !== neuEreignis ? `Ereignis ${fmtDate(k.vorher.ereignisDatum)} → ${fmtDate(neuEreignis)}` : undefined,
      eeb: eebDatum ? `eEB ${fmtDate(eebDatum)}` : undefined,
      grund: k.grund,
    };
  });
}

/** Kompakte Kalender-Pille (Woche/Monat) – kritische Fristen rot wie Notfristen, mit sichtbarem „nicht verlängerbar“. */
export function FristPille({ f, akte, onClick, ohneAz }: { f: Frist; akte?: Akte; onClick: () => void; ohneAz?: boolean }) {
  const k = kalenderMeta(f);
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${k.kritisch ?? TYP_META[f.typ].label}: ${f.titel}${akte ? ` · ${akte.aktenzeichen} ${akte.titel}` : ""}`}
      className={cn(
        "flex w-full min-w-0 items-start gap-1 rounded-sm px-2 py-1.5 text-left text-[12px] leading-tight transition-[filter] duration-100 hover:brightness-[0.97] focus-visible:outline-offset-1",
        k.pill,
        f.status === "erledigt" && "opacity-50",
      )}
    >
      {k.kritisch && <TriangleAlert className="mt-px size-3 shrink-0 text-[var(--seal)]" aria-hidden />}
      <span className="min-w-0 flex-1">
        {k.kritisch && <span className="block text-[12px] font-semibold">{k.kritisch}</span>}
        <span className={cn("block truncate font-medium", f.status === "erledigt" && "line-through")}>
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
  const { erledigt, umschalten, kontrollieren, streichen, korrigieren, korrekturAnfordern, dialog } = useFristAktionen(f, user);
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
  const eebDatum = useEebDatum(f);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <TypChip typ={f.typ} regelKey={f.regelKey} />
        <QuelleChip quelle={f.quelle} notiz={f.notiz} />
        <KontrollStatus f={f} team={team} />
        <EebAbweichungChip f={f} />
        <NachweisZeile f={f} team={team} />
      </div>
      <KorrekturHinweis f={f} team={team} />
      <div className={cn("rounded-md p-4", kritisch ? "bg-seal-soft shadow-[inset_2px_0_0_var(--seal)]" : "bg-[var(--surface-2)]")}>
        <div className={cn("eyebrow", kritisch && "!text-[var(--seal-text)]")}>{f.typ === "termin" ? "Termin" : f.typ === "vorfrist" ? "Vorfrist" : "Fristende"}</div>
        <div className={cn("mt-1 text-[22px] font-semibold leading-tight tracking-[-0.02em]", kritisch && "text-seal")}>
          {wochentagName(f.datum)}, {fmtDateLong(f.datum)}
        </div>
        <div className="num mt-1 flex flex-wrap items-center gap-x-3 text-[13px] text-fg-2">
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
              <span className="mono font-medium text-fg">{akte.aktenzeichen}</span> {akte.titel}
            </dd>
          </div>
        )}
        {f.grundlage && !eebDatum && (
          <div>
            <dt className="eyebrow">Grundlage</dt>
            <dd className="mt-0.5 font-medium">{f.grundlage}</dd>
          </div>
        )}
        {/* Mit eEB: Ereignis und Zustellungsdatum laut eEB nebeneinander (Vier-Augen-Kontrolle, I5-T03-01) */}
        {f.ereignisDatum && (
          <div>
            <dt className="eyebrow">Ereignis</dt>
            <dd className={cn("num mt-0.5 font-medium", eebDatum && eebDatum !== f.ereignisDatum && "text-seal")}>{fmtDateWd(f.ereignisDatum)}</dd>
          </div>
        )}
        {eebDatum && (
          <div>
            <dt className="eyebrow">Zustellung laut eEB</dt>
            <dd className="num mt-0.5 font-medium">{fmtDateWd(eebDatum)}</dd>
          </div>
        )}
        {f.grundlage && eebDatum && (
          <div>
            <dt className="eyebrow">Grundlage</dt>
            <dd className="mt-0.5 font-medium">{f.grundlage}</dd>
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
        <p className={cn("banner !text-[13px] !leading-[18px]", kritisch && "banner-seal")}>
          <TriangleAlert aria-hidden />
          <span>
            {art.art && <strong className="font-semibold">{schuetzeLeerzeichen(art.art)} </strong>}
            {schuetzeLeerzeichen(art.versaeumnis)}
          </span>
        </p>
      )}
      {f.notiz && <p className="rounded-md bg-[var(--surface-2)] p-3 text-[13px] leading-relaxed text-fg-2">{f.notiz}</p>}
      {f.korrekturen?.length ? (
        <div>
          <div className="eyebrow mb-1.5">Korrekturen</div>
          {/* Vollständige Historie: Zeitpunkt, Person, alt → neu, Grund (I4-T03-04) */}
          <ul className="grid gap-1.5 text-[13px] text-fg-2">
            {korrekturVerlauf(f, team, eebDatum).map((k) => (
              <li key={k.am} className="break-words rounded-md bg-[var(--surface-2)] px-2.5 py-1.5">
                <span className="num">{k.zeit}</span> · {k.person} · <span className="num">{k.alt} → {k.neu}</span>
                {k.titelAlt ? <span className="text-fg-3"> (vorher „{k.titelAlt}“)</span> : null}
                {k.ereignis ? <span className="num"> · {k.ereignis}{k.eeb ? ` (${k.eeb})` : ""}</span> : k.eeb ? <span className="num"> · {k.eeb}</span> : null} · Grund: {k.grund}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-4">
        {f.status === "offen" && <KontrolleAktion f={f} user={user} kontrollieren={kontrollieren} verantwortlich={v} anfordern={korrekturAnfordern} />}
        <ErledigtKnopf erledigt={erledigt} onClick={umschalten} />
        {korrigierbar(f) && (
          <Button size="sm" variant="ghost" icon={<PenLine className="size-4" />} onClick={korrigieren} title="Datum bzw. Fristart und Ereignisdatum korrigieren – mit Pflichtgrund, protokolliert">
            Korrigieren …
          </Button>
        )}
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
