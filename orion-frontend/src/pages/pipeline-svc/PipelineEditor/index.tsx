/**
 * Pipeline Editor Page - 可视化 Pipeline 编辑器
 * 支持拖拽式 Stage 编排、Stage 增删改、依赖配置、YAML 预览
 */
import React, { useState, useCallback } from 'react';
import {
  Typography,
  Button,
  Space,
  Card,
  message,
  Modal,
  Form,
  Input,
  Divider,
  Tag,
  Alert,
  Drawer,
  Segmented,
} from 'antd';
import { spacing } from '@/tokens';
import {
  PlusOutlined,
  EditOutlined,
  SaveOutlined,
  UndoOutlined,
  DragOutlined,
  CodeOutlined,
  ArrowLeftOutlined,
  CopyOutlined,
  AppstoreOutlined,
  LayoutOutlined,
} from '@ant-design/icons';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import StageItem from './StageItem';
import StageModal from './StageModal';
import { getPipeline, createPipeline, updatePipeline } from '@/api/pipelines';
import { DAGGraph, validateDAG } from '@/components/DAGGraph';
import { ApartmentOutlined } from '@ant-design/icons';
import { PipelineCanvas } from './canvas';
import { pipelineTemplates } from '@/api/pipeline-templates';

const { Title, Text } = Typography;
const { TextArea } = Input;

export interface StageConfig {
  id: string;
  name: string;
  type: string;
  timeout?: number;
  retryCount?: number;
  dependsOn?: string[];
  config?: Record<string, any>;
  cache?: CacheConfig;
  artifacts?: ArtifactConfig;
  position?: { x: number; y: number };
  matrix?: {
    enabled: boolean;
    dimensions: Array<{ key: string; values: string[] }>;
    exclusions: Array<{ match: Record<string, string>; reason?: string }>;
  };
}

export interface CacheConfig {
  enabled: boolean;
  key: string;
  paths: string[];
  restoreKeys?: string[];
}

export interface ArtifactConfig {
  upload?: string[];
  expiry?: number;
}

interface PipelineForm {
  name: string;
  version: string;
  description?: string;
}

const STAGE_TYPES = [
  { label: '构建 (Build)', value: 'build', icon: '🔨' },
  { label: '测试 (Test)', value: 'test', icon: '🧪' },
  { label: '代码扫描 (Scan)', value: 'scan', icon: '🔍' },
  { label: '部署 (Deploy)', value: 'deploy', icon: '🚀' },
  { label: '通知 (Notify)', value: 'notify', icon: '📢' },
  { label: '自定义 (Custom)', value: 'custom', icon: '⚙️' },
  { label: '多架构构建 (Buildx)', value: 'buildx', icon: '🏷️' },
  { label: '容器运行 (Container)', value: 'container', icon: '📦' },];

const PipelineEditor: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('template');
  const [form] = Form.useForm();

  // Pipeline 基本信息
  const [pipelineInfo, setPipelineInfo] = useState<PipelineForm>({
    name: '',
    version: '1.0.0',
    description: '',
  });

  // Stage 列表
  const [stages, setStages] = useState<StageConfig[]>([]);

  // Stage 编辑弹窗
  const [stageModalVisible, setStageModalVisible] = useState(false);
  const [editingStage, setEditingStage] = useState<StageConfig | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // YAML 预览
  const [yamlPreviewVisible, setYamlPreviewVisible] = useState(false);
  const [generatedYaml, setGeneratedYaml] = useState('');

  // DAG 预览
  const [dagPreviewVisible, setDagPreviewVisible] = useState(false);

  // 视图模式: 'list' = 列表模式, 'canvas' = 拖拽画布模式
  const [viewMode, setViewMode] = useState<'list' | 'canvas'>('list');

  // 保存中状态
  const [saving, setSaving] = useState(false);

  // 加载现有 Pipeline（编辑模式）
  React.useEffect(() => {
    if (id) {
      getPipeline(id)
        .then((response) => {
          // Backend returns pipeline object directly: { id, name, version, ... }
          const pipeline: any = response.data;
          if (pipeline) {
            setPipelineInfo({
              name: pipeline.name,
              version: pipeline.version || '1.0.0',
              description: pipeline.description || '',
            });
            // 从 spec.stages 加载 Stage，支持后端格式和前端格式
            if (pipeline.spec?.stages) {
              const loadedStages: StageConfig[] = pipeline.spec.stages.map(
                (s: any, idx: number) => {
                  // 后端格式: { name, runsOn, steps: [{ name, uses, with }], timeout, retries, ... }
                  const stepType =
                    s.steps?.[0]?.uses?.split('@')[0]?.replace('orion/', '') || s.type || 'custom';
                  const stepConfig = s.steps?.[0]?.with || s.config || {};
                  return {
                    id: `stage-${idx}-${Date.now()}`,
                    name: s.name,
                    type: stepType,
                    timeout: s.timeout,
                    retryCount: s.retries ?? s.retryCount,
                    dependsOn: s.dependsOn || [],
                    config: stepConfig,
                    cache: s.cache,
                    artifacts: s.artifacts,
                  };
                }
              );
              setStages(loadedStages);
            }
          }
        })
        .catch((error: unknown) => {
          if (error instanceof Error) {
            message.error(`加载 Pipeline 失败：${error.message}`);
          } else {
            message.error('加载 Pipeline 失败');
          }
        });
    }
  }, [id]);

  // Load template stages (when creating from template)
  React.useEffect(() => {
    if (templateId && !id) {
      const tpl = pipelineTemplates.find((t) => t.id === templateId);
      if (tpl) {
        setPipelineInfo({
          name: tpl.name,
          version: '1.0.0',
          description: tpl.description,
        });
        const stages: StageConfig[] = tpl.stages.map((s, idx) => ({
          id: `stage-${idx}-${Date.now()}`,
          name: s.name,
          type: s.type,
          timeout: 300,
          retryCount: 0,
          dependsOn: [],
          config: s.config || {},
        }));
        setStages(stages);
      }
    }
  }, [templateId, id]);

  // 生成 YAML (FIXED P0-8: aligned with backend PipelineStage schema)
  const generateYaml = useCallback(() => {
    const yamlLines: string[] = [
      `apiVersion: v1`,
      `kind: Pipeline`,
      `metadata:`,
      `  name: ${pipelineInfo.name}`,
      `  version: ${pipelineInfo.version}`,
      `  description: ${pipelineInfo.description || '""'}`,
      ``,
      `spec:`,
      `  stages:`,
    ];

    for (const stage of stages) {
      const stepUses = stage.config?.uses || `orion/${stage.type}@v1`;
      const stepName = `${stage.name}-step`;

      // Buildx 特殊配置
      if (stage.type === 'buildx' && stage.config?.imageName) {
        const stageLines = [
          `    - name: ${stage.name}`,
          `      type: buildx`,
          `      timeout: ${stage.timeout || 300}`,
          `      retries: ${stage.retryCount || 0}`,
          `      config:`,
          `        imageName: ${stage.config.imageName}`,
          `        tag: ${stage.config.tag || 'latest'}`,
          `        platforms: ${JSON.stringify(stage.config.platforms || ['linux/amd64'])}`,
        ];
        if (stage.config.dockerfilePath) {
          stageLines.push(`        dockerfile: ${stage.config.dockerfilePath}`);
        }
        if (stage.config.push !== false) {
          stageLines.push(`        push: true`);
        }
        if (stage.dependsOn?.length) {
          stageLines.push(`      dependsOn: ${JSON.stringify(stage.dependsOn)}`);
        }
        yamlLines.push(...stageLines);
        continue;
      }

      // Container 特殊配置
      if (stage.type === 'container' && stage.config?.containerImage) {
        const stageLines = [
          `    - name: ${stage.name}`,
          `      type: container`,
          `      timeout: ${stage.timeout || 300}`,
          `      retries: ${stage.retryCount || 0}`,
          `      config:`,
          `        image: ${stage.config.containerImage}`,
        ];
        if (stage.config.containerCommand) {
          stageLines.push(`        command: ${stage.config.containerCommand}`);
        }
        if (stage.config.containerResources) {
          stageLines.push(`        resources: ${JSON.stringify(stage.config.containerResources)}`);
        }
        if (stage.config.containerNetwork) {
          stageLines.push(`        network: ${stage.config.containerNetwork}`);
        }
        if (stage.dependsOn?.length) {
          stageLines.push(`      dependsOn: ${JSON.stringify(stage.dependsOn)}`);
        }
        yamlLines.push(...stageLines);
        continue;
      }

      const stepWith =
        stage.config && Object.keys(stage.config).length > 0
          ? `\n        with: ${JSON.stringify(stage.config)}`
          : '';

      const stageLines = [
        `    - name: ${stage.name}`,
        `      runsOn: ubuntu-latest`,
        `      timeout: ${stage.timeout || 300}`,
        `      retries: ${stage.retryCount || 0}`,
      ];

      if (stage.dependsOn?.length) {
        stageLines.push(`      dependsOn: ${JSON.stringify(stage.dependsOn)}`);
      }

      stageLines.push(`      steps:`);
      stageLines.push(`        - name: ${stepName}`);
      stageLines.push(`          uses: ${stepUses}${stepWith}`);

      // 缓存配置
      if (stage.cache?.enabled) {
        stageLines.push(`      cache:`);
        stageLines.push(`        enabled: true`);
        stageLines.push(`        key: ${stage.cache.key}`);
        stageLines.push(`        paths: ${JSON.stringify(stage.cache.paths)}`);
        if (stage.cache.restoreKeys?.length) {
          stageLines.push(`        restoreKeys: ${JSON.stringify(stage.cache.restoreKeys)}`);
        }
      }

      // Artifact 配置
      if (stage.artifacts?.upload?.length) {
        stageLines.push(`      artifacts:`);
        stageLines.push(`        upload: ${JSON.stringify(stage.artifacts.upload)}`);
        if (stage.artifacts.expiry) {
          stageLines.push(`        expiry: ${stage.artifacts.expiry}`);
        }
      }

      // 矩阵构建配置
      if (stage.matrix?.enabled && stage.matrix.dimensions?.length) {
        stageLines.push(`      matrix:`);
        const matrixEntries = stage.matrix.dimensions.map(
          (d) => `        ${d.key}: ${JSON.stringify(d.values)}`
        );
        stageLines.push(...matrixEntries);
        if (stage.matrix.exclusions?.length) {
          stageLines.push(`        exclude:`);
          stage.matrix.exclusions.forEach((rule) => {
            stageLines.push(`          - ${JSON.stringify(rule.match)}`);
          });
        }
      }

      yamlLines.push(...stageLines);
    }

    return yamlLines.join('\n');
  }, [pipelineInfo, stages]);

  // 处理拖拽结束
  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setStages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  // 打开 Stage 编辑弹窗
  const openStageModal = useCallback((stage?: StageConfig, index?: number) => {
    setEditingStage(stage || null);
    setEditingIndex(index ?? null);
    setStageModalVisible(true);
  }, []);

  // 保存 Stage
  const handleSaveStage = useCallback(
    (values: StageConfig) => {
      if (editingIndex !== null && editingStage) {
        // 编辑现有 Stage
        const newStages = [...stages];
        newStages[editingIndex] = values;
        setStages(newStages);
        message.success('阶段已更新');
      } else {
        // 添加新 Stage
        setStages([...stages, values]);
        message.success('阶段已添加');
      }
      setStageModalVisible(false);
      setEditingStage(null);
      setEditingIndex(null);
    },
    [stages, editingIndex, editingStage]
  );

  // 删除 Stage
  const handleDeleteStage = useCallback(
    (index: number) => {
      const stage = stages[index];
      Modal.confirm({
        title: '确认删除',
        content: `确定要删除阶段 "${stage.name}" 吗？`,
        onOk: () => {
          const newStages = stages.filter((_, i) => i !== index);
          // 同时更新其他 Stage 的依赖关系
          newStages.forEach((s) => {
            if (s.dependsOn?.includes(stage.name)) {
              s.dependsOn = s.dependsOn.filter((d) => d !== stage.name);
            }
          });
          setStages(newStages);
          message.success('阶段已删除');
        },
      });
    },
    [stages]
  );

  // 验证 Stage 依赖
  const validateDependencies = useCallback((): boolean => {
    const stageNames = new Set(stages.map((s) => s.name));
    for (const stage of stages) {
      if (stage.dependsOn) {
        for (const dep of stage.dependsOn) {
          if (!stageNames.has(dep)) {
            message.error(`阶段 "${stage.name}" 依赖了不存在的阶段 "${dep}"`);
            return false;
          }
          // 检查循环依赖
          if (dep === stage.name) {
            message.error(`阶段 "${stage.name}" 不能依赖自己`);
            return false;
          }
        }
      }
    }
    return true;
  }, [stages]);

  // 保存 Pipeline
  const handleSavePipeline = useCallback(async () => {
    try {
      await form.validateFields();
    } catch (error: unknown) {
      message.error('请填写完整的 Pipeline 信息');
      return;
    }

    if (stages.length === 0) {
      message.error('请至少添加一个阶段');
      return;
    }

    if (!validateDependencies()) {
      return;
    }

    setSaving(true);
    try {
      const yaml = generateYaml();

      // 调用真实 API
      if (id) {
        await updatePipeline(id, { yamlDefinition: yaml });
        message.success('Pipeline 已更新');
      } else {
        await createPipeline({
          name: pipelineInfo.name,
          version: pipelineInfo.version,
          description: pipelineInfo.description,
          yamlDefinition: yaml,
        });
        message.success('Pipeline 已创建');
      }

      navigate('/pipelines');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`保存失败：${error.message}`);
      } else {
        message.error('保存失败，请重试');
      }
    } finally {
      setSaving(false);
    }
  }, [form, stages, pipelineInfo, generateYaml, validateDependencies, id, navigate]);

  // 预览 YAML
  const handlePreviewYaml = useCallback(() => {
    const yaml = generateYaml();
    setGeneratedYaml(yaml);
    setYamlPreviewVisible(true);
  }, [generateYaml]);

  // 可用的依赖选项（当前 Stage 之前的所有 Stage）
  const getAvailableDependencies = useCallback(
    (currentIndex: number) => {
      return stages
        .filter((_, index) => index < currentIndex)
        .map((s) => ({ label: s.name, value: s.name }));
    },
    [stages]
  );

  return (
    <div style={{ padding: 0 }}>
      {/* 页面头部 - 与列表页风格一致 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ marginBottom: spacing.sm }}>
            <Space align="center">
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/pipelines')}
                size="small"
              >
                返回列表
              </Button>
              <Title level={2} style={{ marginBottom: 0, display: 'flex', alignItems: 'center' }}>
                <EditOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
                {id ? '编辑 Pipeline' : '创建 Pipeline'}
              </Title>
            </Space>
          </div>
          <Text type="secondary">可视化编排您的 CI/CD 流水线</Text>
        </div>
        <Space>
          {/* 视图模式切换 */}
          <Segmented
            value={viewMode}
            onChange={(value) => setViewMode(value as 'list' | 'canvas')}
            options={[
              { value: 'list', icon: <AppstoreOutlined />, label: '列表' },
              { value: 'canvas', icon: <LayoutOutlined />, label: '画布' },
            ]}
          />
          <Button
            icon={<ApartmentOutlined />}
            onClick={() => setDagPreviewVisible(!dagPreviewVisible)}
            disabled={stages.length === 0}
          >
            {dagPreviewVisible ? '隐藏 DAG' : '查看 DAG'}
          </Button>
          <Button
            icon={<CodeOutlined />}
            onClick={handlePreviewYaml}
            disabled={stages.length === 0}
          >
            预览 YAML
          </Button>
          <Button
            icon={<UndoOutlined />}
            onClick={() => {
              setStages([]);
              setPipelineInfo({ name: '', version: '1.0.0', description: '' });
              message.success('已重置');
            }}
          >
            重置
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSavePipeline}
            loading={saving}
            disabled={stages.length === 0}
          >
            {saving ? '保存中...' : '保存'}
          </Button>
        </Space>
      </div>

      {/* Pipeline 基本信息 */}
      <Card style={{ marginBottom: 24 }} title="基本信息">
        <Form form={form} layout="inline" requiredMark>
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入 Pipeline 名称' }]}
          >
            <Input
              placeholder="例如：build-deploy-pipeline"
              style={{ width: 250 }}
              value={pipelineInfo.name}
              onChange={(e) => setPipelineInfo({ ...pipelineInfo, name: e.target.value })}
            />
          </Form.Item>
          <Form.Item
            label="版本"
            name="version"
            rules={[{ required: true, message: '请输入版本号' }]}
          >
            <Input
              placeholder="例如：1.0.0"
              style={{ width: 120 }}
              value={pipelineInfo.version}
              onChange={(e) => setPipelineInfo({ ...pipelineInfo, version: e.target.value })}
            />
          </Form.Item>
          <Form.Item label="描述" style={{ flex: 1 }}>
            <Input
              placeholder="可选描述..."
              value={pipelineInfo.description}
              onChange={(e) => setPipelineInfo({ ...pipelineInfo, description: e.target.value })}
              style={{ width: 300 }}
            />
          </Form.Item>
        </Form>
      </Card>

      {/* Stage 编排区域 */}
      <Card
        title={
          <Space>
            {viewMode === 'list' ? <DragOutlined /> : <LayoutOutlined />}
            阶段编排
            <Tag color="blue">{stages.length} 个阶段</Tag>
          </Space>
        }
        extra={
          viewMode === 'list' && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openStageModal()}>
              添加阶段
            </Button>
          )
        }
      >
        {stages.length === 0 ? (
          <Alert
            type="info"
            message="暂无阶段"
            description={
              viewMode === 'canvas'
                ? '点击右上角「添加阶段」按钮在画布上添加节点'
                : '点击上方「添加阶段」按钮开始编排流水线'
            }
            showIcon
          />
        ) : viewMode === 'canvas' ? (
          // Canvas 拖拽模式
          <PipelineCanvas
            stages={stages}
            onStagesChange={setStages}
            onNodeClick={(nodeId, stage) => {
              const index = stages.findIndex((s) => s.id === nodeId);
              if (index !== -1) {
                openStageModal(stage, index);
              }
            }}
            onAddStage={(type, position) => {
              const newStage: StageConfig = {
                id: `stage-${Date.now()}`,
                name: `新阶段-${stages.length + 1}`,
                type,
                position,
                config: {},
              };
              setStages([...stages, newStage]);
              openStageModal(newStage, stages.length);
            }}
          />
        ) : (
          // 列表模式 (原有逻辑)
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                {stages.map((stage, index) => (
                  <StageItem
                    key={stage.id}
                    id={stage.id}
                    stage={stage}
                    index={index}
                    onEdit={() => openStageModal(stage, index)}
                    onDelete={() => handleDeleteStage(index)}
                    availableDependencies={getAvailableDependencies(index)}
                  />
                ))}
              </Space>
            </SortableContext>
          </DndContext>
        )}
      </Card>

      {/* DAG 依赖关系可视化 */}
      {dagPreviewVisible && stages.length > 0 && (
        <Card style={{ marginTop: 24 }} title="DAG 依赖关系">
          <Alert
            type={validateDAG(stages).valid ? 'success' : 'error'}
            message={validateDAG(stages).valid ? '依赖关系有效，无循环依赖' : '依赖关系存在问题'}
            description={
              validateDAG(stages).valid
                ? '拓扑结构正确，Pipeline 可以正常执行'
                : validateDAG(stages).errors.join('; ')
            }
            showIcon
            style={{ marginBottom: 16 }}
          />
          <DAGGraph stages={stages} height={350} showMiniMap={false} />
        </Card>
      )}

      {/* Stage 类型说明 */}
      <Card style={{ marginTop: 24 }} title="阶段类型说明">
        <Space wrap>
          {STAGE_TYPES.map((type) => (
            <Tag
              key={type.value}
              color="default"
              style={{ fontSize: spacing[3], padding: '4px 12px' }}
            >
              {type.icon} {type.label}
            </Tag>
          ))}
        </Space>
        <Divider />
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">
            💡 提示：拖拽阶段卡片右侧的拖拽图标可调整顺序；依赖关系只能选择当前阶段之前的阶段
          </Text>
        </Space>
      </Card>

      {/* Stage 编辑弹窗 */}
      {stageModalVisible && (
        <StageModal
          visible={stageModalVisible}
          stage={editingStage}
          availableDependencies={
            editingIndex !== null
              ? getAvailableDependencies(editingIndex)
              : stages.map((s) => ({ label: s.name, value: s.name }))
          }
          onSave={handleSaveStage}
          onCancel={() => {
            setStageModalVisible(false);
            setEditingStage(null);
            setEditingIndex(null);
          }}
        />
      )}

      {/* YAML 预览弹窗 */}
      <Drawer
        title="YAML 预览"
        placement="right"
        width={600}
        open={yamlPreviewVisible}
        onClose={() => setYamlPreviewVisible(false)}
        extra={
          <Space>
            <Button
              icon={<CopyOutlined />}
              onClick={() => {
                navigator.clipboard.writeText(generatedYaml);
                message.success('已复制到剪贴板');
              }}
            >
              复制
            </Button>
          </Space>
        }
        styles={{ body: { padding: 0 } }}
      >
        <TextArea
          value={generatedYaml}
          readOnly
          rows={30}
          style={{ fontFamily: 'monospace', fontSize: spacing[3], border: 'none' }}
        />
      </Drawer>
    </div>
  );
};

export default PipelineEditor;
