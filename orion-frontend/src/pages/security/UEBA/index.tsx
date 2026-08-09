/**
 * UEBA ML User Behavior Anomaly Detection Page
 * P3-14 - 用户行为异常检测
 * 纯前端 Mock 数据：行为基线学习、离群值检测、风险评分
 */

import React, { useState, useMemo } from 'react';
import {
  Card,
  Table,
  Typography,
  Row,
  Col,
  Tag,
  Button,
  Space,
  Select,
  Form,
  InputNumber,
  Radio,
  Progress,
  message,
  Statistic,
  Divider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  UserSwitchOutlined,
  SearchOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SettingOutlined,
  WarningOutlined,
  RadarChartOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title } = Typography;
const { Text } = Typography;
const { Option } = Select;

const commonStyle = {
  primary: colors.primary[500],
  success: colors.success[500],
  warning: colors.warning[500],
  error: colors.error[500],
  info: colors.info[500],
  neutral: colors.neutral[500],
  purple: colors.purple[500],
};

/**
 * 异常类型
 */
type AnomalyType = '异常登录' | '权限滥用' | '数据外泄' | '异常时间' | '高频操作';

/**
 * 检测方法
 */
type DetectionMethod = 'IQR' | '3σ' | 'Z-Score';

/**
 * 事件状态
 */
type EventStatus = '待调查' | '已确认' | '误报';

/**
 * 异常事件记录
 */
interface AnomalyEvent {
  key: string;
  username: string;
  type: AnomalyType;
  score: number;
  method: DetectionMethod;
  time: string;
  status: EventStatus;
}

/**
 * 用户风险排行
 */
interface UserRiskRank {
  key: string;
  username: string;
  score: number;
  count: number;
}

/**
 * 检测模型配置
 */
interface DetectionConfig {
  method: DetectionMethod;
  sensitivity: number;
  baselineDays: number;
}

/**
 * Mock 异常事件数据（10条记录）
 */
const mockEvents: AnomalyEvent[] = [
  {
    key: '1',
    username: 'zhang.san',
    type: '异常登录',
    score: 92,
    method: 'Z-Score',
    time: '2026-08-08 03:24:17',
    status: '待调查',
  },
  {
    key: '2',
    username: 'li.si',
    type: '权限滥用',
    score: 85,
    method: 'IQR',
    time: '2026-08-08 02:10:44',
    status: '已确认',
  },
  {
    key: '3',
    username: 'wang.wu',
    type: '数据外泄',
    score: 78,
    method: '3σ',
    time: '2026-08-07 23:55:31',
    status: '待调查',
  },
  {
    key: '4',
    username: 'chen.liu',
    type: '异常时间',
    score: 65,
    method: 'IQR',
    time: '2026-08-07 22:18:09',
    status: '待调查',
  },
  {
    key: '5',
    username: 'zhao.qi',
    type: '高频操作',
    score: 58,
    method: 'Z-Score',
    time: '2026-08-07 19:42:56',
    status: '误报',
  },
  {
    key: '6',
    username: 'sun.ba',
    type: '异常登录',
    score: 45,
    method: '3σ',
    time: '2026-08-07 16:30:22',
    status: '待调查',
  },
  {
    key: '7',
    username: 'zhu.jiu',
    type: '权限滥用',
    score: 38,
    method: 'IQR',
    time: '2026-08-07 14:15:38',
    status: '已确认',
  },
  {
    key: '8',
    username: 'wu.shi',
    type: '数据外泄',
    score: 88,
    method: 'Z-Score',
    time: '2026-08-07 11:08:47',
    status: '已确认',
  },
  {
    key: '9',
    username: 'zheng.yi',
    type: '异常时间',
    score: 52,
    method: '3σ',
    time: '2026-08-07 09:22:13',
    status: '误报',
  },
  {
    key: '10',
    username: 'huo.er',
    type: '高频操作',
    score: 35,
    method: 'IQR',
    time: '2026-08-06 20:47:59',
    status: '待调查',
  },
];

/**
 * Mock 用户风险排行数据（Top 5）
 */
const mockRiskRanks: UserRiskRank[] = [
  { key: '1', username: 'zhang.san', score: 92, count: 15 },
  { key: '2', username: 'wu.shi', score: 88, count: 12 },
  { key: '3', username: 'li.si', score: 85, count: 10 },
  { key: '4', username: 'wang.wu', score: 78, count: 8 },
  { key: '5', username: 'chen.liu', score: 65, count: 6 },
];

/**
 * 异常类型颜色映射
 */
const anomalyTypeColor: Record<AnomalyType, string> = {
  '异常登录': commonStyle.error,
  '权限滥用': commonStyle.warning,
  '数据外泄': commonStyle.purple,
  '异常时间': commonStyle.info,
  '高频操作': '#FADB14',
};

/**
 * 检测方法颜色映射
 */
const methodColor: Record<DetectionMethod, string> = {
  'IQR': '#F0F2F5',
  '3σ': '#FFF7E6',
  'Z-Score': '#F9F0FF',
};

/**
 * 风险评分颜色
 */
const getScoreColor = (score: number): string => {
  if (score >= 80) return commonStyle.error;
  if (score >= 60) return commonStyle.warning;
  if (score >= 40) return '#FADB14';
  return commonStyle.info;
};

/**
 * 状态渲染
 */
const renderStatus = (status: EventStatus) => {
  const statusMap: Record<EventStatus, { color: string; icon: React.ReactNode }> = {
    '待调查': { color: '#BFBFBF', icon: <SearchOutlined /> },
    '已确认': { color: commonStyle.success, icon: <CheckCircleOutlined /> },
    '误报': { color: commonStyle.info, icon: <CloseCircleOutlined /> },
  };
  const s = statusMap[status];
  return <Tag color={s.color}>{s.icon} {status}</Tag>;
};

const UEBAPage: React.FC = () => {
  const [typeFilter, setTypeFilter] = useState<AnomalyType | 'all'>('all');
  const [levelFilter, setLevelFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [configForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [config] = useState<DetectionConfig>({
    method: 'Z-Score',
    sensitivity: 5,
    baselineDays: 30,
  });

  /**
   * 过滤事件数据
   */
  const filteredEvents = useMemo(() => {
    let data = mockEvents;
    if (typeFilter !== 'all') {
      data = data.filter((e) => e.type === typeFilter);
    }
    if (levelFilter === 'high') {
      data = data.filter((e) => e.score >= 80);
    } else if (levelFilter === 'medium') {
      data = data.filter((e) => e.score >= 40 && e.score < 80);
    } else if (levelFilter === 'low') {
      data = data.filter((e) => e.score < 40);
    }
    return data;
  }, [typeFilter, levelFilter]);

  /**
   * 统计指标
   */
  const monitoredUsers = 128;
  const anomalyEvents = mockEvents.length;
  const highRiskUsers = mockRiskRanks.filter((u) => u.score >= 80).length;
  const modelAccuracy = 94.7;

  /**
   * 表格列定义
   */
  const columns: ColumnsType<AnomalyEvent> = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text: string) => (
        <Space size={6}>
          <UserOutlined style={{ color: commonStyle.neutral }} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '异常类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: AnomalyType) => <Tag color={anomalyTypeColor[type]}>{type}</Tag>,
    },
    {
      title: '风险评分',
      dataIndex: 'score',
      key: 'score',
      render: (score: number) => {
        const color = getScoreColor(score);
        return (
          <Space size={6}>
            <Text strong style={{ color }}>
              {score}
            </Text>
            <Progress
              percent={score}
              size="small"
              strokeColor={color}
              trailColor="#f0f0f0"
              style={{ width: 60 }}
            />
          </Space>
        );
      },
    },
    {
      title: '检测方法',
      dataIndex: 'method',
      key: 'method',
      render: (method: DetectionMethod) => <Tag color={methodColor[method]}>{method}</Tag>,
    },
    {
      title: '发生时间',
      dataIndex: 'time',
      key: 'time',
      render: (text: string) => <Text type="secondary">{text}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: EventStatus) => renderStatus(status),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record: AnomalyEvent) => (
        <Space size={6}>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            style={{ color: commonStyle.primary }}
            onClick={() => message.info(`查看 ${record.username} 的异常详情`)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CheckCircleOutlined />}
            style={{ color: commonStyle.success }}
            disabled={record.status === '已确认'}
            onClick={() => {
              message.success(`已确认 ${record.username} 的异常事件`);
            }}
          >
            确认异常
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CloseCircleOutlined />}
            style={{ color: commonStyle.info }}
            disabled={record.status === '误报'}
            onClick={() => {
              message.info(`已将 ${record.username} 的异常标记为误报`);
            }}
          >
            误报
          </Button>
        </Space>
      ),
    },
  ];

  /**
   * 保存检测模型配置
   */
  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      await new Promise((resolve) => setTimeout(resolve, 800));
      message.success('检测模型配置保存成功，模型将重新训练');
    } catch {
      message.error('保存配置失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 渲染排行项
   */
  const renderRankItem = (user: UserRiskRank, index: number) => {
    const scoreColor = getScoreColor(user.score);
    return (
      <div
        key={user.key}
        style={{
          padding: `${spacing.sm}px ${spacing.md}px`,
          borderRadius: 8,
          backgroundColor: index === 0 ? colors.error[50] : colors.light.bg.secondary,
          border: index === 0 ? `1px solid ${colors.error[100]}` : 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <Space size={8}>
            <Text
              strong
              style={{
                fontSize: 14,
                color: index < 3 ? scoreColor : commonStyle.neutral,
              }}
            >
              #{index + 1}
            </Text>
            <UserOutlined style={{ color: scoreColor }} />
            <Text strong>{user.username}</Text>
          </Space>
          <Space size={4}>
            <Text type="secondary">异常 {user.count} 次</Text>
            <Text strong style={{ color: scoreColor }}>
              {user.score}
            </Text>
          </Space>
        </div>
        <Progress
          percent={user.score}
          strokeColor={scoreColor}
          trailColor="#f0f0f0"
          showInfo={false}
        />
      </div>
    );
  };

  return (
    <div>
      <Title level={2} style={{ marginBottom: 8 }}>
        <UserSwitchOutlined style={{ marginRight: 12, color: commonStyle.error }} />
        UEBA 用户行为异常检测
      </Title>
      <Text type="secondary">行为基线学习 · 离群值检测 · 风险评分</Text>

      <Divider />

      {/* 顶部统计卡片 */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              borderLeft: `3px solid ${commonStyle.primary}`,
            }}
          >
            <Statistic
              title="监控用户数"
              value={monitoredUsers}
              valueStyle={{ color: commonStyle.primary }}
              suffix={<Text type="secondary" style={{ fontSize: 14 }}>人</Text>}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              borderLeft: `3px solid ${commonStyle.error}`,
            }}
          >
            <Statistic
              title="异常事件数"
              value={anomalyEvents}
              valueStyle={{ color: commonStyle.error }}
              suffix={<Text type="secondary" style={{ fontSize: 14 }}>起</Text>}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              borderLeft: `3px solid ${commonStyle.warning}`,
            }}
          >
            <Statistic
              title="高危用户数"
              value={highRiskUsers}
              valueStyle={{ color: commonStyle.warning }}
              suffix={<Text type="secondary" style={{ fontSize: 14 }}>人</Text>}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              borderLeft: `3px solid ${commonStyle.success}`,
            }}
          >
            <Statistic
              title="检测模型准确率"
              value={modelAccuracy}
              precision={1}
              valueStyle={{ color: commonStyle.success }}
              suffix={<Text type="secondary" style={{ fontSize: 14 }}>%</Text>}
            />
          </Card>
        </Col>
      </Row>

      {/* 中部主体：异常事件列表 + 风险排行 */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.lg }}>
        <Col span={14}>
          <Card
            title={
              <Space>
                <RadarChartOutlined />
                <span>异常事件列表</span>
              </Space>
            }
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ marginBottom: spacing.md, display: 'flex', gap: spacing.sm }}>
              <Select
                placeholder="筛选异常类型"
                value={typeFilter}
                onChange={setTypeFilter}
                style={{ width: 180 }}
              >
                <Option value="all">全部类型</Option>
                <Option value="异常登录">异常登录</Option>
                <Option value="权限滥用">权限滥用</Option>
                <Option value="数据外泄">数据外泄</Option>
                <Option value="异常时间">异常时间</Option>
                <Option value="高频操作">高频操作</Option>
              </Select>
              <Select
                placeholder="筛选风险等级"
                value={levelFilter}
                onChange={setLevelFilter}
                style={{ width: 160 }}
              >
                <Option value="all">全部等级</Option>
                <Option value="high">高风险 (&gt;=80)</Option>
                <Option value="medium">中风险 (40-79)</Option>
                <Option value="low">低风险 (&lt;40)</Option>
              </Select>
            </div>

            <Table
              columns={columns}
              dataSource={filteredEvents}
              rowKey="key"
              size="small"
              pagination={{ pageSize: 8, showSizeChanger: false, showQuickJumper: true }}
              scroll={{ x: 1000 }}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        </Col>

        <Col span={10}>
          <Card
            title={
              <Space>
                <WarningOutlined />
                <span>Top 5 高风险用户</span>
              </Space>
            }
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
              {mockRiskRanks.map((user, index) => renderRankItem(user, index))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 底部：检测模型配置 */}
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>检测模型配置</span>
          </Space>
        }
        style={{
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <Form
          form={configForm}
          layout="horizontal"
          initialValues={config}
          style={{ maxWidth: 700, margin: '0 auto' }}
        >
          <Row gutter={[spacing.lg, spacing.md]}>
            <Col span={8}>
              <Form.Item label="检测方法" name="method">
                <Radio.Group>
                  <Radio value="IQR">IQR</Radio>
                  <Radio value="3σ">3σ</Radio>
                  <Radio value="Z-Score">Z-Score</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="阈值灵敏度"
                name="sensitivity"
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value) return Promise.reject(new Error('请输入灵敏度值'));
                      if (value < 1 || value > 10)
                        return Promise.reject(new Error('灵敏度必须在 1-10 之间'));
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <InputNumber
                  min={1}
                  max={10}
                  style={{ width: '100%' }}
                  addonAfter="级"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="基线学习周期" name="baselineDays">
                <Select placeholder="选择基线学习周期">
                  <Option value={7}>7天</Option>
                  <Option value={14}>14天</Option>
                  <Option value={30}>30天</Option>
                  <Option value={90}>90天</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ textAlign: 'right', marginTop: spacing.sm }}>
            <Button
              type="primary"
              icon={<ExclamationCircleOutlined />}
              loading={saving}
              onClick={handleSaveConfig}
              style={{
                backgroundColor: commonStyle.primary,
                borderColor: commonStyle.primary,
                minWidth: 120,
              }}
            >
              保存配置
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default UEBAPage;
