import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

export function Field({ label, hint, children, className, htmlFor }: { label?: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {hint && <div className="mt-1.5 text-[13px] leading-[18px] text-fg-4">{hint}</div>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn("field", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 4, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cn("field", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn("field", className)} {...rest}>
      {children}
    </select>
  );
});

type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className"> & {
  value: string;
  onChange: (v: string) => void;
  /** Klassen des äußeren Rahmens (Breite, Abstand) */
  className?: string;
  /** „Suche leeren“ als eigener Tab-Stopp? In Comboboxen aus (Escape leert), sonst an. */
  leerenFokussierbar?: boolean;
};

/**
 * Suchfeld mit Lupe und „Suche leeren“. Weitere Eingabe-Attribute (onKeyDown, role, aria-*, autoComplete …) werden an das
 * Eingabefeld durchgereicht – damit nutzen auch Comboboxen mit Trefferliste (Kontakt-, Fristart-Auswahl) dieselbe Optik.
 */
export function SearchField({ value, onChange, placeholder = "Suchen …", className, leerenFokussierbar = true, ...rest }: SearchFieldProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-4" aria-hidden />
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field !pl-8 !pr-9"
      />
      {value && (
        <button
          type="button"
          tabIndex={leerenFokussierbar ? undefined : -1}
          aria-label="Suche leeren"
          onClick={() => onChange("")}
          className="absolute right-1 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-sm text-fg-3 hover:bg-surface-2 hover:text-fg max-sm:size-10"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
