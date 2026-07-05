/**
 * AuditComplianceMiddleware - 审计日志合规检查中间件
 *
 * SOC2/ISO27001 合规要求：
 * - 确保所有关键操作都被审计记录
 * - 检查审计日志的完整性
 * - 验证审计日志是否包含必要的字段（who/when/what/result/IP/UA）
 *
 * Usage:
 *   // 在 Fastify 路由中注册
 *   app.addHook('onResponse', auditComplianceGuard({ resourceType: 'pipeline' }));
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { AuditService } from '../services/audit/AuditService';
import { AuditComplianceService } from '../services/audit/AuditComplianceService';
import { createLogger } from '../utils/logger';
import { getCurrentTenantId } from '../db/tenant-context-storage';

const logger = createLogger('audit-compliance-middleware');

export interface AuditComplianceGuardOptions {
  /** 资源类型标识 */
  resourceType: string;
  /** 是否启用合规检查（默认 true） */
  enabled?: boolean;
  /** 必须记录的操作方法（默认 ['POST', 'PUT', 'PATCH', 'DELETE']） */
  requiredMethods?: string[];
  /** 是否验证审计日志完整性（默认 true） */
  verifyIntegrity?: boolean;
}

let auditService: AuditService | null = null;
let auditComplianceService: AuditComplianceService | null = null;

export function setAuditComplianceServices(
  service: AuditService | null,
  complianceService: AuditComplianceService | null
): void {
  auditService = service;
  auditComplianceService = complianceService;
}

export function getAuditComplianceServices(): { auditService: AuditService | null; complianceService: AuditComplianceService | null } {
  return { auditService, complianceService: auditComplianceService };
}

/**
 * 创建审计合规检查中间件
 *
 * 该中间件在 onResponse 钩子中执行，确保：
 * 1. 关键操作已被审计记录
 * 2. 审计日志包含必要的合规字段
 * 3. 如发现合规问题，记录告警日志
 */
export function auditComplianceGuard(options: AuditComplianceGuardOptions) {
  const {
    resourceType,
    enabled = true,
    requiredMethods = ['POST', 'PUT', 'PATCH', 'DELETE'],
    verifyIntegrity = true,
  } = options;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!enabled) return;
    if (!requiredMethods.includes(request.method)) return;

    const service = getAuditComplianceServices().auditService;
    if (!service) {
      logger.warn('[AuditCompliance] AuditService not initialized, skipping compliance check');
      return;
    }

    const user = (request as any).user as Record<string, any> | undefined;
    const tenantId = getCurrentTenantId();
    const userId = user?.userId || user?.id || null;

    // 获取最近的审计日志（假设刚写入的日志可以通过 request 上下文关联）
    // 这里我们检查是否有对应的审计日志记录
    const resourceId = (request.params as any)?.id as string | undefined;

    try {
      // 查询最近 5 分钟的审计日志
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const recentLogs = await service.listAuditLogs({
        tenantId,
        userId: userId ?? undefined,
        resourceType,
        limit: 10,
      });

      // 检查是否有对应操作的审计日志
      const matchingLogs = recentLogs.data.filter(log => {
        const logTime = new Date(log.created_at).toISOString();
        return logTime >= fiveMinutesAgo &&
               log.action === methodToAction(request.method) &&
               (!resourceId || log.resource_id === resourceId);
      });

      if (matchingLogs.length === 0) {
        logger.warn({
          tenantId,
          userId,
          resourceType,
          method: request.method,
          path: request.url,
          statusCode: reply.statusCode,
        }, '[AuditCompliance] Missing audit log for critical operation');
      }

      // 检查审计日志字段完整性
      if (matchingLogs.length > 0) {
        const log = matchingLogs[0];
        const missingFields: string[] = [];

        if (!log.user_id) missingFields.push('user_id');
        if (!log.ip_address) missingFields.push('ip_address');
        if (!log.user_agent) missingFields.push('user_agent');
        if (!log.response_code && log.response_code !== 0) missingFields.push('response_code');

        if (missingFields.length > 0) {
          logger.warn({
            logId: log.id,
            missingFields,
            resourceType,
          }, '[AuditCompliance] Audit log missing required fields');
        }
      }

      // 定期验证审计链完整性（每天一次）
      if (verifyIntegrity && getAuditComplianceServices().complianceService) {
        const complianceService = getAuditComplianceServices().complianceService!;
        // 每天只执行一次完整性验证（通过缓存或调度控制）
        const lastVerification = (request as any).lastIntegrityVerification as Date | undefined;
        if (!lastVerification || Date.now() - lastVerification.getTime() > 24 * 60 * 60 * 1000) {
          try {
            await complianceService.checkAnomalyDetection(tenantId);
            (request as any).lastIntegrityVerification = new Date();
          } catch (error) {
            logger.error({ error }, '[AuditCompliance] Integrity verification failed');
          }
        }
      }
    } catch (error) {
      logger.error({ error, tenantId, resourceType }, '[AuditCompliance] Compliance check failed');
    }
  };
}

function methodToAction(method: string): string {
  switch (method) {
    case 'POST': return 'CREATE';
    case 'PUT':
    case 'PATCH': return 'UPDATE';
    case 'DELETE': return 'DELETE';
    default: return method;
  }
}
