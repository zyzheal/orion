/**
 * Alert List Page (TASK-905)
 * Alert listing with severity filters, alert detail, and acknowledge/resolve actions.
 *
 * Features:
 * - Table with alert data (severity, metric, value, threshold, status, time)
 * - Severity-based color coding
 * - Acknowledge/resolve action buttons
 * - Status filtering
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Button, Space, Tag, Modal, message, Popconfirm } from 'antd';
import { colors, spacing } from '@/tokens';
import { ReloadOutlined, CheckOutlined, CloseOutlined, BellOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getAlerts,
  acknowledgeAlert as apiAcknowledgeAlert,
  resolveAlert as apiResolveAlert,
} from '@/api/alerts';
import type { Alert, AlertSeverity, AlertStatus } from '@/types/pages';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// Severity config
const severityConfig: Record<AlertSeverity, { color: string; label: string; icon: string }> = {
  critical: { color: colors.error[500], label: '严重', icon: '\u26A0' },
  warning: { color: colors.warning[500], label: '警告', icon: '\u26A1' },
  info: { color: colors.primary[500], label: '提示', icon: '\u2139' },
};

// Status config
const statusConfig: Record<AlertStatus, { color: string; label: string }> = {
  active: { color: 'red', label: '活跃' },
  acknowledged: { color: 'orange', label: '已确认' },
  resolved: { color: 'green', label: '已解决' },
  suppressed: { color: 'default', label: '已抑制' },
};

const AlertList: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Load alerts from API
  const loadAlerts = async () => {
    setLoading(true);
    try {
      const response = await getAlerts();
      const apiData = response.data.data;
      setAlerts(Array.isArray(apiData) ? apiData : (apiData as any).items || []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载告警列表失败：${error.message}`);
      } else {
        message.error('加载告警列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  // Filter alerts based on search and filters
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [alert.metric, alert.source, alert.message, alert.value]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      // Severity filter
      const severityFilter = filters.severity;
      if (severityFilter && severityFilter !== 'all' && alert.severity !== severityFilter) {
        return false;
      }

      // Status filter
      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all' && alert.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [searchQuery, filters, alerts]);

  // Filter definitions for SearchFilterBar
  const filterDefs: FilterDefinition[] = [
    {
      key: 'severity',
      label: '严重级别',
      options: [
        { label: '全部', value: 'all' },
        { label: '严重', value: 'critical' },
        { label: '警告', value: 'warning' },
        { label: '提示', value: 'info' },
      ],
    },
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: '活跃', value: 'active' },
        { label: '已确认', value: 'acknowledged' },
        { label: '已解决', value: 'resolved' },
        { label: '已抑制', value: 'suppressed' },
      ],
    },
  ];

  // Count active alerts by severity
  const severityCounts = useMemo(() => {
    return {
      critical: alerts.filter((a) => a.status === 'active' && a.severity === 'critical').length,
      warning: alerts.filter((a) => a.status === 'active' && a.severity === 'warning').length,
      info: alerts.filter((a) => a.status === 'active' && a.severity === 'info').length,
    };
  }, [alerts]);

  // Handle acknowledge
  const handleAcknowledge = async (alertId: string) => {
    try {
      await apiAcknowledgeAlert(alertId);
      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId
            ? {
                ...alert,
                status: 'acknowledged' as AlertStatus,
                acknowledgedBy: 'heal',
                acknowledgedAt: new Date().toISOString(),
              }
            : alert
        )
      );
      message.success('告警已确认');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`确认告警失败：${error.message}`);
      } else {
        message.error('确认告警失败，请稍后重试');
      }
    }
  };

  // Handle resolve
  const handleResolve = async (alertId: string) => {
    try {
      await apiResolveAlert(alertId);
      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId
            ? {
                ...alert,
                status: 'resolved' as AlertStatus,
                resolvedBy: 'heal',
                resolvedAt: new Date().toISOString(),
              }
            : alert
        )
      );
      message.success('告警已解决');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`解决告警失败：${error.message}`);
      } else {
        message.error('解决告警失败，请稍后重试');
      }
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    loadAlerts();
  };

  // Batch acknowledge selected alerts
  const handleBatchAcknowledge = async () => {
    if (selectedRowKeys.length === 0) return;
    let successCount = 0;
    for (const key of selectedRowKeys) {
      try {
        await apiAcknowledgeAlert(key as string);
        setAlerts((prev) =>
          prev.map((alert) =>
            alert.id === key
              ? {
                  ...alert,
                  status: 'acknowledged' as AlertStatus,
                  acknowledgedBy: 'heal',
                  acknowledgedAt: new Date().toISOString(),
                }
              : alert
          )
        );
        successCount++;
      } catch {
        // Continue with others
      }
    }
    message.success(`已批量确认 ${successCount}/${selectedRowKeys.length} 条告警`);
    setSelectedRowKeys([]);
  };

  // Batch resolve selected alerts
  const handleBatchResolve = async () => {
    if (selectedRowKeys.length === 0) return;
    let successCount = 0;
    for (const key of selectedRowKeys) {
      try {
        await apiResolveAlert(key as string);
        setAlerts((prev) =>
          prev.map((alert) =>
            alert.id === key
              ? {
                  ...alert,
                  status: 'resolved' as AlertStatus,
                  resolvedBy: 'heal',
                  resolvedAt: new Date().toISOString(),
                }
              : alert
          )
        );
        successCount++;
      } catch {
        // Continue with others
      }
    }
    message.success(`已批量解决 ${successCount}/${selectedRowKeys.length} 条告警`);
    setSelectedRowKeys([]);
  };

  // Count active alerts that can be batch operated
  const batchableCount = useMemo(() => {
    return alerts.filter(
      (a) =>
        selectedRowKeys.includes(a.id) && (a.status === 'active' || a.status === 'acknowledged')
    ).length;
  }, [alerts, selectedRowKeys]);

  // Row selection config
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
    getCheckboxProps: (record: Alert) => ({
      disabled: record.status === 'resolved' || record.status === 'suppressed',
    }),
  };

  // Show alert detail modal
  const showDetail = (alert: Alert) => {
    setSelectedAlert(alert);
    setDetailModalVisible(true);
  };

  // Table column definitions
  const columns: TableColumn<Alert>[] = [
    {
      key: 'severity',
      title: '级别',
      dataIndex: 'severity',
      width: 90,
      render: (value) => {
        const config = severityConfig[value as AlertSeverity];
        return (
          <Tag color={config.color} style={{ fontWeight: 600 }}>
            {config.icon} {config.label}
          </Tag>
        );
      },
    },
    {
      key: 'metric',
      title: '指标',
      dataIndex: 'metric',
      width: 160,
      sortable: true,
      filterable: true,
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ cursor: 'pointer', color: colors.primary[500] }}
            onClick={() => showDetail(record)}
          >
            {String(value)}
          </Text>
          <Text type="secondary" style={{ fontSize: spacing[2] }}>
            {record.source}
          </Text>
        </Space>
      ),
    },
    {
      key: 'value',
      title: '当前值',
      dataIndex: 'value',
      width: 100,
      render: (value) => (
        <Text strong style={{ color: colors.error[600] }}>
          {String(value)}
        </Text>
      ),
    },
    {
      key: 'threshold',
      title: '阈值',
      dataIndex: 'threshold',
      width: 100,
      render: (value) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {String(value)}
        </Text>
      ),
    },
    {
      key: 'message',
      title: '消息',
      dataIndex: 'message',
      render: (value: unknown) => (
        <Text style={{ fontSize: spacing[3] }} title={String(value)}>
          {String(value)}
        </Text>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value) => {
        const config = statusConfig[value as AlertStatus];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      key: 'lastUpdated',
      title: '更新时间',
      dataIndex: 'lastUpdated',
      width: 140,
      sortable: true,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      render: (_, record) => {
        const isActive = record.status === 'active';
        const isAcknowledged = record.status === 'acknowledged';
        return (
          <Space size="small">
            {isActive && (
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleAcknowledge(record.id)}
              >
                确认
              </Button>
            )}
            {(isActive || isAcknowledged) && (
              <Button
                type="link"
                size="small"
                icon={<CloseOutlined />}
                onClick={() => handleResolve(record.id)}
              >
                解决
              </Button>
            )}
            <Button type="link" size="small" onClick={() => showDetail(record)}>
              详情
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Page header with severity summary */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0, marginBottom: 8 }}>
            <BellOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            监控告警
          </Title>
          <Text type="secondary">共 {alerts.length} 条告警记录</Text>
          {/* Active alert summary */}
          {(severityCounts.critical > 0 || severityCounts.warning > 0) && (
            <div style={{ marginTop: 8 }}>
              <Space size={12}>
                {severityCounts.critical > 0 && (
                  <Tag color="red" style={{ fontWeight: 600 }}>
                    {severityCounts.critical} 个严重告警
                  </Tag>
                )}
                {severityCounts.warning > 0 && (
                  <Tag color="orange">{severityCounts.warning} 个警告</Tag>
                )}
                {severityCounts.info > 0 && <Tag color="blue">{severityCounts.info} 个提示</Tag>}
              </Space>
            </div>
          )}
        </div>
        <Space>
          {selectedRowKeys.length > 0 && (
            <>
              <Popconfirm
                title={`确认 ${selectedRowKeys.length} 条告警?`}
                onConfirm={handleBatchAcknowledge}
              >
                <Button icon={<CheckOutlined />} type="primary" ghost>
                  批量确认 ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
              <Popconfirm title={`解决 ${batchableCount} 条告警?`} onConfirm={handleBatchResolve}>
                <Button danger icon={<CloseOutlined />}>
                  批量解决
                </Button>
              </Popconfirm>
            </>
          )}
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Search and filter bar */}
      <div style={{ marginBottom: 16 }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="搜索指标名称、来源、消息..."
        />
      </div>

      {/* Alert table */}
      <Table
        columns={columns}
        dataSource={filteredAlerts}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
        rowSelection={rowSelection}
      />

      {/* Alert detail modal */}
      <Modal
        title="告警详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          selectedAlert && selectedAlert.status === 'active' && (
            <Button
              key="acknowledge"
              icon={<CheckOutlined />}
              onClick={() => {
                handleAcknowledge(selectedAlert.id);
                setDetailModalVisible(false);
              }}
            >
              确认告警
            </Button>
          ),
          selectedAlert &&
            (selectedAlert.status === 'active' || selectedAlert.status === 'acknowledged') && (
              <Button
                key="resolve"
                type="primary"
                danger
                icon={<CloseOutlined />}
                onClick={() => {
                  handleResolve(selectedAlert.id);
                  setDetailModalVisible(false);
                }}
              >
                解决告警
              </Button>
            ),
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {selectedAlert && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {/* Alert header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background:
                  selectedAlert.severity === 'critical'
                    ? 'rgba(245, 34, 45, 0.06)'
                    : selectedAlert.severity === 'warning'
                      ? 'rgba(250, 140, 22, 0.06)'
                      : 'rgba(24, 144, 255, 0.06)',
                borderRadius: 6,
              }}
            >
              <Tag color={severityConfig[selectedAlert.severity].color} style={{ fontWeight: 600 }}>
                {severityConfig[selectedAlert.severity].icon}{' '}
                {severityConfig[selectedAlert.severity].label}
              </Tag>
              <Tag color={statusConfig[selectedAlert.status].color}>
                {statusConfig[selectedAlert.status].label}
              </Tag>
            </div>

            {/* Detail info */}
            <div>
              <Text type="secondary" style={{ fontSize: spacing[3] }}>
                指标名称
              </Text>
              <div>
                <Text strong style={{ fontSize: spacing[4] }}>
                  {selectedAlert.metric}
                </Text>
              </div>
            </div>

            <div>
              <Text type="secondary" style={{ fontSize: spacing[3] }}>
                告警消息
              </Text>
              <div>
                <Text>{selectedAlert.message}</Text>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 32 }}>
              <div>
                <Text type="secondary" style={{ fontSize: spacing[3] }}>
                  当前值
                </Text>
                <div>
                  <Text strong style={{ color: colors.error[600], fontSize: spacing[5] }}>
                    {selectedAlert.value}
                  </Text>
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: spacing[3] }}>
                  阈值
                </Text>
                <div>
                  <Text>{selectedAlert.threshold}</Text>
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: spacing[3] }}>
                  来源
                </Text>
                <div>
                  <Text code>{selectedAlert.source}</Text>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 32 }}>
              <div>
                <Text type="secondary" style={{ fontSize: spacing[3] }}>
                  首次触发
                </Text>
                <div>
                  <Text style={{ fontSize: spacing[3] }}>
                    {dayjs(selectedAlert.firstTriggered).format('YYYY-MM-DD HH:mm:ss')}
                  </Text>
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: spacing[3] }}>
                  最后更新
                </Text>
                <div>
                  <Text style={{ fontSize: spacing[3] }}>
                    {dayjs(selectedAlert.lastUpdated).format('YYYY-MM-DD HH:mm:ss')}
                  </Text>
                </div>
              </div>
            </div>

            {selectedAlert.acknowledgedBy && (
              <div>
                <Text type="secondary" style={{ fontSize: spacing[3] }}>
                  确认信息
                </Text>
                <div>
                  <Text>
                    由 <Text code>{selectedAlert.acknowledgedBy}</Text> 于{' '}
                    {dayjs(selectedAlert.acknowledgedAt).format('YYYY-MM-DD HH:mm:ss')} 确认
                  </Text>
                </div>
              </div>
            )}

            {selectedAlert.resolvedBy && (
              <div>
                <Text type="secondary" style={{ fontSize: spacing[3] }}>
                  解决信息
                </Text>
                <div>
                  <Text>
                    由 <Text code>{selectedAlert.resolvedBy}</Text> 于{' '}
                    {dayjs(selectedAlert.resolvedAt).format('YYYY-MM-DD HH:mm:ss')} 解决
                  </Text>
                </div>
              </div>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default AlertList;
