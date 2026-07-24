/**
 * JwtKeyRotationRepository - PostgreSQL data access for JWT key rotation
 *
 * Works with the existing jwt_key_rotation table (migration 071).
 * Provides CRUD operations for JWT signing key management.
 */

export interface JwtKeyEntity {
  id: string;
  keyId: string;
  keyHash: string;
  keyStrength: string;
  status: 'pending' | 'active' | 'expiring' | 'expired';
  createdAt: Date;
  activatedAt: Date | null;
  expiresAt: Date | null;
  rotationTrigger: string;
  metadata: Record<string, unknown>;
}

export interface CreateJwtKeyInput {
  keyId: string;
  keyHash: string;
  keyStrength: string;
  status: 'pending' | 'active' | 'expiring' | 'expired';
  rotationTrigger?: string;
}

export interface UpdateJwtKeyInput {
  status?: string;
  activatedAt?: Date | null;
  expiresAt?: Date | null;
}

import { DatabaseError } from '../errors';

export class JwtKeyRotationRepository {
  constructor(
    private db: {
      query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
    },
  ) {}

  /** Find a key by its key_id */
  async findByKeyId(keyId: string): Promise<JwtKeyEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM jwt_key_rotation WHERE key_id = $1`,
      [keyId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /** Find all keys with given statuses */
  async findByStatuses(statuses: string[]): Promise<JwtKeyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM jwt_key_rotation WHERE status = ANY($1) ORDER BY created_at DESC`,
      [statuses],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /** Find the current active key */
  async findActiveKey(): Promise<JwtKeyEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM jwt_key_rotation WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`,
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /** Find keys that are expiring (overlap period) */
  async findExpiringKeys(): Promise<JwtKeyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM jwt_key_rotation WHERE status = 'expiring' ORDER BY created_at DESC`,
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /** Create a new JWT key */
  async create(input: CreateJwtKeyInput): Promise<JwtKeyEntity> {
    const result = await this.db.query(
      `INSERT INTO jwt_key_rotation (key_id, key_hash, key_strength, status, rotation_trigger)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.keyId, input.keyHash, input.keyStrength, input.status, input.rotationTrigger || 'scheduled'],
    );
    if (result.rows.length === 0) {
      throw new DatabaseError('INSERT into jwt_key_rotation');
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /** Update a JWT key by key_id */
  async updateByKeyId(keyId: string, input: UpdateJwtKeyInput): Promise<JwtKeyEntity | undefined> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.activatedAt !== undefined) {
      setClauses.push(`activated_at = $${paramIndex++}`);
      values.push(input.activatedAt);
    }
    if (input.expiresAt !== undefined) {
      setClauses.push(`expires_at = $${paramIndex++}`);
      values.push(input.expiresAt);
    }

    if (setClauses.length === 0) {
      return this.findByKeyId(keyId);
    }

    values.push(keyId);
    const result = await this.db.query(
      `UPDATE jwt_key_rotation SET ${setClauses.join(', ')} WHERE key_id = $${paramIndex} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /** Delete a key by key_id */
  async deleteByKeyId(keyId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM jwt_key_rotation WHERE key_id = $1`,
      [keyId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** List all keys ordered by creation date */
  async findAll(): Promise<JwtKeyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM jwt_key_rotation ORDER BY created_at DESC`,
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  /** Alias for findAll - used by JwtKeyRotationService */
  async listKeys(): Promise<JwtKeyEntity[]> {
    return this.findAll();
  }

  protected mapRowToEntity(row: any): JwtKeyEntity {
    return {
      id: String(row.id),
      keyId: row.key_id,
      keyHash: row.key_hash,
      keyStrength: row.key_strength,
      status: row.status,
      createdAt: row.created_at,
      activatedAt: row.activated_at,
      expiresAt: row.expires_at,
      rotationTrigger: row.rotation_trigger,
      metadata: row.metadata ?? {},
    };
  }
}
