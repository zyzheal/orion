/**
 * Platform Config Service — IM 平台 Webhook 配置管理
 *
 * 功能:
 * 1. 获取用户配置的所有平台
 * 2. 更新单个平台配置
 * 3. 批量更新配置
 *
 * S-1: token/webhook 存储前使用 AES-256-GCM 加密（生产环境）
 *      加密格式: ENC:<hex_iv>:<hex_ciphertext>:<hex_authTag>
 *      需要环境变量 CHATOPS_ENCRYPTION_KEY (64 hex chars = 32 bytes = 256 bit)
 */

import { ChatOpsPlatformConfigRepository, ChatOpsPlatformConfigEntity } from '../../repositories/ChatOpsRepository';
import { DatabasePool } from '../database';
import { OrionError, ErrorCode } from '../../errors';
import { createLogger } from '../../utils/logger';
import crypto from 'crypto';

const logger = createLogger('PlatformConfigService');

/** AES-256-GCM 加密: 输出格式 ENC:<hex_iv>:<hex_ciphertext>:<hex_authTag> */
function encryptValue(value: string): string {
  if (!value || value.startsWith('ENC:')) return value;

  try {
    // 从环境变量获取 32 字节 (256 bit) 密钥
    const keyHex = process.env.CHATOPS_ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
      // 降级为 Base64 保护（生产环境必须设置 CHATOPS_ENCRYPTION_KEY）
      logger.warn('CHATOPS_ENCRYPTION_KEY not set or invalid length; falling back to Base64 encoding');
      return `ENC:${Buffer.from(value).toString('base64')}`;
    }

    const key = Buffer.from(keyHex, 'hex');
    const iv = crypto.randomBytes(12); // GCM 推荐 96-bit nonce
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(value, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    // 格式: ENC:<hex_iv>:<hex_ciphertext>:<hex_authTag>
    return `ENC:${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
  } catch (err) {
    logger.warn({ err }, 'AES-256-GCM encryption failed, falling back to Base64');
    return `ENC:${Buffer.from(value).toString('base64')}`;
  }
}

/** 解密函数（兼容新旧两种格式） */
function decryptValue(value: string): string {
  if (!value || !value.startsWith('ENC:')) return value;

  try {
    const parts = value.slice(4).split(':');

    // 新格式 AES-256-GCM: ENC:<hex_iv>:<hex_ciphertext>:<hex_authTag> (3 parts)
    if (parts.length === 3) {
      const [ivHex, ciphertextHex, authTagHex] = parts;

      const keyHex = process.env.CHATOPS_ENCRYPTION_KEY;
      if (!keyHex || keyHex.length !== 64) {
        throw new OrionError('CHATOPS_ENCRYPTION_KEY not set for AES-256-GCM decryption', ErrorCode.INTERNAL_ERROR);
      }

      const key = Buffer.from(keyHex, 'hex');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertextHex, 'hex', 'utf-8');
      decrypted += decipher.final('utf-8');
      return decrypted;
    }

    // 旧格式 Base64: ENC:<base64_data> (1 part)
    if (parts.length === 1) {
      return Buffer.from(parts[0], 'base64').toString('utf-8');
    }

    return value;
  } catch (err) {
    logger.warn({ err }, 'Decryption failed, returning raw value');
    return value;
  }
}

/** 验证 webhook URL 格式 */
function validateWebhook(webhook: string, platform: string): boolean {
  if (!webhook) return true; // 空值允许
  try {
    const url = new URL(webhook);
    // 验证平台特定域名
    const platformDomains: Record<string, string[]> = {
      dingtalk: ['oapi.dingtalk.com', 'api.dingtalk.com'],
      wecom: ['qyapi.weixin.qq.com'],
      feishu: ['open.feishu.cn', 'open.larksuite.com'],
      slack: ['hooks.slack.com', 'slack.com'],
    };
    const allowed = platformDomains[platform] || [];
    return allowed.some(d => url.hostname.includes(d)) || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface PlatformConfig {
  platform: string;
  enabled: boolean;
  webhook: string;
  token: string;
}

export class PlatformConfigService {
  private repo: ChatOpsPlatformConfigRepository;
  constructor(private pool: DatabasePool) {
    this.repo = new ChatOpsPlatformConfigRepository(this.pool);
  }

  async getByUserId(userId: string): Promise<PlatformConfig[]> {
    const entities = await this.repo.findByUserId(userId);
    return entities.map(e => this.entityToConfig(e));
  }

  async update(userId: string, config: PlatformConfig): Promise<PlatformConfig> {
    // 验证 webhook URL 格式
    if (config.webhook && !validateWebhook(config.webhook, config.platform)) {
      throw new OrionError(`Invalid webhook URL for platform ${config.platform}`, 'VALIDATION_ERROR')
    }
    // S-1: 存储前 AES-256-GCM 加密敏感字段
    const entity = await this.repo.upsert({
      userId,
      platform: config.platform,
      enabled: config.enabled,
      webhook: encryptValue(config.webhook),
      token: encryptValue(config.token),
    });
    return this.entityToConfig(entity);
  }

  async batchUpdate(userId: string, configs: PlatformConfig[]): Promise<PlatformConfig[]> {
    // R-1: 使用事务保证批量更新一致性
    return this.pool.transaction(async (client) => {
      const results: PlatformConfig[] = [];
      for (const config of configs) {
        // 验证 webhook URL 格式
        if (config.webhook && !validateWebhook(config.webhook, config.platform)) {
          throw new OrionError(`Invalid webhook URL for platform ${config.platform}`, 'VALIDATION_ERROR')
        }
        // 在事务内直接执行 upsert
        const result = await client.query(
          `INSERT INTO chatops_platform_configs (user_id, platform, enabled, webhook, token)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, platform) DO UPDATE SET
             enabled = $3, webhook = $4, token = $5, updated_at = NOW()
           RETURNING *`,
          [userId, config.platform, config.enabled, encryptValue(config.webhook), encryptValue(config.token)],
        );
        if (result.rows.length > 0) {
          results.push(this.rowToConfig(result.rows[0]));
        }
      }
      return results;
    });
  }

  private entityToConfig(entity: ChatOpsPlatformConfigEntity): PlatformConfig {
    return {
      platform: entity.platform,
      enabled: entity.enabled,
      webhook: decryptValue(entity.webhook),
      token: decryptValue(entity.token),
    };
  }

  private rowToConfig(row: any): PlatformConfig {
    return {
      platform: row.platform,
      enabled: row.enabled,
      webhook: decryptValue(row.webhook || ''),
      token: decryptValue(row.token || ''),
    };
  }
}
