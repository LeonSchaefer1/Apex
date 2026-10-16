import type { ReactNode } from "react";
import { motion } from "motion/react";
import { CircleHelp } from "lucide-react";
import { useUI } from "@/store/ui";

/** Großer Seitentitel (iOS „Large Title") mit Erklärsatz und Schnellhilfe. */
export function PageHeader({ title, subtitle, actions, hilfe, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; hilfe?: string; eyebrow?: ReactNode }) {
  const zeigeHilfe = useUI((s) => s.zeigeHilfe);
  return (
    <motion.header
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-4"
    >
      <div className="min-w-0 flex-1 basis-[320px]">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <div className="flex items-center gap-2">
          <h1 className="title-xl">{title}</h1>
          {hilfe && (
            <button
              type="button"
              onClick={() => zeigeHilfe(hilfe)}
              className="icon-btn !size-8 text-fg-3"
              aria-label="Was ist das? Schnellhilfe öffnen"
              title="Was ist das? Schnellhilfe öffnen"
            >
              <CircleHelp className="size-[18px]" />
            </button>
          )}
        </div>
        {subtitle && <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-fg-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.header>
  );
}
