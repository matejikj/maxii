import { timingSafeEqual } from 'node:crypto';

/**
 * Double-submit CSRF for cookie-based BFF sessions. Bearer-only mobile calls
 * skip this check because they do not rely on ambient cookies.
 */
export function verifyCsrfDoubleSubmit(input: {
  readonly method: string;
  readonly cookieToken: string | undefined;
  readonly headerToken: string | undefined;
  readonly usesBearerAuth: boolean;
}): boolean {
  if (input.usesBearerAuth) return true;
  if (input.method === 'GET' || input.method === 'HEAD' || input.method === 'OPTIONS') {
    return true;
  }
  const cookie = input.cookieToken?.trim() ?? '';
  const header = input.headerToken?.trim() ?? '';
  if (!cookie || !header || cookie.length !== header.length) return false;
  return timingSafeEqual(Buffer.from(cookie), Buffer.from(header));
}
