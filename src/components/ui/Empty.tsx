import type { ReactNode } from "react";

/** Leerzustand: Symbol 20 px ohne Kachel, Titel 15/600, Text 14 Text 3 (höchstens 44 Zeichen breit), eine Aktion. */
export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-fg-4 [&>svg]:size-5" aria-hidden>{icon}</div>}
      <div className="title-md">{title}</div>
      {text && <p className="mt-1 max-w-[44ch] text-[14px] leading-5 text-fg-3">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
