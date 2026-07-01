/**
 * ApiGovernanceRepository — PostgreSQL data access for API governance entities
 *
 * Covers 5 tables:
 * - api_contracts
 * - api_contract_violations
 * - api_versions
 * - governance_rules
 * - api_verification_history
 */

import { getCurrentTenantId } from '../db/tenant-context-storage';
import { OrionError, ErrorCode } from '../errors';

// ==================== Entity Interfaces ====================

export interface ApiContractEntity {
  id: string;
  tenant_id: string;
  api_name: string;
  version: string;
  method: string;
  path: string;
  request_schema: Record<string, unknown>;
  response_schema: Record<string, unknown>;
  status: 'active' | 'deprecated' | 'retired';
  deprecation_date: string | null;
  retirement_date: string | null;
  replacement_version: string | null;
  created_at: Date;
}

export interface ApiContractViolationEntity {
  id: string;
  contract_id: string;
  tenant_id: string;
  violation_type: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  detected_at: Date;
}

export interface ApiVersionEntity {
  id: string;
  tenant_id: string;
  api_name: string;
  version: string;
  status: 'active' | 'deprecated' | 'retired';
  registered_at: Date;
  deprecation_date: string | null;
  retirement_date: string | null;
  replacement_version: string | null;
  changelog: string | null;
}

export interface GovernanceRuleEntity {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  type: string;
  enabled: boolean;
  created_at: Date;
}

export interface ApiVerificationHistoryEntity {
  id: string;
  contract_id: string;
  tenant_id: string;
  passed: boolean;
  violations: string[];
  endpoint: string;
  method: string;
  verified_at: Date;
}

// ==================== Input Interfaces ====================

export interface CreateApiContractInput {
  apiName: string;
  version: string;
  method: string;
  path: string;
  requestSchema: Record<string, unknown>;
  responseSchema: Record<string, unknown>;
  tenantId?: string;
}

export interface CreateApiContractViolationInput {
  contractId: string;
  violationType: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  detectedAt?: Date;
  tenantId?: string;
}

export interface CreateApiVersionInput {
  apiName: string;
  version: string;
  status?: string;
  replacementVersion?: string;
  changelog?: string;
  tenantId?: string;
}

export interface CreateGovernanceRuleInput {
  name: string;
  description: string;
  type: string;
  enabled?: boolean;
  tenantId?: string;
}

export interface CreateVerificationInput {
  contractId: string;
  passed: boolean;
  violations: string[];
  endpoint: string;
  method: string;
  verifiedAt?: Date;
  tenantId?: string;
}

// ==================== Repository ====================

export class ApiGovernanceRepository {
  private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.db = db;
  }

  private getTenantId(override?: string): string {
    return override || getCurrentTenantId();
  }

  // ==================== API Contracts ====================

  async createContract(input: CreateApiContractInput): Promise<ApiContractEntity> {
    const tenantId = this.getTenantId(input.tenantId);
    const id = `contract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query(
      `INSERT INTO api_contracts
       (id, tenant_id, api_name, version, method, path, request_schema, response_schema, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [id, tenantId, input.apiName, input.version, input.method, input.path, JSON.stringify(input.requestSchema), JSON.stringify(input.responseSchema), 'active', new Date()]
    );
    return this.mapContractRow(result.rows[0]);
  }

  async findContractById(id: string, tenantId?: string): Promise<ApiContractEntity | undefined> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `SELECT * FROM api_contracts WHERE id = $1 AND tenant_id = $2`,
      [id, tId]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapContractRow(result.rows[0]);
  }

  async findAllContracts(tenantId?: string, filters?: { apiName?: string; status?: string }): Promise<ApiContractEntity[]> {
    const tId = this.getTenantId(tenantId);
    let query = `SELECT * FROM api_contracts WHERE tenant_id = $1`;
    const params: unknown[] = [tId];
    let idx = 2;

    if (filters?.apiName) {
      query += ` AND api_name = $${idx}`;
      params.push(filters.apiName);
      idx++;
    }
    if (filters?.status) {
      query += ` AND status = $${idx}`;
      params.push(filters.status);
      idx++;
    }

    query += ' ORDER BY created_at DESC';
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapContractRow(row));
  }

  async updateContract(
    id: string,
    updates: { status?: string; deprecationDate?: string; retirementDate?: string; replacementVersion?: string },
    tenantId?: string
  ): Promise<ApiContractEntity | undefined> {
    const tId = this.getTenantId(tenantId);
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.status !== undefined) { sets.push(`status = $${idx}`); params.push(updates.status); idx++; }
    if (updates.deprecationDate !== undefined) { sets.push(`deprecation_date = $${idx}`); params.push(updates.deprecationDate); idx++; }
    if (updates.retirementDate !== undefined) { sets.push(`retirement_date = $${idx}`); params.push(updates.retirementDate); idx++; }
    if (updates.replacementVersion !== undefined) { sets.push(`replacement_version = $${idx}`); params.push(updates.replacementVersion); idx++; }

    if (sets.length === 0) return this.findContractById(id, tId);

    params.push(id, tId);
    const result = await this.db.query(
      `UPDATE api_contracts SET ${sets.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1} RETURNING *`,
      params
    );
    if (result.rows.length === 0) return undefined;
    return this.mapContractRow(result.rows[0]);
  }

  // ==================== Violations ====================

  async createViolation(input: CreateApiContractViolationInput): Promise<ApiContractViolationEntity> {
    const tenantId = this.getTenantId(input.tenantId);
    const id = `viol-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const result = await this.db.query(
      `INSERT INTO api_contract_violations (id, contract_id, tenant_id, violation_type, description, severity, detected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, input.contractId, tenantId, input.violationType, input.description, input.severity, input.detectedAt || new Date()]
    );
    return this.mapViolationRow(result.rows[0]);
  }

  async findViolations(tenantId?: string, filters?: { contractId?: string; severity?: string }): Promise<ApiContractViolationEntity[]> {
    const tId = this.getTenantId(tenantId);
    let query = `SELECT * FROM api_contract_violations WHERE tenant_id = $1`;
    const params: unknown[] = [tId];
    let idx = 2;

    if (filters?.contractId) {
      query += ` AND contract_id = $${idx}`;
      params.push(filters.contractId);
      idx++;
    }
    if (filters?.severity) {
      query += ` AND severity = $${idx}`;
      params.push(filters.severity);
      idx++;
    }

    query += ' ORDER BY detected_at DESC';
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapViolationRow(row));
  }

  // ==================== API Versions ====================

  async createApiVersion(input: CreateApiVersionInput): Promise<ApiVersionEntity> {
    const tenantId = this.getTenantId(input.tenantId);
    const id = `apiver-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const result = await this.db.query(
      `INSERT INTO api_versions
       (id, tenant_id, api_name, version, status, registered_at, deprecation_date, retirement_date, replacement_version, changelog)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        id, tenantId, input.apiName, input.version,
        input.status || 'active', new Date(),
        null, null,
        input.replacementVersion || null,
        input.changelog || null
      ]
    );
    return this.mapVersionRow(result.rows[0]);
  }

  async findApiVersionById(id: string, tenantId?: string): Promise<ApiVersionEntity | undefined> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `SELECT * FROM api_versions WHERE id = $1 AND tenant_id = $2`,
      [id, tId]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapVersionRow(result.rows[0]);
  }

  async findAllApiVersions(tenantId?: string, filters?: { apiName?: string; status?: string }): Promise<ApiVersionEntity[]> {
    const tId = this.getTenantId(tenantId);
    let query = `SELECT * FROM api_versions WHERE tenant_id = $1`;
    const params: unknown[] = [tId];
    let idx = 2;

    if (filters?.apiName) {
      query += ` AND api_name = $${idx}`;
      params.push(filters.apiName);
      idx++;
    }
    if (filters?.status) {
      query += ` AND status = $${idx}`;
      params.push(filters.status);
      idx++;
    }

    query += ' ORDER BY registered_at DESC';
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapVersionRow(row));
  }

  async updateApiVersion(
    id: string,
    updates: { status?: string; deprecationDate?: string; retirementDate?: string; replacementVersion?: string; changelog?: string },
    tenantId?: string
  ): Promise<ApiVersionEntity | undefined> {
    const tId = this.getTenantId(tenantId);
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.status !== undefined) { sets.push(`status = $${idx}`); params.push(updates.status); idx++; }
    if (updates.deprecationDate !== undefined) { sets.push(`deprecation_date = $${idx}`); params.push(updates.deprecationDate); idx++; }
    if (updates.retirementDate !== undefined) { sets.push(`retirement_date = $${idx}`); params.push(updates.retirementDate); idx++; }
    if (updates.replacementVersion !== undefined) { sets.push(`replacement_version = $${idx}`); params.push(updates.replacementVersion); idx++; }
    if (updates.changelog !== undefined) { sets.push(`changelog = $${idx}`); params.push(updates.changelog); idx++; }

    if (sets.length === 0) return this.findApiVersionById(id, tId);

    params.push(id, tId);
    const result = await this.db.query(
      `UPDATE api_versions SET ${sets.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1} RETURNING *`,
      params
    );
    if (result.rows.length === 0) return undefined;
    return this.mapVersionRow(result.rows[0]);
  }

  async findDeprecatedVersions(tenantId?: string): Promise<ApiVersionEntity[]> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `SELECT * FROM api_versions WHERE tenant_id = $1 AND status = 'deprecated' ORDER BY deprecation_date DESC`,
      [tId]
    );
    return result.rows.map(row => this.mapVersionRow(row));
  }

  // ==================== Governance Rules ====================

  async createRule(input: CreateGovernanceRuleInput): Promise<GovernanceRuleEntity> {
    const tenantId = this.getTenantId(input.tenantId);
    const id = `rule-${Date.now()}`;
    const result = await this.db.query(
      `INSERT INTO governance_rules (id, tenant_id, name, description, type, enabled, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, tenantId, input.name, input.description, input.type, input.enabled !== false, new Date()]
    );
    return this.mapRuleRow(result.rows[0]);
  }

  async findAllRules(tenantId?: string): Promise<GovernanceRuleEntity[]> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `SELECT * FROM governance_rules WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tId]
    );
    return result.rows.map(row => this.mapRuleRow(row));
  }

  async findById(id: string, tenantId?: string): Promise<GovernanceRuleEntity | undefined> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `SELECT * FROM governance_rules WHERE id = $1 AND tenant_id = $2`,
      [id, tId]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRuleRow(result.rows[0]);
  }

  async updateRule(
    id: string,
    input: { name: string; description: string; type: string; enabled: boolean },
    tenantId?: string,
  ): Promise<GovernanceRuleEntity | undefined> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `UPDATE governance_rules SET name = $1, description = $2, type = $3, enabled = $4
       WHERE id = $5 AND tenant_id = $6 RETURNING *`,
      [input.name, input.description, input.type, input.enabled, id, tId]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRuleRow(result.rows[0]);
  }

  async deleteRule(id: string, tenantId?: string): Promise<void> {
    const tId = this.getTenantId(tenantId);
    await this.db.query(
      `DELETE FROM governance_rules WHERE id = $1 AND tenant_id = $2`,
      [id, tId]
    );
  }

  // ==================== Verification History ====================

  async createVerification(input: CreateVerificationInput): Promise<ApiVerificationHistoryEntity> {
    const tenantId = this.getTenantId(input.tenantId);
    const id = `verify-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const result = await this.db.query(
      `INSERT INTO api_verification_history
       (id, contract_id, tenant_id, passed, violations, endpoint, method, verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, input.contractId, tenantId, input.passed, JSON.stringify(input.violations), input.endpoint, input.method, input.verifiedAt || new Date()]
    );
    return this.mapVerificationRow(result.rows[0]);
  }

  async findVerificationHistoryByContractId(contractId: string, tenantId?: string): Promise<ApiVerificationHistoryEntity[]> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `SELECT * FROM api_verification_history WHERE contract_id = $1 AND tenant_id = $2 ORDER BY verified_at DESC`,
      [contractId, tId]
    );
    return result.rows.map(row => this.mapVerificationRow(row));
  }

  // ==================== Governance Report ====================

  async getGovernanceStats(tenantId?: string): Promise<{
    totalContracts: number;
    totalVersions: number;
    totalRules: number;
    activeRules: number;
    totalViolations: number;
    deprecatedVersions: number;
  }> {
    const tId = this.getTenantId(tenantId);

    const [contractResult, versionResult, ruleResult, activeRuleResult, violationResult, deprecatedResult] =
      await Promise.all([
        this.db.query(`SELECT COUNT(*) as count FROM api_contracts WHERE tenant_id = $1`, [tId]),
        this.db.query(`SELECT COUNT(*) as count FROM api_versions WHERE tenant_id = $1`, [tId]),
        this.db.query(`SELECT COUNT(*) as count FROM governance_rules WHERE tenant_id = $1`, [tId]),
        this.db.query(`SELECT COUNT(*) as count FROM governance_rules WHERE tenant_id = $1 AND enabled = true`, [tId]),
        this.db.query(`SELECT COUNT(*) as count FROM api_contract_violations WHERE tenant_id = $1`, [tId]),
        this.db.query(`SELECT COUNT(*) as count FROM api_versions WHERE tenant_id = $1 AND status = 'deprecated'`, [tId]),
      ]);

    return {
      totalContracts: parseInt(contractResult.rows[0].count, 10),
      totalVersions: parseInt(versionResult.rows[0].count, 10),
      totalRules: parseInt(ruleResult.rows[0].count, 10),
      activeRules: parseInt(activeRuleResult.rows[0].count, 10),
      totalViolations: parseInt(violationResult.rows[0].count, 10),
      deprecatedVersions: parseInt(deprecatedResult.rows[0].count, 10),
    };
  }

  // ==================== Row Mappers ====================

  private mapContractRow(row: any): ApiContractEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      api_name: row.api_name,
      version: row.version,
      method: row.method,
      path: row.path,
      request_schema: typeof row.request_schema === 'string' ? JSON.parse(row.request_schema) : (row.request_schema || {}),
      response_schema: typeof row.response_schema === 'string' ? JSON.parse(row.response_schema) : (row.response_schema || {}),
      status: row.status,
      deprecation_date: row.deprecation_date,
      retirement_date: row.retirement_date,
      replacement_version: row.replacement_version,
      created_at: new Date(row.created_at),
    };
  }

  private mapViolationRow(row: any): ApiContractViolationEntity {
    return {
      id: row.id,
      contract_id: row.contract_id,
      tenant_id: row.tenant_id,
      violation_type: row.violation_type,
      description: row.description,
      severity: row.severity,
      detected_at: new Date(row.detected_at),
    };
  }

  private mapVersionRow(row: any): ApiVersionEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      api_name: row.api_name,
      version: row.version,
      status: row.status,
      registered_at: new Date(row.registered_at),
      deprecation_date: row.deprecation_date,
      retirement_date: row.retirement_date,
      replacement_version: row.replacement_version,
      changelog: row.changelog,
    };
  }

  private mapRuleRow(row: any): GovernanceRuleEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      description: row.description,
      type: row.type,
      enabled: row.enabled,
      created_at: new Date(row.created_at),
    };
  }

  private mapVerificationRow(row: any): ApiVerificationHistoryEntity {
    return {
      id: row.id,
      contract_id: row.contract_id,
      tenant_id: row.tenant_id,
      passed: row.passed,
      violations: typeof row.violations === 'string' ? JSON.parse(row.violations) : (row.violations || []),
      endpoint: row.endpoint,
      method: row.method,
      verified_at: new Date(row.verified_at),
    };
  }
}
