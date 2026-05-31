import { BaseRepository } from '../db/base-repository';

export interface SecurityCosignSignatureEntity {
  id: string;
  imageName: string;
  digest: string | null;
  signedAt: Date;
  keyId: string | null;
  verified: boolean;
  tenantId: string | null;
  createdAt: Date;
}

export class SecurityCosignSignatureRepository extends BaseRepository<SecurityCosignSignatureEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'security_cosign_signatures');
  }

  async findByImageName(imageName: string): Promise<SecurityCosignSignatureEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM security_cosign_signatures WHERE image_name = $1 ORDER BY created_at DESC LIMIT 1`,
      [imageName],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): SecurityCosignSignatureEntity {
    return {
      id: row.id,
      imageName: row.image_name,
      digest: row.digest,
      signedAt: row.signed_at,
      keyId: row.key_id,
      verified: row.verified,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
    };
  }
}
