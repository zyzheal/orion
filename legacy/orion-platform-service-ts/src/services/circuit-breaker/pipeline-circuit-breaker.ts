/**
 * Pipeline Circuit Breaker Integration
 *
 * F004: Integrates circuit breaker protection into Pipeline external calls.
 * Provides a single utility to wrap SCM, Docker Registry, and notification calls
 * with appropriate circuit breaker target keys.
 *
 * Usage:
 *   const result = await pipelineCircuitBreaker.execute('scm', 'github', () => fetchSCM());
 *   const result = await pipelineCircuitBreaker.execute('registry', 'docker', () => dockerBuild());
 *   const result = await pipelineCircuitBreaker.execute('notification', 'slack', () => notify());
 */

import { getCircuitBreakerService } from './index';
import type { CircuitBreakerConfig } from '../../utils/rate-limit-circuit-breaker';

// ─── Target Key Constants ────────────────────────────────────────────────────

/**
 * Pre-defined target keys for pipeline external dependencies.
 */
export const PIPELINE_CB_TARGETS = {
  // SCM providers
  scmGitHub: 'scm:github',
  scmGitLab: 'scm:gitlab',
  scmBitbucket: 'scm:bitbucket',

  // Docker Registry
  dockerRegistry: 'registry:docker',
  harborRegistry: 'registry:harbor',

  // Notification services
  notificationSlack: 'notification:slack',
  notificationDingTalk: 'notification:dingtalk',
  notificationWeCom: 'notification:wecom',

  // K8s API
  k8sAPI: 'k8s:api',

  // Artifact storage
  artifactStorage: 'artifact:storage',
} as const;

/**
 * Default circuit breaker configs for pipeline targets.
 */
export const PIPELINE_CB_DEFAULTS: Record<string, CircuitBreakerConfig> = {
  // SCM: tolerate 5 failures, recover after 30s
  [PIPELINE_CB_TARGETS.scmGitHub]: {
    failureThreshold: 5,
    recoveryTimeoutMs: 30000,
    successThreshold: 2,
  },
  [PIPELINE_CB_TARGETS.scmGitLab]: {
    failureThreshold: 5,
    recoveryTimeoutMs: 30000,
    successThreshold: 2,
  },

  // Docker Registry: tolerate 3 failures, recover after 60s (builds are expensive)
  [PIPELINE_CB_TARGETS.dockerRegistry]: {
    failureThreshold: 3,
    recoveryTimeoutMs: 60000,
    successThreshold: 1,
  },

  // Notifications: tolerate 5 failures, recover after 30s
  [PIPELINE_CB_TARGETS.notificationSlack]: {
    failureThreshold: 5,
    recoveryTimeoutMs: 30000,
    successThreshold: 1,
  },

  // K8s API: tolerate 3 failures, recover after 60s
  [PIPELINE_CB_TARGETS.k8sAPI]: {
    failureThreshold: 3,
    recoveryTimeoutMs: 60000,
    successThreshold: 2,
  },
};

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Result from a circuit breaker protected execution.
 */
export interface CircuitBreakerExecutionResult<T> {
  value: T;
  circuitState: string;
  targetKey: string;
}

/**
 * Pipeline Circuit Breaker wrapper.
 * Provides convenient methods to call external services through circuit breakers.
 */
export class PipelineCircuitBreaker {
  /**
   * Execute a function through the appropriate circuit breaker.
   *
   * @param category - Category: 'scm', 'registry', 'notification', 'k8s', 'artifact'
   * @param provider - Provider name: 'github', 'docker', 'slack', etc.
   * @param fn - Async function to execute
   * @returns The result of the function
   * @throws Error if circuit is open or the function itself fails
   */
  async execute<T>(
    category: string,
    provider: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const targetKey = `${category}:${provider}`;

    // Ensure circuit breaker is registered (creates with default config if needed)
    const cbService = getCircuitBreakerService();
    if (!cbService) {
      // Fallback: execute without circuit breaker
      return fn();
    }

    const defaults = PIPELINE_CB_DEFAULTS[targetKey];
    if (defaults) {
      await cbService.getOrCreate(targetKey, defaults);
    }

    return cbService.execute(targetKey, fn);
  }

  /**
   * Get the current state of a pipeline circuit breaker.
   */
  async getState(category: string, provider: string): Promise<string | null> {
    const targetKey = `${category}:${provider}`;
    const cbService = getCircuitBreakerService();
    if (!cbService) return null;

    const state = await cbService.getState(targetKey);
    return state?.state ?? null;
  }

  /**
   * Get all pipeline circuit breaker states.
   */
  async getAllStates(): Promise<{ targetKey: string; state: string; stats: any }[]> {
    const cbService = getCircuitBreakerService();
    if (!cbService) return [];

    const all = await cbService.listAll();
    // Filter to only pipeline-related targets
    return all
      .filter((cb) =>
        cb.targetKey.startsWith('scm:') ||
        cb.targetKey.startsWith('registry:') ||
        cb.targetKey.startsWith('notification:') ||
        cb.targetKey.startsWith('k8s:') ||
        cb.targetKey.startsWith('artifact:'),
      )
      .map((cb) => ({
        targetKey: cb.targetKey,
        state: cb.state,
        stats: cb.stats,
      }));
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const pipelineCircuitBreaker = new PipelineCircuitBreaker();
