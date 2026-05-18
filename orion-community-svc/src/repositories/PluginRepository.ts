import type { Plugin, PluginStatus } from '../types/community';
import type { IDbAdapter } from './IDbAdapter';

export class PluginRepository {
  constructor(private pool: IDbAdapter) {}

  async create(entity: Omit<Plugin, 'id' | 'createdAt' | 'updatedAt' | 'downloadsCount' | 'ratingAvg' | 'ratingCount'>): Promise<Plugin> {
    const result = await this.pool.query(
      `INSERT INTO plugins (contribution_id, name, description, author_id, author_name, version, manifest, download_url, checksum_sha256, status, category, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        entity.contributionId ?? null,
        entity.name,
        entity.description ?? null,
        entity.authorId,
        entity.authorName,
        entity.version,
        JSON.stringify(entity.manifest),
        entity.downloadUrl ?? null,
        entity.checksumSha256 ?? null,
        entity.status,
        entity.category ?? null,
        JSON.stringify(entity.tags ?? []),
      ],
    );
    return this.rowToEntity(result.rows[0]);
  }

  async findById(id: string): Promise<Plugin | null> {
    const result = await this.pool.query('SELECT * FROM plugins WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.rowToEntity(result.rows[0]) : null;
  }

  async findByName(name: string): Promise<Plugin | null> {
    const result = await this.pool.query('SELECT * FROM plugins WHERE name = $1', [name]);
    return result.rows.length > 0 ? this.rowToEntity(result.rows[0]) : null;
  }

  async findByAuthor(authorId: string): Promise<Plugin[]> {
    const result = await this.pool.query(
      'SELECT * FROM plugins WHERE author_id = $1 ORDER BY created_at DESC',
      [authorId],
    );
    return result.rows.map((r) => this.rowToEntity(r));
  }

  async findAll(filters?: { status?: string; category?: string }): Promise<Plugin[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filters?.status) { conditions.push(`status = $${idx++}`); values.push(filters.status); }
    if (filters?.category) { conditions.push(`category = $${idx++}`); values.push(filters.category); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.pool.query(
      `SELECT * FROM plugins ${where} ORDER BY created_at DESC`,
      values,
    );
    return result.rows.map((r) => this.rowToEntity(r));
  }

  async update(id: string, updates: Partial<Plugin>): Promise<Plugin | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.contributionId !== undefined) { fields.push(`contribution_id = $${idx++}`); values.push(updates.contributionId); }
    if (updates.name !== undefined) { fields.push(`name = $${idx++}`); values.push(updates.name); }
    if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description); }
    if (updates.version !== undefined) { fields.push(`version = $${idx++}`); values.push(updates.version); }
    if (updates.manifest !== undefined) { fields.push(`manifest = $${idx++}`); values.push(JSON.stringify(updates.manifest)); }
    if (updates.downloadUrl !== undefined) { fields.push(`download_url = $${idx++}`); values.push(updates.downloadUrl); }
    if (updates.checksumSha256 !== undefined) { fields.push(`checksum_sha256 = $${idx++}`); values.push(updates.checksumSha256); }
    if (updates.status !== undefined) { fields.push(`status = $${idx++}`); values.push(updates.status); }
    if (updates.category !== undefined) { fields.push(`category = $${idx++}`); values.push(updates.category); }
    if (updates.tags !== undefined) { fields.push(`tags = $${idx++}`); values.push(JSON.stringify(updates.tags)); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.pool.query(
      `UPDATE plugins SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return result.rows.length > 0 ? this.rowToEntity(result.rows[0]) : null;
  }

  async updateStatus(id: string, status: PluginStatus): Promise<Plugin | null> {
    const result = await this.pool.query(
      'UPDATE plugins SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id],
    );
    return result.rows.length > 0 ? this.rowToEntity(result.rows[0]) : null;
  }

  async incrementDownloads(id: string): Promise<void> {
    await this.pool.query('UPDATE plugins SET downloads_count = downloads_count + 1 WHERE id = $1', [id]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM plugins WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private rowToEntity(row: Record<string, unknown>): Plugin {
    return {
      id: row.id as string,
      contributionId: row.contribution_id as string | undefined,
      name: row.name as string,
      description: row.description as string | undefined,
      authorId: row.author_id as string,
      authorName: row.author_name as string,
      version: row.version as string,
      manifest: this.parseManifest(row.manifest),
      downloadUrl: row.download_url as string | undefined,
      checksumSha256: row.checksum_sha256 as string | undefined,
      status: row.status as PluginStatus,
      category: row.category as string | undefined,
      tags: this.parseTags(row.tags),
      downloadsCount: Number(row.downloads_count ?? 0),
      ratingAvg: Number(row.rating_avg ?? 0),
      ratingCount: Number(row.rating_count ?? 0),
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at),
    };
  }

  private parseManifest(value: unknown): Record<string, unknown> {
    if (typeof value === 'object' && value !== null) return value as Record<string, unknown>;
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return {}; }
    }
    return {};
  }

  private parseTags(value: unknown): string[] {
    if (Array.isArray(value)) return value as string[];
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return []; }
    }
    return [];
  }

  private toIsoString(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return new Date(value).toISOString();
    return new Date().toISOString();
  }
}
