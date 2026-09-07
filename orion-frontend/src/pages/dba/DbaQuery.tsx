/**
 * DBA Paged Query + Excel Export page
 *
 * Lets DBAs run SELECT queries with cursor pagination and export the
 * full result set to a signed Excel URL. The audit engine runs before
 * execution and blocks disallowed statements (DROP, TRUNCATE, ...).
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Input,
  Select,
  message,
  Table,
  Spin,
  Empty,
  Alert,
  Descriptions,
  Row,
  Col,
  InputNumber,
} from 'antd';
import {
  PlayCircleOutlined,
  ReloadOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import {
  listDataSources,
  executePagedQuery,
  exportToExcel,
  getExportStatus,
  type DataSource,
  type PagedQueryResult,
  type ExportResult,
} from '@/api/dba';

const { Title, Text } = Typography;

const DbaQuery: React.FC = () => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [dsLoading, setDsLoading] = useState(false);

  const [dataSourceId, setDataSourceId] = useState<string>('');
  const [sql, setSql] = useState('');
  const [pageSize, setPageSize] = useState<number>(100);
  const [running, setRunning] = useState(false);
  const [pageToken, setPageToken] = useState<string | undefined>(undefined);

  const [result, setResult] = useState<PagedQueryResult | null>(null);
  const [history, setHistory] = useState<PagedQueryResult[]>([]);

  // Export job
  const [exportJob, setExportJob] = useState<ExportResult | null>(null);
  const [exportPolling, setExportPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Data sources ----

  const loadDataSources = useCallback(async () => {
    setDsLoading(true);
    try {
      const res = await listDataSources('default');
      const list = (res.data as DataSource[]) ?? [];
      setDataSources(Array.isArray(list) ? list : []);
    } catch (err) {
      setDataSources([]);
      message.error(`加载数据源失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setDsLoading(false);
    }
  }, []);

  const loadInitial = async () => {
    await loadDataSources();
  };

  // ---- Execute ----

  const runQuery = async (reset = false) => {
    if (reset) {
      setPageToken(undefined);
      setHistory([]);
    }
    if (!dataSourceId) {
      message.warning('请选择数据源');
      return;
    }
    if (!sql.trim()) {
      message.warning('请输入 SQL');
      return;
    }
    setRunning(true);
    try {
      const res = await executePagedQuery({
        sql,
        data_source_id: dataSourceId,
        page_size: pageSize,
        page_token: pageToken,
      });
      const r = res.data as PagedQueryResult;
      setResult(r);
      setHistory((prev) => [...prev, r]);
    } catch (err) {
      message.error(`查询失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setRunning(false);
    }
  };

  // ---- Export ----

  const startExport = async () => {
    if (!dataSourceId || !sql.trim()) {
      message.warning('请先填写数据源和 SQL');
      return;
    }
    try {
      setExportPolling(true);
      const res = await exportToExcel({ sql, data_source_id: dataSourceId, max_rows: 100000 });
      setExportJob(res.data as ExportResult);
      if (res.data?.id && res.data?.status !== 'done' && res.data?.status !== 'failed') {
        pollExport(res.data.id);
      }
    } catch (err) {
      message.error(`启动导出失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const pollExport = (jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await getExportStatus(jobId);
        const j = res.data as ExportResult;
        setExportJob(j);
        if (j.status === 'done' || j.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setExportPolling(false);
          if (j.status === 'done') {
            message.success(`导出完成，共 ${j.rows_exported ?? 0} 行`);
          } else {
            message.error(`导出失败: ${j.error ?? '未知错误'}`);
          }
        }
      } catch {
        /* transient errors are swallowed until terminal */
      }
    }, 2000);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setExportPolling(false);
  };

  // Cleanup polling on unmount + load data sources on mount
  useEffect(() => {
    void loadInitial();
    return stopPolling;
  }, []);

  const columns = result
    ? result.columns.map((c, i) => ({
        key: c.name,
        title: (
          <Space size={4}>
            <span>{c.name}</span>
            <Tag style={{ fontSize: 10, padding: '0 4px' }} color="geekblue">
              {c.data_type}
            </Tag>
          </Space>
        ),
        dataIndex: 'data',
        render: (_: unknown, row: { data: unknown[] }) => {
          const v = row?.data?.[i];
          if (v === null || v === undefined) return <Text type="secondary">NULL</Text>;
          return <Text code style={{ fontSize: 12 }}>{String(v)}</Text>;
        },
        ellipsis: true,
      }))
    : [];

  const tableData = (result?.rows ?? []).map((r, i) => ({ key: i, data: r as unknown[] }));

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <TableOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
          数据库查询 (分页 + 导出)
        </Title>
        <Text type="secondary">带游标分页的 SELECT 查询与 Excel 导出</Text>
      </div>

      <Row gutter={16} style={{ marginBottom: spacing.md }}>
        <Col xs={24} md={8}>
          <Card size="small" title="数据源">
            <Select
              style={{ width: '100%' }}
              loading={dsLoading}
              placeholder="选择数据源"
              value={dataSourceId || undefined}
              onChange={setDataSourceId}
              options={dataSources.map((ds) => ({
                label: `${ds.name} (${ds.host}:${ds.port})`,
                value: ds.id,
              }))}
              notFoundContent="暂无数据源"
              allowClear
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" title="分页大小">
            <InputNumber
              style={{ width: '100%' }}
              min={10}
              max={1000}
              value={pageSize}
              onChange={(v) => setPageSize(v ?? 100)}
              step={10}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" title="导出任务">
            {exportJob ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>
                  状态:{' '}
                  {exportJob.status === 'done' ? (
                    <Tag icon={<CheckCircleOutlined />} color="success">完成</Tag>
                  ) : exportJob.status === 'failed' ? (
                    <Tag icon={<CloseCircleOutlined />} color="error">失败</Tag>
                  ) : (
                    <Tag icon={<LoadingOutlined />} color="processing">{exportJob.status}</Tag>
                  )}
                </Text>
                {exportJob.file_url && (
                  <a href={exportJob.file_url} target="_blank" rel="noopener noreferrer">
                    下载 Excel
                  </a>
                )}
                {exportJob.rows_exported !== undefined && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {exportJob.rows_exported} 行
                  </Text>
                )}
                {exportJob.error && (
                  <Alert type="error" message={exportJob.error} showIcon style={{ padding: '4px 8px' }} />
                )}
              </Space>
            ) : (
              <Empty description="暂无导出任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: spacing.md }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
          <Text strong style={{ width: 80 }}>SQL:</Text>
          <Input.TextArea
            rows={6}
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            placeholder="SELECT * FROM orders WHERE tenant_id = '...' LIMIT 100;"
            style={{ fontFamily: 'monospace', fontSize: 13 }}
            disabled={running}
          />
        </div>
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={running}
            onClick={() => runQuery(true)}
          >
            执行
          </Button>
          {pageToken && (
            <Button
              icon={<ReloadOutlined />}
              loading={running}
              onClick={() => runQuery(false)}
            >
              下一页
            </Button>
          )}
          <Button
            icon={<DownloadOutlined />}
            loading={exportPolling}
            onClick={startExport}
            disabled={!dataSourceId || !sql.trim()}
          >
            导出 Excel
          </Button>
        </Space>
      </Card>

      {result && (
        <Card
          size="small"
          title={
            <Space>
              <Text>结果</Text>
              <Text type="secondary">
                {result.rows.length} 行 · {result.query_ms}ms
              </Text>
              {result.truncated && <Tag color="warning">已截断</Tag>}
              {result.total > 0 && (
                <Tag color="blue">总 {result.total}</Tag>
              )}
            </Space>
          }
        >
          <Spin spinning={running}>
            {result.rows.length === 0 ? (
              <Empty description="查询无结果" />
            ) : (
              <Table
                columns={columns}
                dataSource={tableData}
                rowKey="key"
                size="small"
                pagination={false}
                scroll={{ x: 'max-content' }}
              />
            )}
          </Spin>
        </Card>
      )}

      {history.length > 1 && (
        <Card size="small" title={`查询历史 (${history.length})`} style={{ marginTop: spacing.md }}>
          <Descriptions
            bordered
            size="small"
            column={2}
            items={history.map((h, i) => ({
              key: `h${i}`,
              label: `#${history.length - i}`,
              children: (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {h.rows.length} 行 · {h.query_ms}ms
                </Text>
              ),
            }))}
          />
        </Card>
      )}
    </div>
  );
};

export default DbaQuery;
