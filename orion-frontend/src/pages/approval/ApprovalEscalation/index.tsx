/**
 * ApprovalEscalation (P3-03)
 * 审批超时升级页面 - SLA 监控、超时自动升级、审批时效分析
 * 纯前端 Mock 数据
 */
import React, { useState } from 'react';
import {
  Typography,
  Card,
  Tag,
  Space,
  Button,
  Table,
  Select,
  Row,
  Col,
  Statistic,
  Switch,
  Modal,
  Form,
  Input,
  message,
  Tooltip,
  Divider,
  Descriptions,
  Timeline,
} from 'antd';
import {
  ClockCircleOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  ArrowUpOutlined,
  ExclamationCircleOutlined,
  SendOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// ==================== Types ====================

type EscalationStatus = 'normal' | 'warning' | 'timeout' | 'escalated';

interface ApprovalRecord {
  id: string;
  requestNo: string;
  applicant: string;
  approver: string;
  submitTime: string;
  waitMinutes: number;
  slaLimit: string;
  status: EscalationStatus;
  department: string;
  approvalType: string;
}

interface EscalationRule {
  id: string;
  name: string;
  threshold: string;
  thresholdMinutes: number;
  action: string;
  enabled: boolean;
  priority: number;
}

interface TrendDay {
  date: string;
  avgDuration: number;
  maxDuration: number;
  slaRate: number;
}

// ==================== Mock Data ====================

const MOCK_APPROVALS: ApprovalRecord[] = [
  {
    id: '1',
    requestNo: 'APPR-20260808-001',
    applicant: '张三',
    approver: '李四',
    submitTime: '2026-08-08 06:30',
    waitMinutes: 165,
    slaLimit: '2 小时',
    status: 'escalated',
    department: '研发部',
    approvalType: '生产部署',
  },
  {
    id: '2',
    requestNo: 'APPR-20260808-002',
    applicant: '王五',
    approver: '赵六',
    submitTime: '2026-08-08 07:00',
    waitMinutes: 95,
    slaLimit: '2 小时',
    status: 'timeout',
    department: '基础设施',
    approvalType: '资源扩容',
  },
  {
    id: '3',
    requestNo: 'APPR-20260808-003',
    applicant: '钱七',
    approver: '孙八',
    submitTime: '2026-08-08 07:45',
    waitMinutes: 52,
    slaLimit: '1 小时',
    status: 'timeout',
    department: '安全部',
    approvalType: '安全审批',
  },
  {
    id: '4',
    requestNo: 'APPR-20260808-004',
    applicant: '周九',
    approver: '吴十',
    submitTime: '2026-08-08 08:10',
    waitMinutes: 42,
    slaLimit: '30 分钟',
    status: 'timeout',
    department: '研发部',
    approvalType: '代码合并',
  },
  {
    id: '5',
    requestNo: 'APPR-20260808-005',
    applicant: '郑一',
    approver: '陈二',
    submitTime: '2026-08-08 08:30',
    waitMinutes: 35,
    slaLimit: '1 小时',
    status: 'warning',
    department: '运维部',
    approvalType: '配置变更',
  },
  {
    id: '6',
    requestNo: 'APPR-20260808-006',
    applicant: '林三',
    approver: '黄四',
    submitTime: '2026-08-08 08:50',
    waitMinutes: 28,
    slaLimit: '30 分钟',
    status: 'warning',
    department: '研发部',
    approvalType: '数据库变更',
  },
  {
    id: '7',
    requestNo: 'APPR-20260808-007',
    applicant: '何五',
    approver: '马六',
    submitTime: '2026-08-08 09:10',
    waitMinutes: 22,
    slaLimit: '1 小时',
    status: 'normal',
    department: '产品部',
    approvalType: '需求变更',
  },
  {
    id: '8',
    requestNo: 'APPR-20260808-008',
    applicant: '罗七',
    approver: '梁八',
    submitTime: '2026-08-08 09:20',
    waitMinutes: 15,
    slaLimit: '2 小时',
    status: 'normal',
    department: '基础设施',
    approvalType: '证书更新',
  },
  {
    id: '9',
    requestNo: 'APPR-20260807-009',
    applicant: '宋九',
    approver: '谢十',
    submitTime: '2026-08-07 18:00',
    waitMinutes: 625,
    slaLimit: '8 小时',
    status: 'escalated',
    department: '安全部',
    approvalType: '权限提升',
  },
  {
    id: '10',
    requestNo: 'APPR-20260807-010',
    applicant: '韩一',
    approver: '杨二',
    submitTime: '2026-08-07 20:00',
    waitMinutes: 565,
    slaLimit: '8 小时',
    status: 'escalated',
    department: '研发部',
    approvalType: '生产回滚',
  },
];

const MOCK_RULES: EscalationRule[] = [
  {
    id: 'r1',
    name: '一级超时升级',
    threshold: '超过 30 分钟',
    thresholdMinutes: 30,
    action: '通知直属上级',
    enabled: true,
    priority: 1,
  },
  {
    id: 'r2',
    name: '二级超时升级',
    threshold: '超过 2 小时',
    thresholdMinutes: 120,
    action: '通知部门负责人',
    enabled: true,
    priority: 2,
  },
  {
    id: 'r3',
    name: '三级超时升级',
    threshold: '超过 8 小时',
    thresholdMinutes: 480,
    action: '自动通过 / 通知管理层',
    enabled: false,
    priority: 3,
  },
  {
    id: 'r4',
    name: '高优审批加速',
    threshold: '超过 15 分钟（P0 工单）',
    thresholdMinutes: 15,
    action: '同时通知审批人上级与部门负责人',
    enabled: true,
    priority: 4,
  },
];

const MOCK_TREND: TrendDay[] = [
  { date: '08-02', avgDuration: 45, maxDuration: 180, slaRate: 92 },
  { date: '08-03', avgDuration: 38, maxDuration: 155, slaRate: 94 },
  { date: '08-04', avgDuration: 52, maxDuration: 210, slaRate: 88 },
  { date: '08-05', avgDuration: 42, maxDuration: 195, slaRate: 91 },
  { date: '08-06', avgDuration: 35, maxDuration: 140, slaRate: 96 },
  { date: '08-07', avgDuration: 48, maxDuration: 220, slaRate: 89 },
  { date: '08-08', avgDuration: 40, maxDuration: 170, slaRate: 93 },
];

// ==================== Helpers ====================

const formatWaitTime = (minutes: number): string => {
  if (minutes < 60) return `${minutes} 分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
};

const statusConfig: Record<
  EscalationStatus,
  { label: string; color: string; bgColor: string }
> = {
  normal: { label: '正常', color: colors.success[500], bgColor: '#f6ffed' },
  warning: { label: '即将超时', color: colors.warning[500], bgColor: '#fffbe6' },
  timeout: { label: '已超时', color: colors.error[500], bgColor: '#fff1f0' },
  escalated: { label: '已升级', color: colors.purple[500], bgColor: '#f9f0ff' },
};

const statusTag = (status: EscalationStatus) => {
  const cfg = statusConfig[status];
  return (
    <Tag
      color={cfg.bgColor}
      style={{
        color: cfg.color,
        borderColor: cfg.color,
        fontWeight: 600,
      }}
    >
      {cfg.label}
    </Tag>
  );
};

// ==================== SVG Trend Chart ====================

const TrendChart: React.FC<{ data: TrendDay[] }> = ({ data }) => {
  const width = 700;
  const height = 200;
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map((d) => d.avgDuration)) * 1.2;
  const minVal = 0;

  const avgPoints = data
    .map((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartW;
      const y = padding.top + chartH - ((d.avgDuration - minVal) / (maxVal - minVal)) * chartH;
      return `${x},${y}`;
    })
    .join(' ');

  const slaPoints = data
    .map((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartW;
      const y = padding.top + chartH - (d.slaRate / 100) * chartH;
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `${padding.left},${padding.top + chartH} ${avgPoints} ${padding.left + chartW},${padding.top + chartH}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="avgGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.primary[500]} stopOpacity={0.3} />
          <stop offset="100%" stopColor={colors.primary[500]} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padding.top + chartH * (1 - ratio);
        const val = Math.round(minVal + (maxVal - minVal) * ratio);
        return (
          <g key={ratio}>
            <line
              x1={padding.left}
              y1={y}
              x2={padding.left + chartW}
              y2={y}
              stroke={colors.neutral[200]}
              strokeDasharray="4,4"
            />
            <text
              x={padding.left - 8}
              y={y + 4}
              textAnchor="end"
              fontSize={11}
              fill={colors.neutral[500]}
            >
              {val}
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      <polygon points={areaPoints} fill="url(#avgGradient)" />

      {/* Avg duration line */}
      <polyline
        points={avgPoints}
        fill="none"
        stroke={colors.primary[500]}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* SLA rate line (dashed) */}
      <polyline
        points={slaPoints}
        fill="none"
        stroke={colors.success[500]}
        strokeWidth={2}
        strokeDasharray="6,4"
        strokeLinecap="round"
      />

      {/* Data points */}
      {data.map((d, i) => {
        const x = padding.left + (i / (data.length - 1)) * chartW;
        const yAvg = padding.top + chartH - ((d.avgDuration - minVal) / (maxVal - minVal)) * chartH;
        const ySla = padding.top + chartH - (d.slaRate / 100) * chartH;
        return (
          <g key={i}>
            <circle cx={x} cy={yAvg} r={4} fill={colors.primary[500]} />
            <circle cx={x} cy={ySla} r={3.5} fill={colors.success[500]} />
            <text
              x={x}
              y={padding.top + chartH + 18}
              textAnchor="middle"
              fontSize={11}
              fill={colors.neutral[500]}
            >
              {d.date}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g>
        <rect x={padding.left} y={4} width={12} height={3} fill={colors.primary[500]} />
        <text x={padding.left + 18} y={9} fontSize={11} fill={colors.neutral[600]}>
          平均审批时长
        </text>
        <line x1={padding.left + 140} y1={6} x2={padding.left + 152} y2={6} stroke={colors.success[500]} strokeDasharray="4,2" strokeWidth={2} />
        <text x={padding.left + 158} y={9} fontSize={11} fill={colors.neutral[600]}>
          SLA 达标率
        </text>
      </g>
    </svg>
  );
};

// ==================== Stats Cards ====================

const StatsCards: React.FC = () => {
  return (
    <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
      <Col span={6}>
        <Card
          size="small"
          style={{
            borderLeft: `3px solid ${colors.primary[500]}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            borderRadius: spacing.sm,
          }}
        >
          <Statistic
            title="活跃审批数"
            value={47}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: colors.primary[500] }}
            suffix="个"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            较昨日 <span style={{ color: colors.error[500] }}>+3</span>
          </Text>
        </Card>
      </Col>
      <Col span={6}>
        <Card
          size="small"
          style={{
            borderLeft: `3px solid ${colors.error[500]}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            borderRadius: spacing.sm,
          }}
        >
          <Statistic
            title="超时审批数"
            value={12}
            prefix={<WarningOutlined />}
            valueStyle={{ color: colors.error[500] }}
            suffix="个"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            较昨日 <span style={{ color: colors.error[500] }}>+2</span>
          </Text>
        </Card>
      </Col>
      <Col span={6}>
        <Card
          size="small"
          style={{
            borderLeft: `3px solid ${colors.info[500]}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            borderRadius: spacing.sm,
          }}
        >
          <Statistic
            title="平均审批时长"
            value={42}
            precision={1}
            valueStyle={{ color: colors.info[500] }}
            suffix="分钟"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            较昨日 <span style={{ color: colors.success[500] }}>-5 分钟</span>
          </Text>
        </Card>
      </Col>
      <Col span={6}>
        <Card
          size="small"
          style={{
            borderLeft: `3px solid ${colors.success[500]}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            borderRadius: spacing.sm,
          }}
        >
          <Statistic
            title="SLA 达标率"
            value={92.5}
            precision={1}
            valueStyle={{ color: colors.success[500] }}
            suffix="%"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            较昨日 <span style={{ color: colors.success[500] }}>+1.2%</span>
          </Text>
        </Card>
      </Col>
    </Row>
  );
};

// ==================== Escalation Rules ====================

const EscalationRulesCard: React.FC = () => {
  const [rules, setRules] = useState<EscalationRule[]>(MOCK_RULES);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          message.success(
            `规则「${r.name}」已${r.enabled ? '停用' : '启用'}`
          );
          return { ...r, enabled: !r.enabled };
        }
        return r;
      })
    );
  };

  const handleCreateRule = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const newRule: EscalationRule = {
        id: `r${rules.length + 1}`,
        name: values.name,
        threshold: `${values.thresholdUnit === 'min' ? '分钟' : '小时'} ${values.threshold}`,
        thresholdMinutes:
          values.thresholdUnit === 'min' ? values.threshold : values.threshold * 60,
        action: values.action,
        enabled: true,
        priority: rules.length + 1,
      };
      setRules((prev) => [...prev, newRule]);
      message.success(`升级规则「${newRule.name}」已创建`);
      setCreateModalVisible(false);
      createForm.resetFields();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建规则失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card
      title={
        <Space>
          <ThunderboltOutlined style={{ color: colors.warning[500] }} />
          <Text strong>升级策略配置</Text>
        </Space>
      }
      extra={
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
        >
          新建规则
        </Button>
      }
      style={{ height: '100%' }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {rules
          .sort((a, b) => a.priority - b.priority)
          .map((rule) => (
            <Card
              key={rule.id}
              size="small"
              style={{
                background: rule.enabled
                  ? colors.primary[50]
                  : colors.neutral[50],
                borderRadius: spacing.sm,
              }}
            >
              <Row gutter={12} align="middle">
                <Col flex="auto">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <Text strong style={{ fontSize: 14 }}>
                      {rule.name}
                    </Text>
                    <Tag
                      color={rule.enabled ? 'processing' : 'default'}
                      style={{ fontSize: 11 }}
                    >
                      {rule.enabled ? '启用中' : '已停用'}
                    </Tag>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Tag
                      color="orange"
                      style={{ fontSize: 11 }}
                    >
                      {rule.threshold}
                    </Tag>
                    <ArrowUpOutlined
                      style={{
                        color: colors.neutral[500],
                        fontSize: 10,
                      }}
                    />
                    <Text style={{ fontSize: 13 }}>{rule.action}</Text>
                  </div>
                </Col>
                <Col>
                  <Switch
                    checked={rule.enabled}
                    onChange={() => toggleRule(rule.id)}
                    checkedChildren="开"
                    unCheckedChildren="关"
                    size="small"
                  />
                </Col>
              </Row>
            </Card>
          ))}
      </Space>

      <Modal
        title="新建升级规则"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setCreateModalVisible(false);
            createForm.resetFields();
          }}>
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={submitting}
            onClick={handleCreateRule}
          >
            创建规则
          </Button>,
        ]}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            label="规则名称"
            name="name"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="例如：四级超时升级" />
          </Form.Item>
          <Form.Item
            label="超时阈值"
            name="threshold"
            rules={[{ required: true, message: '请输入阈值' }]}
          >
            <Input
              type="number"
              placeholder="例如：4"
              addonAfter={
                <Form.Item name="thresholdUnit" noStyle initialValue="min">
                  <Select style={{ width: 80 }}>
                    <Option value="min">分钟</Option>
                    <Option value="hour">小时</Option>
                  </Select>
                </Form.Item>
              }
            />
          </Form.Item>
          <Form.Item
            label="升级动作"
            name="action"
            rules={[{ required: true, message: '请输入升级动作' }]}
          >
            <Input.TextArea
              rows={2}
              placeholder="例如：通知项目经理"
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

// ==================== Trend Card ====================

const TrendCard: React.FC = () => {
  const avgOfAll = MOCK_TREND.reduce((s, d) => s + d.avgDuration, 0) / MOCK_TREND.length;
  const maxOfAll = Math.max(...MOCK_TREND.map((d) => d.maxDuration));
  const slaAvg = MOCK_TREND.reduce((s, d) => s + d.slaRate, 0) / MOCK_TREND.length;
  const lastSla = MOCK_TREND[MOCK_TREND.length - 1].slaRate;
  const prevSla = MOCK_TREND[MOCK_TREND.length - 2].slaRate;
  const slaChange = lastSla - prevSla;

  return (
    <Card
      title={
        <Space>
          <ClockCircleOutlined style={{ color: colors.info[500] }} />
          <Text strong>审批时效趋势（近 7 天）</Text>
        </Space>
      }
    >
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={8}>
          <Statistic
            title="平均审批时长"
            value={Math.round(avgOfAll)}
            valueStyle={{ color: colors.primary[500], fontSize: 24 }}
            suffix="分钟"
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="最长等待"
            value={maxOfAll}
            valueStyle={{ color: colors.warning[500], fontSize: 24 }}
            suffix="分钟"
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="SLA 达标率"
            value={slaAvg.toFixed(1)}
            valueStyle={{ color: colors.success[500], fontSize: 24 }}
            suffix="%"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            较前一日{' '}
            <span style={{ color: slaChange >= 0 ? colors.success[500] : colors.error[500] }}>
              {slaChange >= 0 ? '+' : ''}{slaChange}%
            </span>
          </Text>
        </Col>
      </Row>

      <Divider style={{ margin: `${spacing.sm} 0` }} />

      <TrendChart data={MOCK_TREND} />
    </Card>
  );
};

// ==================== Main Component ====================

const ApprovalEscalation: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<EscalationStatus | 'all'>('all');
  const [approvals] = useState<ApprovalRecord[]>(MOCK_APPROVALS);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ApprovalRecord | null>(null);

  const filteredData = approvals.filter((a) => {
    if (statusFilter === 'all') return true;
    return a.status === statusFilter;
  });

  const handleEscalate = (record: ApprovalRecord) => {
    message.success(
      `审批单 ${record.requestNo} 已手动升级至上一级审批人`
    );
  };

  const handleUrgent = (record: ApprovalRecord) => {
    message.info(`已向审批人 ${record.approver} 发送催办通知`);
  };

  const handleViewDetail = (record: ApprovalRecord) => {
    setSelectedRecord(record);
    setDetailVisible(true);
  };

  const columns = [
    {
      title: '审批单号',
      dataIndex: 'requestNo',
      key: 'requestNo',
      width: 180,
      render: (val: string) => (
        <Text strong style={{ color: colors.primary[500] }}>
          {val}
        </Text>
      ),
    },
    {
      title: '申请人',
      dataIndex: 'applicant',
      key: 'applicant',
      width: 80,
    },
    {
      title: '审批人',
      dataIndex: 'approver',
      key: 'approver',
      width: 80,
    },
    {
      title: '提交时间',
      dataIndex: 'submitTime',
      key: 'submitTime',
      width: 150,
      render: (val: string) => <Text type="secondary">{val}</Text>,
    },
    {
      title: '已等待',
      dataIndex: 'waitMinutes',
      key: 'waitMinutes',
      width: 110,
      render: (minutes: number) => {
        const color =
          minutes > 180 ? colors.purple[500] : minutes > 90 ? colors.error[500] : minutes > 30 ? colors.warning[500] : colors.success[500];
        return (
          <Text style={{ color, fontWeight: 600, fontSize: 14 }}>
            {formatWaitTime(minutes)}
          </Text>
        );
      },
    },
    {
      title: 'SLA 时限',
      dataIndex: 'slaLimit',
      key: 'slaLimit',
      width: 90,
      render: (val: string) => <Text>{val}</Text>,
    },
    {
      title: '超时状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: EscalationStatus) => statusTag(status),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: unknown, record: ApprovalRecord) => (
        <Space size="small">
          <Tooltip title="手动升级至上一级审批人">
            <Button
              type="primary"
              size="small"
              danger
              icon={<ArrowUpOutlined />}
              onClick={() => handleEscalate(record)}
            >
              升级
            </Button>
          </Tooltip>
          <Tooltip title="发送催办通知给当前审批人">
            <Button
              size="small"
              icon={<SendOutlined />}
              style={{ borderColor: colors.warning[500], color: colors.warning[500] }}
              onClick={() => handleUrgent(record)}
            >
              催办
            </Button>
          </Tooltip>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div
      style={{
        padding: spacing.lg,
        background: colors.light.bg.secondary,
        minHeight: '100vh',
      }}
    >
      <Title level={2} style={{ marginBottom: 8 }}>
        <ClockCircleOutlined
          style={{ marginRight: 12, color: colors.warning[500] }}
        />
        审批超时升级
      </Title>
      <Text type="secondary">SLA 监控 · 超时自动升级 · 审批时效分析</Text>
      <br />

      <StatsCards />

      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={14}>
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: colors.error[500] }} />
                <Text strong>超时审批列表</Text>
              </Space>
            }
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: spacing.md,
              }}
            >
              <div>
                <Text type="secondary" style={{ marginRight: 8 }}>
                  状态筛选：
                </Text>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ width: 180 }}
                  size="small"
                >
                  <Option value="all">全部</Option>
                  <Option value="warning">即将超时</Option>
                  <Option value="timeout">已超时</Option>
                  <Option value="escalated">已升级</Option>
                  <Option value="normal">正常</Option>
                </Select>
              </div>
              <Text type="secondary">共 {filteredData.length} 条记录</Text>
            </div>
            <Table
              columns={columns}
              dataSource={filteredData}
              rowKey="id"
              size="middle"
              rowClassName={() => 'ant-table-row-hoverable'}
              pagination={{ pageSize: 8, showSizeChanger: false }}
            />
          </Card>
        </Col>

        <Col span={10}>
          <EscalationRulesCard />
        </Col>
      </Row>

      <TrendCard />

      <Modal
        title={
          <Space>
            <ClockCircleOutlined style={{ color: colors.info[500] }} />
            <Text strong>审批详情</Text>
          </Space>
        }
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
          <Button
            key="urgent"
            icon={<SendOutlined />}
            style={{ color: colors.warning[500], borderColor: colors.warning[500] }}
            onClick={() => {
              if (selectedRecord) handleUrgent(selectedRecord);
            }}
          >
            催办审批人
          </Button>,
          <Button
            key="escalate"
            type="primary"
            danger
            icon={<ArrowUpOutlined />}
            onClick={() => {
              if (selectedRecord) handleEscalate(selectedRecord);
            }}
          >
            手动升级
          </Button>,
        ]}
      >
        {selectedRecord && (
          <div>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="审批单号">
                <Text strong style={{ color: colors.primary[500] }}>
                  {selectedRecord.requestNo}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="审批类型">
                {selectedRecord.approvalType}
              </Descriptions.Item>
              <Descriptions.Item label="申请人">
                {selectedRecord.applicant}（{selectedRecord.department}）
              </Descriptions.Item>
              <Descriptions.Item label="当前审批人">
                {selectedRecord.approver}
              </Descriptions.Item>
              <Descriptions.Item label="提交时间">
                {selectedRecord.submitTime}
              </Descriptions.Item>
              <Descriptions.Item label="已等待">
                <Text
                  style={{
                    color: colors.error[500],
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {formatWaitTime(selectedRecord.waitMinutes)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="SLA 时限">
                {selectedRecord.slaLimit}
              </Descriptions.Item>
              <Descriptions.Item label="当前状态">
                {statusTag(selectedRecord.status)}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Text type="secondary" style={{ fontSize: 13 }}>
              <Paragraph>
                <ExclamationCircleOutlined
                  style={{ color: colors.warning[500], marginRight: 4 }}
                />
                此审批单已等待 {formatWaitTime(selectedRecord.waitMinutes)}，
                已超过 SLA 时限（{selectedRecord.slaLimit}）。
                {selectedRecord.status === 'escalated'
                  ? ' 已触发自动升级，当前处理人为上级审批人。'
                  : selectedRecord.status === 'timeout'
                    ? ' 建议立即催办或手动升级。'
                    : ''}
              </Paragraph>
            </Text>

            <div
              style={{
                marginTop: spacing.md,
                padding: spacing.md,
                background: colors.light.bg.secondary,
                borderRadius: spacing.sm,
              }}
            >
              <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                升级路径
              </Text>
              <Timeline
                items={[
                  {
                    color: colors.primary[500],
                    children: (
                      <Text>{selectedRecord.approver}（当前审批人）</Text>
                    ),
                  },
                  {
                    color: colors.warning[500],
                    children: (
                      <Text>直属上级（一级升级）</Text>
                    ),
                  },
                  {
                    color: colors.error[500],
                    children: (
                      <Text>部门负责人（二级升级）</Text>
                    ),
                  },
                  {
                    color: colors.purple[500],
                    children: (
                      <Text>管理层（三级升级）</Text>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ApprovalEscalation;
