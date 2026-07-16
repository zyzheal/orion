/**
 * SSRF Protection Middleware
 *
 * Protects against Server-Side Request Forgery (OWASP A10) by validating
 * outbound HTTP requests against a domain whitelist and IP CIDR blacklist.
 *
 * Usage:
 * ```typescript
 * import { SSRFProtection } from './middleware/ssrfProtection';
 *
 * const ssrf = new SSRFProtection();
 * await ssrf.validateUrl(userProvidedUrl);
 * const response = await fetch(userProvidedUrl);
 * ```
 */

import { OrionError, ErrorCode } from '../errors';
import { createLogger } from '../utils/logger';
import * as dns from 'dns';

const logger = createLogger('ssrf-protection');

/**
 * CIDR range representation
 */
interface CIDRRange {
  network: string;
  prefix: number;
}

/**
 * SSRF Protection Configuration
 */
export interface SSRFProtectionConfig {
  /**
   * Allowed domains (exact match or wildcard)
   * Examples: 'github.com', '*.github.com', 'api.example.com'
   */
  allowedDomains?: string[];

  /**
   * Blocked IP CIDR ranges
   * Default: loopback, private, link-local
   */
  blockedCIDRs?: string[];

  /**
   * Enable DNS resolution check (default: true)
   */
  enableDNSCheck?: boolean;

  /**
   * Timeout for DNS lookup in ms (default: 5000)
   */
  dnsTimeout?: number;
}

/**
 * Default blocked CIDR ranges (RFC 1918 private networks + loopback + link-local)
 */
const DEFAULT_BLOCKED_CIDRS = [
  '127.0.0.0/8',    // Loopback
  '10.0.0.0/8',     // Private Class A
  '172.16.0.0/12',  // Private Class B
  '192.168.0.0/16', // Private Class C
  '169.254.0.0/16', // Link-local
  '::1/128',        // IPv6 loopback
  'fc00::/7',       // IPv6 unique local
  'fe80::/10',      // IPv6 link-local
];

/**
 * Default allowed domains for Orion platform integrations
 */
const DEFAULT_ALLOWED_DOMAINS = [
  'github.com',
  'api.github.com',
  'raw.githubusercontent.com',
  'gitlab.com',
  'api.gitlab.com',
  'oauth-login.cloud.huawei.com',
  'developer.huawei.com',
  'connect.xiaomi.com',
  'api.vivo.com.cn',
  'openapi.developer.oppo.com',
  'api.openai.com',
  'api.anthropic.com',
];

/**
 * SSRF Protection Service
 */
export class SSRFProtection {
  private allowedDomains: Set<string>;
  private blockedCIDRs: CIDRRange[];
  private enableDNSCheck: boolean;
  private dnsTimeout: number;

  constructor(config: SSRFProtectionConfig = {}) {
    this.allowedDomains = new Set(config.allowedDomains || DEFAULT_ALLOWED_DOMAINS);
    this.blockedCIDRs = this.parseCIDRs(config.blockedCIDRs || DEFAULT_BLOCKED_CIDRS);
    this.enableDNSCheck = config.enableDNSCheck !== false;
    this.dnsTimeout = config.dnsTimeout || 5000;

    logger.info({
      allowedDomains: Array.from(this.allowedDomains),
      blockedCIDRs: this.blockedCIDRs.length,
      enableDNSCheck: this.enableDNSCheck,
    }, 'SSRF Protection initialized');
  }

  /**
   * Validate URL against SSRF protection rules
   *
   * @throws OrionError if URL is not allowed
   */
  async validateUrl(url: string): Promise<void> {
    // Step 1: Parse URL
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch (error) {
      throw new OrionError(
        `Invalid URL: ${url}`,
        ErrorCode.VALIDATION_ERROR,
        // @ts-expect-error - legacy: OrionError 3rd param typed as boolean, runtime accepts object
        { url, reason: 'parse_failed' }
      );
    }

    // Step 2: Check protocol (only http/https allowed)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new OrionError(
        `Protocol ${parsed.protocol} is not allowed. Only http/https are permitted.`,
        ErrorCode.VALIDATION_ERROR,
        // @ts-expect-error - legacy: OrionError 3rd param typed as boolean, runtime accepts object
        { url, protocol: parsed.protocol }
      );
    }

    const hostname = parsed.hostname;

    // Step 3: Check domain whitelist
    if (!this.isDomainAllowed(hostname)) {
      throw new OrionError(
        `Domain ${hostname} is not in the allowed list`,
        ErrorCode.FORBIDDEN,
        // @ts-expect-error - legacy: OrionError 3rd param typed as boolean, runtime accepts object
        { url, hostname, reason: 'domain_not_whitelisted' }
      );
    }

    // Step 4: DNS resolution + CIDR blacklist check
    if (this.enableDNSCheck) {
      try {
        const ipAddress = await this.resolveDNS(hostname);

        if (this.isIPBlocked(ipAddress)) {
          throw new OrionError(
            `IP address ${ipAddress} is in a blocked range (private/loopback)`,
            ErrorCode.FORBIDDEN,
            // @ts-expect-error - legacy: OrionError 3rd param typed as boolean, runtime accepts object
            { url, hostname, ipAddress, reason: 'ip_blocked' }
          );
        }
      } catch (error) {
        if (error instanceof OrionError) {
          throw error;
        }
        // DNS lookup failed - treat as suspicious
        logger.warn({ hostname, error: (error as Error).message }, 'DNS lookup failed');
        throw new OrionError(
          `DNS lookup failed for ${hostname}`,
          ErrorCode.VALIDATION_ERROR,
          // @ts-expect-error - legacy: OrionError 3rd param typed as boolean, runtime accepts object
          { url, hostname, reason: 'dns_lookup_failed' }
        );
      }
    }

    logger.debug({ url, hostname }, 'URL validated successfully');
  }

  /**
   * Check if domain is in allowed list (supports wildcards)
   */
  private isDomainAllowed(hostname: string): boolean {
    // Exact match
    if (this.allowedDomains.has(hostname)) {
      return true;
    }

    // Wildcard match (e.g., *.github.com matches api.github.com)
    for (const domain of this.allowedDomains) {
      if (domain.startsWith('*.')) {
        const suffix = domain.slice(1); // Remove *
        if (hostname.endsWith(suffix)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Resolve DNS with timeout - resolves ALL A (IPv4) and AAAA (IPv6) records
   * and checks each against blocked CIDRs.
   * Dual-stack resolution prevents SSRF bypass via IPv6-only domains.
   */
  private async resolveDNS(hostname: string): Promise<string> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error('DNS lookup timeout')), this.dnsTimeout);
    });

    const resolvePromise = new Promise<string[]>((resolve, reject) => {
      // Resolve both A (IPv4) and AAAA (IPv6) records in parallel
      let resolved: string[] = [];
      let pending = 2;

      dns.resolve4(hostname, (err, addresses) => {
        if (!err && addresses) {
          resolved = resolved.concat(addresses);
        }
        pending--;
        if (pending === 0) {
          if (resolved.length === 0) {
            reject(new Error(`DNS resolution failed: no A or AAAA records for ${hostname}`));
          } else {
            resolve(resolved);
          }
        }
      });

      dns.resolve6(hostname, (err, addresses) => {
        if (!err && addresses) {
          resolved = resolved.concat(addresses);
        }
        pending--;
        if (pending === 0) {
          if (resolved.length === 0) {
            reject(new Error(`DNS resolution failed: no A or AAAA records for ${hostname}`));
          } else {
            resolve(resolved);
          }
        }
      });
    });

    try {
      const addresses = await Promise.race([resolvePromise, timeoutPromise]);
      // Clear timeout to prevent lingering handle
      clearTimeout(timeoutHandle);

      // Validate ALL resolved IPs against blocked CIDRs
      for (const ip of addresses) {
        for (const cidr of this.blockedCIDRs) {
          if (this.isIPInCIDR(ip, cidr)) {
            throw new Error(`Blocked IP detected: ${ip} in ${cidr.network}/${cidr.prefix}`);
          }
        }
      }

      return addresses[0];
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  /**
   * Check if IP is in blocked CIDR ranges
   */
  private isIPBlocked(ip: string): boolean {
    for (const cidr of this.blockedCIDRs) {
      if (this.isIPInCIDR(ip, cidr)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Parse CIDR notation to network/prefix
   */
  private parseCIDRs(cidrs: string[]): CIDRRange[] {
    return cidrs.map(cidr => {
      const [network, prefix] = cidr.split('/');
      return { network, prefix: parseInt(prefix, 10) };
    });
  }

  /**
   * Check if IP is in CIDR range
   * Supports IPv4 and IPv6 (including IPv4-mapped IPv6)
   */
  private isIPInCIDR(ip: string, cidr: CIDRRange): boolean {
    // IPv6 check
    if (ip.includes(':')) {
      // Check for IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1)
      const ipv4MappedMatch = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
      if (ipv4MappedMatch) {
        const mappedIPv4 = ipv4MappedMatch[1];

        // The regex already confirms this is within ::ffff:0.0.0.0/96.
        // Now check the extracted IPv4 against all IPv4 CIDR entries
        for (const block of this.blockedCIDRs) {
          if (!block.network.includes(':') && this.isIPv4InCIDR(mappedIPv4, block)) {
            return true;
          }
        }
        return false;
      }

      // Native IPv6 check (simple prefix match)
      if (cidr.network.includes(':')) {
        return ip.startsWith(cidr.network.split('/')[0]);
      }
      return false;
    }

    // IPv4 check
    return this.isIPv4InCIDR(ip, cidr);
  }

  /**
   * Check if an IPv4 address is in an IPv4 CIDR range
   */
  private isIPv4InCIDR(ip: string, cidr: CIDRRange): boolean {
    if (cidr.network.includes(':')) {
      return false;
    }
    const ipInt = this.ipToInt(ip);
    const networkInt = this.ipToInt(cidr.network);
    const mask = ~((1 << (32 - cidr.prefix)) - 1);

    return (ipInt & mask) === (networkInt & mask);
  }

  /**
   * Convert IPv4 address to integer
   */
  private ipToInt(ip: string): number {
    const parts = ip.split('.').map(p => parseInt(p, 10));
    return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  }

  /**
   * Add domain to whitelist at runtime
   */
  addAllowedDomain(domain: string): void {
    this.allowedDomains.add(domain);
    logger.info({ domain }, 'Added domain to whitelist');
  }

  /**
   * Remove domain from whitelist at runtime
   */
  removeAllowedDomain(domain: string): void {
    this.allowedDomains.delete(domain);
    logger.info({ domain }, 'Removed domain from whitelist');
  }

  /**
   * Get current configuration
   */
  getConfig(): {
    allowedDomains: string[];
    blockedCIDRs: string[];
    enableDNSCheck: boolean;
  } {
    return {
      allowedDomains: Array.from(this.allowedDomains),
      blockedCIDRs: this.blockedCIDRs.map(c => `${c.network}/${c.prefix}`),
      enableDNSCheck: this.enableDNSCheck,
    };
  }
}

/**
 * Singleton instance for global use
 */
export const ssrfProtection = new SSRFProtection();
