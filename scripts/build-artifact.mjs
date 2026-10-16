// Erzeugt aus dem Demo-Build (dist-demo) eine einzelne HTML-Datei für die Artefakt-Vorschau:
// JS und CSS werden eingebettet, Schriften liegen bereits als data:-URIs vor.
import fs from "node:fs";
import path from "node:path";
const dir = process.argv[2] ?? "dist-demo";
const out = process.argv[3] ?? "dist-artifact/anwaltapex.html";
let html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)];
const js = [...html.matchAll(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g)];
const read = (href) => fs.readFileSync(path.join(dir, href.replace(/^\.?\//, "")), "utf8");
let styles = css.map((m) => read(m[1])).join("\n");
let scripts = js.map((m) => read(m[1]).replace(/<\/script/gi, "<\\/script")).join("\n");
const title = html.match(/<title>(.*?)<\/title>/)?.[1] ?? "AnwaltApex";
const body = `<title>${title}</title>
<meta name="description" content="AnwaltApex – Kanzlei-Software mit KI-Fallanalyse, Fristenkontrolle nach § 222 ZPO und Lifetime-Lizenz.">
<style>${styles}</style>
<div id="root"></div>
<script type="module">${scripts}</script>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, body);
const remote = [...body.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
console.log(`Artefakt: ${out} (${(body.length / 1024 / 1024).toFixed(2)} MB)`, remote.length ? `externe Verweise: ${remote.join(", ")}` : "· keine externen Verweise");
