/**
 * Configuration GitOps Sync Service
 * 
 * GitOps 配置同步 - 从 Git 仓库同步配置
 */

import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';
import pino from 'pino';
import { OrionError, ErrorCode } from '../../../errors';

const logger = pino({ name: 'ConfigGitOps' });

// ==================== 配置 ====================

export interface GitOpsConfig {
  enabled: boolean;
  repoUrl: string;
  branch: string;
  configPath: string;
  auth: {
    type: 'ssh' | 'https';
    privateKey?: string;
    username?: string;
    token?: string;
  };
  syncIntervalMs: number;
  watchEnabled: boolean;
  conflictResolution: 'git-wins' | 'db-wins' | 'manual';
}

// ==================== Git 服务 ====================

export class ConfigGitOpsService {
  private git: SimpleGit | null = null;
  private config: GitOpsConfig;
  private workDir: string;
  private isInitialized: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private dbApplyFn: ((configs: Record<string, any>) => Promise<void>) | null = null;

  constructor(workDir: string = '/tmp/orion-config-gitops') {
    this.workDir = workDir;
    this.config = this.getDefaultConfig();
  }

  private getDefaultConfig(): GitOpsConfig {
    return {
      enabled: process.env.GITOPS_ENABLED === 'true',
      repoUrl: process.env.GITOPS_REPO_URL || '',
      branch: process.env.GITOPS_BRANCH || 'main',
      configPath: process.env.GITOPS_CONFIG_PATH || 'configs',
      auth: {
        type: (process.env.GITOPS_AUTH_TYPE as 'ssh' | 'https') || 'https',
        token: process.env.GITOPS_TOKEN,
      },
      syncIntervalMs: parseInt(process.env.GITOPS_SYNC_INTERVAL || '60000'),
      watchEnabled: process.env.GITOPS_WATCH === 'true',
      conflictResolution: (process.env.GITOPS_CONFLICT_RESOLUTION as any) || 'git-wins',
    };
  }

  /**
   * 初始化 GitOps 服务
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('GitOps is disabled');
      return;
    }

    try {
      // 确保工作目录存在
      await fs.mkdir(this.workDir, { recursive: true });

      // 初始化 Git
      this.git = simpleGit();

      // 配置认证
      if (this.config.auth.token) {
        // HTTPS 认证
        const repoUrl = new URL(this.config.repoUrl);
        repoUrl.username = this.config.auth.username || 'oauth2';
        repoUrl.password = this.config.auth.token;
        await this.git.env({ GIT_URL: repoUrl.toString() });
      }

      // 克隆或拉取仓库
      await this.sync();

      this.isInitialized = true;
      logger.info({ repoUrl: this.config.repoUrl }, 'GitOps initialized');

      // 启动定时同步
      if (this.config.syncIntervalMs > 0) {
        this.startPeriodicSync();
      }
    } catch (error) {
      logger.error({ error }, 'Failed to initialize GitOps');
      throw error;
    }
  }

  /**
   * 设置数据库应用函数
   */
  setDbApplyFn(fn: (configs: Record<string, any>) => Promise<void>): void {
    this.dbApplyFn = fn;
  }

  /**
   * 同步配置
   */
  async sync(): Promise<{
    updated: number;
    added: number;
    deleted: number;
    errors: string[];
  }> {
    if (!this.git) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'GitOps not initialized');
    }

    const result = {
      updated: 0,
      added: 0,
      deleted: 0,
      errors: [] as string[],
    };

    try {
      // 检查目录是否是 git 仓库
      const isRepo = await this.git.checkIsRepo();
      
      if (!isRepo) {
        // 克隆仓库
        await this.git.clone(this.config.repoUrl, this.workDir);
        this.git = simpleGit(this.workDir);
      }

      // 切换分支
      try {
        await this.git.checkout(this.config.branch);
      } catch {
        await this.git.checkoutLocalBranch(this.config.branch);
      }

      // 拉取最新
      await this.git.pull('origin', this.config.branch);

      // 读取配置文件
      const configsDir = path.join(this.workDir, this.config.configPath);
      
      try {
        await fs.access(configsDir);
      } catch {
        logger.warn({ configsDir }, 'Config directory not found');
        return result;
      }

      // 读取所有 YAML/JSON 文件
      const files = await this.readConfigFiles(configsDir);
      
      logger.info({ fileCount: files.length }, 'Loaded config files');

      // 应用配置
      if (this.dbApplyFn) {
        await this.dbApplyFn(files);
        result.updated = Object.keys(files).length;
      }
    } catch (error: any) {
      logger.error({ error }, 'Sync failed');
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * 推送配置到 Git
   */
  async push(
    configs: Record<string, any>,
    message: string = 'Update configurations',
    author?: { name: string; email: string }
  ): Promise<{ success: boolean; commitSha?: string; error?: string }> {
    if (!this.git) {
      return { success: false, error: 'GitOps not initialized' };
    }

    try {
      // 写入配置文件
      const configsDir = path.join(this.workDir, this.config.configPath);
      await fs.mkdir(configsDir, { recursive: true });

      for (const [filename, content] of Object.entries(configs)) {
        const filePath = path.join(configsDir, filename.endsWith('.yaml') ? filename : `${filename}.yaml`);
        
        if (typeof content === 'object') {
          const yaml = require('js-yaml');
          await fs.writeFile(filePath, yaml.dump(content));
        } else {
          await fs.writeFile(filePath, String(content));
        }
      }

      // Git 操作
      await this.git.add('.');
      
      const authorInfo = author || {
        name: 'Orion Config Bot',
        email: 'config-bot@orion.dev',
      };
      
      await this.git.commit(message, undefined, { '--author': `${authorInfo.name} <${authorInfo.email}>` });
      
      const log = await this.git.log({ maxCount: 1 });
      const commitSha = log.latest?.hash;

      // 推送到远程
      await this.git.push('origin', this.config.branch);

      logger.info({ commitSha, files: Object.keys(configs).length }, 'Pushed to Git');

      return { success: true, commitSha };
    } catch (error: any) {
      logger.error({ error }, 'Push failed');
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取 Git 状态
   */
  async getStatus(): Promise<{
    branch: string;
    commitsBehind: number;
    hasChanges: boolean;
    lastSync: Date | null;
  }> {
    if (!this.git) {
      return {
        branch: this.config.branch,
        commitsBehind: 0,
        hasChanges: false,
        lastSync: null,
      };
    }

    try {
      const status = await this.git.status();
      
      // 计算落后于远程的提交数
      await this.git.fetch();
      const commitsBehind = await this.git.log({ from: `origin/${this.config.branch}`, to: this.config.branch, maxCount: 1 })
        .then(log => log.all.length)
        .catch(() => 0);

      return {
        branch: status.current || this.config.branch,
        commitsBehind: Math.min(commitsBehind, 10), // 最多显示10个
        hasChanges: status.files.length > 0,
        lastSync: null, // 可以存储最后同步时间
      };
    } catch (error) {
      return {
        branch: this.config.branch,
        commitsBehind: 0,
        hasChanges: false,
        lastSync: null,
      };
    }
  }

  /**
   * 获取配置历史
   */
  async getHistory(limit: number = 10): Promise<Array<{
    hash: string;
    date: string;
    message: string;
    author: string;
  }>> {
    if (!this.git) {
      return [];
    }

    try {
      const log = await this.git.log({ maxCount: limit });
      
      return log.all.map(commit => ({
        hash: commit.hash,
        date: commit.date,
        message: commit.message,
        author: commit.author_name,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to get history');
      return [];
    }
  }

  /**
   * 回滚到指定提交
   */
  async rollback(commitSha: string): Promise<{ success: boolean; error?: string }> {
    if (!this.git) {
      return { success: false, error: 'GitOps not initialized' };
    }

    try {
      await this.git.checkout(commitSha, ['--', this.config.configPath]);
      
      // 重新同步
      await this.sync();
      
      return { success: true };
    } catch (error: any) {
      logger.error({ error }, 'Rollback failed');
      return { success: false, error: error.message };
    }
  }

  /**
   * 启动定时同步
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      logger.debug('Periodic sync started');
      await this.sync();
    }, this.config.syncIntervalMs);

    logger.info({ intervalMs: this.config.syncIntervalMs }, 'Periodic sync started');
  }

  /**
   * 停止定时同步
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * 关闭服务
   */
  async close(): Promise<void> {
    this.stopPeriodicSync();
    
    // 清理工作目录
    try {
      await fs.rm(this.workDir, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
    
    logger.info('GitOps service closed');
  }

  // ==================== 私有方法 ====================

  private async readConfigFiles(dir: string): Promise<Record<string, any>> {
    const configs: Record<string, any> = {};
    
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      
      const ext = path.extname(entry.name).toLowerCase();
      if (!['.yaml', '.yml', '.json'].includes(ext)) continue;
      
      const filePath = path.join(dir, entry.name);
      const content = await fs.readFile(filePath, 'utf-8');
      const key = entry.name.replace(/\.(yaml|yml|json)$/, '');
      
      try {
        if (ext === '.json') {
          configs[key] = JSON.parse(content);
        } else {
          const yaml = require('js-yaml');
          configs[key] = yaml.load(content);
        }
      } catch (error) {
        logger.warn({ file: entry.name, error }, 'Failed to parse config file');
      }
    }

    return configs;
  }
}

export default ConfigGitOpsService;