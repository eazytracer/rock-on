/**
 * returnTo helper
 *
 * Safely round-trips a "return to this URL after auth" value through the
 * `?returnTo=` query param. Only same-origin relative paths are honored to
 * prevent open-redirect attacks (an attacker crafting
 * `/auth?returnTo=https://evil.example` must NOT be able to bounce a
 * freshly-authenticated user off-site).
 */

/**
 * Encode a same-origin `pathname + search` (+ optional hash) into a value
 * suitable for the `returnTo` query param.
 */
export function encodeReturnTo(pathAndSearch: string): string {
  return encodeURIComponent(pathAndSearch)
}

/**
 * Validate and decode a `returnTo` param value.
 *
 * Returns the decoded relative path if it is a safe same-origin path, or
 * `null` if the value is missing or unsafe (absolute URL, protocol-relative,
 * or backslash-trick that browsers may treat as a host separator).
 */
export function sanitizeReturnTo(
  value: string | null | undefined
): string | null {
  if (!value) return null

  let decoded: string
  try {
    decoded = decodeURIComponent(value)
  } catch {
    // Malformed percent-encoding — reject.
    return null
  }

  // Must be a root-relative path.
  if (!decoded.startsWith('/')) return null

  // Reject protocol-relative ("//host") and backslash tricks ("/\\host",
  // "/\thost") that browsers may normalize into an authority component.
  if (decoded.startsWith('//')) return null
  if (decoded.length >= 2 && (decoded[1] === '\\' || decoded[1] === '/')) {
    return null
  }

  return decoded
}
