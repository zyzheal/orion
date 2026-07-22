/**
 * Sprint Board Page
 *
 * Features:
 * - Sprint list with status tabs (planning/active/completed)
 * - Create/Edit sprint modal (name, goal, startDate, endDate, capacity)
 * - Sprint board view with kanban columns (grouped by ticket status)
 * - Burndown chart placeholder (using Ant Design Progress)
 * - Backlog view showing unassigned tickets
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  message,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Row,
  Col,
  Tabs,
  Empty,
  Progress,
  Popconfirm,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  CalendarOutlined,
  ProjectOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import {
  listSprints,
  createSprint,
  updateSprint,
  deleteSprint,
  getSprintBoard,
  addTicketToSprint,
  removeTicketFromSprint,
  getBacklog,
  getBurndownData,
  type Sprint,
  type SprintBoard as SprintBoardType,
  type BurndownData,
  type CreateSprintInput,
} from '@/api/sprints';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const sprintStatusColor: Record<string, string> = {
  planning: 'default',
  active: 'processing',
  completed: 'success',
  cancelled: 'error',
};

const sprintStatusLabel: Record<string, string> = {
  planning: '规划中',
  active: '进行中',
  completed: '已完成',
  cancelled: '已取消',
};

const priorityColor: Record<string, string> = {
  critical: colors.error[500],
  high: colors.warning[500],
  medium: colors.primary[500],
  low: colors.neutral[400],
};

const priorityLabel: Record<string, string> = {
  critical: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

/** Kanban column status labels */
const kanbanColumnLabels: Record<string, string> = {
  open: '待处理',
  in_progress: '进行中',
  in_review: '评审中',
  done: '已完成',
  closed: '已关闭',
};

export default function SprintBoardPage() {
  const [activeTab, setActiveTab] = useState('list');
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [form] = Form.useForm();

  // Kanban state
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [boardData, setBoardData] = useState<SprintBoardType | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);

  // Backlog state
  const [backlog, setBacklog] = useState<
    { ticketId: string; title: string; priority: string; storyPoints: number | null }[]
  >([]);
  const [backlogLoading, setBacklogLoading] = useState(false);

  // Burndown state
  const [burndownData, setBurndownData] = useState<BurndownData[]>([]);
  const [burndownLoading, setBurndownLoading] = useState(false);

  // Active sprint filter for list tab
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  // ── Data fetching ──────────────────────────────────────────────

  const fetchSprints = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSprints(statusFilter ? { status: statusFilter } : undefined);
      setSprints(res.data ?? []);
    } catch {
      message.error('获取 Sprint 列表失败');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchBoard = useCallback(async (sprintId: string) => {
    setBoardLoading(true);
    try {
      const res = await getSprintBoard(sprintId);
      setBoardData(res.data ?? null);
    } catch {
      message.error('获取看板数据失败');
    } finally {
      setBoardLoading(false);
    }
  }, []);

  const fetchBacklog = useCallback(async () => {
    setBacklogLoading(true);
    try {
      const res = await getBacklog();
      setBacklog(res.data ?? []);
    } catch {
      message.error('获取待办列表失败');
    } finally {
      setBacklogLoading(false);
    }
  }, []);

  const fetchBurndown = useCallback(async (sprintId: string) => {
    setBurndownLoading(true);
    try {
      const res = await getBurndownData(sprintId);
      setBurndownData(res.data ?? []);
    } catch {
      // Burndown data may not be available yet
      setBurndownData([]);
    } finally {
      setBurndownLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSprints();
  }, [fetchSprints]);

  useEffect(() => {
    if (selectedSprintId) {
      fetchBoard(selectedSprintId);
      fetchBurndown(selectedSprintId);
    }
  }, [selectedSprintId, fetchBoard, fetchBurndown]);

  useEffect(() => {
    if (activeTab === 'backlog') {
      fetchBacklog();
    }
  }, [activeTab, fetchBacklog]);

  // ── Sprint CRUD handlers ──────────────────────────────────────

  const handleCreate = () => {
    setEditingSprint(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Sprint) => {
    setEditingSprint(record);
    form.setFieldsValue({
      name: record.name,
      goal: record.goal,
      dateRange: [dayjs(record.startDate), dayjs(record.endDate)],
      capacity: record.capacity,
      status: record.status,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setConfirmLoading(true);
      const [start, end] = values.dateRange ?? [];
      const input: CreateSprintInput = {
        name: values.name,
        goal: values.goal,
        startDate: start?.format('YYYY-MM-DD') ?? '',
        endDate: end?.format('YYYY-MM-DD') ?? '',
        capacity: values.capacity,
      };
      if (editingSprint) {
        await updateSprint(editingSprint.id, {
          ...input,
          status: values.status,
        });
        message.success('Sprint 更新成功');
      } else {
        await createSprint(input);
        message.success('Sprint 创建成功');
      }
      setModalVisible(false);
      fetchSprints();
    } catch (err: any) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('保存失败');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSprint(id);
      message.success('Sprint 已删除');
      fetchSprints();
    } catch {
      message.error('删除失败');
    }
  };

  const handleActivate = async (record: Sprint) => {
    try {
      await updateSprint(record.id, { status: 'active' });
      message.success('Sprint 已启动');
      fetchSprints();
    } catch {
      message.error('启动失败');
    }
  };

  const handleComplete = async (record: Sprint) => {
    try {
      await updateSprint(record.id, { status: 'completed' });
      message.success('Sprint 已完成');
      fetchSprints();
    } catch {
      message.error('操作失败');
    }
  };

  // ── Board actions ──────────────────────────────────────────────

  const handleRemoveTicket = async (ticketId: string) => {
    if (!selectedSprintId) return;
    try {
      await removeTicketFromSprint(selectedSprintId, ticketId);
      message.success('已从 Sprint 移除');
      fetchBoard(selectedSprintId);
    } catch {
      message.error('移除失败');
    }
  };

  const handleAddToSprint = async (ticketId: string) => {
    if (!selectedSprintId) {
      message.warning('请先选择 Sprint');
      return;
    }
    try {
      await addTicketToSprint(selectedSprintId, ticketId);
      message.success('已添加到 Sprint');
      fetchBoard(selectedSprintId);
      fetchBacklog();
    } catch {
      message.error('添加失败');
    }
  };

  // ── Burndown calculation ───────────────────────────────────────

  const burndownPercent =
    burndownData.length > 0
      ? Math.round(
          (burndownData[burndownData.length - 1].remainingPoints /
            (burndownData[0].remainingPoints || 1)) *
            100
        )
      : 0;

  // ── Sprint list columns ────────────────────────────────────────

  const sprintColumns: ColumnsType<Sprint> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '目标',
      dataIndex: 'goal',
      key: 'goal',
      ellipsis: true,
      render: (text: string | null) => text || <Text type="secondary">-</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={sprintStatusColor[status]}>{sprintStatusLabel[status] ?? status}</Tag>
      ),
    },
    {
      title: '时间范围',
      key: 'dateRange',
      render: (_, record) => (
        <Space size={4}>
          <CalendarOutlined style={{ color: colors.neutral[400] }} />
          <Text type="secondary">
            {dayjs(record.startDate).format('MM/DD')} - {dayjs(record.endDate).format('MM/DD')}
          </Text>
        </Space>
      ),
    },
    {
      title: '容量',
      dataIndex: 'capacity',
      key: 'capacity',
      render: (cap: number | null) => (cap != null ? `${cap} 点` : <Text type="secondary">-</Text>),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_, record) => (
        <Space>
          {record.status === 'planning' && (
            <Button
              type="link"
              icon={<PlayCircleOutlined />}
              onClick={() => handleActivate(record)}
              style={{ color: colors.success[500] }}
            >
              启动
            </Button>
          )}
          {record.status === 'active' && (
            <Button
              type="link"
              icon={<PlayCircleOutlined />}
              onClick={() => handleComplete(record)}
              style={{ color: colors.warning[500] }}
            >
              完成
            </Button>
          )}
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除此 Sprint？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── Backlog columns ────────────────────────────────────────────

  const backlogColumns: ColumnsType<(typeof backlog)[number]> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (p: string) => <Tag color={priorityColor[p]}>{priorityLabel[p] ?? p}</Tag>,
    },
    {
      title: '故事点',
      dataIndex: 'storyPoints',
      key: 'storyPoints',
      width: 100,
      render: (sp: number | null) => (sp != null ? sp : <Text type="secondary">-</Text>),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          icon={<PlusOutlined />}
          onClick={() => handleAddToSprint(record.ticketId)}
          disabled={!selectedSprintId}
        >
          加入 Sprint
        </Button>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────

  /** Kanban board content */
  const renderKanbanBoard = () => {
    if (!selectedSprintId) {
      return (
        <Empty
          description="请先在下方列表中选择一个 Sprint"
          style={{ marginTop: spacing.xl * 2 }}
        />
      );
    }

    if (boardLoading) {
      return (
        <div style={{ textAlign: 'center', padding: spacing.xl * 2 }}>
          <Text type="secondary">加载中...</Text>
        </div>
      );
    }

    if (!boardData || !boardData.columns || Object.keys(boardData.columns).length === 0) {
      return <Empty description="看板数据为空" />;
    }

    const columnKeys = Object.keys(boardData.columns);

    return (
      <div
        style={{
          display: 'flex',
          gap: spacing.md,
          overflowX: 'auto',
          paddingBottom: spacing.md,
        }}
      >
        {columnKeys.map((colKey) => {
          const tickets = boardData.columns[colKey] ?? [];
          return (
            <div
              key={colKey}
              style={{
                minWidth: 280,
                flex: '0 0 280px',
                background: colors.light.bg.secondary,
                borderRadius: componentRadius.card,
                padding: spacing.md,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: spacing.sm,
                }}
              >
                <Text strong>{kanbanColumnLabels[colKey] ?? colKey}</Text>
                <Badge
                  count={tickets.length}
                  style={{
                    backgroundColor: colors.primary[500],
                  }}
                />
              </div>

              {tickets.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: spacing.lg,
                    color: colors.neutral[400],
                    fontSize: 13,
                  }}
                >
                  暂无工单
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                  {tickets.map((ticket) => (
                    <Card
                      key={ticket.ticketId}
                      size="small"
                      style={{
                        borderRadius: componentRadius.input,
                        boxShadow: shadows.xs,
                        cursor: 'pointer',
                      }}
                      styles={{ body: { padding: spacing.sm } }}
                    >
                      <div style={{ marginBottom: 4 }}>
                        <Text strong style={{ fontSize: 13 }}>
                          {ticket.title}
                        </Text>
                      </div>
                      <Row justify="space-between" align="middle">
                        <Col>
                          <Tag
                            color={priorityColor[ticket.priority]}
                            style={{ borderRadius: componentRadius.tag, fontSize: 11 }}
                          >
                            {priorityLabel[ticket.priority] ?? ticket.priority}
                          </Tag>
                        </Col>
                        <Col>
                          {ticket.assignee ? (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {ticket.assignee}
                            </Text>
                          ) : (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              未分配
                            </Text>
                          )}
                        </Col>
                      </Row>
                      <div style={{ marginTop: 6, textAlign: 'right' }}>
                        <Popconfirm
                          title="确认从 Sprint 移除？"
                          onConfirm={() => handleRemoveTicket(ticket.ticketId)}
                        >
                          <Button type="link" size="small" danger>
                            移除
                          </Button>
                        </Popconfirm>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  /** Burndown chart placeholder */
  const renderBurndown = () => {
    if (!selectedSprintId) return null;

    return (
      <Card
        title="燃尽图"
        size="small"
        style={{
          marginTop: spacing.md,
          borderRadius: componentRadius.card,
          boxShadow: shadows.card,
        }}
      >
        {burndownLoading ? (
          <Text type="secondary">加载中...</Text>
        ) : burndownData.length === 0 ? (
          <Empty description="暂无燃尽数据" />
        ) : (
          <div style={{ textAlign: 'center', padding: spacing.md }}>
            <Progress
              type="dashboard"
              percent={burndownPercent}
              format={(percent) => `剩余 ${percent}%`}
              strokeColor={burndownPercent > 50 ? colors.warning[500] : colors.success[500]}
              size={160}
            />
            <div style={{ marginTop: spacing.sm }}>
              <Text type="secondary">
                最新剩余: {burndownData[burndownData.length - 1].remainingPoints} 点 / 理想:{' '}
                {burndownData[burndownData.length - 1].idealPoints} 点
              </Text>
            </div>
            {/* Detailed burndown breakdown */}
            <div style={{ marginTop: spacing.md, textAlign: 'left' }}>
              {burndownData.slice(-5).map((item) => (
                <Row key={item.date} justify="space-between" style={{ marginBottom: 4 }}>
                  <Col>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(item.date).format('MM/DD')}
                    </Text>
                  </Col>
                  <Col>
                    <Text style={{ fontSize: 12 }}>{item.remainingPoints} 点</Text>
                  </Col>
                </Row>
              ))}
            </div>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <ProjectOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        Sprint 管理
      </Title>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'list',
            label: 'Sprint 列表',
            children: (
              <Card
                style={{
                  borderRadius: componentRadius.card,
                  boxShadow: shadows.card,
                }}
              >
                <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
                  <Col>
                    <Space>
                      <Select
                        placeholder="按状态筛选"
                        allowClear
                        style={{ width: 150 }}
                        value={statusFilter}
                        onChange={(val) => setStatusFilter(val)}
                        options={[
                          { value: 'planning', label: '规划中' },
                          { value: 'active', label: '进行中' },
                          { value: 'completed', label: '已完成' },
                          { value: 'cancelled', label: '已取消' },
                        ]}
                      />
                      <Button icon={<ReloadOutlined />} onClick={fetchSprints}>
                        刷新
                      </Button>
                    </Space>
                  </Col>
                  <Col>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                      创建 Sprint
                    </Button>
                  </Col>
                </Row>
                <Table
                  columns={sprintColumns}
                  dataSource={sprints}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 20 }}
                />
              </Card>
            ),
          },
          {
            key: 'board',
            label: 'Sprint 看板',
            children: (
              <div>
                <Card
                  style={{
                    borderRadius: componentRadius.card,
                    boxShadow: shadows.card,
                    marginBottom: spacing.md,
                  }}
                  styles={{ body: { padding: `${spacing.sm}px ${spacing.md}px` } }}
                >
                  <Row justify="space-between" align="middle">
                    <Col>
                      <Space>
                        <Text strong>选择 Sprint:</Text>
                        <Select
                          placeholder="选择 Sprint 查看看板"
                          style={{ width: 260 }}
                          value={selectedSprintId}
                          onChange={(val) => setSelectedSprintId(val)}
                          loading={loading}
                        >
                          {sprints.map((s) => (
                            <Select.Option key={s.id} value={s.id}>
                              <Space>
                                <Tag color={sprintStatusColor[s.status]} style={{ marginRight: 0 }}>
                                  {sprintStatusLabel[s.status]}
                                </Tag>
                                {s.name}
                              </Space>
                            </Select.Option>
                          ))}
                        </Select>
                      </Space>
                    </Col>
                    <Col>
                      {selectedSprintId && (
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={() => fetchBoard(selectedSprintId)}
                        >
                          刷新
                        </Button>
                      )}
                    </Col>
                  </Row>
                </Card>

                <Row gutter={spacing.md}>
                  <Col span={18}>
                    <Card
                      style={{
                        borderRadius: componentRadius.card,
                        boxShadow: shadows.card,
                      }}
                      styles={{ body: { padding: spacing.md } }}
                    >
                      {renderKanbanBoard()}
                    </Card>
                  </Col>
                  <Col span={6}>{renderBurndown()}</Col>
                </Row>
              </div>
            ),
          },
          {
            key: 'backlog',
            label: '待办列表',
            children: (
              <Card
                style={{
                  borderRadius: componentRadius.card,
                  boxShadow: shadows.card,
                }}
              >
                <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
                  <Col>
                    <Space>
                      <UnorderedListOutlined style={{ color: colors.primary[500] }} />
                      <Text strong>待办工单（未分配到 Sprint）</Text>
                      {selectedSprintId && (
                        <Tag color="blue">
                          目标 Sprint:{' '}
                          {sprints.find((s) => s.id === selectedSprintId)?.name ?? selectedSprintId}
                        </Tag>
                      )}
                    </Space>
                  </Col>
                  <Col>
                    <Button icon={<ReloadOutlined />} onClick={fetchBacklog}>
                      刷新
                    </Button>
                  </Col>
                </Row>
                <Table
                  columns={backlogColumns}
                  dataSource={backlog}
                  rowKey="ticketId"
                  loading={backlogLoading}
                  pagination={{ pageSize: 20 }}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* Create / Edit Modal */}
      <Modal
        title={editingSprint ? '编辑 Sprint' : '创建 Sprint'}
        open={modalVisible}
        onOk={handleSave}
        confirmLoading={confirmLoading}
        onCancel={() => setModalVisible(false)}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: spacing.sm }}>
          <Form.Item
            name="name"
            label="Sprint 名称"
            rules={[{ required: true, message: '请输入 Sprint 名称' }]}
          >
            <Input placeholder="例如: Sprint 2024-W28" style={{ height: 36 }} />
          </Form.Item>

          <Form.Item name="goal" label="Sprint 目标">
            <TextArea rows={2} placeholder="本次 Sprint 的核心目标" />
          </Form.Item>

          <Row gutter={spacing.md}>
            <Col span={12}>
              <Form.Item
                name="dateRange"
                label="起止日期"
                rules={[{ required: true, message: '请选择起止日期' }]}
              >
                <RangePicker style={{ width: '100%', height: 36 }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="capacity" label="容量 (故事点)">
                <InputNumber placeholder="总故事点" min={0} style={{ width: '100%', height: 36 }} />
              </Form.Item>
            </Col>
          </Row>

          {editingSprint && (
            <Form.Item name="status" label="状态">
              <Select
                options={[
                  { value: 'planning', label: '规划中' },
                  { value: 'active', label: '进行中' },
                  { value: 'completed', label: '已完成' },
                  { value: 'cancelled', label: '已取消' },
                ]}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
