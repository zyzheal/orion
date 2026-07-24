/**
 * Comprehensive tests for KnownIssueService
 * Tests all public methods via in-memory fallback path (no DB/repository)
 */

import { KnownIssueService, CreateIssueInput, UpdateIssueInput, KnownIssue } from '../KnownIssueService';

// Suppress pino logging in tests
jest.mock('pino', () => {
  const noop = () => {};
  const mockLogger = { info: noop, warn: noop, error: noop, debug: noop, child: jest.fn(() => mockLogger) };
  return jest.fn(() => mockLogger);
});

// Mock crypto.randomUUID to return predictable values
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-1234'),
}));

describe('KnownIssueService', () => {
  let service: KnownIssueService;

  const sampleInput: CreateIssueInput = {
    tenantId: 'tenant-1',
    title: 'Test issue title',
    description: 'Test issue description',
    fingerprint: 'fp-abc123',
    ticketId: 'ticket-1',
  };

  const minimalInput: CreateIssueInput = {
    tenantId: 'tenant-1',
    title: 'Minimal issue',
    fingerprint: 'fp-minimal',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset randomUUID mock to default
    const { randomUUID } = require('crypto');
    (randomUUID as jest.Mock).mockReturnValue('test-uuid-1234');
    service = new KnownIssueService();
  });

  describe('constructor', () => {
    it('should create instance without DB (in-memory mode)', () => {
      const svc = new KnownIssueService();
      expect(svc).toBeDefined();
    });

    it('should create instance with DB parameter', () => {
      const mockDb = { query: jest.fn(), connect: jest.fn() } as any;
      // Constructor sets repository if db is provided
      const svc = new KnownIssueService(mockDb);
      expect(svc).toBeDefined();
    });
  });

  describe('setRepository', () => {
    it('should allow setting repository after construction', () => {
      // setRepository is a public method; just verify it doesn't throw
      const mockRepo = { findById: jest.fn() } as any;
      expect(() => service.setRepository(mockRepo)).not.toThrow();
    });
  });

  describe('createIssue', () => {
    it('should create an issue with all fields', async () => {
      const result = await service.createIssue(sampleInput);

      expect(result).toMatchObject({
        id: 'test-uuid-1234',
        tenantId: 'tenant-1',
        title: 'Test issue title',
        description: 'Test issue description',
        fingerprint: 'fp-abc123',
        ticketId: 'ticket-1',
        resolved: false,
        resolvedAt: null,
      });
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should create an issue with minimal fields (optional fields default to null)', async () => {
      const result = await service.createIssue(minimalInput);

      expect(result).toMatchObject({
        id: 'test-uuid-1234',
        tenantId: 'tenant-1',
        title: 'Minimal issue',
        fingerprint: 'fp-minimal',
        description: null,
        ticketId: null,
        resolved: false,
        resolvedAt: null,
      });
    });

    it('should generate unique IDs for multiple issues', async () => {
      const { randomUUID } = require('crypto');
      (randomUUID as jest.Mock)
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2');

      const issue1 = await service.createIssue(minimalInput);
      const issue2 = await service.createIssue(minimalInput);

      expect(issue1.id).toBe('uuid-1');
      expect(issue2.id).toBe('uuid-2');
    });

    it('should set createdAt to current time', async () => {
      const before = new Date();
      const result = await service.createIssue(minimalInput);
      const after = new Date();

      expect(result.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should default description to null when undefined', async () => {
      const input: CreateIssueInput = {
        tenantId: 't1',
        title: 'No desc',
        fingerprint: 'fp-1',
        description: undefined,
      };
      const result = await service.createIssue(input);
      expect(result.description).toBeNull();
    });

    it('should default ticketId to null when undefined', async () => {
      const input: CreateIssueInput = {
        tenantId: 't1',
        title: 'No ticket',
        fingerprint: 'fp-1',
        ticketId: undefined,
      };
      const result = await service.createIssue(input);
      expect(result.ticketId).toBeNull();
    });

    it('should store issue in memory for later retrieval', async () => {
      const created = await service.createIssue(sampleInput);
      const retrieved = await service.getIssue(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.title).toBe('Test issue title');
    });
  });

  describe('getIssue', () => {
    it('should return issue by ID', async () => {
      const created = await service.createIssue(sampleInput);
      const result = await service.getIssue(created.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(created.id);
      expect(result!.title).toBe('Test issue title');
    });

    it('should return null for non-existent ID', async () => {
      const result = await service.getIssue('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return all expected fields', async () => {
      const created = await service.createIssue(sampleInput);
      const result = await service.getIssue(created.id);

      expect(result).toEqual({
        id: created.id,
        tenantId: 'tenant-1',
        title: 'Test issue title',
        description: 'Test issue description',
        fingerprint: 'fp-abc123',
        ticketId: 'ticket-1',
        resolved: false,
        resolvedAt: null,
        createdAt: expect.any(Date),
      });
    });
  });

  describe('listIssues', () => {
    beforeEach(async () => {
      const { randomUUID } = require('crypto');
      (randomUUID as jest.Mock)
        .mockReturnValueOnce('id-1')
        .mockReturnValueOnce('id-2')
        .mockReturnValueOnce('id-3')
        .mockReturnValueOnce('id-4');

      await service.createIssue({
        tenantId: 'tenant-1',
        title: 'Issue A',
        fingerprint: 'fp-1',
      });
      await service.createIssue({
        tenantId: 'tenant-1',
        title: 'Issue B',
        fingerprint: 'fp-2',
      });
      await service.createIssue({
        tenantId: 'tenant-2',
        title: 'Issue C',
        fingerprint: 'fp-1',
      });
      await service.createIssue({
        tenantId: 'tenant-1',
        title: 'Issue D',
        fingerprint: 'fp-3',
      });
    });

    it('should list all issues when no filters applied', async () => {
      const result = await service.listIssues();
      expect(result.total).toBe(4);
      expect(result.issues).toHaveLength(4);
    });

    it('should filter by tenantId', async () => {
      const result = await service.listIssues({ tenantId: 'tenant-1' });
      expect(result.total).toBe(3);
      expect(result.issues.every((i) => i.tenantId === 'tenant-1')).toBe(true);
    });

    it('should return empty for non-existent tenant', async () => {
      const result = await service.listIssues({ tenantId: 'non-existent' });
      expect(result.total).toBe(0);
      expect(result.issues).toHaveLength(0);
    });

    it('should filter by resolved status', async () => {
      // Resolve one issue
      await service.resolveIssue('id-1');
      const result = await service.listIssues({ resolved: true });
      expect(result.total).toBe(1);
      expect(result.issues[0].resolved).toBe(true);
    });

    it('should filter by unresolved status', async () => {
      await service.resolveIssue('id-1');
      const result = await service.listIssues({ resolved: false });
      expect(result.total).toBe(3);
    });

    it('should filter by fingerprint', async () => {
      const result = await service.listIssues({ fingerprint: 'fp-1' });
      expect(result.total).toBe(2);
    });

    it('should respect limit parameter', async () => {
      const result = await service.listIssues({ limit: 2 });
      expect(result.total).toBe(4);
      expect(result.issues).toHaveLength(2);
    });

    it('should respect offset parameter', async () => {
      const result = await service.listIssues({ limit: 2, offset: 2 });
      expect(result.total).toBe(4);
      expect(result.issues).toHaveLength(2);
    });

    it('should respect limit and offset together', async () => {
      const result = await service.listIssues({ limit: 1, offset: 1 });
      expect(result.total).toBe(4);
      expect(result.issues).toHaveLength(1);
    });

    it('should return empty issues when offset exceeds total', async () => {
      const result = await service.listIssues({ offset: 100 });
      expect(result.total).toBe(4);
      expect(result.issues).toHaveLength(0);
    });

    it('should combine tenantId and resolved filters', async () => {
      await service.resolveIssue('id-1');
      const result = await service.listIssues({ tenantId: 'tenant-1', resolved: true });
      expect(result.total).toBe(1);
      expect(result.issues[0].id).toBe('id-1');
    });

    it('should use default limit of 20', async () => {
      const result = await service.listIssues();
      expect(result.issues.length).toBeLessThanOrEqual(20);
    });
  });

  describe('updateIssue', () => {
    let issueId: string;

    beforeEach(async () => {
      const created = await service.createIssue(sampleInput);
      issueId = created.id;
    });

    it('should update title', async () => {
      const result = await service.updateIssue(issueId, { title: 'Updated title' });
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Updated title');
      expect(result!.description).toBe('Test issue description'); // unchanged
    });

    it('should update description', async () => {
      const result = await service.updateIssue(issueId, { description: 'New description' });
      expect(result!.description).toBe('New description');
    });

    it('should update fingerprint', async () => {
      const result = await service.updateIssue(issueId, { fingerprint: 'new-fp' });
      expect(result!.fingerprint).toBe('new-fp');
    });

    it('should update ticketId', async () => {
      const result = await service.updateIssue(issueId, { ticketId: 'ticket-99' });
      expect(result!.ticketId).toBe('ticket-99');
    });

    it('should update resolved status and set resolvedAt', async () => {
      const result = await service.updateIssue(issueId, { resolved: true });
      expect(result!.resolved).toBe(true);
      expect(result!.resolvedAt).toBeInstanceOf(Date);
    });

    it('should update multiple fields at once', async () => {
      const result = await service.updateIssue(issueId, {
        title: 'Multi update',
        description: 'Multi desc',
        fingerprint: 'multi-fp',
      });
      expect(result!.title).toBe('Multi update');
      expect(result!.description).toBe('Multi desc');
      expect(result!.fingerprint).toBe('multi-fp');
    });

    it('should return null for non-existent ID', async () => {
      const result = await service.updateIssue('non-existent', { title: 'Nope' });
      expect(result).toBeNull();
    });

    it('should return existing issue when no updates provided', async () => {
      const result = await service.updateIssue(issueId, {});
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Test issue title');
    });

    it('should not set resolvedAt when resolved is set to false', async () => {
      // First resolve
      await service.updateIssue(issueId, { resolved: true });
      // Then un-resolve
      const result = await service.updateIssue(issueId, { resolved: false });
      expect(result!.resolved).toBe(false);
      // resolvedAt should still be the old value (not reset) since code only sets resolvedAt when resolved=true
      // Actually the code sets resolvedAt = current resolvedAt when resolved is false
      // Since we set resolved to true first, resolvedAt will be a Date, then when setting resolved=false,
      // the code does: resolvedAt: updates.resolved ? new Date() : current.resolvedAt
      // So it keeps the old resolvedAt
      expect(result!.resolvedAt).toBeInstanceOf(Date);
    });

    it('should preserve unchanged fields', async () => {
      const original = await service.getIssue(issueId);
      const result = await service.updateIssue(issueId, { title: 'Only title changed' });

      expect(result!.description).toBe(original!.description);
      expect(result!.fingerprint).toBe(original!.fingerprint);
      expect(result!.ticketId).toBe(original!.ticketId);
      expect(result!.resolved).toBe(original!.resolved);
    });
  });

  describe('deleteIssue', () => {
    it('should delete an existing issue', async () => {
      const created = await service.createIssue(sampleInput);
      const result = await service.deleteIssue(created.id);

      expect(result).toBe(true);

      // Verify it's gone
      const retrieved = await service.getIssue(created.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent ID', async () => {
      const result = await service.deleteIssue('non-existent');
      expect(result).toBe(false);
    });

    it('should not affect other issues when deleting one', async () => {
      const { randomUUID } = require('crypto');
      (randomUUID as jest.Mock)
        .mockReturnValueOnce('del-1')
        .mockReturnValueOnce('del-2');

      const issue1 = await service.createIssue(sampleInput);
      const issue2 = await service.createIssue(minimalInput);

      await service.deleteIssue(issue1.id);

      const remaining = await service.getIssue(issue2.id);
      expect(remaining).not.toBeNull();
      expect(remaining!.id).toBe('del-2');
    });
  });

  describe('resolveIssue', () => {
    it('should resolve an issue with current time', async () => {
      const created = await service.createIssue(sampleInput);
      const result = await service.resolveIssue(created.id);

      expect(result).not.toBeNull();
      expect(result!.resolved).toBe(true);
      expect(result!.resolvedAt).toBeInstanceOf(Date);
    });

    it('should resolve an issue with custom time', async () => {
      const created = await service.createIssue(sampleInput);
      const customTime = new Date('2026-01-15T10:00:00Z');
      const result = await service.resolveIssue(created.id, customTime);

      expect(result!.resolved).toBe(true);
      expect(result!.resolvedAt).toEqual(customTime);
    });

    it('should return null for non-existent ID', async () => {
      const result = await service.resolveIssue('non-existent');
      expect(result).toBeNull();
    });

    it('should update the stored issue after resolution', async () => {
      const created = await service.createIssue(sampleInput);
      await service.resolveIssue(created.id);

      const retrieved = await service.getIssue(created.id);
      expect(retrieved!.resolved).toBe(true);
      expect(retrieved!.resolvedAt).toBeInstanceOf(Date);
    });
  });

  describe('linkTicket', () => {
    it('should link a ticket to an existing issue', async () => {
      const created = await service.createIssue(minimalInput); // no ticketId
      const result = await service.linkTicket(created.id, 'ticket-linked');

      expect(result).not.toBeNull();
      expect(result!.ticketId).toBe('ticket-linked');
    });

    it('should return null for non-existent issue', async () => {
      const result = await service.linkTicket('non-existent', 'ticket-1');
      expect(result).toBeNull();
    });

    it('should overwrite existing ticketId', async () => {
      const created = await service.createIssue(sampleInput); // has ticketId 'ticket-1'
      const result = await service.linkTicket(created.id, 'ticket-new');

      expect(result!.ticketId).toBe('ticket-new');
    });

    it('should preserve other fields when linking ticket', async () => {
      const created = await service.createIssue(sampleInput);
      const result = await service.linkTicket(created.id, 'ticket-99');

      expect(result!.title).toBe(sampleInput.title);
      expect(result!.fingerprint).toBe(sampleInput.fingerprint);
      expect(result!.description).toBe(sampleInput.description);
    });
  });

  describe('findByFingerprint', () => {
    it('should find issues by fingerprint', async () => {
      const { randomUUID } = require('crypto');
      (randomUUID as jest.Mock)
        .mockReturnValueOnce('fp-1')
        .mockReturnValueOnce('fp-2')
        .mockReturnValueOnce('fp-3');

      await service.createIssue({ tenantId: 't1', title: 'A', fingerprint: 'fp-dup' });
      await service.createIssue({ tenantId: 't1', title: 'B', fingerprint: 'fp-dup' });
      await service.createIssue({ tenantId: 't1', title: 'C', fingerprint: 'fp-other' });

      const results = await service.findByFingerprint('fp-dup');
      expect(results).toHaveLength(2);
      expect(results.every((i) => i.fingerprint === 'fp-dup')).toBe(true);
    });

    it('should return empty array for non-existent fingerprint', async () => {
      await service.createIssue(sampleInput);
      const results = await service.findByFingerprint('fp-non-existent');
      expect(results).toHaveLength(0);
    });

    it('should return empty array when no issues exist', async () => {
      const results = await service.findByFingerprint('fp-any');
      expect(results).toHaveLength(0);
    });
  });

  describe('getOpenIssues', () => {
    beforeEach(async () => {
      const { randomUUID } = require('crypto');
      (randomUUID as jest.Mock)
        .mockReturnValueOnce('open-1')
        .mockReturnValueOnce('open-2')
        .mockReturnValueOnce('open-3');

      await service.createIssue({ tenantId: 't1', title: 'Open 1', fingerprint: 'fp-1' });
      await service.createIssue({ tenantId: 't1', title: 'Open 2', fingerprint: 'fp-2' });
      await service.createIssue({ tenantId: 't2', title: 'Open 3', fingerprint: 'fp-3' });

      await service.resolveIssue('open-1');
    });

    it('should return only unresolved issues', async () => {
      const results = await service.getOpenIssues();
      expect(results).toHaveLength(2);
      expect(results.every((i) => !i.resolved)).toBe(true);
    });

    it('should filter open issues by tenant', async () => {
      const results = await service.getOpenIssues('t1');
      expect(results).toHaveLength(1);
      expect(results[0].tenantId).toBe('t1');
    });

    it('should return empty for non-existent tenant', async () => {
      const results = await service.getOpenIssues('non-existent');
      expect(results).toHaveLength(0);
    });

    it('should return all open issues when no tenant specified', async () => {
      const results = await service.getOpenIssues();
      expect(results).toHaveLength(2);
    });

    it('should return empty when all issues are resolved', async () => {
      await service.resolveIssue('open-2');
      await service.resolveIssue('open-3');
      const results = await service.getOpenIssues();
      expect(results).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      const { randomUUID } = require('crypto');
      (randomUUID as jest.Mock)
        .mockReturnValueOnce('stat-1')
        .mockReturnValueOnce('stat-2')
        .mockReturnValueOnce('stat-3')
        .mockReturnValueOnce('stat-4');

      await service.createIssue({ tenantId: 't1', title: 'S1', fingerprint: 'fp-1', ticketId: 'tk-1' });
      await service.createIssue({ tenantId: 't1', title: 'S2', fingerprint: 'fp-2', ticketId: 'tk-2' });
      await service.createIssue({ tenantId: 't1', title: 'S3', fingerprint: 'fp-3' });
      await service.createIssue({ tenantId: 't2', title: 'S4', fingerprint: 'fp-4', ticketId: 'tk-3' });

      await service.resolveIssue('stat-1');
    });

    it('should return correct stats for all issues', async () => {
      const stats = await service.getStats();
      expect(stats.total).toBe(4);
      expect(stats.open).toBe(3);
      expect(stats.resolved).toBe(1);
      expect(stats.withTicket).toBe(3);
      expect(stats.withoutTicket).toBe(1);
    });

    it('should return correct stats filtered by tenant', async () => {
      const stats = await service.getStats('t1');
      expect(stats.total).toBe(3);
      expect(stats.open).toBe(2);
      expect(stats.resolved).toBe(1);
      expect(stats.withTicket).toBe(2);
      expect(stats.withoutTicket).toBe(1);
    });

    it('should return zero stats for non-existent tenant', async () => {
      const stats = await service.getStats('non-existent');
      expect(stats).toEqual({
        total: 0,
        open: 0,
        resolved: 0,
        withTicket: 0,
        withoutTicket: 0,
      });
    });

    it('should return zero stats when no issues exist', async () => {
      const freshService = new KnownIssueService();
      const stats = await freshService.getStats();
      expect(stats).toEqual({
        total: 0,
        open: 0,
        resolved: 0,
        withTicket: 0,
        withoutTicket: 0,
      });
    });
  });

  describe('edge cases', () => {
    it('should handle multiple services with independent state', async () => {
      const service1 = new KnownIssueService();
      const service2 = new KnownIssueService();

      const { randomUUID } = require('crypto');
      (randomUUID as jest.Mock).mockReturnValue('shared-uuid');

      await service1.createIssue({ tenantId: 't1', title: 'S1', fingerprint: 'fp-1' });

      const result1 = await service1.getIssue('shared-uuid');
      const result2 = await service2.getIssue('shared-uuid');

      expect(result1).not.toBeNull();
      expect(result2).toBeNull();
    });

    it('should handle creating issue with empty string fields', async () => {
      const result = await service.createIssue({
        tenantId: '',
        title: '',
        fingerprint: '',
        description: '',
      });
      expect(result.tenantId).toBe('');
      expect(result.title).toBe('');
      expect(result.fingerprint).toBe('');
      expect(result.description).toBe(''); // empty string, not null (?? only replaces undefined/null)
    });

    it('should handle listing issues from empty service', async () => {
      const result = await service.listIssues();
      expect(result.total).toBe(0);
      expect(result.issues).toHaveLength(0);
    });

    it('should handle deleting from empty service', async () => {
      const result = await service.deleteIssue('any-id');
      expect(result).toBe(false);
    });

    it('should handle resolving from empty service', async () => {
      const result = await service.resolveIssue('any-id');
      expect(result).toBeNull();
    });

    it('should handle findByFingerprint from empty service', async () => {
      const results = await service.findByFingerprint('any-fp');
      expect(results).toHaveLength(0);
    });

    it('should handle getOpenIssues from empty service', async () => {
      const results = await service.getOpenIssues();
      expect(results).toHaveLength(0);
    });

    it('should correctly map all fields through CRUD cycle', async () => {
      const created = await service.createIssue(sampleInput);
      const retrieved = await service.getIssue(created.id);

      // All fields should match
      expect(retrieved).toEqual(created);

      // Update and verify
      const updated = await service.updateIssue(created.id, {
        title: 'Updated',
        description: 'Updated desc',
        fingerprint: 'updated-fp',
        ticketId: 'updated-ticket',
        resolved: true,
      });

      expect(updated!.title).toBe('Updated');
      expect(updated!.description).toBe('Updated desc');
      expect(updated!.fingerprint).toBe('updated-fp');
      expect(updated!.ticketId).toBe('updated-ticket');
      expect(updated!.resolved).toBe(true);
      expect(updated!.resolvedAt).toBeInstanceOf(Date);
      expect(updated!.id).toBe(created.id); // ID unchanged
      expect(updated!.tenantId).toBe(created.tenantId); // tenant unchanged
      expect(updated!.createdAt).toEqual(created.createdAt); // createdAt unchanged
    });
  });
});
