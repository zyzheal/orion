/**
 * Audit History Page - Admin skill audit log viewer
 *
 * Features:
 * - Table of audit logs
 * - Filter by action, date range
 * - Show actor, action, timestamp, reason
 */
import React, { useState, useMemo, useEffect } from 'react';
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
  Select,
  DatePicker,
} from 'antd';
import { ReloadOutlined, FileTextOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { spacing, colors } from '@/tokens';
import Table, { type TableColumn } from '@/components/Table';
import { getAllAuditHistory } from '@/api/skills';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// Action type definitions
const actionLabels: Record<string, string> = {
  submit: '提交审核',
  approve: '审核通过',
  reject: '审核拒绝',
  archive: '归档',
  create: '创建',
  update: '更新',
  delete: '删除',
  install: '安装',
  uninstall: '卸载',
  execute: '执行',
  instance_create: '创建实例',
  instance_update: '更新实例',
  instance_delete: '删除实例',
};

const actionColors: Record<string, string> = {
  submit: 'blue',
  approve: 'green',
  reject: 'red',
  archive: 'default',
  create: 'cyan',
  update: 'orange',
  delete: 'red',
  install: 'purple',
  uninstall: 'default',
  execute: 'geekblue',
  instance_create: 'cyan',
  instance_update: 'orange',
  instance_delete: 'red',
};

const AuditHistory: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  // Detail modal
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getAllAuditHistory({ page, limit: 50 });
      const data = res.data;
      const items = data.logs || [];
      setAuditLogs(Array.isArray(items) ? items : []);
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
  }, [page]);

  // Client-side filtering
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      if (dateRange && dateRange[0] && dateRange[1]) {
        const logDate = dayjs(log.createdAt || log.timestamp);
        if (logDate.isBefore(dateRange[0]) || logDate.isAfter(dateRange[1].endOf('day'))) {
          return false;
        }
      }
      return true;
    });
  }, [auditLogs, actionFilter, dateRange]);

  // Get unique actions for filter
  const uniqueActions = useMemo(() => {
    const actions = new Set<string>();
    auditLogs.forEach((log) => {
      if (log.action) actions.add(log.action);
    });
    return Array.from(actions);
  }, [auditLogs]);

  const columns: TableColumn<any>[] = [
    {
      key: 'action',
      title: '操作类型',
      dataIndex: 'action',
      width: 140,
      render: (v: unknown) => (
        <Tag color={actionColors[String(v)] || 'default'}>
          {actionLabels[String(v)] || String(v)}
        </Tag>
      ),
    },
    {
      key: 'skillName',
      title: '技能名称',
      dataIndex: 'skillName',
      width: 180,
      render: (v: unknown, record) => (
        <Text strong>{v || record.skillId || '-'}</Text>
      ),
    },
    {
      key: 'actor',
      title: '操作人',
      dataIndex: 'actor',
      width: 140,
      render: (v: unknown) => (
        <Text code>{String(v) || '系统'}</Text>
      ),
    },
    {
      key: 'reason',
      title: '原因/备注',
      dataIndex: 'reason',
      width: 240,
      render: (v: unknown) =>
        v ? (
          <Text type="secondary" style={{ fontSize: spacing[2] }}>
            {String(v).slice(0, 80)}{String(v).length > 80 ? '...' : ''}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      key: 'action_detail',
      title: '操作详情',
      dataIndex: 'action',
      width: 160,
      render: (v: unknown) => {
        const action = String(v);
        const isPositive = ['approve', 'create', 'install', 'instance_create'].includes(action);
        const isNegative = ['reject', 'delete', 'archive', 'uninstall', 'instance_delete'].includes(action);
        const color = isPositive ? 'success' : isNegative ? 'error' : 'default';
        const label = actionLabels[action] || action;
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      key: 'createdAt',
      title: '操作时间',
      dataIndex: 'createdAt',
      width: 180,
      sortable: true,
      render: (v: unknown, record) => {
        const time = v || record.timestamp;
        return (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: spacing[3] }}>
              {dayjs(String(time)).format('YYYY-MM-DD HH:mm')}
            </Text>
            <Text type="secondary" style={{ fontSize: spacing[2] }}>
              {dayjs(String(time)).fromNow()}
            </Text>
          </Space>
        );
      },
    },
    {
      key: 'actions',
      title: '操作',
      width: 80,
      render: (_: unknown, record) => (
        <Button
          type="link"
          size="small"
          icon={<FileTextOutlined />}
          onClick={() => {
            setSelectedLog(record);
            setDetailModalVisible(true);
          }}
        >
          详情
        </Button>
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
          <Title level={2} style={{ marginBottom: 8 }}>
            <ThunderboltOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            审核历史
          </Title>
          <Text type="secondary">所有技能相关的审核操作记录</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总记录数" value={total} suffix="条" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="通过"
              value={auditLogs.filter((l) => l.action === 'approve').length}
              suffix="条"
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="拒绝"
              value={auditLogs.filter((l) => l.action === 'reject').length}
              suffix="条"
              valueStyle={{ color: colors.error[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="执行"
              value={auditLogs.filter((l) => l.action === 'execute').length}
              suffix="条"
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Space size="middle" wrap>
          <span>操作类型：</span>
          <Select
            style={{ width: 160 }}
            value={actionFilter}
            onChange={setActionFilter}
            options={[
              { label: '全部', value: 'all' },
              ...uniqueActions.map((a) => ({
                label: actionLabels[a] || a,
                value: a,
              })),
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

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredLogs}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
          pagination={{
            current: page,
            pageSize: 50,
            total,
          }}
          onPaginationChange={(p) => setPage(p)}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="操作详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={<Button onClick={() => setDetailModalVisible(false)}>关闭</Button>}
        width={600}
      >
        {selectedLog && (
          <div>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <Text strong>操作类型：</Text>
                <Tag color={actionColors[selectedLog.action] || 'default'}>
                  {actionLabels[selectedLog.action] || selectedLog.action}
                </Tag>
              </div>
              <div>
                <Text strong>技能：</Text>
                <Text>{selectedLog.skillName || selectedLog.skillId || '-'}</Text>
              </div>
              <div>
                <Text strong>操作人：</Text>
                <Text code>{selectedLog.actor || '系统'}</Text>
              </div>
              {selectedLog.reason && (
                <div>
                  <Text strong>原因：</Text>
                  <Text>{selectedLog.reason}</Text>
                </div>
              )}
              <div>
                <Text strong>状态变更：</Text>
                <Text>
                  {selectedLog.oldStatus || '-'} → {selectedLog.newStatus || '-'}
                </Text>
              </div>
              <div>
                <Text strong>时间：</Text>
                <Text>
                  {dayjs(selectedLog.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                </Text>
              </div>
              {selectedLog.details && (
                <Card title="详细信息" size="small">
                  <pre style={{ fontSize: 12, background: colors.neutral[100], padding: 8, borderRadius: 4 }}>
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </Card>
              )}
            </Space>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AuditHistory;
