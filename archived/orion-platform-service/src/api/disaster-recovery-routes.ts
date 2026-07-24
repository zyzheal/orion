/**
 * Disaster Recovery API Routes
 * 
 * REST API endpoints for disaster recovery management.
 * Supports /api/v1/disaster-recovery/* endpoints.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import {
  DisasterRecoveryRepository,
  DisasterRecoveryService,
  DisasterRecoveryConfig,
  DisasterRecoveryStatus,
  FailoverHistory,
  DRMetrics,
  FailoverResult,
  HealthCheckResult,
  ReplicationStatusResult,
  ClusterStatus,
  CreateConfigInput,
  UpdateConfigInput,
  SyncMode,
  DRError,
  FailoverInProgressError,
  ClusterUnhealthyError,
  LockAcquisitionError,
  ConfigurationError,
} from '../services/disaster-recovery';

// =============================================================================
// Types
// =============================================================================

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: Date;
    requestId?: string;
  };
}

interface CreateConfigRequest {
  name: string;
  primaryClusterId: string;
  primaryClusterEndpoint: string;
  standbyClusterId: string;
  standbyClusterEndpoint: string;
  syncMode?: SyncMode;
  autoFailover?: boolean;
  failoverThresholdSeconds?: number;
  healthCheckIntervalSeconds?: number;
  syncIntervalSeconds?: number;
  rpoTargetSeconds?: number;
  rtoTargetSeconds?: number;
  metadata?: Record<string, unknown>;
}

interface UpdateConfigRequest {
  name?: string;
  primaryClusterId?: string;
  primaryClusterEndpoint?: string;
  standbyClusterId?: string;
  standbyClusterEndpoint?: string;
  syncMode?: SyncMode;
  autoFailover?: boolean;
  failoverThresholdSeconds?: number;
  healthCheckIntervalSeconds?: number;
  syncIntervalSeconds?: number;
  rpoTargetSeconds?: number;
  rtoTargetSeconds?: number;
  status?: string;
  metadata?: Record<string, unknown>;
}

interface FailoverRequest {
  force?: boolean;
  reason?: string;
  skipHealthCheck?: boolean;
  timeout?: number;
}

interface FailbackRequest {
  force?: boolean;
  reason?: string;
  skipHealthCheck?: boolean;
  timeout?: number;
}

// =============================================================================
// Router Factory
// =============================================================================

export function createDisasterRecoveryRoutes(pool: Pool): Router {
  const router = Router();
  const repository = new DisasterRecoveryRepository(pool);
  const service = new DisasterRecoveryService(repository);

  // =============================================================================
  // Helper Functions
  // =============================================================================

  function success<T>(res: Response, data: T, statusCode: number = 200): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
      meta: {
        timestamp: new Date(),
      },
    };
    res.status(statusCode).json(response);
  }

  function error(res: Response, err: Error, statusCode: number = 500): void {
    let code = 'INTERNAL_ERROR';
    let details: Record<string, unknown> | undefined;

    if (err instanceof DRError) {
      code = err.code;
      details = err.details;
    }

    const response: ApiResponse<never> = {
      success: false,
      error: {
        code,
        message: err.message,
        details,
      },
      meta: {
        timestamp: new Date(),
      },
    };
    res.status(statusCode).json(response);
  }

  function getConfigId(req: Request): string {
    const { configId } = req.params;
    if (!configId) {
      throw new DRError('Configuration ID is required', 'MISSING_CONFIG_ID');
    }
    return configId;
  }

  function getActor(req: Request): string | undefined {
    return req.headers['x-user-id'] as string || req.ip;
  }

  // =============================================================================
  // Configuration Routes
  // =============================================================================

  /**
   * @route POST /api/v1/disaster-recovery/configs
   * @description Create a new DR configuration
   */
  router.post('/configs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input: CreateConfigRequest = req.body;

      // Validate required fields
      if (!input.name || !input.primaryClusterId || !input.primaryClusterEndpoint ||
          !input.standbyClusterId || !input.standbyClusterEndpoint) {
        throw new DRError(
          'Missing required fields: name, primaryClusterId, primaryClusterEndpoint, standbyClusterId, standbyClusterEndpoint',
          'VALIDATION_ERROR'
        );
      }

      const config = await service.createConfig({
        name: input.name,
        primaryClusterId: input.primaryClusterId,
        primaryClusterEndpoint: input.primaryClusterEndpoint,
        standbyClusterId: input.standbyClusterId,
        standbyClusterEndpoint: input.standbyClusterEndpoint,
        syncMode: input.syncMode,
        autoFailover: input.autoFailover,
        failoverThresholdSeconds: input.failoverThresholdSeconds,
        healthCheckIntervalSeconds: input.healthCheckIntervalSeconds,
        syncIntervalSeconds: input.syncIntervalSeconds,
        rpoTargetSeconds: input.rpoTargetSeconds,
        rtoTargetSeconds: input.rtoTargetSeconds,
        metadata: input.metadata,
      });

      success(res, config, 201);
    } catch (err) {
      if (err instanceof ConfigurationError) {
        error(res, err, 400);
      } else if ((err as DRError).code === 'VALIDATION_ERROR') {
        error(res, err as Error, 400);
      } else {
        error(res, err as Error);
      }
    }
  });

  /**
   * @route GET /api/v1/disaster-recovery/configs
   * @description List all DR configurations
   */
  router.get('/configs', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const configs = await service.getAllConfigs();
      success(res, configs);
    } catch (err) {
      error(res, err as Error);
    }
  });

  /**
   * @route GET /api/v1/disaster-recovery/configs/:configId
   * @description Get a specific DR configuration
   */
  router.get('/configs/:configId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const configId = getConfigId(req);
      const config = await service.getConfig(configId);

      if (!config) {
        throw new DRError('Configuration not found', 'NOT_FOUND');
      }

      success(res, config);
    } catch (err) {
      if ((err as DRError).code === 'NOT_FOUND') {
        error(res, err as Error, 404);
      } else {
        error(res, err as Error);
      }
    }
  });

  /**
   * @route PUT /api/v1/disaster-recovery/configs/:configId
   * @description Update a DR configuration
   */
  router.put('/configs/:configId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const configId = getConfigId(req);
      const input: UpdateConfigRequest = req.body;

      const config = await service.updateConfig(configId, {
        name: input.name,
        primaryClusterId: input.primaryClusterId,
        primaryClusterEndpoint: input.primaryClusterEndpoint,
        standbyClusterId: input.standbyClusterId,
        standbyClusterEndpoint: input.standbyClusterEndpoint,
        syncMode: input.syncMode,
        autoFailover: input.autoFailover,
        failoverThresholdSeconds: input.failoverThresholdSeconds,
        healthCheckIntervalSeconds: input.healthCheckIntervalSeconds,
        syncIntervalSeconds: input.syncIntervalSeconds,
        rpoTargetSeconds: input.rpoTargetSeconds,
        rtoTargetSeconds: input.rtoTargetSeconds,
        status: input.status,
        metadata: input.metadata,
      });

      if (!config) {
        throw new DRError('Configuration not found', 'NOT_FOUND');
      }

      success(res, config);
    } catch (err) {
      if ((err as DRError).code === 'NOT_FOUND') {
        error(res, err as Error, 404);
      } else if (err instanceof ConfigurationError) {
        error(res, err, 400);
      } else {
        error(res, err as Error);
      }
    }
  });

  /**
   * @route DELETE /api/v1/disaster-recovery/configs/:configId
   * @description Delete a DR configuration
   */
  router.delete('/configs/:configId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const configId = getConfigId(req);
      const deleted = await service.deleteConfig(configId);

      if (!deleted) {
        throw new DRError('Configuration not found', 'NOT_FOUND');
      }

      success(res, { deleted: true });
    } catch (err) {
      if ((err as DRError).code === 'NOT_FOUND') {
        error(res, err as Error, 404);
      } else {
        error(res, err as Error);
      }
    }
  });

  // =============================================================================
  // Status Routes
  // =============================================================================

  /**
   * @route GET /api/v1/disaster-recovery/status
   * @description Get DR status for all configurations
   */
  router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const status = await service.getStatus();
      success(res, status);
    } catch (err) {
      error(res, err as Error);
    }
  });

  /**
   * @route GET /api/v1/disaster-recovery/status/:configId
   * @description Get DR status for a specific configuration
   */
  router.get('/status/:configId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const configId = getConfigId(req);
      const status = await service.getStatus(configId);

      if (status.length === 0) {
        throw new DRError('Configuration not found', 'NOT_FOUND');
      }

      success(res, status[0]);
    } catch (err) {
      if ((err as DRError).code === 'NOT_FOUND') {
        error(res, err as Error, 404);
      } else {
        error(res, err as Error);
      }
    }
  });

  /**
   * @route GET /api/v1/disaster-recovery/metrics/:configId
   * @description Get DR metrics for a specific configuration
   */
  router.get('/metrics/:configId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const configId = getConfigId(req);
      const metrics = await service.getMetrics(configId);

      if (!metrics) {
        throw new DRError('Configuration not found', 'NOT_FOUND');
      }

      success(res, metrics);
    } catch (err) {
      if ((err as DRError).code === 'NOT_FOUND') {
        error(res, err as Error, 404);
      } else {
        error(res, err as Error);
      }
    }
  });

  // =============================================================================
  // Failover Routes
  // =============================================================================

  /**
   * @route POST /api/v1/disaster-recovery/failover
   * @description Perform manual failover
   */
  router.post('/failover', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { configId, ...options }: { configId: string } & FailoverRequest = req.body;

      if (!configId) {
        throw new DRError('configId is required', 'VALIDATION_ERROR');
      }

      const actor = getActor(req);
      const result = await service.failover(configId, options, actor);

      success(res, result);
    } catch (err) {
      if (err instanceof FailoverInProgressError) {
        error(res, err, 409);
      } else if (err instanceof ClusterUnhealthyError) {
        error(res, err, 503);
      } else if (err instanceof LockAcquisitionError) {
        error(res, err, 423);
      } else if ((err as DRError).code === 'CONFIG_NOT_FOUND') {
        error(res, err as Error, 404);
      } else if ((err as DRError).code === 'VALIDATION_ERROR') {
        error(res, err as Error, 400);
      } else {
        error(res, err as Error);
      }
    }
  });

  /**
   * @route POST /api/v1/disaster-recovery/failback
   * @description Perform manual failback
   */
  router.post('/failback', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { configId, ...options }: { configId: string } & FailbackRequest = req.body;

      if (!configId) {
        throw new DRError('configId is required', 'VALIDATION_ERROR');
      }

      const actor = getActor(req);
      const result = await service.failback(configId, options, actor);

      success(res, result);
    } catch (err) {
      if (err instanceof FailoverInProgressError) {
        error(res, err, 409);
      } else if (err instanceof ClusterUnhealthyError) {
        error(res, err, 503);
      } else if (err instanceof LockAcquisitionError) {
        error(res, err, 423);
      } else if ((err as DRError).code === 'CONFIG_NOT_FOUND') {
        error(res, err as Error, 404);
      } else if ((err as DRError).code === 'INVALID_STATE') {
        error(res, err as Error, 400);
      } else if ((err as DRError).code === 'VALIDATION_ERROR') {
        error(res, err as Error, 400);
      } else {
        error(res, err as Error);
      }
    }
  });

  /**
   * @route GET /api/v1/disaster-recovery/failover/history/:configId
   * @description Get failover history for a configuration
   */
  router.get('/failover/history/:configId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const configId = getConfigId(req);
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const history = await service.getFailoverHistory(configId, limit);
      success(res, history);
    } catch (err) {
      error(res, err as Error);
    }
  });

  /**
   * @route GET /api/v1/disaster-recovery/failover/active/:configId
   * @description Get active failover for a configuration
   */
  router.get('/failover/active/:configId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const configId = getConfigId(req);
      const activeFailover = await service.getActiveFailover(configId);

      if (!activeFailover) {
        success(res, { activeFailover: null });
      } else {
        success(res, { activeFailover });
      }
    } catch (err) {
      error(res, err as Error);
    }
  });

  // =============================================================================
  // Health Check Routes
  // =============================================================================

  /**
   * @route POST /api/v1/disaster-recovery/health-check
   * @description Perform health check on a cluster
   */
  router.post('/health-check', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { configId, clusterId } = req.body;

      if (!configId || !clusterId) {
        throw new DRError('configId and clusterId are required', 'VALIDATION_ERROR');
      }

      const result = await service.performHealthCheck(configId, clusterId);
      success(res, result);
    } catch (err) {
      if ((err as DRError).code === 'CONFIG_NOT_FOUND') {
        error(res, err as Error, 404);
      } else if ((err as DRError).code === 'VALIDATION_ERROR') {
        error(res, err as Error, 400);
      } else {
        error(res, err as Error);
      }
    }
  });

  // =============================================================================
  // Replication Status Routes
  // =============================================================================

  /**
   * @route GET /api/v1/disaster-recovery/replication/:configId
   * @description Get replication status for a configuration
   */
  router.get('/replication/:configId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const configId = getConfigId(req);
      const status = await service.getReplicationStatus(configId);

      success(res, status);
    } catch (err) {
      if ((err as DRError).code === 'CONFIG_NOT_FOUND') {
        error(res, err as Error, 404);
      } else {
        error(res, err as Error);
      }
    }
  });

  /**
   * @route POST /api/v1/disaster-recovery/replication
   * @description Record replication lag
   */
  router.post('/replication', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { configId, clusterId, lagSeconds, lagBytes, lastSyncTimestamp, replicationStatus } = req.body;

      if (!configId || !clusterId || lagSeconds === undefined || !replicationStatus) {
        throw new DRError(
          'configId, clusterId, lagSeconds, and replicationStatus are required',
          'VALIDATION_ERROR'
        );
      }

      await service.recordReplicationLag({
        configId,
        clusterId,
        lagSeconds,
        lagBytes,
        lastSyncTimestamp: lastSyncTimestamp ? new Date(lastSyncTimestamp) : undefined,
        replicationStatus,
      });

      success(res, { recorded: true });
    } catch (err) {
      if ((err as DRError).code === 'VALIDATION_ERROR') {
        error(res, err as Error, 400);
      } else {
        error(res, err as Error);
      }
    }
  });

  // =============================================================================
  // Cluster Status Routes
  // =============================================================================

  /**
   * @route GET /api/v1/disaster-recovery/clusters/:configId
   * @description Get all cluster statuses for a configuration
   */
  router.get('/clusters/:configId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const configId = getConfigId(req);
      const statuses = await service.getAllClusterStatuses(configId);

      success(res, statuses);
    } catch (err) {
      error(res, err as Error);
    }
  });

  /**
   * @route GET /api/v1/disaster-recovery/clusters/:configId/:clusterId
   * @description Get status for a specific cluster
   */
  router.get('/clusters/:configId/:clusterId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { configId, clusterId } = req.params;

      if (!configId || !clusterId) {
        throw new DRError('configId and clusterId are required', 'VALIDATION_ERROR');
      }

      const status = await service.getClusterStatus(configId, clusterId);

      if (!status) {
        throw new DRError('Cluster status not found', 'NOT_FOUND');
      }

      success(res, status);
    } catch (err) {
      if ((err as DRError).code === 'NOT_FOUND') {
        error(res, err as Error, 404);
      } else if ((err as DRError).code === 'VALIDATION_ERROR') {
        error(res, err as Error, 400);
      } else {
        error(res, err as Error);
      }
    }
  });

  /**
   * @route PUT /api/v1/disaster-recovery/clusters/:configId/:clusterId
   * @description Update cluster status
   */
  router.put('/clusters/:configId/:clusterId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { configId, clusterId } = req.params;
      const { role, status, lastHeartbeat, dataCenter, region, availabilityZone, connectionString, isPrimary, metadata } = req.body;

      if (!configId || !clusterId) {
        throw new DRError('configId and clusterId are required', 'VALIDATION_ERROR');
      }

      if (!role || !status || isPrimary === undefined) {
        throw new DRError('role, status, and isPrimary are required', 'VALIDATION_ERROR');
      }

      const clusterStatus = await service.updateClusterStatus({
        configId,
        clusterId,
        role,
        status,
        lastHeartbeat: lastHeartbeat ? new Date(lastHeartbeat) : undefined,
        dataCenter,
        region,
        availabilityZone,
        connectionString,
        isPrimary,
        metadata,
      });

      success(res, clusterStatus);
    } catch (err) {
      if ((err as DRError).code === 'VALIDATION_ERROR') {
        error(res, err as Error, 400);
      } else {
        error(res, err as Error);
      }
    }
  });

  // =============================================================================
  // Audit Log Routes
  // =============================================================================

  /**
   * @route GET /api/v1/disaster-recovery/audit/:configId
   * @description Get audit log for a configuration
   */
  router.get('/audit/:configId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const configId = getConfigId(req);
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

      const auditLog = await repository.getAuditLog(configId, limit);
      success(res, auditLog);
    } catch (err) {
      error(res, err as Error);
    }
  });

  // =============================================================================
  // Cleanup Routes
  // =============================================================================

  /**
   * @route POST /api/v1/disaster-recovery/cleanup
   * @description Cleanup old records
   */
  router.post('/cleanup', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { maxAgeDays = 7 } = req.body;
      const result = await service.cleanup(maxAgeDays);
      success(res, result);
    } catch (err) {
      error(res, err as Error);
    }
  });

  return router;
}

// Default export
export default createDisasterRecoveryRoutes;