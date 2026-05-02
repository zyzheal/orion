import { describe, it, expect } from 'vitest';
import { isSafeExternalUrl, sanitizeExternalUrl } from '../actionSecurity';

describe('actionSecurity', () => {
  describe('isSafeExternalUrl', () => {
    it('allows whitelisted HTTPS URLs', () => {
      expect(isSafeExternalUrl('https://github.com/orion-design/repo')).toBe(true);
      expect(isSafeExternalUrl('https://gitlab.com/group/project')).toBe(true);
    });

    it('allows subdomains of whitelisted domains', () => {
      expect(isSafeExternalUrl('https://ci.github.com/orion-design/repo')).toBe(true);
      expect(isSafeExternalUrl('https://docs.gitlab.com/group/project')).toBe(true);
    });

    it('rejects javascript: protocol', () => {
      expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    });

    it('rejects data: protocol', () => {
      expect(isSafeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('rejects vbscript: protocol', () => {
      expect(isSafeExternalUrl('vbscript:msgbox(1)')).toBe(false);
    });

    it('rejects protocol-relative URLs', () => {
      expect(isSafeExternalUrl('//evil.com')).toBe(false);
    });

    it('rejects non-whitelisted domains', () => {
      expect(isSafeExternalUrl('https://evil.com')).toBe(false);
      expect(isSafeExternalUrl('https://github.com.evil.com')).toBe(false);
    });

    it('rejects malformed URLs', () => {
      expect(isSafeExternalUrl('not-a-url')).toBe(false);
      expect(isSafeExternalUrl('')).toBe(false);
    });
  });

  describe('sanitizeExternalUrl', () => {
    it('returns the original URL if safe', () => {
      expect(sanitizeExternalUrl('https://github.com/test')).toBe('https://github.com/test');
    });

    it('returns null if unsafe', () => {
      expect(sanitizeExternalUrl('javascript:alert(1)')).toBe(null);
    });

    it('returns safe URLs unchanged', () => {
      expect(sanitizeExternalUrl('https://github.com/test')).toBeTruthy();
    });
  });
});
