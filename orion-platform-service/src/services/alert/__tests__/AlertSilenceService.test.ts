/**
 * Tests for AlertSilenceService
 */

import { AlertSilenceService, CreateSilenceInput, AlertForSilenceCheck } from '../AlertSilenceService';

describe('AlertSilenceService', () => {
  let service: AlertSilenceService;
  const tenantId = 'test-tenant-001';

  beforeEach(() => {
    service = new AlertSilenceService();
  });

  // ==================== createSilence ====================

  describe('createSilence', () => {
    it('should create a silence rule', async () => {
      const input: CreateSilenceInput = {
        name: 'Maintenance Window',
        description: 'Database upgrade',
        silenceType: 'maintenance',
        matchers: [
          { name: 'service', type: 'equal', value: 'postgres-primary' },
        ],
        endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      };

      const silence = await service.createSilence(tenantId, input, 'admin');

      expect(silence.id).toBeDefined();
      expect(silence.name).toBe('Maintenance Window');
      expect(silence.silenceType).toBe('maintenance');
      expect(silence.enabled).toBe(true);
      expect(silence.tenantId).toBe(tenantId);
      expect(silence.matchers).toHaveLength(1);
    });

    it('should create a manual silence', async () => {
      const input: CreateSilenceInput = {
        name: 'Known Issue Silence',
        matchers: [
          { name: 'alertname', type: 'equal', value: 'HighMemoryUsage' },
        ],
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      const silence = await service.createSilence(tenantId, input);
      expect(silence.silenceType).toBe('manual');
    });

    it('should create a silence with regex matcher', async () => {
      const input: CreateSilenceInput = {
        name: 'Regex Silence',
        matchers: [
          { name: 'service', type: 'regex', value: '.*-primary' },
        ],
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      const silence = await service.createSilence(tenantId, input);
      expect(silence.matchers[0].type).toBe('regex');
    });

    it('should throw error for empty matchers', async () => {
      const input: CreateSilenceInput = {
        name: 'Bad Silence',
        matchers: [],
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      await expect(service.createSilence(tenantId, input)).rejects.toThrow(
        'Silence requires at least one matcher'
      );
    });

    it('should throw error when endsAt is before startsAt', async () => {
      const input: CreateSilenceInput = {
        name: 'Bad Time',
        matchers: [{ name: 'service', type: 'equal', value: 'svc' }],
        startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      await expect(service.createSilence(tenantId, input)).rejects.toThrow(
        'endsAt must be after startsAt'
      );
    });
  });

  // ==================== getActiveSilences ====================

  describe('getActiveSilences', () => {
    beforeEach(async () => {
      await service.createSilence(tenantId, {
        name: 'Active Silence',
        matchers: [{ name: 'service', type: 'equal', value: 'svc-a' }],
        endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      });

      // Expired silence
      await service.createSilence(tenantId, {
        name: 'Expired Silence',
        matchers: [{ name: 'service', type: 'equal', value: 'svc-b' }],
        startsAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() - 60 * 60 * 1000),
      });

      // Future silence
      await service.createSilence(tenantId, {
        name: 'Future Silence',
        matchers: [{ name: 'service', type: 'equal', value: 'svc-c' }],
        startsAt: new Date(Date.now() + 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      });
    });

    it('should return only active silences', async () => {
      const silences = await service.getActiveSilences(tenantId);
      expect(silences.length).toBe(1);
      expect(silences[0].name).toBe('Active Silence');
    });

    it('should not include expired silences', async () => {
      const silences = await service.getActiveSilences(tenantId);
      expect(silences.some((s) => s.name === 'Expired Silence')).toBe(false);
    });

    it('should not include future silences', async () => {
      const silences = await service.getActiveSilences(tenantId);
      expect(silences.some((s) => s.name === 'Future Silence')).toBe(false);
    });
  });

  // ==================== getAllSilences ====================

  describe('getAllSilences', () => {
    it('should return all silences including expired', async () => {
      await service.createSilence(tenantId, {
        name: 'Active',
        matchers: [{ name: 'service', type: 'equal', value: 'svc' }],
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      await service.createSilence(tenantId, {
        name: 'Expired',
        matchers: [{ name: 'service', type: 'equal', value: 'svc' }],
        startsAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() - 60 * 60 * 1000),
      });

      const all = await service.getAllSilences(tenantId);
      expect(all.length).toBe(2);
    });
  });

  // ==================== getSilenceById ====================

  describe('getSilenceById', () => {
    it('should return silence by ID', async () => {
      const created = await service.createSilence(tenantId, {
        name: 'Test Silence',
        matchers: [{ name: 'service', type: 'equal', value: 'svc' }],
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const silence = await service.getSilenceById(created.id);
      expect(silence).toBeDefined();
      expect(silence!.name).toBe('Test Silence');
    });

    it('should return undefined for non-existent ID', async () => {
      const silence = await service.getSilenceById('non-existent');
      expect(silence).toBeUndefined();
    });
  });

  // ==================== deleteSilence ====================

  describe('deleteSilence', () => {
    it('should delete a silence', async () => {
      const created = await service.createSilence(tenantId, {
        name: 'To Delete',
        matchers: [{ name: 'service', type: 'equal', value: 'svc' }],
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const deleted = await service.deleteSilence(created.id);
      expect(deleted).toBe(true);

      const silence = await service.getSilenceById(created.id);
      expect(silence).toBeUndefined();
    });

    it('should return false for non-existent silence', async () => {
      const result = await service.deleteSilence('non-existent');
      expect(result).toBe(false);
    });
  });

  // ==================== updateSilence ====================

  describe('updateSilence', () => {
    it('should update silence name', async () => {
      const created = await service.createSilence(tenantId, {
        name: 'Old Name',
        matchers: [{ name: 'service', type: 'equal', value: 'svc' }],
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const updated = await service.updateSilence(created.id, { name: 'New Name' });
      expect(updated).toBeDefined();
      expect(updated!.name).toBe('New Name');
    });

    it('should disable a silence', async () => {
      const created = await service.createSilence(tenantId, {
        name: 'Disable Me',
        matchers: [{ name: 'service', type: 'equal', value: 'svc' }],
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const updated = await service.updateSilence(created.id, { enabled: false });
      expect(updated!.enabled).toBe(false);
    });

    it('should return undefined for non-existent silence', async () => {
      const result = await service.updateSilence('non-existent', { name: 'New' });
      expect(result).toBeUndefined();
    });
  });

  // ==================== isAlertSilenced ====================

  describe('isAlertSilenced', () => {
    it('should return silenced when alert matches equal matcher', async () => {
      await service.createSilence(tenantId, {
        name: 'DB Silence',
        matchers: [{ name: 'service', type: 'equal', value: 'postgres-primary' }],
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const alert: AlertForSilenceCheck = {
        name: 'HighCPU',
        service: 'postgres-primary',
      };

      const result = await service.isAlertSilenced(alert, tenantId);
      expect(result.silenced).toBe(true);
      expect(result.silenceName).toBe('DB Silence');
    });

    it('should return silenced when alert matches regex matcher', async () => {
      await service.createSilence(tenantId, {
        name: 'Regex Silence',
        matchers: [{ name: 'severity', type: 'regex', value: 'critical|warning' }],
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const alert: AlertForSilenceCheck = {
        name: 'HighMemory',
        severity: 'critical',
      };

      const result = await service.isAlertSilenced(alert, tenantId);
      expect(result.silenced).toBe(true);
    });

    it('should return not silenced when alert does not match', async () => {
      await service.createSilence(tenantId, {
        name: 'Specific Silence',
        matchers: [{ name: 'service', type: 'equal', value: 'postgres-primary' }],
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const alert: AlertForSilenceCheck = {
        name: 'HighCPU',
        service: 'redis-cache',
      };

      const result = await service.isAlertSilenced(alert, tenantId);
      expect(result.silenced).toBe(false);
    });

    it('should not silence if silence is expired', async () => {
      await service.createSilence(tenantId, {
        name: 'Expired Silence',
        matchers: [{ name: 'service', type: 'equal', value: 'postgres-primary' }],
        startsAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() - 60 * 60 * 1000),
      });

      const alert: AlertForSilenceCheck = {
        name: 'HighCPU',
        service: 'postgres-primary',
      };

      const result = await service.isAlertSilenced(alert, tenantId);
      expect(result.silenced).toBe(false);
    });

    it('should match alertname matcher', async () => {
      await service.createSilence(tenantId, {
        name: 'Alert Name Silence',
        matchers: [{ name: 'alertname', type: 'equal', value: 'HighCPU' }],
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const alert: AlertForSilenceCheck = {
        name: 'HighCPU',
        service: 'api-gateway',
      };

      const result = await service.isAlertSilenced(alert, tenantId);
      expect(result.silenced).toBe(true);
    });

    it('should match labels', async () => {
      await service.createSilence(tenantId, {
        name: 'Label Silence',
        matchers: [{ name: 'environment', type: 'equal', value: 'staging' }],
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const alert: AlertForSilenceCheck = {
        name: 'HighCPU',
        service: 'api-gateway',
        labels: { environment: 'staging' },
      };

      const result = await service.isAlertSilenced(alert, tenantId);
      expect(result.silenced).toBe(true);
    });
  });

  // ==================== expireSilences ====================

  describe('expireSilences', () => {
    it('should clean up expired silences', async () => {
      await service.createSilence(tenantId, {
        name: 'Expired',
        matchers: [{ name: 'service', type: 'equal', value: 'svc' }],
        startsAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() - 60 * 60 * 1000),
      });

      const count = await service.expireSilences();
      expect(count).toBe(1);
    });

    it('should not remove active silences', async () => {
      await service.createSilence(tenantId, {
        name: 'Active',
        matchers: [{ name: 'service', type: 'equal', value: 'svc' }],
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const count = await service.expireSilences();
      expect(count).toBe(0);
    });
  });
});
