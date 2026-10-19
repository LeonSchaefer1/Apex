import { useEffect, useMemo, useState } from "react";
import { MotionConfig } from "motion/react";
import { PageHeader, Segmented } from "@/components/ui";
import { FristAutomatikHinweis } from "@/components/FristAutomatikHinweis";
import { darfAbrechnung } from "@/lib/backend";
import { fmtDateLong, today, wochentagName } from "@/core/dates";
import { Briefing } from "./cockpit/Briefing";
import { VerwaisteFristenHinweis } from "./cockpit/VerwaisteFristen";
import { AktenKarte, FristenKarte, PosteingangKarte, TermineKarte } from "./cockpit/KartenArbeit";
import { FinanzenKarte, KiKarte, MotorKarte, Schnellaktionen } from "./cockpit/KartenKanzlei";
import { begruessung, useCockpitDaten, type Ansicht } from "./cockpit/daten";

const LS_ANSICHT = "aa:cockpit-ansicht";

function ladeAnsicht(): Ansicht {
  try {
    return localStorage.getItem(LS_ANSICHT) === "meine" ? "meine" : "kanzlei";
  } catch {
    return "kanzlei";
  }
}

/** Cockpit – „Ihr Tag auf einen Blick": der erste Bildschirm nach der Anmeldung. */
export default function Cockpit() {
  const [ansicht, setAnsicht] = useState<Ansicht>(ladeAnsicht);
  const d = useCockpitDaten(ansicht);
  const [jetzt, setJetzt] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setJetzt(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const erstellt = useMemo(() => new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }), []);
  const heute = today();
  const fin = darfAbrechnung(d.user.rolle);

  const wechsle = (v: Ansicht) => {
    setAnsicht(v);
    try {
      localStorage.setItem(LS_ANSICHT, v);
    } catch {
      /* optional */
    }
  };

  return (
    <MotionConfig reducedMotion="user">
    <div className="@container">
      <PageHeader
        eyebrow={`${wochentagName(heute)}, ${fmtDateLong(heute)}`}
        title={begruessung(d.user, jetzt)}
        subtitle="Ihr Tag auf einen Blick: was fällig ist, was neu eingegangen ist und was der 38h-Motor bereits erledigt hat."
        hilfe="cockpit"
        actions={
          <Segmented<Ansicht>
            size="sm"
            value={ansicht}
            onChange={wechsle}
            options={[
              { value: "kanzlei", label: "Ganze Kanzlei" },
              { value: "meine", label: "Nur meine" },
            ]}
          />
        }
      />

      {/* Ruhige Reihenfolge nach Priorität: Hinweise → Briefing → Aktionen → heute fällig und Posteingang → Termine und Akten →
          Nebeninformationen (KI-Empfehlung, 38h-Motor, Finanzen) ohne Karten. Schmal einspaltig in genau dieser Reihenfolge. */}
      <div className="grid gap-8">
        {/* Pausierte Fristautomatik: Hinweis mit Zeitpunkt und Person über allem anderen (I3-T10-01) */}
        <FristAutomatikHinweis />
        {/* Offene Fristen eines deaktivierten Zugangs: Hinweis, bis die Verantwortung übertragen ist (I5-T23-01) */}
        <VerwaisteFristenHinweis />
        <div className="grid gap-5">
          <Briefing saetze={d.briefing} warnungen={d.warnungen} erstellt={erstellt} />
          <Schnellaktionen />
        </div>

        <div className="grid grid-cols-1 gap-8 @3xl:grid-cols-12 @3xl:gap-6">
          <div className="contents @3xl:col-span-7 @3xl:flex @3xl:flex-col @3xl:gap-8">
            <FristenKarte d={d} className="order-1" />
            <AktenKarte d={d} className="order-4" />
          </div>
          <div className="contents @3xl:col-span-5 @3xl:flex @3xl:flex-col @3xl:gap-8">
            <PosteingangKarte d={d} className="order-2" />
            <TermineKarte d={d} className="order-3" />
          </div>
        </div>

        {/* Auszubildende sehen keine Abrechnung und kein Fremdgeld – dann zwei Spalten. */}
        <div className={fin ? "grid grid-cols-1 gap-8 @3xl:grid-cols-2 @5xl:grid-cols-3 @5xl:gap-6" : "grid grid-cols-1 gap-8 @3xl:grid-cols-2 @5xl:gap-6"}>
          <KiKarte d={d} />
          <MotorKarte d={d} />
          {fin && <FinanzenKarte d={d} />}
        </div>
      </div>
    </div>
    </MotionConfig>
  );
}
