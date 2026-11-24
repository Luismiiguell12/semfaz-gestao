#!/usr/bin/env node
// Servidor estático que reproduz o comportamento do GitHub Pages para testes
// locais e E2E: serve ./out sob o basePath e responde 404.html quando não acha o arquivo.
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "out");
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/semfaz-gestao";
const port = Number(process.env.PORT ?? 4173);
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain",
};

function send(res, file, status = 200) {
  res.writeHead(status, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith(basePath)) {
    res.writeHead(302, { Location: `${basePath}/` });
    return res.end();
  }
  const rel = normalize(decodeURIComponent(url.pathname.slice(basePath.length) || "/")).replace(/^(\.\.[/\\])+/, "");
  let file = join(root, rel);
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!url.pathname.endsWith("/")) {
      res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
      return res.end();
    }
    file = join(file, "index.html");
  }
  if (!file.startsWith(root) || !existsSync(file)) return send(res, join(root, "404.html"), 404);
  send(res, file);
}).listen(port, () => console.log(`Servindo ./out em http://localhost:${port}${basePath}/`));
