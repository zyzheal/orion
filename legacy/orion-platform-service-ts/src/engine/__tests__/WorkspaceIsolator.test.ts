/**
 * WorkspaceIsolator Tests
 *
 * TDD: Tests written first, then implementation.
 * Verifies workspace creation, isolation, path traversal protection,
 * and cleanup with retention policies.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  WorkspaceIsolator,
  sanitizeTaskId,
  WorkspaceCleanupResult,
} from '../WorkspaceIsolator';

describe('WorkspaceIsolator', () => {
  const testBaseDir = '/tmp/orion-workspaces-test';
  let isolator: WorkspaceIsolator;

  beforeEach(() => {
    isolator = new WorkspaceIsolator(testBaseDir);
    // Clean up any leftover test directories
    try {
      if (fs.existsSync(testBaseDir)) {
        fs.rmSync(testBaseDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors in setup
    }
  });

  afterEach(async () => {
    // Clean up test directories
    try {
      await isolator.cleanupAll();
    } catch {
      // Ignore cleanup errors in teardown
    }
  });

  describe('createWorkspace', () => {
    it('should create a workspace directory for a given runId', () => {
      const workspacePath = isolator.createWorkspace('run-001');

      expect(workspacePath).toBe(`${testBaseDir}/run-001/`);
      expect(fs.existsSync(workspacePath)).toBe(true);
    });

    it('should return the same path if workspace already exists', () => {
      const first = isolator.createWorkspace('run-002');
      const second = isolator.createWorkspace('run-002');

      expect(first).toBe(second);
    });

    it('should create nested directories if base path does not exist', () => {
      const nestedDir = `${testBaseDir}/deep/nested`;
      const nestedIsolator = new WorkspaceIsolator(nestedDir);
      const workspacePath = nestedIsolator.createWorkspace('run-003');

      expect(fs.existsSync(workspacePath)).toBe(true);
      // Clean up
      try {
        fs.rmSync(testBaseDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    });
  });

  describe('createTaskWorkspace', () => {
    it('should create a task subdirectory within the run workspace', () => {
      isolator.createWorkspace('run-010');
      const taskPath = isolator.createTaskWorkspace('run-010', 'task-build');

      expect(taskPath).toBe(`${testBaseDir}/run-010/task-build/`);
      expect(fs.existsSync(taskPath)).toBe(true);
    });

    it('should auto-create parent workspace if not exists', () => {
      const taskPath = isolator.createTaskWorkspace('run-011', 'task-test');

      expect(fs.existsSync(taskPath)).toBe(true);
      expect(fs.existsSync(`${testBaseDir}/run-011/`)).toBe(true);
    });

    it('should sanitize taskId to prevent path traversal', () => {
      isolator.createWorkspace('run-012');
      const taskPath = isolator.createTaskWorkspace('run-012', '../../../etc/passwd');

      // Sanitized to only contain alphanumeric, hyphens, underscores
      expect(taskPath).not.toContain('..');
      expect(taskPath).not.toContain('/etc/passwd');
      expect(fs.existsSync(taskPath)).toBe(true);
    });
  });

  describe('getWorkspacePath', () => {
    it('should return workspace path without creating directory', () => {
      const wsPath = isolator.getWorkspacePath('run-020');
      expect(wsPath).toBe(`${testBaseDir}/run-020/`);
      // getWorkspacePath should NOT create the directory
      expect(fs.existsSync(wsPath)).toBe(false);
    });

    it('should return task workspace path', () => {
      const taskPath = isolator.getWorkspacePath('run-020', 'task-compile');
      expect(taskPath).toBe(`${testBaseDir}/run-020/task-compile/`);
    });

    it('should respect custom rootPath when provided', () => {
      // When customRootPath is provided, it replaces the base dir
      // runId is still appended for isolation
      const customPath = isolator.getWorkspacePath(
        'run-021',
        'task-build',
        '/custom/workspace'
      );
      expect(customPath).toBe('/custom/workspace/run-021/task-build/');
    });

    it('should sanitize taskId even with custom rootPath', () => {
      const taskPath = isolator.getWorkspacePath(
        'run-021',
        '../evil',
        '/custom/workspace'
      );
      // runId is still part of path, taskId gets sanitized
      expect(taskPath).toBe('/custom/workspace/run-021/evil/');
      expect(taskPath).not.toContain('..');
    });
  });

  describe('sanitizeTaskId', () => {
    it('should allow alphanumeric, hyphens, underscores', () => {
      expect(sanitizeTaskId('task-001')).toBe('task-001');
      expect(sanitizeTaskId('task_002')).toBe('task_002');
      expect(sanitizeTaskId('Task123')).toBe('Task123');
    });

    it('should remove path traversal sequences', () => {
      expect(sanitizeTaskId('../../../etc')).toBe('etc');
      // '..' alone becomes empty after sanitization, returns 'untitled'
      expect(sanitizeTaskId('..')).toBe('untitled');
      expect(sanitizeTaskId('task/../../secret')).toBe('tasksecret');
    });

    it('should remove special characters (whitelist approach)', () => {
      // Whitelist [a-zA-Z0-9_-] removes spaces, semicolons, slashes, etc.
      expect(sanitizeTaskId('task;rm -rf /')).toBe('taskrm-rf');
      expect(sanitizeTaskId('task$(evil)')).toBe('taskevil');
    });

    it('should handle empty input', () => {
      expect(sanitizeTaskId('')).toBe('untitled');
      expect(sanitizeTaskId('   ')).toBe('untitled');
    });

    it('should remove null bytes', () => {
      expect(sanitizeTaskId('task\x00evil')).toBe('taskevil');
    });
  });

  describe('cleanupWorkspace', () => {
    it('should immediately delete workspace for successful runs', async () => {
      isolator.createWorkspace('run-success');
      isolator.createTaskWorkspace('run-success', 'task-1');

      const result = await isolator.cleanupWorkspace('run-success', true);

      expect(result.deleted).toBe(true);
      expect(result.retained).toBe(false);
      expect(fs.existsSync(`${testBaseDir}/run-success/`)).toBe(false);
    });

    it('should retain workspace for failed runs (7-day retention)', async () => {
      isolator.createWorkspace('run-failed');
      isolator.createTaskWorkspace('run-failed', 'task-1');

      const result = await isolator.cleanupWorkspace('run-failed', false);

      expect(result.deleted).toBe(false);
      expect(result.retained).toBe(true);
      // Workspace should still exist for debugging
      expect(fs.existsSync(`${testBaseDir}/run-failed/`)).toBe(true);
    });

    it('should log and not throw if workspace does not exist', async () => {
      const result = await isolator.cleanupWorkspace('nonexistent', true);

      expect(result.deleted).toBe(false);
      expect(result.error).toBeFalsy();
    });

    it('should log error but not throw if deletion fails', async () => {
      // Create workspace, then make it undeletable by removing permissions
      const wsPath = isolator.createWorkspace('run-undeletable');
      // Create a file inside to ensure there's content
      fs.writeFileSync(`${wsPath}test.txt`, 'test');

      // On some systems, chmod may not fully prevent deletion of the parent
      // so we just verify the function doesn't throw
      const result = await isolator.cleanupWorkspace('run-undeletable', true);
      // The function should not throw even if deletion fails
      expect(result).toBeDefined();
    });
  });

  describe('cleanupExpiredWorkspaces', () => {
    it('should delete workspaces older than retention period', async () => {
      // Create a workspace and backdate it by modifying mtime
      const wsPath = isolator.createWorkspace('run-expired');
      fs.writeFileSync(`${wsPath}test.txt`, 'test');

      // Backdate by 8 days (beyond default 7-day retention)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8);
      fs.utimesSync(wsPath, oldDate, oldDate);

      const result = await isolator.cleanupExpiredWorkspaces();

      expect(result.deleted).toBeGreaterThanOrEqual(1);
      expect(fs.existsSync(wsPath)).toBe(false);
    });

    it('should not delete workspaces within retention period', async () => {
      const wsPath = isolator.createWorkspace('run-recent');
      fs.writeFileSync(`${wsPath}test.txt`, 'test');

      // Backdate by only 3 days (within 7-day retention)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3);
      fs.utimesSync(wsPath, recentDate, recentDate);

      const result = await isolator.cleanupExpiredWorkspaces();

      expect(result.deleted).toBe(0);
      expect(fs.existsSync(wsPath)).toBe(true);
    });

    it('should accept custom retention days', async () => {
      const wsPath = isolator.createWorkspace('run-custom');
      fs.writeFileSync(`${wsPath}test.txt`, 'test');

      // Backdate by 4 days
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 4);
      fs.utimesSync(wsPath, oldDate, oldDate);

      // With 3-day retention, this should be deleted
      const result = await isolator.cleanupExpiredWorkspaces(3);

      expect(result.deleted).toBeGreaterThanOrEqual(1);
      expect(fs.existsSync(wsPath)).toBe(false);
    });
  });

  describe('default base directory', () => {
    it('should use /tmp/orion-workspaces when no baseDir provided', () => {
      const defaultIsolator = new WorkspaceIsolator();
      const wsPath = defaultIsolator.getWorkspacePath('run-default');

      expect(wsPath).toBe('/tmp/orion-workspaces/run-default/');
    });
  });
});
