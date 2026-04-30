/**
 * Plugin SPI API Client
 *
 * Backend routes: orion-platform-service/src/api/plugin-spi-routes.ts
 */

import { api } from './client';

export interface SPIStats {
  totalExtensionPoints: number;
  activePoints: number;
  totalRegistrations: number;
}

export interface SPIExtensionPoint {
  id: string;
  name: string;
  description: string;
  interface: string;
  enabled: boolean;
  registrationCount: number;
  createdAt: string;
}

export interface PluginRegistration {
  id: string;
  pluginName: string;
  extensionPointId: string;
  extensionPointName: string;
  version: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  createdAt: string;
}

export interface SPIConfig {
  id: string;
  key: string;
  value: string;
  description: string;
  category: string;
  encrypted: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getSPIStats() {
  return api.get<{ stats: SPIStats }>('/v1/plugin-spi/stats');
}

export async function getExtensionPoints() {
  return api.get<{ extensionPoints: SPIExtensionPoint[] }>('/v1/plugin-spi/extension-points');
}

export async function getPluginRegistrations() {
  return api.get<{ registrations: PluginRegistration[] }>('/v1/plugin-spi/registrations');
}

export async function getSPIConfigs() {
  return api.get<{ configs: SPIConfig[] }>('/v1/plugin-spi/configs');
}

export async function createExtensionPoint(
  input: Omit<SPIExtensionPoint, 'id' | 'registrationCount' | 'createdAt'>
) {
  return api.post<{ extensionPoint: SPIExtensionPoint }>('/v1/plugin-spi/extension-points', input);
}

export async function deleteExtensionPoint(id: string) {
  return api.delete<void>(`/v1/plugin-spi/extension-points/${id}`);
}

export async function toggleExtensionPoint(id: string, enabled: boolean) {
  return api.patch<{ extensionPoint: SPIExtensionPoint }>(
    `/v1/plugin-spi/extension-points/${id}/toggle`,
    { enabled }
  );
}

export async function createRegistration(input: Omit<PluginRegistration, 'id' | 'createdAt'>) {
  return api.post<{ registration: PluginRegistration }>('/v1/plugin-spi/registrations', input);
}

export async function deleteRegistration(id: string) {
  return api.delete<void>(`/v1/plugin-spi/registrations/${id}`);
}

export async function toggleRegistration(id: string, enabled: boolean) {
  return api.patch<{ registration: PluginRegistration }>(
    `/v1/plugin-spi/registrations/${id}/toggle`,
    { enabled }
  );
}

export async function createSPIConfig(input: Omit<SPIConfig, 'id' | 'createdAt' | 'updatedAt'>) {
  return api.post<{ config: SPIConfig }>('/v1/plugin-spi/configs', input);
}

export async function updateSPIConfig(id: string, input: Partial<SPIConfig>) {
  return api.put<{ config: SPIConfig }>(`/v1/plugin-spi/configs/${id}`, input);
}

export async function deleteSPIConfig(id: string) {
  return api.delete<void>(`/v1/plugin-spi/configs/${id}`);
}
