/**
 * DeployGitIntegrationService - Git Integration for Deploy Operations
 *
 * Provides release notes generation, Git commit linking, and deployment changelog
 * from Git history. Uses simple-git for repository operations.
 *
 * TASK-5.9: Deploy Release Notes Git Integration
 *
 * Key responsibilities:
 * - generateReleaseNotes(deploymentId): Auto-generate release notes from Git commits
 * - linkGitCommit(deploymentId, commitSha): Link a Git commit to a deployment
 * - getDeploymentChangelog(deploymentId): Get structured changelog for a deployment
 */

import simpleGit, { SimpleGit } from 'simple-git';
import * as fs from 'fs/promises';
import { createLogger } from '../../utils/logger';
import {
  DeployRepository,
  Deployment,
} from './DeployRepository';
import { DeployGitCommitLinkRepository, DeployGitCommitLinkEntity } from '../../repositories/DeployGitCommitLinkRepository';
import { ReleaseNotesRepository } from '../../repositories/ReleaseNotesRepository';

const logger = createLogger('deploy-git-integration');

// ==================== Types ====================

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  email: string;
  date: string;
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

export interface ChangeEntry {
  type: 'feature' | 'fix' | 'improvement' | 'breaking' | 'config' | 'docs' | 'refactor' | 'test' | 'chore';
  description: string;
  commit: string;
  author: string;
  issueId?: string;
  prNumber?: string;
  prUrl?: string;
}

export interface ReleaseNotes {
  id: string;
  deploymentId: string;
  tenantId: string;
  version: string;
  environment: string;
  generatedAt: Date;
  summary: string;
  changes: ChangeEntry[];
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

export interface DeploymentChangelog {
  deploymentId: string;
  commitSha: string;
  commits: GitCommit[];
  changes: ChangeEntry[];
  totalCommits: number;
  generatedAt: Date;
}

export interface GenerateReleaseNotesOptions {
  fromCommit?: string;
  toCommit?: string;
  repoPath?: string;
}

export interface LinkGitCommitOptions {
  commitMessage?: string;
  commitAuthor?: string;
  commitEmail?: string;
  committedAt?: Date;
  branch?: string;
  prNumber?: string;
  prUrl?: string;
}

// ==================== Error Class ====================

export class DeployGitIntegrationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'DeployGitIntegrationError';
  }
}

// ==================== Service ====================

export class DeployGitIntegrationService {
  private deployRepository: DeployRepository;
  private gitCommitLinkRepository: DeployGitCommitLinkRepository;
  private releaseNotesRepository: ReleaseNotesRepository;
  private counter = 0;

  constructor(
    deployRepository: DeployRepository,
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }
  ) {
    this.deployRepository = deployRepository;
    this.gitCommitLinkRepository = new DeployGitCommitLinkRepository(db);
    this.releaseNotesRepository = new ReleaseNotesRepository(db);
  }

  // ==================== Generate Release Notes ====================

  /**
   * Generate release notes from Git history for a deployment.
   * Looks up the deployment's commit_sha and fetches Git log to generate structured notes.
   */
  async generateReleaseNotes(
    deploymentId: string,
    tenantId: string,
    options: GenerateReleaseNotesOptions = {}
  ): Promise<ReleaseNotes> {
    if (!deploymentId || !tenantId) {
      throw new DeployGitIntegrationError(
        'deploymentId and tenantId are required',
        'INVALID_INPUT'
      );
    }

    // Get deployment info
    const deployment = await this.deployRepository.findById(deploymentId);
    if (!deployment) {
      throw new DeployGitIntegrationError(`Deployment not found: ${deploymentId}`, 'DEPLOY_NOT_FOUND');
    }

    // Verify tenant isolation
    if (deployment.tenant_id !== tenantId) {
      throw new DeployGitIntegrationError(
        'Deployment does not belong to tenant',
        'TENANT_MISMATCH'
      );
    }

    const repoPath = options.repoPath || process.cwd();
    const toCommit = options.toCommit || deployment.commit_sha || undefined;
    const fromCommit = options.fromCommit;

    if (!toCommit) {
      throw new DeployGitIntegrationError(
        'No commit SHA available for deployment; cannot generate release notes',
        'NO_COMMIT_SHA'
      );
    }

    // Fetch commits from Git
    const commits = await this.getCommitsFromRepo(repoPath, fromCommit, toCommit);
    logger.info({ deploymentId, commitCount: commits.length }, 'Fetched commits for release notes');

    // Parse and convert to change entries
    const parsedCommits = commits.map(c => this.parseConventionalCommit(c));
    const enrichedCommits = parsedCommits.map(c => this.enrichWithPRInfo(c));
    const changes = this.convertToChanges(enrichedCommits);

    // Generate summary and metrics
    const summary = this.generateSummary(changes);
    const metrics = this.calculateMetrics(changes, commits.length);

    // Persist release notes
    const id = this.generateId('release-notes');
    const entity = await this.releaseNotesRepository.create({
      id,
      deploymentId,
      tenantId,
      version: '1.0.0',
      environment: deployment.environment,
      generatedAt: new Date(),
      summary,
      changes,
      metrics,
      notes: null,
      content: null,
      generatedBy: 'git',
      status: 'published',
    });

    return this.entityToReleaseNotes(entity);
  }

  // ==================== Link Git Commit ====================

  /**
   * Link a Git commit to a deployment.
   * Creates or updates the deploy_git_commit_links record.
   */
  async linkGitCommit(
    deploymentId: string,
    tenantId: string,
    commitSha: string,
    options: LinkGitCommitOptions = {}
  ): Promise<DeployGitCommitLinkEntity> {
    if (!deploymentId || !tenantId || !commitSha) {
      throw new DeployGitIntegrationError(
        'deploymentId, tenantId, and commitSha are required',
        'INVALID_INPUT'
      );
    }

    // Validate SHA format (40-char hex)
    if (!/^[0-9a-f]{7,40}$/i.test(commitSha)) {
      throw new DeployGitIntegrationError(
        'Invalid commit SHA format',
        'INVALID_COMMIT_SHA'
      );
    }

    // Verify deployment exists and belongs to tenant
    const deployment = await this.deployRepository.findById(deploymentId);
    if (!deployment) {
      throw new DeployGitIntegrationError(`Deployment not found: ${deploymentId}`, 'DEPLOY_NOT_FOUND');
    }

    if (deployment.tenant_id !== tenantId) {
      throw new DeployGitIntegrationError(
        'Deployment does not belong to tenant',
        'TENANT_MISMATCH'
      );
    }

    // Optionally enrich with Git metadata
    let enrichedOptions = { ...options };
    if (!options.commitMessage) {
      try {
        const git = simpleGit(process.cwd());
        const log = await git.log({ maxCount: 1, from: commitSha });
        if (log.latest) {
          enrichedOptions.commitMessage = log.latest.message;
          enrichedOptions.commitAuthor = log.latest.author_name;
          enrichedOptions.commitEmail = log.latest.author_email;
          enrichedOptions.committedAt = new Date(log.latest.date);
        }
      } catch (err) {
        logger.warn({ commitSha, err }, 'Failed to enrich commit info from git');
      }
    }

    // Persist link
    const link = await this.gitCommitLinkRepository.upsertByDeploymentId({
      deploymentId,
      tenantId,
      commitSha,
      commitMessage: enrichedOptions.commitMessage,
      commitAuthor: enrichedOptions.commitAuthor,
      commitEmail: enrichedOptions.commitEmail,
      committedAt: enrichedOptions.committedAt,
      branch: enrichedOptions.branch,
      prNumber: enrichedOptions.prNumber,
      prUrl: enrichedOptions.prUrl,
    });

    // Update deployment commit_sha
    await this.deployRepository.update(deploymentId, { commit_sha: commitSha });

    logger.info({ deploymentId, commitSha }, 'Linked Git commit to deployment');
    return link;
  }

  // ==================== Get Deployment Changelog ====================

  /**
   * Get a structured changelog for a deployment by fetching Git history.
   */
  async getDeploymentChangelog(deploymentId: string, tenantId: string, repoPath?: string): Promise<DeploymentChangelog> {
    if (!deploymentId || !tenantId) {
      throw new DeployGitIntegrationError(
        'deploymentId and tenantId are required',
        'INVALID_INPUT'
      );
    }

    // Get deployment
    const deployment = await this.deployRepository.findById(deploymentId);
    if (!deployment) {
      throw new DeployGitIntegrationError(`Deployment not found: ${deploymentId}`, 'DEPLOY_NOT_FOUND');
    }

    if (deployment.tenant_id !== tenantId) {
      throw new DeployGitIntegrationError(
        'Deployment does not belong to tenant',
        'TENANT_MISMATCH'
      );
    }

    const commitSha = deployment.commit_sha;
    if (!commitSha) {
      throw new DeployGitIntegrationError(
        'Deployment has no associated commit SHA',
        'NO_COMMIT_SHA'
      );
    }

    // Get Git commit link for context
    const link = await this.gitCommitLinkRepository.findByDeploymentId(deploymentId);

    // Fetch commits
    const effectiveRepoPath = repoPath || process.cwd();
    const commits = await this.getCommitsFromRepo(effectiveRepoPath, undefined, commitSha);

    // Parse commits to change entries
    const parsedCommits = commits.map(c => this.parseConventionalCommit(c));
    const enrichedCommits = parsedCommits.map(c => this.enrichWithPRInfo(c));
    const changes = this.convertToChanges(enrichedCommits);

    return {
      deploymentId,
      commitSha,
      commits,
      changes,
      totalCommits: commits.length,
      generatedAt: new Date(),
    };
  }

  // ==================== Get Commit Link ====================

  /**
   * Get the Git commit link for a deployment
   */
  async getCommitLink(deploymentId: string, tenantId: string): Promise<DeployGitCommitLinkEntity | null> {
    const link = await this.gitCommitLinkRepository.findByDeploymentId(deploymentId);
    if (!link) return null;

    // Verify tenant isolation
    if (link.tenantId !== tenantId) {
      return null;
    }

    return link;
  }

  // ==================== Git Operations ====================

  /**
   * Fetch commits from a Git repository
   */
  private async getCommitsFromRepo(repoPath: string, from?: string, to?: string): Promise<GitCommit[]> {
    try {
      await fs.access(repoPath);
    } catch {
      throw new DeployGitIntegrationError(
        `Git repository not found at: ${repoPath}`,
        'REPO_NOT_FOUND'
      );
    }

    const git = simpleGit(repoPath);

    try {
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        throw new DeployGitIntegrationError(
          `Not a git repository: ${repoPath}`,
          'NOT_A_REPO'
        );
      }
    } catch (error: any) {
      if (error instanceof DeployGitIntegrationError) throw error;
      throw new DeployGitIntegrationError(
        `Git validation failed: ${error.message}`,
        'GIT_VALIDATION_FAILED'
      );
    }

    try {
      const log = await git.log({
        from: to || undefined,
        to: from || undefined,
        maxCount: 100,
        symmetric: !from && !to,
      });

      // Try fetching remote for PR/MR info (non-fatal if fails)
      try {
        await git.fetch();
      } catch {
        logger.warn('Failed to fetch from remote, using local commits only');
      }

      return log.all.map(commit => ({
        hash: commit.hash,
        message: commit.message,
        author: commit.author_name,
        email: commit.author_email || '',
        date: commit.date,
      }));
    } catch (error: any) {
      logger.error({ error, repoPath }, 'Failed to get git log');
      throw new DeployGitIntegrationError(
        `Failed to get git log: ${error.message}`,
        'GIT_LOG_FAILED'
      );
    }
  }

  // ==================== Commit Parsing ====================

  /**
   * Parse Conventional Commits format: <type>(<scope>)?: <description> [BREAKING CHANGE]
   */
  private parseConventionalCommit(commit: GitCommit): ConventionalCommit {
    const message = commit.message.trim();
    const breaking = message.includes('BREAKING CHANGE') || message.startsWith('BREAKING CHANGE:');

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
    const patterns = [
      /\(#(\d+)\)$/,
      /\[#(\d+)\]$/,
      /Merge pull request #(\d+)/i,
      /\((\d+)\)$/,
    ];

    let prNumber: string | undefined;
    let prUrl: string | undefined;

    for (const pattern of patterns) {
      const match = commit.description.match(pattern);
      if (match) {
        prNumber = match[1];
        prUrl = `https://github.com/orionhq/orion-platform/pull/${prNumber}`;
        break;
      }
    }

    return { ...commit, prNumber, prUrl };
  }

  /**
   * Convert conventional commits to change entries
   */
  private convertToChanges(commits: ConventionalCommit[]): ChangeEntry[] {
    const typeMapping: Record<string, ChangeEntry['type']> = {
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
      .filter(c => !c.description.startsWith('Merge') && c.description.length > 0)
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
        } as ChangeEntry;
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

  private generateSummary(changes: ChangeEntry[]): string {
    const featureCount = changes.filter(c => c.type === 'feature').length;
    const fixCount = changes.filter(c => c.type === 'fix').length;
    const breakingCount = changes.filter(c => c.type === 'breaking').length;

    const parts: string[] = [];
    if (featureCount > 0) parts.push(`${featureCount} feature${featureCount > 1 ? 's' : ''}`);
    if (fixCount > 0) parts.push(`${fixCount} fix${fixCount > 1 ? 'es' : ''}`);
    if (breakingCount > 0) parts.push(`${breakingCount} breaking change${breakingCount > 1 ? 's' : ''}`);

    if (parts.length === 0) return 'No significant changes';

    return `This release includes ${parts.join(', ')}`;
  }

  private calculateMetrics(changes: ChangeEntry[], totalCommits: number) {
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

  private entityToReleaseNotes(entity: any): ReleaseNotes {
    return {
      id: entity.id,
      deploymentId: entity.deploymentId ?? '',
      tenantId: entity.tenantId ?? '',
      version: entity.version ?? '1.0.0',
      environment: entity.environment ?? 'unknown',
      generatedAt: entity.generatedAt,
      summary: entity.summary ?? '',
      changes: (entity.changes ?? []) as ChangeEntry[],
      metrics: (entity.metrics as ReleaseNotes['metrics']) ?? {
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
