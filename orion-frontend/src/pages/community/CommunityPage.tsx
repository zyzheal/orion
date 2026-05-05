/**
 * Community Ecosystem Page
 * Phase 3 - Community contributions, skill sharing, and ecosystem management
 */
import React, { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  Typography,
  Tabs,
  Avatar,
} from 'antd';
import {
  TeamOutlined,
  ReloadOutlined,
  StarOutlined,
  GithubOutlined,
  GlobalOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface Contributor {
  id: string;
  name: string;
  avatar: string;
  contributions: number;
  skills: string[];
  joinedAt: string;
  github: string;
  reputation: number;
}

interface EcosystemPlugin {
  id: string;
  name: string;
  author: string;
  downloads: number;
  stars: number;
  category: string;
  description: string;
  version: string;
}

interface Event {
  id: string;
  title: string;
  type: 'workshop' | 'webinar' | 'hackathon' | 'release';
  date: string;
  attendees: number;
  description: string;
}

const mockContributors: Contributor[] = [
  { id: 'c1', name: 'Zhang Wei', avatar: '', contributions: 142, skills: ['pipeline', 'ai-agent', 'k8s'], joinedAt: '2025-01-10', github: '@zhangwei', reputation: 4850 },
  { id: 'c2', name: 'Li Ming', avatar: '', contributions: 98, skills: ['monitoring', 'alerting', 'finops'], joinedAt: '2025-02-15', github: '@liming', reputation: 3200 },
  { id: 'c3', name: 'Wang Fang', avatar: '', contributions: 76, skills: ['chaos', 'resilience', 'testing'], joinedAt: '2025-03-20', github: '@wangfang', reputation: 2800 },
];

const mockPlugins: EcosystemPlugin[] = [
  { id: 'ep1', name: 'k8s-deploy-pro', author: 'Zhang Wei', downloads: 5200, stars: 180, category: 'deployment', description: 'Advanced Kubernetes deployment plugin with canary support', version: '2.1.0' },
  { id: 'ep2', name: 'monitor-dashboard-plus', author: 'Li Ming', downloads: 3800, stars: 95, category: 'monitoring', description: 'Enhanced monitoring dashboard with custom widgets', version: '1.5.2' },
  { id: 'ep3', name: 'chaos-monkey-ext', author: 'Wang Fang', downloads: 1500, stars: 62, category: 'chaos', description: 'Extended chaos monkey with custom fault injection', version: '1.0.0' },
];

const mockEvents: Event[] = [
  { id: 'e1', title: 'Orion Platform Workshop Q2', type: 'workshop', date: '2026-05-20', attendees: 120, description: 'Hands-on workshop for new platform features' },
  { id: 'e2', title: 'CloudNative Webinar: GitOps', type: 'webinar', date: '2026-06-01', attendees: 300, description: 'GitOps best practices and Orion integration' },
  { id: 'e3', title: 'Summer Hackathon 2026', type: 'hackathon', date: '2026-07-15', attendees: 500, description: 'Build plugins and integrations for the platform' },
];

const eventIcon: Record<string, typeof StarOutlined> = {
  workshop: StarOutlined,
  webinar: GlobalOutlined,
  hackathon: GithubOutlined,
  release: StarOutlined,
};

const CommunityPage: React.FC = () => {
  const [contributors] = useState<Contributor[]>(mockContributors);
  const [plugins] = useState<EcosystemPlugin[]>(mockPlugins);
  const [events] = useState<Event[]>(mockEvents);
  const [loading, setLoading] = useState(false);

  const totalContributions = contributors.reduce((s, c) => s + c.contributions, 0);
  const totalDownloads = plugins.reduce((s, p) => s + p.downloads, 0);
  const totalStars = plugins.reduce((s, p) => s + p.stars, 0);

  const contributorColumns = [
    {
      title: 'Contributor',
      dataIndex: 'name',
      key: 'name',
      render: (v: string, record: Contributor) => (
        <Space>
          <Avatar>{v[0]}</Avatar>
          <div>
            <div>{v}</div>
            <Text type="secondary">{record.github}</Text>
          </div>
        </Space>
      ),
    },
    { title: 'Contributions', dataIndex: 'contributions', key: 'contributions' },
    {
      title: 'Skills',
      dataIndex: 'skills',
      key: 'skills',
      render: (v: string[]) => v.map((s) => <Tag key={s}>{s}</Tag>),
    },
    { title: 'Reputation', dataIndex: 'reputation', key: 'reputation', render: (v: number) => v.toLocaleString() },
    { title: 'Joined', dataIndex: 'joinedAt', key: 'joinedAt' },
  ];

  const pluginColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Author', dataIndex: 'author', key: 'author' },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    { title: 'Downloads', dataIndex: 'downloads', key: 'downloads', render: (v: number) => v.toLocaleString() },
    {
      title: 'Stars',
      dataIndex: 'stars',
      key: 'stars',
      render: (v: number) => (
        <Space><StarOutlined /> {v}</Space>
      ),
    },
    { title: 'Version', dataIndex: 'version', key: 'version' },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
  ];

  const eventColumns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (v: string, record: Event) => {
        const Icon = eventIcon[record.type] || StarOutlined;
        return <Space><Icon /> {v}</Space>;
      },
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => <Tag color="cyan">{v}</Tag>,
    },
    { title: 'Date', dataIndex: 'date', key: 'date' },
    { title: 'Attendees', dataIndex: 'attendees', key: 'attendees' },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <TeamOutlined /> Community Ecosystem
          </Title>
          <Text type="secondary">Contributors, shared plugins, and community events</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => setLoading(true)} loading={loading}>
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="Contributors" value={contributors.length} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Total Contributions" value={totalContributions} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Plugin Downloads" value={totalDownloads.toLocaleString()} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Total Stars" value={totalStars} prefix={<StarOutlined />} /></Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          defaultActiveKey="contributors"
          items={[
            {
              key: 'contributors',
              label: 'Contributors',
              children: (
                <Table columns={contributorColumns} dataSource={contributors} rowKey="id" pagination={false} />
              ),
            },
            {
              key: 'plugins',
              label: 'Community Plugins',
              children: (
                <Table columns={pluginColumns} dataSource={plugins} rowKey="id" pagination={false} />
              ),
            },
            {
              key: 'events',
              label: 'Events',
              children: (
                <Table columns={eventColumns} dataSource={events} rowKey="id" pagination={false} />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default CommunityPage;
