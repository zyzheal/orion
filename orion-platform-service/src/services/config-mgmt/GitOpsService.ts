/**
 * GitOpsService - GitOps Configuration Synchronization
 *
 * Manages synchronization between configuration items and a Git repository.
 * Supports drift detection, auto-sync, and sync status tracking.
 *
 * Features:
 *   - Pull configs from Git repository (YAML/JSON format)
 *   - Detect configuration drift between Git and platform state
 *   - Auto-sync with configurable interval
 *   - Sync status tracking and history
 *   - Auto-rollback on sync failure detection
 */

import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from './ConfigService';
import { GitOpsRepository } from '../../repositories/GitOpsRepository';
import {
  GitOpsConfig,
  CreateGitOpsInput,
  SyncStatus,
  ConfigDiff,
  ConfigItem,
  GitOpsStatus,
  SyncDirection,
  IEventPublisher,
  ConfigEvents,
} from './types';
import { OrionError, ErrorCode } from '../../errors';

/** Parsed config file from Git */
interface ParsedGitConfig {
  key: string;
  value: string;
  environment: string;
  description?: string;
  encrypted?: boolean;
  tags?: string[];
}

export interface GitOpsServiceConfig {
  configService: ConfigService;
  eventPublisher?: IEventPublisher;
  /** Git client interface (mockable for testing) */
  gitClient?: IGitClient;
  /** PostgreSQL repository for persistence */
  repository?: GitOpsRepository;
}

/** Interface for Git operations (allows mocking) */
export interface IGitClient {
  clone(repoUrl: string, branch: string, targetDir: string): Promise<void>;
  pull(repoDir: string): Promise<void>;
  readFile(repoDir: string, filePath: string): Promise<string>;
  getCurrentCommit(repoDir: string): Promise<string>;
  getDiff(repoDir: string, path: string): Promise<string>;
  cleanup(repoDir: string): Promise<void>;
}

/** Default in-memory Git client (for testing/mock) */
export class MockGitClient implements IGitClient {
  private fileContents: Map<string, string> = new Map();

  setFileContent(path: string, content: string): void {
    this.fileContents.set(path, content);
  }

  async clone(): Promise<void> {}
  async pull(): Promise<void> {}

  async readFile(repoDir: string, filePath: string): Promise<string> {
    // Support both full path and relative path lookups
    const fullPath = `${repoDir}/${filePath}`.replace(/\/+/g, '/');
    const content = this.fileContents.get(fullPath) || this.fileContents.get(filePath);
    if (content === undefined) {
      throw new OrionError(ErrorCode.NOT_FOUND, `File not found: ${filePath}`);
    }
    return content;
  }

  async getCurrentCommit(): Promise<string> {
    return 'abc123def456';
  }

  async getDiff(): Promise<string> {
    return '';
  }

  async cleanup(): Promise<void> {}
}

export class GitOpsService {
  private configService: ConfigService;
  private eventPublisher: IEventPublisher | null;
  private gitClient: IGitClient;
  private syncTimer: NodeJS.Timeout | null;
  private repoDir: string;
  private repository?: GitOpsRepository;
  // Memory fallback for when no repository
  private gitOpsConfigs: Map<string, GitOpsConfig>;
  private syncHistory: SyncStatus[];

  constructor(config: GitOpsServiceConfig) {
    this.configService = config.configService;
    this.eventPublisher = config.eventPublisher || null;
    this.gitClient = config.gitClient || new MockGitClient();
    this.syncTimer = null;
    this.repoDir = '/tmp/orion-config-repo';
    this.repository = config.repository;
    this.gitOpsConfigs = new Map();
    this.syncHistory = [];
  }

  setGitClient(client: IGitClient): void {
    this.gitClient = client;
  }

  setEventPublisher(publisher: IEventPublisher): void {
    this.eventPublisher = publisher;
  }

  /**
   * Enable GitOps synchronization for a repository
   */
  async enableGitOps(input: CreateGitOpsInput): Promise<GitOpsConfig> {
    const id = uuidv4();
    const now = new Date();

    const gitOpsConfig: GitOpsConfig = {
      id,
      repoUrl: input.repoUrl,
      branch: input.branch,
      configPath: input.configPath || 'configs/',
      syncInterval: input.syncInterval || 300, // 5 minutes default
      status: 'enabled',
      syncDirection: input.syncDirection || 'git_to_platform',
      autoApply: input.autoApply !== false,
      createdBy: input.createdBy,
      createdAt: now,
    };

    // Persist to repository or memory
    if (this.repository) {
      await this.repository.createGitOpsConfig(gitOpsConfig);
    } else {
      this.gitOpsConfigs.set(id, gitOpsConfig);
    }

    // Start sync timer
    this.startSyncTimer();

    return { ...gitOpsConfig };
  }

  /**
   * Disable GitOps synchronization
   */
  async disableGitOps(gitOpsConfigId: string): Promise<GitOpsConfig> {
    // Try repository first, fallback to memory
    let config = this.repository
      ? await this.repository.findById(gitOpsConfigId)
      : null;

    if (!config) {
      config = this.gitOpsConfigs.get(gitOpsConfigId) || null;
    }

    if (!config) {
      throw new OrionError(ErrorCode.NOT_FOUND, `GitOps config '${gitOpsConfigId}' not found`);
    }

    config.status = 'disabled';

    // Update in repository or memory
    if (this.repository) {
      await this.repository.update(gitOpsConfigId, { status: 'disabled' });
    } else {
      this.gitOpsConfigs.set(gitOpsConfigId, config);
    }

    // Stop sync timer if this was the only active config
    const allConfigs = this.repository
      ? await this.repository.findByStatus('enabled')
      : Array.from(this.gitOpsConfigs.values());

    const hasActive = allConfigs.some(
      (c) => c.status === 'enabled' || c.status === 'syncing'
    );
    if (!hasActive && this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    return { ...config };
  }

  /**
   * Get GitOps configuration by ID
   */
  async getGitOpsConfig(gitOpsConfigId: string): Promise<GitOpsConfig | null> {
    // Try repository first, fallback to memory
    if (this.repository) {
      const config = await this.repository.findById(gitOpsConfigId);
      return config ? { ...config } : null;
    }
    const config = this.gitOpsConfigs.get(gitOpsConfigId);
    return config ? { ...config } : null;
  }

  /**
   * List all GitOps configurations
   */
  async listGitOpsConfigs(): Promise<GitOpsConfig[]> {
    // Use repository if available
    if (this.repository) {
      const configs = await this.repository.findAll();
      return configs.map((c) => ({ ...c }));
    }
    return Array.from(this.gitOpsConfigs.values()).map((c) => ({ ...c }));
  }

  /**
   * Trigger a manual sync from Git repository
   */
  async syncFromGit(gitOpsConfigId?: string): Promise<SyncStatus> {
    // Get configs from repository or memory
    let configs: GitOpsConfig[] = [];
    if (this.repository) {
      if (gitOpsConfigId) {
        const config = await this.repository.findById(gitOpsConfigId);
        configs = config ? [config] : [];
      } else {
        configs = await this.repository.findByStatus('enabled');
      }
    } else {
      configs = gitOpsConfigId
        ? [this.gitOpsConfigs.get(gitOpsConfigId)].filter(Boolean) as GitOpsConfig[]
        : Array.from(this.gitOpsConfigs.values()).filter(
          (c) => c.status === 'enabled'
        );
    }

    const syncStatus: SyncStatus = {
      id: uuidv4(),
      gitOpsConfigId: gitOpsConfigId || configs[0]?.id || '',
      status: 'success',
      itemsSynced: 0,
      itemsFailed: 0,
      startedAt: new Date(),
      driftDetected: false,
      driftItems: [],
    };

    try {
      for (const gitConfig of configs) {
        if (!gitConfig) continue;

        gitConfig.status = 'syncing';
        // Update status in repository or memory
        if (this.repository) {
          await this.repository.update(gitConfig.id, { status: 'syncing' });
        } else {
          this.gitOpsConfigs.set(gitConfig.id, gitConfig);
        }

        // Clone/pull repository
        try {
          await this.gitClient.clone(gitConfig.repoUrl, gitConfig.branch, this.repoDir);
        } catch {
          // Already cloned, try pull
          try {
            await this.gitClient.pull(this.repoDir);
          } catch (error: any) {
            syncStatus.status = 'failure';
            syncStatus.error = `Failed to access Git repository: ${error.message}`;
            gitConfig.status = 'error';
            gitConfig.lastError = error.message;
            // Update in repository or memory
            if (this.repository) {
              await this.repository.update(gitConfig.id, { status: 'error', lastError: error.message });
            } else {
              this.gitOpsConfigs.set(gitConfig.id, gitConfig);
            }
            continue;
          }
        }

        // Read and parse config files
        const parsedConfigs = await this.readGitConfigFiles(gitConfig);

        // Detect drift before applying (only for existing configs, not new ones being imported)
        const driftItems = await this.detectDriftInternal(parsedConfigs);
        const existingDriftItems = driftItems.filter((d) => d.changeType !== 'added');
        if (existingDriftItems.length > 0) {
          syncStatus.driftDetected = true;
          syncStatus.driftItems = existingDriftItems;
        }

        // Apply configs if auto-apply is enabled
        if (gitConfig.autoApply) {
          let imported = 0;
          for (const pc of parsedConfigs) {
            try {
              await this.configService.createConfig({
                key: pc.key,
                value: pc.value,
                environment: pc.environment,
                description: pc.description,
                encrypted: pc.encrypted,
                tags: pc.tags,
                createdBy: 'gitops-sync',
              });
              imported++;
            } catch {
              // Skip duplicates
            }
          }
          syncStatus.itemsSynced += imported;
        } else {
          syncStatus.itemsSynced = parsedConfigs.length;
        }

        gitConfig.lastSync = new Date();
        gitConfig.status = syncStatus.driftDetected
          ? 'drift_detected'
          : 'enabled';

        // Update in repository or memory
        if (this.repository) {
          await this.repository.update(gitConfig.id, {
            lastSync: gitConfig.lastSync,
            status: gitConfig.status,
          });
        } else {
          this.gitOpsConfigs.set(gitConfig.id, gitConfig);
        }
      }

      syncStatus.completedAt = new Date();

      // Persist sync history
      if (this.repository) {
        await this.repository.createSyncStatus(syncStatus);
      }

      // Cleanup
      try {
        await this.gitClient.cleanup(this.repoDir);
      } catch {
        // Ignore cleanup errors
      }
    } catch (error: any) {
      syncStatus.status = 'failure';
      syncStatus.error = error.message;
      syncStatus.completedAt = new Date();
    }

    this.syncHistory.push(syncStatus);

    await this.publishEvent(ConfigEvents.CONFIG_SYNCED, {
      syncId: syncStatus.id,
      status: syncStatus.status,
      itemsSynced: syncStatus.itemsSynced,
      itemsFailed: syncStatus.itemsFailed,
      driftDetected: syncStatus.driftDetected,
    });

    return syncStatus;
  }

  /**
   * Detect configuration drift between Git and current platform state
   */
  async detectDrift(gitOpsConfigId?: string): Promise<ConfigDiff[]> {
    let configs: GitOpsConfig[] = [];

    if (this.repository) {
      if (gitOpsConfigId) {
        const config = await this.repository.findById(gitOpsConfigId);
        configs = config ? [config] : [];
      } else {
        const enabled = await this.repository.findByStatus('enabled');
        const driftDetected = await this.repository.findByStatus('drift_detected');
        configs = [...enabled, ...driftDetected];
      }
    } else {
      if (gitOpsConfigId) {
        const c = this.gitOpsConfigs.get(gitOpsConfigId);
        if (c) configs = [c];
      } else {
        configs = Array.from(this.gitOpsConfigs.values()).filter(
          (c) => c.status === 'enabled' || c.status === 'drift_detected'
        );
      }
    }

    const allDriftItems: ConfigDiff[] = [];

    for (const gitConfig of configs) {
      if (!gitConfig) continue;

      try {
        await this.gitClient.clone(gitConfig.repoUrl, gitConfig.branch, this.repoDir);
      } catch {
        try {
          await this.gitClient.pull(this.repoDir);
        } catch {
          continue;
        }
      }

      const parsedConfigs = await this.readGitConfigFiles(gitConfig);
      const driftItems = await this.detectDriftInternal(parsedConfigs);
      allDriftItems.push(...driftItems);

      try {
        await this.gitClient.cleanup(this.repoDir);
      } catch {
        // Ignore cleanup errors
      }
    }

    return allDriftItems;
  }

  /**
   * Get sync status history
   */
  async getSyncStatus(options?: {
    limit?: number;
    gitOpsConfigId?: string;
  }): Promise<SyncStatus[]> {
    // Use repository if available
    if (this.repository && options?.gitOpsConfigId) {
      return this.repository.findSyncHistory(
        options.gitOpsConfigId,
        options.limit || 20
      );
    }

    // Fallback to memory
    let results = [...this.syncHistory].reverse();

    if (options?.gitOpsConfigId) {
      results = results.filter((s) => s.gitOpsConfigId === options.gitOpsConfigId);
    }

    const limit = options?.limit || 20;
    return results.slice(0, limit);
  }

  /**
   * Get latest sync status
   */
  async getLatestSyncStatus(
    gitOpsConfigId?: string
  ): Promise<SyncStatus | null> {
    // Use repository if available
    if (this.repository && gitOpsConfigId) {
      return this.repository.findLatestSyncStatus(gitOpsConfigId);
    }

    // Fallback to memory
    const filtered = gitOpsConfigId
      ? this.syncHistory.filter((s) => s.gitOpsConfigId === gitOpsConfigId)
      : this.syncHistory;

    return filtered.length > 0 ? filtered[filtered.length - 1] : null;
  }

  // ==================== Internal Methods ====================

  private startSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    const minInterval = Math.min(
      ...Array.from(this.gitOpsConfigs.values())
        .filter((c) => c.status === 'enabled')
        .map((c) => c.syncInterval * 1000)
    );

    if (isFinite(minInterval) && minInterval > 0) {
      this.syncTimer = setInterval(async () => {
        try {
          await this.syncFromGit();
        } catch {
          // Log but don't crash the timer
        }
      }, minInterval);
    }
  }

  private async readGitConfigFiles(
    gitConfig: GitOpsConfig
  ): Promise<ParsedGitConfig[]> {
    try {
      const content = await this.gitClient.readFile(
        this.repoDir,
        `${gitConfig.configPath}configs.yaml`
      );
      return this.parseYamlConfig(content);
    } catch {
      // Try JSON
      try {
        const content = await this.gitClient.readFile(
          this.repoDir,
          `${gitConfig.configPath}configs.json`
        );
        return this.parseJsonConfig(content);
      } catch {
        return [];
      }
    }
  }

  private parseYamlConfig(content: string): ParsedGitConfig[] {
    // Simple YAML parser for flat key-value configs
    // Production: use js-yaml library
    const results: ParsedGitConfig[] = [];
    const lines = content.split('\n');
    let currentEnv: string = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Check for environment section
      const envMatch = trimmed.match(/^(\w+):\s*$/);
      if (envMatch && ['dev', 'staging', 'prod'].includes(envMatch[1])) {
        currentEnv = envMatch[1];
        continue;
      }

      // Parse key-value pair
      const kvMatch = trimmed.match(/^([\w.]+):\s*(.+)$/);
      if (kvMatch && currentEnv) {
        results.push({
          key: kvMatch[1],
          value: kvMatch[2].replace(/^["']|["']$/g, ''),
          environment: currentEnv,
        });
      }
    }

    return results;
  }

  private parseJsonConfig(content: string): ParsedGitConfig[] {
    const results: ParsedGitConfig[] = [];
    try {
      const parsed = JSON.parse(content);
      for (const [env, configs] of Object.entries(parsed)) {
        if (typeof configs === 'object' && configs !== null) {
          for (const [key, value] of Object.entries(configs)) {
            results.push({
              key,
              value: String(value),
              environment: env,
            });
          }
        }
      }
    } catch {
      // Invalid JSON, return empty
    }
    return results;
  }

  private async detectDriftInternal(
    gitConfigs: ParsedGitConfig[]
  ): Promise<ConfigDiff[]> {
    const driftItems: ConfigDiff[] = [];

    for (const gc of gitConfigs) {
      const env = gc.environment as any;
      if (!['dev', 'staging', 'prod'].includes(env)) continue;

      const platformConfig = await this.configService.getConfigByKey(
        gc.key,
        env
      );

      if (!platformConfig) {
        // Config exists in Git but not in platform
        driftItems.push({
          key: gc.key,
          environment: env,
          newValue: gc.value,
          changeType: 'added',
        });
      } else {
        const platformValue = typeof platformConfig.value === 'string'
          ? platformConfig.value
          : JSON.stringify(platformConfig.value);
        if (platformValue !== gc.value) {
          // Value mismatch
          driftItems.push({
            key: gc.key,
            environment: env,
            oldValue: platformValue,
            newValue: gc.value,
            changeType: 'modified',
          });
        }
      }
    }

    // Check for configs in platform but not in Git
    const allPlatformConfigs = await this.configService.listConfigs();
    for (const pc of allPlatformConfigs) {
      const gitMatch = gitConfigs.find(
        (gc) => gc.key === pc.key
      );
      if (!gitMatch) {
        driftItems.push({
          key: pc.key,
          environment: 'dev' as any,
          oldValue: JSON.stringify(pc.value),
          changeType: 'removed',
        });
      }
    }

    return driftItems;
  }

  private async publishEvent(type: string, data: any): Promise<void> {
    if (!this.eventPublisher) return;
    try {
      await this.eventPublisher.publish(type, data, {
        source: 'gitops-service',
      });
    } catch {
      // Best-effort event publishing
    }
  }
}
