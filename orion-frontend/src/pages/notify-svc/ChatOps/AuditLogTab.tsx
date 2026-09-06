/**
 * AuditLogTab - 审计日志
 * 抽取自 AdminSettings.tsx (P2-9 Phase 41)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Input,
  Typography,
  message,
  Empty,
  Tooltip,
} from 'antd';
import { SearchOutlined, ReloadOutlined, AuditOutlined } from '@ant-design/icons';
import { getAuditLogs, type AuditLog, type AuditLogListParams } from '@/api/chatops';
import { colors, spacing, themeVars } from '@/tokens';
import dayjs from 'dayjs';

const { Text } = Typography;

export const AuditLogTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filters, setFilters] = useState<AuditLogListParams>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: AuditLogListParams = {
        page: 1,
        perPage: 50,
        ...filters,
      };
      const res = await getAuditLogs(params);
      const data = res.data ?? [];
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      message.error('获取审计日志失败');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const columns = [
    {
      title: '操作者',
      key: 'actor',
      width: 140,
      render: (_: unknown, record: AuditLog) => {
        const actor = typeof record.actor === 'string' ? record.actor : record.actor?.userId || '-';
        return <Text code>{actor}</Text>;
      },
    },
    {
      title: '命令',
      key: 'command',
      width: 140,
      render: (_: unknown, record: AuditLog) => {
        const action =
          typeof record.action === 'string' ? record.action : record.action?.command || '-';
        return <Text code>/{action}</Text>;
      },
    },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      width: 90,
      render: (v: string) => (
        <Tag color={v === 'success' ? colors.success[500] : colors.error[400]}>{v || '-'}</Tag>
      ),
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 160,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Text>
      ),
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
      render: (v: string) => (
        <Tooltip title={v}>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            {v || '-'}
          </Text>
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.md,
        }}
      >
        <Space>
          <AuditOutlined style={{ color: colors.info[500], fontSize: 18 }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: themeVars.textPrimary }}>
            审计日志
          </span>
        </Space>
        <Space>
          <Input
            prefix={<SearchOutlined />}
            placeholder="搜索命令"
            value={filters.command}
            onChange={(e) => setFilters((prev) => ({ ...prev, command: e.target.value }))}
            style={{ width: 200 }}
            allowClear
          />
          <Input
            placeholder="用户 ID"
            value={filters.userId}
            onChange={(e) => setFilters((prev) => ({ ...prev, userId: e.target.value }))}
            style={{ width: 160 }}
            allowClear
          />
        </Space>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      <Card bodyStyle={{ padding: '0 24px 24px' }}>
        {logs.length === 0 && !loading ? (
          <Empty description="暂无审计日志" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            columns={columns}
            dataSource={logs}
            rowKey="id"
            loading={loading}
            size="middle"
            pagination={
              {
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`,
              } as const
            }
          />
        )}
      </Card>
    </div>
  );
};
