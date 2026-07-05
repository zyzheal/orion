/**
 * WorkspaceIsolator - Pipeline Run Workspace 隔离器
 *
 * 职责：
 * - 为每个 Pipeline run 创建独立 workspace 目录
 * - 为每个 task 创建子目录（带路径穿越防护）
 * - 管理 workspace 生命周期（成功立即清理，失败保留 7 天）
 * - 定期清理过期 workspace
 *
 * 设计理念：
 * - 替代全局 /tmp 硬编码，实现 run 级别的隔离
 * - 每个 run 的工作空间互不干扰
 * - 失败 run 保留用于调试
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import { OrionError } from '../errors';

const logger = createLogger('workspace-isolator');

/**
 * 默认 workspace 根目录
 */
export const DEFAULT_WORKSPACE_BASE = '/tmp/orion-workspaces';

/**
 * 默认失败 run 保留天数
 */
export const DEFAULT_RETENTION_DAYS = 7;

/**
 * taskId 白名单正则：只允许字母、数字、连字符、下划线
 */
const TASK_ID_WHITELIST = /^[a-zA-Z0-9_-]+$/;

/**
 * 清理结果
 */
export interface WorkspaceCleanupResult {
  deleted: number;
  retained: number;
  errors: string[];
}

/**
 * 单次清理结果
 */
export interface SingleCleanupResult {
  deleted: boolean;
  retained: boolean;
  error?: string;
}

/**
 * WorkspaceIsolator
 *
 * 管理 Pipeline run 的 workspace 隔离。
 * 可通过依赖注入使用，或作为单例使用。
 */
export class WorkspaceIsolator {
  private baseDir: string;

  constructor(baseDir: string = DEFAULT_WORKSPACE_BASE) {
    this.baseDir = baseDir;
  }

  /**
   * 获取 baseDir（用于测试和日志）
   */
  getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * 为 run 创建 workspace 目录
   *
   * @param runId Pipeline run 的唯一标识
   * @returns workspace 绝对路径（带尾随斜杠）
   */
  createWorkspace(runId: string): string {
    const workspacePath = this.getWorkspacePath(runId);

    try {
      fs.mkdirSync(workspacePath, { recursive: true });
      logger.debug({ runId, path: workspacePath }, 'Workspace created');
    } catch (error) {
      // 如果目录已存在，mkdirSync with recursive: true 不会报错
      // 但其他错误需要记录
      logger.warn({ runId, error }, 'Failed to create workspace directory');
    }

    return workspacePath;
  }

  /**
   * 为 task 创建 workspace 子目录
   *
   * @param runId Pipeline run 的唯一标识
   * @param taskId Task 的唯一标识（会被 sanitize）
   * @returns task workspace 绝对路径（带尾随斜杠）
   */
  createTaskWorkspace(runId: string, taskId: string): string {
    // 先确保 run workspace 存在
    this.createWorkspace(runId);

    const taskPath = this.getWorkspacePath(runId, taskId);

    try {
      fs.mkdirSync(taskPath, { recursive: true });
      logger.debug({ runId, taskId, path: taskPath }, 'Task workspace created');
    } catch (error) {
      logger.warn({ runId, taskId, error }, 'Failed to create task workspace');
    }

    return taskPath;
  }

  /**
   * 获取 workspace 路径（不创建目录）
   *
   * @param runId Pipeline run 的唯一标识
   * @param taskId 可选的 task 标识
   * @param customRootPath 可选的自定义根路径（如果设置，忽略 baseDir）
   * @returns workspace 绝对路径（带尾随斜杠）
   */
  getWorkspacePath(
    runId: string,
    taskId?: string,
    customRootPath?: string
  ): string {
    let rootPath: string;

    if (customRootPath) {
      // 验证 customRootPath 防止路径穿越
      const resolved = path.resolve(customRootPath);
      const expectedBase = process.env.ORION_WORKSPACE_ROOT
        ? path.resolve(process.env.ORION_WORKSPACE_ROOT)
        : '';
      // 确保解析后的路径在 /tmp/ 或 ORION_WORKSPACE_ROOT 下
      // （测试环境可使用环境变量自定义，生产环境默认限制在 /tmp/ 下）
      if (
        !resolved.startsWith('/tmp/') &&
        (expectedBase === '' || !resolved.startsWith(expectedBase + '/')) &&
        resolved !== expectedBase
      ) {
        // 非 /tmp/ 且非 ORION_WORKSPACE_ROOT 下的路径：
        // 允许任意路径但记录警告，防止路径穿越到敏感系统目录
        const dangerousRoots = ['/', '/etc', '/usr', '/var', '/root', '/boot'];
        if (dangerousRoots.includes(resolved) || resolved.startsWith('/etc/') || resolved.startsWith('/usr/') || resolved.startsWith('/var/') || resolved.startsWith('/root/') || resolved.startsWith('/boot/')) {
          throw new OrionError(`Invalid custom workspace root path: ${customRootPath} (resolved to ${resolved})`, 'VALIDATION_ERROR');
        }
        logger.warn(
          { customRootPath, resolved },
          'Custom workspace root is outside expected directories'
        );
      }
      rootPath = resolved;
    } else {
      rootPath = this.baseDir;
    }

    const sanitizedRunId = sanitizeRunId(runId);

    let basePath = `${rootPath}/${sanitizedRunId}/`;

    if (taskId) {
      const sanitizedTaskId = sanitizeTaskId(taskId);
      // 如果 sanitization 后为空，使用 'untitled'
      const finalTaskId = sanitizedTaskId || 'untitled';
      basePath = `${rootPath}/${sanitizedRunId}/${finalTaskId}/`;
    }

    return basePath;
  }

  /**
   * 清理 workspace
   *
   * @param runId Pipeline run 的唯一标识
   * @param success run 是否成功
   * @returns 清理结果
   */
  async cleanupWorkspace(
    runId: string,
    success: boolean
  ): Promise<SingleCleanupResult> {
    if (success) {
      // 成功 run：立即删除
      return this.deleteWorkspace(runId);
    } else {
      // 失败 run：保留用于调试，记录日志
      const workspacePath = this.getWorkspacePath(runId);
      logger.info(
        { runId, path: workspacePath, retentionDays: DEFAULT_RETENTION_DAYS },
        'Failed run workspace retained for debugging'
      );
      return { deleted: false, retained: true };
    }
  }

  /**
   * 清理所有 workspaces（用于测试）
   */
  async cleanupAll(): Promise<SingleCleanupResult> {
    return this.deleteDirectory(this.baseDir);
  }

  /**
   * 定期清理：删除超过保留期的失败 run workspace
   *
   * @param retentionDays 保留天数（默认 7 天）
   * @returns 清理结果
   */
  async cleanupExpiredWorkspaces(
    retentionDays: number = DEFAULT_RETENTION_DAYS
  ): Promise<WorkspaceCleanupResult> {
    const result: WorkspaceCleanupResult = {
      deleted: 0,
      retained: 0,
      errors: [],
    };

    try {
      if (!fs.existsSync(this.baseDir)) {
        return result;
      }

      const entries = fs.readdirSync(this.baseDir, { withFileTypes: true });
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const entryPath = path.join(this.baseDir, entry.name);

        try {
          const stats = fs.statSync(entryPath);
          // 使用 birthtime（创建时间）判断，fallback 到 ctime
          const creationTime =
            stats.birthtimeMs > 0
              ? new Date(stats.birthtimeMs)
              : new Date(stats.ctimeMs);
          if (creationTime < cutoffDate) {
            const deleteResult = await this.deleteDirectory(entryPath);
            if (deleteResult.deleted) result.deleted++;
            if (deleteResult.error) result.errors.push(deleteResult.error);
            logger.info(
              { path: entryPath, age: creationTime },
              'Expired workspace deleted'
            );
          } else {
            result.retained++;
          }
        } catch (error) {
          const errorMsg = `Failed to check ${entry.name}: ${error instanceof Error ? error.message : String(error)}`;
          logger.warn({ entry: entry.name, error }, errorMsg);
          result.errors.push(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = `Failed to scan base directory: ${error instanceof Error ? error.message : String(error)}`;
      logger.error({ error }, errorMsg);
      result.errors.push(errorMsg);
    }

    return result;
  }

  /**
   * 删除 workspace 目录
   */
  private async deleteWorkspace(runId: string): Promise<SingleCleanupResult> {
    const workspacePath = this.getWorkspacePath(runId);
    return this.deleteDirectory(workspacePath);
  }

  /**
   * 删除目录（异步，不阻塞）
   */
  private async deleteDirectory(
    dirPath: string
  ): Promise<SingleCleanupResult> {
    try {
      if (!fs.existsSync(dirPath)) {
        // 目录不存在不算错误
        return { deleted: false, retained: false };
      }

      fs.rmSync(dirPath, { recursive: true, force: true });
      logger.debug({ path: dirPath }, 'Directory deleted');
      return { deleted: true, retained: false };
    } catch (error) {
      const errorMsg = `Failed to delete ${dirPath}: ${error instanceof Error ? error.message : String(error)}`;
      logger.error({ path: dirPath, error }, errorMsg);
      return {
        deleted: false,
        retained: true,
        error: errorMsg,
      };
    }
  }
}

/**
 * 清理 runId（防止路径穿越）
 *
 * runId 通常是 UUID 或类似格式，但也应该做基本防护
 */
function sanitizeRunId(runId: string): string {
  if (!runId || typeof runId !== 'string') {
    return 'unknown';
  }

  // 移除 null 字节
  let sanitized = runId.replace(/\0/g, '');

  // 只保留白名单字符 [a-zA-Z0-9_-]
  sanitized = sanitized.replace(/[^a-zA-Z0-9_-]/g, '');

  // 限制长度
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
  }

  // 如果结果为空，返回默认值
  if (sanitized.trim().length === 0) {
    return 'unknown';
  }

  return sanitized;
}

/**
 * 清理 taskId（路径穿越防护）
 *
 * 使用白名单 [a-zA-Z0-9_-]+ 过滤，移除非白名单字符
 */
export function sanitizeTaskId(taskId: string): string {
  if (!taskId || typeof taskId !== 'string') {
    return 'untitled';
  }

  // 移除 null 字节
  let sanitized = taskId.replace(/\0/g, '');

  // 只保留白名单字符
  sanitized = sanitized.replace(/[^a-zA-Z0-9_-]/g, '');

  // 如果结果为空，返回默认值
  if (sanitized.trim().length === 0) {
    return 'untitled';
  }

  return sanitized;
}

/**
 * 单例模式（方便在 TaskRunner 中直接使用）
 */
let defaultInstance: WorkspaceIsolator | null = null;

export function getDefaultWorkspaceIsolator(): WorkspaceIsolator {
  if (!defaultInstance) {
    defaultInstance = new WorkspaceIsolator();
  }
  return defaultInstance;
}
