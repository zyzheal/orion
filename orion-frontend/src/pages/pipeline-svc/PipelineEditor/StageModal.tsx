/**
 * StageModal - Stage 配置弹窗
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Divider,
  Switch,
  Button,
  Card,
  message,
  Tag,
  Collapse,
  Radio,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  BranchesOutlined,
  UserOutlined,
  SafetyOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type {
  StageConfig,
  MatrixBuildConfig,
  TimeoutConfig,
  ApprovalConfig,
  QualityGateConfig,
  QualityGateRule,
} from './types';
import MatrixConfigurator from '@/components/MatrixConfigurator';
import PRTriggerConfigComponent, { type PRTriggerConfig as PRTriggerConfigType } from '@/components/PRTriggerConfig';
import { getPipelines } from '@/api/pipelines';

const { TextArea } = Input;

const STAGE_TYPES = [
  { label: '🔨 构建 (Build)', value: 'build' },
  { label: '🧪 测试 (Test)', value: 'test' },
  { label: '🔍 代码扫描 (Scan)', value: 'scan' },
  { label: '🚀 部署 (Deploy)', value: 'deploy' },
  { label: '📢 通知 (Notify)', value: 'notify' },
  { label: '🔀 子流水线 (Sub-Pipeline)', value: 'sub-pipeline' },
  { label: '🏷️ 多架构构建 (Buildx)', value: 'buildx' },
  { label: '📦 容器运行 (Container)', value: 'container' },
  { label: '📱 APK 上传 (APK Upload)', value: 'apk-upload' },
  { label: '⚙️ 自定义 (Custom)', value: 'custom' },
];

interface StageModalProps {
  visible: boolean;
  stage: StageConfig | null;
  availableDependencies: { label: string; value: string }[];
  onSave: (values: StageConfig) => void;
  onCancel: () => void;
}

const StageModal: React.FC<StageModalProps> = ({
  visible,
  stage,
  availableDependencies,
  onSave,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const [cachePaths, setCachePaths] = useState<string[]>(['']);
  const [artifactPaths, setArtifactPaths] = useState<string[]>(['']);
  const [matrixConfig, setMatrixConfig] = useState<MatrixBuildConfig>({
    enabled: false,
    dimensions: [],
    exclusions: [],
  });
  const [prTriggerConfig, setPrTriggerConfig] = useState<Partial<PRTriggerConfigType>>({
    enabled: false,
    provider: 'github',
    prActions: ['opened', 'synchronize'],
  });
  // 超时配置
  const [timeoutConfig, setTimeoutConfig] = useState<TimeoutConfig>({
    enabled: false,
    duration: 300,
    action: 'fail',
    retryCount: 1,
  });
  // 审批配置
  const [approvalConfig, setApprovalConfig] = useState<ApprovalConfig>({
    enabled: false,
    approvers: [],
    mode: 'any',
    timeout: 24,
    timeoutAction: 'reject',
  });
  // 质量门禁配置
  const [qualityGateConfig, setQualityGateConfig] = useState<QualityGateConfig>({
    enabled: false,
    rules: [],
    failureAction: 'block',
  });
  // 子流水线相关状态
  const [pipelineOptions, setPipelineOptions] = useState<{ label: string; value: string }[]>([]);
  const [subPipelineParams, setSubPipelineParams] = useState<{ key: string; value: string }[]>([
    { key: '', value: '' },
  ]);

  useEffect(() => {
    if (stage) {
      form.setFieldsValue({
        name: stage.name,
        type: stage.type,
        timeout: stage.timeout,
        retryCount: stage.retryCount,
        dependsOn: stage.dependsOn,
        script: stage.config?.script || '',
        command: stage.config?.command || '',
        image: stage.config?.image || '',
        env: stage.config?.env || '',
        subPipelineId: stage.type === 'sub-pipeline' ? stage.subPipeline?.pipelineId : undefined,
        subPipelineBranch: stage.type === 'sub-pipeline' ? stage.subPipeline?.branch : 'main',
        cacheEnabled: stage.cache?.enabled || false,
        cacheKey: stage.cache?.key || '',
        cacheRestoreKeys: stage.cache?.restoreKeys?.join('\n') || '',
        artifactUpload: stage.artifacts?.upload?.join('\n') || '',
        artifactExpiry: stage.artifacts?.expiry || 7,
      });
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
      setMatrixConfig(
        stage.matrix || {
          enabled: false,
          dimensions: [],
          exclusions: [],
        }
      );
      // 加载 PR 触发配置
      if (stage.prTrigger) {
        setPrTriggerConfig(stage.prTrigger);
      } else {
        setPrTriggerConfig({
          enabled: false,
          provider: 'github',
          prActions: ['opened', 'synchronize'],
        });
      }
      // 加载超时配置
      if (stage.timeoutConfig) {
        setTimeoutConfig(stage.timeoutConfig);
      } else {
        setTimeoutConfig({
          enabled: false,
          duration: 300,
          action: 'fail',
          retryCount: 1,
        });
      }
      // 加载审批配置
      if (stage.approvalConfig) {
        setApprovalConfig(stage.approvalConfig);
      } else {
        setApprovalConfig({
          enabled: false,
          approvers: [],
          mode: 'any',
          timeout: 24,
          timeoutAction: 'reject',
        });
      }
      // 加载质量门禁配置
      if (stage.qualityGateConfig) {
        setQualityGateConfig(stage.qualityGateConfig);
      } else {
        setQualityGateConfig({
          enabled: false,
          rules: [],
          failureAction: 'block',
        });
      }
    } else {
      form.resetFields();
      setCachePaths(['']);
      setArtifactPaths(['']);
      setSubPipelineParams([{ key: '', value: '' }]);
      setMatrixConfig({
        enabled: false,
        dimensions: [],
        exclusions: [],
      });
      setTimeoutConfig({
        enabled: false,
        duration: 300,
        action: 'fail',
        retryCount: 1,
      });
      setApprovalConfig({
        enabled: false,
        approvers: [],
        mode: 'any',
        timeout: 24,
        timeoutAction: 'reject',
      });
      setQualityGateConfig({
        enabled: false,
        rules: [],
        failureAction: 'block',
      });
    }
  }, [stage, form, visible]);

  // 加载可用流水线列表（用于子流水线选择）
  useEffect(() => {
    if (visible) {
      getPipelines()
        .then((res) => {
          const data = res.data?.data ?? res.data;
          const list = Array.isArray(data) ? data : [];
          const opts = list.map((p: { id: string; name: string }) => ({
            label: p.name,
            value: p.id,
          }));
          setPipelineOptions(opts);
        })
        .catch(() => {
          setPipelineOptions([]);
        });
    }
  }, [visible]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const stageConfig: StageConfig = {
        id: stage?.id || `stage-${Date.now()}`,
        name: values.name,
        type: values.type,
        timeout: values.timeout,
        retryCount: values.retryCount,
        dependsOn: values.dependsOn,
        config: {
          script: values.script,
          command: values.command,
          image: values.image,
          env: values.env,
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
          containerResources: values.containerResources ? {
            cpu: values.containerCpu,
            memory: values.containerMemory,
            gpu: values.containerGpu ? {
              devices: values.containerGpuDevices,
              capabilities: values.containerGpuCapabilities?.split(',').filter(Boolean),
            } : undefined,
          } : undefined,
          containerNetwork: values.containerNetwork,
        },
        // APK 上传配置
        apkUpload: values.type === 'apk-upload'
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
              paths: cachePaths.filter((p) => p.trim()),
              restoreKeys: values.cacheRestoreKeys?.split('\n').filter((k: string) => k.trim()),
            }
          : undefined,
        // Artifact 配置
        artifacts: {
          upload: artifactPaths.filter((p) => p.trim()),
          expiry: values.artifactExpiry,
        },
        // 子流水线配置
        subPipeline:
          values.type === 'sub-pipeline' && values.subPipelineId
            ? {
                pipelineId: values.subPipelineId,
                branch: values.subPipelineBranch || 'main',
                params: subPipelineParams
                  .filter((p) => p.key.trim())
                  .reduce(
                    (acc, p) => ({ ...acc, [p.key.trim()]: p.value.trim() }),
                    {} as Record<string, string>
                  ),
              }
            : undefined,
        // 矩阵构建配置
        matrix: matrixConfig.enabled
          ? {
              enabled: true,
              dimensions: matrixConfig.dimensions,
              exclusions: matrixConfig.exclusions,
            }
          : undefined,
        // PR/MR 触发配置 - 显式构建完整对象，确保必填字段
        prTrigger: prTriggerConfig?.enabled
          ? {
              ...prTriggerConfig,
              enabled: true,
              provider: prTriggerConfig.provider || 'github',
              prActions: prTriggerConfig.prActions || ['opened', 'synchronize'],
              branchFilter: prTriggerConfig.branchFilter || {
                targetBranches: ['main', 'master', 'develop'],
              },
              pathFilter: prTriggerConfig.pathFilter || {
                includePaths: [],
                excludePaths: ['docs/**', '*.md'],
              },
              labelFilter: prTriggerConfig.labelFilter || {
                requiredLabels: [],
                excludedLabels: ['wip', 'do-not-merge'],
              },
              draftPolicy: prTriggerConfig.draftPolicy || 'skip',
              securityLevel: prTriggerConfig.securityLevel || 'safe',
            } as PRTriggerConfigType
          : undefined,
        // 超时配置
        timeoutConfig: timeoutConfig.enabled ? timeoutConfig : undefined,
        // 审批配置
        approvalConfig: approvalConfig.enabled ? approvalConfig : undefined,
        // 质量门禁配置
        qualityGateConfig: qualityGateConfig.enabled ? qualityGateConfig : undefined,
      };
      onSave(stageConfig);
    } catch (error: unknown) {
      // Ant Design 表单验证失败会自动显示错误
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      message.error('保存失败');
    }
  };

  // 缓存路径管理
  const handleAddCachePath = () => setCachePaths([...cachePaths, '']);
  const handleRemoveCachePath = (index: number) => {
    const newPaths = cachePaths.filter((_, i) => i !== index);
    setCachePaths(newPaths.length ? newPaths : ['']);
  };
  const handleUpdateCachePath = (index: number, value: string) => {
    const newPaths = [...cachePaths];
    newPaths[index] = value;
    setCachePaths(newPaths);
  };

  // Artifact 路径管理
  const handleAddArtifactPath = () => setArtifactPaths([...artifactPaths, '']);
  const handleRemoveArtifactPath = (index: number) => {
    const newPaths = artifactPaths.filter((_, i) => i !== index);
    setArtifactPaths(newPaths.length ? newPaths : ['']);
  };
  const handleUpdateArtifactPath = (index: number, value: string) => {
    const newPaths = [...artifactPaths];
    newPaths[index] = value;
    setArtifactPaths(newPaths);
  };

  // 质量门禁规则管理
  const handleAddQualityRule = () => {
    const newRule: QualityGateRule = {
      id: `rule-${Date.now()}`,
      metric: 'test_pass_rate',
      operator: '>=',
      threshold: 80,
    };
    setQualityGateConfig((prev) => ({
      ...prev,
      rules: [...prev.rules, newRule],
    }));
  };
  const handleRemoveQualityRule = (id: string) => {
    setQualityGateConfig((prev) => ({
      ...prev,
      rules: prev.rules.filter((r) => r.id !== id),
    }));
  };
  const handleUpdateQualityRule = (id: string, field: keyof QualityGateRule, value: any) => {
    setQualityGateConfig((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    }));
  };

  // 审批人管理
  const handleAddApprover = () => {
    setApprovalConfig((prev) => ({
      ...prev,
      approvers: [...prev.approvers, ''],
    }));
  };
  const handleRemoveApprover = (index: number) => {
    setApprovalConfig((prev) => ({
      ...prev,
      approvers: prev.approvers.filter((_, i) => i !== index),
    }));
  };
  const handleUpdateApprover = (index: number, value: string) => {
    setApprovalConfig((prev) => ({
      ...prev,
      approvers: prev.approvers.map((a, i) => (i === index ? value : a)),
    }));
  };

  const METRIC_OPTIONS = [
    { label: '测试通过率', value: 'test_pass_rate' },
    { label: '代码覆盖率', value: 'coverage' },
    { label: '漏洞数量', value: 'vulnerability_count' },
    { label: '自定义指标', value: 'custom' },
  ];

  const OPERATOR_OPTIONS = [
    { label: '>', value: '>' },
    { label: '<', value: '<' },
    { label: '>=', value: '>=' },
    { label: '<=', value: '<=' },
    { label: '==', value: '==' },
  ];

  return (
    <Modal
      title={stage ? '编辑阶段' : '添加阶段'}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      width={800}
      okText="保存"
      cancelText="取消"
      footer={
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" onClick={handleOk}>
            保存
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark
        initialValues={{
          timeout: 300,
          retryCount: 0,
          cacheEnabled: false,
          artifactExpiry: 7,
        }}
      >
        <Form.Item
          label="阶段名称"
          name="name"
          rules={[
            { required: true, message: '请输入阶段名称' },
            { pattern: /^[a-zA-Z0-9_-]+$/, message: '只能包含字母、数字、下划线和连字符' },
          ]}
        >
          <Input placeholder="例如：build-app" maxLength={50} showCount />
        </Form.Item>

        <Form.Item
          label="阶段类型"
          name="type"
          rules={[{ required: true, message: '请选择阶段类型' }]}
        >
          <Select placeholder="选择类型" options={STAGE_TYPES} />
        </Form.Item>

        <Divider orientation="left" orientationMargin={0}>
          高级设置
        </Divider>

        <Form.Item label="超时时间 (秒)" name="timeout" tooltip="超过此时间后阶段将被终止">
          <InputNumber
            min={0}
            max={7200}
            step={60}
            style={{ width: '100%' }}
            placeholder="默认 300 秒"
            formatter={(value) => `${value}s`}
            parser={(value) => Number(value?.replace('s', '')) ?? 0}
          />
        </Form.Item>

        <Form.Item label="重试次数" name="retryCount" tooltip="失败后自动重试的次数">
          <InputNumber min={0} max={5} style={{ width: '100%' }} placeholder="默认 0 次" />
        </Form.Item>

        <Form.Item label="依赖阶段" name="dependsOn" tooltip="当前阶段执行前需要完成的阶段">
          <Select
            mode="multiple"
            placeholder="选择依赖的阶段"
            options={availableDependencies}
            maxTagCount="responsive"
            allowClear
          />
        </Form.Item>

        <Divider orientation="left" orientationMargin={0}>
          执行配置
        </Divider>

        <Form.Item label="脚本内容" name="script" tooltip="Shell 脚本内容">
          <TextArea
            rows={4}
            placeholder="#!/bin/bash&#10;echo 'Hello, World!'"
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>

        <Form.Item
          label="执行命令"
          name="command"
          tooltip="直接执行的命令"
          dependencies={['script']}
          rules={[
            {
              validator: (_, value) => {
                const script = form.getFieldValue('script');
                if (!value && !script) {
                  return Promise.resolve(); // 两者都为空也可以
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <Input placeholder="例如：npm run build" />
        </Form.Item>

        <Form.Item label="Docker 镜像" name="image" tooltip="执行此阶段的 Docker 镜像">
          <Input placeholder="例如：node:18-alpine" />
        </Form.Item>

        <Form.Item label="环境变量" name="env" tooltip="格式：KEY=VALUE，每行一个">
          <TextArea
            rows={3}
            placeholder="NODE_ENV=production&#10;API_URL=https://api.example.com"
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>

        {/* 子流水线配置（仅当类型是 sub-pipeline 时显示） */}
        <Form.Item noStyle shouldUpdate={(prev, curr) => prev.type !== curr.type}>
          {(formInstance) =>
            formInstance.getFieldValue('type') === 'sub-pipeline' && (
              <Card size="small" style={{ marginBottom: 16 }} title={<Space><BranchesOutlined /> 子流水线配置</Space>}>
                <Form.Item
                  label="选择流水线"
                  name="subPipelineId"
                  rules={[{ required: true, message: '请选择要调用的子流水线' }]}
                >
                  <Select
                    placeholder="选择目标流水线"
                    options={pipelineOptions}
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </Form.Item>

                <Form.Item
                  label="分支"
                  name="subPipelineBranch"
                  tooltip="指定子流水线使用的分支，留空则使用默认分支"
                >
                  <Input placeholder="例如：main, develop" />
                </Form.Item>

                <Form.Item label="传递参数">
                  <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    {subPipelineParams.map((param, index) => (
                      <Space key={index} style={{ width: '100%' }}>
                        <Input
                          value={param.key}
                          onChange={(e) => {
                            const newParams = [...subPipelineParams];
                            newParams[index] = { ...newParams[index], key: e.target.value };
                            setSubPipelineParams(newParams);
                          }}
                          placeholder="参数名"
                          style={{ flex: 1 }}
                        />
                        <Input
                          value={param.value}
                          onChange={(e) => {
                            const newParams = [...subPipelineParams];
                            newParams[index] = { ...newParams[index], value: e.target.value };
                            setSubPipelineParams(newParams);
                          }}
                          placeholder="参数值"
                          style={{ flex: 1.5 }}
                        />
                        <Button
                          icon={<PlusOutlined />}
                          onClick={() => {
                            setSubPipelineParams([...subPipelineParams, { key: '', value: '' }]);
                          }}
                        />
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            if (subPipelineParams.length === 1) {
                              setSubPipelineParams([{ key: '', value: '' }]);
                            } else {
                              setSubPipelineParams(subPipelineParams.filter((_, i) => i !== index));
                            }
                          }}
                          disabled={subPipelineParams.length === 1}
                        />
                      </Space>
                    ))}
                  </Space>
                </Form.Item>
              </Card>
            )
          }
        </Form.Item>

        {/* Buildx 多架构构建配置 */}
        <Form.Item noStyle shouldUpdate={(prev, curr) => prev.type !== curr.type}>
          {(formInstance) =>
            formInstance.getFieldValue('type') === 'buildx' && (
              <Card size="small" style={{ marginBottom: 16 }} title={<Space>🏷️ 多架构构建配置</Space>}>
                <Form.Item
                  label="镜像名称"
                  name="buildxImageName"
                  rules={[{ required: true, message: '请输入镜像名称' }]}
                  tooltip="例如：registry.example.com/my-app"
                >
                  <Input placeholder="registry.example.com/my-app" />
                </Form.Item>

                <Form.Item label="标签 (Tag)" name="buildxTag" tooltip="镜像标签">
                  <Input placeholder="latest" />
                </Form.Item>

                <Form.Item
                  label="目标平台"
                  name="buildxPlatforms"
                  rules={[{ required: true, message: '请选择至少一个平台' }]}
                  tooltip="支持的平台架构"
                >
                  <Select
                    mode="multiple"
                    placeholder="选择目标平台"
                    options={[
                      { label: 'linux/amd64', value: 'linux/amd64' },
                      { label: 'linux/arm64', value: 'linux/arm64' },
                      { label: 'linux/arm/v7', value: 'linux/arm/v7' },
                      { label: 'linux/s390x', value: 'linux/s390x' },
                      { label: 'linux/ppc64le', value: 'linux/ppc64le' },
                    ]}
                  />
                </Form.Item>

                <Form.Item label="Dockerfile 路径" name="buildxDockerfile" tooltip="Dockerfile 的相对路径">
                  <Input placeholder="Dockerfile" />
                </Form.Item>

                <Form.Item label="构建上下文" name="buildxContext" tooltip="构建上下文目录">
                  <Input placeholder="." />
                </Form.Item>

                <Form.Item label="推送镜像" name="buildxPush" valuePropName="checked" tooltip="构建完成后推送到镜像仓库">
                  <Switch />
                </Form.Item>
              </Card>
            )
          }
        </Form.Item>

        {/* Container 容器运行配置 */}
        <Form.Item noStyle shouldUpdate={(prev, curr) => prev.type !== curr.type}>
          {(formInstance) =>
            (formInstance.getFieldValue('type') === 'container' || formInstance.getFieldValue('type') === 'apk-upload') && (
              <>
                {formInstance.getFieldValue('type') === 'container' && (
                  <Card size="small" style={{ marginBottom: 16 }} title={<Space>📦 容器运行配置</Space>}>
                    <Form.Item
                      label="容器镜像"
                      name="containerImage"
                      rules={[{ required: true, message: '请输入容器镜像' }]}
                      tooltip="例如：node:18-alpine"
                    >
                      <Input placeholder="node:18-alpine" />
                    </Form.Item>

                <Form.Item label="启动命令" name="containerCommand" tooltip="容器启动时执行的命令">
                  <Input placeholder="npm run test" />
                </Form.Item>

                <Form.Item label="启动参数" name="containerArgs" tooltip="每行一个参数">
                  <TextArea rows={2} placeholder="--env=production&#10;--port=3000" style={{ fontFamily: 'monospace' }} />
                </Form.Item>

                <Form.Item label="环境变量" name="containerEnv" tooltip="格式：KEY=VALUE，每行一个">
                  <TextArea rows={2} placeholder="NODE_ENV=production&#10;API_URL=https://api.example.com" style={{ fontFamily: 'monospace' }} />
                </Form.Item>

                <Form.Item label="资源限制" name="containerResources" valuePropName="checked">
                  <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                </Form.Item>

                <Form.Item noStyle shouldUpdate={(prev, curr) => prev.containerResources !== curr.containerResources}>
                  {(fi) =>
                    fi.getFieldValue('containerResources') && (
                      <>
                        <Form.Item label="CPU 限制" name="containerCpu" tooltip="例如：2.0 表示 2 个 CPU">
                          <InputNumber min={0.1} max={16} step={0.1} style={{ width: '100%' }} placeholder="2.0" />
                        </Form.Item>
                        <Form.Item label="内存限制" name="containerMemory" tooltip="例如：4g, 512m">
                          <Input placeholder="4g" />
                        </Form.Item>
                        <Form.Item label="启用 GPU" name="containerGpu" valuePropName="checked">
                          <Switch />
                        </Form.Item>
                        <Form.Item noStyle shouldUpdate={(prev, curr) => prev.containerGpu !== curr.containerGpu}>
                          {(fi2) =>
                            fi2.getFieldValue('containerGpu') && (
                              <>
                                <Form.Item label="GPU 设备" name="containerGpuDevices" tooltip="例如：all, 0, device=GPU-uuid">
                                  <Input placeholder="all" />
                                </Form.Item>
                                <Form.Item label="GPU 能力" name="containerGpuCapabilities" tooltip="逗号分隔">
                                  <Input placeholder="compute,utility" />
                                </Form.Item>
                              </>
                            )
                          }
                        </Form.Item>
                      </>
                    )
                  }
                </Form.Item>

                <Form.Item label="网络模式" name="containerNetwork" tooltip="容器网络模式">
                  <Select
                    placeholder="选择网络模式"
                    options={[
                      { label: 'host', value: 'host' },
                      { label: 'bridge', value: 'bridge' },
                      { label: 'none', value: 'none' },
                    ]}
                  />
                </Form.Item>
              </Card>
                )}
                {/* APK Upload 配置 */}
                {formInstance.getFieldValue('type') === 'apk-upload' && (
                  <Card size="small" style={{ marginBottom: 16 }} title={<Space>📱 APK 上传配置</Space>}>
                    <Form.Item
                      label="上传类型"
                      name="apkUploadType"
                      initialValue="single"
                      tooltip="单市场上传或并行多市场上传"
                    >
                      <Select
                        placeholder="选择上传类型"
                        options={[
                          { label: '单市场 (Single)', value: 'single' },
                          { label: '多市场并行 (Parallel)', value: 'parallel' },
                        ]}
                      />
                    </Form.Item>

                    <Form.Item
                      label="应用市场"
                      name="apkMarket"
                      tooltip="选择要上传的应用市场（单市场模式）"
                      rules={[{ required: true, message: '请选择应用市场' }]}
                    >
                      <Select
                        placeholder="选择目标市场"
                        options={[
                          { label: '华为 AppGallery', value: 'huawei' },
                          { label: '小米应用商店', value: 'xiaomi' },
                          { label: 'OPPO 软件商店', value: 'oppo' },
                          { label: 'VIVO 应用商店', value: 'vivo' },
                          { label: '荣耀应用市场', value: 'honor' },
                          { label: '腾讯应用宝', value: 'tencent' },
                          { label: 'Google Play', value: 'googleplay' },
                          { label: '三星 Galaxy Store', value: 'samsung' },
                          { label: '蒲公英', value: 'pgyer' },
                          { label: 'fir.im', value: 'fir' },
                        ]}
                      />
                    </Form.Item>

                    {/* 多市场并行配置 */}
                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, curr) => prev.apkUploadType !== curr.apkUploadType}
                    >
                      {({ getFieldValue }) =>
                        getFieldValue('apkUploadType') === 'parallel' && (
                          <Form.Item
                            label="目标市场列表"
                            name="apkMarkets"
                            tooltip="选择要并行上传的多个应用市场"
                            rules={[{ required: true, message: '请至少选择一个市场' }]}
                          >
                            <Select
                              mode="multiple"
                              placeholder="选择多个目标市场"
                              options={[
                                { label: '华为 AppGallery', value: 'huawei' },
                                { label: '小米应用商店', value: 'xiaomi' },
                                { label: 'OPPO 软件商店', value: 'oppo' },
                                { label: 'VIVO 应用商店', value: 'vivo' },
                                { label: '荣耀应用市场', value: 'honor' },
                                { label: '腾讯应用宝', value: 'tencent' },
                                { label: 'Google Play', value: 'googleplay' },
                                { label: '三星 Galaxy Store', value: 'samsung' },
                                { label: '蒲公英', value: 'pgyer' },
                                { label: 'fir.im', value: 'fir' },
                              ]}
                            />
                          </Form.Item>
                        )
                      }
                    </Form.Item>

                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, curr) => prev.apkUploadType !== curr.apkUploadType}
                    >
                      {({ getFieldValue }) =>
                        getFieldValue('apkUploadType') !== 'parallel' && (
                          <Form.Item
                            label="应用市场"
                            name="apkMarket"
                            tooltip="选择要上传的应用市场（单市场模式）"
                            rules={[{ required: true, message: '请选择应用市场' }]}
                          >
                            <Select
                              placeholder="选择目标市场"
                              options={[
                                { label: '华为 AppGallery', value: 'huawei' },
                                { label: '小米应用商店', value: 'xiaomi' },
                                { label: 'OPPO 软件商店', value: 'oppo' },
                                { label: 'VIVO 应用商店', value: 'vivo' },
                                { label: '荣耀应用市场', value: 'honor' },
                                { label: '腾讯应用宝', value: 'tencent' },
                                { label: 'Google Play', value: 'googleplay' },
                                { label: '三星 Galaxy Store', value: 'samsung' },
                                { label: '蒲公英', value: 'pgyer' },
                                { label: 'fir.im', value: 'fir' },
                              ]}
                            />
                          </Form.Item>
                        )
                      }
                    </Form.Item>

                    <Form.Item
                      label="APK 文件路径"
                      name="apkPath"
                      rules={[{ required: true, message: '请输入 APK 文件路径' }]}
                      tooltip="APK 文件在构建产物中的路径"
                    >
                      <Input placeholder="例如：./build/app-release.apk" />
                    </Form.Item>

                    <Form.Item
                      label="应用包名"
                      name="packageName"
                      rules={[{ required: true, message: '请输入应用包名' }]}
                      tooltip="Android 应用的包名，如：com.example.app"
                    >
                      <Input placeholder="例如：com.example.app" />
                    </Form.Item>

                    <Form.Item
                      label="版本名称"
                      name="versionName"
                      tooltip="应用的版本名称（可选）"
                    >
                      <Input placeholder="例如：1.0.0" />
                    </Form.Item>

                    <Form.Item
                      label="更新日志"
                      name="changelog"
                      tooltip="版本更新说明"
                    >
                      <TextArea
                        rows={3}
                        placeholder="描述此次更新的内容..."
                      />
                    </Form.Item>

                    <Form.Item
                      label="市场凭证"
                      name="apkCredentials"
                      tooltip="选择已配置的市场凭证（支持 Secret 引用），格式: ${secrets.apk-{market}-credentials}"
                    >
                      <Input placeholder="例如：${secrets.apk-huawei-credentials}（支持：huawei/xiaomi/oppo/vivo/honor/pgyer/fir/googleplay/samsung/tencent）" />
                    </Form.Item>

                    <Form.Item
                      label="发布渠道"
                      name="apkChannel"
                      tooltip="发布渠道：production/beta/alpha/internal"
                    >
                      <Select
                        placeholder="选择发布渠道"
                        options={[
                          { label: '正式 (Production)', value: 'production' },
                          { label: '测试版 (Beta)', value: 'beta' },
                          { label: '内测版 (Alpha)', value: 'alpha' },
                          { label: '内部 (Internal)', value: 'internal' },
                        ]}
                      />
                    </Form.Item>
                  </Card>
                )}
              </>
            )
          }
        </Form.Item>

        {/* 缓存配置 */}
        <Divider orientation="left" orientationMargin={0}>
          <Space>
            <Form.Item noStyle name="cacheEnabled" valuePropName="checked">
              <Switch size="small" />
            </Form.Item>
            <span>启用构建缓存</span>
          </Space>
        </Divider>

        <Form.Item noStyle shouldUpdate>
          {(formInstance) =>
            formInstance.getFieldValue('cacheEnabled') && (
              <Card size="small" style={{ marginBottom: 16 }}>
                <Form.Item
                  label="缓存 Key"
                  name="cacheKey"
                  tooltip="缓存的唯一标识，可使用表达式如 ${{ hashFiles('package-lock.json') }}"
                  rules={[{ required: true, message: '请输入缓存 Key' }]}
                >
                  <Input placeholder="例如：npm-${{ hashFiles('package-lock.json') }}" />
                </Form.Item>

                <Form.Item label="缓存路径" required>
                  <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    {cachePaths.map((path, index) => (
                      <Space key={index} style={{ width: '100%' }}>
                        <Input
                          value={path}
                          onChange={(e) => handleUpdateCachePath(index, e.target.value)}
                          placeholder="例如：node_modules, .npm/cache"
                          style={{ flex: 1 }}
                        />
                        <Button icon={<PlusOutlined />} onClick={handleAddCachePath} />
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveCachePath(index)}
                          disabled={cachePaths.length === 1}
                        />
                      </Space>
                    ))}
                  </Space>
                </Form.Item>

                <Form.Item
                  label="恢复 Key 前缀"
                  name="cacheRestoreKeys"
                  tooltip="用于匹配缓存的前缀列表，每行一个"
                >
                  <TextArea
                    rows={2}
                    placeholder="npm-&#10;build-"
                    style={{ fontFamily: 'monospace' }}
                  />
                </Form.Item>
              </Card>
            )
          }
        </Form.Item>

        {/* Artifact 配置 */}
        <Divider orientation="left" orientationMargin={0}>
          构建产物 (Artifact)
        </Divider>

        <Card size="small" style={{ marginBottom: 16 }}>
          <Form.Item label="上传路径" required>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              {artifactPaths.map((path, index) => (
                <Space key={index} style={{ width: '100%' }}>
                  <Input
                    value={path}
                    onChange={(e) => handleUpdateArtifactPath(index, e.target.value)}
                    placeholder="例如：dist/, build/*.jar"
                    style={{ flex: 1 }}
                  />
                  <Button icon={<PlusOutlined />} onClick={handleAddArtifactPath} />
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveArtifactPath(index)}
                    disabled={artifactPaths.length === 1}
                  />
                </Space>
              ))}
            </Space>
          </Form.Item>

          <Form.Item
            label="过期时间 (天)"
            name="artifactExpiry"
            tooltip="构建产物保留天数，0 表示永久保存"
          >
            <InputNumber min={0} max={365} style={{ width: '100%' }} placeholder="默认 7 天" />
          </Form.Item>
        </Card>

        {/* 矩阵构建配置 */}
        <Divider orientation="left" orientationMargin={0}>
          <Space>
            <ThunderboltOutlined style={{ color: '#faad14' }} />
            <span>矩阵构建 (Matrix Build)</span>
          </Space>
        </Divider>

        <Form.Item noStyle shouldUpdate>
          <Card
            size="small"
            style={{ marginBottom: 16 }}
            extra={
              <Space>
                <span>启用矩阵构建</span>
                <Switch
                  checked={matrixConfig.enabled}
                  onChange={(checked) =>
                    setMatrixConfig((prev) => ({
                      ...prev,
                      enabled: checked,
                      dimensions: checked ? prev.dimensions : [],
                      exclusions: checked ? prev.exclusions : [],
                    }))
                  }
                />
              </Space>
            }
          >
            {matrixConfig.enabled ? (
              <MatrixConfigurator
                value={matrixConfig}
                onChange={setMatrixConfig}
              />
            ) : (
              <div style={{ padding: '8px 0', color: '#999' }}>
                启用后可在多个维度上并行构建，例如同时测试多个 Node.js 版本和操作系统
              </div>
            )}
          </Card>
        </Form.Item>

        {/* PR/MR 触发配置 */}
        <Divider orientation="left" orientationMargin={0}>
          <Space>
            <BranchesOutlined />
            <span>PR/MR 触发配置</span>
          </Space>
        </Divider>

        <Form.Item noStyle shouldUpdate>
          <PRTriggerConfigComponent
            value={prTriggerConfig}
            onChange={(config) => setPrTriggerConfig(config as Partial<PRTriggerConfigType>)}
          />
        </Form.Item>

        {/* 超时配置 */}
        <Divider orientation="left" orientationMargin={0}>
          <Space>
            <ClockCircleOutlined />
            <span>超时策略配置</span>
          </Space>
        </Divider>

        <Card size="small" style={{ marginBottom: 16 }}>
          <Form.Item label="启用超时策略" valuePropName="checked">
            <Switch
              checked={timeoutConfig.enabled}
              onChange={(checked) =>
                setTimeoutConfig((prev) => ({ ...prev, enabled: checked }))
              }
              checkedChildren="启用"
              unCheckedChildren="禁用"
            />
          </Form.Item>

          {timeoutConfig.enabled && (
            <>
              <Form.Item label="超时时长 (秒)" tooltip="阶段执行超过此时间将触发超时策略">
                <InputNumber
                  min={1}
                  max={7200}
                  step={60}
                  value={timeoutConfig.duration}
                  onChange={(value) =>
                    setTimeoutConfig((prev) => ({ ...prev, duration: value || 300 }))
                  }
                  style={{ width: '100%' }}
                  placeholder="默认 300 秒"
                />
              </Form.Item>

              <Form.Item label="超时后动作">
                <Radio.Group
                  value={timeoutConfig.action}
                  onChange={(e) =>
                    setTimeoutConfig((prev) => ({ ...prev, action: e.target.value }))
                  }
                >
                  <Space direction="vertical">
                    <Radio value="fail">
                      <Space>
                        <Tag color="error">失败</Tag>
                        <span>标记阶段为失败</span>
                      </Space>
                    </Radio>
                    <Radio value="skip">
                      <Space>
                        <Tag color="warning">跳过</Tag>
                        <span>跳过当前阶段继续后续阶段</span>
                      </Space>
                    </Radio>
                    <Radio value="retry">
                      <Space>
                        <Tag color="processing">重试</Tag>
                        <span>自动重试指定次数</span>
                      </Space>
                    </Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>

              {timeoutConfig.action === 'retry' && (
                <Form.Item label="重试次数">
                  <InputNumber
                    min={1}
                    max={5}
                    value={timeoutConfig.retryCount}
                    onChange={(value) =>
                      setTimeoutConfig((prev) => ({ ...prev, retryCount: value || 1 }))
                    }
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              )}
            </>
          )}

          {!timeoutConfig.enabled && (
            <div style={{ padding: '8px 0', color: '#999' }}>
              启用后可配置超时时长和超时后的动作（失败/跳过/重试）
            </div>
          )}
        </Card>

        {/* 审批配置 */}
        <Divider orientation="left" orientationMargin={0}>
          <Space>
            <UserOutlined />
            <span>审批配置</span>
          </Space>
        </Divider>

        <Card size="small" style={{ marginBottom: 16 }}>
          <Form.Item label="启用审批" valuePropName="checked">
            <Switch
              checked={approvalConfig.enabled}
              onChange={(checked) =>
                setApprovalConfig((prev) => ({ ...prev, enabled: checked }))
              }
              checkedChildren="启用"
              unCheckedChildren="禁用"
            />
          </Form.Item>

          {approvalConfig.enabled && (
            <>
              <Form.Item label="审批人" required tooltip="输入审批人的用户名或邮箱">
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  {approvalConfig.approvers.map((approver, index) => (
                    <Space key={index} style={{ width: '100%' }}>
                      <Input
                        value={approver}
                        onChange={(e) => handleUpdateApprover(index, e.target.value)}
                        placeholder="输入审批人用户名或邮箱"
                        prefix={<UserOutlined />}
                        style={{ flex: 1 }}
                      />
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveApprover(index)}
                        disabled={approvalConfig.approvers.length === 0}
                      />
                    </Space>
                  ))}
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={handleAddApprover}
                    block
                  >
                    添加审批人
                  </Button>
                </Space>
              </Form.Item>

              <Form.Item label="审批模式">
                <Radio.Group
                  value={approvalConfig.mode}
                  onChange={(e) =>
                    setApprovalConfig((prev) => ({ ...prev, mode: e.target.value }))
                  }
                >
                  <Radio value="any">
                    <Space>
                      <Tag color="success">任一审批</Tag>
                      <span>任意一个审批人通过即可</span>
                    </Space>
                  </Radio>
                  <Radio value="unanimous">
                    <Space>
                      <Tag color="processing">全部审批</Tag>
                      <span>所有审批人都必须通过</span>
                    </Space>
                  </Radio>
                </Radio.Group>
              </Form.Item>

              <Form.Item label="审批超时 (小时)" tooltip="审批人超过此时间未处理将触发超时动作">
                <InputNumber
                  min={1}
                  max={168}
                  value={approvalConfig.timeout}
                  onChange={(value) =>
                    setApprovalConfig((prev) => ({ ...prev, timeout: value || 24 }))
                  }
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Form.Item label="超时动作">
                <Radio.Group
                  value={approvalConfig.timeoutAction}
                  onChange={(e) =>
                    setApprovalConfig((prev) => ({
                      ...prev,
                      timeoutAction: e.target.value,
                    }))
                  }
                >
                  <Radio value="reject">
                    <Tag color="error">自动拒绝</Tag>
                  </Radio>
                  <Radio value="approve">
                    <Tag color="success">自动通过</Tag>
                  </Radio>
                </Radio.Group>
              </Form.Item>
            </>
          )}

          {!approvalConfig.enabled && (
            <div style={{ padding: '8px 0', color: '#999' }}>
              启用后可配置审批人、审批模式和超时处理策略
            </div>
          )}
        </Card>

        {/* 质量门禁配置 */}
        <Divider orientation="left" orientationMargin={0}>
          <Space>
            <SafetyOutlined />
            <span>质量门禁配置</span>
          </Space>
        </Divider>

        <Card size="small" style={{ marginBottom: 16 }}>
          <Form.Item label="启用质量门禁" valuePropName="checked">
            <Switch
              checked={qualityGateConfig.enabled}
              onChange={(checked) =>
                setQualityGateConfig((prev) => ({ ...prev, enabled: checked }))
              }
              checkedChildren="启用"
              unCheckedChildren="禁用"
            />
          </Form.Item>

          {qualityGateConfig.enabled && (
            <>
              <Form.Item label="不通过时的动作">
                <Radio.Group
                  value={qualityGateConfig.failureAction}
                  onChange={(e) =>
                    setQualityGateConfig((prev) => ({
                      ...prev,
                      failureAction: e.target.value,
                    }))
                  }
                >
                  <Space direction="vertical">
                    <Radio value="block">
                      <Space>
                        <Tag color="error">阻断</Tag>
                        <span>阻断流水线执行</span>
                      </Space>
                    </Radio>
                    <Radio value="warn">
                      <Space>
                        <Tag color="warning">警告</Tag>
                        <span>记录警告但继续执行</span>
                      </Space>
                    </Radio>
                    <Radio value="continue">
                      <Space>
                        <Tag color="default">继续</Tag>
                        <span>不处理，直接继续</span>
                      </Space>
                    </Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>

              <Form.Item label="规则列表">
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  {qualityGateConfig.rules.map((rule) => (
                    <Card
                      key={rule.id}
                      size="small"
                      extra={
                        <Button
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveQualityRule(rule.id)}
                        />
                      }
                    >
                      <Space style={{ width: '100%' }} size={8}>
                        <Select
                          value={rule.metric}
                          onChange={(value) => handleUpdateQualityRule(rule.id, 'metric', value)}
                          options={METRIC_OPTIONS}
                          style={{ width: 160 }}
                          placeholder="选择指标"
                        />
                        <Select
                          value={rule.operator}
                          onChange={(value) => handleUpdateQualityRule(rule.id, 'operator', value)}
                          options={OPERATOR_OPTIONS}
                          style={{ width: 80 }}
                        />
                        <InputNumber
                          value={rule.threshold}
                          onChange={(value) =>
                            handleUpdateQualityRule(rule.id, 'threshold', value || 0)
                          }
                          style={{ width: 120 }}
                          placeholder="阈值"
                        />
                      </Space>
                    </Card>
                  ))}
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={handleAddQualityRule}
                    block
                  >
                    添加质量规则
                  </Button>
                </Space>
              </Form.Item>
            </>
          )}

          {!qualityGateConfig.enabled && (
            <div style={{ padding: '8px 0', color: '#999' }}>
              启用后可配置质量检查规则，如测试通过率、代码覆盖率、漏洞数量等
            </div>
          )}
        </Card>
      </Form>
    </Modal>
  );
};

export default StageModal;
