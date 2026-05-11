import type { Redis } from 'ioredis';
import type { AppConfig } from '../config/app';
import type { Agent, AgentStatus, ScalingDecision } from '../types/agent';
import type { AgentService } from './AgentService';

/**
 * RunnerManager handles agent pool auto-scaling:
 * - Monitors agent utilization and health
 * - Scales up when demand exceeds capacity
 * - Scales down when agents are idle
 * - Enforces maximum runner limits
 * - Respects cooldown between scaling actions
 */
export class RunnerManager {
  private redis: Redis;
  private config: AppConfig;
  private agentService: AgentService;
  private lastScalingAction: Date | null = null;

  constructor(
    redis: Redis,
    config: AppConfig,
    agentService: AgentService,
  ) {
    this.redis = redis;
    this.config = config;
    this.agentService = agentService;
  }

  /**
   * Evaluate whether to scale the agent pool up or down
   *
   * TODO: Full implementation needs:
   * - Check cooldown period since last scaling
   * - Collect agent utilization metrics
   * - Compare against thresholds
   * - Emit scaling decision
   * - Trigger provisioning or decommissioning
   */
  async evaluate(): Promise<ScalingDecision> {
    // TODO: Respect cooldown
    if (this.isInCooldown()) {
      return {
        action: 'no_op',
        count: 0,
        reason: 'Still within scaling cooldown period',
        timestamp: new Date().toISOString(),
      };
    }

    const counts = await this.agentService.counts();
    const totalAgents = Object.values(counts).reduce((a, b) => a + b, 0);
    const idleCount = counts[AgentStatus.IDLE] || 0;
    const busyCount = counts[AgentStatus.BUSY] || 0;
    const deadCount = counts[AgentStatus.DEAD] || 0;

    // TODO: Calculate utilization
    // const utilization = totalAgents > 0
    //   ? (busyCount / totalAgents) * 100
    //   : 0;

    // TODO: Check scale up conditions
    // - No idle agents and pending tasks
    // - Utilization above threshold
    // - Below max runner limit

    // TODO: Check scale down conditions
    // - Excess idle agents
    // - Utilization below threshold

    return {
      action: 'no_op',
      count: 0,
      reason: 'Scaling evaluation not yet implemented',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Scale up the agent pool by provisioning new runners
   */
  async scaleUp(count: number): Promise<ScalingDecision> {
    // TODO: Validate count + current <= maxRunners
    // TODO: Provision new agent instances
    // - Via cloud provider API, k8s, or Docker
    // TODO: Record scaling action
    // TODO: Update lastScalingAction

    this.lastScalingAction = new Date();

    return {
      action: 'scale_up',
      count,
      reason: 'Scale up not yet implemented',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Scale down the agent pool by decommissioning idle runners
   */
  async scaleDown(count: number): Promise<ScalingDecision> {
    // TODO: Identify idle agents to decommission
    // - Prefer agents idle longest
    // - Avoid agents with recent registration
    // TODO: Gracefully drain (stop accepting new tasks)
    // TODO: Deregister after tasks complete
    // TODO: Record scaling action

    this.lastScalingAction = new Date();

    return {
      action: 'scale_down',
      count,
      reason: 'Scale down not yet implemented',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check if we're within the scaling cooldown period
   */
  private isInCooldown(): boolean {
    if (!this.lastScalingAction) return false;
    const elapsed =
      (Date.now() - this.lastScalingAction.getTime()) / 1000;
    return elapsed < this.config.scaling.cooldown;
  }

  /**
   * Start the scaling evaluation interval
   */
  startInterval(): ReturnType<typeof setInterval> {
    return setInterval(async () => {
      try {
        const decision = await this.evaluate();
        if (decision.action === 'scale_up') {
          await this.scaleUp(decision.count);
        } else if (decision.action === 'scale_down') {
          await this.scaleDown(decision.count);
        }
      } catch (err) {
        // TODO: Log scaling errors
      }
    }, 30_000); // Evaluate every 30 seconds
  }

  /**
   * Get current pool status
   */
  async getPoolStatus(): Promise<{
    total: number;
    idle: number;
    busy: number;
    dead: number;
    max: number;
    utilization: number;
  }> {
    const counts = await this.agentService.counts();
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const busy = counts[AgentStatus.BUSY] || 0;
    const utilization = total > 0 ? (busy / total) * 100 : 0;

    return {
      total,
      idle: counts[AgentStatus.IDLE] || 0,
      busy,
      dead: counts[AgentStatus.DEAD] || 0,
      max: this.config.scaling.maxRunners,
      utilization: Math.round(utilization * 100) / 100,
    };
  }
}
