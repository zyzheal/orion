/**
 * ScmWebhookEventRepository - Optional PostgreSQL persistence for SCM webhook events.
 *
 * Webhook events are naturally ephemeral (time-bound, kept last 100 in memory).
 * This repository provides a persistence layer for audit/debugging scenarios.
 * The service layer does NOT use this by default — events stay in memory.
 * It is available for future optional DB persistence.
 */

import { BaseRepository } from '../db/base-repository';

export interface ScmWebhookEventEntity {
  id: string;
  provider: 'github' | 'gitlab';
  eventType: string;
  repository: string;
  branch: string;
  commitSha: string;
  commitMessage: string;
  pusher: string;
  timestamp: Date;
  rawPayload: Record<string, unknown>;
  matchedPipelines: string[];
  prNumber?: number;
  sourceBranch?: string;
  targetBranch?: string;
  createdAt: Date;
}

export class ScmWebhookEventRepository extends BaseRepository<ScmWebhookEventEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'scm_webhook_events');
  }

  /**
   * Find recent events, ordered by timestamp descending.
   */
  async findRecent(limit: number = 50): Promise<ScmWebhookEventEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM scm_webhook_events ORDER BY timestamp DESC LIMIT $1`,
      [limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find events by provider.
   */
  async findByProvider(provider: 'github' | 'gitlab', limit: number = 50): Promise<ScmWebhookEventEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM scm_webhook_events WHERE provider = $1 ORDER BY timestamp DESC LIMIT $2`,
      [provider, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find events by event type.
   */
  async findByEventType(eventType: string, limit: number = 50): Promise<ScmWebhookEventEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM scm_webhook_events WHERE event_type = $1 ORDER BY timestamp DESC LIMIT $2`,
      [eventType, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): ScmWebhookEventEntity {
    return {
      id: row.id,
      provider: row.provider,
      eventType: row.event_type,
      repository: row.repository,
      branch: row.branch,
      commitSha: row.commit_sha,
      commitMessage: row.commit_message || '',
      pusher: row.pusher,
      timestamp: row.timestamp ? new Date(row.timestamp) : new Date(),
      rawPayload: row.raw_payload ?? {},
      matchedPipelines: row.matched_pipelines || [],
      prNumber: row.pr_number,
      sourceBranch: row.source_branch,
      targetBranch: row.target_branch,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}
