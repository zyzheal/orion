/**
 * TicketingService - Business logic layer for Ticketing operations
 */

import { TicketingRepository, Ticket, TicketComment, CreateTicketInput, UpdateTicketInput } from './TicketingRepository';

export interface ListTicketsOptions {
  page?: number;
  limit?: number;
  tenantId?: string;
  status?: string;
  assigneeId?: string;
  priority?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class TicketingServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'TicketingServiceError'; }
}

export class TicketingService {
  private repository: TicketingRepository;
  constructor(repository: TicketingRepository) { this.repository = repository; }

  async getTicket(id: string): Promise<Ticket> {
    const ticket = await this.repository.findById(id);
    if (!ticket) throw new TicketingServiceError(`Ticket not found: ${id}`, 'NOT_FOUND');
    return ticket;
  }

  async listTickets(options: ListTicketsOptions = {}): Promise<PaginatedResult<Ticket>> {
    const { page = 1, limit = 20, tenantId, status, assigneeId, priority } = options;
    const offset = (page - 1) * limit;
    const [tickets, total] = await Promise.all([
      this.repository.findAll({ tenantId, status, assigneeId, priority, limit, offset }),
      this.repository.count({ tenantId, status, assigneeId }),
    ]);
    return { data: tickets, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createTicket(input: CreateTicketInput): Promise<Ticket> {
    if (!input.tenant_id) throw new TicketingServiceError('Tenant ID required', 'INVALID_INPUT');
    if (!input.title) throw new TicketingServiceError('Title required', 'INVALID_INPUT');
    return this.repository.create(input);
  }

  async updateTicket(id: string, input: UpdateTicketInput): Promise<Ticket> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new TicketingServiceError(`Ticket not found: ${id}`, 'NOT_FOUND');
    const updated = await this.repository.update(id, input);
    if (!updated) throw new TicketingServiceError(`Failed to update: ${id}`, 'UPDATE_FAILED');
    return updated;
  }

  async assignTicket(id: string, assigneeId: string): Promise<Ticket> {
    return this.updateTicket(id, { assignee_id: assigneeId, status: 'assigned' });
  }

  async resolveTicket(id: string): Promise<Ticket> {
    return this.updateTicket(id, { status: 'resolved' });
  }

  async closeTicket(id: string): Promise<Ticket> {
    return this.updateTicket(id, { status: 'closed' });
  }

  async addComment(ticketId: string, authorId: string | null, content: string, isInternal?: boolean): Promise<TicketComment> {
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) throw new TicketingServiceError(`Ticket not found: ${ticketId}`, 'NOT_FOUND');
    return this.repository.addComment(ticketId, authorId, content, isInternal);
  }

  async getComments(ticketId: string): Promise<TicketComment[]> {
    return this.repository.getComments(ticketId);
  }
}