/**
 * RiskAssessmentService 单元测试
 *
 * 使用内存模拟的 db.query 代替真实 PostgreSQL 连接
 */

import { RiskAssessmentService } from '../RiskAssessmentService';
import { DeploymentRisk, RiskLevel } from '../types';

jest.mock('@/db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
  getCurrentTraceId: () => 'test-trace-id',
}));

/**
 * 创建内存模拟的 db 对象，支持 INSERT/SELECT/DELETE 操作
 */
function createMockDb() {
  const tables: Record<string, any[]> = {
    risk_assessments: [],
    risk_reports: [],
  };
  let idCounter = 0;

  const db = {
    async query(text: string, params: unknown[] = []) {
      const sql = text.trim();

      // INSERT ... RETURNING *
      const insertMatch = sql.match(/^INSERT INTO (\w+)\s+\(([^)]+)\)\s+VALUES\s+\(([^)]+)\)\s+RETURNING \*$/i);
      if (insertMatch) {
        const table = insertMatch[1];
        const columns = insertMatch[2].split(',').map(c => c.trim());
        const row: Record<string, any> = { id: `auto-id-${++idCounter}` };
        columns.forEach((col, i) => {
          row[col] = params[i] ?? null;
        });
        if (!row.created_at) row.created_at = new Date();
        if (!row.updated_at) row.updated_at = new Date();
        tables[table].push(row);
        return { rows: [row], rowCount: 1 };
      }

      // SELECT COUNT(*)
      const countMatch = sql.match(/^SELECT COUNT\(\*\) as count FROM (\w+)(.*)$/i);
      if (countMatch) {
        const table = countMatch[1];
        const whereClause = countMatch[2];
        let rows = [...tables[table]];
        rows = applyWhere(rows, whereClause, params);
        return { rows: [{ count: String(rows.length) }], rowCount: 1 };
      }

      // SELECT * with WHERE, ORDER BY, LIMIT, OFFSET
      if (sql.startsWith('SELECT')) {
        const tableMatch = sql.match(/FROM\s+(\w+)/i);
        if (!tableMatch) return { rows: [], rowCount: 0 };
        const table = tableMatch[1];
        let rows = [...(tables[table] || [])];

        // Apply WHERE clauses
        rows = applyWhere(rows, sql, params);

        // Apply ORDER BY
        const orderMatch = sql.match(/ORDER BY\s+(\w+)\s+(ASC|DESC)/i);
        if (orderMatch) {
          const col = orderMatch[1];
          const dir = orderMatch[2].toUpperCase();
          rows.sort((a, b) => {
            const av = a[col] ?? '';
            const bv = b[col] ?? '';
            if (av < bv) return dir === 'ASC' ? -1 : 1;
            if (av > bv) return dir === 'ASC' ? 1 : -1;
            return 0;
          });
        }

        // Apply LIMIT
        const limitMatch = sql.match(/LIMIT\s+\$(\d+)/i);
        if (limitMatch) {
          const limitIdx = parseInt(limitMatch[1]) - 1;
          const limit = params[limitIdx] as number;
          rows = rows.slice(0, limit);
        }

        // Apply OFFSET
        const offsetMatch = sql.match(/OFFSET\s+\$(\d+)/i);
        if (offsetMatch) {
          const offsetIdx = parseInt(offsetMatch[1]) - 1;
          const offset = params[offsetIdx] as number;
          rows = rows.slice(offset);
        }

        return { rows, rowCount: rows.length };
      }

      // DELETE
      if (sql.startsWith('DELETE')) {
        const deleteMatch = sql.match(/DELETE FROM (\w+) WHERE id = \$1/i);
        if (deleteMatch) {
          const table = deleteMatch[1];
          const before = tables[table].length;
          tables[table] = tables[table].filter(r => r.id !== params[0]);
          return { rowCount: before - tables[table].length, rows: [] };
        }
      }

      return { rows: [], rowCount: 0 };
    },

    /** 获取表数据的快照（测试断言用） */
    getTableData(table: string) {
      return tables[table] || [];
    },

    /** 清空所有表 */
    clearAll() {
      for (const key of Object.keys(tables)) {
        tables[key] = [];
      }
    },
  };

  return db;
}

/**
 * 从 SQL WHERE 子句中提取条件并过滤行
 */
function applyWhere(rows: any[], sql: string, params: unknown[]): any[] {
  // 提取所有 "column = $N" 条件
  const conditions: Array<{ col: string; paramIdx: number }> = [];
  const regex = /(\w+)\s*=\s*\$(\d+)/g;
  let match;
  while ((match = regex.exec(sql)) !== null) {
    // 跳过 WHERE 之前的部分（SELECT 子句中可能有 $N）
    const wherePos = sql.indexOf('WHERE');
    if (wherePos >= 0 && match.index < wherePos) continue;
    conditions.push({ col: match[1], paramIdx: parseInt(match[2]) - 1 });
  }

  if (conditions.length === 0) return rows;

  return rows.filter(row => {
    return conditions.every(({ col, paramIdx }) => {
      const val = params[paramIdx];
      // Skip tenant_id filter when value is '__system__' (test context default)
      if (col === 'tenant_id' && val === '__system__') return true;
      // 支持 snake_case 和 camelCase 列名匹配
      return row[col] === val || row[toCamelCase(col)] === val;
    });
  });
}

function toCamelCase(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

describe('RiskAssessmentService', () => {
  let service: RiskAssessmentService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new RiskAssessmentService(mockDb as any);
  });

  // ==================== assessDeploymentRisk ====================

  describe('assessDeploymentRisk', () => {
    const baseDeploymentRisk: DeploymentRisk = {
      changeScope: ['service-a'],
      changeSize: { filesChanged: 5, linesChanged: 100 },
      timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
      dependencyRisk: { totalDependencies: 2, unhealthyDependencies: 0, criticalDependencies: [] },
      historicalRisk: { recentFailureRate: 0.05, recentIncidents: 0, averageMTTR: 300000 },
    };

    it('should return a complete risk assessment', async () => {
      const assessment = await service.assessDeploymentRisk({
        deploymentId: 'deploy-1',
        deploymentRisk: baseDeploymentRisk,
        tenantId: 'test-tenant',
      });

      expect(assessment.id).toBeDefined();
      expect(assessment.targetType).toBe('deployment');
      expect(assessment.targetId).toBe('deploy-1');
      expect(assessment.riskScore).toBeGreaterThanOrEqual(0);
      expect(assessment.riskScore).toBeLessThanOrEqual(100);
      expect(assessment.riskLevel).toBeDefined();
      expect(assessment.factors.length).toBeGreaterThan(0);
      expect(assessment.recommendations.length).toBeGreaterThanOrEqual(0);
      expect(assessment.createdAt).toBeInstanceOf(Date);
    });

    it('should persist assessment to database', async () => {
      await service.assessDeploymentRisk({
        deploymentId: 'deploy-persist',
        deploymentRisk: baseDeploymentRisk,
        tenantId: 'test-tenant',
      });

      expect(mockDb.getTableData('risk_assessments').length).toBe(1);
      expect(mockDb.getTableData('risk_assessments')[0].target_id).toBe('deploy-persist');
    });

    it('should include tenant ID', async () => {
      const assessment = await service.assessDeploymentRisk({
        deploymentId: 'deploy-2',
        deploymentRisk: baseDeploymentRisk,
        tenantId: 'test-tenant',
      });

      expect(assessment.tenantId).toBe('test-tenant');
    });

    it('should include health check results when requested', async () => {
      const assessment = await service.assessDeploymentRisk({
        deploymentId: 'deploy-3',
        deploymentRisk: baseDeploymentRisk,
        tenantId: 'test-tenant',
        runHealthChecks: true,
        healthCheckParams: {
          pipelineStatus: 'success',
          testResults: { total: 100, passed: 100, failed: 0 },
          codeReviewStatus: 'approved',
        },
      });

      expect(assessment.metadata).toBeDefined();
      expect(assessment.metadata?.healthCheckResult).toBeDefined();
      expect(assessment.metadata?.healthCheckResult.canProceed).toBe(true);
    });

    it('should add block recommendation when health check fails', async () => {
      const assessment = await service.assessDeploymentRisk({
        deploymentId: 'deploy-4',
        deploymentRisk: baseDeploymentRisk,
        tenantId: 'test-tenant',
        runHealthChecks: true,
        healthCheckParams: {
          pipelineStatus: 'failed',
          testResults: { total: 100, passed: 100, failed: 0 },
          codeReviewStatus: 'approved',
        },
      });

      const blockRecs = assessment.recommendations.filter((r) => r.type === 'block');
      expect(blockRecs.length).toBeGreaterThan(0);
    });

    it('should assess high risk for risky deployment', async () => {
      const riskyDeployment: DeploymentRisk = {
        changeScope: Array.from({ length: 8 }, (_, i) => `service-${i}`),
        changeSize: { filesChanged: 100, linesChanged: 10000 },
        timeRisk: { isWeekend: true, isAfterHours: true, isHoliday: false, isFriday: false },
        dependencyRisk: {
          totalDependencies: 15,
          unhealthyDependencies: 2,
          criticalDependencies: ['db', 'cache'],
        },
        historicalRisk: { recentFailureRate: 0.30, recentIncidents: 4, averageMTTR: 7200000 },
      };

      const assessment = await service.assessDeploymentRisk({
        deploymentId: 'deploy-5',
        deploymentRisk: riskyDeployment,
        tenantId: 'test-tenant',
      });

      expect(assessment.riskLevel).toBe('High');
    });
  });

  // ==================== assessChangeRisk ====================

  describe('assessChangeRisk', () => {
    it('should return a change risk assessment', async () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 10, linesChanged: 200 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 3, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.05, recentIncidents: 0, averageMTTR: 300000 },
      };

      const assessment = await service.assessChangeRisk({
        changeId: 'change-1',
        deploymentRisk,
        tenantId: 'test-tenant',
      });

      expect(assessment.id).toBeDefined();
      expect(assessment.targetType).toBe('change');
      expect(assessment.targetId).toBe('change-1');
      expect(assessment.riskScore).toBeGreaterThanOrEqual(0);
      expect(assessment.riskScore).toBeLessThanOrEqual(100);
    });

    it('should include tenant ID', async () => {
      const deploymentRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 5, linesChanged: 100 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 1, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.01, recentIncidents: 0, averageMTTR: 120000 },
      };

      const assessment = await service.assessChangeRisk({
        changeId: 'change-2',
        deploymentRisk,
        tenantId: 'test-tenant',
      });

      expect(assessment.tenantId).toBe('test-tenant');
    });
  });

  // ==================== getAssessmentHistory ====================

  describe('getAssessmentHistory', () => {
    beforeEach(async () => {
      const baseRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 5, linesChanged: 100 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 1, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.05, recentIncidents: 0, averageMTTR: 300000 },
      };

      await service.assessDeploymentRisk({
        deploymentId: 'deploy-h1',
        deploymentRisk: baseRisk,
        tenantId: 'test-tenant',
      });

      await service.assessDeploymentRisk({
        deploymentId: 'deploy-h2',
        deploymentRisk: baseRisk,
        tenantId: 'test-tenant',
      });

      await service.assessChangeRisk({
        changeId: 'change-h1',
        deploymentRisk: baseRisk,
        tenantId: 'test-tenant',
      });
    });

    it('should return all assessments by default', async () => {
      const history = await service.getAssessmentHistory();
      expect(history.length).toBe(3);
    });

    it('should filter by targetType', async () => {
      const history = await service.getAssessmentHistory({ targetType: 'deployment' });
      expect(history.length).toBe(2);
      history.forEach((a) => expect(a.targetType).toBe('deployment'));
    });

    it('should filter by tenantId', async () => {
      const history = await service.getAssessmentHistory({ tenantId: 'test-tenant' });
      expect(history.length).toBe(3);
    });

    it('should filter by targetId', async () => {
      const history = await service.getAssessmentHistory({ targetId: 'deploy-h1' });
      expect(history.length).toBe(1);
      expect(history[0].targetId).toBe('deploy-h1');
    });

    it('should limit results', async () => {
      const history = await service.getAssessmentHistory({ limit: 2 });
      expect(history.length).toBe(2);
    });
  });

  // ==================== getAssessmentById ====================

  describe('getAssessmentById', () => {
    it('should return assessment by ID', async () => {
      const assessment = await service.assessDeploymentRisk({
        deploymentId: 'deploy-id-1',
        deploymentRisk: {
          changeScope: ['service-a'],
          changeSize: { filesChanged: 5, linesChanged: 100 },
          timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
          dependencyRisk: { totalDependencies: 1, unhealthyDependencies: 0, criticalDependencies: [] },
          historicalRisk: { recentFailureRate: 0.05, recentIncidents: 0, averageMTTR: 300000 },
        },
        tenantId: 'test-tenant',
      });

      // 查找数据库中对应的记录
      const dbRows = mockDb.getTableData('risk_assessments');
      const dbRow = dbRows.find(r => r.target_id === 'deploy-id-1');
      expect(dbRow).toBeDefined();

      const found = await service.getAssessmentById(dbRow.id);
      expect(found).toBeDefined();
      expect(found!.targetId).toBe('deploy-id-1');
    });

    it('should return undefined for non-existent ID', async () => {
      const found = await service.getAssessmentById('non-existent');
      expect(found).toBeUndefined();
    });
  });

  // ==================== generateReport ====================

  describe('generateReport', () => {
    it('should generate a complete risk report', async () => {
      await service.assessDeploymentRisk({
        deploymentId: 'deploy-r1',
        deploymentRisk: {
          changeScope: ['service-a', 'service-b'],
          changeSize: { filesChanged: 20, linesChanged: 500 },
          timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
          dependencyRisk: { totalDependencies: 5, unhealthyDependencies: 0, criticalDependencies: [] },
          historicalRisk: { recentFailureRate: 0.10, recentIncidents: 1, averageMTTR: 600000 },
        },
        tenantId: 'test-tenant',
      });

      // 获取 assessment 的 ID（来自数据库）
      const dbAssessments = mockDb.getTableData('risk_assessments');
      const assessmentRow = dbAssessments.find(r => r.target_id === 'deploy-r1');
      expect(assessmentRow).toBeDefined();

      const report = await service.generateReport(assessmentRow.id);

      expect(report).not.toBeNull();
      expect(report!.id).toBeDefined();
      expect(report!.assessmentId).toBe(assessmentRow.id);
      expect(report!.summary.riskScore).toBeGreaterThanOrEqual(0);
      expect(report!.summary.riskLevel).toBeDefined();
      expect(report!.generatedAt).toBeInstanceOf(Date);

      // 验证报告已持久化
      expect(mockDb.getTableData('risk_reports').length).toBe(1);
    });

    it('should return null for non-existent assessment', async () => {
      const report = await service.generateReport('non-existent');
      expect(report).toBeNull();
    });
  });

  // ==================== getReportHistory ====================

  describe('getReportHistory', () => {
    beforeEach(async () => {
      const baseRisk: DeploymentRisk = {
        changeScope: ['service-a'],
        changeSize: { filesChanged: 5, linesChanged: 100 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 1, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: { recentFailureRate: 0.05, recentIncidents: 0, averageMTTR: 300000 },
      };

      await service.assessDeploymentRisk({
        deploymentId: 'deploy-rh1',
        deploymentRisk: baseRisk,
        tenantId: 'test-tenant',
      });
      const a1Row = mockDb.getTableData('risk_assessments').find(r => r.target_id === 'deploy-rh1');
      await service.generateReport(a1Row.id);

      await service.assessDeploymentRisk({
        deploymentId: 'deploy-rh2',
        deploymentRisk: baseRisk,
        tenantId: 'test-tenant',
      });
      const a2Row = mockDb.getTableData('risk_assessments').find(r => r.target_id === 'deploy-rh2');
      await service.generateReport(a2Row.id);
    });

    it('should return all reports by default', async () => {
      const reports = await service.getReportHistory();
      expect(reports.length).toBe(2);
    });

    it('should filter by assessmentId', async () => {
      const a1Row = mockDb.getTableData('risk_assessments').find(r => r.target_id === 'deploy-rh1');
      const reports = await service.getReportHistory({ assessmentId: a1Row.id });
      expect(reports.length).toBe(1);
    });

    it('should filter by tenantId', async () => {
      const reports = await service.getReportHistory({ tenantId: 'test-tenant' });
      expect(reports.length).toBe(2);
    });

    it('should limit results', async () => {
      const reports = await service.getReportHistory({ limit: 1 });
      expect(reports.length).toBe(1);
    });
  });

  // ==================== getReportById ====================

  describe('getReportById', () => {
    it('should return report by ID', async () => {
      await service.assessDeploymentRisk({
        deploymentId: 'deploy-rid1',
        deploymentRisk: {
          changeScope: ['service-a'],
          changeSize: { filesChanged: 5, linesChanged: 100 },
          timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
          dependencyRisk: { totalDependencies: 1, unhealthyDependencies: 0, criticalDependencies: [] },
          historicalRisk: { recentFailureRate: 0.05, recentIncidents: 0, averageMTTR: 300000 },
        },
        tenantId: 'test-tenant',
      });

      const aRow = mockDb.getTableData('risk_assessments').find(r => r.target_id === 'deploy-rid1');
      await service.generateReport(aRow.id);

      const reportRow = mockDb.getTableData('risk_reports')[0];
      const found = await service.getReportById(reportRow.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(reportRow.id);
    });

    it('should return undefined for non-existent ID', async () => {
      const found = await service.getReportById('non-existent-report');
      expect(found).toBeUndefined();
    });
  });

  // ==================== Service Accessors ====================

  describe('service accessors', () => {
    it('should return health check service', () => {
      const hcs = service.getHealthCheckService();
      expect(hcs).toBeDefined();
    });

    it('should return scoring engine', () => {
      const se = service.getScoringEngine();
      expect(se).toBeDefined();
    });
  });
});
