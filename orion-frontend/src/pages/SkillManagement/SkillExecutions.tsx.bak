/**
 * Skill Execution History Page
 * Table showing execution history with filters and detail view.
 *
 * Features:
 * - Filter by status, capability, date range
 * - Show duration, status badge, input/output summary
 * - Click to view execution details
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Modal,
  message,
  Row,
  Col,
  Statistic,
  DatePicker,
  Select,
  Descriptions,
} from 'antd';
import { ReloadOutlined, ArrowLeftOutlined, PlayCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { spacing, colors } from '@/tokens';
import Table, { type TableColumn } from '@/components/Table';
import {
  getSkillExecutions,
  executeSkill,
  getSkill,
  type SkillExecution,
  type SkillPackage,
} from '@/api/skills';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// Status color mapping for executions
const executionStatusColors: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  success: 'success',
  failed: 'error',
  timeout: 'warning',
};

const SkillExecutions: React.FC = () => {
  const { id: skillId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [executions, setExecutions] = useState<SkillExecution[]>([]);
  const [skill, setSkill] = useState<SkillPackage | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<SkillExecution | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [capabilityFilter, setCapabilityFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const loadData = async () => {
    if (!skillId) return;
    setLoading(true);
    try {
      const [execRes, skillRes] = await Promise.all([
        getSkillExecutions(skillId, { page, limit: 20 }),
        getSkill(skillId),
      ]);
      const execData = execRes.data.data;
      const items = execData.executions || [];
      setExecutions(Array.isArray(items) ? items : []);
      setTotal(execData.total || 0);
      const skillData = (skillRes as any).data?.data;
      setSkill(skillData || null);
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
  }, [skillId, page]);

  const handleExecute = () => {
    if (!skillId) return;
    Modal.confirm({
      title: '确认执行',
      content: `确定要立即执行技能 "${skill?.name}" 吗？`,
      okText: '执行',
      onOk: async () => {
        try {
          await executeSkill(skillId, { input: {}, sync: false });
          message.success('技能已触发执行');
          loadData();
        } catch (error: unknown) {
          message.error(error instanceof Error ? error.message : '执行失败');
        }
      },
    });
  };

  // Apply client-side filters on top of loaded data
  const filteredExecutions = useMemo(() => {
    return executions.filter((exec) => {
      if (statusFilter !== 'all' && exec.status !== statusFilter) return false;
      if (capabilityFilter !== 'all' && exec.capability !== capabilityFilter) return false;
      if (dateRange && dateRange[0] && dateRange[1]) {
        const execDate = dayjs(exec.createdAt);
        if (
          execDate.isBefore(dateRange[0]) ||
          execDate.isAfter(dateRange[1].endOf('day'))
        ) {
          return false;
        }
      }
      return true;
    });
  }, [executions, statusFilter, capabilityFilter, dateRange]);

  const formatDuration = (ms?: number): string => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const columns: TableColumn<SkillExecution>[] = [
    {
      key: 'id',
      title: '执行ID',
      dataIndex: 'id',
      width: 120,
      render: (v: unknown) => (
        <Text code style={{ fontSize: spacing[2] }}>
          {String(v).slice(0, 8)}...
        </Text>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: unknown) => (
        <Tag color={executionStatusColors[String(v)] || 'default'}>
          {String(v)}
        </Tag>
      ),
    },
    {
      key: 'capability',
      title: '能力',
      dataIndex: 'capability',
      width: 140,
      render: (v: unknown) =>
        v ? <Tag color="blue">{String(v)}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      key: 'instanceId',
      title: '实例',
      dataIndex: 'instanceId',
      width: 120,
      render: (v: unknown) =>
        v ? (
          <Text code style={{ fontSize: spacing[2] }}>{String(v).slice(0, 8)}</Text>
        ) : (
          <Text type="secondary">直接执行</Text>
        ),
    },
    {
      key: 'duration',
      title: '耗时',
      dataIndex: 'duration',
      width: 100,
      sortable: true,
      render: (v: unknown) => <Text>{formatDuration(v as number)}</Text>,
    },
    {
      key: 'userId',
      title: '执行人',
      dataIndex: 'userId',
      width: 120,
      render: (v: unknown) =>
        v ? <Text code>{String(v)}</Text> : <Text type="secondary">系统</Text>,
    },
    {
      key: 'input',
      title: '输入摘要',
      dataIndex: 'input',
      width: 200,
      render: (v: unknown) => {
        const input = v as Record<string, unknown>;
        const keys = input ? Object.keys(input) : [];
        return keys.length > 0 ? (
          <Text type="secondary" style={{ fontSize: spacing[2] }}>
            {keys.slice(0, 3).join(', ')}{keys.length > 3 ? '...' : ''}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        );
      },
    },
    {
      key: 'createdAt',
      title: '执行时间',
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
      width: 80,
      render: (_: unknown, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => {
            setSelectedExecution(record);
            setDetailModalVisible(true);
          }}
        >
          详情
        </Button>
      ),
    },
  ];

  // Extract unique capabilities for filter
  const capabilities = useMemo(() => {
    const caps = new Set<string>();
    executions.forEach((e) => {
      if (e.capability) caps.add(e.capability);
    });
    return Array.from(caps);
  }, [executions]);

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
          <Space style={{ marginBottom: 8 }}>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/skills/my')}
            >
              返回
            </Button>
          </Space>
          <Title level={2} style={{ marginBottom: 8 }}>
            <ThunderboltOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            执行历史 {skill && <Text type="secondary">- {skill.name}</Text>}
          </Title>
          <Text type="secondary">查看技能执行的详细记录和结果</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleExecute}>
            执行技能
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总执行次数" value={total} suffix="次" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功"
              value={executions.filter((e) => e.status === 'success').length}
              suffix="次"
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="失败"
              value={executions.filter((e) => e.status === 'failed').length}
              suffix="次"
              valueStyle={{ color: colors.error[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均耗时"
              value={
                executions.length > 0
                  ? Math.round(
                      executions.reduce((sum, e) => sum + (e.duration || 0), 0) /
                        executions.length
                    )
                  : 0
              }
              suffix="ms"
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Space size="middle" wrap>
          <span>状态筛选：</span>
          <Select
            style={{ width: 140 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: '全部', value: 'all' },
              { label: '等待中', value: 'pending' },
              { label: '运行中', value: 'running' },
              { label: '成功', value: 'success' },
              { label: '失败', value: 'failed' },
              { label: '超时', value: 'timeout' },
            ]}
          />
          <span style={{ marginLeft: 16 }}>能力筛选：</span>
          <Select
            style={{ width: 140 }}
            value={capabilityFilter}
            onChange={setCapabilityFilter}
            options={[
              { label: '全部', value: 'all' },
              ...capabilities.map((c) => ({ label: c, value: c })),
            ]}
          />
          <span style={{ marginLeft: 16 }}>日期范围：</span>
          <RangePicker
            value={dateRange}
            onChange={(dates) =>
              setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)
            }
          />
        </Space>
      </Card>

      {/* Execution Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredExecutions}
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

      {/* Execution Detail Modal */}
      <Modal
        title="执行详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={
          <Button onClick={() => setDetailModalVisible(false)}>关闭</Button>
        }
        width={700}
      >
        {selectedExecution && (
          <div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="执行ID" span={2}>
                <Text code>{selectedExecution.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={executionStatusColors[selectedExecution.status] || 'default'}>
                  {selectedExecution.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="耗时">
                {formatDuration(selectedExecution.duration)}
              </Descriptions.Item>
              <Descriptions.Item label="能力">
                {selectedExecution.capability || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="执行人">
                {selectedExecution.userId || '系统'}
              </Descriptions.Item>
              <Descriptions.Item label="实例ID">
                {selectedExecution.instanceId || '直接执行'}
              </Descriptions.Item>
              <Descriptions.Item label="项目">
                {selectedExecution.projectId || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="开始时间" span={2}>
                {dayjs(selectedExecution.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              {selectedExecution.completedAt && (
                <Descriptions.Item label="完成时间" span={2}>
                  {dayjs(selectedExecution.completedAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
            </Descriptions>

            {selectedExecution.errorMessage && (
              <Card style={{ marginTop: 16 }} title="错误信息" size="small">
                <Text type="danger" style={{ whiteSpace: 'pre-wrap' }}>
                  {selectedExecution.errorMessage}
                </Text>
              </Card>
            )}

            <Card style={{ marginTop: 16 }} title="输入参数" size="small">
              <pre style={{ fontSize: 12, background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                {JSON.stringify(selectedExecution.input, null, 2)}
              </pre>
            </Card>

            <Card style={{ marginTop: 16 }} title="输出结果" size="small">
              <pre style={{ fontSize: 12, background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                {JSON.stringify(selectedExecution.output, null, 2)}
              </pre>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SkillExecutions;
