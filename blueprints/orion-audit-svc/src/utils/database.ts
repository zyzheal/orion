import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config/index.js';
import type {
  AuditLog,
  AuditLogInput,
  AuditChainInfo,
  AuditStorageStats,
  AuditLogQuery,
  AuditActionResult,
  ResourceTypeCount,
  AuditAction,
} from '../types/audit.js';
import type {
  CompliancePolicy,
  ComplianceRule,
  ComplianceEvaluation,
  ComplianceFinding,
  ComplianceReport,
  ComplianceScore,
  Remediation,
  AuditPlan,
  AuditFinding,
  ComplianceFramework,
  ComplianceEvidence,
  GapAnalysisResult,
  ComplianceStatus,
  ComplianceSeverity,
  RemediationStatus,
  AuditPlanStatus,
  FindingStatus,
} from '../types/compliance.js';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const poolConfig: PoolConfig = {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false,
      min: config.database.poolMin,
      max: config.database.poolMax,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

    pool = new Pool(poolConfig);

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function query<T extends QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await getPool().query<T>(text, params);
    const duration = Date.now() - start;
    if (config.logging.level === 'debug') {
      console.debug(`Executed query in ${duration}ms`, { text, params });
    }
    return result;
  } catch (error) {
    console.error('Database query error', { text, params, error });
    throw error;
  }
}

export async function initializeDatabase(): Promise<void> {
  const ddl = `
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL,
      action VARCHAR(50) NOT NULL,
      resource_type VARCHAR(255) NOT NULL,
      resource_id VARCHAR(255) NOT NULL,
      details JSONB NOT NULL DEFAULT '{}',
      ip_address INET,
      user_agent TEXT,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      previous_hash VARCHAR(64) NOT NULL,
      current_hash VARCHAR(64) NOT NULL,
      chain_index BIGINT NOT NULL,
      severity VARCHAR(20) NOT NULL DEFAULT 'low',
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      tenant_id VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_chain_index ON audit_logs(chain_index);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_current_hash ON audit_logs(current_hash);

    CREATE TABLE IF NOT EXISTS compliance_policies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      framework VARCHAR(100) NOT NULL,
      rules JSONB NOT NULL DEFAULT '[]',
      status VARCHAR(30) NOT NULL DEFAULT 'not_evaluated',
      last_evaluated TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS compliance_evaluations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      policy_id UUID NOT NULL REFERENCES compliance_policies(id),
      resource_id VARCHAR(255) NOT NULL,
      status VARCHAR(30) NOT NULL,
      score NUMERIC(5, 2) NOT NULL DEFAULT 0,
      evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      evaluated_by VARCHAR(255) NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_evaluations_policy ON compliance_evaluations(policy_id);
    CREATE INDEX IF NOT EXISTS idx_evaluations_resource ON compliance_evaluations(resource_id);

    CREATE TABLE IF NOT EXISTS compliance_findings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_id UUID NOT NULL,
      resource_id VARCHAR(255) NOT NULL,
      status VARCHAR(30) NOT NULL,
      severity VARCHAR(20) NOT NULL,
      description TEXT NOT NULL,
      evidence TEXT,
      remediation TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_findings_resource ON compliance_findings(resource_id);
    CREATE INDEX IF NOT EXISTS idx_findings_severity ON compliance_findings(severity);

    CREATE TABLE IF NOT EXISTS compliance_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      policy_id UUID NOT NULL REFERENCES compliance_policies(id),
      title VARCHAR(255) NOT NULL,
      status VARCHAR(30) NOT NULL,
      overall_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
      total_checks INTEGER NOT NULL DEFAULT 0,
      passed_checks INTEGER NOT NULL DEFAULT 0,
      failed_checks INTEGER NOT NULL DEFAULT 0,
      findings JSONB NOT NULL DEFAULT '[]',
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      generated_by VARCHAR(255) NOT NULL,
      period_start TIMESTAMPTZ NOT NULL,
      period_end TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS remediations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      finding_id UUID NOT NULL REFERENCES compliance_findings(id),
      description TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'open',
      assigned_to VARCHAR(255),
      due_date TIMESTAMPTZ,
      resolved_at TIMESTAMPTZ,
      resolved_by VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      scope JSONB NOT NULL DEFAULT '{}',
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      created_by VARCHAR(255) NOT NULL,
      start_date TIMESTAMPTZ NOT NULL,
      end_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_findings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      audit_plan_id UUID NOT NULL REFERENCES audit_plans(id),
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      severity VARCHAR(20) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'open',
      resource_id VARCHAR(255),
      evidence TEXT,
      recommendation TEXT,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS compliance_frameworks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      version VARCHAR(50) NOT NULL,
      description TEXT NOT NULL,
      categories TEXT[] NOT NULL DEFAULT '{}',
      policies TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS compliance_evidence (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      finding_id UUID NOT NULL REFERENCES compliance_findings(id),
      type VARCHAR(100) NOT NULL,
      content TEXT NOT NULL,
      source VARCHAR(255) NOT NULL,
      collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      collected_by VARCHAR(255) NOT NULL,
      verified BOOLEAN NOT NULL DEFAULT false,
      verified_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS gap_analysis (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      framework_id UUID NOT NULL REFERENCES compliance_frameworks(id),
      policy_id UUID NOT NULL REFERENCES compliance_policies(id),
      current_status VARCHAR(30) NOT NULL,
      target_status VARCHAR(30) NOT NULL,
      gap_description TEXT NOT NULL,
      remediation_steps TEXT[] NOT NULL DEFAULT '{}',
      estimated_effort VARCHAR(100),
      priority VARCHAR(20) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await query(ddl);
  console.log('Database tables initialized successfully');
}

function mapRowToAuditLog(row: Record<string, unknown>): AuditLog {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    action: row.action as AuditLog['action'],
    resourceType: row.resource_type as string,
    resourceId: row.resource_id as string,
    details: (row.details as Record<string, unknown>) || {},
    ipAddress: (row.ip_address as string) || null,
    userAgent: (row.user_agent as string) || null,
    timestamp: row.timestamp as Date,
    previousHash: row.previous_hash as string,
    currentHash: row.current_hash as string,
    chainIndex: Number(row.chain_index),
    severity: row.severity as AuditLog['severity'],
    status: row.status as AuditLog['status'],
    tenantId: (row.tenant_id as string) || null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

// ── Audit Repository ──────────────────────────────────────────────

export const AuditRepository = {
  async create(input: AuditLogInput, previousHash: string, chainIndex: number): Promise<AuditLog> {
    const { userId, action, resourceType, resourceId, details, ipAddress, userAgent, severity, tenantId } = input;

    const result = await query<Record<string, unknown>>(`
      INSERT INTO audit_logs (
        user_id, action, resource_type, resource_id, details,
        ip_address, user_agent, previous_hash, current_hash, chain_index,
        severity, status, tenant_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12)
      RETURNING *
    `, [
      userId, action, resourceType, resourceId,
      JSON.stringify(details || {}),
      ipAddress || null,
      userAgent || null,
      previousHash,
      '',
      chainIndex,
      severity || 'low',
      tenantId || null,
    ]);

    return mapRowToAuditLog(result.rows[0]);
  },

  async updateHash(id: string, currentHash: string): Promise<void> {
    await query(`
      UPDATE audit_logs SET current_hash = $1, updated_at = NOW() WHERE id = $2
    `, [currentHash, id]);
  },

  async updateStatus(id: string, status: AuditLog['status']): Promise<AuditLog> {
    const result = await query<Record<string, unknown>>(`
      UPDATE audit_logs SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *
    `, [status, id]);
    return mapRowToAuditLog(result.rows[0]);
  },

  async findById(id: string): Promise<AuditLog | null> {
    const result = await query<Record<string, unknown>>('SELECT * FROM audit_logs WHERE id = $1', [id]);
    return result.rows.length > 0 ? mapRowToAuditLog(result.rows[0]) : null;
  },

  async findMany(queryParams: AuditLogQuery): Promise<{ logs: AuditLog[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (queryParams.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(queryParams.userId);
    }
    if (queryParams.action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(queryParams.action);
    }
    if (queryParams.resourceType) {
      conditions.push(`resource_type = $${paramIndex++}`);
      params.push(queryParams.resourceType);
    }
    if (queryParams.resourceId) {
      conditions.push(`resource_id = $${paramIndex++}`);
      params.push(queryParams.resourceId);
    }
    if (queryParams.startDate) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      params.push(queryParams.startDate);
    }
    if (queryParams.endDate) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      params.push(queryParams.endDate);
    }
    if (queryParams.severity) {
      conditions.push(`severity = $${paramIndex++}`);
      params.push(queryParams.severity);
    }
    if (queryParams.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(queryParams.status);
    }
    if (queryParams.tenantId !== undefined) {
      if (queryParams.tenantId === null) {
        conditions.push(`tenant_id IS NULL`);
      } else {
        conditions.push(`tenant_id = $${paramIndex++}`);
        params.push(queryParams.tenantId);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortColumn = queryParams.sortBy === 'chainIndex' ? 'chain_index' : queryParams.sortBy || 'timestamp';
    const sortOrder = queryParams.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const limit = queryParams.limit || 50;
    const offset = queryParams.offset || 0;

    const countResult = await query<{ cnt: string }>(
      `SELECT COUNT(*) as cnt FROM audit_logs ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].cnt, 10);

    const dataResult = await query<Record<string, unknown>>(`
      SELECT * FROM audit_logs ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, [...params, limit, offset]);

    return { logs: dataResult.rows.map(mapRowToAuditLog), total };
  },

  async findByHash(hash: string): Promise<AuditLog | null> {
    const result = await query<Record<string, unknown>>('SELECT * FROM audit_logs WHERE current_hash = $1', [hash]);
    return result.rows.length > 0 ? mapRowToAuditLog(result.rows[0]) : null;
  },

  async getLatestChainIndex(): Promise<number> {
    const result = await query<{ max_idx: string }>('SELECT MAX(chain_index) as max_idx FROM audit_logs');
    const val = result.rows[0]?.max_idx;
    return val ? parseInt(val, 10) : 0;
  },

  async getChainInfo(): Promise<AuditChainInfo> {
    const infoResult = await query<{
      total: string;
      latest_hash: string;
      genesis_hash: string;
      latest_index: string;
    }>(`
      SELECT
        COUNT(*) as total,
        COALESCE((SELECT current_hash FROM audit_logs ORDER BY chain_index DESC LIMIT 1), '') as latest_hash,
        COALESCE((SELECT previous_hash FROM audit_logs ORDER BY chain_index ASC LIMIT 1), '') as genesis_hash,
        COALESCE(MAX(chain_index), 0) as latest_index
      FROM audit_logs
    `);

    const { total, latest_hash, genesis_hash, latest_index } = infoResult.rows[0];

    const integrityResult = await query<{ cnt: string }>(`
      SELECT COUNT(*) as cnt FROM audit_logs l1
      JOIN audit_logs l2 ON l2.chain_index = l1.chain_index + 1
      WHERE l2.previous_hash != l1.current_hash
    `);

    return {
      genesisHash: genesis_hash || config.audit.chainGenesisHash,
      latestHash: latest_hash,
      totalEntries: parseInt(total, 10),
      chainIntegrity: parseInt(integrityResult.rows[0].cnt, 10) === 0,
      latestIndex: parseInt(latest_index, 10),
      algorithm: config.audit.hashAlgorithm,
    };
  },

  async getStorageStats(): Promise<AuditStorageStats> {
    const statsResult = await query<{
      total: string;
      storage_bytes: string;
      oldest: Date | null;
      newest: Date | null;
    }>(`
      SELECT
        COUNT(*) as total,
        pg_total_relation_size('audit_logs') as storage_bytes,
        MIN(timestamp) as oldest,
        MAX(timestamp) as newest
      FROM audit_logs
    `);

    const { total, storage_bytes, oldest, newest } = statsResult.rows[0];

    const typeResult = await query<Record<string, unknown>>(`
      SELECT resource_type, COUNT(*) as count
      FROM audit_logs
      GROUP BY resource_type
      ORDER BY count DESC
    `);

    const recordsByType: Record<string, number> = {};
    for (const row of typeResult.rows) {
      recordsByType[row.resource_type as string] = Number(row.count);
    }

    return {
      totalRecords: parseInt(total, 10),
      storageBytes: parseInt(storage_bytes, 10),
      oldestEntry: oldest || null,
      newestEntry: newest || null,
      recordsByType,
    };
  },

  async getActionsSummary(): Promise<AuditActionResult[]> {
    const result = await query<Record<string, unknown>>(`
      SELECT action, resource_type, resource_id, COUNT(*) as count
      FROM audit_logs
      GROUP BY action, resource_type, resource_id
      ORDER BY count DESC
      LIMIT 100
    `);
    return result.rows.map((row) => ({
      id: `${row.action}-${row.resource_type}-${row.resource_id}`,
      action: row.action as AuditAction,
      resourceType: row.resource_type as string,
      resourceId: row.resource_id as string,
      count: Number(row.count),
    }));
  },

  async getResourceTypes(): Promise<ResourceTypeCount[]> {
    const result = await query<Record<string, unknown>>(`
      SELECT resource_type, COUNT(*) as count
      FROM audit_logs
      GROUP BY resource_type
      ORDER BY count DESC
    `);
    return result.rows.map((row) => ({
      resourceType: row.resource_type as string,
      count: Number(row.count),
    }));
  },

  async deleteById(id: string): Promise<boolean> {
    const result = await query('DELETE FROM audit_logs WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },
};

// ── Compliance Repository ─────────────────────────────────────────

function mapRowToCompliancePolicy(row: Record<string, unknown>): CompliancePolicy {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    framework: row.framework as string,
    rules: (row.rules as ComplianceRule[]) || [],
    status: row.status as ComplianceStatus,
    lastEvaluated: (row.last_evaluated as Date) || null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

function mapRowToComplianceEvaluation(row: Record<string, unknown>): ComplianceEvaluation {
  return {
    id: row.id as string,
    policyId: row.policy_id as string,
    resourceId: row.resource_id as string,
    status: row.status as ComplianceStatus,
    score: Number(row.score),
    findings: [],
    evaluatedAt: row.evaluated_at as Date,
    evaluatedBy: row.evaluated_by as string,
    details: (row.details as Record<string, unknown>) || {},
  };
}

function mapRowToComplianceFinding(row: Record<string, unknown>): ComplianceFinding {
  return {
    id: row.id as string,
    ruleId: row.rule_id as string,
    resourceId: row.resource_id as string,
    status: row.status as ComplianceStatus,
    severity: row.severity as ComplianceSeverity,
    description: row.description as string,
    evidence: (row.evidence as string) || null,
    remediation: (row.remediation as string) || null,
    createdAt: row.created_at as Date,
  };
}

export const ComplianceRepository = {
  async createPolicy(
    name: string,
    description: string,
    framework: string,
    rules: ComplianceRule[]
  ): Promise<CompliancePolicy> {
    const result = await query<Record<string, unknown>>(`
      INSERT INTO compliance_policies (name, description, framework, rules)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [name, description, framework, JSON.stringify(rules)]);
    return mapRowToCompliancePolicy(result.rows[0]);
  },

  async findAllPolicies(): Promise<CompliancePolicy[]> {
    const result = await query<Record<string, unknown>>('SELECT * FROM compliance_policies ORDER BY name');
    return result.rows.map(mapRowToCompliancePolicy);
  },

  async findPolicyById(id: string): Promise<CompliancePolicy | null> {
    const result = await query<Record<string, unknown>>('SELECT * FROM compliance_policies WHERE id = $1', [id]);
    return result.rows.length > 0 ? mapRowToCompliancePolicy(result.rows[0]) : null;
  },

  async createEvaluation(
    policyId: string,
    resourceId: string,
    status: ComplianceStatus,
    score: number,
    evaluatedBy: string,
    details: Record<string, unknown>
  ): Promise<ComplianceEvaluation> {
    const result = await query<Record<string, unknown>>(`
      INSERT INTO compliance_evaluations (policy_id, resource_id, status, score, evaluated_by, details)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [policyId, resourceId, status, score, evaluatedBy, JSON.stringify(details)]);
    return mapRowToComplianceEvaluation(result.rows[0]);
  },

  async createFinding(
    ruleId: string,
    resourceId: string,
    status: ComplianceStatus,
    severity: ComplianceSeverity,
    description: string,
    evidence: string | null,
    remediation: string | null
  ): Promise<ComplianceFinding> {
    const result = await query<Record<string, unknown>>(`
      INSERT INTO compliance_findings (rule_id, resource_id, status, severity, description, evidence, remediation)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [ruleId, resourceId, status, severity, description, evidence, remediation]);
    return mapRowToComplianceFinding(result.rows[0]);
  },

  async findFindingsByEvaluation(evaluationId: string): Promise<ComplianceFinding[]> {
    const result = await query<Record<string, unknown>>(`
      SELECT f.* FROM compliance_findings f
      JOIN compliance_evaluations e ON e.resource_id = f.resource_id
      WHERE e.id = $1
    `, [evaluationId]);
    return result.rows.map(mapRowToComplianceFinding);
  },

  async createReport(
    policyId: string,
    title: string,
    status: ComplianceStatus,
    overallScore: number,
    totalChecks: number,
    passedChecks: number,
    failedChecks: number,
    findings: ComplianceFinding[],
    generatedBy: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<ComplianceReport> {
    const result = await query<Record<string, unknown>>(`
      INSERT INTO compliance_reports (
        policy_id, title, status, overall_score, total_checks, passed_checks, failed_checks,
        findings, generated_by, period_start, period_end
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *
    `, [
      policyId, title, status, overallScore, totalChecks, passedChecks, failedChecks,
      JSON.stringify(findings), generatedBy, periodStart, periodEnd,
    ]);
    const row = result.rows[0];
    return {
      id: row.id as string,
      policyId: row.policy_id as string,
      title: row.title as string,
      status: row.status as ComplianceStatus,
      overallScore: Number(row.overall_score),
      totalChecks: Number(row.total_checks),
      passedChecks: Number(row.passed_checks),
      failedChecks: Number(row.failed_checks),
      findings: (row.findings as ComplianceFinding[]) || [],
      generatedAt: row.generated_at as Date,
      generatedBy: row.generated_by as string,
      periodStart: row.period_start as Date,
      periodEnd: row.period_end as Date,
    };
  },

  async findReportById(id: string): Promise<ComplianceReport | null> {
    const result = await query<Record<string, unknown>>('SELECT * FROM compliance_reports WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id as string,
      policyId: row.policy_id as string,
      title: row.title as string,
      status: row.status as ComplianceStatus,
      overallScore: Number(row.overall_score),
      totalChecks: Number(row.total_checks),
      passedChecks: Number(row.passed_checks),
      failedChecks: Number(row.failed_checks),
      findings: (row.findings as ComplianceFinding[]) || [],
      generatedAt: row.generated_at as Date,
      generatedBy: row.generated_by as string,
      periodStart: row.period_start as Date,
      periodEnd: row.period_end as Date,
    };
  },

  async getScores(): Promise<ComplianceScore[]> {
    const result = await query<Record<string, unknown>>(`
      SELECT
        p.id as policy_id,
        p.name as policy_name,
        COALESCE(e.status, 'not_evaluated') as status,
        COALESCE(e.score, 0) as score,
        p.last_evaluated as last_evaluated,
        COUNT(f.id) as total_checks,
        SUM(CASE WHEN f.status = 'compliant' THEN 1 ELSE 0 END) as passed_checks
      FROM compliance_policies p
      LEFT JOIN compliance_evaluations e ON e.policy_id = p.id
      LEFT JOIN compliance_findings f ON f.resource_id = e.resource_id
      GROUP BY p.id, p.name, e.status, e.score, p.last_evaluated
      ORDER BY p.name
    `);
    return result.rows.map((row) => ({
      policyId: row.policy_id as string,
      policyName: row.policy_name as string,
      score: Number(row.score),
      status: row.status as ComplianceStatus,
      lastEvaluated: row.last_evaluated ? (row.last_evaluated as Date) : null,
      totalChecks: Number(row.total_checks || 0),
      passedChecks: Number(row.passed_checks || 0),
    }));
  },

  async createRemediation(
    findingId: string,
    description: string,
    assignedTo: string | null,
    dueDate: Date | null
  ): Promise<Remediation> {
    const result = await query<Record<string, unknown>>(`
      INSERT INTO remediations (finding_id, description, assigned_to, due_date)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [findingId, description, assignedTo, dueDate]);
    const row = result.rows[0];
    return {
      id: row.id as string,
      findingId: row.finding_id as string,
      description: row.description as string,
      status: row.status as RemediationStatus,
      assignedTo: (row.assigned_to as string) || null,
      dueDate: (row.due_date as Date) || null,
      resolvedAt: (row.resolved_at as Date) || null,
      resolvedBy: (row.resolved_by as string) || null,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  },

  async updateRemediationStatus(
    id: string,
    status: RemediationStatus,
    resolvedBy: string | null
  ): Promise<Remediation> {
    const result = await query<Record<string, unknown>>(`
      UPDATE remediations
      SET status = $1, resolved_by = $2, resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END,
          updated_at = NOW()
      WHERE id = $3 RETURNING *
    `, [status, resolvedBy, id]);
    const row = result.rows[0];
    return {
      id: row.id as string,
      findingId: row.finding_id as string,
      description: row.description as string,
      status: row.status as RemediationStatus,
      assignedTo: (row.assigned_to as string) || null,
      dueDate: (row.due_date as Date) || null,
      resolvedAt: (row.resolved_at as Date) || null,
      resolvedBy: (row.resolved_by as string) || null,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  },

  async findAllAuditPlans(): Promise<AuditPlan[]> {
    const result = await query<Record<string, unknown>>('SELECT * FROM audit_plans ORDER BY created_at DESC');
    return result.rows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      scope: (row.scope as Record<string, unknown>) || {},
      status: row.status as AuditPlanStatus,
      createdBy: row.created_by as string,
      startDate: row.start_date as Date,
      endDate: (row.end_date as Date) || null,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    }));
  },

  async createAuditPlan(
    name: string,
    description: string,
    scope: Record<string, unknown>,
    createdBy: string,
    startDate: Date,
    endDate: Date | null
  ): Promise<AuditPlan> {
    const result = await query<Record<string, unknown>>(`
      INSERT INTO audit_plans (name, description, scope, created_by, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [name, description, JSON.stringify(scope), createdBy, startDate, endDate]);
    const row = result.rows[0];
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      scope: (row.scope as Record<string, unknown>) || {},
      status: row.status as AuditPlanStatus,
      createdBy: row.created_by as string,
      startDate: row.start_date as Date,
      endDate: (row.end_date as Date) || null,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  },

  async findAuditPlanById(id: string): Promise<AuditPlan | null> {
    const result = await query<Record<string, unknown>>('SELECT * FROM audit_plans WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      scope: (row.scope as Record<string, unknown>) || {},
      status: row.status as AuditPlanStatus,
      createdBy: row.created_by as string,
      startDate: row.start_date as Date,
      endDate: (row.end_date as Date) || null,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  },

  async createAuditFinding(
    auditPlanId: string,
    title: string,
    description: string,
    severity: ComplianceSeverity,
    createdBy: string,
    resourceId: string | null,
    evidence: string | null,
    recommendation: string | null
  ): Promise<AuditFinding> {
    const result = await query<Record<string, unknown>>(`
      INSERT INTO audit_findings (
        audit_plan_id, title, description, severity, created_by, resource_id, evidence, recommendation
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [auditPlanId, title, description, severity, createdBy, resourceId, evidence, recommendation]);
    const row = result.rows[0];
    return {
      id: row.id as string,
      auditPlanId: row.audit_plan_id as string,
      title: row.title as string,
      description: row.description as string,
      severity: row.severity as ComplianceSeverity,
      status: row.status as FindingStatus,
      resourceId: (row.resource_id as string) || null,
      evidence: (row.evidence as string) || null,
      recommendation: (row.recommendation as string) || null,
      createdBy: row.created_by as string,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  },

  async findAuditPlanFindings(planId: string): Promise<AuditFinding[]> {
    const result = await query<Record<string, unknown>>(
      'SELECT * FROM audit_findings WHERE audit_plan_id = $1 ORDER BY created_at DESC',
      [planId]
    );
    return result.rows.map((row) => ({
      id: row.id as string,
      auditPlanId: row.audit_plan_id as string,
      title: row.title as string,
      description: row.description as string,
      severity: row.severity as ComplianceSeverity,
      status: row.status as FindingStatus,
      resourceId: (row.resource_id as string) || null,
      evidence: (row.evidence as string) || null,
      recommendation: (row.recommendation as string) || null,
      createdBy: row.created_by as string,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    }));
  },

  async findAllFrameworks(): Promise<ComplianceFramework[]> {
    const result = await query<Record<string, unknown>>('SELECT * FROM compliance_frameworks ORDER BY name');
    return result.rows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      version: row.version as string,
      description: row.description as string,
      categories: (row.categories as string[]) || [],
      policies: (row.policies as string[]) || [],
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    }));
  },

  async createFramework(
    name: string,
    version: string,
    description: string,
    categories: string[],
    policies: string[]
  ): Promise<ComplianceFramework> {
    const result = await query<Record<string, unknown>>(`
      INSERT INTO compliance_frameworks (name, version, description, categories, policies)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [name, version, description, categories, policies]);
    const row = result.rows[0];
    return {
      id: row.id as string,
      name: row.name as string,
      version: row.version as string,
      description: row.description as string,
      categories: (row.categories as string[]) || [],
      policies: (row.policies as string[]) || [],
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  },

  async createEvidence(
    findingId: string,
    type: string,
    content: string,
    source: string,
    collectedBy: string
  ): Promise<ComplianceEvidence> {
    const result = await query<Record<string, unknown>>(`
      INSERT INTO compliance_evidence (finding_id, type, content, source, collected_by)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [findingId, type, content, source, collectedBy]);
    const row = result.rows[0];
    return {
      id: row.id as string,
      findingId: row.finding_id as string,
      type: row.type as string,
      content: row.content as string,
      source: row.source as string,
      collectedAt: row.collected_at as Date,
      collectedBy: row.collected_by as string,
      verified: row.verified as boolean,
      verifiedAt: (row.verified_at as Date) || null,
    };
  },

  async findAllEvidence(): Promise<ComplianceEvidence[]> {
    const result = await query<Record<string, unknown>>('SELECT * FROM compliance_evidence ORDER BY collected_at DESC');
    return result.rows.map((row) => ({
      id: row.id as string,
      findingId: row.finding_id as string,
      type: row.type as string,
      content: row.content as string,
      source: row.source as string,
      collectedAt: row.collected_at as Date,
      collectedBy: row.collected_by as string,
      verified: row.verified as boolean,
      verifiedAt: (row.verified_at as Date) || null,
    }));
  },

  async createGapAnalysis(
    frameworkId: string,
    policyId: string,
    currentStatus: ComplianceStatus,
    targetStatus: ComplianceStatus,
    gapDescription: string,
    remediationSteps: string[],
    estimatedEffort: string,
    priority: ComplianceSeverity
  ): Promise<GapAnalysisResult> {
    const result = await query<Record<string, unknown>>(`
      INSERT INTO gap_analysis (
        framework_id, policy_id, current_status, target_status, gap_description,
        remediation_steps, estimated_effort, priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [frameworkId, policyId, currentStatus, targetStatus, gapDescription, remediationSteps, estimatedEffort, priority]);
    const row = result.rows[0];
    return {
      id: row.id as string,
      frameworkId: row.framework_id as string,
      policyId: row.policy_id as string,
      currentStatus: row.current_status as ComplianceStatus,
      targetStatus: row.target_status as ComplianceStatus,
      gapDescription: row.gap_description as string,
      remediationSteps: (row.remediation_steps as string[]) || [],
      estimatedEffort: (row.estimated_effort as string) || '',
      priority: row.priority as ComplianceSeverity,
      createdAt: row.created_at as Date,
    };
  },

  async findAllGapAnalysis(): Promise<GapAnalysisResult[]> {
    const result = await query<Record<string, unknown>>('SELECT * FROM gap_analysis ORDER BY priority, created_at DESC');
    return result.rows.map((row) => ({
      id: row.id as string,
      frameworkId: row.framework_id as string,
      policyId: row.policy_id as string,
      currentStatus: row.current_status as ComplianceStatus,
      targetStatus: row.target_status as ComplianceStatus,
      gapDescription: row.gap_description as string,
      remediationSteps: (row.remediation_steps as string[]) || [],
      estimatedEffort: (row.estimated_effort as string) || '',
      priority: row.priority as ComplianceSeverity,
      createdAt: row.created_at as Date,
    }));
  },
};
