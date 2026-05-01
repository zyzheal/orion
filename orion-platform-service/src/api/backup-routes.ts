/**
 * TASK-704: Backup & Recovery API Routes
 *
 * Provides endpoints for backup management, verification,
 * recovery plans, and health monitoring.
 * Registered under /api/v1/backup prefix.
 *
 * Migrated to PostgreSQL Repository pattern.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { BackupController } from './controllers/backup/BackupController';
import { BackupService } from '../services/backup';

interface BackupRoutesOptions {
  database: DatabasePool;
}

export default async function backupRoutes(
  app: FastifyInstance,
  options: BackupRoutesOptions
): Promise<void> {
  // Initialize Repository + Service with database pool
  const service = new BackupService({ database: options.database });
  const controller = new BackupController(service);

  // ==================== Service Control ====================

  // POST /start - Start backup service
  app.post('/start', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.startService(request, reply);
  });

  // POST /stop - Stop backup service
  app.post('/stop', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.stopService(request, reply);
  });

  // GET /health - Health check
  app.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.healthCheck(request, reply);
  });

  // ==================== Backup Plans ====================

  // POST /plans - Create backup plan
  app.post('/plans', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createPlan(request, reply);
  });

  // GET /plans - Get all backup plans
  app.get('/plans', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getPlans(request, reply);
  });

  // GET /plans/:id - Get a backup plan
  app.get('/plans/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getPlan(request, reply);
  });

  // PUT /plans/:id - Update a backup plan
  app.put('/plans/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updatePlan(request, reply);
  });

  // DELETE /plans/:id - Delete a backup plan
  app.delete('/plans/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deletePlan(request, reply);
  });

  // PATCH /plans/:id/toggle - Toggle a backup plan
  app.patch('/plans/:id/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.togglePlan(request, reply);
  });

  // ==================== Backup Execution ====================

  // POST /trigger - Trigger a manual backup
  app.post('/trigger', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.triggerBackup(request, reply);
  });

  // ==================== Backup Records ====================

  // GET /backups - Get all backups
  app.get('/backups', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getBackups(request, reply);
  });

  // GET /backups/:id - Get backup detail
  app.get('/backups/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getBackupDetail(request, reply);
  });

  // DELETE /backups/:id - Delete a backup
  app.delete('/backups/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deleteBackup(request, reply);
  });

  // ==================== Verification ====================

  // POST /backups/:id/verify - Verify backup integrity
  app.post('/backups/:id/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.verifyBackup(request, reply);
  });

  // POST /backups/:id/test-restore - Test restore a backup
  app.post('/backups/:id/test-restore', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.testRestore(request, reply);
  });

  // GET /backups/:id/verifications - Get verification history
  app.get('/backups/:id/verifications', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getVerifications(request, reply);
  });

  // ==================== Recovery Plans ====================

  // POST /recovery-plans - Create recovery plan
  app.post('/recovery-plans', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createRecoveryPlan(request, reply);
  });

  // GET /recovery-plans - Get all recovery plans
  app.get('/recovery-plans', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRecoveryPlans(request, reply);
  });

  // GET /recovery-plans/:id - Get a recovery plan
  app.get('/recovery-plans/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRecoveryPlan(request, reply);
  });

  // PUT /recovery-plans/:id - Update a recovery plan
  app.put('/recovery-plans/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateRecoveryPlan(request, reply);
  });

  // DELETE /recovery-plans/:id - Delete a recovery plan
  app.delete('/recovery-plans/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deleteRecoveryPlan(request, reply);
  });

  // ==================== Recovery Execution ====================

  // POST /recovery/:planId/initiate - Initiate recovery
  app.post('/recovery/:planId/initiate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.initiateRecovery(request, reply);
  });

  // POST /recovery/:executionId/execute - Execute recovery
  app.post('/recovery/:executionId/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.executeRecovery(request, reply);
  });

  // POST /recovery/:planId/point-in-time - Point-in-time recovery
  app.post('/recovery/:planId/point-in-time', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.initiatePointInTimeRecovery(request, reply);
  });

  // GET /recovery/executions - Get recovery executions
  app.get('/recovery/executions', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRecoveryExecutions(request, reply);
  });

  // GET /recovery/rto-rpo-stats - Get RTO/RPO stats
  app.get('/recovery/rto-rpo-stats', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRtoRpoStats(request, reply);
  });

  // ==================== Health & Monitoring ====================

  // GET /status - Get backup status summary
  app.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getBackupStatus(request, reply);
  });

  // GET /storage - Get storage usage
  app.get('/storage', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getStorageUsage(request, reply);
  });

  // GET /health-report - Generate health report
  app.get('/health-report', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getHealthReport(request, reply);
  });

  // POST /retention/enforce - Enforce retention policies
  app.post('/retention/enforce', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.enforceRetention(request, reply);
  });
}
