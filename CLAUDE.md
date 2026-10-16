# AnwaltApex – Hinweise für Claude Code

Lies zuerst `docs/MASTERPROMPT.md` (Produkt, Anforderungen, Phasen) und `docs/UI-LEITFADEN.md` (Design- & Coderegeln).

- UI-Sprache Deutsch; juristische Begriffe korrekt (beA, eEB, Notfrist, Vorfrist, Gegenstandswert, VV RVG).
- Fachlogik nur in `src/core` (ohne React, mit Tests in `src/core/*.test.ts`, `npm test`). Fristen berechnet ausschließlich `src/core/fristen.ts` – nie das Sprachmodell.
- KI-Zugriffe nur über `src/ai/llm.ts` (Server-Proxy / Artefakt-Laufzeit / Demo-Fallback). Jede KI-Funktion braucht einen Offline-Fallback.
- Daten über `useData` (zustand) ändern; Persistenz läuft über `src/lib/backend` (Demo: IndexedDB, Server: REST).
- Server: `server/index.ts` (Hono, node:sqlite). Jede Datenabfrage ist auf die Kanzlei der Sitzung begrenzt – Mandantentrennung niemals aufweichen.
- Farben nur über Tokens aus `src/styles/index.css`; Hell- und Dunkelmodus und 360 px Breite prüfen (`node scripts/shot.mjs …`).
- Keine `alert/confirm/prompt`, keine externen Ressourcen (Fonts, CDNs, Tracking).
- Prüfen vor dem Commit: `npm run typecheck && npm test && npm run build`.
