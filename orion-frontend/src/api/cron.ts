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
  return api.get<CronJob[]>('/v1/cron/jobs');
}

export async function getCronJob(id: string) {
  return api.get<CronJob>(`/v1/cron/jobs/${id}`);
}

export async function createCronJob(input: CronJobInput) {
  return api.post<CronJob>('/v1/cron/jobs', input);
}

export async function updateCronJob(id: string, input: Partial<CronJobInput>) {
  return api.put<CronJob>(`/v1/cron/jobs/${id}`, input);
}

export async function deleteCronJob(id: string) {
  return api.delete<void>(`/v1/cron/jobs/${id}`);
}

export async function executeCronJob(id: string) {
  return api.post<void>(`/v1/cron/jobs/${id}/execute`);
}

export async function getCronStatus() {
  return api.get<{ running: number; total: number; enabled: number }>('/v1/cron/status');
}
