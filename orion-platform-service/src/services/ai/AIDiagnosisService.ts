// orion-platform-service/src/services/ai/AIDiagnosisService.ts
// AI Diagnosis Service - error root cause analysis

import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface DiagnosisResult {
  rootCause: string;
  suggestedFix: string;
  confidence: number;  // 0-100
  similarIncidents: Array<{ error: string; resolution: string }>;
}

export interface DiagnosisContext {
  taskId: string;
  pluginId: string;
  errorMessage: string;
  errorStack: string;
  isolationTier?: string;
  durationMs: number;
}

/**
 * AI Diagnosis Service - analyzes plugin execution errors
 * Phase 4: stub - will be wired to platform AI service in production
 */
export class AIDiagnosisService {
  private diagnosisTimeoutMs = 30000; // 30s timeout for AI service calls

  async diagnose(context: DiagnosisContext): Promise<DiagnosisResult> {
    logger.info(
      { taskId: context.taskId, pluginId: context.pluginId },
      'Starting AI diagnosis'
    );

    // SRE: Timeout wrapper for future external AI service calls
    // When AI integration is added, wrap the call with this timeout
    const result = await this.withTimeout(
      this.runDiagnosis(context),
      this.diagnosisTimeoutMs,
      `AI diagnosis timed out after ${this.diagnosisTimeoutMs}ms`
    );

    return result;
  }

  private async runDiagnosis(context: DiagnosisContext): Promise<DiagnosisResult> {
    // Future implementation:
    // 1. Collect last 50 log lines
    // 2. Get OpenTelemetry span data
    // 3. Find similar historical incidents
    // 4. Build prompt and call AI service
    // 5. Parse and return results

    // Phase 4: return simulated result
    return {
      rootCause: `Plugin ${context.pluginId} failed: ${context.errorMessage}`,
      suggestedFix: 'Check plugin configuration and network connectivity',
      confidence: 65,
      similarIncidents: [
        {
          error: 'Connection refused',
          resolution: 'Verified network policy allows outbound traffic',
        },
      ],
    };
  }

  /**
   * Generic timeout wrapper for external service calls.
   * Prevents indefinite hangs when downstream services are unresponsive.
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(message));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  async findSimilarIncidents(
    error: Error,
    limit: number = 5
  ): Promise<Array<{ error: string; resolution: string }>> {
    // Future: query plugin_audit_logs table for similar errors
    return [];
  }
}
