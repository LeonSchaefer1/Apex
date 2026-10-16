// Sprachein- und -ausgabe über die Web Speech API (Browser-intern, ohne Zusatzdienste der App).

type RecCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function recCtor(): RecCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Für diese Sitzung gesperrt (Mikrofon verweigert oder in der eingebetteten Ansicht nicht erlaubt) → Mikrofon-Knopf ausblenden. */
let gesperrt = false;

export function spracheingabeVerfuegbar(): boolean {
  return !gesperrt && !!recCtor();
}

export function sprachausgabeVerfuegbar(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function eingebettet(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Ohne Lebenszeichen (onstart/onaudiostart) gilt die Spracheingabe als nicht verfügbar – z. B. in einer Sandbox ohne Mikrofon. */
const WACHHUND_MS = 4000;
/** Steht die Browser-Abfrage zur Mikrofonfreigabe noch aus, bekommt die Nutzerin mehr Zeit zum Bestätigen. */
const WACHHUND_ABFRAGE_MS = 10000;
const NICHT_VERFUEGBAR = "Spracheingabe ist in dieser Ansicht nicht verfügbar – bitte tippen Sie Ihre Frage.";

/**
 * Startet die Spracheingabe (Deutsch). Gibt eine Stopp-Funktion zurück.
 * `onEnde` wird genau einmal aufgerufen – nach Ende, Fehler, Stopp oder wenn der Wachhund anschlägt.
 * `onFehler(msg, dauerhaft)`: `dauerhaft` = Spracheingabe ist für diese Sitzung gesperrt (Knopf ausblenden).
 */
export function hoeren(cb: { onInterim: (t: string) => void; onFinal: (t: string) => void; onEnde: () => void; onFehler: (msg: string, dauerhaft?: boolean) => void }): () => void {
  const Ctor = recCtor();
  if (!Ctor || gesperrt) {
    cb.onFehler(gesperrt ? NICHT_VERFUEGBAR : "Spracheingabe wird von diesem Browser nicht unterstützt. Bitte Chrome, Edge oder Safari verwenden.");
    cb.onEnde();
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = "de-DE";
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let final = "";
  let gestartet = false;
  let beendet = false;
  let wachhund: ReturnType<typeof setTimeout> | undefined;
  let nachlauf: ReturnType<typeof setTimeout> | undefined;

  const ende = () => {
    if (beendet) return;
    beendet = true;
    clearTimeout(wachhund);
    clearTimeout(nachlauf);
    rec.onresult = rec.onerror = rec.onend = rec.onstart = rec.onaudiostart = null;
    if (final.trim()) cb.onFinal(final.trim());
    cb.onEnde();
  };
  const abbrechen = () => {
    try {
      rec.abort();
    } catch {
      /* bereits beendet */
    }
  };
  const sperren = (msg: string) => {
    gesperrt = true;
    abbrechen();
    cb.onFehler(msg, true);
    ende();
  };
  const wachhundStellen = (ms: number, msg = NICHT_VERFUEGBAR) => {
    clearTimeout(wachhund);
    wachhund = setTimeout(() => {
      if (gestartet || beendet) return;
      abbrechen();
      cb.onFehler(msg);
      ende();
    }, ms);
  };
  const lebt = () => {
    gestartet = true;
    clearTimeout(wachhund);
  };

  rec.onstart = lebt;
  rec.onaudiostart = lebt;
  rec.onresult = (e) => {
    lebt();
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    cb.onInterim((final + " " + interim).trim());
  };
  rec.onerror = (e) => {
    if (beendet) return;
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      sperren(
        e.error === "service-not-allowed" || eingebettet()
          ? NICHT_VERFUEGBAR
          : "Mikrofon nicht freigegeben – bitte tippen Sie Ihre Frage. Den Zugriff können Sie in den Browser-Einstellungen erlauben.",
      );
      return;
    }
    const map: Record<string, string> = {
      "no-speech": "Ich habe nichts gehört – bitte noch einmal versuchen.",
      "audio-capture": "Kein Mikrofon gefunden – bitte tippen Sie Ihre Frage.",
      network: "Die Spracherkennung ist gerade nicht erreichbar – bitte tippen Sie Ihre Frage.",
    };
    if (e.error !== "aborted") cb.onFehler(map[e.error] ?? "Spracheingabe fehlgeschlagen.");
    // Manche Browser senden nach einem Fehler kein onend mehr – den Zustand trotzdem sicher beenden.
    ende();
  };
  rec.onend = ende;

  try {
    rec.start();
  } catch {
    cb.onFehler("Spracheingabe konnte nicht gestartet werden.");
    ende();
    return () => {};
  }
  wachhundStellen(WACHHUND_MS);
  // Mikrofon bereits verweigert (z. B. Sandbox ohne Mikrofon) → sofort ehrlich melden statt zu warten;
  // Abfrage noch offen → mehr Zeit, damit eine Freigabe im Browser nicht abgeschnitten wird.
  try {
    void navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((p) => {
        if (beendet || gestartet) return;
        if (p.state === "denied") sperren(eingebettet() ? NICHT_VERFUEGBAR : "Mikrofon blockiert – bitte tippen Sie Ihre Frage. Den Zugriff können Sie in den Browser-Einstellungen erlauben.");
        else if (p.state === "prompt") wachhundStellen(WACHHUND_ABFRAGE_MS, "Keine Mikrofonfreigabe erhalten – bitte tippen Sie Ihre Frage oder versuchen Sie es erneut.");
      })
      .catch(() => {});
  } catch {
    /* Permissions-API nicht verfügbar */
  }

  return () => {
    if (beendet) return;
    if (!gestartet) {
      // Nie richtig gestartet: es kommt kein onend mehr – sofort beenden.
      abbrechen();
      ende();
      return;
    }
    try {
      rec.stop();
    } catch {
      /* bereits beendet */
    }
    // Erkanntes noch auswerten lassen, aber nicht ewig auf onend warten.
    nachlauf = setTimeout(() => {
      abbrechen();
      ende();
    }, 2500);
  };
}

function deutscheStimme(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const de = voices.filter((v) => v.lang?.toLowerCase().startsWith("de"));
  return de.find((v) => /anna|petra|helena|katja|google deutsch|marlene|vicki/i.test(v.name)) ?? de.find((v) => v.localService) ?? de[0];
}

/** Text für die Sprachausgabe vorbereiten (Markdown, Abkürzungen, Aktenzeichen). */
export function sprechbar(text: string): string {
  return text
    .replace(/\*\*|__|`|#+\s/g, "")
    .replace(/^•\s*/gm, "")
    .replace(/§§/g, "Paragrafen")
    .replace(/§/g, "Paragraf")
    .replace(/\bAbs\.\s?/g, "Absatz ")
    .replace(/\bNr\.\s?/g, "Nummer ")
    .replace(/\bz\. ?B\./g, "zum Beispiel")
    .replace(/\bggf\./g, "gegebenenfalls")
    .replace(/\bUSt\./g, "Umsatzsteuer")
    .replace(/\bRVG\b/g, "R V G")
    .replace(/\bZPO\b/g, "Z P O")
    .replace(/\bBGB\b/g, "B G B")
    .replace(/\bBGH\b/g, "B G H")
    .replace(/\bBAG\b/g, "B A G")
    .replace(/\beEB\b/g, "elektronisches Empfangsbekenntnis")
    .replace(/(\d{2,3})\/(\d{2})\b/g, "$1 Strich $2")
    .replace(/\s+/g, " ")
    .trim();
}

/** Liest Text vor; `onPegel` liefert einen Wert 0..1 für die Avatar-Animation. */
export function sprechen(text: string, cb: { onStart?: () => void; onEnde?: () => void; onPegel?: (v: number) => void } = {}): () => void {
  if (!sprachausgabeVerfuegbar()) {
    cb.onEnde?.();
    return () => {};
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(sprechbar(text).slice(0, 900));
  u.lang = "de-DE";
  const v = deutscheStimme();
  if (v) u.voice = v;
  u.rate = 1.04;
  u.pitch = 1;
  let timer: ReturnType<typeof setInterval> | undefined;
  u.onstart = () => {
    cb.onStart?.();
    timer = setInterval(() => cb.onPegel?.(0.35 + Math.random() * 0.65), 120);
  };
  u.onboundary = () => cb.onPegel?.(1);
  const ende = () => {
    clearInterval(timer);
    cb.onPegel?.(0);
    cb.onEnde?.();
  };
  u.onend = ende;
  u.onerror = ende;
  synth.speak(u);
  return () => {
    synth.cancel();
    ende();
  };
}
