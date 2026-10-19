import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "react-router";
import { ArrowRightLeft, CalendarOff, Check, Info, KeyRound, Minus, MoreHorizontal, Power, PowerOff, ShieldCheck, ShieldOff, Trash2, UserPlus, Users, Infinity as InfinityIcon } from "lucide-react";
import type { Rolle, User } from "@/core/types";
import { darfLizenzSehen, darfVerwalten, getBackend, istConsole } from "@/lib/backend";
import { useData } from "@/store/data";
import { useKanzlei, useSession } from "@/store/session";
import { toast } from "@/store/ui";
import { Avatar, Button, Chip, Field, Input, Menu, Modal, Select } from "@/components/ui";
import { StartpasswortKarte } from "@/components/StartpasswortKarte";
import { cn } from "@/lib/cn";
import { addDays, fmtDate, today } from "@/core/dates";
import { NICHT_UEBERTRAGEN, istAbwesend, istBerufstraeger, tagKurz, uebertragungSperrgrund, uebertragungVorbelegung, verantwortungText, vertretungUmfangText } from "@/core/vertretung";
import { offeneVerantwortung } from "@/core/fristenLage";
import type { Frist } from "@/core/types";
import { Abschnitt } from "./teile";
import { ROLLE_AUSWAHL, ROLLE_SPALTE, rollenLabel } from "@/lib/rollen";
import { BEWEGUNG } from "@/lib/bewegung";

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
const RECHTE: { bereich: string; ja: string; nein: string; r: Record<Rolle, boolean> }[] = [
  { bereich: "Akten, Fristen & Kontakte", ja: "Akten, Fristen, Kontakte", nein: "keine Akten", r: { partner: true, anwalt: true, refa: true, azubi: true, admin: true } },
  { bereich: "Posteingang & beA (lesen, zuordnen, Notizen)", ja: "Posteingang", nein: "kein Posteingang", r: { partner: true, anwalt: true, refa: true, azubi: true, admin: true } },
  { bereich: "eEB abgeben (nur Berufsträger)", ja: "eEB", nein: "kein eEB", r: { partner: true, anwalt: true, refa: false, azubi: false, admin: false } },
  { bereich: "Abrechnung & Aktenkonten (Fremdgeld)", ja: "Abrechnung", nein: "keine Abrechnung und Aktenkonten", r: { partner: true, anwalt: true, refa: true, azubi: false, admin: true } },
  { bereich: "Lizenz & Teamliste einsehen", ja: "Lizenz- und Teamdaten", nein: "keine Lizenz- und Teamdaten", r: { partner: true, anwalt: false, refa: false, azubi: false, admin: true } },
  { bereich: "Team & Zugänge verwalten", ja: "Zugänge verwalten", nein: "keine Zugangsverwaltung", r: { partner: true, anwalt: false, refa: false, azubi: false, admin: true } },
  { bereich: "Kanzleiprofil & Datenbestand", ja: "Kanzleiprofil", nein: "kein Kanzleiprofil", r: { partner: true, anwalt: false, refa: false, azubi: false, admin: true } },
];

/**
 * Folgen einer Rolle in einem Satz – aus derselben Rechte-Matrix wie die Tabelle:
 * „Fachangestellte: Akten, Fristen, Kontakte, Posteingang, Abrechnung – kein eEB, keine Lizenz- und Teamdaten, …“
 */
function rollenFolgen(rolle: Rolle): string {
  const ja = RECHTE.filter((z) => z.r[rolle]).map((z) => z.ja);
  const nein = RECHTE.filter((z) => !z.r[rolle]).map((z) => z.nein);
  // Lizenz/Teamliste und Zugangsverwaltung hängen zusammen – einmal nennen
  const kurz = nein.includes("keine Lizenz- und Teamdaten") ? nein.filter((x) => x !== "keine Zugangsverwaltung") : nein;
  const name = ROLLE_AUSWAHL[rolle];
  if (nein.length) return `${name}: ${ja.join(", ")} – ${kurz.join(", ")}.`;
  const auch = ja.slice(2);
  return `${name}: alle Rechte, auch ${auch.slice(0, -1).join(", ")} und ${auch[auch.length - 1]}.`;
}

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
  const sb = a.sachbearbeitungId ? team.find((x) => x.id === a.sachbearbeitungId) : undefined;
  const zeitraum = istAbwesend(u, today()) ? `abwesend bis ${fmtDate(a.bis).slice(0, 6)}` : `abwesend ${fmtDate(a.von).slice(0, 6)}–${fmtDate(a.bis).slice(0, 6)}`;
  return `${zeitraum}${v ? ` · Vertretung: ${v.name}` : " · keine Vertretung"}${sb ? ` · Sachbearbeitung: ${sb.name}` : ""}${a.grund ? ` · ${a.grund}` : ""}`;
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
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--line)] px-3.5 py-3">
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
        <div className="mt-4 flex items-start gap-3 rounded-lg bg-[var(--ink-softer)] p-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-ink-soft text-ink">
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
  const [folgen, setFolgen] = useState<{ user: User; art: FolgenArt } | null>(null);
  const plaetze = tenant.lizenz.arbeitsplaetze;
  // Deep-Link aus dem Cockpit-Hinweis „… offene Fristen eines deaktivierten Zugangs“: ?uebertragen=<Nutzer-ID> (I5-T23-01)
  const [params, setParams] = useSearchParams();
  const uebertragenFuer = params.get("uebertragen");
  useEffect(() => {
    if (!uebertragenFuer) return;
    const ziel = team.find((x) => x.id === uebertragenFuer);
    if (ziel?.deaktiviert && (ziel.rolle !== "partner" || user.rolle === "partner")) setFolgen({ user: ziel, art: "uebertragen" });
    const rest = new URLSearchParams(params);
    rest.delete("uebertragen");
    setParams(rest, { replace: true });
  }, [uebertragenFuer]); // eslint-disable-line react-hooks/exhaustive-deps
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
        <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-lg border border-[var(--line)]">
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
                  transition={BEWEGUNG.standard}
                  className="overflow-hidden"
                >
                  <div className={cn("flex items-center gap-3 px-3.5 py-3", u.deaktiviert && "opacity-70")}>
                    <Avatar initialen={u.initialen} farbe={u.farbe} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-[14px] font-semibold">{u.name}</span>
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
                              ...(u.deaktiviert ? [{ label: "Akten und Fristen übertragen …", icon: <ArrowRightLeft />, onClick: () => setFolgen({ user: u, art: "uebertragen" }) }] : []),
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
      <div className="-mx-1 overflow-x-auto rounded-md outline-none focus-visible:shadow-[0_0_0_2px_var(--focus)]" tabIndex={0} role="region" aria-label="Rechte je Rolle">
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
  const [sachbearbeitung, setSachbearbeitung] = useState("");
  const [umgestellt, setUmgestellt] = useState<string | null>(null);
  const [grund, setGrund] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [geoeffnetFuer, setGeoeffnetFuer] = useState<string | null>(null);
  // Bestätigung nach dem Speichern (I4-T18-04): Einträge der abwesenden Person im Zeitraum und wer sie ab wann sieht
  const [ergebnis, setErgebnis] = useState<{ von: string; bis: string; vertretung?: User; eintraege: Frist[] } | null>(null);
  const fristen = useData((s) => s.data.fristen);
  const akten = useData((s) => s.data.akten);
  const fertigRef = useRef<HTMLButtonElement>(null);
  // Nach dem Speichern: Fokus auf „Fertig“ (der Speichern-Knopf ist dann nicht mehr da)
  useEffect(() => {
    if (!ergebnis) return;
    const t = setTimeout(() => fertigRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, [ergebnis]);
  if (ziel && geoeffnetFuer !== ziel.id) {
    setGeoeffnetFuer(ziel.id);
    setErgebnis(null);
    setVon(ziel.abwesenheit?.von ?? today());
    setBis(ziel.abwesenheit?.bis ?? "");
    // Früher gespeicherte Vertretung durch eine Fachangestellte: als Sachbearbeitung übernehmen, Vertretung neu wählen lassen
    const alt = team.find((x) => x.id === ziel.abwesenheit?.vertretungId);
    const umstellen = !!alt && istBerufstraeger(ziel) && !istBerufstraeger(alt);
    setVertretung(umstellen ? "" : ziel.abwesenheit?.vertretungId ?? "");
    setSachbearbeitung(ziel.abwesenheit?.sachbearbeitungId ?? (umstellen && alt ? alt.id : ""));
    setUmgestellt(umstellen && alt ? `${alt.name} war als Vertretung eingetragen und ist jetzt für die Sachbearbeitung vorgesehen. Bitte wählen Sie eine Vertretung nach § 53 BRAO.` : null);
    setGrund(ziel.abwesenheit?.grund ?? "");
    setFehler(null);
  }
  if (!ziel && geoeffnetFuer) setGeoeffnetFuer(null);
  // § 53 BRAO: Berufsträger vertreten nur Partner und Rechtsanwälte; die Sachbearbeitung (z. B. Fachangestellte) ist ein eigenes Feld.
  const berufstraeger = !!ziel && istBerufstraeger(ziel);
  const aktiv = team.filter((u) => ziel && u.id !== ziel.id && !u.deaktiviert);
  const kandidaten = aktiv.filter((u) => (berufstraeger ? istBerufstraeger(u) : u.rolle !== "azubi"));
  const sbKandidaten = aktiv.filter((u) => u.rolle === "refa" || u.rolle === "azubi");

  const speichern = async (entfernen = false) => {
    if (!ziel) return;
    setFehler(null);
    if (!entfernen) {
      if (!von || !bis) return setFehler("Bitte geben Sie Beginn und Ende der Abwesenheit an.");
      if (bis < von) return setFehler("Das Ende liegt vor dem Beginn. Bitte prüfen Sie die Daten.");
    }
    setLaedt(true);
    try {
      const sbId = berufstraeger && sachbearbeitung ? sachbearbeitung : "";
      const neu = await getBackend().team.aendern(ziel.id, {
        abwesenheit: entfernen ? null : { von, bis, ...(vertretung ? { vertretungId: vertretung } : {}), ...(sbId ? { sachbearbeitungId: sbId } : {}), ...(grund.trim() ? { grund: grund.trim() } : {}) },
      });
      aktualisiereTeam((t) => t.map((x) => (x.id === ziel.id ? neu : x)));
      const v = team.find((x) => x.id === vertretung);
      const sb = sbId ? team.find((x) => x.id === sbId) : undefined;
      useData.getState().log({
        akteur: "nutzer",
        userId: user.id,
        text: entfernen
          ? `Abwesenheit von ${ziel.name} beendet`
          : `Abwesenheit von ${ziel.name} eingetragen (${fmtDate(von)}–${fmtDate(bis)}) – Vertretung: ${v?.name ?? "keine"}${berufstraeger ? " (§ 53 BRAO)" : ""}${sb ? ` · Sachbearbeitung: ${sb.name}` : ""}`,
      });
      if (entfernen) {
        toast("Abwesenheit entfernt", { text: ziel.name, ton: "erfolg" });
        onClose();
      } else {
        // offene Fristen, Notfristen, Wiedervorlagen und Vorfristen der Person im Zeitraum (keine Termine) – wie „Vertretung vorab“
        const eintraege = fristen
          .filter((f) => f.status === "offen" && f.verantwortlichId === ziel.id && f.typ !== "termin" && f.datum >= von && f.datum <= bis)
          .sort((a, b) => a.datum.localeCompare(b.datum) || (a.uhrzeit ?? "").localeCompare(b.uhrzeit ?? ""));
        setErgebnis({ von, bis, vertretung: v, eintraege });
      }
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Die Abwesenheit konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.");
    } finally {
      setLaedt(false);
    }
  };

  // Bestätigung im selben Dialog (Fokus bleibt im Dialog und kehrt beim Schließen zum Auslöser zurück)
  const bestaetigung = (() => {
    if (!ziel || !ergebnis) return null;
    const heute = today();
    // Die Vertretung sieht die Einträge im Cockpit 14 Tage vor Beginn (Vertretung vorab), ab Beginn unter „Nur meine (+ Vertretung)“
    const abWann = ergebnis.von <= addDays(heute, 14) ? "ab sofort" : `ab ${tagKurz(addDays(ergebnis.von, -14))}`;
    const az = (id: string) => akten.find((a) => a.id === id)?.aktenzeichen;
    return (
      <div className="grid gap-3">
        {ergebnis.eintraege.length === 0 ? (
          <p className="flex items-start gap-2 rounded-md bg-green-soft px-3 py-2.5 text-[14px] text-fg-2">
            <Check className="mt-0.5 size-4 shrink-0 text-green" /> Im Zeitraum liegen keine offenen Fristen.
          </p>
        ) : (
          <>
            <p className="text-[14px] text-fg-2">
              Im Zeitraum: <span className="font-semibold text-fg">{vertretungUmfangText(ergebnis.eintraege)}</span>
            </p>
            <ul className="grid divide-y divide-[var(--line)] overflow-hidden rounded-lg ring-1 ring-[var(--line)]" aria-label="Einträge im Zeitraum">
              {ergebnis.eintraege.map((f) => (
                <li key={f.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 px-3 py-2 text-[13px]">
                  <span className="num font-semibold text-fg">{tagKurz(f.datum)}</span>
                  <span className="min-w-0 break-words text-fg-2">
                    {az(f.akteId) && <span className="mono mr-1.5 font-medium text-fg">{az(f.akteId)}</span>}
                    {f.titel}
                    {f.typ !== "frist" && <span className="text-fg-3"> · {f.typ === "notfrist" ? "Notfrist" : f.typ === "wiedervorlage" ? "Wiedervorlage" : "Vorfrist"}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {ergebnis.vertretung ? (
          <p className="flex items-start gap-2 rounded-md bg-[var(--surface-2)] px-3 py-2.5 text-[13px] leading-snug text-fg-2">
            <Info className="mt-0.5 size-3.5 shrink-0 text-fg-3" />
            <span>
              {ergebnis.eintraege.length
                ? `${ergebnis.vertretung.name} sieht sie ${abWann} im Cockpit und unter ‚Nur meine (+ Vertretung)‘.`
                : `${ergebnis.vertretung.name} ist als Vertretung eingetragen und sieht neue Einträge ${abWann} im Cockpit und unter ‚Nur meine (+ Vertretung)‘.`}
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-2 rounded-md bg-amber-soft px-3 py-2.5 text-[13px] leading-snug text-fg-2">
            <Info className="mt-0.5 size-3.5 shrink-0 text-amber" />
            <span>Ohne Vertretung sieht niemand diese Einträge vorab – bitte eine Vertretung eintragen (§ 53 BRAO).</span>
          </p>
        )}
      </div>
    );
  })();

  return (
    <Modal
      open={!!ziel}
      onClose={onClose}
      size="sm"
      icon={<CalendarOff className="size-5" />}
      title={bestaetigung ? "Abwesenheit eingetragen" : "Abwesenheit & Vertretung"}
      subtitle={
        ziel && ergebnis
          ? `${ziel.name} · ${tagKurz(ergebnis.von)} bis ${tagKurz(ergebnis.bis)}`
          : ziel
            ? `${ziel.name} – die Vertretung sieht die Fristen im Cockpit und unter „Nur meine“.`
            : undefined
      }
      footer={
        bestaetigung ? (
          <Button ref={fertigRef} variant="primary" onClick={onClose}>
            Fertig
          </Button>
        ) : (
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
        )
      }
    >
      {bestaetigung ?? (
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
        <Field
          label={berufstraeger ? "Vertretung (Rechtsanwältin/Rechtsanwalt)" : "Vertretung"}
          htmlFor="abw-vertretung"
          hint={
            berufstraeger
              ? "§ 53 BRAO: Bei Abwesenheit über eine Woche ist für eine Vertretung durch eine Rechtsanwältin oder einen Rechtsanwalt zu sorgen. Zur Wahl stehen deshalb nur Partner und Anwälte."
              : "Die Vertretung sieht die Fristen und Wiedervorlagen im Cockpit und unter „Nur meine“."
          }
        >
          <Select id="abw-vertretung" value={vertretung} onChange={(e) => setVertretung(e.target.value)}>
            <option value="">keine Vertretung</option>
            {kandidaten.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {rollenLabel(u)}
                {istAbwesend(u, von || today()) ? " · selbst abwesend" : ""}
              </option>
            ))}
          </Select>
        </Field>
        {umgestellt && (
          <p className="flex gap-2 rounded-md bg-amber-soft px-3 py-2 text-[13px] text-fg-2">
            <Info className="mt-0.5 size-3.5 shrink-0 text-amber" /> {umgestellt}
          </p>
        )}
        {berufstraeger && sbKandidaten.length > 0 && (
          <Field label="Sachbearbeitung während der Abwesenheit (optional)" htmlFor="abw-sachbearbeitung" hint="Fachangestellte übernehmen hier die Sachbearbeitung – nicht die Vertretung nach § 53 BRAO.">
            <Select id="abw-sachbearbeitung" value={sachbearbeitung} onChange={(e) => setSachbearbeitung(e.target.value)}>
              <option value="">wie bisher</option>
              {sbKandidaten.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {rollenLabel(u)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Grund (optional)" htmlFor="abw-grund">
          <Input id="abw-grund" value={grund} maxLength={200} onChange={(e) => setGrund(e.target.value)} placeholder="z. B. Urlaub, Fortbildung" />
        </Field>
        {fehler && (
          <div role="alert" className="rounded-md bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal">
            {fehler}
          </div>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
      )}
    </Modal>
  );
}

type FolgenArt = "deaktivieren" | "entfernen" | "uebertragen";

/**
 * Rückfrage vor Deaktivieren bzw. Entfernen: nennt offene Akten (Bearbeiter oder Sachbearbeiter) und offene Fristen (verantwortlich)
 * und bietet „jetzt übertragen an …“ – jede Akte erhält den Verlaufseintrag „Bearbeitung von … an … übergeben“.
 * Offene Fristen bleiben nie still ohne aktive verantwortliche Person (I5-T23-01): Das Feld ist mit der Vertretung bzw. der
 * angemeldeten Person vorbelegt oder Pflicht; „Nicht übertragen“ geht nur mit Pflichthäkchen und Protokolleintrag.
 * Art „uebertragen“: nachträglich für einen bereits deaktivierten Zugang (Cockpit-Hinweis → Einstellungen → Team).
 */
function FolgenModal({ daten, onClose }: { daten: { user: User; art: FolgenArt } | null; onClose: () => void }) {
  const { team, user } = useKanzlei();
  const akten = useData((s) => s.data.akten);
  const fristen = useData((s) => s.data.fristen);
  const [ziel, setZiel] = useState("");
  const [sbZiel, setSbZiel] = useState("");
  const [bestaetigt, setBestaetigt] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const u = daten?.user;
  const offen = useMemo(() => (u ? akten.filter((a) => a.status !== "abgeschlossen") : []), [akten, u]);
  const bearbAkten = useMemo(() => (u ? offen.filter((a) => a.bearbeiterId === u.id) : []), [offen, u]);
  const sachAkten = useMemo(() => (u ? offen.filter((a) => a.sachbearbeiterId === u.id) : []), [offen, u]);
  // Zählweise wie überall (fristenLage): Fristen = Notfristen und Fristen; Wiedervorlagen und Termine getrennt genannt.
  // Übertragen werden alle offenen Einträge der Person.
  const verantwortung = useMemo(() => (u ? offeneVerantwortung(fristen, u.id) : undefined), [fristen, u]);
  const offeneEintraege = verantwortung?.alle ?? [];
  const anzFristen = verantwortung?.fristen.length ?? 0;
  const weitere = verantwortung ? offeneEintraege.length - anzFristen : 0;
  // Bearbeitung und Fristverantwortung nur an Berufsträger; Fachangestellte nur als Sachbearbeitung
  const aktiv = team.filter((x) => u && x.id !== u.id && !x.deaktiviert);
  const kandidaten = aktiv.filter(istBerufstraeger);
  const sbKandidaten = [...aktiv.filter((x) => x.rolle === "refa"), ...kandidaten];
  const entfernen = daten?.art === "entfernen";
  const nachtraeglich = daten?.art === "uebertragen";
  const bearbUndFristen = bearbAkten.length > 0 || offeneEintraege.length > 0;
  // Pflichtentscheidung, sobald offene Fristen beim Zugang liegen; ohne Fristen bleibt der Ablauf wie bisher („nicht übertragen“ frei)
  const pflicht = anzFristen > 0;
  const ohneUebertragung = ziel === NICHT_UEBERTRAGEN;

  // Vorbelegung beim Öffnen: Vertretung der Person, sonst die angemeldete Person – sonst leer und Pflicht
  useEffect(() => {
    if (!u) return;
    setZiel(pflicht || nachtraeglich ? uebertragungVorbelegung(u, user, kandidaten) : "");
    setSbZiel("");
    setBestaetigt(false);
    setFehler(null);
    // nur beim Öffnen für eine Person, nicht bei jeder Datenänderung
  }, [u?.id, daten?.art]); // eslint-disable-line react-hooks/exhaustive-deps

  const sperrgrund = !u
    ? undefined
    : nachtraeglich
      ? !kandidaten.some((x) => x.id === ziel) && !sbKandidaten.some((x) => x.id === sbZiel)
        ? `Bitte wählen Sie, wer ${anzFristen === 1 ? "die offene Frist" : anzFristen ? `die ${anzFristen} offenen Fristen` : "die offenen Einträge"} von ${u.name} übernimmt.`
        : undefined
      : uebertragungSperrgrund({ offeneFristen: anzFristen, wahl: ziel, bestaetigt, name: u.name });
  const grundId = "folgen-sperrgrund";

  const schliessen = () => {
    setZiel("");
    setSbZiel("");
    setBestaetigt(false);
    setFehler(null);
    onClose();
  };

  const uebertragen = (alt: User, neu: User | undefined, neuSb: User | undefined) => {
    const st = useData.getState();
    for (const a of offen) {
      const patch: Partial<typeof a> = {};
      if (neu && a.bearbeiterId === alt.id) patch.bearbeiterId = neu.id;
      if (neuSb && a.sachbearbeiterId === alt.id) patch.sachbearbeiterId = neuSb.id;
      if (!Object.keys(patch).length) continue;
      st.patch("akten", a.id, patch);
      if (patch.bearbeiterId) st.log({ akteur: "nutzer", userId: user.id, akteId: a.id, text: `Bearbeitung von ${alt.name} an ${neu!.name} übergeben` });
      if (patch.sachbearbeiterId) st.log({ akteur: "nutzer", userId: user.id, akteId: a.id, text: `Sachbearbeitung von ${alt.name} an ${neuSb!.name} übergeben` });
    }
    if (neu) for (const f of offeneEintraege) st.patch("fristen", f.id, { verantwortlichId: neu.id });
  };

  const ausfuehren = async () => {
    if (!u || !daten || sperrgrund) return;
    setFehler(null);
    setLaedt(true);
    try {
      const neu = kandidaten.find((x) => x.id === ziel);
      const neuSb = sbKandidaten.find((x) => x.id === sbZiel);
      const teile = [
        neu && `Bearbeitung und Fristen an ${neu.name}`,
        neuSb && `Sachbearbeitung an ${neuSb.name}`,
      ].filter(Boolean) as string[];
      const nachsatz = teile.length ? ` – ${teile.join(", ")} übertragen` : "";
      // Ohne Übertragung: Protokolleintrag mit Zahl der Fristen und handelnder Person (I5-T23-01)
      const selbstUeberwacht = pflicht && ohneUebertragung && bestaetigt;
      const ohneText = selbstUeberwacht ? ` – ${anzFristen === 1 ? "1 offene Frist" : `${anzFristen} offene Fristen`} nicht übertragen; Überwachung sichergestellt durch ${user.name}` : "";
      // Erst das Backend entscheiden lassen (Rechte, Fristregel), dann übertragen – lehnt es ab, bleibt alles unverändert
      if (nachtraeglich) {
        if (neu || neuSb) uebertragen(u, neu, neuSb);
        useData.getState().log({ akteur: "nutzer", userId: user.id, text: `Offene Einträge des deaktivierten Zugangs von ${u.name}${nachsatz}` });
      } else if (entfernen) {
        await getBackend().team.remove(u.id, neu ? { uebertragenAn: neu.id } : undefined);
        if (neu || neuSb) uebertragen(u, neu, neuSb);
        aktualisiereTeam((t) => t.filter((x) => x.id !== u.id));
        useData.getState().log({ akteur: "nutzer", userId: user.id, text: `Zugang von ${u.name} entfernt${nachsatz}` });
      } else {
        const geaendert = await getBackend().team.aendern(u.id, {
          deaktiviert: true,
          ...(neu ? { fristen: { uebertragenAn: neu.id } } : selbstUeberwacht ? { fristen: { ueberwachungBestaetigt: true } } : {}),
        });
        if (neu || neuSb) uebertragen(u, neu, neuSb);
        aktualisiereTeam((t) => t.map((x) => (x.id === u.id ? geaendert : x)));
        useData.getState().log({ akteur: "nutzer", userId: user.id, text: `Zugang von ${u.name} deaktiviert (umkehrbar)${nachsatz}${ohneText}` });
      }
      const zahlen = [
        neu && `${bearbAkten.length} Akten und ${verantwortungText(verantwortung!)} an ${neu.name}`,
        neuSb && `Sachbearbeitung in ${sachAkten.length} Akten an ${neuSb.name}`,
      ].filter(Boolean) as string[];
      toast(nachtraeglich ? "Verantwortung übertragen" : entfernen ? "Zugang entfernt" : "Zugang deaktiviert", {
        text: `${u.name}${zahlen.length ? ` · ${zahlen.join(" · ")} übertragen` : selbstUeberwacht ? ` · ${anzFristen === 1 ? "1 offene Frist" : `${anzFristen} offene Fristen`} bleiben beim Zugang – Überwachung durch Sie` : ""}`,
        ton: "info",
      });
      schliessen();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt. Bitte versuchen Sie es erneut.");
    } finally {
      setLaedt(false);
    }
  };

  const titel = !u ? "" : nachtraeglich ? `Offene Einträge von ${u.name} übertragen` : entfernen ? `Zugang von ${u.name} entfernen?` : `Zugang von ${u.name} deaktivieren?`;
  const unter = nachtraeglich
    ? "Der Zugang ist deaktiviert – übertragen Sie Bearbeitung und Fristverantwortung an eine aktive Person."
    : entfernen
      ? "Endgültig – die Person kann sich nicht mehr anmelden. Akten, Fristen und Protokolle bleiben erhalten."
      : "Umkehrbar – Anmeldung und laufende Sitzungen sind gesperrt, bis Sie „Reaktivieren“ wählen.";

  return (
    <Modal
      open={!!daten}
      onClose={schliessen}
      size="sm"
      icon={nachtraeglich ? <ArrowRightLeft className="size-5" /> : entfernen ? <Trash2 className="size-5" /> : <PowerOff className="size-5" />}
      title={titel}
      subtitle={unter}
      footer={
        <>
          <Button variant="ghost" onClick={schliessen}>
            Abbrechen
          </Button>
          <Button variant={entfernen ? "danger" : "primary"} loading={laedt} disabled={!!sperrgrund} aria-describedby={sperrgrund ? grundId : undefined} onClick={() => void ausfuehren()}>
            {nachtraeglich ? "Übertragen" : entfernen ? "Zugang entfernen" : "Deaktivieren"}
          </Button>
          {sperrgrund && (
            <p id={grundId} className="basis-full text-right text-[13px] leading-snug text-fg-3">
              {sperrgrund}
            </p>
          )}
        </>
      }
    >
      {u && (
        <div className="grid gap-3.5">
          <div className={cn("grid gap-2", sachAkten.length > 0 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2")}>
            <div className="rounded-lg bg-[var(--ink-softer)] p-3 ring-1 ring-[var(--line)]">
              <div className="num text-[22px] font-semibold">{bearbAkten.length}</div>
              <div className="text-[13px] text-fg-3">offene Akten (Bearbeitung)</div>
            </div>
            {sachAkten.length > 0 && (
              <div className="rounded-lg bg-[var(--ink-softer)] p-3 ring-1 ring-[var(--line)]">
                <div className="num text-[22px] font-semibold">{sachAkten.length}</div>
                <div className="text-[13px] text-fg-3">offene Akten (Sachbearbeitung)</div>
              </div>
            )}
            <div className={cn("rounded-lg p-3 ring-1 ring-[var(--line)]", anzFristen ? "bg-amber-soft" : "bg-[var(--ink-softer)]")}>
              <div className="num text-[22px] font-semibold">{anzFristen}</div>
              <div className="text-[13px] text-fg-3">offene Fristen (verantwortlich)</div>
              {weitere > 0 && verantwortung && (
                <div className="mt-0.5 text-[13px] text-fg-3">dazu {verantwortungText({ ...verantwortung, fristen: [] })}</div>
              )}
            </div>
          </div>
          {bearbUndFristen && (
            <Field
              label={pflicht || nachtraeglich ? "Bearbeitung und Fristverantwortung übertragen an … (Pflicht)" : "Bearbeitung und Fristverantwortung übertragen an …"}
              htmlFor="folgen-ziel"
              hint={
                entfernen && pflicht
                  ? "Beim Entfernen Pflicht – ein entfernter Zugang kann keine Fristen behalten. Sollen sie beim Zugang bleiben, wählen Sie „Deaktivieren“. Nur Partner und Anwälte."
                  : "Nur Partner und Anwälte. Jede Akte erhält im Verlauf den Eintrag „Bearbeitung von … an … übergeben“."
              }
            >
              <Select id="folgen-ziel" value={ziel} aria-required={pflicht || nachtraeglich || undefined} onChange={(e) => {
                setZiel(e.target.value);
                setBestaetigt(false);
              }}>
                {pflicht || nachtraeglich ? (
                  <option value="" disabled>
                    Bitte wählen …
                  </option>
                ) : (
                  <option value="">nicht übertragen</option>
                )}
                {kandidaten.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} · {rollenLabel(x)}
                    {istAbwesend(x, today()) ? " · abwesend" : ""}
                  </option>
                ))}
                {pflicht && !nachtraeglich && !entfernen && <option value={NICHT_UEBERTRAGEN}>Nicht übertragen – ich stelle die Überwachung selbst sicher</option>}
              </Select>
            </Field>
          )}
          {pflicht && ohneUebertragung && (
            <label htmlFor="folgen-bestaetigt" className="flex items-start gap-2.5 rounded-md bg-amber-soft px-3 py-2.5 text-[13px] leading-snug text-fg">
              <input id="folgen-bestaetigt" type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--seal)]" checked={bestaetigt} onChange={(e) => setBestaetigt(e.target.checked)} />
              <span>
                Ich stelle sicher, dass {anzFristen === 1 ? "die offene Frist" : `die ${anzFristen} offenen Fristen`} von {u.name} überwacht {anzFristen === 1 ? "wird" : "werden"}.
                <span className="mt-0.5 block text-[13px] text-fg-2">Die Fristen bleiben beim deaktivierten Zugang; das Cockpit weist darauf hin, bis sie übertragen sind. Der Vorgang wird mit Ihrem Namen protokolliert.</span>
              </span>
            </label>
          )}
          {sachAkten.length > 0 && (
            <Field label="Sachbearbeitung übertragen an …" htmlFor="folgen-sb" hint="Die Sachbearbeitung können auch Fachangestellte übernehmen.">
              <Select id="folgen-sb" value={sbZiel} onChange={(e) => setSbZiel(e.target.value)}>
                <option value="">nicht übertragen</option>
                {sbKandidaten.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} · {rollenLabel(x)}
                    {istAbwesend(x, today()) ? " · abwesend" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {fehler && (
            <div role="alert" className="rounded-md bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal">
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
              <Select id="inv-rolle" value={rolle} onChange={(e) => setRolle(e.target.value as Rolle)} aria-describedby="inv-rolle-folgen">
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
          <p id="inv-rolle-folgen" aria-live="polite" className="flex gap-2 rounded-md bg-[var(--ink-softer)] px-3.5 py-2.5 text-[13px] text-fg-2">
            <Info className="mt-0.5 size-3.5 shrink-0 text-ink" />
            <span className="min-w-0">
              {rollenFolgen(rolle)}
              {rolle === "azubi" && " Im Posteingang: lesen, zuordnen, Notizen."}
              {(rolle === "refa" || rolle === "azubi" || rolle === "admin") && " Vertretung nach § 53 BRAO, Aktenbearbeitung und Fristverantwortung übernehmen nur Partner und Anwälte."}
            </span>
          </p>
          {voll && <div className="rounded-md bg-amber-soft px-3.5 py-2.5 text-[13px] text-fg-2">Alle Arbeitsplätze sind belegt. Weitere Arbeitsplätze erhalten Sie über {tenant.ansprechpartner.name}.</div>}
          {fehler && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert" className="rounded-md bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal">
              {fehler}
            </motion.div>
          )}
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      )}
    </Modal>
  );
}
