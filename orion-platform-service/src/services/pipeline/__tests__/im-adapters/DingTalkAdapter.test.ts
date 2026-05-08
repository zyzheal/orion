/**
 * DingTalkAdapter Tests
 *
 * 测试钉钉 Webhook 通知适配器的消息格式和错误处理。
 */

import { DingTalkAdapter } from '../../im-adapters/DingTalkAdapter';
import { IMNotificationConfig, IMNotificationPayload } from '../IMNotifier';

describe('DingTalkAdapter', () => {
  let adapter: DingTalkAdapter;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    adapter = new DingTalkAdapter();
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createConfig(): IMNotificationConfig {
    return {
      type: 'dingtalk',
      webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=test123',
      name: 'DingTalk Test',
    };
  }

  function createPayload(override?: Partial<IMNotificationPayload>): IMNotificationPayload {
    return {
      title: 'Pipeline 完成: test-pipeline',
      content: '### Pipeline 执行成功\n\n**Pipeline**: test-pipeline',
      pipelineName: 'test-pipeline',
      runId: 'run-abc-123',
      status: 'success',
      duration: '2m 30s',
      triggerBy: 'developer-01',
      ...override,
    };
  }

  describe('platformType', () => {
    it('should return dingtalk', () => {
      expect(adapter.platformType).toBe('dingtalk');
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
        'https://oapi.dingtalk.com/robot/send?access_token=test123',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.msgtype).toBe('markdown');
      expect(body.markdown.title).toBe('Pipeline 完成: test-pipeline');
      expect(body.markdown.text).toContain('Pipeline 执行成功');
      expect(body.markdown.text).toContain('test-pipeline');
      expect(body.markdown.text).toContain('run-abc-123');
      expect(body.markdown.text).toContain('2m 30s');
      expect(body.markdown.text).toContain('developer-01');
    });

    it('should include duration when provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ errcode: 0 }),
      });

      await adapter.send(createConfig(), createPayload({ duration: '5m 10s' }));

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.markdown.text).toContain('5m 10s');
    });

    it('should omit triggerBy when not provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ errcode: 0 }),
      });

      await adapter.send(createConfig(), createPayload({ triggerBy: undefined }));

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.markdown.text).not.toContain('触发人');
    });

    it('should include view link with runId', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ errcode: 0 }),
      });

      await adapter.send(createConfig(), createPayload({ runId: 'unique-run-id' }));

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.markdown.text).toContain('#/pipelines/unique-run-id');
    });
  });

  describe('send - status variations', () => {
    it('should use success emoji for success status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ errcode: 0 }),
      });

      await adapter.send(createConfig(), createPayload({ status: 'success' }));

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.markdown.text).toContain('\u2705');
    });

    it('should use cross mark emoji for failed status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ errcode: 0 }),
      });

      await adapter.send(createConfig(), createPayload({ status: 'failed' }));

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.markdown.text).toContain('\u274c');
      expect(body.markdown.text).toContain('执行失败');
    });

    it('should use stop button emoji for cancelled status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ errcode: 0 }),
      });

      await adapter.send(createConfig(), createPayload({ status: 'cancelled' }));

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.markdown.text).toContain('\u23f9');
      expect(body.markdown.text).toContain('已取消');
    });
  });

  describe('send - error handling', () => {
    it('should throw error on HTTP failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(adapter.send(createConfig(), createPayload())).rejects.toThrow(
        'DingTalk webhook returned status 500: Internal Server Error'
      );
    });

    it('should throw error on non-zero errcode', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ errcode: 310000, errmsg: 'not in all' }),
      });

      await expect(adapter.send(createConfig(), createPayload())).rejects.toThrow(
        'DingTalk API error'
      );
    });

    it('should throw error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('network error'));

      await expect(adapter.send(createConfig(), createPayload())).rejects.toThrow(
        'network error'
      );
    });
  });
});
