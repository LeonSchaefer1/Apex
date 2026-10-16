import { motion } from "motion/react";
import { Activity, BadgeCheck, CalendarClock, CalendarRange, FolderOpen, KeyRound, Mail, Pause, Play, RotateCcw, Trash2, Users } from "lucide-react";
import { Avatar, Button, Chip } from "@/components/ui";
import { bundeslandName } from "@/core/feiertage";
import { fmtDate, fmtNum, relTime, today } from "@/core/dates";
import type { ConsoleKunde } from "@/lib/backend";
import type { Tenant, User } from "@/core/types";
import { cn } from "@/lib/cn";
import { DEMO_IDS, testStatus } from "./helfer";

const STATUS: Record<NonNullable<Tenant["status"]>, { label: string; ton: "amber" | "green" | "seal" | "ink" }> = {
  test: { label: "Test", ton: "ink" },
  aktiv: { label: "Aktiv", ton: "green" },
  pausiert: { label: "Pausiert", ton: "seal" },
};

const ROLLE: Record<User["rolle"], string> = { partner: "Partner/in", anwalt: "Anwalt/Anwältin", refa: "Fachangestellte/r", admin: "Admin" };

export interface KartenAktionen {
  status: (k: ConsoleKunde, s: Tenant["status"]) => void;
  zuruecksetzen: (k: ConsoleKunde) => void;
  loeschen: (k: ConsoleKunde) => void;
  passwort: (k: ConsoleKunde, u: User) => void;
}

function kuerzel(name: string) {
  const w = name.replace(/&/g, " ").split(/\s+/).filter((x) => /^[A-ZÄÖÜ]/.test(x));
  return ((w[0]?.[0] ?? "") + (w[1]?.[0] ?? "")).toUpperCase() || name.slice(0, 2).toUpperCase();
}

/** Eine Kunden-Kanzlei mit Zugängen, Kennzahlen und Verwaltungsaktionen. */
export function KundenKarte({ k, i, aktionen, beschaeftigt }: { k: ConsoleKunde; i: number; aktionen: KartenAktionen; beschaeftigt?: boolean }) {
  const t = k.tenant;
  const status = STATUS[t.status ?? "aktiv"];
  const test = t.status === "test" ? testStatus(t) : null;
  const demo = DEMO_IDS.has(t.id);
  const nieAngemeldet = !k.stats.letzteAktivitaet && k.stats.akten === 0;

  const heute = today();
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: beschaeftigt ? 0.6 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 420, damping: 34, delay: Math.min(i, 8) * 0.04 }}
      className={cn("sheet glow relative overflow-hidden rounded-[24px]", t.status === "pausiert" && "opacity-90")}
      aria-label={t.name}
    >
      {/* Farbkante der Kanzlei */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: t.farbe }} />
      <div className="relative z-[1] grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-8">
        {/* Kanzlei */}
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <Avatar initialen={kuerzel(t.kurzname || t.name)} farbe={t.farbe} size={42} className="!rounded-[13px]" />
            <div className="min-w-0 flex-1">
              <h3 className="text-[15.5px] font-semibold leading-snug tracking-[-0.015em]">{t.name}</h3>
              <div className="mt-0.5 truncate text-[12.5px] text-fg-3">
                {t.stadt} · {bundeslandName(t.bundesland)}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Chip tone={status.ton} dot>
              {status.label}
            </Chip>
            {test && (
              <Chip tone={test.ton === "neutral" ? "outline" : test.ton} icon={<CalendarRange className="size-3" />} title={t.testBis ? `Testzugang bis ${fmtDate(t.testBis)}` : undefined}>
                bis {fmtDate(t.testBis)} · {test.text}
              </Chip>
            )}
            {demo && <Chip tone="violet">Präsentationskanzlei</Chip>}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
            <div className="min-w-0">
              <dt className="text-fg-4">Lizenz-Nr.</dt>
              <dd className="mono truncate font-medium text-fg-2">{t.lizenz.lizenzNr}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-fg-4">Arbeitsplätze</dt>
              <dd className="num font-medium text-fg-2">
                {t.lizenz.arbeitsplaetze} · seit {fmtDate(t.lizenz.seit)}
              </dd>
            </div>
          </dl>
          {t.schwerpunkte.length > 0 && <div className="mt-2.5 truncate text-[11.5px] text-fg-4">{t.schwerpunkte.join(" · ")}</div>}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Kennzahl icon={<FolderOpen className="size-3.5" />} wert={k.stats.akten} label="Akten" />
            <Kennzahl icon={<CalendarClock className="size-3.5" />} wert={k.stats.offeneFristen} label="Fristen offen" />
            <Kennzahl icon={<Mail className="size-3.5" />} wert={k.stats.nachrichten} label="Nachrichten" />
          </div>
          <div className="mt-2.5 flex items-start gap-2 text-[12px] text-fg-3">
            <Activity className={cn("mt-0.5 size-3.5 shrink-0", nieAngemeldet ? "text-fg-4" : "text-green")} />
            <span>{k.stats.letzteAktivitaet ? <>Letzte Aktivität {relTime(k.stats.letzteAktivitaet)}</> : "Noch nicht angemeldet – der Datenbestand entsteht beim ersten Login."}</span>
          </div>
        </div>

        {/* Zugänge */}
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-fg-3">
            <Users className="size-3.5" />
            {k.users.length} {k.users.length === 1 ? "Zugang" : "Zugänge"}
          </div>
          <ul className="flex min-w-0 flex-col gap-1">
            {k.users.map((u) => (
              <li key={u.id} className="group flex min-w-0 items-center gap-2.5 rounded-[12px] px-1.5 py-1.5 transition-colors hover:bg-ink-softer">
                <Avatar initialen={u.initialen} farbe={u.farbe} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">
                    {u.name} <span className="font-normal text-fg-4">· {ROLLE[u.rolle]}</span>
                  </span>
                  <span className="flex min-w-0 items-center gap-1 text-[12px] text-fg-3">
                    <Mail className="size-3 shrink-0" />
                    <span className="mono truncate">{u.email}</span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => aktionen.passwort(k, u)}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-fg-3 transition-colors hover:bg-ink-soft hover:text-ink"
                  title={`Neues Passwort für ${u.name} erzeugen`}
                >
                  <KeyRound className="size-3.5" />
                  <span className="hidden sm:inline">Neues Passwort</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Aktionen */}
      <div className="relative z-[1] flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] bg-[color-mix(in_oklab,var(--ink-softer)_60%,transparent)] px-3 py-2.5 sm:px-4">
        {t.status === "pausiert" ? (
          <Button size="sm" variant="primary" icon={<Play className="size-3.5" />} onClick={() => aktionen.status(k, t.testBis && t.testBis >= heute ? "test" : "aktiv")}>
            Reaktivieren
          </Button>
        ) : (
          <Button size="sm" variant="secondary" icon={<Pause className="size-3.5" />} onClick={() => aktionen.status(k, "pausiert")}>
            Pausieren
          </Button>
        )}
        {t.status === "test" && (
          <Button size="sm" variant="secondary" icon={<BadgeCheck className="size-3.5" />} onClick={() => aktionen.status(k, "aktiv")}>
            Als Kunde freischalten
          </Button>
        )}
        <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => aktionen.zuruecksetzen(k)}>
          Daten zurücksetzen
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 className="size-3.5" />}
          disabled={demo}
          title={demo ? "Präsentationskanzleien sind fest eingebaut – sie lassen sich zurücksetzen, aber nicht löschen." : `${t.name} endgültig löschen`}
          onClick={() => aktionen.loeschen(k)}
          className="ml-auto !text-seal hover:!bg-seal-soft"
        >
          Löschen
        </Button>
      </div>
    </motion.article>
  );
}

function Kennzahl({ icon, wert, label }: { icon: React.ReactNode; wert: number; label: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 rounded-[12px] bg-[var(--ink-softer)] px-2.5 py-2 shadow-[inset_0_0_0_1px_var(--line)] sm:flex">
      <span className="shrink-0 text-fg-4">{icon}</span>
      <span className="num text-[15px] font-semibold leading-none tracking-[-0.02em]">{fmtNum(wert)}</span>
      <span className="col-span-2 min-w-0 truncate text-[11.5px] text-fg-3">{label}</span>
    </div>
  );
}
