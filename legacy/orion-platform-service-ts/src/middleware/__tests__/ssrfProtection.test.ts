/**
 * SSRF Protection Middleware Tests
 */

import { SSRFProtection } from '../ssrfProtection';
import { OrionError, ErrorCode } from '../../errors';

describe('SSRFProtection', () => {
  let ssrf: SSRFProtection;

  beforeEach(() => {
    ssrf = new SSRFProtection({
      allowedDomains: ['github.com', 'api.example.com', '*.trusted.com'],
      enableDNSCheck: false, // Disable DNS check for unit tests
    });
  });

  describe('validateUrl - Protocol Check', () => {
    it('should allow http:// URLs', async () => {
      await expect(ssrf.validateUrl('http://github.com/test')).resolves.not.toThrow();
    });

    it('should allow https:// URLs', async () => {
      await expect(ssrf.validateUrl('https://github.com/test')).resolves.not.toThrow();
    });

    it('should reject ftp:// URLs', async () => {
      await expect(ssrf.validateUrl('ftp://github.com/test')).rejects.toThrow(OrionError);
      await expect(ssrf.validateUrl('ftp://github.com/test')).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
      });
    });

    it('should reject file:// URLs', async () => {
      await expect(ssrf.validateUrl('file:///etc/passwd')).rejects.toThrow(OrionError);
    });

    it('should reject gopher:// URLs', async () => {
      await expect(ssrf.validateUrl('gopher://github.com')).rejects.toThrow(OrionError);
    });
  });

  describe('validateUrl - Domain Whitelist', () => {
    it('should allow exact domain match', async () => {
      await expect(ssrf.validateUrl('https://github.com/repo')).resolves.not.toThrow();
      await expect(ssrf.validateUrl('https://api.example.com/v1')).resolves.not.toThrow();
    });

    it('should allow wildcard subdomain match', async () => {
      await expect(ssrf.validateUrl('https://api.trusted.com/test')).resolves.not.toThrow();
      await expect(ssrf.validateUrl('https://sub.trusted.com/test')).resolves.not.toThrow();
    });

    it('should reject non-whitelisted domains', async () => {
      await expect(ssrf.validateUrl('https://evil.com/test')).rejects.toThrow(OrionError);
      await expect(ssrf.validateUrl('https://evil.com/test')).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
      });
    });

    it('should reject domain with malicious suffix', async () => {
      await expect(ssrf.validateUrl('https://fakegithub.com/test')).rejects.toThrow(OrionError);
    });
  });

  describe('validateUrl - Invalid URLs', () => {
    it('should reject invalid URL format', async () => {
      await expect(ssrf.validateUrl('not-a-url')).rejects.toThrow(OrionError);
      await expect(ssrf.validateUrl('://malformed')).rejects.toThrow(OrionError);
    });

    it('should reject empty URL', async () => {
      await expect(ssrf.validateUrl('')).rejects.toThrow(OrionError);
    });
  });

  describe('isIPInCIDR', () => {
    let ssrfWithDNS: SSRFProtection;

    beforeEach(() => {
      ssrfWithDNS = new SSRFProtection({
        allowedDomains: ['example.com'],
        blockedCIDRs: ['192.168.0.0/16', '10.0.0.0/8', '127.0.0.0/8'],
        enableDNSCheck: true,
      });
    });

    it('should block loopback addresses', async () => {
      // Mock DNS to return loopback
      jest.spyOn(ssrfWithDNS as any, 'resolveDNS').mockResolvedValue('127.0.0.1');

      await expect(ssrfWithDNS.validateUrl('https://example.com')).rejects.toThrow(OrionError);
      await expect(ssrfWithDNS.validateUrl('https://example.com')).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
      });
    });

    it('should block private Class A (10.0.0.0/8)', async () => {
      jest.spyOn(ssrfWithDNS as any, 'resolveDNS').mockResolvedValue('10.1.2.3');

      await expect(ssrfWithDNS.validateUrl('https://example.com')).rejects.toThrow(OrionError);
    });

    it('should block private Class C (192.168.0.0/16)', async () => {
      jest.spyOn(ssrfWithDNS as any, 'resolveDNS').mockResolvedValue('192.168.1.100');

      await expect(ssrfWithDNS.validateUrl('https://example.com')).rejects.toThrow(OrionError);
    });

    it('should allow public IP addresses', async () => {
      jest.spyOn(ssrfWithDNS as any, 'resolveDNS').mockResolvedValue('8.8.8.8');

      await expect(ssrfWithDNS.validateUrl('https://example.com')).resolves.not.toThrow();
    });
  });

  describe('Runtime Configuration', () => {
    it('should allow adding domains at runtime', async () => {
      await expect(ssrf.validateUrl('https://newdomain.com')).rejects.toThrow(OrionError);

      ssrf.addAllowedDomain('newdomain.com');

      await expect(ssrf.validateUrl('https://newdomain.com')).resolves.not.toThrow();
    });

    it('should allow removing domains at runtime', async () => {
      await expect(ssrf.validateUrl('https://github.com')).resolves.not.toThrow();

      ssrf.removeAllowedDomain('github.com');

      await expect(ssrf.validateUrl('https://github.com')).rejects.toThrow(OrionError);
    });

    it('should return current configuration', () => {
      const config = ssrf.getConfig();

      expect(config.allowedDomains).toContain('github.com');
      expect(config.allowedDomains).toContain('api.example.com');
      expect(config.enableDNSCheck).toBe(false);
      expect(Array.isArray(config.blockedCIDRs)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle URLs with ports', async () => {
      await expect(ssrf.validateUrl('https://github.com:443/test')).resolves.not.toThrow();
    });

    it('should handle URLs with query strings', async () => {
      await expect(ssrf.validateUrl('https://github.com/test?param=value')).resolves.not.toThrow();
    });

    it('should handle URLs with fragments', async () => {
      await expect(ssrf.validateUrl('https://github.com/test#section')).resolves.not.toThrow();
    });

    it('should handle URLs with authentication', async () => {
      await expect(ssrf.validateUrl('https://user:pass@github.com/test')).resolves.not.toThrow();
    });

    it('should be case-insensitive for protocols', async () => {
      await expect(ssrf.validateUrl('HTTP://github.com')).resolves.not.toThrow();
      await expect(ssrf.validateUrl('HTTPS://github.com')).resolves.not.toThrow();
    });
  });

  describe('Default Configuration', () => {
    it('should have default allowed domains', () => {
      const defaultSSRF = new SSRFProtection();
      const config = defaultSSRF.getConfig();

      expect(config.allowedDomains).toContain('github.com');
      expect(config.allowedDomains).toContain('gitlab.com');
      expect(config.allowedDomains).toContain('api.openai.com');
    });

    it('should have default blocked CIDRs', () => {
      const defaultSSRF = new SSRFProtection();
      const config = defaultSSRF.getConfig();

      expect(config.blockedCIDRs).toContain('127.0.0.0/8');
      expect(config.blockedCIDRs).toContain('10.0.0.0/8');
      expect(config.blockedCIDRs).toContain('192.168.0.0/16');
    });
  });

  describe('CIDR Calculation', () => {
    it('should correctly calculate /24 CIDR', () => {
      const testSSRF = new SSRFProtection({
        allowedDomains: ['test.com'],
        blockedCIDRs: ['192.168.1.0/24'],
        enableDNSCheck: true,
      });

      jest.spyOn(testSSRF as any, 'resolveDNS').mockResolvedValue('192.168.1.50');
      expect(testSSRF.validateUrl('https://test.com')).rejects.toThrow();

      jest.spyOn(testSSRF as any, 'resolveDNS').mockResolvedValue('192.168.2.50');
      expect(testSSRF.validateUrl('https://test.com')).resolves.not.toThrow();
    });

    it('should correctly calculate /16 CIDR', () => {
      const testSSRF = new SSRFProtection({
        allowedDomains: ['test.com'],
        blockedCIDRs: ['172.16.0.0/12'],
        enableDNSCheck: true,
      });

      jest.spyOn(testSSRF as any, 'resolveDNS').mockResolvedValue('172.20.1.1');
      expect(testSSRF.validateUrl('https://test.com')).rejects.toThrow();

      jest.spyOn(testSSRF as any, 'resolveDNS').mockResolvedValue('172.32.1.1');
      expect(testSSRF.validateUrl('https://test.com')).resolves.not.toThrow();
    });
  });

  describe('DNS Timeout', () => {
    it('should timeout long DNS lookups', async () => {
      await jest.isolateModulesAsync(async () => {
        jest.doMock('dns', () => ({
          lookup: () => {},
          resolve4: (_hostname: string, callback: (err: any, addresses: string[]) => void) => {
            setTimeout(() => callback(null as any, []), 200);
            return {} as any;
          },
        }));

        const { SSRFProtection: SSRFProtectionWithMock } = await import('../ssrfProtection');
        const timeoutSSRF = new SSRFProtectionWithMock({
          allowedDomains: ['slow.example.com'],
          enableDNSCheck: true,
          dnsTimeout: 100,
        });

        await expect(timeoutSSRF.validateUrl('https://slow.example.com')).rejects.toThrow();
      });
    }, 10000);
  });
});
