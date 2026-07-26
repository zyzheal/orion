/**
 * Plugin Manager Service - Stub
 */

export type PluginType = 'chat' | 'command' | 'notification' | 'integration';
export type PluginState = 'active' | 'inactive' | 'error' | 'updating';

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  type: PluginType;
  state: PluginState;
  enabled: boolean;
  description?: string;
  author?: string;
  tags?: string[];
  securityLevel?: string;
  configSchema?: Record<string, unknown>;
  installedAt?: Date;
  updatedAt?: Date;
  config?: Record<string, unknown>;
}

export class PluginManagerService {
  async listPlugins(): Promise<any[]> { return []; }
  async getPlugin(name: string): Promise<any | null> { return null; }
}
