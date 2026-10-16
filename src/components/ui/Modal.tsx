import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { create } from "zustand";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

/** Zählt offene Dialoge (Modal, Drawer) – z. B. damit die schwebende Tab-Leiste dahinter verschwindet. */
const useDialoge = create<{ offen: number }>(() => ({ offen: 0 }));
function useDialogZaehlung(open: boolean) {
  useEffect(() => {
    if (!open) return;
    useDialoge.setState((s) => ({ offen: s.offen + 1 }));
    return () => useDialoge.setState((s) => ({ offen: Math.max(0, s.offen - 1) }));
  }, [open]);
}
export const useDialogOffen = () => useDialoge((s) => s.offen > 0);

function useEsc(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = "md", icon }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl"; icon?: ReactNode }) {
  useEsc(open, onClose);
  useDialogZaehlung(open);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) setTimeout(() => ref.current?.querySelector<HTMLElement>("input,textarea,select,button[data-autofocus]")?.focus(), 60);
  }, [open]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 40, scale: 0.96, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 24, scale: 0.97, filter: "blur(4px)" }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className={cn(
              "glass-strong relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] sm:rounded-[28px]",
              size === "sm" && "sm:max-w-md",
              size === "md" && "sm:max-w-xl",
              size === "lg" && "sm:max-w-3xl",
              size === "xl" && "sm:max-w-5xl",
            )}
            style={{ boxShadow: "var(--glass-shadow-lg)" }}
          >
            <div className="flex items-start gap-3 px-6 pb-3 pt-5">
              {icon && <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">{icon}</div>}
              <div className="min-w-0 flex-1">
                <h2 className="title-lg">{title}</h2>
                {subtitle && <p className="mt-1 text-[13px] text-fg-3">{subtitle}</p>}
              </div>
              <button aria-label="Schließen" onClick={onClose} className="icon-btn -mr-2 -mt-1">
                <X className="size-[18px]" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">{children}</div>
            {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] px-6 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, subtitle, children, footer, width = 560, icon }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; width?: number; icon?: ReactNode }) {
  useEsc(open, onClose);
  useDialogZaehlung(open);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[75]">
          <motion.div className="absolute inset-0 bg-[var(--scrim)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            initial={{ x: "105%" }}
            animate={{ x: 0 }}
            exit={{ x: "105%" }}
            transition={{ type: "spring", stiffness: 380, damping: 40 }}
            className="glass-strong absolute bottom-2 right-2 top-2 flex w-[calc(100%-16px)] flex-col overflow-hidden rounded-[28px]"
            style={{ maxWidth: width, boxShadow: "var(--glass-shadow-lg)" }}
          >
            <div className="flex items-start gap-3 px-6 pb-3 pt-5">
              {icon && <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">{icon}</div>}
              <div className="min-w-0 flex-1">
                <h2 className="title-lg">{title}</h2>
                {subtitle && <p className="mt-1 text-[13px] text-fg-3">{subtitle}</p>}
              </div>
              <button aria-label="Schließen" onClick={onClose} className="icon-btn -mr-2 -mt-1">
                <X className="size-[18px]" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
            {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] px-6 py-4">{footer}</div>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// Bestätigungsdialog (ersetzt window.confirm, das in eingebetteten Ansichten nicht verfügbar ist)
interface ConfirmReq {
  titel: string;
  text?: string;
  bestaetigen?: string;
  gefahr?: boolean;
  resolve: (ok: boolean) => void;
}
const useConfirmStore = create<{ req: ConfirmReq | null; set: (r: ConfirmReq | null) => void }>((set) => ({ req: null, set: (req) => set({ req }) }));

export function confirmDialog(opts: Omit<ConfirmReq, "resolve">): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.getState().set({ ...opts, resolve }));
}

export function ConfirmHost() {
  const { req, set } = useConfirmStore();
  const close = (ok: boolean) => {
    req?.resolve(ok);
    set(null);
  };
  return (
    <Modal
      open={!!req}
      onClose={() => close(false)}
      title={req?.titel ?? ""}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>
            Abbrechen
          </Button>
          <Button data-autofocus variant={req?.gefahr ? "danger" : "primary"} onClick={() => close(true)}>
            {req?.bestaetigen ?? "Bestätigen"}
          </Button>
        </>
      }
    >
      {req?.text && <p className="text-[14px] text-fg-2">{req.text}</p>}
    </Modal>
  );
}
