#!/usr/bin/env node
// Sync the source Google Sheet into the `data/` JSON folder used by the prototype.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
//   SHEET_ID=<spreadsheet id> npm run sync:sheets
//
// The spreadsheet must be shared (Viewer) with the service account email.
// One tab per resource, named exactly like the JSON file (see TABS below);
// first row = column headers = record field names. Missing tabs are skipped
// and keep their current JSON file.
import { createSign } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { rowsToRecords } from "./sheets/rowsToRecords.mjs";

const TABS = [
  "sales",
  "tags",
  "companies",
  "contacts",
  "contact_notes",
  "deals",
  "deal_notes",
  "tasks",
];
const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const OUT_DIR = path.resolve(process.env.DATA_DIR ?? "data");

const fail = (message) => {
  console.error(`sheets-to-json: ${message}`);
  process.exit(1);
};

const base64url = (input) => Buffer.from(input).toString("base64url");

const getAccessToken = async (key) => {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: key.token_uri,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = createSign("RSA-SHA256")
    .update(`${header}.${claims}`)
    .sign(key.private_key, "base64url");

  const response = await fetch(key.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!response.ok) {
    fail(`token request failed (${response.status}): ${await response.text()}`);
  }
  return (await response.json()).access_token;
};

const googleGet = async (url, token) => {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    fail(`GET ${url} failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
};

const main = async () => {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const sheetId = process.env.SHEET_ID;
  if (!keyPath) fail("set GOOGLE_APPLICATION_CREDENTIALS to the key file path");
  if (!sheetId) fail("set SHEET_ID to the spreadsheet id");

  const key = JSON.parse(readFileSync(keyPath, "utf8"));
  const token = await getAccessToken(key);
  const api = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;

  const meta = await googleGet(`${api}?fields=sheets.properties.title`, token);
  const available = new Set(meta.sheets.map((s) => s.properties.title));
  const tabs = TABS.filter((tab) => available.has(tab));
  const missing = TABS.filter((tab) => !available.has(tab));
  if (!tabs.length) fail(`no tab named like: ${TABS.join(", ")}`);

  const query = tabs.map((t) => `ranges=${encodeURIComponent(t)}`).join("&");
  const { valueRanges } = await googleGet(
    `${api}/values:batchGet?${query}&valueRenderOption=FORMATTED_VALUE`,
    token,
  );

  mkdirSync(OUT_DIR, { recursive: true });
  valueRanges.forEach((range, i) => {
    const records = rowsToRecords(range.values ?? [], tabs[i]);
    const file = path.join(OUT_DIR, `${tabs[i]}.json`);
    writeFileSync(file, `${JSON.stringify(records, null, 2)}\n`);
    console.warn(`${tabs[i]}: ${records.length} records -> ${file}`);
  });
  if (missing.length)
    console.warn(`skipped (tab not found): ${missing.join(", ")}`);
};

main().catch((error) => fail(error.message));
