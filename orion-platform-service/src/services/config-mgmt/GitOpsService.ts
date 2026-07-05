/**
 * GitOpsService - GitOps Configuration Synchronization
 *
 * Manages synchronization between configuration items and a Git repository.
 * Supports drift detection, auto-sync, and sync status tracking.
 *
 * Persistence: PostgreSQL via GitOpsRepository
 */

import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from './ConfigService';
import { GitOpsRepository } from '../../repositories/GitOpsRepository';
import {
  GitOpsConfig,
  CreateGitOpsInput,
  SyncStatus,
  ConfigDiff,
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
  /** PostgreSQL repository for persistence (required) */
  repository: GitOpsRepository;
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
      throw new OrionError(`File not found: ${filePath}`, ErrorCode.NOT_FOUND);
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
  private repository: GitOpsRepository;

  constructor(config: GitOpsServiceConfig) {
    if (!config.repository) throw new OrionError('GitOpsRepository is required', ErrorCode.INTERNAL_ERROR);
    this.repository = config.repository;
    this.configService = config.configService;
    this.eventPublisher = config.eventPublisher || null;
    this.gitClient = config.gitClient || new MockGitClient();
    this.syncTimer = null;
    this.repoDir = '/tmp/orion-config-repo';
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

    await this.repository.createGitOpsConfig(gitOpsConfig);

    // Start sync timer
    await this.startSyncTimer();

    return { ...gitOpsConfig };
  }

  /**
   * Disable GitOps synchronization
   */
  async disableGitOps(gitOpsConfigId: string): Promise<GitOpsConfig> {
    const config = await this.repository.findById(gitOpsConfigId);

    if (!config) {
      throw new OrionError(`GitOps config '${gitOpsConfigId}' not found`, ErrorCode.NOT_FOUND);
    }

    await this.repository.update(gitOpsConfigId, { status: 'disabled' });

    // Stop sync timer if this was the only active config
    const allConfigs = await this.repository.findByStatus('enabled');

    const hasActive = allConfigs.some(
      (c) => c.status === 'enabled' || c.status === 'syncing'
    );
    if (!hasActive && this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    return { ...config, status: 'disabled' };
  }

  /**
   * Get GitOps configuration by ID
   */
  async getGitOpsConfig(gitOpsConfigId: string): Promise<GitOpsConfig | null> {
    const config = await this.repository.findById(gitOpsConfigId);
    return config ? { ...config } : null;
  }

  /**
   * List all GitOps configurations
   */
  async listGitOpsConfigs(): Promise<GitOpsConfig[]> {
    const configs = await this.repository.findAll();
    return configs.map((c) => ({ ...c }));
  }

  /**
   * Trigger a manual sync from Git repository
   */
  async syncFromGit(gitOpsConfigId?: string): Promise<SyncStatus> {
    let configs: GitOpsConfig[] = [];
    if (gitOpsConfigId) {
      const config = await this.repository.findById(gitOpsConfigId);
      configs = config ? [config] : [];
    } else {
      configs = await this.repository.findByStatus('enabled');
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

        await this.repository.update(gitConfig.id, { status: 'syncing' });

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
            await this.repository.update(gitConfig.id, { status: 'error', lastError: error.message });
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

        const lastSync = new Date();
        const newStatus = syncStatus.driftDetected
          ? 'drift_detected'
          : 'enabled';

        await this.repository.update(gitConfig.id, {
          lastSync,
          status: newStatus,
        });
      }

      syncStatus.completedAt = new Date();

      // Persist sync history
      await this.repository.createSyncStatus(syncStatus);

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

    if (gitOpsConfigId) {
      const config = await this.repository.findById(gitOpsConfigId);
      configs = config ? [config] : [];
    } else {
      const enabled = await this.repository.findByStatus('enabled');
      const driftDetected = await this.repository.findByStatus('drift_detected');
      configs = [...enabled, ...driftDetected];
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
    const gitOpsConfigId = options?.gitOpsConfigId;
    if (gitOpsConfigId) {
      return this.repository.findSyncHistory(
        gitOpsConfigId,
        options.limit || 20
      );
    }

    // No specific configId: get all configs and fetch their history
    const allConfigs = await this.repository.findAll();
    const allHistory: SyncStatus[] = [];
    for (const config of allConfigs) {
      const history = await this.repository.findSyncHistory(config.id, options?.limit || 20);
      allHistory.push(...history);
    }
    // Sort by startedAt descending
    allHistory.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    return allHistory.slice(0, options?.limit || 20);
  }

  /**
   * Get latest sync status
   */
  async getLatestSyncStatus(
    gitOpsConfigId?: string
  ): Promise<SyncStatus | null> {
    if (gitOpsConfigId) {
      return this.repository.findLatestSyncStatus(gitOpsConfigId);
    }

    // No specific configId: find the latest across all configs
    const allConfigs = await this.repository.findAll();
    let latest: SyncStatus | null = null;
    for (const config of allConfigs) {
      const status = await this.repository.findLatestSyncStatus(config.id);
      if (status && (!latest || status.startedAt > latest.startedAt)) {
        latest = status;
      }
    }
    return latest;
  }

  // ==================== Internal Methods ====================

  private async startSyncTimer(): Promise<void> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    const configs = await this.repository.findByStatus('enabled');
    const minInterval = Math.min(
      ...configs.map((c) => c.syncInterval * 1000)
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
