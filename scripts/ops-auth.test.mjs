import { describe, expect, it } from "vitest";

import { createSessions, csrfMatches, parseCookies } from "./ops-auth.mjs";

describe("ops sessions", () => {
  const sessions = createSessions({
    secret: "test-secret",
    allowedEmails: ["Owner@Example.com", " "],
  });

  it("issues a cookie token that verifies back to the e-mail", () => {
    const token = sessions.issue("owner@example.com");

    expect(sessions.verify(token)).toBe("owner@example.com");
    expect(
      sessions.userOf({ headers: { cookie: `ops_session=${token}` } }),
    ).toBe("owner@example.com");
  });

  it("rejects tampered or foreign tokens and e-mails outside the allow-list", () => {
    const token = sessions.issue("owner@example.com");
    const other = createSessions({
      secret: "other",
      allowedEmails: ["owner@example.com"],
    });

    expect(sessions.verify(`${token}x`)).toBeNull();
    expect(other.verify(token)).toBeNull();
    expect(sessions.verify(sessions.issue("intruder@example.com"))).toBeNull();
    expect(sessions.isAllowed("OWNER@example.com")).toBe(true);
    expect(sessions.isAllowed("intruder@example.com")).toBe(false);
  });

  it("checks the Google CSRF cookie against the form field", () => {
    const request = { headers: { cookie: "g_csrf_token=abc; other=1" } };

    expect(csrfMatches(request, new URLSearchParams("g_csrf_token=abc"))).toBe(
      true,
    );
    expect(csrfMatches(request, new URLSearchParams("g_csrf_token=zzz"))).toBe(
      false,
    );
    expect(parseCookies("a=1; b=x%3Dy")).toEqual({ a: "1", b: "x=y" });
  });
});
