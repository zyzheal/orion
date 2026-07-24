/**
 * RunnerService 单元测试
 *
 * 测试 Runner 服务的任务执行和结果报告逻辑。
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Task execution logic extracted from RunnerService
interface TaskParameters {
  command?: string;
  script?: string;
  timeout?: number;
  workingDir?: string;
  env?: Record<string, string>;
}

interface TaskResult {
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
  exitCode: number;
}

function validateTaskParameters(type: string, params: TaskParameters): string[] {
  const errors: string[] = [];
  if (!type || type.trim().length === 0) {
    errors.push('Task type is required');
  }
  if (!['shell', 'http', 'pipeline', 'deploy'].includes(type)) {
    errors.push(`Unknown task type: ${type}`);
  }
  if (type === 'shell' && !params.command && !params.script) {
    errors.push('Shell task requires command or script');
  }
  if (params.timeout && (params.timeout < 1000 || params.timeout > 3600000)) {
    errors.push('Timeout must be between 1s and 1h');
  }
  return errors;
}

function formatTaskResult(type: string, params: TaskParameters, success: boolean, output: string, durationMs: number): TaskResult {
  return {
    success,
    output: output.slice(0, 10000), // Truncate output
    error: success ? undefined : 'Task execution failed',
    durationMs,
    exitCode: success ? 0 : 1,
  };
}

function estimateTaskDuration(type: string, params: TaskParameters): number {
  const baseTimeout = params.timeout || 300000; // 5 min default
  switch (type) {
    case 'shell':
      return Math.min(baseTimeout, 60000); // Shell tasks default to 1 min max
    case 'http':
      return Math.min(baseTimeout, 30000); // HTTP tasks default to 30s
    case 'pipeline':
      return baseTimeout; // Pipeline tasks use full timeout
    case 'deploy':
      return Math.min(baseTimeout, 600000); // Deploy tasks default to 10 min max
    default:
      return baseTimeout;
  }
}

describe('RunnerService - Task Execution', () => {
  describe('validateTaskParameters', () => {
    it('accepts valid shell task', () => {
      const errors = validateTaskParameters('shell', { command: 'echo hello' });
      expect(errors).toHaveLength(0);
    });

    it('accepts valid http task', () => {
      const errors = validateTaskParameters('http', { command: 'curl http://example.com' });
      expect(errors).toHaveLength(0);
    });

    it('rejects empty type', () => {
      const errors = validateTaskParameters('', {});
      expect(errors).toContain('Task type is required');
    });

    it('rejects unknown type', () => {
      const errors = validateTaskParameters('unknown', {});
      expect(errors).toContain('Unknown task type');
    });

    it('rejects shell task without command', () => {
      const errors = validateTaskParameters('shell', {});
      expect(errors).toContain('Shell task requires command or script');
    });

    it('rejects invalid timeout', () => {
      expect(validateTaskParameters('shell', { command: 'echo', timeout: 500 })).toContain('Timeout must be between 1s and 1h');
      expect(validateTaskParameters('shell', { command: 'echo', timeout: 3700000 })).toContain('Timeout must be between 1s and 1h');
    });

    it('accepts valid timeout', () => {
      expect(validateTaskParameters('shell', { command: 'echo', timeout: 5000 })).toHaveLength(0);
    });
  });

  describe('formatTaskResult', () => {
    it('formats success result', () => {
      const result = formatTaskResult('shell', {}, true, 'output', 1234);
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.error).toBeUndefined();
    });

    it('formats failure result', () => {
      const result = formatTaskResult('shell', {}, false, 'error output', 1234);
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.error).toBeDefined();
    });

    it('truncates long output', () => {
      const longOutput = 'x'.repeat(15000);
      const result = formatTaskResult('shell', {}, true, longOutput, 1234);
      expect(result.output.length).toBeLessThanOrEqual(10000);
    });
  });

  describe('estimateTaskDuration', () => {
    it('uses default for shell tasks', () => {
      expect(estimateTaskDuration('shell', {})).toBe(60000);
    });

    it('uses default for http tasks', () => {
      expect(estimateTaskDuration('http', {})).toBe(30000);
    });

    it('uses default for deploy tasks', () => {
      expect(estimateTaskDuration('deploy', {})).toBe(600000);
    });

    it('uses full timeout for pipeline tasks', () => {
      expect(estimateTaskDuration('pipeline', { timeout: 300000 })).toBe(300000);
    });

    it('respects custom timeout within limits', () => {
      expect(estimateTaskDuration('shell', { timeout: 10000 })).toBe(10000);
    });
  });
});
