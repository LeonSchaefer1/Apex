// Namens-, Orts- und Gerichtsdaten für realistische Demodaten.

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
