// Service-account access token for Google APIs, signed with node:crypto (no dependency).
import { createSign } from "node:crypto";

const base64url = (input) => Buffer.from(input).toString("base64url");

export const SHEETS_READONLY_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets.readonly";

export const createTokenProvider = (key, scope = SHEETS_READONLY_SCOPE) => {
  let cached = { token: "", expiresAt: 0 };
  return async () => {
    if (cached.token && Date.now() < cached.expiresAt - 60_000) {
      return cached.token;
    }
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = base64url(
      JSON.stringify({
        iss: key.client_email,
        scope,
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
      throw new Error(
        `token request failed (${response.status}): ${await response.text()}`,
      );
    }
    const { access_token, expires_in } = await response.json();
    cached = { token: access_token, expiresAt: Date.now() + expires_in * 1000 };
    return access_token;
  };
};

export const googleGet = async (url, token) => {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(
      `GET ${url} failed (${response.status}): ${await response.text()}`,
    );
  }
  return response.json();
};
