/**
 * External URL security validation for ChatOps action navigation.
 * Prevents XSS, open redirect, and phishing attacks.
 */

/** Allowed external domain whitelist — add domains that are safe to navigate to */
const ALLOWED_EXTERNAL_DOMAINS = [
  'github.com',
  'gitlab.com',
  'grafana.com',
  'prometheus.io',
] as const;

/**
 * Check if a URL is safe to navigate to externally.
 *
 * Security rules:
 * 1. Only http: and https: protocols allowed
 * 2. Domain must be in the whitelist (or subdomain of whitelisted domain)
 * 3. No javascript:, data:, vbscript: protocols
 * 4. No protocol-relative URLs (//evil.com)
 */
export function isSafeExternalUrl(url: string): boolean {
  try {
    // Reject empty or whitespace-only strings
    if (!url || url.trim() === '') return false;

    // Reject protocol-relative URLs
    if (url.startsWith('//')) return false;

    const parsed = new URL(url);

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    // Domain whitelist check (exact match or subdomain)
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_EXTERNAL_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    // Invalid URL — reject
    return false;
  }
}

/**
 * Sanitize and return a URL if safe, or null if unsafe.
 */
export function sanitizeExternalUrl(url: string): string | null {
  return isSafeExternalUrl(url) ? url : null;
}
