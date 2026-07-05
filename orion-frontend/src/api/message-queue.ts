/**
 * MessageQueue API Service
 * Auto-generated from backend message-queue-routes.ts
 * Prefix: /api/v1/message-queue
 */
import { api } from './client';

export interface MessageQueue {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const createMessageQueueEnqueue = async (data?: Partial<MessageQueue>): Promise<MessageQueue> => {
  const response = await api.post<MessageQueue>('/api/v1/message-queue/enqueue', data);
  return response.data;
};

export const createMessageQueueDequeue = async (data?: Partial<MessageQueue>): Promise<MessageQueue> => {
  const response = await api.post<MessageQueue>('/api/v1/message-queue/dequeue', data);
  return response.data;
};

export const createMessageQueueSchedule = async (data?: Partial<MessageQueue>): Promise<MessageQueue> => {
  const response = await api.post<MessageQueue>('/api/v1/message-queue/schedule', data);
  return response.data;
};

export const createMessageQueueAck = async (messageId: string, data?: Partial<MessageQueue>): Promise<MessageQueue> => {
  const response = await api.post<MessageQueue>('/api/v1/message-queue/' + messageId + '/ack', data);
  return response.data;
};

export const createMessageQueueNack = async (messageId: string, data?: Partial<MessageQueue>): Promise<MessageQueue> => {
  const response = await api.post<MessageQueue>('/api/v1/message-queue/' + messageId + '/nack', data);
  return response.data;
};

export const createMessageQueueRetry = async (messageId: string, data?: Partial<MessageQueue>): Promise<MessageQueue> => {
  const response = await api.post<MessageQueue>('/api/v1/message-queue/' + messageId + '/retry', data);
  return response.data;
};

export const listMessageQueue = async (params?: Record<string, unknown>): Promise<{ data: MessageQueue[]; total: number }> => {
  const response = await api.get<{ data: MessageQueue[]; total: number }>('/api/v1/message-queue/dead-letter', { params });
  return { data: response.data.data, total: response.data.total };
};

export const createMessageQueueDeadLetterReplay = async (id: string, data?: Partial<MessageQueue>): Promise<MessageQueue> => {
  const response = await api.post<MessageQueue>('/api/v1/message-queue/dead-letter/' + id + '/replay', data);
  return response.data;
};

export const createMessageQueueConsumerRegister = async (data?: Partial<MessageQueue>): Promise<MessageQueue> => {
  const response = await api.post<MessageQueue>('/api/v1/message-queue/consumer/register', data);
  return response.data;
};

export const createMessageQueueConsumerHeartbeat = async (id: string, data?: Partial<MessageQueue>): Promise<MessageQueue> => {
  const response = await api.post<MessageQueue>('/api/v1/message-queue/consumer/' + id + '/heartbeat', data);
  return response.data;
};
