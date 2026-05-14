/**
 * TrafficSplitter - Canary traffic splitting logic
 *
 * Provides traffic split calculation, routing decisions, and health validation
 * for canary deployments.
 */

import pino from 'pino';
import { CanaryTrafficService, TrafficSplitConfig } from './CanaryTrafficService';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface TrafficSplitResult {
  canaryId: string;
  percent: number;
  baselineEndpoint: string;
  canaryEndpoint: string;
  rules: Record<string, any>;
}

export interface HealthCheckResult {
  healthy: boolean;
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message: string;
    details?: Record<string, any>;
  }[];
}

// In-memory store for traffic splits
const trafficSplits = new Map<string, TrafficSplitResult>();

// ==================== TrafficSplitter ====================

export class TrafficSplitter {
  private canaryService: CanaryTrafficService | null = null;

  constructor(canaryService?: CanaryTrafficService) {
    this.canaryService = canaryService || null;
  }

  /**
   * Set canary service reference
   */
  setCanaryService(service: CanaryTrafficService): void {
    this.canaryService = service;
  }

  /**
   * Split traffic between baseline and canary
   */
  async splitTraffic(canaryId: string, percent: number): Promise<TrafficSplitResult> {
    const config = await this.canaryService?.getTrafficConfig(canaryId);

    const result: TrafficSplitResult = {
      canaryId,
      percent,
      baselineEndpoint: config?.baseline_destination || `http://baseline.${canaryId}.svc.cluster.local`,
      canaryEndpoint: config?.canary_destination || `http://canary.${canaryId}.svc.cluster.local`,
      rules: {
        strategy: config?.strategy || 'weighted',
        headerRules: [],
        cookieRules: [],
        ipHash: false,
      },
    };

    trafficSplits.set(canaryId, result);
    logger.info({ canaryId, percent }, '[TrafficSplitter] Traffic split configured');

    return result;
  }

  /**
   * Get current traffic split
   */
  async getTrafficSplit(canaryId: string): Promise<TrafficSplitResult | null> {
    return trafficSplits.get(canaryId) || null;
  }

  /**
   * Determine target endpoint for a request
   */
  determineTarget(canaryId: string, request: {
    headers?: Record<string, string>;
    ip?: string;
  }): { target: string; isCanary: boolean } {
    const split = trafficSplits.get(canaryId);
    if (!split) {
      // Default to baseline if no split configured
      return { target: `http://baseline.${canaryId}.svc.cluster.local`, isCanary: false };
    }

    // Check for canary header overrides
    const canaryHeader = request.headers?.['x-canary'];
    if (canaryHeader === 'always') {
      return { target: split.canaryEndpoint, isCanary: true };
    }
    if (canaryHeader === 'never') {
      return { target: split.baselineEndpoint, isCanary: false };
    }

    // IP hash based routing for sticky sessions
    if (request.ip) {
      const hash = this.hashIP(request.ip);
      if (hash % 100 < split.percent) {
        return { target: split.canaryEndpoint, isCanary: true };
      }
      return { target: split.baselineEndpoint, isCanary: false };
    }

    // Random weighted routing
    const random = Math.random() * 100;
    if (random < split.percent) {
      return { target: split.canaryEndpoint, isCanary: true };
    }
    return { target: split.baselineEndpoint, isCanary: false };
  }

  /**
   * Validate traffic health before applying split or promoting
   */
  async validateTrafficHealth(canaryId: string): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = [];
    const config = await this.canaryService?.getTrafficConfig(canaryId);

    // Check 1: Config exists
    if (!config) {
      checks.push({
        name: 'config',
        status: 'fail',
        message: 'Canary configuration not found',
      });
    } else {
      checks.push({
        name: 'config',
        status: 'pass',
        message: 'Canary configuration valid',
      });
    }

    // Check 2: Traffic weights are valid
    if (config && (config.canary_weight ?? 0) > 0) {
      const total = (config.baseline_weight ?? 0) + (config.canary_weight ?? 0);
      if (total !== 100) {
        checks.push({
          name: 'weights',
          status: 'warn',
          message: `Traffic weights sum to ${total}%, expected 100%`,
          details: { baseline: config.baseline_weight, canary: config.canary_weight },
        });
      } else {
        checks.push({
          name: 'weights',
          status: 'pass',
          message: 'Traffic weights valid',
        });
      }
    }

    // Check 3: Endpoints configured
    if (config?.canary_destination) {
      checks.push({
        name: 'endpoints',
        status: 'pass',
        message: 'Canary endpoints configured',
      });
    } else {
      checks.push({
        name: 'endpoints',
        status: 'warn',
        message: 'Using default endpoint patterns',
      });
    }

    // Check 4: Phase is valid
    const validPhases = ['initial', ' Canary ', 'promoted', 'rolled_back'];
    if (config && validPhases.includes(config.phase || '')) {
      checks.push({
        name: 'phase',
        status: 'pass',
        message: `Phase: ${config.phase}`,
      });
    } else {
      checks.push({
        name: 'phase',
        status: 'warn',
        message: `Unknown phase: ${config?.phase}`,
      });
    }

    const healthy = checks.every(c => c.status !== 'fail');

    return { healthy, checks };
  }

  /**
   * Get all active traffic splits
   */
  async getActiveSplits(): Promise<TrafficSplitResult[]> {
    return Array.from(trafficSplits.values());
  }

  /**
   * Clear traffic split
   */
  async clearSplit(canaryId: string): Promise<boolean> {
    return trafficSplits.delete(canaryId);
  }

  // ==================== Utility Methods ====================

  /**
   * Simple hash function for IP-based sticky sessions
   */
  private hashIP(ip: string): number {
    let hash = 0;
    for (let i = 0; i < ip.length; i++) {
      const char = ip.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

export default TrafficSplitter;