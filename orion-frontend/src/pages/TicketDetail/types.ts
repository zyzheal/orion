/**
 * types.ts - TicketDetail 类型定义
 * 抽取自 TicketDetail/index.tsx (P2-9 Phase 58)
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
  tags: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  dueDate: string;
  escalationLevel: number;
}

export interface AssignValues {
  assignee: string;
  reason?: string;
}

export interface ResolveValues {
  resolutionNote?: string;
}

export interface TransferValues {
  toEngineer: string;
  reason: string;
}

export interface EscalateValues {
  reason: string;
}
