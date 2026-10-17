import { useEffect, useState } from "react";
import { useMedia } from "./useMedia";

/**
 * Dunkelmodus aktiv? `data-theme` der App (bzw. des einbettenden Viewers) hat Vorrang, sonst die Systemeinstellung –
 * dieselbe Regel wie die CSS-Selektoren in src/styles/index.css.
 */
export function useDunkelModus(): boolean {
  const system = useMedia("(prefers-color-scheme: dark)");
  const [attr, setAttr] = useState<string | null>(() => (typeof document === "undefined" ? null : document.documentElement.getAttribute("data-theme")));
  useEffect(() => {
    const root = document.documentElement;
    const o = new MutationObserver(() => setAttr(root.getAttribute("data-theme")));
    o.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    setAttr(root.getAttribute("data-theme"));
    return () => o.disconnect();
  }, []);
  return attr === "dark" || attr === "light" ? attr === "dark" : system;
}
