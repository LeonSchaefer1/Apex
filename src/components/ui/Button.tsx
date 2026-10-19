import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Varianten (DESIGN-SYSTEM.md 12.1): primary = Hauptaktion (höchstens eine je Bereich), secondary = Standard, ghost = Werkzeugleisten,
 * danger = „Löschen“ (sekundär mit roter Schrift; vollflächig nur in confirmDialog), ai = wie secondary mit Sparkles-Symbol.
 */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "ai";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, iconRight, loading, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn("btn", `btn-${variant}`, size === "sm" && "btn-sm", size === "lg" && "btn-lg", className)}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : (icon ?? (variant === "ai" ? <Sparkles className="size-4" aria-hidden /> : null))}
      {children}
      {iconRight}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "sm" | "md";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "md", className, children, type = "button", ...rest },
  ref,
) {
  return (
    // 32 × 32 px (sm 28 px), am Telefon 44 × 44 px (CSS .icon-btn)
    <button ref={ref} type={type} aria-label={label} title={label} className={cn("icon-btn", size === "sm" && "sm:!size-7", className)} {...rest}>
      {children}
    </button>
  );
});
