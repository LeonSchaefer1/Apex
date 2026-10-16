import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Building, Cloud, DatabaseBackup, FileClock, KeyRound, Lock, MonitorCheck, RotateCcw, Scale, Server, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { darfVerwalten, getBackend, getInfo, hatBeispieldaten } from "@/lib/backend";
import { relTime } from "@/core/dates";
import { useCol, useData } from "@/store/data";
import { useKanzlei, useSession } from "@/store/session";
import { toast } from "@/store/ui";
import { Avatar, Button, Chip, confirmDialog } from "@/components/ui";
import { cn } from "@/lib/cn";
import { Abschnitt } from "./teile";

const SICHERHEIT = [
  { icon: <Lock className="size-4" />, t: "Verschlüsselte Übertragung", s: "TLS 1.3 zwischen Arbeitsplatz, Server und Schnittstellen" },
  { icon: <KeyRound className="size-4" />, t: "Verschlüsselte Speicherung", s: "Dokumente und Datenbank verschlüsselt (AES-256)" },
  { icon: <DatabaseBackup className="size-4" />, t: "Verschlüsselte Backups", s: "Täglich, nach dem 3-2-1-Prinzip, mit Wiederherstellungstest" },
  { icon: <Users className="size-4" />, t: "Strikte Mandantentrennung", s: "Jede Kanzlei hat einen getrennten Datenbestand – auf Datenbankebene erzwungen" },
  { icon: <MonitorCheck className="size-4" />, t: "Ohne Admin-Rechte", s: "Browser-Client: keine lokalen Administratorrechte, keine Makros, keine Virenscanner-Ausnahmen" },
];

const RECHT = [
  { norm: "§ 203 StGB", t: "Verschwiegenheit", s: "Mitwirkende Dienstleister werden zur Verschwiegenheit verpflichtet (§ 203 Abs. 3, 4 StGB); Zugriff nur, soweit für den Betrieb erforderlich." },
  { norm: "§ 43e BRAO", t: "Dienstleister", s: "Vertrag in Textform mit Verschwiegenheitspflicht, Zugriffsbegrenzung und Regelung zu Unterauftragnehmern." },
  { norm: "Art. 28 DSGVO", t: "Auftragsverarbeitung", s: "Vertrag zur Auftragsverarbeitung mit technischen und organisatorischen Maßnahmen (TOM)." },
  { norm: "§ 50 BRAO", t: "Handakten", s: "Aufbewahrungsfristen werden je Akte vorgemerkt, Löschung erst nach Ablauf und Freigabe." },
];

/** Stoppuhren der Abrechnung dieser Kanzlei gehören zum alten Datenstand (Akten-IDs) – nach dem Zurücksetzen verwerfen. */
function stoppuhrenVerwerfen(tenantId: string) {
  try {
    const praefix = `aa:abrechnung:timer:${tenantId}:`;
    const weg: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(praefix)) weg.push(k);
    }
    weg.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* Speicher gesperrt – dann gibt es auch keine gespeicherten Stoppuhren */
  }
}

export function DatenschutzTab() {
  const info = getInfo();
  const demo = info?.modus !== "server";
  const sitzung = useKanzlei();
  const { tenant, team, user } = sitzung;
  const darf = darfVerwalten(user.rolle);
  // „Demo-Daten zurücksetzen“ gibt es nur für Präsentations- und Beispieldaten-Kanzleien – nie für einen echten Datenbestand.
  const beispiel = hatBeispieldaten(sitzung);
  const praesentation = sitzung.betrieb?.praesentation ?? demo;
  const akt = useCol("aktivitaeten");
  const [laedt, setLaedt] = useState(false);
  const namen = useMemo(() => new Map(team.map((u) => [u.id, u])), [team]);
  const protokoll = useMemo(() => akt.filter((a) => a.akteur === "nutzer" || a.akteur === "system").slice().sort((a, b) => b.zeit.localeCompare(a.zeit)).slice(0, 6), [akt]);

  const zuruecksetzen = async () => {
    const ok = await confirmDialog({
      titel: "Demo-Daten zurücksetzen?",
      text: `Alle Akten, Fristen, Nachrichten, Rechnungen und Aktivitäten dieser Kanzlei werden auf die Beispieldaten zurückgesetzt. Ihre Änderungen gehen dabei verloren.${praesentation ? " Entfernte Beispiel-Zugänge werden wiederhergestellt." : ""}`,
      bestaetigen: "Zurücksetzen",
      gefahr: true,
    });
    if (!ok) return;
    setLaedt(true);
    try {
      await useData.getState().reset();
      stoppuhrenVerwerfen(tenant.id);
      // entfernte Beispiel-Zugänge sind wieder da – Team der Sitzung neu laden
      const s = await getBackend().me().catch(() => null);
      if (s) useSession.getState().setSitzung(s);
      toast("Demo-Daten zurückgesetzt", { text: "Die Beispielkanzlei ist wieder im Ausgangszustand.", ton: "erfolg" });
    } catch (e) {
      toast("Zurücksetzen fehlgeschlagen", { text: e instanceof Error ? e.message : "Bitte erneut versuchen.", ton: "fehler" });
    } finally {
      setLaedt(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Abschnitt
        titel="Betrieb & Hosting"
        text="Sie entscheiden, wo Ihre Mandantendaten liegen."
        icon={<Server className="size-[18px]" />}
        className="xl:col-span-2"
        aktion={<Chip tone={demo ? "amber" : "green"} dot>{demo ? "Aktuell: Demo im Browser" : "Aktuell: Server-Betrieb"}</Chip>}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Hosting icon={<Building className="size-5" />} titel="On-Premise in Ihrer Kanzlei" text="Server in Ihren Räumen oder bei Ihrem IT-Dienstleister. Updates spielen Sie ein, wann Sie wollen." punkte={["Daten verlassen die Kanzlei nicht", "Installation per Docker", "Betrieb auch ohne Internet (außer beA, E-Mail, Bank)"]} aktiv={!demo} />
          <Hosting icon={<Cloud className="size-5" />} titel="Private Cloud in Deutschland" text="Betrieb in einem Rechenzentrum in Deutschland – ohne eigene Server-Wartung." punkte={["Eigene, getrennte Umgebung je Kanzlei", "Verschlüsselte Backups an zwei Standorten", "Zertifizierung nach ISO 27001 / BSI C5 angestrebt"]} />
        </div>
        {demo && <p className="mt-3 text-[12.5px] text-fg-3">Diese Demo läuft vollständig in Ihrem Browser – es werden keine Daten an einen Server übertragen.</p>}
      </Abschnitt>

      <Abschnitt titel="Sicherheit" text="Ziel-Standard für den Produktivbetrieb." icon={<ShieldCheck className="size-[18px]" />}>
        <ul className="grid grid-cols-1 gap-3">
          {SICHERHEIT.map((x) => (
            <li key={x.t} className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-green-soft text-green">{x.icon}</span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold">{x.t}</span>
                <span className="block text-[12.5px] text-fg-3">{x.s}</span>
              </span>
            </li>
          ))}
        </ul>
      </Abschnitt>

      <Abschnitt titel="Berufsrecht & Datenschutz" text="Woran sich Gestaltung und Verträge von AnwaltApex ausrichten." icon={<Scale className="size-[18px]" />}>
        <ul className="grid grid-cols-1 gap-2.5">
          {RECHT.map((r) => (
            <li key={r.norm} className="rounded-[16px] bg-[var(--surface-2)] p-3.5 ring-1 ring-[var(--line)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mono rounded-[7px] bg-ink-soft px-1.5 py-0.5 text-[11.5px] font-semibold text-ink">{r.norm}</span>
                <span className="text-[13.5px] font-semibold">{r.t}</span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-3">{r.s}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11.5px] leading-snug text-fg-4">Gestaltungsziele, keine Rechtsberatung: Maßgeblich sind die geschlossenen Verträge und Ihre eigene berufsrechtliche Prüfung.</p>
      </Abschnitt>

      <Abschnitt titel="Protokoll" text="Jede Änderung an Akten, Fristen, Zugängen und Einstellungen wird mit Person und Zeitpunkt festgehalten." icon={<FileClock className="size-[18px]" />}>
        <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-[16px] border border-[var(--line)]">
          {protokoll.length === 0 && <li className="px-3.5 py-6 text-center text-[13px] text-fg-3">Noch keine Einträge.</li>}
          {protokoll.map((a, i) => {
            const u = a.userId ? namen.get(a.userId) : undefined;
            return (
              <motion.li key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="flex items-center gap-3 px-3.5 py-2.5">
                {u ? <Avatar initialen={u.initialen} farbe={u.farbe} size={26} /> : <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-ink-soft text-ink"><ShieldCheck className="size-3.5" /></span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{a.text}</span>
                  <span className="block text-[11.5px] text-fg-4">
                    {u?.name ?? "System"} · {relTime(a.zeit)}
                  </span>
                </span>
              </motion.li>
            );
          })}
        </ul>
        <p className="mt-2 text-[12px] text-fg-3">Auszug der letzten Einträge. KI-Anfragen werden ohne Inhalte protokolliert.</p>
      </Abschnitt>

      {beispiel && (
        <section className="relative rounded-[22px] border border-[color-mix(in_oklab,var(--seal)_35%,transparent)] bg-[color-mix(in_oklab,var(--seal-soft)_60%,transparent)] p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-seal-soft text-seal">
              <ShieldAlert className="size-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="title-md">Gefahrenbereich</h2>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-3">Aktionen, die sich nicht rückgängig machen lassen.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[16px] bg-[var(--surface)] p-4 ring-1 ring-[var(--line)]">
            <div className="min-w-0 flex-1 basis-[220px]">
              <div className="text-[14px] font-semibold">Demo-Daten zurücksetzen</div>
              <div className="text-[12.5px] text-fg-3">
                {darf ? `Setzt alle Daten von ${tenant.kurzname} auf die Beispieldaten zurück – z. B. vor einer Präsentation.` : "Den Datenbestand zurücksetzen dürfen Partner und Administration Ihrer Kanzlei."}
              </div>
            </div>
            <Button variant="danger" icon={<RotateCcw className="size-4" />} loading={laedt} disabled={!darf} onClick={() => void zuruecksetzen()}>
              Zurücksetzen
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function Hosting({ icon, titel, text, punkte, aktiv }: { icon: React.ReactNode; titel: string; text: string; punkte: string[]; aktiv?: boolean }) {
  return (
    <div className={cn("rounded-[18px] p-4 ring-1", aktiv ? "bg-[var(--ink-softer)] ring-2 ring-[var(--ink)]" : "bg-[var(--surface-2)] ring-[var(--line)]")}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">{icon}</span>
        <span className="min-w-0 flex-1 text-[14px] font-semibold">{titel}</span>
        {aktiv && <Chip tone="ink">Ihr Betrieb</Chip>}
      </div>
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-fg-3">{text}</p>
      <ul className="mt-2.5 grid grid-cols-1 gap-1 text-[12.5px] text-fg-2">
        {punkte.map((p) => (
          <li key={p} className="flex gap-2">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-green" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}
