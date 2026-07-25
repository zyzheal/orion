/**
 * WebhookVerifier 单元测试
 *
 * 测试钉钉、飞书、企业微信三种 IM 平台的签名验证逻辑。
 */

import {
  WebhookVerifier,
  isFeishuChallenge,
} from '../WebhookVerifier';
import crypto from 'crypto';

describe('WebhookVerifier', () => {
  // 保存原始环境变量，测试后恢复
  const originalEnv = { ...process.env };

  afterEach(() => {
    // 恢复环境变量
    process.env = { ...originalEnv };
  });

  // ==================== shouldVerify ====================

  describe('shouldVerify', () => {
    it('should skip verification when WEBHOOK_VERIFY=off', () => {
      process.env.WEBHOOK_VERIFY = 'off';
      process.env.NODE_ENV = 'production';
      expect(WebhookVerifier.shouldVerify()).toBe(false);
    });

    it('should verify in production when WEBHOOK_VERIFY is not set', () => {
      delete process.env.WEBHOOK_VERIFY;
      process.env.NODE_ENV = 'production';
      expect(WebhookVerifier.shouldVerify()).toBe(true);
    });

    it('should skip verification in development environment', () => {
      delete process.env.WEBHOOK_VERIFY;
      process.env.NODE_ENV = 'development';
      expect(WebhookVerifier.shouldVerify()).toBe(false);
    });

    it('should skip verification in test environment', () => {
      delete process.env.WEBHOOK_VERIFY;
      process.env.NODE_ENV = 'test';
      expect(WebhookVerifier.shouldVerify()).toBe(false);
    });
  });

  // ==================== isFeishuChallenge ====================

  describe('isFeishuChallenge', () => {
    it('should return true for valid challenge request', () => {
      expect(isFeishuChallenge({ challenge: 'abc123', token: 'xyz' })).toBe(true);
    });

    it('should return false when challenge is missing', () => {
      expect(isFeishuChallenge({ token: 'xyz' })).toBe(false);
    });

    it('should return false when token is missing', () => {
      expect(isFeishuChallenge({ challenge: 'abc123' })).toBe(false);
    });

    it('should return false for regular message body', () => {
      expect(isFeishuChallenge({ text: '/deploy', platform: 'feishu' })).toBe(false);
    });
  });

  // ==================== DingTalk Verification ====================

  describe('verifyDingTalk', () => {
    const SIGNING_SECRET = 'test-dingtalk-secret-123';

    function generateDingTalkSign(timestamp: number, secret: string): string {
      const stringToSign = `${timestamp}\n${secret}`;
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(stringToSign);
      return encodeURIComponent(hmac.digest('base64'));
    }

    it('should pass with valid signature and timestamp', () => {
      process.env.DINGTALK_WEBHOOK_SECRET = SIGNING_SECRET;
      const now = Date.now();
      const sign = generateDingTalkSign(now, SIGNING_SECRET);

      const result = WebhookVerifier.verifyDingTalk({
        sign,
        timestamp: String(now),
      });

      expect(result.valid).toBe(true);
      expect(result.platform).toBe('dingtalk');
      expect(result.userId).toBe('dingtalk-webhook');
    });

    it('should fail when sign parameter is missing', () => {
      const result = WebhookVerifier.verifyDingTalk({
        timestamp: String(Date.now()),
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('缺少 sign 或 timestamp');
    });

    it('should fail when timestamp parameter is missing', () => {
      const result = WebhookVerifier.verifyDingTalk({
        sign: 'abc',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('缺少 sign 或 timestamp');
    });

    it('should fail when timestamp is expired (beyond 5 min tolerance)', () => {
      process.env.DINGTALK_WEBHOOK_SECRET = SIGNING_SECRET;
      const oldTimestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago
      const sign = generateDingTalkSign(oldTimestamp, SIGNING_SECRET);

      const result = WebhookVerifier.verifyDingTalk({
        sign,
        timestamp: String(oldTimestamp),
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('时间戳已过期');
    });

    it('should fail when timestamp format is invalid', () => {
      const result = WebhookVerifier.verifyDingTalk({
        sign: 'abc',
        timestamp: 'not-a-number',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('时间戳格式无效');
    });

    it('should fail when signature does not match', () => {
      process.env.DINGTALK_WEBHOOK_SECRET = SIGNING_SECRET;

      const result = WebhookVerifier.verifyDingTalk({
        sign: 'wrong-signature',
        timestamp: String(Date.now()),
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('签名值不匹配');
    });

    it('should fail when DINGTALK_WEBHOOK_SECRET is not configured', () => {
      delete process.env.DINGTALK_WEBHOOK_SECRET;

      const result = WebhookVerifier.verifyDingTalk({
        sign: 'abc',
        timestamp: String(Date.now()),
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('未配置 DINGTALK_WEBHOOK_SECRET');
    });
  });

  // ==================== Feishu Verification ====================

  describe('verifyFeishu', () => {
    const VERIFICATION_TOKEN = 'test-feishu-token-456';

    it('should pass challenge verification with correct token', () => {
      process.env.FEISHU_VERIFICATION_TOKEN = VERIFICATION_TOKEN;

      const result = WebhookVerifier.verifyFeishu({
        challenge: 'test-challenge-value',
        token: VERIFICATION_TOKEN,
      });

      expect(result.valid).toBe(true);
      expect(result.platform).toBe('feishu');
    });

    it('should fail challenge verification with wrong token', () => {
      process.env.FEISHU_VERIFICATION_TOKEN = VERIFICATION_TOKEN;

      const result = WebhookVerifier.verifyFeishu({
        challenge: 'test-challenge-value',
        token: 'wrong-token',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('token 不匹配');
    });

    it('should fail when FEISHU_VERIFICATION_TOKEN is not configured', () => {
      delete process.env.FEISHU_VERIFICATION_TOKEN;

      const result = WebhookVerifier.verifyFeishu({
        challenge: 'abc',
        token: 'xyz',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('未配置 FEISHU_VERIFICATION_TOKEN');
    });

    it('should pass event callback verification with correct token', () => {
      process.env.FEISHU_VERIFICATION_TOKEN = VERIFICATION_TOKEN;

      const result = WebhookVerifier.verifyFeishu({
        token: VERIFICATION_TOKEN,
        msg_type: 'im.message.receive_v1',
        event: {
          open_id: 'ou_feishu_user_123',
        },
      });

      expect(result.valid).toBe(true);
      expect(result.platform).toBe('feishu');
      expect(result.userId).toBe('ou_feishu_user_123');
    });

    it('should fail event callback with wrong token', () => {
      process.env.FEISHU_VERIFICATION_TOKEN = VERIFICATION_TOKEN;

      const result = WebhookVerifier.verifyFeishu({
        token: 'wrong-event-token',
        msg_type: 'im.message.receive_v1',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('token 不匹配');
    });

    it('should fail when no token field present', () => {
      const result = WebhookVerifier.verifyFeishu({
        msg_type: 'im.message.receive_v1',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('缺少 token 字段');
    });

    it('should extract userId from nested sender structure', () => {
      process.env.FEISHU_VERIFICATION_TOKEN = VERIFICATION_TOKEN;

      const result = WebhookVerifier.verifyFeishu({
        token: VERIFICATION_TOKEN,
        msg_type: 'im.message.receive_v1',
        event: {
          sender: {
            sender_id: {
              open_id: 'ou_nested_user_456',
            },
          },
        },
      });

      expect(result.valid).toBe(true);
      expect(result.userId).toBe('ou_nested_user_456');
    });
  });

  // ==================== WeCom Verification ====================

  describe('verifyWeCom', () => {
    const WECOM_TOKEN = 'test-wecom-token-789';

    function generateWeComSignature(
      token: string,
      timestamp: string,
      nonce: string,
      msgBody: string,
    ): string {
      const sorted = [token, timestamp, nonce, msgBody].sort();
      const rawString = sorted.join('');
      return crypto.createHash('sha1').update(rawString).digest('hex');
    }

    it('should pass with valid signature', () => {
      process.env.WECOM_WEBHOOK_TOKEN = WECOM_TOKEN;
      const timestamp = String(Math.floor(Date.now() / 1000));
      const nonce = 'random-nonce-abc';
      const msgBody = JSON.stringify({ FromUserName: 'wecom_user_001' });
      const msgSignature = generateWeComSignature(WECOM_TOKEN, timestamp, nonce, msgBody);

      const result = WebhookVerifier.verifyWeCom(
        { FromUserName: 'wecom_user_001' },
        { msg_signature: msgSignature, timestamp, nonce },
      );

      expect(result.valid).toBe(true);
      expect(result.platform).toBe('wecom');
      expect(result.userId).toBe('wecom_user_001');
    });

    it('should fail when msg_signature parameter is missing', () => {
      const result = WebhookVerifier.verifyWeCom(
        {},
        { timestamp: '123', nonce: 'abc' },
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('缺少 msg_signature');
    });

    it('should fail when timestamp parameter is missing', () => {
      const result = WebhookVerifier.verifyWeCom(
        {},
        { msg_signature: 'abc', nonce: 'xyz' },
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('缺少 msg_signature');
    });

    it('should fail when nonce parameter is missing', () => {
      const result = WebhookVerifier.verifyWeCom(
        {},
        { msg_signature: 'abc', timestamp: '123' },
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('缺少 msg_signature');
    });

    it('should fail when timestamp is expired', () => {
      process.env.WECOM_WEBHOOK_TOKEN = WECOM_TOKEN;
      const oldTimestamp = String(Math.floor(Date.now() / 1000) - 6 * 60); // 6 min ago
      const nonce = 'random-nonce';
      const msgBody = JSON.stringify({});
      const msgSignature = generateWeComSignature(WECOM_TOKEN, oldTimestamp, nonce, msgBody);

      const result = WebhookVerifier.verifyWeCom(
        {},
        { msg_signature: msgSignature, timestamp: oldTimestamp, nonce },
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('时间戳已过期');
    });

    it('should fail when timestamp format is invalid', () => {
      const result = WebhookVerifier.verifyWeCom(
        {},
        { msg_signature: 'abc', timestamp: 'not-a-number', nonce: 'xyz' },
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('时间戳格式无效');
    });

    it('should fail when signature does not match', () => {
      process.env.WECOM_WEBHOOK_TOKEN = WECOM_TOKEN;

      const result = WebhookVerifier.verifyWeCom(
        {},
        {
          msg_signature: 'wrong-signature',
          timestamp: String(Math.floor(Date.now() / 1000)),
          nonce: 'abc',
        },
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('签名值不匹配');
    });

    it('should fail when WECOM_WEBHOOK_TOKEN is not configured', () => {
      delete process.env.WECOM_WEBHOOK_TOKEN;

      const result = WebhookVerifier.verifyWeCom(
        {},
        {
          msg_signature: 'abc',
          timestamp: String(Math.floor(Date.now() / 1000)),
          nonce: 'xyz',
        },
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('未配置 WECOM_WEBHOOK_TOKEN');
    });
  });

  // ==================== Auto-detect verify ====================

  describe('verify (auto-detect)', () => {
    it('should detect DingTalk from query parameters', () => {
      process.env.DINGTALK_WEBHOOK_SECRET = 'secret';
      const now = Date.now();
      const stringToSign = `${now}\nsecret`;
      const sign = encodeURIComponent(
        crypto.createHmac('sha256', 'secret').update(stringToSign).digest('base64'),
      );

      const result = WebhookVerifier.verify(
        {},
        { sign, timestamp: String(now) },
        {},
      );

      expect(result.valid).toBe(true);
      expect(result.platform).toBe('dingtalk');
    });

    it('should detect Feishu from body token', () => {
      process.env.FEISHU_VERIFICATION_TOKEN = 'feishu-token';

      const result = WebhookVerifier.verify(
        { challenge: 'test', token: 'feishu-token' },
        {},
        {},
      );

      expect(result.valid).toBe(true);
      expect(result.platform).toBe('feishu');
    });

    it('should detect WeCom from msg_signature query param', () => {
      process.env.WECOM_WEBHOOK_TOKEN = 'wecom-token';
      const ts = String(Math.floor(Date.now() / 1000));
      const nonce = 'n';
      const body = JSON.stringify({});
      const sorted = ['wecom-token', ts, nonce, body].sort();
      const msgSignature = crypto.createHash('sha1').update(sorted.join('')).digest('hex');

      const result = WebhookVerifier.verify(
        {},
        { msg_signature: msgSignature, timestamp: ts, nonce },
        {},
      );

      expect(result.valid).toBe(true);
      expect(result.platform).toBe('wecom');
    });

    it('should detect platform from X-IM-Platform header', () => {
      process.env.FEISHU_VERIFICATION_TOKEN = 'feishu-token';

      const result = WebhookVerifier.verify(
        { token: 'feishu-token', msg_type: 'test' },
        {},
        { 'x-im-platform': 'feishu' },
      );

      expect(result.valid).toBe(true);
      expect(result.platform).toBe('feishu');
    });

    it('should return error for unrecognized platform', () => {
      const result = WebhookVerifier.verify(
        { some: 'data' },
        {},
        {},
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('无法识别 IM 平台类型');
    });
  });
});
