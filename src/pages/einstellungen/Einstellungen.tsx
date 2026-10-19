import { useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Building2, Infinity as InfinityIcon, Palette, ShieldCheck, Sparkles, Users } from "lucide-react";
import { PageHeader, Segmented } from "@/components/ui";
import { KanzleiTab } from "./KanzleiTab";
import { TeamTab } from "./TeamTab";
import { LizenzTab } from "./LizenzTab";
import { KiTab } from "./KiTab";
import { DarstellungTab } from "./DarstellungTab";
import { DatenschutzTab } from "./DatenschutzTab";
import { useKanzlei } from "@/store/session";
import { darfLizenzSehen } from "@/lib/backend";
import { BEWEGUNG } from "@/lib/bewegung";

type Tab = "kanzlei" | "team" | "lizenz" | "ki" | "darstellung" | "datenschutz";

const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: "kanzlei", label: "Kanzlei", icon: <Building2 className="size-3.5" /> },
  { value: "team", label: "Team & Zugänge", icon: <Users className="size-3.5" /> },
  { value: "lizenz", label: "Lizenz", icon: <InfinityIcon className="size-3.5" /> },
  { value: "ki", label: "KI", icon: <Sparkles className="size-3.5" /> },
  { value: "darstellung", label: "Darstellung", icon: <Palette className="size-3.5" /> },
  { value: "datenschutz", label: "Datenschutz", icon: <ShieldCheck className="size-3.5" /> },
];

export default function Einstellungen() {
  const [params, setParams] = useSearchParams();
  const { user } = useKanzlei();
  // Reiter „Lizenz“ und die Teamliste mit E-Mails nur für Partner und Administration; alle anderen sehen „Ihr Zugang“.
  const verwaltung = darfLizenzSehen(user.rolle);
  const tabs = TABS.filter((t) => verwaltung || t.value !== "lizenz").map((t) => (t.value === "team" && !verwaltung ? { ...t, label: "Ihr Zugang" } : t));
  const roh = params.get("tab");
  const tab: Tab = tabs.some((t) => t.value === roh) ? (roh as Tab) : roh === "lizenz" ? "team" : "kanzlei";

  return (
    <div>
      <PageHeader title="Einstellungen" hilfe="einstellungen" subtitle={verwaltung ? "Kanzlei, Team & Zugänge, Lizenz, KI, Darstellung und Datenschutz – alles, was Ihre Kanzlei in Apex ausmacht, an einem Ort." : "Ihr Zugang, Kanzleiangaben, KI, Darstellung und Datenschutz – an einem Ort."} />
      <div className="sticky top-2 z-30 -mx-1 mb-5 px-1 md:static">
        <Segmented<Tab>
          value={tab}
          onChange={(t) => setParams(t === "kanzlei" ? {} : { tab: t }, { replace: true })}
          options={tabs}
          className="max-w-full !bg-[color-mix(in_oklab,var(--surface)_97%,transparent)] md:!bg-[var(--ink-softer)] md:shadow-none"
        />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={BEWEGUNG.standard}>
          {tab === "kanzlei" && <KanzleiTab />}
          {tab === "team" && <TeamTab />}
          {tab === "lizenz" && <LizenzTab />}
          {tab === "ki" && <KiTab />}
          {tab === "darstellung" && <DarstellungTab />}
          {tab === "datenschutz" && <DatenschutzTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
