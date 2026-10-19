import { useEffect, useState } from "react";
import { RouterProvider } from "react-router";
import { MotionConfig } from "motion/react";
import { initBackend } from "@/lib/backend";
import { useSession } from "@/store/session";
import { useAiStatus } from "@/ai/status";
import { createAppRouter } from "@/app/router";
import { ConfirmHost, Toaster } from "@/components/ui";
import { LadeBildschirm } from "@/components/shell/LadeBildschirm";

let router: ReturnType<typeof createAppRouter> | null = null;

export default function App() {
  const [bereit, setBereit] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const setSitzung = useSession((s) => s.setSitzung);

  useEffect(() => {
    (async () => {
      try {
        const { backend, info } = await initBackend();
        void useAiStatus.getState().init(info);
        const s = await backend.me();
        setSitzung(s);
        router = createAppRouter();
        setBereit(true);
      } catch (e) {
        setFehler(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [setSitzung]);

  return (
    <MotionConfig reducedMotion="user">
      {/* Einfarbiger Grund (--bg) über body – kein Aura-Hintergrund, keine Lichtbrechung mehr (DESIGN-SYSTEM.md 13) */}
      <div id="app-inhalt" className="relative z-10 h-full">{bereit && router ? <RouterProvider router={router} /> : <LadeBildschirm fehler={fehler ?? undefined} text="Apex startet …" />}</div>
      <Toaster />
      <ConfirmHost />
    </MotionConfig>
  );
}
