import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Eye, EyeOff, Lock, LogOut, Unlock } from "lucide-react";
import { useKanzlei, useSession, sperreMinutenFuer } from "@/store/session";
import { useData } from "@/store/data";
import { Avatar, Button, Input } from "@/components/ui";
import { AppIcon } from "@/components/Logo";

/**
 * Sperre bei Inaktivität: liegt deckend über der App – Inhalte sind unsichtbar (die App darunter ist zusätzlich inert).
 * Weiter geht es nur mit dem eigenen Passwort oder per Abmelden.
 */
export function Sperrbildschirm() {
  const sitzung = useKanzlei();
  const { user, tenant } = sitzung;
  const minuten = sperreMinutenFuer(sitzung);
  const [pw, setPw] = useState("");
  const [zeige, setZeige] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const feld = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => feld.current?.focus(), 50);
  }, []);

  const entsperren = async () => {
    setFehler(null);
    if (!pw) return setFehler("Bitte geben Sie Ihr Passwort ein.");
    setLaedt(true);
    try {
      await useSession.getState().entsperren(pw);
      setPw("");
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das Entsperren ist fehlgeschlagen. Bitte versuchen Sie es erneut.");
    } finally {
      setLaedt(false);
    }
  };

  const abmelden = async () => {
    await useSession.getState().logout();
    useData.getState().clear();
  };

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-[var(--bg)] px-4 py-8" role="dialog" aria-modal="true" aria-labelledby="sperre-titel">
      <div className="aura" aria-hidden>
        <i />
        <i />
        <i />
        <i />
      </div>
      <motion.form
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        className="glass-strong relative z-10 w-full max-w-[420px] rounded-[30px] p-6 sm:p-8"
        style={{ boxShadow: "var(--glass-shadow-lg)" }}
        onSubmit={(e) => {
          e.preventDefault();
          void entsperren();
        }}
      >
        <div className="flex items-center gap-3">
          <AppIcon size={34} />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-2.5 py-1 text-[13px] font-medium text-fg-2">
            <Lock className="size-3.5 text-amber" /> Gesperrt
          </span>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <Avatar initialen={user.initialen} farbe={user.farbe} size={48} />
          <div className="min-w-0">
            <h1 id="sperre-titel" className="title-lg truncate">
              {user.name}
            </h1>
            <p className="truncate text-[13px] text-fg-3">{tenant.kurzname}</p>
          </div>
        </div>
        <p className="mt-4 text-[13.5px] leading-relaxed text-fg-2">
          AnwaltApex wurde nach {minuten ?? 15} Minuten ohne Aktivität gesperrt – zum Schutz der Mandantendaten. Bitte melden Sie sich mit Ihrem Passwort wieder an.
        </p>
        <input type="email" autoComplete="username" value={user.email} readOnly hidden />
        <div className="relative mt-4">
          <label htmlFor="sperre-pw" className="sr-only">
            Passwort
          </label>
          <Input ref={feld} id="sperre-pw" type={zeige ? "text" : "password"} autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Passwort" className="!h-12 !pr-11" />
          <button type="button" onClick={() => setZeige((v) => !v)} className="icon-btn absolute right-1.5 top-1/2 !size-9 -translate-y-1/2" aria-label={zeige ? "Passwort verbergen" : "Passwort anzeigen"}>
            {zeige ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {fehler && (
          <div role="alert" className="mt-3 rounded-[12px] bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal">
            {fehler}
          </div>
        )}
        <Button type="submit" variant="primary" size="lg" loading={laedt} icon={<Unlock className="size-4" />} className="mt-4 w-full">
          Entsperren
        </Button>
        <Button variant="ghost" icon={<LogOut className="size-4" />} className="mt-2 w-full" onClick={() => void abmelden()}>
          Abmelden
        </Button>
        <p className="mt-3 text-center text-[13px] text-fg-3">Die Dauer bis zur Sperre legen Partner und Administration unter Einstellungen → Datenschutz fest.</p>
      </motion.form>
    </div>
  );
}
