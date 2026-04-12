/**
 * TASK-801: TicketGenerator Unit Tests
 */

import { TicketGenerator } from '../TicketGenerator';

describe('TicketGenerator', () => {
  let generator: TicketGenerator;

  beforeEach(() => {
    generator = new TicketGenerator();
  });

  // ==================== generateFromAlert ====================

  describe('generateFromAlert', () => {
    it('should generate a ticket from a basic alert', () => {
      const ticket = generator.generateFromAlert({
        alertId: 'alert-1',
        metric: 'system.cpu.usage',
        severity: 'critical',
        message: 'CPU usage exceeded 95%',
        triggeredAt: new Date(),
      });

      expect(ticket.id).toMatch(/^TKT-/);
      expect(ticket.title).toContain('CRITICAL');
      expect(ticket.title).toContain('system.cpu.usage');
      expect(ticket.description).toContain('CPU usage exceeded 95%');
      expect(ticket.status).toBe('open');
      expect(ticket.source).toBe('alert');
      expect(ticket.sourceAlertId).toBe('alert-1');
      expect(ticket.escalationLevel).toBe(0);
    });

    it('should categorize infrastructure alerts', () => {
      const ticket = generator.generateFromAlert({
        alertId: 'alert-1',
        metric: 'system.cpu.usage',
        severity: 'warning',
        message: 'High CPU',
        tags: { host: 'server-1' },
        triggeredAt: new Date(),
      });

      expect(ticket.category).toBe('infrastructure');
    });

    it('should categorize database alerts', () => {
      const ticket = generator.generateFromAlert({
        alertId: 'alert-2',
        metric: 'db.connection_pool',
        severity: 'critical',
        message: 'Connection pool exhausted',
        triggeredAt: new Date(),
      });

      expect(ticket.category).toBe('database');
    });

    it('should categorize network alerts', () => {
      const ticket = generator.generateFromAlert({
        alertId: 'alert-3',
        metric: 'network.packet_loss',
        severity: 'warning',
        message: 'High packet loss detected',
        triggeredAt: new Date(),
      });

      expect(ticket.category).toBe('network');
    });

    it('should categorize security alerts', () => {
      const ticket = generator.generateFromAlert({
        alertId: 'alert-4',
        metric: 'auth.failed_attempts',
        severity: 'critical',
        message: 'Multiple unauthorized access attempts',
        triggeredAt: new Date(),
      });

      expect(ticket.category).toBe('security');
    });

    it('should assign priority based on severity', () => {
      const criticalTicket = generator.generateFromAlert({
        alertId: 'alert-c',
        metric: 'test',
        severity: 'critical',
        message: 'test',
        triggeredAt: new Date(),
      });

      const warningTicket = generator.generateFromAlert({
        alertId: 'alert-w',
        metric: 'test',
        severity: 'warning',
        message: 'test',
        triggeredAt: new Date(),
      });

      const infoTicket = generator.generateFromAlert({
        alertId: 'alert-i',
        metric: 'test',
        severity: 'info',
        message: 'test',
        triggeredAt: new Date(),
      });

      expect(criticalTicket.priority).toBe('critical');
      expect(warningTicket.priority).toBe('medium');
      expect(infoTicket.priority).toBe('low');
    });

    it('should boost priority for production tags', () => {
      const ticket = generator.generateFromAlert({
        alertId: 'alert-prod',
        metric: 'test.cpu',
        severity: 'warning',
        message: 'test',
        tags: { environment: 'production' },
        triggeredAt: new Date(),
      });

      expect(ticket.priority).toBe('high'); // Boosted from medium
    });

    it('should include metadata from alert', () => {
      const triggeredAt = new Date('2024-01-01');
      const ticket = generator.generateFromAlert({
        alertId: 'alert-1',
        metric: 'test.cpu',
        severity: 'warning',
        message: 'test',
        ruleName: 'High CPU Rule',
        tags: { env: 'prod' },
        triggeredAt,
      });

      expect(ticket.metadata).toBeDefined();
      expect(ticket.metadata?.metric).toBe('test.cpu');
      expect(ticket.metadata?.ruleName).toBe('High CPU Rule');
    });

    it('should use custom reporter', () => {
      const ticket = generator.generateFromAlert(
        {
          alertId: 'alert-1',
          metric: 'test',
          severity: 'warning',
          message: 'test',
          triggeredAt: new Date(),
        },
        'ops-team'
      );

      expect(ticket.reporter).toBe('ops-team');
    });
  });

  // ==================== generateFromIncident ====================

  describe('generateFromIncident', () => {
    it('should generate a ticket from an incident', () => {
      const ticket = generator.generateFromIncident({
        incidentId: 'inc-1',
        title: 'Service outage',
        description: 'Multiple services are down',
        severity: 'critical',
        affectedServices: ['api', 'web', 'db'],
        reporter: 'oncall-engine',
      });

      expect(ticket.id).toMatch(/^TKT-/);
      expect(ticket.title).toBe('Service outage');
      expect(ticket.description).toBe('Multiple services are down');
      expect(ticket.source).toBe('incident');
      expect(ticket.sourceIncidentId).toBe('inc-1');
      expect(ticket.reporter).toBe('oncall-engine');
    });

    it('should boost priority for multiple affected services', () => {
      const ticket = generator.generateFromIncident({
        incidentId: 'inc-2',
        title: 'API errors',
        description: 'test',
        severity: 'medium',
        affectedServices: ['api', 'web', 'db', 'cache', 'auth'],
        reporter: 'system',
      });

      expect(ticket.priority).toBe('high'); // Boosted from medium
    });

    it('should categorize based on incident content', () => {
      const ticket = generator.generateFromIncident({
        incidentId: 'inc-3',
        title: 'Database replication lag',
        description: 'Primary database replication is lagging',
        severity: 'high',
        reporter: 'system',
      });

      expect(ticket.category).toBe('database');
    });
  });

  // ==================== categorize ====================

  describe('categorize', () => {
    it('should categorize based on metric name', () => {
      const category = generator.categorize({
        metric: 'http.response.time',
        message: 'Slow API responses',
      });

      expect(category).toBe('application');
    });

    it('should categorize based on tags', () => {
      const category = generator.categorize({
        metric: 'custom.metric',
        tags: { component: 'ci', type: 'runner' },
      });

      expect(category).toBe('pipeline');
    });

    it('should categorize based on message', () => {
      const category = generator.categorize({
        message: 'SSL certificate expired for api.example.com',
      });

      expect(category).toBe('security');
    });

    it('should return other for unclassifiable input', () => {
      const category = generator.categorize({
        metric: 'xyz.abc',
        message: 'random text with no keywords',
      });

      expect(category).toBe('other');
    });
  });

  // ==================== assignPriority ====================

  describe('assignPriority', () => {
    it('should map severity to priority', () => {
      expect(generator.assignPriority('critical')).toBe('critical');
      expect(generator.assignPriority('high')).toBe('high');
      expect(generator.assignPriority('warning')).toBe('medium');
      expect(generator.assignPriority('medium')).toBe('medium');
      expect(generator.assignPriority('info')).toBe('low');
      expect(generator.assignPriority('low')).toBe('low');
    });

    it('should boost priority for high impact', () => {
      expect(generator.assignPriority('medium', 85)).toBe('critical');
      expect(generator.assignPriority('low', 65)).toBe('high');
    });

    it('should reduce priority for low impact', () => {
      expect(generator.assignPriority('critical', 10)).toBe('high');
      expect(generator.assignPriority('high', 10)).toBe('medium');
    });

    it('should handle unknown severity', () => {
      expect(generator.assignPriority('unknown' as any)).toBe('medium');
    });
  });
});
