/**
 * Credentials used by family photo/API clients. Bearer keeps the token in
 * process memory; cookie mode relies on HttpOnly BFF cookies plus CSRF.
 */
export type FamilyAccessCredentials =
  | { readonly kind: 'bearer'; readonly accessToken: string }
  | { readonly kind: 'cookie'; readonly csrfToken: string };
