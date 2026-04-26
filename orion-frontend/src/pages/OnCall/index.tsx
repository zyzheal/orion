/**
 * OnCall Management Page
 * Schedule management, rotation viewing, and override operations
 */
import React, { useState, useEffect } from 'react';
import {
  Typography, Button, Space, Tag, Card, Modal, Form, Input, Select, message,
  Popconfirm, Descriptions, Drawer, Tooltip, Table as AntTable, Timeline,
  Empty, Avatar, Badge,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, DeleteOutlined, SwapOutlined,
  UserOutlined, CalendarOutlined,
  EyeOutlined, GlobalOutlined, TeamOutlined,
} from '@ant-design/icons';
import {
  getSchedules, createSchedule, deleteSchedule,
  getCurrentOnCall, createOverride,
  type OnCallSchedule, type OnCallAssignment, type OnCallOverride,
  type EscalationRule, type RotationType,
  type CreateScheduleInput, type CreateOverrideInput,
  type CurrentOnCallResult,
} from '@/api/oncall';
import { colors } from '@/tokens/colors';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);

const { Title, Text } = Typography;

// ---- Constants ----

const rotationTypeLabel: Record<RotationType, string> = {
  daily: '每日轮换',
  weekly: '每周轮换',
  monthly: '每月轮换',
};

const rotationTypeColor: Record<RotationType, string> = {
  daily: 'blue',
  weekly: 'green',
  monthly: 'purple',
};

const timezoneOptions = [
  { label: 'Asia/Shanghai (UTC+8)', value: 'Asia/Shanghai' },
  { label: 'America/New_York (UTC-5)', value: 'America/New_York' },
  { label: 'America/Los_Angeles (UTC-8)', value: 'America/Los_Angeles' },
  { label: 'Europe/London (UTC+0)', value: 'Europe/London' },
  { label: 'Europe/Berlin (UTC+1)', value: 'Europe/Berlin' },
  { label: 'Asia/Tokyo (UTC+9)', value: 'Asia/Tokyo' },
  { label: 'UTC', value: 'UTC' },
];

// Mock team members for display
const MOCK_USERS: Record<string, string> = {
  'dev-001': '张三',
  'dev-002': '李四',
  'dev-003': '王五',
  'dev-004': '赵六',
  'dev-005': '孙七',
  'dev-006': '周八',
  'ops-001': '运维-甲',
  'ops-002': '运维-乙',
};

const resolveUserName = (userId: string): string => MOCK_USERS[userId] || userId;

// ---- Mock data ----

const MOCK_ESCALATIONS: EscalationRule[][] = [
  [
    { level: 1, timeoutMinutes: 15, targets: ['dev-002'] },
    { level: 2, timeoutMinutes: 30, targets: ['dev-003'] },
  ],
  [
    { level: 1, timeoutMinutes: 10, targets: ['ops-002'] },
  ],
];

const MOCK_SCHEDULES: OnCallSchedule[] = [
  {
    id: 'sched-1', name: '平台核心服务', timezone: 'Asia/Shanghai',
    rotationType: 'weekly', rotationStartHour: 9,
    teamMembers: ['dev-001', 'dev-002', 'dev-003'],
    startDate: '2024-03-01T09:00:00Z', escalations: MOCK_ESCALATIONS[0],
    createdAt: '2024-01-15T08:00:00Z', updatedAt: '2024-03-15T10:00:00Z',
  },
  {
    id: 'sched-2', name: 'AI 算法服务', timezone: 'Asia/Shanghai',
    rotationType: 'daily', rotationStartHour: 10,
    teamMembers: ['dev-004', 'dev-005'],
    startDate: '2024-03-10T10:00:00Z', escalations: [],
    createdAt: '2024-02-01T08:00:00Z', updatedAt: '2024-03-18T14:00:00Z',
  },
  {
    id: 'sched-3', name: '运维值班', timezone: 'Asia/Shanghai',
    rotationType: 'monthly', rotationStartHour: 0,
    teamMembers: ['ops-001', 'ops-002', 'dev-006'],
    startDate: '2024-01-01T00:00:00Z', escalations: MOCK_ESCALATIONS[1],
    createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-02-01T00:00:00Z',
  },
];

const MOCK_ASSIGNMENTS: OnCallAssignment[] = [
  { id: 'assign-1', scheduleId: 'sched-1', userId: 'dev-001', startTime: '2024-03-18T09:00:00Z', endTime: '2024-03-25T09:00:00Z' },
  { id: 'assign-2', scheduleId: 'sched-1', userId: 'dev-002', startTime: '2024-03-25T09:00:00Z', endTime: '2024-04-01T09:00:00Z' },
  { id: 'assign-3', scheduleId: 'sched-1', userId: 'dev-003', startTime: '2024-04-01T09:00:00Z', endTime: '2024-04-08T09:00:00Z' },
  { id: 'assign-4', scheduleId: 'sched-2', userId: 'dev-004', startTime: '2024-03-20T10:00:00Z', endTime: '2024-03-21T10:00:00Z' },
  { id: 'assign-5', scheduleId: 'sched-2', userId: 'dev-005', startTime: '2024-03-21T10:00:00Z', endTime: '2024-03-22T10:00:00Z' },
  { id: 'assign-6', scheduleId: 'sched-3', userId: 'ops-001', startTime: '2024-03-01T00:00:00Z', endTime: '2024-04-01T00:00:00Z' },
  { id: 'assign-7', scheduleId: 'sched-3', userId: 'ops-002', startTime: '2024-04-01T00:00:00Z', endTime: '2024-05-01T00:00:00Z' },
];

const MOCK_CURRENT_ONCALL: Record<string, CurrentOnCallResult> = {
  'sched-1': { isOnCall: true, primaryUserId: 'dev-001', escalationTargets: ['dev-002', 'dev-003'] },
  'sched-2': { isOnCall: true, primaryUserId: 'dev-004', escalationTargets: ['dev-005'] },
  'sched-3': { isOnCall: true, primaryUserId: 'ops-001', escalationTargets: ['ops-002', 'dev-006'] },
};

// ---- Main Component ----

const OnCallManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState<OnCallSchedule[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [overrideModalVisible, setOverrideModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<OnCallSchedule | null>(null);
  const [currentOnCall, setCurrentOnCall] = useState<Record<string, CurrentOnCallResult>>({});
  const [overrides] = useState<OnCallOverride[]>([]);
  const [createForm] = Form.useForm();
  const [overrideForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [memberInput, setMemberInput] = useState('');

  // ---- Data Loading ----

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getSchedules();
      const data = res.data?.data?.schedules;
      setSchedules(Array.isArray(data) && data.length > 0 ? data : MOCK_SCHEDULES);
    } catch {
      setSchedules(MOCK_SCHEDULES);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentOnCall = async (scheduleId: string) => {
    try {
      const res = await getCurrentOnCall(scheduleId);
      const result = res.data?.data;
      if (result) {
        setCurrentOnCall((prev) => ({ ...prev, [scheduleId]: result }));
      } else {
        setCurrentOnCall((prev) => ({ ...prev, [scheduleId]: MOCK_CURRENT_ONCALL[scheduleId] || { isOnCall: false } }));
      }
    } catch {
      setCurrentOnCall((prev) => ({ ...prev, [scheduleId]: MOCK_CURRENT_ONCALL[scheduleId] || { isOnCall: false } }));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Load current on-call for all schedules
    let cancelled = false;
    const promises = schedules.map((s) => loadCurrentOnCall(s.id));
    Promise.allSettled(promises).then(() => {
      if (!cancelled) {
        // All loaded, state already updated within individual loadCurrentOnCall calls
      }
    });
    return () => { cancelled = true; };
  }, [schedules]);

  // ---- Handlers ----

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const teamMembers = memberInput
        ? memberInput.split(',').map((s: string) => s.trim()).filter(Boolean)
        : (values.teamMembers || []);

      const payload: CreateScheduleInput = {
        name: values.name,
        timezone: values.timezone,
        rotationType: values.rotationType,
        teamMembers,
        rotationStartHour: values.rotationStartHour ?? 9,
      };
      await createSchedule(payload);
      message.success('值班排班创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      setMemberInput('');
      loadData();
    } catch {
      message.error('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSchedule(id);
      message.success('值班排班已删除');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const openOverrideModal = (schedule: OnCallSchedule) => {
    setSelectedSchedule(schedule);
    overrideForm.setFieldsValue({
      rotationStartHour: 9,
    });
    setOverrideModalVisible(true);
  };

  const handleCreateOverride = async () => {
    if (!selectedSchedule) return;
    try {
      const values = await overrideForm.validateFields();
      setSubmitting(true);
      const payload: CreateOverrideInput = {
        scheduleId: selectedSchedule.id,
        originalUserId: values.originalUserId,
        overrideUserId: values.overrideUserId,
        startTime: values.startTime.format('YYYY-MM-DDTHH:mm:ssZ'),
        endTime: values.endTime.format('YYYY-MM-DDTHH:mm:ssZ'),
        reason: values.reason,
      };
      await createOverride(payload);
      message.success('代班创建成功');
      setOverrideModalVisible(false);
      overrideForm.resetFields();
    } catch {
      message.error('代班创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = (schedule: OnCallSchedule) => {
    setSelectedSchedule(schedule);
    setDetailDrawerVisible(true);
    loadCurrentOnCall(schedule.id);
  };

  // ---- Computed ----

  const getAssignmentsForSchedule = (scheduleId: string): OnCallAssignment[] => {
    return MOCK_ASSIGNMENTS.filter((a) => a.scheduleId === scheduleId);
  };

  const getOverridesForSchedule = (scheduleId: string): OnCallOverride[] => {
    return overrides.filter((o) => o.scheduleId === scheduleId);
  };

  // ---- Table Columns ----

  const columns = [
    {
      title: '排班名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string, record: OnCallSchedule) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.timezone}</Text>
        </Space>
      ),
    },
    {
      title: '轮换方式',
      key: 'rotationType',
      width: 110,
      render: (_: unknown, record: OnCallSchedule) => (
        <Tag color={rotationTypeColor[record.rotationType]}>
          {rotationTypeLabel[record.rotationType]}
        </Tag>
      ),
    },
    {
      title: '当前值班',
      key: 'currentOnCall',
      width: 160,
      render: (_: unknown, record: OnCallSchedule) => {
        const oncall = currentOnCall[record.id];
        const userId = oncall?.primaryUserId || record.teamMembers[0];
        if (!userId) return <Text type="secondary">-</Text>;
        return (
          <Space>
            <Badge status={oncall?.isOnCall ? 'success' : 'default'} />
            <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: colors.primary[500] }} />
            <Text>{resolveUserName(userId)}</Text>
          </Space>
        );
      },
    },
    {
      title: '团队成员',
      key: 'teamMembers',
      width: 240,
      render: (_: unknown, record: OnCallSchedule) => (
        <Space wrap>
          {record.teamMembers.slice(0, 3).map((uid) => (
            <Tag key={uid} icon={<UserOutlined />}>{resolveUserName(uid)}</Tag>
          ))}
          {record.teamMembers.length > 3 && (
            <Tag>+{record.teamMembers.length - 3}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '开始时间',
      key: 'startDate',
      width: 140,
      render: (_: unknown, record: OnCallSchedule) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(record.startDate).format('YYYY-MM-DD HH:mm')}
        </Text>
      ),
    },
    {
      title: '升级规则',
      key: 'escalations',
      width: 120,
      render: (_: unknown, record: OnCallSchedule) => {
        if (!record.escalations || record.escalations.length === 0) {
          return <Text type="secondary">无</Text>;
        }
        return (
          <Tooltip title={record.escalations.map((e) => `L${e.level}: ${e.timeoutMinutes}分钟 -> ${e.targets.map(resolveUserName).join(', ')}`).join('; ')}>
            <Tag color="orange">{record.escalations.length} 级</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '更新时间',
      key: 'updatedAt',
      width: 130,
      render: (_: unknown, record: OnCallSchedule) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(record.updatedAt).fromNow()}</Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: OnCallSchedule) => (
        <Space size="small" wrap>
          <Tooltip title="详情"><Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>详情</Button></Tooltip>
          <Tooltip title="设置代班"><Button type="link" size="small" icon={<SwapOutlined />} onClick={() => openOverrideModal(record)}>代班</Button></Tooltip>
          <Tooltip title="删除"><Popconfirm title="确认删除该值班排班?" onConfirm={() => handleDelete(record.id)}><Button type="link" size="small" danger icon={<DeleteOutlined />} /></Popconfirm></Tooltip>
        </Space>
      ),
    },
  ];

  // ---- Detail Drawer Content ----

  const renderDetailContent = () => {
    if (!selectedSchedule) return null;
    const schedule = selectedSchedule;
    const oncall = currentOnCall[schedule.id];
    const assignments = getAssignmentsForSchedule(schedule.id);
    const scheduleOverrides = getOverridesForSchedule(schedule.id);

    return (
      <div>
        {/* Basic Info */}
        <Descriptions column={2} bordered size="small" title="基本信息" style={{ marginBottom: 24 }}>
          <Descriptions.Item label="排班名称">{schedule.name}</Descriptions.Item>
          <Descriptions.Item label="轮换方式">
            <Tag color={rotationTypeColor[schedule.rotationType]}>{rotationTypeLabel[schedule.rotationType]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="时区"><GlobalOutlined /> {schedule.timezone}</Descriptions.Item>
          <Descriptions.Item label="轮换开始时间">{schedule.rotationStartHour}:00</Descriptions.Item>
          <Descriptions.Item label="当前值班">
            {oncall?.primaryUserId ? (
              <Space>
                <Badge status={oncall.isOnCall ? 'success' : 'default'} />
                {resolveUserName(oncall.primaryUserId)}
              </Space>
            ) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="团队成员">
            <Space wrap>
              {schedule.teamMembers.map((uid) => (
                <Tag key={uid} icon={<UserOutlined />}>{resolveUserName(uid)}</Tag>
              ))}
            </Space>
          </Descriptions.Item>
        </Descriptions>

        {/* Upcoming Shifts */}
        <Title level={5}><CalendarOutlined /> 即将到来的排班</Title>
        {assignments.length > 0 ? (
          <Timeline
            style={{ marginBottom: 24 }}
            items={assignments.map((a, idx) => {
              const isCurrent = oncall?.primaryUserId === a.userId;
              return {
                color: isCurrent ? 'green' : idx === 0 ? 'blue' : 'gray',
                children: (
                  <Space direction="vertical" size={0}>
                    <Space>
                      <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: isCurrent ? colors.success[500] : colors.primary[500] }} />
                      <Text strong={isCurrent}>{resolveUserName(a.userId)}</Text>
                      {isCurrent && <Badge status="success" text={<Text type="secondary" style={{ fontSize: 12 }}>当前值班</Text>} />}
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(a.startTime).format('YYYY-MM-DD HH:mm')} 至 {dayjs(a.endTime).format('YYYY-MM-DD HH:mm')}
                    </Text>
                  </Space>
                ),
              };
            })}
          />
        ) : (
          <Empty description="暂无排班记录" style={{ marginBottom: 24 }} />
        )}

        {/* Escalation Rules */}
        {schedule.escalations && schedule.escalations.length > 0 && (
          <>
            <Title level={5}><TeamOutlined /> 升级规则</Title>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 24 }}>
              {schedule.escalations.map((rule) => (
                <Descriptions.Item key={rule.level} label={`第 ${rule.level} 级`}>
                  {rule.timeoutMinutes} 分钟未响应时升级至:
                  <Space style={{ marginLeft: 8 }}>
                    {rule.targets.map((t) => <Tag key={t}>{resolveUserName(t)}</Tag>)}
                  </Space>
                </Descriptions.Item>
              ))}
            </Descriptions>
          </>
        )}

        {/* Active Overrides */}
        {scheduleOverrides.length > 0 && (
          <>
            <Title level={5}><SwapOutlined /> 代班记录</Title>
            <Timeline
              items={scheduleOverrides.map((o) => ({
                color: 'orange',
                children: (
                  <Space direction="vertical" size={0}>
                    <Text>
                      <Tag color="orange">代班</Tag>
                      {resolveUserName(o.originalUserId)} {'->'} {resolveUserName(o.overrideUserId)}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(o.startTime).format('YYYY-MM-DD HH:mm')} 至 {dayjs(o.endTime).format('YYYY-MM-DD HH:mm')}
                    </Text>
                    {o.reason && <Text type="secondary">原因: {o.reason}</Text>}
                  </Space>
                ),
              }))}
            />
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>OnCall 值班管理</Title>
          <Text type="secondary">管理值班排班、轮换分配和代班设置</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCreateModalVisible(true); createForm.resetFields(); setMemberInput(''); }}>创建排班</Button>
        </Space>
      </div>

      {/* Schedule List */}
      <Card>
        <AntTable
          columns={columns}
          dataSource={schedules}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={false}
        />
      </Card>

      {/* Create Schedule Modal */}
      <Modal
        title="创建值班排班"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        width={560}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="排班名称" rules={[{ required: true, message: '请输入排班名称' }]}>
            <Input placeholder="如: 平台核心服务值班" />
          </Form.Item>
          <Form.Item name="timezone" label="时区" rules={[{ required: true, message: '请选择时区' }]} initialValue="Asia/Shanghai">
            <Select options={timezoneOptions} />
          </Form.Item>
          <Form.Item name="rotationType" label="轮换方式" rules={[{ required: true, message: '请选择轮换方式' }]}>
            <Select options={[
              { label: '每日轮换', value: 'daily' },
              { label: '每周轮换', value: 'weekly' },
              { label: '每月轮换', value: 'monthly' },
            ]} />
          </Form.Item>
          <Form.Item label="团队成员 (逗号分隔的用户ID)" required>
            <Input
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              placeholder="如: dev-001, dev-002, dev-003"
            />
          </Form.Item>
          <Form.Item name="rotationStartHour" label="轮换开始时间 (小时)" initialValue={9}>
            <Select options={Array.from({ length: 24 }, (_, i) => ({ label: `${i}:00`, value: i }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Override Modal */}
      <Modal
        title="设置代班"
        open={overrideModalVisible}
        onCancel={() => setOverrideModalVisible(false)}
        onOk={handleCreateOverride}
        confirmLoading={submitting}
        width={480}
        destroyOnClose
      >
        {selectedSchedule && (
          <div style={{ marginBottom: 16 }}>
            <Text>当前排班: <Text strong>{selectedSchedule.name}</Text></Text>
          </div>
        )}
        <Form form={overrideForm} layout="vertical">
          <Form.Item name="originalUserId" label="原始值班人员" rules={[{ required: true, message: '请选择原始值班人员' }]}>
            <Select
              options={selectedSchedule?.teamMembers.map((uid) => ({
                label: resolveUserName(uid),
                value: uid,
              }))}
              placeholder="选择原始值班人员"
            />
          </Form.Item>
          <Form.Item name="overrideUserId" label="代班人员" rules={[{ required: true, message: '请选择代班人员' }]}>
            <Select
              options={Object.entries(MOCK_USERS)
                .filter(([uid]) => selectedSchedule?.teamMembers.includes(uid))
                .map(([uid, name]) => ({ label: name, value: uid }))}
              placeholder="选择代班人员"
            />
          </Form.Item>
          <Form.Item name="startTime" label="代班开始时间" rules={[{ required: true, message: '请选择开始时间' }]}>
            <Input placeholder="YYYY-MM-DD HH:mm" />
          </Form.Item>
          <Form.Item name="endTime" label="代班结束时间" rules={[{ required: true, message: '请选择结束时间' }]}>
            <Input placeholder="YYYY-MM-DD HH:mm" />
          </Form.Item>
          <Form.Item name="reason" label="代班原因">
            <Input.TextArea rows={2} placeholder="代班原因..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={selectedSchedule ? `${selectedSchedule.name} - 排班详情` : '排班详情'}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={720}
        destroyOnClose
      >
        {renderDetailContent()}
      </Drawer>
    </div>
  );
};

export default OnCallManagement;
