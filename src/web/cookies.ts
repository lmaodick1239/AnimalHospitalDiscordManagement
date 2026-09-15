import { sign, unsign } from "cookie-signature";

export const COOKIE_NAME = "aho_session";
export const CSRF_COOKIE = "aho_csrf";

export type SessionPayload = { userId: string };

export function signSession(userId: string, secret: string): string {
  return sign(userId, secret);
}

export function unsignSession(cookie: string, secret: string): string | null {
  const value = unsign(cookie, secret);
  return value === false ? null : value;
}

export function cookieHeader(name: string, value: string, opts: { maxAgeSec: number; secure: boolean }): string {
  const encoded = encodeURIComponent(value);
  return `${name}=${encoded}; Path=/; Max-Age=${Math.floor(opts.maxAgeSec)}; HttpOnly; SameSite=Lax${opts.secure ? "; Secure" : ""}`;
}
