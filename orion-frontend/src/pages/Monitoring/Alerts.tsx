/**
 * Monitoring Alerts Page
 * List and manage active alerts with acknowledge, resolve, and escalate actions
 */
import React, { useState, useEffect } from 'react';
import { Typography, Button, Space, Tag, Modal, Form, Input, message } from 'antd';
import {
  ReloadOutlined,
  BellOutlined,
  CheckOutlined,
  CloseOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { getAlerts, acknowledgeAlert, resolveAlert, escalateAlert } from '@/api/monitoring';
import type { Alert } from '@/api/monitoring';
import { spacing } from '@/tokens';
import { colors } from '@/tokens';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const severityConfig: Record<string, { color: string; label: string }> = {
  critical: { color: 'red', label: '严重' },
  warning: { color: 'orange', label: '警告' },
  info: { color: 'blue', label: '提示' },
};

const statusConfig: Record<string, { color: string; label: string }> = {
  active: { color: 'red', label: '活跃' },
  acknowledged: { color: 'orange', label: '已确认' },
  resolved: { color: 'green', label: '已解决' },
};

const MonitoringAlerts: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [escalateModalVisible, setEscalateModalVisible] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [escalateForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await getAlerts();
      const apiData = response.data.data;
      setAlerts(Array.isArray(apiData) ? apiData : []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载告警失败：${error.message}`);
      } else {
        message.error('加载告警失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredAlerts = React.useMemo(() => {
    return alerts.filter((a) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [a.ruleName, a.ruleId, a.severity, a.status].join(' ').toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      const severityFilter = filters.severity;
      if (severityFilter && severityFilter !== 'all' && a.severity !== severityFilter) return false;
      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all' && a.status !== statusFilter) return false;
      return true;
    });
  }, [searchQuery, filters, alerts]);

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
      ],
    },
  ];

  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeAlert(id);
      message.success('告警已确认');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`确认告警失败：${error.message}`);
      } else {
        message.error('确认告警失败，请稍后重试');
      }
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await resolveAlert(id);
      message.success('告警已解决');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`解决告警失败：${error.message}`);
      } else {
        message.error('解决告警失败，请稍后重试');
      }
    }
  };

  const handleEscalate = async (values: any) => {
    if (!selectedAlert) return;
    try {
      await escalateAlert(selectedAlert.id, values);
      message.success('告警已升级');
      setEscalateModalVisible(false);
      escalateForm.resetFields();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`升级告警失败：${error.message}`);
      } else {
        message.error('升级告警失败，请稍后重试');
      }
    }
  };

  const columns: TableColumn<Alert>[] = [
    {
      key: 'severity',
      title: '级别',
      dataIndex: 'severity',
      width: 90,
      render: (v: unknown) => {
        const cfg = severityConfig[String(v)];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      key: 'ruleName',
      title: '规则名称',
      dataIndex: 'ruleName',
      sortable: true,
      filterable: true,
      render: (v: unknown) => <Text strong>{v as string}</Text>,
    },
    {
      key: 'ruleId',
      title: '规则ID',
      dataIndex: 'ruleId',
      width: 120,
      render: (v: unknown) => (
        <Text code style={{ fontSize: spacing[3] }}>
          {v as string}
        </Text>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (v: unknown) => {
        const cfg = statusConfig[String(v)];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      key: 'triggeredAt',
      title: '触发时间',
      dataIndex: 'triggeredAt',
      sortable: true,
      width: 160,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(v as string).format('YYYY-MM-DD HH:mm:ss')}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 180,
      render: (_, record: Alert) => (
        <Space size="small">
          {record.status === 'active' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleAcknowledge(record.id)}
              >
                确认
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => handleResolve(record.id)}
              >
                解决
              </Button>
            </>
          )}
          <Button
            type="link"
            size="small"
            icon={<ArrowUpOutlined />}
            onClick={() => {
              setSelectedAlert(record);
              setEscalateModalVisible(true);
            }}
          >
            升级
          </Button>
        </Space>
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
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <BellOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            <BellOutlined style={{ marginRight: 8 }} />
            告警列表
          </Title>
          <Text type="secondary">共 {filteredAlerts.length} 条告警</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="搜索规则名称、ID..."
        />
      </div>

      <Table
        columns={columns}
        dataSource={filteredAlerts}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />

      {/* Escalate Modal */}
      <Modal
        title="升级告警"
        open={escalateModalVisible}
        onCancel={() => setEscalateModalVisible(false)}
        footer={null}
        width={480}
      >
        {selectedAlert && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">告警:</Text> <Text strong>{selectedAlert.ruleName}</Text>
              <br />
              <Tag color={severityConfig[selectedAlert.severity]?.color}>
                {severityConfig[selectedAlert.severity]?.label}
              </Tag>
            </div>
            <Form form={escalateForm} layout="vertical" onFinish={handleEscalate}>
              <Form.Item
                name="reason"
                label="升级原因"
                rules={[{ required: true, message: '请输入升级原因' }]}
              >
                <Input.TextArea rows={3} placeholder="请描述升级原因..." />
              </Form.Item>
              <Form.Item name="target" label="目标人员">
                <Input placeholder="可选，指定升级目标" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block>
                  提交升级
                </Button>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
};

export default MonitoringAlerts;
