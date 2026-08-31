/**
 * AI Review - Review Detail
 * Detailed view of a single AI review result
 */
import React, { useEffect } from 'react';
import { useQuery } from '@/providers/QueryProvider';
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
  Empty,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { getReviewDetail, getReviewComments } from '@/api/ai-review';
import type { AIReviewResult } from '@/api/ai-review';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';

const { Title } = Typography;

const AIReviewDetail: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reviewId = searchParams.get('id') || '';

  const { data, isLoading: loading, isError, error, refetch } = useQuery<{ detail: AIReviewResult | null; issues: AIReviewResult['comments'] }>({
    queryKey: ['ai-review-detail', reviewId],
    queryFn: async () => {
      const res = await getReviewDetail(reviewId);
      const detail = (res.data || null) as unknown as AIReviewResult | null;
      let issues: AIReviewResult['comments'] = [];
      try {
        const commentsRes = await getReviewComments(reviewId);
        issues = (commentsRes.data || []) as unknown as AIReviewResult['comments'];
      } catch { /* backward compatible */ }
      return { detail, issues };
    },
    enabled: !!reviewId,
    staleTime: 30_000,
  });

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  // 缺少评审 ID 参数提示（迁移前由 loadDetail 内的守卫给出）
  useEffect(() => {
    if (!reviewId) {
      message.warning('缺少评审 ID 参数');
    }
  }, [reviewId]);

  useEffect(() => {
    if (isError) {
      message.error(
        error instanceof Error ? `加载评审详情失败：${error.message}` : '加载评审详情失败，请稍后重试'
      );
    }
  }, [isError, error]);

  const loadDetail = () => refetch();
  const detail = data?.detail ?? null;
  const issues = data?.issues ?? [];

  if (loading) {
    return (
      <div style={{ padding: spacing.lg, textAlign: 'center' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!detail) {
    return (
      <div style={{ padding: spacing.lg }}>
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
    { title: '文件', dataIndex: 'filePath', key: 'file', ellipsis: true },
    { title: '行号', dataIndex: 'lineNumber', key: 'line', width: 80 },
    { title: '描述', dataIndex: 'message', key: 'description', ellipsis: true },
    { title: '建议', dataIndex: 'suggestion', key: 'suggestion', ellipsis: true },
  ];

  // Real issues loaded from backend API (via getReviewComments)

  return (
    <div style={{ padding: spacing.lg }}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}
      >
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ai-review/history')}>
          返回
        </Button>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <FileTextOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
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
        style={{ marginBottom: spacing.lg }}
      />

      {/* Basic Info */}
      <Card title="基本信息" style={{ marginBottom: spacing.md }}>
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
      <Row gutter={16} style={{ marginBottom: spacing.md }}>
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
          loading={loading}
          columns={issueColumns}
          dataSource={issues}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="small"
          locale={{
            emptyText: <Empty description="暂无问题详情" />,
          }}
        />
      </Card>
    </div>
  );
};

export default AIReviewDetail;
