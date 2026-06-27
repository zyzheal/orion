/**
 * TicketKnowledge API Service
 * Auto-generated from backend ticket-knowledge-routes.ts
 * Prefix: /v1/tickets/:id/to-knowledge
 */
import { api } from './client';

export interface TicketKnowledge {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createTicketKnowledgeToKnowledge = async (id: string, data?: Partial<TicketKnowledge>): Promise<TicketKnowledge> => {
  const response = await api.post<TicketKnowledge>('/v1/tickets/:id/to-knowledge/' + id + '/to-knowledge', data);
  return response.data;
};

export const getTicketKnowledge = async (id: string): Promise<TicketKnowledge> => {
  const response = await api.get<TicketKnowledge>('/v1/tickets/:id/to-knowledge/' + id + '/to-knowledge/preview');
  return response.data;
};
