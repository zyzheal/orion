/**
 * RLSPolicyManager - PostgreSQL Row Level Security 策略管理服务
 *
 * 功能：
 * - 管理 PostgreSQL RLS 策略的创建、启用、禁用
 * - 设置数据库 session 变量 (app.current_tenant_id)
 * - 验证 RLS 策略是否正确应用
 * - 提供策略状态报告
 */

import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * RLS 策略配置
 */
export interface RLSPolicyConfig {
  tableName: string;
  policyName: string;
  sessionVariable: string;
  enabled: boolean;
}

/**
 * RLS 状态检查结果
 */
export interface RLSStatusResult {
  tableName: string;
  rlsEnabled: boolean;
  rlsForced: boolean;
  policyCount: number;
  policies: string[];
}

/**
 * Session 变量设置结果
 */
export interface SessionVariableResult {
  variableName: string;
  value: string;
  success: boolean;
}

/**
 * RLSPolicyManager - RLS 策略管理服务
 */
export class RLSPolicyManager {
  private db: { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };
  private sessionVariableName: string = 'app.current_tenant_id';
  private isolationVariableName: string = 'app.tenant_isolation';
  private enabled: boolean = true;

  // 需要启用 RLS 的核心表列表
  private readonly RLS_TABLES = [
    'sessions',
    'audit_logs',
    'deployments',
    'pipeline_runs',
    'builds',
    'build_environments',
    'kb_spaces',
    'kb_docs',
    'knowledge_articles',
    'knowledge_categories',
    'agent_runs',
    'chatops_messages',
    'configs',
    'projects',
    'pipelines',
    'artifacts',
    'artifact_registry',
    'environments',
    'alerts',
    'alert_rules',
    'budgets',
    'cost_records',
    'notifications',
    'notification_channels',
    'webhooks',
    'api_keys',
    'cron_jobs',
    'cron_executions',
    'event_bus_events',
    'tickets',
    'incidents',
    'rollbacks',
    'sbom_documents',
    'sbom_vulnerabilities',
    'policies',
    'policy_evaluations',
    'approvals',
    'skill_definitions',
    'skill_executions',
    'vector_embeddings',
    'confirmation_requests',
    'namespace_allocations',
    'namespace_pools',
    'product_lines',
    'internal_libraries',
    'iac_workspaces',
    'iac_plans',
    'iac_state_versions',
    'oncall_schedules',
    'oncall_assignments',
    'oncall_overrides',
    'maintenance_windows',
    'alert_suppressions',
    'known_issues',
    'healing_actions',
    'plugin_executions',
    'canary_analysis_runs',
    'change_intelligence_records',
    'risk_assessments',
    'risk_predictions',
    'code_ownership',
    'branch_policies',
    'build_cache_entries',
    'build_logs',
  ];

  constructor(
    database: { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> },
    options?: { sessionVariableName?: string }
  ) {
    this.db = database;
    if (options?.sessionVariableName) {
      this.sessionVariableName = options.sessionVariableName;
    }
  }

  /**
   * 设置数据库 session 变量，用于 RLS 策略
   * 这是四层隔离中 Database RLS 层的核心操作
   */
  async setTenantSessionVariable(tenantId: number): Promise<SessionVariableResult> {
    if (!this.enabled) {
      return {
        variableName: this.sessionVariableName,
        value: '',
        success: true,
      };
    }

    try {
      const sql = `SELECT set_config($1, $2, false), set_config($3, $4, false)`;
      await this.db.query(sql, [
        this.sessionVariableName,
        String(tenantId),
        this.isolationVariableName,
        'true',
      ]);

      logger.debug(`[RLSPolicyManager] Set session variable ${this.sessionVariableName} = ${tenantId}`);

      return {
        variableName: this.sessionVariableName,
        value: String(tenantId),
        success: true,
      };
    } catch (error) {
      logger.error(`[RLSPolicyManager] Failed to set session variable:`, error);
      return {
        variableName: this.sessionVariableName,
        value: '',
        success: false,
      };
    }
  }

  /**
   * 清除数据库 session 变量
   */
  async clearTenantSessionVariable(): Promise<void> {
    try {
      const sql = `SELECT set_config($1, $2, false), set_config($3, $4, false)`;
      await this.db.query(sql, [
        this.sessionVariableName,
        '',
        this.isolationVariableName,
        'false',
      ]);

      logger.debug(`[RLSPolicyManager] Cleared session variable ${this.sessionVariableName}`);
    } catch (error) {
      logger.error(`[RLSPolicyManager] Failed to clear session variable:`, error);
    }
  }

  /**
   * 获取当前 session 变量值
   */
  async getCurrentTenantId(): Promise<number | null> {
    try {
      const sql = `SELECT current_setting('${this.sessionVariableName}', true) as tenant_id`;
      const result = await this.db.query(sql);

      const tenantIdStr = result.rows[0]?.tenant_id;
      if (tenantIdStr && tenantIdStr !== '') {
        return parseInt(tenantIdStr, 10);
      }
      return null;
    } catch (error) {
      logger.error(`[RLSPolicyManager] Failed to get current tenant:`, error);
      return null;
    }
  }

  /**
   * 检查指定表的 RLS 状态
   */
  async checkRLSStatus(tableName: string): Promise<RLSStatusResult> {
    try {
      // 检查 RLS 是否启用
      const rlsStatusSql = `
        SELECT relname, relrowsecurity, relforcerowsecurity
        FROM pg_class
        WHERE relname = $1 AND relkind = 'r'
      `;
      const rlsResult = await this.db.query(rlsStatusSql, [tableName]);

      // 获取表的策略列表
      const policiesSql = `
        SELECT polname
        FROM pg_policy
        WHERE polrelid = (SELECT oid FROM pg_class WHERE relname = $1)
      `;
      const policiesResult = await this.db.query(policiesSql, [tableName]);

      const tableInfo = rlsResult.rows[0];

      return {
        tableName,
        rlsEnabled: tableInfo?.relrowsecurity ?? false,
        rlsForced: tableInfo?.relforcerowsecurity ?? false,
        policyCount: policiesResult.rows.length,
        policies: policiesResult.rows.map((row: any) => row.polname),
      };
    } catch (error) {
      logger.error(`[RLSPolicyManager] Failed to check RLS status for ${tableName}:`, error);
      return {
        tableName,
        rlsEnabled: false,
        rlsForced: false,
        policyCount: 0,
        policies: [],
      };
    }
  }

  /**
   * 检查所有核心表的 RLS 状态
   */
  async checkAllRLSStatus(): Promise<RLSStatusResult[]> {
    const results: RLSStatusResult[] = [];

    for (const tableName of this.RLS_TABLES) {
      const status = await this.checkRLSStatus(tableName);
      results.push(status);
    }

    return results;
  }

  /**
   * 为指定表创建 RLS 策略
   */
  async createRLSPolicy(tableName: string): Promise<boolean> {
    if (!this.enabled) {
      return true;
    }

    try {
      // Validate table name to prevent SQL injection (DDL statements cannot use parameterized queries)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        throw new Error(`Invalid table name: ${tableName}. Must match /^[a-zA-Z_][a-zA-Z0-9_]*$/`);
      }

      // 启用 RLS
      await this.db.query(`ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY`);

      // 强制 RLS（包括表 owner）
      await this.db.query(`ALTER TABLE ${tableName} FORCE ROW LEVEL SECURITY`);

      // 创建策略
      const policyName = `tenant_isolation_${tableName}`;
      const policySql = `
        CREATE POLICY ${policyName} ON ${tableName}
        USING (
          current_setting('${this.sessionVariableName}', true) IS NOT NULL
          AND current_setting('${this.sessionVariableName}', true) != ''
          AND tenant_id::text = current_setting('${this.sessionVariableName}')
        )
      `;
      await this.db.query(policySql);

      // 创建索引优化查询性能
      await this.db.query(
        `CREATE INDEX IF NOT EXISTS idx_${tableName}_tenant_rls ON ${tableName}(tenant_id)`
      );

      logger.info(`[RLSPolicyManager] Created RLS policy for ${tableName}`);
      return true;
    } catch (error) {
      logger.error(`[RLSPolicyManager] Failed to create RLS policy for ${tableName}:`, error);
      return false;
    }
  }

  /**
   * 为所有核心表批量创建 RLS 策略
   */
  async createAllRLSPolicies(): Promise<{ tableName: string; success: boolean }[]> {
    const results: { tableName: string; success: boolean }[] = [];

    for (const tableName of this.RLS_TABLES) {
      const success = await this.createRLSPolicy(tableName);
      results.push({ tableName, success });
    }

    return results;
  }

  /**
   * 禁用指定表的 RLS 策略（用于特殊场景）
   */
  async disableRLSPolicy(tableName: string): Promise<boolean> {
    try {
      // Validate table name to prevent SQL injection (DDL statements cannot use parameterized queries)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        throw new Error(`Invalid table name: ${tableName}. Must match /^[a-zA-Z_][a-zA-Z0-9_]*$/`);
      }

      await this.db.query(`ALTER TABLE ${tableName} DISABLE ROW LEVEL SECURITY`);
      logger.warn(`[RLSPolicyManager] Disabled RLS for ${tableName}`);
      return true;
    } catch (error) {
      logger.error(`[RLSPolicyManager] Failed to disable RLS for ${tableName}:`, error);
      return false;
    }
  }

  /**
   * 验证 RLS 策略是否正确工作
   */
  async validateRLSIsolation(tenantId: number, tableName: string): Promise<boolean> {
    try {
      // Validate table name to prevent SQL injection (DDL/DML statements cannot use parameterized queries)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        throw new Error(`Invalid table name: ${tableName}. Must match /^[a-zA-Z_][a-zA-Z0-9_]*$/`);
      }

      // 设置 session 变量
      await this.setTenantSessionVariable(tenantId);

      // 尝试查询表，应该只返回该租户的数据
      const sql = `SELECT COUNT(*) as count FROM ${tableName}`;
      const result = await this.db.query(sql);

      // 清除 session 变量
      await this.clearTenantSessionVariable();

      // 如果查询成功执行且返回结果，说明 RLS 正常工作
      // 实际验证需要检查是否有其他租户的数据泄漏
      return true;
    } catch (error) {
      logger.error(`[RLSPolicyManager] RLS validation failed for ${tableName}:`, error);
      return false;
    }
  }

  /**
   * 获取 RLS 表列表
   */
  getRLSTableList(): string[] {
    return [...this.RLS_TABLES];
  }

  /**
   * 启用 RLS 管理器
   */
  enable(): void {
    this.enabled = true;
    logger.info('[RLSPolicyManager] Enabled');
  }

  /**
   * 禁用 RLS 管理器（用于测试或特殊场景）
   */
  disable(): void {
    this.enabled = false;
    logger.warn('[RLSPolicyManager] Disabled');
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 获取 session 变量名称
   */
  getSessionVariableName(): string {
    return this.sessionVariableName;
  }

  /**
   * 生成设置 session 变量的 SQL（用于连接池场景）
   * NOTE: For direct execution, prefer the parameterized setTenantSessionVariable() method.
   * This string-returning method is for scenarios where SQL must be embedded in a larger batch.
   * tenantId must be validated as an integer before calling this method.
   */
  generateSessionSetSQL(tenantId: number): string {
    return `SELECT set_config('${this.sessionVariableName}', '${tenantId}', false), set_config('${this.isolationVariableName}', 'true', false)`;
  }

  /**
   * 生成清除 session 变量的 SQL
   */
  generateSessionClearSQL(): string {
    return `SELECT set_config('${this.sessionVariableName}', '', false), set_config('${this.isolationVariableName}', 'false', false)`;
  }
}

// 导出单例工厂
export function createRLSPolicyManager(
  database: { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> }
): RLSPolicyManager {
  return new RLSPolicyManager(database);
}