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
  Tabs,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  BranchesOutlined,
  UserOutlined,
  SafetyOutlined,
  SettingOutlined,
  RocketOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { StageConfig, MatrixBuildConfig } from './types';
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
        timeoutConfig: stage?.timeoutConfig || { enabled: false, duration: 300, action: 'fail' as const },
        approvalConfig: stage?.approvalConfig || { enabled: false, approvers: [], mode: 'unanimous' as const, timeout: 0, timeoutAction: 'reject' as const },
        qualityGateConfig: stage?.qualityGateConfig || { enabled: false, rules: [], failureAction: 'block' as const },
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
        // PR/MR 触发配置
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
        timeoutConfig: values.timeoutConfig?.enabled
          ? values.timeoutConfig
          : undefined,
        // 审批卡点配置
        approvalConfig: values.approvalConfig?.enabled
          ? values.approvalConfig
          : undefined,
        // 质量门禁配置
        qualityGateConfig: values.qualityGateConfig?.enabled
          ? values.qualityGateConfig
          : undefined,
      };
      onSave(stageConfig);
    } catch (error: unknown) {
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
          timeoutConfig: { enabled: false, duration: 300, action: 'fail' },
          approvalConfig: { enabled: false, approvers: [], mode: 'unanimous', timeout: 0, timeoutAction: 'reject' },
          qualityGateConfig: { enabled: false, rules: [], failureAction: 'block' },
        }}
      >
        <Tabs
          defaultActiveKey="basic"
          items={[
            {
              key: 'basic',
              label: <span><SettingOutlined /> 基础配置</span>,
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

                  <Divider orientation="left" orientationMargin={0}>执行配置</Divider>

                  <Form.Item label="脚本内容" name="script" tooltip="Shell 脚本内容">
                    <TextArea
                      rows={4}
                      placeholder="#!/bin/bash&#10;echo 'Hello, World!'"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </Form.Item>

                  <Form.Item label="执行命令" name="command" tooltip="直接执行的命令" dependencies={['script']}>
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
                </div>
              ),
            },
            {
              key: 'dependencies',
              label: <span><BranchesOutlined /> 依赖配置</span>,
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Form.Item label="依赖阶段" name="dependsOn" tooltip="当前阶段执行前需要完成的阶段">
                    <Select
                      mode="multiple"
                      placeholder="选择依赖的阶段"
                      options={availableDependencies}
                      maxTagCount="responsive"
                      allowClear
                    />
                  </Form.Item>
                </div>
              ),
            },
            {
              key: 'retry',
              label: <span><ClockCircleOutlined /> 重试策略</span>,
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Form.Item label="超时时间 (秒)" name="timeout" tooltip="超过此时间后阶段将被终止">
                    <InputNumber
                      min={0}
                      max={7200}
                      step={60}
                      style={{ width: '100%' }}
                      placeholder="默认 300 秒"
                      formatter={(value) => `${value}s`}
                      parser={(value) => Number(value?.replace('s', '')) as any}
                    />
                  </Form.Item>

                  <Form.Item label="重试次数" name="retryCount" tooltip="失败后自动重试的次数">
                    <InputNumber min={0} max={5} style={{ width: '100%' }} placeholder="默认 0 次" />
                  </Form.Item>
                </div>
              ),
            },
            {
              key: 'cache',
              label: <span><ThunderboltOutlined /> 缓存配置</span>,
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Space>
                    <Form.Item noStyle name="cacheEnabled" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                    <span>启用构建缓存</span>
                  </Space>

                  <Form.Item noStyle shouldUpdate>
                    {(formInstance) =>
                      formInstance.getFieldValue('cacheEnabled') && (
                        <Card size="small">
                          <Form.Item
                            label="缓存 Key"
                            name="cacheKey"
                            tooltip="缓存的唯一标识，可使用表达式"
                            rules={[{ required: true, message: '请输入缓存 Key' }]}
                          >
                            <Input placeholder="例如：npm-cache-key" />
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
                </div>
              ),
            },
            {
              key: 'artifacts',
              label: <span><RocketOutlined /> 制品配置</span>,
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Card size="small">
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
                </div>
              ),
            },
            {
              key: 'advanced',
              label: <span><ThunderboltOutlined /> 高级配置</span>,
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* 子流水线配置 */}
                  <Form.Item noStyle shouldUpdate={(prev, curr) => prev.type !== curr.type}>
                    {(formInstance) =>
                      formInstance.getFieldValue('type') === 'sub-pipeline' && (
                        <Card size="small" title={<Space><BranchesOutlined /> 子流水线配置</Space>}>
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

                          <Form.Item label="分支" name="subPipelineBranch" tooltip="指定子流水线使用的分支">
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
                        <Card size="small" title="多架构构建配置">
                          <Form.Item
                            label="镜像名称"
                            name="buildxImageName"
                            rules={[{ required: true, message: '请输入镜像名称' }]}
                          >
                            <Input placeholder="registry.example.com/my-app" />
                          </Form.Item>

                          <Form.Item label="标签 (Tag)" name="buildxTag">
                            <Input placeholder="latest" />
                          </Form.Item>

                          <Form.Item
                            label="目标平台"
                            name="buildxPlatforms"
                            rules={[{ required: true, message: '请选择至少一个平台' }]}
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

                          <Form.Item label="Dockerfile 路径" name="buildxDockerfile">
                            <Input placeholder="Dockerfile" />
                          </Form.Item>

                          <Form.Item label="构建上下文" name="buildxContext">
                            <Input placeholder="." />
                          </Form.Item>

                          <Form.Item label="推送镜像" name="buildxPush" valuePropName="checked">
                            <Switch />
                          </Form.Item>
                        </Card>
                      )
                    }
                  </Form.Item>

                  {/* Container / APK Upload 配置 */}
                  <Form.Item noStyle shouldUpdate={(prev, curr) => prev.type !== curr.type}>
                    {(formInstance) =>
                      (formInstance.getFieldValue('type') === 'container' || formInstance.getFieldValue('type') === 'apk-upload') && (
                        <>
                          {formInstance.getFieldValue('type') === 'container' && (
                            <Card size="small" title="容器运行配置">
                              <Form.Item
                                label="容器镜像"
                                name="containerImage"
                                rules={[{ required: true, message: '请输入容器镜像' }]}
                              >
                                <Input placeholder="node:18-alpine" />
                              </Form.Item>

                              <Form.Item label="启动命令" name="containerCommand">
                                <Input placeholder="npm run test" />
                              </Form.Item>

                              <Form.Item label="启动参数" name="containerArgs">
                                <TextArea rows={2} placeholder="--env=production&#10;--port=3000" style={{ fontFamily: 'monospace' }} />
                              </Form.Item>

                              <Form.Item label="环境变量" name="containerEnv">
                                <TextArea rows={2} placeholder="NODE_ENV=production" style={{ fontFamily: 'monospace' }} />
                              </Form.Item>

                              <Form.Item label="资源限制" name="containerResources" valuePropName="checked">
                                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                              </Form.Item>

                              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.containerResources !== curr.containerResources}>
                                {(fi) =>
                                  fi.getFieldValue('containerResources') && (
                                    <>
                                      <Form.Item label="CPU 限制" name="containerCpu">
                                        <InputNumber min={0.1} max={16} step={0.1} style={{ width: '100%' }} placeholder="2.0" />
                                      </Form.Item>
                                      <Form.Item label="内存限制" name="containerMemory">
                                        <Input placeholder="4g" />
                                      </Form.Item>
                                      <Form.Item label="启用 GPU" name="containerGpu" valuePropName="checked">
                                        <Switch />
                                      </Form.Item>
                                      <Form.Item noStyle shouldUpdate={(prev, curr) => prev.containerGpu !== curr.containerGpu}>
                                        {(fi2) =>
                                          fi2.getFieldValue('containerGpu') && (
                                            <>
                                              <Form.Item label="GPU 设备" name="containerGpuDevices">
                                                <Input placeholder="all" />
                                              </Form.Item>
                                              <Form.Item label="GPU 能力" name="containerGpuCapabilities">
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

                              <Form.Item label="网络模式" name="containerNetwork">
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
                          {formInstance.getFieldValue('type') === 'apk-upload' && (
                            <Card size="small" title="APK 上传配置">
                              <Form.Item label="上传类型" name="apkUploadType" initialValue="single">
                                <Select
                                  placeholder="选择上传类型"
                                  options={[
                                    { label: '单市场 (Single)', value: 'single' },
                                    { label: '多市场并行 (Parallel)', value: 'parallel' },
                                  ]}
                                />
                              </Form.Item>

                              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.apkUploadType !== curr.apkUploadType}>
                                {({ getFieldValue }) =>
                                  getFieldValue('apkUploadType') === 'parallel' && (
                                    <Form.Item
                                      label="目标市场列表"
                                      name="apkMarkets"
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

                              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.apkUploadType !== curr.apkUploadType}>
                                {({ getFieldValue }) =>
                                  getFieldValue('apkUploadType') !== 'parallel' && (
                                    <Form.Item
                                      label="应用市场"
                                      name="apkMarket"
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
                              >
                                <Input placeholder="例如：./build/app-release.apk" />
                              </Form.Item>

                              <Form.Item
                                label="应用包名"
                                name="packageName"
                                rules={[{ required: true, message: '请输入应用包名' }]}
                              >
                                <Input placeholder="例如：com.example.app" />
                              </Form.Item>

                              <Form.Item label="版本名称" name="versionName">
                                <Input placeholder="例如：1.0.0" />
                              </Form.Item>

                              <Form.Item label="更新日志" name="changelog">
                                <TextArea rows={3} placeholder="描述此次更新的内容..." />
                              </Form.Item>

                              <Form.Item label="市场凭证" name="apkCredentials">
                                <Input placeholder="例如：${secrets.apk-huawei-credentials}" />
                              </Form.Item>

                              <Form.Item label="发布渠道" name="apkChannel">
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

                  {/* 矩阵构建配置 */}
                  <Card
                    size="small"
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
                      <MatrixConfigurator value={matrixConfig} onChange={setMatrixConfig} />
                    ) : (
                      <div style={{ padding: '8px 0', color: '#999' }}>
                        启用后可在多个维度上并行构建
                      </div>
                    )}
                  </Card>

                  {/* PR/MR 触发配置 */}
                  <PRTriggerConfigComponent
                    value={prTriggerConfig}
                    onChange={(config) => setPrTriggerConfig(config as Partial<PRTriggerConfigType>)}
                  />
                </div>
              ),
            },
            {
              key: 'timeout',
              label: <span><ThunderboltOutlined /> 超时配置</span>,
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Form.Item label="启用阶段超时" name={['timeoutConfig', 'enabled']} valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="超时时间（秒）" name={['timeoutConfig', 'duration']}>
                    <InputNumber min={1} max={86400} style={{ width: '100%' }} placeholder="300" />
                  </Form.Item>
                  <Form.Item label="超时动作" name={['timeoutConfig', 'action']}>
                    <Select>
                      <Select.Option value="fail">标记为失败</Select.Option>
                      <Select.Option value="skip">跳过并继续</Select.Option>
                      <Select.Option value="retry">自动重试</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item noStyle shouldUpdate={(prev: any, curr: any) => prev.timeoutConfig?.action !== curr.timeoutConfig?.action}>
                    {({ getFieldValue }: any) =>
                      getFieldValue(['timeoutConfig', 'action']) === 'retry' && (
                        <Form.Item label="重试次数" name={['timeoutConfig', 'retryCount']}>
                          <InputNumber min={1} max={10} style={{ width: '100%' }} placeholder="3" />
                        </Form.Item>
                      )
                    }
                  </Form.Item>
                </div>
              ),
            },
            {
              key: 'approval',
              label: <span><UserOutlined /> 审批卡点</span>,
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Form.Item label="启用审批卡点" name={['approvalConfig', 'enabled']} valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="审批人" name={['approvalConfig', 'approvers']}>
                    <Select mode="multiple" placeholder="选择审批人（用户或角色）" allowClear>
                      <Select.Option value="admin">Admin</Select.Option>
                      <Select.Option value="tech-lead">Tech Lead</Select.Option>
                      <Select.Option value="team-lead">Team Lead</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item label="审批模式" name={['approvalConfig', 'mode']}>
                    <Select>
                      <Select.Option value="unanimous">会签（全部通过）</Select.Option>
                      <Select.Option value="any">或签（任一通过）</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item label="审批超时（秒）" name={['approvalConfig', 'timeout']}>
                    <InputNumber min={0} max={604800} style={{ width: '100%' }} placeholder="0 表示不超时" />
                  </Form.Item>
                  <Form.Item label="超时自动处理" name={['approvalConfig', 'timeoutAction']}>
                    <Select>
                      <Select.Option value="approve">自动通过</Select.Option>
                      <Select.Option value="reject">自动拒绝</Select.Option>
                    </Select>
                  </Form.Item>
                </div>
              ),
            },
            {
              key: 'qualityGate',
              label: <span><SafetyOutlined /> 质量门禁</span>,
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Form.Item label="启用质量门禁" name={['qualityGateConfig', 'enabled']} valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item label="不通过时" name={['qualityGateConfig', 'failureAction']}>
                    <Select>
                      <Select.Option value="block">阻止部署</Select.Option>
                      <Select.Option value="warn">仅告警，继续执行</Select.Option>
                      <Select.Option value="continue">忽略</Select.Option>
                    </Select>
                  </Form.Item>
                  <div>
                    <div style={{ marginBottom: 12, fontWeight: 500 }}>门禁规则</div>
                    <Form.List name={['qualityGateConfig', 'rules']}>
                      {(fields, { add, remove }) => (
                        <>
                          {fields.map(({ key, name, ...restField }) => (
                            <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                              <Form.Item {...restField} name={[name, 'metric']} style={{ width: 160 }}>
                                <Select placeholder="指标">
                                  <Select.Option value="test_pass_rate">测试通过率</Select.Option>
                                  <Select.Option value="coverage">代码覆盖率</Select.Option>
                                  <Select.Option value="vulnerability_count">漏洞数量</Select.Option>
                                  <Select.Option value="custom">自定义</Select.Option>
                                </Select>
                              </Form.Item>
                              <Form.Item {...restField} name={[name, 'operator']} style={{ width: 80 }}>
                                <Select>
                                  <Select.Option value=">=">&gt;=</Select.Option>
                                  <Select.Option value="<=">&lt;=</Select.Option>
                                  <Select.Option value=">">&gt;</Select.Option>
                                  <Select.Option value="<">&lt;</Select.Option>
                                  <Select.Option value="==">==</Select.Option>
                                </Select>
                              </Form.Item>
                              <Form.Item {...restField} name={[name, 'threshold']} style={{ width: 100 }}>
                                <InputNumber placeholder="阈值" />
                              </Form.Item>
                              <DeleteOutlined onClick={() => remove(name)} style={{ color: '#f5222d', cursor: 'pointer' }} />
                            </Space>
                          ))}
                          <Button
                            type="dashed"
                            onClick={() => add({ id: `rule-${Date.now()}`, metric: 'test_pass_rate', operator: '>=', threshold: 95 })}
                            block
                            icon={<PlusOutlined />}
                          >
                            添加规则
                          </Button>
                        </>
                      )}
                    </Form.List>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Form>
    </Modal>
  );
};

export default StageModal;
