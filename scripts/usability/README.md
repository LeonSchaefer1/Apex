# Usability-Werkzeuge (Kundenavatar-Tests)

- `avatar.mjs` – bedient die App wie ein Mensch (Schritte als JSON, Screenshots, Sichtbarer-Text-Dump, axe-core, Viewports,
  Hell/Dunkel, reduzierte Bewegung, Farbsehschwäche-Simulation). Kopfzeilen der Datei lesen.
  Aufruf: `AVATAR_BASE=http://127.0.0.1:5173 node scripts/usability/avatar.mjs <profilordner> schritte.json`
  (Profilordner = persistenter Browser; Screenshots unter `<profilordner>/shots/`).
- axe-core für `{"axe": true}`: `cd scripts/usability && mkdir axe && cd axe && npm pack axe-core@4.10.2 && tar xzf axe-core-*.tgz`
  (Ordner ist in .gitignore).
- `iteration-workflow.js` – Referenz: das Skript, mit dem je Iteration vier Test-Blöcke des Kundenavatars (Claudia Reinholz)
  parallel liefen, danach Konsolidierung, zwei Fixer und Prüfung (Claude-Code-„Workflow“-Format, Argument `n` = Iteration).
