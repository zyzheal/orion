/**
 * Agent Run Service
 *
 * 负责 Agent 工作流的执行：
 * - 手动触发 Agent 运行
 * - 执行 Agent 步骤（read_file, run_command）
 * - 记录决策日志
 * - 返回运行结果
 *
 * Uses PostgreSQL Repository pattern for persistence.
 */

import pino from 'pino';
import { AgentProfileService } from './agent-profile-service';
import { EventBusService } from './event-bus-service';
import { AgentRunRepository } from '../../repositories/AgentRunRepository';
import {
  AgentRun,
  AgentRunCreateInput,
  AgentRunStatus,
  AgentAction,
  AgentDecision,
  createAgentRun,
} from '../../models/AgentRun';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class AgentRunService {
  private runRepository: AgentRunRepository;
  private agentProfileService: AgentProfileService;
  private eventBus?: EventBusService;

  constructor(options: {
    agentProfileService: AgentProfileService;
    eventBus?: EventBusService;
    runRepository: AgentRunRepository;
  }) {
    this.agentProfileService = options.agentProfileService;
    this.eventBus = options.eventBus;
    this.runRepository = options.runRepository;
  }

  /**
   * 手动触发 Agent 运行
   */
  async triggerRun(input: AgentRunCreateInput): Promise<AgentRun> {
    logger.info({
      agentProfileId: input.agentProfileId,
      triggerPayload: input.triggerPayload,
    }, 'Triggering agent run');

    // Validate agent profile exists and is enabled
    const profile = await this.agentProfileService.getById(input.agentProfileId);
    if (!profile.enabled) {
      throw new Error(`Agent profile "${profile.name}" is disabled`);
    }

    const timeoutSec = profile.capabilities?.timeoutSec || 3600;
    const now = new Date();
    const timeoutAt = new Date(now.getTime() + timeoutSec * 1000);

    // Persist run to database
    const entity = await this.runRepository.createRun(
      input.agentProfileId,
      input.triggerPayload,
      input.totalSteps || 1,
      timeoutAt,
      input.tenantId
    );

    const run = createAgentRun({
      ...input,
      agentProfileName: profile.name,
      timeoutSec,
    });
    // Override the ID with the database-generated UUID
    run.id = entity.id;

    // Publish event
    await this.publishEvent('agent.run.started', {
      runId: run.id,
      agentProfileId: run.agentProfileId,
      agentProfileName: run.agentProfileName,
    });

    logger.info({ runId: run.id }, 'Agent run started');
    return run;
  }

  /**
   * 执行 Agent 步骤 (MVP: 只执行一步)
   */
  async executeStep(
    runId: string,
    action: AgentAction,
    actionInput: Record<string, unknown>
  ): Promise<AgentDecision> {
    // Fetch run from DB
    const entity = await this.runRepository.findRunById(runId);
    if (!entity) {
      throw new Error(`Agent run "${runId}" not found`);
    }

    if (entity.status !== 'running') {
      throw new Error(`Agent run "${runId}" is not running (status: ${entity.status})`);
    }

    // Check timeout
    if (new Date() > entity.timeout_at) {
      await this.runRepository.failRun(runId, 'Agent run timed out');
      throw new Error('Agent run timed out');
    }

    // Get agent profile for constraints
    const profile = await this.agentProfileService.getById(entity.agent_profile_id);
    const stepNumber = entity.current_step + 1;

    // Create decision record in DB
    const decisionRecord = await this.runRepository.createDecision(
      runId,
      profile.id,
      stepNumber,
      action,
      actionInput as Record<string, any>,
      `Executing ${action} as part of agent workflow`
    );

    // Build in-memory decision object for return
    const decision: AgentDecision = {
      id: decisionRecord.id,
      runId,
      agentId: profile.id,
      stepNumber,
      action,
      actionInput: actionInput as Record<string, unknown>,
      reasoning: `Executing ${action} as part of agent workflow`,
      createdAt: new Date(),
    };

    logger.info(
      { runId, step: stepNumber, action },
      'Executing agent step'
    );

    try {
      // Execute the actual tool
      const toolResult = await this.executeTool(action, actionInput, profile);

      // Update decision in DB
      await this.runRepository.updateDecision(decisionRecord.id, {
        toolResult,
        actionOutput: { step: stepNumber, status: 'completed', timestamp: new Date().toISOString() },
      });

      decision.toolResult = toolResult;
      decision.actionOutput = { step: stepNumber, status: 'completed', timestamp: new Date().toISOString() };

      // Update step counter
      await this.runRepository.updateStep(runId, stepNumber);

      // Check if this was the last step
      if (stepNumber >= entity.total_steps) {
        await this.runRepository.completeRun(runId, {
          finalStep: stepNumber,
          status: 'completed',
          completedAt: new Date().toISOString(),
        });

        await this.publishEvent('agent.run.completed', {
          runId: runId,
          result: decision.toolResult,
        });
      }

      logger.info(
        { runId, step: stepNumber, action },
        'Agent step completed'
      );
      return decision;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await this.runRepository.updateDecision(decisionRecord.id, { error: errorMsg });
      await this.runRepository.failRun(runId, `Step ${stepNumber} failed: ${errorMsg}`);

      await this.publishEvent('agent.run.failed', {
        runId: runId,
        error: errorMsg,
        step: stepNumber,
      });

      throw error;
    }
  }

  /**
   * 执行工具 (MVP: 模拟 read_file 和 run_command)
   */
  private async executeTool(
    action: AgentAction,
    actionInput: Record<string, unknown>,
    profile: any
  ): Promise<Record<string, unknown>> {
    // Check if tool is allowed by profile
    const allowedTool = profile.tools.find(
      (t: any) => t.toolName === action && (t.permission === 'read' || t.permission === 'execute')
    );

    if (!allowedTool) {
      throw new Error(`Tool "${action}" is not allowed for agent profile`);
    }

    switch (action) {
      case 'read_file': {
        const filePath = actionInput.filePath as string || '/dev/null';
        return {
          success: true,
          filePath,
          content: `# Simulated file content for ${filePath}\n# In MVP, this returns mock content`,
          lines: 2,
          timestamp: new Date().toISOString(),
        };
      }

      case 'run_command': {
        const command = actionInput.command as string || 'echo hello';
        // Block dangerous commands
        const blocked = ['rm -rf /', 'DROP TABLE', 'sudo rm', 'chmod 777 /'];
        if (blocked.some((b) => command.includes(b))) {
          throw new Error(`Command "${command}" is forbidden`);
        }

        return {
          success: true,
          command,
          stdout: `[MVP] Simulated output for: ${command}`,
          stderr: '',
          exitCode: 0,
          durationMs: 50,
          timestamp: new Date().toISOString(),
        };
      }

      case 'write_code': {
        const filePath = actionInput.filePath as string || '/tmp/agent-output.ts';
        const content = actionInput.content as string || '// Agent generated code';
        return {
          success: true,
          filePath,
          linesWritten: content.split('\n').length,
          timestamp: new Date().toISOString(),
        };
      }

      case 'create_pr': {
        return {
          success: true,
          prUrl: 'https://github.com/org/repo/pull/1',
          prNumber: 1,
          timestamp: new Date().toISOString(),
        };
      }

      case 'request_approval': {
        return {
          success: true,
          approvalId: `approval-${Date.now()}`,
          status: 'pending',
          timestamp: new Date().toISOString(),
        };
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * 获取 Agent 运行列表
   */
  async list(options?: {
    agentProfileId?: string;
    statusFilter?: AgentRunStatus;
  }): Promise<AgentRun[]> {
    const entities = await this.runRepository.listRuns(options);

    // Convert entities to AgentRun format
    const runs: AgentRun[] = [];
    for (const entity of entities) {
      const decisions = await this.runRepository.getDecisionsByRunId(entity.id);
      runs.push({
        id: entity.id,
        agentProfileId: entity.agent_profile_id,
        agentProfileName: '', // Would need a join or separate query
        triggerPayload: entity.trigger_payload,
        status: entity.status as AgentRunStatus,
        currentStep: entity.current_step,
        totalSteps: entity.total_steps,
        result: entity.result || undefined,
        error: entity.error || undefined,
        startedAt: entity.started_at,
        completedAt: entity.completed_at || undefined,
        timeoutAt: entity.timeout_at,
        decisions: decisions.map(d => ({
          id: d.id,
          runId: d.run_id,
          agentId: d.agent_id,
          stepNumber: d.step_number,
          action: d.action as AgentAction,
          actionInput: d.action_input,
          actionOutput: d.action_output || undefined,
          reasoning: d.reasoning,
          toolResult: d.tool_result || undefined,
          error: d.error || undefined,
          createdAt: d.created_at,
        })),
        tenantId: entity.tenant_id || undefined,
      });
    }

    return runs;
  }

  /**
   * 获取 Agent 运行详情
   */
  async getById(id: string): Promise<AgentRun> {
    const entity = await this.runRepository.findRunById(id);
    if (!entity) {
      throw new Error(`Agent run "${id}" not found`);
    }

    const decisions = await this.runRepository.getDecisionsByRunId(id);

    return {
      id: entity.id,
      agentProfileId: entity.agent_profile_id,
      agentProfileName: '',
      triggerPayload: entity.trigger_payload,
      status: entity.status as AgentRunStatus,
      currentStep: entity.current_step,
      totalSteps: entity.total_steps,
      result: entity.result || undefined,
      error: entity.error || undefined,
      startedAt: entity.started_at,
      completedAt: entity.completed_at || undefined,
      timeoutAt: entity.timeout_at,
      decisions: decisions.map(d => ({
        id: d.id,
        runId: d.run_id,
        agentId: d.agent_id,
        stepNumber: d.step_number,
        action: d.action as AgentAction,
        actionInput: d.action_input,
        actionOutput: d.action_output || undefined,
        reasoning: d.reasoning,
        toolResult: d.tool_result || undefined,
        error: d.error || undefined,
        createdAt: d.created_at,
      })),
      tenantId: entity.tenant_id || undefined,
    };
  }

  /**
   * 取消 Agent 运行
   */
  async cancel(id: string): Promise<AgentRun> {
    const entity = await this.runRepository.findRunById(id);
    if (!entity) {
      throw new Error(`Agent run "${id}" not found`);
    }

    if (entity.status !== 'running') {
      throw new Error(`Agent run "${id}" is not running (status: ${entity.status})`);
    }

    const updated = await this.runRepository.cancelRun(id);
    if (!updated) {
      throw new Error(`Agent run "${id}" not found`);
    }

    const decisions = await this.runRepository.getDecisionsByRunId(id);

    await this.publishEvent('agent.run.cancelled', { runId: id });
    logger.info({ runId: id }, 'Agent run cancelled');

    return {
      id: updated.id,
      agentProfileId: updated.agent_profile_id,
      agentProfileName: '',
      triggerPayload: updated.trigger_payload,
      status: updated.status as AgentRunStatus,
      currentStep: updated.current_step,
      totalSteps: updated.total_steps,
      result: updated.result || undefined,
      error: updated.error || undefined,
      startedAt: updated.started_at,
      completedAt: updated.completed_at || undefined,
      timeoutAt: updated.timeout_at,
      decisions: decisions.map(d => ({
        id: d.id,
        runId: d.run_id,
        agentId: d.agent_id,
        stepNumber: d.step_number,
        action: d.action as AgentAction,
        actionInput: d.action_input,
        actionOutput: d.action_output || undefined,
        reasoning: d.reasoning,
        toolResult: d.tool_result || undefined,
        error: d.error || undefined,
        createdAt: d.created_at,
      })),
      tenantId: updated.tenant_id || undefined,
    };
  }

  /**
   * 重试 Agent 运行
   */
  async retry(id: string): Promise<AgentRun> {
    const existing = await this.runRepository.findRunById(id);
    if (!existing) {
      throw new Error(`Agent run "${id}" not found`);
    }

    // Create a new run with same parameters
    const timeoutSec = 3600;
    const now = new Date();
    const timeoutAt = new Date(now.getTime() + timeoutSec * 1000);

    const newEntity = await this.runRepository.createRun(
      existing.agent_profile_id,
      existing.trigger_payload,
      existing.total_steps,
      timeoutAt,
      existing.tenant_id || undefined
    );

    const profile = await this.agentProfileService.getById(existing.agent_profile_id);

    await this.publishEvent('agent.run.retried', {
      originalRunId: id,
      newRunId: newEntity.id,
    });

    logger.info({ originalRunId: id, newRunId: newEntity.id }, 'Agent run retried');

    return {
      id: newEntity.id,
      agentProfileId: newEntity.agent_profile_id,
      agentProfileName: profile.name,
      triggerPayload: newEntity.trigger_payload,
      status: 'running',
      currentStep: 0,
      totalSteps: newEntity.total_steps,
      startedAt: newEntity.started_at,
      timeoutAt: newEntity.timeout_at,
      decisions: [],
      tenantId: newEntity.tenant_id || undefined,
    };
  }

  /**
   * 发布事件
   */
  private async publishEvent(type: string, data: any): Promise<void> {
    if (this.eventBus) {
      try {
        await this.eventBus.publish(type, data, { source: 'agent-run-service' });
      } catch (err) {
        logger.error({ err }, 'Failed to publish agent event');
      }
    }
  }
}
