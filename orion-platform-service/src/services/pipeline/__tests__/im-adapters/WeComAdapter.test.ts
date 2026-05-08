/**
 * WeComAdapter Tests
 *
 * 测试企业微信 Webhook 通知适配器的消息格式和错误处理。
 */

import { WeComAdapter } from '../../im-adapters/WeComAdapter';
import { IMNotificationConfig, IMNotificationPayload } from '../IMNotifier';

describe('WeComAdapter', () => {
  let adapter: WeComAdapter;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    adapter = new WeComAdapter();
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createConfig(): IMNotificationConfig {
    return {
      type: 'wecom',
      webhookUrl: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test123',
      name: 'WeCom Test',
    };
  }

  function createPayload(override?: Partial<IMNotificationPayload>): IMNotificationPayload {
    return {
      title: 'Pipeline 完成: test-pipeline',
      content: '### Pipeline 执行成功',
      pipelineName: 'test-pipeline',
      runId: 'run-abc-123',
      status: 'success',
      duration: '2m 30s',
      triggerBy: 'developer-01',
      ...override,
    };
  }

  describe('platformType', () => {
    it('should return wecom', () => {
      expect(adapter.platformType).toBe('wecom');
    });
  });

  describe('send - success scenarios', () => {
    it('should send markdown message with correct format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ errcode: 0, errmsg: 'ok' }),
      });

      await adapter.send(createConfig(), createPayload());

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test123',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.msgtype).toBe('markdown');
      expect(body.markdown.content).toContain('Pipeline 执行成功');
      expect(body.markdown.content).toContain('test-pipeline');
      expect(body.markdown.content).toContain('run-abc-123');
      expect(body.markdown.content).toContain('2m 30s');
      expect(body.markdown.content).toContain('developer-01');
    });

    it('should use blockquote format for fields', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ errcode: 0 }),
      });

      await adapter.send(createConfig(), createPayload());

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      // WeCom uses > prefix for blockquote
      expect(body.markdown.content).toContain('> **Pipeline**:');
      expect(body.markdown.content).toContain('> **Run ID**:');
    });

    it('should include view link with runId', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ errcode: 0 }),
      });

      await adapter.send(createConfig(), createPayload({ runId: 'unique-run-id' }));

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.markdown.content).toContain('#/pipelines/unique-run-id');
    });
  });

  describe('send - status variations', () => {
    it('should use info color for success status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ errcode: 0 }),
      });

      await adapter.send(createConfig(), createPayload({ status: 'success' }));

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.markdown.content).toContain('<font color="info">成功</font>');
    });

    it('should use warning color for failed status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ errcode: 0 }),
      });

      await adapter.send(createConfig(), createPayload({ status: 'failed' }));

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.markdown.content).toContain('<font color="warning">失败</font>');
      expect(body.markdown.content).toContain('执行失败');
    });

    it('should use comment color for cancelled status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ errcode: 0 }),
      });

      await adapter.send(createConfig(), createPayload({ status: 'cancelled' }));

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.markdown.content).toContain('<font color="comment">取消</font>');
      expect(body.markdown.content).toContain('已取消');
    });
  });

  describe('send - error handling', () => {
    it('should throw error on HTTP failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(adapter.send(createConfig(), createPayload())).rejects.toThrow(
        'WeCom webhook returned status 400: Bad Request'
      );
    });

    it('should throw error on non-zero errcode', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ errcode: 93000, errmsg: 'invalid key' }),
      });

      await expect(adapter.send(createConfig(), createPayload())).rejects.toThrow(
        'WeCom API error'
      );
    });

    it('should throw error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('connection refused'));

      await expect(adapter.send(createConfig(), createPayload())).rejects.toThrow(
        'connection refused'
      );
    });
  });
});
