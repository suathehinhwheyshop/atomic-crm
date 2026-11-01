// Google sign-in for the ops server: "Sign in with Google" posts an ID token to
// /auth/login, the server verifies it with Google, checks the e-mail against the
// allow-list and sets a signed HttpOnly session cookie. No password is stored.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE = "ops_session";
const CSRF_COOKIE = "g_csrf_token";
export const SESSION_HOURS = 12;

export const parseCookies = (header = "") =>
  Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([name, value]) => name && value !== undefined)
      .map(([name, ...rest]) => [name, decodeURIComponent(rest.join("="))]),
  );

export const createSessions = ({ secret, allowedEmails }) => {
  const key = secret || randomBytes(32).toString("hex");
  const allowed = new Set(
    allowedEmails.map((e) => e.trim().toLowerCase()).filter(Boolean),
  );
  const sign = (payload) =>
    createHmac("sha256", key).update(payload).digest("base64url");

  const issue = (email) => {
    const payload = Buffer.from(
      JSON.stringify({ email, exp: Date.now() + SESSION_HOURS * 3_600_000 }),
    ).toString("base64url");
    return `${payload}.${sign(payload)}`;
  };

  const verify = (token) => {
    if (!token || !token.includes(".")) return null;
    const [payload, signature] = token.split(".");
    const expected = sign(payload);
    if (
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    )
      return null;
    try {
      const { email, exp } = JSON.parse(
        Buffer.from(payload, "base64url").toString(),
      );
      return exp > Date.now() && allowed.has(email) ? email : null;
    } catch {
      return null;
    }
  };

  return {
    isAllowed: (email) => allowed.has(String(email ?? "").toLowerCase()),
    issue,
    verify,
    userOf: (request) => verify(parseCookies(request.headers.cookie)[COOKIE]),
    cookie: (token, secure) =>
      `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? SESSION_HOURS * 3600 : 0}${secure ? "; Secure" : ""}`,
  };
};

/** Verify a Google ID token with Google's tokeninfo endpoint; returns the e-mail or null. */
export const verifyGoogleIdToken = async (credential, clientId) => {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
  );
  if (!response.ok) return null;
  const info = await response.json();
  const okIssuer =
    info.iss === "https://accounts.google.com" ||
    info.iss === "accounts.google.com";
  return info.aud === clientId && okIssuer && info.email_verified === "true"
    ? String(info.email).toLowerCase()
    : null;
};

export const readBody = (request) =>
  new Promise((resolve, reject) => {
    let data = "";
    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > 64_000) reject(new Error("body too large"));
    });
    request.on("end", () => resolve(data));
    request.on("error", reject);
  });

/** CSRF check mandated by Google Identity Services: cookie and form field must match. */
export const csrfMatches = (request, body) => {
  const cookie = parseCookies(request.headers.cookie)[CSRF_COOKIE];
  const field = body.get(CSRF_COOKIE);
  return Boolean(cookie) && cookie === field;
};

export const loginPage = (clientId, message = "") => `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>WheyShop – Đăng nhập</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://accounts.google.com/gsi/client" async></script>
<style>body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#f6f6f7;color:#111}
.card{background:#fff;padding:40px 48px;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,.1);text-align:center;max-width:360px}
h1{font-size:22px;margin:0 0 4px}p{color:#666;margin:0 0 24px;font-size:14px}.err{color:#b91c1c;margin-top:16px;font-size:14px}</style></head>
<body><div class="card"><h1>WheyShop</h1><p>Báo cáo bán hàng & tài chính</p>
<div id="g_id_onload" data-client_id="${clientId}" data-login_uri="/auth/login" data-auto_prompt="false"></div>
<div class="g_id_signin" data-type="standard" data-size="large" data-text="signin_with" data-shape="pill"></div>
${message ? `<div class="err">${message}</div>` : ""}
</div></body></html>`;
