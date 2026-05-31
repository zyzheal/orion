/**
 * Cross-Domain Orchestrator Service
 *
 * Orchestrates workflows across multiple domains (CI/CD, Monitoring, Security, etc.)
 * with event-driven coordination and dependency management.
 *
 * Phase 1.2: Connected to real backend services instead of simulated results.
 */

import { v4 as uuidv4 } from 'uuid';
import { DeployService } from './deploy/DeployService';
import { DeployRepository } from './deploy/DeployRepository';
import type { CreateDeploymentInput } from './deploy/DeployRepository';
import { MonitoringService } from './monitoring/MonitoringService';
import { MonitoringRepository } from './monitoring/MonitoringRepository';
import { NotificationService } from './notification/NotificationService';
import { NotificationRepository } from './notification/NotificationRepository';
import type { CreateNotificationInput } from './notification/NotificationRepository';
import { AISecurityService, sanitizeInput, validateOutput } from './ai-security';
import type { DatabasePool } from './database';
import pino from 'pino';
import { OrionError, ErrorCode } from '../errors';

const logger = pino({ name: 'LCross-LDomain-LOrchestrator' });
import {
  CrossDomainWorkflowRepository,
  CrossDomainExecutionRepository,
  WorkflowDefinitionEntity,
  WorkflowStepEntity,
  ExecutionEntity,
  ExecutionStepEntity,
} from './CrossDomainWorkflowRepository';

// ============================================================
// Service interfaces for dependency injection
// ============================================================

/**
 * Minimal interface for PipelineEngine — only the execute method
 * we need from the orchestrator's perspective. Avoids pulling in
 * the full PipelineEngine dependency tree when a mock is preferred.
 */
export interface IPipelineExecutor {
  execute(
    pipelineId: string,
    triggerType: string,
    triggerBy?: string,
    context?: Record<string, unknown>
  ): Promise<unknown>;
}

/**
 * Optional services that can be injected into the orchestrator.
 * When not provided, the orchestrator falls back to simulated execution
 * (development mode).
 */
export interface OrchestratorServices {
  pipelineEngine?: IPipelineExecutor;
  deployService?: DeployService;
  monitoringService?: MonitoringService;
  notificationService?: NotificationService;
  securityService?: AISecurityService;
  /** Database pool for lazy-initializing services when not injected */
  database?: DatabasePool;
}

// ============================================================
// Step output passing context
// ============================================================

/**
 * Enriched context that carries outputs from completed steps.
 * Each step's result is stored under its stepId, and parameters
 * can reference previous outputs using `${stepId.field}` syntax
 * (resolved at execution time).
 */
interface StepContext extends Record<string, unknown> {
  _stepOutputs?: Record<string, unknown>;
}

// ============================================================
// Types
// ============================================================

export interface DomainWorkflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  triggers: Trigger[];
  status: 'active' | 'paused' | 'completed' | 'failed';
  lastRun?: Date;
  createdAt: Date;
}

export interface WorkflowStep {
  id: string;
  domain: 'pipeline' | 'deploy' | 'monitor' | 'security' | 'notify';
  action: string;
  parameters: Record<string, unknown>;
  dependsOn: string[];
  timeout: number;
  retryPolicy?: { maxRetries: number; backoff: number };
}

export interface Trigger {
  type: 'event' | 'schedule' | 'manual';
  config: Record<string, unknown>;
}

export interface ExecutionRecord {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  steps: ExecutionStepResult[];
  startedAt: Date;
  completedAt?: Date;
  triggeredBy: string;
}

export interface ExecutionStepResult {
  stepId: string;
  status: string;
  result?: unknown;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface CreateWorkflowInput {
  name: string;
  description: string;
  steps: Omit<WorkflowStep, 'id'>[];
  triggers: Trigger[];
}

export interface WorkflowListFilter {
  status?: 'active' | 'paused' | 'completed' | 'failed';
  domain?: string;
  limit?: number;
  offset?: number;
}

// ============================================================
// Service
// ============================================================

export class CrossDomainOrchestrator {
  // PostgreSQL persistence via repositories
  private workflowRepository?: CrossDomainWorkflowRepository;
  private executionRepository?: CrossDomainExecutionRepository;

  // In-memory cache for fast lookups (synced from DB)
  private workflows: Map<string, DomainWorkflow> = new Map();
  private executions: Map<string, ExecutionRecord> = new Map();

  // Injected services (optional — falls back to simulated mode)
  private pipelineEngine?: IPipelineExecutor;
  private deployService?: DeployService;
  private monitoringService?: MonitoringService;
  private notificationService?: NotificationService;
  private securityService?: AISecurityService;
  private database?: DatabasePool;

  /**
   * @param services - Optional real service instances. When omitted,
   *                   the orchestrator uses simulated execution (dev mode).
   */
  constructor(services?: OrchestratorServices) {
    this.pipelineEngine = services?.pipelineEngine;
    this.deployService = services?.deployService;
    this.monitoringService = services?.monitoringService;
    this.notificationService = services?.notificationService;
    this.securityService = services?.securityService;
    this.database = services?.database;

    // Initialize repositories if database is available
    if (this.database) {
      this.workflowRepository = new CrossDomainWorkflowRepository(this.database);
      this.executionRepository = new CrossDomainExecutionRepository(this.database);
    }
  }

  /**
   * Load all workflows from DB into in-memory cache on startup.
   */
  async initialize(): Promise<void> {
    if (!this.workflowRepository) return;

    try {
      const allWorkflows = await this.workflowRepository.findAll({ limit: 1000 });
      for (const entity of allWorkflows.entities) {
        const steps = await this.workflowRepository.getSteps(entity.id);
        const workflow = this.mapEntityToWorkflow(entity, steps);
        this.workflows.set(workflow.id, workflow);
      }
      logger.info(`[CrossDomainOrchestrator] Loaded ${allWorkflows.entities.length} workflows from DB`);
    } catch (err) {
      logger.warn('[CrossDomainOrchestrator] Failed to load workflows from DB:', err);
    }
  }

  /**
   * Lazily create a DeployService if not injected but database is available.
   */
  private getDeployService(): DeployService | undefined {
    if (this.deployService) return this.deployService;
    if (this.database) {
      this.deployService = new DeployService(new DeployRepository(this.database));
      return this.deployService;
    }
    return undefined;
  }

  /**
   * Lazily create a MonitoringService if not injected but database is available.
   */
  private getMonitoringService(): MonitoringService | undefined {
    if (this.monitoringService) return this.monitoringService;
    if (this.database) {
      this.monitoringService = new MonitoringService(new MonitoringRepository(this.database));
      return this.monitoringService;
    }
    return undefined;
  }

  /**
   * Lazily create a NotificationService if not injected but database is available.
   */
  private getNotificationService(): NotificationService | undefined {
    if (this.notificationService) return this.notificationService;
    if (this.database) {
      this.notificationService = new NotificationService(
        new NotificationRepository(this.database),
        undefined // eventPublisher — optional for in-app notifications
      );
      return this.notificationService;
    }
    return undefined;
  }

  /**
   * Create a new domain workflow — persists to DB when available.
   */
  async createWorkflow(input: CreateWorkflowInput): Promise<DomainWorkflow> {
    const workflowId = `workflow-${uuidv4()}`;
    const now = new Date();

    if (this.workflowRepository) {
      // Persist to DB
      const entity: Omit<WorkflowDefinitionEntity, 'createdAt' | 'updatedAt'> = {
        id: workflowId,
        tenantId: 'default',
        name: input.name,
        description: input.description,
        status: 'active',
        createdBy: null,
        lastRunAt: null,
      };

      const steps: Omit<WorkflowStepEntity, 'id'>[] = input.steps.map((s, i) => ({
        workflowId,
        domain: s.domain,
        action: s.action,
        parameters: s.parameters,
        dependsOn: s.dependsOn,
        timeoutMs: s.timeout,
        retryPolicy: s.retryPolicy || null,
        stepOrder: i,
      }));

      const createdEntity = await this.workflowRepository.createWithSteps(entity, steps);
      const createdSteps = await this.workflowRepository.getSteps(createdEntity.id);
      const workflow = this.mapEntityToWorkflow(createdEntity, createdSteps);
      this.workflows.set(workflow.id, workflow);
      return workflow;
    }

    // Fallback: in-memory only
    const workflow: DomainWorkflow = {
      id: workflowId,
      name: input.name,
      description: input.description,
      steps: input.steps.map((s) => ({
        ...s,
        id: `step-${uuidv4()}`,
      })),
      triggers: input.triggers,
      status: 'active',
      createdAt: now,
    };

    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  /**
   * Execute a workflow by ID — persists execution to DB when available.
   */
  async executeWorkflow(
    workflowId: string,
    triggeredBy: string,
    initialInput?: Record<string, unknown>
  ): Promise<ExecutionRecord> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new OrionError(ErrorCode.NOT_FOUND, 'Workflow not found');
    }

    // Allow re-execution of completed or failed workflows
    if (workflow.status !== 'active' && workflow.status !== 'completed' && workflow.status !== 'failed') {
      throw new OrionError(ErrorCode.OPERATION_FAILED, `Workflow is not active (current status: ${workflow.status})`);
    }

    // Reset to active for re-execution
    workflow.status = 'active';

    const executionId = `exec-${uuidv4()}`;
    const now = new Date();

    const execution: ExecutionRecord = {
      id: executionId,
      workflowId,
      status: 'running',
      steps: workflow.steps.map((s) => ({
        stepId: s.id,
        status: 'pending',
      })),
      startedAt: now,
      triggeredBy,
    };

    // Persist execution to DB
    if (this.executionRepository) {
      try {
        const execEntity: ExecutionEntity = {
          id: executionId,
          workflowId,
          status: 'running',
          triggeredBy,
          startedAt: now,
          completedAt: null,
        };
        await this.executionRepository.create(execEntity);

        // Create step records — use stepId as the record id for easy lookup
        for (const step of execution.steps) {
          const stepEntity: ExecutionStepEntity = {
            id: step.stepId, // Same id as workflow step for easy cross-reference
            executionId,
            stepId: step.stepId,
            status: 'pending',
            result: null,
            error: null,
            startedAt: null,
            completedAt: null,
          };
          await this.executionRepository.createStep(stepEntity);
        }
      } catch (err) {
        logger.warn('[CrossDomainOrchestrator] Failed to persist execution:', err);
      }
    }

    this.executions.set(execution.id, execution);
    workflow.lastRun = now;

    // Update workflow lastRunAt in DB
    if (this.workflowRepository) {
      try {
        await this.workflowRepository.updateLastRun(workflowId, now);
      } catch (err) {
        logger.warn('[CrossDomainOrchestrator] Failed to update workflow lastRun:', err);
      }
    }

    // Execute steps based on dependencies
    await this.executeSteps(execution, workflow.steps, initialInput || {});

    // Determine final status
    const hasFailed = execution.steps.some((s) => s.status === 'failed');
    execution.status = hasFailed ? 'failed' : 'completed';
    execution.completedAt = new Date();

    // Update workflow status
    workflow.status = execution.status === 'failed' ? 'failed' : 'completed';

    // Persist execution final status
    if (this.executionRepository) {
      try {
        await this.executionRepository.updateStatus(executionId, execution.status, execution.completedAt);
        // Update individual step results
        for (const step of execution.steps) {
          if (step.status !== 'pending') {
            // Find and update the step record — simplified approach
            await this.executionRepository.updateStep(
              step.stepId,
              step.status,
              step.result as Record<string, unknown> | null,
              step.error || null,
              step.completedAt || null,
            );
          }
        }
      } catch (err) {
        logger.warn('[CrossDomainOrchestrator] Failed to persist execution final status:', err);
      }
    }

    return execution;
  }

  /**
   * Execute workflow steps based on dependencies
   */
  private async executeSteps(
    execution: ExecutionRecord,
    steps: WorkflowStep[],
    context: Record<string, unknown>
  ): Promise<void> {
    const completed = new Set<string>();
    const stepMap = new Map(steps.map((s) => [s.id, s]));

    // Initialize step outputs tracking
    const stepContext: StepContext = { ...context, _stepOutputs: {} };

    while (completed.size < steps.length) {
      // Find steps that are ready to execute (all dependencies completed)
      const readySteps = steps.filter(
        (s) =>
          !completed.has(s.id) &&
          s.dependsOn.every((d) => completed.has(d))
      );

      if (readySteps.length === 0) {
        // No more steps can proceed - either done or stuck
        break;
      }

      // Execute ready steps in parallel (they have no inter-dependencies)
      const stepPromises = readySteps.map(async (step) => {
        const stepResult = execution.steps.find((s) => s.stepId === step.id)!;
        stepResult.status = 'running';
        stepResult.startedAt = new Date();

        try {
          // Resolve parameter references to previous step outputs
          const resolvedParams = this.resolveParameterReferences(step.parameters, stepContext);

          // Execute with timeout
          const result = await this.executeStepWithTimeout(
            { ...step, parameters: resolvedParams },
            stepContext
          );
          stepResult.status = 'completed';
          stepResult.result = result;
          stepResult.completedAt = new Date();

          // Store output in context for downstream steps
          stepContext[step.id] = result;
          if (stepContext._stepOutputs) {
            stepContext._stepOutputs[step.id] = result;
          }

          // Persist step completion to DB
          if (this.executionRepository) {
            try {
              await this.executionRepository.updateStep(
                step.id,
                'completed',
                result as Record<string, unknown> | null,
                null,
                new Date(),
              );
            } catch (err) {
              logger.warn('[CrossDomainOrchestrator] Failed to persist step result:', err);
            }
          }

          completed.add(step.id);
        } catch (e) {
          stepResult.status = 'failed';
          stepResult.error = e instanceof Error ? e.message : 'Unknown error';
          stepResult.completedAt = new Date();
          execution.status = 'failed';
          // Mark as completed so the loop can exit cleanly
          completed.add(step.id);
        }
      });

      // Wait for all ready steps to finish
      await Promise.allSettled(stepPromises);

      // If any step failed, stop execution immediately
      if (execution.status === 'failed') {
        return;
      }
    }
  }

  /**
   * Resolve parameter references to previous step outputs.
   * Supports `${stepId.field}` or `${stepId}` syntax in string values.
   */
  private resolveParameterReferences(
    params: Record<string, unknown>,
    context: StepContext
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        resolved[key] = this.resolveStringReferences(value, context);
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        resolved[key] = this.resolveParameterReferences(
          value as Record<string, unknown>,
          context
        );
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }

  /**
   * Resolve `${...}` placeholders in a string to context values.
   */
  private resolveStringReferences(
    str: string,
    context: StepContext
  ): string {
    return str.replace(/\$\{([^}]+)\}/g, (_match, path: string) => {
      const parts = path.split('.');
      let current: unknown = context;
      for (const part of parts) {
        if (current && typeof current === 'object' && part in (current as object)) {
          current = (current as Record<string, unknown>)[part];
        } else {
          // Leave unresolved references as-is
          return _match;
        }
      }
      return typeof current === 'string' ? current : JSON.stringify(current);
    });
  }

  /**
   * Execute a single step with timeout
   */
  private async executeStepWithTimeout(
    step: WorkflowStep,
    context: Record<string, unknown>
  ): Promise<unknown> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Step ${step.id} timed out after ${step.timeout}ms`));
      }, step.timeout);
    });

    return Promise.race([this.executeStep(step, context), timeoutPromise]);
  }

  /**
   * Execute a single step — connects to real services when available,
   * falls back to simulated execution in development mode.
   */
  private async executeStep(
    step: WorkflowStep,
    context: Record<string, unknown>
  ): Promise<unknown> {
    const { domain, action, parameters } = step;

    switch (domain) {
      case 'pipeline':
        return this.executePipelineStep(action, parameters, context);

      case 'deploy':
        return this.executeDeployStep(action, parameters, context);

      case 'monitor':
        return this.executeMonitorStep(action, parameters, context);

      case 'security':
        return this.executeSecurityStep(action, parameters, context);

      case 'notify':
        return this.executeNotifyStep(action, parameters, context);

      default:
        // Unknown domain — fall back to simulation
        logger.warn(
          `[CrossDomainOrchestrator] Unknown domain '${domain}', simulating execution`
        );
        return this.simulateStep(domain, action, parameters, context);
    }
  }

  // ============================================================
  // Domain-specific step executors
  // ============================================================

  /**
   * Pipeline domain — trigger pipeline execution via PipelineEngine.
   * Falls back to PipelineService CRUD if engine not available.
   */
  private async executePipelineStep(
    action: string,
    parameters: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<unknown> {
    if (this.pipelineEngine) {
      const pipelineId = (parameters.pipelineId as string) || (parameters.id as string);
      if (!pipelineId) {
        throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Pipeline domain requires pipelineId parameter');
      }

      const triggerType = (parameters.triggerType as string) || 'manual';
      const triggerBy = (parameters.triggerBy as string) || 'orchestrator';

      const result = await this.pipelineEngine.execute(pipelineId, triggerType, triggerBy, context);
      return {
        domain: 'pipeline',
        action,
        status: 'success',
        result,
      };
    }

    // Fallback: simulate
    logger.warn('[CrossDomainOrchestrator] PipelineEngine not available, simulating pipeline execution');
    return this.simulateStep('pipeline', action, parameters, context);
  }

  /**
   * Deploy domain — create/start deployments via DeployService.
   */
  private async executeDeployStep(
    action: string,
    parameters: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<unknown> {
    const service = this.getDeployService();
    if (service) {
      switch (action) {
        case 'create':
        case 'deploy': {
          const input: CreateDeploymentInput = {
            tenant_id: (parameters.tenantId as string) || 'default',
            project_id: parameters.projectId as string | undefined,
            pipeline_run_id: parameters.pipelineRunId as string | undefined,
            build_id: parameters.buildId as string | undefined,
            environment: (parameters.environment as string) || 'development',
            strategy: (parameters.strategy as string) || 'rolling',
            config: (parameters.config as Record<string, unknown>) || {},
            deployed_by: (parameters.deployedBy as string) || 'orchestrator',
          };
          const deployment = await service.createDeployment(input);
          return {
            domain: 'deploy',
            action,
            status: 'success',
            deploymentId: deployment.id,
            deployment,
          };
        }

        case 'rollback': {
          const deploymentId = (parameters.deploymentId as string) || (parameters.id as string);
          if (!deploymentId) {
            throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Rollback action requires deploymentId parameter');
          }
          const actorId = (parameters.actorId as string) || 'orchestrator';
          const rolledBack = await service.rollback(deploymentId, actorId);
          return {
            domain: 'deploy',
            action,
            status: 'success',
            deploymentId: rolledBack.id,
            deployment: rolledBack,
          };
        }

        case 'cancel': {
          const deploymentId = (parameters.deploymentId as string) || (parameters.id as string);
          if (!deploymentId) {
            throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Cancel action requires deploymentId parameter');
          }
          const actorId = (parameters.actorId as string) || 'orchestrator';
          const cancelled = await service.cancelDeployment(deploymentId, actorId);
          return {
            domain: 'deploy',
            action,
            status: 'success',
            deploymentId: cancelled.id,
            deployment: cancelled,
          };
        }

        case 'status': {
          const deploymentId = (parameters.deploymentId as string) || (parameters.id as string);
          if (!deploymentId) {
            throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Status action requires deploymentId parameter');
          }
          const deployment = await service.getDeployment(deploymentId);
          return {
            domain: 'deploy',
            action,
            status: 'success',
            deployment,
          };
        }

        default:
          throw new OrionError(ErrorCode.NOT_FOUND, `Unknown deploy action: ${action}`);
      }
    }

    // Fallback: simulate
    logger.warn('[CrossDomainOrchestrator] DeployService not available, simulating deploy execution');
    return this.simulateStep('deploy', action, parameters, context);
  }

  /**
   * Monitor domain — query metrics, alerts, and dashboard data via MonitoringService.
   */
  private async executeMonitorStep(
    action: string,
    parameters: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<unknown> {
    const service = this.getMonitoringService();
    if (service) {
      switch (action) {
        case 'verify':
        case 'health': {
          const healthStatus = service.getHealthStatus();
          return {
            domain: 'monitor',
            action,
            status: 'success',
            health: healthStatus,
          };
        }

        case 'query':
        case 'metrics': {
          const metricName = parameters.metricName as string | undefined;
          const metrics = service.getMetrics(metricName);
          return {
            domain: 'monitor',
            action,
            status: 'success',
            metrics,
          };
        }

        case 'alerts':
        case 'listAlerts': {
          const tenantId = (parameters.tenantId as string) || 'default';
          const alerts = await service.listAlerts({ tenantId });
          return {
            domain: 'monitor',
            action,
            status: 'success',
            alerts,
          };
        }

        case 'dashboard': {
          const dashboardData = await service.getDashboardData();
          return {
            domain: 'monitor',
            action,
            status: 'success',
            dashboard: dashboardData,
          };
        }

        case 'evaluateRules': {
          const newAlerts = await service.evaluateRules();
          return {
            domain: 'monitor',
            action,
            status: 'success',
            newAlerts,
          };
        }

        default:
          throw new OrionError(ErrorCode.NOT_FOUND, `Unknown monitor action: ${action}`);
      }
    }

    // Fallback: simulate
    logger.warn('[CrossDomainOrchestrator] MonitoringService not available, simulating monitor execution');
    return this.simulateStep('monitor', action, parameters, context);
  }

  /**
   * Security domain — run security scans via AISecurityService.
   */
  private async executeSecurityStep(
    action: string,
    parameters: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<unknown> {
    if (this.securityService) {
      switch (action) {
        case 'scan':
        case 'process': {
          const input = (parameters.input as string) || JSON.stringify(parameters);
          const userId = (parameters.userId as string) || 'orchestrator';
          const result = await this.securityService.processRequest(input, userId);
          return {
            domain: 'security',
            action,
            status: result.riskScore < 70 ? 'success' : 'warning',
            securityResult: result,
          };
        }

        case 'sanitize': {
          const input = (parameters.input as string) || '';
          const sanitized = sanitizeInput(input);
          return {
            domain: 'security',
            action,
            status: sanitized.passed ? 'success' : 'warning',
            sanitized,
          };
        }

        case 'validate':
        case 'validateOutput': {
          const output = (parameters.output as string) || '';
          const validated = validateOutput(output);
          return {
            domain: 'security',
            action,
            status: validated.passed ? 'success' : 'warning',
            validated,
          };
        }

        case 'audit':
        case 'getAuditLogs': {
          const logs = await this.securityService.getAuditLogsAsync({
            userId: parameters.userId as string | undefined,
          });
          return {
            domain: 'security',
            action,
            status: 'success',
            auditLogs: logs,
          };
        }

        default:
          throw new OrionError(ErrorCode.NOT_FOUND, `Unknown security action: ${action}`);
      }
    }

    // Fallback: simulate
    logger.warn('[CrossDomainOrchestrator] AISecurityService not available, simulating security execution');
    return this.simulateStep('security', action, parameters, context);
  }

  /**
   * Notify domain — send notifications via NotificationService.
   */
  private async executeNotifyStep(
    action: string,
    parameters: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<unknown> {
    const service = this.getNotificationService();
    if (service) {
      switch (action) {
        case 'send':
        case 'notify': {
          const input: CreateNotificationInput = {
            tenant_id: (parameters.tenantId as string) || 'default',
            user_id: (parameters.userId as string) || '',
            type: (parameters.type as string) || 'info',
            title: (parameters.title as string) || 'Notification',
            message: (parameters.message as string) || '',
            channel: (parameters.channel as string) || 'in-app',
          };
          if (!input.user_id) {
            throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Notification requires userId parameter');
          }
          const notification = await service.send(input);
          return {
            domain: 'notify',
            action,
            status: 'success',
            notificationId: notification.id,
            notification,
          };
        }

        case 'list':
        case 'getNotifications': {
          const userId = (parameters.userId as string) || '';
          if (!userId) {
            throw new OrionError(ErrorCode.VALIDATION_ERROR, 'List notifications requires userId parameter');
          }
          const limit = (parameters.limit as number) || 20;
          const page = (parameters.page as number) || 1;
          const notifications = await service.getNotifications(userId, limit, page);
          return {
            domain: 'notify',
            action,
            status: 'success',
            notifications,
          };
        }

        case 'markRead': {
          const notificationId = (parameters.notificationId as string) || (parameters.id as string);
          if (!notificationId) {
            throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Mark read requires notificationId parameter');
          }
          const updated = await service.markAsRead(notificationId);
          return {
            domain: 'notify',
            action,
            status: 'success',
            notification: updated,
          };
        }

        case 'unreadCount': {
          const userId = (parameters.userId as string) || '';
          if (!userId) {
            throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Unread count requires userId parameter');
          }
          const count = await service.getUnreadCount(userId);
          return {
            domain: 'notify',
            action,
            status: 'success',
            unreadCount: count,
          };
        }

        case 'broadcast': {
          const tenantId = (parameters.tenantId as string) || 'default';
          const userIds = (parameters.userIds as string[]) || [];
          const type = (parameters.type as string) || 'info';
          const title = (parameters.title as string) || 'Broadcast';
          const message = (parameters.message as string) || '';
          if (userIds.length === 0) {
            throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Broadcast requires userIds parameter');
          }
          const count = await service.broadcast(tenantId, userIds, type, title, message);
          return {
            domain: 'notify',
            action,
            status: 'success',
            sentCount: count,
          };
        }

        default:
          throw new OrionError(ErrorCode.NOT_FOUND, `Unknown notify action: ${action}`);
      }
    }

    // Fallback: simulate
    logger.warn('[CrossDomainOrchestrator] NotificationService not available, simulating notify execution');
    return this.simulateStep('notify', action, parameters, context);
  }

  /**
   * Simulate step execution (development / fallback mode)
   */
  private async simulateStep(
    domain: string,
    action: string,
    parameters: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<unknown> {
    // Small delay to simulate async work
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 50 + 10));

    return {
      domain,
      action,
      result: 'success',
      parameters,
      contextKeys: Object.keys(context).filter((k) => !k.startsWith('_')),
    };
  }

  /**
   * Get a workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<DomainWorkflow | null> {
    return this.workflows.get(workflowId) || null;
  }

  /**
   * List all workflows — reads from DB when available for consistency.
   */
  async listWorkflows(filter?: WorkflowListFilter): Promise<DomainWorkflow[]> {
    if (this.workflowRepository) {
      try {
        const result = await this.workflowRepository.findAll({
          where: filter?.status ? { status: filter.status } : undefined,
          limit: filter?.limit || 100,
          offset: filter?.offset || 0,
        });

        let workflows: DomainWorkflow[] = [];
        for (const entity of result.entities) {
          const steps = await this.workflowRepository.getSteps(entity.id);
          workflows.push(this.mapEntityToWorkflow(entity, steps));
        }

        if (filter?.domain) {
          workflows = workflows.filter((w) =>
            w.steps.some((s) => s.domain === filter.domain)
          );
        }

        return workflows;
      } catch (err) {
        logger.warn('[CrossDomainOrchestrator] DB listWorkflows failed, falling back to in-memory:', err);
      }
    }

    // Fallback: in-memory
    let results = Array.from(this.workflows.values());

    if (filter?.status) {
      results = results.filter((w) => w.status === filter.status);
    }

    if (filter?.domain) {
      results = results.filter((w) =>
        w.steps.some((s) => s.domain === filter.domain)
      );
    }

    // Sort by createdAt descending
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const offset = filter?.offset || 0;
    const limit = filter?.limit || 100;
    return results.slice(offset, offset + limit);
  }

  /**
   * Get an execution by ID
   */
  async getExecution(executionId: string): Promise<ExecutionRecord | null> {
    return this.executions.get(executionId) || null;
  }

  /**
   * List executions for a workflow
   */
  async listExecutions(workflowId: string): Promise<ExecutionRecord[]> {
    if (this.executionRepository) {
      try {
        const execEntities = await this.executionRepository.findByWorkflowId(workflowId);
        const records: ExecutionRecord[] = [];

        for (const entity of execEntities) {
          const stepEntities = await this.executionRepository.getSteps(entity.id);
          const record: ExecutionRecord = {
            id: entity.id,
            workflowId: entity.workflowId,
            status: entity.status,
            steps: stepEntities.map((s) => ({
              stepId: s.stepId,
              status: s.status,
              result: s.result,
              error: s.error || undefined,
              startedAt: s.startedAt || undefined,
              completedAt: s.completedAt || undefined,
            })),
            startedAt: entity.startedAt,
            completedAt: entity.completedAt || undefined,
            triggeredBy: entity.triggeredBy,
          };
          records.push(record);
        }

        return records;
      } catch (err) {
        logger.warn('[CrossDomainOrchestrator] DB listExecutions failed, falling back to in-memory:', err);
      }
    }

    // Fallback: in-memory
    return Array.from(this.executions.values())
      .filter((e) => e.workflowId === workflowId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  /**
   * Pause a workflow — persists status change to DB.
   */
  async pauseWorkflow(workflowId: string): Promise<boolean> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return false;
    }

    if (workflow.status !== 'active') {
      throw new OrionError('OPERATION_FAILED', `Cannot pause workflow with status: ${workflow.status}`)
    }

    workflow.status = 'paused';

    if (this.workflowRepository) {
      try {
        await this.workflowRepository.updateStatus(workflowId, 'paused');
      } catch (err) {
        logger.warn('[CrossDomainOrchestrator] Failed to persist pause status:', err);
      }
    }
    return true;
  }

  /**
   * Resume a paused workflow — persists status change to DB.
   */
  async resumeWorkflow(workflowId: string): Promise<boolean> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return false;
    }

    if (workflow.status !== 'paused') {
      throw new OrionError('OPERATION_FAILED', `Cannot resume workflow with status: ${workflow.status}`)
    }

    workflow.status = 'active';

    if (this.workflowRepository) {
      try {
        await this.workflowRepository.updateStatus(workflowId, 'active');
      } catch (err) {
        logger.warn('[CrossDomainOrchestrator] Failed to persist resume status:', err);
      }
    }
    return true;
  }

  // ==================== Entity Mapping ====================

  /**
   * Map DB entity + steps to DomainWorkflow
   */
  private mapEntityToWorkflow(entity: WorkflowDefinitionEntity, steps: WorkflowStepEntity[]): DomainWorkflow {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description || '',
      steps: steps.map((s) => ({
        id: s.id,
        domain: s.domain,
        action: s.action,
        parameters: s.parameters,
        dependsOn: s.dependsOn,
        timeout: s.timeoutMs,
        retryPolicy: s.retryPolicy || undefined,
      })),
      triggers: [], // Triggers not persisted in schema; derived from external config
      status: entity.status,
      lastRun: entity.lastRunAt || undefined,
      createdAt: entity.createdAt,
    };
  }
}