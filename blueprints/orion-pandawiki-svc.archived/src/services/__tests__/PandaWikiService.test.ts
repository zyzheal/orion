/**
 * PandaWikiService 单元测试
 *
 * 测试知识库服务的输入验证和搜索逻辑。
 */

import { describe, it, expect } from '@jest/globals';

// Input validation logic extracted from PandaWikiService
function validateSpaceInput(input: { name?: string }): string[] {
  const errors: string[] = [];
  if (!input.name || input.name.trim().length === 0) {
    errors.push('Space name is required');
  }
  if (input.name && input.name.length > 100) {
    errors.push('Space name must be less than 100 characters');
  }
  return errors;
}

function validateDocumentInput(input: { title?: string; content?: string; spaceId?: string }): string[] {
  const errors: string[] = [];
  if (!input.title || input.title.trim().length === 0) {
    errors.push('Document title is required');
  }
  if (!input.content || input.content.trim().length === 0) {
    errors.push('Document content is required');
  }
  if (!input.spaceId || input.spaceId.trim().length === 0) {
    errors.push('Space ID is required');
  }
  return errors;
}

function buildSearchQuery(q: string, options?: { spaceId?: string; page?: number; limit?: number }): string {
  const params = new URLSearchParams();
  params.set('q', q);
  if (options?.spaceId) params.set('spaceId', options.spaceId);
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  return params.toString();
}

function sanitizeContent(content: string, maxLength: number = 100000): string {
  // Strip control characters except newlines and tabs
  return content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, maxLength);
}

describe('PandaWikiService - Input Validation', () => {
  describe('validateSpaceInput', () => {
    it('accepts valid space name', () => {
      expect(validateSpaceInput({ name: 'My Space' })).toHaveLength(0);
    });

    it('rejects empty name', () => {
      expect(validateSpaceInput({})).toContain('Space name is required');
    });

    it('rejects too long name', () => {
      const errors = validateSpaceInput({ name: 'a'.repeat(101) });
      expect(errors).toContain('Space name must be less than 100 characters');
    });

    it('accepts max length name', () => {
      expect(validateSpaceInput({ name: 'a'.repeat(100) })).toHaveLength(0);
    });
  });

  describe('validateDocumentInput', () => {
    it('accepts valid document', () => {
      const errors = validateDocumentInput({ title: 'Doc', content: 'Content', spaceId: 's1' });
      expect(errors).toHaveLength(0);
    });

    it('rejects missing fields', () => {
      expect(validateDocumentInput({})).toHaveLength(3);
    });

    it('rejects whitespace-only fields', () => {
      const errors = validateDocumentInput({ title: '  ', content: '  ', spaceId: '  ' });
      expect(errors).toHaveLength(3);
    });
  });

  describe('buildSearchQuery', () => {
    it('builds basic query', () => {
      const q = buildSearchQuery('hello');
      expect(q).toContain('q=hello');
    });

    it('includes optional params', () => {
      const q = buildSearchQuery('test', { spaceId: 's1', page: 2, limit: 20 });
      expect(q).toContain('q=test');
      expect(q).toContain('spaceId=s1');
      expect(q).toContain('page=2');
      expect(q).toContain('limit=20');
    });

    it('omits undefined params', () => {
      const q = buildSearchQuery('test', { spaceId: 's1' });
      expect(q).not.toContain('page=');
      expect(q).not.toContain('limit=');
    });
  });

  describe('sanitizeContent', () => {
    it('removes control characters', () => {
      const input = 'Hello\x00World\x01Test';
      expect(sanitizeContent(input)).toBe('HelloWorldTest');
    });

    it('preserves newlines and tabs', () => {
      const input = 'Hello\nWorld\tTab';
      expect(sanitizeContent(input)).toBe('Hello\nWorld\tTab');
    });

    it('truncates to max length', () => {
      const input = 'a'.repeat(150000);
      expect(sanitizeContent(input)).toHaveLength(100000);
    });

    it('respects custom max length', () => {
      const input = 'a'.repeat(500);
      expect(sanitizeContent(input, 100)).toHaveLength(100);
    });
  });
});
