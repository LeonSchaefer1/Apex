// Erzeugt aus dem Demo-Build (dist-demo) eine einzelne HTML-Datei für die Artefakt-Vorschau:
// JS und CSS werden eingebettet, Schriften liegen bereits als data:-URIs vor.
import fs from "node:fs";
import path from "node:path";
const dir = process.argv[2] ?? "dist-demo";
// Dateiname bleibt nach der Umbenennung in Apex: unter diesem Pfad wird das Artefakt unter derselben Adresse neu veröffentlicht.
const out = process.argv[3] ?? "dist-artifact/anwaltapex.html";
let html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)];
const js = [...html.matchAll(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g)];
const read = (href) => fs.readFileSync(path.join(dir, href.replace(/^\.?\//, "")), "utf8");
let styles = css.map((m) => read(m[1])).join("\n");
let scripts = js.map((m) => read(m[1]).replace(/<\/script/gi, "<\\/script")).join("\n");
// Artefakt-Titel ist ein Name ohne Erklärzusatz (Galerie/Browser-Tab); die Web-App behält „Apex – Kanzleisoftware“.
const title = "Apex Kanzleisoftware";
const body = `<title>${title}</title>
<meta name="description" content="Apex – die Kanzleisoftware mit KI-Fallanalyse, Fristenkontrolle nach § 222 ZPO und Lifetime-Lizenz.">
<style>${styles}</style>
<div id="root"></div>
<script type="module">${scripts}</script>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, body);
const remote = [...body.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
console.log(`Artefakt: ${out} (${(body.length / 1024 / 1024).toFixed(2)} MB)`, remote.length ? `externe Verweise: ${remote.join(", ")}` : "· keine externen Verweise");
