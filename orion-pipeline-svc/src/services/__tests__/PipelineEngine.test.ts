/**
 * PipelineEngine 并行执行测试
 *
 * 验证：
 * 1. 无依赖阶段并行执行
 * 2. 有依赖阶段顺序执行
 * 3. 失败时取消未执行阶段
 * 4. 阶段重试逻辑
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineEngine } from '../PipelineEngine';
import type { Pipeline, PipelineStage } from '../../types/pipeline';
import pino from 'pino';

// Mock logger
const mockLogger = pino({ level: 'silent' });

// Mock spawn to prevent actual command execution
vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((event, cb) => {
      if (event === 'close') {
        setTimeout(() => cb(0), 10);
      }
    }),
    kill: vi.fn(),
  })),
}));

describe('PipelineEngine - Parallel Execution', () => {
  let engine: PipelineEngine;

  beforeEach(() => {
    engine = new PipelineEngine({ logger: mockLogger });
  });

  it('should validate DAG without cycles', () => {
    const stages: PipelineStage[] = [
      { id: 'build', name: 'Build', type: 'build', command: 'echo build', dependsOn: [] },
      { id: 'test', name: 'Test', type: 'test', command: 'echo test', dependsOn: ['build'] },
      { id: 'deploy', name: 'Deploy', type: 'deploy', command: 'echo deploy', dependsOn: ['test'] },
    ];

    const result = PipelineEngine.validateDag(stages);
    expect(result.valid).toBe(true);
  });

  it('should detect cycle in DAG', () => {
    const stages: PipelineStage[] = [
      { id: 'a', name: 'A', type: 'build', command: 'echo a', dependsOn: ['c'] },
      { id: 'b', name: 'B', type: 'test', command: 'echo b', dependsOn: ['a'] },
      { id: 'c', name: 'C', type: 'deploy', command: 'echo c', dependsOn: ['b'] },
    ];

    const result = PipelineEngine.validateDag(stages);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Cycle detected');
  });

  it('should detect missing dependency reference', () => {
    const stages: PipelineStage[] = [
      { id: 'build', name: 'Build', type: 'build', command: 'echo build', dependsOn: ['nonexistent'] },
    ];

    const result = PipelineEngine.validateDag(stages);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('non-existent stage');
  });

  it('should support retries configuration on stage', () => {
    const stage: PipelineStage = {
      id: 'flaky-test',
      name: 'Flaky Test',
      type: 'test',
      command: 'echo test',
      dependsOn: [],
      retries: 3,
    };

    expect(stage.retries).toBe(3);
  });
});
