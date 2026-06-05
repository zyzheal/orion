/**
 * SCMWebhookService - Source Control Management Webhook Receiver
 *
 * Handles GitHub push events and GitLab push events.
 * Parses webhook payloads, extracts repo, branch, commit.
 * Matches against pipeline trigger rules and triggers matching pipelines.
 * Validates webhook signatures (GitHub HMAC, GitLab secret token).
 */

import crypto from 'crypto';
import pino from 'pino';
import { PipelineEngine } from '../../engine/PipelineEngine';
import { TriggerType } from '../../models/PipelineRun';
import { OrionError, ErrorCode } from '../../errors';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Parsed SCM webhook event
 */
export interface SCMWebhookEvent {
  id: string;
  provider: 'github' | 'gitlab';
  eventType: string; // 'push', 'pull_request', etc.
  repository: string;
  branch: string;
  commitSha: string;
  commitMessage: string;
  pusher: string;
  timestamp: Date;
  rawPayload: Record<string, any>;
  matchedPipelines: string[];
  /** Pull Request number (for pull_request events) */
  prNumber?: number;
  /** Source branch (head of PR) */
  sourceBranch?: string;
  /** Target branch (base of PR) */
  targetBranch?: string;
}

/**
 * Pipeline trigger rule matching SCM webhooks
 */
export interface SCMTriggerRule {
  pipelineId: string;
  repository: string; // Exact match or glob pattern
  branchPattern: string; // e.g., 'main', 'refs/heads/*', '*'
  events: string[]; // e.g., ['push', 'pull_request']
}

export class SCMWebhookService {
  private pipelineEngine: PipelineEngine | null;
  private triggerRules: SCMTriggerRule[] = [];
  private events: SCMWebhookEvent[] = [];
  private secretToken: string;
  /** PR event debounce map: key -> timeout */
  private prDebounceMap = new Map<string, NodeJS.Timeout>();

  constructor(pipelineEngine?: PipelineEngine | null) {
    this.pipelineEngine = pipelineEngine || null;
    this.secretToken = process.env.SCM_WEBHOOK_SECRET || '';
  }

  /**
   * Configure trigger rules for SCM webhook matching.
   */
  setTriggerRules(rules: SCMTriggerRule[]): void {
    this.triggerRules = rules;
    logger.info({ ruleCount: rules.length }, 'SCM webhook trigger rules configured');
  }

  /**
   * Add a single trigger rule.
   */
  addTriggerRule(rule: SCMTriggerRule): void {
    this.triggerRules.push(rule);
  }

  /**
   * Validate a GitHub webhook signature (HMAC SHA256).
   * GitHub sends: X-Hub-Signature-256: sha256=<hex>
   */
  validateGitHubSignature(payload: string, signature: string): boolean {
    if (!this.secretToken) {
      logger.warn({ traceId: getCurrentTraceId() }, 'SCM_WEBHOOK_SECRET not set, skipping GitHub signature validation');
      return true; // Skip validation if no secret configured
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.secretToken)
      .update(payload)
      .digest('hex');

    const providedSignature = signature.replace('sha256=', '');

    // Use timing-safe comparison to prevent timing attacks
    // First check length to avoid timingSafeEqual errors on mismatched lengths
    if (providedSignature.length !== expectedSignature.length) {
      return false;
    }
    return crypto.timingSafeEqual(
      Buffer.from(providedSignature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Validate a GitLab webhook secret token.
   * GitLab sends: X-Gitlab-Token: <secret>
   */
  validateGitLabToken(token: string): boolean {
    if (!this.secretToken) {
      logger.warn({ traceId: getCurrentTraceId() }, 'SCM_WEBHOOK_SECRET not set, skipping GitLab token validation');
      return true;
    }

    return this.timingSafeCompare(token, this.secretToken);
  }

  /**
   * Timing-safe string comparison to prevent timing attacks.
   */
  private timingSafeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  /**
   * Handle a GitHub push event.
   */
  async handleGitHubPush(payload: any, signature?: string): Promise<SCMWebhookEvent> {
    // Validate signature if provided
    if (signature) {
      const rawPayload = JSON.stringify(payload);
      if (!this.validateGitHubSignature(rawPayload, signature)) {
        throw new OrionError('Invalid GitHub webhook signature', ErrorCode.VALIDATION_ERROR);
      }
    }

    const event: SCMWebhookEvent = {
      id: generateEventId(),
      provider: 'github',
      eventType: 'push',
      repository: payload.repository?.full_name || payload.repository?.name || 'unknown',
      branch: payload.ref?.replace('refs/heads/', '') || 'unknown',
      commitSha: payload.after || 'unknown',
      commitMessage: payload.head_commit?.message || '',
      pusher: payload.pusher?.name || payload.sender?.login || 'unknown',
      timestamp: new Date(),
      rawPayload: payload,
      matchedPipelines: [],
    };

    return this.processEvent(event);
  }

  /**
   * Handle a GitHub pull_request event.
   */
  async handleGitHubPullRequest(payload: any, signature?: string): Promise<SCMWebhookEvent> {
    // Validate signature if provided
    if (signature) {
      const rawPayload = JSON.stringify(payload);
      if (!this.validateGitHubSignature(rawPayload, signature)) {
        throw new OrionError('Invalid GitHub webhook signature', ErrorCode.VALIDATION_ERROR);
      }
    }

    const pr = payload.pull_request || {};
    const action = payload.action || '';

    // Check debounce for synchronize events (force pushes)
    if (action === 'synchronize') {
      const debounceKey = `gh-pr-${pr.base?.repo?.full_name}-${pr.number}`;
      if (this.prDebounceMap.has(debounceKey)) {
        const entry = this.prDebounceMap.get(debounceKey)!;
        clearTimeout(entry);
        logger.debug({ debounceKey }, 'PR synchronize event debounced');
      }
      this.prDebounceMap.set(debounceKey, setTimeout(() => {
        this.prDebounceMap.delete(debounceKey);
      }, 30000));
    }

    const event: SCMWebhookEvent = {
      id: generateEventId(),
      provider: 'github',
      eventType: 'pull_request',
      repository: pr.base?.repo?.full_name || 'unknown',
      branch: pr.base?.ref || 'unknown',
      commitSha: pr.head?.sha || 'unknown',
      commitMessage: pr.title || '',
      pusher: pr.user?.login || 'unknown',
      timestamp: new Date(),
      rawPayload: payload,
      matchedPipelines: [],
      prNumber: pr.number,
      sourceBranch: pr.head?.ref,
      targetBranch: pr.base?.ref,
    };

    return this.processEvent(event);
  }

  /**
   * Handle a GitLab push event.
   */
  async handleGitLabPush(payload: any, token?: string): Promise<SCMWebhookEvent> {
    // Validate token if provided
    if (token) {
      if (!this.validateGitLabToken(token)) {
        throw new OrionError('Invalid GitLab webhook token', ErrorCode.VALIDATION_ERROR);
      }
    }

    const event: SCMWebhookEvent = {
      id: generateEventId(),
      provider: 'gitlab',
      eventType: 'push',
      repository: payload.project?.path_with_namespace || payload.project?.name || 'unknown',
      branch: payload.ref?.replace('refs/heads/', '') || 'unknown',
      commitSha: payload.after || payload.checkout_sha || 'unknown',
      commitMessage: payload.commits?.[0]?.message || '',
      pusher: payload.user_name || payload.user_username || 'unknown',
      timestamp: new Date(),
      rawPayload: payload,
      matchedPipelines: [],
    };

    return this.processEvent(event);
  }

  /**
   * Handle a GitLab merge_request event.
   */
  async handleGitLabMergeRequest(payload: any, token?: string): Promise<SCMWebhookEvent> {
    // Validate token if provided
    if (token) {
      if (!this.validateGitLabToken(token)) {
        throw new OrionError('Invalid GitLab webhook token', ErrorCode.VALIDATION_ERROR);
      }
    }

    const attrs = payload.object_attributes || {};
    const action = attrs.action || attrs.state || '';

    // Check debounce
    if (action === 'update') {
      const debounceKey = `gl-mr-${attrs.target_project_id}-${attrs.iid}`;
      if (this.prDebounceMap.has(debounceKey)) {
        const entry = this.prDebounceMap.get(debounceKey)!;
        clearTimeout(entry);
        logger.debug({ debounceKey }, 'MR update event debounced');
      }
      this.prDebounceMap.set(debounceKey, setTimeout(() => {
        this.prDebounceMap.delete(debounceKey);
      }, 30000));
    }

    const event: SCMWebhookEvent = {
      id: generateEventId(),
      provider: 'gitlab',
      eventType: 'pull_request',
      repository: payload.project?.path_with_namespace || 'unknown',
      branch: attrs.target_branch || 'unknown',
      commitSha: attrs.last_commit?.id || 'unknown',
      commitMessage: attrs.title || '',
      pusher: payload.user?.username || 'unknown',
      timestamp: new Date(),
      rawPayload: payload,
      matchedPipelines: [],
      prNumber: attrs.iid,
      sourceBranch: attrs.source_branch,
      targetBranch: attrs.target_branch,
    };

    return this.processEvent(event);
  }

  /**
   * Process an SCM event and trigger matching pipelines.
   */
  private async processEvent(event: SCMWebhookEvent): Promise<SCMWebhookEvent> {
    logger.info(
      { provider: event.provider, repository: event.repository, branch: event.branch },
      'Processing SCM webhook event'
    );

    // Store event
    this.events.unshift(event);
    // Keep only last 100 events
    if (this.events.length > 100) {
      this.events = this.events.slice(0, 100);
    }

    // Find matching pipelines
    const matchedPipelines = this.matchPipelines(event);
    event.matchedPipelines = matchedPipelines;

    if (matchedPipelines.length === 0) {
      logger.info({ eventId: event.id }, 'No pipelines matched SCM webhook event');
      return event;
    }

    logger.info(
      { eventId: event.id, matchedPipelines },
      `Triggering ${matchedPipelines.length} pipeline(s) from SCM webhook`
    );

    // Trigger matched pipelines
    for (const pipelineId of matchedPipelines) {
      try {
        if (!this.pipelineEngine) {
          logger.warn({ traceId: getCurrentTraceId(), pipelineId }, 'Pipeline engine not available, skipping trigger');
          continue;
        }

        // Build git context for SCM write-back
        const gitContext: Record<string, unknown> = {
          git: {
            ref: event.branch,
            sha: event.commitSha,
            repo: event.repository,
          },
          scmProvider: event.provider,
          repository: event.repository,
          branch: event.branch,
          commitSha: event.commitSha,
          commitMessage: event.commitMessage,
          webhookEventId: event.id,
        };

        // Add PR context if this is a pull_request event
        if (event.eventType === 'pull_request' && event.prNumber) {
          gitContext.prNumber = event.prNumber;
          gitContext.sourceBranch = event.sourceBranch;
          gitContext.targetBranch = event.targetBranch;
          (gitContext as any).pullRequest = {
            number: event.prNumber,
            sourceBranch: event.sourceBranch,
            targetBranch: event.targetBranch,
          };
        }

        await this.pipelineEngine.execute(
          pipelineId,
          TriggerType.EVENT,
          event.pusher,
          gitContext
        );

        logger.info({ pipelineId, eventId: event.id }, 'Pipeline triggered from SCM webhook');
      } catch (error: any) {
        logger.error(
          { pipelineId, eventId: event.id, error: error.message },
          'Failed to trigger pipeline from SCM webhook'
        );
      }
    }

    return event;
  }

  /**
   * Match an SCM event against configured trigger rules.
   */
  private matchPipelines(event: SCMWebhookEvent): string[] {
    const matched = new Set<string>();

    for (const rule of this.triggerRules) {
      // Check event type
      if (!rule.events.includes(event.eventType)) {
        continue;
      }

      // Check repository match
      if (!this.matchRepository(rule.repository, event.repository)) {
        continue;
      }

      // Check branch match
      if (!this.matchBranch(rule.branchPattern, event.branch)) {
        continue;
      }

      matched.add(rule.pipelineId);
    }

    return Array.from(matched);
  }

  /**
   * Match repository name against rule (supports simple glob patterns).
   */
  private matchRepository(pattern: string, actual: string): boolean {
    if (pattern === '*') return true;
    if (pattern === actual) return true;

    // Simple glob matching: convert * to regex
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*/g, '.*'); // Convert * to .*

    return new RegExp(`^${regexPattern}$`).test(actual);
  }

  /**
   * Match branch name against rule pattern.
   */
  private matchBranch(pattern: string, actual: string): boolean {
    if (pattern === '*') return true;
    if (pattern === actual) return true;

    // Handle refs/heads/* pattern
    if (pattern.startsWith('refs/heads/')) {
      const branchPattern = pattern.replace('refs/heads/', '');
      if (branchPattern === '*') return true;
      if (branchPattern === actual) return true;
    }

    // Simple glob matching
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');

    return new RegExp(`^${regexPattern}$`).test(actual);
  }

  /**
   * Get stored webhook events.
   */
  getEvents(limit: number = 20): SCMWebhookEvent[] {
    return this.events.slice(0, limit);
  }

  /**
   * Get a webhook event by ID.
   */
  getEventById(id: string): SCMWebhookEvent | undefined {
    return this.events.find(e => e.id === id);
  }
}

/**
 * Generate a unique event ID.
 */
function generateEventId(): string {
  return `scm-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}
