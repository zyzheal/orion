/**
 * APIPlaygroundService Tests
 *
 * Covers: request save/retrieve/update/delete, list with pagination & filtering,
 * execute request (simulation), quick execute, response history, stats, clear history.
 */

import {
  APIPlaygroundService,
  APIPlaygroundServiceError,
  PlaygroundRequest,
} from '../APIPlaygroundService';

describe('APIPlaygroundService', () => {
  let service: APIPlaygroundService;

  const defaultInput = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    method: 'GET',
    url: 'https://api.example.com/healthz',
  };

  beforeEach(() => {
    service = new APIPlaygroundService();
  });

  // ==================== saveRequest ====================

  describe('saveRequest', () => {
    it('should save a request with all default fields', async () => {
      const req = await service.saveRequest(defaultInput);

      expect(req.id).toBeDefined();
      expect(req.tenantId).toBe('tenant-1');
      expect(req.userId).toBe('user-1');
      expect(req.method).toBe('GET');
      expect(req.url).toBe('https://api.example.com/healthz');
      expect(req.name).toBe('GET https://api.example.com/healthz');
      expect(req.headers).toEqual({});
      expect(req.queryParams).toEqual({});
      expect(req.body).toBe('');
      expect(req.bodyType).toBe('none');
      expect(req.createdAt).toBeInstanceOf(Date);
    });

    it('should save with custom fields', async () => {
      const req = await service.saveRequest({
        ...defaultInput,
        name: 'Health Check',
        method: 'POST',
        url: 'https://api.example.com/data',
        headers: { Authorization: 'Bearer token' },
        queryParams: { page: '1' },
        body: '{"key":"value"}',
        bodyType: 'json',
      });

      expect(req.name).toBe('Health Check');
      expect(req.method).toBe('POST');
      expect(req.headers).toEqual({ Authorization: 'Bearer token' });
      expect(req.queryParams).toEqual({ page: '1' });
      expect(req.body).toBe('{"key":"value"}');
      expect(req.bodyType).toBe('json');
    });

    it('should normalize method to uppercase', async () => {
      const req = await service.saveRequest({ ...defaultInput, method: 'post', url: 'https://example.com' });
      expect(req.method).toBe('POST');
    });

    it('should trim whitespace from url', async () => {
      const req = await service.saveRequest({ ...defaultInput, url: '  https://example.com  ' });
      expect(req.url).toBe('https://example.com');
    });

    it('should throw for empty url', async () => {
      await expect(
        service.saveRequest({ ...defaultInput, url: '' })
      ).rejects.toThrow(APIPlaygroundServiceError);

      await expect(
        service.saveRequest({ ...defaultInput, url: '   ' })
      ).rejects.toThrow(APIPlaygroundServiceError);
    });

    it('should throw for empty method', async () => {
      await expect(
        service.saveRequest({ ...defaultInput, method: '' })
      ).rejects.toThrow(APIPlaygroundServiceError);
    });

    it('should throw for invalid HTTP method', async () => {
      await expect(
        service.saveRequest({ ...defaultInput, method: 'INVALID' })
      ).rejects.toThrow(APIPlaygroundServiceError);

      try {
        await service.saveRequest({ ...defaultInput, method: 'INVALID' });
      } catch (err: any) {
        expect(err.code).toBe('INVALID_INPUT');
      }
    });

    it('should accept all valid HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
      for (const method of methods) {
        const req = await service.saveRequest({ ...defaultInput, method, url: `https://example.com/${method}` });
        expect(req.method).toBe(method);
      }
    });
  });

  // ==================== getRequestById ====================

  describe('getRequestById', () => {
    it('should return a saved request', async () => {
      const created = await service.saveRequest(defaultInput);
      const req = await service.getRequestById(created.id);

      expect(req.id).toBe(created.id);
      expect(req.url).toBe(defaultInput.url);
    });

    it('should throw REQUEST_NOT_FOUND for non-existent ID', async () => {
      await expect(
        service.getRequestById('non-existent')
      ).rejects.toThrow(APIPlaygroundServiceError);

      try {
        await service.getRequestById('non-existent');
      } catch (err: any) {
        expect(err.code).toBe('REQUEST_NOT_FOUND');
      }
    });
  });

  // ==================== listRequests ====================

  describe('listRequests', () => {
    it('should return paginated requests sorted by createdAt desc', async () => {
      for (let i = 0; i < 5; i++) {
        await service.saveRequest({ ...defaultInput, url: `https://example.com/${i}` });
      }

      const result = await service.listRequests('tenant-1', 'user-1', { page: 1, pageSize: 3 });

      expect(result.data.length).toBe(3);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(2);
    });

    it('should use default pagination', async () => {
      const result = await service.listRequests('tenant-1', 'user-1');

      expect(result.page).toBe(1);
      expect(result.data.length).toBe(0);
    });

    it('should filter by method', async () => {
      await service.saveRequest({ ...defaultInput, method: 'GET', url: 'https://example.com/a' });
      await service.saveRequest({ ...defaultInput, method: 'POST', url: 'https://example.com/b' });

      const result = await service.listRequests('tenant-1', 'user-1', { method: 'POST' });
      expect(result.data.every(r => r.method === 'POST')).toBe(true);
    });

    it('should filter by tenant and user', async () => {
      await service.saveRequest(defaultInput);
      await service.saveRequest({ ...defaultInput, userId: 'user-2' });
      await service.saveRequest({ ...defaultInput, tenantId: 'tenant-2' });

      const result = await service.listRequests('tenant-1', 'user-1');
      expect(result.total).toBe(1);
    });

    it('should handle empty results', async () => {
      const result = await service.listRequests('tenant-empty', 'user-empty');
      expect(result.data.length).toBe(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  // ==================== updateRequest ====================

  describe('updateRequest', () => {
    it('should update request fields', async () => {
      const created = await service.saveRequest(defaultInput);

      const updated = await service.updateRequest(created.id, {
        name: 'Updated Name',
        url: 'https://new-url.com',
        method: 'POST',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.url).toBe('https://new-url.com');
      expect(updated.method).toBe('POST');
    });

    it('should update headers, queryParams, body, bodyType', async () => {
      const created = await service.saveRequest(defaultInput);

      const updated = await service.updateRequest(created.id, {
        headers: { 'X-Custom': 'value' },
        queryParams: { q: 'test' },
        body: '{"updated": true}',
        bodyType: 'json',
      });

      expect(updated.headers).toEqual({ 'X-Custom': 'value' });
      expect(updated.queryParams).toEqual({ q: 'test' });
      expect(updated.body).toBe('{"updated": true}');
      expect(updated.bodyType).toBe('json');
    });

    it('should throw REQUEST_NOT_FOUND for non-existent ID', async () => {
      await expect(
        service.updateRequest('non-existent', { name: 'test' })
      ).rejects.toThrow(APIPlaygroundServiceError);
    });

    it('should throw for invalid method on update', async () => {
      const created = await service.saveRequest(defaultInput);

      await expect(
        service.updateRequest(created.id, { method: 'INVALID' })
      ).rejects.toThrow(APIPlaygroundServiceError);
    });

    it('should normalize method to uppercase on update', async () => {
      const created = await service.saveRequest(defaultInput);
      const updated = await service.updateRequest(created.id, { method: 'patch' });

      expect(updated.method).toBe('PATCH');
    });
  });

  // ==================== deleteRequest ====================

  describe('deleteRequest', () => {
    it('should delete a saved request', async () => {
      const created = await service.saveRequest(defaultInput);
      const result = await service.deleteRequest(created.id);

      expect(result).toBe(true);

      await expect(service.getRequestById(created.id)).rejects.toThrow(APIPlaygroundServiceError);
    });

    it('should also clear response history on delete', async () => {
      const created = await service.saveRequest(defaultInput);
      await service.executeRequest(created.id);

      await service.deleteRequest(created.id);

      // History should be gone
      const history = await service.getResponseHistory(created.id);
      expect(history.data.length).toBe(0);
    });

    it('should throw REQUEST_NOT_FOUND for non-existent ID', async () => {
      await expect(
        service.deleteRequest('non-existent')
      ).rejects.toThrow(APIPlaygroundServiceError);
    });
  });

  // ==================== executeRequest ====================

  describe('executeRequest', () => {
    it('should execute a GET request and return 200', async () => {
      const created = await service.saveRequest(defaultInput);

      const result = await service.executeRequest(created.id);

      expect(result.request.id).toBe(created.id);
      expect(result.response.statusCode).toBe(200);
      expect(result.response.requestId).toBe(created.id);
      expect(result.response.headers['Content-Type']).toBe('application/json');
      expect(result.response.headers['X-Request-Id']).toBeDefined();
      expect(result.response.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.response.timestamp).toBeInstanceOf(Date);
    });

    it('should simulate 201 for POST requests', async () => {
      const created = await service.saveRequest({
        ...defaultInput,
        method: 'POST',
        url: 'https://api.example.com/items',
        body: '{"name":"test"}',
        bodyType: 'json',
      });

      const result = await service.executeRequest(created.id);
      expect(result.response.statusCode).toBe(201);
    });

    it('should simulate 200 for PUT requests', async () => {
      const created = await service.saveRequest({
        ...defaultInput,
        method: 'PUT',
        url: 'https://api.example.com/items/1',
      });

      const result = await service.executeRequest(created.id);
      expect(result.response.statusCode).toBe(200);
    });

    it('should simulate 200 for DELETE requests', async () => {
      const created = await service.saveRequest({
        ...defaultInput,
        method: 'DELETE',
        url: 'https://api.example.com/items/1',
      });

      const result = await service.executeRequest(created.id);
      expect(result.response.statusCode).toBe(200);
    });

    it('should simulate 500 for URLs containing /error', async () => {
      const created = await service.saveRequest({
        ...defaultInput,
        url: 'https://api.example.com/error',
      });

      const result = await service.executeRequest(created.id);
      expect(result.response.statusCode).toBe(500);
    });

    it('should simulate 404 for URLs containing /not-found', async () => {
      const created = await service.saveRequest({
        ...defaultInput,
        url: 'https://api.example.com/not-found',
      });

      const result = await service.executeRequest(created.id);
      expect(result.response.statusCode).toBe(404);
    });

    it('should simulate 404 for URLs containing /404', async () => {
      const created = await service.saveRequest({
        ...defaultInput,
        url: 'https://api.example.com/resource/404',
      });

      const result = await service.executeRequest(created.id);
      expect(result.response.statusCode).toBe(404);
    });

    it('should simulate health check response', async () => {
      const created = await service.saveRequest({
        ...defaultInput,
        url: 'https://api.example.com/health',
      });

      const result = await service.executeRequest(created.id);
      expect(result.response.statusCode).toBe(200);
      const body = JSON.parse(result.response.body);
      expect(body.status).toBe('ok');
    });

    it('should append query params to URL', async () => {
      const created = await service.saveRequest({
        ...defaultInput,
        url: 'https://api.example.com/items',
        queryParams: { page: '1', limit: '10' },
      });

      const result = await service.executeRequest(created.id);
      expect(result.response.statusCode).toBe(200);
    });

    it('should store response history', async () => {
      const created = await service.saveRequest(defaultInput);

      await service.executeRequest(created.id);
      await service.executeRequest(created.id);

      const history = await service.getResponseHistory(created.id);
      expect(history.data.length).toBe(2);
      expect(history.total).toBe(2);
    });

    it('should keep only last 50 responses per request', async () => {
      const created = await service.saveRequest(defaultInput);

      for (let i = 0; i < 55; i++) {
        await service.executeRequest(created.id);
      }

      const history = await service.getResponseHistory(created.id);
      expect(history.data.length).toBeLessThanOrEqual(50);
    });

    it('should throw REQUEST_NOT_FOUND for non-existent ID', async () => {
      await expect(
        service.executeRequest('non-existent')
      ).rejects.toThrow(APIPlaygroundServiceError);
    });
  });

  // ==================== quickExecute ====================

  describe('quickExecute', () => {
    it('should save and execute in one step', async () => {
      const result = await service.quickExecute(defaultInput);

      expect(result.request).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.request.method).toBe('GET');
      expect(result.response.statusCode).toBe(200);
    });

    it('should handle POST quick execute', async () => {
      const result = await service.quickExecute({
        ...defaultInput,
        method: 'POST',
        url: 'https://api.example.com/items',
        body: '{"name":"test"}',
        bodyType: 'json',
      });

      expect(result.response.statusCode).toBe(201);
    });
  });

  // ==================== getResponseHistory ====================

  describe('getResponseHistory', () => {
    it('should return paginated response history', async () => {
      const created = await service.saveRequest(defaultInput);

      for (let i = 0; i < 5; i++) {
        await service.executeRequest(created.id);
      }

      const result = await service.getResponseHistory(created.id, { page: 1, pageSize: 3 });
      expect(result.data.length).toBe(3);
      expect(result.total).toBe(5);
      expect(result.totalPages).toBe(2);
    });

    it('should return empty history for request with no executions', async () => {
      const created = await service.saveRequest(defaultInput);

      const history = await service.getResponseHistory(created.id);
      expect(history.data.length).toBe(0);
      expect(history.total).toBe(0);
    });

    it('should return empty history for non-existent request', async () => {
      const history = await service.getResponseHistory('non-existent');
      expect(history.data.length).toBe(0);
    });
  });

  // ==================== clearHistory ====================

  describe('clearHistory', () => {
    it('should clear response history for a request', async () => {
      const created = await service.saveRequest(defaultInput);
      await service.executeRequest(created.id);
      await service.executeRequest(created.id);

      await service.clearHistory(created.id);

      const history = await service.getResponseHistory(created.id);
      expect(history.data.length).toBe(0);
    });

    it('should be safe to call on non-existent request', async () => {
      await expect(service.clearHistory('non-existent')).resolves.toBeUndefined();
    });
  });

  // ==================== getStats ====================

  describe('getStats', () => {
    it('should return stats with zero for no requests', async () => {
      const stats = await service.getStats('tenant-1', 'user-1');

      expect(stats.totalRequests).toBe(0);
      expect(stats.totalExecutions).toBe(0);
      expect(stats.avgLatency).toBe(0);
    });

    it('should count requests and executions', async () => {
      const req1 = await service.saveRequest({ ...defaultInput, url: 'https://example.com/a' });
      const req2 = await service.saveRequest({ ...defaultInput, url: 'https://example.com/b' });

      await service.executeRequest(req1.id);
      await service.executeRequest(req1.id);
      await service.executeRequest(req2.id);

      const stats = await service.getStats('tenant-1', 'user-1');
      expect(stats.totalRequests).toBe(2);
      expect(stats.totalExecutions).toBe(3);
      expect(stats.avgLatency).toBeGreaterThanOrEqual(0);
    });

    it('should isolate stats by tenant and user', async () => {
      await service.saveRequest(defaultInput);
      await service.saveRequest({ ...defaultInput, userId: 'user-2' });

      const stats1 = await service.getStats('tenant-1', 'user-1');
      const stats2 = await service.getStats('tenant-1', 'user-2');

      expect(stats1.totalRequests).toBe(1);
      expect(stats2.totalRequests).toBe(1);
    });
  });
});
