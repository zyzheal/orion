/**
 * types.ts - TicketList 类型定义
 * 抽取自 TicketList/index.tsx (P2-9 Phase 62)
 */

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  source: string;
  reporter: string;
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
  dueDate: string;
  escalationLevel: number;
  tags?: Record<string, string>;
}

export type MockTicket = Ticket;
