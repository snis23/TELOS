#!/usr/bin/env node
/**
 * out/ 을 GitHub Pages 처럼 /TELOS/ 아래에서 보여 주는 작은 정적 서버 (E2E, 미리 보기용).
 * 사용: node scripts/serve-out.mjs [포트]
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const ROOT = new URL("../out", import.meta.url).pathname;
const BASE = "/TELOS";
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4173);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(302, { Location: `${BASE}/` });
    res.end();
    return;
  }
  let path = normalize(decodeURIComponent(url.pathname.slice(BASE.length)) || "/");
  if (path.includes("..")) {
    res.writeHead(400);
    res.end();
    return;
  }
  let file = join(ROOT, path);
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!path.endsWith("/")) {
      res.writeHead(301, { Location: `${BASE}${path}/${url.search}` });
      res.end();
      return;
    }
    file = join(file, "index.html");
  }
  let status = 200;
  if (!existsSync(file)) {
    status = 404;
    file = join(ROOT, "404.html");
  }
  res.writeHead(status, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`http://localhost:${PORT}${BASE}/`));
