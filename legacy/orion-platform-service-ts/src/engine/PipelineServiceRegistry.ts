/**
 * PipelineServiceRegistry - Pipeline 服务注册表
 *
 * 提供 PipelineEngine 和其协作者所需的全部可选服务。
 * PipelineEngine 不再直接 import 15+ 个服务，而是通过此注册表按名称获取。
 *
 * 目标：Engine → Services 直接 import 从 20 个减少到 4 个核心服务
 *   - PipelineService
 *   - PipelineRunService
 *   - PipelineEventPublisher
 *   - StageExecutor
 */

import { SubPipelineService } from '../services/pipeline/SubPipelineService';
import { PipelineEventSSEBridge } from '../services/pipeline/PipelineEventSSEBridge';
import { ArtifactService } from '../services/pipeline/ArtifactService';
import { ApprovalGateService } from '../services/pipeline/ApprovalGateService';
import { PipelineExecutionQueue, QueuePriority } from '../services/pipeline/PipelineExecutionQueue';
import { AutoRetryService } from '../services/pipeline/AutoRetryService';
import { IMNotifier, IMNotificationConfig } from '../services/pipeline/IMNotifier';
import { WebhookNotifier } from '../services/pipeline/WebhookNotifier';
import { WebhookConfigRepository } from '../repositories/WebhookConfigRepository';
import { QualityGateService } from '../services/pipeline/QualityGateService';
import { DeploymentStrategyService } from '../services/pipeline/DeploymentStrategyService';
import { SecretsService, SecretsServiceConfig } from '../services/pipeline/SecretsService';
import { SecretRepository } from '../repositories/SecretRepository';
import { CommitStatusService } from '../services/code-repo/CommitStatusService';
import { GlobalParamService } from '../services/pipeline/GlobalParamService';
import { EnvProfileService } from '../services/pipeline/EnvProfileService';
import { ScriptVersionService } from '../services/pipeline/ScriptVersionService';
import { PipelineAuditLogService } from '../services/pipeline/PipelineAuditLogService';
import { PipelineCheckpointManager } from './PipelineCheckpointManager';
import { DebugController } from './DebugController';

export interface IPipelineServiceRegistry {
  getSubPipelineService(): SubPipelineService | null;
  getSseBridge(): PipelineEventSSEBridge | null;
  getArtifactService(): ArtifactService | null;
  getApprovalGateService(): ApprovalGateService | null;
  getExecutionQueue(): PipelineExecutionQueue | null;
  getAutoRetryService(): AutoRetryService | null;
  getImNotifier(): IMNotifier | null;
  getImNotificationConfigs(): IMNotificationConfig[];
  getWebhookNotifier(): WebhookNotifier | null;
  getWebhookConfigRepo(): WebhookConfigRepository | null;
  getQualityGateService(): QualityGateService | null;
  getDeploymentStrategyService(): DeploymentStrategyService | null;
  getSecretsService(): SecretsService | null;
  getScmStatusService(): CommitStatusService | null;
  getGlobalParamService(): GlobalParamService | null;
  getEnvProfileService(): EnvProfileService | null;
  getScriptVersionService(): ScriptVersionService | null;
  getPipelineAuditLogService(): PipelineAuditLogService | null;
  getCheckpointManager(): PipelineCheckpointManager | null;
  getDebugController(): DebugController | null;
  initializeSecrets(
    database: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
    masterKey?: string
  ): void;
}

export class PipelineServiceRegistry implements IPipelineServiceRegistry {
  private subPipelineService: SubPipelineService | null = null;
  private sseBridge: PipelineEventSSEBridge | null = null;
  private artifactService: ArtifactService | null = null;
  private approvalGateService: ApprovalGateService | null = null;
  private executionQueue: PipelineExecutionQueue | null = null;
  private autoRetryService: AutoRetryService | null = null;
  private imNotifier: IMNotifier | null = null;
  private imNotificationConfigs: IMNotificationConfig[] = [];
  private webhookNotifier: WebhookNotifier | null = null;
  private webhookConfigRepo: WebhookConfigRepository | null = null;
  private qualityGateService: QualityGateService | null = null;
  private deploymentStrategyService: DeploymentStrategyService | null = null;
  private secretsService: SecretsService | null = null;
  private secretsRepo: SecretRepository | null = null;
  private scmStatusService: CommitStatusService | null = null;
  private globalParamService: GlobalParamService | null = null;
  private envProfileService: EnvProfileService | null = null;
  private scriptVersionService: ScriptVersionService | null = null;
  private pipelineAuditLogService: PipelineAuditLogService | null = null;
  private checkpointManager: PipelineCheckpointManager | null = null;
  private debugController: DebugController | null = null;

  // ==================== Registration methods ====================

  registerSubPipelineService(service: SubPipelineService | null): this {
    this.subPipelineService = service;
    return this;
  }

  registerSseBridge(bridge: PipelineEventSSEBridge | null): this {
    this.sseBridge = bridge;
    return this;
  }

  registerArtifactService(service: ArtifactService | null): this {
    this.artifactService = service;
    return this;
  }

  registerApprovalGateService(service: ApprovalGateService | null): this {
    this.approvalGateService = service;
    return this;
  }

  registerExecutionQueue(queue: PipelineExecutionQueue | null): this {
    this.executionQueue = queue;
    return this;
  }

  registerAutoRetryService(service: AutoRetryService | null): this {
    this.autoRetryService = service;
    return this;
  }

  registerImNotifier(notifier: IMNotifier | null, configs: IMNotificationConfig[] = []): this {
    this.imNotifier = notifier;
    this.imNotificationConfigs = configs;
    return this;
  }

  registerWebhookNotifier(notifier: WebhookNotifier | null, repo: WebhookConfigRepository | null = null): this {
    this.webhookNotifier = notifier;
    this.webhookConfigRepo = repo;
    return this;
  }

  registerQualityGateService(service: QualityGateService | null): this {
    this.qualityGateService = service;
    return this;
  }

  registerDeploymentStrategyService(service: DeploymentStrategyService | null): this {
    this.deploymentStrategyService = service;
    return this;
  }

  registerScmStatusService(service: CommitStatusService | null): this {
    this.scmStatusService = service;
    return this;
  }

  registerGlobalParamService(service: GlobalParamService | null): this {
    this.globalParamService = service;
    return this;
  }

  registerEnvProfileService(service: EnvProfileService | null): this {
    this.envProfileService = service;
    return this;
  }

  registerScriptVersionService(service: ScriptVersionService | null): this {
    this.scriptVersionService = service;
    return this;
  }

  registerPipelineAuditLogService(service: PipelineAuditLogService | null): this {
    this.pipelineAuditLogService = service;
    return this;
  }

  registerCheckpointManager(manager: PipelineCheckpointManager | null): this {
    this.checkpointManager = manager;
    return this;
  }

  registerDebugController(controller: DebugController | null): this {
    this.debugController = controller;
    return this;
  }

  // ==================== Lookup methods ====================

  getSubPipelineService(): SubPipelineService | null {
    return this.subPipelineService;
  }

  getSseBridge(): PipelineEventSSEBridge | null {
    return this.sseBridge;
  }

  getArtifactService(): ArtifactService | null {
    return this.artifactService;
  }

  getApprovalGateService(): ApprovalGateService | null {
    return this.approvalGateService;
  }

  getExecutionQueue(): PipelineExecutionQueue | null {
    return this.executionQueue;
  }

  getAutoRetryService(): AutoRetryService | null {
    return this.autoRetryService;
  }

  getImNotifier(): IMNotifier | null {
    return this.imNotifier;
  }

  getImNotificationConfigs(): IMNotificationConfig[] {
    return this.imNotificationConfigs;
  }

  getWebhookNotifier(): WebhookNotifier | null {
    return this.webhookNotifier;
  }

  getWebhookConfigRepo(): WebhookConfigRepository | null {
    return this.webhookConfigRepo;
  }

  getQualityGateService(): QualityGateService | null {
    return this.qualityGateService;
  }

  getDeploymentStrategyService(): DeploymentStrategyService | null {
    return this.deploymentStrategyService;
  }

  getSecretsService(): SecretsService | null {
    return this.secretsService;
  }

  getScmStatusService(): CommitStatusService | null {
    return this.scmStatusService;
  }

  getGlobalParamService(): GlobalParamService | null {
    return this.globalParamService;
  }

  getEnvProfileService(): EnvProfileService | null {
    return this.envProfileService;
  }

  getScriptVersionService(): ScriptVersionService | null {
    return this.scriptVersionService;
  }

  getPipelineAuditLogService(): PipelineAuditLogService | null {
    return this.pipelineAuditLogService;
  }

  getCheckpointManager(): PipelineCheckpointManager | null {
    return this.checkpointManager;
  }

  getDebugController(): DebugController | null {
    return this.debugController;
  }

  // ==================== Secret management ====================

  initializeSecrets(
    database: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
    masterKey?: string
  ): void {
    if (!database) return;
    this.secretsRepo = new SecretRepository(database);
    const config: SecretsServiceConfig | undefined = masterKey ? { encryptionKey: masterKey } : undefined;
    this.secretsService = new SecretsService(this.secretsRepo, config);
  }
}
