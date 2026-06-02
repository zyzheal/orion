/**
 * TicketingService Unit Tests
 */

import { TicketingService, TicketingServiceError, ListTicketsOptions, PaginatedResult } from '../TicketingService';
import { TicketingRepository, TicketRecord, TicketCommentRecord, CreateTicketInput, UpdateTicketInput } from '../TicketingRepository';

// Mock TicketingRepository
const mockRepository = {
  findById: jest.fn(),
  findAll: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  addComment: jest.fn(),
  getComments: jest.fn(),
} as unknown as TicketingRepository;

describe('TicketingService', () => {
  let service: TicketingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TicketingService(mockRepository);
  });

  // ==================== TicketingServiceError ====================

  describe('TicketingServiceError', () => {
    it('should set message and code', () => {
      const error = new TicketingServiceError('Test error', 'TEST_CODE');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('TicketingServiceError');
    });

    it('should be an instance of Error', () => {
      const error = new TicketingServiceError('msg', 'CODE');
      expect(error).toBeInstanceOf(Error);
    });
  });

  // ==================== getTicket ====================

  describe('getTicket', () => {
    it('should return a ticket by ID', async () => {
      const mockTicket = { id: 't-1', title: 'Test' } as TicketRecord;
      (mockRepository.findById as jest.Mock).mockResolvedValue(mockTicket);

      const result = await service.getTicket('t-1');

      expect(result.id).toBe('t-1');
      expect(mockRepository.findById).toHaveBeenCalledWith('t-1');
    });

    it('should throw NOT_FOUND when ticket does not exist', async () => {
      (mockRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.getTicket('nonexistent')).rejects.toThrow(TicketingServiceError);
      await expect(service.getTicket('nonexistent')).rejects.toThrow('Ticket not found: nonexistent');
    });

    it('should include NOT_FOUND code in error', async () => {
      (mockRepository.findById as jest.Mock).mockResolvedValue(null);

      try {
        await service.getTicket('nonexistent');
        fail('should have thrown');
      } catch (err) {
        expect((err as TicketingServiceError).code).toBe('NOT_FOUND');
      }
    });
  });

  // ==================== listTickets ====================

  describe('listTickets', () => {
    it('should return paginated results', async () => {
      const mockTickets = [{ id: 't-1' }, { id: 't-2' }] as TicketRecord[];
      (mockRepository.findAll as jest.Mock).mockResolvedValue(mockTickets);
      (mockRepository.count as jest.Mock).mockResolvedValue(2);

      const result = await service.listTickets();

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should use default pagination parameters', async () => {
      (mockRepository.findAll as jest.Mock).mockResolvedValue([]);
      (mockRepository.count as jest.Mock).mockResolvedValue(0);

      await service.listTickets();

      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20, offset: 0 })
      );
    });

    it('should support custom pagination', async () => {
      (mockRepository.findAll as jest.Mock).mockResolvedValue([]);
      (mockRepository.count as jest.Mock).mockResolvedValue(100);

      const result = await service.listTickets({ page: 3, limit: 10 });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(10);
      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 20 })
      );
    });

    it('should pass filter parameters to repository', async () => {
      (mockRepository.findAll as jest.Mock).mockResolvedValue([]);
      (mockRepository.count as jest.Mock).mockResolvedValue(0);

      await service.listTickets({
        tenantId: 't-1',
        status: 'open',
        assigneeId: 'user-1',
        priority: 'high',
      });

      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't-1',
          status: 'open',
          assigneeId: 'user-1',
          priority: 'high',
        })
      );
    });

    it('should correctly calculate totalPages', async () => {
      (mockRepository.findAll as jest.Mock).mockResolvedValue([]);
      (mockRepository.count as jest.Mock).mockResolvedValue(25);

      const result = await service.listTickets({ limit: 10 });

      expect(result.totalPages).toBe(3);
    });
  });

  // ==================== createTicket ====================

  describe('createTicket', () => {
    it('should create a ticket with valid input', async () => {
      const input: CreateTicketInput = { tenant_id: 't-1', title: 'New ticket' };
      const mockCreated = { id: 't-new', ...input } as TicketRecord;
      (mockRepository.create as jest.Mock).mockResolvedValue(mockCreated);

      const result = await service.createTicket(input);

      expect(result.id).toBe('t-new');
      expect(mockRepository.create).toHaveBeenCalledWith(input);
    });

    it('should throw INVALID_INPUT when tenant_id is missing', async () => {
      const input = { title: 'No tenant' } as CreateTicketInput;

      await expect(service.createTicket(input)).rejects.toThrow(TicketingServiceError);
      await expect(service.createTicket(input)).rejects.toThrow('Tenant ID required');
    });

    it('should throw INVALID_INPUT when title is missing', async () => {
      const input = { tenant_id: 't-1' } as CreateTicketInput;

      await expect(service.createTicket(input)).rejects.toThrow(TicketingServiceError);
      await expect(service.createTicket(input)).rejects.toThrow('Title required');
    });

    it('should include INVALID_INPUT code in error', async () => {
      try {
        await service.createTicket({} as CreateTicketInput);
        fail('should have thrown');
      } catch (err) {
        expect((err as TicketingServiceError).code).toBe('INVALID_INPUT');
      }
    });
  });

  // ==================== updateTicket ====================

  describe('updateTicket', () => {
    it('should update an existing ticket', async () => {
      const existing = { id: 't-1', title: 'Old' } as TicketRecord;
      const updated = { id: 't-1', title: 'New' } as TicketRecord;
      (mockRepository.findById as jest.Mock).mockResolvedValue(existing);
      (mockRepository.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.updateTicket('t-1', { title: 'New' });

      expect(result.title).toBe('New');
      expect(mockRepository.update).toHaveBeenCalledWith('t-1', { title: 'New' });
    });

    it('should throw NOT_FOUND when ticket does not exist', async () => {
      (mockRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.updateTicket('nonexistent', {})).rejects.toThrow('Ticket not found: nonexistent');
    });

    it('should throw UPDATE_FAILED when update returns null', async () => {
      const existing = { id: 't-1' } as TicketRecord;
      (mockRepository.findById as jest.Mock).mockResolvedValue(existing);
      (mockRepository.update as jest.Mock).mockResolvedValue(null);

      await expect(service.updateTicket('t-1', {})).rejects.toThrow('Failed to update: t-1');
    });

    it('should include UPDATE_FAILED code in error', async () => {
      const existing = { id: 't-1' } as TicketRecord;
      (mockRepository.findById as jest.Mock).mockResolvedValue(existing);
      (mockRepository.update as jest.Mock).mockResolvedValue(null);

      try {
        await service.updateTicket('t-1', {});
        fail('should have thrown');
      } catch (err) {
        expect((err as TicketingServiceError).code).toBe('UPDATE_FAILED');
      }
    });
  });

  // ==================== assignTicket ====================

  describe('assignTicket', () => {
    it('should assign ticket to user', async () => {
      const existing = { id: 't-1' } as TicketRecord;
      const updated = { id: 't-1', assignee_id: 'user-1', status: 'assigned' } as TicketRecord;
      (mockRepository.findById as jest.Mock).mockResolvedValue(existing);
      (mockRepository.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.assignTicket('t-1', 'user-1');

      expect(result.assignee_id).toBe('user-1');
      expect(result.status).toBe('assigned');
      expect(mockRepository.update).toHaveBeenCalledWith('t-1', { assignee_id: 'user-1', status: 'assigned' });
    });
  });

  // ==================== resolveTicket ====================

  describe('resolveTicket', () => {
    it('should resolve ticket', async () => {
      const existing = { id: 't-1' } as TicketRecord;
      const updated = { id: 't-1', status: 'resolved' } as TicketRecord;
      (mockRepository.findById as jest.Mock).mockResolvedValue(existing);
      (mockRepository.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.resolveTicket('t-1');

      expect(result.status).toBe('resolved');
      expect(mockRepository.update).toHaveBeenCalledWith('t-1', { status: 'resolved' });
    });
  });

  // ==================== closeTicket ====================

  describe('closeTicket', () => {
    it('should close ticket', async () => {
      const existing = { id: 't-1' } as TicketRecord;
      const updated = { id: 't-1', status: 'closed' } as TicketRecord;
      (mockRepository.findById as jest.Mock).mockResolvedValue(existing);
      (mockRepository.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.closeTicket('t-1');

      expect(result.status).toBe('closed');
      expect(mockRepository.update).toHaveBeenCalledWith('t-1', { status: 'closed' });
    });
  });

  // ==================== addComment ====================

  describe('addComment', () => {
    it('should add a comment to a ticket', async () => {
      const mockTicket = { id: 't-1' } as TicketRecord;
      const mockComment = { id: 'c-1', content: 'Hello' } as TicketCommentRecord;
      (mockRepository.findById as jest.Mock).mockResolvedValue(mockTicket);
      (mockRepository.addComment as jest.Mock).mockResolvedValue(mockComment);

      const result = await service.addComment('t-1', 'user-1', 'Hello');

      expect(result.id).toBe('c-1');
      expect(mockRepository.addComment).toHaveBeenCalledWith('t-1', 'user-1', 'Hello', undefined);
    });

    it('should support null authorId', async () => {
      const mockTicket = { id: 't-1' } as TicketRecord;
      (mockRepository.findById as jest.Mock).mockResolvedValue(mockTicket);
      (mockRepository.addComment as jest.Mock).mockResolvedValue({ id: 'c-1' });

      await service.addComment('t-1', null, 'System message');

      expect(mockRepository.addComment).toHaveBeenCalledWith('t-1', null, 'System message', undefined);
    });

    it('should support isInternal flag', async () => {
      const mockTicket = { id: 't-1' } as TicketRecord;
      (mockRepository.findById as jest.Mock).mockResolvedValue(mockTicket);
      (mockRepository.addComment as jest.Mock).mockResolvedValue({ id: 'c-1' });

      await service.addComment('t-1', 'user-1', 'Internal note', true);

      expect(mockRepository.addComment).toHaveBeenCalledWith('t-1', 'user-1', 'Internal note', true);
    });

    it('should throw NOT_FOUND when ticket does not exist', async () => {
      (mockRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.addComment('nonexistent', 'user-1', 'text')).rejects.toThrow(
        'Ticket not found: nonexistent'
      );
    });
  });

  // ==================== getComments ====================

  describe('getComments', () => {
    it('should return comments for a ticket', async () => {
      const mockComments = [
        { id: 'c-1', content: 'First' },
        { id: 'c-2', content: 'Second' },
      ] as TicketCommentRecord[];
      (mockRepository.getComments as jest.Mock).mockResolvedValue(mockComments);

      const result = await service.getComments('t-1');

      expect(result).toHaveLength(2);
      expect(mockRepository.getComments).toHaveBeenCalledWith('t-1');
    });

    it('should return empty array when no comments', async () => {
      (mockRepository.getComments as jest.Mock).mockResolvedValue([]);

      const result = await service.getComments('t-1');

      expect(result).toHaveLength(0);
    });
  });
});
