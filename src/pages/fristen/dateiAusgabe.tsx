// Datei-Ausgabe ohne stilles Herunterladen: Vorschau-Dialog mit „Datei speichern“ und „In Zwischenablage kopieren“.
// In eingebetteten Ansichten (Vorschau/iframe) sind Downloads oft gesperrt – dann bleibt das Kopieren (Hinweis im Dialog).
import { useEffect, useRef, useState } from "react";
import { Copy, Download, FileText } from "lucide-react";
import { kopiereText } from "@/lib/zwischenablage";
import { toast } from "@/store/ui";
import { Button, Modal, Segmented } from "@/components/ui";

export interface AusgabeDatei {
  name: string;
  mime: string;
  inhalt: string;
  /** Kurzer Satz, was die Datei enthält */
  beschreibung?: string;
  /** Beschriftung im Umschalter, wenn der Dialog mehrere Dateien anbietet (z. B. „Auskunft (HTML)“) */
  label?: string;
}

function eingebettet(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Speichert die Datei über einen temporären Objekt-Link – mit Rückmeldung, wenn der Browser das nicht erlaubt. */
export function speichereDatei(d: AusgabeDatei): boolean {
  try {
    const blob = new Blob([d.inhalt], { type: `${d.mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = d.name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Dialog mit Vorschau der Datei – „Datei speichern“ und „In Zwischenablage kopieren“.
 * Mit `dateien` bietet er mehrere Formate zur Wahl an (z. B. Auskunft als HTML und Export als JSON); HTML erscheint gerendert.
 */
export function DateiDialog({ datei: einzel, dateien, onClose, titel }: { datei?: AusgabeDatei | null; dateien?: AusgabeDatei[] | null; onClose: () => void; titel?: string }) {
  const liste = dateien?.length ? dateien : einzel ? [einzel] : [];
  const [idx, setIdx] = useState(0);
  const schluessel = liste.map((d) => d.name).join("|");
  useEffect(() => setIdx(0), [schluessel]);
  const datei: AusgabeDatei | null = liste[Math.min(idx, liste.length - 1)] ?? null;
  const preRef = useRef<HTMLPreElement>(null);
  const [kopiert, setKopiert] = useState(false);
  const groesse = datei ? new TextEncoder().encode(datei.inhalt).length : 0;
  const embed = eingebettet();
  const speichern = () => {
    if (!datei) return;
    if (speichereDatei(datei)) toast("Datei gespeichert", { text: `${datei.name} – im Download-Ordner Ihres Browsers.`, ton: "erfolg" });
    else toast("Speichern nicht möglich", { text: "Der Browser erlaubt hier keinen Download – bitte „In Zwischenablage kopieren“ nutzen.", ton: "warnung" });
  };
  const kopieren = async () => {
    if (!datei) return;
    const r = await kopiereText(datei.inhalt, preRef.current);
    if (r === "kopiert") {
      setKopiert(true);
      setTimeout(() => setKopiert(false), 1800);
      toast("In die Zwischenablage kopiert", { text: datei.name, ton: "erfolg" });
    } else if (r === "markiert") toast("Text markiert", { text: "Jetzt mit Strg+C (Mac: ⌘C) kopieren.", ton: "info" });
    else toast("Kopieren nicht möglich", { ton: "warnung" });
  };
  return (
    <Modal
      open={!!datei}
      onClose={onClose}
      size="lg"
      title={titel ?? datei?.name ?? ""}
      subtitle={datei ? `${datei.beschreibung ? `${datei.beschreibung} · ` : ""}${(groesse / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} KB` : undefined}
      icon={<FileText className="size-[18px]" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className="mr-auto">
            Schließen
          </Button>
          <Button variant="secondary" icon={<Copy className="size-4" />} onClick={() => void kopieren()}>
            {kopiert ? "Kopiert" : "In Zwischenablage kopieren"}
          </Button>
          <Button variant="primary" icon={<Download className="size-4" />} onClick={speichern}>
            Datei speichern
          </Button>
        </>
      }
    >
      {liste.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Segmented size="sm" value={String(idx)} onChange={(v) => setIdx(Number(v))} options={liste.map((d, i) => ({ value: String(i), label: d.label ?? d.name }))} />
          <span className="break-all text-[12.5px] text-fg-3">{datei?.name}</span>
        </div>
      )}
      {embed && (
        <p className="mb-3 rounded-[12px] bg-amber-soft px-3 py-2 text-[12.5px] text-fg-2">
          In dieser eingebetteten Ansicht sperrt der Browser Downloads möglicherweise – dann den Inhalt kopieren und als Datei „{datei?.name}“ speichern.
        </p>
      )}
      {datei?.mime === "text/html" ? (
        <>
          {/* gerenderte Vorschau, abgeschottet (sandbox ohne Skripte) – papierweiß wie der Ausdruck */}
          <iframe title={`Vorschau ${datei.name}`} sandbox="" srcDoc={datei.inhalt} className="h-[52vh] w-full rounded-[14px] bg-white ring-1 ring-[var(--line)]" />
          <pre ref={preRef} className="sr-only" aria-hidden>
            {datei.inhalt}
          </pre>
        </>
      ) : (
        <pre ref={preRef} tabIndex={0} aria-label={`Inhalt von ${datei?.name ?? "Datei"}`} className="mono max-h-[52vh] overflow-auto whitespace-pre-wrap break-words rounded-[14px] bg-ink-softer p-3 text-[12px] leading-relaxed text-fg-2">
          {datei?.inhalt}
        </pre>
      )}
    </Modal>
  );
}
