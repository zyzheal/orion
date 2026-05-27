/**
 * Community Ecosystem Page
 * Phase 4 - Community contributions, skill sharing, and ecosystem management
 *
 * Features:
 * - Contribution management
 * - Contributor profiles and badges
 * - Plugin submission and review
 * - Mentorship program
 */
import React, { useState, useEffect, useMemo } from 'react';
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
  Modal,
  Form,
  Input,
  Select,
  message,
} from 'antd';
import {
  TeamOutlined,
  ReloadOutlined,
  StarOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  communityApi,
  type Contribution,
  type Badge,
  type Mentorship,
} from '@/api/community';
import { colors } from '@/tokens';

const { Title, Text } = Typography;

const typeColorMap: Record<string, string> = {
  plugin: 'blue',
  skill: 'green',
  template: 'orange',
  documentation: 'purple',
  code: 'cyan',
};

const typeLabelMap: Record<string, string> = {
  plugin: '插件',
  skill: '技能',
  template: '模板',
  documentation: '文档',
  code: '代码',
};

const statusColorMap: Record<string, string> = {
  pending: 'default',
  approved: 'green',
  rejected: 'red',
};

const statusLabelMap: Record<string, string> = {
  pending: '审核中',
  approved: '已通过',
  rejected: '已拒绝',
};

const badgeLevelColor: Record<string, string> = {
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
  platinum: '#e5e4e2',
};

const CommunityPage: React.FC = () => {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [mentorships, setMentorships] = useState<Mentorship[]>([]);
  const [loading, setLoading] = useState(false);
  const [contributeModalOpen, setContributeModalOpen] = useState(false);
  const [mentorshipModalOpen, setMentorshipModalOpen] = useState(false);
  const [contributeForm] = Form.useForm();
  const [mentorshipForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [contribsRes, badgesRes, mentorshipsRes] = await Promise.allSettled([
        communityApi.listContributions(),
        communityApi.listBadges(),
        communityApi.listMentorship(),
      ]);

      if (contribsRes.status === 'fulfilled') {
        setContributions(Array.isArray(contribsRes.value) ? contribsRes.value : []);
      }
      if (badgesRes.status === 'fulfilled') {
        setBadges(Array.isArray(badgesRes.value) ? badgesRes.value : []);
      }
      if (mentorshipsRes.status === 'fulfilled') {
        setMentorships(Array.isArray(mentorshipsRes.value) ? mentorshipsRes.value : []);
      }
    } catch (error: unknown) {
      message.error(`加载社区数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContribution = async (values: any) => {
    try {
      await communityApi.createContribution({
        type: values.type,
        title: values.title,
        description: values.description || '',
        repository_url: values.repositoryUrl || undefined,
      });
      message.success('贡献提交成功');
      setContributeModalOpen(false);
      contributeForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`提交失败: ${(error as Error).message}`);
    }
  };

  const handleCreateMentorship = async (values: any) => {
    try {
      await communityApi.createMentorship({
        mentor_id: values.mentorId,
        mentee_id: values.menteeId,
        skill_area: values.skillArea,
      });
      message.success('导师申请提交成功');
      setMentorshipModalOpen(false);
      mentorshipForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`申请失败: ${(error as Error).message}`);
    }
  };

  // Stats
  const stats = useMemo(() => ({
    totalContributions: contributions.length,
    approved: contributions.filter((c) => c.status === 'approved').length,
    totalDownloads: contributions.reduce((s, c) => s + (c.downloads || 0), 0),
    totalStars: contributions.reduce((s, c) => s + (c.stars || 0), 0),
  }), [contributions]);

  // Contribution columns
  const contributionColumns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (v: string) => <Tag color={typeColorMap[v]}>{typeLabelMap[v]}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (v: string) => <Tag color={statusColorMap[v]}>{statusLabelMap[v]}</Tag>,
    },
    { title: '作者', dataIndex: 'username', key: 'username', width: 100 },
    {
      title: 'Stars',
      dataIndex: 'stars',
      key: 'stars',
      width: 80,
      render: (v: number) => <Space><StarOutlined /> {v || 0}</Space>,
    },
    {
      title: '下载',
      dataIndex: 'downloads',
      key: 'downloads',
      width: 80,
      render: (v: number) => (v || 0).toLocaleString(),
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
  ];

  // Badge columns
  const badgeColumns = [
    {
      title: '徽章',
      key: 'icon',
      width: 60,
      render: (_: unknown, record: Badge) => (
        <Avatar style={{ backgroundColor: badgeLevelColor[record.level] }}>
          {record.icon}
        </Avatar>
      ),
    },
    { title: '名称', dataIndex: 'name', key: 'name', width: 120 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '等级',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (v: string) => (
        <Tag color={badgeLevelColor[v] || 'default'}>{v}</Tag>
      ),
    },
  ];

  // Mentorship columns
  const mentorshipColumns = [
    { title: '导师', dataIndex: 'mentor_id', key: 'mentor_id', width: 140, render: (v: string) => v.slice(0, 12) },
    { title: '学员', dataIndex: 'mentee_id', key: 'mentee_id', width: 140, render: (v: string) => v.slice(0, 12) },
    { title: '技能领域', dataIndex: 'skill_area', key: 'skill_area', width: 140 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (v: string) => {
        const colorMap: Record<string, string> = { pending: 'default', active: 'green', completed: 'blue' };
        const labelMap: Record<string, string> = { pending: '待确认', active: '进行中', completed: '已完成' };
        return <Tag color={colorMap[v]}>{labelMap[v]}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
  ];

  const tabItems = [
    {
      key: 'contributions',
      label: '社区贡献',
      children: (
        <Table
          columns={contributionColumns}
          dataSource={contributions}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      ),
    },
    {
      key: 'badges',
      label: '徽章系统',
      children: (
        <Table
          columns={badgeColumns}
          dataSource={badges}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      ),
    },
    {
      key: 'mentorship',
      label: '导师计划',
      children: (
        <Table
          columns={mentorshipColumns}
          dataSource={mentorships}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <TeamOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            社区生态
          </Title>
          <Text type="secondary">社区贡献、共享插件和导师计划</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => setContributeModalOpen(true)}>
            提交贡献
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => setMentorshipModalOpen(true)}>
            导师申请
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="贡献总数" value={stats.totalContributions} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已通过" value={stats.approved} valueStyle={{ color: colors.success[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总下载" value={stats.totalDownloads} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总 Stars" value={stats.totalStars} prefix={<StarOutlined />} />
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Card>
        <Tabs items={tabItems} />
      </Card>

      {/* Create Contribution Modal */}
      <Modal
        title="提交社区贡献"
        open={contributeModalOpen}
        onCancel={() => setContributeModalOpen(false)}
        onOk={() => contributeForm.submit()}
        width={600}
      >
        <Form form={contributeForm} layout="vertical" onFinish={handleCreateContribution}>
          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="贡献标题" />
          </Form.Item>
          <Form.Item label="类型" name="type" rules={[{ required: true, message: '请选择类型' }]}>
            <Select
              options={[
                { value: 'plugin', label: '插件' },
                { value: 'skill', label: '技能' },
                { value: 'template', label: '模板' },
                { value: 'documentation', label: '文档' },
                { value: 'code', label: '代码' },
              ]}
            />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} placeholder="详细描述" />
          </Form.Item>
          <Form.Item label="仓库 URL" name="repositoryUrl">
            <Input placeholder="https://github.com/..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Mentorship Modal */}
      <Modal
        title="导师计划申请"
        open={mentorshipModalOpen}
        onCancel={() => setMentorshipModalOpen(false)}
        onOk={() => mentorshipForm.submit()}
        width={600}
      >
        <Form form={mentorshipForm} layout="vertical" onFinish={handleCreateMentorship}>
          <Form.Item label="导师 ID" name="mentorId" rules={[{ required: true, message: '请输入导师 ID' }]}>
            <Input placeholder="导师用户 ID" />
          </Form.Item>
          <Form.Item label="学员 ID" name="menteeId" rules={[{ required: true, message: '请输入学员 ID' }]}>
            <Input placeholder="学员用户 ID" />
          </Form.Item>
          <Form.Item label="技能领域" name="skillArea" rules={[{ required: true, message: '请输入技能领域' }]}>
            <Select
              options={[
                { label: 'Pipeline', value: 'pipeline' },
                { label: 'Kubernetes', value: 'k8s' },
                { label: 'Monitoring', value: 'monitoring' },
                { label: 'AI Agent', value: 'ai-agent' },
                { label: 'FinOps', value: 'finops' },
                { label: 'Chaos Engineering', value: 'chaos' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CommunityPage;
