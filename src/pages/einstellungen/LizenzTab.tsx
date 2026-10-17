import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowRight, BookOpen, CalendarClock, Check, Handshake, Headset, Infinity as InfinityIcon, RefreshCw, Server, ShieldCheck, Truck, Wrench, X } from "lucide-react";
import { diffDays, fmtDate, fmtDateLong, today } from "@/core/dates";
import { useKanzlei } from "@/store/session";
import { Button, Chip } from "@/components/ui";
import { telHref } from "@/lib/telefon";
import { CopyButton } from "@/pages/hilfe/kopieren";
import { cn } from "@/lib/cn";
import { festeAnsprechBezeichnung } from "@/lib/rollen";
import { ESCROW_HINWEIS, LIZENZ_KENNZEICHNUNG, LIZENZ_KERN, PREIS_HINWEIS, UEBERTRAGBARKEIT_HINWEIS, WARTUNG_HINWEIS, WARTUNG_INHALT, WARTUNG_OPTIONAL } from "@/content/lizenz";
import { Abschnitt } from "./teile";

export function LizenzTab() {
  const { tenant, team } = useKanzlei();
  const nav = useNavigate();
  const l = tenant.lizenz;
  const heute = today();
  // Testzugang (in der Apex Console angelegt): noch keine Lizenz erworben – erst danach gilt die Lifetime-Lizenz.
  const test = tenant.status === "test";
  const testBis = test ? tenant.testBis : undefined;
  const testGesamt = testBis ? Math.max(1, diffDays(tenant.createdAt.slice(0, 10), testBis)) : 1;
  const testRest = testBis ? Math.max(0, diffDays(heute, testBis)) : 0;
  const ap = tenant.ansprechpartner;

  const inklusive = [
    { icon: <RefreshCw className="size-4" />, t: "Aktualisierungen im Rahmen der Wartung", s: "mit der optionalen Wartung (Umfang laut Angebot) – vorab geprüft, den Zeitpunkt bestimmen Sie" },
    { icon: <Headset className="size-4" />, t: festeAnsprechBezeichnung(ap, { ohneIhr: true }), s: `${ap.name} · ${ap.verfuegbar}` },
    { icon: <BookOpen className="size-4" />, t: "Animiertes Wiki & Schnellhilfe", s: "in jeder Ansicht, plus Apex Assistent" },
    { icon: <Truck className="size-4" />, t: "Umzug in fünf Schritten – mit Vorschau und Rückgängig", s: `aus Ihrer bisherigen Software – begleitet von ${ap.name}` },
    { icon: <Server className="size-4" />, t: "Betrieb nach Wahl", s: "Auf Ihrem eigenen Server oder in einem deutschen Rechenzentrum" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <motion.section
          initial={{ opacity: 0, y: 10, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="glass-strong glow relative overflow-hidden rounded-[28px] p-6"
          style={{ boxShadow: "var(--glass-shadow-lg)" }}
        >
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-[radial-gradient(circle,var(--ink-soft),transparent_65%)]" />
          <div className="relative flex items-start gap-4">
            <div className={cn("grid size-14 shrink-0 place-items-center rounded-[18px]", test ? "bg-amber-soft text-amber" : "bg-ink text-[var(--on-ink)] shadow-[0_10px_24px_-10px_var(--ink)]")}>
              {test ? <CalendarClock className="size-7" /> : <InfinityIcon className="size-7" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="eyebrow">{test ? "Ihr Zugang" : "Ihre Lizenz"}</div>
              <h2 className="title-lg mt-1">{test ? (testBis ? `Testzugang bis ${fmtDate(testBis)}` : "Testzugang") : "Lifetime-Lizenz"}</h2>
              <p className="mt-1 text-[13.5px] text-fg-2">
                {/* Eine Aussage zur Wartung in beiden Zweigen – wortgleich mit der Landing (I5-T13-01, src/content/lizenz.ts) */}
                {test
                  ? `In der Testphase sind alle Funktionen freigeschaltet. ${testBis ? "Danach" : "Wenn Sie überzeugt sind,"} erwerben Sie die Lifetime-Lizenz – einmal investiert, dauerhaft genutzt. ${WARTUNG_OPTIONAL}.`
                  : `${LIZENZ_KERN}. ${WARTUNG_OPTIONAL}.`}
              </p>
            </div>
          </div>
          {test ? (
            <dl className="relative mt-6 grid grid-cols-2 gap-3">
              <Kachel label="Testzugang seit">{fmtDateLong(tenant.createdAt.slice(0, 10))}</Kachel>
              <Kachel label="Testzeitraum">{testBis ? <span className="num">noch {testRest} {testRest === 1 ? "Tag" : "Tage"}</span> : "unbefristet"}</Kachel>
              <Kachel label="Arbeitsplätze">
                <span className="num">
                  {l.arbeitsplaetze} <span className="text-[12.5px] font-normal text-fg-3">· {team.length} belegt</span>
                </span>
              </Kachel>
              <Kachel label="Danach">Lifetime-Lizenz</Kachel>
            </dl>
          ) : (
            <dl className="relative mt-6 grid grid-cols-2 gap-3">
              <Kachel label="Lizenznummer" className="col-span-2 sm:col-span-1">
                <span className="flex items-center gap-1">
                  <span className="mono min-w-0 truncate select-all">{l.lizenzNr}</span>
                  <CopyButton text={l.lizenzNr} label="Lizenznummer kopieren" className="-my-1" />
                </span>
              </Kachel>
              <Kachel label="Gültig seit">{fmtDateLong(l.seit)}</Kachel>
              <Kachel label="Arbeitsplätze">
                <span className="num">
                  {l.arbeitsplaetze} <span className="text-[12.5px] font-normal text-fg-3">· {team.length} belegt</span>
                </span>
              </Kachel>
              <Kachel label="Laufzeit">unbegrenzt</Kachel>
            </dl>
          )}
          {test && testBis && (
            <div className="relative mt-4">
              <div className="bar">
                <span style={{ width: `${Math.min(100, Math.max(2, ((testGesamt - testRest) / testGesamt) * 100))}%` }} />
              </div>
            </div>
          )}
          <div className="relative mt-5 flex flex-wrap gap-1.5">
            {test ? (
              <>
                <Chip tone="green" icon={<Check className="size-3" strokeWidth={3} />}>
                  Alle Funktionen freigeschaltet
                </Chip>
                <Chip tone="green" icon={<Check className="size-3" strokeWidth={3} />}>
                  Danach ohne Abo
                </Chip>
                <Chip tone="green" icon={<Check className="size-3" strokeWidth={3} />}>
                  Ihre Daten bleiben erhalten
                </Chip>
              </>
            ) : (
              <>
                <Chip tone="green" icon={<Check className="size-3" strokeWidth={3} />}>
                  Keine Monatsgebühren
                </Chip>
                <Chip tone="green" icon={<Check className="size-3" strokeWidth={3} />}>
                  Keine Abo-Falle
                </Chip>
                <Chip tone="green" icon={<Check className="size-3" strokeWidth={3} />}>
                  Ihre Daten gehören Ihnen
                </Chip>
              </>
            )}
          </div>
        </motion.section>

        {test && (
          <section className="sheet rounded-[22px] p-5">
            <div className="title-md">Lifetime-Lizenz erwerben</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-fg-3">
              {festeAnsprechBezeichnung(ap)} {ap.name} erstellt Ihnen ein Angebot nach Kanzleigröße: <a href={telHref(ap.telefon)} className="num whitespace-nowrap font-semibold text-ink underline decoration-[var(--ink-soft)] underline-offset-2 hover:decoration-ink" aria-label={`${ap.telefon} anrufen`}>{ap.telefon}</a> · <span className="break-all">{ap.email}</span>. Beim Wechsel bleiben alle Daten der Testphase vollständig erhalten.
            </p>
          </section>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Abschnitt titel="Was enthalten ist" text={`Ohne Zusatzpakete. Laufende Kosten entstehen nur mit der optionalen Wartung. ${PREIS_HINWEIS}.`} icon={<ShieldCheck className="size-[18px]" />}>
          <ul className="grid grid-cols-1 gap-3">
            {inklusive.map((x, i) => (
              <motion.li key={x.t} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 + i * 0.04, type: "spring", stiffness: 420, damping: 34 }} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-ink-soft text-ink">{x.icon}</span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold">{x.t}</span>
                  <span className="block text-[12.5px] text-fg-3">{x.s}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        </Abschnitt>
        <Abschnitt titel="Wartung" text={`${WARTUNG_HINWEIS}.`} icon={<Wrench className="size-[18px]" />} aktion={<Chip tone="outline">laut Angebot</Chip>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <h3 className="text-[13.5px] font-semibold">Enthalten</h3>
              <ul className="mt-1.5 grid gap-1.5 text-[13px] text-fg-2">
                {WARTUNG_INHALT.enthalten.map((x) => (
                  <li key={x} className="flex gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-green" strokeWidth={3} />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="min-w-0">
              <h3 className="text-[13.5px] font-semibold">Ohne Wartung</h3>
              <ul className="mt-1.5 grid gap-1.5 text-[13px] text-fg-2">
                {WARTUNG_INHALT.ohne.map((x, i) => (
                  <li key={x} className="flex gap-2">
                    {i === 0 ? <Check className="mt-0.5 size-3.5 shrink-0 text-green" strokeWidth={3} /> : <X className="mt-0.5 size-3.5 shrink-0 text-fg-3" strokeWidth={3} />}
                    {x.charAt(0).toUpperCase() + x.slice(1)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-3 text-[12.5px] text-fg-3">{LIZENZ_KENNZEICHNUNG}.</p>
        </Abschnitt>
        <Abschnitt titel="Übertragbarkeit & Escrow" text="Was mit der Lizenz bei Übergabe oder im Ernstfall geschieht." icon={<Handshake className="size-[18px]" />}>
          <ul className="grid gap-2.5 text-[13px] leading-relaxed text-fg-2">
            <li className="rounded-[14px] bg-[var(--surface-2)] px-3.5 py-2.5 ring-1 ring-[var(--line)]">{UEBERTRAGBARKEIT_HINWEIS}.</li>
            <li className="rounded-[14px] bg-[var(--surface-2)] px-3.5 py-2.5 ring-1 ring-[var(--line)]">{ESCROW_HINWEIS}.</li>
          </ul>
          <p className="mt-3 text-[12.5px] text-fg-3">{LIZENZ_KENNZEICHNUNG}.</p>
        </Abschnitt>
        <div className="sheet flex flex-wrap items-center gap-3 rounded-[22px] p-5">
          <div className="min-w-0 flex-1 basis-[220px]">
            <div className="title-md">Lifetime oder Abo?</div>
            <p className="mt-0.5 text-[12.5px] text-fg-3">Die Beispielrechnung im 38h-Motor vergleicht beide Modelle über fünf Jahre.</p>
          </div>
          <Button iconRight={<ArrowRight className="size-4" />} onClick={() => nav("/automatisierung#roi")}>
            Beispielrechnung ansehen
          </Button>
        </div>
      </div>
    </div>
  );
}

function Kachel({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-[16px] bg-[var(--surface)]/60 px-3.5 py-3 ring-1 ring-[var(--line)]", className)}>
      <dt className="text-[12.5px] text-fg-3">{label}</dt>
      <dd className="mt-0.5 truncate text-[14.5px] font-semibold">{children}</dd>
    </div>
  );
}
