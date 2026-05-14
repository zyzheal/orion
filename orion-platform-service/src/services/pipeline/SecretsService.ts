/**
 * SecretsService - Secret 管理服务
 *
 * 职责：
 * 1. Secret 加密存储（AES-256-GCM）
 * 2. Secret 引用语法解析（${secrets.XXX}）
 * 3. 流式日志遮蔽（自动替换 secret 值为 ***）
 *
 * 安全要求：
 * - Secret 值必须通过 child_process.spawn 的 env 参数传递
 * - 禁止使用 shell: true
 * - 日志遮蔽在流式日志收集时实时完成
 */

import * as crypto from 'crypto';
import { SecretRepository, SecretEntity, SecretScope, SecretCreateInput } from '../../repositories/SecretRepository';
import pino from 'pino';

const logger = pino({ name: 'secrets-service' });

/**
 * Secret 引用语法正则: ${secrets.XXX} 或 ${secrets.XXX:default_value}
 */
const SECRET_REF_PATTERN = /\$\{secrets\.([a-zA-Z_][a-zA-Z0-9_]*)(?::([^}]*))?\}/g;

/**
 * 加密结果（包含 IV 和 auth tag）
 */
interface EncryptedData {
  iv: Buffer;
  ciphertext: Buffer;
  authTag: Buffer;
}

/**
 * SecretsService 配置
 */
export interface SecretsServiceConfig {
  /** AES-256 加密密钥（32 字节 hex 字符串或 32 字节 buffer） */
  encryptionKey?: string;
}

export interface SecretValue {
  id: string;
  name: string;
  value: string;
  scope: SecretScope;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface SecretListItem {
  id: string;
  tenantId: string;
  name: string;
  scope: SecretScope;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  // value 字段不包含在列表响应中（安全考虑）
}

export interface ResolveSecretsResult {
  /** 解析后的环境变量 */
  resolvedEnv: Record<string, string>;
  /** 解析到的 secret 值列表（用于日志遮蔽） */
  resolvedValues: string[];
  /** 未找到的 secret 引用列表 */
  unresolvedRefs: string[];
}

/**
 * 流式日志遮蔽器
 *
 * 在 stdout/stderr 流处理管道中使用，自动将 secret 值替换为 ***
 */
export class StreamSecretSanitizer {
  private secretValues: Set<string>;
  private sortedValues: string[];

  constructor(secretValues: string[]) {
    this.secretValues = new Set(secretValues);
    // 按长度降序排列，优先匹配更长的 secret（防止短 secret 截断长 secret）
    this.sortedValues = [...secretValues].sort((a, b) => b.length - a.length);
  }

  /**
   * 对单行日志进行遮蔽
   */
  sanitize(line: string): string {
    if (this.sortedValues.length === 0) return line;

    let result = line;
    for (const value of this.sortedValues) {
      if (value.length === 0) continue;
      // 使用 split/join 替代 replaceAll 以处理特殊字符
      result = result.split(value).join('***');
    }
    return result;
  }

  /**
   * 对多行日志进行遮蔽
   */
  sanitizeBatch(lines: string[]): string[] {
    if (this.sortedValues.length === 0) return lines;
    return lines.map((line) => this.sanitize(line));
  }
}

export class SecretsService {
  private repository: SecretRepository;
  private encryptionKey: Buffer;

  constructor(repository: SecretRepository, config?: SecretsServiceConfig) {
    this.repository = repository;
    this.encryptionKey = this.deriveEncryptionKey(config?.encryptionKey);
  }

  // ==================== 加密/解密 ====================

  /**
   * 加密 secret 值
   *
   * 使用 AES-256-GCM，每次加密生成随机 IV，结果包含 IV + ciphertext + authTag
   */
  encrypt(plaintext: string): Buffer {
    const iv = crypto.randomBytes(16); // 128-bit IV
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    let ciphertext = cipher.update(plaintext, 'utf8');
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);

    const authTag = cipher.getAuthTag();

    // 存储格式: IV(16) + authTag(16) + ciphertext
    return Buffer.concat([iv, authTag, ciphertext]);
  }

  /**
   * 解密 secret 值
   */
  decrypt(encryptedData: Buffer): string {
    if (encryptedData.length < 33) {
      throw new Error('Invalid encrypted data: too short (need IV + authTag + ciphertext)');
    }

    const iv = encryptedData.subarray(0, 16);
    const authTag = encryptedData.subarray(16, 32);
    const ciphertext = encryptedData.subarray(32);

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext);
    plaintext = Buffer.concat([plaintext, decipher.final()]);

    return plaintext.toString('utf8');
  }

  // ==================== CRUD ====================

  /**
   * 创建 secret
   */
  async createSecret(
    tenantId: string,
    name: string,
    value: string,
    scope: SecretScope = 'project',
    createdBy?: string,
  ): Promise<SecretValue> {
    this.validateSecretName(name);

    const encryptedValue = this.encrypt(value);
    const entity = await this.repository.upsert({
      tenantId,
      name,
      encryptedValue,
      scope,
      createdBy,
    });

    logger.info({ tenantId, name, scope }, 'Secret created/updated');
    return this.toSecretValue(entity);
  }

  /**
   * 获取 secret 值（解密）
   */
  async getSecret(tenantId: string, name: string, scope?: SecretScope): Promise<SecretValue | null> {
    const entity = await this.repository.findByTenantAndName(tenantId, name, scope);
    if (!entity) return null;

    try {
      const value = this.decrypt(entity.encryptedValue);
      return this.toSecretValue({ ...entity, decryptedValue: value } as any);
    } catch (error) {
      logger.error({ tenantId, name, error }, 'Failed to decrypt secret');
      throw new Error(`Failed to decrypt secret "${name}": ${(error as Error).message}`);
    }
  }

  /**
   * 删除 secret
   */
  async deleteSecret(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

  /**
   * 列出 secrets（不包含值）
   */
  async listSecrets(tenantId: string, scope?: SecretScope): Promise<SecretListItem[]> {
    const entities = await this.repository.listByTenantAndScope(tenantId, scope);
    return entities.map((e) => ({
      id: e.id,
      name: e.name,
      scope: e.scope,
      description: e.description || undefined,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      createdBy: e.createdBy,
    }));
  }

  /**
   * Get secret entity (returns metadata, not the value)
   */
  async getSecretEntity(tenantId: string, name: string, scope?: SecretScope): Promise<SecretListItem | null> {
    const secret = await this.getSecret(tenantId, name, scope);
    if (!secret) return null;
    return {
      id: secret.id,
      tenantId: secret.tenantId,
      name: secret.name,
      scope: secret.scope,
      description: secret.description,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
      createdBy: secret.createdBy,
    };
  }

  /**
   * List all secret entities (metadata only)
   */
  async listSecretEntities(tenantId: string, scope?: SecretScope): Promise<SecretListItem[]> {
    const secrets = await this.listSecrets(tenantId, scope);
    return secrets.map(s => ({ ...s, tenantId }));
  }

  /**
   * Get secret entity by ID
   */
  async getSecretEntityById(id: string): Promise<SecretListItem | null> {
    const entity = await this.repository.findById(id);
    if (!entity) return null;
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      scope: entity.scope,
      description: entity.description || undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      createdBy: entity.createdBy,
    };
  }

  /**
   * Update secret value
   */
  async updateSecretValue(id: string, value: string): Promise<boolean> {
    const entity = await this.repository.findById(id);
    if (!entity) return false;

    const encryptedValue = this.encrypt(value);
    await this.repository.update(id, {
      encryptedValue,
      updatedAt: new Date(),
    });
    return true;
  }

  /**
   * Update secret description
   */
  async updateSecretDescription(id: string, description: string): Promise<boolean> {
    const entity = await this.repository.findById(id);
    if (!entity) return false;

    await this.repository.update(id, {
      description,
      updatedAt: new Date(),
    });
    return true;
  }

  /**
   * Delete secret by ID
   */
  async deleteSecretById(id: string): Promise<boolean> {
    return this.deleteSecret(id);
  }

  /**
   * Resolve and replace secrets in parameters
   */
  async resolveAndReplaceSecrets(tenantId: string, parameters: Record<string, string>): Promise<Record<string, string>> {
    const resolved = await this.resolveSecretRefs(tenantId, parameters);
    return resolved.resolvedEnv;
  }

  // ==================== Secret 引用解析 ====================

  /**
   * 从文本中提取所有 ${secrets.XXX} 引用
   */
  static extractSecretRefs(text: string): Array<{ ref: string; name: string; defaultValue?: string }> {
    const refs: Array<{ ref: string; name: string; defaultValue?: string }> = [];
    const regex = new RegExp(SECRET_REF_PATTERN.source, SECRET_REF_PATTERN.flags);
    for (const match of text.matchAll(regex)) {
      refs.push({
        ref: match[0],
        name: match[1],
        defaultValue: match[2],
      });
    }
    return refs;
  }

  /**
   * 解析 task parameters/env 中的 secret 引用
   *
   * 遍历所有字符串值，替换 ${secrets.XXX} 为真实 secret 值
   */
  async resolveSecretRefs(
    tenantId: string,
    envOrParams: Record<string, unknown>,
  ): Promise<ResolveSecretsResult> {
    const resolvedEnv: Record<string, string> = {};
    const resolvedValues: string[] = [];
    const unresolvedRefs: string[] = [];
    const seenRefs = new Set<string>();

    for (const [key, rawValue] of Object.entries(envOrParams)) {
      const value = typeof rawValue === 'string' ? rawValue : String(rawValue);
      const refs = SecretsService.extractSecretRefs(value);

      if (refs.length === 0) {
        resolvedEnv[key] = value;
        continue;
      }

      let resolvedValue = value;
      for (const { ref, name, defaultValue } of refs) {
        if (seenRefs.has(name)) continue;
        seenRefs.add(name);

        try {
          const secret = await this.getSecret(tenantId, name);
          if (secret) {
            resolvedValue = resolvedValue.replace(ref, secret.value);
            resolvedValues.push(secret.value);
          } else if (defaultValue !== undefined) {
            resolvedValue = resolvedValue.replace(ref, defaultValue);
          } else {
            unresolvedRefs.push(name);
            logger.warn({ tenantId, secretName: name }, 'Secret reference not resolved');
          }
        } catch (error) {
          if (defaultValue !== undefined) {
            resolvedValue = resolvedValue.replace(ref, defaultValue);
          } else {
            unresolvedRefs.push(name);
            logger.error({ tenantId, secretName: name, error }, 'Error resolving secret reference');
          }
        }
      }

      resolvedEnv[key] = resolvedValue;
    }

    return { resolvedEnv, resolvedValues, unresolvedRefs };
  }

  /**
   * 为 task 解析 secrets（专门用于 task 执行前）
   *
   * 支持两种格式：
   * 1. env 中的 ${secrets.XXX} 引用
   * 2. parameters.secrets 数组: ["DEPLOY_KEY", "DB_PASSWORD"]
   */
  async resolveTaskSecrets(
    tenantId: string,
    taskParams: Record<string, unknown>,
  ): Promise<{ env: Record<string, string>; secretValues: string[]; unresolved: string[] }> {
    const env = (taskParams.env as Record<string, string>) || {};
    const secretNames = (taskParams.secrets as string[]) || [];

    // 1. 解析 env 中的 ${secrets.XXX} 引用
    const resolved = await this.resolveSecretRefs(tenantId, env);

    // 2. 直接加载 secretNames 列表中的 secret
    for (const name of secretNames) {
      try {
        const secret = await this.getSecret(tenantId, name);
        if (secret) {
          // 将 secret 值添加到环境变量（用 name 作为 key）
          resolved.resolvedEnv[name] = secret.value;
          resolved.resolvedValues.push(secret.value);
        } else {
          resolved.unresolvedRefs.push(name);
        }
      } catch (error) {
        resolved.unresolvedRefs.push(name);
      }
    }

    return {
      env: resolved.resolvedEnv,
      secretValues: resolved.resolvedValues,
      unresolved: resolved.unresolvedRefs,
    };
  }

  // ==================== 日志遮蔽 ====================

  /**
   * 创建日志遮蔽器
   */
  createSanitizer(secretValues: string[]): StreamSecretSanitizer {
    return new StreamSecretSanitizer(secretValues);
  }

  /**
   * 遮蔽单行日志
   */
  static sanitizeLine(line: string, secretValues: string[]): string {
    if (secretValues.length === 0) return line;
    // 按长度降序排列，优先匹配更长的 secret
    const sorted = [...secretValues].sort((a, b) => b.length - a.length);
    let result = line;
    for (const value of sorted) {
      if (value.length === 0) continue;
      result = result.split(value).join('***');
    }
    return result;
  }

  // ==================== 安全校验 ====================

  /**
   * 校验 secret 名称格式
   * 只允许 [a-zA-Z_][a-zA-Z0-9_]*
   */
  private validateSecretName(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new Error('Secret name must be a non-empty string');
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error(
        `Invalid secret name "${name}": must match [a-zA-Z_][a-zA-Z0-9_]*`,
      );
    }
    if (name.length > 255) {
      throw new Error('Secret name must be 255 characters or less');
    }
  }

  /**
   * 派生加密密钥
   *
   * 支持：
   * - 32 字节 hex 字符串（64 个 hex 字符）
   * - 任意长度字符串（通过 SHA-256 派生为 32 字节）
   * - 未配置时使用固定测试密钥（仅开发环境）
   */
  private deriveEncryptionKey(key?: string): Buffer {
    if (!key) {
      // 开发/测试环境 fallback 密钥
      // 生产环境必须设置 ORION_SECRET_ENCRYPTION_KEY
      logger.warn('No encryption key provided, using fallback (INSECURE for production)');
      return crypto.createHash('sha256').update('orion-dev-fallback-key-do-not-use-in-production').digest();
    }

    // 如果是 64 位 hex 字符串，直接作为 32 字节密钥
    if (/^[0-9a-fA-F]{64}$/.test(key)) {
      return Buffer.from(key, 'hex');
    }

    // 否则通过 SHA-256 派生
    return crypto.createHash('sha256').update(key).digest();
  }

  private toSecretValue(entity: any): SecretValue {
    return {
      id: entity.id,
      name: entity.name,
      value: entity.decryptedValue || entity.value || '',
      scope: entity.scope,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      createdBy: entity.createdBy,
    };
  }
}
