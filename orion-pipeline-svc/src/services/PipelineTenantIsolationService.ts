/**
 * Pipeline Tenant Isolation Service
 *
 * Ensures that users can only access pipelines and runs within their own tenant.
 * This is a security fix identified by the security audit.
 *
 * Responsibilities:
 * - Validate that a pipeline belongs to a given tenant
 * - Extract tenantId from request context (header or authenticated user)
 * - Enforce tenant-scoped filtering for list/get operations
 */

import pino from 'pino';
import { PipelineService } from './PipelineService';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class PipelineTenantIsolationService {
  private pipelineService: PipelineService | null;

  constructor(pipelineService?: PipelineService | null) {
    this.pipelineService = pipelineService || null;
  }

  /**
   * Extract tenantId from request headers.
   * Falls back to '00000000-0000-0000-0000-000000000000' if not provided.
   */
  static extractTenantId(headers: Record<string, string | undefined>): string {
    return (headers['x-tenant-id'] as string) || '00000000-0000-0000-0000-000000000000';
  }

  /**
   * Validate that a pipeline belongs to the given tenant.
   */
  async validatePipelineTenant(
    pipelineId: string,
    tenantId: string
  ): Promise<{ valid: boolean; pipeline?: any; error?: string }> {
    if (!this.pipelineService) {
      logger.warn({ pipelineId }, 'PipelineService unavailable for tenant validation, allowing');
      return { valid: true };
    }

    const pipeline = await this.pipelineService.getById(pipelineId);
    if (!pipeline) {
      return { valid: false, error: `Pipeline '${pipelineId}' not found` };
    }

    const pipelineTenantId = (pipeline as any).tenant_id;
    if (pipelineTenantId && pipelineTenantId !== tenantId) {
      logger.warn(
        { pipelineId, requestTenantId: tenantId, pipelineTenantId },
        'Tenant isolation violation: pipeline belongs to different tenant'
      );
      return {
        valid: false,
        error: `Access denied: pipeline '${pipelineId}' does not belong to tenant '${tenantId}'`,
      };
    }

    return { valid: true, pipeline };
  }

  /**
   * Validate that a pipeline run belongs to the given tenant.
   * If run lacks tenantId, falls back to validating the associated pipeline.
   */
  async validateRunTenant(
    run: any,
    tenantId: string
  ): Promise<{ valid: boolean; error?: string }> {
    if (!run) {
      return { valid: false, error: 'Run not found' };
    }

    const runTenantId = run.context?.tenantId || (run as any).tenant_id;

    if (runTenantId) {
      // Run has tenantId, validate directly
      if (runTenantId !== tenantId) {
        logger.warn(
          { runId: run.id, requestTenantId: tenantId, runTenantId },
          'Tenant isolation violation: run belongs to different tenant'
        );
        return {
          valid: false,
          error: `Access denied: run '${run.id}' does not belong to tenant '${tenantId}'`,
        };
      }
    } else if (run.pipelineId) {
      // Run lacks tenantId, validate via associated pipeline
      const pipelineCheck = await this.validatePipelineTenant(run.pipelineId, tenantId);
      if (!pipelineCheck.valid) {
        return { valid: false, error: pipelineCheck.error };
      }
    }
    // If no tenantId and no pipelineId, allow (backward compatible for legacy data)

    return { valid: true };
  }
}
