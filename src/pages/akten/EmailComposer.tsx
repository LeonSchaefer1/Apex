// E-Mail bzw. beA-Nachricht direkt aus der Akte – nach dem Senden bleibt man in der Akte.
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AtSign, Mail, Paperclip, Send, ShieldCheck, X } from "lucide-react";
import type { Akte, Dokument, Kontakt, Nachricht } from "@/core/types";
import { nowLocal, uid } from "@/core/dates";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Chip, Drawer, Field, Input, Select, Switch, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { KontaktAvatar } from "@/pages/kontakte/kontaktHelfer";
import { beruehreAkte, useKontaktMap } from "./helfer";
import { DiktatKnopf } from "./Diktat";

/** Betreff nach Empfängerrolle: Mandant „Ihre Angelegenheit …“, Gericht/Gegenanwalt/Versicherung mit „Ihr Zeichen/Unser Zeichen“. */
export function betreffFuer(rolle: string | undefined, akte: Akte): string {
  const kurz = akte.titel.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  switch (rolle) {
    case "Mandant":
      return `Ihre Angelegenheit ${kurz} – unser Zeichen ${akte.aktenzeichen}`;
    case "Gericht":
      return akte.gerichtsAz ? `Ihr Zeichen ${akte.gerichtsAz} / Unser Zeichen ${akte.aktenzeichen} – ${kurz}` : `Unser Zeichen ${akte.aktenzeichen} – ${kurz}`;
    case "Gegneranwalt":
      return `Ihr Zeichen/Unser Zeichen ${akte.aktenzeichen} – ${kurz}`;
    case "Versicherung": {
      const ihr = akte.rsv?.schadennummer ?? akte.rsv?.versicherungsnummer;
      return `${ihr ? `Ihr Zeichen ${ihr} / ` : ""}Unser Zeichen ${akte.aktenzeichen} – ${kurz}`;
    }
    default:
      return `Unser Zeichen ${akte.aktenzeichen} – ${kurz}`;
  }
}

function anrede(k?: Kontakt): string {
  if (!k) return "Sehr geehrte Damen und Herren,";
  if (k.typ === "person") {
    if (k.anrede === "Frau") return `Sehr geehrte Frau ${k.nachname ?? k.name},`;
    if (k.anrede === "Herr") return `Sehr geehrter Herr ${k.nachname ?? k.name},`;
    return `Guten Tag ${k.name},`;
  }
  if (k.rollen.includes("gericht")) return "Sehr geehrte Damen und Herren,";
  if (k.rollen.includes("gegneranwalt")) return "Sehr geehrte Kolleginnen und Kollegen,";
  return "Sehr geehrte Damen und Herren,";
}

export function EmailComposer({ akte, open, onClose, onGesendet }: { akte: Akte; open: boolean; onClose: () => void; onGesendet: (dokId: string) => void }) {
  const { user, tenant } = useKanzlei();
  const kontakte = useKontaktMap();
  const alleDoks = useCol("dokumente");
  const doks = useMemo(() => alleDoks.filter((d) => d.akteId === akte.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [alleDoks, akte.id]);

  const empfaenger = useMemo(() => {
    const ids: [string, string | undefined][] = [
      ["Mandant", akte.mandantId],
      ["Gegner", akte.gegnerId],
      ["Gegneranwalt", akte.gegneranwaltId],
      ["Gericht", akte.gerichtId],
    ];
    const vers = akte.rsv ? [...kontakte.values()].find((k) => k.name === akte.rsv!.versicherung) : undefined;
    const out = ids.map(([rolle, id]) => ({ rolle, k: id ? kontakte.get(id) : undefined })).filter((x): x is { rolle: string; k: Kontakt } => !!x.k);
    if (vers) out.push({ rolle: "Versicherung", k: vers });
    return out;
  }, [akte, kontakte]);
  const beaZiele = empfaenger.filter((e) => e.rolle === "Gericht" || e.rolle === "Gegneranwalt");

  const [kontaktId, setKontaktId] = useState<string | undefined>();
  const [an, setAn] = useState("");
  const [betreff, setBetreff] = useState("");
  const [text, setText] = useState("");
  const [bea, setBea] = useState(false);
  const [anhaenge, setAnhaenge] = useState<string[]>([]);
  const [sendet, setSendet] = useState(false);

  const signatur = `Mit freundlichen Grüßen\n\n${user.name}\n${user.titel}\n${tenant.name}\n${tenant.adresse}`;
  const brief = (k?: Kontakt) => `${anrede(k)}\n\n\n\n${signatur}`;

  useEffect(() => {
    if (!open) return;
    const m = kontakte.get(akte.mandantId);
    setKontaktId(m?.id);
    setAn(m?.email ?? "");
    setBetreff(betreffFuer("Mandant", akte));
    setText(brief(m));
    setBea(false);
    setAnhaenge([]);
    setSendet(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, akte.id]);

  const rolleVon = (id?: string) => empfaenger.find((e) => e.k.id === id)?.rolle;
  const waehle = (k: Kontakt, alsBea = bea) => {
    const vorher = kontakte.get(kontaktId ?? "");
    // Betreff passend zur Empfängerrolle – nur, solange er nicht von Hand geändert wurde
    const alt = betreffFuer(rolleVon(kontaktId), akte);
    setBetreff((b) => (b === alt || !b.trim() ? betreffFuer(rolleVon(k.id), akte) : b));
    setKontaktId(k.id);
    setAn(alsBea ? k.safeId ?? k.name : k.email ?? "");
    // Anrede austauschen, wenn der Text noch mit der alten Anrede beginnt
    setText((t) => (t.startsWith(anrede(vorher)) ? anrede(k) + t.slice(anrede(vorher).length) : t));
  };

  const setzeBea = (v: boolean) => {
    setBea(v);
    if (v) {
      const ziel = beaZiele.find((e) => e.k.id === kontaktId) ?? beaZiele[0];
      if (ziel) waehle(ziel.k, true);
    } else {
      const m = empfaenger[0];
      if (m) waehle(m.k, false);
    }
  };

  const gewaehlt = kontaktId ? kontakte.get(kontaktId) : undefined;
  const emailOk = bea ? !!an.trim() : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(an.trim());
  const kannSenden = emailOk && !!betreff.trim() && !!text.trim() && !sendet;

  const senden = () => {
    setSendet(true);
    // kurzer Moment für das Gefühl des Versendens
    setTimeout(() => {
      const st = useData.getState();
      const jetzt = nowLocal();
      const kanal: Nachricht["kanal"] = bea ? "bea" : "email";
      const anhangDoks = doks.filter((d) => anhaenge.includes(d.id));
      const n: Nachricht = {
        id: uid("n"), kanal, richtung: "aus", von: user.name, vonAdresse: user.email, an: gewaehlt?.name ?? an.trim(), betreff: betreff.trim(), text: text.trim(),
        eingang: jetzt, akteId: akte.id, anhaenge: anhangDoks.map((d) => ({ name: `${d.name} (Version ${d.version}).${d.format}`, groesseKb: d.groesseKb })), status: "erledigt", zugeordnet: true,
      };
      st.upsert("nachrichten", n);
      const dok: Dokument = {
        id: uid("d"), akteId: akte.id, name: betreff.trim(), art: bea ? "bea" : "email", ordner: "Korrespondenz", format: "eml",
        groesseKb: Math.max(2, Math.round(text.length / 900) + anhangDoks.reduce((s, d) => s + d.groesseKb, 0)), seiten: 1,
        inhalt: `Von: ${user.name} <${user.email}>\nAn: ${gewaehlt?.name ?? ""} <${an.trim()}>\nBetreff: ${betreff.trim()}\nGesendet: ${new Date().toLocaleString("de-DE")}${bea ? "\nÜbermittlungsweg: beA (sicherer Übermittlungsweg nach § 130a Abs. 4 ZPO)" : ""}${anhangDoks.length ? `\nAnlagen: ${anhangDoks.map((d) => `${d.name} (Version ${d.version})`).join(", ")}` : ""}\n\n${text.trim()}`,
        quelle: bea ? "bea" : "email", autorId: user.id, version: 1, createdAt: jetzt,
      };
      st.upsert("dokumente", dok);
      st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `${bea ? "beA-Nachricht" : "E-Mail"} an ${gewaehlt?.name ?? an.trim()} gesendet: „${betreff.trim()}“ – ${akte.aktenzeichen}` });
      beruehreAkte(akte.id);
      onClose();
      toast("Gesendet – Sie bleiben in der Akte", {
        ton: "erfolg",
        text: `${bea ? "beA-Nachricht" : "E-Mail"} an ${gewaehlt?.name ?? an.trim()} · abgelegt in „Korrespondenz“`,
        aktion: { label: "Ansehen", onClick: () => onGesendet(dok.id) },
      });
    }, 650);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={640}
      icon={bea ? <ShieldCheck className="size-[18px]" /> : <Mail className="size-[18px]" />}
      title={bea ? "beA-Nachricht schreiben" : "E-Mail schreiben"}
      subtitle={`${akte.aktenzeichen} · ${akte.titel} – wird automatisch in der E-Akte abgelegt`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Verwerfen
          </Button>
          <Button variant="primary" icon={<Send className="size-4" />} loading={sendet} disabled={!kannSenden} onClick={senden}>
            {bea ? "Über beA senden" : "Senden"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        {beaZiele.length > 0 && (
          <div className="flex items-center gap-3 rounded-[16px] bg-ink-softer p-3.5 shadow-[inset_0_0_0_1px_var(--line)]">
            <span className="grid grid-cols-1 size-9 shrink-0 place-items-center rounded-[11px] bg-ink-soft text-ink">
              <ShieldCheck className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold">Als beA-Nachricht senden</div>
              <div className="text-[12.5px] text-fg-3">Sicherer Übermittlungsweg an {beaZiele.map((e) => e.rolle).join(" oder ")}</div>
            </div>
            <Switch id="mail-bea" checked={bea} onChange={setzeBea} label="Als beA-Nachricht senden" />
          </div>
        )}

        <div>
          <div className="label">Empfänger aus der Akte</div>
          <div className="flex flex-wrap gap-1.5">
            {(bea ? beaZiele : empfaenger).map(({ rolle, k }) => {
              const aktiv = k.id === kontaktId;
              const ohneAdresse = bea ? false : !k.email;
              return (
                <button
                  key={k.id}
                  type="button"
                  disabled={ohneAdresse}
                  title={ohneAdresse ? "Keine E-Mail-Adresse hinterlegt" : undefined}
                  onClick={() => waehle(k)}
                  className={cn(
                    "relative inline-flex h-9 items-center gap-2 rounded-full pl-1 pr-3 text-[12.5px] font-medium transition-colors disabled:opacity-40",
                    aktiv ? "text-fg" : "text-fg-2 shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-ink-softer",
                  )}
                >
                  {aktiv && <motion.span layoutId="mail-empf" transition={{ type: "spring", stiffness: 520, damping: 38 }} className="absolute inset-0 rounded-full bg-[var(--surface)] shadow-[0_0_0_1.5px_var(--ink)]" />}
                  <KontaktAvatar k={k} size={26} className="relative" />
                  <span className="relative max-w-[220px] truncate" title={k.name}>{k.name}</span>
                  <span className="relative text-[12px] text-fg-3">{rolle}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Field label={bea ? "An (beA SAFE-ID)" : "An"} htmlFor="mail-an" hint={!emailOk && an ? <span className="text-seal">Bitte eine gültige E-Mail-Adresse eingeben.</span> : undefined}>
          <div className="relative">
            <AtSign className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-3" />
            <Input id="mail-an" value={an} onChange={(e) => setAn(e.target.value)} className={cn("!pl-10", bea && "mono text-[13px]")} placeholder={bea ? "DE.Justiz…" : "name@beispiel.de"} />
          </div>
        </Field>
        <Field label="Betreff" htmlFor="mail-betreff">
          <Input id="mail-betreff" value={betreff} onChange={(e) => setBetreff(e.target.value)} />
        </Field>
        <Field label="Nachricht" htmlFor="mail-text">
          <Textarea id="mail-text" rows={12} value={text} onChange={(e) => setText(e.target.value)} className="leading-relaxed" />
          <div className="mt-1.5">
            <DiktatKnopf
              onText={(t) =>
                setText((v) => {
                  // Diktat vor der Grußformel einfügen
                  const i = v.indexOf("Mit freundlichen Grüßen");
                  if (i < 0) return v.trim() ? `${v.trimEnd()} ${t}` : t;
                  const vor = v.slice(0, i).trimEnd();
                  return `${vor}${vor.endsWith(",") ? "\n\n" : " "}${t}\n\n${v.slice(i)}`;
                })
              }
            />
          </div>
        </Field>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="label !mb-0">Anlagen aus der E-Akte</span>
            {doks.length > 0 && (
              <Select
                id="mail-anlage"
                aria-label="Dokument anhängen"
                value=""
                onChange={(e) => e.target.value && setAnhaenge((a) => (a.includes(e.target.value) ? a : [...a, e.target.value]))}
                className="!h-8 !w-auto max-w-[240px] !rounded-full !text-[12.5px]"
              >
                <option value="">Dokument anhängen …</option>
                {doks.filter((d) => !anhaenge.includes(d.id)).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} (Version {d.version})
                  </option>
                ))}
              </Select>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <AnimatePresence initial={false}>
              {anhaenge.map((id) => {
                const d = doks.find((x) => x.id === id);
                if (!d) return null;
                return (
                  <motion.span key={id} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                    <Chip tone="ink" icon={<Paperclip className="size-3" />}>
                      <span className="max-w-[240px] truncate" title={`${d.name} (Version ${d.version})`}>
                        {d.name} · Version {d.version}
                      </span>
                      <button type="button" aria-label={`${d.name} entfernen`} onClick={() => setAnhaenge((a) => a.filter((x) => x !== id))} className="-mr-1 grid grid-cols-1 size-4 place-items-center rounded-full hover:bg-ink-soft">
                        <X className="size-3" />
                      </button>
                    </Chip>
                  </motion.span>
                );
              })}
            </AnimatePresence>
            {anhaenge.length === 0 && <span className="text-[12.5px] text-fg-3">Keine Anlagen.</span>}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
