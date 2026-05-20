/**
 * Integration Page - Host and K8s resource sync status
 * Extracted from CMDB/index.tsx
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Table,
  Tag,
  Button,
  Statistic,
  message,
  Tabs,
  Drawer,
  Descriptions,
  Space,
} from 'antd';
import {
  SyncOutlined,
  CloudServerOutlined,
  ClusterOutlined,
  StopOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import { getHosts, getK8sResources, getCICDResources, startK8sSync, stopK8sSync, type HostInfo, type K8sResource, type CICDResource } from '@/api/cmdb';

const { Title, Text } = Typography;

const IntegrationPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [hosts, setHosts] = useState<HostInfo[]>([]);
  const [k8sResources, setK8sResources] = useState<K8sResource[]>([]);
  const [cicdResources, setCICDResources] = useState<CICDResource[]>([]);
  const [selectedHost, setSelectedHost] = useState<HostInfo | null>(null);
  const [hostDrawerOpen, setHostDrawerOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [hostsRes, k8sRes, cicdRes] = await Promise.all([
        getHosts({ pageSize: 20 }),
        getK8sResources(),
        getCICDResources(),
      ]);
      setHosts((hostsRes.data as any).data || []);
      setK8sResources((k8sRes.data as any).data || []);
      setCICDResources((cicdRes.data as any).data || []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载集成数据失败：${error.message}`);
      } else {
        message.error('加载集成数据失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await startK8sSync();
      message.success('K8s 同步已启动');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`同步启动失败：${error.message}`);
      } else {
        message.error('同步启动失败');
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleStopSync = async () => {
    setStopping(true);
    try {
      await stopK8sSync();
      message.success('K8s 同步已停止');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`同步停止失败：${error.message}`);
      } else {
        message.error('同步停止失败');
      }
    } finally {
      setStopping(false);
    }
  };

  const hostColumns = [
    { title: '主机名', dataIndex: 'hostname', key: 'hostname' },
    { title: 'IP', dataIndex: 'ip', key: 'ip' },
    { title: 'OS', dataIndex: 'os', key: 'os' },
    { title: 'CPU', dataIndex: 'cpu', key: 'cpu', render: (v: number) => `${v} Core` },
    { title: '内存', dataIndex: 'memory', key: 'memory', render: (v: number) => `${(v / 1024).toFixed(1)} GB` },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s === 'running' ? 'green' : 'default'}>{s}</Tag> },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: HostInfo) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedHost(record);
            setHostDrawerOpen(true);
          }}
        >
          详情
        </Button>
      ),
    },
  ];

  const k8sColumns = [
    { title: '类型', dataIndex: 'kind', key: 'kind', render: (k: string) => <Tag>{k}</Tag> },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: 'Namespace', dataIndex: 'namespace', key: 'namespace' },
    { title: '副本', dataIndex: 'replicas', key: 'replicas', render: (r: any) => (r ? `${r.current}/${r.desired}` : '-') },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s === 'Running' ? 'green' : 'default'}>{s}</Tag> },
  ];

  const cicdColumns = [
    { title: '类型', dataIndex: 'type', key: 'type', render: (t: string) => <Tag color="purple">{t}</Tag> },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: 'URL', dataIndex: 'url', key: 'url', render: (u: string) => u ? <a href={u} target="_blank" rel="noopener noreferrer">{u}</a> : '-' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{s}</Tag> },
  ];

  const isInitialLoading = loading && hosts.length === 0 && k8sResources.length === 0;

  return (
    <div>
      {isInitialLoading && <PageSkeleton cards={3} rows={8} />}
      {isInitialLoading ? null : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <Title level={4}>集成资源</Title>
              <Text type="secondary">主机、K8s、CI/CD 资源同步状态</Text>
            </div>
            <Space>
              <Button icon={<SyncOutlined spin={syncing} />} onClick={handleSync} loading={syncing}>
                K8s 同步
              </Button>
              <Button icon={<StopOutlined />} onClick={handleStopSync} loading={stopping} danger>
                停止同步
              </Button>
            </Space>
          </div>

          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card><Statistic title="主机数量" value={hosts.length} prefix={<CloudServerOutlined />} /></Card>
            </Col>
            <Col span={8}>
              <Card><Statistic title="K8s 资源" value={k8sResources.length} prefix={<ClusterOutlined />} /></Card>
            </Col>
            <Col span={8}>
              <Card><Statistic title="运行中主机" value={hosts.filter((h) => h.status === 'running').length} valueStyle={{ color: colors.success[500] }} /></Card>
            </Col>
          </Row>

          <Tabs
            defaultActiveKey="hosts"
            items={[
              {
                key: 'hosts',
                label: (
                  <span>
                    <CloudServerOutlined /> 主机列表
                  </span>
                ),
                children: (
                  <Card loading={loading}>
                    <Table columns={hostColumns} dataSource={hosts} rowKey="ci_id" pagination={{ pageSize: 10 }} />
                  </Card>
                ),
              },
              {
                key: 'k8s',
                label: (
                  <span>
                    <ClusterOutlined /> K8s 资源
                  </span>
                ),
                children: (
                  <Card loading={loading}>
                    <Table columns={k8sColumns} dataSource={k8sResources} rowKey={(r) => `${r.kind}-${r.namespace}-${r.name}`} pagination={{ pageSize: 10 }} />
                  </Card>
                ),
              },
              {
                key: 'cicd',
                label: 'CI/CD 资源',
                children: (
                  <Card loading={loading}>
                    <Table columns={cicdColumns} dataSource={cicdResources} rowKey={(r: CICDResource) => `${r.type}-${r.name}`} pagination={{ pageSize: 10 }} locale={{ emptyText: '暂无 CI/CD 资源' }} />
                  </Card>
                ),
              },
            ]}
          />

          <Drawer
            title="主机详情"
            placement="right"
            width={600}
            open={hostDrawerOpen}
            onClose={() => {
              setHostDrawerOpen(false);
              setSelectedHost(null);
            }}
          >
            {selectedHost && (
              <Descriptions column={1} bordered>
                <Descriptions.Item label="CI ID">{selectedHost.ci_id}</Descriptions.Item>
                <Descriptions.Item label="主机名">{selectedHost.hostname}</Descriptions.Item>
                <Descriptions.Item label="IP">{selectedHost.ip}</Descriptions.Item>
                <Descriptions.Item label="操作系统">{selectedHost.os}</Descriptions.Item>
                <Descriptions.Item label="CPU">{selectedHost.cpu} Core</Descriptions.Item>
                <Descriptions.Item label="内存">{(selectedHost.memory / 1024).toFixed(1)} GB</Descriptions.Item>
                <Descriptions.Item label="磁盘">{(selectedHost.disk / 1024).toFixed(1)} GB</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={selectedHost.status === 'running' ? 'green' : 'default'}>{selectedHost.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="云厂商">{selectedHost.provider || '-'}</Descriptions.Item>
                <Descriptions.Item label="区域">{selectedHost.region || '-'}</Descriptions.Item>
              </Descriptions>
            )}
          </Drawer>
        </>
      )}
    </div>
  );
};

export default IntegrationPage;
