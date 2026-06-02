/**
 * TicketingRepository - 数据仓库层单元测试
 *
 * 测试覆盖: 工单CRUD、评论、分配、关系、调度规则、转移、挂起、工作流历史、SLA、工程师档案
 */

import { TicketingRepository } from '../TicketingRepository';

describe('TicketingRepository', () => {
  let mockDb: { query: jest.Mock };
  let repository: TicketingRepository;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repository = new TicketingRepository(mockDb as any);
  });

  // ==================== Ticket CRUD ====================

  describe('findById', () => {
    it('should return ticket by id', async () => {
      const mockTicket = { id: 'ticket-1', title: 'Test ticket', status: 'open' };
      mockDb.query.mockResolvedValue({ rows: [mockTicket] });

      const result = await repository.findById('ticket-1');

      expect(result).toEqual(mockTicket);
      expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM tickets WHERE id = $1', ['ticket-1']);
    });

    it('should return null when ticket not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all tickets without filter', async () => {
      const mockTickets = [{ id: 't1' }, { id: 't2' }];
      mockDb.query.mockResolvedValue({ rows: mockTickets });

      const result = await repository.findAll();

      expect(result).toEqual(mockTickets);
    });

    it('should filter by tenantId', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ tenantId: 'tenant-1' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['tenant-1']
      );
    });

    it('should filter by status', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ status: 'open' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $1'),
        ['open']
      );
    });

    it('should filter by assigneeId', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ assigneeId: 'user-1' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('assignee_id = $1'),
        ['user-1']
      );
    });

    it('should filter by priority', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ priority: 'high' });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('priority = $1'),
        ['high']
      );
    });

    it('should apply limit and offset', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAll({ limit: 10, offset: 20 });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1 OFFSET $2'),
        [10, 20]
      );
    });
  });

  describe('count', () => {
    it('should return total count without filter', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '42' }] });

      const result = await repository.count();

      expect(result).toBe(42);
    });

    it('should return filtered count', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '5' }] });

      const result = await repository.count({ tenantId: 't1', status: 'open' });

      expect(result).toBe(5);
    });
  });

  describe('create', () => {
    it('should create a ticket with all fields', async () => {
      const mockTicket = {
        id: 'ticket-1',
        tenant_id: 't1',
        title: 'Test ticket',
        description: 'Description',
        type: 'incident',
        priority: 'high',
        reporter_id: 'user-1',
        source: 'slack',
        source_id: 'msg-123',
        tags: ['bug', 'urgent'],
        status: 'open',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockTicket] });

      const result = await repository.create({
        tenant_id: 't1',
        title: 'Test ticket',
        description: 'Description',
        type: 'incident',
        priority: 'high',
        reporter_id: 'user-1',
        source: 'slack',
        source_id: 'msg-123',
        tags: ['bug', 'urgent'],
      });

      expect(result).toEqual(mockTicket);
    });

    it('should create ticket with minimal fields', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'ticket-1' }] });

      await repository.create({
        tenant_id: 't1',
        title: 'Test ticket',
      });

      const callArgs = mockDb.query.mock.calls[0];
      const params = callArgs[1];
      expect(params[2]).toBeNull(); // description
      expect(params[3]).toBe('incident'); // default type
      expect(params[4]).toBe('medium'); // default priority
    });
  });

  describe('update', () => {
    it('should update ticket title', async () => {
      const mockUpdated = { id: 'ticket-1', title: 'Updated title' };
      mockDb.query.mockResolvedValue({ rows: [mockUpdated] });

      const result = await repository.update('ticket-1', { title: 'Updated title' });

      expect(result).toEqual(mockUpdated);
    });

    it('should update ticket status to resolved', async () => {
      const mockUpdated = { id: 'ticket-1', status: 'resolved', resolved_at: new Date() };
      mockDb.query.mockResolvedValue({ rows: [mockUpdated] });

      const result = await repository.update('ticket-1', { status: 'resolved' });

      expect(result).toEqual(mockUpdated);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('resolved_at'),
        expect.arrayContaining(['resolved', expect.any(Date), 'ticket-1'])
      );
    });

    it('should return current ticket when no updates provided', async () => {
      const mockTicket = { id: 'ticket-1', title: 'Test' };
      mockDb.query.mockResolvedValue({ rows: [mockTicket] });

      const result = await repository.update('ticket-1', {});

      expect(result).toEqual(mockTicket);
    });

    it('should return null when ticket not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.update('non-existent', { title: 'New' });

      expect(result).toBeNull();
    });
  });

  // ==================== Comments ====================

  describe('addComment', () => {
    it('should add a comment to ticket', async () => {
      const mockComment = {
        id: 'comment-1',
        ticket_id: 'ticket-1',
        author_id: 'user-1',
        content: 'Test comment',
        is_internal: false,
        created_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockComment] });

      const result = await repository.addComment('ticket-1', 'user-1', 'Test comment');

      expect(result).toEqual(mockComment);
    });

    it('should add internal comment', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'comment-1' }] });

      await repository.addComment('ticket-1', 'user-1', 'Internal note', true);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ticket_comments'),
        ['ticket-1', 'user-1', 'Internal note', true]
      );
    });

    it('should add comment with null author', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'comment-1' }] });

      await repository.addComment('ticket-1', null, 'System comment');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ticket_comments'),
        ['ticket-1', null, 'System comment', false]
      );
    });
  });

  describe('getComments', () => {
    it('should return comments for ticket', async () => {
      const mockComments = [{ id: 'c1' }, { id: 'c2' }];
      mockDb.query.mockResolvedValue({ rows: mockComments });

      const result = await repository.getComments('ticket-1');

      expect(result).toEqual(mockComments);
    });

    it('should return empty array when no comments', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.getComments('ticket-1');

      expect(result).toEqual([]);
    });
  });

  // ==================== Assignments ====================

  describe('createAssignment', () => {
    it('should create an assignment', async () => {
      const mockAssignment = {
        id: 'ASGN-123',
        ticket_id: 'ticket-1',
        assignee_id: 'user-1',
        assigned_by: 'admin',
        assigned_at: new Date(),
        reason: 'Manual assignment',
        match_score: 0.95,
      };
      mockDb.query.mockResolvedValue({ rows: [mockAssignment] });

      const result = await repository.createAssignment({
        ticketId: 'ticket-1',
        assignee: 'user-1',
        assignedBy: 'admin',
        reason: 'Manual assignment',
        matchScore: 0.95,
      });

      expect(result.id).toBeDefined();
      expect(result.ticketId).toBe('ticket-1');
      expect(result.assignee).toBe('user-1');
    });
  });

  describe('getAssignmentsByTicket', () => {
    it('should return assignments for ticket', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'a1', ticket_id: 'ticket-1' }] });

      const result = await repository.getAssignmentsByTicket('ticket-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('getAssignmentsByAssignee', () => {
    it('should return assignments for assignee', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'a1', assignee_id: 'user-1' }] });

      const result = await repository.getAssignmentsByAssignee('user-1');

      expect(result).toHaveLength(1);
    });

    it('should apply limit', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getAssignmentsByAssignee('user-1', 10);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2'),
        ['user-1', 10]
      );
    });
  });

  // ==================== Relations ====================

  describe('createRelation', () => {
    it('should create a relation', async () => {
      const mockRelation = {
        id: 'REL-123',
        ticket_id: 'ticket-1',
        related_ticket_id: 'ticket-2',
        relation_type: 'blocks',
        confidence: 0.9,
        description: 'Blocks deployment',
        created_by: 'user-1',
        created_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRelation] });

      const result = await repository.createRelation({
        ticketId: 'ticket-1',
        relatedTicketId: 'ticket-2',
        relationType: 'blocks',
        createdBy: 'user-1',
        description: 'Blocks deployment',
        confidence: 0.9,
      });

      expect(result.id).toBeDefined();
      expect(result.ticketId).toBe('ticket-1');
      expect(result.relatedTicketId).toBe('ticket-2');
    });
  });

  describe('getRelationsByTicket', () => {
    it('should return relations for ticket', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'r1' }] });

      const result = await repository.getRelationsByTicket('ticket-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('getAllRelations', () => {
    it('should return all relations', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'r1' }, { id: 'r2' }] });

      const result = await repository.getAllRelations();

      expect(result).toHaveLength(2);
    });
  });

  describe('deleteRelation', () => {
    it('should delete an existing relation', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.deleteRelation('rel-1');

      expect(result).toBe(true);
    });

    it('should return false when relation not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.deleteRelation('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('findExistingRelation', () => {
    it('should find existing relation', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'r1' }] });

      const result = await repository.findExistingRelation('ticket-1', 'ticket-2');

      expect(result).toBeDefined();
    });

    it('should return null when no relation exists', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findExistingRelation('ticket-1', 'ticket-2');

      expect(result).toBeNull();
    });
  });

  // ==================== Dispatch Rules ====================

  describe('createDispatchRule', () => {
    it('should create a dispatch rule', async () => {
      const mockRule = {
        id: 'DR-123',
        name: 'High priority rule',
        conditions: { priority: 'high' },
        assignee_id: 'user-1',
        rule_priority: 1,
        enabled: true,
      };
      mockDb.query.mockResolvedValue({ rows: [mockRule] });

      const result = await repository.createDispatchRule({
        name: 'High priority rule',
        conditions: { priority: 'high' },
        assignee: 'user-1',
        priority: 1,
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe('High priority rule');
    });
  });

  describe('getAllDispatchRules', () => {
    it('should return all dispatch rules', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'dr1' }] });

      const result = await repository.getAllDispatchRules();

      expect(result).toHaveLength(1);
    });
  });

  describe('getActiveDispatchRules', () => {
    it('should return active dispatch rules', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'dr1', enabled: true }] });

      const result = await repository.getActiveDispatchRules();

      expect(result).toHaveLength(1);
    });
  });

  describe('updateDispatchRule', () => {
    it('should update dispatch rule', async () => {
      const mockUpdated = { id: 'dr-1', name: 'Updated rule' };
      mockDb.query.mockResolvedValue({ rows: [mockUpdated] });

      const result = await repository.updateDispatchRule('dr-1', { name: 'Updated rule' });

      expect(result).toBeDefined();
    });

    it('should return null when no updates provided', async () => {
      const result = await repository.updateDispatchRule('dr-1', {});

      expect(result).toBeNull();
    });

    it('should return null when rule not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.updateDispatchRule('non-existent', { name: 'New' });

      expect(result).toBeNull();
    });
  });

  describe('deleteDispatchRule', () => {
    it('should delete an existing rule', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.deleteDispatchRule('dr-1');

      expect(result).toBe(true);
    });

    it('should return false when rule not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.deleteDispatchRule('non-existent');

      expect(result).toBe(false);
    });
  });

  // ==================== Transfers ====================

  describe('createTransfer', () => {
    it('should create a transfer', async () => {
      const mockTransfer = {
        id: 'XFER-123',
        ticket_id: 'ticket-1',
        from_engineer_id: 'user-1',
        to_engineer_id: 'user-2',
        transfer_type: 'manual',
        reason: 'Workload',
        initiated_by: 'admin',
        transferred_at: new Date(),
        hold_duration_ms: null,
        accepted: true,
      };
      mockDb.query.mockResolvedValue({ rows: [mockTransfer] });

      const result = await repository.createTransfer({
        ticketId: 'ticket-1',
        fromEngineer: 'user-1',
        toEngineer: 'user-2',
        transferType: 'manual',
        reason: 'Workload',
        initiatedBy: 'admin',
      });

      expect(result.id).toBeDefined();
      expect(result.ticketId).toBe('ticket-1');
    });
  });

  describe('getTransfersByTicket', () => {
    it('should return transfers for ticket', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'x1' }] });

      const result = await repository.getTransfersByTicket('ticket-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('getTransfersByEngineer', () => {
    it('should return transfers from and to engineer', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'x1' }] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'x2' }] });

      const result = await repository.getTransfersByEngineer('user-1');

      expect(result.transferredFrom).toHaveLength(1);
      expect(result.transferredTo).toHaveLength(1);
    });
  });

  describe('countTransfersByTicket', () => {
    it('should return transfer count', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '3' }] });

      const result = await repository.countTransfersByTicket('ticket-1');

      expect(result).toBe(3);
    });
  });

  describe('getTransferStats', () => {
    it('should return transfer statistics', async () => {
      const mockStats = {
        total: '10',
        manual: '5',
        auto_timeout: '2',
        escalation: '2',
        backup: '1',
        avg_hold_time_ms: '5000',
      };
      mockDb.query.mockResolvedValue({ rows: [mockStats] });

      const result = await repository.getTransferStats();

      expect(result).toEqual(mockStats);
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      mockDb.query.mockResolvedValue({ rows: [{}] });

      await repository.getTransferStats(startDate, endDate);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('transferred_at >= $1'),
        expect.arrayContaining([startDate, endDate])
      );
    });
  });

  // ==================== Suspensions ====================

  describe('createSuspend', () => {
    it('should create an active suspension', async () => {
      const mockSuspend = {
        id: 'SUSP-123',
        engineer_id: 'user-1',
        reason: 'vacation',
        status: 'active',
        start_time: new Date('2026-01-01'),
        end_time: new Date('2026-01-15'),
        backup_engineer_id: 'user-2',
        auto_reassign: true,
        pause_sla: false,
        notes: 'Annual leave',
        created_by: 'admin',
        created_at: new Date(),
        tickets_reassigned: 0,
      };
      mockDb.query.mockResolvedValue({ rows: [mockSuspend] });

      const result = await repository.createSuspend({
        engineerId: 'user-1',
        reason: 'vacation',
        startTime: new Date('2026-01-01'),
        endTime: new Date('2026-01-15'),
        backupEngineerId: 'user-2',
        createdBy: 'admin',
        notes: 'Annual leave',
      });

      expect(result.id).toBeDefined();
      expect(result.engineerId).toBe('user-1');
    });
  });

  describe('findSuspendById', () => {
    it('should return suspension by id', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 's1' }] });

      const result = await repository.findSuspendById('s1');

      expect(result).toBeDefined();
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findSuspendById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateSuspendStatus', () => {
    it('should update suspension status', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 's1', status: 'completed' }] });

      const result = await repository.updateSuspendStatus('s1', 'completed');

      expect(result).toBeDefined();
    });

    it('should update with actual end time', async () => {
      const endTime = new Date();
      mockDb.query.mockResolvedValue({ rows: [{ id: 's1' }] });

      await repository.updateSuspendStatus('s1', 'completed', endTime);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('actual_end_time'),
        expect.arrayContaining(['completed', endTime, 's1'])
      );
    });
  });

  describe('getActiveSuspensions', () => {
    it('should return active suspensions', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 's1', status: 'active' }] });

      const result = await repository.getActiveSuspensions();

      expect(result).toHaveLength(1);
    });
  });

  describe('getScheduledSuspensions', () => {
    it('should return scheduled suspensions', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 's1', status: 'scheduled' }] });

      const result = await repository.getScheduledSuspensions();

      expect(result).toHaveLength(1);
    });
  });

  describe('getSuspensionsByEngineer', () => {
    it('should return suspensions for engineer', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 's1' }] });

      const result = await repository.getSuspensionsByEngineer('user-1');

      expect(result).toHaveLength(1);
    });
  });

  // ==================== Workflow History ====================

  describe('createWorkflowHistory', () => {
    it('should create workflow history', async () => {
      const mockHistory = {
        id: 'WH-123',
        ticket_id: 'ticket-1',
        from_status: 'open',
        to_status: 'in_progress',
        triggered_by: 'user-1',
        triggered_type: 'manual',
        comment: 'Starting work',
        created_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockHistory] });

      const result = await repository.createWorkflowHistory('ticket-1', 'open', 'in_progress', 'user-1', 'Starting work');

      expect(result.id).toBeDefined();
      expect(result.ticketId).toBe('ticket-1');
    });
  });

  describe('getWorkflowHistory', () => {
    it('should return workflow history for ticket', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'wh1' }] });

      const result = await repository.getWorkflowHistory('ticket-1');

      expect(result).toHaveLength(1);
    });
  });

  // ==================== SLA Tracking ====================

  describe('createSLA', () => {
    it('should create SLA for ticket', async () => {
      const mockSLA = {
        id: 'SLA-123',
        ticket_id: 'ticket-1',
        priority: 'high',
        response_time_minutes: 15,
        resolution_time_minutes: 60,
        response_breached: false,
        resolution_breached: false,
      };
      mockDb.query.mockResolvedValue({ rows: [mockSLA] });

      const result = await repository.createSLA('ticket-1', 'high', 3600000);

      expect(result.id).toBeDefined();
      expect(result.ticketId).toBe('ticket-1');
    });
  });

  describe('getSLA', () => {
    it('should return SLA for ticket', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'sla1' }] });

      const result = await repository.getSLA('ticket-1');

      expect(result).toBeDefined();
    });

    it('should return null when no SLA', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.getSLA('ticket-1');

      expect(result).toBeNull();
    });
  });

  describe('getAllSLA', () => {
    it('should return all SLAs', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'sla1' }] });

      const result = await repository.getAllSLA();

      expect(result).toHaveLength(1);
    });
  });

  describe('updateSLA', () => {
    it('should update SLA fields', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.updateSLA('ticket-1', {
        resolvedAt: new Date(),
        responseBreached: true,
        resolutionBreached: false,
        firstResponseAt: new Date(),
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE ticket_sla'),
        expect.arrayContaining([expect.any(Date), true, false, expect.any(Date), 'ticket-1'])
      );
    });

    it('should not update when no fields provided', async () => {
      await repository.updateSLA('ticket-1', {});

      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  // ==================== Engineer Profiles ====================

  describe('createEngineerProfile', () => {
    it('should create engineer profile', async () => {
      const mockProfile = {
        id: 'eng-1',
        name: 'John Doe',
        expertise: ['backend', 'devops'],
        current_load: 0,
        max_capacity: 10,
        availability: 'available',
        team: 'platform',
        on_call: false,
      };
      mockDb.query.mockResolvedValue({ rows: [mockProfile] });

      const result = await repository.createEngineerProfile({
        id: 'eng-1',
        name: 'John Doe',
        expertise: ['backend', 'devops'],
        team: 'platform',
      });

      expect(result.id).toBe('eng-1');
      expect(result.name).toBe('John Doe');
    });

    it('should use defaults for optional fields', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'eng-1' }] });

      await repository.createEngineerProfile({
        id: 'eng-1',
        name: 'John Doe',
      });

      const callArgs = mockDb.query.mock.calls[0];
      const params = callArgs[1];
      expect(params[2]).toEqual([]); // expertise
      expect(params[3]).toBe(0); // currentLoad
      expect(params[4]).toBe(10); // maxCapacity
      expect(params[5]).toBe('available'); // availability
    });
  });

  describe('findEngineerProfileById', () => {
    it('should return engineer profile', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'eng-1' }] });

      const result = await repository.findEngineerProfileById('eng-1');

      expect(result).toBeDefined();
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findEngineerProfileById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findAllEngineerProfiles', () => {
    it('should return all engineer profiles', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'eng1' }, { id: 'eng2' }] });

      const result = await repository.findAllEngineerProfiles();

      expect(result).toHaveLength(2);
    });
  });

  describe('updateEngineerProfile', () => {
    it('should update engineer profile', async () => {
      const mockUpdated = { id: 'eng-1', name: 'Updated Name' };
      mockDb.query.mockResolvedValue({ rows: [mockUpdated] });

      const result = await repository.updateEngineerProfile('eng-1', { name: 'Updated Name' });

      expect(result).toBeDefined();
    });

    it('should return current profile when no updates', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'eng-1' }] });

      const result = await repository.updateEngineerProfile('eng-1', {});

      expect(result).toBeDefined();
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.updateEngineerProfile('non-existent', { name: 'New' });

      expect(result).toBeNull();
    });
  });

  describe('deleteEngineerProfile', () => {
    it('should delete engineer profile', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.deleteEngineerProfile('eng-1');

      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.deleteEngineerProfile('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('getAvailableEngineers', () => {
    it('should return available engineers', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'eng1' }] });

      const result = await repository.getAvailableEngineers();

      expect(result).toHaveLength(1);
    });
  });

  // ==================== Error Propagation ====================

  describe('error propagation', () => {
    it('should propagate connection refused errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Connection refused'));

      await expect(repository.findById('ticket-1')).rejects.toThrow('Connection refused');
    });

    it('should propagate timeout errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Query timeout'));

      await expect(repository.create({ tenant_id: 't1', title: 'Test' })).rejects.toThrow('Query timeout');
    });

    it('should propagate constraint violation errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Unique constraint violation'));

      await expect(repository.addComment('ticket-1', 'user-1', 'Test')).rejects.toThrow('Unique constraint violation');
    });
  });
});
