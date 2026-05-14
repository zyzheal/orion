/**
 * ApiContractRepository - PostgreSQL Repository for API Contracts
 */

import { DatabasePool } from '../services/database';
import { BaseRepository } from '../db/base-repository';

export interface ApiContractEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  endpoint: string;
  method: string;
  schema: Record<string, unknown>;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiContractViolationEntity {
  id: string;
  contractId: string;
  violationType: string;
  description: string;
  severity: string;
  detectedAt: Date;
  sampleData: Record<string, unknown> | null;
}

export interface CreateContractInput {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  endpoint: string;
  method: string;
  schema: Record<string, unknown>;
  version?: string;
}

export interface UpdateContractInput {
  name?: string;
  description?: string;
  endpoint?: string;
  method?: string;
  schema?: Record<string, unknown>;
  version?: string;
}

export class ApiContractRepository extends BaseRepository<ApiContractEntity> {
  constructor(db: DatabasePool) {
    super(db, 'api_contracts');
  }

  async findByTenant(tenantId: string): Promise<ApiContractEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM api_contracts WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByEndpoint(endpoint: string, tenantId: string): Promise<ApiContractEntity | null> {
    const result = await this.db.query(
      `SELECT * FROM api_contracts WHERE endpoint = $1 AND tenant_id = $2`,
      [endpoint, tenantId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async createContract(input: CreateContractInput): Promise<ApiContractEntity> {
    const result = await this.db.query(
      `INSERT INTO api_contracts (id, tenant_id, name, description, endpoint, method, schema, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        input.id,
        input.tenantId,
        input.name,
        input.description || null,
        input.endpoint,
        input.method,
        JSON.stringify(input.schema),
        input.version || '1.0.0',
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateContract(id: string, input: UpdateContractInput): Promise<ApiContractEntity | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      sets.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      sets.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.endpoint !== undefined) {
      sets.push(`endpoint = $${paramIndex++}`);
      values.push(input.endpoint);
    }
    if (input.method !== undefined) {
      sets.push(`method = $${paramIndex++}`);
      values.push(input.method);
    }
    if (input.schema !== undefined) {
      sets.push(`schema = $${paramIndex++}`);
      values.push(JSON.stringify(input.schema));
    }
    if (input.version !== undefined) {
      sets.push(`version = $${paramIndex++}`);
      values.push(input.version);
    }

    values.push(id);
    const result = await this.db.query(
      `UPDATE api_contracts SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteContract(id: string): Promise<boolean> {
    const result = await this.db.query(`DELETE FROM api_contracts WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): ApiContractEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      endpoint: row.endpoint,
      method: row.method,
      schema: row.schema || {},
      version: row.version,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}

export class ApiContractViolationRepository extends BaseRepository<ApiContractViolationEntity> {
  constructor(db: DatabasePool) {
    super(db, 'api_contract_violations');
  }

  async findByContract(contractId: string): Promise<ApiContractViolationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM api_contract_violations WHERE contract_id = $1 ORDER BY detected_at DESC`,
      [contractId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async createViolation(input: Omit<ApiContractViolationEntity, 'id' | 'detectedAt'> & { id?: string }): Promise<ApiContractViolationEntity> {
    const id = input.id || crypto.randomUUID();
    const result = await this.db.query(
      `INSERT INTO api_contract_violations (id, contract_id, violation_type, description, severity, sample_data)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        id,
        input.contractId,
        input.violationType,
        input.description,
        input.severity,
        input.sampleData ? JSON.stringify(input.sampleData) : null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteByContract(contractId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM api_contract_violations WHERE contract_id = $1`,
      [contractId],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): ApiContractViolationEntity {
    return {
      id: row.id,
      contractId: row.contract_id,
      violationType: row.violation_type,
      description: row.description,
      severity: row.severity,
      detectedAt: row.detected_at ? new Date(row.detected_at) : new Date(),
      sampleData: row.sample_data,
    };
  }
}