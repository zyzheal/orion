/**
 * 数据库 DevOps API 路由
 *
 * 前缀: /api/v1/database-devops
 *
 * 功能模块:
 * - SQL 审核
 * - 慢查询分析
 * - 敏感数据发现与脱敏
 * - Schema 变更管理
 * - 数据库健康检查
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  SQLAuditService,
  AuditRequest,
  AuditHistoryQuery,
  SQLStatementType,
  AuditSeverity,
  SlowQueryAnalyzer,
  SlowQueryEntry,
  SensitiveDataDetector,
  MaskRequest,
  SensitiveDataType,
  SchemaChangeManager,
  CreateChangeRequest,
  ReviewRequest,
  ChangeType,
  ChangeStatus,
} from '../services/database';

export interface DatabaseDevOpsRoutesOptions {
  sqlAuditService?: SQLAuditService;
  slowQueryAnalyzer?: SlowQueryAnalyzer;
  sensitiveDataDetector?: SensitiveDataDetector;
  schemaChangeManager?: SchemaChangeManager;
}

export default async function databaseDevOpsRoutes(
  app: FastifyInstance,
  options: DatabaseDevOpsRoutesOptions
): Promise<void> {
  // 初始化服务
  const sqlAudit = options.sqlAuditService || new SQLAuditService();
  const slowQuery = options.slowQueryAnalyzer || new SlowQueryAnalyzer();
  const sensitiveData = options.sensitiveDataDetector || new SensitiveDataDetector();
  const schemaChange = options.schemaChangeManager || new SchemaChangeManager();

  // ==================== SQL 审核 ====================

  /**
   * POST /api/v1/database-devops/sql-audit
   * 审核 SQL 语句
   */
  app.post(
    '/sql-audit',
    async (
      request: FastifyRequest<{ Body: AuditRequest }>,
      reply: FastifyReply
    ) => {
      const { sql, database, table, tenantId, userId, includeExplain } = request.body;

      if (!sql) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'sql is required',
        });
      }

      const result = await sqlAudit.audit({
        sql,
        database,
        table,
        tenantId,
        userId,
        includeExplain,
      });

      return reply.status(201).send({
        data: result,
      });
    }
  );

  /**
   * POST /api/v1/database-devops/sql-audit/batch
   * 批量审核
   */
  app.post(
    '/sql-audit/batch',
    async (
      request: FastifyRequest<{ Body: { requests: AuditRequest[] } }>,
      reply: FastifyReply
    ) => {
      const { requests } = request.body;
      if (!requests || !Array.isArray(requests) || requests.length === 0) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'requests array is required',
        });
      }

      const results = await sqlAudit.auditBatch(requests);
      return reply.send({
        data: results,
        meta: { total: results.length },
      });
    }
  );

  /**
   * GET /api/v1/database-devops/sql-audit/history
   * 获取审核历史
   */
  app.get(
    '/sql-audit/history',
    async (
      request: FastifyRequest<{
        Querystring: {
          tenantId?: string;
          statementType?: SQLStatementType;
          approved?: string;
          minRiskScore?: string;
          since?: string;
          limit?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { tenantId, statementType, approved, minRiskScore, since, limit } = request.query;
      const history = sqlAudit.getHistory({
        tenantId,
        statementType,
        approved: approved !== undefined ? approved === 'true' : undefined,
        minRiskScore: minRiskScore ? parseInt(minRiskScore, 10) : undefined,
        since: since ? new Date(since) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      });

      return reply.send({
        data: history,
        meta: { total: history.length },
      });
    }
  );

  /**
   * GET /api/v1/database-devops/sql-audit/stats
   * 获取审核统计
   */
  app.get(
    '/sql-audit/stats',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const stats = sqlAudit.getStats();
      return reply.send({ data: stats });
    }
  );

  /**
   * GET /api/v1/database-devops/sql-audit/rules
   * 获取审核规则列表
   */
  app.get(
    '/sql-audit/rules',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const rules = sqlAudit.getRules();
      return reply.send({
        data: rules,
        meta: { total: rules.length },
      });
    }
  );

  /**
   * PATCH /api/v1/database-devops/sql-audit/rules/:id
   * 更新规则启用状态
   */
  app.patch(
    '/sql-audit/rules/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { enabled: boolean };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { enabled } = request.body;
      const success = sqlAudit.setRuleEnabled(id, enabled);
      if (!success) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Rule ${id} not found`,
        });
      }
      return reply.send({ data: { success: true } });
    }
  );

  // ==================== 慢查询分析 ====================

  /**
   * POST /api/v1/database-devops/slow-query/collect
   * 收集慢查询
   */
  app.post(
    '/slow-query/collect',
    async (
      request: FastifyRequest<{ Body: Omit<SlowQueryEntry, 'id' | 'normalizedSql' | 'fingerprint'> }>,
      reply: FastifyReply
    ) => {
      const entry = slowQuery.collect(request.body);
      return reply.status(201).send({ data: entry });
    }
  );

  /**
   * GET /api/v1/database-devops/slow-query/stats
   * 获取慢查询统计
   */
  app.get(
    '/slow-query/stats',
    async (
      request: FastifyRequest<{
        Querystring: { database?: string; since?: string; until?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { database, since, until } = request.query;
      const stats = slowQuery.getStats({
        database,
        since: since ? new Date(since) : undefined,
        until: until ? new Date(until) : undefined,
      });
      return reply.send({ data: stats });
    }
  );

  /**
   * GET /api/v1/database-devops/slow-query/top
   * 获取 Top N 慢查询
   */
  app.get(
    '/slow-query/top',
    async (
      request: FastifyRequest<{
        Querystring: { n?: string; database?: string; since?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { n, database, since } = request.query;
      const topN = slowQuery.getTopN(
        n ? parseInt(n, 10) : 10,
        { database, since: since ? new Date(since) : undefined }
      );
      return reply.send({
        data: topN,
        meta: { total: topN.length },
      });
    }
  );

  /**
   * GET /api/v1/database-devops/slow-query/trend
   * 获取慢查询趋势
   */
  app.get(
    '/slow-query/trend',
    async (
      request: FastifyRequest<{
        Querystring: {
          database?: string;
          since?: string;
          until?: string;
          granularity?: 'hour' | 'day';
        };
      }>,
      reply: FastifyReply
    ) => {
      const { database, since, until, granularity } = request.query;
      const trend = slowQuery.getTrend({
        database,
        since: since ? new Date(since) : undefined,
        until: until ? new Date(until) : undefined,
        granularity,
      });
      return reply.send({ data: trend });
    }
  );

  /**
   * GET /api/v1/database-devops/slow-query/distribution
   * 获取慢查询分布
   */
  app.get(
    '/slow-query/distribution',
    async (
      request: FastifyRequest<{
        Querystring: { since?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { since } = request.query;
      const distribution = slowQuery.getDistribution({
        since: since ? new Date(since) : undefined,
      });
      return reply.send({ data: distribution });
    }
  );

  /**
   * GET /api/v1/database-devops/slow-query/alerts
   * 获取慢查询告警
   */
  app.get(
    '/slow-query/alerts',
    async (
      request: FastifyRequest<{ Querystring: { limit?: string } }>,
      reply: FastifyReply
    ) => {
      const { limit } = request.query;
      const alerts = slowQuery.getAlerts(limit ? parseInt(limit, 10) : 50);
      return reply.send({
        data: alerts,
        meta: { total: alerts.length },
      });
    }
  );

  // ==================== 敏感数据发现 ====================

  /**
   * POST /api/v1/database-devops/sensitive-data/detect
   * 检测敏感数据
   */
  app.post(
    '/sensitive-data/detect',
    async (
      request: FastifyRequest<{ Body: { value: string } }>,
      reply: FastifyReply
    ) => {
      const { value } = request.body;
      if (!value) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'value is required',
        });
      }

      const result = sensitiveData.detect(value);
      return reply.send({ data: result });
    }
  );

  /**
   * POST /api/v1/database-devops/sensitive-data/mask
   * 脱敏处理
   */
  app.post(
    '/sensitive-data/mask',
    async (
      request: FastifyRequest<{ Body: MaskRequest }>,
      reply: FastifyReply
    ) => {
      const { value, type, strategy, options } = request.body;
      if (!value || !type) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'value and type are required',
        });
      }

      const result = sensitiveData.mask({ value, type, strategy, options });
      return reply.send({ data: result });
    }
  );

  /**
   * POST /api/v1/database-devops/sensitive-data/scan
   * 扫描数据库
   */
  app.post(
    '/sensitive-data/scan',
    async (
      request: FastifyRequest<{ Body: { database: string; tables?: string[] } }>,
      reply: FastifyReply
    ) => {
      const { database, tables } = request.body;
      if (!database) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'database is required',
        });
      }

      const report = await sensitiveData.scanDatabase(database, tables);
      return reply.send({ data: report });
    }
  );

  /**
   * GET /api/v1/database-devops/sensitive-data/scan-history
   * 获取扫描历史
   */
  app.get(
    '/sensitive-data/scan-history',
    async (
      request: FastifyRequest<{ Querystring: { limit?: string } }>,
      reply: FastifyReply
    ) => {
      const { limit } = request.query;
      const history = sensitiveData.getScanHistory(limit ? parseInt(limit, 10) : 20);
      return reply.send({
        data: history,
        meta: { total: history.length },
      });
    }
  );

  /**
   * GET /api/v1/database-devops/sensitive-data/rules
   * 获取脱敏规则
   */
  app.get(
    '/sensitive-data/rules',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const rules = sensitiveData.getRules();
      return reply.send({
        data: rules,
        meta: { total: rules.length },
      });
    }
  );

  /**
   * GET /api/v1/database-devops/sensitive-data/stats
   * 获取敏感数据统计
   */
  app.get(
    '/sensitive-data/stats',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const stats = sensitiveData.getStats();
      return reply.send({ data: stats });
    }
  );

  // ==================== Schema 变更管理 ====================

  /**
   * POST /api/v1/database-devops/schema-changes
   * 创建变更
   */
  app.post(
    '/schema-changes',
    async (
      request: FastifyRequest<{ Body: CreateChangeRequest }>,
      reply: FastifyReply
    ) => {
      const { database, tableName, changeType, title, description, sql, rollbackSql, createdBy, tags, metadata } = request.body;

      if (!database || !tableName || !changeType || !title || !sql || !createdBy) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'database, tableName, changeType, title, sql, and createdBy are required',
        });
      }

      const change = schemaChange.createChange({
        database,
        tableName,
        changeType,
        title,
        description: description || '',
        sql,
        rollbackSql,
        createdBy,
        tags,
        metadata,
      });

      return reply.status(201).send({ data: change });
    }
  );

  /**
   * GET /api/v1/database-devops/schema-changes
   * 查询变更列表
   */
  app.get(
    '/schema-changes',
    async (
      request: FastifyRequest<{
        Querystring: {
          database?: string;
          tableName?: string;
          status?: ChangeStatus;
          changeType?: ChangeType;
          createdBy?: string;
          since?: string;
          limit?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { database, tableName, status, changeType, createdBy, since, limit } = request.query;
      const changes = schemaChange.queryChanges({
        database,
        tableName,
        status,
        changeType,
        createdBy,
        since: since ? new Date(since) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      });

      return reply.send({
        data: changes,
        meta: { total: changes.length },
      });
    }
  );

  /**
   * GET /api/v1/database-devops/schema-changes/:id
   * 获取变更详情
   */
  app.get(
    '/schema-changes/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const change = schemaChange.getChange(id);
      if (!change) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Change ${id} not found`,
        });
      }
      return reply.send({ data: change });
    }
  );

  /**
   * POST /api/v1/database-devops/schema-changes/:id/review
   * 审批变更
   */
  app.post(
    '/schema-changes/:id/review',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { approved: boolean; reviewedBy: string; comment: string };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { approved, reviewedBy, comment } = request.body;

      if (approved === undefined || !reviewedBy) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'approved and reviewedBy are required',
        });
      }

      try {
        const change = schemaChange.reviewChange({
          changeId: id,
          approved,
          reviewedBy,
          comment: comment || '',
        });
        return reply.send({ data: change });
      } catch (error: any) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /api/v1/database-devops/schema-changes/:id/execute
   * 执行变更
   */
  app.post(
    '/schema-changes/:id/execute',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      try {
        const result = await schemaChange.executeChange(id);
        return reply.send({ data: result });
      } catch (error: any) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /api/v1/database-devops/schema-changes/:id/rollback
   * 回滚变更
   */
  app.post(
    '/schema-changes/:id/rollback',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      try {
        const result = await schemaChange.rollbackChange(id);
        return reply.send({ data: result });
      } catch (error: any) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /api/v1/database-devops/schema-changes/stats
   * 获取变更统计
   */
  app.get(
    '/schema-changes/stats',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const stats = schemaChange.getStats();
      return reply.send({ data: stats });
    }
  );

  /**
   * GET /api/v1/database-devops/schema-changes/versions/:database
   * 获取数据库版本历史
   */
  app.get(
    '/schema-changes/versions/:database',
    async (
      request: FastifyRequest<{ Params: { database: string } }>,
      reply: FastifyReply
    ) => {
      const { database } = request.params;
      const versions = schemaChange.getVersionHistory(database);
      return reply.send({
        data: versions,
        meta: { total: versions.length },
      });
    }
  );

  // ==================== 数据库健康检查 ====================

  /**
   * GET /api/v1/database-devops/health-check
   * 综合健康检查
   */
  app.get(
    '/health-check',
    async (
      request: FastifyRequest<{
        Querystring: { database?: string };
      }>,
      reply: FastifyReply
    ) => {
      // 汇总各服务状态
      const sqlAuditStats = sqlAudit.getStats();
      const slowQueryStats = slowQuery.getStats();
      const sensitiveDataStats = sensitiveData.getStats();
      const schemaChangeStats = schemaChange.getStats();

      const health = {
        status: 'healthy',
        timestamp: new Date(),
        components: {
          sqlAudit: {
            status: 'healthy',
            totalAudits: sqlAuditStats.totalAudits,
            averageRiskScore: sqlAuditStats.averageRiskScore,
          },
          slowQuery: {
            status: slowQueryStats.p95QueryTime > 10 ? 'warning' : 'healthy',
            totalQueries: slowQueryStats.totalQueries,
            p95QueryTime: slowQueryStats.p95QueryTime,
          },
          sensitiveData: {
            status: 'healthy',
            totalScans: sensitiveDataStats.totalScans,
            sensitiveFieldsFound: sensitiveDataStats.totalSensitiveFields,
          },
          schemaChange: {
            status: 'healthy',
            totalChanges: schemaChangeStats.total,
            successRate: schemaChangeStats.successRate,
          },
        },
      };

      // 如果任一组件有问题，更新整体状态
      const hasWarning = Object.values(health.components).some((c) => c.status === 'warning');
      if (hasWarning) {
        health.status = 'warning';
      }

      return reply.send({ data: health });
    }
  );
}
