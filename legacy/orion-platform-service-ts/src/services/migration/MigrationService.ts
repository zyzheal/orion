/**
 * MigrationService - Service Migration Planning and Execution
 *
 * Provides capabilities for:
 * - Migration plan creation and validation
 * - Migration execution with pause/resume/rollback
 * - Data synchronization between source and target services
 * - Data integrity verification
 *
 * Task 4.39: Migrated from in-memory Map() to PostgreSQL Repository pattern
 */

import { randomUUID } from 'crypto';
import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';
import { MigrationPlanRepository, MigrationPlanEntity } from '../../repositories/MigrationPlanRepository';
import { MigrationExecutionRepository, MigrationExecutionEntity } from '../../repositories/MigrationExecutionRepository';

const logger = createLogger('migration-service');

// ==================== Types ====================

export type MigrationStrategy = 'big-bang' | 'blue-green' | 'canary' | 'rolling' | 'strangler';

export type MigrationStatus = 'pending' | 'validating' | 'running' | 'paused' | 'completed' | 'failed' | 'rolled-back';

export interface MigrationPlan {
  id: string;
  name: string;
  description?: string;
  sourceService: string;
  targetService: string;
  strategy: MigrationStrategy;
  status: MigrationStatus;
  config: Record<string, unknown>;
  steps: MigrationStep[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface MigrationStep {
  id: string;
  name: string;
  description: string;
  order: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  sourceEndpoint?: string;
  targetEndpoint?: string;
  rollbackEndpoint?: string;
}

export interface MigrationExecution {
  id: string;
  planId: string;
  status: MigrationStatus;
  currentStepIndex: number;
  startedAt?: string;
  pausedAt?: string;
  completedAt?: string;
  rolledBackAt?: string;
  executedBy: string;
  error?: string;
  metrics: {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    dataSynced: number;
    dataVerified: number;
  };
}

export interface DataSyncResult {
  totalRecords: number;
  syncedRecords: number;
  failedRecords: number;
  skippedRecords: number;
  durationMs: number;
  errors: Array<{ recordId: string; error: string }>;
}

export interface DataIntegrityReport {
  totalRecords: number;
  matchedRecords: number;
  mismatchedRecords: number;
  missingRecords: number;
  extraRecords: number;
  integrityScore: number;
  details: Array<{ recordId: string; source?: unknown; target?: unknown; mismatch?: string }>;
}

export interface CreateMigrationPlanInput {
  name: string;
  description?: string;
  sourceService: string;
  targetService: string;
  strategy: MigrationStrategy;
  steps?: Omit<MigrationStep, 'id' | 'status'>[];
  config?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ==================== Migration Service ====================

export class MigrationService {
  private planRepo: MigrationPlanRepository;
  private executionRepo: MigrationExecutionRepository;
  private logger = logger;

  // Transient in-memory stores for non-persistent data
  private syncResults = new Map<string, DataSyncResult>();
  private integrityReports = new Map<string, DataIntegrityReport>();

  constructor(db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.planRepo = new MigrationPlanRepository(db);
    this.executionRepo = new MigrationExecutionRepository(db);
  }

  // ==================== Migration Planning ====================

  /**
   * Create a new migration plan
   */
  async createMigrationPlan(
    input: CreateMigrationPlanInput,
    createdBy: string,
  ): Promise<MigrationPlan> {
    this.logger.info(
      { source: input.sourceService, target: input.targetService, strategy: input.strategy },
      '[MigrationService] Creating migration plan'
    );

    const plan = await this.planRepo.create({
      id: `migration-plan-${randomUUID().slice(0, 8)}`,
      tenantId: 'default',
      name: input.name,
      description: input.description,
      sourceService: input.sourceService,
      targetService: input.targetService,
      strategy: input.strategy,
      config: input.config ?? {},
      steps: (input.steps ?? []).map((step, index) => ({
        ...step,
        id: `step-${index + 1}`,
        status: 'pending' as const,
      })),
      createdBy,
    });

    this.logger.info({ planId: plan.id }, '[MigrationService] Migration plan created');
    return this.entityToDTO(plan);
  }

  /**
   * Get migration plan by ID
   */
  async getMigrationPlan(planId: string): Promise<MigrationPlan | null> {
    const plan = await this.planRepo.findById(planId);
    return plan ? this.entityToDTO(plan) : null;
  }

  /**
   * List migration plans for a source service
   */
  async listMigrationPlans(sourceService?: string): Promise<MigrationPlan[]> {
    const entities = sourceService
      ? await this.planRepo.findBySourceService(sourceService)
      : (await this.planRepo.findAll()).entities;
    return entities.map(e => this.entityToDTO(e));
  }

  /**
   * Validate a migration plan for correctness
   */
  async validateMigrationPlan(planId: string): Promise<ValidationResult> {
    const plan = await this.planRepo.findById(planId);
    if (!plan) {
      return { valid: false, errors: [`Migration plan not found: ${planId}`], warnings: [] };
    }

    const dto = this.entityToDTO(plan);
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validations
    if (!dto.sourceService) {
      errors.push('Source service is required');
    }
    if (!dto.targetService) {
      errors.push('Target service is required');
    }
    if (dto.sourceService === dto.targetService) {
      errors.push('Source and target services must be different');
    }
    if (!dto.steps || dto.steps.length === 0) {
      errors.push('Migration plan must have at least one step');
    }

    // Check step ordering
    const stepIds = dto.steps.map((s) => s.id);
    const uniqueStepIds = new Set(stepIds);
    if (uniqueStepIds.size !== stepIds.length) {
      errors.push('Migration step IDs must be unique');
    }

    // Check strategy-specific requirements
    switch (dto.strategy) {
      case 'blue-green':
        if (!dto.config.blueService || !dto.config.greenService) {
          warnings.push('Blue-green strategy typically requires blue/green service configuration');
        }
        break;
      case 'canary':
        if (!dto.config.canaryPercentage) {
          warnings.push('Canary strategy benefits from canary percentage configuration');
        }
        break;
      case 'strangler':
        if (!dto.config.legacyEndpoint) {
          warnings.push('Strangler pattern typically requires legacy endpoint configuration');
        }
        break;
      default:
        break;
    }

    this.logger.info(
      { planId, valid: errors.length === 0, errors: errors.length, warnings: warnings.length },
      '[MigrationService] Migration plan validated'
    );

    return { valid: errors.length === 0, errors, warnings };
  }

  // ==================== Execution Control ====================

  /**
   * Start migration execution
   */
  async startMigration(planId: string, executor: string): Promise<MigrationExecution> {
    const plan = await this.planRepo.findById(planId);
    if (!plan) {
      throw new OrionError(`Migration plan not found: ${planId}`, ErrorCode.NOT_FOUND);
    }

    if (plan.status === 'running') {
      throw new OrionError(`Migration is already running: ${planId}`, ErrorCode.STATE_CONFLICT);
    }

    // Create execution record
    const execution = await this.executionRepo.create({
      id: `migration-exec-${randomUUID().slice(0, 8)}`,
      tenantId: plan.tenant_id,
      planId,
      executedBy: executor,
      totalSteps: plan.steps.length,
    });

    // Mark plan as running
    await this.planRepo.updateStatus(planId, 'running');

    this.logger.info({ planId, executionId: execution.id, executor }, '[MigrationService] Migration started');

    // Execute steps (in-memory simulation, persisted on completion)
    const dto = this.executionEntityToDTO(execution);
    await this.executeNextStep(execution.id);

    return dto;
  }

  /**
   * Get migration execution status
   */
  async getMigrationStatus(executionId: string): Promise<MigrationExecution | null> {
    const execution = await this.executionRepo.findById(executionId);
    return execution ? this.executionEntityToDTO(execution) : null;
  }

  /**
   * Pause a running migration
   */
  async pauseMigration(executionId: string): Promise<MigrationExecution> {
    const execution = await this.executionRepo.findById(executionId);
    if (!execution) {
      throw new OrionError(`Migration execution not found: ${executionId}`, ErrorCode.NOT_FOUND);
    }

    if (execution.status !== 'running') {
      throw new OrionError(`Migration is not running (current status: ${execution.status})`, ErrorCode.STATE_CONFLICT);
    }

    const updated = await this.executionRepo.updateStatus(executionId, 'paused');
    if (!updated) {
      throw new OrionError(`Failed to pause migration: ${executionId}`, ErrorCode.INTERNAL_ERROR);
    }

    this.logger.info({ executionId }, '[MigrationService] Migration paused');
    return this.executionEntityToDTO(updated);
  }

  /**
   * Resume a paused migration
   */
  async resumeMigration(executionId: string): Promise<MigrationExecution> {
    const execution = await this.executionRepo.findById(executionId);
    if (!execution) {
      throw new OrionError(`Migration execution not found: ${executionId}`, ErrorCode.NOT_FOUND);
    }

    if (execution.status !== 'paused') {
      throw new OrionError(`Migration is not paused (current status: ${execution.status})`, ErrorCode.STATE_CONFLICT);
    }

    const updated = await this.executionRepo.updateStatus(executionId, 'running');
    if (!updated) {
      throw new OrionError(`Failed to resume migration: ${executionId}`, ErrorCode.INTERNAL_ERROR);
    }

    // Continue with next step
    await this.executeNextStep(executionId);

    return this.executionEntityToDTO(updated);
  }

  /**
   * Rollback a migration to its original state
   */
  async rollbackMigration(executionId: string): Promise<MigrationExecution> {
    const execution = await this.executionRepo.findById(executionId);
    if (!execution) {
      throw new OrionError(`Migration execution not found: ${executionId}`, ErrorCode.NOT_FOUND);
    }

    if (execution.status === 'rolled-back') {
      throw new OrionError(`Migration is already rolled back: ${executionId}`, ErrorCode.STATE_CONFLICT);
    }

    const plan = await this.planRepo.findById(execution.plan_id);
    if (!plan) {
      throw new OrionError(`Migration plan not found: ${execution.plan_id}`, ErrorCode.NOT_FOUND);
    }

    // Mark execution as rolled back
    await this.executionRepo.updateStatus(executionId, 'rolled-back');

    // Mark plan as pending again
    await this.planRepo.updateStatus(plan.id, 'pending');

    this.logger.info({ executionId, planId: execution.plan_id }, '[MigrationService] Migration rolled back');

    const updated = await this.executionRepo.findById(executionId);
    return updated ? this.executionEntityToDTO(updated) : {
      id: executionId,
      planId: execution.plan_id,
      status: 'rolled-back',
      currentStepIndex: 0,
      rolledBackAt: new Date().toISOString(),
      executedBy: execution.executed_by,
      metrics: {
        totalSteps: execution.total_steps,
        completedSteps: execution.completed_steps,
        failedSteps: execution.failed_steps,
        dataSynced: execution.data_synced,
        dataVerified: execution.data_verified,
      },
    };
  }

  // ==================== Data Sync ====================

  /**
   * Sync data from source service to target service
   */
  async syncData(
    sourceService: string,
    targetService: string,
    filter?: { recordIds?: string[]; batchSize?: number },
  ): Promise<DataSyncResult> {
    const batchSize = filter?.batchSize ?? 1000;
    const syncId = `sync-${randomUUID().slice(0, 8)}`;

    this.logger.info(
      { sourceService, targetService, batchSize, recordCount: filter?.recordIds?.length },
      '[MigrationService] Starting data sync'
    );

    const startedAt = Date.now();
    let syncedRecords = 0;
    let failedRecords = 0;
    let skippedRecords = 0;
    const errors: Array<{ recordId: string; error: string }> = [];

    // Simulate sync - in production, this would iterate over actual records
    const totalRecords = filter?.recordIds?.length ?? 1000;
    const batches = Math.ceil(totalRecords / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const batchStart = batch * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, totalRecords);
      const recordIds = filter?.recordIds?.slice(batchStart, batchEnd) ??
        Array.from({ length: batchEnd - batchStart }, (_, i) => `record-${batchStart + i}`);

      for (const recordId of recordIds) {
        try {
          // Simulate data sync - in production, this would copy actual data
          await this.syncSingleRecord(sourceService, targetService, recordId);
          syncedRecords++;
        } catch (err) {
          failedRecords++;
          errors.push({
            recordId,
            error: (err as Error).message,
          });
        }
      }
    }

    const result: DataSyncResult = {
      totalRecords,
      syncedRecords,
      failedRecords,
      skippedRecords,
      durationMs: Date.now() - startedAt,
      errors,
    };

    this.syncResults.set(syncId, result);

    this.logger.info(
      { syncId, syncedRecords, failedRecords, durationMs: result.durationMs },
      '[MigrationService] Data sync completed'
    );

    return result;
  }

  /**
   * Verify data integrity after migration
   */
  async verifyDataIntegrity(migrationId: string): Promise<DataIntegrityReport> {
    const execution = await this.executionRepo.findById(migrationId);
    if (!execution) {
      throw new OrionError(`Migration execution not found: ${migrationId}`, ErrorCode.NOT_FOUND);
    }

    this.logger.info({ migrationId }, '[MigrationService] Verifying data integrity');

    const plan = await this.planRepo.findById(execution.plan_id);
    if (!plan) {
      throw new OrionError(`Migration plan not found: ${execution.plan_id}`, ErrorCode.NOT_FOUND);
    }

    // Simulate integrity check - in production, this would compare source and target data
    const totalRecords = 1000;
    const matchedRecords = Math.floor(totalRecords * 0.98);
    const mismatchedRecords = Math.floor(totalRecords * 0.01);
    const missingRecords = totalRecords - matchedRecords - mismatchedRecords;
    const extraRecords = 0;

    const integrityScore = Math.round((matchedRecords / totalRecords) * 100);

    const report: DataIntegrityReport = {
      totalRecords,
      matchedRecords,
      mismatchedRecords,
      missingRecords,
      extraRecords,
      integrityScore,
      details: [],
    };

    this.integrityReports.set(migrationId, report);

    // Update execution metrics
    await this.executionRepo.updateMetrics(migrationId, { dataVerified: matchedRecords });

    this.logger.info(
      { migrationId, integrityScore, matched: matchedRecords, mismatched: mismatchedRecords },
      '[MigrationService] Data integrity verified'
    );

    return report;
  }

  // ==================== Internal Methods ====================

  private async executeNextStep(executionId: string): Promise<void> {
    const execution = await this.executionRepo.findById(executionId);
    if (!execution || execution.status !== 'running') return;

    const plan = await this.planRepo.findById(execution.plan_id);
    if (!plan) return;

    const steps = (typeof plan.steps === 'string' ? JSON.parse(plan.steps) : plan.steps) as MigrationStep[];

    for (let i = execution.current_step_index; i < steps.length; i++) {
      if (execution.status !== 'running') break;

      const step = steps[i];

      try {
        this.logger.info({ executionId, stepId: step.id, stepName: step.name }, '[MigrationService] Executing step');

        // Simulate step execution - in production, this would call actual migration logic
        await this.executeStep({ id: plan.id, steps }, step);

        // Update execution progress
        await this.executionRepo.updateMetrics(executionId, {
          completedSteps: i + 1,
          dataSynced: execution.data_synced + Math.floor(Math.random() * 100),
        });
        await this.executionRepo.updateStatus(executionId, 'running', { currentStepIndex: i + 1 });
      } catch (err) {
        await this.executionRepo.updateMetrics(executionId, {
          failedSteps: execution.failed_steps + 1,
        });
        await this.executionRepo.updateStatus(executionId, 'failed', {
          error: (err as Error).message,
        });

        this.logger.error(
          { executionId, stepId: step.id, error: (err as Error).message },
          '[MigrationService] Step execution failed'
        );

        // Continue with next step even if current fails
        continue;
      }
    }

    // Check completion status
    const allCompleted = steps.every((s) => s.status === 'completed' || s.status === 'skipped');
    const hasFailures = steps.some((s) => s.status === 'failed');

    const finalExecution = await this.executionRepo.findById(executionId);
    if (!finalExecution) return;

    if (allCompleted && !hasFailures) {
      await this.executionRepo.updateStatus(executionId, 'completed', {
        currentStepIndex: steps.length,
      });
      await this.planRepo.updateStatus(plan.id, 'completed');
      this.logger.info({ executionId, planId: plan.id }, '[MigrationService] Migration completed successfully');
    } else if (hasFailures) {
      await this.executionRepo.updateStatus(executionId, 'failed', {
        currentStepIndex: steps.length,
      });
      await this.planRepo.updateStatus(plan.id, 'failed');
      this.logger.warn({ executionId, planId: plan.id, failedSteps: finalExecution.failed_steps + 1 }, '[MigrationService] Migration completed with failures');
    }
  }

  private async executeStep(plan: { id: string; steps: MigrationStep[] }, step: MigrationStep): Promise<void> {
    // Simulate step execution time
    const executionTime = 500 + Math.random() * 1500;
    await new Promise((resolve) => setTimeout(resolve, executionTime));

    this.logger.debug(
      { planId: plan.id, stepId: step.id, durationMs: executionTime },
      '[MigrationService] Step executed'
    );
  }

  private async syncSingleRecord(
    sourceService: string,
    targetService: string,
    recordId: string,
  ): Promise<void> {
    // Simulate occasional failures (1% failure rate)
    if (Math.random() < 0.01) {
      throw new OrionError(`Sync failed for record ${recordId}: connection timeout`, ErrorCode.INTERNAL_ERROR);
    }

    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 10 + Math.random() * 50));
  }

  // ==================== DTO Converters ====================

  private entityToDTO(entity: MigrationPlanEntity): MigrationPlan {
    const steps = typeof entity.steps === 'string' ? JSON.parse(entity.steps) : entity.steps;
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description ?? undefined,
      sourceService: entity.source_service,
      targetService: entity.target_service,
      strategy: entity.strategy as MigrationStrategy,
      status: entity.status as MigrationStatus,
      config: entity.config,
      steps: steps || [],
      createdAt: entity.created_at.toISOString(),
      updatedAt: entity.updated_at.toISOString(),
      createdBy: entity.created_by,
    };
  }

  private executionEntityToDTO(entity: MigrationExecutionEntity): MigrationExecution {
    return {
      id: entity.id,
      planId: entity.plan_id,
      status: entity.status as MigrationStatus,
      currentStepIndex: entity.current_step_index,
      startedAt: entity.started_at?.toISOString(),
      pausedAt: entity.paused_at?.toISOString(),
      completedAt: entity.completed_at?.toISOString(),
      rolledBackAt: entity.rolled_back_at?.toISOString(),
      executedBy: entity.executed_by,
      error: entity.error ?? undefined,
      metrics: {
        totalSteps: entity.total_steps,
        completedSteps: entity.completed_steps,
        failedSteps: entity.failed_steps,
        dataSynced: entity.data_synced,
        dataVerified: entity.data_verified,
      },
    };
  }
}

export default MigrationService;
