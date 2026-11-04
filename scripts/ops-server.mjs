#!/usr/bin/env node
// WheyShop ops server: reads the branch report spreadsheets with a Google service
// account and serves them to the ops dashboard, which refreshes every minute.
//
//   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
//   OPS_SOURCES=./ops-sources.json npm run start:ops
//
// ops-sources.json (gitignored) lists the spreadsheets, see ops/sources.example.json.
// Each spreadsheet must be shared (Viewer) with the service account email.
// Locally the server listens on 127.0.0.1 only: it has NO login of its own.
// In production run it behind Identity-Aware Proxy on Cloud Run (see docs/ops/DEPLOY.md):
// HOST=0.0.0.0, PORT from the platform, the key file mounted from Secret Manager and the
// sources given inline through OPS_SOURCES_JSON.
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import {
  createSessions,
  csrfMatches,
  loginPage,
  readBody,
  verifyGoogleIdToken,
} from "./ops-auth.mjs";
import { createTokenProvider, googleGet } from "./sheets/googleAuth.mjs";

const PORT = Number(process.env.PORT ?? 4300);
const HOST = process.env.HOST ?? "127.0.0.1";
const CACHE_MS = Number(process.env.OPS_CACHE_SECONDS ?? 300) * 1000;
const STATIC_DIR = path.resolve(process.env.OPS_STATIC_DIR ?? "dist-ops");
// Tabs to read per file kind: the dashboard recomputes totals itself from the input tabs.
const TAB_PREFIXES = {
  sales: [
    "Đơn CH",
    "Đơn Cửa hàng",
    "Đơn Tại Cửa hàng",
    "Đơn NT",
    "Đơn Nội thành",
    "Đơn Ship Nội thành",
    "Đơn Bưu điện",
    "Đơn COD",
    "Đơn Tiktok",
    "Đơn Shopee",
    "Bảng Chi phí",
    "Chi Phí",
    "MPOS về",
    "Sổ quỹ",
    "Tồn kho",
    "Công nợ NCC",
    "Danh mục sản phẩm",
  ],
  bctc: [
    "BCTC tháng",
    "Báo cáo tài chính",
    "DT ngày",
    "Doanh thu ngày",
    "Công nợ NCC",
    "Công nợ Nhà cung cấp",
    "Tóm tắt công nợ",
    "Lịch TT NCC",
    "Lịch Thanh toán",
  ],
  kho: [
    "Danh mục",
    "Hàng xách tay tồn kho",
    "Hàng công ty đã đặt",
    "Hàng công ty mới về",
  ],
  price: [],
};
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

// Login is on when GOOGLE_CLIENT_ID is set; ALLOWED_EMAILS lists who may enter.
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const sessions = createSessions({
  secret: process.env.SESSION_SECRET,
  allowedEmails: (process.env.ALLOWED_EMAILS ?? "").split(","),
});
if (CLIENT_ID && !(process.env.ALLOWED_EMAILS ?? "").trim()) {
  fail(
    "ALLOWED_EMAILS must list at least one e-mail when GOOGLE_CLIENT_ID is set",
  );
}

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const sourcesPath = process.env.OPS_SOURCES ?? "ops-sources.json";
if (!keyPath)
  fail("set GOOGLE_APPLICATION_CREDENTIALS to the service account key file");
if (!process.env.OPS_SOURCES_JSON && !existsSync(sourcesPath))
  fail(
    `sources file not found: ${sourcesPath} (copy ops/sources.example.json or set OPS_SOURCES_JSON)`,
  );

const getToken = createTokenProvider(JSON.parse(readFileSync(keyPath, "utf8")));
const sources = JSON.parse(
  process.env.OPS_SOURCES_JSON ?? readFileSync(sourcesPath, "utf8"),
);
if (
  !Array.isArray(sources) ||
  !sources.every((s) => s.branch && s.line && s.spreadsheetId)
) {
  fail("sources must be an array of { branch, line, spreadsheetId }");
}

const fetchWorkbook = async ({
  branch,
  line,
  kind = "sales",
  spreadsheetId,
}) => {
  const prefixes = TAB_PREFIXES[kind] ?? TAB_PREFIXES.sales;
  const token = await getToken();
  const api = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const meta = await googleGet(`${api}?fields=sheets.properties.title`, token);
  const titles = meta.sheets
    .map((s) => s.properties.title)
    .filter((title) =>
      prefixes.some((prefix) =>
        title.toLowerCase().startsWith(prefix.toLowerCase()),
      ),
    );
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
    kind,
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
  // Cloud Run terminates TLS; HSTS is harmless on plain localhost.
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
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
  if (url.pathname === "/healthz") {
    response.writeHead(200, { "Content-Type": "text/plain" }).end("ok");
    return;
  }
  if (CLIENT_ID) {
    const secure = request.headers["x-forwarded-proto"] === "https";
    const html = (code, body) => {
      response.writeHead(code, { "Content-Type": "text/html; charset=utf-8" });
      response.end(body);
    };
    if (url.pathname === "/auth/login" && request.method === "POST") {
      const body = new URLSearchParams(await readBody(request));
      if (!csrfMatches(request, body))
        return html(
          400,
          loginPage(CLIENT_ID, "Phiên đăng nhập không hợp lệ, thử lại."),
        );
      const email = await verifyGoogleIdToken(
        body.get("credential") ?? "",
        CLIENT_ID,
      ).catch(() => null);
      if (!email)
        return html(
          401,
          loginPage(CLIENT_ID, "Không xác minh được tài khoản Google."),
        );
      if (!sessions.isAllowed(email))
        return html(
          403,
          loginPage(CLIENT_ID, `${email} chưa được cấp quyền xem.`),
        );
      response.writeHead(303, {
        "Set-Cookie": sessions.cookie(sessions.issue(email), secure),
        Location: "/",
      });
      response.end();
      return;
    }
    if (url.pathname === "/auth/logout") {
      response.writeHead(303, {
        "Set-Cookie": sessions.cookie("", secure),
        Location: "/login",
      });
      response.end();
      return;
    }
    const user = sessions.userOf(request);
    if (url.pathname === "/login") {
      if (!user) return html(200, loginPage(CLIENT_ID));
      response.writeHead(303, { Location: "/" });
      response.end();
      return;
    }
    if (!user) {
      if (url.pathname.endsWith("/api/workbooks")) {
        response.writeHead(401, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "login required" }));
        return;
      }
      response.writeHead(303, { Location: "/login" });
      response.end();
      return;
    }
  }
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
    `ops-server: http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT} (${sources.length} spreadsheets, cache ${CACHE_MS / 1000}s, login ${CLIENT_ID ? "on" : "off"})`,
  );
});
