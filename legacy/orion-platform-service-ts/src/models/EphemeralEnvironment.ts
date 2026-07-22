/**
 * Ephemeral Environment 数据模型
 *
 * 定义临时开发环境的生命周期：
 * - Namespace 创建、服务部署、Preview URL 生成
 * - 环境状态管理和自动销毁
 */

import { v4 as uuidv4 } from 'uuid';

export type EphemeralEnvStatus =
  | 'provisioning'
  | 'running'
  | 'idle'
  | 'tearing_down'
  | 'destroyed';

export interface EphemeralResourceConfig {
  cpu: string;
  memory: string;
  storage: string;
}

export interface EphemeralService {
  name: string;
  image: string;
  replicas: number;
  healthy: boolean;
}

export interface EphemeralEnvironment {
  id: string;
  prId: string;
  repoId: string;
  branchName: string;
  namespace: string;
  status: EphemeralEnvStatus;
  previewUrl?: string;
  commitSha?: string;
  resources: EphemeralResourceConfig;
  services: EphemeralService[];
  createdBy?: string;
  createdAt: Date;
  idleSince?: Date;
  autoDestroyAt?: Date;
  destroyedAt?: Date;
  destroyReason?: string;
}

export interface EphemeralEnvCreateInput {
  prId: string;
  repoId: string;
  branchName: string;
  commitSha?: string;
  templateId?: string;
  createdBy?: string;
}

const DEFAULT_RESOURCES: EphemeralResourceConfig = {
  cpu: '2',
  memory: '4Gi',
  storage: '10Gi',
};

function generateNamespace(prId: string, repoId: string): string {
  const sanitizedRepo = repoId.replace(/[^a-z0-9-]/g, '').substring(0, 30);
  const sanitizedPr = prId.replace(/[^a-z0-9-]/g, '').substring(0, 20);
  const hash = uuidv4().substring(0, 6);
  return `eph-${sanitizedRepo}-${sanitizedPr}-${hash}`.substring(0, 63);
}

function generatePreviewUrl(namespace: string): string {
  return `https://${namespace}.dev.orion.internal`;
}

export function createEphemeralEnvironment(
  input: EphemeralEnvCreateInput
): EphemeralEnvironment {
  const now = new Date();
  const namespace = generateNamespace(input.prId, input.repoId);

  return {
    id: uuidv4(),
    prId: input.prId,
    repoId: input.repoId,
    branchName: input.branchName,
    namespace,
    status: 'provisioning',
    previewUrl: generatePreviewUrl(namespace),
    commitSha: input.commitSha,
    resources: DEFAULT_RESOURCES,
    services: [],
    createdBy: input.createdBy,
    createdAt: now,
    autoDestroyAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24h default
  };
}

export function markRunning(env: EphemeralEnvironment, services: EphemeralService[]): void {
  env.status = 'running';
  env.services = services;
}

export function markIdle(env: EphemeralEnvironment): void {
  env.status = 'idle';
  env.idleSince = new Date();
}

export function markTearingDown(env: EphemeralEnvironment, reason: string): void {
  env.status = 'tearing_down';
  env.destroyReason = reason;
}

export function markDestroyed(env: EphemeralEnvironment, reason: string): void {
  env.status = 'destroyed';
  env.destroyReason = reason;
  env.destroyedAt = new Date();
}

export function wakeEnvironment(env: EphemeralEnvironment): void {
  env.status = 'running';
  env.idleSince = undefined;
}
