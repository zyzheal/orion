/**
 * StageModal - Stage 配置弹窗
 *
 * 负责弹窗骨架与"字段类"表单（阶段名称/类型、高级设置、执行配置、
 * 子流水线、Buildx、容器/APK 上传、缓存、构建产物）。
 * 矩阵/PR 触发/超时/审批/质量门禁五个配置区块拆分至 stage-sections/，
 * 受控状态与回填逻辑收敛在 useStageModalState，
 * 表单值 → StageConfig 的转换见 buildStageConfig。
 */

import { Form, Button, Card, Input, InputNumber, message, Modal, Select, Space, Switch, Divider } from 'antd';
import { BranchesOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { StageConfig } from './types';
import {
  STAGE_TYPES,
  BUILD_PLATFORMS,
  CONTAINER_NETWORK_OPTIONS,
  APK_UPLOAD_TYPE_OPTIONS,
  APK_MARKET_OPTIONS,
  APK_CHANNEL_OPTIONS,
} from './StageModalConfig';
import { STAGE_FORM_INITIAL_VALUES } from './stageFormValues';
import type { StageFormValues } from './stageFormValues';
import { buildStageConfig } from './buildStageConfig';
import { useStageModalState } from './useStageModalState';
import {
  StageMatrixSection,
  StagePrTriggerSection,
  StageTimeoutSection,
  StageApprovalSection,
  StageQualityGateSection,
} from './stage-sections';
import { spacing } from '@/tokens';

const { TextArea } = Input;

interface StageModalProps {
  visible: boolean;
  stage: StageConfig | null;
  availableDependencies: { label: string; value: string }[];
  onSave: (values: StageConfig) => void;
  onCancel: () => void;
}

const StageModal = ({
  visible,
  stage,
  availableDependencies,
  onSave,
  onCancel,
}: StageModalProps) => {
  const [form] = Form.useForm<StageFormValues>();
  const {
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
  } = useStageModalState(form, stage, visible);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const stageConfig = buildStageConfig(values, {
        cachePaths,
        artifactPaths,
        subPipelineParams,
        prTriggerConfig,
        timeoutConfig,
        approvalConfig,
        qualityGateConfig,
        isEditing: Boolean(stage),
      });
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
  const handleAddCachePath = () => setCachePaths((prev) => [...prev, '']);
  const handleRemoveCachePath = (index: number) =>
    setCachePaths((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [''];
    });
  const handleUpdateCachePath = (index: number, value: string) =>
    setCachePaths((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });

  // Artifact 路径管理
  const handleAddArtifactPath = () => setArtifactPaths((prev) => [...prev, '']);
  const handleRemoveArtifactPath = (index: number) =>
    setArtifactPaths((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [''];
    });
  const handleUpdateArtifactPath = (index: number, value: string) =>
    setArtifactPaths((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });

  const updateParam = (index: number, field: 'key' | 'value', value: string) =>
    setSubPipelineParams((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });

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
        initialValues={STAGE_FORM_INITIAL_VALUES}
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
            parser={(value) => (Number(value?.replace('s', '')) || 0) as 0 | 7200}
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
              <Card
                size="small"
                style={{ marginBottom: spacing.md }}
                title={
                  <Space>
                    <BranchesOutlined /> 子流水线配置
                  </Space>
                }
              >
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
                      <Space key={String(index)} style={{ width: '100%' }}>
                        <Input
                          value={param.key}
                          onChange={(e) => updateParam(index, 'key', e.target.value)}
                          placeholder="参数名"
                          style={{ flex: 1 }}
                        />
                        <Input
                          value={param.value}
                          onChange={(e) => updateParam(index, 'value', e.target.value)}
                          placeholder="参数值"
                          style={{ flex: 1.5 }}
                        />
                        <Button
                          icon={<PlusOutlined />}
                          onClick={() =>
                            setSubPipelineParams((prev) => [...prev, { key: '', value: '' }])
                          }
                        />
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() =>
                            setSubPipelineParams((prev) =>
                              prev.length === 1
                                ? [{ key: '', value: '' }]
                                : prev.filter((_, i) => i !== index)
                            )
                          }
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
              <Card
                size="small"
                style={{ marginBottom: spacing.md }}
                title={<Space>🏷️ 多架构构建配置</Space>}
              >
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
                    options={BUILD_PLATFORMS}
                  />
                </Form.Item>

                <Form.Item
                  label="Dockerfile 路径"
                  name="buildxDockerfile"
                  tooltip="Dockerfile 的相对路径"
                >
                  <Input placeholder="Dockerfile" />
                </Form.Item>

                <Form.Item label="构建上下文" name="buildxContext" tooltip="构建上下文目录">
                  <Input placeholder="." />
                </Form.Item>

                <Form.Item
                  label="推送镜像"
                  name="buildxPush"
                  valuePropName="checked"
                  tooltip="构建完成后推送到镜像仓库"
                >
                  <Switch />
                </Form.Item>
              </Card>
            )
          }
        </Form.Item>

        {/* Container 容器运行配置 / APK Upload 配置 */}
        <Form.Item noStyle shouldUpdate={(prev, curr) => prev.type !== curr.type}>
          {(formInstance) =>
            (formInstance.getFieldValue('type') === 'container' ||
              formInstance.getFieldValue('type') === 'apk-upload') && (
              <>
                {formInstance.getFieldValue('type') === 'container' && (
                  <Card
                    size="small"
                    style={{ marginBottom: spacing.md }}
                    title={<Space>📦 容器运行配置</Space>}
                  >
                    <Form.Item
                      label="容器镜像"
                      name="containerImage"
                      rules={[{ required: true, message: '请输入容器镜像' }]}
                      tooltip="例如：node:18-alpine"
                    >
                      <Input placeholder="node:18-alpine" />
                    </Form.Item>

                    <Form.Item
                      label="启动命令"
                      name="containerCommand"
                      tooltip="容器启动时执行的命令"
                    >
                      <Input placeholder="npm run test" />
                    </Form.Item>

                    <Form.Item label="启动参数" name="containerArgs" tooltip="每行一个参数">
                      <TextArea
                        rows={2}
                        placeholder="--env=production&#10;--port=3000"
                        style={{ fontFamily: 'monospace' }}
                      />
                    </Form.Item>

                    <Form.Item
                      label="环境变量"
                      name="containerEnv"
                      tooltip="格式：KEY=VALUE，每行一个"
                    >
                      <TextArea
                        rows={2}
                        placeholder="NODE_ENV=production&#10;API_URL=https://api.example.com"
                        style={{ fontFamily: 'monospace' }}
                      />
                    </Form.Item>

                    <Form.Item label="资源限制" name="containerResources" valuePropName="checked">
                      <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                    </Form.Item>

                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, curr) =>
                        prev.containerResources !== curr.containerResources
                      }
                    >
                      {(fi) =>
                        fi.getFieldValue('containerResources') && (
                          <>
                            <Form.Item
                              label="CPU 限制"
                              name="containerCpu"
                              tooltip="例如：2.0 表示 2 个 CPU"
                            >
                              <InputNumber
                                min={0.1}
                                max={16}
                                step={0.1}
                                style={{ width: '100%' }}
                                placeholder="2.0"
                              />
                            </Form.Item>
                            <Form.Item
                              label="内存限制"
                              name="containerMemory"
                              tooltip="例如：4g, 512m"
                            >
                              <Input placeholder="4g" />
                            </Form.Item>
                            <Form.Item label="启用 GPU" name="containerGpu" valuePropName="checked">
                              <Switch />
                            </Form.Item>
                            <Form.Item
                              noStyle
                              shouldUpdate={(prev, curr) => prev.containerGpu !== curr.containerGpu}
                            >
                              {(fi2) =>
                                fi2.getFieldValue('containerGpu') && (
                                  <>
                                    <Form.Item
                                      label="GPU 设备"
                                      name="containerGpuDevices"
                                      tooltip="例如：all, 0, device=GPU-uuid"
                                    >
                                      <Input placeholder="all" />
                                    </Form.Item>
                                    <Form.Item
                                      label="GPU 能力"
                                      name="containerGpuCapabilities"
                                      tooltip="逗号分隔"
                                    >
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
                        options={CONTAINER_NETWORK_OPTIONS}
                      />
                    </Form.Item>
                  </Card>
                )}
                {/* APK Upload 配置 */}
                {formInstance.getFieldValue('type') === 'apk-upload' && (
                  <Card
                    size="small"
                    style={{ marginBottom: spacing.md }}
                    title={<Space>📱 APK 上传配置</Space>}
                  >
                    <Form.Item
                      label="上传类型"
                      name="apkUploadType"
                      initialValue="single"
                      tooltip="单市场上传或并行多市场上传"
                    >
                      <Select
                        placeholder="选择上传类型"
                        options={APK_UPLOAD_TYPE_OPTIONS}
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
                        options={APK_MARKET_OPTIONS}
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
                              options={APK_MARKET_OPTIONS}
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
                              options={APK_MARKET_OPTIONS}
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

                    <Form.Item label="版本名称" name="versionName" tooltip="应用的版本名称（可选）">
                      <Input placeholder="例如：1.0.0" />
                    </Form.Item>

                    <Form.Item label="更新日志" name="changelog" tooltip="版本更新说明">
                      <TextArea rows={3} placeholder="描述此次更新的内容..." />
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
                        options={APK_CHANNEL_OPTIONS}
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
              <Card size="small" style={{ marginBottom: spacing.md }}>
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
                      <Space key={String(index)} style={{ width: '100%' }} className="orion-stage-path-row">
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

        <Card size="small" style={{ marginBottom: spacing.md }}>
          <Form.Item label="上传路径" required>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              {artifactPaths.map((path, index) => (
                <Space key={String(index)} style={{ width: '100%' }} className="orion-stage-path-row">
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
        <StageMatrixSection value={matrixConfig} onChange={setMatrixConfig} />

        {/* PR/MR 触发配置 */}
        <StagePrTriggerSection
          value={prTriggerConfig}
          onChange={setPrTriggerConfig}
        />

        {/* 超时配置 */}
        <StageTimeoutSection value={timeoutConfig} onChange={setTimeoutConfig} />

        {/* 审批配置 */}
        <StageApprovalSection value={approvalConfig} onChange={setApprovalConfig} />

        {/* 质量门禁配置 */}
        <StageQualityGateSection value={qualityGateConfig} onChange={setQualityGateConfig} />
      </Form>
    </Modal>
  );
};

export default StageModal;
