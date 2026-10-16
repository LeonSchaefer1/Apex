import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, KeyRound, Lock, Mail, ShieldCheck, Sparkles, Infinity as InfinityIcon, Building2, Eye, EyeOff } from "lucide-react";
import { useSession } from "@/store/session";
import { useData } from "@/store/data";
import { PASSWORT_MIN, PasswortWechselNoetig, getBackend, getInfo, istConsole, pruefeNeuesPasswort, type SchnellLogin } from "@/lib/backend";
import { Avatar, Button, Chip, Input } from "@/components/ui";
import { CONSOLE_DEMO, DEMO_PASSWORT, DEMO_TENANTS } from "@/core/seed/tenants";
import { AppIcon, Wordmark } from "@/components/Logo";
import { cn } from "@/lib/cn";

const BEISPIEL_STAEDTE = DEMO_TENANTS.map((t) => t.tenant.stadt).join(", ");

type ZugangArt = "console" | "beispiel" | "beispiel-eigenes-pw" | "kundentest";
function zugangArt(s: SchnellLogin): ZugangArt {
  if (s.console) return "console";
  if (s.kundentest) return "kundentest";
  return s.passwort === DEMO_PASSWORT ? "beispiel" : "beispiel-eigenes-pw";
}

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
  const info = getInfo();

  useEffect(() => {
    if (info?.schnellLogin) getBackend().schnellLogins().then(setSchnell).catch(() => setSchnell([]));
  }, [info?.schnellLogin]);

  if (status === "angemeldet" && sitzung) return <Navigate to={istConsole(sitzung) ? "/console" : "/cockpit"} replace />;

  const arten = new Set(schnell.map(zugangArt));
  const mitEigenen = arten.has("kundentest") || arten.has("beispiel-eigenes-pw");

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
      } else setFehler(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setLaedt(null);
    }
  };

  const eigenesPasswort = async () => {
    if (!wechsel) return;
    setFehler(null);
    const regel = pruefeNeuesPasswort(neuPw, wechsel.start);
    if (regel) return setFehler(regel);
    if (neuPw !== neuPw2) return setFehler("Die beiden Eingaben stimmen nicht überein.");
    setLaedt("wechsel");
    try {
      clear();
      const s = await passwortErsetzen(wechsel.email, wechsel.start, neuPw);
      nav(istConsole(s) ? "/console" : "/cockpit", { replace: true });
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Das Passwort konnte nicht gespeichert werden.");
    } finally {
      setLaedt(null);
    }
  };

  return (
    <div className="relative z-10 h-full overflow-y-auto">
      <div className="mx-auto grid min-h-full w-full max-w-[1200px] items-center gap-10 px-[max(16px,env(safe-area-inset-left))] py-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="order-2 lg:order-1">
          <Link to="/willkommen" className="mb-8 inline-flex items-center gap-3">
            <AppIcon size={44} />
            <Wordmark size={22} />
          </Link>
          <h1 className="text-[clamp(32px,4.4vw,52px)] font-bold leading-[1.02] tracking-[-0.045em]">
            Die Kanzlei-Software,
            <br />
            <span className="ai-text">die mitdenkt.</span>
          </h1>
          <p className="mt-5 max-w-[46ch] text-[16px] leading-relaxed text-fg-2">
            Ein Werkzeug, volle Kontrolle: Akten, beA, Fristen, Abrechnung und eine KI, die passende Präzedenzfälle in Sekunden findet. Einmal investieren, dauerhaft nutzen.
          </p>
          <ul className="mt-8 grid max-w-[520px] gap-3 sm:grid-cols-2">
            {[
              { icon: <Sparkles className="size-4" />, t: "KI-Fallanalyse", s: "Erfolgsaussicht & Präzedenzfälle" },
              { icon: <ShieldCheck className="size-4" />, t: "Fristen mit Rechenweg", s: "§ 222 ZPO, Vier-Augen-Prinzip" },
              { icon: <InfinityIcon className="size-4" />, t: "Lifetime-Lizenz", s: "Keine Monatsgebühren" },
              { icon: <Building2 className="size-4" />, t: "Ihr Ansprechpartner", s: "Direkt erreichbar – ohne Hotline" },
            ].map((x, i) => (
              <motion.li key={x.t} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.07 }} className="glass-thin flex items-start gap-3 rounded-[18px] p-3.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-ink-soft text-ink">{x.icon}</span>
                <span>
                  <span className="block text-[13.5px] font-semibold">{x.t}</span>
                  <span className="block text-[12px] text-fg-3">{x.s}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 26, delay: 0.1 }}
          className="order-1 lg:order-2"
        >
          <div className="glass-strong glow rounded-[32px] p-6 sm:p-8" style={{ boxShadow: "var(--glass-shadow-lg)" }}>
            {wechsel ? (
              <motion.form
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid gap-3.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void eigenesPasswort();
                }}
              >
                <div className="mb-2.5 flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-ink-soft text-ink">
                    <KeyRound className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="title-lg">Eigenes Passwort festlegen</h2>
                    <p className="mt-1 text-[13px] text-fg-3">
                      Sie melden sich zum ersten Mal mit dem Startpasswort an. Bitte vergeben Sie jetzt ein eigenes Passwort für <span className="break-all font-medium text-fg-2">{wechsel.email}</span>.
                    </p>
                  </div>
                </div>
                <input type="email" autoComplete="username" value={wechsel.email} readOnly hidden />
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-4" />
                  <Input id="login-neu" type={zeigePw ? "text" : "password"} autoComplete="new-password" required value={neuPw} onChange={(e) => setNeuPw(e.target.value)} placeholder="Neues Passwort" aria-label="Neues Passwort" className="!h-12 !pl-10 !pr-11" />
                  <button type="button" onClick={() => setZeigePw((v) => !v)} className="icon-btn absolute right-1.5 top-1/2 !size-9 -translate-y-1/2" aria-label={zeigePw ? "Passwort verbergen" : "Passwort anzeigen"}>
                    {zeigePw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-4" />
                  <Input id="login-neu2" type={zeigePw ? "text" : "password"} autoComplete="new-password" required value={neuPw2} onChange={(e) => setNeuPw2(e.target.value)} placeholder="Neues Passwort wiederholen" aria-label="Neues Passwort wiederholen" className="!h-12 !pl-10" />
                </div>
                <p className="text-[12px] text-fg-3">Mindestens {PASSWORT_MIN} Zeichen mit Buchstaben und mindestens einer Ziffer – anders als das Startpasswort.</p>
                {fehler && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-[12px] bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal" role="alert">
                    {fehler}
                  </motion.div>
                )}
                <Button type="submit" variant="primary" size="lg" loading={laedt === "wechsel"} iconRight={<ArrowRight className="size-4" />} className="mt-1 w-full">
                  Passwort speichern und anmelden
                </Button>
                <Button
                  variant="ghost"
                  icon={<ArrowLeft className="size-4" />}
                  onClick={() => {
                    setWechsel(null);
                    setFehler(null);
                    setPw("");
                  }}
                >
                  Zurück zur Anmeldung
                </Button>
              </motion.form>
            ) : (
            <>
            <div className="mb-6">
              <h2 className="title-lg">Anmelden</h2>
              <p className="mt-1 text-[13px] text-fg-3">Mit dem Zugang Ihrer Kanzlei.</p>
            </div>
            <form
              className="grid gap-3.5"
              onSubmit={(e) => {
                e.preventDefault();
                void anmelden();
              }}
            >
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-4" />
                <Input id="login-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail-Adresse" className="!h-12 !pl-10" />
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-4" />
                <Input id="login-passwort" type={zeigePw ? "text" : "password"} autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Passwort" className="!h-12 !pl-10 !pr-11" />
                <button type="button" onClick={() => setZeigePw((v) => !v)} className="icon-btn absolute right-1.5 top-1/2 !size-9 -translate-y-1/2" aria-label={zeigePw ? "Passwort verbergen" : "Passwort anzeigen"}>
                  {zeigePw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {fehler && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-[12px] bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal" role="alert">
                  {fehler}
                </motion.div>
              )}
              <Button type="submit" variant="primary" size="lg" loading={laedt === "form"} iconRight={<ArrowRight className="size-4" />} className="mt-1 w-full">
                Anmelden
              </Button>
            </form>

            {schnell.length > 0 && (
              <div className="mt-7">
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[var(--line)]" />
                  <span className="eyebrow">Testzugänge</span>
                  <div className="h-px flex-1 bg-[var(--line)]" />
                </div>
                <div className="grid gap-2">
                  {schnell.map((s) => (
                    <button
                      key={s.email}
                      type="button"
                      onClick={() => {
                        setEmail(s.email);
                        setPw(s.passwort);
                        void anmelden(s.email, s.passwort, s.email);
                      }}
                      className={cn(
                        "glow group relative flex items-center gap-3 rounded-[18px] p-2.5 pr-3.5 text-left ring-1 ring-[var(--line)] transition-all duration-300 ease-[var(--spring)] hover:-translate-y-0.5 hover:bg-[var(--surface)] hover:shadow-glass active:scale-[0.99]",
                        s.console && "bg-[var(--ink-softer)]",
                      )}
                    >
                      <Avatar initialen={s.initialen} farbe={s.farbe} size={38} />
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-[13.5px] font-semibold">{s.kanzlei}</span>
                          {zugangArt(s) === "kundentest" && (
                            <Chip tone="ink" className="!h-[19px] shrink-0 !px-1.5 !text-[10.5px]" title="In der Apex Console angelegter Testzugang – eigenes Passwort">
                              Kundentest
                            </Chip>
                          )}
                          {zugangArt(s) === "beispiel-eigenes-pw" && (
                            <Chip tone="amber" className="!h-[19px] shrink-0 !px-1.5 !text-[10.5px]" title="In der Apex Console wurde ein neues Passwort vergeben">
                              neues Passwort
                            </Chip>
                          )}
                        </span>
                        <span className="block truncate text-[12px] text-fg-3">
                          {s.name} · {s.stadt}
                        </span>
                      </span>
                      {laedt === s.email ? (
                        <span className="size-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />
                      ) : (
                        <ArrowRight className="size-4 text-fg-4 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="mt-3 text-[11.5px] leading-snug text-fg-4">
                  <p>Ein Klick meldet direkt an. Jede Testkanzlei sieht ausschließlich ihre eigenen Daten.</p>
                  <p className="mt-1.5 font-medium text-fg-3">Passwörter für die Anmeldung von Hand:</p>
                  <ul className="mt-1 grid gap-0.5">
                    <li>
                      Beispielkanzleien ({BEISPIEL_STAEDTE}): <span className="mono text-fg-3">{DEMO_PASSWORT}</span>
                    </li>
                    {arten.has("console") && (
                      <li>
                        Apex Console: <span className="mono text-fg-3">{CONSOLE_DEMO.passwort}</span>
                      </li>
                    )}
                    {mitEigenen && <li>Kundentests und neu vergebene Passwörter: das in der Apex Console angezeigte Passwort</li>}
                  </ul>
                  {info?.modus === "demo" && <p className="mt-1.5">Demo-Modus: Ihre Änderungen bleiben in diesem Browser gespeichert.</p>}
                </div>
              </div>
            )}
            </>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
