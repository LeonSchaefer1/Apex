import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { CheckCircle2, Info, Receipt } from "lucide-react";
import type { Tenant } from "@/core/types";
import { fehlendeRechnungsangaben, pruefeRechnungsangaben, type Rechnungsangaben, type RechnungsangabenFeld } from "@/core/abrechnung";
import { schuetzeLeerzeichen } from "@/core/dates";
import { darfVerwalten, fehlerFeld, getBackend, istConsole } from "@/lib/backend";
import { useKanzlei, useSession } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Chip, Field, Input } from "@/components/ui";
import { Abschnitt } from "./teile";

type Feld = RechnungsangabenFeld;
type Formular = Record<Feld, string>;

const REIHENFOLGE: Feld[] = ["steuernummer", "ustIdNr", "iban", "bic", "bank", "anderIban", "anderBank"];
/** Felder, die auf Rechnungen stehen – der Direktsprung aus einer Rechnung fokussiert das erste leere davon. */
const RECHNUNGSFELDER: Feld[] = ["steuernummer", "ustIdNr", "iban", "bic", "bank"];

/** Fließtext ohne unglückliche Umbrüche: „§ 14“, „Abs. 4“ und „USt-IdNr.“ (geschützter Bindestrich) bleiben zusammen. */
const satz = (t: string) => schuetzeLeerzeichen(t).replace(/USt-IdNr/g, "USt\u2011IdNr");

const formularAus = (t: Tenant): Formular => ({
  steuernummer: t.steuernummer ?? "",
  ustIdNr: t.ustIdNr ?? "",
  iban: t.geschaeftskonto?.iban ?? "",
  bic: t.geschaeftskonto?.bic ?? "",
  bank: t.geschaeftskonto?.bank ?? "",
  anderIban: t.anderkonto?.iban ?? "",
  anderBank: t.anderkonto?.bank ?? "",
});

const angabenAus = (f: Formular): Rechnungsangaben => ({
  steuernummer: f.steuernummer.trim() || undefined,
  ustIdNr: f.ustIdNr.trim() || undefined,
  geschaeftskonto: f.iban.trim() || f.bic.trim() || f.bank.trim() ? { iban: f.iban.trim(), bic: f.bic.trim() || undefined, bank: f.bank.trim() || undefined } : undefined,
  anderkonto: f.anderIban.trim() || f.anderBank.trim() ? { iban: f.anderIban.trim(), bank: f.anderBank.trim() || undefined } : undefined,
});

/**
 * Rechnungsangaben der Kanzlei (I3-T07-03): Steuernummer bzw. USt-IdNr. (§ 14 Abs. 4 S. 1 Nr. 2 UStG) und Geschäftskonto.
 * Ändern dürfen Partner und Administration, alle anderen lesen. Fehler stehen am Feld; Speichern prüft Demo-Backend und Server
 * gleich (`pruefeRechnungsangaben`), das Protokoll schreibt das Backend. Direktsprung: /einstellungen?tab=kanzlei&abschnitt=rechnung.
 */
export function RechnungsangabenAbschnitt() {
  const { tenant, user, betrieb } = useKanzlei();
  const darf = darfVerwalten(user.rolle);
  const gespeichert = formularAus(tenant);
  const stand = JSON.stringify(gespeichert);
  const [f, setF] = useState<Formular>(gespeichert);
  const [fehler, setFehler] = useState<Partial<Record<Feld | "allgemein", string>>>({});
  const [laeuft, setLaeuft] = useState(false);
  const geaendert = JSON.stringify(f) !== stand;
  const fehlt = fehlendeRechnungsangaben(tenant);
  const refs = useRef<Partial<Record<Feld, HTMLInputElement | null>>>({});

  // Gespeicherter Stand kam von außen (Neuladen, andere Sitzung) → Formular nachziehen
  useEffect(() => {
    setF(JSON.parse(stand) as Formular);
  }, [stand]);

  // Direktsprung aus Rechnung, Strg+K oder Glocke: Abschnitt zeigen, erstes leeres Feld fokussieren (nur wer ändern darf)
  const [params] = useSearchParams();
  const abschnitt = params.get("abschnitt");
  useEffect(() => {
    if (abschnitt !== "rechnung") return;
    const t = setTimeout(() => {
      const el = document.getElementById("kanzlei-rechnung");
      el?.scrollIntoView({ block: "start" });
      const aktuell = formularAus(aktuellerTenant());
      const leer = darf ? RECHNUNGSFELDER.find((k) => !aktuell[k]) : undefined;
      const ziel = leer ? refs.current[leer] : null;
      if (ziel) ziel.focus({ preventScroll: true });
      else el?.focus({ preventScroll: true });
    }, 140);
    return () => clearTimeout(t);
  }, [abschnitt, darf]);

  const set = (k: Feld, v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    if (fehler[k] || fehler.allgemein) setFehler((x) => ({ ...x, [k]: undefined, allgemein: undefined }));
  };

  const speichern = async () => {
    if (!darf) return;
    const a = angabenAus(f);
    const pruefung = pruefeRechnungsangaben(a);
    const erstes = REIHENFOLGE.find((k) => pruefung[k]);
    if (erstes) {
      setFehler(pruefung);
      refs.current[erstes]?.focus();
      return;
    }
    setFehler({});
    setLaeuft(true);
    try {
      const neu = await getBackend().kanzlei.rechnungsangabenSpeichern(a);
      const s = useSession.getState().sitzung;
      if (s && !istConsole(s)) useSession.getState().setSitzung({ ...s, tenant: neu });
      setF(formularAus(neu));
      const offen = fehlendeRechnungsangaben(neu);
      toast("Rechnungsangaben gespeichert", { text: offen.length ? `Noch offen: ${offen.join(", ")}.` : "Neue Rechnungen zeigen ab sofort diese Angaben.", ton: offen.length ? "warnung" : "erfolg" });
    } catch (e) {
      const text = e instanceof Error ? e.message : "Die Rechnungsangaben konnten nicht gespeichert werden.";
      const feld = fehlerFeld(e);
      if (feld && (REIHENFOLGE as string[]).includes(feld)) {
        setFehler({ [feld]: text });
        refs.current[feld as Feld]?.focus();
      } else setFehler({ allgemein: text });
    } finally {
      setLaeuft(false);
    }
  };

  const feld = (k: Feld, extra: React.InputHTMLAttributes<HTMLInputElement> & { hinweisId?: string }) => {
    const { hinweisId, ...rest } = extra;
    const beschrieben = [fehler[k] ? `kr-${k}-fehler` : undefined, hinweisId].filter(Boolean).join(" ") || undefined;
    return (
      <>
        <Input
          ref={(el) => {
            refs.current[k] = el;
          }}
          id={`kr-${k}`}
          value={f[k]}
          onChange={(e) => set(k, e.target.value)}
          aria-invalid={!!fehler[k] || undefined}
          aria-describedby={beschrieben}
          spellCheck={false}
          autoComplete="off"
          maxLength={80}
          {...rest}
        />
        {fehler[k] && (
          <div id={`kr-${k}-fehler`} className="mt-1.5 text-[12.5px] leading-snug text-seal">
            {fehler[k]}
          </div>
        )}
      </>
    );
  };

  return (
    <Abschnitt
      id="kanzlei-rechnung"
      titel="Rechnungsangaben"
      text={satz("Pflichtangabe auf jeder Rechnung: Steuernummer oder USt-IdNr. (§ 14 Abs. 4 S. 1 Nr. 2 UStG). Dazu das Geschäftskonto als Zahlungsweg für Überweisung und E-Rechnung.")}
      icon={<Receipt className="size-[18px]" />}
      aktion={
        fehlt.length ? (
          <Chip tone="amber" dot>
            {fehlt.length === 1 ? "1 Angabe fehlt" : `${fehlt.length} Angaben fehlen`}
          </Chip>
        ) : (
          <Chip tone="green" icon={<CheckCircle2 className="size-3" />}>
            Vollständig
          </Chip>
        )
      }
    >
      <form
        className="grid grid-cols-1 gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void speichern();
        }}
      >
        {fehlt.length > 0 && (
          <div className="flex items-start gap-2 rounded-[12px] bg-amber-soft px-3.5 py-2.5 text-[13px] leading-snug text-fg-2">
            <Info className="mt-0.5 size-4 shrink-0 text-amber" />
            <span className="min-w-0">
              Noch offen: {satz(fehlt.join(" · "))}. Bis dahin zeigen Rechnungen gekennzeichnete Platzhalter.
              {betrieb?.praesentation && " In Beispielkanzleien bleiben die Felder bewusst leer – hier stehen keine echten Kontodaten."}
            </span>
          </div>
        )}
        <fieldset disabled={!darf} className="contents">
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <Field label="Steuernummer" htmlFor="kr-steuernummer" hint={<span id="kr-steuernummer-hinweis">Vom Finanzamt, z. B. 12/345/67890</span>}>
              {feld("steuernummer", { inputMode: "text", hinweisId: "kr-steuernummer-hinweis" })}
            </Field>
            <Field label="USt-IdNr." htmlFor="kr-ustIdNr" hint={<span id="kr-ustIdNr-hinweis">„DE“ und 9 Ziffern, z. B. DE123456789 – eine der beiden Angaben genügt</span>}>
              {feld("ustIdNr", { autoCapitalize: "characters", hinweisId: "kr-ustIdNr-hinweis" })}
            </Field>
            <Field label="IBAN (Geschäftskonto)" htmlFor="kr-iban" className="md:col-span-2" hint={<span id="kr-iban-hinweis">{satz("Zahlungsweg (für E-Rechnung/Überweisung), keine Pflichtangabe nach § 14 UStG. Deutsche IBAN: 22 Stellen, beginnt mit DE – die Prüfziffer wird beim Speichern geprüft.")}</span>}>
              {feld("iban", { autoCapitalize: "characters", inputMode: "text", hinweisId: "kr-iban-hinweis", className: "num" })}
            </Field>
            <Field label="BIC" htmlFor="kr-bic" hint={<span id="kr-bic-hinweis">8 oder 11 Zeichen (optional)</span>}>
              {feld("bic", { autoCapitalize: "characters", hinweisId: "kr-bic-hinweis" })}
            </Field>
            <Field label="Bank" htmlFor="kr-bank" hint="Optional">
              {feld("bank", { maxLength: 120 })}
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3.5 border-t border-[var(--line)] pt-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <div className="text-[13.5px] font-semibold text-fg">Anderkonto für Fremdgeld</div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-fg-3">{satz("Optional. Steht nicht auf Rechnungen. AnwaltApex setzt diese IBAN als Auftraggeberkonto in die SEPA-Datei, wenn Sie Fremdgeld vom Anderkonto weiterleiten (§ 43a Abs. 7 BRAO, § 4 BORA).")}</p>
            </div>
            <Field label="IBAN (Anderkonto)" htmlFor="kr-anderIban" className="md:col-span-2" hint={<span id="kr-anderIban-hinweis">Ein eigenes Konto – nicht das Geschäftskonto. Die Prüfziffer wird beim Speichern geprüft.</span>}>
              {feld("anderIban", { autoCapitalize: "characters", inputMode: "text", hinweisId: "kr-anderIban-hinweis", className: "num" })}
            </Field>
            <Field label="Bank (Anderkonto)" htmlFor="kr-anderBank" hint="Optional">
              {feld("anderBank", { maxLength: 120 })}
            </Field>
          </div>
        </fieldset>

        {fehler.allgemein && (
          <div role="alert" className="rounded-[12px] bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal">
            {fehler.allgemein}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
          <span className="flex min-w-0 flex-1 basis-[220px] items-center gap-1.5 text-[12.5px] text-fg-3">
            <Info className="size-3.5 shrink-0" />
            {darf ? "Gilt für neue Rechnungen; bereits versandte Rechnungen bleiben unverändert. Jede Änderung steht im Protokoll." : "Die Rechnungsangaben ändern Partner und Administration Ihrer Kanzlei."}
          </span>
          {darf && (
            <div className="flex gap-2">
              {geaendert && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setF(gespeichert);
                    setFehler({});
                  }}
                >
                  Verwerfen
                </Button>
              )}
              <Button type="submit" variant="primary" disabled={!geaendert} loading={laeuft}>
                Rechnungsangaben speichern
              </Button>
            </div>
          )}
        </div>
      </form>
    </Abschnitt>
  );
}

/** Aktueller Kanzlei-Stand außerhalb des Renderns (für den verzögerten Fokus beim Direktsprung). */
function aktuellerTenant(): Tenant {
  const s = useSession.getState().sitzung;
  return s && !istConsole(s) ? s.tenant : ({} as Tenant);
}
