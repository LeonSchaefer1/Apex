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
  const roh = params.get("tab");
  const tab: Tab = TABS.some((t) => t.value === roh) ? (roh as Tab) : "kanzlei";

  return (
    <div>
      <PageHeader title="Einstellungen" hilfe="einstellungen" subtitle="Kanzlei, Team & Zugänge, Lizenz, KI und Darstellung – alles, was Ihre Kanzlei in AnwaltApex ausmacht, an einem Ort." />
      <div className="sticky top-[76px] z-30 -mx-1 mb-5 px-1 md:static">
        <Segmented<Tab>
          value={tab}
          onChange={(t) => setParams(t === "kanzlei" ? {} : { tab: t }, { replace: true })}
          options={TABS}
          className="max-w-full !bg-[var(--glass-strong)] backdrop-blur-xl md:!bg-[var(--ink-softer)] md:backdrop-blur-none"
        />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ type: "spring", stiffness: 460, damping: 36 }}>
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
