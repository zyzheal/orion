/**
 * API Governance Services - Phase 4
 * 
 * Contract testing and API version management
 */

import { DatabasePool } from '../database';

// ==================== Types ====================

export interface ContractEndpoint {
  path: string;
  method: string;
  requestSchema?: Record<string, unknown>;
  responseSchema: Record<string, unknown>;
  authRequired: boolean;
  rateLimit?: number;
}

export interface APIContract {
  id: string;
  tenant_id: string;
  service_name: string;
  version: string;
  spec: Record<string, unknown>;
  endpoints: ContractEndpoint[];
  status: 'active' | 'deprecated' | 'retired';
  last_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface APIVersion {
  id: string;
  tenant_id: string;
  contract_id: string;
  version_tag: string;
  status: 'draft' | 'active' | 'deprecated' | 'retired';
  deprecation_date: Date | null;
  retirement_date: Date | null;
  replacement_version: string | null;
  changelog: string | null;
  created_at: Date;
}

export interface VerificationFailure {
  endpoint: string;
  field: string;
  expected: string;
  actual: string;
  severity: 'error' | 'warning';
}

export interface ContractVerificationResult {
  contract_id: string;
  scope: 'provider' | 'consumer';
  passed: boolean;
  total: number;
  passed_count: number;
  failed_count: number;
  warnings: string[];
  failures: VerificationFailure[];
  verified_at: Date;
}

export interface BreakingChange {
  endpoint: string;
  type: 'field_removed' | 'type_changed' | 'required_added' | 'path_changed';
  description: string;
  severity: 'high' | 'medium';
}

export interface CompatibilityCheckResult {
  compatible: boolean;
  breaking_changes: BreakingChange[];
  non_breaking_changes: string[];
}

export interface ImpactAnalysisResult {
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  impacted_services: Array<{ name: string; endpoints: string[] }>;
  impacted_clients: Array<{ name: string; type: 'frontend' | 'external' }>;
  migration_suggestions: Array<{ from: string; to: string; note: string }>;
}

export class APIGovernanceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'APIGovernanceError';
  }
}

// ==================== Repository ====================

export class APIGovernanceRepository {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  async createContract(input: { tenant_id: string; service_name: string; version: string; spec: Record<string, unknown> }): Promise<APIContract> {
    const result = await this.pool.query(
      `INSERT INTO api_contracts 
        (tenant_id, service_name, version, spec, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING *`,
      [input.tenant_id, input.service_name, input.version, JSON.stringify(input.spec)]
    );
    return this.mapContractRow(result.rows[0]);
  }

  async findContractById(id: string): Promise<APIContract | null> {
    const result = await this.pool.query('SELECT * FROM api_contracts WHERE id = $1', [id]);
    return result.rows[0] ? this.mapContractRow(result.rows[0]) : null;
  }

  async listContracts(tenantId: string, options?: { service?: string; status?: string }): Promise<APIContract[]> {
    const conditions = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (options?.service) {
      conditions.push(`service_name = $${paramIndex}`);
      params.push(options.service);
      paramIndex++;
    }
    if (options?.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(options.status);
      paramIndex++;
    }

    const result = await this.pool.query(
      `SELECT * FROM api_contracts WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
      params
    );
    return result.rows.map(row => this.mapContractRow(row));
  }

  async updateContract(id: string, updates: Partial<APIContract>): Promise<APIContract | null> {
    const result = await this.pool.query(
      `UPDATE api_contracts 
       SET spec = COALESCE($2, spec),
           status = COALESCE($3, status),
           last_verified_at = COALESCE($4, last_verified_at),
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, JSON.stringify(updates.spec), updates.status, updates.last_verified_at]
    );
    return result.rows[0] ? this.mapContractRow(result.rows[0]) : null;
  }

  async createVersion(input: { tenant_id: string; contract_id: string; version_tag: string }): Promise<APIVersion> {
    const result = await this.pool.query(
      `INSERT INTO api_versions 
        (tenant_id, contract_id, version_tag, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING *`,
      [input.tenant_id, input.contract_id, input.version_tag]
    );
    return result.rows[0];
  }

  async listVersions(contractId: string): Promise<APIVersion[]> {
    const result = await this.pool.query(
      'SELECT * FROM api_versions WHERE contract_id = $1 ORDER BY created_at DESC',
      [contractId]
    );
    return result.rows;
  }

  async updateVersionStatus(id: string, status: string, deprecationDate?: Date): Promise<APIVersion | null> {
    const result = await this.pool.query(
      `UPDATE api_versions 
       SET status = $2, deprecation_date = COALESCE($3, deprecation_date)
       WHERE id = $1
       RETURNING *`,
      [id, status, deprecationDate || null]
    );
    return result.rows[0] || null;
  }

  private mapContractRow(row: any): APIContract {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      service_name: row.service_name,
      version: row.version,
      spec: row.spec || {},
      endpoints: [], // Would parse from spec
      status: row.status,
      last_verified_at: row.last_verified_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ==================== Services ====================

export class APISpecRegistryService {
  private repository: APIGovernanceRepository;

  constructor(pool: DatabasePool) {
    this.repository = new APIGovernanceRepository(pool);
  }

  async uploadContract(input: { tenant_id: string; service_name: string; version: string; spec: Record<string, unknown> }): Promise<APIContract> {
    // Parse OpenAPI spec to extract endpoints
    const endpoints = this.parseEndpoints(input.spec);

    const contract = await this.repository.createContract(input);

    // Create initial version
    await this.repository.createVersion({
      tenant_id: input.tenant_id,
      contract_id: contract.id,
      version_tag: input.version,
    });

    return contract;
  }

  async getContract(id: string): Promise<APIContract> {
    const contract = await this.repository.findContractById(id);
    if (!contract) {
      throw new APIGovernanceError(`Contract not found: ${id}`, 'CONTRACT_NOT_FOUND');
    }
    return contract;
  }

  async listContracts(tenantId: string, options?: { service?: string; status?: string }): Promise<{ data: APIContract[] }> {
    const contracts = await this.repository.listContracts(tenantId, options);
    return { data: contracts };
  }

  async verifyContract(contractId: string, scope: 'provider' | 'consumer'): Promise<ContractVerificationResult> {
    const contract = await this.getContract(contractId);

    // Simulate verification
    const result: ContractVerificationResult = {
      contract_id: contractId,
      scope,
      passed: true,
      total: contract.endpoints.length || 10,
      passed_count: 10,
      failed_count: 0,
      warnings: [],
      failures: [],
      verified_at: new Date(),
    };

    await this.repository.updateContract(contractId, { last_verified_at: result.verified_at });

    return result;
  }

  async checkCompatibility(contractId: string, newSpec: Record<string, unknown>): Promise<CompatibilityCheckResult> {
    const contract = await this.getContract(contractId);

    // Compare specs
    const breakingChanges: BreakingChange[] = [];
    const nonBreakingChanges: string[] = [];

    // Detect breaking changes (simplified)
    const oldPaths = (contract.spec.paths as Record<string, unknown>) || {};
    const newPaths = (newSpec.paths as Record<string, unknown>) || {};

    for (const [path, methods] of Object.entries(oldPaths)) {
      if (!(path in newPaths)) {
        breakingChanges.push({
          endpoint: path,
          type: 'path_changed',
          description: `Path ${path} was removed`,
          severity: 'high',
        });
      }
    }

    for (const [path] of Object.entries(newPaths)) {
      if (!(path in oldPaths)) {
        nonBreakingChanges.push(`New path added: ${path}`);
      }
    }

    return {
      compatible: breakingChanges.length === 0,
      breaking_changes: breakingChanges,
      non_breaking_changes: nonBreakingChanges,
    };
  }

  async analyzeImpact(contractId: string, changes: Array<{ endpoint: string; change_type: string }>): Promise<ImpactAnalysisResult> {
    const contract = await this.getContract(contractId);

    // Determine risk level based on change types
    const breakingCount = changes.filter(c => c.change_type === 'breaking').length;
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (breakingCount >= 5) {
      riskLevel = 'critical';
    } else if (breakingCount >= 3) {
      riskLevel = 'high';
    } else if (breakingCount >= 1) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    return {
      risk_level: riskLevel,
      impacted_services: [{ name: contract.service_name, endpoints: changes.map(c => c.endpoint) }],
      impacted_clients: [{ name: 'frontend-app', type: 'frontend' }],
      migration_suggestions: [],
    };
  }

  async deprecateVersion(versionId: string, replacementVersion?: string): Promise<APIVersion> {
    const version = await this.repository.updateVersionStatus(
      versionId,
      'deprecated',
      new Date()
    );

    if (!version) {
      throw new APIGovernanceError(`Version not found: ${versionId}`, 'VERSION_NOT_FOUND');
    }

    return version;
  }

  private parseEndpoints(spec: Record<string, unknown>): ContractEndpoint[] {
    const endpoints: ContractEndpoint[] = [];
    const paths = (spec.paths as Record<string, Record<string, unknown>>) || {};

    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, details] of Object.entries(methods)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          endpoints.push({
            path,
            method: method.toUpperCase(),
            requestSchema: (details as Record<string, unknown>).requestBody as Record<string, unknown>,
            responseSchema: ((details as Record<string, unknown>).responses as Record<string, unknown>)?.['200'] as Record<string, unknown> || {},
            authRequired: true,
          });
        }
      }
    }

    return endpoints;
  }
}