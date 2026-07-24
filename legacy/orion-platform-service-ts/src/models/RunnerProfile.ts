/**
 * RunnerProfile — Execution target profile
 *
 * Describes a runner that can execute pipeline tasks.
 * Supports multiple protocols: k8s (Tekton), ssh, winrm.
 *
 * This is the architecture foundation for NeatLogic-style
 * remote runner execution. SSH/WinRM protocols are reserved
 * for future implementation.
 */

export type RunnerProtocol = 'k8s' | 'ssh' | 'winrm';

export interface RunnerProfile {
  id: string;
  name: string;
  protocol: RunnerProtocol;
  labels: string[];
  available: boolean;
  maxConcurrency: number;
  metadata: Record<string, unknown>;
}

export interface RunnerSshConfig {
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  credentialRef?: string;
  workingDir?: string;
}

export interface RunnerWinrmConfig {
  host: string;
  port: number;
  username: string;
  authType: 'ntlm' | 'basic' | 'certificate';
  credentialRef?: string;
  useHttps: boolean;
}

export function createRunnerProfile(input: {
  id?: string;
  name: string;
  protocol: RunnerProtocol;
  labels?: string[];
  available?: boolean;
  maxConcurrency?: number;
  metadata?: Record<string, unknown>;
}): RunnerProfile {
  return {
    id: input.id || `runner-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    name: input.name,
    protocol: input.protocol,
    labels: input.labels || [],
    available: input.available ?? true,
    maxConcurrency: input.maxConcurrency || 4,
    metadata: input.metadata || {},
  };
}
