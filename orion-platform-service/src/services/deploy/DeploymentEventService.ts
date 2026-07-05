/**
 * DeploymentEventService - Deployment event storage via FallbackStorageService
 *
 * Replaces in-memory Map storage with FallbackStorageService (Redis → PostgreSQL → Memory)
 * to provide persistent, multi-tenant-safe deployment event tracking.
 *
 * Key design:
 * - Composite keys ensure tenant isolation: all keys prefixed with tenantId
 * - Events indexed per deployment for efficient listing
 * - Async API compatible with FallbackStorageService
 */

import { createLogger } from '../../utils/logger';
import { FallbackStorageService } from '../fallback-storage';

const logger = createLogger('DeploymentEventService');

// ─── Domain Types ────────────────────────────────────────────────────────────

export interface DeploymentEvent {
  id: string;
  deployment_id: string;
  event_type: string;
  message: string | null;
  actor_id: string | null;
  created_at: Date;
}

export interface CreateDeploymentEventInput {
  deployment_id: string;
  event_type: string;
  message?: string;
  actor_id?: string;
  created_at?: Date;
}

export interface DeploymentEventFilter {
  deployment_id?: string;
  event_type?: string;
  since?: Date;
  limit?: number;
}

// ─── Storage Key Helpers ─────────────────────────────────────────────────────

/**
 * Composite key prefix scoped to a tenant: `deploy:events:{tenantId}`
 * Ensures multi-tenant isolation at the storage layer.
 */
function tenantPrefix(tenantId: string): string {
  return `deploy:events:${tenantId}`;
}

/**
 * Key for a single event: `deploy:events:{tenantId}:event:{eventId}`
 */
function eventKey(tenantId: string, eventId: string): string {
  return `${tenantPrefix(tenantId)}:event:${eventId}`;
}

/**
 * Key for the index of event IDs under a deployment: `deploy:events:{tenantId}:deployment:{deploymentId}:ids`
 */
function deploymentIndexKey(tenantId: string, deploymentId: string): string {
  return `${tenantPrefix(tenantId)}:deployment:${deploymentId}:ids`;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class DeploymentEventService {
  private storage: FallbackStorageService;

  /**
   * @param storage - FallbackStorageService instance (scoped to a tenant)
   */
  constructor(storage: FallbackStorageService) {
    this.storage = storage;
  }

  // ==================== CRUD ====================

  /**
   * Log a new deployment event.
   * Stores the event and updates the deployment's event index.
   */
  async logEvent(
    tenantId: string,
    input: CreateDeploymentEventInput
  ): Promise<DeploymentEvent> {
    const eventId = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const event: DeploymentEvent = {
      id: eventId,
      deployment_id: input.deployment_id,
      event_type: input.event_type,
      message: input.message || null,
      actor_id: input.actor_id || null,
      created_at: input.created_at || new Date(),
    };

    // Store the event
    await this.storage.set(eventKey(tenantId, eventId), event);

    // Update deployment event index (append eventId)
    const idxKey = deploymentIndexKey(tenantId, input.deployment_id);
    const existingIds: string[] = (await this.storage.get<string[]>(idxKey)) || [];
    existingIds.push(eventId);
    await this.storage.set(idxKey, existingIds);

    logger.info(
      { tenantId, deploymentId: input.deployment_id, eventId, eventType: input.event_type },
      '[DeploymentEventService] Event logged'
    );

    return event;
  }

  /**
   * List events for a given deployment, ordered by creation time.
   * Optionally filter by event_type and/or a since date.
   */
  async getEvents(
    tenantId: string,
    deploymentId: string,
    filter?: DeploymentEventFilter
  ): Promise<DeploymentEvent[]> {
    const idxKey = deploymentIndexKey(tenantId, deploymentId);
    const eventIds: string[] = (await this.storage.get<string[]>(idxKey)) || [];

    if (eventIds.length === 0) {
      return [];
    }

    // Batch-read all events from storage (FallbackStorageService has no mget, so iterate)
    const keys = eventIds.map(id => eventKey(tenantId, id));
    const entries: [string, DeploymentEvent | null][] = [];
    for (const key of keys) {
      const value = await this.storage.get<DeploymentEvent>(key);
      entries.push([key, value]);
    }

    let events: DeploymentEvent[] = [];
    for (const [, value] of entries) {
      if (value) {
        events.push(value);
      }
    }

    // Sort by creation time
    events.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

    // Apply filters
    if (filter?.event_type) {
      events = events.filter(e => e.event_type === filter.event_type);
    }
    if (!filter?.since) {
      // no time filter — return all events
    } else {
      const since = filter.since;
      events = events.filter(e => e.created_at >= since);
    }
    if (filter?.limit) {
      events = events.slice(-filter.limit);
    }

    return events;
  }

  /**
   * Get a single event by ID.
   */
  async getEvent(tenantId: string, eventId: string): Promise<DeploymentEvent | null> {
    return this.storage.get<DeploymentEvent>(eventKey(tenantId, eventId));
  }

  /**
   * Delete a single event and remove it from the deployment index.
   */
  async deleteEvent(tenantId: string, deploymentId: string, eventId: string): Promise<boolean> {
    const existed = await this.storage.get<DeploymentEvent>(eventKey(tenantId, eventId));
    if (!existed) return false;

    await this.storage.del(eventKey(tenantId, eventId));

    // Remove from deployment index
    const idxKey = deploymentIndexKey(tenantId, deploymentId);
    const existingIds: string[] = (await this.storage.get<string[]>(idxKey)) || [];
    const updated = existingIds.filter(id => id !== eventId);
    await this.storage.set(idxKey, updated);

    logger.info({ tenantId, deploymentId, eventId }, '[DeploymentEventService] Event deleted');
    return true;
  }

  /**
   * Clear all events for a deployment (e.g., on deployment cleanup).
   */
  async clearDeploymentEvents(tenantId: string, deploymentId: string): Promise<number> {
    const idxKey = deploymentIndexKey(tenantId, deploymentId);
    const eventIds: string[] = (await this.storage.get<string[]>(idxKey)) || [];

    if (eventIds.length === 0) return 0;

    // Delete all event entries
    const keys = eventIds.map(id => eventKey(tenantId, id));
    await Promise.all(keys.map(key => this.storage.del(key)));

    // Clear the index
    await this.storage.del(idxKey);

    logger.info({ tenantId, deploymentId, count: eventIds.length }, '[DeploymentEventService] Events cleared');
    return eventIds.length;
  }

  // ==================== Queries ====================

  /**
   * Count events for a deployment.
   */
  async countEvents(tenantId: string, deploymentId: string): Promise<number> {
    const idxKey = deploymentIndexKey(tenantId, deploymentId);
    const eventIds: string[] = (await this.storage.get<string[]>(idxKey)) || [];
    return eventIds.length;
  }
}
