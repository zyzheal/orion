/**
 * WebhookKeyRepository - Code Webhook Secret/Key Management (PostgreSQL)
 *
 * Manages webhook secrets for SCM providers (GitHub, GitLab, Bitbucket).
 * Stores secret hashes (not plaintext) for signature validation.
 *
 * Table: webhook_keys
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';
import { getCurrentTenantId } from '../db/tenant-context-storage';
import { encryptValue as hashValue, compareHash } from '../utils/encryption';

export type WebhookProvider = 'github' | 'gitlab' | 'bitbucket';

export interface WebhookKeyEntity {
  id: string;
  tenant_id: string;
  provider: WebhookProvider;
  secret_hash: string;
  is_active: boolean;
  created_at: Date;
  rotated_at: Date | null;
}

export interface WebhookKeyCreateInput {
  provider: WebhookProvider;
  secret: string;
  tenantId?: string;
}

export interface WebhookKeyUpdateInput {
  secret_hash?: string;
  is_active?: boolean;
  rotated_at?: Date;
}

export class WebhookKeyRepository extends BaseRepository<WebhookKeyEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'webhook_keys');
  }

  /**
   * Find webhook key by provider for current tenant
   */
  async findByProvider(provider: WebhookProvider): Promise<WebhookKeyEntity | undefined> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM webhook_keys WHERE tenant_id = $1 AND provider = $2`,
      [tenantId, provider],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * List all webhook keys for current tenant
   */
  async findAllByTenant(tenantId?: string, limit = 100): Promise<WebhookKeyEntity[]> {
    const resolvedTenantId = tenantId || getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM webhook_keys WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [resolvedTenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Create a new webhook key entry
   */
  async createKey(input: WebhookKeyCreateInput): Promise<WebhookKeyEntity> {
    const tenantId = input.tenantId || getCurrentTenantId();
    return this.create({
      id: `wk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      tenant_id: tenantId,
      provider: input.provider,
      secret_hash: hashValue(input.secret),
      is_active: true,
      created_at: new Date(),
      rotated_at: null,
    });
  }

  /**
   * Rotate secret: update hash and rotated_at timestamp
   */
  async rotateSecret(provider: WebhookProvider, newSecret: string): Promise<WebhookKeyEntity | null> {
    const existing = await this.findByProvider(provider);
    if (!existing) {
      throw new OrionError(`Webhook key not found for provider: ${provider}`, ErrorCode.NOT_FOUND);
    }
    return this.update(existing.id, {
      secret_hash: hashValue(newSecret),
      rotated_at: new Date(),
    });
  }

  /**
   * Deactivate (soft delete) a webhook key
   */
  async deactivate(provider: WebhookProvider): Promise<boolean> {
    const existing = await this.findByProvider(provider);
    if (!existing) return false;
    await this.update(existing.id, { is_active: false });
    return true;
  }

  /**
   * Validate a webhook signature against stored hash
   */
  async validateSignature(provider: WebhookProvider, secret: string): Promise<boolean> {
    const existing = await this.findByProvider(provider);
    if (!existing || !existing.is_active) return false;
    return compareHash(secret, existing.secret_hash);
  }

  protected mapRowToEntity(row: any): WebhookKeyEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      provider: row.provider,
      secret_hash: row.secret_hash,
      is_active: row.is_active ?? true,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      rotated_at: row.rotated_at ? new Date(row.rotated_at) : null,
    };
  }
}
