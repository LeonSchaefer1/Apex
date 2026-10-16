// Namens-, Orts- und Gerichtsdaten für realistische Demodaten.
import type { Bundesland } from "../types";

export const VORNAMEN_M = ["Thomas", "Michael", "Andreas", "Stefan", "Christian", "Markus", "Daniel", "Tobias", "Florian", "Sebastian", "Jan", "Lukas", "Mehmet", "Ali", "Piotr", "Hendrik", "Matthias", "Kevin", "Dennis", "Oliver", "Rainer", "Klaus"];
export const VORNAMEN_W = ["Sabine", "Claudia", "Anna", "Katharina", "Laura", "Sarah", "Nina", "Melanie", "Petra", "Elif", "Fatma", "Johanna", "Lea", "Svenja", "Monika", "Ursula", "Ewa", "Marie", "Franziska", "Birgit", "Ines", "Carina"];
export const NACHNAMEN = ["Müller", "Schmidt", "Schneider", "Fischer", "Meyer", "Wagner", "Schulz", "Koch", "Richter", "Klein", "Wolf", "Neumann", "Schwarz", "Zimmermann", "Braun", "Hofmann", "Hartwig", "Lange", "Schmitt", "Werner", "Krause", "Meier", "Lehmann", "Köhler", "Kowalski", "Öztürk", "Nowak", "Vogel", "Friedrich", "Keller", "Günther", "Seidel", "Lorenz", "Albrecht", "Sommer", "Franke", "Winkler", "Arslan", "Peters", "Jansen"];
export const BRANCHEN = ["Logistik GmbH", "Haustechnik GmbH", "Bau GmbH & Co. KG", "Immobilien GmbH", "Autohaus GmbH", "Software GmbH", "Gastronomie GmbH", "Elektrotechnik GmbH", "Möbelwerk GmbH", "Medien GmbH", "Dachdeckerei GmbH", "Pflegedienst GmbH", "Metallbau GmbH", "Reinigungsservice GmbH"];
export const HAUSVERWALTUNGEN = ["Lindenhof Hausverwaltung GmbH", "Spreeblick Wohnen GmbH", "Isartal Immobilienverwaltung GmbH", "Alsterhaus Verwaltung GmbH", "Nordstern Facility GmbH", "Kastanienhof Wohnbau eG"];
export const GEGNERANWAELTE = ["Möller & Thiel Rechtsanwälte", "Rechtsanwälte Fuchs Partner mbB", "Dr. Kessler & Kollegen", "Kanzlei am Ring Rechtsanwälte", "Brenner Schuster Rechtsanwälte", "Wendt Rechtsanwälte PartG"];
export const VERSICHERUNGEN = ["Nordlicht Rechtsschutz AG", "Spreebogen Rechtsschutz VVaG", "Isarwerk Versicherung AG", "Elbtal Versicherung AG"];
export const KFZ_VERSICHERER = ["Elbtal Versicherung AG", "Isarwerk Versicherung AG", "Hanseatische Kraftfahrt-Versicherung AG", "Südstern Versicherung AG"];

export type StadtKey = "berlin" | "muenchen" | "hamburg";

export interface StadtDaten {
  ort: string;
  vorwahl: string;
  strassen: string[];
  plz: string[];
  gerichte: {
    ag: string[];
    lg: string;
    olg: string;
    arbg: string;
    mahn: string;
    fam: string;
    nachlass: string;
    straf: string;
    sta: string;
    bussgeld: string;
    vg: string;
  };
}

export const STAEDTE: Record<StadtKey, StadtDaten> = {
  berlin: {
    ort: "Berlin",
    vorwahl: "030",
    strassen: ["Kantstraße", "Sonnenallee", "Schönhauser Allee", "Karl-Marx-Straße", "Bergmannstraße", "Torstraße", "Wilmersdorfer Straße", "Prenzlauer Allee", "Hermannstraße", "Müllerstraße", "Turmstraße", "Boxhagener Straße"],
    plz: ["10115", "10405", "10585", "10965", "12043", "12047", "13353", "10627", "10437", "12053", "10551", "10245"],
    gerichte: {
      ag: ["Amtsgericht Charlottenburg", "Amtsgericht Mitte", "Amtsgericht Tempelhof-Kreuzberg", "Amtsgericht Neukölln"],
      lg: "Landgericht Berlin II",
      olg: "Kammergericht",
      arbg: "Arbeitsgericht Berlin",
      mahn: "Amtsgericht Wedding – Zentrales Mahngericht",
      fam: "Amtsgericht Tempelhof-Kreuzberg – Familiengericht",
      nachlass: "Amtsgericht Schöneberg – Nachlassgericht",
      straf: "Amtsgericht Tiergarten",
      sta: "Staatsanwaltschaft Berlin",
      bussgeld: "Polizei Berlin – Bußgeldstelle",
      vg: "Verwaltungsgericht Berlin",
    },
  },
  muenchen: {
    ort: "München",
    vorwahl: "089",
    strassen: ["Leopoldstraße", "Sendlinger Straße", "Landsberger Straße", "Rosenheimer Straße", "Schwanthalerstraße", "Nymphenburger Straße", "Lindwurmstraße", "Ungererstraße", "Dachauer Straße", "Belgradstraße", "Wörthstraße", "Fraunhoferstraße"],
    plz: ["80802", "80331", "80339", "81669", "80336", "80634", "80337", "80805", "80335", "80796", "81667", "80469"],
    gerichte: {
      ag: ["Amtsgericht München"],
      lg: "Landgericht München I",
      olg: "Oberlandesgericht München",
      arbg: "Arbeitsgericht München",
      mahn: "Amtsgericht Coburg – Zentrales Mahngericht",
      fam: "Amtsgericht München – Familiengericht",
      nachlass: "Amtsgericht München – Nachlassgericht",
      straf: "Amtsgericht München – Strafgericht",
      sta: "Staatsanwaltschaft München I",
      bussgeld: "Bayerisches Polizeiverwaltungsamt – Zentrale Bußgeldstelle",
      vg: "Verwaltungsgericht München",
    },
  },
  hamburg: {
    ort: "Hamburg",
    vorwahl: "040",
    strassen: ["Eppendorfer Weg", "Osterstraße", "Mühlenkamp", "Lange Reihe", "Ottenser Hauptstraße", "Wandsbeker Chaussee", "Grindelallee", "Schanzenstraße", "Fuhlsbüttler Straße", "Bahrenfelder Straße", "Hoheluftchaussee", "Barmbeker Straße"],
    plz: ["20259", "20255", "22303", "20099", "22765", "22089", "20146", "20357", "22305", "22761", "20253", "22303"],
    gerichte: {
      ag: ["Amtsgericht Hamburg", "Amtsgericht Hamburg-Altona", "Amtsgericht Hamburg-Wandsbek"],
      lg: "Landgericht Hamburg",
      olg: "Hanseatisches Oberlandesgericht",
      arbg: "Arbeitsgericht Hamburg",
      mahn: "Amtsgericht Hamburg – Mahngericht",
      fam: "Amtsgericht Hamburg – Familiengericht",
      nachlass: "Amtsgericht Hamburg – Nachlassgericht",
      straf: "Amtsgericht Hamburg – Strafgericht",
      sta: "Staatsanwaltschaft Hamburg",
      bussgeld: "Bußgeldstelle Hamburg",
      vg: "Verwaltungsgericht Hamburg",
    },
  },
};

// ───────────── Weitere Kanzleistandorte (Testzugänge aus der Apex Console) ─────────────
// Die Stadt der Kanzlei bestimmt Gerichte, Adressen und Vorwahlen der Beispieldaten.

const ALLGEMEINE_STRASSEN = ["Bahnhofstraße", "Hauptstraße", "Schillerstraße", "Goethestraße", "Lindenstraße", "Gartenstraße", "Kirchstraße", "Schulstraße", "Bergstraße", "Ringstraße", "Mozartstraße", "Friedrichstraße"];

const MAHN = {
  BW: "Amtsgericht Stuttgart – Zentrales Mahngericht",
  BY: "Amtsgericht Coburg – Zentrales Mahngericht",
  BEBB: "Amtsgericht Wedding – Zentrales Mahngericht",
  HB: "Amtsgericht Bremen – Mahngericht",
  HHMV: "Amtsgericht Hamburg – Mahngericht",
  HE: "Amtsgericht Hünfeld – Zentrales Mahngericht",
  NI: "Amtsgericht Uelzen – Zentrales Mahngericht",
  HAGEN: "Amtsgericht Hagen – Zentrales Mahngericht",
  EUSKIRCHEN: "Amtsgericht Euskirchen – Zentrales Mahngericht",
  RPSL: "Amtsgericht Mayen – Zentrales Mahngericht",
  MDR: "Amtsgericht Aschersleben – Zentrales Mahngericht",
  SH: "Amtsgericht Schleswig – Zentrales Mahngericht",
} as const;

/** Landesweite Vorgaben: Hauptstadt (für Vorwahl/PLZ, wenn die Stadt unbekannt ist), OLG, Mahngericht, Bußgeldstelle. */
const LAND: Record<Bundesland, { hauptstadt: string; olg: string; mahn: string; bussgeld?: string }> = {
  BW: { hauptstadt: "stuttgart", olg: "Oberlandesgericht Stuttgart", mahn: MAHN.BW },
  BY: { hauptstadt: "muenchen", olg: "Oberlandesgericht München", mahn: MAHN.BY, bussgeld: "Bayerisches Polizeiverwaltungsamt – Zentrale Bußgeldstelle" },
  BE: { hauptstadt: "berlin", olg: "Kammergericht", mahn: MAHN.BEBB, bussgeld: "Polizei Berlin – Bußgeldstelle" },
  BB: { hauptstadt: "potsdam", olg: "Brandenburgisches Oberlandesgericht", mahn: MAHN.BEBB, bussgeld: "Zentrale Bußgeldstelle der Polizei Brandenburg" },
  HB: { hauptstadt: "bremen", olg: "Hanseatisches Oberlandesgericht in Bremen", mahn: MAHN.HB },
  HH: { hauptstadt: "hamburg", olg: "Hanseatisches Oberlandesgericht", mahn: MAHN.HHMV, bussgeld: "Bußgeldstelle Hamburg" },
  HE: { hauptstadt: "wiesbaden", olg: "Oberlandesgericht Frankfurt am Main", mahn: MAHN.HE, bussgeld: "Regierungspräsidium Kassel – Zentrale Bußgeldstelle" },
  MV: { hauptstadt: "schwerin", olg: "Oberlandesgericht Rostock", mahn: MAHN.HHMV },
  NI: { hauptstadt: "hannover", olg: "Oberlandesgericht Celle", mahn: MAHN.NI },
  NW: { hauptstadt: "duesseldorf", olg: "Oberlandesgericht Düsseldorf", mahn: MAHN.HAGEN },
  RP: { hauptstadt: "mainz", olg: "Oberlandesgericht Koblenz", mahn: MAHN.RPSL },
  SL: { hauptstadt: "saarbruecken", olg: "Saarländisches Oberlandesgericht", mahn: MAHN.RPSL },
  SN: { hauptstadt: "dresden", olg: "Oberlandesgericht Dresden", mahn: MAHN.MDR },
  ST: { hauptstadt: "magdeburg", olg: "Oberlandesgericht Naumburg", mahn: MAHN.MDR },
  SH: { hauptstadt: "kiel", olg: "Schleswig-Holsteinisches Oberlandesgericht", mahn: MAHN.SH },
  TH: { hauptstadt: "erfurt", olg: "Thüringer Oberlandesgericht", mahn: MAHN.MDR },
};

interface Standort {
  land: Bundesland;
  ort: string;
  vorwahl: string;
  plz: string[];
  strassen?: string[];
  /** Abweichungen vom Muster „Amtsgericht/Landgericht/Arbeitsgericht <Ort>“ */
  g?: Partial<StadtDaten["gerichte"]>;
}

/** Größere Kanzleistandorte mit den tatsächlich zuständigen Gerichten (Schlüssel: vereinfachter Ortsname). */
const STANDORTE: Record<string, Standort> = {
  koeln: { land: "NW", ort: "Köln", vorwahl: "0221", plz: ["50667", "50670", "50672", "50674", "50677", "50733", "50823", "50931", "51063", "51105"], strassen: ["Aachener Straße", "Venloer Straße", "Zülpicher Straße", "Neusser Straße", "Severinstraße", "Luxemburger Straße", "Ehrenstraße", "Bonner Straße", "Dürener Straße", "Subbelrather Straße", "Deutzer Freiheit", "Frankfurter Straße"], g: { olg: "Oberlandesgericht Köln", mahn: MAHN.EUSKIRCHEN } },
  duesseldorf: { land: "NW", ort: "Düsseldorf", vorwahl: "0211", plz: ["40210", "40211", "40212", "40213", "40215", "40217", "40219", "40223", "40225", "40227", "40476", "40545"], strassen: ["Kölner Straße", "Graf-Adolf-Straße", "Nordstraße", "Lorettostraße", "Bilker Allee", "Kaiserswerther Straße", "Ackerstraße", "Brunnenstraße", "Friedrichstraße", "Oststraße", "Benrather Straße", "Rethelstraße"] },
  dortmund: { land: "NW", ort: "Dortmund", vorwahl: "0231", plz: ["44135", "44137", "44139", "44141", "44143", "44145", "44147"], strassen: ["Rheinische Straße", "Kaiserstraße", "Märkische Straße", "Brackeler Straße", "Hansastraße", "Saarlandstraße", "Münsterstraße", "Ruhrallee", "Kreuzstraße", "Hohe Straße", "Lindemannstraße", "Westenhellweg"], g: { olg: "Oberlandesgericht Hamm", vg: "Verwaltungsgericht Gelsenkirchen" } },
  essen: { land: "NW", ort: "Essen", vorwahl: "0201", plz: ["45127", "45128", "45130", "45131", "45138", "45141", "45143"], strassen: ["Rüttenscheider Straße", "Altendorfer Straße", "Frohnhauser Straße", "Steeler Straße", "Huyssenallee", "Kettwiger Straße", "Alfredstraße", "Viehofer Straße", "Holsterhauser Straße", "Gemarkenstraße", "Hachestraße", "Bochumer Landstraße"], g: { olg: "Oberlandesgericht Hamm", vg: "Verwaltungsgericht Gelsenkirchen" } },
  bochum: { land: "NW", ort: "Bochum", vorwahl: "0234", plz: ["44787", "44789", "44791", "44793", "44795", "44799", "44801"], g: { olg: "Oberlandesgericht Hamm", vg: "Verwaltungsgericht Gelsenkirchen" } },
  duisburg: { land: "NW", ort: "Duisburg", vorwahl: "0203", plz: ["47051", "47053", "47055", "47057", "47058", "47059"], g: { vg: "Verwaltungsgericht Düsseldorf" } },
  wuppertal: { land: "NW", ort: "Wuppertal", vorwahl: "0202", plz: ["42103", "42105", "42107", "42275", "42283", "42285"], g: { vg: "Verwaltungsgericht Düsseldorf" } },
  bonn: { land: "NW", ort: "Bonn", vorwahl: "0228", plz: ["53111", "53113", "53115", "53117", "53119", "53121", "53173", "53225"], g: { olg: "Oberlandesgericht Köln", vg: "Verwaltungsgericht Köln", mahn: MAHN.EUSKIRCHEN } },
  aachen: { land: "NW", ort: "Aachen", vorwahl: "0241", plz: ["52062", "52064", "52066", "52068", "52070", "52072"], g: { olg: "Oberlandesgericht Köln", mahn: MAHN.EUSKIRCHEN } },
  muenster: { land: "NW", ort: "Münster", vorwahl: "0251", plz: ["48143", "48145", "48147", "48149", "48151", "48153", "48155"], g: { olg: "Oberlandesgericht Hamm" } },
  bielefeld: { land: "NW", ort: "Bielefeld", vorwahl: "0521", plz: ["33602", "33604", "33607", "33609", "33611", "33613", "33615"], g: { olg: "Oberlandesgericht Hamm", vg: "Verwaltungsgericht Minden" } },
  frankfurt: { land: "HE", ort: "Frankfurt am Main", vorwahl: "069", plz: ["60311", "60313", "60316", "60318", "60322", "60325", "60385", "60431", "60486", "60594"], strassen: ["Berger Straße", "Leipziger Straße", "Schweizer Straße", "Eschersheimer Landstraße", "Mainzer Landstraße", "Hanauer Landstraße", "Oeder Weg", "Friedberger Landstraße", "Textorstraße", "Bockenheimer Landstraße", "Saalburgstraße", "Rödelheimer Landstraße"] },
  wiesbaden: { land: "HE", ort: "Wiesbaden", vorwahl: "0611", plz: ["65183", "65185", "65187", "65189", "65193", "65195", "65197"] },
  kassel: { land: "HE", ort: "Kassel", vorwahl: "0561", plz: ["34117", "34119", "34121", "34127", "34131"] },
  darmstadt: { land: "HE", ort: "Darmstadt", vorwahl: "06151", plz: ["64283", "64285", "64287", "64289", "64293", "64295"] },
  stuttgart: { land: "BW", ort: "Stuttgart", vorwahl: "0711", plz: ["70173", "70174", "70176", "70178", "70180", "70182", "70184", "70190", "70372"], strassen: ["Tübinger Straße", "Hauptstätter Straße", "Rotebühlstraße", "Olgastraße", "Neckarstraße", "Schwabstraße", "Böblinger Straße", "Hohenheimer Straße", "Marktstraße", "Heilbronner Straße", "Rosensteinstraße", "Wagenburgstraße"], g: { bussgeld: "Landeshauptstadt Stuttgart – Bußgeldstelle" } },
  karlsruhe: { land: "BW", ort: "Karlsruhe", vorwahl: "0721", plz: ["76131", "76133", "76135", "76137", "76139", "76185", "76189"], g: { olg: "Oberlandesgericht Karlsruhe" } },
  mannheim: { land: "BW", ort: "Mannheim", vorwahl: "0621", plz: ["68159", "68161", "68163", "68165", "68167", "68169"], g: { olg: "Oberlandesgericht Karlsruhe", vg: "Verwaltungsgericht Karlsruhe" } },
  freiburg: { land: "BW", ort: "Freiburg im Breisgau", vorwahl: "0761", plz: ["79098", "79100", "79102", "79104", "79106", "79110"], g: { olg: "Oberlandesgericht Karlsruhe", vg: "Verwaltungsgericht Freiburg" } },
  nuernberg: { land: "BY", ort: "Nürnberg", vorwahl: "0911", plz: ["90402", "90403", "90408", "90409", "90419", "90429", "90439", "90443", "90459", "90461"], strassen: ["Fürther Straße", "Allersberger Straße", "Äußere Sulzbacher Straße", "Bucher Straße", "Pirckheimerstraße", "Gibitzenhofstraße", "Rothenburger Straße", "Wodanstraße", "Regensburger Straße", "Nordring", "Bayreuther Straße", "Schweinauer Hauptstraße"], g: { lg: "Landgericht Nürnberg-Fürth", olg: "Oberlandesgericht Nürnberg", vg: "Verwaltungsgericht Ansbach", sta: "Staatsanwaltschaft Nürnberg-Fürth" } },
  augsburg: { land: "BY", ort: "Augsburg", vorwahl: "0821", plz: ["86150", "86152", "86153", "86154", "86156", "86159", "86161"] },
  regensburg: { land: "BY", ort: "Regensburg", vorwahl: "0941", plz: ["93047", "93049", "93051", "93053", "93055", "93059"], g: { olg: "Oberlandesgericht Nürnberg" } },
  wuerzburg: { land: "BY", ort: "Würzburg", vorwahl: "0931", plz: ["97070", "97072", "97074", "97076", "97080", "97082"], g: { olg: "Oberlandesgericht Bamberg" } },
  hannover: { land: "NI", ort: "Hannover", vorwahl: "0511", plz: ["30159", "30161", "30163", "30165", "30167", "30169", "30171", "30173", "30175", "30177"], strassen: ["Lister Meile", "Podbielskistraße", "Limmerstraße", "Hildesheimer Straße", "Engelbosteler Damm", "Celler Straße", "Vahrenwalder Straße", "Göttinger Straße", "Marienstraße", "Sallstraße", "Kollenrodtstraße", "Wunstorfer Straße"] },
  braunschweig: { land: "NI", ort: "Braunschweig", vorwahl: "0531", plz: ["38100", "38102", "38104", "38106", "38114", "38118"], g: { olg: "Oberlandesgericht Braunschweig" } },
  oldenburg: { land: "NI", ort: "Oldenburg", vorwahl: "0441", plz: ["26121", "26122", "26123", "26125", "26129", "26131"], g: { olg: "Oberlandesgericht Oldenburg" } },
  osnabrueck: { land: "NI", ort: "Osnabrück", vorwahl: "0541", plz: ["49074", "49076", "49078", "49080", "49082", "49084"], g: { olg: "Oberlandesgericht Oldenburg" } },
  bremen: { land: "HB", ort: "Bremen", vorwahl: "0421", plz: ["28195", "28199", "28203", "28205", "28209", "28211", "28213", "28215", "28217"], strassen: ["Ostertorsteinweg", "Schwachhauser Heerstraße", "Hamburger Straße", "Wachmannstraße", "Vor dem Steintor", "Neustadtswall", "Hastedter Heerstraße", "Waller Heerstraße", "Gröpelinger Heerstraße", "Am Dobben", "Humboldtstraße", "Am Wall"], g: { arbg: "Arbeitsgericht Bremen-Bremerhaven", bussgeld: "Ordnungsamt Bremen – Bußgeldstelle" } },
  leipzig: { land: "SN", ort: "Leipzig", vorwahl: "0341", plz: ["04103", "04105", "04107", "04109", "04155", "04177", "04229", "04275", "04315"], strassen: ["Karl-Liebknecht-Straße", "Eisenbahnstraße", "Georg-Schwarz-Straße", "Gohliser Straße", "Könneritzstraße", "Prager Straße", "Kochstraße", "Lützner Straße", "Dresdner Straße", "Kurt-Eisner-Straße", "Arthur-Hoffmann-Straße", "Wurzner Straße"] },
  dresden: { land: "SN", ort: "Dresden", vorwahl: "0351", plz: ["01067", "01069", "01097", "01099", "01127", "01139", "01187", "01219", "01277", "01307"], strassen: ["Königsbrücker Straße", "Bautzner Straße", "Louisenstraße", "Alaunstraße", "Großenhainer Straße", "Leipziger Straße", "Bürgerstraße", "Hechtstraße", "Schandauer Straße", "Wiener Straße", "Kesselsdorfer Straße", "Löbtauer Straße"] },
  chemnitz: { land: "SN", ort: "Chemnitz", vorwahl: "0371", plz: ["09111", "09112", "09113", "09119", "09126", "09130"] },
  halle: { land: "ST", ort: "Halle (Saale)", vorwahl: "0345", plz: ["06108", "06110", "06112", "06114", "06118", "06120"], g: { lg: "Landgericht Halle", arbg: "Arbeitsgericht Halle", vg: "Verwaltungsgericht Halle", sta: "Staatsanwaltschaft Halle" } },
  magdeburg: { land: "ST", ort: "Magdeburg", vorwahl: "0391", plz: ["39104", "39106", "39108", "39110", "39112", "39114"] },
  erfurt: { land: "TH", ort: "Erfurt", vorwahl: "0361", plz: ["99084", "99085", "99086", "99087", "99089", "99092", "99094", "99096"], g: { vg: "Verwaltungsgericht Weimar" } },
  potsdam: { land: "BB", ort: "Potsdam", vorwahl: "0331", plz: ["14467", "14469", "14471", "14473", "14478", "14480", "14482"] },
  kiel: { land: "SH", ort: "Kiel", vorwahl: "0431", plz: ["24103", "24105", "24106", "24109", "24113", "24114", "24116", "24118", "24143", "24145"], g: { vg: "Schleswig-Holsteinisches Verwaltungsgericht" } },
  luebeck: { land: "SH", ort: "Lübeck", vorwahl: "0451", plz: ["23552", "23554", "23556", "23558", "23560", "23562", "23564", "23566", "23568", "23569"], g: { vg: "Schleswig-Holsteinisches Verwaltungsgericht" } },
  schwerin: { land: "MV", ort: "Schwerin", vorwahl: "0385", plz: ["19053", "19055", "19057", "19059", "19061", "19063"] },
  rostock: { land: "MV", ort: "Rostock", vorwahl: "0381", plz: ["18055", "18057", "18059", "18069", "18106", "18107"], g: { vg: "Verwaltungsgericht Schwerin" } },
  mainz: { land: "RP", ort: "Mainz", vorwahl: "06131", plz: ["55116", "55118", "55120", "55122", "55124", "55126", "55127", "55131"] },
  koblenz: { land: "RP", ort: "Koblenz", vorwahl: "0261", plz: ["56068", "56070", "56072", "56073", "56075", "56076"] },
  saarbruecken: { land: "SL", ort: "Saarbrücken", vorwahl: "0681", plz: ["66111", "66113", "66115", "66117", "66119", "66121", "66123"], g: { vg: "Verwaltungsgericht des Saarlandes" } },
};

/** Vereinfachter Ortsname als Schlüssel: „Frankfurt am Main“ → „frankfurt“, „Halle (Saale)“ → „halle“. */
export function ortsSchluessel(stadt: string): string {
  return stadt
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(am|an der|im|in der|ob der|bei)\b.*$/, " ")
    .replace(/[^a-z]+/g, " ")
    .trim()
    .split(" ")[0] ?? "";
}

const HERO_ORTE: Record<string, StadtKey> = { berlin: "berlin", muenchen: "muenchen", munchen: "muenchen", hamburg: "hamburg" };
const HERO_LAND: Record<StadtKey, Bundesland> = { berlin: "BE", muenchen: "BY", hamburg: "HH" };

function ausStandort(s: Standort): StadtDaten {
  const L = LAND[s.land];
  return {
    ort: s.ort,
    vorwahl: s.vorwahl,
    strassen: s.strassen ?? ALLGEMEINE_STRASSEN,
    plz: s.plz,
    gerichte: {
      ag: [`Amtsgericht ${s.ort}`],
      lg: `Landgericht ${s.ort}`,
      olg: L.olg,
      arbg: `Arbeitsgericht ${s.ort}`,
      mahn: L.mahn,
      fam: `Amtsgericht ${s.ort} – Familiengericht`,
      nachlass: `Amtsgericht ${s.ort} – Nachlassgericht`,
      straf: `Amtsgericht ${s.ort} – Strafgericht`,
      sta: `Staatsanwaltschaft ${s.ort}`,
      bussgeld: L.bussgeld ?? `Stadt ${s.ort} – Bußgeldstelle`,
      vg: `Verwaltungsgericht ${s.ort}`,
      ...s.g,
    },
  };
}

/**
 * Orts- und Gerichtsdaten für die Beispieldaten einer Kanzlei.
 * Berlin, München und Hamburg nutzen die Präsentationsprofile; bekannte Großstädte die dort zuständigen Gerichte;
 * jede andere Stadt Gerichte „<Art> <Stadt>“ mit OLG und zentralem Mahngericht ihres Bundeslands.
 */
export function stadtDatenFuer(stadt: string | undefined, bundesland: Bundesland, profil: StadtKey): StadtDaten {
  const key = ortsSchluessel(stadt ?? "");
  const hero = HERO_ORTE[key];
  if (hero && HERO_LAND[hero] === bundesland) return STAEDTE[hero];
  const bekannt = STANDORTE[key];
  if (bekannt && bekannt.land === bundesland) return ausStandort(bekannt);
  const name = (stadt ?? "").trim();
  if (!name) {
    // Keine Stadt angegeben: Landeshauptstadt (bzw. das Profil, wenn es zum Bundesland passt)
    if (HERO_LAND[profil] === bundesland) return STAEDTE[profil];
    const hs = LAND[bundesland].hauptstadt;
    return HERO_ORTE[hs] ? STAEDTE[HERO_ORTE[hs]] : ausStandort(STANDORTE[hs]);
  }
  const hs = LAND[bundesland].hauptstadt;
  const basis = HERO_ORTE[hs] ? { vorwahl: STAEDTE[HERO_ORTE[hs]].vorwahl, plz: STAEDTE[HERO_ORTE[hs]].plz } : { vorwahl: STANDORTE[hs].vorwahl, plz: STANDORTE[hs].plz };
  return ausStandort({ land: bundesland, ort: name, vorwahl: basis.vorwahl, plz: basis.plz });
}
