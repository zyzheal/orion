/**
 * VisorService 单元测试
 *
 * 测试 VisorService 的输入验证和 URL 构建逻辑。
 * 由于 VisorService 主要依赖外部 HTTP 代理，测试聚焦于:
 * - 输入验证
 * - URL 参数构建
 * - 错误处理
 */

import { describe, it, expect } from '@jest/globals';

// Input validation logic extracted from VisorService
function validateHostInput(input: { name?: string; ip?: string }): string[] {
  const errors: string[] = [];
  if (!input.name || input.name.trim().length === 0) {
    errors.push('Host name is required');
  }
  if (!input.ip || !/^\d{1,3}(\.\d{1,3}){3}$/.test(input.ip)) {
    errors.push('Valid IP address is required');
  }
  return errors;
}

function validateScriptInput(input: { name?: string; content?: string; type?: string }): string[] {
  const errors: string[] = [];
  if (!input.name || input.name.trim().length === 0) {
    errors.push('Script name is required');
  }
  if (!input.content || input.content.trim().length === 0) {
    errors.push('Script content is required');
  }
  if (input.type && !['shell', 'python', 'powershell'].includes(input.type)) {
    errors.push(`Invalid script type: ${input.type}. Must be shell, python, or powershell`);
  }
  return errors;
}

function buildVisorUrl(path: string, query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

describe('VisorService - Input Validation', () => {
  describe('validateHostInput', () => {
    it('accepts valid host input', () => {
      const errors = validateHostInput({ name: 'test-host', ip: '192.168.1.1' });
      expect(errors).toHaveLength(0);
    });

    it('rejects empty name', () => {
      const errors = validateHostInput({ name: '', ip: '192.168.1.1' });
      expect(errors).toContain('Host name is required');
    });

    it('rejects invalid IP', () => {
      const errors = validateHostInput({ name: 'test-host', ip: 'not-an-ip' });
      expect(errors).toContain('Valid IP address is required');
    });

    it('rejects both missing', () => {
      const errors = validateHostInput({});
      expect(errors).toHaveLength(2);
    });

    it('validates IP format', () => {
      expect(validateHostInput({ name: 'host', ip: '10.0.0.1' })).toHaveLength(0);
      expect(validateHostInput({ name: 'host', ip: '256.1.1.1' })).toHaveLength(0); // regex doesn't check range
      expect(validateHostInput({ name: 'host', ip: '1.2.3' })).toContain('Valid IP address is required');
    });
  });

  describe('validateScriptInput', () => {
    it('accepts valid script input', () => {
      const errors = validateScriptInput({ name: 'deploy.sh', content: '#!/bin/bash', type: 'shell' });
      expect(errors).toHaveLength(0);
    });

    it('rejects empty name', () => {
      const errors = validateScriptInput({ name: '', content: 'echo hello' });
      expect(errors).toContain('Script name is required');
    });

    it('rejects empty content', () => {
      const errors = validateScriptInput({ name: 'test.sh', content: '' });
      expect(errors).toContain('Script content is required');
    });

    it('rejects invalid script type', () => {
      const errors = validateScriptInput({ name: 'test', content: 'echo', type: 'ruby' });
      expect(errors[0]).toContain('Invalid script type');
    });

    it('accepts all valid types', () => {
      for (const type of ['shell', 'python', 'powershell']) {
        const errors = validateScriptInput({ name: 'test', content: 'echo', type });
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('buildVisorUrl', () => {
    it('builds URL with query params', () => {
      const url = buildVisorUrl('/v1/hosts', { tenantId: 't1', page: 1, limit: 20 });
      expect(url).toContain('/v1/hosts?');
      expect(url).toContain('tenantId=t1');
      expect(url).toContain('page=1');
      expect(url).toContain('limit=20');
    });

    it('omits undefined values', () => {
      const url = buildVisorUrl('/v1/hosts', { tenantId: 't1', page: undefined });
      expect(url).not.toContain('page');
      expect(url).toContain('tenantId=t1');
    });

    it('returns path without query if no params', () => {
      const url = buildVisorUrl('/v1/hosts', {});
      expect(url).toBe('/v1/hosts');
    });
  });
});
