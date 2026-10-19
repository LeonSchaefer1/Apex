import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, Check, CircleCheck, Landmark, Mail, MapPin, Sparkles, ArrowRight, TriangleAlert, UserCheck } from "lucide-react";
import { Avatar, Chip, type Tone } from "@/components/ui";
import { toast } from "@/store/ui";
import { useData } from "@/store/data";
import { addDays, diffDays, fmtDateShort, monatName, fromISO, nowLocal, relTime, wochentagName } from "@/core/dates";
import { fristArtZu } from "@/core/fristen";
import { istKritisch } from "@/core/fristenLage";
import type { Frist, Nachricht } from "@/core/types";
import { cn } from "@/lib/cn";
import { BEWEGUNG } from "@/lib/bewegung";
import { letzteAbfrageText, letzteAbfrageUhrzeit } from "@/lib/betriebsstatus";
import { foermlicherName } from "@/lib/rollen";
import { Abschnitt, GruppenKopf, KRITISCH_BALKEN, ListenKarte, MehrLink } from "./Basis";
import { TYP_LABEL, tagLabel, type CockpitDaten } from "./daten";

function anzahl(n: number, eins: string, viele: string) {
  return `${n} ${n === 1 ? eins : viele}`;
}

/** Typ-Chip: Rot nur für kritische Fristen, Bernstein für Fristen (bald fällig), alles andere neutral (DESIGN-SYSTEM.md 12.6). */
const TYP_TON: Record<Frist["typ"], Tone> = { notfrist: "seal", frist: "amber", vorfrist: "neutral", wiedervorlage: "neutral", termin: "neutral" };

/** Zeile in einer Cockpit-Liste: Polster 12/16 px, Hover Fläche 2. */
const ZEILE = "group flex min-w-0 gap-3 px-4 py-3 transition-colors duration-100 hover:bg-[var(--surface-2)] focus-visible:outline-offset-[-2px]";

// ───────────────────────── Fristen ─────────────────────────
export function FristenKarte({ d, className }: { d: CockpitDaten; className?: string }) {
  const MAX = 7;
  const sichtbar = d.bisWerktag.slice(0, MAX);
  const rest = d.bisWerktag.length - sichtbar.length;
  // Kritische Fristen (Notfrist oder nicht verlängerbar) der nächsten 7 Tage, die nicht ohnehin in der Liste stehen
  const spotlight = d.kritischWoche.filter((f) => f.datum > d.bisTag).slice(0, 2);
  const gruppen: { key: string; label: string; items: Frist[] }[] = [];
  for (const f of sichtbar) {
    const key = f.datum < d.heute ? "ueber" : f.datum;
    let g = gruppen.find((x) => x.key === key);
    if (!g) {
      const label = key === "ueber" ? "Überfällig" : f.datum === d.heute ? `Heute · ${wochentagName(f.datum)}` : `${diffDays(d.heute, f.datum) === 1 ? "Morgen" : wochentagName(f.datum)} · ${fmtDateShort(f.datum)}`;
      g = { key, label, items: [] };
      gruppen.push(g);
    }
    g.items.push(f);
  }
  const bisLabel = d.wochenende ? `bis ${wochentagName(d.bisTag)}` : "bis morgen";
  // Freitags (oder vor Feiertagen) reicht die Liste bis zum nächsten Werktag – der Titel sagt das.
  const titel = d.wochenende ? `Heute & ${wochentagName(d.bisTag)} fällig` : "Heute & morgen fällig";
  // Kopfzeile mit derselben Zählweise wie Briefing, Navigation und Fristenkalender: Fristen, Wiedervorlagen und Vorfristen getrennt
  const nF = d.lage.faellig.length;
  const dazu = [
    d.lage.wiedervorlagen.length ? anzahl(d.lage.wiedervorlagen.length, "Wiedervorlage", "Wiedervorlagen") : "",
    d.lage.vorfristen.length ? anzahl(d.lage.vorfristen.length, "Vorfrist", "Vorfristen") : "",
  ].filter(Boolean);
  const heuteText = `${nF === 0 ? "Heute keine Frist" : `Heute ${anzahl(nF, "Frist", "Fristen")}`}${dazu.length ? `, dazu ${dazu.join(" und ")}` : ""}`;
  const naechsteWoche = addDays(d.heute, 7);

  return (
    <Abschnitt
      label={d.wochenende ? `Heute und bis ${wochentagName(d.bisTag)} fällig` : "Heute und morgen fällig"}
      className={className}
      titel={titel}
      unter={
        d.bisWerktag.length === 0 ? (
          `Nichts offen ${bisLabel}`
        ) : (
          <>
            {heuteText}
            <span className="hidden @md:inline"> · {anzahl(d.bisWerktag.length, "Eintrag", "Einträge")} {bisLabel}</span>
          </>
        )
      }
      mehr={{ to: "/fristen", label: "Alle Fristen" }}
    >
      {(d.vertretungVorab.length > 0 || d.vertretung.length > 0) && (
        <div className="mb-3 grid gap-2">
          {d.vertretungVorab.map((v) => (
            // Vertretung vor dem ersten Abwesenheitstag (I4-T18-04, § 53 BRAO): Warnhinweis mit Symbol und Text
            <div key={v.person.id} className="banner banner-amber" role="note">
              <CalendarClock aria-hidden />
              <span className="min-w-0">
                <span className="font-medium text-[var(--amber-text)]">Vertretung vorab: </span>
                {v.text}
                <Link to="/fristen?vertretung=vorab" className="link ml-1.5 inline-flex min-h-6 items-center gap-0.5 whitespace-nowrap font-medium">
                  Fristen ansehen <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </span>
            </div>
          ))}
          {d.vertretung.map((v) => (
            <Link key={v.person.id} to="/fristen?nur=meine" className="banner transition-colors duration-100 hover:border-[var(--line-strong)]">
              <UserCheck aria-hidden />
              <span className="min-w-0">
                <span className="font-medium text-fg">Sie vertreten heute {v.person.name}</span> – {anzahl(v.fristen, "Frist", "Fristen")}
                {v.weitere > 0 && `, dazu ${anzahl(v.weitere, "Wiedervorlage oder Vorfrist", "Wiedervorlagen und Vorfristen")}`} bis <span className="whitespace-nowrap">{wochentagName(v.bis, true)}, {fmtDateShort(v.bis)}</span>
                {v.bisAbwesenheitsende ? <span className="text-fg-3"> (Ende der Abwesenheit)</span> : <span className="text-fg-3"> (nächste 7 Tage)</span>}
              </span>
            </Link>
          ))}
        </div>
      )}

      <ListenKarte>
        <TermineHeute d={d} />

        {spotlight.length > 0 && (
          <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
            {spotlight.map((f) => (
              <NotfristSpot key={f.id} f={f} d={d} />
            ))}
          </ul>
        )}

        {d.bisWerktag.length === 0 ? (
          <div className="border-t border-[var(--line)]">
            <div className="flex items-start gap-3 px-4 py-3">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-[var(--green)]" aria-hidden />
              <div className="min-w-0">
                <div className="text-[14px] font-medium">Alles im Griff</div>
                <p className="text-[13px] text-fg-3">Bis {wochentagName(d.bisTag)} ist nichts offen. Vorfristen setzt der 38h-Motor automatisch.</p>
              </div>
            </div>
            {d.woche.filter((f) => f.datum > d.bisTag).length > 0 && (
              <>
                <GruppenKopf className="border-t border-[var(--line)]">
                  Als Nächstes · bis {wochentagName(naechsteWoche, true)}, {fmtDateShort(naechsteWoche)}
                </GruppenKopf>
                <ul className="flex min-w-0 flex-col divide-y divide-[var(--line)]">
                  {d.woche
                    .filter((f) => f.datum > d.bisTag)
                    .slice(0, 6)
                    .map((f) => (
                      <FristZeile key={f.id} f={f} d={d} mitDatum />
                    ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          gruppen.map((g) => (
            <div key={g.key} className="border-t border-[var(--line)]">
              <GruppenKopf className={cn(g.key === "ueber" && "!text-[var(--seal-text)]")}>{g.label}</GruppenKopf>
              <ul className="flex min-w-0 flex-col divide-y divide-[var(--line)]">
                <AnimatePresence initial={false}>
                  {g.items.map((f) => (
                    <FristZeile key={f.id} f={f} d={d} />
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          ))
        )}
        {rest > 0 && (
          <div className="border-t border-[var(--line)] px-4 py-2">
            <MehrLink to="/fristen">
              {rest} weitere bis {wochentagName(d.bisTag)}
            </MehrLink>
          </div>
        )}
      </ListenKarte>
    </Abschnitt>
  );
}

function NotfristSpot({ f, d }: { f: Frist; d: CockpitDaten }) {
  const a = d.akten.get(f.akteId);
  const tage = diffDays(d.heute, f.datum);
  const gesamt = f.ereignisDatum ? Math.max(1, diffDays(f.ereignisDatum, f.datum)) : 0;
  const vergangen = f.ereignisDatum ? Math.min(gesamt, Math.max(0, diffDays(f.ereignisDatum, d.heute))) : 0;
  const art = fristArtZu(f);
  return (
    <li className={KRITISCH_BALKEN}>
      <Link to={`/akten/${f.akteId}?tab=fristen`} className={cn(ZEILE, "flex-col gap-1")}>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="seal" voll={tage <= 1} title={art?.kurz}>
            {f.typ === "notfrist" ? "Notfrist" : "Nicht verlängerbar"}
          </Chip>
          <span className="text-[13px] font-medium text-[var(--seal-text)]">
            {tage === 0 ? "heute" : `noch ${tage} ${tage === 1 ? "Tag" : "Tage"}`} · {wochentagName(f.datum, true)}, {fmtDateShort(f.datum)}
          </span>
        </div>
        <div className="text-[14px] font-medium leading-5 text-fg">{f.titel}</div>
        <div className="truncate text-[13px] text-fg-3">
          {a && <span className="mono text-fg-2">{a.aktenzeichen}</span>} {a?.titel}
          {f.grundlage && <> · {f.grundlage}</>}
        </div>
        {gesamt > 0 && (
          <div className="mt-1 flex items-center gap-3">
            <div className="bar flex-1" aria-hidden>
              <span className="!bg-[var(--seal)]" style={{ width: `${(vergangen / gesamt) * 100}%` }} />
            </div>
            <span className="num shrink-0 text-[13px] text-fg-3">
              Tag {vergangen} von {gesamt}
            </span>
          </div>
        )}
      </Link>
    </li>
  );
}

function FristZeile({ f, d, mitDatum }: { f: Frist; d: CockpitDaten; mitDatum?: boolean }) {
  const a = d.akten.get(f.akteId);
  const v = d.team.get(f.verantwortlichId);
  const erledigbar = f.typ === "wiedervorlage" || f.typ === "vorfrist";
  // rot: Notfrist oder gesetzlich nicht verlängerbare Frist (z. B. § 4 KSchG, StPO, OWiG)
  const notfrist = istKritisch(f);
  const art = notfrist ? fristArtZu(f) : undefined;
  const vertretenFuer = d.vertreten.get(f.verantwortlichId);

  const erledigen = () => {
    const st = useData.getState();
    st.patch("fristen", f.id, { status: "erledigt", erledigtAm: nowLocal(), erledigtVon: d.user.id });
    st.log({ akteur: "nutzer", userId: d.user.id, akteId: f.akteId, text: `${TYP_LABEL[f.typ]} erledigt: ${f.titel}${a ? ` – ${a.aktenzeichen}` : ""}` });
    toast(`${TYP_LABEL[f.typ]} erledigt`, {
      text: f.titel,
      ton: "erfolg",
      aktion: { label: "Rückgängig", onClick: () => useData.getState().patch("fristen", f.id, { status: "offen", erledigtAm: undefined, erledigtVon: undefined }) },
    });
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0, transition: BEWEGUNG.standard }}
      transition={BEWEGUNG.standard}
      className={cn("relative overflow-hidden", notfrist && KRITISCH_BALKEN)}
    >
      <div className="group flex items-center gap-3 py-2.5 pl-4 pr-3 transition-colors duration-100 hover:bg-[var(--surface-2)]">
        <Link to={`/akten/${f.akteId}?tab=fristen`} className="min-w-0 flex-1 rounded-sm">
          <div className="truncate text-[14px] font-medium leading-5 text-fg max-[359px]:overflow-visible max-[359px]:whitespace-normal max-[359px]:break-words">
            {f.titel}
            {f.uhrzeit && <span className="num ml-1.5 font-normal text-fg-3">{f.uhrzeit} Uhr</span>}
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-[13px] text-fg-3">
            <Chip tone={notfrist ? "seal" : TYP_TON[f.typ]} title={art?.kurz}>
              {TYP_LABEL[f.typ]}
            </Chip>
            {(f.datum < d.heute || mitDatum) && <span className={cn("shrink-0 font-medium", f.datum < d.heute ? "text-[var(--seal-text)]" : "text-fg-2")}>{tagLabel(f.datum, d.heute)}</span>}
            {vertretenFuer && (
              <Chip tone="outline" className="shrink-0" title={`Vertretung nach § 53 BRAO – ${vertretenFuer.name} ist abwesend`}>
                Vertretung für {foermlicherName(vertretenFuer).replace(/^Herr /, "Herrn ")}
              </Chip>
            )}
            {a && <span className="mono shrink-0 text-fg-2">{a.aktenzeichen}</span>}
            <span className="truncate">{a?.titel}</span>
          </div>
        </Link>
        {v && <Avatar initialen={v.initialen} farbe={v.farbe} size={24} title={`Verantwortlich: ${v.name}`} className="hidden sm:inline-grid" />}
        {erledigbar ? (
          <button
            type="button"
            onClick={erledigen}
            aria-label={`${f.titel} als erledigt markieren`}
            title="Als erledigt markieren"
            className="grid size-8 shrink-0 place-items-center rounded-md text-fg-3 shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors duration-100 hover:bg-[var(--surface-3)] hover:text-fg max-sm:size-11"
          >
            <Check className="size-4" />
          </button>
        ) : (
          <span className="size-8 shrink-0 max-sm:size-11" aria-hidden />
        )}
      </div>
    </motion.li>
  );
}

/** „Termine heute“ – direkt über den heute fälligen Fristen: Uhrzeit, Ort, Akte, Link (Quelle: Fristen mit typ 'termin'). */
function TermineHeute({ d }: { d: CockpitDaten }) {
  return (
    <div className="pb-2">
      <GruppenKopf>
        Termine heute
        {d.termineHeute.length > 0 && <span className="num font-normal text-fg-4"> · {d.termineHeute.length}</span>}
      </GruppenKopf>
      {d.termineHeute.length === 0 ? (
        <p className="px-4 text-[13px] text-fg-3">Heute keine Termine.</p>
      ) : (
        <ul className="grid">
          {d.termineHeute.map((t) => {
            const a = d.akten.get(t.akteId);
            return (
              <li key={t.id}>
                <Link to={`/akten/${t.akteId}?tab=fristen`} className="group flex min-w-0 items-baseline gap-3 px-4 py-1.5 text-[14px] transition-colors duration-100 hover:bg-[var(--surface-2)] focus-visible:outline-offset-[-2px]">
                  <span className="num w-[72px] shrink-0 font-medium text-fg">{t.uhrzeit ? `${t.uhrzeit} Uhr` : "ganztägig"}</span>
                  <span className="min-w-0 truncate font-medium max-[359px]:overflow-visible max-[359px]:whitespace-normal max-[359px]:break-words">{t.titel}</span>
                  {t.ort && <span className="hidden min-w-0 truncate text-[13px] text-fg-3 @md:inline">· {t.ort}</span>}
                  {a && <span className="mono ml-auto shrink-0 text-[13px] text-fg-3">{a.aktenzeichen}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ───────────────────────── Betriebsstatus ─────────────────────────
/**
 * „beA ✓ · E-Mail ✓ · letzte Abfrage …“ – führt zum Systemstatus. Im Posteingang relativ („vor 1 Min.“), im Briefing am
 * Smartphone mit Uhrzeit („01:20 Uhr“), immer mit der Kennzeichnung „simuliert“.
 */
export function StatusZeile({ className, uhrzeit = false }: { className?: string; uhrzeit?: boolean }) {
  return (
    <Link
      to="/hilfe#status"
      className={cn("inline-flex min-h-8 flex-wrap items-center gap-x-2 gap-y-0.5 self-start rounded-sm text-[13px] text-fg-3 transition-colors duration-100 hover:text-fg max-sm:min-h-11", className)}
      title="Systemstatus öffnen – beA, E-Mail und Bank sind im Prototyp simuliert"
    >
      <span className="inline-flex items-center gap-1 font-medium text-fg-2">
        beA <Check className="size-3.5 text-[var(--green)]" aria-label="verbunden" />
      </span>
      <span aria-hidden>·</span>
      <span className="inline-flex items-center gap-1 font-medium text-fg-2">
        E-Mail <Check className="size-3.5 text-[var(--green)]" aria-label="verbunden" />
      </span>
      <span aria-hidden>·</span>
      <span>{uhrzeit ? `letzte Abfrage ${letzteAbfrageUhrzeit()}` : letzteAbfrageText()} (simuliert)</span>
    </Link>
  );
}

// ───────────────────────── Posteingang ─────────────────────────
export function PosteingangKarte({ d, className }: { d: CockpitDaten; className?: string }) {
  const items = d.posteingang.slice(0, 4);
  return (
    <Abschnitt
      label="Neue Nachrichten im Posteingang"
      className={className}
      titel="Posteingang"
      unter={d.posteingang.length ? `${d.posteingang.length} neu · ${d.wartetAufKi} ${d.wartetAufKi === 1 ? "wartet" : "warten"} auf KI-Analyse` : "beA und E-Mail in einem Postfach"}
      mehr={{ to: "/posteingang", label: "Zum Posteingang" }}
    >
      <StatusZeile className="-mt-2 mb-1" />
      <ListenKarte>
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
            <Mail className="size-5 text-fg-4" aria-hidden />
            <div className="mt-3 title-md">Posteingang aufgeräumt</div>
            <p className="mt-1 max-w-[36ch] text-[13px] text-fg-3">Neue beA-Nachrichten und E-Mails ordnet die KI automatisch den Akten zu.</p>
          </div>
        ) : (
          <ul className="flex min-w-0 flex-col divide-y divide-[var(--line)]">
            {items.map((n) => (
              <PostZeile key={n.id} n={n} d={d} />
            ))}
          </ul>
        )}
        {d.posteingang.length > items.length && (
          <div className="border-t border-[var(--line)] px-4 py-2">
            <MehrLink to="/posteingang">{d.posteingang.length - items.length} weitere neue Nachrichten</MehrLink>
          </div>
        )}
      </ListenKarte>
    </Abschnitt>
  );
}

function PostZeile({ n, d }: { n: Nachricht; d: CockpitDaten }) {
  const akteId = n.akteId ?? n.ki?.akteId;
  const a = akteId ? d.akten.get(akteId) : undefined;
  const fertig = n.kiStatus === "analysiert" || n.kiStatus === "uebernommen";
  return (
    <li className="min-w-0">
      <Link to={`/posteingang?id=${encodeURIComponent(n.id)}`} className={ZEILE}>
        <span className="mt-0.5 shrink-0 text-fg-4" title={n.kanal === "bea" ? "beA-Nachricht" : "E-Mail"}>
          {n.kanal === "bea" ? <Landmark className="size-4" aria-label="beA-Nachricht" /> : <Mail className="size-4" aria-label="E-Mail" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-[14px] font-medium text-fg max-[359px]:overflow-visible max-[359px]:whitespace-normal max-[359px]:break-words">{n.von}</span>
            <span className="ml-auto shrink-0 text-[13px] text-fg-4">{relTime(n.eingang)}</span>
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-fg-2 max-[359px]:overflow-visible max-[359px]:whitespace-normal max-[359px]:break-words">{n.betreff}</span>
          {fertig && n.ki ? (
            <span className="mt-1 flex items-start gap-1.5 text-[13px] leading-[18px] text-fg-3">
              <Sparkles className="mt-0.5 size-3 shrink-0" aria-hidden />
              <span className="line-clamp-2">
                <span className="mr-1 font-medium text-fg-2">KI:</span>
                {n.ki.zusammenfassung}
              </span>
            </span>
          ) : (
            <span className="mt-1 block text-[13px] text-fg-4">Wartet auf KI-Analyse</span>
          )}
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            {n.kanal === "bea" && <Chip>beA</Chip>}
            {n.eebErforderlich && !n.eebAbgegeben && <Chip tone="amber">eEB offen</Chip>}
            {n.ki?.frist && <Chip tone="seal">Frist erkannt</Chip>}
            {a ? <span className="mono text-[13px] text-fg-3">{a.aktenzeichen}</span> : <Chip tone="outline">noch keiner Akte zugeordnet</Chip>}
            <span className="ml-auto inline-flex items-center gap-1 text-[13px] font-medium text-fg-2 group-hover:text-fg">
              <Sparkles className="size-3.5" aria-hidden />
              {fertig ? "KI-Analyse ansehen" : "Analysieren lassen"}
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}

// ───────────────────────── Termine ─────────────────────────
export function TermineKarte({ d, className }: { d: CockpitDaten; className?: string }) {
  return (
    <Abschnitt label="Termine und Wochenblick" className={className} titel="Termine" unter="Wochenblick und nächste Gerichts- und Ortstermine" mehr={{ to: "/fristen", label: "Kalender" }}>
      <ListenKarte>
        <div className="grid grid-cols-5 divide-x divide-[var(--line)] border-b border-[var(--line)]">
          {d.wochenTage.map((t) => {
            const ist = t.datum === d.heute;
            const last = t.fristen + t.termine;
            return (
              <Link
                key={t.datum}
                to={`/fristen?datum=${t.datum}`}
                aria-current={ist ? "date" : undefined}
                title={`${wochentagName(t.datum)}: ${anzahl(t.fristen, "Frist", "Fristen")}, ${anzahl(t.termine, "Termin", "Termine")}${t.wiedervorlagen ? ` · dazu ${anzahl(t.wiedervorlagen, "Wiedervorlage", "Wiedervorlagen")}` : ""}${t.kritisch ? " · kritische Frist" : ""}`}
                className={cn(
                  "flex min-h-11 flex-col items-center px-1 py-2 transition-colors duration-100 focus-visible:outline-offset-[-2px]",
                  ist ? "bg-[var(--surface-3)] shadow-[inset_0_2px_0_var(--ink)]" : "hover:bg-[var(--surface-2)]",
                )}
              >
                <span className={cn("text-[12px] leading-4", ist ? "font-semibold text-fg" : "font-medium text-fg-3")}>{wochentagName(t.datum, true)}</span>
                <span className="num text-[15px] font-semibold leading-6 text-fg">{fromISO(t.datum).getUTCDate()}</span>
                <span className="num inline-flex items-center gap-1 text-[12px] leading-4 text-fg-3">
                  {t.kritisch && <TriangleAlert className="size-3 text-[var(--seal)]" aria-hidden />}
                  {last || "–"}
                </span>
              </Link>
            );
          })}
        </div>
        {d.termine.length === 0 ? (
          <p className="px-4 py-5 text-center text-[13px] text-fg-3">Keine Termine geplant. Ladungen aus dem beA trägt die KI automatisch ein.</p>
        ) : (
          <ul className="flex min-w-0 flex-col divide-y divide-[var(--line)]">
            {d.termine.map((t) => {
              const a = d.akten.get(t.akteId);
              const dt = fromISO(t.datum);
              return (
                <li key={t.id}>
                  <Link to={`/akten/${t.akteId}?tab=fristen`} className={cn(ZEILE, "items-start gap-4")}>
                    <span className="w-9 shrink-0 text-center">
                      <span className="block text-[12px] leading-4 text-fg-3">{monatName(dt.getUTCMonth(), true)}</span>
                      <span className="num block text-[18px] font-semibold leading-6 text-fg">{dt.getUTCDate()}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-fg max-[359px]:overflow-visible max-[359px]:whitespace-normal max-[359px]:break-words">{t.titel}</span>
                      <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-fg-3">
                        <span className="shrink-0 text-fg-2">
                          {tagLabel(t.datum, d.heute)}
                          {t.uhrzeit && `, ${t.uhrzeit} Uhr`}
                        </span>
                        {t.ort && (
                          <span className="flex min-w-0 items-center gap-1 truncate">
                            <MapPin className="size-3 shrink-0" aria-hidden />
                            <span className="truncate">{t.ort}</span>
                          </span>
                        )}
                      </span>
                      {a && (
                        <span className="mt-0.5 block truncate text-[13px] text-fg-3">
                          <span className="mono">{a.aktenzeichen}</span> · {a.titel}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {d.termine.length > 0 && d.termine.length < 3 && (
          <p className="mt-auto flex items-start gap-2 border-t border-[var(--line)] px-4 py-3 text-[13px] leading-[18px] text-fg-3">
            <Sparkles className="mt-0.5 size-3 shrink-0" aria-hidden />
            Ladungen aus dem beA erkennt die KI automatisch und trägt sie mit Ort und Uhrzeit hier ein.
          </p>
        )}
      </ListenKarte>
    </Abschnitt>
  );
}

// ───────────────────────── Akten mit Handlungsbedarf ─────────────────────────
const GRUND_TON: Record<string, Tone> = { seal: "seal", amber: "amber", ink: "ink", violet: "outline", neutral: "neutral" };

export function AktenKarte({ d, className }: { d: CockpitDaten; className?: string }) {
  const items = d.handlungsbedarf.slice(0, 5);
  return (
    <Abschnitt
      label="Akten mit Handlungsbedarf"
      className={className}
      titel="Akten mit Handlungsbedarf"
      unter={`${anzahl(d.aktenMitFrist, "Akte", "Akten")} mit Frist ≤ 7 Tage${d.aktenNurPrio ? ` · dazu ${d.aktenNurPrio} mit hoher Priorität` : ""}`}
      mehr={{ to: "/akten?frist=frist7", label: "In Akten ansehen" }}
    >
      <ListenKarte>
        {items.length === 0 ? (
          <p className="flex items-center justify-center gap-2 px-4 py-6 text-center text-[13px] text-fg-3">
            <CircleCheck className="size-4 shrink-0 text-[var(--green)]" aria-hidden />
            Keine Akte braucht gerade Ihre Aufmerksamkeit.
          </p>
        ) : (
          <ul className="flex min-w-0 flex-col divide-y divide-[var(--line)]">
            {items.map(({ akte, gruende }) => {
              const b = d.team.get(akte.bearbeiterId);
              return (
                <li key={akte.id} className="min-w-0">
                  <Link to={`/akten/${akte.id}`} className={cn(ZEILE, "items-center")}>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="mono shrink-0 text-[13px] text-fg-2">{akte.aktenzeichen}</span>
                        <span className="truncate text-[14px] font-medium text-fg max-[359px]:overflow-visible max-[359px]:whitespace-normal max-[359px]:break-words">{akte.titel}</span>
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        {gruende.map((g) => (
                          <Chip key={g.text} tone={GRUND_TON[g.ton] ?? "neutral"}>
                            {g.text}
                          </Chip>
                        ))}
                        <span className="truncate text-[13px] text-fg-3">
                          {akte.sachgebiet} · {akte.phase}
                        </span>
                      </span>
                    </span>
                    {b && <Avatar initialen={b.initialen} farbe={b.farbe} size={24} title={`Bearbeitung: ${b.name}`} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </ListenKarte>
    </Abschnitt>
  );
}
