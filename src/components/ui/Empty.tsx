import type { ReactNode } from "react";

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-14 place-items-center rounded-[18px] bg-ink-soft text-ink">{icon}</div>}
      <div className="title-md">{title}</div>
      {text && <p className="mt-1.5 max-w-sm text-[13px] text-fg-3">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
