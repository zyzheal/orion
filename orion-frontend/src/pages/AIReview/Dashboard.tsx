/**
 * AI Review - Dashboard
 * Overview of recent reviews, issue statistics, and quick actions
 */
import React, { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Table, Tag, Space, Button, Statistic, Progress, Modal, Form, Input, Select, message } from 'antd';
import {
  ReloadOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { getReviewHistory, triggerReview, reviewDiff } from '@/api/ai-review';
import type { AIReviewResult } from '@/api/ai-review';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { colors } from '@/tokens';

const { Title, Text } = Typography;

const AIReviewDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [recentReviews, setRecentReviews] = useState<AIReviewResult[]>([]);
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [triggerForm] = Form.useForm();
  const [triggerLoading, setTriggerLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getReviewHistory({ pageSize: 10 });
      setRecentReviews(res.data.data?.items || []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载评审历史失败：${error.message}`);
      } else {
        message.error('加载评审历史失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTriggerReview = async (values: { prId: string; repoId: string; mode: string }) => {
    setTriggerLoading(true);
    try {
      if (values.mode === 'diff') {
        await reviewDiff({ prId: values.prId, repoId: values.repoId });
      } else {
        await triggerReview({ prId: values.prId, repoId: values.repoId });
      }
      message.success('评审已触发');
      setTriggerModalOpen(false);
      triggerForm.resetFields();
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`触发评审失败：${error.message}`);
      } else {
        message.error('触发评审失败，请稍后重试');
      }
    } finally {
      setTriggerLoading(false);
    }
  };

  const totalIssues = recentReviews.reduce((sum, r) => sum + r.totalIssues, 0);
  const totalCritical = recentReviews.reduce((sum, r) => sum + r.criticalCount, 0);
  const avgPassRate = recentReviews.length > 0
    ? recentReviews.reduce((sum, r) => sum + r.passRate, 0) / recentReviews.length
    : 0;

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'running': return 'blue';
      case 'failed': return 'red';
      default: return 'default';
    }
  };

  const statusText = (status: string) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'running': return '运行中';
      case 'failed': return '失败';
      case 'pending': return '等待中';
      default: return status;
    }
  };

  const columns = [
    {
      title: 'PR ID',
      dataIndex: 'prId',
      key: 'prId',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={statusColor(status)}>{statusText(status)}</Tag>,
    },
    {
      title: '严重问题',
      dataIndex: 'criticalCount',
      key: 'criticalCount',
      render: (count: number) => count > 0 ? <Tag color="red">{count}</Tag> : <Tag color="default">{count}</Tag>,
    },
    {
      title: '警告',
      dataIndex: 'warningCount',
      key: 'warningCount',
      render: (count: number) => count > 0 ? <Tag color="orange">{count}</Tag> : <Tag color="default">{count}</Tag>,
    },
    {
      title: '通过率',
      dataIndex: 'passRate',
      key: 'passRate',
      render: (rate: number) => (
        <Progress
          percent={Math.round(rate * 100)}
          strokeColor={rate > 0.8 ? colors.success[500] : rate > 0.5 ? colors.warning[500] : colors.error[500]}
          size="small"
        />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (ts: string) => dayjs(ts).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: AIReviewResult) => (
        <Button type="link" size="small" onClick={() => navigate(`/ai-review/detail?id=${record.id}`)}>
          详情
        </Button>
      ),
    },
  ];

  const tableData = recentReviews.map((r) => ({ ...r, key: r.id }));

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>AI Review Dashboard</Title>
          <Text type="secondary">AI 代码评审概览与快速操作</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => setTriggerModalOpen(true)}>
            触发评审
          </Button>
        </Space>
      </div>

      {/* Summary Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="评审总数" value={recentReviews.length} prefix={<SwapOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总问题数" value={totalIssues} valueStyle={{ color: colors.error[500] }} prefix={<CloseCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="严重问题" value={totalCritical} valueStyle={{ color: colors.warning[500] }} prefix={<WarningOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="平均通过率" value={Math.round(avgPassRate * 100)} suffix="%" valueStyle={{ color: colors.success[500] }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      {/* Recent Reviews */}
      <Card title="最近评审记录">
        <Table
          columns={columns}
          dataSource={tableData}
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Card>

      {/* Trigger Review Modal */}
      <Modal
        title="触发 AI 评审"
        open={triggerModalOpen}
        onCancel={() => setTriggerModalOpen(false)}
        footer={null}
      >
        <Form form={triggerForm} layout="vertical" onFinish={handleTriggerReview}>
          <Form.Item name="prId" label="PR ID" rules={[{ required: true, message: '请输入 PR ID' }]}>
            <Input placeholder="例如：PR-1234" />
          </Form.Item>
          <Form.Item name="repoId" label="仓库 ID" rules={[{ required: true, message: '请输入仓库 ID' }]}>
            <Input placeholder="例如：my-org/my-repo" />
          </Form.Item>
          <Form.Item name="mode" label="评审模式" initialValue="review">
            <Select>
              <Select.Option value="review">完整评审</Select.Option>
              <Select.Option value="diff">Diff 评审</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={triggerLoading} block>
              触发评审
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AIReviewDashboard;
