import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { RefreshCw } from "lucide-react";
import { create } from "zustand";
import { toast } from "@/store/ui";
import { useKanzlei } from "@/store/session";
import { cn } from "@/lib/cn";
import { ABRUF_MINUTEN, SIMULIERT_STATUS, letzterAbrufMs } from "@/lib/betriebsstatus";

// Zeitpunkt des letzten Abrufs „Jetzt abrufen“ – bleibt beim Seitenwechsel erhalten. Sonst gilt der automatische Takt
// (alle 2 Min.), derselbe wie im Cockpit und im Systemstatus.
const useAbruf = create<{ zuletzt: number; laeuft: boolean }>(() => ({ zuletzt: 0, laeuft: false }));

function seit(ms: number, jetzt: number) {
  const min = Math.floor((jetzt - ms) / 60_000);
  if (min < 1) return "gerade eben";
  if (min === 1) return "vor 1 Min.";
  return `vor ${min} Min.`;
}

function Punkt({ aktiv }: { aktiv: boolean }) {
  return (
    <span className="relative flex size-1.5 shrink-0">
      <span className={cn("relative inline-flex size-1.5 rounded-full", aktiv ? "bg-[var(--green)]" : "bg-[var(--amber)]")} />
    </span>
  );
}

/** Verbindungsstatus für beA & E-Mail – im Prototyp ehrlich als „simuliert“ gekennzeichnet (keine echte Anbindung). */
export function Verbindungsstatus({ className }: { className?: string }) {
  const { zuletzt: manuell, laeuft } = useAbruf();
  const { user } = useKanzlei();
  const domain = user.email.split("@")[1] ?? "";
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setJetzt(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);

  const zuletzt = Math.max(manuell, letzterAbrufMs(jetzt));
  const abrufen = () => {
    if (useAbruf.getState().laeuft) return;
    useAbruf.setState({ laeuft: true });
    setTimeout(() => {
      useAbruf.setState({ laeuft: false, zuletzt: Date.now() });
      setJetzt(Date.now());
      toast("Postfach aktuell", { text: "Simulierter Abruf von beA und E-Mail – keine neuen Nachrichten. Im Prototyp ist kein echtes Postfach angebunden.", ton: "info" });
    }, 1200);
  };

  return (
    <div className={cn("flex min-w-0 items-center gap-2 sm:gap-4", className)} aria-live="polite">
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 sm:flex sm:items-center sm:gap-4">
        <div className="flex min-w-0 items-center gap-2" title={`${SIMULIERT_STATUS} – im Echtbetrieb: besonderes elektronisches Anwaltspostfach, Abruf alle ${ABRUF_MINUTEN} Minuten, Zustellungen mit Zeitstempel`}>
          <Punkt aktiv={!laeuft} />
          <div className="min-w-0 leading-tight">
            <div className="text-[13px] font-medium text-fg">beA (simuliert)</div>
            <div className="num text-[13px] text-fg-3">{laeuft ? "Abfrage läuft …" : `Abfrage ${seit(zuletzt, jetzt)}`}</div>
          </div>
        </div>
        <div className="hidden h-7 w-px bg-[var(--line)] sm:block" />
        <div className="flex min-w-0 items-center gap-2" title={`Im Prototyp simuliert – im Echtbetrieb: E-Mail-Postfach über Microsoft 365${domain ? ` (@${domain})` : ""}, verschlüsselt (TLS)`}>
          <Punkt aktiv={!laeuft} />
          <div className="min-w-0 leading-tight">
            <div className="text-[13px] font-medium text-fg">E-Mail (simuliert)</div>
            <div className="text-[13px] text-fg-3">
              Microsoft 365<span className="hidden 2xl:inline">{domain ? ` · @${domain}` : ""}</span>
            </div>
          </div>
        </div>
      </div>
      <button type="button" onClick={abrufen} disabled={laeuft} className="btn btn-sm btn-ghost shrink-0 !px-2.5 sm:!px-3" aria-label="Postfach jetzt abrufen" title="Postfach jetzt abrufen">
        <motion.span animate={laeuft ? { rotate: 360 } : { rotate: 0 }} transition={laeuft ? { repeat: Infinity, duration: 0.8, ease: "linear" } : { duration: 0 }} className="inline-flex">
          <RefreshCw className="size-4" />
        </motion.span>
        <span className="hidden sm:inline">{laeuft ? "Ruft ab …" : "Jetzt abrufen"}</span>
      </button>
    </div>
  );
}
