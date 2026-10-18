import { test } from "node:test";
import assert from "node:assert/strict";
import {
  base32Dekodieren, base32Kodieren, hmacSha1Rein, hotp, kuerze, neueWiederherstellungscodes, neuerSchluessel, otpauthUri, pruefeTotp, schluesselGruppiert, totp, wiederherstellungNormal, zeitschritt,
} from "./totp";

// RFC 6238, Anhang B: Schlüssel „12345678901234567890“ (ASCII), SHA-1, 8 Stellen
const RFC_SCHLUESSEL = base32Kodieren(new TextEncoder().encode("12345678901234567890"));
const RFC_VEKTOREN: [number, string][] = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

test("TOTP: Base32 nach RFC 4648 (Hin und zurück, Abtippen tolerant)", () => {
  assert.equal(RFC_SCHLUESSEL, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  assert.equal(base32Kodieren(new TextEncoder().encode("foobar")), "MZXW6YTBOI");
  assert.deepEqual([...base32Dekodieren("mzxw 6ytb-oi")], [...new TextEncoder().encode("foobar")]);
  assert.throws(() => base32Dekodieren("AB1C"));
  const s = neuerSchluessel();
  assert.match(s, /^[A-Z2-7]{32}$/);
  assert.equal(schluesselGruppiert("ABCDEFGHIJ"), "ABCD EFGH IJ");
});

test("TOTP: Testvektoren aus RFC 6238 (SHA-1, 8 Stellen) über Web Crypto", async () => {
  for (const [sek, code] of RFC_VEKTOREN) assert.equal(await totp(RFC_SCHLUESSEL, sek * 1000, 8), code, `T = ${sek}`);
});

test("TOTP: dieselben Vektoren mit 6 Stellen und über die eingebaute SHA-1 (Rückfall)", async () => {
  const key = new TextEncoder().encode("12345678901234567890");
  for (const [sek, code] of RFC_VEKTOREN) {
    assert.equal(await totp(RFC_SCHLUESSEL, sek * 1000), code.slice(-6), `T = ${sek}`);
    const z = new Uint8Array(8);
    new DataView(z.buffer).setUint32(4, zeitschritt(sek * 1000));
    if (zeitschritt(sek * 1000) > 0xffffffff) continue;
    assert.equal(kuerze(hmacSha1Rein(key, z), 8), code, `rein T = ${sek}`);
  }
  // RFC 4226 Anhang D (HOTP): Zähler 0 → 755224, 9 → 520489
  assert.equal(await hotp(key, 0), "755224");
  assert.equal(await hotp(key, 9), "520489");
});

test("TOTP: Prüfung im Fenster ± 30 s, falsche Codes und Wiederverwendung abgelehnt", async () => {
  const s = neuerSchluessel();
  const jetzt = Date.UTC(2026, 9, 16, 9, 30, 10);
  const code = await totp(s, jetzt);
  assert.equal(await pruefeTotp(s, code, jetzt), zeitschritt(jetzt));
  assert.equal(await pruefeTotp(s, code.slice(0, 3) + " " + code.slice(3), jetzt), zeitschritt(jetzt), "Leerzeichen erlaubt");
  assert.notEqual(await pruefeTotp(s, code, jetzt + 30_000), null, "nächster Schritt noch gültig (Uhrabweichung)");
  assert.equal(await pruefeTotp(s, code, jetzt + 95_000), null, "nach drei Schritten abgelaufen");
  const falsch = String((Number(code) + 1) % 1_000_000).padStart(6, "0");
  assert.equal(await pruefeTotp(s, falsch, jetzt), null);
  assert.equal(await pruefeTotp(s, "12ab56", jetzt), null);
  assert.equal(await pruefeTotp(s, code, jetzt, { nichtVor: zeitschritt(jetzt) }), null, "bereits verwendeter Code");
});

test("TOTP: otpauth-URI und Wiederherstellungscodes", () => {
  const uri = otpauthUri("JBSWY3DPEHPK3PXP", "claudia.reinholz@kanzlei.de");
  assert.match(uri, /^otpauth:\/\/totp\/Apex%3Aclaudia\.reinholz%40kanzlei\.de\?/);
  assert.match(uri, /secret=JBSWY3DPEHPK3PXP/);
  assert.match(uri, /issuer=Apex(&|$)/);
  assert.match(uri, /digits=6/);
  assert.match(uri, /period=30/);
  const codes = neueWiederherstellungscodes();
  assert.equal(codes.length, 8);
  assert.equal(new Set(codes).size, 8);
  for (const c of codes) assert.match(c, /^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
  assert.equal(wiederherstellungNormal(" 7kq4-m2xd "), "7KQ4M2XD");
});
