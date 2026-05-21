/**
 * Session Management Page
 * User session monitoring and management (view, revoke, filter)
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Select,
  Input,
  message,
  Popconfirm,
  Tooltip,
  Descriptions,
  Drawer,
} from 'antd';
import {
  ReloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CheckCircleOutlined,
  StopOutlined,
  SearchOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import MetricCard from '@/components/MetricCard';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import duration from 'dayjs/plugin/duration';
import { getSessions, getSessionStats, deleteSession as apiDeleteSession } from '@/api/session';
import type { Session as ApiSession, SessionStats as ApiSessionStats } from '@/api/session';

dayjs.extend(relativeTime);
dayjs.extend(duration);

const { Title, Text } = Typography;

// ---- Types ----

interface UserSession {
  id: string;
  userId: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  startedAt: string;
  lastActive: string;
  status: 'active' | 'expired' | 'revoked';
  duration: number; // in seconds
}

interface SessionStats {
  activeSessions: number;
  totalUsers: number;
  expiredSessions: number;
  avgDuration: number; // in seconds
}

type SessionStatus = UserSession['status'];

// ---- Color maps ----

const statusColorMap: Record<SessionStatus, string> = {
  active: 'success',
  expired: 'default',
  revoked: 'error',
};

const statusLabelMap: Record<SessionStatus, string> = {
  active: '活跃',
  expired: '已过期',
  revoked: '已撤销',
};

const statusIconMap: Record<SessionStatus, React.ReactNode> = {
  active: <CheckCircleOutlined />,
  expired: <ClockCircleOutlined />,
  revoked: <StopOutlined />,
};

// ---- API mapping helpers ----

const deriveStatus = (session: ApiSession): 'active' | 'expired' | 'revoked' => {
  if (session.expiresAt && dayjs(session.expiresAt).isBefore(dayjs())) {
    return 'expired';
  }
  return 'active';
};

const mapApiSession = (apiSession: ApiSession): UserSession => ({
  id: apiSession.id,
  userId: apiSession.userId,
  sessionId: apiSession.token?.substring(0, 12) || apiSession.id,
  ipAddress: apiSession.ipAddress || 'unknown',
  userAgent: apiSession.userAgent || 'unknown',
  startedAt: apiSession.createdAt,
  lastActive: apiSession.lastAccessedAt,
  status: deriveStatus(apiSession),
  duration: dayjs(apiSession.lastAccessedAt).diff(dayjs(apiSession.createdAt), 'second'),
});

const mapApiStats = (apiStats: ApiSessionStats): SessionStats => ({
  activeSessions: apiStats.active || 0,
  totalUsers: apiStats.total || 0,
  expiredSessions: apiStats.expired || 0,
  avgDuration: 0,
});

// ---- Helper: Format duration ----

const formatDuration = (seconds: number): string => {
  const dur = dayjs.duration(seconds * 1000);
  const hours = dur.hours();
  const minutes = dur.minutes();
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

// ---- Main Component ----

const SessionManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedSession, setSelectedSession] = useState<UserSession | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsRes, statsRes] = await Promise.all([getSessions(), getSessionStats()]);
      const sessionsData = sessionsRes.data?.data?.sessions || sessionsRes.data?.data || [];
      const statsData = statsRes.data?.data?.stats || statsRes.data?.data || {};
      setSessions(Array.isArray(sessionsData) ? sessionsData.map(mapApiSession) : []);
      setStats(mapApiStats(statsData as ApiSessionStats));
    } catch (error: unknown) {
      message.error(`加载 Session 数据失败: ${(error as Error).message}`);
      setSessions([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !s.userId.toLowerCase().includes(q) &&
          !s.sessionId.toLowerCase().includes(q) &&
          !s.ipAddress.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [sessions, statusFilter, searchQuery]);

  const openDetail = (session: UserSession) => {
    setSelectedSession(session);
    setDetailDrawerVisible(true);
  };

  const handleRevoke = async (id: string) => {
    try {
      await apiDeleteSession(id);
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: 'revoked' as const } : s))
      );
      message.success('会话已撤销');
      if (selectedSession?.id === id) {
        setSelectedSession((prev) => (prev ? { ...prev, status: 'revoked' as const } : prev));
      }
    } catch (error: unknown) {
      message.error(`撤销失败: ${(error as Error).message}`);
    }
  };

  // ---- Table columns ----

  const columns: TableColumn<UserSession>[] = [
    {
      key: 'user',
      title: '用户',
      dataIndex: 'userId',
      width: 180,
      render: (v: unknown) => (
        <Space>
          <UserOutlined style={{ color: colors.neutral[400] }} />
          <Text strong style={{ fontSize: 13 }}>
            {String(v)}
          </Text>
        </Space>
      ),
    },
    {
      key: 'sessionId',
      title: 'Session ID',
      dataIndex: 'sessionId',
      width: 140,
      render: (v: unknown) => (
        <Text code style={{ fontSize: 11 }}>
          {String(v).substring(0, 8)}...
        </Text>
      ),
    },
    {
      key: 'ipAddress',
      title: 'IP 地址',
      dataIndex: 'ipAddress',
      width: 130,
      render: (v: unknown) => (
        <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(v)}</Text>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_v: unknown, record: UserSession) => (
        <Tag color={statusColorMap[record.status]} icon={statusIconMap[record.status]}>
          {statusLabelMap[record.status]}
        </Tag>
      ),
    },
    {
      key: 'startedAt',
      title: '开始时间',
      dataIndex: 'startedAt',
      width: 140,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(String(v)).format('MM-DD HH:mm')}
        </Text>
      ),
    },
    {
      key: 'lastActive',
      title: '最后活跃',
      dataIndex: 'lastActive',
      width: 130,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(String(v)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'duration',
      title: '时长',
      dataIndex: 'duration',
      width: 80,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatDuration(typeof v === 'number' ? v : 0)}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 120,
      render: (_: unknown, record: UserSession) => (
        <Space size="small" wrap>
          <Tooltip title="详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openDetail(record)}
            >
              详情
            </Button>
          </Tooltip>
          {record.status === 'active' && (
            <Popconfirm title="确认撤销该会话?" onConfirm={() => handleRevoke(record.id)}>
              <Tooltip title="撤销会话">
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                  撤销
                </Button>
              </Tooltip>
            </Popconfirm>
          )}
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
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <ClockCircleOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            Session Management
          </Title>
          <Text type="secondary">用户会话管理</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: spacing.md,
            marginBottom: spacing.lg,
          }}
        >
          <MetricCard
            title="活跃会话"
            value={stats.activeSessions}
            icon={<CheckCircleOutlined />}
            color={colors.success[500]}
            size="medium"
          />
          <MetricCard
            title="总用户数"
            value={stats.totalUsers}
            icon={<UserOutlined />}
            color={colors.primary[500]}
            size="medium"
          />
          <MetricCard
            title="已过期会话"
            value={stats.expiredSessions}
            icon={<ClockCircleOutlined />}
            color={colors.neutral[400]}
            size="medium"
          />
          <MetricCard
            title="平均时长"
            value={formatDuration(stats.avgDuration)}
            icon={<ClockCircleOutlined />}
            color={colors.purple[500]}
            size="medium"
          />
        </div>
      )}

      {/* Filters */}
      <Card size="small" style={{ marginBottom: spacing.md }}>
        <Space wrap>
          <Input
            placeholder="搜索用户、Session ID 或 IP 地址..."
            allowClear
            prefix={<SearchOutlined />}
            style={{ width: 280 }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Text>
            <FilterOutlined /> 状态:
          </Text>
          <Select
            style={{ width: 130 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: '全部', value: 'all' },
              { label: '活跃', value: 'active' },
              { label: '已过期', value: 'expired' },
              { label: '已撤销', value: 'revoked' },
            ]}
          />
        </Space>
      </Card>

      {/* Session Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredSessions}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Session Detail Drawer */}
      <Drawer
        title="会话详情"
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={640}
        destroyOnClose
      >
        {selectedSession && (
          <>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="用户" span={2}>
                <Space>
                  <UserOutlined style={{ color: colors.neutral[400] }} />
                  <Text strong>{selectedSession.userId}</Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Session ID" span={2}>
                <Text code>{selectedSession.sessionId}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="IP 地址">
                <Text style={{ fontFamily: 'monospace' }}>{selectedSession.ipAddress}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag
                  color={statusColorMap[selectedSession.status]}
                  icon={statusIconMap[selectedSession.status]}
                >
                  {statusLabelMap[selectedSession.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="浏览器" span={2}>
                {selectedSession.userAgent}
              </Descriptions.Item>
              <Descriptions.Item label="开始时间" span={2}>
                {dayjs(selectedSession.startedAt).format('YYYY-MM-DD HH:mm:ss')}
                <Text type="secondary" style={{ marginLeft: spacing.sm }}>
                  ({dayjs(selectedSession.startedAt).fromNow()})
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="最后活跃" span={2}>
                {dayjs(selectedSession.lastActive).format('YYYY-MM-DD HH:mm:ss')}
                <Text type="secondary" style={{ marginLeft: spacing.sm }}>
                  ({dayjs(selectedSession.lastActive).fromNow()})
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="会话时长">
                {formatDuration(selectedSession.duration)}
              </Descriptions.Item>
            </Descriptions>

            {/* Action button for active sessions */}
            {selectedSession.status === 'active' && (
              <div style={{ marginTop: spacing.lg }}>
                <Popconfirm
                  title="确认撤销该会话？"
                  description="撤销后用户需要重新登录"
                  onConfirm={() => {
                    handleRevoke(selectedSession.id);
                    setDetailDrawerVisible(false);
                  }}
                >
                  <Button danger icon={<DeleteOutlined />}>
                    撤销会话
                  </Button>
                </Popconfirm>
              </div>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
};

export default SessionManagement;
