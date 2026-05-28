/**
 * CrossDomainOrchestrator - 跨域编排服务
 *
 * 基于现有 Saga 模式实现跨域流程编排，支持：
 * - 创建跨域编排流程
 * - 执行/暂停/恢复/中止编排
 * - 状态查询
 * - 跨域事务补偿
 *
 * 复用 saga/ 目录下的 SagaCoordinator、TransactionLog、IdempotencyChecker
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../database';
import { SagaCoordinator } from '../../saga/SagaCoordinator';
import { TransactionLog } from '../../saga/TransactionLog';
import { IdempotencyChecker } from '../../saga/IdempotencyChecker';
import {
  SagaDefinition,
  SagaStep,
  SagaContext,
  SagaStatus,
  SagaStepStatus,
  createSagaContext,
} from '../../saga/types';
import { DomainConnector } from './DomainConnector';
import pino from 'pino';
import { OrionError, ErrorCode } from '../../../errors';

const logger = pino({ name: 'LCross-LDomain-LOrchestrator' });

// ============================================================
// Types
// ============================================================

export type OrchestrationStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'aborted'
  | 'compensating'
  | 'compensated';

export interface OrchestrationStep {
  stepName: string;
  domainName: string;
  sequence: number;
  status: OrchestrationStepStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  retryCount: number;
  maxRetries: number;
  startedAt?: Date;
  completedAt?: Date;
  compensationStartedAt?: Date;
  compensationCompletedAt?: Date;
}

export type OrchestrationStepStatus =
  | 'pending'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'compensating'
  | 'compensated'
  | 'skipped';

export interface CrossDomainOrchestRATION {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: OrchestrationStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  domains: string[];
  currentStep?: string;
  stepCount: number;
  completedSteps: number;
  steps: OrchestrationStep[];
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  startedAt?: Date;
  metadata: Record<string, unknown>;
}

export interface CreateOrchestrationInput {
  name: string;
  description?: string;
  domains: string[];
  steps: {
    stepName: string;
    domainName: string;
    action: string;
    payload: Record<string, unknown>;
    maxRetries?: number;
    timeoutMs?: number;
  }[];
  metadata?: Record<string, unknown>;
}

export interface OrchestrationListFilter {
  tenantId?: string;
  status?: OrchestrationStatus | OrchestrationStatus[];
  domain?: string;
  limit?: number;
  offset?: number;
}

// ============================================================
// Database Repository
// ============================================================

interface OrchestrationRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  domains: string[];
  current_step: string | null;
  step_count: number;
  completed_steps: number;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
  started_at: Date | null;
  metadata: Record<string, unknown>;
}

interface OrchestrationStepRow {
  id: string;
  orchestration_id: string;
  step_name: string;
  domain_name: string;
  sequence: number;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  retry_count: number;
  max_retries: number;
  started_at: Date | null;
  completed_at: Date | null;
  compensation_started_at: Date | null;
  compensation_completed_at: Date | null;
  created_at: Date;
}

class OrchestrationRepository {
  private pool: DatabasePool | null;
  private memory = new Map<string, CrossDomainOrchestRATION>();

  constructor(pool?: DatabasePool) {
    this.pool = pool || null;
  }

  private isDbAvailable(): boolean {
    return this.pool !== null;
  }

  async save(orchestration: CrossDomainOrchestRATION): Promise<void> {
    if (!this.isDbAvailable()) {
      this.memory.set(orchestration.id, orchestration);
      return;
    }
    await this.pool!.query(
      `INSERT INTO cross_domain_orchestrations (
        id, tenant_id, name, description, status, input, output, error,
        domains, current_step, step_count, completed_steps, created_by,
        metadata, created_at, updated_at, completed_at, started_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        output = EXCLUDED.output,
        error = EXCLUDED.error,
        current_step = EXCLUDED.current_step,
        completed_steps = EXCLUDED.completed_steps,
        updated_at = EXCLUDED.updated_at,
        completed_at = EXCLUDED.completed_at,
        started_at = EXCLUDED.started_at`,
      [
        orchestration.id,
        orchestration.tenantId,
        orchestration.name,
        orchestration.description || null,
        orchestration.status,
        JSON.stringify(orchestration.input),
        orchestration.output ? JSON.stringify(orchestration.output) : null,
        orchestration.error || null,
        JSON.stringify(orchestration.domains),
        orchestration.currentStep || null,
        orchestration.stepCount,
        orchestration.completedSteps,
        orchestration.createdBy || null,
        JSON.stringify(orchestration.metadata),
        orchestration.createdAt,
        orchestration.updatedAt,
        orchestration.completedAt || null,
        orchestration.startedAt || null,
      ]
    );
  }

  async findById(id: string): Promise<CrossDomainOrchestRATION | null> {
    if (!this.isDbAvailable()) {
      return this.memory.get(id) || null;
    }
    const rows = (
      await this.pool!.query(
        'SELECT * FROM cross_domain_orchestrations WHERE id = $1',
        [id]
      )
    ).rows;
    if (rows.length === 0) return null;
    return this.rowToOrchestration(rows[0]);
  }

  async findByTenant(tenantId: string, filter?: OrchestrationListFilter): Promise<CrossDomainOrchestRATION[]> {
    if (!this.isDbAvailable()) {
      let results = Array.from(this.memory.values()).filter((o) => o.tenantId === tenantId);
      if (filter?.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        results = results.filter((o) => statuses.includes(o.status));
      }
      if (filter?.domain) {
        results = results.filter((o) => o.domains.includes(filter.domain!));
      }
      results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const offset = filter?.offset || 0;
      const limit = filter?.limit || 100;
      return results.slice(offset, offset + limit);
    }

    let query = 'SELECT * FROM cross_domain_orchestrations WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIdx = 2;

    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      query += ` AND status = ANY($${paramIdx})`;
      params.push(statuses);
      paramIdx++;
    }
    if (filter?.domain) {
      query += ` AND domains @> $${paramIdx}::jsonb`;
      params.push(JSON.stringify([filter.domain]));
      paramIdx++;
    }

    query += ' ORDER BY created_at DESC';
    if (filter?.limit) {
      query += ` LIMIT $${paramIdx}`;
      params.push(filter.limit);
      paramIdx++;
    }
    if (filter?.offset) {
      query += ` OFFSET $${paramIdx}`;
      params.push(filter.offset);
    }

    const rows = (await this.pool!.query(query, params)).rows;
    return rows.map((r: OrchestrationRow) => this.rowToOrchestration(r));
  }

  async saveStep(step: OrchestrationStep, orchestrationId: string): Promise<void> {
    if (!this.isDbAvailable()) {
      const orch = this.memory.get(orchestrationId);
      if (orch) {
        const idx = orch.steps.findIndex((s) => s.stepName === step.stepName && s.sequence === step.sequence);
        if (idx >= 0) {
          orch.steps[idx] = step;
        } else {
          orch.steps.push(step);
        }
      }
      return;
    }
    await this.pool!.query(
      `INSERT INTO cross_domain_orchestration_steps (
        id, orchestration_id, step_name, domain_name, sequence, status,
        input, output, error, retry_count, max_retries,
        started_at, completed_at, compensation_started_at, compensation_completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (orchestration_id, step_name, sequence) DO UPDATE SET
        status = EXCLUDED.status,
        output = EXCLUDED.output,
        error = EXCLUDED.error,
        retry_count = EXCLUDED.retry_count,
        started_at = EXCLUDED.started_at,
        completed_at = EXCLUDED.completed_at,
        compensation_started_at = EXCLUDED.compensation_started_at,
        compensation_completed_at = EXCLUDED.compensation_completed_at`,
      [
        uuidv4(),
        orchestrationId,
        step.stepName,
        step.domainName,
        step.sequence,
        step.status,
        JSON.stringify(step.input),
        step.output ? JSON.stringify(step.output) : null,
        step.error || null,
        step.retryCount,
        step.maxRetries,
        step.startedAt || null,
        step.completedAt || null,
        step.compensationStartedAt || null,
        step.compensationCompletedAt || null,
      ]
    );
  }

  async findStepsByOrchestrationId(orchestrationId: string): Promise<OrchestrationStep[]> {
    if (!this.isDbAvailable()) {
      const orch = this.memory.get(orchestrationId);
      return orch ? [...orch.steps] : [];
    }
    const rows = (
      await this.pool!.query(
        'SELECT * FROM cross_domain_orchestration_steps WHERE orchestration_id = $1 ORDER BY sequence',
        [orchestrationId]
      )
    ).rows;
    return rows.map((r: OrchestrationStepRow) => ({
      stepName: r.step_name,
      domainName: r.domain_name,
      sequence: r.sequence,
      status: r.status as OrchestrationStepStatus,
      input: r.input as Record<string, unknown>,
      output: r.output || undefined,
      error: r.error || undefined,
      retryCount: r.retry_count,
      maxRetries: r.max_retries,
      startedAt: r.started_at || undefined,
      completedAt: r.completed_at || undefined,
      compensationStartedAt: r.compensation_started_at || undefined,
      compensationCompletedAt: r.compensation_completed_at || undefined,
    }));
  }

  private rowToOrchestration(row: OrchestrationRow): CrossDomainOrchestRATION {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description || undefined,
      status: row.status as OrchestrationStatus,
      input: (row.input as Record<string, unknown>) || {},
      output: row.output || undefined,
      error: row.error || undefined,
      domains: row.domains || [],
      currentStep: row.current_step || undefined,
      stepCount: row.step_count,
      completedSteps: row.completed_steps,
      steps: [],
      createdBy: row.created_by || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at || undefined,
      startedAt: row.started_at || undefined,
      metadata: (row.metadata as Record<string, unknown>) || {},
    };
  }
}

// ============================================================
// Service
// ============================================================

export class CrossDomainOrchestrator {
  private repository: OrchestrationRepository;
  private sagaCoordinator: SagaCoordinator;
  private domainConnector: DomainConnector;
  private orchestrations = new Map<string, CrossDomainOrchestRATION>();

  constructor(options: {
    database?: DatabasePool;
    domainConnector?: DomainConnector;
  } = {}) {
    this.repository = new OrchestrationRepository(options.database);
    this.domainConnector = options.domainConnector || new DomainConnector(options.database);

    const transactionLog = new TransactionLog();
    const idempotencyChecker = new IdempotencyChecker();
    this.sagaCoordinator = new SagaCoordinator({
      transactionLog,
      idempotencyChecker,
      defaultRetryConfig: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        multiplier: 2,
      },
      defaultTimeoutMs: 30 * 60 * 1000,
    });
  }

  /**
   * 创建跨域编排流程
   */
  async createOrchestration(
    tenantId: string,
    input: CreateOrchestrationInput,
    createdBy?: string
  ): Promise<CrossDomainOrchestRATION> {
    const id = uuidv4();
    const now = new Date();

    const orchestration: CrossDomainOrchestRATION = {
      id,
      tenantId,
      name: input.name,
      description: input.description,
      status: 'pending',
      input: input.steps.reduce(
        (acc, step) => {
          acc[step.stepName] = step.payload;
          return acc;
        },
        {} as Record<string, unknown>
      ),
      domains: input.domains,
      stepCount: input.steps.length,
      completedSteps: 0,
      steps: input.steps.map((step, index) => ({
        stepName: step.stepName,
        domainName: step.domainName,
        sequence: index + 1,
        status: 'pending' as OrchestrationStepStatus,
        input: step.payload,
        retryCount: 0,
        maxRetries: step.maxRetries || 3,
      })),
      createdBy,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata || {},
    };

    await this.repository.save(orchestration);
    for (const step of orchestration.steps) {
      await this.repository.saveStep(step, orchestration.id);
    }
    this.orchestrations.set(id, orchestration);

    return { ...orchestration };
  }

  /**
   * 执行编排
   */
  async executeOrchestration(orchestrationId: string): Promise<CrossDomainOrchestRATION> {
    const orchestration = await this.getOrchestrationById(orchestrationId);
    if (!orchestration) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Orchestration '${orchestrationId}' not found`);
    }

    if (orchestration.status !== 'pending' && orchestration.status !== 'paused') {
      throw new OrionError('VALIDATION_ERROR', `Orchestration cannot be executed in '${orchestration.status}' state. Must be 'pending' or 'paused'.`);
    }

    orchestration.status = 'running';
    orchestration.startedAt = orchestration.startedAt || new Date();
    orchestration.updatedAt = new Date();
    await this.repository.save(orchestration);

    try {
      // Build Saga definition from orchestration steps
      const sagaDefinition = this.buildSagaDefinition(orchestration);

      // Execute saga
      const result = await this.sagaCoordinator.execute(sagaDefinition, orchestration.input, {
        metadata: { orchestrationId, tenantId: orchestration.tenantId },
      });

      // Update orchestration status based on saga result
      orchestration.updatedAt = new Date();
      if (result.success) {
        orchestration.status = 'completed';
        orchestration.output = result.output as Record<string, unknown>;
        orchestration.completedAt = new Date();
        orchestration.completedSteps = orchestration.stepCount;
      } else {
        orchestration.status = result.status === 'compensated' ? 'compensated' : 'failed';
        orchestration.error = result.error;
        orchestration.completedAt = new Date();
      }
      await this.repository.save(orchestration);
    } catch (error) {
      orchestration.status = 'failed';
      orchestration.error = error instanceof Error ? error.message : 'Unknown error';
      orchestration.updatedAt = new Date();
      orchestration.completedAt = new Date();
      await this.repository.save(orchestration);
    }

    return { ...orchestration };
  }

  /**
   * 暂停编排
   */
  async pauseOrchestration(orchestrationId: string): Promise<CrossDomainOrchestRATION> {
    const orchestration = await this.getOrchestrationById(orchestrationId);
    if (!orchestration) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Orchestration '${orchestrationId}' not found`);
    }

    if (orchestration.status !== 'running') {
      throw new OrionError(ErrorCode.NOT_FOUND, `Only running orchestrations can be paused (current: ${orchestration.status})`);
    }

    orchestration.status = 'paused';
    orchestration.updatedAt = new Date();
    await this.repository.save(orchestration);

    return { ...orchestration };
  }

  /**
   * 恢复编排
   */
  async resumeOrchestration(orchestrationId: string): Promise<CrossDomainOrchestRATION> {
    const orchestration = await this.getOrchestrationById(orchestrationId);
    if (!orchestration) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Orchestration '${orchestrationId}' not found`);
    }

    if (orchestration.status !== 'paused') {
      throw new OrionError(ErrorCode.NOT_FOUND, `Only paused orchestrations can be resumed (current: ${orchestration.status})`);
    }

    // Resume execution
    return this.executeOrchestration(orchestrationId);
  }

  /**
   * 中止编排
   */
  async abortOrchestration(orchestrationId: string): Promise<CrossDomainOrchestRATION> {
    const orchestration = await this.getOrchestrationById(orchestrationId);
    if (!orchestration) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Orchestration '${orchestrationId}' not found`);
    }

    if (orchestration.status === 'completed' || orchestration.status === 'aborted') {
      throw new OrionError(ErrorCode.NOT_FOUND, `Cannot abort orchestrations in '${orchestration.status}' state`);
    }

    orchestration.status = 'aborted';
    orchestration.error = 'Aborted by user';
    orchestration.updatedAt = new Date();
    orchestration.completedAt = new Date();
    await this.repository.save(orchestration);

    return { ...orchestration };
  }

  /**
   * 获取编排状态
   */
  async getOrchestrationStatus(orchestrationId: string): Promise<CrossDomainOrchestRATION> {
    const orchestration = await this.getOrchestrationById(orchestrationId);
    if (!orchestration) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Orchestration '${orchestrationId}' not found`);
    }

    // Reload steps
    orchestration.steps = await this.repository.findStepsByOrchestrationId(orchestrationId);
    return { ...orchestration };
  }

  /**
   * 获取编排列表
   */
  async listOrchestrations(
    tenantId: string,
    filter?: OrchestrationListFilter
  ): Promise<CrossDomainOrchestRATION[]> {
    const orchestrations = await this.repository.findByTenant(tenantId, filter);
    // Reload steps for each (limit to reduce overhead)
    for (const orch of orchestrations) {
      orch.steps = await this.repository.findStepsByOrchestrationId(orch.id);
    }
    return orchestrations;
  }

  /**
   * 获取编排详情
   */
  async getOrchestrationById(id: string): Promise<CrossDomainOrchestRATION | null> {
    const orchestration = await this.repository.findById(id);
    if (!orchestration) return null;

    orchestration.steps = await this.repository.findStepsByOrchestrationId(id);
    return orchestration;
  }

  // ============================================================
  // Internal Methods
  // ============================================================

  private buildSagaDefinition(
    orchestration: CrossDomainOrchestRATION
  ): SagaDefinition<Record<string, unknown>, Record<string, unknown>> {
    const connector = this.domainConnector;
    const orchId = orchestration.id;
    const repository = this.repository;

    const steps: SagaStep<Record<string, unknown>, unknown>[] = orchestration.steps.map((step) => ({
      name: step.stepName,
      sequence: step.sequence,
      execute: async (input: Record<string, unknown>, context: SagaContext): Promise<unknown> => {
        // Update step status to executing
        const executingStep: OrchestrationStep = {
          ...step,
          status: 'executing',
          startedAt: new Date(),
        };
        await repository.saveStep(executingStep, orchId);

        // Invoke domain connector
        const output = await connector.invokeDomain(step.domainName, step.stepName, {
          ...input,
          ...step.input,
        });

        // Update step status to completed
        const completedStep: OrchestrationStep = {
          ...step,
          status: 'completed',
          output,
          completedAt: new Date(),
        };
        await repository.saveStep(completedStep, orchId);

        return output;
      },
      compensate: async (
        input: Record<string, unknown>,
        output: unknown,
        context: SagaContext
      ): Promise<void> => {
        // Update step status to compensating
        const compensatingStep: OrchestrationStep = {
          ...step,
          status: 'compensating',
          compensationStartedAt: new Date(),
        };
        await repository.saveStep(compensatingStep, orchId);

        // Attempt compensation via domain connector (reverse action)
        try {
          await connector.compensateTransaction(orchId);
        } catch (error) {
          // Log compensation failure but don't throw - saga handles this
          logger.error(
            `[CrossDomainOrchestrator] Compensation failed for step ${step.stepName}:`,
            error
          );
        }

        // Update step status
        const compensatedStep: OrchestrationStep = {
          ...step,
          status: 'compensated',
          compensationCompletedAt: new Date(),
        };
        await repository.saveStep(compensatedStep, orchId);
      },
      retryConfig: {
        maxRetries: step.maxRetries,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        multiplier: 2,
      },
    }));

    return {
      name: `CrossDomainOrchestration_${orchestration.name}`,
      steps,
      finalize: async (
        input: Record<string, unknown>,
        context: SagaContext
      ): Promise<Record<string, unknown>> => {
        return {
          orchestrationId: orchId,
          status: 'completed',
          completedAt: new Date(),
        };
      },
    };
  }
}
