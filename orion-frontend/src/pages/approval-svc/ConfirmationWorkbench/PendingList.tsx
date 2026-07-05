/**
 * Pending Confirmations - Priority color coding, filter, approve/reject actions
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Modal,
  Form,
  Input,
  message,
  Progress,
} from 'antd';
import { colors, spacing } from '@/tokens';
import {
  ReloadOutlined,
  ClockCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge, { type StatusType } from '@/components/StatusBadge';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getConfirmations,
  approveConfirmation,
  rejectConfirmation,
  type ConfirmationRequest,
} from '@/api/confirmations';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const priorityColorMap: Record<string, string> = {
  P0: colors.error[400],
  P1: colors.warning[500],
  P2: colors.warning[500],
  P3: colors.success[500],
};

const sceneTypeOptions = [
  { label: '全部', value: 'all' },
  { label: '部署变更', value: 'deployment' },
  { label: '配置修改', value: 'config' },
  { label: '数据库操作', value: 'database' },
  { label: '权限变更', value: 'permission' },
];

const PendingList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [confirmations, setConfirmations] = useState<ConfirmationRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedConfirmation, setSelectedConfirmation] = useState<ConfirmationRequest | null>(
    null
  );
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comment, setComment] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getConfirmations();
      setConfirmations(Array.isArray(res.data) ? res.data : []);
    } catch {
      message.error('Failed to load confirmations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredConfirmations = useMemo(() => {
    return confirmations.filter((c) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!c.id.toLowerCase().includes(q) && !c.sceneType.toLowerCase().includes(q)) return false;
      }
      if (filters.priority && filters.priority !== 'all' && c.priority !== filters.priority)
        return false;
      if (filters.status && filters.status !== 'all' && c.status !== filters.status) return false;
      if (filters.sceneType && filters.sceneType !== 'all' && c.sceneType !== filters.sceneType)
        return false;
      return true;
    });
  }, [searchQuery, filters, confirmations]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setProcessingId(id);
    try {
      if (action === 'approve') {
        await approveConfirmation(id, { comment });
        message.success('已确认');
      } else {
        await rejectConfirmation(id, { comment });
        message.success('已拒绝');
      }
      setCommentModalVisible(false);
      setComment('');
      loadData();
    } catch {
      message.error('操作失败');
    } finally {
      setProcessingId(null);
    }
  };

  const openCommentModal = (confirmation: ConfirmationRequest, type: 'approve' | 'reject') => {
    setSelectedConfirmation(confirmation);
    setActionType(type);
    setComment('');
    setCommentModalVisible(true);
  };

  const pendingCount = confirmations.filter((c) => c.status === 'pending').length;
  const p0Count = confirmations.filter((c) => c.status === 'pending' && c.priority === 'P0').length;
  const p1Count = confirmations.filter((c) => c.status === 'pending' && c.priority === 'P1').length;

  const columns: TableColumn<ConfirmationRequest>[] = [
    {
      key: 'priority',
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      sortable: true,
      render: (v: unknown) => (
        <Tag color={priorityColorMap[String(v)] || 'default'} style={{ fontWeight: 'bold' }}>
          {String(v)}
        </Tag>
      ),
    },
    {
      key: 'sceneType',
      title: '场景',
      dataIndex: 'sceneType',
      width: 120,
      render: (v: unknown) => <Tag color="blue">{String(v)}</Tag>,
    },
    {
      key: 'id',
      title: '确认 ID',
      dataIndex: 'id',
      width: 180,
      sortable: true,
      render: (v: unknown) => (
        <Text code style={{ fontSize: spacing[3] }}>
          {String(v).slice(0, 16)}...
        </Text>
      ),
    },
    {
      key: 'aiSuggestion',
      title: 'AI 建议',
      dataIndex: 'aiSuggestion',
      width: 200,
      render: (v: unknown) => <Text style={{ fontSize: spacing[3] }}>{String(v)}</Text>,
    },
    {
      key: 'aiConfidence',
      title: 'AI 置信度',
      dataIndex: 'aiConfidence',
      width: 120,
      render: (v: unknown) => (
        <Progress
          percent={Number(v)}
          size="small"
          strokeColor={
            Number(v) >= 80
              ? colors.success[500]
              : Number(v) >= 60
                ? colors.warning[500]
                : colors.error[400]
          }
          format={() => `${Number(v)}%`}
        />
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: unknown) => <StatusBadge status={String(v) as StatusType} size="small" />,
    },
    {
      key: 'pushTime',
      title: '推送时间',
      dataIndex: 'pushTime',
      width: 160,
      sortable: true,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(v)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 180,
      render: (_: unknown, record: any) =>
        record.status === 'pending' ? (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              style={{ color: colors.success[500] }}
              onClick={() => openCommentModal(record, 'approve')}
            >
              确认
            </Button>
            <Button
              type="link"
              size="small"
              icon={<CloseOutlined />}
              danger
              onClick={() => openCommentModal(record, 'reject')}
            >
              拒绝
            </Button>
            <Button
              type="link"
              size="small"
              icon={<InfoCircleOutlined />}
              onClick={() => {
                setSelectedConfirmation(record);
                setDetailModalVisible(true);
              }}
            >
              详情
            </Button>
          </Space>
        ) : (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<InfoCircleOutlined />}
              onClick={() => {
                setSelectedConfirmation(record);
                setDetailModalVisible(true);
              }}
            >
              详情
            </Button>
          </Space>
        ),
    },
  ];

  const filterDefs: FilterDefinition[] = [
    {
      key: 'priority',
      label: '优先级',
      options: [
        { label: '全部', value: 'all' },
        { label: 'P0', value: 'P0' },
        { label: 'P1', value: 'P1' },
        { label: 'P2', value: 'P2' },
        { label: 'P3', value: 'P3' },
      ],
    },
    { key: 'sceneType', label: '场景', options: sceneTypeOptions },
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: 'Pending', value: 'pending' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Expired', value: 'expired' },
      ],
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <ClockCircleOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            确认工作台
          </Title>
          <Text type="secondary">待确认的 AI 操作建议</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="待确认"
              value={pendingCount}
              valueStyle={{ color: colors.primary[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="P0 紧急"
              value={p0Count}
              valueStyle={{ color: priorityColorMap.P0 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="P1 高" value={p1Count} valueStyle={{ color: priorityColorMap.P1 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总计" value={confirmations.length} />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: spacing.md }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={filterDefs}
            searchPlaceholder="搜索确认请求..."
          />
        </div>
        <Table
          columns={columns}
          dataSource={filteredConfirmations}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="确认详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={<Button onClick={() => setDetailModalVisible(false)}>关闭</Button>}
      >
        {selectedConfirmation && (
          <div>
            <Space style={{ marginBottom: spacing.md }}>
              <Tag color={priorityColorMap[selectedConfirmation.priority]}>
                {selectedConfirmation.priority}
              </Tag>
              <StatusBadge status={selectedConfirmation.status as StatusType} />
            </Space>
            <p>
              <Text strong>AI 建议:</Text> {selectedConfirmation.aiSuggestion}
            </p>
            <p>
              <Text strong>置信度:</Text> {selectedConfirmation.aiConfidence}%
            </p>
            <p>
              <Text strong>推送时间:</Text>{' '}
              {dayjs(selectedConfirmation.pushTime).format('YYYY-MM-DD HH:mm:ss')}
            </p>
            {selectedConfirmation.responseTime && (
              <p>
                <Text strong>响应时间:</Text>{' '}
                {dayjs(selectedConfirmation.responseTime).format('YYYY-MM-DD HH:mm:ss')}
              </p>
            )}
            {selectedConfirmation.comment && (
              <p>
                <Text strong>备注:</Text> {selectedConfirmation.comment}
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Comment Modal */}
      <Modal
        title={actionType === 'approve' ? '确认操作' : '拒绝操作'}
        open={commentModalVisible}
        onCancel={() => setCommentModalVisible(false)}
        onOk={() => selectedConfirmation && handleAction(selectedConfirmation.id, actionType)}
        okText={actionType === 'approve' ? '确认' : '拒绝'}
        okButtonProps={{ danger: actionType === 'reject' }}
        confirmLoading={processingId !== null}
      >
        <p>
          <Text strong>确认 ID:</Text> {selectedConfirmation?.id}
        </p>
        <p>
          <Text strong>AI 建议:</Text> {selectedConfirmation?.aiSuggestion}
        </p>
        <Form layout="vertical">
          <Form.Item label="备注">
            <Input.TextArea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="输入备注..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PendingList;
