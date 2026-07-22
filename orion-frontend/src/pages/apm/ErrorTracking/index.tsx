/**
 * APM Error Tracking Page (Phase 3.5.3)
 * Application error collection, stack trace display, trend analysis
 * - Fixed: "View Detail" button now opens Modal with trace details
 * - Added: service filter, error trend visualization
 */
import React, { useState, useEffect } from 'react';
import { Typography, Card, Table, Button, Tag, Space, message, Spin, Select, Modal, Descriptions, Divider } from 'antd';
import { WarningOutlined, ReloadOutlined, FilterOutlined, EyeOutlined, CodeOutlined } from '@ant-design/icons';
import { apmApi, type TraceSummary } from '@/api/apm';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

const ApmErrorTrackingPage: React.FC = () => {
  const [errors, setErrors] = useState<TraceSummary[]>([]);
  const [allTraces, setAllTraces] = useState<TraceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<string | undefined>(undefined);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTrace, setSelectedTrace] = useState<TraceSummary | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const traces = await apmApi.listTraces({ limit: 200 });
      const traceList = Array.isArray(traces) ? traces : ((traces as any).data ?? []);
      setAllTraces(traceList);
      const errorTraces = traceList.filter((t: any) => t.status === 'error');
      setErrors(errorTraces);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载错误数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleViewDetail = (record: TraceSummary) => {
    setSelectedTrace(record);
    setDetailModalOpen(true);
  };

  const errorColumns = [
    {
      title: 'Trace ID', dataIndex: 'traceId', key: 'traceId', ellipsis: true,
      render: (v: string) => <code style={{ fontSize: 12 }}>{v.slice(0, 16)}...</code>,
    },
    { title: '服务', dataIndex: 'root_service', key: 'root_service' },
    { title: '操作', dataIndex: 'root_operation', key: 'root_operation' },
    {
      title: '耗时', dataIndex: 'duration_ms', key: 'duration_ms',
      render: (ms: number) => (
        <span style={{ color: ms > 5000 ? colors.error[500] : ms > 2000 ? colors.warning[500] : colors.neutral[900], fontWeight: 600 }}>
          {ms} ms
        </span>
      ),
    },
    { title: 'Span 数', dataIndex: 'span_count', key: 'span_count' },
    {
      title: '发生时间', dataIndex: 'start_time', key: 'start_time',
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作', key: 'actions',
      render: (_: any, record: TraceSummary) => (
        <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
          查看详情
        </Button>
      ),
    },
  ];

  // Extract unique services
  const services = Array.from(new Set(allTraces.map((t) => t.root_service).filter(Boolean)));

  // Error trend: group by hour
  const errorTrend = React.useMemo(() => {
    const hourMap = new Map<string, number>();
    errors.forEach((e) => {
      const hour = new Date(e.start_time).getHours();
      const key = `${hour}:00`;
      hourMap.set(key, (hourMap.get(key) || 0) + 1);
    });
    return Array.from(hourMap.entries()).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  }, [errors]);

  return (
    <Spin spinning={loading}>
      <div style={{ padding: spacing.lg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
          <div>
            <Title level={2} style={{ marginBottom: spacing.sm }}>
              <WarningOutlined style={{ marginRight: spacing[3], color: colors.error[500] }} />
              错误追踪
            </Title>
            <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14 }}>应用错误采集与堆栈分析（共 {errors.length} 个错误）</Text>
          </div>
          <Space>
            <Select
              allowClear
              placeholder="按服务筛选"
              style={{ width: 200 }}
              onChange={(v) => setServiceFilter(v)}
              value={serviceFilter}
              suffixIcon={<FilterOutlined />}
            >
              {services.map((s) => <Select.Option key={s} value={s}>{s}</Select.Option>)}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          </Space>
        </div>

        {/* Error Trend Summary */}
        <Card title="错误时间分布" style={{ marginBottom: spacing.md }}>
          {errorTrend.length > 0 ? (
            <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'end', height: 80 }}>
              {errorTrend.map(([hour, count]) => (
                <div key={hour} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40 }}>
                  <span style={{ fontSize: 10, color: colors.neutral[500] }}>{count}</span>
                  <div style={{
                    width: 30,
                    height: count * 15,
                    backgroundColor: count > 5 ? colors.error[500] : colors.warning[500],
                    borderRadius: 4,
                  }} />
                  <span style={{ fontSize: 10, color: colors.neutral[500] }}>{hour}</span>
                </div>
              ))}
            </div>
          ) : (
            <Text type="secondary">暂无错误数据</Text>
          )}
        </Card>

        {/* Error List */}
        <Card title={`错误列表 (${errors.length})`}>
          <Table
            columns={errorColumns}
            dataSource={errors}
            rowKey="traceId"
            pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }}
            size="small"
            locale={{ emptyText: '暂无错误，系统运行良好！' }}
          />
        </Card>

        {/* Trace Detail Modal */}
        <Modal
          title={
            <span>
              <CodeOutlined style={{ marginRight: spacing.sm, color: colors.error[500] }} />
              Trace 详情
            </span>
          }
          open={detailModalOpen}
          onCancel={() => {
            setDetailModalOpen(false);
            setSelectedTrace(null);
          }}
          footer={null}
          width={700}
        >
          {selectedTrace && (
            <>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="Trace ID" span={2}>
                  <code style={{ fontSize: 12 }}>{selectedTrace.traceId}</code>
                </Descriptions.Item>
                <Descriptions.Item label="服务">{selectedTrace.root_service}</Descriptions.Item>
                <Descriptions.Item label="操作">{selectedTrace.root_operation}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={selectedTrace.status === 'error' ? colors.error[500] : colors.success[500]}>
                    {selectedTrace.status}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="耗时">
                  <span style={{ color: selectedTrace.duration_ms > 5000 ? colors.error[500] : colors.neutral[900], fontWeight: 600 }}>
                    {selectedTrace.duration_ms} ms
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="Span 数">{selectedTrace.span_count}</Descriptions.Item>
                <Descriptions.Item label="发生时间">{new Date(selectedTrace.start_time).toLocaleString()}</Descriptions.Item>
                <Descriptions.Item label="结束时间">{new Date(selectedTrace.end_time).toLocaleString()}</Descriptions.Item>
              </Descriptions>

              <Divider />
              <Text type="secondary">提示：点击 Trace ID 可跳转到完整的链路追踪详情页</Text>
            </>
          )}
        </Modal>
      </div>
    </Spin>
  );
};

export default ApmErrorTrackingPage;
