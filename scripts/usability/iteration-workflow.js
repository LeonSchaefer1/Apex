export const meta = {
  name: 'anwaltapex-e2e-iteration',
  description: 'Volle E2E-Iteration: Kundenavatar Claudia Reinholz bedient AnwaltApex visuell (4 Blöcke, alle 24 Aufgaben), Feedback konsolidieren, umsetzen, prüfen',
  phases: [
    { title: 'Test', detail: 'Avatar bedient die Software visuell – 4 Blöcke parallel' },
    { title: 'Konsolidierung', detail: 'Bericht, Kennzahlen, Umsetzungspakete' },
    { title: 'Umsetzung', detail: '2 Fixer mit getrennten Bereichen' },
    { title: 'Prüfung', detail: 'Nachweis, Build, Tests, Restpunkte' },
  ],
}

const N = args.n
const SP = '/tmp/claude-0/-home-user/8e3855f9-d774-52dd-8eea-fde3897947a7/scratchpad'
const DOC = '/home/user/anwaltapex/docs/KUNDENAVATAR.md'
const OUT = `/home/user/anwaltapex/docs/usability/iteration-${N}`
const HINWEIS = args.hinweis ? `\nHINWEIS DER PROJEKTLEITUNG (verbindlich): ${args.hinweis}` : ''
const VORHER = N > 1 ? `/home/user/anwaltapex/docs/usability/iteration-${N - 1}.md` : null

const STEUERUNG = `SO BEDIENST DU DIE SOFTWARE (wie per Computer Use – visuell, Schritt für Schritt):
- Werkzeug: node ${SP}/avatar/avatar.mjs <dein-profilordner> - (JSON-Schrittliste über stdin). Lies zuerst die Kopfzeilen der Datei ${SP}/avatar/avatar.mjs (Schritt-Typen: viewport, theme, motion, vision, goto, click, dblclick, clickXY, hover, fill, type, press, select, upload, scroll, wait, shot, text, axe, eval).
- Dein Profilordner (Browser bleibt zwischen Aufrufen erhalten – Anmeldung, Daten, aktuelle Seite): ${SP}/avatar/i${N}-<block>/ . Der erste Aufruf startet mit leerem Browser (frische Demodaten).
- Arbeite wie ein Mensch: Screenshot machen ("shot"), ihn mit dem Read-Tool ANSEHEN, entscheiden, dann sichtbare Elemente bedienen (Selektoren über sichtbaren Text/Rolle, z. B. "text=Fristen übernehmen", "role=button[name=\\"Anmelden\\"]"). "text": true liefert sichtbare Texte und Bedienelemente der Ansicht. Pro Aufruf ruhig 3–8 Schritte, dann wieder ansehen.
- Während des Tests KEINEN Quellcode lesen (eine echte Nutzerin kann das auch nicht). Erst ganz am Ende darfst du per grep nach Dateien suchen, um Befunde einer Datei zuzuordnen (optional).
- Sparsam mit dem Kontext: höchstens ~45 Screenshots ansehen, jeden nur einmal.
- Dev-Server: http://127.0.0.1:5173 (nicht stoppen). 500 auf /api/info ist normal.`

const BLOECKE = [
  { key: 'A', titel: 'Erstkontakt, Verwaltung, Hilfe & 38h-Motor', aufgaben: 'T00 (Landing), T21 (Apex Console: eigenen Testzugang anlegen), T16 (erste Anmeldung im eigenen Testzugang), T18 Fall 3b (Gerichtsort-Probe NRW im eigenen Zugang), dann im Präsentationszugang: T10 (38h-Motor verstehen), T12 (Störung, Hilfe und Ansprechpartnerin), T13 (Einstellungen, Team, Lizenz, Datenschutz)' },
  { key: 'B', titel: 'Alltag Mandatsarbeit', aufgaben: 'Präsentationszugang: T01 (Morgenroutine im Cockpit), T02 (beA-Posteingang mit Urteil), T03 (Frist übernehmen, eEB, Vier-Augen-Kontrolle), T04 (Mandatsanfrage Kündigungsschutz mit Kollisionsprobe), T05 (E-Akte aufräumen und schreiben), T17 (Kontakte), T23 (Aktenübersicht, Mandantenportal, Nachfolge)' },
  { key: 'C', titel: 'Kanzlei, Geld & KI', aufgaben: 'Präsentationszugang: T06 (Fallanalyse, Fall-Datenbank, Suche), T07 (Abrechnung: RVG, Storno, Sammelabrechnung, Zeithonorar, E-Rechnung), T08 (Bankabgleich und Fremdgeld), T09 (Forderungskonto und Zinsen), T19 (Apex KI: Dokument-Analyse und Schriftsatz-Entwurf)' },
  { key: 'D', titel: 'Umzug, mobil, abends, Assistent & ReFa', aufgaben: 'T11 (Umzug aus RA-MICRO), T14 (mobil am Gericht), T15 (Dunkelmodus abends, Tagesabschluss), T18 (Fristenrechner Fälle 1, 2, 3a, 4, 5), T20 (Apex Assistent: Sprache und Aktionen), T22 (Petras Vormittag – als Mia Becker, mia.becker@hartmann-partner.de / Apex-Demo-2026)' },
]

const BEFUND = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'I{n}-T{xx}-{nn}' },
    schwere: { type: 'string', enum: ['K', 'H', 'M', 'N'] },
    kategorie: { type: 'string', enum: ['Bedienbarkeit', 'Verständlichkeit', 'Look & Feel', 'Fehler', 'Fachlich', 'Tempo', 'Vertrauen', 'Barrierefreiheit', 'Mobil'] },
    aufgabe: { type: 'string' },
    ansicht: { type: 'string' },
    viewport: { type: 'string' },
    modus: { type: 'string' },
    beobachtung: { type: 'string' },
    erwartung: { type: 'string' },
    vorschlag: { type: 'string' },
    zitat: { type: 'string' },
    screenshot: { type: 'string' },
    dateien: { type: 'array', items: { type: 'string' } },
  },
  required: ['id', 'schwere', 'kategorie', 'aufgabe', 'ansicht', 'beobachtung', 'vorschlag'],
}
const TEST_SCHEMA = {
  type: 'object',
  properties: {
    aufgaben: { type: 'array', items: { type: 'object', properties: { aufgabe: { type: 'string' }, ergebnis: { type: 'string', enum: ['erfolgreich', 'mit Mühe', 'gescheitert', 'nicht prüfbar'] }, messwert: { type: 'string' }, pruefpunkte: { type: 'string' }, aktionen: { type: 'string' }, fehlaktionen: { type: 'number' }, fachlichKorrekt: { type: 'boolean' }, seq: { type: 'number' }, oton: { type: 'string' } }, required: ['aufgabe', 'ergebnis', 'seq', 'oton'] } },
    befunde: { type: 'array', items: BEFUND },
    nachtest: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string', enum: ['behoben', 'teilweise', 'nicht behoben', 'nicht prüfbar'] }, kommentar: { type: 'string' } }, required: ['id', 'status'] } },
    positiv: { type: 'array', items: { type: 'string' } },
    axe: { type: 'array', items: { type: 'object', properties: { ansicht: { type: 'string' }, serious: { type: 'number' }, critical: { type: 'number' } }, required: ['ansicht', 'serious', 'critical'] } },
    sus: { type: 'array', items: { type: 'number' }, description: '10 Antworten 1–5 in Standardreihenfolge' },
    ueqs: { type: 'object', properties: { pragmatisch: { type: 'number' }, hedonisch: { type: 'number' } } },
    noten: { type: 'object', properties: { lookFeel: { type: 'number' }, lesbarkeit: { type: 'number' }, verstaendlichkeit: { type: 'number' }, vertrauen: { type: 'number' }, tempo: { type: 'number' }, fachlich: { type: 'number' }, mobil: { type: 'number' } } },
    empfehlung: { type: 'number' },
    kaufHeute: { type: 'string' },
    top3: { type: 'array', items: { type: 'string' } },
    bilder: { type: 'array', items: { type: 'string' }, description: 'bis zu 4 Screenshot-Pfade unter docs/usability/iteration-N/bilder/' },
  },
  required: ['aufgaben', 'befunde', 'positiv', 'sus', 'noten', 'top3'],
}

phase('Test')
const tests = await parallel(BLOECKE.map((b) => () =>
  agent(`Du bist der Kundenavatar CLAUDIA REINHOLZ. Lies in ${DOC}: Kurzfassung und Abschnitt 1.1–1.5 (Zeilen 1–120), die Abschnitte zu deinen Aufgaben im Teil 1.6 (Überschriften „#### T..“), 1.7–1.11 (Messmethode, Bewertungsraster, Verhaltensregeln, Schwerpunkt der Iteration ${N}, Feedback-Vorlage), sowie 3 (Steckbrief), 7 (Frustrationen, Ängste, Datenschutz-Fragen, Barrierefreiheit, Mobil) und 9 (Sprache und Tonalität). Abschnitt 1.13 ist NUR für die Testleitung – nicht lesen.
Du testest jetzt ITERATION ${N}, BLOCK ${b.key} („${b.titel}“): ${b.aufgaben}. Halte dich an Erfolgskriterien, Prüfpunkte und Prüfwerte der Aufgaben und an den Schwerpunkt der Iteration ${N} aus Abschnitt 1.10 (Viewports, Dunkelmodus, Tastatur, axe usw.).
${N > 1 ? `NACHTEST: Lies zuerst ${VORHER} und prüfe alle dort als umgesetzt markierten Befunde deiner Aufgaben (Befund-IDs) – Status behoben / teilweise / nicht behoben.` : 'Dies ist die Baseline-Iteration – ehrlicher erster Eindruck.'}
${STEUERUNG}
Bleib in deiner Rolle (O-Töne in Claudias Sprache, kritisch, ungeduldig bei Umwegen, rechnet juristisch nach), aber beschreibe Befunde präzise und reproduzierbar (Ansicht, Viewport, Modus, Schritte, Beobachtung → Erwartung → Vorschlag). Befund-IDs: I${N}-T{xx}-{nn}.
ERGEBNIS: (1) Schreibe dein Feedback nach Vorlage 1.11 als Markdown nach ${OUT}/block-${b.key}.md (Ordner anlegen). (2) Kopiere bis zu 4 aussagekräftige Screenshots (Schlüsselmomente, gute wie schlechte) nach ${OUT}/bilder/ mit sprechenden Namen (block-${b.key}-…jpg) und verlinke sie relativ in deiner Datei. (3) Gib die strukturierten Ergebnisse zurück (SUS = deine 10 Antworten für das Gesamtsystem nach deinem Block; Noten 1–6).`, { label: `test:${b.key}`, phase: 'Test', schema: TEST_SCHEMA })
    .then((r) => ({ block: b.key, ...(r || { befunde: [], aufgaben: [], positiv: [], sus: [], noten: {}, top3: ['Block fehlgeschlagen'] }) }))
))

const susWert = (a) => (Array.isArray(a) && a.length === 10 ? a.reduce((s, v, i) => s + (i % 2 === 0 ? v - 1 : 5 - v), 0) * 2.5 : null)
const susListe = tests.map((t) => susWert(t.sus)).filter((x) => x !== null)
const sus = susListe.length ? Math.round((susListe.reduce((a, b) => a + b, 0) / susListe.length) * 10) / 10 : null
const alleBefunde = tests.flatMap((t) => (t.befunde || []).map((f) => ({ ...f, block: t.block })))
log(`Iteration ${N}: ${alleBefunde.length} Befunde, SUS ≈ ${sus}`)

const PAKET = { type: 'object', properties: { id: { type: 'string' }, titel: { type: 'string' }, schwere: { type: 'string' }, auftrag: { type: 'string' }, dateien: { type: 'array', items: { type: 'string' } } }, required: ['id', 'titel', 'schwere', 'auftrag'] }
const KONS_SCHEMA = {
  type: 'object',
  properties: {
    paketA: { type: 'array', items: PAKET },
    paketB: { type: 'array', items: PAKET },
    verworfen: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, grund: { type: 'string' } }, required: ['id', 'grund'] } },
    kennzahlen: { type: 'string' },
  },
  required: ['paketA', 'paketB', 'verworfen', 'kennzahlen'],
}

phase('Konsolidierung')
const kons = await agent(`Du bist die Testleitung (UX-Researcherin) der Usability-Studie mit dem Kundenavatar Claudia Reinholz (${DOC}; Abschnitt 1.7–1.13 sind für dich relevant, inkl. 1.13 Hinweise an die Testleitung).
Iteration ${N} ist getestet. Feedback-Dateien: ${OUT}/block-A.md … block-D.md. Strukturierte Ergebnisse (JSON) unten. Berechneter SUS-Mittelwert (Trendwert): ${sus}.${HINWEIS}${VORHER ? ` Vorrunde: ${VORHER}.` : ''}
AUFGABEN:
1. Befunde deduplizieren und prüfen. Leitlinie des Auftraggebers: „das gesamte Feedback einbauen“ – setze ALLES um, was berechtigt ist (K, H, M und sinnvolle N). Verwirf nur, was dem Briefing widerspricht, fachlich falsch ist, auf einem Missverständnis beruht oder außerhalb eines Prototyps liegt (z. B. echte beA-Anbindung) – jeweils mit Grund. Prüfe Zweifelsfälle selbst (Code lesen, kurz per Playwright oder dem Avatar-Werkzeug node ${SP}/avatar/avatar.mjs nachstellen).
2. Schreibe den Iterationsbericht ${OUT}.md (Deutsch, präsentabel, für den Auftraggeber): Kurzfazit · Kennzahlen (Aufgaben erfolgreich x/24, Fehlaktionen, SEQ-Mittel, SUS-Trendwert, UEQ-S, Schulnoten-Mittel, Empfehlung 0–10, Kauf heute, axe serious/critical, Befunde je Schwere) ${N > 1 ? '· Vergleich zur Vorrunde (Tabelle) · Nachtest-Ergebnisse' : ''} · stärkste O-Töne · Positives · Befunde nach Bereich (Tabelle: ID, Schwere, Kategorie, Befund, Entscheidung umsetzen/verworfen + Grund) · Bilder (relativ: iteration-${N}/bilder/…) · Umsetzungsplan. Lege außerdem /home/user/anwaltapex/docs/usability/README.md an bzw. ergänze dort die Zeile dieser Iteration in einer Übersichtstabelle (Iteration, Datum, Schwerpunkt, Aufgaben erfolgreich, SUS, UEQ-S, Ø Note, Befunde K/H/M/N, Link).
3. Erstelle Umsetzungspakete für zwei Fixer mit GETRENNTEN Dateibereichen:
   paketA = „Rahmen, Design, Einstieg, Logik & Daten“: src/components/**, src/styles/**, src/app/**, src/App.tsx, src/main.tsx, src/lib/**, src/store/**, src/core/**, src/ai/**, src/content/**, server/**, src/pages/Cockpit.tsx, src/pages/cockpit/**, src/pages/public/**, src/pages/hilfe/**, src/pages/einstellungen/**, src/pages/console/**
   paketB = „Fachseiten“: src/pages/akten/**, src/pages/kontakte/**, src/pages/posteingang/**, src/pages/fristen/**, src/pages/abrechnung/**, src/pages/ki/**, src/pages/falldb/**, src/pages/motor/**, src/pages/umzug/**
   Jeder Auftrag konkret und selbsterklärend (Befund-ID, was genau ändern, Erfolgskriterium, betroffene Dateien soweit bekannt). Befunde, die beide Bereiche berühren: nach Hauptdatei zuordnen und im Auftrag vermerken, welche Datei im anderen Bereich mitbetroffen ist (der andere Fixer darf sie dann nicht anfassen – die Prüfung erledigt den Rest).
STRUKTURIERTE ERGEBNISSE:
${JSON.stringify(tests, null, 1)}`, { label: 'konsolidierung', phase: 'Konsolidierung', schema: KONS_SCHEMA })

const REGELN = `Lies /home/user/anwaltapex/CLAUDE.md und docs/UI-LEITFADEN.md (Design-/Coderegeln: Liquid-Glass-Look, Tokens statt fester Farben, Hell/Dunkel, 360 px, keine alert/confirm/prompt/window.open, Fachlogik in src/core mit Tests, Fristen nur über src/core/fristen.ts, Zählung über src/core/fristenLage.ts, Kennzahlen über src/core/kennzahlen.ts, KI über src/ai/llm.ts mit Offline-Fallback). UI-Sprache Deutsch mit korrekter Typografie. Bestehenden Stil beibehalten; die USPs des Auftraggebers erhalten. Ein zweiter Fixer arbeitet GLEICHZEITIG in einem anderen Dateibereich – ändere ausschließlich Dateien deines Bereichs; Bedarf außerhalb → im Bericht unter „Bereichsübergreifend“ (Datei + exakte Änderung). Bei „Datei seit dem Lesen geändert“: neu lesen, nie fremde Änderungen überschreiben. Kein git commit, kein npm install, package.json nicht ändern. Prüfung: npx tsc --noEmit (Fehler in fremden, gerade bearbeiteten Dateien ignorieren), npm test bei Logik-Änderungen, jede Änderung visuell bestätigen (node ${SP}/avatar/avatar.mjs <eigener-profilordner unter ${SP}/avatar/fix-i${N}-…> - oder eigenes Playwright-Skript), passende Viewports und hell/dunkel. Speicher sparsam: ein Browser gleichzeitig, nach jedem Skript schließen, keine Builds.`
const FIX_SCHEMA = {
  type: 'object',
  properties: {
    umgesetzt: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, was: { type: 'string' }, dateien: { type: 'array', items: { type: 'string' } } }, required: ['id', 'was'] } },
    nichtUmgesetzt: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, grund: { type: 'string' } }, required: ['id', 'grund'] } },
    bereichsuebergreifend: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, datei: { type: 'string' }, aenderung: { type: 'string' } }, required: ['datei', 'aenderung'] } },
  },
  required: ['umgesetzt', 'nichtUmgesetzt', 'bereichsuebergreifend'],
}

phase('Umsetzung')
const fixes = await parallel([
  ['A', 'Rahmen, Design, Einstieg, Logik & Daten', 'src/components/**, src/styles/**, src/app/**, src/App.tsx, src/main.tsx, src/lib/**, src/store/**, src/core/**, src/ai/**, src/content/**, server/**, src/pages/Cockpit.tsx, src/pages/cockpit/**, src/pages/public/**, src/pages/hilfe/**, src/pages/einstellungen/**, src/pages/console/**', kons.paketA],
  ['B', 'Fachseiten', 'src/pages/akten/**, src/pages/kontakte/**, src/pages/posteingang/**, src/pages/fristen/**, src/pages/abrechnung/**, src/pages/ki/**, src/pages/falldb/**, src/pages/motor/**, src/pages/umzug/**', kons.paketB],
].filter(([, , , p]) => p && p.length).map(([k, titel, bereich, paket]) => () =>
  agent(`PROJEKT /home/user/anwaltapex – AnwaltApex (Kanzlei-Software, Prototyp zur Kundenpräsentation). Du bist Fixer „${titel}“ in Iteration ${N} der Usability-Studie mit dem Kundenavatar Claudia Reinholz. Iterationsbericht: ${OUT}.md (lies die Befunde dort für Kontext; Screenshots unter ${OUT}/bilder/ und in den Profilordnern ${SP}/avatar/i${N}-*/shots/).
DEIN DATEIBEREICH: ${bereich}${HINWEIS}
${REGELN}
Setze ALLE folgenden Aufträge vollständig und sorgfältig um (Reihenfolge nach Schwere K → H → M → N):
${JSON.stringify(paket, null, 1)}`, { label: `fix:${k}`, phase: 'Umsetzung', schema: FIX_SCHEMA }).then((r) => ({ bereich: k, ...(r || { umgesetzt: [], nichtUmgesetzt: [{ id: '-', grund: 'Fixer fehlgeschlagen' }], bereichsuebergreifend: [] }) }))
))

phase('Prüfung')
const pruefung = await agent(`PROJEKT /home/user/anwaltapex – AnwaltApex. Du bist die Prüfung am Ende von Iteration ${N} der Usability-Studie (Kundenavatar Claudia Reinholz, ${DOC}). Iterationsbericht: ${OUT}.md. Du darfst jetzt ALLE Projektdateien ändern (außer package.json; kein npm install, kein git commit).
${REGELN.replace('Ein zweiter Fixer arbeitet GLEICHZEITIG in einem anderen Dateibereich – ändere ausschließlich Dateien deines Bereichs; Bedarf außerhalb → im Bericht unter „Bereichsübergreifend“ (Datei + exakte Änderung).', '')}
AUFGABEN:
1. Setze die bereichsübergreifenden Restpunkte und sinnvoll nachholbaren „nicht umgesetzt“-Punkte der Fixer um (unten).
2. Prüfe jede umgesetzte K- und H-Änderung visuell nach (Avatar-Werkzeug node ${SP}/avatar/avatar.mjs, eigener Profilordner ${SP}/avatar/pruefung-i${N}/) und stichprobenartig M/N.
3. Qualitätstor: npx tsc --noEmit, npm test, npm run build (Web + Server) – alles fehlerfrei; Konsolen-Sweep über alle Hauptrouten im Demo-Modus (Login Hartmann) ohne pageerrors/console.errors (500 auf /api/info ignorieren). Behebe, was rot ist.
4. Ergänze in ${OUT}.md einen Abschnitt „Umsetzung & Nachweis“ (Tabelle: Befund-ID, Status umgesetzt/teilweise/offen, was geändert, Nachweis) und aktualisiere die Übersicht in docs/usability/README.md (Spalte „umgesetzt“).
FIXER-ERGEBNISSE:
${JSON.stringify(fixes, null, 1)}
VERWORFEN (zur Info): ${JSON.stringify(kons.verworfen)}`, { label: 'pruefung', phase: 'Prüfung' })

return { iteration: N, sus, befunde: alleBefunde.length, schwere: ['K', 'H', 'M', 'N'].map((s) => `${s}:${alleBefunde.filter((f) => f.schwere === s).length}`).join(' '), kennzahlen: kons.kennzahlen, umgesetzt: fixes.map((f) => `${f.bereich}: ${f.umgesetzt.length} umgesetzt, ${f.nichtUmgesetzt.length} offen`), pruefung }
