import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRightLeft, CalendarOff, Check, Info, KeyRound, Minus, MoreHorizontal, Power, PowerOff, ShieldCheck, ShieldOff, Trash2, UserPlus, Users, Infinity as InfinityIcon } from "lucide-react";
import type { Rolle, User } from "@/core/types";
import { darfLizenzSehen, darfVerwalten, getBackend, istConsole } from "@/lib/backend";
import { useData } from "@/store/data";
import { useKanzlei, useSession } from "@/store/session";
import { toast } from "@/store/ui";
import { Avatar, Button, Chip, Field, Input, Menu, Modal, Select } from "@/components/ui";
import { StartpasswortKarte } from "@/components/StartpasswortKarte";
import { cn } from "@/lib/cn";
import { fmtDate, fmtDateWd, today } from "@/core/dates";
import { istAbwesend } from "@/core/vertretung";
import { Abschnitt } from "./teile";
import { ROLLE_AUSWAHL, ROLLE_SPALTE, rollenLabel } from "@/lib/rollen";

type Anrede = "" | "Frau" | "Herr";

/** Berufsbezeichnung als Vorschlag – passend zu Rolle und Anrede (Frau → „Rechtsanwaltsfachangestellte“). */
function titelVorschlag(rolle: Rolle, anrede: Anrede): string {
  const w = anrede === "Frau";
  const m = anrede === "Herr";
  switch (rolle) {
    case "partner":
      return w ? "Rechtsanwältin · Partnerin" : m ? "Rechtsanwalt · Partner" : "Rechtsanwältin / Rechtsanwalt · Partner";
    case "anwalt":
      return w ? "Rechtsanwältin" : m ? "Rechtsanwalt" : "Rechtsanwältin / Rechtsanwalt";
    case "refa":
      return w ? "Rechtsanwaltsfachangestellte" : m ? "Rechtsanwaltsfachangestellter" : "Rechtsanwaltsfachangestellte/r";
    case "azubi":
      return w ? "Auszubildende zur Rechtsanwaltsfachangestellten" : m ? "Auszubildender zum Rechtsanwaltsfachangestellten" : "Auszubildende/r (Rechtsanwaltsfachangestellte/r)";
    default:
      return "Kanzleiverwaltung";
  }
}

const SPALTEN: Rolle[] = ["partner", "anwalt", "refa", "azubi", "admin"];
const REIHENFOLGE: Rolle[] = ["partner", "anwalt", "refa", "azubi", "admin"];

// Muss mit der Rechteprüfung in src/lib/backend (Demo), server/index.ts und den Fachseiten übereinstimmen
// (VERWALTUNGS_ROLLEN, darfEebAbgeben, darfAbrechnung, darfLizenzSehen).
const RECHTE: { bereich: string; r: Record<Rolle, boolean> }[] = [
  { bereich: "Akten, Fristen & Kontakte", r: { partner: true, anwalt: true, refa: true, azubi: true, admin: true } },
  { bereich: "Posteingang & beA (lesen, zuordnen, Notizen)", r: { partner: true, anwalt: true, refa: true, azubi: true, admin: true } },
  { bereich: "eEB abgeben (nur Berufsträger)", r: { partner: true, anwalt: true, refa: false, azubi: false, admin: false } },
  { bereich: "Abrechnung & Aktenkonten (Fremdgeld)", r: { partner: true, anwalt: true, refa: true, azubi: false, admin: true } },
  { bereich: "Lizenz & Teamliste einsehen", r: { partner: true, anwalt: false, refa: false, azubi: false, admin: true } },
  { bereich: "Team & Zugänge verwalten", r: { partner: true, anwalt: false, refa: false, azubi: false, admin: true } },
  { bereich: "Kanzleiprofil & Datenbestand", r: { partner: true, anwalt: false, refa: false, azubi: false, admin: true } },
];

function aktualisiereTeam(fn: (team: User[]) => User[]) {
  const s = useSession.getState().sitzung;
  if (s && !istConsole(s)) {
    const team = fn(s.team);
    useSession.getState().setSitzung({ ...s, team, user: team.find((u) => u.id === s.user.id) ?? s.user });
  }
}

/** „abwesend bis 23.10. · Vertretung: Dr. Julia Hartmann“ */
function abwesenheitText(u: User, team: User[]): string | null {
  const a = u.abwesenheit;
  if (!a || a.bis < today()) return null;
  const v = a.vertretungId ? team.find((x) => x.id === a.vertretungId) : undefined;
  const zeitraum = istAbwesend(u, today()) ? `abwesend bis ${fmtDate(a.bis).slice(0, 6)}` : `abwesend ${fmtDate(a.von).slice(0, 6)}–${fmtDate(a.bis).slice(0, 6)}`;
  return `${zeitraum}${v ? ` · Vertretung: ${v.name}` : " · keine Vertretung"}${a.grund ? ` · ${a.grund}` : ""}`;
}

export function TeamTab() {
  const { team, user, tenant } = useKanzlei();
  const darf = darfVerwalten(user.rolle);
  return darf && darfLizenzSehen(user.rolle) ? <TeamVerwaltung /> : <EigenerZugang key={user.id} team={team} user={user} tenantKurz={tenant.kurzname} plaetze={tenant.lizenz.arbeitsplaetze} test={tenant.status === "test"} />;
}

/** Ansicht für Anwälte, Fachangestellte und Auszubildende: eigenes Profil, Lizenztyp ohne Lizenznummer, Rechte – keine Teamliste mit E-Mails. */
function EigenerZugang({ team, user, tenantKurz, plaetze, test }: { team: User[]; user: User; tenantKurz: string; plaetze: number; test: boolean }) {
  const [abw, setAbw] = useState(false);
  const text = abwesenheitText(user, team);
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Abschnitt titel="Ihr Zugang" text={`Ihr persönlicher Zugang bei ${tenantKurz}. Zugänge, Lizenz und Teamliste verwalten Partner und Administration.`} icon={<Users className="size-[18px]" />}>
        <div className="flex flex-wrap items-center gap-3 rounded-[18px] border border-[var(--line)] px-3.5 py-3">
          <Avatar initialen={user.initialen} farbe={user.farbe} size={42} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold">{user.name}</div>
            <div className="truncate text-[13px] text-fg-3">
              {rollenLabel(user)} · {user.titel}
            </div>
            <div className="truncate text-[13px] text-fg-3">{user.email}</div>
            {text && <div className="mt-1 text-[13px] text-amber">{text}</div>}
          </div>
          <Button size="sm" variant="secondary" icon={<CalendarOff className="size-3.5" />} onClick={() => setAbw(true)}>
            Abwesenheit & Vertretung
          </Button>
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-[16px] bg-[var(--ink-softer)] p-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">
            <InfinityIcon className="size-[18px]" />
          </span>
          <div className="min-w-0 text-[13px] text-fg-2">
            <div className="font-semibold text-fg">{test ? "Testzugang – alle Funktionen frei" : "Lifetime-Lizenz"}</div>
            {plaetze} Arbeitsplätze. Lizenznummer, Teamliste und Wartung sehen Partner und Administration.
          </div>
        </div>
      </Abschnitt>
      <RechteMatrix />
      <AbwesenheitModal ziel={abw ? user : null} onClose={() => setAbw(false)} />
    </div>
  );
}

function TeamVerwaltung() {
  const { team, user, tenant } = useKanzlei();
  const [einladen, setEinladen] = useState(false);
  const [neuPw, setNeuPw] = useState<{ user: User; passwort: string } | null>(null);
  const [abwFuer, setAbwFuer] = useState<User | null>(null);
  const [folgen, setFolgen] = useState<{ user: User; art: "deaktivieren" | "entfernen" } | null>(null);
  const plaetze = tenant.lizenz.arbeitsplaetze;
  const voll = team.length >= plaetze;
  const sortiert = [...team].sort((a, b) => REIHENFOLGE.indexOf(a.rolle) - REIHENFOLGE.indexOf(b.rolle));

  const neuesPasswort = (u: User) =>
    void (async () => {
      try {
        const passwort = await getBackend().team.neuesPasswort(u.id);
        useData.getState().log({ akteur: "nutzer", userId: user.id, text: `Neues Startpasswort für ${u.name} vergeben` });
        setNeuPw({ user: u, passwort });
      } catch (e) {
        toast("Passwort konnte nicht vergeben werden", { text: e instanceof Error ? e.message : "Bitte erneut versuchen.", ton: "fehler" });
      }
    })();

  const reaktivieren = (u: User) =>
    void (async () => {
      try {
        const neu = await getBackend().team.aendern(u.id, { deaktiviert: false });
        aktualisiereTeam((t) => t.map((x) => (x.id === u.id ? neu : x)));
        useData.getState().log({ akteur: "nutzer", userId: user.id, text: `Zugang von ${u.name} reaktiviert` });
        toast("Zugang reaktiviert", { text: `${u.name} kann sich wieder anmelden.`, ton: "erfolg" });
      } catch (e) {
        toast("Reaktivieren nicht möglich", { text: e instanceof Error ? e.message : "Bitte erneut versuchen.", ton: "fehler" });
      }
    })();

  const zweiFaktorZuruecksetzen = (u: User) =>
    void (async () => {
      try {
        await getBackend().team.aendern(u.id, { zweiFaktorZuruecksetzen: true });
        toast("Zwei-Faktor-Anmeldung zurückgesetzt", { text: `${u.name} richtet sie bei Bedarf neu ein.`, ton: "info" });
      } catch (e) {
        toast("Zurücksetzen nicht möglich", { text: e instanceof Error ? e.message : "Bitte erneut versuchen.", ton: "fehler" });
      }
    })();

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Abschnitt
        titel="Team & Zugänge"
        text="Jede Person meldet sich mit eigenem Zugang an – Rechte folgen der Rolle. Abwesenheiten mit Vertretung (§ 53 BRAO) tragen Sie hier ein."
        icon={<Users className="size-[18px]" />}
        aktion={
          <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setEinladen(true)}>
            Person einladen
          </Button>
        }
      >
        <div className="mb-4">
          <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
            <span className="text-fg-3">Arbeitsplätze der Lifetime-Lizenz</span>
            <span className="num font-semibold">
              {team.length} von {plaetze} belegt
            </span>
          </div>
          <div className="bar">
            <span style={{ width: `${Math.min(100, (team.length / plaetze) * 100)}%` }} />
          </div>
        </div>
        <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-[18px] border border-[var(--line)]">
          <AnimatePresence initial={false}>
            {sortiert.map((u) => {
              const ich = u.id === user.id;
              const abw = abwesenheitText(u, team);
              const verwaltbar = !ich && (u.rolle !== "partner" || user.rolle === "partner");
              return (
                <motion.li
                  key={u.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  className="overflow-hidden"
                >
                  <div className={cn("flex items-center gap-3 px-3.5 py-3", u.deaktiviert && "opacity-70")}>
                    <Avatar initialen={u.initialen} farbe={u.farbe} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-[13.5px] font-semibold">{u.name}</span>
                        {ich && <Chip tone="ink">Sie</Chip>}
                        {u.deaktiviert && <Chip tone="seal">deaktiviert</Chip>}
                        <Chip tone={u.rolle === "partner" ? "ink" : "outline"} className="sm:hidden">
                          {rollenLabel(u)}
                        </Chip>
                      </div>
                      <div className="truncate text-[13px] text-fg-3">{u.titel}</div>
                      <div className="truncate text-[13px] text-fg-3">{u.email}</div>
                      {abw && <div className="text-[13px] text-amber">{abw}</div>}
                    </div>
                    <Chip tone={u.rolle === "partner" ? "ink" : "outline"} className="hidden sm:inline-flex">
                      {rollenLabel(u)}
                    </Chip>
                    <Menu
                      trigger={({ toggle }) => (
                        <button type="button" className="icon-btn !size-9" aria-label={`Aktionen für ${u.name}`} onClick={toggle}>
                          <MoreHorizontal className="size-4" />
                        </button>
                      )}
                      items={[
                        { label: "Abwesenheit & Vertretung", icon: <CalendarOff />, onClick: () => setAbwFuer(u) },
                        ...(verwaltbar
                          ? [
                              { label: "Neues Startpasswort vergeben", icon: <KeyRound />, onClick: () => neuesPasswort(u) },
                              { label: "Zwei-Faktor zurücksetzen", icon: <ShieldOff />, onClick: () => zweiFaktorZuruecksetzen(u) },
                              u.deaktiviert
                                ? { label: "Reaktivieren", icon: <Power />, onClick: () => reaktivieren(u) }
                                : { label: "Deaktivieren (umkehrbar)", icon: <PowerOff />, onClick: () => setFolgen({ user: u, art: "deaktivieren" }) },
                              { label: "Zugang entfernen", icon: <Trash2 />, danger: true, onClick: () => setFolgen({ user: u, art: "entfernen" }) },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
        {voll && <p className="mt-3 text-[13px] text-amber">Alle Arbeitsplätze sind belegt. Weitere Arbeitsplätze erhalten Sie über {tenant.ansprechpartner.name}.</p>}
      </Abschnitt>

      <RechteMatrix />

      <EinladenModal open={einladen} onClose={() => setEinladen(false)} voll={voll} />
      <AbwesenheitModal ziel={abwFuer} onClose={() => setAbwFuer(null)} />
      <FolgenModal daten={folgen} onClose={() => setFolgen(null)} />
      <Modal
        open={!!neuPw}
        onClose={() => setNeuPw(null)}
        title="Neues Startpasswort"
        subtitle={neuPw ? `${neuPw.user.name} · ${neuPw.user.email}` : undefined}
        icon={<KeyRound className="size-5" />}
        size="sm"
        footer={
          <Button variant="primary" onClick={() => setNeuPw(null)}>
            Fertig
          </Button>
        }
      >
        {neuPw && (
          <div className="grid grid-cols-1 gap-4">
            <StartpasswortKarte passwort={neuPw.passwort} />
            <p className="flex gap-2 text-[13px] text-fg-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-green" /> Bei der nächsten Anmeldung legt {neuPw.user.name} ein eigenes Passwort fest. Das bisherige Passwort ist ungültig.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function RechteMatrix() {
  return (
    <Abschnitt titel="Rollen & Rechte" text="Übersicht der Standardrechte je Rolle." icon={<ShieldCheck className="size-[18px]" />}>
      {/* Bei schmaler Breite seitlich scrollbar – per Tastatur erreichbar (WCAG 2.1.1) */}
      <div className="-mx-1 overflow-x-auto rounded-[12px] outline-none focus-visible:shadow-[0_0_0_2px_var(--focus)]" tabIndex={0} role="region" aria-label="Rechte je Rolle">
        <table className="w-full min-w-[380px] text-[13px]">
          <caption className="sr-only">Rechte je Rolle</caption>
          <thead>
            <tr className="text-fg-3">
              <th scope="col" className="px-1 pb-2 text-left font-medium">
                Bereich
              </th>
              {SPALTEN.map((r) => (
                <th key={r} scope="col" className="px-0.5 pb-2 text-center align-bottom text-[12px] font-medium leading-tight">
                  {/* weiche Trennstellen, damit die Spalten auch in schmalen Karten passen */}
                  {ROLLE_SPALTE[r].replace("Fachangestellte", "Fach\u00ADangestellte").replace("Auszubildende", "Auszu\u00ADbildende").replace("Administration", "Adminis\u00ADtration")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RECHTE.map((z) => (
              <tr key={z.bereich} className="border-t border-[var(--line)]">
                <th scope="row" className="px-1 py-2.5 text-left font-normal text-fg-2">
                  {z.bereich}
                </th>
                {SPALTEN.map((r) => (
                  <td key={r} className="px-0.5 py-2.5 text-center">
                    {z.r[r] ? <Check className="mx-auto size-4 text-green" aria-label="ja" role="img" /> : <Minus className="mx-auto size-4 text-fg-3" aria-label="nein" role="img" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[13px] text-fg-3">
        Die Rechte prüft nicht nur die Oberfläche, sondern auch der Kanzlei-Server (im Demo-Betrieb das Demo-Backend). Lizenznummer und Teamliste mit E-Mail-Adressen sehen nur Partner und Administration; den KI-Status sehen alle, der KI-Präsentationsmodus gilt je Gerät.
      </p>
    </Abschnitt>
  );
}

/** Abwesenheit & Vertretung (§ 53 BRAO): Zeitraum, Vertretung aus dem Team, Grund (optional). */
function AbwesenheitModal({ ziel, onClose }: { ziel: User | null; onClose: () => void }) {
  const { team, user } = useKanzlei();
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [vertretung, setVertretung] = useState("");
  const [grund, setGrund] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [geoeffnetFuer, setGeoeffnetFuer] = useState<string | null>(null);
  if (ziel && geoeffnetFuer !== ziel.id) {
    setGeoeffnetFuer(ziel.id);
    setVon(ziel.abwesenheit?.von ?? today());
    setBis(ziel.abwesenheit?.bis ?? "");
    setVertretung(ziel.abwesenheit?.vertretungId ?? "");
    setGrund(ziel.abwesenheit?.grund ?? "");
    setFehler(null);
  }
  if (!ziel && geoeffnetFuer) setGeoeffnetFuer(null);
  const kandidaten = team.filter((u) => ziel && u.id !== ziel.id && !u.deaktiviert && u.rolle !== "azubi");

  const speichern = async (entfernen = false) => {
    if (!ziel) return;
    setFehler(null);
    if (!entfernen) {
      if (!von || !bis) return setFehler("Bitte geben Sie Beginn und Ende der Abwesenheit an.");
      if (bis < von) return setFehler("Das Ende liegt vor dem Beginn. Bitte prüfen Sie die Daten.");
    }
    setLaedt(true);
    try {
      const neu = await getBackend().team.aendern(ziel.id, { abwesenheit: entfernen ? null : { von, bis, ...(vertretung ? { vertretungId: vertretung } : {}), ...(grund.trim() ? { grund: grund.trim() } : {}) } });
      aktualisiereTeam((t) => t.map((x) => (x.id === ziel.id ? neu : x)));
      const v = team.find((x) => x.id === vertretung);
      useData.getState().log({
        akteur: "nutzer",
        userId: user.id,
        text: entfernen ? `Abwesenheit von ${ziel.name} beendet` : `Abwesenheit von ${ziel.name} eingetragen (${fmtDate(von)}–${fmtDate(bis)}) – Vertretung: ${v?.name ?? "keine"} (§ 53 BRAO)`,
      });
      toast(entfernen ? "Abwesenheit entfernt" : "Abwesenheit eingetragen", { text: entfernen ? ziel.name : `${ziel.name} · bis ${fmtDateWd(bis)}${v ? ` · Vertretung: ${v.name}` : ""}`, ton: "erfolg" });
      onClose();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Die Abwesenheit konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.");
    } finally {
      setLaedt(false);
    }
  };

  return (
    <Modal
      open={!!ziel}
      onClose={onClose}
      size="sm"
      icon={<CalendarOff className="size-5" />}
      title="Abwesenheit & Vertretung"
      subtitle={ziel ? `${ziel.name} – die Vertretung sieht die Fristen im Cockpit und unter „Nur meine“.` : undefined}
      footer={
        <>
          {ziel?.abwesenheit && (
            <Button variant="ghost" onClick={() => void speichern(true)} className="mr-auto">
              Abwesenheit entfernen
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" loading={laedt} onClick={() => void speichern()}>
            Speichern
          </Button>
        </>
      }
    >
      <form
        className="grid gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          void speichern();
        }}
      >
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Von" htmlFor="abw-von">
            <Input id="abw-von" type="date" value={von} onChange={(e) => setVon(e.target.value)} />
          </Field>
          <Field label="Bis" htmlFor="abw-bis">
            <Input id="abw-bis" type="date" value={bis} min={von || undefined} onChange={(e) => setBis(e.target.value)} />
          </Field>
        </div>
        <Field label="Vertretung" htmlFor="abw-vertretung" hint="§ 53 BRAO: Bei Abwesenheit über eine Woche ist für eine Vertretung zu sorgen.">
          <Select id="abw-vertretung" value={vertretung} onChange={(e) => setVertretung(e.target.value)}>
            <option value="">keine Vertretung</option>
            {kandidaten.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {rollenLabel(u)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Grund (optional)" htmlFor="abw-grund">
          <Input id="abw-grund" value={grund} maxLength={200} onChange={(e) => setGrund(e.target.value)} placeholder="z. B. Urlaub, Fortbildung" />
        </Field>
        {fehler && (
          <div role="alert" className="rounded-[12px] bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal">
            {fehler}
          </div>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}

/**
 * Rückfrage vor Deaktivieren bzw. Entfernen: nennt offene Akten (Bearbeiter oder Sachbearbeiter) und offene Fristen (verantwortlich)
 * und bietet „jetzt übertragen an …“ – jede Akte erhält den Verlaufseintrag „Bearbeitung von … an … übergeben“.
 */
function FolgenModal({ daten, onClose }: { daten: { user: User; art: "deaktivieren" | "entfernen" } | null; onClose: () => void }) {
  const { team, user } = useKanzlei();
  const akten = useData((s) => s.data.akten);
  const fristen = useData((s) => s.data.fristen);
  const [ziel, setZiel] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const u = daten?.user;
  const offeneAkten = useMemo(() => (u ? akten.filter((a) => a.status !== "abgeschlossen" && (a.bearbeiterId === u.id || a.sachbearbeiterId === u.id)) : []), [akten, u]);
  const offeneFristen = useMemo(() => (u ? fristen.filter((f) => f.status === "offen" && f.verantwortlichId === u.id) : []), [fristen, u]);
  const kandidaten = team.filter((x) => u && x.id !== u.id && !x.deaktiviert && x.rolle !== "azubi");
  const entfernen = daten?.art === "entfernen";

  const schliessen = () => {
    setZiel("");
    setFehler(null);
    onClose();
  };

  const uebertragen = (alt: User, neu: User) => {
    const st = useData.getState();
    for (const a of offeneAkten) {
      const patch: Partial<typeof a> = {};
      if (a.bearbeiterId === alt.id) patch.bearbeiterId = neu.id;
      if (a.sachbearbeiterId === alt.id) patch.sachbearbeiterId = neu.id;
      st.patch("akten", a.id, patch);
      st.log({ akteur: "nutzer", userId: user.id, akteId: a.id, text: `Bearbeitung von ${alt.name} an ${neu.name} übergeben` });
    }
    for (const f of offeneFristen) st.patch("fristen", f.id, { verantwortlichId: neu.id });
  };

  const ausfuehren = async () => {
    if (!u || !daten) return;
    setFehler(null);
    setLaedt(true);
    try {
      const neu = team.find((x) => x.id === ziel);
      if (neu) uebertragen(u, neu);
      if (entfernen) {
        await getBackend().team.remove(u.id);
        aktualisiereTeam((t) => t.filter((x) => x.id !== u.id));
        useData.getState().log({ akteur: "nutzer", userId: user.id, text: `Zugang von ${u.name} entfernt${neu ? ` – Akten und Fristen an ${neu.name} übertragen` : ""}` });
      } else {
        const geaendert = await getBackend().team.aendern(u.id, { deaktiviert: true });
        aktualisiereTeam((t) => t.map((x) => (x.id === u.id ? geaendert : x)));
        useData.getState().log({ akteur: "nutzer", userId: user.id, text: `Zugang von ${u.name} deaktiviert (umkehrbar)${neu ? ` – Akten und Fristen an ${neu.name} übertragen` : ""}` });
      }
      toast(entfernen ? "Zugang entfernt" : "Zugang deaktiviert", {
        text: `${u.name}${neu ? ` · ${offeneAkten.length} Akten und ${offeneFristen.length} Fristen an ${neu.name} übertragen` : ""}`,
        ton: "info",
      });
      schliessen();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt. Bitte versuchen Sie es erneut.");
    } finally {
      setLaedt(false);
    }
  };

  return (
    <Modal
      open={!!daten}
      onClose={schliessen}
      size="sm"
      icon={entfernen ? <Trash2 className="size-5" /> : <PowerOff className="size-5" />}
      title={u ? (entfernen ? `Zugang von ${u.name} entfernen?` : `Zugang von ${u.name} deaktivieren?`) : ""}
      subtitle={entfernen ? "Endgültig – die Person kann sich nicht mehr anmelden. Akten, Fristen und Protokolle bleiben erhalten." : "Umkehrbar – Anmeldung und laufende Sitzungen sind gesperrt, bis Sie „Reaktivieren“ wählen."}
      footer={
        <>
          <Button variant="ghost" onClick={schliessen}>
            Abbrechen
          </Button>
          <Button variant={entfernen ? "danger" : "primary"} loading={laedt} onClick={() => void ausfuehren()}>
            {entfernen ? "Zugang entfernen" : "Deaktivieren"}
          </Button>
        </>
      }
    >
      {u && (
        <div className="grid gap-3.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[14px] bg-[var(--ink-softer)] p-3 ring-1 ring-[var(--line)]">
              <div className="num text-[22px] font-semibold">{offeneAkten.length}</div>
              <div className="text-[13px] text-fg-3">offene Akten (Bearbeitung)</div>
            </div>
            <div className={cn("rounded-[14px] p-3 ring-1 ring-[var(--line)]", offeneFristen.length ? "bg-amber-soft" : "bg-[var(--ink-softer)]")}>
              <div className="num text-[22px] font-semibold">{offeneFristen.length}</div>
              <div className="text-[13px] text-fg-3">offene Fristen (verantwortlich)</div>
            </div>
          </div>
          {(offeneAkten.length > 0 || offeneFristen.length > 0) && (
            <Field label="Jetzt übertragen an …" htmlFor="folgen-ziel" hint="Jede Akte erhält im Verlauf den Eintrag „Bearbeitung von … an … übergeben“.">
              <Select id="folgen-ziel" value={ziel} onChange={(e) => setZiel(e.target.value)}>
                <option value="">nicht übertragen</option>
                {kandidaten.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} · {rollenLabel(x)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {!ziel && offeneFristen.length > 0 && (
            <p className="flex gap-2 rounded-[12px] bg-amber-soft px-3 py-2 text-[13px] text-fg-2">
              <ArrowRightLeft className="mt-0.5 size-3.5 shrink-0 text-amber" /> Ohne Übertragung bleiben {offeneFristen.length} Fristen bei {u.name}. Bitte stellen Sie sicher, dass jemand sie überwacht.
            </p>
          )}
          {fehler && (
            <div role="alert" className="rounded-[12px] bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal">
              {fehler}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function EinladenModal({ open, onClose, voll }: { open: boolean; onClose: () => void; voll: boolean }) {
  const { user, tenant } = useKanzlei();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [anrede, setAnrede] = useState<Anrede>("");
  const [rolle, setRolle] = useState<Rolle>("anwalt");
  const [titel, setTitel] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<{ user: User; passwort: string } | null>(null);

  const reset = () => {
    setName("");
    setEmail("");
    setAnrede("");
    setRolle("anwalt");
    setTitel("");
    setFehler(null);
    setErgebnis(null);
  };
  const schliessen = () => {
    onClose();
    setTimeout(reset, 300);
  };

  const senden = async () => {
    setFehler(null);
    if (name.trim().split(/\s+/).length < 2) return setFehler("Bitte Vor- und Nachnamen angeben, z. B. „Anna Schulz“.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setFehler("Bitte eine gültige E-Mail-Adresse angeben, z. B. anna.schulz@kanzlei.de.");
    setLaedt(true);
    try {
      const r = await getBackend().team.add({ name: name.trim(), email: email.trim(), rolle, titel: titel.trim() || titelVorschlag(rolle, anrede), ...(anrede ? { anrede } : {}) });
      aktualisiereTeam((t) => [...t.filter((x) => x.id !== r.user.id), r.user]);
      useData.getState().log({ akteur: "nutzer", userId: user.id, text: `Zugang für ${r.user.name} angelegt (${rollenLabel(r.user)}) – Startpasswort vergeben` });
      setErgebnis(r);
      toast("Zugang angelegt", { text: `${r.user.name} kann sich jetzt anmelden.`, ton: "erfolg" });
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Der Zugang konnte nicht angelegt werden. Bitte erneut versuchen.");
    } finally {
      setLaedt(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={schliessen}
      title={ergebnis ? "Zugang angelegt" : "Person einladen"}
      subtitle={ergebnis ? undefined : `Neuer Zugang für ${tenant.kurzname} – mit eigener Anmeldung und Rolle.`}
      icon={ergebnis ? <KeyRound className="size-5" /> : <UserPlus className="size-5" />}
      size="sm"
      footer={
        ergebnis ? (
          <>
            <Button variant="ghost" onClick={reset}>
              Weitere Person einladen
            </Button>
            <Button variant="primary" onClick={schliessen}>
              Fertig
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={schliessen}>
              Abbrechen
            </Button>
            <Button variant="primary" icon={<UserPlus className="size-4" />} loading={laedt} disabled={voll} onClick={() => void senden()}>
              Zugang anlegen
            </Button>
          </>
        )
      }
    >
      {ergebnis ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-4">
          <div className="flex items-center gap-3">
            <Avatar initialen={ergebnis.user.initialen} farbe={ergebnis.user.farbe} size={42} />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold">{ergebnis.user.name}</div>
              <div className="truncate text-[13px] text-fg-3">
                {rollenLabel(ergebnis.user)} · {ergebnis.user.email}
              </div>
            </div>
          </div>
          <StartpasswortKarte passwort={ergebnis.passwort} />
          <ul className="grid grid-cols-1 gap-1.5 text-[13px] text-fg-2">
            <li className="flex gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-green" /> Bei der ersten Anmeldung legt die Person ein eigenes Passwort fest.
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-green" /> Es wird nur jetzt angezeigt. Bei Verlust vergeben Partner oder Administration über „⋯“ ein neues Startpasswort.
            </li>
          </ul>
        </motion.div>
      ) : (
        <form
          className="grid grid-cols-1 gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            void senden();
          }}
        >
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[140px_minmax(0,1fr)]">
            <Field label="Anrede" htmlFor="inv-anrede">
              <Select id="inv-anrede" value={anrede} onChange={(e) => setAnrede(e.target.value as Anrede)}>
                <option value="">keine Angabe</option>
                <option value="Frau">Frau</option>
                <option value="Herr">Herr</option>
              </Select>
            </Field>
            <Field label="Vor- und Nachname" htmlFor="inv-name">
              <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Anna Schulz" autoComplete="off" />
            </Field>
          </div>
          <Field label="E-Mail-Adresse" htmlFor="inv-email" hint="Damit meldet sich die Person an.">
            <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="anna.schulz@kanzlei.de" autoComplete="off" />
          </Field>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Rolle" htmlFor="inv-rolle">
              <Select id="inv-rolle" value={rolle} onChange={(e) => setRolle(e.target.value as Rolle)}>
                {REIHENFOLGE.map((r) => (
                  <option key={r} value={r}>
                    {ROLLE_AUSWAHL[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Titel / Berufsbezeichnung" htmlFor="inv-titel">
              <Input id="inv-titel" value={titel} onChange={(e) => setTitel(e.target.value)} placeholder={titelVorschlag(rolle, anrede)} />
            </Field>
          </div>
          {rolle === "azubi" && (
            <p className="flex gap-2 rounded-[12px] bg-[var(--ink-softer)] px-3.5 py-2.5 text-[13px] text-fg-2">
              <Info className="mt-0.5 size-3.5 shrink-0 text-ink" /> Auszubildende arbeiten in Akten, Fristen, Kontakten und im Posteingang (lesen, zuordnen, Notizen). Abrechnung, Aktenkonten (Fremdgeld), eEB-Abgabe, Lizenz und Teamliste sind gesperrt.
            </p>
          )}
          {voll && <div className="rounded-[12px] bg-amber-soft px-3.5 py-2.5 text-[13px] text-fg-2">Alle Arbeitsplätze sind belegt. Weitere Arbeitsplätze erhalten Sie über {tenant.ansprechpartner.name}.</div>}
          {fehler && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert" className="rounded-[12px] bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal">
              {fehler}
            </motion.div>
          )}
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      )}
    </Modal>
  );
}
