import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, CircleAlert, Eye, EyeOff, KeyRound, Loader2, Phone, Smartphone } from "lucide-react";
import { useSession } from "@/store/session";
import { useData } from "@/store/data";
import { PASSWORT_MIN, PasswortWechselNoetig, ZweiFaktorNoetig, getBackend, getInfo, istConsole, pruefeNeuesPasswort, type SchnellLogin } from "@/lib/backend";
import { Avatar, Button, Field, Input } from "@/components/ui";
import { CONSOLE_DEMO, DEMO_PASSWORT, DEMO_TENANTS } from "@/core/seed/tenants";
import { STANDARD_ANSPRECHPARTNER } from "@/core/seed/kunde";
import { ansprechBezeichnung } from "@/lib/rollen";
import { Wortmarke } from "@/components/Logo";
import { BEWEGUNG } from "@/lib/bewegung";

const BEISPIEL_STAEDTE = DEMO_TENANTS.map((t) => t.tenant.stadt).join(", ");
const AP = STANDARD_ANSPRECHPARTNER;

/** Anmeldung – jede Kanzlei hat eigene Zugänge und einen streng getrennten Datenbestand. */
export default function Login() {
  const { login, passwortErsetzen, sitzung, status } = useSession();
  const clear = useData((s) => s.clear);
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [zeigePw, setZeigePw] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState<string | null>(null);
  const [schnell, setSchnell] = useState<SchnellLogin[]>([]);
  /** Erste Anmeldung mit Startpasswort: eigenes Passwort festlegen */
  const [wechsel, setWechsel] = useState<{ email: string; start: string } | null>(null);
  const [neuPw, setNeuPw] = useState("");
  const [neuPw2, setNeuPw2] = useState("");
  /** Zweiter Schritt: Code aus der Authenticator-App */
  const [zweiFaktor, setZweiFaktor] = useState<{ email: string; vorgang: string } | null>(null);
  const [code, setCode] = useState("");
  const [mitWiederherstellung, setMitWiederherstellung] = useState(false);
  const [vergessen, setVergessen] = useState(false);
  const info = getInfo();

  useEffect(() => {
    if (info?.schnellLogin) getBackend().schnellLogins().then(setSchnell).catch(() => setSchnell([]));
  }, [info?.schnellLogin]);

  if (status === "angemeldet" && sitzung) return <Navigate to={istConsole(sitzung) ? "/console" : "/cockpit"} replace />;

  // Ein-Klick-Kacheln gibt es nur für die öffentlichen Beispielkanzleien (Demo-Passwort) und – im Browser-Demo – den Anbieterzugang.
  const beispiele = schnell.filter((s) => !s.console && s.passwort === DEMO_PASSWORT);
  const anbieter = schnell.filter((s) => s.console);
  const kacheln = [...beispiele, ...anbieter];

  const zumZweitenFaktor = (err: ZweiFaktorNoetig) => {
    setZweiFaktor({ email: err.email, vorgang: err.vorgang });
    setWechsel(null);
    setCode("");
    setMitWiederherstellung(false);
    setFehler(null);
  };

  const anmelden = async (e?: string, p?: string, key = "form") => {
    setFehler(null);
    setLaedt(key);
    try {
      clear();
      const s = await login(e ?? email, p ?? pw);
      nav(istConsole(s) ? "/console" : "/cockpit", { replace: true });
    } catch (err) {
      if (err instanceof PasswortWechselNoetig) {
        setWechsel({ email: err.email || (e ?? email), start: p ?? pw });
        setNeuPw("");
        setNeuPw2("");
        setZeigePw(false);
      } else if (err instanceof ZweiFaktorNoetig) zumZweitenFaktor(err);
      else setFehler(err instanceof Error ? err.message : "Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.");
    } finally {
      setLaedt(null);
    }
  };

  const eigenesPasswort = async () => {
    if (!wechsel) return;
    setFehler(null);
    const regel = pruefeNeuesPasswort(neuPw, wechsel.start);
    if (regel) return setFehler(regel);
    if (neuPw !== neuPw2) return setFehler("Die beiden Eingaben stimmen nicht überein. Bitte geben Sie das neue Passwort in beiden Feldern gleich ein.");
    setLaedt("wechsel");
    try {
      clear();
      const s = await passwortErsetzen(wechsel.email, wechsel.start, neuPw);
      nav(istConsole(s) ? "/console" : "/cockpit", { replace: true });
    } catch (err) {
      if (err instanceof ZweiFaktorNoetig) zumZweitenFaktor(err);
      else setFehler(err instanceof Error ? err.message : "Das Passwort konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.");
    } finally {
      setLaedt(null);
    }
  };

  const codeSenden = async () => {
    if (!zweiFaktor) return;
    setFehler(null);
    const c = code.trim();
    if (!mitWiederherstellung && !/^\d{6}$/.test(c.replace(/\s+/g, ""))) return setFehler("Bitte geben Sie die 6 Ziffern aus Ihrer Authenticator-App ein – ohne Buchstaben.");
    if (mitWiederherstellung && c.replace(/[\s-]/g, "").length !== 8) return setFehler("Ein Wiederherstellungscode hat 8 Zeichen, z. B. 7KQ4-M2XD. Bitte prüfen Sie die Eingabe.");
    setLaedt("code");
    try {
      clear();
      const s = await useSession.getState().zweiFaktorAnmelden(zweiFaktor.vorgang, c);
      nav(istConsole(s) ? "/console" : "/cockpit", { replace: true });
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.");
      setCode("");
    } finally {
      setLaedt(null);
    }
  };

  const zurueck = () => {
    setWechsel(null);
    setZweiFaktor(null);
    setFehler(null);
    setPw("");
    setCode("");
  };

  const fehlerHinweis = fehler && (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={BEWEGUNG.standard} className="banner banner-seal" role="alert">
      <CircleAlert aria-hidden />
      <span>{fehler}</span>
    </motion.div>
  );

  return (
    <div className="login-scroll relative z-10 h-full overflow-y-auto bg-[var(--bg)]">
      {/* Anmeldung (DESIGN-SYSTEM.md 14): Wortmarke oben mittig, Formular in einer Karte (400 px) auf --bg, ein Primärknopf */}
      <div className="mx-auto flex min-h-full w-full max-w-[432px] flex-col px-4 pb-10 pt-[max(40px,env(safe-area-inset-top))] sm:pt-16">
        <Link to="/willkommen" className="mx-auto mb-10 inline-flex min-h-11 items-center rounded-md px-2" aria-label="Apex – zur Startseite">
          <Wortmarke size={24} />
        </Link>

        <main className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
          {zweiFaktor ? (
            <motion.form
              key="zweifaktor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={BEWEGUNG.standard}
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void codeSenden();
              }}
            >
              <div>
                <Smartphone className="mb-3 size-5 text-fg-3" aria-hidden />
                <h1 className="title-lg">Code aus Ihrer Authenticator-App</h1>
                <p className="mt-1 text-[14px] leading-5 text-fg-3">
                  Ihr Passwort stimmt. Bitte geben Sie jetzt den 6-stelligen Code ein, den Ihre App für <span className="break-all font-medium text-fg-2">Apex · {zweiFaktor.email}</span> anzeigt.
                </p>
              </div>
              <label htmlFor="login-code" className="sr-only">
                {mitWiederherstellung ? "Wiederherstellungscode" : "6-stelliger Code"}
              </label>
              <Input
                id="login-code"
                autoFocus
                inputMode={mitWiederherstellung ? "text" : "numeric"}
                autoComplete="one-time-code"
                maxLength={mitWiederherstellung ? 12 : 7}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={mitWiederherstellung ? "z. B. 7KQ4-M2XD" : "123 456"}
                className="mono !h-14 text-center !text-[22px] tracking-[0.3em]"
              />
              {fehlerHinweis}
              <Button type="submit" variant="primary" size="lg" loading={laedt === "code"} iconRight={<ArrowRight className="size-4" />} className="w-full">
                Bestätigen und anmelden
              </Button>
              <button
                type="button"
                className="link min-h-11 justify-self-center text-[13px] font-medium sm:min-h-6"
                onClick={() => {
                  setMitWiederherstellung((v) => !v);
                  setCode("");
                  setFehler(null);
                }}
              >
                {mitWiederherstellung ? "Doch den Code aus der App verwenden" : "Telefon nicht zur Hand? Wiederherstellungscode verwenden"}
              </button>
              <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={zurueck}>
                Zurück zur Anmeldung
              </Button>
            </motion.form>
          ) : wechsel ? (
            <motion.form
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={BEWEGUNG.standard}
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void eigenesPasswort();
              }}
            >
              <div>
                <KeyRound className="mb-3 size-5 text-fg-3" aria-hidden />
                <h1 className="title-lg">Eigenes Passwort festlegen</h1>
                <p className="mt-1 text-[14px] leading-5 text-fg-3">
                  Sie melden sich zum ersten Mal mit dem Startpasswort an. Bitte vergeben Sie jetzt ein eigenes Passwort für <span className="break-all font-medium text-fg-2">{wechsel.email}</span>.
                </p>
              </div>
              <input type="email" autoComplete="username" value={wechsel.email} readOnly hidden />
              <Field label="Neues Passwort" htmlFor="login-neu">
                <div className="relative">
                  <Input id="login-neu" type={zeigePw ? "text" : "password"} autoComplete="new-password" required value={neuPw} onChange={(e) => setNeuPw(e.target.value)} aria-describedby="login-neu-regel" className="!pr-11 sm:!h-10" />
                  <AugeKnopf an={zeigePw} onClick={() => setZeigePw((v) => !v)} />
                </div>
              </Field>
              <Field label="Neues Passwort wiederholen" htmlFor="login-neu2">
                <Input id="login-neu2" type={zeigePw ? "text" : "password"} autoComplete="new-password" required value={neuPw2} onChange={(e) => setNeuPw2(e.target.value)} className="sm:!h-10" />
              </Field>
              <p id="login-neu-regel" className="-mt-1 text-[13px] leading-5 text-fg-3">
                Mindestens {PASSWORT_MIN} Zeichen mit Buchstaben und mindestens einer Ziffer – anders als das Startpasswort.
              </p>
              {fehlerHinweis}
              <Button type="submit" variant="primary" size="lg" loading={laedt === "wechsel"} iconRight={<ArrowRight className="size-4" />} className="w-full">
                Passwort speichern und anmelden
              </Button>
              <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={zurueck}>
                Zurück zur Anmeldung
              </Button>
            </motion.form>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="title-xl">Anmelden</h1>
                <p className="mt-1 text-[14px] leading-5 text-fg-3">Mit dem Zugang Ihrer Kanzlei.</p>
              </div>
              <form
                className="grid gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void anmelden();
                }}
              >
                <Field label="E-Mail-Adresse" htmlFor="login-email">
                  <Input id="login-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@kanzlei.de" className="sm:!h-10" />
                </Field>
                <div>
                  <div className="mb-1.5 flex items-end justify-between gap-3">
                    <label htmlFor="login-passwort" className="label !mb-0">
                      Passwort
                    </label>
                    <button type="button" aria-expanded={vergessen} aria-controls="pw-vergessen" onClick={() => setVergessen((v) => !v)} className="link-leise -my-3 min-h-11 sm:-my-1 sm:min-h-6">
                      Passwort vergessen?
                    </button>
                  </div>
                  <div className="relative">
                    <Input id="login-passwort" type={zeigePw ? "text" : "password"} autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} className="!pr-11 sm:!h-10" />
                    <AugeKnopf an={zeigePw} onClick={() => setZeigePw((v) => !v)} />
                  </div>
                </div>
                <AnimatePresence initial={false}>
                  {vergessen && (
                    <motion.div id="pw-vergessen" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={BEWEGUNG.standard} className="overflow-hidden">
                      <div className="banner flex-col !gap-1.5 text-[13px] leading-5">
                        <p>
                          Ein neues Startpasswort vergibt Ihre Kanzleiverwaltung (Partner oder Administration unter <span className="font-medium text-fg">Einstellungen → Team</span>) – bei Testzugängen Ihre {ansprechBezeichnung(AP)} {AP.name}, Tel.{" "}
                          <a href={`tel:${AP.telefon.replace(/\s+/g, "")}`} className="link font-medium">
                            {AP.telefon}
                          </a>
                          , {AP.verfuegbar}.
                        </p>
                        <p className="flex items-start gap-1.5 text-fg-3">
                          <Phone className="mt-[3px] size-3.5 shrink-0" aria-hidden /> Aus Sicherheitsgründen versendet Apex keine Passwörter per E-Mail.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {fehlerHinweis}
                <Button type="submit" variant="primary" size="lg" loading={laedt === "form"} iconRight={<ArrowRight className="size-4" />} className="mt-1 w-full">
                  Anmelden
                </Button>
              </form>

              {kacheln.length > 0 && (
                <section aria-labelledby="demo-titel" className="mt-8 border-t border-[var(--line)] pt-6">
                  <h2 id="demo-titel" className="text-[13px] font-medium text-fg-3">
                    Öffentliche Demo
                  </h2>
                  <ul className="mt-2 divide-y divide-[var(--line)]">
                    {kacheln.map((s) => (
                      <li key={s.email}>
                        <button
                          type="button"
                          onClick={() => {
                            setEmail(s.email);
                            setPw(s.passwort);
                            void anmelden(s.email, s.passwort, s.email);
                          }}
                          className="group -mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors duration-100 hover:bg-[var(--surface-2)] focus-visible:outline-offset-[-2px]"
                        >
                          <Avatar initialen={s.initialen} size={32} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium leading-5 text-fg">{s.kanzlei}</span>
                            <span className="block truncate text-[13px] leading-[18px] text-fg-3">
                              {s.name} · {s.stadt}
                            </span>
                          </span>
                          {laedt === s.email ? <Loader2 className="size-4 animate-spin text-fg-3 motion-reduce:animate-none" aria-label="Anmeldung läuft" /> : <ArrowRight className="size-4 text-fg-4 transition-colors duration-100 group-hover:text-fg" aria-hidden />}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 grid gap-2 text-[13px] leading-5 text-fg-3">
                    <p>
                      Ein Klick meldet direkt an – das gilt nur für die <span className="font-medium text-fg-2">Beispielkanzleien mit öffentlichem Demo-Passwort</span>. Jede Kanzlei sieht ausschließlich ihre eigenen Daten. Zugänge mit eigenem Passwort (auch Kundentests) melden sich immer mit E-Mail-Adresse und Passwort an.
                    </p>
                    <div>
                      <p className="font-medium text-fg-2">Öffentliche Demo-Passwörter für die Anmeldung von Hand:</p>
                      <ul className="mt-1 grid gap-0.5">
                        <li>
                          Beispielkanzleien ({BEISPIEL_STAEDTE}): <span className="mono whitespace-nowrap text-fg-2">{DEMO_PASSWORT}</span>
                        </li>
                        {anbieter.length > 0 && (
                          <li>
                            Anbieterzugang (Apex Console, nur Demo): <span className="mono whitespace-nowrap text-fg-2">{CONSOLE_DEMO.passwort}</span>
                          </li>
                        )}
                      </ul>
                    </div>
                    {info?.modus === "demo" && <p>{info.speicherDauerhaft === false ? "Demo-Modus: Änderungen gelten nur für diese Sitzung – der Browser-Speicher ist hier nicht verfügbar." : "Demo-Modus: Ihre Änderungen bleiben in diesem Browser gespeichert."}</p>}
                  </div>
                </section>
              )}
            </>
          )}
        </main>

        <p className="mt-8 text-center text-[13px] leading-5 text-fg-4">Die Kanzlei-Software, die mitdenkt.</p>
      </div>
    </div>
  );
}

/** Passwort anzeigen/verbergen: Trefferfläche über die ganze Feldhöhe (Telefon 44 × 44 px, Desktop 40 × 40 px). */
function AugeKnopf({ an, onClick }: { an: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-fg-3 transition-colors duration-100 hover:text-fg focus-visible:outline-offset-[-2px] sm:w-10"
      aria-label={an ? "Passwort verbergen" : "Passwort anzeigen"}
      title={an ? "Passwort verbergen" : "Passwort anzeigen"}
    >
      {an ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
}
