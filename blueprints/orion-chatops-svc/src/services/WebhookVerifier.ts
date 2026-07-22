/**
 * IM Webhook 签名验证服务
 *
 * 支持钉钉、飞书、企业微信三种主流 IM 平台的签名验证。
 * - 钉钉: HMAC-SHA256 验证 (signature + timestamp)
 * - 飞书: Challenge 验证 + token 校验
 * - 企业微信: HMAC-SHA256 验证 (msg_signature)
 *
 * 开发/测试环境默认跳过验证（process.env.NODE_ENV !== 'production'）。
 * 可通过环境变量 WEBHOOK_VERIFY=off 显式关闭。
 */

import crypto from 'crypto';

/** 支持的 IM 平台类型 */
export type IMPlatform = 'dingtalk' | 'feishu' | 'wecom';

/** Webhook 验证结果 */
export interface WebhookVerifyResult {
  /** 验证是否通过 */
  valid: boolean;
  /** 识别的平台类型 */
  platform: IMPlatform;
  /** 从签名上下文中提取的用户 ID（如 staffId、open_id、UserID） */
  userId?: string;
  /** 租户 ID（如有） */
  tenantId?: string;
  /** 错误信息（验证失败时） */
  error?: string;
}

/** 飞书 Challenge 响应（用于 URL 验证） */
export interface FeishuChallengeResponse {
  challenge: string;
}

/** 检测请求是否来自飞书 URL 验证（Challenge 请求） */
export function isFeishuChallenge(body: Record<string, unknown>): boolean {
  return typeof body.challenge === 'string' && typeof body.token === 'string';
}

/**
 * WebhookVerifier - 签名验证核心逻辑
 */
export class WebhookVerifier {
  /** 时间戳有效期（5 分钟），防止重放攻击 */
  private static readonly TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

  /**
   * 判断当前环境是否需要执行签名验证
   */
  static shouldVerify(): boolean {
    if (process.env.WEBHOOK_VERIFY === 'off') {
      return false;
    }
    return process.env.NODE_ENV === 'production';
  }

  /**
   * 主验证入口：自动检测平台类型并执行对应验证
   *
   * @param body 请求体
   * @param query 查询参数
   * @param headers 请求头
   */
  static verify(
    body: Record<string, unknown>,
    query: Record<string, string | undefined>,
    headers: Record<string, string | undefined>,
  ): WebhookVerifyResult {
    const platform = this.detectPlatform(body, query, headers);
    if (!platform) {
      return {
        valid: false,
        platform: 'dingtalk', // 默认占位
        error: '无法识别 IM 平台类型，请提供正确的签名参数',
      };
    }

    switch (platform) {
      case 'dingtalk':
        return this.verifyDingTalk(query);
      case 'feishu':
        return this.verifyFeishu(body);
      case 'wecom':
        return this.verifyWeCom(body, query);
      default:
        return { valid: false, platform, error: '不支持的 IM 平台' };
    }
  }

  /**
   * 检测 IM 平台类型
   *
   * 检测优先级：
   * 1. 请求头 X-IM-Platform 显式指定
   * 2. 钉钉：查询参数中有 sign 和 timestamp
   * 3. 飞书：请求体中有 challenge 和 token（URL 验证）或 msg_type
   * 4. 企业微信：查询参数中有 msg_signature
   */
  private static detectPlatform(
    body: Record<string, unknown>,
    query: Record<string, string | undefined>,
    headers: Record<string, string | undefined>,
  ): IMPlatform | null {
    // 1. 显式指定平台
    const headerPlatform = headers['x-im-platform'] ?? headers['X-IM-Platform'];
    if (headerPlatform === 'dingtalk' || headerPlatform === 'feishu' || headerPlatform === 'wecom') {
      return headerPlatform as IMPlatform;
    }

    // 2. 钉钉：query 中有 sign 和 timestamp
    if (query.sign && query.timestamp) {
      return 'dingtalk';
    }

    // 3. 飞书：body 中有 challenge+token 或 msg_type
    if (body.msg_type || (typeof body.challenge === 'string' && typeof body.token === 'string')) {
      return 'feishu';
    }

    // 4. 企业微信：query 中有 msg_signature
    if (query.msg_signature) {
      return 'wecom';
    }

    // 5. 钉钉：body 中有 msgtype（钉钉回调格式）
    if (body.msgtype && (body.senderStaffId || body.senderId)) {
      return 'dingtalk';
    }

    return null;
  }

  // ==================== 钉钉验证 ====================

  /**
   * 钉钉 Webhook 签名验证
   *
   * 钉钉机器人安全设置使用自定义关键词 + 签名（HMAC-SHA256）方式。
   * 签名计算：
   *   1. 把 timestamp + "\n" + signingSecret 作为签名字符串
   *   2. 使用 HMAC-SHA256 算法计算签名
   *   3. 进行 Base64 encode 得到最终签名
   *   4. 对签名进行 URL encode
   *
   * 验证时：收到请求后，用同样的 signingSecret 和 timestamp 重新计算签名进行比对。
   *
   * @param query 查询参数，应包含 sign 和 timestamp
   */
  static verifyDingTalk(query: Record<string, string | undefined>): WebhookVerifyResult {
    const sign = query.sign;
    const timestamp = query.timestamp;

    if (!sign || !timestamp) {
      return {
        valid: false,
        platform: 'dingtalk',
        error: '钉钉签名验证失败：缺少 sign 或 timestamp 参数',
      };
    }

    // 时间戳过期检查
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts)) {
      return {
        valid: false,
        platform: 'dingtalk',
        error: '钉钉签名验证失败：时间戳格式无效',
      };
    }

    // 钉钉 timestamp 是毫秒级
    const now = Date.now();
    const diff = Math.abs(now - ts);
    if (diff > this.TIMESTAMP_TOLERANCE_MS) {
      return {
        valid: false,
        platform: 'dingtalk',
        error: `钉钉签名验证失败：时间戳已过期（偏差 ${Math.round(diff / 1000)}s，允许 ${Math.round(this.TIMESTAMP_TOLERANCE_MS / 1000)}s）`,
      };
    }

    // 获取签名密钥
    const signingSecret = process.env.DINGTALK_WEBHOOK_SECRET;
    if (!signingSecret) {
      return {
        valid: false,
        platform: 'dingtalk',
        error: '钉钉签名验证失败：服务端未配置 DINGTALK_WEBHOOK_SECRET',
      };
    }

    // 重新计算签名
    const stringToSign = `${timestamp}\n${signingSecret}`;
    const hmac = crypto.createHmac('sha256', signingSecret);
    hmac.update(stringToSign);
    const computedSign = encodeURIComponent(hmac.digest('base64'));

    if (computedSign !== sign) {
      return {
        valid: false,
        platform: 'dingtalk',
        error: '钉钉签名验证失败：签名值不匹配',
      };
    }

    return {
      valid: true,
      platform: 'dingtalk',
      userId: 'dingtalk-webhook', // 钉钉机器人回调不携带用户信息
    };
  }

  // ==================== 飞书验证 ====================

  /**
   * 飞书 Webhook 验证
   *
   * 飞书有两种验证场景：
   * 1. URL 验证（Challenge）：飞书在配置事件订阅时会发送 challenge 请求，需原样返回 challenge
   * 2. 事件回调验证：请求体中包含 v2.0 的 token 字段，需校验是否与服务端配置一致
   *
   * @param body 请求体
   */
  static verifyFeishu(body: Record<string, unknown>): WebhookVerifyResult {
    // 场景 1: URL 验证（Challenge 请求）
    if (isFeishuChallenge(body)) {
      const requestToken = body.token as string;
      const expectedToken = process.env.FEISHU_VERIFICATION_TOKEN;

      if (!expectedToken) {
        return {
          valid: false,
          platform: 'feishu',
          error: '飞书验证失败：服务端未配置 FEISHU_VERIFICATION_TOKEN',
        };
      }

      if (requestToken !== expectedToken) {
        return {
          valid: false,
          platform: 'feishu',
          error: '飞书 Challenge 验证失败：token 不匹配',
        };
      }

      return {
        valid: true,
        platform: 'feishu',
        userId: 'feishu-challenge',
      };
    }

    // 场景 2: 事件回调验证（v2.0 事件格式）
    const eventToken = body.token as string | undefined;
    if (eventToken) {
      const expectedToken = process.env.FEISHU_VERIFICATION_TOKEN;
      if (!expectedToken) {
        return {
          valid: false,
          platform: 'feishu',
          error: '飞书验证失败：服务端未配置 FEISHU_VERIFICATION_TOKEN',
        };
      }

      if (eventToken !== expectedToken) {
        return {
          valid: false,
          platform: 'feishu',
          error: '飞书事件回调验证失败：token 不匹配',
        };
      }

      // 从事件中提取用户信息（飞书事件体中的 open_id）
      const event = body.event as Record<string, unknown> | undefined;
      const sender = event?.sender as Record<string, unknown> | undefined;
      const senderId = sender?.sender_id as Record<string, unknown> | undefined;
      const userId =
        (event?.open_id as string) ??
        (senderId?.open_id as string) ??
        'feishu-webhook';

      return {
        valid: true,
        platform: 'feishu',
        userId,
      };
    }

    // 没有 token 字段，视为无效请求
    return {
      valid: false,
      platform: 'feishu',
      error: '飞书验证失败：请求体中缺少 token 字段',
    };
  }

  // ==================== 企业微信验证 ====================

  /**
   * 企业微信 Webhook 签名验证
   *
   * 企业微信回调验证使用 SHA1 签名：
   *   msg_signature = SHA1(sort(Token, timestamp, nonce, encrypt_body))
   *
   * 其中 encrypt_body 是消息体中 msg_encrypt 字段的值（加密消息）
   * 或者直接使用明文 body 进行校验。
   *
   * @param body 请求体
   * @param query 查询参数，应包含 msg_signature、timestamp、nonce
   */
  static verifyWeCom(
    body: Record<string, unknown>,
    query: Record<string, string | undefined>,
  ): WebhookVerifyResult {
    const msgSignature = query.msg_signature;
    const timestamp = query.timestamp;
    const nonce = query.nonce;

    if (!msgSignature || !timestamp || !nonce) {
      return {
        valid: false,
        platform: 'wecom',
        error: '企业微信签名验证失败：缺少 msg_signature、timestamp 或 nonce 参数',
      };
    }

    // 时间戳过期检查
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts)) {
      return {
        valid: false,
        platform: 'wecom',
        error: '企业微信签名验证失败：时间戳格式无效',
      };
    }

    const now = Date.now();
    // 企业微信 timestamp 是秒级
    const diff = Math.abs(now - ts * 1000);
    if (diff > this.TIMESTAMP_TOLERANCE_MS) {
      return {
        valid: false,
        platform: 'wecom',
        error: `企业微信签名验证失败：时间戳已过期（偏差 ${Math.round(diff / 1000)}s，允许 ${Math.round(this.TIMESTAMP_TOLERANCE_MS / 1000)}s）`,
      };
    }

    // 获取 Token
    const token = process.env.WECOM_WEBHOOK_TOKEN;
    if (!token) {
      return {
        valid: false,
        platform: 'wecom',
        error: '企业微信签名验证失败：服务端未配置 WECOM_WEBHOOK_TOKEN',
      };
    }

    // 计算签名：SHA1(sort(Token, timestamp, nonce, msg_body))
    const msgBody = body.msg_encrypt
      ? String(body.msg_encrypt)
      : JSON.stringify(body);
    const sorted = [token, timestamp, nonce, msgBody].sort();
    const rawString = sorted.join('');
    const computedSignature = crypto.createHash('sha1').update(rawString).digest('hex');

    if (computedSignature !== msgSignature) {
      return {
        valid: false,
        platform: 'wecom',
        error: '企业微信签名验证失败：签名值不匹配',
      };
    }

    // 从请求体中提取用户 ID
    const userId =
      (body.FromUserName as string) ??
      (body.userid as string) ??
      'wecom-webhook';

    return {
      valid: true,
      platform: 'wecom',
      userId,
    };
  }
}
