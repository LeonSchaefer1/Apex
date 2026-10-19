import { useEffect, useState } from "react";
import { Landmark, Mail, Send } from "lucide-react";
import type { Kontakt, Nachricht } from "@/core/types";
import { useCol } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Drawer, Field, Input, Textarea } from "@/components/ui";
import { antwortBetreff, antwortSenden } from "./analyse";

function anrede(n: Nachricht, kontakte: Kontakt[]) {
  if (n.kanal === "bea" && /rechtsanw|kanzlei|kollege/i.test(`${n.von} ${n.text}`)) return "Sehr geehrte Kolleginnen und Kollegen,";
  const k = kontakte.find((x) => (n.vonAdresse && x.email === n.vonAdresse) || x.name === n.von);
  if (k?.typ === "person" && k.nachname && k.anrede === "Herr") return `Sehr geehrter Herr ${k.nachname},`;
  if (k?.typ === "person" && k.nachname && k.anrede === "Frau") return `Sehr geehrte Frau ${k.nachname},`;
  return "Sehr geehrte Damen und Herren,";
}

/** Antwort verfassen – gesendet wird über denselben Kanal (beA oder E-Mail); Sie bleiben im Posteingang. */
export function AntwortDrawer({ n, open, onClose }: { n: Nachricht; open: boolean; onClose: () => void }) {
  const { user, tenant } = useKanzlei();
  const kontakte = useCol("kontakte");
  const [an, setAn] = useState("");
  const [betreff, setBetreff] = useState("");
  const [text, setText] = useState("");
  const [sendet, setSendet] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAn(n.vonAdresse ? `${n.von} <${n.vonAdresse}>` : n.von);
    setBetreff(antwortBetreff(n.betreff));
    setText(`${anrede(n, kontakte)}\n\n\n\nMit freundlichen Grüßen\n\n${user.name}\n${tenant.name}`);
  }, [open, n.id]);

  const senden = () => {
    if (!text.trim()) return;
    setSendet(true);
    setTimeout(() => {
      const empfaenger = an.replace(/\s*<[^>]*>\s*$/, "").trim() || n.von;
      antwortSenden(n, user, { an: empfaenger, betreff, text });
      setSendet(false);
      onClose();
      toast("Antwort gesendet", { text: `${n.kanal === "bea" ? "Per beA mit Prüfprotokoll" : "Per E-Mail"} an ${empfaenger}${n.akteId ? " · in der Akte abgelegt" : ""}.`, ton: "erfolg" });
    }, 650);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Antworten"
      subtitle={n.kanal === "bea" ? "Versand über Ihr beA – mit Zeitstempel und Prüfprotokoll." : "Versand über Ihr E-Mail-Postfach (Microsoft 365)."}
      icon={n.kanal === "bea" ? <Landmark className="size-[18px]" /> : <Mail className="size-[18px]" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" icon={<Send className="size-4" />} loading={sendet} onClick={senden} disabled={!text.trim()}>
            {n.kanal === "bea" ? "Per beA senden" : "E-Mail senden"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="An" htmlFor="antwort-an">
          <Input id="antwort-an" value={an} onChange={(e) => setAn(e.target.value)} />
        </Field>
        <Field label="Betreff" htmlFor="antwort-betreff">
          <Input id="antwort-betreff" value={betreff} onChange={(e) => setBetreff(e.target.value)} />
        </Field>
        <Field label="Nachricht" htmlFor="antwort-text" hint="Tipp: Die Antwort wird automatisch in der zugeordneten Akte abgelegt.">
          <Textarea id="antwort-text" rows={14} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <div className="border-l-2 border-[var(--line-strong)] py-1 pl-3.5 text-[13px] leading-relaxed text-fg-3">
          <div className="mb-1 font-semibold text-fg-2">Ursprüngliche Nachricht</div>
          <div className="line-clamp-4 whitespace-pre-line">{n.text}</div>
        </div>
      </div>
    </Drawer>
  );
}
