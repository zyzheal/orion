import { DatabasePool } from '../database';
/**
 * Traffic Splitter - Phase 3
 *
 * Handles the mechanics of traffic splitting for canary deployments:
 * - Executing traffic split changes
 * - Retrieving current traffic configuration
 * - Validating traffic health before split changes
 */

export interface TrafficSplitConfig {
  canaryId: string;
  serviceName: string;
  canaryVersion: string;
  baselineVersion: string;
  canaryPercent: number;
  baselinePercent: number;
  lastUpdated: Date;
}

export interface TrafficHealthStatus {
  canaryId: string;
  healthy: boolean;
  canaryErrorRate: number;
  baselineErrorRate: number;
  canaryLatency: number;
  baselineLatency: number;
  checks: TrafficHealthCheck[];
}

export interface TrafficHealthCheck {
  name: string;
  passed: boolean;
  message: string;
}

/**
 * Error rate threshold (canary error rate should not exceed baseline by more than this)
 */
const MAX_ERROR_RATE_DIFF = 0.05;

/**
 * Latency increase threshold (canary latency should not exceed baseline by more than this %)
 */
const MAX_LATENCY_INCREASE = 0.20;

export class TrafficSplitter {

  constructor(private pool: DatabasePool) {}

  /**
   * Execute a traffic split change
   */
  async splitTraffic(canaryId: string, newPercent: number): Promise<TrafficSplitConfig> {
    if (newPercent < 0 || newPercent > 100) {
      throw new Error('Traffic percent must be between 0 and 100');
    }

    // Get canary deployment details
    const canaryResult = await this.pool.query(
      'SELECT * FROM canary_deployments WHERE id = $1',
      [canaryId]
    );
    if (!canaryResult.rows[0]) {
      throw new Error('Canary deployment not found');
    }
    const canary = canaryResult.rows[0];

    // Validate state allows traffic changes
    if (canary.status !== 'running' && canary.status !== 'paused') {
      throw new Error(`Cannot modify traffic for canary in '${canary.status}' state`);
    }

    // Enforce max_percent constraint
    if (newPercent > canary.max_percent) {
      throw new Error(`Traffic percent cannot exceed max_percent (${canary.max_percent})`);
    }

    // Update traffic split
    const updateResult = await this.pool.query(
      `UPDATE canary_deployments
       SET current_percent = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [canaryId, newPercent]
    );

    // Log the traffic change
    await this.pool.query(
      `INSERT INTO canary_traffic_changes
        (canary_id, old_percent, new_percent, changed_at)
       VALUES ($1, $2, $3, NOW())`,
      [canaryId, canary.current_percent, newPercent]
    );

    const updated = updateResult.rows[0];

    return {
      canaryId: updated.id,
      serviceName: updated.service_name,
      canaryVersion: updated.canary_version,
      baselineVersion: updated.baseline_version,
      canaryPercent: parseInt(updated.current_percent, 10),
      baselinePercent: 100 - parseInt(updated.current_percent, 10),
      lastUpdated: updated.updated_at,
    };
  }

  /**
   * Get current traffic configuration for a canary deployment
   */
  async getCurrentTraffic(canaryId: string): Promise<TrafficSplitConfig> {
    const result = await this.pool.query(
      'SELECT * FROM canary_deployments WHERE id = $1',
      [canaryId]
    );
    if (!result.rows[0]) {
      throw new Error('Canary deployment not found');
    }

    const canary = result.rows[0];

    return {
      canaryId: canary.id,
      serviceName: canary.service_name,
      canaryVersion: canary.canary_version,
      baselineVersion: canary.baseline_version,
      canaryPercent: parseInt(canary.current_percent, 10),
      baselinePercent: 100 - parseInt(canary.current_percent, 10),
      lastUpdated: canary.updated_at,
    };
  }

  /**
   * Validate traffic health before allowing a split change
   */
  async validateTrafficHealth(canaryId: string): Promise<TrafficHealthStatus> {
    const checks: TrafficHealthCheck[] = [];
    let healthy = true;

    // Get canary deployment
    const canaryResult = await this.pool.query(
      'SELECT * FROM canary_deployments WHERE id = $1',
      [canaryId]
    );
    if (!canaryResult.rows[0]) {
      throw new Error('Canary deployment not found');
    }
    const canary = canaryResult.rows[0];

    // Simulated metrics (in production, these would come from Prometheus/metrics service)
    // These would typically call into the CanaryAnalysisService
    const canaryErrorRate = this.simulateCanaryErrorRate(canaryId);
    const baselineErrorRate = this.simulateBaselineErrorRate(canaryId);
    const canaryLatency = this.simulateCanaryLatency(canaryId);
    const baselineLatency = this.simulateBaselineLatency(canaryId);

    // Check 1: Error rate comparison
    const errorRateDiff = canaryErrorRate - baselineErrorRate;
    if (errorRateDiff > MAX_ERROR_RATE_DIFF) {
      checks.push({
        name: 'error_rate_check',
        passed: false,
        message: `Canary error rate (${(canaryErrorRate * 100).toFixed(2)}%) exceeds baseline by more than ${(MAX_ERROR_RATE_DIFF * 100).toFixed(1)}%`,
      });
      healthy = false;
    } else {
      checks.push({
        name: 'error_rate_check',
        passed: true,
        message: `Error rate within acceptable range`,
      });
    }

    // Check 2: Latency comparison
    const latencyIncrease = baselineLatency > 0
      ? (canaryLatency - baselineLatency) / baselineLatency
      : 0;
    if (latencyIncrease > MAX_LATENCY_INCREASE) {
      checks.push({
        name: 'latency_check',
        passed: false,
        message: `Canary latency (${canaryLatency.toFixed(0)}ms) exceeds baseline by more than ${(MAX_LATENCY_INCREASE * 100).toFixed(0)}%`,
      });
      healthy = false;
    } else {
      checks.push({
        name: 'latency_check',
        passed: true,
        message: `Latency within acceptable range`,
      });
    }

    // Check 3: Traffic volume check
    const currentPercent = parseInt(canary.current_percent, 10);
    if (currentPercent > 0 && currentPercent < 5) {
      checks.push({
        name: 'traffic_volume_check',
        passed: false,
        message: 'Insufficient traffic for meaningful analysis (less than 5%)',
      });
      // Not marking as unhealthy for this, just a warning
    } else {
      checks.push({
        name: 'traffic_volume_check',
        passed: true,
        message: 'Sufficient traffic volume for analysis',
      });
    }

    // Check 4: Canary state check
    if (canary.status !== 'running') {
      checks.push({
        name: 'canary_state_check',
        passed: false,
        message: `Canary is not in running state (current: ${canary.status})`,
      });
      healthy = false;
    } else {
      checks.push({
        name: 'canary_state_check',
        passed: true,
        message: 'Canary is in running state',
      });
    }

    return {
      canaryId,
      healthy,
      canaryErrorRate,
      baselineErrorRate,
      canaryLatency,
      baselineLatency,
      checks,
    };
  }

  // ==================== Simulated Metrics (replace with real Prometheus calls) ====================

  private simulateCanaryErrorRate(canaryId: string): number {
    // In production, query Prometheus for canary error rate
    // For now, return a reasonable simulated value
    const hash = this.hashCode(canaryId);
    return 0.01 + (Math.abs(hash) % 100) / 10000; // 0.01 to 0.02
  }

  private simulateBaselineErrorRate(canaryId: string): number {
    // In production, query Prometheus for baseline error rate
    const hash = this.hashCode(canaryId);
    return 0.005 + (Math.abs(hash) % 50) / 10000; // 0.005 to 0.01
  }

  private simulateCanaryLatency(canaryId: string): number {
    // In production, query Prometheus for canary latency (p99)
    const hash = this.hashCode(canaryId);
    return 100 + (Math.abs(hash) % 50); // 100-150ms
  }

  private simulateBaselineLatency(canaryId: string): number {
    // In production, query Prometheus for baseline latency (p99)
    const hash = this.hashCode(canaryId);
    return 95 + (Math.abs(hash) % 45); // 95-140ms
  }

  /**
   * Simple hash function for deterministic simulation
   */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash;
  }
}
