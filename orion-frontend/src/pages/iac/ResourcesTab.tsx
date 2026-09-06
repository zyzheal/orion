/**
 * ResourcesTab.tsx - IaC 基础设施资源
 * 抽取自 IacPage.tsx (P2-9 Phase 49)
 * 工作区选择器 + 资源变更 Table
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Table,
  Tag,
  Select,
  message,
} from 'antd';
import { DeploymentUnitOutlined } from '@ant-design/icons';
import {
  getWorkspaces,
  getWorkspaceResources,
  type IaCWorkspace,
  type IaCResourceChange,
} from '@/api/iac';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

const actionColorMap: Record<string, string> = {
  create: colors.success[500],
  update: colors.warning[500],
  delete: colors.error[500],
  replace: colors.purple[500],
  read: colors.neutral[400],
};

const ResourcesTab: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<IaCWorkspace[]>([]);
  const [resources, setResources] = useState<IaCResourceChange[]>([]);
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

  const loadResources = async (workspaceId: string) => {
    setLoading(true);
    try {
      const res = await getWorkspaceResources(workspaceId);
      setResources((res.data as { data?: IaCResourceChange[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载资源失败');
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
    loadResources(id);
  };

  const columns = [
    { title: '地址', dataIndex: 'address', key: 'address', ellipsis: true },
    { title: '类型', dataIndex: 'type', key: 'type' },
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      render: (a: string) => <Tag color={actionColorMap[a]}>{a}</Tag>,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <div>
          <Title level={3} style={{ marginBottom: spacing.sm }}>
            <DeploymentUnitOutlined
              style={{ marginRight: spacing[3], color: colors.primary[500] }}
            />
            基础设施资源
          </Title>
          <Text type="secondary">查看工作区管理的基础设施资源</Text>
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
        dataSource={resources}
        rowKey="address"
        loading={loading}
        pagination={{ pageSize: 15 }}
      />
    </div>
  );
};

export default ResourcesTab;
