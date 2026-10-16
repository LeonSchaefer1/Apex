import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Building, Cloud, DatabaseBackup, FileClock, FileText, Fingerprint, KeyRound, Lock, MonitorCheck, RotateCcw, Scale, Server, ShieldAlert, ShieldCheck, Trash2, Users } from "lucide-react";
import { SPERRE_MINUTEN, darfVerwalten, getBackend, getInfo, hatBeispieldaten, istConsole, kanzleiSicherheit, type SperreMinuten, type ZweiFaktorStatus } from "@/lib/backend";
import { fmtDate, relTime, today } from "@/core/dates";
import { useCol, useData } from "@/store/data";
import { useKanzlei, useSession } from "@/store/session";
import { toast } from "@/store/ui";
import { Avatar, Button, Chip, Segmented, Switch, confirmDialog } from "@/components/ui";
import { ZweiFaktorEinrichtung } from "@/components/sicherheit/ZweiFaktorEinrichtung";
import { DateiDialog, type AusgabeDatei } from "@/pages/fristen/dateiAusgabe";
import { LOESCHKONZEPT, MUSTER, MUSTER_KENNZEICHNUNG, UNTERAUFTRAGNEHMER } from "@/content/datenschutz";
import { cn } from "@/lib/cn";
import { Abschnitt, Zeile } from "./teile";

const SICHERHEIT = [
  { icon: <Lock className="size-4" />, t: "Verschlüsselte Übertragung", s: "TLS 1.3 zwischen Arbeitsplatz, Server und Schnittstellen" },
  { icon: <KeyRound className="size-4" />, t: "Verschlüsselte Speicherung", s: "Dokumente und Datenbank verschlüsselt (AES-256)" },
  { icon: <DatabaseBackup className="size-4" />, t: "Verschlüsselte Backups", s: "Täglich, nach dem 3-2-1-Prinzip, mit Wiederherstellungstest" },
  { icon: <Users className="size-4" />, t: "Strikte Mandantentrennung", s: "Jede Kanzlei hat einen getrennten Datenbestand – auf Datenbankebene erzwungen" },
  { icon: <MonitorCheck className="size-4" />, t: "Ohne Admin-Rechte", s: "Browser-Client: keine lokalen Administratorrechte, keine Makros, keine Virenscanner-Ausnahmen" },
  { icon: <Fingerprint className="size-4" />, t: "Zwei-Faktor-Anmeldung und Sperre", s: "Code aus einer Authenticator-App (TOTP) und automatische Sperre bei Inaktivität – Einstellung siehe „Anmeldung & Sicherheit“" },
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
  const protokoll = useMemo(() => akt.filter((a) => a.akteur === "nutzer" || a.akteur === "system").slice().sort((a, b) => b.zeit.localeCompare(a.zeit)).slice(0, 8), [akt]);
  const [muster, setMuster] = useState<AusgabeDatei | null>(null);
  const oeffneMuster = (key: (typeof MUSTER)[number]["key"]) => {
    const m = MUSTER.find((x) => x.key === key);
    if (!m) return;
    setMuster({ name: m.datei, mime: "text/plain", beschreibung: `${MUSTER_KENNZEICHNUNG} · ${m.beschreibung}`, inhalt: m.inhalt({ kanzlei: tenant.name, anschrift: tenant.adresse, datum: fmtDate(today()) }) });
  };

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
          <Hosting icon={<Building className="size-5" />} titel="Eigener Server in der Kanzlei" text="Server in Ihren Räumen oder bei Ihrem IT-Dienstleister. Aktualisierungen spielen Sie ein, wann Sie wollen." punkte={["Daten verlassen die Kanzlei nicht", "Installation per Docker", "Betrieb auch ohne Internet (außer beA, E-Mail, Bank)"]} aktiv={!demo} />
          <Hosting icon={<Cloud className="size-5" />} titel="Deutsches Rechenzentrum" text="Betrieb in einem Rechenzentrum in Deutschland – ohne eigene Server-Wartung." punkte={["Eigene, getrennte Umgebung je Kanzlei", "Verschlüsselte Backups an zwei Standorten", "Zertifizierung nach ISO 27001 / BSI C5 angestrebt"]} />
        </div>
        {demo && <p className="mt-3 text-[12.5px] text-fg-3">Diese Demo läuft vollständig in Ihrem Browser – es werden keine Daten an einen Server übertragen.</p>}
      </Abschnitt>

      <AnmeldungSicherheit praesentation={praesentation} />

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
                <span className="mono rounded-[7px] bg-ink-soft px-1.5 py-0.5 text-[12.5px] font-semibold text-ink">{r.norm}</span>
                <span className="text-[13.5px] font-semibold">{r.t}</span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-3">{r.s}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <h3 className="text-[13.5px] font-semibold">Verträge zum Herunterladen</h3>
          <p className="mt-0.5 text-[12.5px] text-fg-3">{MUSTER_KENNZEICHNUNG}. Die Muster werden lokal erzeugt – mit Ihrer Kanzlei als Vertragspartei.</p>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            {MUSTER.map((m) => (
              <button key={m.key} type="button" onClick={() => oeffneMuster(m.key)} className="press flex min-w-0 items-start gap-3 rounded-[16px] bg-[var(--surface-2)] p-3.5 text-left ring-1 ring-[var(--line)] hover:ring-[var(--line-strong)]">
                <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-ink-soft text-ink">
                  <FileText className="size-4" />
                </span>
                <span className="min-w-0 hyphens-auto [overflow-wrap:anywhere]" lang="de">
                  <span className="block text-[13.5px] font-semibold">{m.titel}</span>
                  <span className="mt-0.5 block text-[12.5px] text-fg-3">Vorschau, Datei speichern oder kopieren · {m.datei}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[12.5px] leading-snug text-fg-3">Gestaltungsziele, keine Rechtsberatung: Maßgeblich sind die geschlossenen Verträge und Ihre eigene berufsrechtliche Prüfung.</p>
      </Abschnitt>

      <Abschnitt titel="Unterauftragnehmer & Löschkonzept" text="Wer außer uns Ihre Daten verarbeiten kann – und wie lange was aufbewahrt wird." icon={<Trash2 className="size-[18px]" />} className="xl:col-span-2">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="min-w-0">
            <h3 className="text-[13.5px] font-semibold">Unterauftragnehmer</h3>
            <ul className="mt-2 grid gap-2">
              {UNTERAUFTRAGNEHMER.map((u) => (
                <li key={u.wer} className="rounded-[16px] bg-[var(--surface-2)] p-3.5 ring-1 ring-[var(--line)]">
                  <div className="text-[13.5px] font-semibold">{u.wer}</div>
                  <div className="mt-0.5 text-[12.5px] leading-relaxed text-fg-2">{u.zweck}</div>
                  <div className="mt-1 text-[12.5px] leading-relaxed text-fg-3">
                    Ort: {u.ort} · {u.wann}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0">
            <h3 id="loeschkonzept" className="text-[13.5px] font-semibold">
              Löschkonzept
            </h3>
            <div className="mt-2 overflow-x-auto rounded-[16px] ring-1 ring-[var(--line)]">
              <table className="w-full min-w-[420px] text-left text-[12.5px]" aria-labelledby="loeschkonzept">
                <thead className="bg-[var(--surface-2)] text-fg-3">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Daten
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Aufbewahrung
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Grundlage
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {LOESCHKONZEPT.map((l) => (
                    <tr key={l.was}>
                      <td className="px-3 py-2 align-top font-medium text-fg">{l.was}</td>
                      <td className="px-3 py-2 align-top text-fg-2">{l.frist}</td>
                      <td className="mono whitespace-nowrap px-3 py-2 align-top text-fg-2">{l.grundlage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[12.5px] text-fg-3">Nach Ablauf werden Daten erst nach Ihrer Freigabe gelöscht – je Akte vorgemerkt.</p>
          </div>
        </div>
      </Abschnitt>

      <Abschnitt titel="Protokoll" text="Jede Änderung an Akten, Fristen, Zugängen und Einstellungen wird mit Person und Zeitpunkt festgehalten." icon={<FileClock className="size-[18px]" />}>
        <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-[16px] border border-[var(--line)]">
          {protokoll.length === 0 && <li className="px-3.5 py-6 text-center text-[13px] text-fg-3">Noch keine Einträge.</li>}
          {protokoll.map((a, i) => {
            // Vorgänge durch AnwaltApex bzw. das System (z. B. Zugang angelegt, Startpasswort vergeben): `userId` nennt die
            // betroffene Person – ausgelöst hat sie AnwaltApex, nicht die Person selbst.
            const u = a.akteur !== "system" && a.userId ? namen.get(a.userId) : undefined;
            const wer = a.beispiel && !u ? "Beispielperson" : (u?.name ?? (a.akteur === "system" ? "AnwaltApex (System)" : "Unbekannte Person"));
            return (
              <motion.li key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className={cn("flex items-center gap-3 px-3.5 py-2.5", a.beispiel && "bg-[var(--ink-softer)]")}>
                {u ? (
                  <Avatar initialen={u.initialen} farbe={u.farbe} size={26} />
                ) : (
                  <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-ink-soft text-ink">
                    <ShieldCheck className="size-3.5" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate text-[13px]">{a.text}</span>
                    {a.beispiel && (
                      <Chip tone="amber" className="shrink-0">
                        Beispiel
                      </Chip>
                    )}
                  </span>
                  <span className="block text-[12.5px] text-fg-3">
                    {wer} · {relTime(a.zeit)}
                    {a.beispiel && " · Beispieldaten – nicht von Ihnen ausgelöst"}
                  </span>
                </span>
              </motion.li>
            );
          })}
        </ul>
        <p className="mt-2 text-[12.5px] text-fg-3">Auszug der letzten Einträge. Eingriffe von AnwaltApex (z. B. ein neues Startpasswort über die Apex Console) stehen hier ebenfalls. KI-Anfragen werden ohne Inhalte protokolliert.</p>
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
      <DateiDialog datei={muster} onClose={() => setMuster(null)} />
    </div>
  );
}

/** „Anmeldung & Sicherheit“: eigene Zwei-Faktor-Anmeldung; für Partner/Administration Pflicht für alle und die Sperre bei Inaktivität. */
function AnmeldungSicherheit({ praesentation }: { praesentation: boolean }) {
  const { tenant, user } = useKanzlei();
  const darf = darfVerwalten(user.rolle);
  const einstellung = kanzleiSicherheit(tenant);
  const [eigen, setEigen] = useState<ZweiFaktorStatus | null>(null);
  const [speichert, setSpeichert] = useState(false);

  const speichern = async (neu: { zweiFaktorPflicht: boolean; sperreMinuten: SperreMinuten }, protokoll: string) => {
    setSpeichert(true);
    try {
      const t = await getBackend().kanzlei.sicherheitSpeichern(neu);
      const s = useSession.getState().sitzung;
      if (s && !istConsole(s)) useSession.getState().setSitzung({ ...s, tenant: t });
      useData.getState().log({ akteur: "nutzer", userId: user.id, text: protokoll });
      toast("Gespeichert", { text: protokoll, ton: "erfolg" });
    } catch (e) {
      toast("Nicht gespeichert", { text: e instanceof Error ? e.message : "Bitte versuchen Sie es erneut.", ton: "fehler" });
    } finally {
      setSpeichert(false);
    }
  };

  const pflichtGrund = praesentation
    ? "In Präsentationskanzleien nicht verfügbar – die Zugangsdaten sind öffentlich. Bitte nutzen Sie dafür Ihren Kundentest."
    : !eigen?.aktiv && !einstellung.zweiFaktorPflicht
      ? "Richten Sie zuerst Ihre eigene Zwei-Faktor-Anmeldung ein (links) – sonst sperren Sie sich selbst aus."
      : undefined;

  return (
    <Abschnitt
      titel="Anmeldung & Sicherheit"
      text="Zwei-Faktor-Anmeldung mit einer Authenticator-App und automatische Sperre bei Inaktivität."
      icon={<Fingerprint className="size-[18px]" />}
      className="xl:col-span-2"
      aktion={
        <Chip tone="outline">
          Sperre nach {einstellung.sperreMinuten} Min.
        </Chip>
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="min-w-0">
          <h3 className="mb-2 text-[13.5px] font-semibold">Ihre Zwei-Faktor-Anmeldung</h3>
          <ZweiFaktorEinrichtung onStatus={setEigen} />
        </div>
        <div className="min-w-0 rounded-[18px] bg-[var(--surface-2)] p-4 ring-1 ring-[var(--line)]">
          <h3 className="text-[13.5px] font-semibold">Für die ganze Kanzlei</h3>
          {!darf && <p className="mt-1 text-[12.5px] text-fg-3">Diese Einstellungen ändern Partner und Administration Ihrer Kanzlei.</p>}
          <div className="mt-3 divide-y divide-[var(--line)]">
            <Zeile titel="Zwei-Faktor für alle Pflicht" htmlFor="zf-pflicht" text={pflichtGrund ?? (einstellung.zweiFaktorPflicht ? "Alle Personen müssen bei der Anmeldung einen Code eingeben; wer noch keinen eingerichtet hat, richtet ihn bei der nächsten Anmeldung ein." : "Jede Person entscheidet selbst.")}>
              <Switch
                id="zf-pflicht"
                checked={einstellung.zweiFaktorPflicht}
                disabled={!darf || speichert || (!!pflichtGrund && !einstellung.zweiFaktorPflicht)}
                onChange={(v) => void speichern({ ...einstellung, zweiFaktorPflicht: v }, v ? "Zwei-Faktor-Anmeldung für alle zur Pflicht gemacht" : "Pflicht zur Zwei-Faktor-Anmeldung aufgehoben")}
                label="Zwei-Faktor für alle Pflicht"
              />
            </Zeile>
            <Zeile titel="Sperre bei Inaktivität" text="Nach dieser Zeit ohne Maus, Tastatur oder Touch legt sich der Sperrbildschirm über die App. Entsperren mit Passwort.">
              {!darf ? (
                <span className="text-[13px] font-semibold text-fg-2">{einstellung.sperreMinuten} Minuten</span>
              ) : (
              <Segmented<string>
                size="sm"
                value={String(einstellung.sperreMinuten)}
                onChange={(v) => {
                  if (!darf || speichert) return;
                  const m = Number(v) as SperreMinuten;
                  if (m !== einstellung.sperreMinuten) void speichern({ ...einstellung, sperreMinuten: m }, `Sperre bei Inaktivität auf ${m} Minuten gesetzt`);
                }}
                options={SPERRE_MINUTEN.map((m) => ({ value: String(m), label: `${m} Min.` }))}
              />
              )}
            </Zeile>
          </div>
        </div>
      </div>
    </Abschnitt>
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
