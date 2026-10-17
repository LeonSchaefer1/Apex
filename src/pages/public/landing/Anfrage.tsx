import { useEffect, useState } from "react";
import { create } from "zustand";
import { motion } from "motion/react";
import { Check, Clock, Mail, Phone, Send } from "lucide-react";
import { STANDARD_ANSPRECHPARTNER } from "@/core/seed/kunde";
import { istEmail } from "@/lib/backend";
import { Avatar, Button, Field, Input, Modal, Select } from "@/components/ui";
import { cn } from "@/lib/cn";

/** Art der Anfrage: Testzugang (Hero, Schluss) oder Angebot (Lifetime). */
export type AnfrageArt = "testzugang" | "angebot";

export const useAnfrage = create<{ art: AnfrageArt | null; oeffne: (a: AnfrageArt) => void; schliessen: () => void }>((set) => ({
  art: null,
  oeffne: (art) => set({ art }),
  schliessen: () => set({ art: null }),
}));

export const ANFRAGE_BESTAETIGUNG = "Im Prototyp wird nichts versendet – im Echtbetrieb meldet sich Ihre Ansprechpartnerin innerhalb eines Werktags.";

const TITEL: Record<AnfrageArt, { titel: string; untertitel: string; knopf: string }> = {
  testzugang: { titel: "Testzugang anfordern", untertitel: "Eigener Testzugang für Ihre Kanzlei – auf Wunsch mit Beispieldaten.", knopf: "Testzugang anfordern" },
  angebot: { titel: "Angebot anfordern", untertitel: "Lifetime-Lizenz nach Kanzleigröße – Preis auf Anfrage, verbindlich im Angebot.", knopf: "Angebot anfordern" },
};

const PLAETZE = ["1–3", "4–8", "9–15", "16–30", "mehr als 30"];

interface Formular {
  kanzlei: string;
  name: string;
  email: string;
  telefon: string;
  plaetze: string;
  termin: string;
}
const LEER: Formular = { kanzlei: "", name: "", email: "", telefon: "", plaetze: "", termin: "" };

/** Kontaktblock mit den Werten der festen Ansprechpartnerin (src/core/seed/kunde.ts) – nichts erfunden. */
export function KontaktBlock({ className, hell }: { className?: string; hell?: boolean }) {
  const ap = STANDARD_ANSPRECHPARTNER;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2.5", className)}>
      <Avatar initialen={ap.initialen} size={40} />
      <div className="min-w-0 flex-1 basis-[200px]">
        <div className={cn("text-[14.5px] font-semibold", hell && "text-[var(--sk-fg,var(--bg))]")}>
          {ap.name}, {ap.rolle.replace(/^Ihre feste /, "Ihre ")}
        </div>
        <div className={cn("mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]", hell ? "text-[color-mix(in_oklab,var(--sk-fg,var(--bg))_82%,transparent)]" : "text-fg-2")}>
          <a href={`tel:${ap.telefon.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 font-medium underline-offset-2 hover:underline">
            <Phone className="size-3.5" /> {ap.telefon}
          </a>
          <span className="inline-flex items-center gap-1.5">
            <Mail className="size-3.5" /> {ap.email}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" /> {ap.verfuegbar}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Anfrageformular ohne externe Dienste: prüft die Eingaben und bestätigt ehrlich, dass im Prototyp nichts versendet wird. */
export function AnfrageDialog() {
  const { art, schliessen } = useAnfrage();
  const [f, setF] = useState<Formular>(LEER);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState(false);
  const t = TITEL[art ?? "testzugang"];

  useEffect(() => {
    if (!art) return;
    setFertig(false);
    setFehler(null);
  }, [art]);

  const set = <K extends keyof Formular>(k: K, v: Formular[K]) => setF((x) => ({ ...x, [k]: v }));

  const senden = () => {
    if (!f.kanzlei.trim()) return setFehler("Bitte geben Sie den Namen Ihrer Kanzlei an.");
    if (!f.name.trim()) return setFehler("Bitte geben Sie Ihren Namen an – so weiß Ihre Ansprechpartnerin, wen sie anruft.");
    if (!istEmail(f.email.trim())) return setFehler("Bitte prüfen Sie die E-Mail-Adresse, z. B. name@kanzlei.de.");
    if (f.telefon.trim() && !/^[+\d][\d\s/()-]{5,}$/.test(f.telefon.trim())) return setFehler("Bitte geben Sie die Telefonnummer mit Ziffern an, z. B. +49 30 1234567 – oder lassen Sie das Feld leer.");
    if (!f.plaetze) return setFehler("Bitte wählen Sie die Zahl der Arbeitsplätze – danach richtet sich das Angebot.");
    setFehler(null);
    setFertig(true);
  };

  const zu = () => {
    schliessen();
    if (fertig) setTimeout(() => setF(LEER), 300);
  };

  return (
    <Modal
      open={!!art}
      onClose={zu}
      size="md"
      icon={<Send className="size-5" />}
      title={fertig ? "Anfrage vorgemerkt" : t.titel}
      subtitle={fertig ? undefined : t.untertitel}
      footer={
        fertig ? (
          <Button variant="primary" onClick={zu}>
            Fertig
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={zu}>
              Abbrechen
            </Button>
            <Button variant="primary" icon={<Send className="size-4" />} onClick={senden}>
              {t.knopf}
            </Button>
          </>
        )
      }
    >
      {fertig ? (
        <div className="flex flex-col items-center py-2 text-center">
          <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 420, damping: 20 }} className="mb-3 grid size-14 place-items-center rounded-full bg-green-soft text-green">
            <Check className="size-7" strokeWidth={2.6} />
          </motion.div>
          <p className="max-w-[46ch] text-[14.5px] leading-relaxed text-fg-2">
            Danke, {f.name.trim()}. {ANFRAGE_BESTAETIGUNG}
          </p>
          <div className="mt-5 w-full rounded-[16px] bg-[var(--ink-softer)] p-4 text-left">
            <KontaktBlock />
          </div>
        </div>
      ) : (
        <form
          className="grid grid-cols-1 gap-3.5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            senden();
          }}
        >
          <Field label="Kanzlei" htmlFor="af-kanzlei" className="sm:col-span-2">
            <Input id="af-kanzlei" value={f.kanzlei} onChange={(e) => set("kanzlei", e.target.value)} autoComplete="organization" placeholder="z. B. Kanzlei Muster & Partner" />
          </Field>
          <Field label="Ihr Name" htmlFor="af-name">
            <Input id="af-name" value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
          </Field>
          <Field label="E-Mail" htmlFor="af-email">
            <Input id="af-email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Telefon (optional)" htmlFor="af-tel">
            <Input id="af-tel" inputMode="tel" value={f.telefon} onChange={(e) => set("telefon", e.target.value)} autoComplete="tel" placeholder="+49 …" />
          </Field>
          <Field label="Arbeitsplätze" htmlFor="af-plaetze">
            <Select id="af-plaetze" value={f.plaetze} onChange={(e) => set("plaetze", e.target.value)}>
              <option value="">Bitte wählen …</option>
              {PLAETZE.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </Field>
          <Field label="Wunschtermin (optional)" htmlFor="af-termin" className="sm:col-span-2" hint="Für den Rückruf bzw. den Start des Testzugangs.">
            <Input id="af-termin" value={f.termin} onChange={(e) => set("termin", e.target.value)} placeholder="z. B. nächste Woche Dienstag ab 14 Uhr" />
          </Field>
          {fehler && (
            <div role="alert" className="rounded-[12px] bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal sm:col-span-2">
              {fehler}
            </div>
          )}
          <p className="text-[12.5px] leading-relaxed text-fg-3 sm:col-span-2">Ohne externe Dienste: Diese Seite übermittelt im Prototyp keine Daten. Lieber direkt sprechen?</p>
          <div className="rounded-[16px] bg-[var(--ink-softer)] p-3.5 sm:col-span-2">
            <KontaktBlock />
          </div>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      )}
    </Modal>
  );
}
