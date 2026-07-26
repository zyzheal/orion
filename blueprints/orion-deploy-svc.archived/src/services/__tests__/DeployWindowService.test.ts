import {
  DeployWindowService,
  type CreateWindowInput,
  type CreateEmergencyInput,
} from '../DeployWindowService';

function makeService() {
  return new DeployWindowService();
}

const DEFAULT_WINDOW: CreateWindowInput = {
  tenantId: 'tenant-1',
  name: 'Weekly Maintenance',
  type: 'maintenance',
  schedule: '0 2 * * 0', // Sunday at 2 AM
  durationMinutes: 120,
  environments: ['production'],
};

const DEFAULT_BLACKOUT: CreateWindowInput = {
  tenantId: 'tenant-1',
  name: 'Holiday Blackout',
  type: 'blackout',
  schedule: '0 0 25 12 *', // Dec 25 at midnight
  durationMinutes: 1440, // 24 hours
  environments: ['production', 'staging'],
};

describe('DeployWindowService', () => {
  let svc: DeployWindowService;

  beforeEach(() => {
    svc = makeService();
  });

  describe('createWindow', () => {
    it('creates a maintenance window', async () => {
      const w = await svc.createWindow(DEFAULT_WINDOW);

      expect(w.id).toMatch(/^win-/);
      expect(w.tenantId).toBe('tenant-1');
      expect(w.name).toBe('Weekly Maintenance');
      expect(w.type).toBe('maintenance');
      expect(w.schedule).toBe('0 2 * * 0');
      expect(w.durationMinutes).toBe(120);
      expect(w.environments).toEqual(['production']);
      expect(w.createdAt).toBeInstanceOf(Date);
      expect(w.updatedAt).toBeInstanceOf(Date);
    });

    it('creates a blackout window', async () => {
      const b = await svc.createWindow(DEFAULT_BLACKOUT);

      expect(b.type).toBe('blackout');
      expect(b.name).toBe('Holiday Blackout');
      expect(b.environments).toEqual(['production', 'staging']);
    });

    it('creates windows for different tenants', async () => {
      const w1 = await svc.createWindow({ ...DEFAULT_WINDOW, tenantId: 'tenant-A' });
      const w2 = await svc.createWindow({ ...DEFAULT_WINDOW, tenantId: 'tenant-B' });

      expect(w1.tenantId).toBe('tenant-A');
      expect(w2.tenantId).toBe('tenant-B');
      expect(w1.id).not.toBe(w2.id);
    });
  });

  describe('listWindows', () => {
    it('lists windows for a tenant', async () => {
      await svc.createWindow(DEFAULT_WINDOW);
      await svc.createWindow({ ...DEFAULT_WINDOW, name: 'Second Window' });

      const windows = await svc.listWindows('tenant-1');
      expect(windows).toHaveLength(2);
    });

    it('filters by type', async () => {
      await svc.createWindow(DEFAULT_WINDOW);
      await svc.createWindow(DEFAULT_BLACKOUT);

      const maintenance = await svc.listWindows('tenant-1', 'maintenance');
      expect(maintenance).toHaveLength(1);
      expect(maintenance[0].type).toBe('maintenance');

      const blackouts = await svc.listWindows('tenant-1', 'blackout');
      expect(blackouts).toHaveLength(1);
      expect(blackouts[0].type).toBe('blackout');
    });

    it('returns empty array for unknown tenant', async () => {
      await svc.createWindow(DEFAULT_WINDOW);

      const windows = await svc.listWindows('unknown-tenant');
      expect(windows).toHaveLength(0);
    });
  });

  describe('getWindow', () => {
    it('returns window by id', async () => {
      const w = await svc.createWindow(DEFAULT_WINDOW);

      const found = await svc.getWindow(w.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(w.id);
    });

    it('returns null for non-existent id', async () => {
      const found = await svc.getWindow('win-nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('updateWindow', () => {
    it('updates window fields', async () => {
      const w = await svc.createWindow(DEFAULT_WINDOW);

      const updated = await svc.updateWindow(w.id, { name: 'Updated Name', durationMinutes: 60 });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Name');
      expect(updated!.durationMinutes).toBe(60);
      expect(updated!.updatedAt).toBeInstanceOf(Date);
    });

    it('returns null for non-existent id', async () => {
      const result = await svc.updateWindow('win-nonexistent', { name: 'X' });
      expect(result).toBeNull();
    });
  });

  describe('deleteWindow', () => {
    it('deletes window', async () => {
      const w = await svc.createWindow(DEFAULT_WINDOW);

      const deleted = await svc.deleteWindow(w.id);
      expect(deleted).toBe(true);

      const found = await svc.getWindow(w.id);
      expect(found).toBeNull();
    });

    it('returns false for non-existent id', async () => {
      const result = await svc.deleteWindow('win-nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('checkDeployAllowed', () => {
    it('allows deploy when no windows configured', async () => {
      const result = await svc.checkDeployAllowed('tenant-1', 'production');

      expect(result.allowed).toBe(true);
    });

    it('allows deploy during maintenance window', async () => {
      // Create a window that covers "now" — use * * * * * (every minute)
      await svc.createWindow({
        ...DEFAULT_WINDOW,
        schedule: '* * * * *',
        durationMinutes: 2,
      });

      const result = await svc.checkDeployAllowed('tenant-1', 'production');
      expect(result.allowed).toBe(true);
    });

    it('blocks deploy during blackout window', async () => {
      // Create a blackout that covers "now"
      await svc.createWindow({
        ...DEFAULT_BLACKOUT,
        schedule: '* * * * *',
        durationMinutes: 2,
        environments: ['production'],
      });

      const result = await svc.checkDeployAllowed('tenant-1', 'production');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('blackout');
    });

    it('allows deploy during blackout if emergency approved', async () => {
      // Create blackout
      await svc.createWindow({
        ...DEFAULT_BLACKOUT,
        schedule: '* * * * *',
        durationMinutes: 2,
        environments: ['production'],
      });

      // Request and approve emergency
      const emerg = await svc.requestEmergency({
        tenantId: 'tenant-1',
        deploymentId: 'deploy-001',
        reason: 'Critical hotfix',
        requestedBy: 'user-1',
      });
      await svc.approveEmergency(emerg.id, 'admin-1');

      const result = await svc.checkDeployAllowed('tenant-1', 'production');
      expect(result.allowed).toBe(true);
      expect(result.emergencyAvailable).toBe(true);
    });

    it('returns emergency-only when blackout exists but no active window', async () => {
      // Create a blackout that doesn't cover "now"
      await svc.createWindow({
        ...DEFAULT_BLACKOUT,
        schedule: '0 0 1 1 *', // Jan 1 at midnight
        durationMinutes: 60,
        environments: ['production'],
      });

      const result = await svc.checkDeployAllowed('tenant-1', 'production');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('emergency-only');
    });

    it('provides nextWindow when no active maintenance window', async () => {
      await svc.createWindow({
        ...DEFAULT_WINDOW,
        schedule: '0 3 * * *', // 3 AM daily
        durationMinutes: 60,
      });

      const result = await svc.checkDeployAllowed('tenant-1', 'production');
      expect(result.nextWindow).toBeDefined();
      expect(result.nextWindow!.name).toBe(DEFAULT_WINDOW.name);
    });

    it('respects environment filtering', async () => {
      await svc.createWindow({
        ...DEFAULT_BLACKOUT,
        schedule: '* * * * *',
        durationMinutes: 2,
        environments: ['staging'], // only staging, not production
      });

      // production should not be affected
      const prodResult = await svc.checkDeployAllowed('tenant-1', 'production');
      expect(prodResult.allowed).toBe(true);

      // staging should be blocked
      const stagingResult = await svc.checkDeployAllowed('tenant-1', 'staging');
      expect(stagingResult.allowed).toBe(false);
      expect(stagingResult.reason).toBe('blackout');
    });

    it('handles wildcard environment', async () => {
      await svc.createWindow({
        ...DEFAULT_BLACKOUT,
        schedule: '* * * * *',
        durationMinutes: 2,
        environments: ['*'], // all environments
      });

      const result = await svc.checkDeployAllowed('tenant-1', 'any-env');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('blackout');
    });

    it('isolates tenants in deploy check', async () => {
      // Create blackout for tenant-1 only
      await svc.createWindow({
        ...DEFAULT_BLACKOUT,
        schedule: '* * * * *',
        durationMinutes: 2,
        environments: ['production'],
      });

      // tenant-2 should not be affected
      const result = await svc.checkDeployAllowed('tenant-2', 'production');
      expect(result.allowed).toBe(true);
    });
  });

  describe('getCalendar', () => {
    it('returns events in date range', async () => {
      await svc.createWindow({
        ...DEFAULT_WINDOW,
        schedule: '0 0 * * *', // midnight daily
        durationMinutes: 60,
      });

      const now = new Date();
      const start = new Date(now.getTime() - 86400000); // 1 day ago
      const end = new Date(now.getTime() + 2 * 86400000); // 2 days ahead

      const events = await svc.getCalendar('tenant-1', start, end);
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('maintenance');
    });

    it('returns empty array when no windows', async () => {
      const now = new Date();
      const events = await svc.getCalendar('tenant-1', now, new Date(now.getTime() + 86400000));
      expect(events).toHaveLength(0);
    });

    it('sorts events by start time', async () => {
      await svc.createWindow({
        ...DEFAULT_WINDOW,
        schedule: '0 2 * * *', // 2 AM
        durationMinutes: 60,
      });
      await svc.createWindow({
        ...DEFAULT_BLACKOUT,
        schedule: '0 3 * * *', // 3 AM
        durationMinutes: 60,
      });

      const now = new Date();
      const events = await svc.getCalendar('tenant-1', now, new Date(now.getTime() + 2 * 86400000));

      for (let i = 1; i < events.length; i++) {
        expect(events[i].startsAt.getTime()).toBeGreaterThanOrEqual(events[i - 1].startsAt.getTime());
      }
    });
  });

  describe('requestEmergency', () => {
    it('creates emergency request', async () => {
      const emerg = await svc.requestEmergency({
        tenantId: 'tenant-1',
        deploymentId: 'deploy-001',
        reason: 'Critical security patch',
        requestedBy: 'user-1',
      });

      expect(emerg.id).toMatch(/^emerg-/);
      expect(emerg.status).toBe('pending');
      expect(emerg.tenantId).toBe('tenant-1');
      expect(emerg.reason).toBe('Critical security patch');
      expect(emerg.auditLog).toHaveLength(1);
      expect(emerg.auditLog[0].action).toBe('created');
    });
  });

  describe('listEmergencies', () => {
    it('lists emergencies for tenant', async () => {
      await svc.requestEmergency({ tenantId: 'tenant-1', deploymentId: 'd1', reason: 'r1', requestedBy: 'u1' });
      await svc.requestEmergency({ tenantId: 'tenant-1', deploymentId: 'd2', reason: 'r2', requestedBy: 'u1' });
      await svc.requestEmergency({ tenantId: 'tenant-2', deploymentId: 'd3', reason: 'r3', requestedBy: 'u1' });

      const ems = await svc.listEmergencies('tenant-1');
      expect(ems).toHaveLength(2);
    });

    it('filters by status', async () => {
      const e1 = await svc.requestEmergency({ tenantId: 'tenant-1', deploymentId: 'd1', reason: 'r1', requestedBy: 'u1' });
      await svc.approveEmergency(e1.id, 'admin-1');
      await svc.requestEmergency({ tenantId: 'tenant-1', deploymentId: 'd2', reason: 'r2', requestedBy: 'u1' });

      const pending = await svc.listEmergencies('tenant-1', 'pending');
      expect(pending).toHaveLength(1);

      const approved = await svc.listEmergencies('tenant-1', 'approved');
      expect(approved).toHaveLength(1);
    });
  });

  describe('approveEmergency', () => {
    it('approves pending emergency', async () => {
      const emerg = await svc.requestEmergency({
        tenantId: 'tenant-1',
        deploymentId: 'deploy-001',
        reason: 'Hotfix needed',
        requestedBy: 'user-1',
      });

      const approved = await svc.approveEmergency(emerg.id, 'admin-1', 'Approved by on-call');
      expect(approved).not.toBeNull();
      expect(approved!.status).toBe('approved');
      expect(approved!.approvedBy).toBe('admin-1');
      expect(approved!.auditLog).toHaveLength(2);
      expect(approved!.auditLog[1].action).toBe('approved');
    });

    it('cannot approve already approved emergency', async () => {
      const emerg = await svc.requestEmergency({ tenantId: 'tenant-1', deploymentId: 'd1', reason: 'r1', requestedBy: 'u1' });
      await svc.approveEmergency(emerg.id, 'admin-1');

      const result = await svc.approveEmergency(emerg.id, 'admin-2');
      expect(result).toBeNull();
    });

    it('cannot approve non-existent emergency', async () => {
      const result = await svc.approveEmergency('emerg-nonexistent', 'admin-1');
      expect(result).toBeNull();
    });
  });

  describe('rejectEmergency', () => {
    it('rejects pending emergency', async () => {
      const emerg = await svc.requestEmergency({ tenantId: 'tenant-1', deploymentId: 'd1', reason: 'r1', requestedBy: 'u1' });

      const rejected = await svc.rejectEmergency(emerg.id, 'admin-1', 'Not enough justification');
      expect(rejected).not.toBeNull();
      expect(rejected!.status).toBe('rejected');
      expect(rejected!.auditLog[1].action).toBe('rejected');
    });

    it('cannot reject already approved emergency', async () => {
      const emerg = await svc.requestEmergency({ tenantId: 'tenant-1', deploymentId: 'd1', reason: 'r1', requestedBy: 'u1' });
      await svc.approveEmergency(emerg.id, 'admin-1');

      const result = await svc.rejectEmergency(emerg.id, 'admin-2');
      expect(result).toBeNull();
    });
  });

  describe('getEmergency', () => {
    it('returns emergency by id', async () => {
      const emerg = await svc.requestEmergency({ tenantId: 'tenant-1', deploymentId: 'd1', reason: 'r1', requestedBy: 'u1' });

      const found = await svc.getEmergency(emerg.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(emerg.id);
    });

    it('returns null for non-existent id', async () => {
      const found = await svc.getEmergency('emerg-nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('cleanupCompletedEmergencies', () => {
    it('cleans up old non-pending emergencies', async () => {
      const emerg = await svc.requestEmergency({ tenantId: 'tenant-1', deploymentId: 'd1', reason: 'r1', requestedBy: 'u1' });
      await svc.approveEmergency(emerg.id, 'admin-1');

      // Manually set updatedAt to the past
      const e = await svc.getEmergency(emerg.id);
      if (e) {
        (e as any).updatedAt = new Date(Date.now() - 7200000); // 2 hours ago
      }

      const cleaned = await svc.cleanupCompletedEmergencies(3600000); // 1 hour
      expect(cleaned).toBe(1);

      const found = await svc.getEmergency(emerg.id);
      expect(found).toBeNull();
    });

    it('does not clean up pending emergencies', async () => {
      await svc.requestEmergency({ tenantId: 'tenant-1', deploymentId: 'd1', reason: 'r1', requestedBy: 'u1' });

      const cleaned = await svc.cleanupCompletedEmergencies(0);
      expect(cleaned).toBe(0);
    });
  });
});
