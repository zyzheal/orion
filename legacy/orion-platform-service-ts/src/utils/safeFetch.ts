/**
 * SSRF-Protected Fetch Utility
 *
 * Wraps native fetch with SSRF validation.
 * Use this instead of direct fetch() calls for user-controlled URLs.
 */

import { ssrfProtection } from '../middleware/ssrfProtection';

/**
 * SSRF-protected fetch wrapper
 *
 * @param url - URL to fetch (will be validated against SSRF rules)
 * @param options - Standard fetch options
 * @returns Promise<Response>
 * @throws OrionError if URL fails SSRF validation
 *
 * @example
 * ```typescript
 * import { safeFetch } from '../utils/safeFetch';
 *
 * const response = await safeFetch(userProvidedUrl, {
 *   method: 'GET',
 *   headers: { 'Authorization': `Bearer ${token}` }
 * });
 * ```
 */
export async function safeFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  // Validate URL against SSRF rules
  await ssrfProtection.validateUrl(url);

  // Proceed with fetch if validation passes
  return fetch(url, options);
}

/**
 * SSRF-protected fetch wrapper with custom SSRF config
 *
 * Use when you need different SSRF rules than the global config.
 *
 * @param url - URL to fetch
 * @param options - Standard fetch options
 * @param allowedDomains - Custom allowed domains for this request
 * @returns Promise<Response>
 */
export async function safeFetchWithDomains(
  url: string,
  options: RequestInit | undefined,
  allowedDomains: string[]
): Promise<Response> {
  const { SSRFProtection } = await import('../middleware/ssrfProtection');
  const customSSRF = new SSRFProtection({ allowedDomains });

  await customSSRF.validateUrl(url);
  return fetch(url, options);
}
