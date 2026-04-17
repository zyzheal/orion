/**
 * Agent Run Service
 *
 * 负责 Agent 工作流的执行：
 * - 手动触发 Agent 运行
 * - 执行 Agent 步骤（read_file, run_command）
 * - 记录决策日志
 * - 返回运行结果
 */

import pino from 'pino';
import { AgentProfileService } from './agent-profile-service';
import { EventBusService } from './event-bus-service';
import {
  AgentRun,
  AgentRunCreateInput,
  AgentRunStatus,
  AgentAction,
  AgentDecision,
  createAgentRun,
  addDecision,
  completeDecision,
  failDecision,
  completeRun,
  failRun,
  cancelRun,
} from '../models/AgentRun';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class AgentRunService {
  private runs: Map<string, AgentRun> = new Map();
  private agentProfileService: AgentProfileService;
  private eventBus?: EventBusService;

  constructor(options: {
    agentProfileService: AgentProfileService;
    eventBus?: EventBusService;
  }) {
    this.agentProfileService = options.agentProfileService;
    this.eventBus = options.eventBus;
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

    const run = createAgentRun({
      ...input,
      agentProfileName: profile.name,
      timeoutSec: profile.capabilities.timeoutSec,
    });

    this.runs.set(run.id, run);

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
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Agent run "${runId}" not found`);
    }

    if (run.status !== 'running') {
      throw new Error(`Agent run "${runId}" is not running (status: ${run.status})`);
    }

    // Check timeout
    if (new Date() > run.timeoutAt) {
      failRun(run, 'Agent run timed out');
      throw new Error('Agent run timed out');
    }

    // Get agent profile for constraints
    const profile = await this.agentProfileService.getById(run.agentProfileId);
    const stepNumber = run.currentStep + 1;

    // Create decision record
    const decision = addDecision(
      run,
      profile.id,
      stepNumber,
      action,
      actionInput,
      `Executing ${action} as part of agent workflow`
    );

    logger.info(
      { runId, step: stepNumber, action },
      'Executing agent step'
    );

    try {
      // Execute the actual tool
      const toolResult = await this.executeTool(action, actionInput, profile);

      completeDecision(decision, toolResult, {
        step: stepNumber,
        status: 'completed',
        timestamp: new Date().toISOString(),
      });

      // Check if this was the last step
      if (stepNumber >= run.totalSteps) {
        completeRun(run, {
          finalStep: stepNumber,
          decisions: run.decisions.map((d) => ({
            action: d.action,
            status: d.error ? 'failed' : 'completed',
            toolResult: d.toolResult,
          })),
          completedAt: new Date().toISOString(),
        });

        await this.publishEvent('agent.run.completed', {
          runId: run.id,
          result: run.result,
        });
      }

      logger.info(
        { runId, step: stepNumber, action },
        'Agent step completed'
      );
      return decision;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      failDecision(decision, errorMsg);
      failRun(run, `Step ${stepNumber} failed: ${errorMsg}`);

      await this.publishEvent('agent.run.failed', {
        runId: run.id,
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
        const filePath = actionInput.filePath as string || '/tmp/agent_output.ts';
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
    let runs = Array.from(this.runs.values());

    if (options?.agentProfileId) {
      runs = runs.filter((r) => r.agentProfileId === options.agentProfileId);
    }

    if (options?.statusFilter) {
      runs = runs.filter((r) => r.status === options.statusFilter);
    }

    // Sort by startedAt descending
    runs.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    return runs;
  }

  /**
   * 获取 Agent 运行详情
   */
  async getById(id: string): Promise<AgentRun> {
    const run = this.runs.get(id);
    if (!run) {
      throw new Error(`Agent run "${id}" not found`);
    }
    return run;
  }

  /**
   * 取消 Agent 运行
   */
  async cancel(id: string): Promise<AgentRun> {
    const run = this.runs.get(id);
    if (!run) {
      throw new Error(`Agent run "${id}" not found`);
    }

    if (run.status !== 'running') {
      throw new Error(`Agent run "${id}" is not running (status: ${run.status})`);
    }

    cancelRun(run);

    await this.publishEvent('agent.run.cancelled', { runId: run.id });
    logger.info({ runId: run.id }, 'Agent run cancelled');
    return run;
  }

  /**
   * 重试 Agent 运行
   */
  async retry(id: string): Promise<AgentRun> {
    const existing = this.runs.get(id);
    if (!existing) {
      throw new Error(`Agent run "${id}" not found`);
    }

    // Create a new run with same parameters
    const newRun = createAgentRun({
      agentProfileId: existing.agentProfileId,
      agentProfileName: existing.agentProfileName,
      triggerPayload: existing.triggerPayload,
      totalSteps: existing.totalSteps,
      tenantId: existing.tenantId,
    });

    this.runs.set(newRun.id, newRun);

    await this.publishEvent('agent.run.retried', {
      originalRunId: id,
      newRunId: newRun.id,
    });

    logger.info({ originalRunId: id, newRunId: newRun.id }, 'Agent run retried');
    return newRun;
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
