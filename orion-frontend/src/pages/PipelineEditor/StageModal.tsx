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
} from 'antd';
import { PlusOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { StageConfig, MatrixBuildConfig } from './types';
import MatrixConfigurator from '@/components/MatrixConfigurator';

const { TextArea } = Input;

const STAGE_TYPES = [
  { label: '🔨 构建 (Build)', value: 'build' },
  { label: '🧪 测试 (Test)', value: 'test' },
  { label: '🔍 代码扫描 (Scan)', value: 'scan' },
  { label: '🚀 部署 (Deploy)', value: 'deploy' },
  { label: '📢 通知 (Notify)', value: 'notify' },
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
        cacheEnabled: stage.cache?.enabled || false,
        cacheKey: stage.cache?.key || '',
        cacheRestoreKeys: stage.cache?.restoreKeys?.join('\n') || '',
        artifactUpload: stage.artifacts?.upload?.join('\n') || '',
        artifactExpiry: stage.artifacts?.expiry || 7,
      });
      setCachePaths(stage.cache?.paths?.length ? stage.cache.paths : ['']);
      setArtifactPaths(stage.artifacts?.upload?.length ? stage.artifacts.upload : ['']);
      // 加载矩阵构建配置
      setMatrixConfig(
        stage.matrix || {
          enabled: false,
          dimensions: [],
          exclusions: [],
        }
      );
    } else {
      form.resetFields();
      setCachePaths(['']);
      setArtifactPaths(['']);
      setMatrixConfig({
        enabled: false,
        dimensions: [],
        exclusions: [],
      });
    }
  }, [stage, form, visible]);

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
        },
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
        // 矩阵构建配置
        matrix: matrixConfig.enabled
          ? {
              enabled: true,
              dimensions: matrixConfig.dimensions,
              exclusions: matrixConfig.exclusions,
            }
          : undefined,
      };
      onSave(stageConfig);
    } catch (error: unknown) {
      // 验证失败，不处理
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
            parser={(value) => Number(value?.replace('s', '')) as any}
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
      </Form>
    </Modal>
  );
};

export default StageModal;
