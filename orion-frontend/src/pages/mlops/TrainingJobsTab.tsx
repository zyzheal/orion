/**
 * MLOps Training Jobs Tab - training job scheduling and status management
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Empty,
  Form,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import {
  createTrainingJob,
  listTrainingJobs,
  updateJobStatus,
  type TrainingJob,
} from '@/api/mlops';
import { colors, spacing } from '@/tokens';
import { headerRowStyle, sectionTitleStyle } from './config';
import { buildTrainingJobColumns } from './columns';
import { TrainingJobsModals } from './MLOpsModals';

const { Title, Text } = Typography;

export const TrainingJobsTab: React.FC = () => {
  const [jobs, setJobs] = useState<TrainingJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listTrainingJobs();
      setJobs((res.data as { data?: TrainingJob[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载训练任务失败');
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
      await createTrainingJob({
        dataset: values.dataset,
        experimentId: values.experimentId,
      });
      message.success('训练任务创建成功');
      setCreateModalOpen(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (id: string, status: TrainingJob['status']) => {
    try {
      await updateJobStatus(id, status);
      message.success(`任务状态已更新为 ${status}`);
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '状态更新失败');
    }
  };

  const columns = useMemo(() => buildTrainingJobColumns({ handleStatusChange }), []);

  return (
    <div>
      <div style={headerRowStyle}>
        <div>
          <Title level={3} style={sectionTitleStyle}>
            <SyncOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            训练任务
          </Title>
          <Text type="secondary">管理 ML 模型训练任务</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建任务
          </Button>
        </Space>
      </div>

      {jobs.length === 0 && !loading ? (
        <Empty description="暂无训练任务">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建第一个训练任务
          </Button>
        </Empty>
      ) : (
        <Table
          columns={columns}
          dataSource={jobs}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      )}

      <TrainingJobsModals
        createModalOpen={createModalOpen}
        setCreateModalOpen={setCreateModalOpen}
        creating={creating}
        createForm={createForm}
        handleCreate={handleCreate}
      />
    </div>
  );
};
