import { motion } from "motion/react";
import { Activity, BadgeCheck, CalendarRange, KeyRound, Mail, Pause, Play, RotateCcw, Send, Trash2, Undo2, Users } from "lucide-react";
import { Avatar, Button, Chip } from "@/components/ui";
import { bundeslandName } from "@/core/feiertage";
import { fmtDate, fmtNum, relTime, today } from "@/core/dates";
import type { ConsoleKunde } from "@/lib/backend";
import type { Tenant, User } from "@/core/types";
import { BEWEGUNG } from "@/lib/bewegung";
import { DEMO_IDS, DEMO_NUTZER_IDS, testStatus } from "./helfer";
import { rollenLabel } from "@/lib/rollen";

/** Status einer Kanzlei: Farbe nur mit Bedeutung – aktiv = in Ordnung (grün mit Haken), Test und Pausiert neutral mit Symbol. */
const STATUS: Record<NonNullable<Tenant["status"]>, { label: string; ton: "green" | "ink" | "neutral"; icon?: React.ReactNode }> = {
  test: { label: "Test", ton: "ink" },
  aktiv: { label: "Aktiv", ton: "green" },
  pausiert: { label: "Pausiert", ton: "neutral", icon: <Pause aria-hidden /> },
};

export interface KartenAktionen {
  status: (k: ConsoleKunde, s: Tenant["status"]) => void;
  zuruecksetzen: (k: ConsoleKunde) => void;
  loeschen: (k: ConsoleKunde) => void;
  passwort: (k: ConsoleKunde, u: User) => void;
  /** Eingebaute Beispiel-Zugänge: öffentliches Demo-Passwort wiederherstellen */
  standardPasswort: (k: ConsoleKunde, u: User) => void;
  /** Vollständige Einladung (ohne Passwort) in die Zwischenablage */
  einladung: (k: ConsoleKunde, u: User) => void;
}

function kuerzel(name: string) {
  const w = name.replace(/&/g, " ").split(/\s+/).filter((x) => /^[A-ZÄÖÜ]/.test(x));
  return ((w[0]?.[0] ?? "") + (w[1]?.[0] ?? "")).toUpperCase() || name.slice(0, 2).toUpperCase();
}

/**
 * Eine Kunden-Kanzlei mit Zugängen, Kennzahlen und Verwaltungsaktionen – eine Karte (Fläche, Linie, Radius 8) ohne Karten darin.
 * Die Kanzleifarbe aus den Daten erscheint nur als 8-px-Punkt neben dem Namen (DESIGN-SYSTEM.md 4.1).
 */
export function KundenKarte({ k, aktionen, beschaeftigt }: { k: ConsoleKunde; aktionen: KartenAktionen; beschaeftigt?: boolean }) {
  const t = k.tenant;
  const status = STATUS[t.status ?? "aktiv"];
  const test = t.status === "test" ? testStatus(t) : null;
  const demo = DEMO_IDS.has(t.id);

  const heute = today();
  return (
    <motion.article
      initial={{ opacity: 0 }}
      animate={{ opacity: beschaeftigt ? 0.6 : 1 }}
      exit={{ opacity: 0 }}
      transition={BEWEGUNG.standard}
      className="sheet relative overflow-hidden rounded-lg"
      aria-label={t.name}
      aria-busy={beschaeftigt || undefined}
    >
      <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-10">
        {/* Kanzlei */}
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <Avatar initialen={kuerzel(t.kurzname || t.name)} size={40} />
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold leading-[22px] text-fg">
                {t.farbe && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: t.farbe }} />}
                <span className="min-w-0">{t.name}</span>
              </h3>
              <div className="truncate text-[13px] leading-[18px] text-fg-3">
                {t.stadt} · {bundeslandName(t.bundesland)}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Chip tone={status.ton} icon={status.icon}>
              {status.label}
            </Chip>
            {test && (
              <Chip tone={test.ton === "neutral" ? "outline" : test.ton} icon={test.ton === "neutral" ? <CalendarRange aria-hidden /> : undefined} title={t.testBis ? `Testzugang bis ${fmtDate(t.testBis)}` : undefined}>
                bis {fmtDate(t.testBis)} · {test.text}
              </Chip>
            )}
            {demo && <Chip tone="outline">Präsentationskanzlei</Chip>}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] leading-[18px]">
            <div className="min-w-0">
              <dt className="text-fg-3">Lizenz-Nr.</dt>
              <dd className="mono truncate text-fg">{t.lizenz.lizenzNr}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-fg-3">Arbeitsplätze</dt>
              <dd className="num text-fg">
                {t.lizenz.arbeitsplaetze} · seit {fmtDate(t.lizenz.seit)}
              </dd>
            </div>
          </dl>
          {t.schwerpunkte.length > 0 && <div className="mt-3 text-[13px] leading-[18px] text-fg-3">{t.schwerpunkte.join(" · ")}</div>}
          {/* Kennzahlen als Zeile mit Trennlinien – keine Kacheln */}
          <dl className="mt-4 grid grid-cols-3 border-y border-[var(--line)]">
            <Kennzahl wert={k.stats.akten} label="Akten" />
            <Kennzahl wert={k.stats.offeneFristen} label="Fristen offen" />
            <Kennzahl wert={k.stats.nachrichten} label="Nachrichten" />
          </dl>
          <div className="mt-3 flex items-start gap-2 text-[13px] leading-[18px] text-fg-3">
            <Activity className="mt-px size-3.5 shrink-0 text-fg-4" aria-hidden />
            <span>{k.stats.letzteAktivitaet ? <>Letzte Aktivität {relTime(k.stats.letzteAktivitaet)}</> : "Noch nicht angemeldet – der Datenbestand entsteht beim ersten Login."}</span>
          </div>
        </div>

        {/* Zugänge */}
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[13px] font-medium text-fg-3">
            <Users className="size-3.5 text-fg-4" aria-hidden />
            {k.users.length} {k.users.length === 1 ? "Zugang" : "Zugänge"}
          </div>
          <ul className="flex min-w-0 flex-col divide-y divide-[var(--line)]">
            {k.users.map((u) => (
              <li key={u.id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <Avatar initialen={u.initialen} size={28} />
                <span className="min-w-0 flex-1 basis-[200px]">
                  <span className="block text-[14px] font-medium leading-5 text-fg [overflow-wrap:anywhere]">
                    {u.name} <span className="font-normal text-fg-3">· {rollenLabel(u)}</span>
                  </span>
                  <span className="flex min-w-0 items-start gap-1 text-[12px] leading-4 text-fg-3">
                    <Mail className="mt-px size-3 shrink-0 text-fg-4" aria-hidden />
                    <span className="mono min-w-0 [overflow-wrap:anywhere]">{u.email}</span>
                  </span>
                </span>
                <span className="ml-auto flex flex-wrap items-center justify-end gap-0.5">
                  {DEMO_NUTZER_IDS.has(u.id) && (
                    <button
                      type="button"
                      onClick={() => aktionen.standardPasswort(k, u)}
                      className="btn btn-ghost btn-sm max-sm:min-w-11"
                      title={`Setzt für ${u.name} wieder das öffentliche Passwort der Präsentationskanzleien – z. B. nach einer Vorführung, in der es geändert wurde.`}
                      aria-label={`Demo-Passwort für ${u.name} wiederherstellen`}
                    >
                      <Undo2 aria-hidden />
                      <span className="hidden sm:inline">Demo-Passwort wiederherstellen</span>
                    </button>
                  )}
                  <button type="button" onClick={() => aktionen.einladung(k, u)} className="btn btn-ghost btn-sm max-sm:min-w-11" title={`Vollständige Einladung für ${u.name} kopieren (ohne Passwort)`} aria-label={`Einladung für ${u.name} kopieren`}>
                    <Send aria-hidden />
                    <span className="hidden sm:inline">Einladung kopieren</span>
                  </button>
                  <button type="button" onClick={() => aktionen.passwort(k, u)} className="btn btn-ghost btn-sm max-sm:min-w-11" title={`Neues Passwort für ${u.name} erzeugen`} aria-label={`Neues Passwort für ${u.name} erzeugen`}>
                    <KeyRound aria-hidden />
                    <span className="hidden sm:inline">Neues Passwort</span>
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Aktionen */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-4 py-3 sm:px-5">
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
          variant="danger"
          icon={<Trash2 className="size-3.5" />}
          disabled={demo}
          title={demo ? "Präsentationskanzleien sind fest eingebaut – sie lassen sich zurücksetzen, aber nicht löschen." : `${t.name} endgültig löschen`}
          onClick={() => aktionen.loeschen(k)}
          className="ml-auto"
        >
          Löschen
        </Button>
      </div>
    </motion.article>
  );
}

function Kennzahl({ wert, label }: { wert: number; label: string }) {
  return (
    // dt vor dd (gültige Beschreibungsliste), sichtbar steht die Zahl oben
    <div className="flex min-w-0 flex-col-reverse border-l border-[var(--line)] px-3 py-2.5 first:border-l-0 first:pl-0">
      <dt className="truncate text-[12px] leading-4 text-fg-3">{label}</dt>
      <dd className="num text-[16px] font-semibold leading-6 text-fg">{fmtNum(wert)}</dd>
    </div>
  );
}
