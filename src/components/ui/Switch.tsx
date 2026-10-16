import { motion } from "motion/react";
import { cn } from "@/lib/cn";

export function Switch({ checked, onChange, label, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[30px] w-[50px] shrink-0 items-center rounded-full p-[2px] transition-colors duration-300",
        checked ? "bg-[var(--green)]" : "bg-[var(--line-strong)]",
        disabled && "opacity-50",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 600, damping: 34 }}
        className={cn("block h-[26px] w-[26px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.22),0_0_0_0.5px_rgba(0,0,0,0.04)]", checked ? "ml-auto" : "")}
        whileTap={{ width: 32 }}
      />
    </button>
  );
}
