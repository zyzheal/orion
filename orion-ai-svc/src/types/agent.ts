/**
 * Type definitions for the Orion Agent Service
 */

/**
 * Agent (Runner) status states
 */
export enum AgentStatus {
  REGISTERING = 'registering',
  IDLE = 'idle',
  BUSY = 'busy',
  DRAINING = 'draining',
  DEAD = 'dead',
  STALE = 'stale',
}

/**
 * Task execution states
 */
export enum TaskStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMED_OUT = 'timed_out',
}

/**
 * Represents a registered Runner agent
 */
export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  /** ISO 8601 timestamp */
  registeredAt: string;
  /** ISO 8601 timestamp of last heartbeat */
  lastHeartbeat: string;
  /** Current assigned task ID, if any */
  currentTaskId: string | null;
  /** Number of tasks completed */
  tasksCompleted: number;
  /** Number of tasks failed */
  tasksFailed: number;
  /** Agent metadata (host, OS, capabilities, etc.) */
  metadata: AgentMetadata;
}

/**
 * Agent metadata from registration
 */
export interface AgentMetadata {
  host: string;
  os: string;
  arch: string;
  /** Available capabilities (e.g., 'docker', 'node', 'python') */
  capabilities: string[];
  /** Agent version */
  version: string;
  /** Additional key-value pairs */
  labels?: Record<string, string>;
}

/**
 * Task definition for execution
 */
export interface Task {
  id: string;
  agentId: string | null;
  status: TaskStatus;
  command: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
  timeoutSeconds: number;
  /** ISO 8601 timestamp */
  createdAt: string;
  /** ISO 8601 timestamp */
  startedAt: string | null;
  /** ISO 8601 timestamp */
  completedAt: string | null;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  errorMessage: string | null;
}

/**
 * Request body for agent registration
 */
export interface RegisterAgentRequest {
  name: string;
  metadata: AgentMetadata;
}

/**
 * Request body for heartbeat
 */
export interface HeartbeatRequest {
  status?: AgentStatus;
  currentTaskId?: string | null;
  metrics?: AgentMetrics;
}

/**
 * Agent runtime metrics
 */
export interface AgentMetrics {
  cpuUsage?: number;
  memoryUsage?: number;
  activeTasks?: number;
}

/**
 * Request body for task dispatch
 */
export interface DispatchTaskRequest {
  command: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
  timeoutSeconds?: number;
}

/**
 * Sandbox execution configuration
 */
export interface SandboxConfig {
  image: string;
  command: string;
  workingDir: string;
  env: Record<string, string>;
  memoryLimit: string;
  cpuLimit: string;
  networkMode: string;
  readOnlyRootFs: boolean;
  dropCapabilities: boolean;
  timeoutSeconds: number;
}

/**
 * Result from sandbox execution
 */
export interface SandboxResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

/**
 * Scaling decision
 */
export interface ScalingDecision {
  action: 'scale_up' | 'scale_down' | 'no_op';
  count: number;
  reason: string;
  timestamp: string;
}

/**
 * Agent orchestration task (used by MultiAgentOrchestrator)
 */
export interface AgentTask {
  id: string;
  agentId: string;
  type: 'reasoning' | 'execution' | 'verification' | 'research';
  prompt: string;
  priority: number;
  timeout: number;
  dependencies: string[];
  status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Health check response
 */
export interface ServiceHealth {
  status: 'ok' | 'degraded' | 'unhealthy';
  uptime: number;
  agents: {
    total: number;
    idle: number;
    busy: number;
    dead: number;
  };
  redis: boolean;
}
