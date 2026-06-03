/**
 * MockServiceManager Tests
 *
 * Covers: rule CRUD, toggle enable/disable, match request with exact/prefix/regex,
 * priority-based matching, stats, pagination, filtering, error handling.
 */

import {
  MockServiceManager,
  MockServiceManagerError,
  MockRule,
} from '../MockServiceManager';

describe('MockServiceManager', () => {
  let manager: MockServiceManager;

  const defaultInput = {
    tenantId: 'tenant-1',
    name: 'Get Users',
    method: 'GET',
    path: '/api/v1/users',
  };

  beforeEach(() => {
    manager = new MockServiceManager();
  });

  // ==================== createRule ====================

  describe('createRule', () => {
    it('should create a rule with all default fields', async () => {
      const rule = await manager.createRule(defaultInput);

      expect(rule.id).toBeDefined();
      expect(rule.tenantId).toBe('tenant-1');
      expect(rule.name).toBe('Get Users');
      expect(rule.method).toBe('GET');
      expect(rule.path).toBe('/api/v1/users');
      expect(rule.statusCode).toBe(200);
      expect(rule.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(rule.body).toEqual({});
      expect(rule.delay).toBe(0);
      expect(rule.enabled).toBe(true);
      expect(rule.priority).toBe(0);
      expect(rule.matchType).toBe('exact');
      expect(rule.description).toBe('');
      expect(rule.createdAt).toBeInstanceOf(Date);
      expect(rule.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a rule with custom fields', async () => {
      const rule = await manager.createRule({
        ...defaultInput,
        description: 'Returns a list of users',
        statusCode: 201,
        headers: { 'X-Custom': 'value' },
        body: { users: [] },
        delay: 500,
        priority: 10,
        matchType: 'prefix',
      });

      expect(rule.description).toBe('Returns a list of users');
      expect(rule.statusCode).toBe(201);
      expect(rule.headers).toEqual({ 'X-Custom': 'value' });
      expect(rule.body).toEqual({ users: [] });
      expect(rule.delay).toBe(500);
      expect(rule.priority).toBe(10);
      expect(rule.matchType).toBe('prefix');
    });

    it('should trim whitespace from name and path', async () => {
      const rule = await manager.createRule({
        ...defaultInput,
        name: '  Get Users  ',
        path: '  /api/v1/users  ',
      });

      expect(rule.name).toBe('Get Users');
      expect(rule.path).toBe('/api/v1/users');
    });

    it('should normalize method to uppercase', async () => {
      const rule = await manager.createRule({ ...defaultInput, method: 'post' });
      expect(rule.method).toBe('POST');
    });

    it('should throw for empty name', async () => {
      await expect(
        manager.createRule({ ...defaultInput, name: '' })
      ).rejects.toThrow(MockServiceManagerError);

      await expect(
        manager.createRule({ ...defaultInput, name: '   ' })
      ).rejects.toThrow(MockServiceManagerError);
    });

    it('should throw for empty method', async () => {
      await expect(
        manager.createRule({ ...defaultInput, method: '' })
      ).rejects.toThrow(MockServiceManagerError);
    });

    it('should throw for empty path', async () => {
      await expect(
        manager.createRule({ ...defaultInput, path: '' })
      ).rejects.toThrow(MockServiceManagerError);
    });

    it('should throw for invalid HTTP method', async () => {
      await expect(
        manager.createRule({ ...defaultInput, method: 'INVALID' })
      ).rejects.toThrow(MockServiceManagerError);

      try {
        await manager.createRule({ ...defaultInput, method: 'INVALID' });
      } catch (err: any) {
        expect(err.code).toBe('INVALID_INPUT');
      }
    });

    it('should accept all valid HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
      for (const method of methods) {
        const rule = await manager.createRule({
          ...defaultInput,
          method,
          path: `/api/${method.toLowerCase()}`,
        });
        expect(rule.method).toBe(method);
      }
    });
  });

  // ==================== getRuleById ====================

  describe('getRuleById', () => {
    it('should return a rule by ID', async () => {
      const created = await manager.createRule(defaultInput);
      const rule = await manager.getRuleById(created.id);

      expect(rule.id).toBe(created.id);
      expect(rule.name).toBe('Get Users');
    });

    it('should throw RULE_NOT_FOUND for non-existent ID', async () => {
      await expect(
        manager.getRuleById('non-existent')
      ).rejects.toThrow(MockServiceManagerError);

      try {
        await manager.getRuleById('non-existent');
      } catch (err: any) {
        expect(err.code).toBe('RULE_NOT_FOUND');
      }
    });
  });

  // ==================== listRules ====================

  describe('listRules', () => {
    it('should return paginated rules', async () => {
      for (let i = 0; i < 5; i++) {
        await manager.createRule({ ...defaultInput, name: `Rule ${i}`, path: `/api/${i}` });
      }

      const result = await manager.listRules('tenant-1', { page: 1, pageSize: 3 });

      expect(result.data.length).toBe(3);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(2);
    });

    it('should use default pagination', async () => {
      const result = await manager.listRules('tenant-1');
      expect(result.page).toBe(1);
    });

    it('should filter by enabled status', async () => {
      const rule1 = await manager.createRule({ ...defaultInput, name: 'Rule 1', path: '/a' });
      await manager.createRule({ ...defaultInput, name: 'Rule 2', path: '/b' });
      await manager.toggleRule(rule1.id);

      const enabled = await manager.listRules('tenant-1', { enabled: true });
      expect(enabled.data.every(r => r.enabled)).toBe(true);
      expect(enabled.total).toBe(1);

      const disabled = await manager.listRules('tenant-1', { enabled: false });
      expect(disabled.data.every(r => !r.enabled)).toBe(true);
    });

    it('should filter by method', async () => {
      await manager.createRule({ ...defaultInput, method: 'GET', path: '/a' });
      await manager.createRule({ ...defaultInput, method: 'POST', path: '/b' });

      const result = await manager.listRules('tenant-1', { method: 'POST' });
      expect(result.data.every(r => r.method === 'POST')).toBe(true);
    });

    it('should sort by priority descending', async () => {
      await manager.createRule({ ...defaultInput, name: 'Low', path: '/low', priority: 1 });
      await manager.createRule({ ...defaultInput, name: 'High', path: '/high', priority: 10 });

      const result = await manager.listRules('tenant-1');
      expect(result.data[0].name).toBe('High');
    });

    it('should isolate by tenant', async () => {
      await manager.createRule(defaultInput);
      await manager.createRule({ ...defaultInput, tenantId: 'tenant-2' });

      const result = await manager.listRules('tenant-1');
      expect(result.total).toBe(1);
    });
  });

  // ==================== updateRule ====================

  describe('updateRule', () => {
    it('should update rule fields', async () => {
      const created = await manager.createRule(defaultInput);

      const updated = await manager.updateRule(created.id, {
        name: 'Updated Rule',
        path: '/api/v2/users',
        statusCode: 201,
        delay: 100,
        priority: 5,
      });

      expect(updated.name).toBe('Updated Rule');
      expect(updated.path).toBe('/api/v2/users');
      expect(updated.statusCode).toBe(201);
      expect(updated.delay).toBe(100);
      expect(updated.priority).toBe(5);
    });

    it('should update method, headers, body, enabled, matchType', async () => {
      const created = await manager.createRule(defaultInput);

      const updated = await manager.updateRule(created.id, {
        method: 'POST',
        headers: { 'X-Test': '1' },
        body: { success: true },
        enabled: false,
        matchType: 'regex',
      });

      expect(updated.method).toBe('POST');
      expect(updated.headers).toEqual({ 'X-Test': '1' });
      expect(updated.body).toEqual({ success: true });
      expect(updated.enabled).toBe(false);
      expect(updated.matchType).toBe('regex');
    });

    it('should throw RULE_NOT_FOUND for non-existent ID', async () => {
      await expect(
        manager.updateRule('non-existent', { name: 'test' })
      ).rejects.toThrow(MockServiceManagerError);
    });

    it('should throw for invalid method on update', async () => {
      const created = await manager.createRule(defaultInput);

      await expect(
        manager.updateRule(created.id, { method: 'INVALID' })
      ).rejects.toThrow(MockServiceManagerError);
    });

    it('should update the updatedAt timestamp', async () => {
      const created = await manager.createRule(defaultInput);
      const originalUpdatedAt = created.updatedAt;

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await manager.updateRule(created.id, { name: 'Updated' });
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });
  });

  // ==================== deleteRule ====================

  describe('deleteRule', () => {
    it('should delete an existing rule', async () => {
      const created = await manager.createRule(defaultInput);
      const result = await manager.deleteRule(created.id);

      expect(result).toBe(true);

      await expect(manager.getRuleById(created.id)).rejects.toThrow(MockServiceManagerError);
    });

    it('should throw RULE_NOT_FOUND for non-existent ID', async () => {
      await expect(
        manager.deleteRule('non-existent')
      ).rejects.toThrow(MockServiceManagerError);
    });
  });

  // ==================== toggleRule ====================

  describe('toggleRule', () => {
    it('should toggle enabled to disabled', async () => {
      const created = await manager.createRule(defaultInput);
      expect(created.enabled).toBe(true);

      const toggled = await manager.toggleRule(created.id);
      expect(toggled.enabled).toBe(false);
    });

    it('should toggle disabled back to enabled', async () => {
      const created = await manager.createRule(defaultInput);
      await manager.toggleRule(created.id);
      const toggled = await manager.toggleRule(created.id);

      expect(toggled.enabled).toBe(true);
    });

    it('should throw RULE_NOT_FOUND for non-existent ID', async () => {
      await expect(
        manager.toggleRule('non-existent')
      ).rejects.toThrow(MockServiceManagerError);
    });
  });

  // ==================== matchRequest ====================

  describe('matchRequest', () => {
    describe('exact match', () => {
      it('should match exact path', async () => {
        await manager.createRule({
          ...defaultInput,
          matchType: 'exact',
          body: { users: [{ id: 1, name: 'Alice' }] },
        });

        const result = await manager.matchRequest('tenant-1', 'GET', '/api/v1/users');

        expect(result.matched).toBe(true);
        expect(result.statusCode).toBe(200);
        expect(result.body).toEqual({ users: [{ id: 1, name: 'Alice' }] });
        expect(result.rule).toBeDefined();
      });

      it('should not match different path', async () => {
        await manager.createRule({ ...defaultInput, matchType: 'exact' });

        const result = await manager.matchRequest('tenant-1', 'GET', '/api/v1/orders');
        expect(result.matched).toBe(false);
        expect(result.statusCode).toBe(404);
      });
    });

    describe('prefix match', () => {
      it('should match path with prefix', async () => {
        await manager.createRule({
          ...defaultInput,
          path: '/api/v1',
          matchType: 'prefix',
        });

        const result = await manager.matchRequest('tenant-1', 'GET', '/api/v1/users');
        expect(result.matched).toBe(true);
      });

      it('should match exact prefix', async () => {
        await manager.createRule({
          ...defaultInput,
          path: '/api/v1/users',
          matchType: 'prefix',
        });

        const result = await manager.matchRequest('tenant-1', 'GET', '/api/v1/users/123');
        expect(result.matched).toBe(true);
      });

      it('should not match non-matching prefix', async () => {
        await manager.createRule({
          ...defaultInput,
          path: '/api/v2',
          matchType: 'prefix',
        });

        const result = await manager.matchRequest('tenant-1', 'GET', '/api/v1/users');
        expect(result.matched).toBe(false);
      });
    });

    describe('regex match', () => {
      it('should match with regex pattern', async () => {
        await manager.createRule({
          ...defaultInput,
          path: '/api/v\\d+/users',
          matchType: 'regex',
        });

        const result = await manager.matchRequest('tenant-1', 'GET', '/api/v1/users');
        expect(result.matched).toBe(true);
      });

      it('should match with complex regex', async () => {
        await manager.createRule({
          ...defaultInput,
          path: '/api/(users|accounts)/\\d+',
          matchType: 'regex',
        });

        expect((await manager.matchRequest('tenant-1', 'GET', '/api/users/123')).matched).toBe(true);
        expect((await manager.matchRequest('tenant-1', 'GET', '/api/accounts/456')).matched).toBe(true);
        expect((await manager.matchRequest('tenant-1', 'GET', '/api/orders/123')).matched).toBe(false);
      });

      it('should return no match for invalid regex', async () => {
        await manager.createRule({
          ...defaultInput,
          path: '[invalid',
          matchType: 'regex',
        });

        const result = await manager.matchRequest('tenant-1', 'GET', '/api/v1/users');
        expect(result.matched).toBe(false);
      });
    });

    describe('method matching', () => {
      it('should only match rules with correct method', async () => {
        await manager.createRule({ ...defaultInput, method: 'GET' });

        const getResult = await manager.matchRequest('tenant-1', 'GET', '/api/v1/users');
        expect(getResult.matched).toBe(true);

        const postResult = await manager.matchRequest('tenant-1', 'POST', '/api/v1/users');
        expect(postResult.matched).toBe(false);
      });

      it('should normalize method for matching', async () => {
        await manager.createRule({ ...defaultInput, method: 'GET' });

        const result = await manager.matchRequest('tenant-1', 'get', '/api/v1/users');
        expect(result.matched).toBe(true);
      });
    });

    describe('priority', () => {
      it('should return highest priority match first', async () => {
        await manager.createRule({
          ...defaultInput,
          name: 'Low Priority',
          priority: 1,
          statusCode: 200,
          matchType: 'prefix',
          path: '/api',
        });
        await manager.createRule({
          ...defaultInput,
          name: 'High Priority',
          priority: 10,
          statusCode: 201,
          matchType: 'prefix',
          path: '/api',
        });

        const result = await manager.matchRequest('tenant-1', 'GET', '/api/v1/users');
        expect(result.matched).toBe(true);
        expect(result.statusCode).toBe(201);
        expect(result.rule!.name).toBe('High Priority');
      });
    });

    describe('enabled/disabled', () => {
      it('should not match disabled rules', async () => {
        const rule = await manager.createRule(defaultInput);
        await manager.toggleRule(rule.id);

        const result = await manager.matchRequest('tenant-1', 'GET', '/api/v1/users');
        expect(result.matched).toBe(false);
      });

      it('should match enabled rules and skip disabled ones', async () => {
        const disabled = await manager.createRule({ ...defaultInput, name: 'Disabled', priority: 10 });
        await manager.createRule({ ...defaultInput, name: 'Enabled', priority: 1, path: '/api' , matchType: 'prefix' });
        await manager.toggleRule(disabled.id);

        const result = await manager.matchRequest('tenant-1', 'GET', '/api/v1/users');
        expect(result.matched).toBe(true);
        expect(result.rule!.name).toBe('Enabled');
      });
    });

    describe('tenant isolation', () => {
      it('should only match rules from the same tenant', async () => {
        await manager.createRule({ ...defaultInput, tenantId: 'tenant-2' });

        const result = await manager.matchRequest('tenant-1', 'GET', '/api/v1/users');
        expect(result.matched).toBe(false);
      });
    });

    describe('response fields', () => {
      it('should return custom headers from matched rule', async () => {
        await manager.createRule({
          ...defaultInput,
          headers: { 'X-Mock': 'true', 'Cache-Control': 'no-cache' },
        });

        const result = await manager.matchRequest('tenant-1', 'GET', '/api/v1/users');
        expect(result.headers['X-Mock']).toBe('true');
        expect(result.headers['Cache-Control']).toBe('no-cache');
      });

      it('should return delay from matched rule', async () => {
        await manager.createRule({ ...defaultInput, delay: 500 });

        const result = await manager.matchRequest('tenant-1', 'GET', '/api/v1/users');
        expect(result.delay).toBe(500);
      });

      it('should return custom status code from matched rule', async () => {
        await manager.createRule({ ...defaultInput, statusCode: 403 });

        const result = await manager.matchRequest('tenant-1', 'GET', '/api/v1/users');
        expect(result.statusCode).toBe(403);
      });
    });

    describe('no match', () => {
      it('should return 404 when no rules match', async () => {
        const result = await manager.matchRequest('tenant-1', 'GET', '/no/rules');

        expect(result.matched).toBe(false);
        expect(result.statusCode).toBe(404);
        expect(result.headers).toEqual({});
        expect(result.body).toBeNull();
        expect(result.delay).toBe(0);
      });
    });
  });

  // ==================== getStats ====================

  describe('getStats', () => {
    it('should return stats with zero for empty tenant', async () => {
      const stats = await manager.getStats('tenant-empty');

      expect(stats.total).toBe(0);
      expect(stats.enabled).toBe(0);
      expect(stats.disabled).toBe(0);
    });

    it('should count enabled and disabled rules', async () => {
      const rule1 = await manager.createRule({ ...defaultInput, name: 'Rule 1', path: '/a' });
      await manager.createRule({ ...defaultInput, name: 'Rule 2', path: '/b' });
      await manager.createRule({ ...defaultInput, name: 'Rule 3', path: '/c' });
      await manager.toggleRule(rule1.id);

      const stats = await manager.getStats('tenant-1');
      expect(stats.total).toBe(3);
      expect(stats.enabled).toBe(2);
      expect(stats.disabled).toBe(1);
    });

    it('should isolate stats by tenant', async () => {
      await manager.createRule(defaultInput);
      await manager.createRule({ ...defaultInput, tenantId: 'tenant-2', path: '/other' });

      const stats1 = await manager.getStats('tenant-1');
      const stats2 = await manager.getStats('tenant-2');

      expect(stats1.total).toBe(1);
      expect(stats2.total).toBe(1);
    });
  });
});
