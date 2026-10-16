import { chromium } from "playwright";
import fs from "node:fs";
const [,, out, ...files] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 320 } });
const imgs = files.map(f => `<div style="display:grid;place-items:center;gap:8px"><img src="data:image/svg+xml;base64,${fs.readFileSync(f).toString("base64")}" style="width:220px;height:220px"/></div>`).join("");
await p.setContent(`<body style="margin:0;display:flex;gap:40px;padding:40px;background:linear-gradient(90deg,#f3f5fb 50%,#070a12 50%)">${imgs}</body>`);
await p.screenshot({ path: out });
await b.close();
