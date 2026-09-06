/**
 * useStageModalState - StageModal 状态管理 Hook
 *
 * 收敛弹窗的全部受控状态：表单回填/重置、缓存与产物路径列表、
 * 子流水线参数、矩阵/PR/超时/审批/质量门禁配置，以及子流水线候选列表加载。
 */
import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { FormInstance } from 'antd';
import { getPipelines } from '@/api/pipelines';
import type {
  MatrixBuildConfig,
  StageConfig,
  TimeoutConfig,
  ApprovalConfig,
  QualityGateConfig,
} from './types';
import type { PRTriggerConfig as PRTriggerConfigType } from '@/components/PRTriggerConfig';
import {
  DEFAULT_MATRIX_CONFIG,
  DEFAULT_APPROVAL_CONFIG,
  DEFAULT_QUALITY_GATE_CONFIG,
  DEFAULT_TIMEOUT_CONFIG,
  DEFAULT_PR_TRIGGER_CONFIG,
} from './StageModalConfig';
import type { StageFormValues } from './stageFormValues';

export type PipelineOption = { label: string; value: string };
export type ParamEntry = { key: string; value: string };

export interface StageModalState {
  cachePaths: string[];
  setCachePaths: Dispatch<SetStateAction<string[]>>;
  artifactPaths: string[];
  setArtifactPaths: Dispatch<SetStateAction<string[]>>;
  subPipelineParams: ParamEntry[];
  setSubPipelineParams: Dispatch<SetStateAction<ParamEntry[]>>;
  matrixConfig: MatrixBuildConfig;
  setMatrixConfig: Dispatch<SetStateAction<MatrixBuildConfig>>;
  prTriggerConfig: Partial<PRTriggerConfigType>;
  setPrTriggerConfig: Dispatch<SetStateAction<Partial<PRTriggerConfigType>>>;
  timeoutConfig: TimeoutConfig;
  setTimeoutConfig: Dispatch<SetStateAction<TimeoutConfig>>;
  approvalConfig: ApprovalConfig;
  setApprovalConfig: Dispatch<SetStateAction<ApprovalConfig>>;
  qualityGateConfig: QualityGateConfig;
  setQualityGateConfig: Dispatch<SetStateAction<QualityGateConfig>>;
  pipelineOptions: PipelineOption[];
}

export function useStageModalState(
  form: FormInstance,
  stage: StageConfig | null,
  visible: boolean
): StageModalState {
  const [cachePaths, setCachePaths] = useState<string[]>(['']);
  const [artifactPaths, setArtifactPaths] = useState<string[]>(['']);
  const [matrixConfig, setMatrixConfig] = useState<MatrixBuildConfig>(DEFAULT_MATRIX_CONFIG);
  const [prTriggerConfig, setPrTriggerConfig] = useState<Partial<PRTriggerConfigType>>(
    DEFAULT_PR_TRIGGER_CONFIG
  );
  // 超时配置
  const [timeoutConfig, setTimeoutConfig] = useState<TimeoutConfig>(DEFAULT_TIMEOUT_CONFIG);
  // 审批配置
  const [approvalConfig, setApprovalConfig] = useState<ApprovalConfig>(
    DEFAULT_APPROVAL_CONFIG
  );
  // 质量门禁配置
  const [qualityGateConfig, setQualityGateConfig] = useState<QualityGateConfig>(
    DEFAULT_QUALITY_GATE_CONFIG
  );
  // 子流水线相关状态
  const [pipelineOptions, setPipelineOptions] = useState<PipelineOption[]>([]);
  const [subPipelineParams, setSubPipelineParams] = useState<ParamEntry[]>([{ key: '', value: '' }]);

  useEffect(() => {
    if (stage) {
      form.setFieldsValue({
        name: stage.name,
        type: stage.type,
        timeout: stage.timeout,
        retryCount: stage.retryCount,
        dependsOn: stage.dependsOn,
        script: (stage.config?.script as string) ?? '',
        command: (stage.config?.command as string) ?? '',
        image: (stage.config?.image as string) ?? '',
        env: (stage.config?.env as string) ?? '',
        subPipelineId: stage.type === 'sub-pipeline' ? stage.subPipeline?.pipelineId : undefined,
        subPipelineBranch: stage.type === 'sub-pipeline' ? stage.subPipeline?.branch : 'main',
        cacheEnabled: stage.cache?.enabled || false,
        cacheKey: stage.cache?.key || '',
        cacheRestoreKeys: stage.cache?.restoreKeys?.join('\n') || '',
        artifactUpload: stage.artifacts?.upload?.join('\n') || '',
        artifactExpiry: stage.artifacts?.expiry || 7,
      } as unknown as StageFormValues);
      setCachePaths(stage.cache?.paths?.length ? stage.cache.paths : ['']);
      setArtifactPaths(stage.artifacts?.upload?.length ? stage.artifacts.upload : ['']);
      // 加载子流水线参数
      if (stage.type === 'sub-pipeline' && stage.subPipeline) {
        const paramsArr = stage.subPipeline.params
          ? Object.entries(stage.subPipeline.params).map(([key, value]) => ({ key, value }))
          : [{ key: '', value: '' }];
        setSubPipelineParams(paramsArr);
      } else {
        setSubPipelineParams([{ key: '', value: '' }]);
      }
      // 加载矩阵构建配置
      setMatrixConfig(stage.matrix || DEFAULT_MATRIX_CONFIG);
      // 加载 PR 触发配置
      setPrTriggerConfig(stage.prTrigger ?? DEFAULT_PR_TRIGGER_CONFIG);
      // 加载超时配置
      setTimeoutConfig(stage.timeoutConfig ?? DEFAULT_TIMEOUT_CONFIG);
      // 加载审批配置
      setApprovalConfig(stage.approvalConfig ?? DEFAULT_APPROVAL_CONFIG);
      // 加载质量门禁配置
      setQualityGateConfig(stage.qualityGateConfig ?? DEFAULT_QUALITY_GATE_CONFIG);
    } else {
      form.resetFields();
      setCachePaths(['']);
      setArtifactPaths(['']);
      setSubPipelineParams([{ key: '', value: '' }]);
      setMatrixConfig(DEFAULT_MATRIX_CONFIG);
      setPrTriggerConfig(DEFAULT_PR_TRIGGER_CONFIG);
      setTimeoutConfig(DEFAULT_TIMEOUT_CONFIG);
      setApprovalConfig(DEFAULT_APPROVAL_CONFIG);
      setQualityGateConfig(DEFAULT_QUALITY_GATE_CONFIG);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 派生值随 stage 变化
  }, [stage, form, visible]);

  // 加载可用流水线列表（用于子流水线选择）
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getPipelines()
      .then((res) => {
        if (cancelled) return;
        const data = res.data ?? res.data;
        const list = Array.isArray(data) ? data : [];
        setPipelineOptions(
          list.map((p: { id: string; name: string }) => ({
            label: p.name,
            value: p.id,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setPipelineOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  return {
    cachePaths,
    setCachePaths,
    artifactPaths,
    setArtifactPaths,
    subPipelineParams,
    setSubPipelineParams,
    matrixConfig,
    setMatrixConfig,
    prTriggerConfig,
    setPrTriggerConfig,
    timeoutConfig,
    setTimeoutConfig,
    approvalConfig,
    setApprovalConfig,
    qualityGateConfig,
    setQualityGateConfig,
    pipelineOptions,
  };
}
