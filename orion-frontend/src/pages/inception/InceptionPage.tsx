/**
 * SQL Audit Engine (Inception) Page
 *
 * Provides SQL input, auditing, parsing, execution (dry-run and real),
 * and audit history viewing through the Inception engine.
 */

import React, { useState, useEffect } from 'react';
import { inceptionApi, SqlAuditResult, SqlParseResult, SqlExecuteResult, AuditRecord } from '@/api/inception';
import { Card, Input, Button, Space, Table, Tag, message, Spin, Row, Col, Badge, Descriptions } from 'antd';
import {
  SearchOutlined,
  CodeOutlined,
  PlayCircleOutlined,
  SafetyCertificateOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';

const { TextArea } = Input;

// ==================== Risk level badge helper ====================

const RiskBadge: React.FC<{ level: 'low' | 'medium' | 'high' }> = ({ level }) => {
  const colorMap = { low: 'green', medium: 'orange', high: 'red' };
  const labelMap = { low: '低风险', medium: '中风险', high: '高风险' };
  return <Tag color={colorMap[level]}>{labelMap[level]}</Tag>;
};

// ==================== Main Component ====================

const InceptionPage: React.FC = () => {
  // Connection state
  const [status, setStatus] = useState<{ connected: boolean; host: string; port: number } | null>(null);

  // SQL input
  const [sql, setSql] = useState('');
  const [database, setDatabase] = useState<string>('');
  const [databases, setDatabases] = useState<string[]>([]);

  // Action state
  const [loading, setLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<SqlAuditResult | null>(null);
  const [parseResult, setParseResult] = useState<SqlParseResult | null>(null);
  const [executeResult, setExecuteResult] = useState<SqlExecuteResult | null>(null);
  const [resultTab, setResultTab] = useState<string>('none'); // 'audit' | 'parse' | 'execute' | 'none'

  // History state
  const [history, setHistory] = useState<AuditRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  // ==================== Effects ====================

  useEffect(() => {
    loadStatus();
    loadDatabases();
    loadHistory(1, pagination.pageSize);
  }, []);

  // ==================== Data loading ====================

  const loadStatus = async () => {
    try {
      const res = await inceptionApi.status();
      setStatus(res.data as { connected: boolean; host: string; port: number });
    } catch {
      // If status endpoint is unavailable, fallback to health check
      try {
        await inceptionApi.health();
        setStatus({ connected: true, host: 'unknown', port: 0 });
      } catch {
        setStatus({ connected: false, host: 'unknown', port: 0 });
      }
    }
  };

  const loadDatabases = async () => {
    try {
      const res = await inceptionApi.listDatabases();
      const data = res.data as { databases: string[] };
      setDatabases(data?.databases || []);
    } catch {
      // Databases endpoint may not be available yet
      setDatabases([]);
    }
  };

  const loadHistory = async (page: number, pageSize: number) => {
    setHistoryLoading(true);
    try {
      const res = await inceptionApi.history({ page, limit: pageSize });
      const data = res.data as { records: AuditRecord[]; total: number };
      setHistory(data?.records || []);
      setPagination((prev) => ({ ...prev, current: page, total: data?.total || 0 }));
    } catch {
      message.error('加载审计历史失败');
    } finally {
      setHistoryLoading(false);
    }
  };

  // ==================== Action handlers ====================

  const handleAudit = async () => {
    if (!sql.trim()) {
      message.warning('请输入 SQL 语句');
      return;
    }
    setLoading(true);
    try {
      const res = await inceptionApi.audit(sql, database || undefined);
      setAuditResult(res.data as SqlAuditResult);
      setResultTab('audit');
      message.success('SQL 审计完成');
      loadHistory(1, pagination.pageSize);
    } catch {
      message.error('SQL 审计失败');
    } finally {
      setLoading(false);
    }
  };

  const handleParse = async () => {
    if (!sql.trim()) {
      message.warning('请输入 SQL 语句');
      return;
    }
    setLoading(true);
    try {
      const res = await inceptionApi.parse(sql);
      setParseResult(res.data as SqlParseResult);
      setResultTab('parse');
      message.success('SQL 解析完成');
    } catch {
      message.error('SQL 解析失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (dryRun: boolean) => {
    if (!sql.trim()) {
      message.warning('请输入 SQL 语句');
      return;
    }
    setLoading(true);
    try {
      const res = await inceptionApi.execute(
        sql,
        database || undefined,
        dryRun
      );
      setExecuteResult(res.data as SqlExecuteResult);
      setResultTab('execute');
      message.success(dryRun ? 'Dry Run 执行完成' : 'SQL 执行完成');
      loadHistory(1, pagination.pageSize);
    } catch {
      message.error(dryRun ? 'Dry Run 执行失败' : 'SQL 执行失败');
    } finally {
      setLoading(false);
    }
  };

  // ==================== History table pagination ====================

  const handleHistoryChange = (page: number, pageSize?: number) => {
    loadHistory(page, pageSize || pagination.pageSize);
  };

  // ==================== Column definitions ====================

  const historyColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => <code style={{ fontSize: 12 }}>{id.slice(0, 8)}</code>,
    },
    {
      title: 'SQL',
      dataIndex: 'sql',
      key: 'sql',
      ellipsis: true,
      render: (sqlText: string) => (
        <code style={{ fontSize: 12, color: colors.neutral[600] }}>{sqlText.slice(0, 80)}{sqlText.length > 80 ? '...' : ''}</code>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          passed: { color: 'success', text: '通过' },
          failed: { color: 'error', text: '失败' },
          warning: { color: 'warning', text: '警告' },
        };
        const s = statusMap[status] || { color: 'default', text: status };
        return <Badge status={s.color as 'success' | 'error' | 'warning' | 'default'} text={s.text} />;
      },
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 100,
      render: (level: string) => {
        const colorMap: Record<string, string> = { low: 'green', medium: 'orange', high: 'red' };
        const labelMap: Record<string, string> = { low: '低', medium: '中', high: '高' };
        return <Tag color={colorMap[level] || 'default'}>{labelMap[level] || level}</Tag>;
      },
    },
    {
      title: '执行人',
      dataIndex: 'executedBy',
      key: 'executedBy',
      width: 120,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (d: string) => new Date(d).toLocaleString(),
    },
  ];

  // ==================== Render ====================

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={16}>
          <h2 style={{ margin: 0 }}>
            <SafetyCertificateOutlined style={{ marginRight: 8, color: '#3370E6' }} />
            SQL 审计引擎 (Inception)
          </h2>
        </Col>
        <Col span={8} style={{ textAlign: 'right', lineHeight: '32px' }}>
          {status !== null ? (
            <Badge
              status={status.connected ? 'success' : 'default'}
              text={status.connected ? `已连接 (${status.host}:${status.port})` : '未连接'}
            />
          ) : (
            <Spin size="small" />
          )}
        </Col>
      </Row>

      {/* SQL Input & Results */}
      <Row gutter={16}>
        {/* Left: SQL Input */}
        <Col span={12}>
          <Card title="SQL 输入" extra={
            <Space>
              {databases.length > 0 && (
                <Input.Select
                  allowClear
                  placeholder="选择数据库"
                  style={{ width: 160 }}
                  value={database}
                  onChange={(v) => setDatabase(v || '')}
                  options={databases.map((d) => ({ value: d, label: d }))}
                />
              )}
            </Space>
          }>
            <TextArea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              placeholder="-- 在此输入 SQL 语句&#10;SELECT * FROM users WHERE id = 1;"
              style={{
                fontFamily: 'monospace',
                fontSize: 14,
                minHeight: 200,
                marginBottom: 16,
              }}
            />
            <Space wrap>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleAudit}
                loading={loading}
              >
                审计 SQL
              </Button>
              <Button
                icon={<CodeOutlined />}
                onClick={handleParse}
                loading={loading}
              >
                解析 SQL
              </Button>
              <Button
                icon={<PlayCircleOutlined />}
                onClick={() => handleExecute(true)}
                loading={loading}
              >
                执行 SQL (Dry Run)
              </Button>
              <Button
                danger
                icon={<DatabaseOutlined />}
                onClick={() => handleExecute(false)}
                loading={loading}
              >
                执行 SQL
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => { setSql(''); setAuditResult(null); setParseResult(null); setExecuteResult(null); setResultTab('none'); }}>
                清空
              </Button>
            </Space>
          </Card>
        </Col>

        {/* Right: Results Panel */}
        <Col span={12}>
          <Card title="执行结果">
            <Spin spinning={loading}>
              {resultTab === 'none' && (
                <div style={{ textAlign: 'center', color: colors.neutral[500], padding: '60px 0' }}>
                  输入 SQL 并点击操作按钮查看结果
                </div>
              )}

              {/* Audit Results */}
              {resultTab === 'audit' && auditResult && (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <Space>
                      <span>风险等级:</span>
                      <RiskBadge level={auditResult.riskLevel} />
                    </Space>
                  </div>

                  {/* Errors Table */}
                  {auditResult.errors.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <h4 style={{ color: colors.error[500], marginBottom: 8 }}>错误 ({auditResult.errors.length})</h4>
                      <Table
                        bordered
                        size="small"
                        dataSource={auditResult.errors}
                        rowKey={(_, i) => `error-${i}`}
                        pagination={false}
                        columns={[
                          { title: '级别', dataIndex: 'level', key: 'level', width: 80, render: (l: string) => <Tag color="red">{l}</Tag> },
                          { title: '行号', dataIndex: 'line', key: 'line', width: 70 },
                          { title: '信息', dataIndex: 'message', key: 'message' },
                        ]}
                      />
                    </div>
                  )}

                  {/* Warnings Table */}
                  {auditResult.warnings.length > 0 && (
                    <div>
                      <h4 style={{ color: colors.warning[500], marginBottom: 8 }}>警告 ({auditResult.warnings.length})</h4>
                      <Table
                        bordered
                        size="small"
                        dataSource={auditResult.warnings}
                        rowKey={(_, i) => `warn-${i}`}
                        pagination={false}
                        columns={[
                          { title: '级别', dataIndex: 'level', key: 'level', width: 80, render: (l: string) => <Tag color="orange">{l}</Tag> },
                          { title: '行号', dataIndex: 'line', key: 'line', width: 70 },
                          { title: '信息', dataIndex: 'message', key: 'message' },
                        ]}
                      />
                    </div>
                  )}

                  {auditResult.errors.length === 0 && auditResult.warnings.length === 0 && (
                    <Tag color="green">SQL 检查通过，无错误或警告</Tag>
                  )}
                </div>
              )}

              {/* Parse Results */}
              {resultTab === 'parse' && parseResult && (
                <div>
                  <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
                    <Descriptions.Item label="SQL 类型">{parseResult.type}</Descriptions.Item>
                    <Descriptions.Item label="解析状态">
                      {parseResult.success ? (
                        <Tag color="green">成功</Tag>
                      ) : (
                        <Tag color="red">失败</Tag>
                      )}
                    </Descriptions.Item>
                  </Descriptions>
                  {parseResult.formatted && (
                    <div>
                      <h4 style={{ marginBottom: 8 }}>格式化后的 SQL</h4>
                      <pre
                        style={{
                          fontFamily: 'monospace',
                          fontSize: 13,
                          background: colors.neutral[100],
                          padding: 12,
                          borderRadius: 4,
                          maxHeight: 300,
                          overflow: 'auto',
                        }}
                      >
                        {parseResult.formatted}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Execute Results */}
              {resultTab === 'execute' && executeResult && (
                <div>
                  <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
                    <Descriptions.Item label="执行状态">
                      {executeResult.success ? (
                        <Tag color="green">成功</Tag>
                      ) : (
                        <Tag color="red">失败</Tag>
                      )}
                    </Descriptions.Item>
                    {executeResult.affectedRows !== undefined && (
                      <Descriptions.Item label="影响行数">{executeResult.affectedRows}</Descriptions.Item>
                    )}
                  </Descriptions>

                  {executeResult.message && (
                    <div style={{ marginBottom: 16 }}>
                      <Tag color="blue">{executeResult.message}</Tag>
                    </div>
                  )}

                  {executeResult.result && executeResult.result.length > 0 && (
                    <div>
                      <h4 style={{ marginBottom: 8 }}>查询结果 ({executeResult.result.length} 条)</h4>
                      <Table
                        bordered
                        size="small"
                        dataSource={executeResult.result}
                        rowKey={(_, i) => `row-${i}`}
                        pagination={{ pageSize: 10 }}
                        scroll={{ x: 600 }}
                      />
                    </div>
                  )}

                  {executeResult.success && !executeResult.result && !executeResult.message && (
                    <Tag color="green">执行成功</Tag>
                  )}
                </div>
              )}
            </Spin>
          </Card>
        </Col>
      </Row>

      {/* History Section */}
      <Card
        title={<><HistoryOutlined style={{ marginRight: 8 }} />审计历史</>}
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => loadHistory(pagination.current, pagination.pageSize)}>
            刷新
          </Button>
        }
        style={{ marginTop: 16 }}
      >
        <Table
          columns={historyColumns}
          dataSource={history}
          rowKey="id"
          loading={historyLoading}
          bordered
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total: number) => `共 ${total} 条`,
            onChange: handleHistoryChange,
            onShowSizeChange: handleHistoryChange,
          }}
        />
      </Card>
    </div>
  );
};

export default InceptionPage;
