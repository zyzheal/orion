/**
 * FeishuAdapter Tests
 *
 * 测试飞书 Webhook 通知适配器的消息格式和错误处理。
 */

import { FeishuAdapter } from '../../im-adapters/FeishuAdapter';
import { IMNotificationConfig, IMNotificationPayload } from '../IMNotifier';

describe('FeishuAdapter', () => {
  let adapter: FeishuAdapter;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    adapter = new FeishuAdapter();
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createConfig(): IMNotificationConfig {
    return {
      type: 'feishu',
      webhookUrl: 'https://open.feishu.cn/open-apis/bot/v2/hook/test123',
      name: 'Feishu Test',
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
    it('should return feishu', () => {
      expect(adapter.platformType).toBe('feishu');
    });
  });

  describe('send - success scenarios', () => {
    it('should send interactive card message with correct format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ code: 0, msg: 'success' }),
      });

      await adapter.send(createConfig(), createPayload());

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://open.feishu.cn/open-apis/bot/v2/hook/test123',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.msg_type).toBe('interactive');
      expect(body.card.header.title.content).toBe('Pipeline 完成: test-pipeline');
      expect(body.card.elements[0].text.content).toContain('test-pipeline');
      expect(body.card.elements[0].text.content).toContain('run-abc-123');
      expect(body.card.elements[0].text.content).toContain('2m 30s');
      expect(body.card.elements[0].text.content).toContain('developer-01');
    });

    it('should include action button with runId link', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ code: 0 }),
      });

      await adapter.send(createConfig(), createPayload({ runId: 'unique-run-456' }));

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      const actionElement = body.card.elements.find((el: any) => el.tag === 'action');
      expect(actionElement).toBeDefined();
      expect(actionElement.actions[0].url).toContain('#/pipelines/unique-run-456');
      expect(actionElement.actions[0].text.content).toBe('查看详情');
    });
  });

  describe('send - status variations', () => {
    it('should use green template for success status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ code: 0 }),
      });

      await adapter.send(createConfig(), createPayload({ status: 'success' }));

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.card.header.template).toBe('green');
      expect(body.card.elements[0].text.content).toContain('\u2705');
      expect(body.card.elements[0].text.content).toContain('执行成功');
    });

    it('should use red template for failed status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ code: 0 }),
      });

      await adapter.send(createConfig(), createPayload({ status: 'failed' }));

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.card.header.template).toBe('red');
      expect(body.card.elements[0].text.content).toContain('\u274c');
      expect(body.card.elements[0].text.content).toContain('执行失败');
    });

    it('should use gray template for cancelled status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ code: 0 }),
      });

      await adapter.send(createConfig(), createPayload({ status: 'cancelled' }));

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.card.header.template).toBe('gray');
      expect(body.card.elements[0].text.content).toContain('\u23f9');
      expect(body.card.elements[0].text.content).toContain('已取消');
    });
  });

  describe('send - error handling', () => {
    it('should throw error on HTTP failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
      });

      await expect(adapter.send(createConfig(), createPayload())).rejects.toThrow(
        'Feishu webhook returned status 502: Bad Gateway'
      );
    });

    it('should throw error on non-zero code', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ code: 19001, msg: 'param invalid' }),
      });

      await expect(adapter.send(createConfig(), createPayload())).rejects.toThrow(
        'Feishu API error'
      );
    });

    it('should throw error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('socket hang up'));

      await expect(adapter.send(createConfig(), createPayload())).rejects.toThrow(
        'socket hang up'
      );
    });
  });
});
