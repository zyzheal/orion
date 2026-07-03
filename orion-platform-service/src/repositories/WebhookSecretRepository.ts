import { BaseRepository } from '../db/base-repository';
import { getCurrentTenantId } from '../db/tenant-context-storage';
import { decryptValue, encryptValue } from '../utils/encryption';

export interface WebhookSecretEntity {
  id: string;
  repo_id: string;
  secret: string;
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
}

export class WebhookSecretRepository extends BaseRepository<WebhookSecretEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'webhook_secrets');
  }

  async findByRepoId(repoId: string): Promise<WebhookSecretEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM webhook_secrets WHERE repo_id = $1`,
      [repoId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<WebhookSecretEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM webhook_secrets WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async upsertByRepoId(repoId: string, secret: string, tenantId?: string): Promise<WebhookSecretEntity> {
    const existing = await this.findByRepoId(repoId);
    if (existing) {
      return this.update(existing.id, { secret: encryptValue(secret) });
    }
    return this.create({
      id: `ws-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      repo_id: repoId,
      secret: encryptValue(secret),
      tenant_id: tenantId || getCurrentTenantId(),
    });
  }

  protected mapRowToEntity(row: any): WebhookSecretEntity {
    return {
      id: row.id,
      repo_id: row.repo_id,
      secret: decryptValue(row.secret),
      tenant_id: row.tenant_id,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
