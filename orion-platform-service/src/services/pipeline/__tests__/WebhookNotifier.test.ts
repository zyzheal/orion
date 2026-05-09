/**
 * WebhookNotifier Tests
 *
 * 测试 WebhookNotifier 的通知发送、重试机制、HMAC 签名生成和错误处理。
 * 确保 Webhook 失败不会影响 Pipeline 的正常执行状态。
 */

import {
  WebhookNotifier,
  WebhookConfig,
  WebhookPayload,
  generateHmacSignature,
} from '../WebhookNotifier';

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }));
});

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('WebhookNotifier', () => {
  let notifier: WebhookNotifier;

  beforeEach(() => {
    notifier = new WebhookNotifier();
    mockFetch.mockReset();
  });

  // Helper to create a sample webhook config
  function createSampleConfig(override?: Partial<WebhookConfig>): WebhookConfig {
    return {
      url: 'https://example.com/webhook',
      method: 'POST',
      events: ['pipeline.complete', 'pipeline.failed'],
      retries: 3,
      ...override,
    };
  }

  // Helper to create a sample webhook payload
  function createSamplePayload(override?: Partial<WebhookPayload>): WebhookPayload {
    return {
      eventType: 'pipeline.complete',
      runId: 'run-123',
      pipelineId: 'pipeline-main',
      status: 'success',
      timestamp: new Date(),
      durationMs: 30000,
      stagesSummary: [
        { name: 'build', status: 'success', durationMs: 15000 },
        { name: 'test', status: 'success', durationMs: 15000 },
      ],
      ...override,
    };
  }

  describe('sendWebhook', () => {
    it('should send webhook successfully on first attempt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      const config = createSampleConfig();
      const payload = createSamplePayload();

      await expect(notifier.sendWebhook(config, payload)).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe('https://example.com/webhook');
      expect(callArgs[1].method).toBe('POST');
      expect(callArgs[1].headers['Content-Type']).toBe('application/json');
    });

    it('should send webhook with correct payload body', async () => {
      let capturedBody: string | undefined;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      const payload = createSamplePayload({
        eventType: 'pipeline.failed',
        runId: 'run-456',
        status: 'failed',
        durationMs: 5000,
        stagesSummary: [{ name: 'build', status: 'failed', durationMs: 5000 }],
      });

      await notifier.sendWebhook(createSampleConfig(), payload);

      capturedBody = mockFetch.mock.calls[0][1].body;
      const body = JSON.parse(capturedBody!);
      expect(body.eventType).toBe('pipeline.failed');
      expect(body.runId).toBe('run-456');
      expect(body.status).toBe('failed');
      expect(body.durationMs).toBe(5000);
      expect(body.stagesSummary).toHaveLength(1);
    });

    it('should include HMAC signature when secret is provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      const config = createSampleConfig({ secret: 'my-secret-key' });
      const payload = createSamplePayload();

      await notifier.sendWebhook(config, payload);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['X-Webhook-Signature']).toBeDefined();
      expect(headers['X-Webhook-Signature-Algorithm']).toBe('sha256');
    });

    it('should not include signature headers when secret is not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      const config = createSampleConfig(); // no secret
      const payload = createSamplePayload();

      await notifier.sendWebhook(config, payload);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['X-Webhook-Signature']).toBeUndefined();
      expect(headers['X-Webhook-Signature-Algorithm']).toBeUndefined();
    });

    it('should include custom headers from config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      const config = createSampleConfig({
        headers: {
          'X-Custom-Header': 'custom-value',
          'Authorization': 'Bearer token123',
        },
      });
      const payload = createSamplePayload();

      await notifier.sendWebhook(config, payload);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['X-Custom-Header']).toBe('custom-value');
      expect(headers['Authorization']).toBe('Bearer token123');
    });

    it('should use PUT method when configured', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      const config = createSampleConfig({ method: 'PUT' });
      const payload = createSamplePayload();

      await notifier.sendWebhook(config, payload);

      expect(mockFetch.mock.calls[0][1].method).toBe('PUT');
    });

    it('should use PATCH method when configured', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      const config = createSampleConfig({ method: 'PATCH' });
      const payload = createSamplePayload();

      await notifier.sendWebhook(config, payload);

      expect(mockFetch.mock.calls[0][1].method).toBe('PATCH');
    });
  });

  describe('retry on failure', () => {
    it('should retry up to 3 times on failure', async () => {
      // Fail twice, succeed on third attempt
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        });

      // Use fake timers for faster tests
      jest.useFakeTimers();

      const config = createSampleConfig({ retries: 3 });
      const payload = createSamplePayload();

      const promise = notifier.sendWebhook(config, payload);

      // Advance timers to allow retries to complete
      await jest.advanceTimersByTimeAsync(10000);

      await expect(promise).resolves.not.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });

    it('should use default retries (3) when not specified', async () => {
      // Fail all 4 attempts (1 initial + 3 retries)
      mockFetch.mockRejectedValue(new Error('Persistent error'));

      jest.useFakeTimers();

      const config = createSampleConfig(); // retries defaults to 3
      const payload = createSamplePayload();

      const promise = notifier.sendWebhook(config, payload);

      await jest.advanceTimersByTimeAsync(30000);

      await expect(promise).resolves.not.toThrow();
      // 1 initial + 3 retries = 4 total attempts
      expect(mockFetch).toHaveBeenCalledTimes(4);

      jest.useRealTimers();
    });

    it('should not retry when retries is 0', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const config = createSampleConfig({ retries: 0 });
      const payload = createSamplePayload();

      // Should not throw - errors are caught and logged
      await expect(notifier.sendWebhook(config, payload)).resolves.not.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should eventually give up after max retries and log error', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent error'));

      jest.useFakeTimers();

      const config = createSampleConfig({ retries: 2 });
      const payload = createSamplePayload();

      const promise = notifier.sendWebhook(config, payload);

      await jest.advanceTimersByTimeAsync(15000);

      // Should not throw - errors are caught and logged, never affect pipeline
      await expect(promise).resolves.not.toThrow();
      // 1 initial + 2 retries = 3 total attempts
      expect(mockFetch).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });
  });

  describe('HMAC signature generation', () => {
    it('should generate consistent HMAC SHA-256 signatures', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'my-secret';

      const sig1 = generateHmacSignature(secret, payload);
      const sig2 = generateHmacSignature(secret, payload);

      expect(sig1).toBe(sig2);
      expect(sig1).toHaveLength(64); // SHA-256 hex = 64 chars
    });

    it('should generate different signatures for different payloads', () => {
      const secret = 'my-secret';

      const sig1 = generateHmacSignature(secret, JSON.stringify({ test: 'data1' }));
      const sig2 = generateHmacSignature(secret, JSON.stringify({ test: 'data2' }));

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different secrets', () => {
      const payload = JSON.stringify({ test: 'data' });

      const sig1 = generateHmacSignature('secret1', payload);
      const sig2 = generateHmacSignature('secret2', payload);

      expect(sig1).not.toBe(sig2);
    });

    it('should produce valid hex string', () => {
      const signature = generateHmacSignature('secret', JSON.stringify({ test: true }));
      expect(signature).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('error handling - pipeline state protection', () => {
    it('should not throw when webhook URL is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const config = createSampleConfig({ retries: 0 });
      const payload = createSamplePayload();

      // Webhook failure must NOT affect pipeline status
      await expect(notifier.sendWebhook(config, payload)).resolves.not.toThrow();
    });

    it('should not throw when webhook returns 500', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const config = createSampleConfig({ retries: 0 });
      const payload = createSamplePayload();

      await expect(notifier.sendWebhook(config, payload)).resolves.not.toThrow();
    });

    it('should not throw when webhook returns 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const config = createSampleConfig({ retries: 0 });
      const payload = createSamplePayload();

      await expect(notifier.sendWebhook(config, payload)).resolves.not.toThrow();
    });

    it('should not throw when webhook times out', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));

      const config = createSampleConfig({ retries: 0 });
      const payload = createSamplePayload();

      await expect(notifier.sendWebhook(config, payload)).resolves.not.toThrow();
    });

    it('should not throw when response body is invalid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const config = createSampleConfig({ retries: 0 });
      const payload = createSamplePayload();

      await expect(notifier.sendWebhook(config, payload)).resolves.not.toThrow();
    });
  });

  describe('event filtering', () => {
    it('should send webhook when event type is in config events list', () => {
      const config = createSampleConfig({
        events: ['pipeline.complete', 'pipeline.failed'],
      });
      const payload = createSamplePayload({ eventType: 'pipeline.complete' });

      expect(notifier.shouldSend(config, payload)).toBe(true);
    });

    it('should send webhook when config has no events filter (send all)', () => {
      const config = createSampleConfig({ events: undefined });
      const payload = createSamplePayload({ eventType: 'pipeline.cancelled' });

      expect(notifier.shouldSend(config, payload)).toBe(true);
    });

    it('should not send webhook when event type is not in config events list', () => {
      const config = createSampleConfig({
        events: ['pipeline.complete'],
      });
      const payload = createSamplePayload({ eventType: 'pipeline.cancelled' });

      expect(notifier.shouldSend(config, payload)).toBe(false);
    });

    it('should not send webhook when events list is empty', () => {
      const config = createSampleConfig({ events: [] });
      const payload = createSamplePayload({ eventType: 'pipeline.complete' });

      expect(notifier.shouldSend(config, payload)).toBe(false);
    });
  });

  describe('sendAll', () => {
    it('should send to multiple webhook configs in parallel', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      const configs: WebhookConfig[] = [
        createSampleConfig({ url: 'https://hook1.example.com' }),
        createSampleConfig({ url: 'https://hook2.example.com' }),
        createSampleConfig({ url: 'https://hook3.example.com' }),
      ];
      const payload = createSamplePayload();

      await notifier.sendAll(configs, payload);

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not fail if one webhook fails', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) });

      const configs: WebhookConfig[] = [
        createSampleConfig({ url: 'https://hook1.example.com', retries: 0 }),
        createSampleConfig({ url: 'https://hook2.example.com', retries: 0 }),
        createSampleConfig({ url: 'https://hook3.example.com', retries: 0 }),
      ];
      const payload = createSamplePayload();

      await expect(notifier.sendAll(configs, payload)).resolves.not.toThrow();
    });

    it('should skip configs that do not match the event type', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      const configs: WebhookConfig[] = [
        createSampleConfig({ url: 'https://hook1.example.com', events: ['pipeline.complete'] }),
        createSampleConfig({ url: 'https://hook2.example.com', events: ['pipeline.failed'] }),
      ];
      const payload = createSamplePayload({ eventType: 'pipeline.complete' });

      await notifier.sendAll(configs, payload);

      // Only the first config should match 'pipeline.complete'
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toBe('https://hook1.example.com');
    });
  });
});
