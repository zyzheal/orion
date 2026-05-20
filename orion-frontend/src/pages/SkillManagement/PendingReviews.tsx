/**
 * Pending Reviews Page - Admin/Reviewer skill review workflow
 *
 * Features:
 * - Table of skills pending review
 * - Approve/Reject actions with confirmation modals
 * - Stats cards (pending count, approved count, etc.)
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Modal,
  Form,
  Input,
  message,
  Row,
  Col,
  Statistic,
  Select,
} from 'antd';
import {
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import {
  getPendingReviews,
  approveSkill,
  rejectSkill,
  archiveSkill,
  type SkillPackage,
} from '@/api/skills';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { TextArea } = Input;

const categoryOptions = [
  { label: '全部', value: 'all' },
  { label: 'CI/CD', value: 'ci-cd' },
  { label: '数据库', value: 'database' },
  { label: '监控', value: 'monitoring' },
  { label: '安全', value: 'security' },
  { label: 'AI/ML', value: 'ai-ml' },
  { label: '基础设施', value: 'infrastructure' },
];

const PendingReviews: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reviews, setReviews] = useState<SkillPackage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Review modal state
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'archive'>('approve');
  const [reviewingSkill, setReviewingSkill] = useState<SkillPackage | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [reviewForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const params: { page: number; limit: number; category?: string } = {
        page,
        limit: 20,
      };
      if (categoryFilter !== 'all') {
        params.category = categoryFilter;
      }
      const res = await getPendingReviews(params);
      const data = res.data.data;
      setReviews(Array.isArray(data.items) ? data.items : []);
      setTotal(data.total || 0);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载失败：${error.message}`);
      } else {
        message.error('加载失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, categoryFilter]);

  const handleOpenReview = (
    skill: SkillPackage,
    action: 'approve' | 'reject' | 'archive'
  ) => {
    setReviewingSkill(skill);
    setReviewAction(action);
    setReviewReason('');
    reviewForm.resetFields();
    setReviewModalVisible(true);
  };

  const handleReviewSubmit = async () => {
    if (!reviewingSkill) return;
    setActionLoading(`${reviewAction}-${reviewingSkill.id}`);
    try {
      switch (reviewAction) {
        case 'approve':
          await approveSkill(reviewingSkill.id, reviewReason || undefined);
          message.success(`技能 "${reviewingSkill.name}" 已通过审核`);
          break;
        case 'reject':
          if (!reviewReason) {
            message.warning('请填写拒绝原因');
            return;
          }
          await rejectSkill(reviewingSkill.id, reviewReason);
          message.success(`技能 "${reviewingSkill.name}" 已拒绝`);
          break;
        case 'archive':
          await archiveSkill(reviewingSkill.id, reviewReason || undefined);
          message.success(`技能 "${reviewingSkill.name}" 已归档`);
          break;
      }
      setReviewModalVisible(false);
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredReviews = useMemo(() => {
    return reviews;
  }, [reviews]);

  const modalTitle =
    reviewAction === 'approve'
      ? '通过审核'
      : reviewAction === 'reject'
        ? '拒绝技能'
        : '归档技能';

  const columns: TableColumn<SkillPackage>[] = [
    {
      key: 'name',
      title: '技能名称',
      dataIndex: 'name',
      width: 200,
      sortable: true,
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 100,
      render: (v: unknown) => <Tag>v{String(v)}</Tag>,
    },
    {
      key: 'category',
      title: '分类',
      dataIndex: 'category',
      width: 120,
      render: (v: unknown) => <Tag color="blue">{String(v)}</Tag>,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: unknown) => <StatusBadge status={v as any} size="small" />,
    },
    {
      key: 'author',
      title: '提交人',
      dataIndex: 'author',
      width: 120,
      render: (v: unknown) => <Text code>{String(v)}</Text>,
    },
    {
      key: 'description',
      title: '描述',
      dataIndex: 'description',
      width: 240,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[2] }}>
          {String(v).slice(0, 80)}{String(v).length > 80 ? '...' : ''}
        </Text>
      ),
    },
    {
      key: 'createdAt',
      title: '提交时间',
      dataIndex: 'createdAt',
      width: 160,
      sortable: true,
      render: (v: unknown) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: spacing[3] }}>
            {dayjs(String(v)).format('MM-DD HH:mm')}
          </Text>
          <Text type="secondary" style={{ fontSize: spacing[2] }}>
            {dayjs(String(v)).fromNow()}
          </Text>
        </Space>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 240,
      render: (_: unknown, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/skills/${record.id}/instances`)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            style={{ color: '#52c41a' }}
            icon={<CheckOutlined />}
            onClick={() => handleOpenReview(record, 'approve')}
            loading={actionLoading === `approve-${record.id}`}
          >
            通过
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<CloseOutlined />}
            onClick={() => handleOpenReview(record, 'reject')}
            loading={actionLoading === `reject-${record.id}`}
          >
            拒绝
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => handleOpenReview(record, 'archive')}
            loading={actionLoading === `archive-${record.id}`}
          >
            归档
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            待审核技能
          </Title>
          <Text type="secondary">管理员审核提交的技能包，确保质量和合规性</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="待审核"
              value={total}
              suffix="个"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="CI/CD"
              value={reviews.filter((r) => r.category === 'ci-cd').length}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="AI/ML"
              value={reviews.filter((r) => r.category === 'ai-ml').length}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="当前页"
              value={reviews.length}
              suffix="个"
            />
          </Card>
        </Col>
      </Row>

      {/* Filter */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <span>分类筛选：</span>
          <Select
            style={{ width: 160 }}
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categoryOptions}
          />
        </Space>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredReviews}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
          pagination={{
            current: page,
            pageSize: 20,
            total,
          }}
          onPaginationChange={(p) => setPage(p)}
        />
      </Card>

      {/* Review Modal */}
      <Modal
        title={modalTitle}
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        onOk={handleReviewSubmit}
        okText={
          reviewAction === 'approve'
            ? '通过'
            : reviewAction === 'reject'
              ? '拒绝'
              : '归档'
        }
        okButtonProps={{
          danger: reviewAction === 'reject',
          loading: !!actionLoading,
        }}
        width={500}
      >
        {reviewingSkill && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>技能：</Text>
              <Text>{reviewingSkill.name}</Text>
              <Tag style={{ marginLeft: 8 }}>v{reviewingSkill.version}</Tag>
            </div>

            <Form form={reviewForm} layout="vertical">
              <Form.Item
                label={
                  reviewAction === 'approve'
                    ? '审核意见（可选）'
                    : reviewAction === 'reject'
                      ? '拒绝原因（必填）'
                      : '归档原因（可选）'
                }
                name="reason"
                rules={
                  reviewAction === 'reject'
                    ? [{ required: true, message: '请填写拒绝原因' }]
                    : []
                }
              >
                <TextArea
                  rows={4}
                  placeholder={
                    reviewAction === 'approve'
                      ? '输入审核意见...'
                      : reviewAction === 'reject'
                        ? '请说明拒绝的原因...'
                        : '输入归档原因...'
                  }
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PendingReviews;
