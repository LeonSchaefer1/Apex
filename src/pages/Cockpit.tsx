import { useEffect, useMemo, useState } from "react";
import { MotionConfig } from "motion/react";
import { PageHeader, Segmented } from "@/components/ui";
import { FristAutomatikHinweis } from "@/components/FristAutomatikHinweis";
import { darfAbrechnung } from "@/lib/backend";
import { fmtDateLong, today, wochentagName } from "@/core/dates";
import { Briefing } from "./cockpit/Briefing";
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

      <div className="grid gap-4">
        {/* Pausierte Fristautomatik: Hinweis mit Zeitpunkt und Person über allem anderen (I3-T10-01) */}
        <FristAutomatikHinweis />
        <Briefing saetze={d.briefing} warnungen={d.warnungen} erstellt={erstellt} />
        <Schnellaktionen />

        <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @4xl:grid-cols-12">
          <FristenKarte d={d} i={0} className="@2xl:col-span-2 @4xl:order-1 @4xl:col-span-7" />
          <PosteingangKarte d={d} i={1} className="@2xl:col-span-2 @4xl:order-2 @4xl:col-span-5" />
          <KiKarte d={d} i={2} className={fin ? "@4xl:order-3 @4xl:col-span-4" : "@4xl:order-3 @4xl:col-span-6"} />
          <MotorKarte d={d} i={3} className={fin ? "@4xl:order-4 @4xl:col-span-4" : "@4xl:order-4 @4xl:col-span-6"} />
          <TermineKarte d={d} i={4} className={fin ? "@4xl:order-6 @4xl:col-span-5" : "@2xl:col-span-2 @4xl:order-6 @4xl:col-span-5"} />
          {/* Auszubildende sehen keine Abrechnung und kein Fremdgeld – die Termine-Karte nimmt dann die ganze Zeile ein. */}
          {fin && <FinanzenKarte d={d} i={5} className="@4xl:order-5 @4xl:col-span-4" />}
          <AktenKarte d={d} i={6} className="@2xl:col-span-2 @4xl:order-7 @4xl:col-span-7" />
        </div>
      </div>
    </div>
    </MotionConfig>
  );
}
