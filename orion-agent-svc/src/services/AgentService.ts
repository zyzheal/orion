import { v4 as uuidv4 } from 'uuid';
import type { Redis } from 'ioredis';
import {
  Agent,
  AgentStatus,
  RegisterAgentRequest,
  HeartbeatRequest,
} from '../types/agent';
import type { AppConfig } from '../config/app';

/**
 * AgentService handles agent (Runner) lifecycle:
 * - Registration
 * - Heartbeat processing
 * - Status management (idle/busy/stale/dead transitions)
 * - Agent listing and lookup
 */
export class AgentService {
  private redis: Redis;
  private config: AppConfig;
  private agentKeyPrefix = 'agent:';
  private agentsSetKey = 'agents:all';

  constructor(redis: Redis, config: AppConfig) {
    this.redis = redis;
    this.config = config;
  }

  /**
   * Register a new agent
   *
   * TODO: Full implementation needs:
   * - Uniqueness validation (name)
   * - Redis storage (hash + set membership)
   * - Heartbeat interval timer setup
   * - Capability-based routing support
   */
  async register(request: RegisterAgentRequest): Promise<Agent> {
    const agent: Agent = {
      id: uuidv4(),
      name: request.name,
      status: AgentStatus.REGISTERING,
      registeredAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
      currentTaskId: null,
      tasksCompleted: 0,
      tasksFailed: 0,
      metadata: request.metadata,
    };

    // TODO: Persist to Redis
    // await this.redis.hset(this.agentKeyPrefix + agent.id, agent);
    // await this.redis.sadd(this.agentsSetKey, agent.id);

    // Transition to IDLE after registration
    agent.status = AgentStatus.IDLE;

    return agent;
  }

  /**
   * Process agent heartbeat
   *
   * TODO: Full implementation needs:
   * - Validate agent exists
   * - Update lastHeartbeat timestamp
   * - Check stale/dead thresholds
   * - Update agent status if provided in request
   * - Update metrics if provided
   * - Return updated agent state
   */
  async heartbeat(
    agentId: string,
    request: HeartbeatRequest,
  ): Promise<Agent | null> {
    // TODO: Fetch agent from Redis
    // const agentData = await this.redis.hgetall(this.agentKeyPrefix + agentId);

    // TODO: Update heartbeat timestamp
    // await this.redis.hset(
    //   this.agentKeyPrefix + agentId,
    //   'lastHeartbeat',
    //   new Date().toISOString(),
    // );

    // TODO: Check if agent has gone stale/dead
    // await this.checkStaleAgents();

    return null; // placeholder
  }

  /**
   * Get a single agent by ID
   */
  async getById(agentId: string): Promise<Agent | null> {
    // TODO: Fetch from Redis
    // const data = await this.redis.hgetall(this.agentKeyPrefix + agentId);
    // return data?.id ? this.parseAgent(data) : null;
    return null;
  }

  /**
   * List all agents, optionally filtered by status
   */
  async list(status?: AgentStatus): Promise<Agent[]> {
    // TODO: Get all agent IDs from set
    // const ids = await this.redis.smembers(this.agentsSetKey);
    // const agents = await Promise.all(
    //   ids.map(id => this.redis.hgetall(this.agentKeyPrefix + id)),
    // );
    // Filter by status if provided
    return [];
  }

  /**
   * Deregister an agent
   */
  async deregister(agentId: string): Promise<boolean> {
    // TODO: Check agent has no active tasks
    // TODO: Remove from Redis set and hash
    // TODO: Trigger scaling evaluation
    return false;
  }

  /**
   * Check and update stale/dead agents based on heartbeat thresholds
   *
   * TODO: Implementation needs:
   * - Scan all agents
   * - Compare lastHeartbeat to thresholds
   * - Transition stale -> dead if past dead threshold
   * - Transition idle/busy -> stale if past stale threshold
   * - Free resources for dead agents
   */
  async checkStaleAgents(): Promise<void> {
    const now = Date.now();
    const staleMs = this.config.heartbeat.staleThreshold * 1000;
    const deadMs = this.config.heartbeat.deadThreshold * 1000;

    // TODO: Iterate all agents and update status
    // for (const agent of await this.list()) {
    //   const lastBeat = new Date(agent.lastHeartbeat).getTime();
    //   const elapsed = now - lastBeat;
    //
    //   if (elapsed > deadMs && agent.status !== AgentStatus.DEAD) {
    //     await this.updateStatus(agent.id, AgentStatus.DEAD);
    //     this.log.warn({ agentId: agent.id }, 'Agent marked as dead');
    //   } else if (elapsed > staleMs && agent.status === AgentStatus.IDLE) {
    //     await this.updateStatus(agent.id, AgentStatus.STALE);
    //     this.log.warn({ agentId: agent.id }, 'Agent marked as stale');
    //   }
    // }
  }

  /**
   * Get count of agents by status
   */
  async counts(): Promise<Record<AgentStatus, number>> {
    const agents = await this.list();
    const counts = {} as Record<AgentStatus, number>;
    for (const status of Object.values(AgentStatus)) {
      counts[status] = agents.filter((a) => a.status === status).length;
    }
    return counts;
  }
}
