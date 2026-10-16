// Kryptografisch sichere Zufallswerte für Passwörter und Kennungen – im Browser (Demo-Backend) und auf dem Server (Node ≥ 22).

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // ohne leicht verwechselbare Zeichen (0/O, 1/l/I)

/** Gleichverteilte Zufallszahl 0 … n−1 (Ablehnungsverfahren, damit keine Werte bevorzugt werden). */
export function zufallsZahl(n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > 0x100000000) throw new RangeError("zufallsZahl: ungültiger Bereich");
  const grenze = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < grenze) return buf[0] % n;
  }
}

/** Startpasswort im bekannten Format „Apex-XXXX-XXXX“ (≈ 46 Bit) – wird bei der ersten Anmeldung ersetzt. */
export function sicheresPasswort(): string {
  const block = () => Array.from({ length: 4 }, () => ALPHABET[zufallsZahl(ALPHABET.length)]).join("");
  return `Apex-${block()}-${block()}`;
}

/** Zufällige Kennung aus Kleinbuchstaben und Ziffern (z. B. für Kanzlei-IDs). */
export function zufallsKennung(laenge = 8): string {
  const z = "abcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: laenge }, () => z[zufallsZahl(z.length)]).join("");
}
