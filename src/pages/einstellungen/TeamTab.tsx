import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, KeyRound, Minus, MoreHorizontal, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import type { Rolle, User } from "@/core/types";
import { getBackend, istConsole } from "@/lib/backend";
import { useData } from "@/store/data";
import { useKanzlei, useSession } from "@/store/session";
import { toast } from "@/store/ui";
import { Avatar, Button, Chip, Field, Input, Menu, Modal, Select, confirmDialog } from "@/components/ui";
import { CopyButton } from "@/pages/hilfe/kopieren";
import { cn } from "@/lib/cn";
import { Abschnitt, ROLLEN_LABEL } from "./teile";

const TITEL_VORSCHLAG: Record<Rolle, string> = {
  partner: "Rechtsanwältin / Rechtsanwalt · Partner",
  anwalt: "Rechtsanwältin / Rechtsanwalt",
  refa: "Rechtsanwaltsfachangestellte/r",
  admin: "Kanzleiverwaltung",
};

const RECHTE: { bereich: string; r: Record<Rolle, boolean> }[] = [
  { bereich: "Akten, Fristen & Kontakte", r: { partner: true, anwalt: true, refa: true, admin: false } },
  { bereich: "Posteingang, beA & eEB", r: { partner: true, anwalt: true, refa: true, admin: false } },
  { bereich: "Abrechnung & Aktenkonten", r: { partner: true, anwalt: true, refa: true, admin: false } },
  { bereich: "Team & Zugänge", r: { partner: true, anwalt: false, refa: false, admin: true } },
  { bereich: "Lizenz, KI & Datenschutz", r: { partner: true, anwalt: false, refa: false, admin: true } },
];

function aktualisiereTeam(fn: (team: User[]) => User[]) {
  const s = useSession.getState().sitzung;
  if (s && !istConsole(s)) useSession.getState().setSitzung({ ...s, team: fn(s.team) });
}

export function TeamTab() {
  const { team, user, tenant } = useKanzlei();
  const [einladen, setEinladen] = useState(false);
  const plaetze = tenant.lizenz.arbeitsplaetze;
  const voll = team.length >= plaetze;
  const sortiert = [...team].sort((a, b) => ["partner", "anwalt", "refa", "admin"].indexOf(a.rolle) - ["partner", "anwalt", "refa", "admin"].indexOf(b.rolle));

  const entfernen = async (u: User) => {
    const ok = await confirmDialog({ titel: `Zugang von ${u.name} entfernen?`, text: "Die Person kann sich danach nicht mehr anmelden. Akten, Fristen und Protokolle bleiben unverändert erhalten.", bestaetigen: "Zugang entfernen", gefahr: true });
    if (!ok) return;
    try {
      await getBackend().team.remove(u.id);
      aktualisiereTeam((t) => t.filter((x) => x.id !== u.id));
      useData.getState().log({ akteur: "nutzer", userId: user.id, text: `Zugang von ${u.name} entfernt` });
      toast("Zugang entfernt", { text: u.name, ton: "info" });
    } catch (e) {
      toast("Entfernen nicht möglich", { text: e instanceof Error ? e.message : "Bitte erneut versuchen.", ton: "fehler" });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Abschnitt
        titel="Team & Zugänge"
        text="Jede Person meldet sich mit eigenem Zugang an – Rechte folgen der Rolle."
        icon={<Users className="size-[18px]" />}
        aktion={
          <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setEinladen(true)}>
            Person einladen
          </Button>
        }
      >
        <div className="mb-4">
          <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
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
                  <div className="flex items-center gap-3 px-3.5 py-3">
                    <Avatar initialen={u.initialen} farbe={u.farbe} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-[13.5px] font-semibold">{u.name}</span>
                        {ich && <Chip tone="ink">Sie</Chip>}
                      </div>
                      <div className="truncate text-[12px] text-fg-3">{u.titel}</div>
                      <div className="truncate text-[12px] text-fg-4">{u.email}</div>
                    </div>
                    <Chip tone={u.rolle === "partner" ? "ink" : "outline"} className="hidden sm:inline-flex">
                      {ROLLEN_LABEL[u.rolle]}
                    </Chip>
                    {!ich && u.rolle !== "partner" ? (
                      <Menu
                        trigger={({ toggle }) => (
                          <button type="button" className="icon-btn !size-8" aria-label={`Aktionen für ${u.name}`} onClick={toggle}>
                            <MoreHorizontal className="size-4" />
                          </button>
                        )}
                        items={[{ label: "Zugang entfernen", icon: <Trash2 />, danger: true, onClick: () => void entfernen(u) }]}
                      />
                    ) : (
                      <span className="size-8 shrink-0" />
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
        {voll && <p className="mt-3 text-[12.5px] text-amber">Alle Arbeitsplätze sind belegt. Weitere Arbeitsplätze erhalten Sie über Ihren Ansprechpartner {tenant.ansprechpartner.name}.</p>}
      </Abschnitt>

      <Abschnitt titel="Rollen & Rechte" text="Übersicht der Standardrechte je Rolle." icon={<ShieldCheck className="size-[18px]" />}>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[300px] text-[12.5px]">
            <thead>
              <tr className="text-fg-3">
                <th className="px-1 pb-2 text-left font-medium">Bereich</th>
                {(["partner", "anwalt", "refa", "admin"] as Rolle[]).map((r) => (
                  <th key={r} className="px-1 pb-2 text-center font-medium">
                    {{ partner: "Partner", anwalt: "Anwalt", refa: "ReFa", admin: "Admin" }[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RECHTE.map((z) => (
                <tr key={z.bereich} className="border-t border-[var(--line)]">
                  <td className="px-1 py-2.5 text-fg-2">{z.bereich}</td>
                  {(["partner", "anwalt", "refa", "admin"] as Rolle[]).map((r) => (
                    <td key={r} className="px-1 py-2.5 text-center">
                      {z.r[r] ? <Check className="mx-auto size-4 text-green" aria-label="ja" /> : <Minus className="mx-auto size-4 text-fg-4" aria-label="nein" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] text-fg-3">Zugriffe werden serverseitig geprüft – nicht nur in der Oberfläche. Einzelne Akten lassen sich zusätzlich beschränken.</p>
      </Abschnitt>

      <EinladenModal open={einladen} onClose={() => setEinladen(false)} voll={voll} />
    </div>
  );
}

function EinladenModal({ open, onClose, voll }: { open: boolean; onClose: () => void; voll: boolean }) {
  const { user, tenant } = useKanzlei();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rolle, setRolle] = useState<Rolle>("anwalt");
  const [titel, setTitel] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<{ user: User; passwort: string } | null>(null);

  const reset = () => {
    setName("");
    setEmail("");
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
      const r = await getBackend().team.add({ name: name.trim(), email: email.trim(), rolle, titel: titel.trim() || TITEL_VORSCHLAG[rolle] });
      aktualisiereTeam((t) => [...t.filter((x) => x.id !== r.user.id), r.user]);
      useData.getState().log({ akteur: "nutzer", userId: user.id, text: `Zugang für ${r.user.name} angelegt (${ROLLEN_LABEL[rolle]})` });
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
              <div className="truncate text-[12.5px] text-fg-3">
                {ROLLEN_LABEL[ergebnis.user.rolle]} · {ergebnis.user.email}
              </div>
            </div>
          </div>
          <div className="rounded-[18px] bg-[radial-gradient(120%_140%_at_0%_0%,var(--ink-soft),transparent_70%)] p-4 ring-2 ring-[var(--ink)]">
            <div className="text-[12px] font-medium text-fg-3">Startpasswort</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="mono min-w-0 flex-1 select-all break-all text-[22px] font-semibold tracking-[0.02em]">{ergebnis.passwort}</span>
              <CopyButton text={ergebnis.passwort} label="Startpasswort kopieren" toastTitel="Startpasswort kopiert" />
            </div>
          </div>
          <ul className="grid grid-cols-1 gap-1.5 text-[12.5px] text-fg-2">
            <li className="flex gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-green" /> Das Passwort muss bei der ersten Anmeldung geändert werden.
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-green" /> Bitte persönlich oder über einen sicheren Weg weitergeben – nicht per unverschlüsselter E-Mail.
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-green" /> Es wird nur jetzt angezeigt. Bei Verlust vergibt die Kanzleiverwaltung ein neues.
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
          <Field label="Vor- und Nachname" htmlFor="inv-name">
            <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Anna Schulz" autoComplete="off" />
          </Field>
          <Field label="E-Mail-Adresse" htmlFor="inv-email" hint="Damit meldet sich die Person an.">
            <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="anna.schulz@kanzlei.de" autoComplete="off" />
          </Field>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Rolle" htmlFor="inv-rolle">
              <Select id="inv-rolle" value={rolle} onChange={(e) => setRolle(e.target.value as Rolle)}>
                <option value="partner">Partner/in</option>
                <option value="anwalt">Anwalt/Anwältin</option>
                <option value="refa">ReFa</option>
                <option value="admin">Administration</option>
              </Select>
            </Field>
            <Field label="Titel / Berufsbezeichnung" htmlFor="inv-titel">
              <Input id="inv-titel" value={titel} onChange={(e) => setTitel(e.target.value)} placeholder={TITEL_VORSCHLAG[rolle]} />
            </Field>
          </div>
          {voll && <div className="rounded-[12px] bg-amber-soft px-3.5 py-2.5 text-[13px] text-fg-2">Alle Arbeitsplätze sind belegt. Weitere Arbeitsplätze erhalten Sie über Ihren Ansprechpartner.</div>}
          {fehler && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert" className={cn("rounded-[12px] bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal")}>
              {fehler}
            </motion.div>
          )}
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      )}
    </Modal>
  );
}
