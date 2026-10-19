import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Building2, Check, CheckCircle2, CircleAlert, Copy, Link2, Mail, Plus, Send } from "lucide-react";
import { Button, Chip, Field, Input, Modal, Select, Switch, confirmDialog } from "@/components/ui";
import { BUNDESLAENDER } from "@/core/feiertage";
import { addDays, fmtDate, today } from "@/core/dates";
import { getBackend, type NeuerKunde, type NeuerKundeErgebnis } from "@/lib/backend";
import type { Bundesland, Sachgebiet } from "@/core/types";
import { BEWEGUNG } from "@/lib/bewegung";
import { cn } from "@/lib/cn";
import { StartpasswortKarte } from "@/components/StartpasswortKarte";
import { KopierKnopf } from "@/components/KopierKnopf";
import { LOGIN_URL_HINWEIS, SACHGEBIETE, einladungsText, landFuerStadt, loginUrl } from "./helfer";

/** Formularzustand: Bundesland und Anrede ohne Vorbelegung („“ = noch nicht gewählt bzw. keine Anrede). */
type Formular = Omit<NeuerKunde, "bundesland" | "adminAnrede"> & { bundesland: Bundesland | ""; adminAnrede: "" | "Frau" | "Herr" };

const LEER = (): Formular => ({
  kanzlei: "",
  stadt: "",
  bundesland: "",
  adminAnrede: "",
  adminName: "",
  adminEmail: "",
  arbeitsplaetze: 5,
  schwerpunkte: [],
  beispieldaten: true,
  testBis: addDays(today(), 30),
});

/** „der Hauptnutzerin“ / „des Hauptnutzers“ / „der Hauptnutzerin bzw. des Hauptnutzers“ */
function hauptnutzerGenitiv(anrede: Formular["adminAnrede"]) {
  return anrede === "Frau" ? "der Hauptnutzerin" : anrede === "Herr" ? "des Hauptnutzers" : "der Hauptnutzerin bzw. des Hauptnutzers";
}

/** Dialog: Testzugang für eine neue Kanzlei anlegen – mit fertigem Einladungstext. */
export function NeuerZugang({ open, onClose, onAngelegt }: { open: boolean; onClose: () => void; onAngelegt: () => void }) {
  const [form, setForm] = useState<Formular>(LEER);
  const [landBeruehrt, setLandBeruehrt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [ergebnis, setErgebnis] = useState<NeuerKundeErgebnis | null>(null);
  const [geprueft, setGeprueft] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(LEER());
      setLandBeruehrt(false);
      setFehler(null);
      setErgebnis(null);
      setGeprueft(false);
    }
  }, [open]);

  const set = <K extends keyof Formular>(k: K, v: Formular[K]) => setForm((f) => ({ ...f, [k]: v }));
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.adminEmail.trim());
  const stadtErkannt = !!form.stadt.trim() && !!landFuerStadt(form.stadt);
  const probleme = useMemo(() => {
    const p: Record<string, string> = {};
    if (!form.kanzlei.trim()) p.kanzlei = "Bitte den Namen der Kanzlei eintragen.";
    if (!form.stadt.trim()) p.stadt = "Bitte die Stadt eintragen – sie bestimmt auch die Gerichte der Beispieldaten.";
    if (!form.bundesland)
      p.bundesland = form.stadt.trim() && !stadtErkannt
        ? `„${form.stadt.trim()}“ ist in unserer Ortsliste nicht enthalten. Bitte wählen Sie das Bundesland der Kanzlei aus der Liste – es bestimmt die Feiertage für die Fristen.`
        : "Bitte wählen Sie das Bundesland der Kanzlei – es bestimmt die Feiertage für die Fristen.";
    if (!form.adminName.trim()) p.adminName = "Wer erhält den Zugang? Bitte Vor- und Nachnamen eintragen.";
    if (!emailOk) p.adminEmail = "Bitte eine gültige E-Mail-Adresse eintragen, z. B. name@kanzlei.de.";
    if (!(form.arbeitsplaetze >= 1 && form.arbeitsplaetze <= 500)) p.arbeitsplaetze = "Zwischen 1 und 500 Arbeitsplätzen.";
    if (form.testBis && form.testBis < today()) p.testBis = "Das Datum liegt in der Vergangenheit. Bitte ein künftiges Datum wählen oder das Feld leeren (unbefristet).";
    return p;
  }, [form, emailOk, stadtErkannt]);

  const anlegen = async (e?: FormEvent) => {
    e?.preventDefault();
    setGeprueft(true);
    if (Object.keys(probleme).length) return;
    setLaedt(true);
    setFehler(null);
    if (!form.bundesland) return;
    try {
      const { adminAnrede, bundesland, ...rest } = form;
      const r = await getBackend().console.create({ ...rest, bundesland, ...(adminAnrede ? { adminAnrede } : {}), kanzlei: form.kanzlei.trim(), stadt: form.stadt.trim(), adminName: form.adminName.trim(), adminEmail: form.adminEmail.trim() });
      setErgebnis(r);
      onAngelegt();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Der Zugang konnte nicht angelegt werden.");
    } finally {
      setLaedt(false);
    }
  };

  /** Escape, „Abbrechen“ und Klick daneben: Bei ausgefüllten Feldern erst nachfragen, leeres Formular schließt sofort. */
  const schliessen = async () => {
    if (laedt) return;
    if (!ergebnis && JSON.stringify(form) !== JSON.stringify(LEER())) {
      const ok = await confirmDialog({
        titel: "Eingaben verwerfen?",
        text: "Der Testzugang ist noch nicht angelegt. Ihre Eingaben gehen beim Schließen verloren.",
        bestaetigen: "Verwerfen",
        abbrechen: "Weiter bearbeiten",
        gefahr: true,
      });
      if (!ok) return;
    }
    onClose();
  };

  const zeige = (k: string) => (geprueft ? probleme[k] : undefined);
  // Stadt und Bundesland gehen zusammen an die Erzeugung der Beispieldaten (Gerichte, Feiertage).
  const landHinweis = zeige("bundesland") ? (
    <span className="text-seal">{zeige("bundesland")}</span>
  ) : !form.stadt.trim() || landBeruehrt ? (
    "Pflichtfeld – bestimmt die Feiertage für die Fristberechnung."
  ) : stadtErkannt ? (
    "Aus der Stadt übernommen – bestimmt die Feiertage für die Fristberechnung."
  ) : (
    <span className="text-amber-text">„{form.stadt.trim()}“ ist in unserer Ortsliste nicht enthalten – bitte wählen Sie das Bundesland.</span>
  );
  const nutzerGen = hauptnutzerGenitiv(form.adminAnrede);

  return (
    <Modal
      open={open}
      onClose={() => void schliessen()}
      size="lg"
      icon={ergebnis ? <CheckCircle2 className="size-5" /> : <Plus className="size-5" />}
      title={ergebnis ? "Testzugang ist bereit" : "Neuen Testzugang anlegen"}
      subtitle={ergebnis ? `${ergebnis.tenant.name} · Lizenz ${ergebnis.tenant.lizenz.lizenzNr}` : "Die Kanzlei erhält einen eigenen, streng getrennten Datenbestand und einen Zugang für die Hauptnutzerin bzw. den Hauptnutzer der Kanzlei."}
      footer={
        ergebnis ? (
          <>
            <Button variant="ghost" icon={<Plus className="size-4" />} onClick={() => { setForm(LEER()); setErgebnis(null); setGeprueft(false); }}>
              Weiteren Zugang anlegen
            </Button>
            <Button variant="primary" icon={<Check className="size-4" />} onClick={onClose}>
              Fertig
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => void schliessen()}>
              Abbrechen
            </Button>
            <Button variant="primary" loading={laedt} icon={<Building2 className="size-4" />} onClick={() => void anlegen()}>
              Testzugang anlegen
            </Button>
          </>
        )
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {ergebnis ? (
          <motion.div key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={BEWEGUNG.standard}>
            <Erfolg e={ergebnis} beispieldaten={form.beispieldaten} />
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={anlegen} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={BEWEGUNG.standard} className="grid gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Kanzleiname" htmlFor="nk-kanzlei" className="sm:col-span-2" hint={zeige("kanzlei") && <span className="text-seal">{zeige("kanzlei")}</span>}>
                <Input id="nk-kanzlei" value={form.kanzlei} onChange={(e) => set("kanzlei", e.target.value)} placeholder="z. B. Becker & Schulz Rechtsanwälte PartG mbB" autoComplete="organization" aria-invalid={!!zeige("kanzlei")} />
              </Field>
              <Field label="Stadt" htmlFor="nk-stadt" hint={zeige("stadt") && <span className="text-seal">{zeige("stadt")}</span>}>
                <Input
                  id="nk-stadt"
                  value={form.stadt}
                  onChange={(e) => {
                    const v = e.target.value;
                    // Keine Vorbelegung: Erkennt die Ortsliste die Stadt nicht, bleibt das Bundesland leer (Pflichtfeld).
                    setForm((f) => ({ ...f, stadt: v, bundesland: !landBeruehrt ? landFuerStadt(v) ?? "" : f.bundesland }));
                  }}
                  placeholder="z. B. Köln"
                  autoComplete="address-level2"
                  aria-invalid={!!zeige("stadt")}
                />
              </Field>
              <Field label="Bundesland" htmlFor="nk-land" hint={landHinweis}>
                <Select
                  id="nk-land"
                  value={form.bundesland}
                  aria-invalid={!!zeige("bundesland")}
                  required
                  onChange={(e) => {
                    setLandBeruehrt(true);
                    set("bundesland", e.target.value as Bundesland | "");
                  }}
                >
                  <option value="">Bitte wählen …</option>
                  {BUNDESLAENDER.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Anrede" htmlFor="nk-anrede" hint="Für die förmliche Anrede in Einladung und App.">
                <Select id="nk-anrede" value={form.adminAnrede} onChange={(e) => set("adminAnrede", e.target.value as Formular["adminAnrede"])}>
                  <option value="">keine Angabe</option>
                  <option value="Frau">Frau</option>
                  <option value="Herr">Herr</option>
                </Select>
              </Field>
              <Field label={`Name ${nutzerGen}`} htmlFor="nk-admin" hint={zeige("adminName") && <span className="text-seal">{zeige("adminName")}</span>}>
                <Input id="nk-admin" value={form.adminName} onChange={(e) => set("adminName", e.target.value)} placeholder="z. B. Dr. Anna Becker" autoComplete="name" aria-invalid={!!zeige("adminName")} />
              </Field>
              <Field label={`E-Mail ${nutzerGen}`} htmlFor="nk-email" className="sm:col-span-2" hint={zeige("adminEmail") ? <span className="text-seal">{zeige("adminEmail")}</span> : "Damit meldet sich die Kanzlei an."}>
                <Input id="nk-email" type="email" inputMode="email" value={form.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} placeholder="anna.becker@kanzlei.de" autoComplete="email" aria-invalid={!!zeige("adminEmail")} />
              </Field>
              <Field label="Arbeitsplätze" htmlFor="nk-plaetze" hint={zeige("arbeitsplaetze") && <span className="text-seal">{zeige("arbeitsplaetze")}</span>}>
                <Input id="nk-plaetze" type="number" min={1} max={500} inputMode="numeric" value={Number.isFinite(form.arbeitsplaetze) ? form.arbeitsplaetze : ""} onChange={(e) => set("arbeitsplaetze", Number(e.target.value))} />
              </Field>
              <Field label="Testzugang bis" htmlFor="nk-bis" hint={zeige("testBis") ? <span className="text-seal">{zeige("testBis")}</span> : form.testBis ? `Danach endet der Test am ${fmtDate(form.testBis)}.` : "Ohne Datum unbefristet."}>
                <Input id="nk-bis" type="date" value={form.testBis ?? ""} min={today()} onChange={(e) => set("testBis", e.target.value || undefined)} />
              </Field>
            </div>

            <fieldset>
              <legend className="label">Schwerpunkte</legend>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Schwerpunkte auswählen">
                {SACHGEBIETE.map((sg) => {
                  const an = form.schwerpunkte.includes(sg);
                  return (
                    <button
                      key={sg}
                      type="button"
                      aria-pressed={an}
                      onClick={() => set("schwerpunkte", an ? form.schwerpunkte.filter((x) => x !== sg) : ([...form.schwerpunkte, sg] as Sachgebiet[]))}
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors duration-100 max-sm:h-11",
                        an ? "bg-[var(--surface-3)] text-fg shadow-[inset_0_0_0_1px_var(--ink)]" : "bg-[var(--surface)] text-fg-2 shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-[var(--surface-2)]",
                      )}
                    >
                      {an && <Check className="size-3.5" aria-hidden />}
                      {sg}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[13px] text-fg-3">{form.schwerpunkte.length ? `${form.schwerpunkte.length} ausgewählt – die Beispielakten richten sich danach.` : "Ohne Auswahl werden allgemeine Beispielakten erzeugt."}</p>
            </fieldset>

            <label htmlFor="nk-beispiel" className="flex cursor-pointer items-center gap-4 border-y border-[var(--line)] py-4">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-fg">Mit Beispieldaten</span>
                <span className="block text-[13px] leading-[18px] text-fg-3">Über 30 Beispielakten mit Fristen, Posteingang, Rechnungen und 38h-Motor – ideal für die Präsentation. Ohne: leere Kanzlei für echte Daten.</span>
              </span>
              <Switch id="nk-beispiel" checked={form.beispieldaten} onChange={(v) => set("beispieldaten", v)} label="Mit Beispieldaten" />
            </label>

            {fehler && (
              <div className="banner banner-seal" role="alert">
                <CircleAlert aria-hidden />
                <span>{fehler}</span>
              </div>
            )}
            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </motion.form>
        )}
      </AnimatePresence>
    </Modal>
  );
}

function Erfolg({ e, beispieldaten }: { e: NeuerKundeErgebnis; beispieldaten: boolean }) {
  const text = einladungsText({ tenant: e.tenant, user: e.admin, hauptnutzer: true, beispieldaten });
  return <ZugangsDaten user={e.admin} text={text} passwort={e.passwort} kopf={<>
    <span className="font-semibold text-fg">{e.admin.name}</span> kann sich ab sofort anmelden und legt dabei ein eigenes Passwort fest. {e.tenant.testBis ? `Test bis ${fmtDate(e.tenant.testBis)}.` : ""}{" "}
    {beispieldaten ? <Chip tone="green">mit Beispieldaten</Chip> : <Chip tone="outline">leere Kanzlei</Chip>}
  </>} />;
}

/**
 * Zugangsdaten nach dem Anlegen bzw. nach einem neuen Startpasswort – überall gleich vollständig: Anmeldeadresse, E-Mail,
 * Startpasswort mit eigenem Kopierknopf (getrennt übermitteln) und die Einladung ohne Passwort.
 */
export function ZugangsDaten({ user, text, passwort, kopf }: { user: { email: string }; text: string; passwort: string; kopf?: React.ReactNode }) {
  const url = loginUrl();
  const einladungId = useId();
  const zeilen = [
    { icon: <Link2 className="size-4" />, label: url ? "Anmeldeadresse" : "Anmeldeadresse", wert: url ?? LOGIN_URL_HINWEIS, was: "Anmeldeadresse", hinweis: !url },
    { icon: <Mail className="size-4" />, label: "E-Mail", wert: user.email, was: "E-Mail" },
  ];
  return (
    <div className="grid gap-4">
      {kopf && (
        <div className="banner banner-green">
          <CheckCircle2 aria-hidden />
          <span className="text-fg-2">{kopf}</span>
        </div>
      )}
      <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-lg border border-[var(--line)]">
        {zeilen.map((z) => (
          <li key={z.label} className="flex items-center gap-3 px-3.5 py-2.5">
            <span className="shrink-0 text-fg-4" aria-hidden>
              {z.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-medium leading-4 text-fg-3">{z.label}</span>
              {/* vollständig und umbrechend – die Adresse wird am Telefon vorgelesen (I4-T21-02) */}
              <span className={z.hinweis ? "block text-[13px] text-fg-2" : "mono block text-[13.5px] font-medium leading-snug [overflow-wrap:anywhere]"}>{z.wert}</span>
            </span>
            {!z.hinweis && (
              <KopierKnopf text={z.wert} was={z.was} icon={<Copy className="size-3.5" />} aria-label={`${z.was} kopieren`} title={`${z.was} kopieren`} className="shrink-0 justify-end">
                <span className="hidden sm:inline">Kopieren</span>
              </KopierKnopf>
            )}
          </li>
        ))}
      </ul>
      <StartpasswortKarte passwort={passwort} kompakt />
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <span className="label !mb-0">Einladung – vollständig, ohne Passwort</span>
          <KopierKnopf text={text} was="Einladung" variant="primary" icon={<Send className="size-3.5" />} markieren={() => document.getElementById(einladungId)}>
            Einladung kopieren
          </KopierKnopf>
        </div>
        {/* Vorschaufläche wie ein Eingabefeld (Tokens, hell und dunkel) – eine E-Mail braucht kein Papier (I4-T21-01) */}
        <pre
          id={einladungId}
          className="max-h-[260px] overflow-auto whitespace-pre-wrap rounded-md border border-[var(--line-strong)] bg-[var(--surface)] p-4 font-[inherit] text-[13px] leading-5 text-fg [overflow-wrap:anywhere]"
          tabIndex={0}
          role="region"
          aria-label="Einladungstext"
        >
          {text}
        </pre>
      </div>
    </div>
  );
}
