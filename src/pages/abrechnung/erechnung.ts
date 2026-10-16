// E-Rechnung nach EN 16931: XRechnung (UBL 2.1, CIUS XRechnung 3.0) und ZUGFeRD/Factur-X (CII, Profil EN 16931).
// Erzeugt die strukturierten Daten einer Rechnung zum Abrufen; im Prototyp ohne Versand und ohne PDF/A-3-Container.
import type { Akte, Kontakt, Rechnung, RechnungsPosition, Tenant, Zeiteintrag } from "@/core/types";
import { round2 } from "@/core/dates";
import { leistungszeitraum, satzAusPosition } from "./lib";

const x = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const b = (n: number) => round2(n).toFixed(2);
const UST = 19;

/** Rechnungsart: 380 Rechnung, 386 Vorschussrechnung, 384 Korrekturrechnung. */
function typCode(r: Rechnung): string {
  if (r.art === "vorschuss") return "386";
  if (r.korrekturVon) return "384";
  return "380";
}

function steuerKennung(t: Tenant): { id: string; schema: "VAT" | "FC" } {
  if (t.ustIdNr) return { id: t.ustIdNr, schema: "VAT" };
  if (t.steuernummer) return { id: t.steuernummer, schema: "FC" };
  return { id: "DE000000000", schema: "VAT" };
}

/** Adresse „Kurfürstendamm 186, 10707 Berlin“ in Straße, PLZ, Ort zerlegen. */
function adresse(text: string): { strasse: string; plz: string; ort: string } {
  const m = /^(.*?),\s*(\d{5})\s+(.+)$/.exec(text.trim());
  return m ? { strasse: m[1], plz: m[2], ort: m[3] } : { strasse: text, plz: "", ort: "" };
}

/** Position als Menge × Preis: Zeit in Stunden (HUR), sonst 1 Stück; negative Beträge (Anrechnung) mit Menge −1. */
function zeile(p: RechnungsPosition): { menge: number; einheit: string; preis: number; betrag: number; name: string } {
  const name = p.vv === "Std" ? p.bezeichnung : /^\d{4}$/.test(p.vv) ? `Nr. ${p.vv} VV RVG – ${p.bezeichnung}` : `${p.vv} ${p.bezeichnung}`.trim();
  if (p.vv === "Std" && p.menge) return { menge: p.menge, einheit: "HUR", preis: satzAusPosition(p) || round2(Math.abs(p.betrag) / p.menge), betrag: p.betrag, name };
  return { menge: p.betrag < 0 ? -1 : 1, einheit: "C62", preis: Math.abs(p.betrag), betrag: p.betrag, name };
}

interface Kontext {
  akte?: Akte;
  empfaenger?: Kontakt;
  tenant: Tenant;
  hinweise?: string[];
  /** Zeiten der Kanzlei – Leistungszeitraum einer Zeitrechnung vom ersten bis zum letzten abgerechneten Eintrag */
  zeiten?: Zeiteintrag[];
}

/** XRechnung (UBL 2.1) – als XML-Datei abrufbar. */
export function xrechnungXml(r: Rechnung, { akte, empfaenger, tenant, hinweise = [], zeiten = [] }: Kontext): string {
  const [von, bis] = leistungszeitraum(akte, r, zeiten);
  const st = steuerKennung(tenant);
  const sitz = adresse(tenant.adresse);
  const zeilen = r.positionen.map(zeile);
  const partei = (name: string, a: { strasse: string; plz: string; ort: string }, steuer = "") => `
      <cac:Party>
        <cac:PostalAddress>
          <cbc:StreetName>${x(a.strasse)}</cbc:StreetName>
          <cbc:CityName>${x(a.ort)}</cbc:CityName>
          <cbc:PostalZone>${x(a.plz)}</cbc:PostalZone>
          <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
        </cac:PostalAddress>${steuer}
        <cac:PartyLegalEntity><cbc:RegistrationName>${x(name)}</cbc:RegistrationName></cac:PartyLegalEntity>
      </cac:Party>`;
  const verkaeufer = partei(
    tenant.name,
    sitz,
    `
        <cac:PartyTaxScheme><cbc:CompanyID>${x(st.id)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>${st.schema}</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>`,
  );
  const kaeufer = partei(empfaenger?.name ?? "Mandant", { strasse: empfaenger?.strasse ?? "", plz: empfaenger?.plz ?? "", ort: empfaenger?.ort ?? "" });
  const notiz = [akte ? `In Sachen ${akte.titel}` : "", ...hinweise].filter(Boolean).join(" · ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${x(r.nummer)}</cbc:ID>
  <cbc:IssueDate>${r.datum}</cbc:IssueDate>
  <cbc:DueDate>${r.faellig}</cbc:DueDate>
  <cbc:InvoiceTypeCode>${typCode(r)}</cbc:InvoiceTypeCode>${notiz ? `\n  <cbc:Note>${x(notiz)}</cbc:Note>` : ""}
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${x(akte?.aktenzeichen ?? r.nummer)}</cbc:BuyerReference>
  <cac:InvoicePeriod><cbc:StartDate>${von}</cbc:StartDate><cbc:EndDate>${bis}</cbc:EndDate></cac:InvoicePeriod>
  <cac:AccountingSupplierParty>${verkaeufer}
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>${kaeufer}
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cbc:PaymentID>${x(r.nummer)}</cbc:PaymentID>
    <cac:PayeeFinancialAccount><cbc:ID>DE00000000000000000000</cbc:ID></cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${b(r.ust)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${b(r.netto)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${b(r.ust)}</cbc:TaxAmount>
      <cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>${UST}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${b(r.netto)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${b(r.netto)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${b(r.brutto)}</cbc:TaxInclusiveAmount>
    <cbc:PrepaidAmount currencyID="EUR">${b(r.bezahlt)}</cbc:PrepaidAmount>
    <cbc:PayableAmount currencyID="EUR">${b(r.brutto - r.bezahlt)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${zeilen
  .map(
    (z, i) => `  <cac:InvoiceLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${z.einheit}">${z.menge}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">${b(z.betrag)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${x(z.name)}</cbc:Name>
      <cac:ClassifiedTaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>${UST}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">${b(z.preis)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`,
  )
  .join("\n")}
</ubl:Invoice>
`;
}

/** ZUGFeRD / Factur-X (CII, Profil EN 16931) – das XML, das in die PDF/A-3 eingebettet wird. */
export function zugferdXml(r: Rechnung, { akte, empfaenger, tenant, hinweise = [], zeiten = [] }: Kontext): string {
  const [von, bis] = leistungszeitraum(akte, r, zeiten);
  const st = steuerKennung(tenant);
  const sitz = adresse(tenant.adresse);
  const d = (iso: string) => `<udt:DateTimeString format="102">${iso.replace(/-/g, "")}</udt:DateTimeString>`;
  const notiz = [akte ? `In Sachen ${akte.titel}` : "", ...hinweise].filter(Boolean);
  const zeilen = r.positionen.map(zeile);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${x(r.nummer)}</ram:ID>
    <ram:TypeCode>${typCode(r)}</ram:TypeCode>
    <ram:IssueDateTime>${d(r.datum)}</ram:IssueDateTime>${notiz.map((n) => `\n    <ram:IncludedNote><ram:Content>${x(n)}</ram:Content></ram:IncludedNote>`).join("")}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${zeilen
  .map(
    (z, i) => `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>${x(z.name)}</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${b(z.preis)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${z.einheit}">${z.menge}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>${UST}</ram:RateApplicablePercent></ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${b(z.betrag)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`,
  )
  .join("\n")}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>${x(akte?.aktenzeichen ?? r.nummer)}</ram:BuyerReference>
      <ram:SellerTradeParty>
        <ram:Name>${x(tenant.name)}</ram:Name>
        <ram:PostalTradeAddress><ram:PostcodeCode>${x(sitz.plz)}</ram:PostcodeCode><ram:LineOne>${x(sitz.strasse)}</ram:LineOne><ram:CityName>${x(sitz.ort)}</ram:CityName><ram:CountryID>DE</ram:CountryID></ram:PostalTradeAddress>
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="${st.schema === "VAT" ? "VA" : "FC"}">${x(st.id)}</ram:ID></ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${x(empfaenger?.name ?? "Mandant")}</ram:Name>
        <ram:PostalTradeAddress><ram:PostcodeCode>${x(empfaenger?.plz ?? "")}</ram:PostcodeCode><ram:LineOne>${x(empfaenger?.strasse ?? "")}</ram:LineOne><ram:CityName>${x(empfaenger?.ort ?? "")}</ram:CityName><ram:CountryID>DE</ram:CountryID></ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime>${d(bis)}</ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:PaymentReference>${x(r.nummer)}</ram:PaymentReference>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>DE00000000000000000000</ram:IBANID></ram:PayeePartyCreditorFinancialAccount></ram:SpecifiedTradeSettlementPaymentMeans>
      <ram:ApplicableTradeTax><ram:CalculatedAmount>${b(r.ust)}</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode><ram:BasisAmount>${b(r.netto)}</ram:BasisAmount><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>${UST}</ram:RateApplicablePercent></ram:ApplicableTradeTax>
      <ram:BillingSpecifiedPeriod><ram:StartDateTime>${d(von)}</ram:StartDateTime><ram:EndDateTime>${d(bis)}</ram:EndDateTime></ram:BillingSpecifiedPeriod>
      <ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime>${d(r.faellig)}</ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${b(r.netto)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${b(r.netto)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${b(r.ust)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${b(r.brutto)}</ram:GrandTotalAmount>
        <ram:TotalPrepaidAmount>${b(r.bezahlt)}</ram:TotalPrepaidAmount>
        <ram:DuePayableAmount>${b(r.brutto - r.bezahlt)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`;
}
