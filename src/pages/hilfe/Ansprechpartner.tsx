import { useState } from "react";
import { motion } from "motion/react";
import { Check, Clock, Mail, MonitorUp, Phone, PhoneCall, ShieldCheck, Timer } from "lucide-react";
import type { Ansprechpartner } from "@/core/types";
import { useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Avatar, Button, Card, Chip, Field, Input, Modal, Segmented, Select, Textarea } from "@/components/ui";
import { CopyButton } from "./kopieren";

const THEMEN = ["Umzug & Datenübernahme", "Fristen & beA", "Abrechnung & RVG", "Schnittstellen (E-Mail, Bank)", "Team & Zugänge", "Etwas anderes"];
type Wunsch = "sofort" | "nachmittag" | "morgen";
const spaet = () => new Date().getHours() >= 16;
const WUNSCH_TEXT: Record<Wunsch, string> = {
  sofort: "so bald wie möglich",
  get nachmittag() {
    return spaet() ? "morgen zwischen 14 und 17 Uhr" : "heute zwischen 14 und 17 Uhr";
  },
  morgen: "morgen Vormittag",
};

/** Fester, direkter Ansprechpartner statt Hotline-Warteschleife. */
export function AnsprechpartnerKarte({ ap, className }: { ap: Ansprechpartner; className?: string }) {
  const [rueckruf, setRueckruf] = useState(false);
  const [fernwartung, setFernwartung] = useState(false);
  const vorname = ap.name.split(" ")[0];

  return (
    <Card padded={false} className={className}>
      <div className="relative overflow-hidden rounded-[22px] p-5 md:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[radial-gradient(circle,var(--ink-soft),transparent_65%)]" />
        <div className="relative flex flex-wrap items-start gap-4">
          <div className="relative shrink-0">
            <Avatar initialen={ap.initialen} size={68} />
            <span className="absolute bottom-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-[var(--surface)]">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--green)] opacity-60 [animation-duration:2.2s]" />
                <span className="relative inline-flex size-2.5 rounded-full bg-[var(--green)]" />
              </span>
            </span>
          </div>
          <div className="min-w-0 flex-1 basis-[220px]">
            <div className="eyebrow">Ihr direkter Draht</div>
            <h2 className="title-lg mt-1">{ap.name}</h2>
            <div className="text-[13px] text-fg-3">{ap.rolle}</div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Chip tone="green" dot>
                Erreichbar · {ap.verfuegbar}
              </Chip>
              <Chip tone="ink" icon={<Timer className="size-3" />} title="Demo-Wert">
                Ø Antwortzeit heute: 4 Min.
              </Chip>
            </div>
          </div>
        </div>

        <div className="relative mt-5 grid gap-2 sm:grid-cols-2">
          <KontaktZeile icon={<Phone className="size-4" />} label="Telefon" wert={ap.telefon} />
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

        <div className="relative mt-6 rounded-[18px] bg-[var(--surface-2)] p-4 ring-1 ring-[var(--line)]">
          <div className="mb-3 text-[12.5px] font-semibold">Statt Warteschleife und Ticket-Sackgasse: {vorname} kennt Ihre Kanzlei.</div>
          <Vergleich label="Hotline klassischer Kanzleisoftware" wert="45–60 Min." anteil={1} ton="neutral" />
          <Vergleich label={`Ihr Ansprechpartner (Ø heute)`} wert="4 Min." anteil={4 / 60} ton="green" />
          <p className="mt-2.5 text-[11.5px] leading-snug text-fg-4">Wartezeiten klassischer Hotlines laut Bewertungen von Kanzleien; Antwortzeit hier ist ein Demo-Wert. Unser Ziel: Rückruf innerhalb von 30 Minuten.</p>
        </div>
      </div>

      <RueckrufModal open={rueckruf} onClose={() => setRueckruf(false)} ap={ap} />
      <FernwartungModal open={fernwartung} onClose={() => setFernwartung(false)} ap={ap} />
    </Card>
  );
}

function KontaktZeile({ icon, label, wert }: { icon: React.ReactNode; label: string; wert: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[14px] bg-[var(--ink-softer)] py-2 pl-3 pr-1.5">
      <span className="text-ink">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-fg-4">{label}</span>
        <span className="block select-all truncate text-[13.5px] font-medium">{wert}</span>
      </span>
      <CopyButton text={wert} label={`${label} kopieren`} />
    </div>
  );
}

function Vergleich({ label, wert, anteil, ton }: { label: string; wert: string; anteil: number; ton: "neutral" | "green" }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 flex items-baseline justify-between gap-3 text-[12px]">
        <span className="truncate text-fg-3">{label}</span>
        <span className="num shrink-0 font-semibold text-fg">{wert}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
        <motion.div
          className={ton === "green" ? "h-full rounded-full bg-[var(--green)]" : "h-full rounded-full bg-[var(--fg-4)]"}
          initial={{ width: 0 }}
          whileInView={{ width: `${Math.max(3, anteil * 100)}%` }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 140, damping: 24, delay: ton === "green" ? 0.25 : 0 }}
        />
      </div>
    </div>
  );
}

function RueckrufModal({ open, onClose, ap }: { open: boolean; onClose: () => void; ap: Ansprechpartner }) {
  const { user } = useKanzlei();
  const [thema, setThema] = useState(THEMEN[0]);
  const [wunsch, setWunsch] = useState<Wunsch>("sofort");
  const [nummer, setNummer] = useState("");
  const [anliegen, setAnliegen] = useState("");
  const [gesendet, setGesendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const schliessen = () => {
    onClose();
    setTimeout(() => {
      setGesendet(false);
      setAnliegen("");
      setFehler(null);
    }, 300);
  };

  const senden = () => {
    if (nummer.trim() && !/^[+\d][\d\s/()-]{5,}$/.test(nummer.trim())) {
      setFehler("Bitte geben Sie eine Telefonnummer mit Ziffern an, z. B. +49 30 1234567 – oder lassen Sie das Feld leer.");
      return;
    }
    useData.getState().log({ akteur: "nutzer", userId: user.id, text: `Rückruf angefordert bei ${ap.name}: ${thema} – ${WUNSCH_TEXT[wunsch]}` });
    setGesendet(true);
    toast("Rückrufwunsch übermittelt", { text: `${ap.name} ruft Sie ${WUNSCH_TEXT[wunsch]} an. (Demo: keine echte Anfrage)`, ton: "erfolg" });
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
          <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 420, damping: 20 }} className="mb-3 grid size-14 place-items-center rounded-full bg-green-soft text-green">
            <Check className="size-7" strokeWidth={2.6} />
          </motion.div>
          <p className="text-[14px] text-fg-2">
            {ap.name} ruft Sie <strong className="text-fg">{WUNSCH_TEXT[wunsch]}</strong> an{nummer.trim() ? ` unter ${nummer.trim()}` : ""}.
          </p>
          <p className="mt-1 text-[13px] text-fg-3">Thema: {thema}</p>
          <p className="mt-4 rounded-[12px] bg-amber-soft px-3 py-2 text-[12px] text-fg-2">Demo-Betrieb: Es wurde keine echte Anfrage versendet. Der Wunsch steht im Aktivitätsprotokoll.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          <Field label="Worum geht es?" htmlFor="rr-thema">
            <Select id="rr-thema" value={thema} onChange={(e) => setThema(e.target.value)}>
              {THEMEN.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Wann passt es Ihnen?">
            <Segmented<Wunsch>
              full
              size="sm"
              value={wunsch}
              onChange={setWunsch}
              options={[
                { value: "sofort", label: "Sofort" },
                { value: "nachmittag", label: spaet() ? "Morgen 14–17 Uhr" : "Heute 14–17 Uhr" },
                { value: "morgen", label: "Morgen früh" },
              ]}
            />
          </Field>
          <Field label="Rückrufnummer (optional)" htmlFor="rr-nummer" hint="Leer lassen, wenn die Nummer in Ihrem Profil stimmt.">
            <Input id="rr-nummer" inputMode="tel" placeholder="+49 30 …" value={nummer} onChange={(e) => setNummer(e.target.value)} />
          </Field>
          <Field label="Kurz beschrieben (optional)" htmlFor="rr-anliegen">
            <Textarea id="rr-anliegen" rows={3} placeholder="z. B. Fristen aus dem Umzug gemeinsam prüfen" value={anliegen} onChange={(e) => setAnliegen(e.target.value)} />
          </Field>
          {fehler && (
            <div role="alert" className="rounded-[12px] bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal">
              {fehler}
            </div>
          )}
          <div className="flex items-center gap-2 text-[12px] text-fg-3">
            <Clock className="size-3.5" /> {ap.verfuegbar}
          </div>
        </div>
      )}
    </Modal>
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
          <motion.li key={x.t} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 + i * 0.06 }} className="flex gap-3">
            <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-ink-soft text-[12px] font-semibold text-ink">{i + 1}</span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold">{x.t}</span>
              <span className="block text-[12.5px] text-fg-3">{x.s}</span>
            </span>
          </motion.li>
        ))}
      </ol>
      <div className="mt-5 flex items-center gap-3 rounded-[16px] bg-[var(--ink-softer)] p-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] text-fg-3">Ihr Sitzungscode (Beispiel)</div>
          <div className="mono select-all text-[24px] font-semibold tracking-[0.12em]">{code}</div>
        </div>
        <CopyButton text={code.replace(/\s/g, "")} label="Sitzungscode kopieren" />
      </div>
      <p className="mt-3 flex gap-2 text-[12px] text-fg-3">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-green" />
        Keine Software-Installation, keine lokalen Administratorrechte, kein dauerhafter Zugang. Im Demo-Betrieb wird keine Verbindung aufgebaut.
      </p>
    </Modal>
  );
}
