// Eigenes Passwort ändern – für jede Rolle (I3-T13-02). Gleiche Regeln und Meldungen wie bei der ersten Anmeldung; ein falsches
// aktuelles Passwort zählt als Fehlversuch. Geöffnet aus Einstellungen → Datenschutz → Anmeldung & Sicherheit oder über Strg+K.
import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { Button, Field, Input, Modal } from "@/components/ui";
import { getBackend } from "@/lib/backend";
import { PASSWORT_MIN, fehlerFeld, pruefeNeuesPasswort } from "@/lib/backend/types";
import { VORGANG, vorgang } from "@/lib/backend/protokoll";
import { useKanzlei } from "@/store/session";
import { useData } from "@/store/data";
import { toast, useUI } from "@/store/ui";

type Feld = "alt" | "neu" | "wiederholung";

export function PasswortAendernDialog() {
  const { passwortAendern: offen, setPasswortAendern } = useUI();
  const { user } = useKanzlei();
  const [alt, setAlt] = useState("");
  const [neu, setNeu] = useState("");
  const [wiederholung, setWiederholung] = useState("");
  const [zeigen, setZeigen] = useState(false);
  const [fehler, setFehler] = useState<Partial<Record<Feld | "allgemein", string>>>({});
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    if (!offen) return;
    setAlt("");
    setNeu("");
    setWiederholung("");
    setZeigen(false);
    setFehler({});
  }, [offen]);

  const schliessen = () => setPasswortAendern(false);
  const fokus = (f: Feld) => document.getElementById(`pw-${f}`)?.focus();

  const speichern = async () => {
    const f: Partial<Record<Feld, string>> = {};
    if (!alt) f.alt = "Bitte geben Sie Ihr aktuelles Passwort ein.";
    const regel = pruefeNeuesPasswort(neu, alt, "dem bisherigen Passwort");
    if (regel) f.neu = regel;
    else if (wiederholung !== neu) f.wiederholung = "Die Wiederholung stimmt nicht mit dem neuen Passwort überein. Bitte geben Sie es noch einmal genau gleich ein.";
    setFehler(f);
    const erstes = (["alt", "neu", "wiederholung"] as Feld[]).find((x) => f[x]);
    if (erstes) return fokus(erstes);
    setLaeuft(true);
    try {
      await getBackend().passwortAendern(alt, neu);
      // Das Backend hat den Vorgang protokolliert – hier nur anzeigen, bis die Daten neu geladen werden
      useData.getState().einfuegenLokal("aktivitaeten", vorgang(VORGANG.eigenesPasswortGeaendert(user.name), { akteur: "nutzer", userId: user.id }));
      schliessen();
      toast("Passwort geändert", { text: "Ab der nächsten Anmeldung gilt Ihr neues Passwort. Der Vorgang steht im Protokoll.", ton: "erfolg" });
    } catch (e) {
      const feld = fehlerFeld(e);
      const text = e instanceof Error ? e.message : "Das Passwort wurde nicht geändert. Bitte versuchen Sie es erneut.";
      if (feld === "alt" || feld === "neu") {
        setFehler({ [feld]: text });
        fokus(feld);
      } else setFehler({ allgemein: text });
    } finally {
      setLaeuft(false);
    }
  };

  const meldung = (f: Feld) =>
    fehler[f] ? (
      <span id={`pw-${f}-fehler`} className="text-seal">
        {fehler[f]}
      </span>
    ) : undefined;
  const feldProps = (f: Feld) => ({
    id: `pw-${f}`,
    type: zeigen ? "text" : "password",
    "aria-invalid": !!fehler[f] || undefined,
    "aria-describedby": fehler[f] ? `pw-${f}-fehler` : f === "neu" ? "pw-regel" : undefined,
    maxLength: 256,
  });

  return (
    <Modal
      open={offen}
      onClose={schliessen}
      size="sm"
      icon={<KeyRound className="size-5" />}
      title="Passwort ändern"
      subtitle={`${user.name} · gilt ab der nächsten Anmeldung`}
      footer={
        <>
          <Button variant="ghost" onClick={schliessen}>
            Abbrechen
          </Button>
          <Button variant="primary" icon={<KeyRound className="size-4" />} loading={laeuft} onClick={() => void speichern()}>
            Passwort ändern
          </Button>
        </>
      }
    >
      <form
        className="grid gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          void speichern();
        }}
      >
        {/* Für Passwort-Manager: zu welchem Zugang das Passwort gehört */}
        <input type="email" name="username" autoComplete="username" value={user.email} readOnly hidden />
        <Field label="Aktuelles Passwort" htmlFor="pw-alt" hint={meldung("alt")}>
          <Input {...feldProps("alt")} autoComplete="current-password" value={alt} onChange={(e) => setAlt(e.target.value)} data-autofocus />
        </Field>
        <Field label="Neues Passwort" htmlFor="pw-neu" hint={meldung("neu") ?? <span id="pw-regel">Mindestens {PASSWORT_MIN} Zeichen mit Buchstaben und mindestens einer Ziffer – anders als das bisherige Passwort.</span>}>
          <Input {...feldProps("neu")} autoComplete="new-password" value={neu} onChange={(e) => setNeu(e.target.value)} />
        </Field>
        <Field label="Neues Passwort wiederholen" htmlFor="pw-wiederholung" hint={meldung("wiederholung")}>
          <Input {...feldProps("wiederholung")} autoComplete="new-password" value={wiederholung} onChange={(e) => setWiederholung(e.target.value)} />
        </Field>
        <label htmlFor="pw-zeigen" className="flex min-h-[32px] items-center gap-2 text-[13px] text-fg-2">
          <input id="pw-zeigen" type="checkbox" className="size-4 accent-[var(--ink)]" checked={zeigen} onChange={(e) => setZeigen(e.target.checked)} />
          Passwörter anzeigen
        </label>
        {fehler.allgemein && (
          <div role="alert" className="rounded-[12px] bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal">
            {fehler.allgemein}
          </div>
        )}
        <p className="text-[12.5px] leading-relaxed text-fg-3">Passwort vergessen? Dann vergeben Partner oder Administration unter Team & Zugänge ein Startpasswort – das ist für den Notfall gedacht.</p>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
