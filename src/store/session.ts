import { create } from "zustand";
import { getBackend, istConsole, type Sitzung } from "@/lib/backend";
import type { SessionInfo } from "@/core/types";

interface SessionState {
  status: "unbekannt" | "abgemeldet" | "angemeldet";
  sitzung: Sitzung | null;
  setSitzung: (s: Sitzung | null) => void;
  login: (email: string, passwort: string) => Promise<Sitzung>;
  logout: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  status: "unbekannt",
  sitzung: null,
  setSitzung: (s) => set({ sitzung: s, status: s ? "angemeldet" : "abgemeldet" }),
  login: async (email, passwort) => {
    const s = await getBackend().login(email, passwort);
    set({ sitzung: s, status: "angemeldet" });
    return s;
  },
  logout: async () => {
    await getBackend().logout();
    set({ sitzung: null, status: "abgemeldet" });
  },
}));

/** Kanzlei-Sitzung (wirft, wenn Console-Sitzung) – nur innerhalb der Kanzlei-App verwenden. */
export function useKanzlei(): SessionInfo {
  const s = useSession((st) => st.sitzung);
  if (!s || istConsole(s)) throw new Error("Keine Kanzlei-Sitzung");
  return s;
}
