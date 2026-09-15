import { randomBytes } from "node:crypto";

export function newCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function csrfFormField(token: string): string {
  return `<input type="hidden" name="csrf" value="${escapeHtml(token)}">`;
}

function escapeHtml(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, (character) => `&#${character.charCodeAt(0)};`);
}

export function originAllowed(originOrReferer: string | undefined, publicBaseUrl: string): boolean {
  if (!originOrReferer) return false;
  try {
    const actual = new URL(originOrReferer);
    const expected = new URL(publicBaseUrl);
    return actual.protocol === expected.protocol && actual.host === expected.host;
  } catch {
    return false;
  }
}

export function csrfOk(opts: {
  cookieToken: string | undefined;
  bodyToken: string | undefined;
  origin: string | undefined;
  referer: string | undefined;
  publicBaseUrl: string;
}): boolean {
  return Boolean(opts.cookieToken && opts.bodyToken && opts.cookieToken === opts.bodyToken && originAllowed(opts.origin ?? opts.referer, opts.publicBaseUrl));
}
