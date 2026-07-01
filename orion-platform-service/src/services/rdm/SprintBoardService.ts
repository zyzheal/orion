/**
 * Sprint Board Service
 * Business logic for sprint management, board view, backlog, and burndown
 */
import { SprintRepository, CreateSprintInput, UpdateSprintInput } from './SprintRepository';
import { SprintTicketRepository } from './SprintTicketRepository';
import { TicketRelationRepository } from './TicketRelationRepository';
import { TicketingRepository } from '../ticketing/TicketingRepository';

export class SprintBoardService {
  constructor(
    private sprintRepo: SprintRepository,
    private sprintTicketRepo: SprintTicketRepository,
    private relationRepo: TicketRelationRepository,
    private ticketRepo?: TicketingRepository
  ) {}

  async listSprints(filters?: { status?: string }) {
    return this.sprintRepo.list(filters);
  }

  async getSprint(id: string) {
    return this.sprintRepo.get(id);
  }

  async createSprint(data: CreateSprintInput) {
    return this.sprintRepo.create(data);
  }

  async updateSprint(id: string, data: UpdateSprintInput) {
    return this.sprintRepo.update(id, data);
  }

  async deleteSprint(id: string) {
    return this.sprintRepo.delete(id);
  }

  async getSprintBoard(sprintId: string) {
    const sprint = await this.sprintRepo.get(sprintId);
    if (!sprint) return null;

    const sprintTickets = await this.sprintTicketRepo.listBySprint(sprintId);
    // Group tickets by actual status from ticket service
    const columns: Record<string, { ticketId: string; sortOrder: number }[]> = {};
    for (const st of sprintTickets) {
      let status = 'open';
      if (this.ticketRepo) {
        try {
          const ticket = await this.ticketRepo.findById(st.ticket_id, '');
          if (ticket) status = ticket.status || 'open';
        } catch {
          // Fallback to 'open' if ticket not found
        }
      }
      if (!columns[status]) columns[status] = [];
      columns[status].push({ ticketId: st.ticket_id, sortOrder: st.sort_order });
    }

    return { sprint, columns };
  }

  async moveTicketToSprint(sprintId: string, ticketId: string, sortOrder?: number) {
    return this.sprintTicketRepo.addTicket(sprintId, ticketId, sortOrder);
  }

  async removeTicketFromSprint(sprintId: string, ticketId: string) {
    return this.sprintTicketRepo.removeTicket(sprintId, ticketId);
  }

  async reorderTickets(sprintId: string, orders: { ticketId: string; sortOrder: number }[]) {
    return this.sprintTicketRepo.reorderTickets(sprintId, orders);
  }

  async getBurndownData(sprintId: string) {
    const sprint = await this.sprintRepo.get(sprintId);
    if (!sprint) return [];

    const tickets = await this.sprintTicketRepo.listBySprint(sprintId);
    const totalTickets = tickets.length;

    // Count completed tickets if ticket repo available
    let completedTickets = 0;
    if (this.ticketRepo) {
      for (const st of tickets) {
        try {
          const ticket = await this.ticketRepo.findById(st.ticket_id, '');
          if (ticket && (ticket.status === 'closed' || ticket.status === 'resolved' || ticket.status === 'done')) {
            completedTickets++;
          }
        } catch {
          // Skip if ticket not found
        }
      }
    }

    // Generate ideal burndown line
    const start = new Date(sprint.start_date);
    const end = new Date(sprint.end_date);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const idealDecrement = totalTickets / Math.max(totalDays, 1);
    const remainingTickets = totalTickets - completedTickets;

    const data: { date: string; remainingPoints: number; idealPoints: number }[] = [];
    for (let i = 0; i <= totalDays; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      data.push({
        date: date.toISOString().split('T')[0],
        remainingPoints: remainingTickets,
        idealPoints: Math.max(0, totalTickets - idealDecrement * i),
      });
    }

    return data;
  }
}
