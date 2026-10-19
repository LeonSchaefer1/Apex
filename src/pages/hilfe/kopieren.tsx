import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy } from "lucide-react";
import { toast } from "@/store/ui";
import { cn } from "@/lib/cn";
import { BEWEGUNG } from "@/lib/bewegung";

/** In die Zwischenablage kopieren – mit Rückfall für eingebettete Ansichten ohne Clipboard-API. */
export async function kopiere(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* Rückfall unten */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Kleiner Kopier-Knopf mit Häkchen-Rückmeldung. */
export function CopyButton({ text, label, className, toastTitel = "In die Zwischenablage kopiert" }: { text: string; label: string; className?: string; toastTitel?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={async () => {
        const erfolg = await kopiere(text);
        if (erfolg) {
          setOk(true);
          setTimeout(() => setOk(false), 1600);
          toast(toastTitel, { text, ton: "erfolg" });
        } else {
          toast("Kopieren nicht möglich", { text: "Bitte markieren Sie den Text und kopieren Sie ihn mit Strg+C bzw. ⌘C.", ton: "warnung" });
        }
      }}
      className={cn("icon-btn !size-8 shrink-0", ok && "text-green", className)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={ok ? "ok" : "copy"} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={BEWEGUNG.standard} className="grid place-items-center">
          {ok ? <Check className="size-4" /> : <Copy className="size-4" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
