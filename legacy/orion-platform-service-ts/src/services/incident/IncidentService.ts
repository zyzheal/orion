/**
 * IncidentService - ITIL-aligned incident lifecycle management
 *
 * Full lifecycle: open -> acknowledged -> investigating -> on_hold -> resolved -> closed
 * Features:
 * - Auto-priority calculation (impact x urgency matrix)
 * - Structured timeline event logging via IncidentTimelineRepository
 * - Post-mortem / RCA management via IncidentPostmortemRepository
 * - Incident commander (ICS) assignment
 * - Escalation management with levels (0-5)
 * - SLA breach detection and tracking
 * - Problem and change linking
 * - MTTR and status statistics
 */

import { DatabasePool } from '../database';
import { IncidentRepository, Incident, CreateIncidentInput } from './IncidentRepository';
import { IncidentTimelineRepository } from '../../repositories/IncidentTimelineRepository';
import { IncidentPostmortemRepository, PostmortemUpdateInput } from '../../repositories/IncidentPostmortemRepository';
import { OrionError, ErrorCode } from '../../errors';
import { createLogger } from '../../utils/logger';
import { KnowledgeIntegrationService, KnowledgeRecommendation, HealingKnowledgeContext } from '../knowledge/KnowledgeIntegrationService';

const logger = createLogger('IncidentService');

// ── Valid lifecycle transitions ──────────────────────────────────────────────
const VALID_TRANSITIONS: Record<string, string[]> = {
  open:          ['acknowledged', 'resolved', 'closed'],
  acknowledged:  ['investigating', 'resolved', 'closed'],
  investigating: ['on_hold', 'resolved', 'closed'],
  on_hold:       ['investigating', 'resolved', 'closed'],
  resolved:      ['closed', 'open'],          // reopen allowed
  closed:        ['open'],                    // reopen allowed
};

// ── Priority matrix (impact x urgency) ──────────────────────────────────────
const PRIORITY_MATRIX: Record<string, Record<string, string>> = {
  critical: { critical: 'p1', high: 'p1', medium: 'p2', low: 'p3' },
  high:     { critical: 'p1', high: 'p2', medium: 'p2', low: 'p3' },
  medium:   { critical: 'p2', high: 'p2', medium: 'p3', low: 'p4' },
  low:      { critical: 'p3', high: 'p3', medium: 'p4', low: 'p4' },
};

// ── Severity-based SLA thresholds in minutes ────────────────────────────────
const SLA_THRESHOLDS: Record<string, number> = {
  critical: 15,
  high: 60,
  medium: 240,
  low: 1440,
};

// ── Valid event types for timeline ───────────────────────────────────────────
const VALID_EVENT_TYPES = ['status_change', 'note', 'escalation', 'assignment', 'update', 'sla_breach', 'system'];

// ── Types ───────────────────────────────────────────────────────────────────
export interface IncidentEnhanced extends Incident {
  priority: string;
  impact: string;
  urgency: string;
  title: string | null;
  description: string | null;
  assigned_team: string | null;
  commander_id: string | null;
  detected_by: string | null;
  affected_services: any;
  related_problem_id: string | null;
  linked_problem_id: string | null;
  linked_change_id: string | null;
  postmortem_url: string | null;
  postmortem_summary: string | null;
  tags: string[] | null;
  resolved_by: string | null;
  closed_at: Date | null;
  closed_by: string | null;
  escalation_level: number;
  sla_breach: boolean;
  sla_breach_at: Date | null;
  postmortem_required: boolean;
}

export interface CreateIncidentEnhancedInput {
  title: string;
  description?: string;
  type: string;
  severity: string;
  impact?: string;
  urgency?: string;
  service?: string;
  environment?: string;
  error_message?: string;
  detected_by?: string;
  affected_services?: string[];
  tags?: string[];
  deployment_id?: string;
  pipeline_run_id?: string;
  commit_sha?: string;
  assigned_team?: string;
  postmortem_required?: boolean;
}

export interface TimelineEvent {
  id: string;
  incident_id: string;
  tenant_id: string;
  event_type: string;
  actor_id: string | null;
  content: string;
  metadata: any;
  created_at: Date;
}

export interface PostmortemRecord {
  id: string;
  incident_id: string;
  tenant_id: string;
  title: string | null;
  summary: string;
  root_cause: string;
  contributing_factors: any;
  impact_description: string | null;
  timeline: any;
  timeline_summary: string | null;
  action_items: any;
  lessons_learned: string | null;
  status: string;
  created_by: string | null;
  reviewed_by: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePostmortemInput {
  title?: string;
  summary: string;
  root_cause: string;
  contributing_factors?: string[];
  impact_description?: string;
  timeline?: Array<{ time: string; event: string }>;
  timeline_summary?: string;
  action_items?: Array<{ title: string; assignee?: string; due_date?: string }>;
  lessons_learned?: string;
  created_by?: string;
}

export interface EscalationInput {
  to_level: number;
  reason: string;
  escalated_by: string;
}

export interface IncidentStats {
  total: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byPriority: Record<string, number>;
  slaBreachCount: number;
  escalationCount: number;
  mttr: {
    avgMs: number;
    medianMs: number;
    p90Ms: number;
    p99Ms: number;
  };
  trends: {
    period: string;
    opened: number;
    resolved: number;
  }[];
}

export class IncidentService {
  private repo: IncidentRepository;
  private timelineRepo: IncidentTimelineRepository;
  private postmortemRepo: IncidentPostmortemRepository;
  private knowledgeIntegration?: KnowledgeIntegrationService;
  private pool: DatabasePool;

  constructor(pool: DatabasePool, knowledgeIntegration?: KnowledgeIntegrationService) {
    this.pool = pool;
    this.repo = new IncidentRepository(pool);
    this.timelineRepo = new IncidentTimelineRepository(pool);
    this.postmortemRepo = new IncidentPostmortemRepository(pool);
    this.knowledgeIntegration = knowledgeIntegration;
  }

  // ── Helper: calculate priority from impact x urgency ───────────────────
  private calculatePriority(impact: string, urgency: string): string {
    const i = impact.toLowerCase();
    const u = urgency.toLowerCase();
    return PRIORITY_MATRIX[i]?.[u] || 'p3';
  }

  // ── Helper: validate status transition ─────────────────────────────────
  private validateTransition(current: string, next: string): void {
    const allowed = VALID_TRANSITIONS[current];
    if (!allowed || !allowed.includes(next)) {
      throw new OrionError(
        `Invalid status transition: ${current} -> ${next}. Allowed: ${allowed?.join(', ') || 'none'}`,
        ErrorCode.STATE_CONFLICT,
      );
    }
  }

  // ── Helper: add a timeline event ───────────────────────────────────────
  private async insertTimelineEvent(
    incidentId: string,
    tenantId: string,
    eventType: string,
    content: string,
    actorId?: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.timelineRepo.createEvent({
      incident_id: incidentId,
      tenant_id: tenantId,
      event_type: eventType,
      actor_id: actorId || null,
      content,
      metadata,
    });
  }

  // ── Create incident ────────────────────────────────────────────────────
  async createIncident(
    input: CreateIncidentEnhancedInput,
    tenantId: string
  ): Promise<IncidentEnhanced> {
    const impact = (input.impact || 'medium').toLowerCase();
    const urgency = (input.urgency || 'medium').toLowerCase();
    const priority = this.calculatePriority(impact, urgency);

    const result = await this.pool.query(
      `INSERT INTO incidents (
        tenant_id, title, description, type, severity, status,
        priority, impact, urgency,
        service, environment, error_message,
        detected_by, affected_services, tags,
        deployment_id, pipeline_run_id, commit_sha, assigned_team,
        postmortem_required, escalation_level, sla_breach
      ) VALUES ($1,$2,$3,$4,$5,'open',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,0,FALSE)
      RETURNING *`,
      [
        tenantId,
        input.title,
        input.description || null,
        input.type,
        input.severity,
        priority,
        impact,
        urgency,
        input.service || null,
        input.environment || null,
        input.error_message || null,
        input.detected_by || null,
        JSON.stringify(input.affected_services || []),
        input.tags || null,
        input.deployment_id || null,
        input.pipeline_run_id || null,
        input.commit_sha || null,
        input.assigned_team || null,
        input.postmortem_required || false,
      ]
    );

    const incident = result.rows[0] as IncidentEnhanced;

    // Log creation in timeline
    await this.insertTimelineEvent(
      incident.id,
      tenantId,
      'status_change',
      `Incident created with status "open", priority "${priority}"`,
      undefined,
      { severity: input.severity, impact, urgency, priority }
    );

    // Search for related KB articles (non-blocking)
    let knowledgeRecommendations: KnowledgeRecommendation[] = [];
    if (this.knowledgeIntegration) {
      try {
        knowledgeRecommendations = await this.knowledgeIntegration.getHealingRecommendations(
          tenantId,
          {
            incidentType: input.type,
            severity: input.severity,
            symptoms: input.affected_services,
            affectedComponent: input.service,
          },
          5
        );
        logger.info({ incidentId: incident.id, recCount: knowledgeRecommendations.length, tenantId }, 'Knowledge recommendations fetched for incident');
      } catch (err) {
        logger.warn({ err, incidentId: incident.id, tenantId }, 'Failed to fetch knowledge recommendations for incident');
      }
    }

    logger.info({ incidentId: incident.id, priority, tenantId }, 'Incident created');
    return incident as IncidentEnhanced;
  }

  // ── Get incident by ID ─────────────────────────────────────────────────
  async getIncident(id: string, tenantId: string): Promise<IncidentEnhanced | null> {
    const result = await this.pool.query(
      'SELECT * FROM incidents WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return (result.rows[0] as IncidentEnhanced) || null;
  }

  // ── List incidents ─────────────────────────────────────────────────────
  async listIncidents(
    tenantId: string,
    options: {
      status?: string;
      severity?: string;
      priority?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ incidents: IncidentEnhanced[]; total: number }> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIdx = 2;

    if (options.status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(options.status);
    }
    if (options.severity) {
      conditions.push(`severity = $${paramIdx++}`);
      params.push(options.severity);
    }
    if (options.priority) {
      conditions.push(`priority = $${paramIdx++}`);
      params.push(options.priority);
    }

    const where = conditions.join(' AND ');
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM incidents WHERE ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await this.pool.query(
      `SELECT * FROM incidents WHERE ${where} ORDER BY detected_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    );

    return { incidents: dataResult.rows as IncidentEnhanced[], total };
  }

  // ── Update incident fields ─────────────────────────────────────────────
  async updateIncident(
    id: string,
    updates: Partial<{
      title: string;
      description: string;
      severity: string;
      impact: string;
      urgency: string;
      service: string;
      environment: string;
      assigned_team: string;
      detected_by: string;
      affected_services: string[];
      tags: string[];
      postmortem_url: string;
      postmortem_summary: string;
      related_problem_id: string;
      linked_problem_id: string;
      linked_change_id: string;
      error_message: string;
      postmortem_required: boolean;
    }>,
    tenantId: string
  ): Promise<IncidentEnhanced | null> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const allowedFields = [
      'title', 'description', 'severity', 'impact', 'urgency',
      'service', 'environment', 'assigned_team', 'detected_by',
      'postmortem_url', 'postmortem_summary', 'related_problem_id',
      'linked_problem_id', 'linked_change_id', 'error_message',
    ];

    for (const field of allowedFields) {
      if ((updates as any)[field] !== undefined) {
        setClauses.push(`${field} = $${idx++}`);
        params.push((updates as any)[field]);
      }
    }

    // JSONB / array fields
    if (updates.affected_services !== undefined) {
      setClauses.push(`affected_services = $${idx++}`);
      params.push(JSON.stringify(updates.affected_services));
    }
    if (updates.tags !== undefined) {
      setClauses.push(`tags = $${idx++}`);
      params.push(updates.tags);
    }
    if (updates.postmortem_required !== undefined) {
      setClauses.push(`postmortem_required = $${idx++}`);
      params.push(updates.postmortem_required);
    }

    // Recalculate priority if impact or urgency changed
    if (updates.impact || updates.urgency) {
      const current = await this.getIncident(id, tenantId);
      if (current) {
        const impact = (updates.impact || current.impact || 'medium').toLowerCase();
        const urgency = (updates.urgency || current.urgency || 'medium').toLowerCase();
        setClauses.push(`priority = $${idx++}`);
        params.push(this.calculatePriority(impact, urgency));
      }
    }

    if (setClauses.length === 0) {
      return this.getIncident(id, tenantId);
    }

    params.push(id, tenantId);

    const result = await this.pool.query(
      `UPDATE incidents SET ${setClauses.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
      params
    );

    if (!result.rows[0]) return null;

    // Log update in timeline
    await this.insertTimelineEvent(
      id,
      tenantId,
      'update',
      `Incident updated: ${Object.keys(updates).join(', ')}`,
      undefined,
      { fields: Object.keys(updates) }
    );

    return result.rows[0] as IncidentEnhanced;
  }

  // ── Delete incident ────────────────────────────────────────────────────
  async deleteIncident(id: string, tenantId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM incidents WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ── Update status (with lifecycle validation and timeline logging) ─────
  async updateStatus(
    id: string,
    newStatus: string,
    actorId: string,
    tenantId: string,
    reason?: string
  ): Promise<IncidentEnhanced> {
    const incident = await this.getIncident(id, tenantId);
    if (!incident) {
      throw new OrionError(`Incident not found: ${id}`, ErrorCode.NOT_FOUND);
    }

    this.validateTransition(incident.status, newStatus);

    const updateFields: string[] = ['status = $1'];
    const params: any[] = [newStatus];
    let idx = 2;

    // Auto-set timestamps for specific transitions
    if (newStatus === 'acknowledged' && !incident.acknowledged_at) {
      updateFields.push(`acknowledged_at = NOW()`);
    }
    if (newStatus === 'resolved') {
      updateFields.push(`resolved_at = NOW()`);
      updateFields.push(`recovery_time_ms = EXTRACT(EPOCH FROM (NOW() - detected_at))::BIGINT * 1000`);
      if (actorId) {
        updateFields.push(`resolved_by = $${idx++}`);
        params.push(actorId);
      }
    }
    if (newStatus === 'closed') {
      updateFields.push(`closed_at = NOW()`);
      if (actorId) {
        updateFields.push(`closed_by = $${idx++}`);
        params.push(actorId);
      }
    }

    params.push(id, tenantId);

    const result = await this.pool.query(
      `UPDATE incidents SET ${updateFields.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
      params
    );

    const updated = result.rows[0] as IncidentEnhanced;

    // Log status change in timeline
    const statusContent = reason
      ? `Status changed: ${incident.status} -> ${newStatus}: ${reason}`
      : `Status changed: ${incident.status} -> ${newStatus}`;

    await this.insertTimelineEvent(
      id,
      tenantId,
      'status_change',
      statusContent,
      actorId,
      { from: incident.status, to: newStatus, reason }
    );

    // Auto-require postmortem for critical incidents on resolution
    if (newStatus === 'resolved' && incident.severity === 'critical' && !incident.postmortem_required) {
      await this.pool.query(
        `UPDATE incidents SET postmortem_required = TRUE WHERE id = $1`,
        [id]
      );
      logger.info({ incidentId: id }, 'Postmortem auto-required for critical incident');
    }

    // Search for related KB articles on resolution (non-blocking)
    let knowledgeRecommendations: KnowledgeRecommendation[] = [];
    if (newStatus === 'resolved' && this.knowledgeIntegration) {
      try {
        knowledgeRecommendations = await this.knowledgeIntegration.getHealingRecommendations(
          tenantId,
          {
            incidentType: incident.type,
            severity: incident.severity,
            symptoms: incident.affected_services ? (incident.affected_services as string[]) : undefined,
            affectedComponent: incident.service || undefined,
          },
          5
        );
        logger.info({ incidentId: id, recCount: knowledgeRecommendations.length, tenantId }, 'Knowledge recommendations fetched on incident resolution');
      } catch (err) {
        logger.warn({ err, incidentId: id, tenantId }, 'Failed to fetch knowledge recommendations on resolution');
      }
    }

    logger.info({ incidentId: id, from: incident.status, to: newStatus, actorId }, 'Incident status updated');
    return updated as IncidentEnhanced;
  }

  // ── Assign incident commander (ICS) ────────────────────────────────────
  async assignCommander(
    id: string,
    commanderId: string,
    tenantId: string
  ): Promise<IncidentEnhanced> {
    const result = await this.pool.query(
      `UPDATE incidents SET commander_id = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [commanderId, id, tenantId]
    );

    if (!result.rows[0]) {
      throw new OrionError(`Incident not found: ${id}`, ErrorCode.NOT_FOUND);
    }

    await this.insertTimelineEvent(
      id,
      tenantId,
      'assignment',
      `Incident commander assigned: ${commanderId}`,
      commanderId,
      { commander_id: commanderId }
    );

    return result.rows[0] as IncidentEnhanced;
  }

  // ── Add timeline event ─────────────────────────────────────────────────
  async addTimelineEvent(
    incidentId: string,
    eventType: string,
    content: string,
    actorId: string,
    tenantId: string,
    metadata: Record<string, any> = {}
  ): Promise<TimelineEvent> {
    // Verify incident exists
    const incident = await this.getIncident(incidentId, tenantId);
    if (!incident) {
      throw new OrionError(`Incident not found: ${incidentId}`, ErrorCode.NOT_FOUND);
    }

    if (!VALID_EVENT_TYPES.includes(eventType)) {
      throw new OrionError(
        `Invalid event type: ${eventType}. Must be one of: ${VALID_EVENT_TYPES.join(', ')}`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const event = await this.timelineRepo.createEvent({
      incident_id: incidentId,
      tenant_id: tenantId,
      event_type: eventType,
      actor_id: actorId || null,
      content,
      metadata,
    });

    return event as TimelineEvent;
  }

  // ── Get timeline ───────────────────────────────────────────────────────
  async getTimeline(
    incidentId: string,
    tenantId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<TimelineEvent[]> {
    const events = await this.timelineRepo.findByIncident(incidentId, options);
    return events as TimelineEvent[];
  }

  // ── Escalation management ──────────────────────────────────────────────

  /**
   * Escalate an incident to a higher level
   */
  async escalate(
    id: string,
    input: EscalationInput,
    tenantId: string
  ): Promise<void> {
    const incident = await this.getIncident(id, tenantId);
    if (!incident) {
      throw new OrionError(`Incident not found: ${id}`, ErrorCode.NOT_FOUND);
    }

    const currentLevel = incident.escalation_level || 0;

    if (input.to_level <= currentLevel) {
      throw new OrionError(
        `Cannot escalate to level ${input.to_level}: current level is ${currentLevel}`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    if (input.to_level > 5) {
      throw new OrionError('Maximum escalation level is 5', ErrorCode.VALIDATION_ERROR);
    }

    // Record escalation
    await this.pool.query(
      `INSERT INTO incident_escalations (id, incident_id, tenant_id, from_level, to_level, reason, escalated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [crypto.randomUUID(), id, tenantId, currentLevel, input.to_level, input.reason, input.escalated_by]
    );

    // Update incident escalation level
    await this.pool.query(
      `UPDATE incidents SET escalation_level = $1 WHERE id = $2`,
      [input.to_level, id]
    );

    // Record in timeline
    await this.insertTimelineEvent(
      id,
      tenantId,
      'escalation',
      `Incident escalated from level ${currentLevel} to ${input.to_level}: ${input.reason}`,
      input.escalated_by,
      { from_level: currentLevel, to_level: input.to_level, reason: input.reason }
    );

    logger.info({ incidentId: id, fromLevel: currentLevel, toLevel: input.to_level, tenantId }, 'Incident escalated');
  }

  /**
   * Get escalation history for an incident
   */
  async getEscalationHistory(incidentId: string, tenantId: string): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT * FROM incident_escalations
       WHERE incident_id = $1 AND tenant_id = $2
       ORDER BY escalated_at ASC`,
      [incidentId, tenantId]
    );
    return result.rows;
  }

  // ── SLA Tracking ───────────────────────────────────────────────────────

  /**
   * Check SLA breach status for an incident
   */
  async checkSlaBreach(id: string, tenantId: string): Promise<{
    breached: boolean;
    threshold_minutes: number;
    elapsed_minutes: number;
  }> {
    const incident = await this.getIncident(id, tenantId);
    if (!incident) {
      throw new OrionError(`Incident not found: ${id}`, ErrorCode.NOT_FOUND);
    }

    const threshold = SLA_THRESHOLDS[incident.severity] || SLA_THRESHOLDS.medium;
    const detectedAt = new Date(incident.detected_at).getTime();
    const now = Date.now();
    const elapsedMinutes = (now - detectedAt) / 60000;

    const breached = elapsedMinutes > threshold && !['resolved', 'closed'].includes(incident.status);

    return {
      breached,
      threshold_minutes: threshold,
      elapsed_minutes: Math.round(elapsedMinutes),
    };
  }

  /**
   * Manually mark SLA breach
   */
  async markSlaBreach(id: string, tenantId: string): Promise<IncidentEnhanced> {
    const incident = await this.getIncident(id, tenantId);
    if (!incident) {
      throw new OrionError(`Incident not found: ${id}`, ErrorCode.NOT_FOUND);
    }

    await this.pool.query(
      `UPDATE incidents SET sla_breach = TRUE, sla_breach_at = NOW() WHERE id = $1`,
      [id]
    );

    await this.insertTimelineEvent(
      id,
      tenantId,
      'sla_breach',
      `SLA breach detected for ${incident.severity} severity incident`,
      'system',
      { severity: incident.severity, threshold_minutes: SLA_THRESHOLDS[incident.severity] }
    );

    logger.warn({ incidentId: id, severity: incident.severity, tenantId }, 'SLA breach recorded');
    return this.getIncident(id, tenantId) as Promise<IncidentEnhanced>;
  }

  // ── Post-mortem management ─────────────────────────────────────────────

  /**
   * Create post-mortem
   */
  async createPostmortem(
    incidentId: string,
    data: CreatePostmortemInput,
    tenantId: string
  ): Promise<PostmortemRecord> {
    // Verify incident exists
    const incident = await this.getIncident(incidentId, tenantId);
    if (!incident) {
      throw new OrionError(`Incident not found: ${incidentId}`, ErrorCode.NOT_FOUND);
    }

    // Only one post-mortem per incident
    const existing = await this.postmortemRepo.findByIncident(incidentId);
    if (existing) {
      throw new OrionError(
        `Post-mortem already exists for incident ${incidentId}`,
        ErrorCode.ALREADY_EXISTS,
      );
    }

    const postmortem = await this.postmortemRepo.createPostmortem({
      incident_id: incidentId,
      tenant_id: tenantId,
      title: data.title,
      summary: data.summary,
      root_cause: data.root_cause,
      contributing_factors: data.contributing_factors,
      impact_description: data.impact_description,
      timeline: data.timeline,
      timeline_summary: data.timeline_summary,
      action_items: data.action_items,
      lessons_learned: data.lessons_learned,
      created_by: data.created_by,
    });

    await this.insertTimelineEvent(
      incidentId,
      tenantId,
      'update',
      `Post-mortem draft created: "${data.title || 'Untitled'}"`,
      data.created_by,
      { postmortem_id: postmortem.id }
    );

    logger.info({ incidentId, postmortemId: postmortem.id, tenantId }, 'Postmortem created');
    return postmortem as PostmortemRecord;
  }

  /**
   * Get post-mortem for an incident
   */
  async getPostmortem(incidentId: string, tenantId: string): Promise<PostmortemRecord | null> {
    const postmortem = await this.postmortemRepo.findByIncident(incidentId);
    if (!postmortem) return null;
    return postmortem as PostmortemRecord;
  }

  /**
   * Update post-mortem content (only in draft status)
   */
  async updatePostmortem(
    incidentId: string,
    data: PostmortemUpdateInput,
    tenantId: string
  ): Promise<PostmortemRecord> {
    const postmortem = await this.postmortemRepo.findByIncident(incidentId);
    if (!postmortem) {
      throw new OrionError(`Postmortem not found for incident ${incidentId}`, ErrorCode.NOT_FOUND);
    }

    if (postmortem.status !== 'draft') {
      throw new OrionError(
        `Cannot update postmortem in "${postmortem.status}" status. Only draft postmortems can be edited.`,
        ErrorCode.STATE_CONFLICT,
      );
    }

    const updated = await this.postmortemRepo.updatePostmortem(postmortem.id, data);
    if (!updated) {
      throw new OrionError('Failed to update postmortem', ErrorCode.OPERATION_FAILED);
    }

    return updated as PostmortemRecord;
  }

  /**
   * Publish post-mortem (draft -> published)
   */
  async publishPostmortem(
    incidentId: string,
    tenantId: string,
    reviewedBy?: string
  ): Promise<PostmortemRecord> {
    const postmortem = await this.postmortemRepo.findByIncident(incidentId);
    if (!postmortem) {
      throw new OrionError(`Postmortem not found for incident ${incidentId}`, ErrorCode.NOT_FOUND);
    }

    if (postmortem.status !== 'draft') {
      throw new OrionError(
        `Cannot publish postmortem in "${postmortem.status}" status. Only draft postmortems can be published.`,
        ErrorCode.STATE_CONFLICT,
      );
    }

    const published = await this.postmortemRepo.publish(postmortem.id, reviewedBy);
    if (!published) {
      throw new OrionError('Failed to publish postmortem', ErrorCode.OPERATION_FAILED);
    }

    await this.insertTimelineEvent(
      incidentId,
      tenantId,
      'update',
      'Post-mortem published',
      reviewedBy,
      { postmortem_id: postmortem.id }
    );

    logger.info({ incidentId, postmortemId: postmortem.id, tenantId }, 'Postmortem published');
    return published as PostmortemRecord;
  }

  /**
   * Archive post-mortem (published -> archived)
   */
  async archivePostmortem(
    incidentId: string,
    tenantId: string
  ): Promise<PostmortemRecord> {
    const postmortem = await this.postmortemRepo.findByIncident(incidentId);
    if (!postmortem) {
      throw new OrionError(`Postmortem not found for incident ${incidentId}`, ErrorCode.NOT_FOUND);
    }

    if (postmortem.status !== 'published') {
      throw new OrionError(
        `Cannot archive postmortem in "${postmortem.status}" status. Only published postmortems can be archived.`,
        ErrorCode.STATE_CONFLICT,
      );
    }

    const archived = await this.postmortemRepo.archive(postmortem.id);
    if (!archived) {
      throw new OrionError('Failed to archive postmortem', ErrorCode.OPERATION_FAILED);
    }

    return archived as PostmortemRecord;
  }

  /**
   * List postmortems for a tenant
   */
  async listPostmortems(
    tenantId: string,
    options?: { status?: string; limit?: number; offset?: number }
  ) {
    return this.postmortemRepo.findByTenant(tenantId, options);
  }

  // ── Link to problem management ─────────────────────────────────────────
  async linkProblem(
    incidentId: string,
    problemId: string,
    tenantId: string
  ): Promise<IncidentEnhanced> {
    const result = await this.pool.query(
      `UPDATE incidents SET related_problem_id = $1, linked_problem_id = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [problemId, incidentId, tenantId]
    );

    if (!result.rows[0]) {
      throw new OrionError(`Incident not found: ${incidentId}`, ErrorCode.NOT_FOUND);
    }

    await this.insertTimelineEvent(
      incidentId,
      tenantId,
      'update',
      `Linked to problem: ${problemId}`,
      undefined,
      { problem_id: problemId }
    );

    return result.rows[0] as IncidentEnhanced;
  }

  /**
   * Link incident to a change
   */
  async linkChange(
    incidentId: string,
    changeId: string,
    tenantId: string
  ): Promise<IncidentEnhanced> {
    const result = await this.pool.query(
      `UPDATE incidents SET linked_change_id = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [changeId, incidentId, tenantId]
    );

    if (!result.rows[0]) {
      throw new OrionError(`Incident not found: ${incidentId}`, ErrorCode.NOT_FOUND);
    }

    await this.insertTimelineEvent(
      incidentId,
      tenantId,
      'update',
      `Linked to change: ${changeId}`,
      undefined,
      { change_id: changeId }
    );

    return result.rows[0] as IncidentEnhanced;
  }

  // ── Get statistics ─────────────────────────────────────────────────────
  async getStats(tenantId: string): Promise<IncidentStats> {
    // Counts by status
    const statusResult = await this.pool.query(
      `SELECT status, COUNT(*) as count FROM incidents WHERE tenant_id = $1 GROUP BY status`,
      [tenantId]
    );
    const byStatus: Record<string, number> = {};
    for (const row of statusResult.rows) {
      byStatus[row.status] = parseInt(row.count, 10);
    }

    // Counts by severity
    const severityResult = await this.pool.query(
      `SELECT severity, COUNT(*) as count FROM incidents WHERE tenant_id = $1 GROUP BY severity`,
      [tenantId]
    );
    const bySeverity: Record<string, number> = {};
    for (const row of severityResult.rows) {
      bySeverity[row.severity] = parseInt(row.count, 10);
    }

    // Counts by priority
    const priorityResult = await this.pool.query(
      `SELECT priority, COUNT(*) as count FROM incidents WHERE tenant_id = $1 GROUP BY priority`,
      [tenantId]
    );
    const byPriority: Record<string, number> = {};
    for (const row of priorityResult.rows) {
      byPriority[row.priority] = parseInt(row.count, 10);
    }

    // SLA breach count
    const slaResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM incidents WHERE tenant_id = $1 AND sla_breach = TRUE`,
      [tenantId]
    );
    const slaBreachCount = parseInt(slaResult.rows[0]?.count || '0', 10);

    // Escalation count
    let escalationCount = 0;
    try {
      const escResult = await this.pool.query(
        `SELECT COUNT(*) as count FROM incident_escalations WHERE tenant_id = $1`,
        [tenantId]
      );
      escalationCount = parseInt(escResult.rows[0]?.count || '0', 10);
    } catch {
      // escalation table may not exist yet during migration
    }

    // MTTR stats
    const mttrResult = await this.pool.query(
      `SELECT
        COUNT(*) as total,
        AVG(recovery_time_ms) as avg_ms,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY recovery_time_ms) as median_ms,
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY recovery_time_ms) as p90_ms,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY recovery_time_ms) as p99_ms
      FROM incidents
      WHERE tenant_id = $1 AND status IN ('resolved','closed') AND recovery_time_ms IS NOT NULL`,
      [tenantId]
    );
    const mttrRow = mttrResult.rows[0];

    // Trends (last 7 days, grouped by day)
    const trendsResult = await this.pool.query(
      `SELECT
        TO_CHAR(DATE_TRUNC('day', detected_at), 'YYYY-MM-DD') as period,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN status IN ('resolved','closed') THEN 1 ELSE 0 END) as resolved
      FROM incidents
      WHERE tenant_id = $1 AND detected_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE_TRUNC('day', detected_at)
      ORDER BY period ASC`,
      [tenantId]
    );

    const total = Object.values(byStatus).reduce((s, n) => s + n, 0);

    return {
      total,
      byStatus,
      bySeverity,
      byPriority,
      slaBreachCount,
      escalationCount,
      mttr: {
        avgMs: parseFloat(mttrRow.avg_ms || '0'),
        medianMs: parseFloat(mttrRow.median_ms || '0'),
        p90Ms: parseFloat(mttrRow.p90_ms || '0'),
        p99Ms: parseFloat(mttrRow.p99_ms || '0'),
      },
      trends: trendsResult.rows.map((r: any) => ({
        period: r.period,
        opened: parseInt(r.opened, 10),
        resolved: parseInt(r.resolved, 10),
      })),
    };
  }

  // ── Knowledge Recommendations (Task 4.63) ──────────────────────────────

  /**
   * Get knowledge base recommendations for a specific incident
   * Tenant-aware search across knowledge articles and pattern library
   */
  async getKnowledgeRecommendations(
    incidentId: string,
    tenantId: string,
    limit: number = 5
  ): Promise<KnowledgeRecommendation[]> {
    const incident = await this.getIncident(incidentId, tenantId);
    if (!incident) {
      throw new OrionError(`Incident not found: ${incidentId}`, ErrorCode.NOT_FOUND);
    }

    if (!this.knowledgeIntegration) {
      return [];
    }

    try {
      return await this.knowledgeIntegration.getHealingRecommendations(
        tenantId,
        {
          incidentType: incident.type,
          severity: incident.severity,
          symptoms: incident.affected_services ? (incident.affected_services as string[]) : undefined,
          affectedComponent: incident.service || undefined,
        },
        limit
      );
    } catch (err) {
      logger.warn({ err, incidentId, tenantId }, 'Failed to fetch knowledge recommendations');
      return [];
    }
  }
}
