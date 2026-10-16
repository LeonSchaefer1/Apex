import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Building2, Check, CheckCircle2, Copy, Eye, EyeOff, KeyRound, Link2, Mail, Plus, Send } from "lucide-react";
import { Button, Chip, Field, Input, Modal, Select, Switch } from "@/components/ui";
import { BUNDESLAENDER } from "@/core/feiertage";
import { addDays, fmtDate, today } from "@/core/dates";
import { getBackend, type NeuerKunde, type NeuerKundeErgebnis } from "@/lib/backend";
import type { Bundesland, Sachgebiet } from "@/core/types";
import { cn } from "@/lib/cn";
import { SACHGEBIETE, einladungsText, kopieren, landFuerStadt, loginUrl } from "./helfer";

const LEER = (): NeuerKunde => ({
  kanzlei: "",
  stadt: "",
  bundesland: "BE",
  adminName: "",
  adminEmail: "",
  arbeitsplaetze: 5,
  schwerpunkte: [],
  beispieldaten: true,
  testBis: addDays(today(), 30),
});

/** Dialog: Testzugang für eine neue Kanzlei anlegen – mit fertigem Einladungstext. */
export function NeuerZugang({ open, onClose, onAngelegt }: { open: boolean; onClose: () => void; onAngelegt: () => void }) {
  const [form, setForm] = useState<NeuerKunde>(LEER);
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

  const set = <K extends keyof NeuerKunde>(k: K, v: NeuerKunde[K]) => setForm((f) => ({ ...f, [k]: v }));
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.adminEmail.trim());
  const probleme = useMemo(() => {
    const p: Record<string, string> = {};
    if (!form.kanzlei.trim()) p.kanzlei = "Bitte den Namen der Kanzlei eintragen.";
    if (!form.stadt.trim()) p.stadt = "Bitte die Stadt eintragen – sie bestimmt auch die Gerichte der Beispieldaten.";
    if (!form.adminName.trim()) p.adminName = "Wer erhält den Zugang? Bitte Vor- und Nachnamen eintragen.";
    if (!emailOk) p.adminEmail = "Bitte eine gültige E-Mail-Adresse eintragen, z. B. name@kanzlei.de.";
    if (!(form.arbeitsplaetze >= 1 && form.arbeitsplaetze <= 500)) p.arbeitsplaetze = "Zwischen 1 und 500 Arbeitsplätzen.";
    if (form.testBis && form.testBis < today()) p.testBis = "Das Datum liegt in der Vergangenheit.";
    return p;
  }, [form, emailOk]);

  const anlegen = async (e?: FormEvent) => {
    e?.preventDefault();
    setGeprueft(true);
    if (Object.keys(probleme).length) return;
    setLaedt(true);
    setFehler(null);
    try {
      const r = await getBackend().console.create({ ...form, kanzlei: form.kanzlei.trim(), stadt: form.stadt.trim(), adminName: form.adminName.trim(), adminEmail: form.adminEmail.trim() });
      setErgebnis(r);
      onAngelegt();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Der Zugang konnte nicht angelegt werden.");
    } finally {
      setLaedt(false);
    }
  };

  const zeige = (k: string) => (geprueft ? probleme[k] : undefined);
  // Stadt und Bundesland gehen zusammen an die Erzeugung der Beispieldaten (Gerichte, Feiertage).
  const stadtErkannt = !!form.stadt.trim() && !!landFuerStadt(form.stadt);
  const landHinweis =
    !form.stadt.trim() || landBeruehrt ? (
      "Bestimmt die Feiertage für die Fristberechnung."
    ) : stadtErkannt ? (
      "Aus der Stadt übernommen – bestimmt die Feiertage für die Fristberechnung."
    ) : (
      <span className="text-amber">„{form.stadt.trim()}“ kennt die Liste nicht – bitte das Bundesland prüfen.</span>
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={ergebnis ? <CheckCircle2 className="size-5" /> : <Plus className="size-5" />}
      title={ergebnis ? "Testzugang ist bereit" : "Neuen Testzugang anlegen"}
      subtitle={ergebnis ? `${ergebnis.tenant.name} · Lizenz ${ergebnis.tenant.lizenz.lizenzNr}` : "Die Kanzlei erhält einen eigenen, streng getrennten Datenbestand und einen Admin-Zugang."}
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
            <Button variant="ghost" onClick={onClose}>
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
          <motion.div key="ok" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ type: "spring", stiffness: 420, damping: 34 }}>
            <Erfolg e={ergebnis} beispieldaten={form.beispieldaten} />
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={anlegen} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="grid gap-4" noValidate>
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
                    setForm((f) => ({ ...f, stadt: v, bundesland: !landBeruehrt ? landFuerStadt(v) ?? f.bundesland : f.bundesland }));
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
                  onChange={(e) => {
                    setLandBeruehrt(true);
                    set("bundesland", e.target.value as Bundesland);
                  }}
                >
                  {BUNDESLAENDER.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Name der Admin-Person" htmlFor="nk-admin" hint={zeige("adminName") && <span className="text-seal">{zeige("adminName")}</span>}>
                <Input id="nk-admin" value={form.adminName} onChange={(e) => set("adminName", e.target.value)} placeholder="z. B. Dr. Anna Becker" autoComplete="name" aria-invalid={!!zeige("adminName")} />
              </Field>
              <Field label="E-Mail der Admin-Person" htmlFor="nk-email" hint={zeige("adminEmail") ? <span className="text-seal">{zeige("adminEmail")}</span> : "Damit meldet sich die Kanzlei an."}>
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
                    <motion.button
                      key={sg}
                      type="button"
                      aria-pressed={an}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => set("schwerpunkte", an ? form.schwerpunkte.filter((x) => x !== sg) : ([...form.schwerpunkte, sg] as Sachgebiet[]))}
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors",
                        an ? "bg-ink text-[var(--on-ink)] shadow-[0_6px_14px_-8px_var(--ink)]" : "bg-[var(--ink-softer)] text-fg-2 shadow-[inset_0_0_0_1px_var(--line)] hover:bg-ink-soft",
                      )}
                    >
                      {an && <Check className="size-3.5" />}
                      {sg}
                    </motion.button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[12px] text-fg-3">{form.schwerpunkte.length ? `${form.schwerpunkte.length} ausgewählt – die Beispielakten richten sich danach.` : "Ohne Auswahl werden allgemeine Beispielakten erzeugt."}</p>
            </fieldset>

            <label htmlFor="nk-beispiel" className="flex cursor-pointer items-center gap-4 rounded-[16px] bg-[var(--ink-softer)] p-3.5 shadow-[inset_0_0_0_1px_var(--line)]">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">Mit Beispieldaten</span>
                <span className="block text-[12.5px] text-fg-3">Über 30 Beispielakten mit Fristen, Posteingang, Rechnungen und 38h-Motor – ideal für die Präsentation. Ohne: leere Kanzlei für echte Daten.</span>
              </span>
              <Switch id="nk-beispiel" checked={form.beispieldaten} onChange={(v) => set("beispieldaten", v)} label="Mit Beispieldaten" />
            </label>

            {fehler && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-[12px] bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal" role="alert">
                {fehler}
              </motion.div>
            )}
            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </motion.form>
        )}
      </AnimatePresence>
    </Modal>
  );
}

function Erfolg({ e, beispieldaten }: { e: NeuerKundeErgebnis; beispieldaten: boolean }) {
  const [zeigePw, setZeigePw] = useState(true);
  const text = einladungsText({ tenant: e.tenant, admin: e.admin, passwort: e.passwort, beispieldaten });
  const zeilen = [
    { icon: <Link2 className="size-4" />, label: "Login-URL", wert: loginUrl(), was: "Login-URL" },
    { icon: <Mail className="size-4" />, label: "E-Mail", wert: e.admin.email, was: "E-Mail" },
    { icon: <KeyRound className="size-4" />, label: "Passwort", wert: e.passwort, was: "Passwort", geheim: true },
  ];
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3 rounded-[16px] bg-green-soft p-3.5 text-[13.5px]">
        <motion.span initial={{ scale: 0.4, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 18 }} className="grid size-9 shrink-0 place-items-center rounded-full bg-green text-white">
          <Check className="size-5" strokeWidth={3} />
        </motion.span>
        <span className="text-fg-2">
          <span className="font-semibold text-fg">{e.admin.name}</span> kann sich ab sofort anmelden. {e.tenant.testBis ? `Test bis ${fmtDate(e.tenant.testBis)}.` : ""}{" "}
          {beispieldaten ? <Chip tone="green">mit Beispieldaten</Chip> : <Chip tone="outline">leere Kanzlei</Chip>}
        </span>
      </div>
      <ul className="sheet divide-y divide-[var(--line)] overflow-hidden rounded-[18px]">
        {zeilen.map((z) => (
          <li key={z.label} className="flex items-center gap-3 px-3.5 py-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-ink-soft text-ink">{z.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11.5px] font-medium text-fg-3">{z.label}</span>
              <span className="mono block truncate text-[13.5px] font-medium">{z.geheim && !zeigePw ? "•".repeat(z.wert.length) : z.wert}</span>
            </span>
            {z.geheim && (
              <button type="button" className="icon-btn !size-8" onClick={() => setZeigePw((v) => !v)} aria-label={zeigePw ? "Passwort verbergen" : "Passwort anzeigen"}>
                {zeigePw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            )}
            <Button size="sm" variant="secondary" icon={<Copy className="size-3.5" />} onClick={() => void kopieren(z.wert, z.was)} aria-label={`${z.was} kopieren`} title={`${z.was} kopieren`}>
              <span className="hidden sm:inline">Kopieren</span>
            </Button>
          </li>
        ))}
      </ul>
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="label !mb-0">Einladung – fertig zum Versenden</span>
          <Button size="sm" variant="primary" icon={<Send className="size-3.5" />} onClick={() => void kopieren(text, "Einladungstext")}>
            Einladung kopieren
          </Button>
        </div>
        <pre className="paper max-h-[260px] overflow-auto whitespace-pre-wrap p-4 font-[inherit] text-[13px] leading-relaxed">{text}</pre>
      </div>
    </div>
  );
}
