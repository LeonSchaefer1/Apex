// Sprachein- und -ausgabe über die Web Speech API (Browser-intern, ohne Zusatzdienste der App).

type RecCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function recCtor(): RecCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function spracheingabeVerfuegbar(): boolean {
  return !!recCtor();
}

export function sprachausgabeVerfuegbar(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Startet die Spracheingabe (Deutsch). Gibt eine Stopp-Funktion zurück. */
export function hoeren(cb: { onInterim: (t: string) => void; onFinal: (t: string) => void; onEnde: () => void; onFehler: (msg: string) => void }): () => void {
  const Ctor = recCtor();
  if (!Ctor) {
    cb.onFehler("Spracheingabe wird von diesem Browser nicht unterstützt. Bitte Chrome, Edge oder Safari verwenden.");
    cb.onEnde();
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = "de-DE";
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let final = "";
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    cb.onInterim((final + " " + interim).trim());
  };
  rec.onerror = (e) => {
    const map: Record<string, string> = {
      "not-allowed": "Mikrofon nicht freigegeben. Bitte erlauben Sie den Zugriff in Ihrem Browser.",
      "service-not-allowed": "Spracheingabe ist in dieser Ansicht nicht erlaubt.",
      "no-speech": "Ich habe nichts gehört – bitte noch einmal versuchen.",
      "audio-capture": "Kein Mikrofon gefunden.",
      network: "Die Spracherkennung ist gerade nicht erreichbar.",
    };
    if (e.error !== "aborted") cb.onFehler(map[e.error] ?? "Spracheingabe fehlgeschlagen.");
  };
  rec.onend = () => {
    if (final.trim()) cb.onFinal(final.trim());
    cb.onEnde();
  };
  try {
    rec.start();
  } catch {
    cb.onFehler("Spracheingabe konnte nicht gestartet werden.");
    cb.onEnde();
  }
  return () => {
    try {
      rec.stop();
    } catch {
      /* bereits beendet */
    }
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
