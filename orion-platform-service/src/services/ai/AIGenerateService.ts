// orion-platform-service/src/services/ai/AIGenerateService.ts
// AI Script Generation Service - generate inline scripts from natural language prompts

import { createLogger } from '../../utils/logger';
import { OrionError } from '../../errors';
import { getCurrentTraceId } from '../../db/tenant-context-storage';
import { safeFetch } from '../../utils/safeFetch';

const logger = createLogger('AIGenerateService');

export interface GeneratedScript {
  code: string;
  language: string;
  warnings: string[];
  requiresApproval: boolean;
}

export interface GenerateRequest {
  prompt: string;
  language: string;
  level?: string;
}

/**
 * Script template for template-based generation fallback.
 */
interface ScriptTemplate {
  keywords: string[];
  language: 'bash' | 'javascript' | 'python';
  code: string;
  description: string;
}

/**
 * Library of script templates for common operations.
 */
const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  // System checks
  {
    keywords: ['disk', 'space', 'storage', 'df'],
    language: 'bash',
    code: 'df -h',
    description: 'Check disk space usage',
  },
  {
    keywords: ['memory', 'mem', 'free', 'ram'],
    language: 'bash',
    code: 'free -h',
    description: 'Check memory usage',
  },
  {
    keywords: ['cpu', 'processor', 'load', 'top'],
    language: 'bash',
    code: 'top -bn1 | head -20',
    description: 'Check CPU usage and load',
  },
  {
    keywords: ['process', 'ps', 'running', 'list process'],
    language: 'bash',
    code: 'ps aux | head -50',
    description: 'List running processes',
  },
  {
    keywords: ['port', 'listen', 'netstat', 'socket'],
    language: 'bash',
    code: 'netstat -tlnp',
    description: 'Check listening ports',
  },
  {
    keywords: ['network', 'ping', 'connectivity', 'connect'],
    language: 'bash',
    code: 'ping -c 3 8.8.8.8',
    description: 'Test network connectivity',
  },
  {
    keywords: ['dns', 'resolve', 'nslookup', 'dig'],
    language: 'bash',
    code: 'nslookup example.com',
    description: 'Check DNS resolution',
  },
  // Service checks
  {
    keywords: ['nginx', 'web server', 'http server', 'nginx running', 'check nginx'],
    language: 'bash',
    code: 'ps aux | grep nginx && curl -s -o /dev/null -w "%{http_code}" http://localhost',
    description: 'Check if nginx is running and responding',
  },
  {
    keywords: ['docker', 'container', 'containers', 'docker ps'],
    language: 'bash',
    code: 'docker ps -a --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"',
    description: 'List Docker containers',
  },
  {
    keywords: ['service', 'systemctl', 'status'],
    language: 'bash',
    code: 'systemctl list-units --type=service --state=running',
    description: 'List running system services',
  },
  // Logs
  {
    keywords: ['log', 'tail', 'recent', 'last log'],
    language: 'bash',
    code: 'tail -n 100 /var/log/syslog',
    description: 'View recent log entries',
  },
  {
    keywords: ['error', 'grep error', 'find error'],
    language: 'bash',
    code: 'grep -i error /var/log/syslog | tail -50',
    description: 'Find recent error messages in logs',
  },
  // File operations
  {
    keywords: ['file size', 'large file', 'find large', 'disk usage'],
    language: 'bash',
    code: 'find / -type f -size +100M 2>/dev/null | head -20',
    description: 'Find large files on the system',
  },
  {
    keywords: ['uptime', 'how long', 'boot'],
    language: 'bash',
    code: 'uptime && who -b',
    description: 'Check system uptime',
  },
  {
    keywords: ['whoami', 'user', 'current user', 'identity'],
    language: 'bash',
    code: 'whoami && id',
    description: 'Check current user identity',
  },
  // Environment
  {
    keywords: ['env', 'environment', 'variable', 'env var'],
    language: 'bash',
    code: 'env | sort',
    description: 'List environment variables',
  },
  {
    keywords: ['os', 'operating system', 'uname', 'kernel'],
    language: 'bash',
    code: 'uname -a',
    description: 'Show operating system information',
  },
];

/**
 * AI Script Generation Service.
 *
 * Calls orion-ai-service for AI-enhanced generation,
 * falls back to template-based matching.
 */
export class AIGenerateService {
  private aiServiceUrl: string;
  private timeoutMs: number;

  constructor(options?: { aiServiceUrl?: string; timeoutMs?: number }) {
    this.aiServiceUrl = options?.aiServiceUrl || process.env.ORION_AI_SERVICE_URL || 'http://localhost:8080';
    this.timeoutMs = options?.timeoutMs || 30000;
  }

  /**
   * Generate a script from a natural language prompt.
   */
  async generateScript(request: GenerateRequest): Promise<GeneratedScript> {
    logger.info(
      { prompt: request.prompt, language: request.language },
      'Generating script from prompt'
    );

    // Try AI service first
    try {
      const aiResult = await this.callAIGeneration(request);
      if (aiResult) {
        return aiResult;
      }
    } catch (error: any) {
      logger.warn(
        { error: error.message },
        'AI script generation unavailable, falling back to templates'
      );
    }

    // Fallback to template-based generation
    return this.generateFromTemplate(request);
  }

  /**
   * Call orion-ai-service for script generation.
   */
  private async callAIGeneration(request: GenerateRequest): Promise<GeneratedScript | null> {
    const url = `${this.aiServiceUrl}/api/generate-script`;

    const response = await safeFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: request.prompt,
        language: request.language,
        level: request.level,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new OrionError(`AI service returned ${response.status}`, 'OPERATION_FAILED')
    }

    const data: Record<string, any> = (await response.json()) as Record<string, any>;

    return {
      code: data.code || data.script || '',
      language: data.language || request.language,
      warnings: data.warnings || [],
      requiresApproval: data.requiresApproval || false,
    };
  }

  /**
   * Generate a script using template matching.
   */
  private generateFromTemplate(request: GenerateRequest): GeneratedScript {
    const prompt = request.prompt.toLowerCase();
    const words = prompt.split(/\s+/);

    // Score each template by keyword matches
    const scored = SCRIPT_TEMPLATES.map((template) => {
      let score = 0;
      for (const keyword of template.keywords) {
        if (prompt.includes(keyword.toLowerCase())) {
          score += 2; // full keyword match
        } else {
          // Partial match: check if any word from keyword is in prompt
          const keywordWords = keyword.toLowerCase().split(/\s+/);
          for (const kw of keywordWords) {
            if (words.includes(kw)) {
              score += 1;
            }
          }
        }
      }
      return { template, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];

    if (best && best.score > 0) {
      logger.info(
        { template: best.template.description, score: best.score },
        'Template-based script generation'
      );

      const warnings: string[] = [];

      // Check if the requested language matches the template language
      if (request.language && request.language !== best.template.language) {
        warnings.push(
          `Template generates ${best.template.language} code, but ${request.language} was requested`
        );
      }

      return {
        code: best.template.code,
        language: best.template.language,
        warnings,
        requiresApproval: false,
      };
    }

    // No template matched
    return {
      code: `# No template found for prompt: "${request.prompt}"\n# Please write the script manually or use a more specific description.`,
      language: request.language || 'bash',
      warnings: ['No matching template found - generated placeholder script'],
      requiresApproval: true,
    };
  }
}
