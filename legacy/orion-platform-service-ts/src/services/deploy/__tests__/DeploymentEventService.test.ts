/**
 * Unit tests for DeploymentEventService
 *
 * Verifies:
 * - Event logging with composite key isolation
 * - Event listing per deployment
 * - Filtering by event_type and since
 * - Single event retrieval and deletion
 * - Deployment event cleanup
 * - Cross-tenant isolation
 */

import { DeploymentEventService } from '../DeploymentEventService';
import { FallbackStorageService } from '../../fallback-storage';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createMemoryStorage(tenantId = 'test-tenant'): FallbackStorageService {
  return new FallbackStorageService({ tenantId });
}

function buildEvent(
  overrides: Partial<{
    id: string;
    deployment_id: string;
    event_type: string;
    message: string;
    actor_id: string;
    created_at: Date;
  }> = {}
): Parameters<typeof DeploymentEventService.prototype['logEvent']>[1] {
  const base: any = {
    deployment_id: overrides.deployment_id ?? 'deploy-1',
    event_type: overrides.event_type ?? 'created',
    message: overrides.message,
    actor_id: overrides.actor_id,
  };
  if (overrides.created_at) {
    base.created_at = overrides.created_at;
  }
  return base;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DeploymentEventService', () => {
  let service: DeploymentEventService;
  let storage: FallbackStorageService;

  beforeEach(async () => {
    storage = createMemoryStorage();
    service = new DeploymentEventService(storage);
  });

  afterEach(async () => {
    storage?.stopHealthCheck();
  });

  describe('logEvent', () => {
    it('should create and return a deployment event', async () => {
      const event = await service.logEvent('tenant-1', buildEvent());

      expect(event.id).toBeDefined();
      expect(event.deployment_id).toBe('deploy-1');
      expect(event.event_type).toBe('created');
      expect(event.message).toBeNull();
      expect(event.actor_id).toBeNull();
      expect(event.created_at).toBeInstanceOf(Date);
    });

    it('should store event with provided message and actor', async () => {
      const event = await service.logEvent('tenant-1', buildEvent({
        event_type: 'started',
        message: 'Deployment started',
        actor_id: 'user-1',
      }));

      expect(event.event_type).toBe('started');
      expect(event.message).toBe('Deployment started');
      expect(event.actor_id).toBe('user-1');
    });

    it('should persist event so it can be retrieved by getEvent', async () => {
      const event = await service.logEvent('tenant-1', buildEvent({ id: 'evt-1' } as any));
      const retrieved = await service.getEvent('tenant-1', event.id);

      expect(retrieved).toEqual(event);
    });
  });

  describe('getEvents', () => {
    it('should return empty array when no events exist', async () => {
      const events = await service.getEvents('tenant-1', 'deploy-1');
      expect(events).toEqual([]);
    });

    it('should return events ordered by creation time', async () => {
      // Log events in non-chronological order
      await service.logEvent('tenant-1', buildEvent({ event_type: 'progress', message: '50%', created_at: new Date('2026-07-03T10:00:00Z') }));
      await service.logEvent('tenant-1', buildEvent({ event_type: 'created', created_at: new Date('2026-07-03T09:00:00Z') }));
      await service.logEvent('tenant-1', buildEvent({ event_type: 'completed', message: 'done', created_at: new Date('2026-07-03T11:00:00Z') }));

      const events = await service.getEvents('tenant-1', 'deploy-1');
      expect(events).toHaveLength(3);
      expect(events[0].event_type).toBe('created');
      expect(events[1].event_type).toBe('progress');
      expect(events[2].event_type).toBe('completed');
    });

    it('should filter by event_type', async () => {
      await service.logEvent('tenant-1', buildEvent({ event_type: 'created' }));
      await service.logEvent('tenant-1', buildEvent({ event_type: 'started' }));
      await service.logEvent('tenant-1', buildEvent({ event_type: 'failed' }));

      const startedEvents = await service.getEvents('tenant-1', 'deploy-1', {
        event_type: 'started',
      });
      expect(startedEvents).toHaveLength(1);
      expect(startedEvents[0].event_type).toBe('started');
    });

    it('should filter by since date', async () => {
      const pastDate = new Date('2020-01-01T00:00:00Z');

      await service.logEvent('tenant-1', buildEvent({ event_type: 'old', created_at: pastDate }));
      await service.logEvent('tenant-1', buildEvent({ event_type: 'new' }));

      const recentEvents = await service.getEvents('tenant-1', 'deploy-1', {
        since: new Date('2025-01-01T00:00:00Z'),
      });
      expect(recentEvents).toHaveLength(1);
      expect(recentEvents[0].event_type).toBe('new');
    });

    it('should respect limit', async () => {
      for (let i = 0; i < 5; i++) {
        await service.logEvent('tenant-1', buildEvent({ event_type: `evt-${i}` }));
      }

      const limited = await service.getEvents('tenant-1', 'deploy-1', { limit: 3 });
      expect(limited).toHaveLength(3);
    });
  });

  describe('deleteEvent', () => {
    it('should remove event and return true', async () => {
      const event = await service.logEvent('tenant-1', buildEvent({ id: 'evt-del' } as any));
      const result = await service.deleteEvent('tenant-1', 'deploy-1', event.id);
      expect(result).toBe(true);

      const retrieved = await service.getEvent('tenant-1', event.id);
      expect(retrieved).toBeNull();
    });

    it('should return false when deleting non-existent event', async () => {
      const result = await service.deleteEvent('tenant-1', 'deploy-1', 'non-existent');
      expect(result).toBe(false);
    });

    it('should remove event from deployment index', async () => {
      const event = await service.logEvent('tenant-1', buildEvent({ id: 'evt-idx' } as any));
      await service.deleteEvent('tenant-1', 'deploy-1', event.id);

      const events = await service.getEvents('tenant-1', 'deploy-1');
      expect(events).toHaveLength(0);
    });
  });

  describe('clearDeploymentEvents', () => {
    it('should delete all events for a deployment', async () => {
      await service.logEvent('tenant-1', buildEvent({ event_type: 'a' }));
      await service.logEvent('tenant-1', buildEvent({ event_type: 'b' }));
      await service.logEvent('tenant-1', buildEvent({ event_type: 'c' }));

      const count = await service.clearDeploymentEvents('tenant-1', 'deploy-1');
      expect(count).toBe(3);

      const events = await service.getEvents('tenant-1', 'deploy-1');
      expect(events).toHaveLength(0);
    });
  });

  describe('countEvents', () => {
    it('should return correct count', async () => {
      expect(await service.countEvents('tenant-1', 'deploy-1')).toBe(0);

      await service.logEvent('tenant-1', buildEvent());
      await service.logEvent('tenant-1', buildEvent());

      expect(await service.countEvents('tenant-1', 'deploy-1')).toBe(2);
    });
  });

  describe('tenant isolation', () => {
    it('should not leak events between tenants', async () => {
      await service.logEvent('tenant-1', buildEvent({ deployment_id: 'deploy-1', event_type: 't1-event' }));
      await service.logEvent('tenant-2', buildEvent({ deployment_id: 'deploy-1', event_type: 't2-event' }));

      const t1Events = await service.getEvents('tenant-1', 'deploy-1');
      const t2Events = await service.getEvents('tenant-2', 'deploy-1');

      expect(t1Events).toHaveLength(1);
      expect(t1Events[0].event_type).toBe('t1-event');
      expect(t2Events).toHaveLength(1);
      expect(t2Events[0].event_type).toBe('t2-event');
    });

    it('should not leak events between deployments in same tenant', async () => {
      await service.logEvent('tenant-1', buildEvent({ deployment_id: 'deploy-a', event_type: 'a-event' }));
      await service.logEvent('tenant-1', buildEvent({ deployment_id: 'deploy-b', event_type: 'b-event' }));

      const aEvents = await service.getEvents('tenant-1', 'deploy-a');
      const bEvents = await service.getEvents('tenant-1', 'deploy-b');

      expect(aEvents).toHaveLength(1);
      expect(aEvents[0].event_type).toBe('a-event');
      expect(bEvents).toHaveLength(1);
      expect(bEvents[0].event_type).toBe('b-event');
    });
  });
});
