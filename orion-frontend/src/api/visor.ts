/**
 * Visor (Ops Visualization) API Service
 * Host management, script execution, resource monitoring
 */
import { api } from './client';

export interface Host {
  id: string;
  hostname: string;
  ip: string;
  os: string;
  status: 'online' | 'offline' | 'error' | 'maintenance';
  cpuUsage?: number;
  memoryUsage?: number;
  lastSeen?: string;
  createdAt: string;
}

export interface AddHostInput {
  hostname: string;
  ip: string;
  os?: string;
}

export interface ScriptExecution {
  id: string;
  hostId: string;
  hostname?: string;
  script: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'timeout';
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

export interface ExecuteScriptInput {
  hostId: string;
  script: string;
}

export interface ResourceUsage {
  hostId: string;
  hostname: string;
  type: 'cpu' | 'memory' | 'disk' | 'network';
  usage: number;
  unit: string;
  timestamp: string;
}

// ---- Hosts ----

export function listHosts() {
  return api.get('/visor/hosts');
}

export function addHost(data: AddHostInput) {
  return api.post('/visor/hosts', data);
}

export function removeHost(id: string) {
  return api.delete(`/visor/hosts/${id}`);
}

export function getHostStatus(id: string) {
  return api.get(`/visor/hosts/${id}/status`);
}

// ---- Scripts ----

export function executeScript(data: ExecuteScriptInput) {
  return api.post('/visor/scripts', data);
}

export function getScriptResult(id: string) {
  return api.get(`/visor/scripts/${id}/result`);
}

// ---- Resources ----

export function listResources() {
  return api.get('/visor/resources');
}

export function getResourcesByType(type: string) {
  return api.get(`/visor/resources/${type}`);
}
