import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, KeyRound, Link2, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { getBackend, type ZweiFaktorEinrichtung as Einrichtung, type ZweiFaktorStatus } from "@/lib/backend";
import { schluesselGruppiert } from "@/core/totp";
import { fmtDate, nowLocal, uid } from "@/core/dates";
import { kopiereText } from "@/lib/zwischenablage";
import { useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Chip, Input } from "@/components/ui";
import { cn } from "@/lib/cn";

async function kopieren(text: string, was: string) {
  const ok = (await kopiereText(text)) === "kopiert";
  toast(ok ? `${was} kopiert` : "Kopieren nicht möglich", { text: ok ? "In der Zwischenablage – jetzt in der Authenticator-App einfügen." : "Bitte markieren und mit Strg+C bzw. ⌘C kopieren.", ton: ok ? "erfolg" : "warnung" });
}

/** Das Backend hat den Vorgang bereits im Kanzleiprotokoll festgehalten – hier nur sofort sichtbar machen. */
function protokolliere(text: string, userId: string) {
  if (useData.getState().status !== "bereit") return;
  useData.getState().einfuegenLokal("aktivitaeten", { id: uid("ak"), zeit: nowLocal(), akteur: "nutzer", userId, text });
}

/**
 * Zwei-Faktor-Anmeldung (TOTP) einrichten, anzeigen und abschalten. Schlüssel als Base32 zum Abtippen und otpauth-Link zum
 * Kopieren, Bestätigung durch den ersten Code, Wiederherstellungscodes einmalig. `pflichtModus`: Einrichtung vor dem ersten Arbeiten.
 */
export function ZweiFaktorEinrichtung({ pflichtModus, onFertig, onStatus }: { pflichtModus?: boolean; onFertig?: () => void; onStatus?: (s: ZweiFaktorStatus) => void }) {
  const { user } = useKanzlei();
  const [status, setStatus] = useState<ZweiFaktorStatus | null>(null);
  const [einrichtung, setEinrichtung] = useState<Einrichtung | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [abschalten, setAbschalten] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  const laden = async () => {
    try {
      setStatus(await getBackend().zweiFaktor.status());
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Der Status konnte nicht geladen werden. Bitte laden Sie die Seite neu.");
    }
  };
  useEffect(() => {
    void laden();
  }, []);
  useEffect(() => {
    if (status) onStatus?.(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const starten = async () => {
    setFehler(null);
    setLaedt(true);
    try {
      setEinrichtung(await getBackend().zweiFaktor.einrichten());
      setCode("");
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Die Einrichtung konnte nicht gestartet werden. Bitte versuchen Sie es erneut.");
    } finally {
      setLaedt(false);
    }
  };

  const bestaetigen = async () => {
    setFehler(null);
    if (!/^\d{6}$/.test(code.replace(/\s+/g, ""))) return setFehler("Bitte geben Sie die 6 Ziffern ein, die Ihre App jetzt anzeigt – ohne Buchstaben.");
    setLaedt(true);
    try {
      const r = await getBackend().zweiFaktor.bestaetigen(code);
      setCodes(r.wiederherstellungscodes);
      setEinrichtung(null);
      setCode("");
      protokolliere(`Zwei-Faktor-Anmeldung eingerichtet – ${user.name}`, user.id);
      toast("Zwei-Faktor-Anmeldung eingerichtet", { text: "Ab der nächsten Anmeldung fragt AnwaltApex nach dem Code.", ton: "erfolg" });
      await laden();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Der Code konnte nicht geprüft werden. Bitte versuchen Sie es erneut.");
    } finally {
      setLaedt(false);
    }
  };

  const deaktivieren = async () => {
    setFehler(null);
    if (!code.trim()) return setFehler("Bitte geben Sie den aktuellen Code aus Ihrer App oder einen Wiederherstellungscode ein.");
    setLaedt(true);
    try {
      await getBackend().zweiFaktor.deaktivieren(code);
      setAbschalten(false);
      setCode("");
      protokolliere(`Zwei-Faktor-Anmeldung deaktiviert – ${user.name}`, user.id);
      toast("Zwei-Faktor-Anmeldung abgeschaltet", { text: "Die Anmeldung erfolgt wieder nur mit Passwort.", ton: "warnung" });
      await laden();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das Abschalten ist fehlgeschlagen. Bitte versuchen Sie es erneut.");
    } finally {
      setLaedt(false);
    }
  };

  if (!status) return <div className="shimmer h-24 rounded-[16px]" aria-label="wird geladen" />;

  // Wiederherstellungscodes – nur jetzt sichtbar
  if (codes) {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3">
        <div className="flex items-start gap-2.5 rounded-[14px] bg-green-soft px-3.5 py-3 text-[13px] text-fg-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-green" />
          <span>
            <span className="font-semibold text-fg">Eingerichtet.</span> Bewahren Sie diese Wiederherstellungscodes sicher auf (z. B. ausgedruckt im Tresor). Jeder Code gilt einmal – für den Fall, dass Ihr Telefon nicht zur Hand ist. <span className="font-semibold">Sie werden nur jetzt angezeigt.</span>
          </span>
        </div>
        <ul className="grid grid-cols-2 gap-2 rounded-[14px] bg-[var(--surface-2)] p-3 ring-1 ring-[var(--line)] sm:grid-cols-4" aria-label="Wiederherstellungscodes">
          {codes.map((c) => (
            <li key={c} className="mono select-all text-center text-[14px] font-semibold tracking-[0.04em]">
              {c}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={<Copy className="size-3.5" />} onClick={() => void kopieren(codes.join("\n"), "Wiederherstellungscodes")}>
            Codes kopieren
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<Check className="size-3.5" />}
            onClick={() => {
              setCodes(null);
              onFertig?.();
            }}
          >
            Codes sicher aufbewahrt
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {status.aktiv ? (
          <Chip tone="green" dot>
            Eingerichtet{status.eingerichtetAm ? ` seit ${fmtDate(status.eingerichtetAm.slice(0, 10))}` : ""}
          </Chip>
        ) : (
          <Chip tone={status.pflicht ? "seal" : "amber"} dot>
            {status.pflicht ? "Nicht eingerichtet – von Ihrer Kanzlei verlangt" : "Nicht eingerichtet"}
          </Chip>
        )}
        {status.aktiv && status.wiederherstellungUebrig !== undefined && (
          <span className="text-[13px] text-fg-3">
            {status.wiederherstellungUebrig} von 8 Wiederherstellungscodes übrig
          </span>
        )}
      </div>

      {status.gesperrt && <p className="rounded-[12px] bg-amber-soft px-3.5 py-2.5 text-[13px] text-fg-2">{status.gesperrt}</p>}

      {!status.aktiv && !einrichtung && !status.gesperrt && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 basis-[240px] text-[13px] leading-relaxed text-fg-2">
            Nach dem Passwort fragt AnwaltApex zusätzlich nach einem 6-stelligen Code aus einer Authenticator-App auf Ihrem Telefon (z. B. FreeOTP, Aegis, Microsoft oder Google Authenticator). Ein gestohlenes Passwort allein genügt dann nicht.
          </p>
          <Button variant="primary" icon={<Smartphone className="size-4" />} loading={laedt} onClick={() => void starten()}>
            Zwei-Faktor einrichten
          </Button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {einrichtung && (
          <motion.form
            key="einrichtung"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="grid gap-3 overflow-hidden"
            onSubmit={(e) => {
              e.preventDefault();
              void bestaetigen();
            }}
          >
            <ol className="grid gap-2.5 text-[13px] leading-relaxed text-fg-2">
              <li>
                <span className="font-semibold text-fg">1.</span> Öffnen Sie Ihre Authenticator-App und fügen Sie ein Konto hinzu („Schlüssel eingeben“ bzw. „Einrichtungsschlüssel“).
              </li>
              <li>
                <span className="font-semibold text-fg">2.</span> Tippen Sie den Schlüssel ab – oder kopieren Sie den Einrichtungslink, wenn die App auf diesem Gerät läuft.
              </li>
            </ol>
            <div className="grid gap-2 rounded-[14px] bg-[var(--surface-2)] p-3 ring-1 ring-[var(--line)]">
              <div className="flex items-center gap-2 text-[12.5px] font-medium text-fg-3">
                <KeyRound className="size-3.5" /> Geheimer Schlüssel (Base32, zeitbasiert, 6 Ziffern, 30 s)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mono min-w-0 flex-1 select-all break-all text-[16px] font-semibold tracking-[0.06em]">{schluesselGruppiert(einrichtung.schluessel)}</span>
                <Button size="sm" variant="secondary" icon={<Copy className="size-3.5" />} onClick={() => void kopieren(einrichtung.schluessel, "Schlüssel")}>
                  Schlüssel kopieren
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-2">
                <Link2 className="size-3.5 shrink-0 text-fg-3" />
                <span className="mono min-w-0 flex-1 truncate text-[12.5px] text-fg-3" title={einrichtung.uri}>
                  {einrichtung.uri}
                </span>
                <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" />} onClick={() => void kopieren(einrichtung.uri, "Einrichtungslink")}>
                  Link kopieren
                </Button>
              </div>
            </div>
            <label htmlFor="zf-code" className="text-[13px] text-fg-2">
              <span className="font-semibold text-fg">3.</span> Geben Sie den ersten Code ein, den die App anzeigt:
            </label>
            <div className="flex flex-wrap gap-2">
              <Input id="zf-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123 456" className="mono !w-[160px] text-center !text-[18px] tracking-[0.25em]" />
              <Button type="submit" variant="primary" icon={<ShieldCheck className="size-4" />} loading={laedt}>
                Bestätigen
              </Button>
              {!pflichtModus && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEinrichtung(null);
                    setFehler(null);
                  }}
                >
                  Abbrechen
                </Button>
              )}
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {status.aktiv && !pflichtModus && (
        <div className="grid gap-2">
          {!abschalten ? (
            <div>
              <Button size="sm" variant="ghost" icon={<ShieldOff className="size-3.5" />} disabled={status.pflicht} title={status.pflicht ? "Ihre Kanzlei verlangt die Zwei-Faktor-Anmeldung – abschalten ist nicht möglich." : undefined} onClick={() => setAbschalten(true)}>
                Zwei-Faktor abschalten
              </Button>
              {status.pflicht && <p className="mt-1 text-[13px] text-fg-3">Ihre Kanzlei verlangt die Zwei-Faktor-Anmeldung für alle. Bei einem neuen Telefon setzen Partner oder Administration sie unter „Team“ zurück.</p>}
            </div>
          ) : (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void deaktivieren();
              }}
            >
              <label htmlFor="zf-aus" className="w-full text-[13px] text-fg-2">
                Zum Abschalten den aktuellen Code oder einen Wiederherstellungscode eingeben:
              </label>
              <Input id="zf-aus" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code" className="mono !w-[180px]" />
              <Button type="submit" size="sm" variant="danger" loading={laedt}>
                Abschalten
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAbschalten(false);
                  setCode("");
                  setFehler(null);
                }}
              >
                Abbrechen
              </Button>
            </form>
          )}
        </div>
      )}

      {fehler && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert" className={cn("rounded-[12px] bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal")}>
          {fehler}
        </motion.div>
      )}
    </div>
  );
}
