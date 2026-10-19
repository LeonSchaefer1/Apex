import { useState } from "react";
import { motion } from "motion/react";
import { AlarmClock, AlertTriangle, BookOpen, Check, Clock, Mail, MonitorUp, Phone, PhoneCall, ShieldCheck, Timer } from "lucide-react";
import type { Ansprechpartner } from "@/core/types";
import { useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast, useUI } from "@/store/ui";
import { Avatar, Button, Card, Chip, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { festeAnsprechBezeichnung } from "@/lib/rollen";
import { RUECKRUF_SIMULIERT, inServicezeit, naechsteServicezeit, rueckrufNachFristende, rueckrufRegel, rueckrufZusage } from "@/core/rueckruf";
import { telHref } from "@/lib/telefon";
import { fmtDateWd } from "@/core/dates";
import { cn } from "@/lib/cn";
import { CopyButton } from "./kopieren";
import { BEWEGUNG } from "@/lib/bewegung";

const THEMEN = ["Umzug & Datenübernahme", "Fristen & beA", "Abrechnung & RVG", "Schnittstellen (E-Mail, Bank)", "Team & Zugänge", "Etwas anderes"];
/** „sofort“ = jetzt + 30 Min. in der Servicezeit · „naechste“ = nächstmögliche Zeit außerhalb der Servicezeit · „wunschzeit“ */
type Wunsch = "sofort" | "naechste" | "wunschzeit";

/** Fester, direkter Ansprechpartner statt Hotline-Warteschleife. */
export function AnsprechpartnerKarte({ ap, className }: { ap: Ansprechpartner; className?: string }) {
  const { tenant } = useKanzlei();
  const [rueckruf, setRueckruf] = useState(false);
  const [fernwartung, setFernwartung] = useState(false);
  const vorname = ap.name.split(" ")[0];
  const jetzt = new Date();
  const erreichbar = inServicezeit(jetzt, ap.verfuegbar, tenant.bundesland);
  const naechste = naechsteServicezeit(jetzt, ap.verfuegbar, tenant.bundesland);

  return (
    <Card padded={false} className={className}>
      <div className="relative overflow-hidden rounded-lg p-5 md:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[radial-gradient(circle,var(--ink-soft),transparent_65%)]" />
        <div className="relative flex flex-wrap items-start gap-4">
          <div className="relative shrink-0">
            <Avatar initialen={ap.initialen} size={68} />
            <span className="absolute bottom-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-[var(--surface)]">
              <span className="relative flex size-2.5">
                {erreichbar && <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--green)] opacity-60 [animation-duration:2.2s]" />}
                <span className={cn("relative inline-flex size-2.5 rounded-full", erreichbar ? "bg-[var(--green)]" : "bg-[var(--fg-4)]")} />
              </span>
            </span>
          </div>
          <div className="min-w-0 flex-1 basis-[220px]">
            <div className="eyebrow">Ihr direkter Draht</div>
            <h2 className="title-lg mt-1">{ap.name}</h2>
            <div className="text-[13px] text-fg-3">{festeAnsprechBezeichnung(ap)}</div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {erreichbar ? (
                <Chip tone="green" dot>
                  Erreichbar · {ap.verfuegbar}
                </Chip>
              ) : (
                // bricht am Smartphone um statt abgeschnitten zu werden (I3-T12-03)
                <Chip tone="amber" icon={<Clock className="size-3 shrink-0" />} title={`Servicezeit ${ap.verfuegbar}`} className="!h-auto max-w-full !whitespace-normal py-1 text-left leading-snug">
                  Jetzt nicht erreichbar · wieder {naechste.text}
                </Chip>
              )}
              {/* Antwortzeit nur in der Servicezeit – nachts oder am Wochenende gibt es „heute“ keine (I3-T12-05) */}
              {erreichbar && (
                <Chip tone="ink" icon={<Timer className="size-3" />} title="Beispielwert – im Prototyp simuliert">
                  Ø Antwortzeit heute: 4 Min. (Beispiel)
                </Chip>
              )}
            </div>
          </div>
        </div>

        <div className="relative mt-5 grid gap-2 sm:grid-cols-2">
          <KontaktZeile icon={<Phone className="size-4" />} label="Telefon (Durchwahl)" wert={ap.telefon} href={telHref(ap.telefon)} />
          <KontaktZeile icon={<Mail className="size-4" />} label="E-Mail" wert={ap.email} />
        </div>

        <div className="relative mt-5 flex flex-wrap gap-2">
          <Button variant="primary" icon={<PhoneCall className="size-4" />} onClick={() => setRueckruf(true)}>
            Rückruf anfordern
          </Button>
          <Button icon={<MonitorUp className="size-4" />} onClick={() => setFernwartung(true)}>
            Bildschirm teilen
          </Button>
        </div>

        <div className="relative mt-6 rounded-lg bg-[var(--surface-2)] p-4 ring-1 ring-[var(--line)]">
          <div className="mb-3 text-[13px] font-semibold">Statt Warteschleife und Ticket-Sackgasse: {vorname} kennt Ihre Kanzlei.</div>
          <Vergleich label="Telefon-Warteschleife klassischer Kanzleisoftware" wert="45–60 Min." anteil={1} ton="neutral" />
          <Vergleich label={`${ap.name} (Ø in der Servicezeit)`} wert="4 Min." anteil={4 / 60} ton="green" />
          <p className="mt-2.5 text-[13px] leading-snug text-fg-3">Wartezeiten klassischer Telefon-Warteschleifen laut Bewertungen von Kanzleien; die Antwortzeit hier ist ein Beispielwert. Servicezeit {ap.verfuegbar}. {rueckrufRegel(ap.verfuegbar)}</p>
        </div>
      </div>

      <RueckrufModal open={rueckruf} onClose={() => setRueckruf(false)} ap={ap} />
      <FernwartungModal open={fernwartung} onClose={() => setFernwartung(false)} ap={ap} />
    </Card>
  );
}

function KontaktZeile({ icon, label, wert, href }: { icon: React.ReactNode; label: string; wert: string; href?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg bg-[var(--ink-softer)] py-2 pl-3 pr-1.5">
      <span className="text-ink">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-fg-3">{label}</span>
        {href ? (
          // Am Smartphone antippen = anrufen (tel:), „Kopieren“ bleibt daneben (I3-T12-01)
          <a href={href} className="inline-flex min-h-[32px] max-w-full items-center truncate pointer-coarse:min-h-11 text-[14px] font-semibold text-ink underline decoration-[var(--ink-soft)] underline-offset-2 hover:decoration-ink" aria-label={`${wert} anrufen`}>
            {wert}
          </a>
        ) : (
          <span className="block select-all truncate text-[14px] font-medium">{wert}</span>
        )}
      </span>
      <CopyButton text={wert} label={`${label} kopieren`} />
    </div>
  );
}

function Vergleich({ label, wert, anteil, ton }: { label: string; wert: string; anteil: number; ton: "neutral" | "green" }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
        <span className="truncate text-fg-3">{label}</span>
        <span className="num shrink-0 font-semibold text-fg">{wert}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
        <motion.div
          className={ton === "green" ? "h-full rounded-full bg-[var(--green)]" : "h-full rounded-full bg-[var(--fg-4)]"}
          initial={{ width: 0 }}
          whileInView={{ width: `${Math.max(3, anteil * 100)}%` }}
          viewport={{ once: true }}
          transition={BEWEGUNG.standard}
        />
      </div>
    </div>
  );
}

function RueckrufModal({ open, onClose, ap }: { open: boolean; onClose: () => void; ap: Ansprechpartner }) {
  const { user, tenant } = useKanzlei();
  const jetzt = new Date();
  const imDienst = inServicezeit(jetzt, ap.verfuegbar, tenant.bundesland);
  const [thema, setThema] = useState("");
  const [themaFehler, setThemaFehler] = useState(false);
  const [wunschWahl, setWunsch] = useState<Wunsch | null>(null);
  // Außerhalb der Servicezeit ist „Sofort“ nicht möglich – vorausgewählt ist dann die nächste mögliche Zeit.
  const wunsch: Wunsch = wunschWahl === "sofort" && !imDienst ? "naechste" : wunschWahl === "naechste" && imDienst ? "sofort" : (wunschWahl ?? (imDienst ? "sofort" : "naechste"));
  const [wunschzeit, setWunschzeit] = useState("");
  const [dringend, setDringend] = useState(false);
  const [nummer, setNummer] = useState("");
  const [anliegen, setAnliegen] = useState("");
  const [zusage, setZusage] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  // Verbindliche Zusage mit Uhrzeit: jetzt + 30 Min. in der Servicezeit, sonst nächster Werktag 8:30 Uhr
  const zusageJetzt = rueckrufZusage(jetzt, ap.verfuegbar, tenant.bundesland);
  const jetztZusage = zusageJetzt.text;
  const gesendet = zusage !== null;
  // Frist läuft heute ab, Rückruf kommt erst nach 24 Uhr (bzw. zur Wunschzeit): nicht warten, sondern ersatzweise einreichen.
  const nachFristende = dringend && (wunsch === "wunschzeit" || rueckrufNachFristende(zusageJetzt, jetzt));
  const vorname = ap.name.split(" ")[0];
  const zeigeStoerung = () => useUI.getState().zeigeHilfe("bea-stoerung");

  const schliessen = () => {
    onClose();
    setTimeout(() => {
      setZusage(null);
      setThema("");
      setThemaFehler(false);
      setWunsch(null);
      setWunschzeit("");
      setDringend(false);
      setAnliegen("");
      setFehler(null);
    }, 300);
  };

  const senden = () => {
    if (!thema) {
      setFehler(null);
      setThemaFehler(true);
      document.getElementById("rr-thema")?.focus();
      return;
    }
    if (wunsch === "wunschzeit" && !wunschzeit.trim()) return setFehler("Bitte nennen Sie Ihre Wunschzeit, z. B. „morgen ab 14 Uhr“ – oder wählen Sie „So bald wie möglich“.");
    if (nummer.trim() && !/^[+\d][\d\s/()-]{5,}$/.test(nummer.trim())) {
      setFehler("Bitte geben Sie eine Telefonnummer mit Ziffern an, z. B. +49 30 1234567 – oder lassen Sie das Feld leer.");
      return;
    }
    setFehler(null);
    const text = wunsch === "wunschzeit" ? `Rückruf zu Ihrer Wunschzeit: ${wunschzeit.trim()}` : jetztZusage;
    const prio = dringend ? " · Priorität: dringend (Frist läuft heute ab)" : "";
    useData.getState().log({ akteur: "nutzer", userId: user.id, text: `Rückruf angefordert bei ${ap.name}: ${thema} – ${text}${prio}` });
    setZusage(text);
    toast("Rückrufwunsch vorgemerkt", { text: `${text}${dringend ? " · dringend" : ""} ${RUECKRUF_SIMULIERT}`, ton: "erfolg" });
  };

  return (
    <Modal
      open={open}
      onClose={schliessen}
      title={gesendet ? "Rückruf ist vorgemerkt" : `Rückruf von ${ap.name}`}
      subtitle={gesendet ? undefined : `Kein Ticket, keine Warteschleife – Ihr Wunsch geht direkt an ${ap.name}.`}
      icon={<PhoneCall className="size-5" />}
      size="sm"
      footer={
        gesendet ? (
          <Button variant="primary" onClick={schliessen}>
            Fertig
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={schliessen}>
              Abbrechen
            </Button>
            <Button variant="primary" icon={<PhoneCall className="size-4" />} onClick={senden}>
              Rückruf anfordern
            </Button>
          </>
        )
      }
    >
      {gesendet ? (
        <div className="flex flex-col items-center py-4 text-center">
          <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={BEWEGUNG.standard} className="mb-3 grid size-14 place-items-center rounded-full bg-green-soft text-green">
            <Check className="size-7" strokeWidth={2.6} />
          </motion.div>
          <p className="text-[15px] font-semibold text-fg">{zusage}</p>
          <p className="mt-1 text-[14px] text-fg-2">
            {ap.name} ruft Sie an{nummer.trim() ? ` unter ${nummer.trim()}` : ""}.
          </p>
          <p className="mt-1 text-[13px] text-fg-3">
            Thema: {thema}
            {dringend && " · Priorität: dringend (Frist läuft heute ab)"}
          </p>
          {nachFristende && <ErsatzeinreichungHinweis datum={wunsch === "wunschzeit" ? undefined : zusageJetzt.datum} onWissen={zeigeStoerung} className="mt-4 text-left" />}
          <p className="mt-4 rounded-md bg-amber-soft px-3 py-2 text-[13px] text-fg-2">{RUECKRUF_SIMULIERT.replace(/^\(|\)$/g, "").replace(/^i/, "I")}. Der Wunsch steht im Aktivitätsprotokoll.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          <div className="flex items-start gap-2.5 rounded-lg bg-green-soft px-3.5 py-2.5 text-[13px] text-fg-2">
            <Clock className="mt-0.5 size-4 shrink-0 text-green" />
            <span>
              <strong className="text-fg">Zusage: {jetztZusage}</strong>
              {zusageJetzt.ausserhalb && <span className="block text-[13px] text-fg-2">{rueckrufRegel(ap.verfuegbar)}</span>}
              <span className="block text-[13px] text-fg-3">{RUECKRUF_SIMULIERT}</span>
            </span>
          </div>
          <Field label="Worum geht es? (Pflicht)" htmlFor="rr-thema">
            <Select
              id="rr-thema"
              value={thema}
              onChange={(e) => {
                setThema(e.target.value);
                if (e.target.value) setThemaFehler(false);
              }}
              aria-required="true"
              aria-invalid={themaFehler || undefined}
              aria-describedby={themaFehler ? "rr-thema-fehler" : undefined}
              className={cn(themaFehler && "!ring-2 !ring-[var(--seal)]")}
            >
              <option value="">Bitte wählen …</option>
              {THEMEN.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            {themaFehler && (
              <p id="rr-thema-fehler" role="alert" className="mt-1.5 flex items-start gap-1.5 text-[13px] font-medium text-seal">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                Bitte wählen Sie ein Thema – so kann sich {vorname} auf den Rückruf vorbereiten.
              </p>
            )}
          </Field>
          <label htmlFor="rr-dringend" className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 text-[14px] text-fg-2">
            <input id="rr-dringend" type="checkbox" checked={dringend} onChange={(e) => setDringend(e.target.checked)} className="size-4 accent-[var(--seal)]" />
            <AlarmClock className="size-4 text-seal" />
            Frist läuft heute ab – bitte vorrangig
          </label>
          {dringend &&
            (nachFristende ? (
              <ErsatzeinreichungHinweis datum={wunsch === "wunschzeit" ? undefined : zusageJetzt.datum} onWissen={zeigeStoerung} />
            ) : (
              <p className="flex items-start gap-2 rounded-md bg-[var(--ink-softer)] px-3 py-2 text-[13px] text-fg-2">
                <BookOpen className="mt-0.5 size-3.5 shrink-0 text-ink" />
                <span>
                  Ist das beA gestört? Was Sie bis zum Fristablauf tun können:{" "}
                  <button type="button" onClick={zeigeStoerung} className="font-semibold text-ink underline underline-offset-2">
                    Wissenskarte „beA-Störung – was tun?“
                  </button>
                </span>
              </p>
            ))}
          <fieldset className="min-w-0">
            <legend className="label">Wann passt es Ihnen?</legend>
            <div className="grid gap-1.5">
              <WunschOption
                id="rr-sofort"
                checked={wunsch === "sofort"}
                disabled={!imDienst}
                onChange={() => setWunsch("sofort")}
                titel="Sofort"
                text={imDienst ? jetztZusage : `nicht möglich – außerhalb der Servicezeit ${ap.verfuegbar}`}
              />
              {!imDienst && <WunschOption id="rr-naechste" checked={wunsch === "naechste"} onChange={() => setWunsch("naechste")} titel="Nächste mögliche Zeit" text={jetztZusage} />}
              <WunschOption id="rr-wunsch" checked={wunsch === "wunschzeit"} onChange={() => setWunsch("wunschzeit")} titel="Wunschzeit" text="Sie nennen eine Zeit innerhalb der Servicezeit." />
            </div>
          </fieldset>
          {wunsch === "wunschzeit" && (
            <Field label="Ihre Wunschzeit" htmlFor="rr-zeit">
              <Input id="rr-zeit" placeholder="z. B. morgen ab 14 Uhr" value={wunschzeit} onChange={(e) => setWunschzeit(e.target.value)} />
            </Field>
          )}
          <Field label="Rückrufnummer (optional)" htmlFor="rr-nummer" hint="Leer lassen, wenn die Nummer in Ihrem Profil stimmt.">
            <Input id="rr-nummer" inputMode="tel" placeholder="+49 30 …" value={nummer} onChange={(e) => setNummer(e.target.value)} />
          </Field>
          <Field label="Kurz beschrieben (optional)" htmlFor="rr-anliegen">
            <Textarea id="rr-anliegen" rows={3} placeholder="z. B. Fristen aus dem Umzug gemeinsam prüfen" value={anliegen} onChange={(e) => setAnliegen(e.target.value)} />
          </Field>
          {fehler && (
            <div role="alert" className="rounded-md bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal">
              {fehler}
            </div>
          )}
          <div className="flex items-center gap-2 text-[13px] text-fg-3">
            <Clock className="size-3.5" /> Servicezeit: {ap.verfuegbar}
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Auswahl „Wann passt es Ihnen?“ – echte Optionsfelder, damit „Sofort“ mit Grund deaktiviert sein kann. */
function WunschOption({ id, checked, disabled, onChange, titel, text }: { id: string; checked: boolean; disabled?: boolean; onChange: () => void; titel: string; text: string }) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-2.5 rounded-md px-3 py-2 ring-1 transition-colors",
        disabled ? "cursor-not-allowed bg-[var(--surface-2)] ring-[var(--line)]" : "cursor-pointer ring-[var(--line)] hover:ring-[var(--line-strong)]",
        checked && "bg-ink-soft ring-[var(--ink)]",
      )}
    >
      <input id={id} type="radio" name="rr-wann" checked={checked} disabled={disabled} onChange={onChange} className="mt-0.5 size-4 accent-[var(--ink)]" aria-describedby={`${id}-text`} />
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-fg">{titel}</span>
        <span id={`${id}-text`} className="block text-[13px] text-fg-2">
          {text}
        </span>
      </span>
    </label>
  );
}

/**
 * Hinweis, wenn der Rückruf erst nach Fristablauf kommt: nicht warten, sondern nach den allgemeinen Vorschriften einreichen.
 * Bewusst ohne Notfallnummer – eine Erreichbarkeit außerhalb der Servicezeit sagt nur der Auftraggeber zu.
 */
function ErsatzeinreichungHinweis({ datum, onWissen, className }: { datum?: string; onWissen: () => void; className?: string }) {
  return (
    <div role="note" className={cn("flex items-start gap-2.5 rounded-lg border border-[color-mix(in_oklab,var(--seal)_45%,transparent)] bg-seal-soft px-3.5 py-3 text-[13px] text-fg", className)}>
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-seal" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold">Warten Sie nicht auf den Rückruf – {datum ? `er kommt erst am ${fmtDateWd(datum)}.` : "er kommt womöglich erst nach Fristablauf."}</p>
        <p className="mt-1 leading-relaxed text-fg-2">
          Ist das beA gestört, reichen Sie nach den allgemeinen Vorschriften ein (Ersatzeinreichung, § 130d S. 2, 3 ZPO; vor den Arbeitsgerichten § 46g S. 3, 4 ArbGG) und machen Sie die Störung glaubhaft.
        </p>
        <button type="button" onClick={onWissen} className="mt-1.5 inline-flex items-center gap-1.5 font-semibold text-ink underline underline-offset-2">
          <BookOpen className="size-3.5" /> Wissenskarte „beA-Störung – was tun?“
        </button>
      </div>
    </div>
  );
}

function FernwartungModal({ open, onClose, ap }: { open: boolean; onClose: () => void; ap: Ansprechpartner }) {
  const code = "482 913";
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bildschirm teilen"
      subtitle="Fernwartung ohne Installation und ohne Admin-Rechte – direkt im Browser."
      icon={<MonitorUp className="size-5" />}
      size="sm"
      footer={
        <Button variant="primary" onClick={onClose}>
          Verstanden
        </Button>
      }
    >
      <ol className="grid grid-cols-1 gap-3">
        {[
          { t: "Sitzungscode nennen", s: `Sie lesen ${ap.name} den Code vor – am Telefon oder per E-Mail.` },
          { t: "Freigabe bestätigen", s: "Ihr Browser fragt, welches Fenster Sie teilen. Sie sehen jederzeit, was geteilt wird." },
          { t: "Jederzeit beenden", s: "Ein Klick auf „Freigabe beenden“ – die Verbindung ist sofort getrennt." },
        ].map((x, i) => (
          <motion.li key={x.t} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={BEWEGUNG.standard} className="flex gap-3">
            <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-ink-soft text-[12px] font-semibold text-ink">{i + 1}</span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold">{x.t}</span>
              <span className="block text-[13px] text-fg-3">{x.s}</span>
            </span>
          </motion.li>
        ))}
      </ol>
      <div className="mt-5 flex items-center gap-3 rounded-lg bg-[var(--ink-softer)] p-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] text-fg-3">Ihr Sitzungscode (Beispiel)</div>
          <div className="mono select-all text-[24px] font-semibold">{code}</div>
        </div>
        <CopyButton text={code.replace(/\s/g, "")} label="Sitzungscode kopieren" />
      </div>
      <p className="mt-3 flex gap-2 text-[13px] text-fg-3">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-green" />
        Keine Software-Installation, keine lokalen Administratorrechte, kein dauerhafter Zugang. Im Demo-Betrieb wird keine Verbindung aufgebaut.
      </p>
    </Modal>
  );
}
