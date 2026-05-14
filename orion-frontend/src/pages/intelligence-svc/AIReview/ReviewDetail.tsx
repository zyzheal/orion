/**
 * AI Review - Review Detail
 * Detailed view of a single AI review result
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Descriptions,
  Tag,
  Spin,
  Space,
  Button,
  Alert,
  Row,
  Col,
  Statistic,
  Table,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { getReviewDetail } from '@/api/ai-review';
import type { AIReviewResult } from '@/api/ai-review';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { colors } from '@/tokens';

const { Title } = Typography;

const AIReviewDetail: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reviewId = searchParams.get('id') || '';

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<AIReviewResult | null>(null);

  const loadDetail = async () => {
    if (!reviewId) {
      message.warning('缺少评审 ID 参数');
      return;
    }
    setLoading(true);
    try {
      const res = await getReviewDetail(reviewId);
      setDetail(res.data.data || null);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载评审详情失败：${error.message}`);
      } else {
        message.error('加载评审详情失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [reviewId]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!detail) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="未找到评审记录"
          description="请检查评审 ID 是否正确"
          type="error"
          action={<Button onClick={() => navigate('/ai-review/history')}>返回历史</Button>}
        />
      </div>
    );
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'running':
        return 'blue';
      case 'failed':
        return 'red';
      default:
        return 'default';
    }
  };

  const statusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'running':
        return '运行中';
      case 'failed':
        return '失败';
      case 'pending':
        return '等待中';
      default:
        return status;
    }
  };

  const issueColumns = [
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      render: (s: string) => (
        <Tag color={s === 'critical' ? 'red' : s === 'warning' ? 'orange' : 'blue'}>{s}</Tag>
      ),
    },
    { title: '文件', dataIndex: 'file', key: 'file', ellipsis: true },
    { title: '行号', dataIndex: 'line', key: 'line', width: 80 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '建议', dataIndex: 'suggestion', key: 'suggestion', ellipsis: true },
  ];

  // Simulated issues based on counts
  const mockIssues = Array.from({ length: Math.min(detail.totalIssues, 20) }, (_, i) => ({
    key: `issue-${i}`,
    severity:
      i < detail.criticalCount
        ? 'critical'
        : i < detail.criticalCount + detail.warningCount
          ? 'warning'
          : 'info',
    file: `src/components/${['Button', 'Table', 'Form', 'Modal'][i % 4]}.tsx`,
    line: Math.floor(Math.random() * 200) + 1,
    description: `Issue #${i + 1}: 代码规范问题`,
    suggestion: '建议修复...',
  }));

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ai-review/history')}>
          返回
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          评审详情
        </Title>
        <Button icon={<ReloadOutlined />} onClick={loadDetail}>
          刷新
        </Button>
      </div>

      {/* Status Alert */}
      <Alert
        message={
          <Space>
            评审状态: <Tag color={statusColor(detail.status)}>{statusText(detail.status)}</Tag>
          </Space>
        }
        type={
          detail.status === 'completed' ? 'success' : detail.status === 'failed' ? 'error' : 'info'
        }
        style={{ marginBottom: 24 }}
      />

      {/* Basic Info */}
      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered>
          <Descriptions.Item label="评审 ID">{detail.id}</Descriptions.Item>
          <Descriptions.Item label="PR ID">{detail.prId}</Descriptions.Item>
          <Descriptions.Item label="仓库 ID">{detail.repoId}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(detail.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="完成时间">
            {detail.completedAt ? dayjs(detail.completedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="通过率">
            <Tag color={detail.passRate > 0.8 ? 'green' : detail.passRate > 0.5 ? 'orange' : 'red'}>
              {(detail.passRate * 100).toFixed(1)}%
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Issue Statistics */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总问题数"
              value={detail.totalIssues}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="严重问题"
              value={detail.criticalCount}
              valueStyle={{ color: colors.error[500] }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="警告"
              value={detail.warningCount}
              valueStyle={{ color: colors.warning[500] }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="提示"
              value={detail.infoCount}
              valueStyle={{ color: colors.primary[500] }}
              prefix={<InfoCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Issue List */}
      <Card title={`问题列表 (${detail.totalIssues})`}>
        <Table
          columns={issueColumns}
          dataSource={mockIssues}
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Card>
    </div>
  );
};

export default AIReviewDetail;
