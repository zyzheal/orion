// orion-platform-service/src/services/ai/AIDiagnosisService.ts
// AI Diagnosis Service - error root cause analysis with rule-based fallback

import pino from 'pino';
import { OrionError } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface DiagnosisResult {
  rootCause: string;
  suggestedFix: string;
  confidence: number;  // 0-100
  similarIncidents: Array<{ error: string; resolution: string; confidence?: number }>;
}

export interface DiagnosisContext {
  taskId: string;
  pluginId: string;
  errorMessage: string;
  errorStack: string;
  isolationTier?: string;
  durationMs: number;
  recentLogs?: string[];
}

/**
 * Rule-based diagnosis patterns for fallback when AI service is unavailable.
 * Each pattern maps error signatures to root cause analysis and fix suggestions.
 */
interface DiagnosisRule {
  pattern: RegExp;
  rootCause: string;
  suggestedFix: string;
  confidence: number;
}

const DIAGNOSIS_RULES: DiagnosisRule[] = [
  // Network issues
  {
    pattern: /connection\s*refused|ECONNREFUSED/i,
    rootCause: 'Network connection refused - the target service is unreachable',
    suggestedFix: 'Verify the service is running and network policy allows outbound traffic to the target host/port',
    confidence: 85,
  },
  {
    pattern: /connection\s*(timed?\s*out|timeout)|ETIMEDOUT/i,
    rootCause: 'Network connection timeout - the target service is not responding',
    suggestedFix: 'Check if the target service is overloaded, verify firewall rules and DNS resolution',
    confidence: 80,
  },
  {
    pattern: /ENOTFOUND|getaddrinfo|dns\s+resolution|domain\s*not?\s*found/i,
    rootCause: 'DNS resolution failure - hostname cannot be resolved',
    suggestedFix: 'Verify the hostname is correct and DNS is properly configured in the environment',
    confidence: 90,
  },
  // Resource issues
  {
    pattern: /out\s*of\s*memory|OOM|ENOMEM|heap\s*limit|memory\s*(exceeded|limit)/i,
    rootCause: 'Out of memory - the process exceeded its memory allocation',
    suggestedFix: 'Increase the memory limit in plugin configuration or optimize the plugin to use less memory',
    confidence: 85,
  },
  {
    pattern: /too\s*many\s*open\s*files|EMFILE|ENFILE/i,
    rootCause: 'File descriptor limit reached - too many open files or connections',
    suggestedFix: 'Increase the ulimit for open files or fix resource leaks in the plugin code',
    confidence: 80,
  },
  // Docker/Container issues (before generic "not found" rule)
  {
    pattern: /image\s*pull\s*failed|no\s*such\s*image|manifest\s*unknown|docker\s*pull/i,
    rootCause: 'Container image not found - failed to pull or locate the Docker image',
    suggestedFix: 'Verify the image name and tag exist in the registry, check registry authentication',
    confidence: 85,
  },
  {
    pattern: /docker\s*(daemon|not?\s*running|cannot\s*connect)/i,
    rootCause: 'Docker daemon unavailable - the Docker engine is not running or accessible',
    suggestedFix: 'Ensure Docker daemon is running and the service has access to the Docker socket',
    confidence: 90,
  },
  // Permission issues
  {
    pattern: /permission\s*denied|EACCES|not\s*permitted/i,
    rootCause: 'Permission denied - insufficient access rights for the requested operation',
    suggestedFix: 'Check RBAC policies and file permissions, ensure the plugin has the required access rights',
    confidence: 85,
  },
  {
    pattern: /not\s*found|ENOENT|no\s*such\s*file|does\s*not\s*exist/i,
    rootCause: 'File or resource not found - the requested path does not exist',
    suggestedFix: 'Verify the file path is correct and the file exists in the workspace',
    confidence: 75,
  },
  // Auth issues
  {
    pattern: /authentication\s*failed|unauthorized|401|invalid\s*(token|credentials|api\s*key)/i,
    rootCause: 'Authentication failure - invalid or expired credentials',
    suggestedFix: 'Verify the API key/token is valid and has not expired, check credential rotation',
    confidence: 85,
  },
  {
    pattern: /forbidden|403|access\s*denied|insufficient\s*privileges/i,
    rootCause: 'Authorization failure - insufficient privileges for the requested operation',
    suggestedFix: 'Check RBAC policies and ensure the service account has the required permissions',
    confidence: 80,
  },
];

/**
 * AI Diagnosis Service - analyzes plugin execution errors.
 *
 * Architecture: HTTP call to orion-ai-service with rule-based fallback.
 * This ensures the endpoint always returns useful output even when AI is unavailable.
 */
export class AIDiagnosisService {
  private aiServiceUrl: string;
  private diagnosisTimeoutMs = 30000; // 30s timeout
  private auditLogRepo?: any; // PluginAuditLogRepository (optional)

  constructor(options?: {
    aiServiceUrl?: string;
    diagnosisTimeoutMs?: number;
    auditLogRepo?: any;
  }) {
    this.aiServiceUrl = options?.aiServiceUrl || process.env.ORION_AI_SERVICE_URL || 'http://localhost:8080';
    this.diagnosisTimeoutMs = options?.diagnosisTimeoutMs || this.diagnosisTimeoutMs;
    this.auditLogRepo = options?.auditLogRepo;
  }

  /**
   * Diagnose a plugin execution failure.
   * Tries AI service first, falls back to rule-based diagnosis.
   */
  async diagnose(context: DiagnosisContext): Promise<DiagnosisResult> {
    logger.info(
      { taskId: context.taskId, pluginId: context.pluginId },
      'Starting AI diagnosis'
    );

    // Try AI service first
    try {
      const aiResult = await this.withTimeout(
        this.callAIService(context),
        this.diagnosisTimeoutMs,
        'AI diagnosis timed out'
      );
      logger.info({ taskId: context.taskId, confidence: aiResult.confidence }, 'AI diagnosis completed');
      return aiResult;
    } catch (error: any) {
      logger.warn(
        { taskId: context.taskId, error: error.message },
        'AI service unavailable, falling back to rule-based diagnosis'
      );
    }

    // Fallback to rule-based diagnosis
    return this.runRuleBasedDiagnosis(context);
  }

  /**
   * Call orion-ai-service for diagnosis via HTTP.
   */
  private async callAIService(context: DiagnosisContext): Promise<DiagnosisResult> {
    const url = `${this.aiServiceUrl}/api/diagnose`;

    const payload = {
      error_message: context.errorMessage,
      error_stack: context.errorStack,
      plugin_id: context.pluginId,
      isolation_tier: context.isolationTier,
      duration_ms: context.durationMs,
      recent_logs: context.recentLogs || [],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.diagnosisTimeoutMs),
    });

    if (!response.ok) {
      throw new OrionError(`AI service returned ${response.status}: ${response.statusText}`, 'OPERATION_FAILED')
    }

    const data: Record<string, any> = (await response.json()) as Record<string, any>;

    // Find similar incidents to enrich the result
    const similarIncidents = await this.findSimilarIncidents(context.errorMessage, 5);

    return {
      rootCause: data.root_cause || data.rootCause || 'Unknown',
      suggestedFix: data.suggested_fix || data.suggestedFix || 'No fix suggested',
      confidence: data.confidence || 70,
      similarIncidents,
    };
  }

  /**
   * Rule-based diagnosis using pattern matching on error messages.
   */
  private async runRuleBasedDiagnosis(context: DiagnosisContext): Promise<DiagnosisResult> {
    const errorText = `${context.errorMessage} ${context.errorStack}`.trim();

    // Match against known patterns
    for (const rule of DIAGNOSIS_RULES) {
      if (rule.pattern.test(errorText)) {
        // Found a matching rule
        const similarIncidents = await this.findSimilarIncidents(context.errorMessage, 5);

        return {
          rootCause: rule.rootCause,
          suggestedFix: rule.suggestedFix,
          confidence: rule.confidence,
          similarIncidents,
        };
      }
    }

    // Generic fallback
    return {
      rootCause: `Plugin ${context.pluginId} failed: ${context.errorMessage?.substring(0, 200) || 'Unknown error'}`,
      suggestedFix: 'Check plugin configuration, logs, and environment. Review the error stack trace for details.',
      confidence: 50,
      similarIncidents: await this.findSimilarIncidents(context.errorMessage, 5),
    };
  }

  /**
   * Find similar historical incidents from the audit log.
   * Uses simple prefix/prefix-match against stored error messages.
   */
  async findSimilarIncidents(
    errorMessage: string,
    limit: number = 5
  ): Promise<Array<{ error: string; resolution: string; confidence?: number }>> {
    if (!this.auditLogRepo) {
      return [];
    }

    try {
      // Extract error prefix for matching (first 20 chars)
      const errorPrefix = errorMessage?.substring(0, 30) || '';
      if (!errorPrefix) return [];

      // Get recent logs from the same plugin to find patterns
      // Since the repo doesn't have findByErrorPattern, we search all and filter
      const allLogs = await this.auditLogRepo.findByPluginId('*'); // wildcard not supported, will need to adapt

      // For now, return empty as the repo interface doesn't support error pattern search
      // A proper implementation would add a findByErrorPattern method to the repository
      return [];
    } catch (error: any) {
      logger.warn({ error: error.message }, 'Failed to find similar incidents');
      return [];
    }
  }

  /**
   * Generic timeout wrapper for external service calls.
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
}
