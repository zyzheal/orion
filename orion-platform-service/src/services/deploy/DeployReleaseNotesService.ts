/**
 * DeployReleaseNotesService - Git-based Release Notes Generation
 *
 * Generates release notes from Git commit history.
 * Supports Conventional Commits format parsing and PR/MR correlation.
 *
 * TASK-5.9: Deploy Release Notes Git Integration
 */

import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import { ReleaseNotesRepository, ReleaseNotesEntity } from '../../repositories/ReleaseNotesRepository';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ name: 'DeployReleaseNotes' });

// ==================== Types ====================

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  email: string;
  date: string;
  tags?: string[];
}

export interface ConventionalCommit {
  type: string;
  scope?: string;
  breaking: boolean;
  description: string;
  body?: string;
  footer?: string;
  hash: string;
  author: string;
  date: string;
  prNumber?: string;
  prUrl?: string;
}

export interface ReleaseNotesChange extends Record<string, unknown> {
  type: 'feature' | 'fix' | 'improvement' | 'breaking' | 'config' | 'docs' | 'refactor' | 'test' | 'chore';
  description: string;
  commit: string;
  author: string;
  issueId?: string;
  prNumber?: string;
  prUrl?: string;
}

export interface DeployReleaseNotes {
  id: string;
  deploymentId: string;
  tenantId: string;
  version: string;
  environment: string;
  generatedAt: Date;
  summary: string;
  changes: ReleaseNotesChange[];
  metrics: {
    totalCommits: number;
    totalChanges: number;
    breakingChanges: number;
    features: number;
    fixes: number;
    improvements: number;
  };
  notes?: string;
  updatedAt?: Date;
}

export interface GenerateReleaseNotesOptions {
  deploymentId: string;
  tenantId: string;
  version: string;
  environment: string;
  fromCommit?: string;
  toCommit?: string;
  repoPath?: string;
  generatedBy?: string;
}

// ==================== Service ====================

export class DeployReleaseNotesService {
  private repository: ReleaseNotesRepository;
  private counter = 0;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.repository = new ReleaseNotesRepository(db);
  }

  // ==================== Public API ====================

  /**
   * Generate release notes from Git history for a deployment
   */
  async generateFromGit(options: GenerateReleaseNotesOptions): Promise<DeployReleaseNotes> {
    const {
      deploymentId,
      tenantId,
      version,
      environment,
      fromCommit,
      toCommit,
      repoPath = process.cwd(),
      generatedBy = 'system',
    } = options;

    if (!deploymentId || !tenantId || !version) {
      throw new DeployReleaseNotesServiceError(
        'deploymentId, tenantId, and version are required',
        'INVALID_INPUT'
      );
    }

    try {
      // Ensure repoPath exists
      try {
        await fs.access(repoPath);
      } catch {
        throw new DeployReleaseNotesServiceError(
          `Git repository not found at: ${repoPath}`,
          'REPO_NOT_FOUND'
        );
      }

      const git = simpleGit(repoPath);

      // Verify it's a git repo
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        throw new DeployReleaseNotesServiceError(
          `Not a git repository: ${repoPath}`,
          'NOT_A_REPO'
        );
      }

      // Get commits
      const commits = await this.getCommits(git, fromCommit, toCommit);
      logger.info({ commitCount: commits.length, from: fromCommit, to: toCommit }, 'Fetched commits');

      // Parse conventional commits
      const parsedCommits = commits.map(c => this.parseConventionalCommit(c));

      // Correlate PR/MR info from commit messages
      const enrichedCommits = parsedCommits.map(c => this.enrichWithPRInfo(c));

      // Convert to change entries
      const changes = this.convertToChanges(enrichedCommits);

      // Generate summary
      const summary = this.generateSummary(changes);

      // Calculate metrics
      const metrics = this.calculateMetrics(changes, commits.length);

      // Save to database
      const id = this.generateId('release-notes');
      const entity = await this.repository.create({
        id,
        deploymentId,
        tenantId,
        version,
        environment,
        generatedAt: new Date(),
        summary,
        changes,
        metrics,
        notes: null,
        content: null,
        generatedBy: generatedBy === 'git' ? 'git' : 'system',
        status: 'published',
      });

      return this.entityToReleaseNotes(entity);
    } catch (error: any) {
      if (error instanceof DeployReleaseNotesServiceError) {
        throw error;
      }
      logger.error({ error, deploymentId, repoPath }, 'Failed to generate release notes from Git');
      throw new DeployReleaseNotesServiceError(
        `Failed to generate release notes: ${error.message}`,
        'GENERATION_FAILED'
      );
    }
  }

  /**
   * Get release notes for a deployment
   */
  async getReleaseNotes(deploymentId: string): Promise<DeployReleaseNotes | null> {
    const entity = await this.repository.findByDeploymentId(deploymentId);
    return entity ? this.entityToReleaseNotes(entity) : null;
  }

  /**
   * Get all release notes for a tenant
   */
  async getReleaseNotesByTenant(tenantId: string, limit = 50): Promise<DeployReleaseNotes[]> {
    const entities = await this.repository.findByTenantId(tenantId, limit);
    return entities.map(entity => this.entityToReleaseNotes(entity));
  }

  /**
   * Get release notes by version
   */
  async getReleaseNotesByVersion(version: string): Promise<DeployReleaseNotes | null> {
    const entity = await this.repository.findByVersion(version);
    return entity ? this.entityToReleaseNotes(entity) : null;
  }

  /**
   * Update release notes (e.g., add manual notes)
   */
  async updateReleaseNotes(deploymentId: string, updates: Partial<DeployReleaseNotes>): Promise<DeployReleaseNotes> {
    const entity = await this.repository.upsertByDeploymentId(deploymentId, {
      summary: updates.summary,
      changes: updates.changes as any,
      metrics: updates.metrics as any,
      notes: updates.notes ?? null,
      content: updates.notes ?? null,
    });

    return this.entityToReleaseNotes(entity);
  }

  /**
   * Delete release notes for a deployment
   */
  async deleteReleaseNotes(deploymentId: string): Promise<void> {
    await this.repository.deleteByDeploymentId(deploymentId);
  }

  // ==================== Git Operations ====================

  /**
   * Get commits between two refs
   */
  private async getCommits(git: SimpleGit, from?: string, to?: string): Promise<GitCommit[]> {
    try {
      const log = await git.log({
        from: to || undefined,
        to: from || undefined,
        maxCount: 100,
        symmetric: !from && !to,
      });

      // Also fetch from remote to get latest PR/MR info
      try {
        await git.fetch();
      } catch (fetchError) {
        logger.warn({ fetchError }, 'Failed to fetch from remote, using local commits only');
      }

      return log.all.map(commit => ({
        hash: commit.hash,
        message: commit.message,
        author: commit.author_name,
        email: commit.author_email || '',
        date: commit.date,
      }));
    } catch (error: any) {
      logger.error({ error }, 'Failed to get git log');
      throw new DeployReleaseNotesServiceError(
        `Failed to get git log: ${error.message}`,
        'GIT_LOG_FAILED'
      );
    }
  }

  /**
   * Parse Conventional Commits format
   * Format: <type>(<scope>)?: <description> [BREAKING CHANGE]
   */
  private parseConventionalCommit(commit: GitCommit): ConventionalCommit {
    const message = commit.message.trim();
    const breaking = message.includes('BREAKING CHANGE') || message.startsWith('BREAKING CHANGE:');

    // Match conventional commit pattern
    const conventionalMatch = message.match(/^(\w+)(\(([^)]+)\))?(!)?:\s*(.+)$/m);

    if (conventionalMatch) {
      const [, type, , scope, , description] = conventionalMatch;
      return {
        type,
        scope,
        breaking,
        description: description.trim(),
        body: this.extractBody(message),
        footer: this.extractFooter(message),
        hash: commit.hash,
        author: commit.author,
        date: commit.date,
      };
    }

    // Non-conventional commit - treat as chore
    return {
      type: 'chore',
      breaking,
      description: message.split('\n')[0].trim(),
      body: this.extractBody(message),
      footer: this.extractFooter(message),
      hash: commit.hash,
      author: commit.author,
      date: commit.date,
    };
  }

  /**
   * Enrich commits with PR/MR information from commit message
   */
  private enrichWithPRInfo(commit: ConventionalCommit): ConventionalCommit {
    // Extract PR/MR number from various patterns
    const patterns = [
      /\(#(\d+)\)$/,                    // (#123)
      /\[#(\d+)\]$/,                    // [#123]
      /Merge pull request #(\d+)/i,     // Merge pull request #123
      /Merge branch '.*' into .*/,      // Merge branch (no PR)
      /\((\d+)\)$/,                     // (123)
    ];

    let prNumber: string | undefined;
    let prUrl: string | undefined;

    for (const pattern of patterns) {
      const match = commit.message.match(pattern) || commit.description.match(pattern);
      if (match) {
        prNumber = match[1];
        // Assume GitHub-style PR URL (can be configured per repo)
        prUrl = `https://github.com/orionhq/orion-platform/pull/${prNumber}`;
        break;
      }
    }

    return {
      ...commit,
      prNumber,
      prUrl,
    };
  }

  /**
   * Convert conventional commits to change entries
   */
  private convertToChanges(commits: ConventionalCommit[]): ReleaseNotesChange[] {
    const typeMapping: Record<string, ReleaseNotesChange['type']> = {
      'feat': 'feature',
      'fix': 'fix',
      'improvement': 'improvement',
      'refactor': 'improvement',
      'perf': 'improvement',
      'breaking': 'breaking',
      'feat!': 'breaking',
      'fix!': 'breaking',
      'config': 'config',
      'docs': 'docs',
      'test': 'test',
      'chore': 'chore',
      'build': 'chore',
      'ci': 'chore',
      'style': 'chore',
      'revert': 'fix',
    };

    return commits
      .filter(c => {
        // Filter out merge commits and empty messages
        return !c.message.startsWith('Merge') && c.description.length > 0;
      })
      .map(commit => {
        const mappedType = typeMapping[commit.type] || 'chore';
        return {
          type: mappedType,
          description: commit.scope
            ? `${commit.type}(${commit.scope}): ${commit.description}`
            : `${commit.type}: ${commit.description}`,
          commit: commit.hash,
          author: commit.author,
          issueId: commit.prNumber,
          prNumber: commit.prNumber,
          prUrl: commit.prUrl,
        } as ReleaseNotesChange;
      });
  }

  // ==================== Helpers ====================

  private extractBody(message: string): string | undefined {
    const parts = message.split('\n\n');
    return parts.length > 1 ? parts.slice(1).join('\n\n').trim() : undefined;
  }

  private extractFooter(message: string): string | undefined {
    const lines = message.split('\n');
    const bodyStart = lines.findIndex(l => l.trim() === '');
    if (bodyStart === -1) return undefined;

    const afterBody = lines.slice(bodyStart + 1).filter(l => l.trim());
    if (afterBody.length === 0) return undefined;

    return afterBody.join('\n').trim();
  }

  private generateSummary(changes: ReleaseNotesChange[]): string {
    const featureCount = changes.filter(c => c.type === 'feature').length;
    const fixCount = changes.filter(c => c.type === 'fix').length;
    const breakingCount = changes.filter(c => c.type === 'breaking').length;

    const parts: string[] = [];
    if (featureCount > 0) parts.push(`${featureCount} feature${featureCount > 1 ? 's' : ''}`);
    if (fixCount > 0) parts.push(`${fixCount} fix${fixCount > 1 ? 'es' : ''}`);
    if (breakingCount > 0) parts.push(`${breakingCount} breaking change${breakingCount > 1 ? 's' : ''}`);

    if (parts.length === 0) {
      return 'No significant changes';
    }

    return `This release includes ${parts.join(', ')}`;
  }

  private calculateMetrics(changes: ReleaseNotesChange[], totalCommits: number) {
    return {
      totalCommits,
      totalChanges: changes.length,
      breakingChanges: changes.filter(c => c.type === 'breaking').length,
      features: changes.filter(c => c.type === 'feature').length,
      fixes: changes.filter(c => c.type === 'fix').length,
      improvements: changes.filter(c => c.type === 'improvement').length,
    };
  }

  private generateId(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${Date.now()}-${this.counter}`;
  }

  private entityToReleaseNotes(entity: ReleaseNotesEntity): DeployReleaseNotes {
    return {
      id: entity.id,
      deploymentId: entity.deploymentId ?? '',
      tenantId: entity.tenantId ?? '',
      version: entity.version ?? '1.0.0',
      environment: entity.environment ?? 'unknown',
      generatedAt: entity.generatedAt,
      summary: entity.summary ?? '',
      changes: (entity.changes ?? []) as ReleaseNotesChange[],
      metrics: (entity.metrics as DeployReleaseNotes['metrics']) ?? {
        totalCommits: 0,
        totalChanges: 0,
        breakingChanges: 0,
        features: 0,
        fixes: 0,
        improvements: 0,
      },
      notes: entity.notes ?? undefined,
      updatedAt: entity.updatedAt,
    };
  }
}

// ==================== Error Class ====================

export class DeployReleaseNotesServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'DeployReleaseNotesServiceError';
  }
}

export default DeployReleaseNotesService;
