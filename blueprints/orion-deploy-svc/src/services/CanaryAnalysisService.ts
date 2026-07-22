import type { CanaryAnalysisResult, CanaryMetric } from "../types/deploy";

/**
 * Configuration for canary analysis
 */
export interface CanaryAnalysisConfig {
  /** Duration of analysis in minutes */
  durationMinutes: number;
  /** Metrics to evaluate */
  metrics: string[];
  /** Minimum passing threshold (0-1) */
  passThreshold: number;
  /** Interval between metric checks in seconds */
  checkIntervalSeconds: number;
}

/**
 * Analysis state tracking
 */
interface AnalysisState {
  deploymentId: string;
  status: 'pending' | 'running' | 'completed' | 'cancelled' | 'failed';
  config: CanaryAnalysisConfig;
  startTime: Date;
  endTime?: Date;
  results: CanaryAnalysisResult[];
  metrics: Map<string, { baseline: number; canary: number[] }>;
}

// In-memory store
const analysisStates = new Map<string, AnalysisState>();
const analysisResults = new Map<string, CanaryAnalysisResult>();

/**
 * Service responsible for canary deployment analysis.
 *
 * Dependencies:
 * - orion-monitor-svc: Retrieve real-time metrics for canary vs baseline
 */
export class CanaryAnalysisService {
  // Default configuration
  private defaultConfig: CanaryAnalysisConfig = {
    durationMinutes: 10,
    metrics: ['request_rate', 'error_rate', 'latency_p50', 'latency_p95', 'latency_p99'],
    passThreshold: 0.95,
    checkIntervalSeconds: 30,
  };

  constructor() {
    // Start periodic analysis job
    this.startPeriodicAnalysis();
  }

  /**
   * Start a canary analysis for a deployment
   * Returns immediately; analysis runs asynchronously
   */
  async startAnalysis(
    deploymentId: string,
    config?: Partial<CanaryAnalysisConfig>,
  ): Promise<void> {
    const mergedConfig = { ...this.defaultConfig, ...config };

    // Create analysis state
    const state: AnalysisState = {
      deploymentId,
      status: 'running',
      config: mergedConfig,
      startTime: new Date(),
      results: [],
      metrics: new Map(),
    };

    analysisStates.set(deploymentId, state);

    // Initialize metrics tracking
    for (const metricName of mergedConfig.metrics) {
      state.metrics.set(metricName, { baseline: 0, canary: [] });
    }

    console.log(`[CanaryAnalysis] Started analysis for deployment ${deploymentId} with config:`, mergedConfig);

    // Emit analysis_started event (in production: emit to event bus)
    // In production: await eventBus.emit('analysis_started', { deploymentId, config: mergedConfig });
  }

  /**
   * Get the current analysis result for a deployment
   */
  async getAnalysisResult(
    deploymentId: string,
  ): Promise<CanaryAnalysisResult | null> {
    // Get latest result
    const results = analysisResults.get(deploymentId);
    if (!results) {
      // Check if there's a pending analysis
      const state = analysisStates.get(deploymentId);
      if (state && state.status === 'running') {
        // Return in-progress status
        return {
          deploymentId,
          status: 'inconclusive',
          metrics: [],
          analyzedAt: new Date().toISOString(),
        };
      }
      return null;
    }
    return results;
  }

  /**
   * Evaluate collected metrics and determine pass/fail
   * Called internally by the analysis job
   */
  async evaluateMetrics(
    deploymentId: string,
  ): Promise<CanaryAnalysisResult> {
    const state = analysisStates.get(deploymentId);
    if (!state) {
      throw new Error(`No analysis state found for deployment: ${deploymentId}`);
    }

    const { config } = state;
    const metrics: CanaryMetric[] = [];

    // Fetch metrics from orion-monitor-svc (mock implementation)
    for (const metricName of config.metrics) {
      const metricData = await this.fetchMetricData(deploymentId, metricName);
      const baseline = metricData.baseline;
      const canary = metricData.canary;

      // Calculate threshold (default 10% deviation for error rate, 20% for latency)
      let threshold = 0.1;
      if (metricName.includes('latency')) {
        threshold = 0.2;
      }

      // Determine if metric passed
      const deviation = baseline > 0 ? Math.abs(canary - baseline) / baseline : 0;
      const passed = deviation <= threshold;

      metrics.push({
        name: metricName,
        baseline,
        canary,
        threshold,
        passed,
      });
    }

    // Calculate overall status
    const passedCount = metrics.filter(m => m.passed).length;
    const passRate = metrics.length > 0 ? passedCount / metrics.length : 0;
    const overallStatus: 'passing' | 'failing' | 'inconclusive' =
      passRate >= config.passThreshold ? 'passing' :
      passRate < 0.5 ? 'failing' : 'inconclusive';

    const result: CanaryAnalysisResult = {
      deploymentId,
      status: overallStatus,
      metrics,
      analyzedAt: new Date().toISOString(),
    };

    // Persist result
    analysisResults.set(deploymentId, result);
    state.results.push(result);

    // Update state status
    state.status = overallStatus === 'passing' ? 'completed' : 'running';

    // Check if analysis duration exceeded
    const elapsed = Date.now() - state.startTime.getTime();
    const maxDuration = config.durationMinutes * 60 * 1000;
    if (elapsed >= maxDuration && overallStatus !== 'passing') {
      state.status = 'completed';
      state.endTime = new Date();
    }

    console.log(`[CanaryAnalysis] Evaluation complete for ${deploymentId}:`, result.status);

    // Emit analysis_completed event
    // In production: await eventBus.emit('analysis_completed', { deploymentId, result });

    // If failing, trigger automatic rollback via DeployService
    if (overallStatus === 'failing') {
      console.log(`[CanaryAnalysis] Deployment ${deploymentId} failing, triggering rollback...`);
      // In production: await deployService.triggerRollback(deploymentId);
    }

    return result;
  }

  /**
   * Cancel an ongoing canary analysis
   */
  async cancelAnalysis(deploymentId: string): Promise<void> {
    const state = analysisStates.get(deploymentId);
    if (!state) {
      console.log(`[CanaryAnalysis] No analysis found for deployment: ${deploymentId}`);
      return;
    }

    // Stop analysis job
    state.status = 'cancelled';
    state.endTime = new Date();

    // Clean up monitoring subscriptions
    console.log(`[CanaryAnalysis] Cancelled analysis for deployment: ${deploymentId}`);

    // Emit analysis_cancelled event
    // In production: await eventBus.emit('analysis_cancelled', { deploymentId });
  }

  /**
   * Get analysis history for a deployment
   */
  async getAnalysisHistory(deploymentId: string): Promise<CanaryAnalysisResult[]> {
    const state = analysisStates.get(deploymentId);
    return state?.results ?? [];
  }

  /**
   * Get all active analyses
   */
  async getActiveAnalyses(): Promise<string[]> {
    const active: string[] = [];
    for (const [deploymentId, state] of analysisStates.entries()) {
      if (state.status === 'running') {
        active.push(deploymentId);
      }
    }
    return active;
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  /**
   * Fetch metric data from monitor service (mock implementation)
   * In production: call orion-monitor-svc API
   */
  private async fetchMetricData(
    deploymentId: string,
    metricName: string
  ): Promise<{ baseline: number; canary: number }> {
    // Mock data - in production, fetch from orion-monitor-svc
    // Simulate some variation
    const randomVariation = () => 0.9 + Math.random() * 0.2;

    const baseValues: Record<string, number> = {
      request_rate: 1000,
      error_rate: 0.02,
      latency_p50: 50,
      latency_p95: 150,
      latency_p99: 300,
    };

    const baseline = baseValues[metricName] ?? 100;
    const canary = baseline * randomVariation();

    // In production:
    // const response = await fetch(`http://localhost:300X/api/v1/metrics/${metricName}?deploymentId=${deploymentId}`);
    // return await response.json();

    return { baseline, canary };
  }

  /**
   * Start periodic analysis job
   */
  private startPeriodicAnalysis(): void {
    // Run analysis every checkIntervalSeconds for active deployments
    setInterval(async () => {
      for (const [deploymentId, state] of analysisStates.entries()) {
        if (state.status === 'running') {
          try {
            // Check if analysis duration exceeded
            const elapsed = Date.now() - state.startTime.getTime();
            const maxDuration = state.config.durationMinutes * 60 * 1000;

            if (elapsed >= maxDuration) {
              // Final evaluation
              await this.evaluateMetrics(deploymentId);
              state.status = 'completed';
              state.endTime = new Date();
            } else {
              // Intermediate evaluation
              await this.evaluateMetrics(deploymentId);
            }
          } catch (error) {
            console.error(`[CanaryAnalysis] Error during periodic analysis for ${deploymentId}:`, error);
            state.status = 'failed';
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }
}

// Export singleton
export const canaryAnalysisService = new CanaryAnalysisService();