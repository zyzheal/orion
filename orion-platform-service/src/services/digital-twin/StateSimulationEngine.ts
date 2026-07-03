/**
 * StateSimulationEngine - Realistic Digital Twin Service State Simulation
 *
 * Implements a Markov chain-based state machine for simulating
 * realistic service state transitions in digital twins:
 *
 * States: healthy → degraded → faulted → recovering → healthy/offline
 *
 * Features:
 * - Configurable transition probability matrix
 * - Fault injection (latency_spike, error_rate, resource_exhaustion, complete_outage)
 * - Automatic recovery simulation
 * - State change timeline/history tracking
 */

import { createLogger } from '../utils/logger';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ==================== Types ====================

export enum ServiceSimulationState {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  FAULTED = 'faulted',
  RECOVERING = 'recovering',
  OFFLINE = 'offline',
}

export enum FaultType {
  LATENCY_SPIKE = 'latency_spike',
  ERROR_RATE = 'error_rate',
  RESOURCE_EXHAUSTION = 'resource_exhaustion',
  COMPLETE_OUTAGE = 'complete_outage',
}

export interface ServiceSimulation {
  name: string;
  state: ServiceSimulationState;
  latency: number;
  errorRate: number;
  lastTransitionAt: string;
  faultInjection: {
    type: FaultType | null;
    injectedAt: string | null;
    durationMs: number | null;
  };
}

export interface StateHistoryEntry {
  timestamp: string;
  service: string;
  previousState: ServiceSimulationState;
  newState: ServiceSimulationState;
  reason: string;
  latency?: number;
  errorRate?: number;
}

export interface SimulationConfig {
  transitionProbabilities?: Partial<Record<ServiceSimulationState, Partial<Record<ServiceSimulationState, number>>>>;
  baseLatencyMs?: number;
  latencyVariance?: number;
  baseErrorRate?: number;
  defaultRecoveryMs?: number;
}

export interface TwinServiceState {
  status: ServiceSimulationState;
  latency: number;
  errorRate: number;
  stateHistory?: Array<{
    timestamp: string;
    state: ServiceSimulationState;
    reason: string;
    latency?: number;
    errorRate?: number;
  }>;
}

// ==================== Default Transition Matrix ====================

const DEFAULT_TRANSITION_MATRIX: Record<ServiceSimulationState, Record<ServiceSimulationState, number>> = {
  [ServiceSimulationState.HEALTHY]: {
    [ServiceSimulationState.HEALTHY]: 0.92,
    [ServiceSimulationState.DEGRADED]: 0.08,
  },
  [ServiceSimulationState.DEGRADED]: {
    [ServiceSimulationState.HEALTHY]: 0.25,
    [ServiceSimulationState.DEGRADED]: 0.55,
    [ServiceSimulationState.FAULTED]: 0.20,
  },
  [ServiceSimulationState.FAULTED]: {
    [ServiceSimulationState.FAULTED]: 0.30,
    [ServiceSimulationState.RECOVERING]: 0.60,
    [ServiceSimulationState.OFFLINE]: 0.10,
  },
  [ServiceSimulationState.RECOVERING]: {
    [ServiceSimulationState.RECOVERING]: 0.40,
    [ServiceSimulationState.DEGRADED]: 0.35,
    [ServiceSimulationState.HEALTHY]: 0.25,
  },
  [ServiceSimulationState.OFFLINE]: {
    [ServiceSimulationState.OFFLINE]: 0.40,
    [ServiceSimulationState.RECOVERING]: 0.60,
  },
};

// ==================== State Simulation Engine ====================

export class StateSimulationEngine {
  private services: Map<string, ServiceSimulation> = new Map();
  private history: StateHistoryEntry[] = [];
  private config: Required<SimulationConfig>;
  private historyMaxLength = 1000;

  constructor(config: SimulationConfig = {}) {
    this.config = {
      transitionProbabilities: (config.transitionProbabilities ?? DEFAULT_TRANSITION_MATRIX) as Record<ServiceSimulationState, Record<ServiceSimulationState, number>>,
      baseLatencyMs: config.baseLatencyMs ?? 20,
      latencyVariance: config.latencyVariance ?? 80,
      baseErrorRate: config.baseErrorRate ?? 0.01,
      defaultRecoveryMs: config.defaultRecoveryMs ?? 30000,
    };
  }

  // ==================== Service Registration ====================

  registerService(name: string, initialState: ServiceSimulationState = ServiceSimulationState.HEALTHY): void {
    const existing = this.services.get(name);
    if (existing) {
      logger.warn({ service: name }, '[StateSimulationEngine] Service already registered, resetting');
    }

    this.services.set(name, {
      name,
      state: initialState,
      latency: this.computeLatency(initialState),
      errorRate: this.computeErrorRate(initialState),
      lastTransitionAt: new Date().toISOString(),
      faultInjection: {
        type: null,
        injectedAt: null,
        durationMs: null,
      },
    });

    this.recordHistory(name, ServiceSimulationState.HEALTHY, initialState, 'initialized');
  }

  // ==================== State Transition ====================

  tick(serviceName: string): ServiceSimulation {
    let service = this.services.get(serviceName);
    if (!service) {
      this.registerService(serviceName);
      service = this.services.get(serviceName)!;
    }

    // Check if fault injection has expired
    if (service.faultInjection.type && service.faultInjection.injectedAt) {
      const elapsed = Date.now() - new Date(service.faultInjection.injectedAt).getTime();
      if (elapsed >= service.faultInjection.durationMs!) {
        this.clearFault(serviceName);
        service = this.services.get(serviceName)!;
      }
    }

    const previousState = service.state;
    const newState = this.computeNextState(service);

    if (newState !== previousState) {
      service.state = newState;
      service.lastTransitionAt = new Date().toISOString();
      service.latency = this.computeLatency(newState);
      service.errorRate = this.computeErrorRate(newState);

      const reason = this.getTransitionReason(service);
      this.recordHistory(serviceName, previousState, newState, reason);

      logger.debug(
        { service: serviceName, from: previousState, to: newState, reason },
        '[StateSimulationEngine] State transition'
      );
    }

    return { ...service };
  }

  tickAll(serviceNames: string[]): ServiceSimulation[] {
    return serviceNames.map((name) => this.tick(name));
  }

  // ==================== Fault Injection ====================

  injectFault(
    serviceName: string,
    faultType: FaultType,
    durationMs: number = 30000,
  ): ServiceSimulation {
    let service = this.services.get(serviceName);
    if (!service) {
      this.registerService(serviceName);
      service = this.services.get(serviceName)!;
    }

    const previousState = service.state;

    switch (faultType) {
      case FaultType.LATENCY_SPIKE:
        service.state = ServiceSimulationState.DEGRADED;
        service.latency = 500 + Math.random() * 1500;
        service.errorRate = Math.min(service.errorRate + 0.05, 0.2);
        break;
      case FaultType.ERROR_RATE:
        service.state = ServiceSimulationState.FAULTED;
        service.errorRate = 0.3 + Math.random() * 0.4;
        service.latency = 100 + Math.random() * 200;
        break;
      case FaultType.RESOURCE_EXHAUSTION:
        service.state = ServiceSimulationState.DEGRADED;
        service.latency = 200 + Math.random() * 300;
        service.errorRate = 0.1 + Math.random() * 0.15;
        break;
      case FaultType.COMPLETE_OUTAGE:
        service.state = ServiceSimulationState.OFFLINE;
        service.latency = 0;
        service.errorRate = 1.0;
        break;
      default:
        throw new Error(`Unknown fault type: ${faultType}`);
    }

    service.faultInjection = {
      type: faultType,
      injectedAt: new Date().toISOString(),
      durationMs,
    };
    service.lastTransitionAt = new Date().toISOString();

    this.recordHistory(serviceName, previousState, service.state, `fault_injected:${faultType}`);

    logger.info(
      { service: serviceName, faultType, durationMs },
      '[StateSimulationEngine] Fault injected'
    );

    return { ...service };
  }

  clearFault(serviceName: string): void {
    const service = this.services.get(serviceName);
    if (!service) return;

    service.faultInjection = {
      type: null,
      injectedAt: null,
      durationMs: null,
    };
  }

  // ==================== Recovery ====================

  recoverService(serviceName: string): ServiceSimulation {
    let service = this.services.get(serviceName);
    if (!service) {
      this.registerService(serviceName);
      service = this.services.get(serviceName)!;
    }

    const previousState = service.state;

    // Force transition to recovering
    service.state = ServiceSimulationState.RECOVERING;
    service.lastTransitionAt = new Date().toISOString();
    service.latency = this.computeLatency(ServiceSimulationState.RECOVERING);
    service.errorRate = this.computeErrorRate(ServiceSimulationState.RECOVERING);

    // Clear any active fault injection
    service.faultInjection = {
      type: null,
      injectedAt: null,
      durationMs: null,
    };

    this.recordHistory(serviceName, previousState, ServiceSimulationState.RECOVERING, 'manual_recovery');

    logger.info({ service: serviceName }, '[StateSimulationEngine] Recovery initiated');

    return { ...service };
  }

  // ==================== Queries ====================

  getServiceState(serviceName: string): ServiceSimulation | null {
    const service = this.services.get(serviceName);
    if (!service) return null;
    return { ...service };
  }

  getAllStates(): Map<string, ServiceSimulation> {
    const result = new Map<string, ServiceSimulation>();
    for (const [name, service] of this.services) {
      result.set(name, { ...service });
    }
    return result;
  }

  getStateHistory(serviceName?: string): StateHistoryEntry[] {
    if (serviceName) {
      return this.history.filter((entry) => entry.service === serviceName);
    }
    return [...this.history];
  }

  getTimeline(twinId?: string): Array<{
    timestamp: string
    service: string
    state: ServiceSimulationState
    reason: string
  }> {
    const entries = twinId ? this.history.filter((e) => e.service === twinId) : this.history;
    return entries.map((entry) => ({
      timestamp: entry.timestamp,
      service: entry.service,
      state: entry.newState,
      reason: entry.reason,
    }));
  }

  resetService(serviceName: string): void {
    this.services.delete(serviceName);
    this.registerService(serviceName);
  }

  // ==================== Internal Methods ====================

  private computeNextState(service: ServiceSimulation): ServiceSimulationState {
    const transitionMatrix = this.config.transitionProbabilities;
    const currentStateTransitions = transitionMatrix[service.state];

    // If fault is injected, fault state takes precedence
    if (service.faultInjection.type) {
      switch (service.faultInjection.type) {
        case FaultType.COMPLETE_OUTAGE:
          return ServiceSimulationState.OFFLINE;
        case FaultType.LATENCY_SPIKE:
        case FaultType.RESOURCE_EXHAUSTION:
          return ServiceSimulationState.DEGRADED;
        case FaultType.ERROR_RATE:
          return ServiceSimulationState.FAULTED;
        default:
          break;
      }
    }

    // No transitions defined for this state, stay in current state
    if (!currentStateTransitions || Object.keys(currentStateTransitions).length === 0) {
      return service.state;
    }

    const rand = Math.random();
    let cumulative = 0;

    for (const [targetState, probability] of Object.entries(currentStateTransitions)) {
      cumulative += probability;
      if (rand <= cumulative) {
        return targetState as ServiceSimulationState;
      }
    }

    // Fallback to current state
    return service.state;
  }

  private computeLatency(state: ServiceSimulationState): number {
    const base = this.config.baseLatencyMs;
    const variance = this.config.latencyVariance;

    switch (state) {
      case ServiceSimulationState.HEALTHY:
        return Math.round(base + Math.random() * variance * 0.2);
      case ServiceSimulationState.DEGRADED:
        return Math.round(base + variance * 0.5 + Math.random() * variance * 0.5);
      case ServiceSimulationState.FAULTED:
        return Math.round(base + variance * 1.5 + Math.random() * variance);
      case ServiceSimulationState.RECOVERING:
        return Math.round(base + variance * 0.3 + Math.random() * variance * 0.4);
      case ServiceSimulationState.OFFLINE:
        return 0;
      default:
        return base;
    }
  }

  private computeErrorRate(state: ServiceSimulationState): number {
    const base = this.config.baseErrorRate;

    switch (state) {
      case ServiceSimulationState.HEALTHY:
        return Math.round((base + Math.random() * base) * 1000) / 1000;
      case ServiceSimulationState.DEGRADED:
        return Math.round((base * 5 + Math.random() * base * 10) * 1000) / 1000;
      case ServiceSimulationState.FAULTED:
        return Math.round((0.2 + Math.random() * 0.4) * 1000) / 1000;
      case ServiceSimulationState.RECOVERING:
        return Math.round((base * 2 + Math.random() * base * 5) * 1000) / 1000;
      case ServiceSimulationState.OFFLINE:
        return 1.0;
      default:
        return base;
    }
  }

  private getTransitionReason(service: ServiceSimulation): string {
    if (service.faultInjection.type) {
      return `fault_active:${service.faultInjection.type}`;
    }
    return 'probabilistic_transition';
  }

  private recordHistory(
    serviceName: string,
    previousState: ServiceSimulationState,
    newState: ServiceSimulationState,
    reason: string,
    latency?: number,
    errorRate?: number,
  ): void {
    const entry: StateHistoryEntry = {
      timestamp: new Date().toISOString(),
      service: serviceName,
      previousState,
      newState,
      reason,
      latency,
      errorRate,
    };

    this.history.push(entry);

    while (this.history.length > this.historyMaxLength) {
      this.history.shift();
    }
  }

  // ==================== Markov Chain Simulation ====================

  /**
   * Simulate state transitions using a Markov chain for a given twin.
   *
   * @param twinId - Twin identifier (used for logging/tracing)
   * @param currentState - Starting state
   * @param steps - Number of transitions to simulate
   * @param transitionMatrix - Optional custom transition matrix; falls back to engine default
   * @returns Array of state snapshots after each step
   */
  async simulateStateTransition(
    twinId: string,
    currentState: ServiceSimulationState,
    steps: number,
    transitionMatrix?: Record<ServiceSimulationState, Record<ServiceSimulationState, number>>,
  ): Promise<Array<{ step: number; state: ServiceSimulationState; latency: number; errorRate: number }>> {
    if (steps < 1) {
      throw new Error('Steps must be a positive integer');
    }

    const matrix = transitionMatrix ?? this.config.transitionProbabilities;
    const states: ServiceSimulationState[] = [currentState];
    let state = currentState;

    for (let i = 0; i < steps; i++) {
      const transitions = matrix[state];
      if (!transitions || Object.keys(transitions).length === 0) {
        logger.warn({ twinId, state, step: i + 1 }, '[StateSimulationEngine] No transitions defined, staying in current state');
        states.push(state);
        continue;
      }

      const rand = Math.random();
      let cumulative = 0;
      let nextState = state;

      for (const [target, probability] of Object.entries(transitions)) {
        cumulative += probability;
        if (rand <= cumulative) {
          nextState = target as ServiceSimulationState;
          break;
        }
      }

      state = nextState;
      states.push(state);

      logger.debug(
        { twinId, step: i + 1, from: states[i], to: state },
        '[StateSimulationEngine] Markov transition simulated'
      );
    }

    return states.slice(1).map((s, idx) => ({
      step: idx + 1,
      state: s,
      latency: this.computeLatency(s),
      errorRate: this.computeErrorRate(s),
    }));
  }

  /**
   * Predict the next N possible states from the current state using the transition matrix.
   *
   * @param twinId - Twin identifier
   * @param currentState - Starting state
   * @param count - Number of next states to return (one per step)
   * @returns Array of predicted states
   */
  async predictNextStates(
    twinId: string,
    currentState: ServiceSimulationState,
    count: number,
  ): Promise<Array<{ step: number; state: ServiceSimulationState; probability: number }>> {
    if (count < 1) {
      throw new Error('Count must be a positive integer');
    }

    const results: Array<{ step: number; state: ServiceSimulationState; probability: number }> = [];
    let state = currentState;

    for (let i = 0; i < count; i++) {
      const transitions = this.config.transitionProbabilities[state];
      if (!transitions || Object.keys(transitions).length === 0) {
        results.push({ step: i + 1, state, probability: 1.0 });
        continue;
      }

      const rand = Math.random();
      let cumulative = 0;
      let nextState = state;
      let probability = 0;

      for (const [target, prob] of Object.entries(transitions)) {
        cumulative += prob as number;
        if (rand <= cumulative) {
          nextState = target as ServiceSimulationState;
          probability = prob as number;
          break;
        }
      }

      results.push({ step: i + 1, state: nextState, probability });
      state = nextState;
    }

    logger.info({ twinId, currentState, predictions: results.map(r => r.state) }, '[StateSimulationEngine] Predicted next states');
    return results;
  }

  /**
   * Calculate the steady-state distribution of a Markov chain using the power method.
   *
   * @param transitionMatrix - Transition probability matrix
   * @returns Steady-state probability distribution over states
   */
  async calculateSteadyState(
    transitionMatrix: Record<ServiceSimulationState, Record<ServiceSimulationState, number>>,
  ): Promise<Record<ServiceSimulationState, number>> {
    const states = Object.keys(transitionMatrix) as ServiceSimulationState[];
    const n = states.length;

    if (n === 0) {
      throw new Error('Transition matrix is empty');
    }

    // Initialize uniform distribution
    let distribution: Record<ServiceSimulationState, number> = {};
    for (const s of states) {
      distribution[s] = 1 / n;
    }

    // Power iteration: multiply by transition matrix until convergence
    const maxIterations = 1000;
    const epsilon = 1e-8;

    for (let iter = 0; iter < maxIterations; iter++) {
      const newDistribution: Record<ServiceSimulationState, number> = {};

      for (const targetState of states) {
        let sum = 0;
        for (const sourceState of states) {
          const transitionProb = transitionMatrix[sourceState]?.[targetState] ?? 0;
          sum += distribution[sourceState] * transitionProb;
        }
        newDistribution[targetState] = sum;
      }

      // Check convergence
      let maxDiff = 0;
      for (const s of states) {
        maxDiff = Math.max(maxDiff, Math.abs(newDistribution[s] - distribution[s]));
      }

      distribution = newDistribution;

      if (maxDiff < epsilon) {
        logger.info({ iterations: iter + 1, distribution }, '[StateSimulationEngine] Steady state converged');
        return distribution;
      }
    }

    logger.warn({ iterations: maxIterations, distribution }, '[StateSimulationEngine] Steady state did not converge within max iterations');
    return distribution;
  }

  /**
   * Build a transition matrix from the state history of a twin.
   *
   * @param twinId - Twin identifier (used to filter history entries)
   * @param timeWindowMs - Optional time window in milliseconds to limit history
   * @returns Transition probability matrix
   */
  async buildTransitionMatrix(
    twinId: string,
    timeWindowMs?: number,
  ): Promise<Record<ServiceSimulationState, Record<ServiceSimulationState, number>>> {
    const cutoff = timeWindowMs ? Date.now() - timeWindowMs : 0;
    const entries = this.history.filter((entry) => {
      if (entry.service !== twinId) return false;
      if (timeWindowMs && new Date(entry.timestamp).getTime() < cutoff) return false;
      return true;
    });

    // Count transitions
    const counts: Record<ServiceSimulationState, Record<ServiceSimulationState, number>> = {};
    const totals: Record<ServiceSimulationState, number> = {};

    for (const entry of entries) {
      if (!counts[entry.previousState]) {
        counts[entry.previousState] = {};
      }
      if (!counts[entry.previousState][entry.newState]) {
        counts[entry.previousState][entry.newState] = 0;
      }
      counts[entry.previousState][entry.newState]++;
      totals[entry.previousState] = (totals[entry.previousState] ?? 0) + 1;
    }

    // Convert counts to probabilities
    const matrix: Record<ServiceSimulationState, Record<ServiceSimulationState, number>> = {};
    for (const source of Object.keys(counts) as ServiceSimulationState[]) {
      matrix[source] = {};
      const total = totals[source] ?? 1;
      for (const [target, count] of Object.entries(counts[source])) {
        matrix[source][target as ServiceSimulationState] = count / total;
      }
    }

    logger.info(
      { twinId, entries: entries.length, states: Object.keys(matrix).length },
      '[StateSimulationEngine] Built transition matrix from history'
    );

    return matrix;
  }

  /**
   * Run a complete simulation scenario for a twin.
   *
   * @param twinId - Twin identifier
   * @param scenario - Scenario configuration
   * @param durationMs - Simulation duration in milliseconds
   * @returns Simulation result with timeline and statistics
   */
  async runSimulation(
    twinId: string,
    scenario: { initialState?: ServiceSimulationState; steps?: number; transitionMatrix?: Record<ServiceSimulationState, Record<ServiceSimulationState, number>> },
    durationMs: number,
  ): Promise<{
    twinId: string;
    scenario: { initialState: ServiceSimulationState; steps: number };
    results: Array<{ step: number; state: ServiceSimulationState; latency: number; errorRate: number }>;
    steadyState?: Record<ServiceSimulationState, number>;
    statistics: { totalTransitions: number; stateDistribution: Record<ServiceSimulationState, number> };
    startedAt: string;
    completedAt: string;
  }> {
    const initialState = scenario.initialState ?? ServiceSimulationState.HEALTHY;
    const steps = scenario.steps ?? 10;
    const matrix = scenario.transitionMatrix ?? this.config.transitionProbabilities;

    const startedAt = new Date().toISOString();

    // Run simulation
    const results = await this.simulateStateTransition(twinId, initialState, steps, matrix);

    // Calculate steady state if matrix is stable
    let steadyState: Record<ServiceSimulationState, number> | undefined;
    try {
      steadyState = await this.calculateSteadyState(matrix);
    } catch (err) {
      logger.warn({ twinId, err: (err as Error).message }, '[StateSimulationEngine] Could not calculate steady state');
    }

    // Compute state distribution from simulation results
    const stateDistribution: Record<ServiceSimulationState, number> = {};
    for (const r of results) {
      stateDistribution[r.state] = (stateDistribution[r.state] ?? 0) + 1;
    }

    const completedAt = new Date().toISOString();

    logger.info(
      { twinId, steps: results.length, steadyState },
      '[StateSimulationEngine] Simulation completed'
    );

    return {
      twinId,
      scenario: { initialState, steps },
      results,
      steadyState,
      statistics: {
        totalTransitions: results.length,
        stateDistribution,
      },
      startedAt,
      completedAt,
    };
  }
}

export default StateSimulationEngine;
