/**
 * IaC State Browser - State version history, resource list, state diff
 */
import React, { useState, useEffect } from 'react';
import { Typography, Button, Space, Tag, Card, Row, Col, Statistic, message, Select, Modal } from 'antd';
import { colors, spacing } from '@/tokens';
import { ReloadOutlined, DiffOutlined, EyeOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import { getWorkspaces, getWorkspaceStateVersions, getWorkspaceResources, type IaCStateVersion, type IaCStateResource } from '@/api/iac';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const StateBrowser: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [stateVersions, setStateVersions] = useState<IaCStateVersion[]>([]);
  const [resources, setResources] = useState<IaCStateResource[]>([]);
  const [diffModalVisible, setDiffModalVisible] = useState(false);
  const [diffVersionA, setDiffVersionA] = useState<number>(0);
  const [diffVersionB, setDiffVersionB] = useState<number>(0);

  const loadWorkspaces = async () => {
    try {
      const res = await getWorkspaces();
      const wsList = Array.isArray(res.data.data) ? res.data.data : [];
      setWorkspaces(wsList.map((w: { id: string; name: string }) => ({ id: w.id, name: w.name })));
      if (wsList.length > 0) {
        setSelectedWorkspaceId(wsList[0].id);
      }
    } catch {
      message.error('Failed to load workspaces');
    }
  };

  const loadWorkspaceData = async (wsId: string) => {
    if (!wsId) return;
    setLoading(true);
    try {
      const [verRes, resRes] = await Promise.all([
        getWorkspaceStateVersions(wsId),
        getWorkspaceResources(wsId),
      ]);
      setStateVersions(Array.isArray(verRes.data.data) ? verRes.data.data : []);
      setResources(Array.isArray(resRes.data.data) ? resRes.data.data : []);
    } catch {
      message.error('Failed to load state data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspaceId) {
      loadWorkspaceData(selectedWorkspaceId);
    }
  }, [selectedWorkspaceId]);

  const selectedWsName = workspaces.find((w) => w.id === selectedWorkspaceId)?.name || '';

  const versionColumns: TableColumn<IaCStateVersion>[] = [
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 80,
      sortable: true,
      render: (v: unknown) => <Tag>v{String(v)}</Tag>,
    },
    {
      key: 'serial',
      title: '序列号',
      dataIndex: 'serial',
      width: 100,
      render: (v: unknown) => <Text>{String(v)}</Text>,
    },
    {
      key: 'resourcesCount',
      title: '资源数',
      dataIndex: 'resourcesCount',
      width: 100,
      sortable: true,
      render: (v: unknown) => <Text>{String(v)}</Text>,
    },
    {
      key: 'createdBy',
      title: '操作人',
      dataIndex: 'createdBy',
      width: 140,
      render: (v: unknown) => <Text>{String(v)}</Text>,
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      sortable: true,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>{dayjs(String(v)).fromNow()}</Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 120,
      render: (_: unknown) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />}>查看</Button>
        </Space>
      ),
    },
  ];

  const resourceColumns: TableColumn<IaCStateResource>[] = [
    {
      key: 'address',
      title: '资源地址',
      dataIndex: 'address',
      width: 300,
      sortable: true,
      render: (v: unknown) => <Text code style={{ fontSize: spacing[3] }}>{String(v)}</Text>,
    },
    {
      key: 'type',
      title: '类型',
      dataIndex: 'type',
      width: 160,
      render: (v: unknown) => <Tag color="blue">{String(v)}</Tag>,
    },
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      width: 160,
      render: (v: unknown) => <Text>{String(v)}</Text>,
    },
    {
      key: 'provider',
      title: 'Provider',
      dataIndex: 'provider',
      width: 160,
      render: (v: unknown) => <Tag>{String(v)}</Tag>,
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>状态浏览</Title>
          <Text type="secondary">IaC 状态版本历史与资源查看</Text>
        </div>
        <Space>
          <Select
            value={selectedWorkspaceId}
            onChange={setSelectedWorkspaceId}
            style={{ width: 200 }}
            options={workspaces.map((w) => ({ label: w.name, value: w.id }))}
            placeholder="选择工作空间"
          />
          <Button icon={<ReloadOutlined />} onClick={() => loadWorkspaceData(selectedWorkspaceId)} loading={loading}>刷新</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="状态版本数" value={stateVersions.length} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="资源总数" value={resources.length} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="最新版本" value={stateVersions.length > 0 ? Math.max(...stateVersions.map((v) => v.version)) : 0} /></Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="最新资源数"
              value={stateVersions.length > 0 ? stateVersions.reduce((max, v) => v.version === Math.max(...stateVersions.map((vv) => vv.version)) ? v.resourcesCount : max, 0) : 0}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={14}>
          <Card title="资源列表" extra={
            <Space>
              <Select size="small" value={diffVersionA} onChange={setDiffVersionA} style={{ width: 80 }}
                options={stateVersions.map((v) => ({ label: `v${v.version}`, value: v.version }))} placeholder="版本A" />
              <Select size="small" value={diffVersionB} onChange={setDiffVersionB} style={{ width: 80 }}
                options={stateVersions.map((v) => ({ label: `v${v.version}`, value: v.version }))} placeholder="版本B" />
              <Button size="small" icon={<DiffOutlined />} onClick={() => setDiffModalVisible(true)}>差异</Button>
            </Space>
          }>
            <Table columns={resourceColumns} dataSource={resources} loading={loading} rowKey="address" size="middle" striped />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="版本历史">
            <Table columns={versionColumns} dataSource={stateVersions} loading={loading} rowKey="id" size="small" striped pagination={{ pageSize: 8, current: 1, total: stateVersions.length } as any} />
          </Card>
        </Col>
      </Row>

      {/* Diff Modal */}
      <Modal title="状态差异" open={diffModalVisible} onCancel={() => setDiffModalVisible(false)} footer={<Button onClick={() => setDiffModalVisible(false)}>关闭</Button>}>
        <p>比较版本 v{diffVersionA} 与 v{diffVersionB} 的状态差异</p>
        <Text type="secondary">工作空间: {selectedWsName}</Text>
        <div style={{ marginTop: 16, padding: 16, background: colors.neutral[50], borderRadius: 4 }}>
          <Text>差异对比结果将在此显示</Text>
        </div>
      </Modal>
    </div>
  );
};

export default StateBrowser;
