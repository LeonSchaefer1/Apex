import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { ArrowRightLeft, BookOpenText, Check, Headphones, Infinity as InfinityIcon, Library, LifeBuoy, Mic, PlayCircle, Search, Sparkles, Zap } from "lucide-react";
import { AiChip, Chip } from "@/components/ui";
import { ENTSCHEIDUNGEN } from "@/core/rechtsprechung";
import { AUTOMATION_DEFS } from "@/core/automationen";
import { cn } from "@/lib/cn";
import { STANDARD_ANSPRECHPARTNER } from "@/core/seed/kunde";
import { Abschnitt, Kopf, Reveal, useReduzierteBewegung } from "./basis";

const SUCHEN: { q: string; g: string; w: string[] }[] = [
  { q: "Bagatellkündigung nach 14 Jahren ohne Abmahnung", g: "Arbeitsrecht", w: ["bagatelle", "abmahnung", "betriebszugehörigkeit", "fristlose kündigung", "geringwertig", "interessenabwägung"] },
  { q: "Schönheitsreparaturen bei unrenovierter Wohnung", g: "Mietrecht", w: ["schönheitsreparaturen", "unrenoviert", "renovierung", "formularklausel", "kaution"] },
  { q: "Versicherung verweist auf freie Werkstatt", g: "Verkehrsrecht", w: ["freie werkstatt", "reparaturkosten", "verweis", "markenwerkstatt", "stundenverrechnungssatz"] },
];

/** Gerichte, die im kuratierten Auszug tatsächlich vorkommen – keine Instanzen versprechen, die der Prototyp nicht enthält. */
const GERICHTE = ["BVerfG", "EuGH", "BGH", "BAG", "BVerwG", "BSG", "BFH", "OLG", "LG", "AG"].filter((g) => ENTSCHEIDUNGEN.some((e) => e.gericht === g));

function treffer(g: string, w: string[]) {
  return ENTSCHEIDUNGEN.filter((e) => e.rechtsgebiet === g).map((e) => {
    const text = (e.schlagworte.join(" ") + " " + e.titel + " " + e.leitsatz).toLowerCase();
    return { e, score: w.reduce((s, x) => s + (text.includes(x) ? 1 : 0), 0) };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function Kachel({ children, className, i = 0 }: { children: ReactNode; className?: string; i?: number }) {
  return (
    <Reveal delay={i * 0.05} as="article" className={cn("sheet glow relative flex min-w-0 flex-col overflow-hidden rounded-[28px] p-6 sm:p-7", className)}>
      {children}
    </Reveal>
  );
}

function KachelKopf({ icon, titel, text, ai }: { icon: ReactNode; titel: string; text: string; ai?: boolean }) {
  return (
    <div className="relative z-[1]">
      <span className={cn("grid size-11 place-items-center rounded-[14px] [&>svg]:size-5", ai ? "ai-fill text-white shadow-[0_8px_20px_-8px_var(--ai-2)]" : "bg-ink-soft text-ink")}>{icon}</span>
      <h3 className="mt-5 text-[21px] font-semibold leading-tight tracking-[-0.025em]">{titel}</h3>
      <p className="mt-2 max-w-[48ch] text-[14.5px] leading-relaxed text-fg-2">{text}</p>
    </div>
  );
}

export function Funktionen() {
  return (
    <Abschnitt id="funktionen">
      <Kopf
        eyebrow="Ein Werkzeug statt fünf"
        titel={
          <>
            Alles, was Ihre Kanzlei braucht.
            <br /> <span className="text-fg-3">In einer Oberfläche.</span>
          </>
        }
        text="Akten, beA und E-Mail, Fristen, Dokumente, RVG-Abrechnung, Forderungen und Zeiten – verbunden durch eine KI, die mitdenkt, und einen Motor, der Routine vorbereitet und erledigt, was die Kanzlei nicht verlässt."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Kachel className="md:col-span-2 lg:col-span-4" i={0}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
            <KachelKopf
              icon={<Library />}
              titel="Die Fall-Datenbank"
              text="Präzedenzfall-Recherche in Sekunden: passende Entscheidungen mit Gericht, Datum und Aktenzeichen zum Nachprüfen. Im Prototyp ein kuratierter Auszug echter Leitentscheidungen von BVerfG, EuGH und Bundesgerichten – im Produktivbetrieb angebunden an offene Quellen wie Open Legal Data und die amtlichen Veröffentlichungen der Bundesgerichte."
            />
            <SucheDemo />
          </div>
        </Kachel>

        <Kachel className="lg:col-span-2" i={1}>
          <KachelKopf icon={<Zap />} titel="Der 38h-Motor" text="Routine im Hintergrund: Standard-Schriftsätze (z. B. Kostenfestsetzungsantrag) bereitet der 38h-Motor vor – zur Prüfung und Unterschrift. Vorfristen setzt er intern, Mandanteninformationen gehen erst nach Ihrer Freigabe hinaus. Ziel: Ø 38 Stunden weniger Routinearbeit pro Woche und Kanzlei. Fristen legt der Motor zur Vier-Augen-Kontrolle vor." />
          <MotorTicker />
        </Kachel>

        <Kachel className="lg:col-span-2" i={2}>
          <KachelKopf icon={<InfinityIcon />} titel="Lifetime-Lizenz (Kauflizenz ohne Laufzeit)" text="Kaufen statt mieten: Sie investieren einmal und erhalten eine unbefristete Lizenz – ohne Abo-Falle und ohne Monatsgebühren. Die Wartung ist optional – Umfang und Preis regelt das Angebot. Ihre Kanzlei-Software gehört Ihnen." />
          <div className="relative z-[1] mt-auto grid grid-cols-2 gap-2 pt-6 text-[12.5px]">
            <div className="rounded-[16px] bg-[var(--ink-softer)] p-3">
              <div className="text-fg-3">Abo-Modell</div>
              <div className="mt-1 font-semibold text-fg-2">jeden Monat</div>
              <div className="mt-2 flex h-6 items-end gap-[3px]" aria-hidden>
                {[3, 4, 4, 5, 6, 6, 7, 8, 9, 10].map((h, k) => (
                  <span key={k} className="w-full rounded-[2px] bg-fg-4/60" style={{ height: `${h * 10}%` }} />
                ))}
              </div>
            </div>
            <div className="rounded-[16px] bg-ink-soft p-3">
              <div className="text-ink">Apex</div>
              <div className="mt-1 font-semibold text-fg">einmal</div>
              <div className="mt-2 flex h-6 items-end gap-[3px]" aria-hidden>
                {[10, 0, 0, 0, 0, 0, 0, 0, 0, 0].map((h, k) => (
                  <span key={k} className={cn("w-full rounded-[2px]", h ? "bg-ink" : "bg-ink/20")} style={{ height: h ? "100%" : "12%" }} />
                ))}
              </div>
            </div>
          </div>
        </Kachel>

        <Kachel className="lg:col-span-2" i={3}>
          <KachelKopf icon={<ArrowRightLeft />} titel="Umzug in fünf Schritten – mit Vorschau und Rückgängig" text="Akten, Kontakte und Fristen aus Ihrer bisherigen Software ziehen vollständig um – mit Vorschau, Dublettenprüfung, Plausibilitätsprüfung der Fristen, Vier-Augen-Kontrolle und Rückgängig je Lauf." />
          <UmzugCheck />
        </Kachel>

        <Kachel className="lg:col-span-2" i={4}>
          <KachelKopf icon={<LifeBuoy />} titel="Persönliche Hilfe, die wirklich hilft" text="Animiertes Wiki und Schnellhilfe direkt in der Software – plus eine feste Ansprechpartnerin mit direkter Durchwahl statt Telefon-Warteschleife." />
          <div className="relative z-[1] mt-auto grid gap-2 pt-6">
            <div className="flex items-center gap-3 rounded-[16px] bg-[var(--ink-softer)] p-3">
              <PlayCircle className="size-5 shrink-0 text-ink" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">Eine Berufungsfrist berechnen</div>
                <div className="text-[12.5px] text-fg-3">Schnellhilfe · 30 Sek.</div>
              </div>
              <BookOpenText className="size-4 text-fg-4" />
            </div>
            <div className="flex items-center gap-3 rounded-[16px] bg-[var(--ink-softer)] p-3">
              <Headphones className="size-5 shrink-0 text-green" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">Ihre feste Ansprechpartnerin</div>
                <div className="text-[12.5px] text-fg-3">Direkte Durchwahl · {STANDARD_ANSPRECHPARTNER.verfuegbar}</div>
              </div>
            </div>
          </div>
        </Kachel>

        <Kachel className="md:col-span-2 lg:col-span-6" i={5}>
          <AvatarDemo />
        </Kachel>
      </div>
    </Abschnitt>
  );
}

/** Tippende Suche mit echten Entscheidungen aus der Fall-Datenbank. */
function SucheDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const sichtbar = useInView(ref, { amount: 0.4 });
  const reduce = useReduzierteBewegung();
  const [idx, setIdx] = useState(0);
  const [zeichen, setZeichen] = useState(SUCHEN[0].q.length);
  const ergebnisse = useMemo(() => SUCHEN.map((s) => treffer(s.g, s.w)), []);
  const q = SUCHEN[idx].q;
  const fertig = zeichen >= q.length;

  useEffect(() => {
    if (!sichtbar || reduce) return;
    let t: ReturnType<typeof setTimeout>;
    if (fertig) {
      t = setTimeout(() => {
        setIdx((i) => (i + 1) % SUCHEN.length);
        setZeichen(0);
      }, 3600);
    } else {
      t = setTimeout(() => setZeichen((z) => z + 1), 34 + Math.random() * 40);
    }
    return () => clearTimeout(t);
  }, [sichtbar, reduce, fertig, zeichen]);

  return (
    <div ref={ref} className="relative z-[1] min-w-0 rounded-[22px] bg-[var(--ink-softer)] p-3 shadow-[inset_0_0_0_1px_var(--line)] sm:p-4">
      <div className="flex h-11 items-center gap-2.5 rounded-full bg-[var(--surface)] px-4 text-[13.5px] shadow-[0_1px_0_0_var(--glass-rim-3)_inset,0_0_0_1px_var(--line),0_6px_16px_-10px_rgba(20,30,80,0.25)]">
        <Search className="size-4 shrink-0 text-fg-4" />
        <span className="min-w-0 truncate">
          {q.slice(0, zeichen)}
          <motion.span className="ml-px inline-block h-4 w-[1.5px] translate-y-[3px] bg-ink" animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} />
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between px-1 text-[12.5px] text-fg-3">
        <span>{fertig ? `${ergebnisse[idx].length} passende Entscheidungen` : "Suche läuft …"}</span>
        <span className="hidden gap-1 sm:flex">
          {GERICHTE.map((g) => (
            <span key={g} className="rounded-[6px] bg-[var(--surface)] px-1.5 py-0.5 text-[12px] font-semibold text-fg-3 shadow-[inset_0_0_0_1px_var(--line)]">
              {g}
            </span>
          ))}
        </span>
      </div>
      <ul className="mt-2 grid min-h-[196px] grid-cols-1 content-start gap-1.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {fertig &&
            ergebnisse[idx].map(({ e, score }, k) => (
              <motion.li
                key={`${idx}-${e.id}`}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 460, damping: 34, delay: k * 0.07 }}
                className="rounded-[14px] bg-[var(--surface)] p-2.5 shadow-[inset_0_0_0_1px_var(--line)]"
              >
                <div className="flex items-center gap-2 text-[12.5px]">
                  <Chip tone="ink" className="!h-[22px] !px-2 !text-[12px]">
                    {e.gericht}
                  </Chip>
                  <span className="mono font-medium text-fg-2">{e.az}</span>
                  <span className="ml-auto flex items-center gap-1.5 text-fg-3">
                    <span className="h-1 w-10 overflow-hidden rounded-full bg-[var(--line)]">
                      <span className="block h-full rounded-full bg-ink" style={{ width: `${Math.min(100, 45 + score * 12)}%` }} />
                    </span>
                    Relevanz
                  </span>
                </div>
                <div className="mt-1 truncate text-[13px] font-semibold">{e.titel}</div>
                <div className="line-clamp-1 text-[12.5px] text-fg-3">{e.leitsatz}</div>
              </motion.li>
            ))}
        </AnimatePresence>
        {!fertig && [0, 1, 2].map((k) => <li key={k} className="shimmer h-[62px] rounded-[14px]" />)}
      </ul>
    </div>
  );
}

function MotorTicker() {
  const ref = useRef<HTMLDivElement>(null);
  const sichtbar = useInView(ref, { amount: 0.4 });
  const reduce = useReduzierteBewegung();
  const liste = AUTOMATION_DEFS;
  const [start, setStart] = useState(0);
  useEffect(() => {
    if (!sichtbar || reduce) return;
    const t = setInterval(() => setStart((s) => (s + 1) % liste.length), 2200);
    return () => clearInterval(t);
  }, [sichtbar, reduce, liste.length]);
  const sichtbare = [0, 1, 2].map((k) => liste[(start + k) % liste.length]);
  return (
    <div ref={ref} className="relative z-[1] mt-auto pt-6">
      <ul className="flex min-w-0 flex-col gap-1.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {sichtbare.map((a) => (
            <motion.li
              key={a.key}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="flex items-center gap-2.5 rounded-[14px] bg-[var(--ink-softer)] px-3 py-2.5"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-[8px] bg-green-soft text-green">
                <Check className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{a.name}</span>
              <span className="num shrink-0 text-[12.5px] font-semibold text-green" title={a.vorgang}>
                +{a.minutenProLauf} Min.
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function UmzugCheck() {
  const ref = useRef<HTMLDivElement>(null);
  const sichtbar = useInView(ref, { amount: 0.5 });
  const reduce = useReduzierteBewegung();
  const punkte = ["Akten mit Rubrum & Sachgebiet", "Kontakte – Dubletten zusammengeführt", "Fristen – geprüft, zur Vier-Augen-Kontrolle", "Datenblatt mit Originalwerten je Akte"];
  const [n, setN] = useState(punkte.length);
  useEffect(() => {
    if (!sichtbar || reduce) return;
    let k = 1;
    setN(1);
    const t = setInterval(() => {
      k++;
      setN(k);
      if (k >= punkte.length) clearInterval(t);
    }, 650);
    return () => clearInterval(t);
  }, [sichtbar, reduce, punkte.length]);
  return (
    <div ref={ref} className="relative z-[1] mt-auto pt-6">
      <div className="mb-2.5 flex items-center justify-between text-[12.5px] text-fg-3">
        <span>Umzug aus Ihrer bisherigen Software</span>
        <span className="num font-semibold text-fg-2">
          {n} von {punkte.length} geprüft
        </span>
      </div>
      <div className="bar mb-3">
        <span style={{ width: `${(n / punkte.length) * 100}%` }} />
      </div>
      <ul className="grid grid-cols-1 gap-1.5">
        {punkte.map((p, k) => (
          <li key={p} className="flex items-center gap-2.5 text-[13px]">
            <motion.span
              animate={{ scale: k < n ? 1 : 0.85, backgroundColor: k < n ? "var(--green-soft)" : "var(--ink-softer)" }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
              className={cn("grid size-5 shrink-0 place-items-center rounded-full", k < n ? "text-green" : "text-fg-4")}
            >
              <Check className="size-3" strokeWidth={3} />
            </motion.span>
            <span className={cn("transition-colors", k < n ? "text-fg" : "text-fg-3")}>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Apex Assistent als Sprachassistent: lebendige Glaskugel mit Gesprächsauszug (Inhalte passen zu den Beispieldaten an jedem Tag). */
function AvatarDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const sichtbar = useInView(ref, { amount: 0.4 });
  return (
    <div ref={ref} className="relative z-[1] grid items-center gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <Orb aktiv={sichtbar} />
        <div className="min-w-0">
          <AiChip>Per Sprache oder Text</AiChip>
          <h3 className="mt-3 text-[21px] font-semibold leading-tight tracking-[-0.025em]">Apex Assistent – Ihr Sprachassistent für persönliche Hilfe</h3>
          <p className="mt-2 max-w-[44ch] text-[14.5px] leading-relaxed text-fg-2">Sprechen Sie einfach los: Der Assistent versteht gesprochene Fragen, kennt die Software und Ihre Akten – und antwortet sofort. Was er einträgt, bestätigen Sie vorher. Wenn es knifflig wird, verbindet er Sie mit Ihrer festen Ansprechpartnerin.</p>
        </div>
      </div>
      <div className="grid gap-2.5">
        <Blase rolle="sie">
          <Mic className="mr-1.5 inline size-3.5 -translate-y-px text-ink" />
          „Welche nicht verlängerbaren Fristen stehen als Nächstes an?“
        </Blase>
        <Blase rolle="apex">
          Als Nächstes der <b>Einspruch gegen einen Bußgeldbescheid</b> (§ 67 OWiG), danach die Klagefristen für <b>Kündigungsschutzklagen</b> (§ 4 KSchG) – darunter Herr Weber in Akte <span className="mono">142/26</span>. Alle mit Vorfrist und Vier-Augen-Kontrolle. Soll ich die Klageschrift für Herrn Weber vorbereiten?
        </Blase>
        <Blase rolle="sie">„Ja, bitte – mit dem Emmely-Urteil.“</Blase>
      </div>
    </div>
  );
}

function Blase({ rolle, children }: { rolle: "sie" | "apex"; children: ReactNode }) {
  return (
    <div className={cn("max-w-[92%] rounded-[20px] px-4 py-3 text-[13.5px] leading-relaxed", rolle === "sie" ? "ml-auto rounded-br-[6px] bg-ink text-[var(--on-ink)]" : "ai-ring rounded-bl-[6px] bg-[var(--surface)] text-fg-2")}>
      {rolle === "apex" && (
        <span className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold">
          <Sparkles className="size-3 text-violet" />
          <span className="ai-text">Apex Assistent</span>
        </span>
      )}
      {children}
    </div>
  );
}

export function Orb({ aktiv = true, size = 112 }: { aktiv?: boolean; size?: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: "conic-gradient(from 0deg, var(--ai-1), var(--ai-2), var(--ai-3), var(--ai-4), var(--ai-1))", filter: "blur(16px)", opacity: 0.55 }}
        animate={aktiv ? { rotate: 360, scale: [1, 1.08, 1] } : undefined}
        transition={{ rotate: { duration: 9, repeat: Infinity, ease: "linear" }, scale: { duration: 3.2, repeat: Infinity, ease: "easeInOut" } }}
      />
      <motion.div
        className="absolute inset-[10%] overflow-hidden rounded-full"
        style={{ background: "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.15) 26%, transparent 46%), conic-gradient(from 120deg, var(--ai-1), var(--ai-2), var(--ai-3), var(--ai-4), var(--ai-1))", boxShadow: "inset 0 -10px 24px rgba(0,0,0,0.25), inset 0 2px 6px rgba(255,255,255,0.6)" }}
        animate={aktiv ? { scale: [1, 1.04, 0.98, 1.03, 1], rotate: [0, 8, -6, 0] } : undefined}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
