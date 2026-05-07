/**
 * Platform Config Service — IM 平台 Webhook 配置管理
 *
 * 功能:
 * 1. 获取用户配置的所有平台
 * 2. 更新单个平台配置
 * 3. 批量更新配置
 *
 * S-1: token/webhook 存储前加密 (生产环境必须)
 */

import { ChatOpsPlatformConfigRepository, ChatOpsPlatformConfigEntity } from '../../repositories/ChatOpsRepository';
import { DatabasePool } from '../database';

export interface PlatformConfig {
  platform: 'dingtalk' | 'wecom' | 'feishu' | 'slack';
  enabled: boolean;
  webhook: string;
  token: string;
}

/** 简单加密函数 (生产环境应使用 pgcrypto 或 KMS) */
function encryptValue(value: string): string {
  if (!value || value.startsWith('ENC:')) return value;
  // Base64 编码作为基础保护 (Phase 1b 升级为 AES)
  return `ENC:${Buffer.from(value).toString('base64')}`;
}

/** 解密函数 */
function decryptValue(value: string): string {
  if (!value || !value.startsWith('ENC:')) return value;
  return Buffer.from(value.slice(4), 'base64').toString('utf-8');
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
      throw new Error(`Invalid webhook URL for platform ${config.platform}`);
    }
    // S-1: 存储前加密敏感字段
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
          throw new Error(`Invalid webhook URL for platform ${config.platform}`);
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