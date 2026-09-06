/**
 * buildStageConfig - 将 StageModal 表单值 + 受控状态转换为 StageConfig
 *
 * 纯函数，不持有状态，便于单元测试与复用。
 */
import type { StageConfig } from './types';
import type { PRTriggerConfig as PRTriggerConfigType } from '@/components/PRTriggerConfig';
import type { StageFormValues } from './stageFormValues';

export interface StageModalExtraState {
  /** 缓存路径列表（受控状态） */
  cachePaths: string[];
  /** 构建产物上传路径列表（受控状态） */
  artifactPaths: string[];
  /** 子流水线参数（受控状态） */
  subPipelineParams: { key: string; value: string }[];
  /** PR/MR 触发配置（受控状态） */
  prTriggerConfig: Partial<PRTriggerConfigType>;
  /** 超时策略配置（受控状态） */
  timeoutConfig: StageConfig['timeoutConfig'];
  /** 审批配置（受控状态） */
  approvalConfig: StageConfig['approvalConfig'];
  /** 质量门禁配置（受控状态） */
  qualityGateConfig: StageConfig['qualityGateConfig'];
  /** 是否处于编辑模式 */
  isEditing: boolean;
}

export function buildStageConfig(
  values: StageFormValues,
  extra: StageModalExtraState
): StageConfig {
  return {
    id: extra.isEditing ? 'stage-editing' : `stage-${Date.now()}`,
    name: values.name,
    type: values.type,
    timeout: values.timeout,
    retryCount: values.retryCount,
    dependsOn: values.dependsOn,
    config: {
      script: values.script,
      command: values.command,
      image: values.image,
      // Buildx config
      imageName: values.buildxImageName,
      tag: values.buildxTag || 'latest',
      platforms: values.buildxPlatforms || ['linux/amd64'],
      dockerfilePath: values.buildxDockerfile,
      context: values.buildxContext || '.',
      push: values.buildxPush ?? true,
      // Container config
      containerImage: values.containerImage,
      containerCommand: values.containerCommand,
      containerArgs: values.containerArgs?.split('\n').filter(Boolean),
      containerEnv: values.containerEnv,
      containerResources: values.containerResources
        ? {
            cpu: values.containerCpu,
            memory: values.containerMemory,
            gpu: values.containerGpu
              ? {
                  devices: values.containerGpuDevices,
                  capabilities: values.containerGpuCapabilities?.split(',').filter(Boolean),
                }
              : undefined,
          }
        : undefined,
      containerNetwork: values.containerNetwork,
      env: values.env,
    },
    // APK 上传配置
    apkUpload:
      values.type === 'apk-upload'
        ? {
            uploadType: values.apkUploadType || 'single',
            market: values.apkMarket,
            apkPath: values.apkPath,
            packageName: values.packageName,
            versionName: values.versionName,
            changelog: values.changelog,
            credentials: values.apkCredentials,
            channel: values.apkChannel,
          }
        : undefined,
    // 缓存配置
    cache: values.cacheEnabled
      ? {
          enabled: true,
          key: values.cacheKey,
          paths: extra.cachePaths.filter((p) => p.trim()),
          restoreKeys: values.cacheRestoreKeys?.split('\n').filter((k) => k.trim()),
        }
      : undefined,
    // Artifact 配置
    artifacts: {
      upload: extra.artifactPaths.filter((p) => p.trim()),
      expiry: values.artifactExpiry,
    },
    // 子流水线配置
    subPipeline:
      values.type === 'sub-pipeline' && values.subPipelineId
        ? {
            pipelineId: values.subPipelineId,
            branch: values.subPipelineBranch || 'main',
            params: extra.subPipelineParams
              .filter((p) => p.key.trim())
              .reduce(
                (acc, p) => ({ ...acc, [p.key.trim()]: p.value.trim() }),
                {} as Record<string, string>
              ),
          }
        : undefined,
    // 矩阵构建配置由 StageMatrixSection 通过 matrix 字段写入
    matrix: undefined,
    // PR/MR 触发配置 - 显式构建完整对象，确保必填字段
    prTrigger: extra.prTriggerConfig?.enabled
      ? ({
          ...extra.prTriggerConfig,
          enabled: true,
          provider: extra.prTriggerConfig.provider || 'github',
          prActions: extra.prTriggerConfig.prActions || ['opened', 'synchronize'],
          branchFilter: extra.prTriggerConfig.branchFilter || {
            targetBranches: ['main', 'master', 'develop'],
          },
          pathFilter: extra.prTriggerConfig.pathFilter || {
            includePaths: [],
            excludePaths: ['docs/**', '*.md'],
          },
          labelFilter: extra.prTriggerConfig.labelFilter || {
            requiredLabels: [],
            excludedLabels: ['wip', 'do-not-merge'],
          },
          draftPolicy: extra.prTriggerConfig.draftPolicy || 'skip',
          securityLevel: extra.prTriggerConfig.securityLevel || 'safe',
        } as PRTriggerConfigType)
      : undefined,
    // 超时配置
    timeoutConfig: extra.timeoutConfig?.enabled ? extra.timeoutConfig : undefined,
    // 审批配置
    approvalConfig: extra.approvalConfig?.enabled ? extra.approvalConfig : undefined,
    // 质量门禁配置
    qualityGateConfig: extra.qualityGateConfig?.enabled
      ? extra.qualityGateConfig
      : undefined,
  };
}
