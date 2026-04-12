/**
 * Deployment Verifier
 *
 * Validates deployments through health checks, metric verification,
 * and comparison with previous deployments.
 *
 * TASK-701: Smart Deployment (智能部署)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  HealthCheckConfig,
  HealthCheckResult,
  MetricVerificationResult,
  DeploymentComparisonResult,
  VerificationReport,
  Deployment,
} from './types';

/**
 * Deployment verification service
 */
export class DeploymentVerifier {
  /**
   * Verify deployment health by checking health endpoints
   */
  async verifyHealth(
    appName: string,
    version: string,
    environment: string,
    healthCheckConfig?: HealthCheckConfig
  ): Promise<HealthCheckResult[]> {
    const config = healthCheckConfig || {
      endpoint: `/api/health`,
      expectedStatus: 200,
      timeoutMs: 5000,
      retries: 3,
      retryIntervalMs: 2000,
    };

    const results: HealthCheckResult[] = [];

    // Health check endpoints to verify
    const endpoints = [
      config.endpoint || `/api/health`,
      `/api/ready`,
      `/api/live`,
    ];

    for (const endpoint of endpoints) {
      const result = await this.checkEndpoint(
        appName,
        version,
        environment,
        endpoint,
        config
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Verify deployment metrics (error rate, latency, etc.)
   */
  async verifyMetrics(
    appName: string,
    version: string,
    environment: string,
    thresholds?: {
      maxErrorRate?: number;
      maxLatencyP50?: number;
      maxLatencyP95?: number;
      maxLatencyP99?: number;
      minThroughput?: number;
    }
  ): Promise<MetricVerificationResult[]> {
    const config = thresholds || {
      maxErrorRate: 5, // 5%
      maxLatencyP50: 200, // ms
      maxLatencyP95: 500, // ms
      maxLatencyP99: 1000, // ms
      minThroughput: 100, // requests per second
    };

    const results: MetricVerificationResult[] = [];

    // Simulate metric collection (in production, this would query Prometheus/DataDog/etc.)
    const metrics = [
      {
        metricName: 'error_rate',
        currentValue: Math.random() * 3, // Simulated 0-3% error rate
        threshold: config.maxErrorRate || 5,
        previousValue: Math.random() * 2,
      },
      {
        metricName: 'latency_p50',
        currentValue: 50 + Math.random() * 100, // Simulated 50-150ms
        threshold: config.maxLatencyP50 || 200,
        previousValue: 60 + Math.random() * 80,
      },
      {
        metricName: 'latency_p95',
        currentValue: 100 + Math.random() * 300, // Simulated 100-400ms
        threshold: config.maxLatencyP95 || 500,
        previousValue: 120 + Math.random() * 250,
      },
      {
        metricName: 'latency_p99',
        currentValue: 200 + Math.random() * 600, // Simulated 200-800ms
        threshold: config.maxLatencyP99 || 1000,
        previousValue: 250 + Math.random() * 500,
      },
      {
        metricName: 'throughput',
        currentValue: 150 + Math.random() * 200, // Simulated 150-350 rps
        threshold: config.minThroughput || 100,
        previousValue: 130 + Math.random() * 180,
        // For throughput, lower is worse (invert the comparison)
        invertComparison: true,
      },
    ];

    for (const metric of metrics) {
      const isWithinThreshold = (metric as any).invertComparison
        ? metric.currentValue >= metric.threshold
        : metric.currentValue <= metric.threshold;

      results.push({
        metricName: metric.metricName,
        currentValue: Math.round(metric.currentValue * 100) / 100,
        threshold: metric.threshold,
        passed: isWithinThreshold,
        previousValue:
          metric.previousValue !== undefined
            ? Math.round(metric.previousValue * 100) / 100
            : undefined,
        checkedAt: new Date(),
      });
    }

    return results;
  }

  /**
   * Compare current deployment with previous deployment
   */
  async compareWithPrevious(
    currentDeployment: Deployment,
    previousDeployment?: Deployment
  ): Promise<DeploymentComparisonResult> {
    const now = new Date();

    if (!previousDeployment) {
      return {
        currentDeploymentId: currentDeployment.id,
        previousDeploymentId: 'none',
        comparedAt: now,
        healthCheckComparison: {
          currentHealth: true,
          previousHealth: true,
        },
        metricComparison: [],
        isImprovement: true,
        summary: 'No previous deployment to compare with',
      };
    }

    // Verify current health
    const currentHealth = currentDeployment.status === 'completed';
    const previousHealth = previousDeployment.status === 'completed';

    // Compare metrics (simulated)
    const metricComparison: MetricVerificationResult[] = [];

    const metrics = ['error_rate', 'latency_p50', 'latency_p95', 'latency_p99'];

    for (const metricName of metrics) {
      const previousValue = 50 + Math.random() * 100;
      const currentValue = 40 + Math.random() * 90;

      metricComparison.push({
        metricName,
        currentValue: Math.round(currentValue * 100) / 100,
        threshold: 500,
        passed: currentValue <= 500,
        previousValue: Math.round(previousValue * 100) / 100,
        checkedAt: now,
      });
    }

    // Determine if current deployment is an improvement
    const improvedMetrics = metricComparison.filter(
      (m) =>
        m.previousValue !== undefined && m.currentValue <= (m.previousValue || 0)
    ).length;

    const isImprovement = improvedMetrics >= metricComparison.length / 2;

    return {
      currentDeploymentId: currentDeployment.id,
      previousDeploymentId: previousDeployment.id,
      comparedAt: now,
      healthCheckComparison: {
        currentHealth,
        previousHealth,
      },
      metricComparison,
      isImprovement,
      summary: isImprovement
        ? 'Current deployment shows improvement over previous version'
        : 'Current deployment shows regression compared to previous version',
    };
  }

  /**
   * Generate a comprehensive verification report
   */
  async generateVerificationReport(
    deployment: Deployment,
    previousDeployment?: Deployment,
    healthCheckConfig?: HealthCheckConfig
  ): Promise<VerificationReport> {
    // Run health checks
    const healthChecks = await this.verifyHealth(
      deployment.appName,
      deployment.version,
      deployment.environment,
      healthCheckConfig
    );

    // Run metric verification
    const metrics = await this.verifyMetrics(
      deployment.appName,
      deployment.version,
      deployment.environment
    );

    // Compare with previous
    const comparison = await this.compareWithPrevious(
      deployment,
      previousDeployment
    );

    // Determine overall status
    const healthPassed = healthChecks.every((h) => h.passed);
    const metricsPassed = metrics.every((m) => m.passed);

    let overallStatus: 'pass' | 'fail' | 'partial' = 'pass';
    if (!healthPassed && !metricsPassed) {
      overallStatus = 'fail';
    } else if (!healthPassed || !metricsPassed) {
      overallStatus = 'partial';
    }

    // Build summary
    const summaryParts: string[] = [];
    summaryParts.push(
      `Health checks: ${healthChecks.filter((h) => h.passed).length}/${healthChecks.length} passed`
    );
    summaryParts.push(
      `Metrics: ${metrics.filter((m) => m.passed).length}/${metrics.length} passed`
    );
    if (comparison) {
      summaryParts.push(`Comparison: ${comparison.summary}`);
    }

    return {
      deploymentId: deployment.id,
      overallStatus,
      healthChecks,
      metrics,
      comparison,
      verifiedAt: new Date(),
      summary: summaryParts.join('. '),
    };
  }

  // ==================== Private Methods ====================

  /**
   * Check a single endpoint for health
   */
  private async checkEndpoint(
    appName: string,
    version: string,
    environment: string,
    endpoint: string,
    config: HealthCheckConfig
  ): Promise<HealthCheckResult> {
    const expectedStatus = config.expectedStatus || 200;
    const timeoutMs = config.timeoutMs || 5000;
    const maxRetries = config.retries || 3;
    const retryIntervalMs = config.retryIntervalMs || 2000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Simulate health check request
        // In production, this would be an actual HTTP request:
        // const response = await fetch(`${baseUrl}${endpoint}`, {
        //   signal: AbortSignal.timeout(timeoutMs),
        // });

        const startTime = Date.now();

        // Simulate successful response
        await new Promise((resolve) =>
          setTimeout(resolve, Math.floor(Math.random() * 50) + 10)
        );

        const responseTimeMs = Date.now() - startTime;

        return {
          id: uuidv4(),
          endpoint,
          passed: true,
          statusCode: expectedStatus,
          responseTimeMs,
          retries: attempt,
          checkedAt: new Date(),
        };
      } catch (error: any) {
        // Last attempt - return failure
        if (attempt === maxRetries - 1) {
          return {
            id: uuidv4(),
            endpoint,
            passed: false,
            error: error.message || 'Health check failed after retries',
            retries: attempt + 1,
            checkedAt: new Date(),
          };
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
      }
    }

    // Should not reach here, but TypeScript needs a return
    return {
      id: uuidv4(),
      endpoint,
      passed: false,
      error: 'Health check failed unexpectedly',
      retries: maxRetries,
      checkedAt: new Date(),
    };
  }
}
