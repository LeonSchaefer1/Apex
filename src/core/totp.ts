// Zwei-Faktor-Anmeldung: zeitbasierte Einmalcodes (TOTP) nach RFC 6238 (HOTP nach RFC 4226) – 30 s, 6 Stellen, HMAC-SHA-1.
// Reine Fachlogik ohne React und ohne externe Bibliotheken: Web Crypto (Browser und Node ≥ 19 global), sonst eine eingebaute
// SHA-1-Umsetzung als Rückfall (z. B. in Umgebungen ohne „sicheren Kontext“). Läuft identisch im Browser und auf dem Server.

export const TOTP_SCHRITT = 30;
export const TOTP_STELLEN = 6;
/** Zulässige Abweichung in Zeitschritten (± 30 s) – gleicht Uhrabweichungen des Telefons aus. */
export const TOTP_FENSTER = 1;

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Base32 nach RFC 4648 ohne Auffüllzeichen (so erwarten es Authenticator-Apps). */
export function base32Kodieren(bytes: Uint8Array): string {
  let bits = 0;
  let wert = 0;
  let out = "";
  for (const b of bytes) {
    wert = (wert << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(wert >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(wert << (5 - bits)) & 31];
  return out;
}

/** Base32 lesen – Leerzeichen, Bindestriche und Kleinschreibung (vom Abtippen) sind erlaubt. Ungültige Zeichen → Fehler. */
export function base32Dekodieren(text: string): Uint8Array {
  const s = text.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
  const out: number[] = [];
  let bits = 0;
  let wert = 0;
  for (const ch of s) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error("Ungültiges Zeichen im Schlüssel");
    wert = (wert << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((wert >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** Schlüssel in Vierergruppen zum Abtippen: „JBSW Y3DP EHPK 3PXP …“. */
export function schluesselGruppiert(base32: string): string {
  return base32.replace(/(.{4})/g, "$1 ").trim();
}

function zufallsBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

/** Neuer geheimer Schlüssel: 20 Byte (160 Bit, Empfehlung RFC 4226) als Base32 (32 Zeichen). */
export function neuerSchluessel(): string {
  return base32Kodieren(zufallsBytes(20));
}

/** otpauth-URI für Authenticator-Apps (Key-Uri-Format): Aussteller und Konto erscheinen in der App. */
export function otpauthUri(schluessel: string, konto: string, aussteller = "AnwaltApex"): string {
  const label = encodeURIComponent(`${aussteller}:${konto}`);
  const p = new URLSearchParams({ secret: schluessel, issuer: aussteller, algorithm: "SHA1", digits: String(TOTP_STELLEN), period: String(TOTP_SCHRITT) });
  return `otpauth://totp/${label}?${p.toString()}`;
}

// ───────────── SHA-1 / HMAC (Rückfall ohne Web Crypto) ─────────────

function sha1(daten: Uint8Array): Uint8Array {
  const ml = daten.length * 8;
  const laenge = (((daten.length + 8) >> 6) + 1) * 64;
  const m = new Uint8Array(laenge);
  m.set(daten);
  m[daten.length] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(laenge - 8, Math.floor(ml / 2 ** 32));
  dv.setUint32(laenge - 4, ml >>> 0);
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  const rotl = (x: number, n: number) => ((x << n) | (x >>> (32 - n))) >>> 0;
  for (let off = 0; off < laenge; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      const [f, k] = i < 20 ? [(b & c) | (~b & d), 0x5a827999] : i < 40 ? [b ^ c ^ d, 0x6ed9eba1] : i < 60 ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc] : [b ^ c ^ d, 0xca62c1d6];
      const t = (rotl(a, 5) + (f >>> 0) + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = t;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  const out = new Uint8Array(20);
  const ov = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => ov.setUint32(i * 4, h));
  return out;
}

/** HMAC-SHA-1 in reinem TypeScript (RFC 2104) – Rückfall, wenn Web Crypto fehlt. Exportiert für die Tests. */
export function hmacSha1Rein(schluessel: Uint8Array, nachricht: Uint8Array): Uint8Array {
  let k = schluessel.length > 64 ? sha1(schluessel) : schluessel;
  const block = new Uint8Array(64);
  block.set(k);
  k = block;
  const innen = new Uint8Array(64 + nachricht.length);
  const aussen = new Uint8Array(64 + 20);
  for (let i = 0; i < 64; i++) {
    innen[i] = k[i] ^ 0x36;
    aussen[i] = k[i] ^ 0x5c;
  }
  innen.set(nachricht, 64);
  aussen.set(sha1(innen), 64);
  return sha1(aussen);
}

async function hmacSha1(schluessel: Uint8Array, nachricht: Uint8Array): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    try {
      const key = await subtle.importKey("raw", schluessel as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
      return new Uint8Array(await subtle.sign("HMAC", key, nachricht as BufferSource));
    } catch {
      /* z. B. kein sicherer Kontext – Rückfall */
    }
  }
  return hmacSha1Rein(schluessel, nachricht);
}

function zaehlerBytes(zaehler: number): Uint8Array {
  const b = new Uint8Array(8);
  const dv = new DataView(b.buffer);
  dv.setUint32(0, Math.floor(zaehler / 2 ** 32));
  dv.setUint32(4, zaehler >>> 0);
  return b;
}

/** Dynamische Kürzung nach RFC 4226 Abschnitt 5.3. */
export function kuerze(hmac: Uint8Array, stellen = TOTP_STELLEN): string {
  const off = hmac[hmac.length - 1] & 0x0f;
  const bin = ((hmac[off] & 0x7f) << 24) | (hmac[off + 1] << 16) | (hmac[off + 2] << 8) | hmac[off + 3];
  return String(bin % 10 ** stellen).padStart(stellen, "0");
}

/** HOTP-Code zum Zähler (RFC 4226). */
export async function hotp(schluessel: Uint8Array, zaehler: number, stellen = TOTP_STELLEN): Promise<string> {
  return kuerze(await hmacSha1(schluessel, zaehlerBytes(zaehler)), stellen);
}

/** Zeitschritt zu einem Zeitpunkt (Millisekunden seit 1970). */
export function zeitschritt(ms: number, schritt = TOTP_SCHRITT): number {
  return Math.floor(ms / 1000 / schritt);
}

/** TOTP-Code (RFC 6238) für einen Base32-Schlüssel zum Zeitpunkt `ms`. */
export async function totp(schluesselBase32: string, ms = Date.now(), stellen = TOTP_STELLEN): Promise<string> {
  return hotp(base32Dekodieren(schluesselBase32), zeitschritt(ms), stellen);
}

/** Eingabe normalisieren: Leerzeichen entfernen („123 456“ → „123456“). */
export function codeBereinigen(code: string): string {
  return code.replace(/\s+/g, "");
}

/**
 * Prüft einen eingegebenen Code im Fenster ± `fenster` Zeitschritte. Rückgabe: der getroffene Zeitschritt (für den Schutz vor
 * Wiederverwendung) oder `null`. `nichtVor`: Zeitschritte bis einschließlich dieses Werts gelten als verbraucht.
 */
export async function pruefeTotp(schluesselBase32: string, code: string, ms = Date.now(), opts: { fenster?: number; nichtVor?: number } = {}): Promise<number | null> {
  const c = codeBereinigen(code);
  if (!/^\d{6}$/.test(c)) return null;
  let key: Uint8Array;
  try {
    key = base32Dekodieren(schluesselBase32);
  } catch {
    return null;
  }
  const jetzt = zeitschritt(ms);
  const fenster = opts.fenster ?? TOTP_FENSTER;
  for (let d = -fenster; d <= fenster; d++) {
    const s = jetzt + d;
    if (opts.nichtVor !== undefined && s <= opts.nichtVor) continue;
    if ((await hotp(key, s)) === c) return s;
  }
  return null;
}

/** Wiederherstellungscodes: `anzahl` Codes der Form „7KQ4-M2XD“ (ohne verwechselbare Zeichen 0/O, 1/I/L). */
export function neueWiederherstellungscodes(anzahl = 8): string[] {
  const zeichen = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  // Verwerfungsverfahren statt Modulo – jedes Zeichen gleich wahrscheinlich
  const grenze = 256 - (256 % zeichen.length);
  const einCode = () => {
    let s = "";
    while (s.length < 8) for (const x of zufallsBytes(16)) if (x < grenze && s.length < 8) s += zeichen[x % zeichen.length];
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  };
  return Array.from({ length: anzahl }, einCode);
}

/** Wiederherstellungscode vergleichbar machen (Groß-/Kleinschreibung, Bindestrich und Leerzeichen egal). */
export function wiederherstellungNormal(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, "");
}
