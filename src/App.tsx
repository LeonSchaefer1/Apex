import { useEffect, useState } from "react";
import { RouterProvider } from "react-router";
import { initBackend } from "@/lib/backend";
import { useSession } from "@/store/session";
import { useAiStatus } from "@/ai/status";
import { createAppRouter } from "@/app/router";
import { ConfirmHost, Toaster } from "@/components/ui";
import { RefractionDefs } from "@/components/shell/RefractionDefs";
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
    <>
      <div className="aura" aria-hidden>
        <i />
        <i />
        <i />
        <i />
      </div>
      <RefractionDefs />
      {bereit && router ? <RouterProvider router={router} /> : <div className="relative z-10 h-full"><LadeBildschirm fehler={fehler ?? undefined} text="AnwaltApex startet …" /></div>}
      <Toaster />
      <ConfirmHost />
    </>
  );
}
