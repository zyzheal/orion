/**
 * MLOps Experiments Tab - experiment tracking with CRUD, status flow and runs drawer
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import {
  ExperimentOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  createExperiment,
  deleteExperiment,
  getExperimentRuns,
  listExperiments,
  updateExperiment,
  updateExperimentStatus,
  type MLExperiment,
  type MLExperimentRun,
} from '@/api/mlops';
import { colors, spacing } from '@/tokens';
import {
  EXPERIMENT_STATUS_OPTIONS,
  filterRowStyle,
  headerRowStyle,
  sectionTitleStyle,
} from './config';
import { buildExperimentColumns, buildRunsColumns } from './columns';
import { ExperimentsModals } from './MLOpsModals';

const { Title, Text } = Typography;

export const ExperimentsTab: React.FC = () => {
  const [experiments, setExperiments] = useState<MLExperiment[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [runsDrawerOpen, setRunsDrawerOpen] = useState(false);
  const [currentRuns, setCurrentRuns] = useState<MLExperimentRun[]>([]);
  const [currentRunsLoading, setCurrentRunsLoading] = useState(false);
  const [_currentExperimentId, setCurrentExperimentId] = useState<string>('');
  const [currentExperiment, setCurrentExperiment] = useState<MLExperiment | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [experimentSearchQuery, setExperimentSearchQuery] = useState('');
  const [experimentStatusFilter, setExperimentStatusFilter] = useState<string | undefined>();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listExperiments();
      setExperiments((res.data as { data?: MLExperiment[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载实验失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (values: any) => {
    setCreating(true);
    try {
      await createExperiment({
        name: values.name,
        project: values.project,
        modelType: values.modelType,
        description: values.description,
      });
      message.success('实验创建成功');
      setCreateModalOpen(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async (record: MLExperiment) => {
    setCurrentExperiment(record);
    editForm.setFieldsValue({
      name: record.name,
      project: record.project,
      modelType: record.modelType,
      description: record.description,
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (values: any) => {
    if (!currentExperiment) return;
    setEditing(true);
    try {
      await updateExperiment(currentExperiment.id, {
        name: values.name,
        project: values.project,
        modelType: values.modelType,
        description: values.description,
      });
      message.success('实验更新成功');
      setEditModalOpen(false);
      editForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '更新失败');
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteExperiment(id);
      message.success('实验已删除');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleStatusChange = async (id: string, status: MLExperiment['status']) => {
    try {
      await updateExperimentStatus(id, status);
      message.success(`实验状态已更新为 ${status}`);
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '状态更新失败');
    }
  };

  const handleViewRuns = async (id: string) => {
    setCurrentExperimentId(id);
    setRunsDrawerOpen(true);
    setCurrentRunsLoading(true);
    try {
      const res = await getExperimentRuns(id);
      setCurrentRuns((res.data as { data?: MLExperimentRun[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载运行记录失败');
    } finally {
      setCurrentRunsLoading(false);
    }
  };

  const runsColumns = useMemo(() => buildRunsColumns(), []);

  // Filtered experiments
  const filteredExperiments = useMemo(() => {
    let result = experiments;
    if (experimentSearchQuery) {
      const q = experimentSearchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.project || '').toLowerCase().includes(q) ||
          (e.modelType || '').toLowerCase().includes(q) ||
          (e.description || '').toLowerCase().includes(q),
      );
    }
    if (experimentStatusFilter) {
      result = result.filter((e) => e.status === experimentStatusFilter);
    }
    return result;
  }, [experiments, experimentSearchQuery, experimentStatusFilter]);

  return (
    <div>
      <div style={headerRowStyle}>
        <div>
          <Title level={3} style={sectionTitleStyle}>
            <ExperimentOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            实验管理
          </Title>
          <Text type="secondary">跟踪和管理 ML 实验</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建实验
          </Button>
        </Space>
      </div>

      <div style={filterRowStyle}>
        <Input
          placeholder="搜索实验名称、项目、模型类型..."
          prefix={<SearchOutlined style={{ color: colors.neutral[400] }} />}
          value={experimentSearchQuery}
          onChange={(e) => setExperimentSearchQuery(e.target.value)}
          style={{ width: 260 }}
          allowClear
        />
        <Select
          placeholder="状态筛选"
          value={experimentStatusFilter}
          onChange={setExperimentStatusFilter}
          allowClear
          style={{ width: 120 }}
          options={EXPERIMENT_STATUS_OPTIONS}
        />
      </div>

      {filteredExperiments.length === 0 && !loading ? (
        <Empty description="暂无实验数据">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建第一个实验
          </Button>
        </Empty>
      ) : (
        <Table
          columns={buildExperimentColumns({
            handleViewRuns,
            handleEdit,
            handleStatusChange,
            handleDelete,
          })}
          dataSource={filteredExperiments}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: filteredExperiments.length === 0 ? '暂无实验数据' : undefined }}
        />
      )}

      <ExperimentsModals
        createModalOpen={createModalOpen}
        setCreateModalOpen={setCreateModalOpen}
        creating={creating}
        createForm={createForm}
        handleCreate={handleCreate}
        editModalOpen={editModalOpen}
        setEditModalOpen={setEditModalOpen}
        editing={editing}
        editForm={editForm}
        handleSaveEdit={handleSaveEdit}
        runsDrawerOpen={runsDrawerOpen}
        setRunsDrawerOpen={setRunsDrawerOpen}
        currentRuns={currentRuns}
        currentRunsLoading={currentRunsLoading}
        runsColumns={runsColumns}
      />
    </div>
  );
};
