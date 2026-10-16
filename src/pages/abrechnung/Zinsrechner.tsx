// Reiter „Zinsrechner“: freier Verzugszinsrechner (§ 288 BGB) für die schnelle Gegenprüfung – Betrag, Zeitraum, 5 PP, 9 PP
// oder fester Satz. Gleicher Rechenkern wie das Forderungskonto (src/core/zinsen.ts), Abschnitte je Basiszinswechsel, act/365.
import { useMemo, useRef, useState } from "react";
import { Copy, Info, Percent } from "lucide-react";
import { Button, Card, CardHeader, Field, Input, Segmented } from "@/components/ui";
import { diffDays, fmtDate, fmtEUR, round2 } from "@/core/dates";
import { basiszinsAm, verzugszinsen, type ZinsAbschnitt } from "@/core/zinsen";
import { kopiereText } from "@/lib/zwischenablage";
import { toast } from "@/store/ui";
import { fmtProzent, parseBetrag } from "./lib";
import { TabKopf as Kopf } from "./ui";

type Satzart = "5" | "9" | "fest";

/** Zinsen zu einem festen Jahreszinssatz für [von, bis] (beide einschließlich), act/365 – ein Abschnitt. */
function festeZinsen(kapital: number, von: string, bis: string, satz: number): ZinsAbschnitt[] {
  if (bis < von || kapital <= 0 || !(satz > 0)) return [];
  const tage = diffDays(von, bis) + 1;
  return [{ von, bis, tage, kapital, zinssatz: round2(satz), zinsen: round2((kapital * satz * tage) / 36500) }];
}

const SATZ_LABEL: Record<Satzart, string> = { "5": "5 PP über Basiszins", "9": "9 PP über Basiszins", fest: "fester Satz" };

export function ZinsrechnerTab() {
  const [betrag, setBetrag] = useState("5.000");
  const [von, setVon] = useState("2026-07-01");
  const [bis, setBis] = useState("2026-07-30");
  const [art, setArt] = useState<Satzart>("9");
  const [fest, setFest] = useState("4");
  const tabelleRef = useRef<HTMLTableElement>(null);

  const kapital = parseBetrag(betrag);
  const datumOk = /^\d{4}-\d{2}-\d{2}$/.test(von) && /^\d{4}-\d{2}-\d{2}$/.test(bis);
  const festSatz = parseBetrag(fest);
  const fehler = !(kapital > 0)
    ? "Bitte einen Betrag eingeben, z. B. 5.000."
    : !datumOk
      ? "Bitte Beginn und Ende des Zinszeitraums eintragen."
      : bis < von
        ? "Das Ende liegt vor dem Beginn."
        : art === "fest" && !(festSatz > 0)
          ? "Bitte einen Zinssatz in Prozent eingeben, z. B. 4."
          : undefined;

  const abschnitte = useMemo<ZinsAbschnitt[]>(() => {
    if (fehler) return [];
    return art === "fest" ? festeZinsen(kapital, von, bis, festSatz) : verzugszinsen(kapital, von, bis, art === "5");
  }, [fehler, art, kapital, von, bis, festSatz]);
  const summe = round2(abschnitte.reduce((s, a) => s + a.zinsen, 0));
  const tage = abschnitte.reduce((s, a) => s + a.tage, 0);

  const text = () =>
    [
      `Zinsberechnung (${art === "fest" ? `fester Satz ${fmtProzent(festSatz)}` : `${art} Prozentpunkte über dem Basiszinssatz, § 288 Abs. ${art === "5" ? "1" : "2"} BGB`}, act/365)`,
      `Kapital ${fmtEUR(kapital)}, Zeitraum ${fmtDate(von)} bis ${fmtDate(bis)} (je einschließlich, ${tage} Tage)`,
      ...abschnitte.map((a) => `Zinsen ${fmtProzent(a.zinssatz)} aus ${fmtEUR(a.kapital)} vom ${fmtDate(a.von)} bis ${fmtDate(a.bis)} (${a.tage} Tage): ${fmtEUR(a.zinsen)}`),
      `Summe: ${fmtEUR(summe)}`,
    ].join("\n");

  const kopieren = async () => {
    const r = await kopiereText(text(), tabelleRef.current);
    if (r === "kopiert") toast("Ergebnis kopiert", { text: `${abschnitte.length} ${abschnitte.length === 1 ? "Abschnitt" : "Abschnitte"} · Summe ${fmtEUR(summe)}`, ton: "erfolg" });
    else if (r === "markiert") toast("Tabelle markiert", { text: "Jetzt mit Strg+C (Mac: ⌘C) kopieren.", ton: "info" });
    else toast("Kopieren nicht möglich", { ton: "warnung" });
  };

  return (
    <>
      <Kopf
        icon={<Percent className="size-[18px]" />}
        titel="Zinsrechner"
        text="Verzugszinsen frei berechnen – für die schnelle Gegenprüfung einer Aufstellung, ohne Forderungssache. Gleicher Rechenkern wie das Forderungskonto."
      />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader icon={<Percent className="size-4" />} title="Eingaben" subtitle="Zeitraum: Beginn und Ende jeweils einschließlich – Tageszählung act/365." />
          <div className="grid gap-3.5">
            <Field label="Betrag (€)" htmlFor="zr-betrag">
              <Input id="zr-betrag" value={betrag} onChange={(e) => setBetrag(e.target.value)} inputMode="decimal" className="num" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="von (einschließlich)" htmlFor="zr-von">
                <Input id="zr-von" type="date" value={von} onChange={(e) => setVon(e.target.value)} />
              </Field>
              <Field label="bis (einschließlich)" htmlFor="zr-bis">
                <Input id="zr-bis" type="date" value={bis} onChange={(e) => setBis(e.target.value)} />
              </Field>
            </div>
            <Field label="Zinssatz">
              <Segmented<Satzart>
                full
                value={art}
                onChange={setArt}
                options={[
                  { value: "5", label: "5 PP" },
                  { value: "9", label: "9 PP" },
                  { value: "fest", label: "fester Satz" },
                ]}
              />
            </Field>
            {art === "fest" && (
              <Field label="Fester Jahreszinssatz (%)" htmlFor="zr-fest">
                <Input id="zr-fest" value={fest} onChange={(e) => setFest(e.target.value)} inputMode="decimal" className="num" />
              </Field>
            )}
            <p className="flex items-start gap-2 rounded-[12px] bg-ink-softer px-3 py-2 text-[12.5px] text-fg-2">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {art === "5" && "§ 288 Abs. 1 BGB: 5 Prozentpunkte über dem Basiszinssatz – wenn ein Verbraucher beteiligt ist."}
                {art === "9" && "§ 288 Abs. 2 BGB: 9 Prozentpunkte über dem Basiszinssatz – Entgeltforderung, kein Verbraucher beteiligt."}
                {art === "fest" && "Fester Satz, z. B. laut Vertrag oder Titel – ohne Basiszinswechsel."}
                {art !== "fest" && datumOk && ` Basiszinssatz am ${fmtDate(von)}: ${fmtProzent(basiszinsAm(von))}.`}
              </span>
            </p>
            {fehler && (
              <p role="status" className="text-[12.5px] font-medium text-seal">
                {fehler}
              </p>
            )}
          </div>
        </Card>

        <Card padded={false} className="overflow-hidden">
          <div className="flex flex-wrap items-start gap-3 p-5 pb-3">
            <CardHeader className="!mb-0 min-w-0 flex-1 basis-[220px]" icon={<Percent className="size-4" />} title="Ergebnis" subtitle={`${SATZ_LABEL[art]} · neuer Abschnitt bei jedem Basiszinswechsel · act/365`} />
            <Button size="sm" variant="secondary" icon={<Copy className="size-4" />} disabled={!abschnitte.length} onClick={() => void kopieren()}>
              Ergebnis kopieren
            </Button>
          </div>
          <div className="overflow-x-auto border-t border-[var(--line)]">
            <table ref={tabelleRef} className="table">
              <thead>
                <tr>
                  <th>Zeitraum</th>
                  <th className="!text-right">Tage</th>
                  <th className="!text-right">Zinssatz</th>
                  <th className="!text-right">Kapital</th>
                  <th className="!text-right">Zinsen</th>
                </tr>
              </thead>
              <tbody>
                {abschnitte.map((a) => (
                  <tr key={a.von}>
                    <td className="num whitespace-nowrap">
                      {fmtDate(a.von)} – {fmtDate(a.bis)}
                    </td>
                    <td className="num text-right">{a.tage}</td>
                    <td className="num whitespace-nowrap text-right">{fmtProzent(a.zinssatz)}</td>
                    <td className="num whitespace-nowrap text-right">{fmtEUR(a.kapital)}</td>
                    <td className="num whitespace-nowrap text-right font-medium">{fmtEUR(a.zinsen)}</td>
                  </tr>
                ))}
                {!abschnitte.length && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[13px] text-fg-3">
                      {fehler ?? "Keine Zinsen im Zeitraum."}
                    </td>
                  </tr>
                )}
              </tbody>
              {abschnitte.length > 0 && (
                <tfoot>
                  <tr>
                    <td className="px-3 py-3 text-[13px] font-semibold">Summe</td>
                    <td className="num px-3 py-3 text-right text-[13px] font-semibold">{tage}</td>
                    <td colSpan={2} />
                    <td className="num px-3 py-3 text-right text-[15px] font-semibold">{fmtEUR(summe)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {abschnitte.length > 0 && (
            <p className="border-t border-[var(--line)] px-5 py-3 text-[12.5px] text-fg-3">
              Rechenweg je Abschnitt: Kapital × Zinssatz × Tage ÷ 365 – z. B. {fmtEUR(abschnitte[0].kapital)} × {fmtProzent(abschnitte[0].zinssatz)} × {abschnitte[0].tage} ÷ 365 = {fmtEUR(abschnitte[0].zinsen)}.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
