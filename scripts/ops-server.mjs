#!/usr/bin/env node
// WheyShop ops server: reads the branch report spreadsheets with a Google service
// account and serves them to the ops dashboard, which refreshes every minute.
//
//   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
//   OPS_SOURCES=./ops-sources.json npm run start:ops
//
// ops-sources.json (gitignored) lists the spreadsheets, see ops/sources.example.json.
// Each spreadsheet must be shared (Viewer) with the service account email.
// The server listens on 127.0.0.1 only: it has NO login, so never expose it publicly.
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import { createTokenProvider, googleGet } from "./sheets/googleAuth.mjs";

const PORT = Number(process.env.PORT ?? 4300);
const HOST = process.env.HOST ?? "127.0.0.1";
const CACHE_MS = Number(process.env.OPS_CACHE_SECONDS ?? 30) * 1000;
const STATIC_DIR = path.resolve(process.env.OPS_STATIC_DIR ?? "dist-ops");
// Only the input tabs are needed: the dashboard recomputes totals itself.
const TAB_PREFIXES = [
  "Đơn CH",
  "Đơn NT",
  "Đơn Bưu điện",
  "Đơn Tiktok",
  "Đơn Shopee",
  "Bảng Chi phí",
  "MPOS về",
];
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

const fail = (message) => {
  console.error(`ops-server: ${message}`);
  process.exit(1);
};

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const sourcesPath = process.env.OPS_SOURCES ?? "ops-sources.json";
if (!keyPath)
  fail("set GOOGLE_APPLICATION_CREDENTIALS to the service account key file");
if (!existsSync(sourcesPath))
  fail(
    `sources file not found: ${sourcesPath} (copy ops/sources.example.json)`,
  );

const getToken = createTokenProvider(JSON.parse(readFileSync(keyPath, "utf8")));
const sources = JSON.parse(readFileSync(sourcesPath, "utf8"));

const fetchWorkbook = async ({ branch, line, spreadsheetId }) => {
  const token = await getToken();
  const api = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const meta = await googleGet(`${api}?fields=sheets.properties.title`, token);
  const titles = meta.sheets
    .map((s) => s.properties.title)
    .filter((title) => TAB_PREFIXES.some((prefix) => title.startsWith(prefix)));
  const query = titles
    .map((t) => `ranges=${encodeURIComponent(`'${t}'`)}`)
    .join("&");
  const { valueRanges } = await googleGet(
    `${api}/values:batchGet?${query}&valueRenderOption=FORMATTED_VALUE`,
    token,
  );
  return {
    branch,
    line,
    tabs: Object.fromEntries(
      titles.map((title, i) => [title, valueRanges[i].values ?? []]),
    ),
  };
};

let cache = { at: 0, body: "" };
const loadWorkbooks = async () => {
  if (cache.body && Date.now() - cache.at < CACHE_MS) return cache.body;
  const workbooks = await Promise.all(sources.map(fetchWorkbook));
  cache = { at: Date.now(), body: JSON.stringify(workbooks) };
  return cache.body;
};

const serveStatic = (urlPath, response) => {
  const file = path.join(
    STATIC_DIR,
    path.normalize(urlPath === "/" ? "/index.html" : urlPath),
  );
  if (!file.startsWith(STATIC_DIR) || !existsSync(file)) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(200, {
    "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream",
  });
  response.end(readFileSync(file));
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

createServer(async (request, response) => {
  Object.entries(SECURITY_HEADERS).forEach(([name, value]) =>
    response.setHeader(name, value),
  );
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname.endsWith("/api/workbooks")) {
    try {
      const body = await loadWorkbooks();
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      response.end(body);
    } catch (error) {
      console.error(error);
      response.writeHead(502, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  serveStatic(url.pathname, response);
}).listen(PORT, HOST, () => {
  console.warn(
    `ops-server: http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT} (${sources.length} spreadsheets, cache ${CACHE_MS / 1000}s)`,
  );
});
