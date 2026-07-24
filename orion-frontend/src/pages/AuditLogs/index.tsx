/**
 * Pipeline Audit Log Page
 * Pipeline execution audit trail for forensic analysis
 */
import React, { useState, useEffect } from 'react';
import {
  Typography, Button, Space, Tag, message, Table, Modal, Form, Input, Select, DatePicker,
  Descriptions, Timeline, Card, Divider, InputNumber,
} from 'antd';
import {
  ReloadOutlined, EyeOutlined, SearchOutlined, ClearOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import {
  getAuditLogs, getRunAuditTrail, cleanupAuditLogs,
  type PipelineAuditLog, type AuditLogFilter, type AuditAction, type AuditOutcome,
  type AuditTrailEntry,
} from '@/api/audit-logs';

const { Title, Text } = Typography;

const actionColor: Record<string, string> = {
  'stage.start': 'blue', 'stage.complete': 'green', 'stage.fail': 'red', 'stage.skip': 'orange',
  'task.start': 'blue', 'task.complete': 'green', 'task.fail': 'red', 'task.skip': 'orange',
  'approval.request': 'purple', 'approval.approve': 'green', 'approval.reject': 'red',
  'trigger.fire': 'cyan', 'run.create': 'blue', 'run.cancel': 'red', 'run.complete': 'green',
};

const outcomeIcon: Record<string, string> = {
  success: '✓', failed: '✗', pending: '⋯',
};

const AuditLogsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<PipelineAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState<PipelineAuditLog | null>(null);
  const [trail, setTrail] = useState<PipelineAuditLog[] | AuditTrailEntry[]>([]);
  const [retentionDays, setRetentionDays] = useState(90);
  const [form] = Form.useForm();

  const loadLogs = async () => {
    setLoading(true);
    try {
      const values = form.getFieldsValue();
      const params: AuditLogFilter = {
        ...(values.runId && { runId: values.runId }),
        ...(values.action && { action: values.action }),
        ...(values.outcome && { outcome: values.outcome }),
        limit: 20,
        offset: (page - 1) * 20,
      };
      if (values.dateRange && values.dateRange.length === 2) {
        params.startTime = values.dateRange[0].toISOString();
        params.endTime = values.dateRange[1].toISOString();
      }
      const res = await getAuditLogs(params);
      setLogs(res.data?.data || []);
      setTotal(res.data?.total || 0);
    } catch {
      message.error('加载审计日志失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, [page]);

  const handleSearch = () => { setPage(1); loadLogs(); };

  const handleReset = () => { form.resetFields(); setPage(1); loadLogs(); };

  const handleViewDetail = async (log: PipelineAuditLog) => {
    if (!log.runId) {
      message.warning('该日志缺少 Run ID，无法查看轨迹');
      return;
    }
    setSelectedLog(log);
    setDetailVisible(true);
    try {
      const res = await getRunAuditTrail(log.runId);
      setTrail(res.data || []);
    } catch {
      setTrail([]);
    }
  };

  const handleCleanup = () => {
    Modal.confirm({
      title: '清理过期日志',
      content: `将删除 ${retentionDays} 天前的审计日志，确认继续？`,
      okText: '清理',
      okType: 'danger',
      onOk: async () => {
        try {
          const res = await cleanupAuditLogs(retentionDays);
          message.success(`已清理 ${res.data?.deleted || 0} 条日志`);
          loadLogs();
        } catch {
          message.error('清理失败');
        }
      },
    });
  };

  const allActions: { value: AuditAction; label: string }[] = [
    { value: 'stage.start', label: 'Stage Start' },
    { value: 'stage.complete', label: 'Stage Complete' },
    { value: 'stage.fail', label: 'Stage Fail' },
    { value: 'task.start', label: 'Task Start' },
    { value: 'task.complete', label: 'Task Complete' },
    { value: 'task.fail', label: 'Task Fail' },
    { value: 'approval.request', label: 'Approval Request' },
    { value: 'approval.approve', label: 'Approval Approve' },
    { value: 'approval.reject', label: 'Approval Reject' },
    { value: 'trigger.fire', label: 'Trigger Fire' },
    { value: 'run.create', label: 'Run Create' },
    { value: 'run.cancel', label: 'Run Cancel' },
    { value: 'run.complete', label: 'Run Complete' },
  ];

  const allOutcomes: { value: AuditOutcome; label: string }[] = [
    { value: 'success', label: 'Success' },
    { value: 'failed', label: 'Failed' },
    { value: 'pending', label: 'Pending' },
  ];

  const columns = [
    {
      title: 'Time',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      width: 140,
      render: (a: AuditAction) => <Tag color={actionColor[a] || 'default'}>{a}</Tag>,
    },
    {
      title: 'Outcome',
      dataIndex: 'outcome',
      width: 90,
      render: (o: AuditOutcome) => (
        <Tag color={o === 'success' ? 'green' : o === 'failed' ? 'red' : 'orange'}>
          {outcomeIcon[o]} {o}
        </Tag>
      ),
    },
    {
      title: 'Actor',
      dataIndex: 'actor',
      width: 120,
    },
    {
      title: 'Run ID',
      dataIndex: 'runId',
      width: 100,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v.slice(0, 12)}...</Text>,
    },
    {
      title: 'Error',
      dataIndex: 'errorMessage',
      ellipsis: true,
      render: (v: string) => v ? <Text type="danger" style={{ fontSize: 12 }}>{v}</Text> : '-',
    },
    {
      title: 'Duration',
      dataIndex: 'durationMs',
      width: 90,
      render: (v: number) => v ? `${v}ms` : '-',
    },
    {
      title: '操作',
      width: 100,
      render: (_: unknown, r: PipelineAuditLog) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(r)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
        <div style={{ flex: 1 }}>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <AuditOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            流水线审计日志
          </Title>
          <Text type="secondary">Pipeline 执行审计轨迹，用于故障排查与合规分析</Text>
        </div>
        <Space>
          <InputNumber
            min={1}
            max={3650}
            value={retentionDays}
            onChange={(v) => setRetentionDays(v || 90)}
            style={{ width: 80 }}
          />
          <span style={{ color: colors.neutral[500], fontSize: 13 }}>天</span>
          <Button icon={<ClearOutlined />} onClick={handleCleanup}>
            清理过期
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadLogs} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: spacing.md }}>
        <Form form={form} layout="inline">
          <Form.Item name="runId" label="Run ID">
            <Input placeholder="Run ID" style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="action" label="Action">
            <Select placeholder="全部" allowClear style={{ width: 150 }}
              options={allActions} />
          </Form.Item>
          <Form.Item name="outcome" label="Outcome">
            <Select placeholder="全部" allowClear style={{ width: 120 }}
              options={allOutcomes} />
          </Form.Item>
          <Form.Item name="dateRange" label="时间范围">
            <DatePicker.RangePicker showTime />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                搜索
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Table
        columns={columns}
        dataSource={logs}
        loading={loading}
        rowKey="id"
        size="middle"
        pagination={{
          current: page,
          pageSize: 20,
          total,
          onChange: (p) => setPage(p),
        }}
      />

      {/* Detail Modal */}
      <Modal
        title={`审计详情 — ${selectedLog?.runId}`}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {selectedLog && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: spacing.md }}>
              <Descriptions.Item label="Run ID">{selectedLog.runId}</Descriptions.Item>
              <Descriptions.Item label="Action">
                <Tag color={actionColor[selectedLog.action]}>{selectedLog.action}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Actor">{selectedLog.actor}</Descriptions.Item>
              <Descriptions.Item label="Outcome">
                <Tag color={selectedLog.outcome === 'success' ? 'green' : selectedLog.outcome === 'failed' ? 'red' : 'orange'}>
                  {selectedLog.outcome}
                </Tag>
              </Descriptions.Item>
              {selectedLog.stageId && <Descriptions.Item label="Stage ID">{selectedLog.stageId}</Descriptions.Item>}
              {selectedLog.taskId && <Descriptions.Item label="Task ID">{selectedLog.taskId}</Descriptions.Item>}
              {selectedLog.durationMs && <Descriptions.Item label="Duration">{selectedLog.durationMs}ms</Descriptions.Item>}
              {selectedLog.errorMessage && (
                <Descriptions.Item label="Error" span={2} style={{ color: colors.error[500] }}>
                  {selectedLog.errorMessage}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Time" span={2}>
                {dayjs(selectedLog.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">运行轨迹</Divider>
            {trail.length > 0 ? (
              <Timeline style={{ maxHeight: 300, overflow: 'auto' }}>
                {trail.map((entry) => (
                  <Timeline.Item
                    key={entry.id}
                    color={entry.outcome === 'success' ? 'green' : entry.outcome === 'failed' ? 'red' : 'gray'}
                  >
                    <Text strong>{entry.action}</Text>
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      {entry.actor} · {dayjs(entry.createdAt).format('HH:mm:ss')}
                    </Text>
                    {entry.durationMs && <Text type="secondary"> · {entry.durationMs}ms</Text>}
                    {entry.errorMessage && (
                      <div style={{ color: colors.error[500], marginTop: 4, fontSize: 12 }}>{entry.errorMessage}</div>
                    )}
                  </Timeline.Item>
                ))}
              </Timeline>
            ) : (
              <Text type="secondary">该运行暂无更多轨迹记录</Text>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default AuditLogsPage;
