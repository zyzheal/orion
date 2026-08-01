/**
 * Cron API Client
 *
 * Backend routes: orion-platform-service/src/api/cron-routes.ts
 */

import { api } from './client';

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  command: string;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  status: 'running' | 'idle' | 'error' | 'disabled';
  lastError?: string;
  runCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CronJobInput {
  name: string;
  schedule: string;
  command: string;
  enabled?: boolean;
}

export async function getCronJobs() {
  return api.get<CronJob[]>('/api/cron/jobs');
}

export async function getCronJob(id: string) {
  return api.get<CronJob>(`/api/cron/jobs/${id}`);
}

export async function createCronJob(input: CronJobInput) {
  return api.post<CronJob>('/api/cron/jobs', input);
}

export async function updateCronJob(id: string, input: Partial<CronJobInput>) {
  return api.put<CronJob>(`/api/cron/jobs/${id}`, input);
}

export async function deleteCronJob(id: string) {
  return api.delete<void>(`/api/cron/jobs/${id}`);
}

export async function executeCronJob(id: string) {
  return api.post<void>(`/api/cron/jobs/${id}/execute`);
}

export async function getCronStatus() {
  return api.get<{ running: number; total: number; enabled: number }>('/api/cron/status');
}
