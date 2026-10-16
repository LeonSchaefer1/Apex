import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, CalendarDays, Check, CheckCircle2, FolderOpen, Gavel, Inbox, Landmark, Mail, MapPin, ShieldAlert, Sparkles, ArrowRight, UserCheck } from "lucide-react";
import { Avatar, Chip } from "@/components/ui";
import { toast } from "@/store/ui";
import { useData } from "@/store/data";
import { addDays, diffDays, fmtDateShort, monatName, fromISO, nowLocal, relTime, wochentagName } from "@/core/dates";
import { fristArtZu } from "@/core/fristen";
import { istKritisch } from "@/core/fristenLage";
import type { Frist, Nachricht } from "@/core/types";
import { cn } from "@/lib/cn";
import { letzteAbfrageText } from "@/lib/betriebsstatus";
import { foermlicherName } from "@/lib/rollen";
import { BentoKarte, KartenKopf, MehrLink, Streifen } from "./Basis";
import { TYP_LABEL, tagLabel, type CockpitDaten } from "./daten";

function anzahl(n: number, eins: string, viele: string) {
  return `${n} ${n === 1 ? eins : viele}`;
}

const TYP_TON = { notfrist: "seal", frist: "amber", vorfrist: "ink", wiedervorlage: "neutral", termin: "violet" } as const;

function streifenTon(f: Frist, heute: string): "seal" | "amber" | "ink" | "neutral" {
  if (f.datum < heute || istKritisch(f)) return "seal";
  if (f.typ === "frist") return f.datum === heute ? "seal" : "amber";
  if (f.typ === "vorfrist") return "ink";
  return "neutral";
}

// ───────────────────────── Fristen ─────────────────────────
export function FristenKarte({ d, i, className }: { d: CockpitDaten; i: number; className?: string }) {
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
  // Freitags (oder vor Feiertagen) reicht die Karte bis zum nächsten Werktag – der Titel sagt das.
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
    <BentoKarte i={i} label={d.wochenende ? `Heute und bis ${wochentagName(d.bisTag)} fällig` : "Heute und morgen fällig"} className={className}>
      <KartenKopf
        icon={<CalendarClock />}
        ton={d.ueberfaellig > 0 || d.bisWerktag.some(istKritisch) ? "seal" : "ink"}
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
      />

      {d.vertretung.length > 0 && (
        <div className="relative z-[1] mb-3 grid gap-1.5">
          {d.vertretung.map((v) => (
            <Link
              key={v.person.id}
              to="/fristen?nur=meine"
              className="flex items-center gap-2.5 rounded-[14px] bg-violet-soft px-3 py-2 text-[13px] text-fg-2 transition-colors hover:bg-[color-mix(in_oklab,var(--violet)_16%,transparent)]"
            >
              <UserCheck className="size-4 shrink-0 text-violet" />
              <span className="min-w-0">
                <span className="font-semibold text-fg">Sie vertreten heute {v.person.name}</span> – {anzahl(v.fristen, "Frist", "Fristen")}
                {v.weitere > 0 && `, dazu ${anzahl(v.weitere, "Wiedervorlage oder Vorfrist", "Wiedervorlagen und Vorfristen")}`} bis {wochentagName(addDays(d.heute, 7), true)}, {fmtDateShort(addDays(d.heute, 7))}
                {v.person.abwesenheit?.bis && <span className="text-fg-3"> · abwesend bis {fmtDateShort(v.person.abwesenheit.bis)}</span>}
              </span>
            </Link>
          ))}
        </div>
      )}

      <TermineHeute d={d} />

      {spotlight.length > 0 && (
        <div className="relative z-[1] mb-3 grid gap-2">
          {spotlight.map((f) => (
            <NotfristSpot key={f.id} f={f} d={d} />
          ))}
        </div>
      )}

      {d.bisWerktag.length === 0 ? (
        <div className="relative z-[1] -mx-1 flex-1">
          <div className="mx-1 flex items-center gap-3 rounded-[16px] bg-green-soft px-4 py-3">
            <CheckCircle2 className="size-6 shrink-0 text-green" />
            <div className="min-w-0">
              <div className="text-[14px] font-semibold">Alles im Griff</div>
              <p className="text-[12.5px] text-fg-3">Bis {wochentagName(d.bisTag)} ist nichts offen. Vorfristen setzt der 38h-Motor automatisch.</p>
            </div>
          </div>
          {d.woche.filter((f) => f.datum > d.bisTag).length > 0 && (
            <>
              <div className="eyebrow px-2 pb-1 pt-3.5">
                Als Nächstes · bis {wochentagName(naechsteWoche, true)}, {fmtDateShort(naechsteWoche)}
              </div>
              <ul className="flex min-w-0 flex-col gap-0.5">
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
        <div className="relative z-[1] -mx-1 flex-1">
          {gruppen.map((g) => (
            <div key={g.key} className="mb-1.5 last:mb-0">
              <div className={cn("eyebrow px-2 pb-1 pt-1.5", g.key === "ueber" && "!text-seal")}>{g.label}</div>
              <ul className="flex min-w-0 flex-col gap-0.5">
                <AnimatePresence initial={false}>
                  {g.items.map((f) => (
                    <FristZeile key={f.id} f={f} d={d} />
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          ))}
          {rest > 0 && (
            <MehrLink to="/fristen" className="mt-1 ml-1">
              {rest} weitere bis {wochentagName(d.bisTag)}
            </MehrLink>
          )}
        </div>
      )}
    </BentoKarte>
  );
}

function NotfristSpot({ f, d }: { f: Frist; d: CockpitDaten }) {
  const a = d.akten.get(f.akteId);
  const tage = diffDays(d.heute, f.datum);
  const gesamt = f.ereignisDatum ? Math.max(1, diffDays(f.ereignisDatum, f.datum)) : 0;
  const vergangen = f.ereignisDatum ? Math.min(gesamt, Math.max(0, diffDays(f.ereignisDatum, d.heute))) : 0;
  const art = fristArtZu(f);
  return (
    <Link
      to={`/akten/${f.akteId}?tab=fristen`}
      className="group relative block overflow-hidden rounded-[16px] bg-seal-soft p-3.5 transition-transform duration-300 ease-[var(--spring)] hover:-translate-y-0.5"
      style={{ boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--seal) 22%, transparent)" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="seal" icon={<ShieldAlert className="size-3" />} title={art?.kurz}>
          {f.typ === "notfrist" ? "Notfrist" : "Nicht verlängerbar"}
        </Chip>
        <span className="text-[12.5px] font-semibold text-seal">
          {tage === 0 ? "heute" : `noch ${tage} ${tage === 1 ? "Tag" : "Tage"}`} · {wochentagName(f.datum, true)}, {fmtDateShort(f.datum)}
        </span>
        <ArrowRight className="ml-auto size-4 text-seal opacity-60 transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="mt-1.5 text-[14px] font-semibold leading-snug">{f.titel}</div>
      <div className="mt-0.5 truncate text-[12.5px] text-fg-3">
        {a && <span className="mono font-medium text-fg-2">{a.aktenzeichen}</span>} {a?.titel}
        {f.grundlage && <> · {f.grundlage}</>}
      </div>
      {gesamt > 0 && (
        <div className="mt-2.5 flex items-center gap-2.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--seal)_14%,transparent)]">
            <motion.div
              className="h-full rounded-full bg-seal"
              initial={{ width: 0 }}
              animate={{ width: `${(vergangen / gesamt) * 100}%` }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
            />
          </div>
          <span className="num shrink-0 text-[12.5px] text-fg-3">
            Tag {vergangen} von {gesamt}
          </span>
        </div>
      )}
    </Link>
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
      exit={{ opacity: 0, height: 0, transition: { duration: 0.22 } }}
      transition={{ type: "spring", stiffness: 480, damping: 38 }}
      className="relative overflow-hidden"
    >
      <div
        className={cn(
          "group relative flex items-center gap-3 rounded-[14px] py-2 pl-4 pr-1.5 transition-colors hover:bg-ink-softer",
          notfrist && "bg-seal-soft hover:bg-seal-soft",
        )}
      >
        <Streifen ton={streifenTon(f, d.heute)} />
        <Link to={`/akten/${f.akteId}?tab=fristen`} className="min-w-0 flex-1">
          <div className={cn("truncate text-[13.5px] font-semibold leading-snug group-hover:text-ink", notfrist && "text-seal group-hover:text-seal")}>
            {f.titel}
            {f.uhrzeit && <span className="num ml-1.5 font-normal text-fg-3">{f.uhrzeit} Uhr</span>}
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] text-fg-3">
            <Chip tone={notfrist ? "seal" : TYP_TON[f.typ]} className="!h-[22px] !px-2 !text-[12.5px]" title={art?.kurz}>
              {TYP_LABEL[f.typ]}
            </Chip>
            {(f.datum < d.heute || mitDatum) && <span className={cn("shrink-0 font-semibold", f.datum < d.heute ? "text-seal" : "text-fg-2")}>{tagLabel(f.datum, d.heute)}</span>}
            {vertretenFuer && (
              <Chip tone="violet" className="!h-[22px] shrink-0 !px-2 !text-[12.5px]" title={`Vertretung nach § 53 BRAO – ${vertretenFuer.name} ist abwesend`}>
                Vertretung für {foermlicherName(vertretenFuer).replace(/^Herr /, "Herrn ")}
              </Chip>
            )}
            {a && <span className="mono shrink-0 font-medium text-fg-2">{a.aktenzeichen}</span>}
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
            className="grid size-8 shrink-0 place-items-center rounded-full text-fg-4 ring-1 ring-[var(--line-strong)] transition-all duration-300 ease-[var(--spring)] hover:bg-green-soft hover:text-green hover:ring-[var(--green)] active:scale-90"
          >
            <Check className="size-4" />
          </button>
        ) : (
          <span className="size-8 shrink-0" aria-hidden />
        )}
      </div>
    </motion.li>
  );
}

/** „Termine heute“ – direkt neben den heute fälligen Fristen: Uhrzeit, Ort, Akte, Link (Quelle: Fristen mit typ 'termin'). */
function TermineHeute({ d }: { d: CockpitDaten }) {
  return (
    <div className="relative z-[1] mb-3 rounded-[16px] bg-[var(--ink-softer)] px-3 py-2">
      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-fg-2">
        <Gavel className="size-3.5 text-violet" />
        Termine heute
        {d.termineHeute.length > 0 && <span className="num font-normal text-fg-3">· {d.termineHeute.length}</span>}
      </div>
      {d.termineHeute.length === 0 ? (
        <p className="mt-0.5 text-[13px] text-fg-3">Heute keine Termine.</p>
      ) : (
        <ul className="mt-1 grid gap-0.5">
          {d.termineHeute.map((t) => {
            const a = d.akten.get(t.akteId);
            return (
              <li key={t.id}>
                <Link to={`/akten/${t.akteId}?tab=fristen`} className="group flex min-w-0 items-baseline gap-2 rounded-[10px] px-1 py-1 text-[13px] hover:bg-ink-soft">
                  <span className="num shrink-0 font-semibold text-violet">{t.uhrzeit ? `${t.uhrzeit} Uhr` : "ganztägig"}</span>
                  <span className="min-w-0 truncate font-medium group-hover:text-ink">{t.titel}</span>
                  {t.ort && <span className="hidden min-w-0 truncate text-fg-3 @md:inline">· {t.ort}</span>}
                  {a && <span className="mono ml-auto shrink-0 text-[12.5px] text-fg-3">{a.aktenzeichen}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ───────────────────────── Posteingang ─────────────────────────
export function PosteingangKarte({ d, i, className }: { d: CockpitDaten; i: number; className?: string }) {
  const items = d.posteingang.slice(0, 4);
  return (
    <BentoKarte i={i} label="Neue Nachrichten im Posteingang" className={className}>
      <KartenKopf
        icon={<Inbox />}
        titel="Posteingang"
        unter={d.posteingang.length ? `${d.posteingang.length} neu · ${d.wartetAufKi} ${d.wartetAufKi === 1 ? "wartet" : "warten"} auf KI-Analyse` : "beA und E-Mail in einem Postfach"}
        mehr={{ to: "/posteingang", label: "Zum Posteingang" }}
      />
      <Link
        to="/hilfe#status"
        className="relative z-[1] -mt-1 mb-2.5 inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 self-start rounded-full bg-[var(--ink-softer)] px-3 py-1 text-[12.5px] text-fg-2 transition-colors hover:bg-ink-soft"
        title="Systemstatus öffnen – beA, E-Mail und Bank sind im Prototyp simuliert"
      >
        <span className="inline-flex items-center gap-1 font-semibold">
          <span className="size-2 rounded-full bg-[var(--green)]" aria-hidden /> beA <Check className="size-3.5 text-green" aria-label="verbunden" />
        </span>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1 font-semibold">
          E-Mail <Check className="size-3.5 text-green" aria-label="verbunden" />
        </span>
        <span aria-hidden>·</span>
        <span>{letzteAbfrageText()} (simuliert)</span>
      </Link>
      {items.length === 0 ? (
        <div className="relative z-[1] flex flex-1 flex-col items-center justify-center rounded-[18px] bg-ink-softer px-6 py-10 text-center">
          <Inbox className="size-8 text-ink" />
          <div className="mt-3 title-md">Posteingang aufgeräumt</div>
          <p className="mt-1 max-w-[32ch] text-[13px] text-fg-3">Neue beA-Nachrichten und E-Mails ordnet die KI automatisch den Akten zu.</p>
        </div>
      ) : (
        <ul className="relative z-[1] -mx-1 flex min-w-0 flex-col gap-1">
          {items.map((n) => (
            <PostZeile key={n.id} n={n} d={d} />
          ))}
        </ul>
      )}
      {d.posteingang.length > items.length && (
        <MehrLink to="/posteingang" className="relative z-[1] mt-2 self-start">
          {d.posteingang.length - items.length} weitere neue Nachrichten
        </MehrLink>
      )}
    </BentoKarte>
  );
}

function PostZeile({ n, d }: { n: Nachricht; d: CockpitDaten }) {
  const akteId = n.akteId ?? n.ki?.akteId;
  const a = akteId ? d.akten.get(akteId) : undefined;
  const fertig = n.kiStatus === "analysiert" || n.kiStatus === "uebernommen";
  return (
    <li className="min-w-0">
      <Link to={`/posteingang?id=${encodeURIComponent(n.id)}`} className="group flex gap-3 rounded-[16px] p-2.5 transition-colors hover:bg-ink-softer">
        <span
          className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-[11px]", n.kanal === "bea" ? "bg-ink-soft text-ink" : "bg-[var(--ink-softer)] text-fg-2")}
          title={n.kanal === "bea" ? "beA-Nachricht" : "E-Mail"}
        >
          {n.kanal === "bea" ? <Landmark className="size-4" /> : <Mail className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-[13.5px] font-semibold">{n.von}</span>
            <span className="ml-auto shrink-0 text-[12.5px] text-fg-3">{relTime(n.eingang)}</span>
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-fg-2">{n.betreff}</span>
          {fertig && n.ki ? (
            <span className="mt-1.5 block rounded-[12px] bg-violet-soft px-2.5 py-2 text-[12.5px] leading-snug text-fg-2">
              <span className="line-clamp-2">
                <span className="ai-text mr-1 font-semibold">KI:</span>
                {n.ki.zusammenfassung}
              </span>
            </span>
          ) : (
            <span className="mt-1.5 flex items-center gap-2 text-[12.5px] text-fg-3">
              <span className="shimmer h-1.5 w-16 rounded-full" aria-hidden />
              Wartet auf KI-Analyse
            </span>
          )}
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {n.kanal === "bea" && <Chip tone="ink" className="!h-[22px] !px-2 !text-[12.5px]">beA</Chip>}
            {n.eebErforderlich && !n.eebAbgegeben && <Chip tone="amber" className="!h-[22px] !px-2 !text-[12.5px]">eEB offen</Chip>}
            {n.ki?.frist && <Chip tone="seal" className="!h-[22px] !px-2 !text-[12.5px]">Frist erkannt</Chip>}
            {a ? (
              <span className="mono text-[12.5px] font-medium text-fg-3">{a.aktenzeichen}</span>
            ) : (
              <Chip tone="outline" className="!h-[22px] !px-2 !text-[12.5px]">noch keiner Akte zugeordnet</Chip>
            )}
            <span className={cn("ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold transition-transform duration-300 ease-[var(--spring)] group-hover:translate-x-0.5", fertig ? "text-violet" : "text-ink")}>
              <Sparkles className="size-3.5" />
              {fertig ? "KI-Analyse ansehen" : "Analysieren lassen"}
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}

// ───────────────────────── Termine ─────────────────────────
export function TermineKarte({ d, i, className }: { d: CockpitDaten; i: number; className?: string }) {
  const maxLast = Math.max(1, ...d.wochenTage.map((t) => t.fristen + t.termine));
  return (
    <BentoKarte i={i} label="Termine und Wochenblick" className={className}>
      <KartenKopf icon={<CalendarDays />} ton="violet" titel="Termine" unter="Wochenblick und nächste Gerichts- und Ortstermine" mehr={{ to: "/fristen", label: "Kalender" }} />
      <div className="relative z-[1] mb-3 grid grid-cols-5 gap-1.5">
        {d.wochenTage.map((t) => {
          const ist = t.datum === d.heute;
          const last = t.fristen + t.termine;
          return (
            <Link
              key={t.datum}
              to={`/fristen?datum=${t.datum}`}
              title={`${wochentagName(t.datum)}: ${anzahl(t.fristen, "Frist", "Fristen")}, ${anzahl(t.termine, "Termin", "Termine")}${t.wiedervorlagen ? ` · dazu ${anzahl(t.wiedervorlagen, "Wiedervorlage", "Wiedervorlagen")}` : ""}`}
              className={cn(
                "group relative flex flex-col items-center rounded-[14px] px-1 pb-2 pt-1.5 transition-colors",
                ist ? "bg-ink text-[var(--on-ink)] shadow-[0_8px_20px_-10px_var(--ink)]" : "bg-[var(--ink-softer)] hover:bg-ink-soft",
              )}
            >
              <span className={cn("text-[12.5px] font-semibold uppercase tracking-wide", ist ? "opacity-80" : "text-fg-3")}>{wochentagName(t.datum, true)}</span>
              <span className="num text-[17px] font-semibold leading-tight">{fromISO(t.datum).getUTCDate()}</span>
              <span className="mt-1 flex h-[14px] w-full items-end justify-center gap-[3px] px-2">
                <span
                  className={cn("w-full max-w-[22px] rounded-full", ist ? "bg-white/70" : t.kritisch ? "bg-seal" : "bg-ink/60")}
                  style={{ height: `${Math.max(3, (last / maxLast) * 14)}px`, opacity: last ? 1 : 0.25 }}
                />
              </span>
              <span className={cn("num mt-1 text-[12.5px]", ist ? "opacity-85" : "text-fg-3")}>{last || "–"}</span>
            </Link>
          );
        })}
      </div>
      {d.termine.length === 0 ? (
        <p className="relative z-[1] rounded-[14px] bg-[var(--ink-softer)] px-4 py-5 text-center text-[13px] text-fg-3">Keine Termine geplant. Ladungen aus dem beA trägt die KI automatisch ein.</p>
      ) : (
        <ul className="relative z-[1] -mx-1 flex min-w-0 flex-col gap-0.5">
          {d.termine.map((t) => {
            const a = d.akten.get(t.akteId);
            const dt = fromISO(t.datum);
            return (
              <li key={t.id}>
                <Link to={`/akten/${t.akteId}?tab=fristen`} className="group flex items-center gap-3 rounded-[14px] p-2 transition-colors hover:bg-ink-softer">
                  <span className="grid w-11 shrink-0 place-items-center rounded-[12px] bg-violet-soft py-1 text-violet">
                    <span className="text-[12.5px] font-semibold uppercase leading-none tracking-wide">{monatName(dt.getUTCMonth(), true).replace(".", "")}</span>
                    <span className="num text-[18px] font-semibold leading-tight">{dt.getUTCDate()}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold group-hover:text-ink">{t.titel}</span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] text-fg-3">
                      <span className="shrink-0 font-medium text-fg-2">
                        {tagLabel(t.datum, d.heute)}
                        {t.uhrzeit && `, ${t.uhrzeit} Uhr`}
                      </span>
                      {t.ort && (
                        <span className="flex min-w-0 items-center gap-1 truncate">
                          <MapPin className="size-3 shrink-0" />
                          <span className="truncate">{t.ort}</span>
                        </span>
                      )}
                    </span>
                    {a && (
                      <span className="mt-0.5 block truncate text-[12.5px] text-fg-3">
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
        <p className="relative z-[1] mt-auto flex items-start gap-2 pt-3 text-[12.5px] leading-snug text-fg-3">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-violet" />
          Ladungen aus dem beA erkennt die KI automatisch und trägt sie mit Ort und Uhrzeit hier ein.
        </p>
      )}
    </BentoKarte>
  );
}

// ───────────────────────── Akten mit Handlungsbedarf ─────────────────────────
export function AktenKarte({ d, i, className }: { d: CockpitDaten; i: number; className?: string }) {
  const items = d.handlungsbedarf.slice(0, 5);
  return (
    <BentoKarte i={i} label="Akten mit Handlungsbedarf" className={className}>
      <KartenKopf
        icon={<FolderOpen />}
        titel="Akten mit Handlungsbedarf"
        unter={`${anzahl(d.aktenMitFrist, "Akte", "Akten")} mit Frist ≤ 7 Tage${d.aktenNurPrio ? ` · dazu ${d.aktenNurPrio} mit hoher Priorität` : ""}`}
        mehr={{ to: "/akten?frist=frist7", label: "In Akten ansehen" }}
      />
      {items.length === 0 ? (
        <p className="relative z-[1] rounded-[14px] bg-green-soft px-4 py-6 text-center text-[13px] text-fg-2">Keine Akte braucht gerade Ihre Aufmerksamkeit.</p>
      ) : (
        <ul className="relative z-[1] -mx-1 flex min-w-0 flex-col gap-0.5">
          {items.map(({ akte, gruende }) => {
            const b = d.team.get(akte.bearbeiterId);
            return (
              <li key={akte.id} className="min-w-0">
                <Link to={`/akten/${akte.id}`} className="group flex items-center gap-3 rounded-[14px] p-2 transition-colors hover:bg-ink-softer">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="mono shrink-0 text-[12.5px] font-semibold text-ink">{akte.aktenzeichen}</span>
                      <span className="truncate text-[13.5px] font-semibold group-hover:text-ink">{akte.titel}</span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      {gruende.map((g) => (
                        <Chip key={g.text} tone={g.ton} dot={g.ton === "seal"} className="!h-[22px] !px-2 !text-[12.5px]">
                          {g.text}
                        </Chip>
                      ))}
                      <span className="truncate text-[12.5px] text-fg-3">
                        {akte.sachgebiet} · {akte.phase}
                      </span>
                    </span>
                  </span>
                  {b && <Avatar initialen={b.initialen} farbe={b.farbe} size={26} title={`Bearbeitung: ${b.name}`} />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </BentoKarte>
  );
}
