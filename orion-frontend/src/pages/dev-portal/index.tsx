/**
 * Developer Portal / Backstage Page
 * Service catalog, tech docs, owned-by, component health overview (Backstage-style)
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Tag,
  Button,
  Space,
  Input,
  Table,
  message,
  Modal,
  Empty,
  Statistic,
  Progress,
  List,
  Descriptions,
} from 'antd';
import {
  AppstoreOutlined,
  SearchOutlined,
  StarOutlined,
  TeamOutlined,
  GithubOutlined,
  RocketOutlined,
  HeartOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { ColumnsType } from 'antd/es/table';
import PageSkeleton from '@/components/PageSkeleton';
const { Title, Text } = Typography;

interface ServiceComponent {
  id: string;
  name: string;
  type: 'service' | 'library' | 'site' | 'tool';
  owner: string;
  lifecycle: 'production' | 'experimental' | 'deprecated';
  health: number;
  techDocs: boolean;
  lastDeployed: string;
  language: string;
  repo: string;
}

const FALLBACK_COMPONENTS: ServiceComponent[] = [
  { id: '1', name: 'orion-platform-svc-go', type: 'service', owner: 'platform-team', lifecycle: 'production', health: 98, techDocs: true, lastDeployed: '2026-08-25', language: 'Go', repo: 'github.com/orion/platform-svc' },
  { id: '2', name: 'orion-frontend', type: 'service', owner: 'platform-team', lifecycle: 'production', health: 95, techDocs: true, lastDeployed: '2026-08-26', language: 'TypeScript', repo: 'github.com/orion/frontend' },
  { id: '3', name: 'orion-agent-runtime', type: 'service', owner: 'ai-team', lifecycle: 'production', health: 92, techDocs: true, lastDeployed: '2026-08-20', language: 'Go', repo: 'github.com/orion/agent-runtime' },
  { id: '4', name: 'orion-shared-lib', type: 'library', owner: 'platform-team', lifecycle: 'production', health: 100, techDocs: false, lastDeployed: '2026-08-15', language: 'TypeScript', repo: 'github.com/orion/shared-lib' },
  { id: '5', name: 'orion-doc-site', type: 'site', owner: 'docs-team', lifecycle: 'production', health: 88, techDocs: true, lastDeployed: '2026-08-18', language: 'Markdown', repo: 'github.com/orion/docs' },
  { id: '6', name: 'orion-ml-sdk', type: 'library', owner: 'ai-team', lifecycle: 'experimental', health: 76, techDocs: false, lastDeployed: '2026-08-22', language: 'Python', repo: 'github.com/orion/ml-sdk' },
];

async function fetchComponents(): Promise<ServiceComponent[]> {
  try {
    const resp = await fetch('/api/v1/developer-portal/components', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    });
    if (!resp.ok) return FALLBACK_COMPONENTS;
    const json = await resp.json();
    return json.data || FALLBACK_COMPONENTS;
  } catch {
    return FALLBACK_COMPONENTS;
  }
}

const DevPortalPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [components, setComponents] = useState<ServiceComponent[]>(FALLBACK_COMPONENTS);
  const [selected, setSelected] = useState<ServiceComponent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchComponents();
      setComponents(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = search
    ? components.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.owner.includes(search.toLowerCase()))
    : components;

  const stats = {
    total: components.length,
    services: components.filter((c) => c.type === 'service').length,
    libraries: components.filter((c) => c.type === 'library').length,
    healthy: components.filter((c) => c.health >= 90).length,
  };

  const avgHealth = components.length > 0 ? Math.round(components.reduce((s, c) => s + c.health, 0) / components.length) : 0;

  const handleView = (c: ServiceComponent) => {
    setSelected(c);
    setDetailOpen(true);
  };

  const handleOpenRepo = (c: ServiceComponent) => {
    window.open(`https://${c.repo}`, '_blank');
    message.success(`已打开 ${c.name} 仓库`);
  };

  const columns: ColumnsType<ServiceComponent> = [
    { title: '组件名称', key: 'name', render: (_: unknown, r: ServiceComponent) => (
      <Space><AppstoreOutlined style={{ color: colors.primary[500] }} /><Text strong style={{ cursor: 'pointer' }} onClick={() => handleView(r)}>{r.name}</Text></Space>
    )},
    { title: '类型', dataIndex: 'type', key: 'type', width: 80,
      render: (v: string) => <Tag color={v === 'service' ? 'blue' : v === 'library' ? 'green' : v === 'site' ? 'purple' : 'orange'}>{v}</Tag> },
    { title: '拥有团队', dataIndex: 'owner', key: 'owner', width: 120, render: (v: string) => <Tag color="default">{v}</Tag> },
    { title: '生命周期', dataIndex: 'lifecycle', key: 'lifecycle', width: 100,
      render: (v: string) => <Tag color={v === 'production' ? 'green' : v === 'experimental' ? 'orange' : 'red'}>{v}</Tag> },
    { title: '健康度', key: 'health', width: 100,
      render: (_: unknown, r: ServiceComponent) => <Progress type="line" size="small" percent={r.health} format={() => `${r.health}%`}
        strokeColor={r.health >= 90 ? colors.success[500] : r.health >= 70 ? colors.warning[500] : colors.error[500]} /> },
    { title: '文档', dataIndex: 'techDocs', key: 'techDocs', width: 60, render: (v: boolean) => v ? <StarOutlined style={{ color: colors.success[500] }} /> : <FileTextOutlined style={{ color: '#d9d9d9' }} /> },
    { title: '最后部署', dataIndex: 'lastDeployed', key: 'lastDeployed', width: 120 },
    {
      title: '操作', key: 'action', width: 120,
      render: (_: unknown, r: ServiceComponent) => (
        <Space size="small">
          <Button size="small" icon={<GithubOutlined />} onClick={() => handleOpenRepo(r)}>Repo</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <AppstoreOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
        开发者门户
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        Backstage 风格组件目录 · 技术文档 · 拥有者 · 组件健康总览
      </Text>

      {loading ? <PageSkeleton rows={8} /> : (
        <>
          <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
            <Col span={6}><Card size="small"><Statistic title="组件总数" value={stats.total} prefix={<AppstoreOutlined />} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="服务数" value={stats.services} prefix={<RocketOutlined />} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="库数" value={stats.libraries} prefix={<StarOutlined />} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="平均健康度" value={avgHealth} suffix="%" prefix={<HeartOutlined />} valueStyle={{ color: avgHealth >= 90 ? colors.success[500] : colors.warning[500] }} /></Card></Col>
          </Row>

          <Card style={{ marginBottom: spacing.md }}>
            <Input.Search placeholder="搜索组件名称或拥有团队..." value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ width: 400 }} enterButton={<SearchOutlined />} allowClear />
          </Card>

          <Card title="组件目录">
            <Table dataSource={filtered} columns={columns} rowKey="id" size="small" pagination={{ pageSize: 10 }}
              locale={{ emptyText: <Empty description="暂无组件" /> }} />
          </Card>

          <Card title="最近更新" style={{ marginTop: spacing.md }}>
            <List
              itemLayout="horizontal"
              dataSource={components.slice(0, 5)}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={<Text strong>{item.name}</Text>}
                    description={<Text type="secondary">{item.owner} · {item.language} · 更新于 {item.lastDeployed}</Text>}
                  />
                  <Progress type="circle" size={36} percent={item.health} format={() => `${item.health}`} />
                </List.Item>
              )}
            />
          </Card>
        </>
      )}

      <Modal
        title={selected?.name || ''}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={[
          <Button key="repo" icon={<GithubOutlined />} onClick={() => selected && handleOpenRepo(selected)}>打开仓库</Button>,
          <Button key="close" onClick={() => setDetailOpen(false)}>关闭</Button>,
        ]}
      >
        {selected && (
          <>
            <Descriptions size="small" bordered column={2}>
              <Descriptions.Item label="类型"><Tag>{selected.type}</Tag></Descriptions.Item>
              <Descriptions.Item label="生命周期"><Tag color={selected.lifecycle === 'production' ? 'green' : selected.lifecycle === 'experimental' ? 'orange' : 'red'}>{selected.lifecycle}</Tag></Descriptions.Item>
              <Descriptions.Item label="拥有团队"><TeamOutlined /> {selected.owner}</Descriptions.Item>
              <Descriptions.Item label="语言"><Tag>{selected.language}</Tag></Descriptions.Item>
              <Descriptions.Item label="仓库" span={2}><GithubOutlined /> {selected.repo}</Descriptions.Item>
              <Descriptions.Item label="健康度" span={2}>
                <Progress percent={selected.health} format={() => `${selected.health}%`} />
              </Descriptions.Item>
              <Descriptions.Item label="技术文档" span={2}>
                {selected.techDocs ? <Tag color="green">已发布</Tag> : <Tag>未发布</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="最后部署">{selected.lastDeployed}</Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Modal>
    </div>
  );
};

export default DevPortalPage;
