import { memo, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, DatabaseBackup, Landmark, Library, Mail, RefreshCw, Scale, Sparkles } from "lucide-react";
import { DEMO_KI_NAME, useAiStatus } from "@/ai/status";
import { ENTSCHEIDUNGEN } from "@/core/rechtsprechung";
import { addDays, fmtDate, fmtNum, today } from "@/core/dates";
import { Card, Chip } from "@/components/ui";
import { cn } from "@/lib/cn";

interface Dienst {
  key: string;
  name: string;
  detail: string;
  icon: React.ReactNode;
  latenz: [number, number] | null; // simulierte Spanne in ms
  latenzText?: string;
  vorfall?: { tageZurueck: number; text: string };
  hinweis?: string;
  ki?: boolean;
}

const TAGE = 90;

function zufall(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/** Systemstatus: offen und ehrlich – Verbindungen, Antwortzeiten und 90-Tage-Verlauf (im Demo-Betrieb simuliert). */
export function Systemstatus() {
  const ai = useAiStatus();
  // neue (simulierte) Messung alle 4 Sekunden
  const [messung, setMessung] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setMessung((x) => x + 1), 4000);
    return () => clearInterval(t);
  }, []);

  const kiDetail =
    ai.quelle === "server" ? `Claude über Ihren Kanzlei-Server${ai.modell ? ` · ${ai.modell}` : ""}` : ai.quelle === "artefakt" ? "Claude über die Vorschau-Laufzeit" : "Nach festen Regeln im Browser · keine Datenübertragung";

  const dienste: Dienst[] = useMemo(
    () => [
      { key: "bea", name: "beA (BRAK)", detail: "Besonderes elektronisches Anwaltspostfach · Abruf alle 2 Min.", icon: <Scale className="size-[18px]" />, latenz: [170, 260] },
      {
        key: "mail", name: "E-Mail (Microsoft 365)", detail: "Exchange Online über Microsoft Graph", icon: <Mail className="size-[18px]" />, latenz: [80, 140],
        vorfall: { tageZurueck: 37, text: "Verzögerte Zustellung beim E-Mail-Anbieter (23 Min.) – Verbindung automatisch wiederhergestellt, keine Nachricht verloren." },
      },
      { key: "bank", name: "Bankabruf (FinTS/CAMT)", detail: "Kontoumsätze stündlich als CAMT.053", icon: <Landmark className="size-[18px]" />, latenz: [290, 420] },
      { key: "ki", name: ai.quelle === "demo" ? DEMO_KI_NAME : "KI (Claude)", detail: kiDetail, icon: <Sparkles className="size-[18px]" />, latenz: ai.quelle === "demo" ? null : [620, 940], latenzText: ai.quelle === "demo" ? "lokal" : undefined, ki: true },
      { key: "falldb", name: "Fall-Datenbank", detail: `${fmtNum(ENTSCHEIDUNGEN.length)} Entscheidungen im Demo-Auszug · Suche lokal`, icon: <Library className="size-[18px]" />, latenz: [6, 18] },
      { key: "backup", name: "Backups", detail: "Letzte Sicherung heute 03:00 Uhr · verschlüsselt · 3-2-1-Prinzip", icon: <DatabaseBackup className="size-[18px]" />, latenz: null, latenzText: "03:00" },
    ],
    [ai.quelle, kiDetail],
  );

  return (
    <section id="status" tabIndex={-1} aria-label="Systemstatus" className="scroll-mt-24 outline-none">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="title-lg">Systemstatus</h2>
          <p className="mt-1 text-[13px] text-fg-3">Offen und ehrlich: Sie sehen jederzeit, ob beA, E-Mail, Bank und KI laufen – statt kryptischer Fehlermeldungen.</p>
        </div>
        <Chip tone="green" icon={<RefreshCw className="size-3" />}>
          Automatische Wiederverbindung aktiv
        </Chip>
      </div>
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-4 border-b border-[var(--line)] p-5 md:px-6">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 420, damping: 22 }} className="relative grid size-12 place-items-center rounded-full bg-green-soft text-green">
            <span className="absolute inset-0 animate-ping rounded-full bg-[var(--green)] opacity-15 [animation-duration:2.6s]" />
            <CheckCircle2 className="size-6" />
          </motion.div>
          <div className="min-w-0 flex-1 basis-[200px]">
            <div className="text-[17px] font-semibold tracking-[-0.02em]">Alle Systeme betriebsbereit</div>
            <div className="text-[12.5px] text-fg-3">
              Zuletzt geprüft vor <GeprueftZaehler /> Sek. · nächste Prüfung automatisch
            </div>
          </div>
          <span className="w-full text-[12.5px] text-fg-3 sm:w-auto">Messwerte im Prototyp simuliert</span>
        </div>
        <ul className="divide-y divide-[var(--line)]">
          {dienste.map((d, i) => (
            <DienstZeile key={d.key} d={d} index={i} messung={messung} />
          ))}
        </ul>
      </Card>
    </section>
  );
}

function DienstZeile({ d, index, messung }: { d: Dienst; index: number; messung: number }) {
  const latenz = d.latenz ? Math.round(d.latenz[0] + zufall(messung * 7 + index * 13) * (d.latenz[1] - d.latenz[0])) : null;
  const heute = today();
  const verfuegbarkeit = d.vorfall ? 100 - (23 / (TAGE * 1440)) * 100 : 100;

  return (
    <li className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:items-center md:gap-6 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-[11px]", d.ki ? "bg-violet-soft text-violet" : "bg-ink-soft text-ink")}>{d.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13.5px] font-semibold">{d.name}</span>
            <Chip tone="green" dot>
              Betriebsbereit
            </Chip>
          </div>
          <div className="line-clamp-2 text-[12px] leading-snug text-fg-3" title={d.detail}>
            {d.detail}
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[12.5px] text-fg-3">
          <span>
            {d.latenz || d.latenzText ? (
              <>
                {d.key === "backup" ? "Letzte Sicherung " : "Antwortzeit "}
                <motion.span key={latenz ?? d.latenzText} initial={{ opacity: 0.3 }} animate={{ opacity: 1 }} className="num font-semibold text-fg-2">
                  {latenz !== null ? `${latenz} ms` : d.latenzText}
                </motion.span>
              </>
            ) : null}
          </span>
          <span className="num">{fmtNum(verfuegbarkeit, 2)} % in 90 Tagen</span>
        </div>
        <UptimeStreifen name={d.name} vorfallTage={d.vorfall?.tageZurueck} heute={heute} />
        <div className="mt-1 flex justify-between text-[12px] text-fg-3">
          <span>
            <span className="sm:hidden">vor 45 Tagen</span>
            <span className="hidden sm:inline">vor 90 Tagen</span>
          </span>
          <span>heute</span>
        </div>
        {d.vorfall && (
          <div className="mt-2 flex gap-2 rounded-[12px] bg-amber-soft px-3 py-2 text-[12px] leading-snug text-fg-2">
            <span className="mt-1 size-2 shrink-0 rounded-[2px] bg-[var(--amber)]" />
            <span>
              <span className="font-semibold">{fmtDate(addDays(heute, -d.vorfall.tageZurueck))} (Beispiel):</span> {d.vorfall.text}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}

function GeprueftZaehler() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setS((x) => (x >= 29 ? 0 : x + 1)), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="num">{s}</span>;
}

/** 90-Tage-Verlauf als feine Balken – eigene Komponente, damit Messwert-Updates sie nicht neu zeichnen. */
const UptimeStreifen = memo(function UptimeStreifen({ name, vorfallTage, heute }: { name: string; vorfallTage?: number; heute: string }) {
  const tage = useMemo(
    () =>
      Array.from({ length: TAGE }, (_, k) => {
        const zurueck = TAGE - 1 - k;
        return { datum: addDays(heute, -zurueck), gelb: vorfallTage === zurueck };
      }),
    [heute, vorfallTage],
  );
  return (
    <div className="flex h-7 items-stretch gap-[2px]" role="img" aria-label={`Verfügbarkeit ${name} der letzten 90 Tage: ${vorfallTage !== undefined ? "ein Tag mit kurzer Störung" : "ohne Störung"}`}>
      {tage.map((t, k) => (
        <motion.span
          key={t.datum}
          title={`${fmtDate(t.datum)} · ${t.gelb ? "kurze Störung – siehe Hinweis" : "ohne Störung"}`}
          initial={{ scaleY: 0.3, opacity: 0 }}
          whileInView={{ scaleY: 1, opacity: t.gelb ? 1 : 0.85 }}
          viewport={{ once: true }}
          transition={{ delay: Math.min(0.6, k * 0.005), type: "spring", stiffness: 420, damping: 30 }}
          className={cn("min-w-0 flex-1 origin-bottom rounded-[2px] transition-opacity hover:opacity-70", t.gelb ? "bg-[var(--amber)]" : "bg-[var(--green)]", k < TAGE - 45 && "hidden sm:block")}
        />
      ))}
    </div>
  );
});
