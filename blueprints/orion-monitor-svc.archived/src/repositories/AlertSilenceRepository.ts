/**
 * AlertSilenceRepository — PostgreSQL data access layer for alert silence rules.
 *
 * Handles CRUD + matchSilence() which finds active silences whose matchers
 * all match the given alert labels.
 */

import type { DatabasePool } from '../services/database/index.js';

export interface AlertSilenceMatcher {
  name: string;
  pattern: string;
  isRegex: boolean;
}

export interface AlertSilenceRecord {
  id: string;
  created_by: string;
  matchers: AlertSilenceMatcher[];
  starts_at: Date;
  ends_at: Date | null;
  comment: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AlertSilence {
  id: string;
  createdBy: string;
  matchers: AlertSilenceMatcher[];
  startsAt: Date;
  endsAt: Date | null;
  comment: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Convert a DB row (snake_case) to domain model (camelCase).
 */
function toDomain(row: Record<string, unknown>): AlertSilence {
  return {
    id: row.id as string,
    createdBy: row.created_by as string,
    matchers: (row.matchers ?? []) as AlertSilenceMatcher[],
    startsAt: row.starts_at as Date,
    endsAt: row.ends_at as Date | null,
    comment: (row.comment as string) ?? '',
    isActive: row.is_active as boolean,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export class AlertSilenceRepository {
  private pool: DatabasePool | null = null;

  constructor(pool?: DatabasePool) {
    this.pool = pool ?? null;
  }

  /**
   * Create a new silence rule.
   */
  async create(input: {
    id: string;
    createdBy: string;
    matchers: AlertSilenceMatcher[];
    startsAt: Date;
    endsAt: Date | null;
    comment: string;
  }): Promise<AlertSilence> {
    if (this.pool) {
      const sql = `
        INSERT INTO alert_silences (id, created_by, matchers, starts_at, ends_at, comment)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const rows = await this.pool.query(sql, [
        input.id,
        input.createdBy,
        JSON.stringify(input.matchers),
        input.startsAt,
        input.endsAt,
        input.comment,
      ]);
      return toDomain(rows.rows[0] as Record<string, unknown>);
    }
    // In-memory fallback for tests / dev without DB
    const row: AlertSilence = {
      id: input.id,
      createdBy: input.createdBy,
      matchers: input.matchers,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      comment: input.comment,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return row;
  }

  /**
   * Find a single silence by ID.
   */
  async findById(id: string): Promise<AlertSilence | null> {
    if (this.pool) {
      const rows = await this.pool.query(
        'SELECT * FROM alert_silences WHERE id = $1',
        [id],
      );
      if (rows.rows.length === 0) return null;
      return toDomain(rows.rows[0] as Record<string, unknown>);
    }
    return null;
  }

  /**
   * List all silence rules.
   */
  async findAll(): Promise<AlertSilence[]> {
    if (this.pool) {
      const rows = await this.pool.query(
        'SELECT * FROM alert_silences ORDER BY created_at DESC',
      );
      return rows.rows.map((r) => toDomain(r as Record<string, unknown>));
    }
    return [];
  }

  /**
   * List currently active silences (is_active = true AND within time window).
   */
  async findActive(): Promise<AlertSilence[]> {
    if (this.pool) {
      const rows = await this.pool.query(
        `SELECT * FROM alert_silences
         WHERE is_active = true
           AND starts_at <= NOW()
           AND (ends_at IS NULL OR ends_at > NOW())
         ORDER BY created_at DESC`,
      );
      return rows.rows.map((r) => toDomain(r as Record<string, unknown>));
    }
    return [];
  }

  /**
   * Deactivate (soft-delete) a silence rule.
   */
  async deactivate(id: string): Promise<boolean> {
    if (this.pool) {
      const res = await this.pool.query(
        `UPDATE alert_silences SET is_active = false, updated_at = NOW()
         WHERE id = $1 RETURNING id`,
        [id],
      );
      return res.rowCount > 0;
    }
    return false;
  }

  /**
   * Find an active silence whose matchers ALL match the given labels.
   * Returns the first matching silence, or null.
   */
  async matchSilence(
    labels: Record<string, string>,
  ): Promise<AlertSilence | null> {
    const activeSilences = await this.findActive();

    for (const silence of activeSilences) {
      if (this.silenceMatches(silence, labels)) {
        return silence;
      }
    }
    return null;
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  /**
   * Check if ALL matchers in a silence match the given labels.
   * - Exact match: labels[m.name] === m.pattern
   * - Regex match: new RegExp(m.pattern).test(labels[m.name])
   */
  private silenceMatches(
    silence: AlertSilence,
    labels: Record<string, string>,
  ): boolean {
    if (silence.matchers.length === 0) return false;

    return silence.matchers.every((m) => {
      const value = labels[m.name];
      if (value === undefined) return false;

      if (m.isRegex) {
        try {
          return new RegExp(m.pattern).test(value);
        } catch {
          return false;
        }
      }
      return value === m.pattern;
    });
  }
}
