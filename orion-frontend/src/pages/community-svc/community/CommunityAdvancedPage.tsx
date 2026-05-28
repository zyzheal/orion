/**
 * Community Advanced Page
 * Phase 4 - Badge management, incentive programs, mentorship pairing
 */

import React, { useState, useEffect } from 'react';
import { communityApi, Contribution, Badge, Mentorship } from '../../../api/community';
import {
  Card, Table, Button, Modal, Form, Select, Input, Tag,
  message, Space, Statistic, Row, Col, Avatar, Tabs,
  Badge as AntBadge, List
} from 'antd';
import { colors } from '@/tokens';
import {
  TrophyOutlined, TeamOutlined, StarOutlined,
  PlusOutlined, ReloadOutlined, UserOutlined,
  CrownOutlined
} from '@ant-design/icons';

const { TextArea } = Input;

const CommunityAdvancedPage: React.FC = () => {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [mentorships, setMentorships] = useState<Mentorship[]>([]);
  const [loading, setLoading] = useState(false);
  const [contributionModal, setContributionModal] = useState(false);
  const [mentorshipModal, setMentorshipModal] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [contribRes, badgeRes, mentorRes] = await Promise.all([
        communityApi.listContributions(),
        communityApi.listBadges(),
        communityApi.listMentorship(),
      ]);
      setContributions(contribRes || []);
      setBadges(badgeRes || []);
      setMentorships(mentorRes || []);
    } catch {
      message.error('Failed to load data');
    }
    setLoading(false);
  };

  const handleCreateContribution = async (values: any) => {
    try {
      await communityApi.createContribution(values);
      message.success('Contribution submitted');
      setContributionModal(false);
      loadData();
    } catch {
      message.error('Failed to submit contribution');
    }
  };

  const handleCreateMentorship = async (values: any) => {
    try {
      await communityApi.createMentorship(values);
      message.success('Mentorship request submitted');
      setMentorshipModal(false);
      loadData();
    } catch {
      message.error('Failed to submit mentorship request');
    }
  };

  const getBadgeIcon = (category: string) => {
    switch (category) {
      case 'contribution': return <TrophyOutlined />;
      case 'mentorship': return <TeamOutlined />;
      case 'quality': return <StarOutlined />;
      case 'milestone': return <CrownOutlined />;
      default: return <TrophyOutlined />;
    }
  };

  const getBadgeColor = (level: string) => {
    switch (level) {
      case 'platinum': return colors.tier.platinum;
      case 'gold': return colors.warning[400];
      case 'silver': return colors.neutral[400];
      case 'bronze': return colors.tier.bronze;
      default: return colors.neutral[300];
    }
  };

  const contributionColumns = [
    {
      title: 'Author',
      dataIndex: 'username',
      key: 'username',
      render: (username: string) => <><Avatar size="small" icon={<UserOutlined />} style={{ marginRight: 8 }} />{username}</>,
    },
    { title: 'Title', dataIndex: 'title', key: 'title' },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <AntBadge
          status={status === 'approved' ? 'success' : status === 'pending' ? 'processing' : 'error'}
          text={status}
        />
      ),
    },
    { title: 'Stars', dataIndex: 'stars', key: 'stars', width: 80 },
    { title: 'Downloads', dataIndex: 'downloads', key: 'downloads', width: 100 },
    { title: 'Created', dataIndex: 'created_at', key: 'created_at', render: (d: string) => new Date(d).toLocaleString() },
  ];

  const mentorshipColumns = [
    { title: 'Mentor ID', dataIndex: 'mentor_id', key: 'mentor_id', width: 100 },
    { title: 'Mentee ID', dataIndex: 'mentee_id', key: 'mentee_id', width: 100 },
    { title: 'Skill Area', dataIndex: 'skill_area', key: 'skill_area' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <AntBadge
          status={status === 'active' ? 'success' : status === 'pending' ? 'processing' : 'default'}
          text={status}
        />
      ),
    },
    { title: 'Created', dataIndex: 'created_at', key: 'created_at', render: (d: string) => new Date(d).toLocaleString() },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Total Contributions" value={contributions.length} prefix={<TrophyOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Available Badges" value={badges.length} prefix={<CrownOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Active Mentorships" value={mentorships.filter(m => m.status === 'active').length} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Approved" value={contributions.filter(c => c.status === 'approved').length} prefix={<StarOutlined />} />
          </Card>
        </Col>
      </Row>

      <Tabs
        items={[
          {
            key: 'contributions',
            label: <><TrophyOutlined /> Contributions</>,
            children: (
              <Card
                title="Community Contributions"
                extra={
                  <Space>
                    <Button icon={<PlusOutlined />} onClick={() => setContributionModal(true)}>
                      Submit Contribution
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
                  </Space>
                }
              >
                <Table
                  columns={contributionColumns}
                  dataSource={contributions}
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            ),
          },
          {
            key: 'badges',
            label: <><CrownOutlined /> Badge Management</>,
            children: (
              <Card title="Community Badges" extra={<Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>}>
                <Row gutter={16}>
                  {badges.map((badge: Badge) => (
                    <Col span={6} key={badge.id} style={{ marginBottom: 16 }}>
                      <Card hoverable size="small" style={{ textAlign: 'center' }}>
                        <Avatar
                          size={48}
                          style={{ backgroundColor: getBadgeColor(badge.level), marginBottom: 8 }}
                          icon={getBadgeIcon(badge.category)}
                        />
                        <div style={{ fontWeight: 'bold' }}>{badge.name}</div>
                        <div style={{ color: colors.neutral[500], fontSize: 12, marginTop: 4 }}>{badge.description}</div>
                        <Tag style={{ marginTop: 8 }} color={getBadgeColor(badge.level)}>
                          {badge.level}
                        </Tag>
                      </Card>
                    </Col>
                  ))}
                </Row>
                {badges.length === 0 && <p style={{ color: colors.neutral[500], textAlign: 'center' }}>No badges available</p>}
              </Card>
            ),
          },
          {
            key: 'mentorship',
            label: <><TeamOutlined /> Mentorship</>,
            children: (
              <Card
                title="Mentorship Pairing"
                extra={
                  <Space>
                    <Button icon={<PlusOutlined />} onClick={() => setMentorshipModal(true)}>
                      Request Mentorship
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
                  </Space>
                }
              >
                <Table
                  columns={mentorshipColumns}
                  dataSource={mentorships}
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            ),
          },
          {
            key: 'incentives',
            label: <><StarOutlined /> Incentive Programs</>,
            children: (
              <Card title="Incentive Programs">
                <List
                  dataSource={[
                    { title: 'Top Contributor Q2', desc: 'Most contributions in Q2 2026', reward: 'Platinum Badge + Recognition' },
                    { title: 'Quality Champion', desc: 'Highest quality score across submissions', reward: 'Gold Badge + Priority Review' },
                    { title: 'Mentor of the Month', desc: 'Best mentorship feedback and outcomes', reward: 'Silver Badge + Bonus Points' },
                    { title: 'Plugin Pioneer', desc: 'First to publish 5 approved plugins', reward: 'Exclusive Badge + Feature Spotlight' },
                  ]}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<AntBadge status="processing" />}
                        title={item.title}
                        description={`${item.desc} | Reward: ${item.reward}`}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* Submit Contribution Modal */}
      <Modal
        title="Submit Contribution"
        open={contributionModal}
        onCancel={() => setContributionModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateContribution}>
          <Form.Item label="Type" name="type" required>
            <Select options={[
              { value: 'plugin', label: 'Plugin' },
              { value: 'skill', label: 'Skill' },
              { value: 'template', label: 'Template' },
              { value: 'documentation', label: 'Documentation' },
              { value: 'code', label: 'Code' },
            ]} />
          </Form.Item>
          <Form.Item label="Title" name="title" required>
            <Input placeholder="My awesome plugin" />
          </Form.Item>
          <Form.Item label="Repository URL" name="repository_url">
            <Input placeholder="https://github.com/..." />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Request Mentorship Modal */}
      <Modal
        title="Request Mentorship"
        open={mentorshipModal}
        onCancel={() => setMentorshipModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateMentorship}>
          <Form.Item label="Mentor ID" name="mentor_id" required>
            <Input placeholder="User ID of mentor" />
          </Form.Item>
          <Form.Item label="Mentee ID" name="mentee_id" required>
            <Input placeholder="Your user ID" />
          </Form.Item>
          <Form.Item label="Skill Area" name="skill_area" required>
            <Select options={[
              { value: 'pipeline', label: 'CI/CD Pipeline' },
              { value: 'testing', label: 'Testing Strategy' },
              { value: 'architecture', label: 'System Architecture' },
              { value: 'devops', label: 'DevOps Practices' },
              { value: 'security', label: 'Security' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CommunityAdvancedPage;
