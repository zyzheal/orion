/**
 * PlansTab.tsx - IaC 变更计划
 * 抽取自 IacPage.tsx (P2-9 Phase 49)
 * 工作区选择器 + 变更计划 Table (含成本预估/资源变更数)
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Table,
  Tag,
  Select,
  message,
} from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import {
  getWorkspaces,
  getWorkspacePlans,
  type IaCWorkspace,
  type IaCPlan,
  type IaCResourceChange,
} from '@/api/iac';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

const statusColorMap: Record<string, string> = {
  pending: colors.warning[500],
  applied: colors.success[500],
  discarded: colors.neutral[400],
};

const PlansTab: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<IaCWorkspace[]>([]);
  const [plans, setPlans] = useState<IaCPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | undefined>(undefined);

  const loadWorkspaces = async () => {
    try {
      const res = await getWorkspaces();
      setWorkspaces((res.data as { data?: IaCWorkspace[] })?.data ?? []);
    } catch (error: unknown) {
      console.error('Failed to load:', error);
    }
  };

  const loadPlans = async (workspaceId: string) => {
    setLoading(true);
    try {
      const res = await getWorkspacePlans(workspaceId);
      setPlans((res.data as { data?: IaCPlan[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载计划失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWorkspaceChange = (id: string) => {
    setSelectedWorkspace(id);
    loadPlans(id);
  };

  const columns = [
    {
      title: 'Plan ID',
      dataIndex: 'id',
      key: 'id',
      ellipsis: true,
      render: (v: string) => <code style={{ fontSize: 12 }}>{v.slice(0, 12)}...</code>,
    },
    { title: '工作区', dataIndex: 'workspaceId', key: 'workspaceId', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={statusColorMap[s]}>{s}</Tag>,
    },
    {
      title: '变更数',
      dataIndex: 'resourceChanges',
      key: 'resourceChanges',
      render: (changes: IaCResourceChange[]) => changes?.length || 0,
    },
    {
      title: '预估费用',
      dataIndex: 'costEstimate',
      key: 'costEstimate',
      render: (v: number) => (v ? `$${v.toFixed(2)}` : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <div>
          <Title level={3} style={{ marginBottom: spacing.sm }}>
            <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            变更计划
          </Title>
          <Text type="secondary">基础设施变更计划与资源预览</Text>
        </div>
        <Select
          placeholder="选择工作区"
          style={{ width: 240 }}
          onChange={handleWorkspaceChange}
          value={selectedWorkspace}
        >
          {workspaces.map((w) => (
            <Select.Option key={w.id} value={w.id}>
              {w.name} ({w.environment})
            </Select.Option>
          ))}
        </Select>
      </div>
      <Table
        columns={columns}
        dataSource={plans}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};

export default PlansTab;
