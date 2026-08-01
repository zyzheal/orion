import { PermissionGuard } from '@/components/PermissionGuard';
/**
 * Database DevOps Page
 *
 * 数据库 DevOps 管理平台，包含 5 大功能：
 * 1. SQL 审核 - SQL 语句规范检查和执行计划分析
 * 2. 慢查询分析 - 慢查询日志统计和优化建议
 * 3. 敏感数据发现 - 自动识别敏感字段并脱敏
 * 4. Schema 变更管理 - 变更版本控制和审批流程
 * 5. 健康检查 - 数据库连接池、锁、死锁监控
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Col,
  Row,
  Table,
  Tag,
  Typography,
  Button,
  Space,
  Statistic,
  Tabs,
  Input,
  Select,
  Form,
  Modal,
  message,
  Tooltip,
  Descriptions,
  Alert,
  Empty,
  Badge,
  Divider,
} from 'antd';
import {
  DatabaseOutlined,
  AuditOutlined,
  ClockCircleOutlined,
  SafetyCertificateOutlined,
  CloudSyncOutlined,
  HeartOutlined,
  SearchOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  FileSearchOutlined,
  LockOutlined,
  PlayCircleOutlined,
  RollbackOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { componentRadius } from '@/tokens/radius';
import {
  auditSQL,
  getAuditStats,
  getAuditHistory,
  getAuditRules,
  updateAuditRule,
  getSlowQueryStats,
  getSlowQueryTopN,
  detectSensitiveData,
  maskSensitiveData,
  scanDatabaseSensitiveData,
  getScanHistory,
  getSensitiveDataStats,
  createSchemaChange,
  getSchemaChanges,
  getSchemaChangeStats,
  reviewSchemaChange,
  executeSchemaChange,
  rollbackSchemaChange,
  getDatabaseHealthCheck,
} from '@/api/database-devops';
import type {
  SQLAuditResult,
  SQLAuditStats,
  AuditRule,
  SlowQueryStats,
  SlowQueryTopN,
  SchemaChange,
  ChangeStats,
  HealthCheckResult,
  ScanReport,
  SensitiveDataStats,
} from '@/api/database-devops';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ==================== 状态配置 ====================

const _severityConfig: Record<string, { color: string; label: string }> = {
  info: { color: 'blue', label: '信息' },
  warning: { color: 'orange', label: '警告' },
  error: { color: 'red', label: '错误' },
  critical: { color: 'magenta', label: '严重' },
};
void _severityConfig;

const riskLevelConfig: Record<string, { color: string; label: string }> = {
  low: { color: 'green', label: '低风险' },
  medium: { color: 'orange', label: '中风险' },
  high: { color: 'red', label: '高风险' },
  critical: { color: 'magenta', label: '严重' },
};

const changeStatusConfig: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  pending_review: { color: 'processing', label: '待审批' },
  approved: { color: 'success', label: '已批准' },
  rejected: { color: 'error', label: '已拒绝' },
  executing: { color: 'processing', label: '执行中' },
  executed: { color: 'success', label: '已执行' },
  failed: { color: 'error', label: '执行失败' },
  rolled_back: { color: 'warning', label: '已回滚' },
};

const healthStatusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  healthy: { color: colors.success[500], icon: <CheckCircleOutlined /> },
  warning: { color: colors.warning[500], icon: <WarningOutlined /> },
  unhealthy: { color: colors.error[500], icon: <CloseCircleOutlined /> },
};

// ==================== 主页面组件 ====================

const DatabaseDevOpsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('sql-audit');

  return (
    <div style={{ padding: 0 }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 16 }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <DatabaseOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          数据库 DevOps
        </Title>
        <Text type="secondary" style={{ fontSize: 14, color: colors.neutral[500] }}>
          SQL 审核、慢查询分析、敏感数据发现、Schema 变更管理、健康检查
        </Text>
      </div>

      {/* 功能标签页 */}
      <Card
        bordered={false}
        style={{ borderRadius: componentRadius.card }}
        bodyStyle={{ padding: 0 }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ padding: '0 24px' }}
          items={[
            {
              key: 'sql-audit',
              label: (
                <span>
                  <AuditOutlined />
                  SQL 审核
                </span>
              ),
              children: <SQLAuditTab />,
            },
            {
              key: 'slow-query',
              label: (
                <span>
                  <ClockCircleOutlined />
                  慢查询分析
                </span>
              ),
              children: <SlowQueryTab />,
            },
            {
              key: 'sensitive-data',
              label: (
                <span>
                  <SafetyCertificateOutlined />
                  敏感数据发现
                </span>
              ),
              children: <SensitiveDataTab />,
            },
            {
              key: 'schema-change',
              label: (
                <span>
                  <CloudSyncOutlined />
                  Schema 变更
                </span>
              ),
              children: <SchemaChangeTab />,
            },
            {
              key: 'health-check',
              label: (
                <span>
                  <HeartOutlined />
                  健康检查
                </span>
              ),
              children: <HealthCheckTab />,
            },
          ]}
        />
      </Card>
    </div>
  );
};

// ==================== SQL 审核 Tab ====================

const SQLAuditTab: React.FC = () => {
  const [sql, setSql] = useState('');
  const [database, setDatabase] = useState('');
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<SQLAuditResult | null>(null);
  const [stats, setStats] = useState<SQLAuditStats | null>(null);
  const [history, setHistory] = useState<SQLAuditResult[]>([]);
  const [_rules, setRules] = useState<AuditRule[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoadingHistory(true);
    try {
      const [statsData, historyData, rulesData] = await Promise.all([
        getAuditStats(),
        getAuditHistory({ limit: 20 }),
        getAuditRules(),
      ]);
      setStats(statsData);
      setHistory(historyData);
      setRules(rulesData);
    } catch (error) {
      console.error('Failed to load audit data:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 提交审核
  const handleAudit = async () => {
    if (!sql.trim()) {
      message.warning('请输入 SQL 语句');
      return;
    }

    setAuditing(true);
    try {
      const result = await auditSQL({ sql, database: database || undefined });
      setAuditResult(result);
      message.success('审核完成');
      // 刷新历史
      const historyData = await getAuditHistory({ limit: 20 });
      setHistory(historyData);
    } catch (error) {
      message.error('审核失败');
    } finally {
      setAuditing(false);
    }
  };

  // 切换规则状态
  const _handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      await updateAuditRule(ruleId, enabled);
      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, enabled } : r))
      );
      message.success(`规则已${enabled ? '启用' : '禁用'}`);
    } catch (error) {
      message.error('更新规则失败');
    }
  };
  void _handleToggleRule;

  // 历史表格列
  const historyColumns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (val: string) => new Date(val).toLocaleString(),
    },
    {
      title: 'SQL 类型',
      dataIndex: 'statementType',
      key: 'statementType',
      width: 100,
      render: (val: string) => <Tag color="blue">{val}</Tag>,
    },
    {
      title: 'SQL 语句',
      dataIndex: 'sql',
      key: 'sql',
      ellipsis: true,
      render: (val: string) => (
        <Tooltip title={val}>
          <Text code style={{ fontSize: 12 }}>{val.substring(0, 60)}...</Text>
        </Tooltip>
      ),
    },
    {
      title: '风险分',
      dataIndex: 'riskScore',
      key: 'riskScore',
      width: 100,
      sorter: (a: SQLAuditResult, b: SQLAuditResult) => a.riskScore - b.riskScore,
      render: (val: number) => (
        <Text
          style={{
            color: val >= 80 ? colors.error[500] : val >= 50 ? colors.warning[500] : colors.success[500],
            fontWeight: 600,
          }}
        >
          {val}
        </Text>
      ),
    },
    {
      title: '结果',
      dataIndex: 'approved',
      key: 'approved',
      width: 80,
      render: (val: boolean) => (
        val
          ? <Tag icon={<CheckCircleOutlined />} color="success">通过</Tag>
          : <Tag icon={<CloseCircleOutlined />} color="error">拒绝</Tag>
      ),
    },
    {
      title: '违规数',
      dataIndex: 'summary',
      key: 'violations',
      width: 80,
      render: (val: SQLAuditResult['summary']) => (
        <Space size={4}>
          {val.critical > 0 && <Tag color="magenta">{val.critical}</Tag>}
          {val.error > 0 && <Tag color="red">{val.error}</Tag>}
          {val.warning > 0 && <Tag color="orange">{val.warning}</Tag>}
          {val.total === 0 && <Tag color="green">0</Tag>}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px 0' }}>
      {/* 统计卡片 */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card bordered={false} size="small" style={{ borderRadius: componentRadius.card }}>
              <Statistic
                title="总审核数"
                value={stats.totalAudits}
                prefix={<AuditOutlined style={{ color: colors.primary[500] }} />}
                valueStyle={{ fontSize: 24 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} size="small" style={{ borderRadius: componentRadius.card }}>
              <Statistic
                title="通过率"
                value={stats.totalAudits > 0 ? Math.round((stats.approvedCount / stats.totalAudits) * 100) : 0}
                suffix="%"
                prefix={<CheckCircleOutlined style={{ color: colors.success[500] }} />}
                valueStyle={{ fontSize: 24, color: colors.success[500] }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} size="small" style={{ borderRadius: componentRadius.card }}>
              <Statistic
                title="平均风险分"
                value={stats.averageRiskScore}
                prefix={<WarningOutlined style={{ color: colors.warning[500] }} />}
                valueStyle={{ fontSize: 24, color: colors.warning[500] }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} size="small" style={{ borderRadius: componentRadius.card }}>
              <Statistic
                title="拒绝数"
                value={stats.rejectedCount}
                prefix={<CloseCircleOutlined style={{ color: colors.error[500] }} />}
                valueStyle={{ fontSize: 24, color: colors.error[500] }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* SQL 输入区 */}
      <Card bordered={false} style={{ borderRadius: componentRadius.card, marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 14 }}>SQL 审核</Text>
        </div>
        <Row gutter={16}>
          <Col span={18}>
            <TextArea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              placeholder="输入需要审核的 SQL 语句..."
              rows={6}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Col>
          <Col span={6}>
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Input
                placeholder="数据库名（可选）"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                prefix={<DatabaseOutlined />}
              />
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleAudit}
                loading={auditing}
                block
                style={{ height: 36 }}
              >
                开始审核
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadData}
                block
                style={{ height: 36 }}
              >
                刷新数据
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 审核结果 */}
      {auditResult && (
        <Card bordered={false} style={{ borderRadius: componentRadius.card, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text strong>审核结果</Text>
            <Space>
              <Tag color={auditResult.approved ? 'success' : 'error'} style={{ fontSize: 14, padding: '4px 12px' }}>
                {auditResult.approved ? '审核通过' : '审核拒绝'}
              </Tag>
              <Tag color={riskLevelConfig[auditResult.riskScore >= 80 ? 'critical' : auditResult.riskScore >= 50 ? 'high' : 'low']?.color || 'default'}>
                风险分: {auditResult.riskScore}
              </Tag>
            </Space>
          </div>

          {/* 违规列表 */}
          {auditResult.violations.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
                发现 {auditResult.violations.length} 个问题
              </Text>
              {auditResult.violations.map((v, idx) => (
                <Alert
                  key={idx}
                  type={v.severity === 'critical' || v.severity === 'error' ? 'error' : v.severity === 'warning' ? 'warning' : 'info'}
                  message={<Text strong>{v.ruleName}</Text>}
                  description={
                    <div>
                      <div>{v.message}</div>
                      {v.suggestion && (
                        <div style={{ marginTop: 4, color: colors.neutral[500] }}>
                          建议: {v.suggestion}
                        </div>
                      )}
                    </div>
                  }
                  style={{ marginBottom: 8 }}
                  showIcon
                />
              ))}
            </div>
          )}

          {/* 执行计划分析 */}
          {auditResult.explainAnalysis && (
            <div>
              <Divider />
              <Text strong style={{ marginBottom: 8, display: 'block' }}>执行计划分析</Text>
              <Row gutter={[16, 8]}>
                <Col span={6}>
                  <Text type="secondary">风险等级</Text>
                  <div>
                    <Tag color={riskLevelConfig[auditResult.explainAnalysis.riskLevel]?.color || 'default'}>
                      {riskLevelConfig[auditResult.explainAnalysis.riskLevel]?.label || auditResult.explainAnalysis.riskLevel}
                    </Tag>
                  </div>
                </Col>
                <Col span={6}>
                  <Text type="secondary">全表扫描</Text>
                  <div><Text strong>{auditResult.explainAnalysis.fullTableScans.length} 个</Text></div>
                </Col>
                <Col span={6}>
                  <Text type="secondary">缺失索引</Text>
                  <div><Text strong>{auditResult.explainAnalysis.missingIndexes.length} 个</Text></div>
                </Col>
                <Col span={6}>
                  <Text type="secondary">预估成本</Text>
                  <div><Text strong>{auditResult.explainAnalysis.estimatedCost}</Text></div>
                </Col>
              </Row>
              {auditResult.explainAnalysis.recommendations.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {auditResult.explainAnalysis.recommendations.map((rec, idx) => (
                    <Alert
                      key={idx}
                      type="info"
                      message={rec}
                      style={{ marginBottom: 4 }}
                      showIcon
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* 历史记录 */}
      <Card bordered={false} style={{ borderRadius: componentRadius.card }}>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>审核历史</Text>
          <Badge count={history.length} style={{ backgroundColor: colors.primary[500] }} />
        </div>
        <Table
          columns={historyColumns}
          dataSource={history}
          rowKey="id"
          loading={loadingHistory}
          size="small"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="暂无审核记录" /> }}
        />
      </Card>
    </div>
  );
};

// ==================== 慢查询分析 Tab ====================

const SlowQueryTab: React.FC = () => {
  const [stats, setStats] = useState<SlowQueryStats | null>(null);
  const [topN, setTopN] = useState<SlowQueryTopN[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDatabase, setSelectedDatabase] = useState<string>('');

  useEffect(() => {
    loadSlowQueryData();
  }, [selectedDatabase]);

  const loadSlowQueryData = async () => {
    setLoading(true);
    try {
      const [statsData, topNData] = await Promise.all([
        getSlowQueryStats(selectedDatabase ? { database: selectedDatabase } : undefined),
        getSlowQueryTopN({ n: 10, database: selectedDatabase || undefined }),
      ]);
      setStats(statsData);
      setTopN(topNData);
    } catch (error) {
      console.error('Failed to load slow query data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Top N 表格列
  const topNColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_: any, __: any, index: number) => (
        <Text strong style={{ color: index < 3 ? colors.error[500] : colors.neutral[500] }}>
          #{index + 1}
        </Text>
      ),
    },
    {
      title: 'SQL 指纹',
      dataIndex: 'fingerprint',
      key: 'fingerprint',
      width: 120,
      render: (val: string) => <Tag>{val}</Tag>,
    },
    {
      title: '示例 SQL',
      dataIndex: 'sampleSql',
      key: 'sampleSql',
      ellipsis: true,
      render: (val: string) => (
        <Tooltip title={val}>
          <Text code style={{ fontSize: 12 }}>{val.substring(0, 80)}...</Text>
        </Tooltip>
      ),
    },
    {
      title: '执行次数',
      dataIndex: 'count',
      key: 'count',
      width: 90,
      sorter: (a: SlowQueryTopN, b: SlowQueryTopN) => a.count - b.count,
      render: (val: number) => <Text strong>{val}</Text>,
    },
    {
      title: '总耗时(s)',
      dataIndex: 'totalTime',
      key: 'totalTime',
      width: 100,
      sorter: (a: SlowQueryTopN, b: SlowQueryTopN) => a.totalTime - b.totalTime,
      render: (val: number) => (
        <Text style={{ color: val > 100 ? colors.error[500] : colors.warning[500] }}>
          {val.toFixed(2)}
        </Text>
      ),
    },
    {
      title: '平均耗时(s)',
      dataIndex: 'avgTime',
      key: 'avgTime',
      width: 100,
      render: (val: number) => val.toFixed(3),
    },
    {
      title: '扫描行数',
      dataIndex: 'avgRowsExamined',
      key: 'avgRowsExamined',
      width: 100,
      render: (val: number) => Math.round(val).toLocaleString(),
    },
    {
      title: '优化建议',
      dataIndex: 'optimizationTips',
      key: 'tips',
      render: (tips: string[]) => (
        <Space direction="vertical" size={2}>
          {tips.slice(0, 2).map((tip, idx) => (
            <Text key={idx} type="secondary" style={{ fontSize: 12 }}>{tip}</Text>
          ))}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px 0' }}>
      {/* 统计卡片 */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card bordered={false} size="small" style={{ borderRadius: componentRadius.card }}>
              <Statistic
                title="慢查询总数"
                value={stats.totalQueries}
                prefix={<ClockCircleOutlined style={{ color: colors.primary[500] }} />}
                valueStyle={{ fontSize: 24 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} size="small" style={{ borderRadius: componentRadius.card }}>
              <Statistic
                title="P95 耗时"
                value={stats.p95QueryTime}
                suffix="s"
                precision={2}
                prefix={<ThunderboltOutlined style={{ color: colors.warning[500] }} />}
                valueStyle={{ fontSize: 24, color: stats.p95QueryTime > 5 ? colors.error[500] : colors.warning[500] }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} size="small" style={{ borderRadius: componentRadius.card }}>
              <Statistic
                title="平均耗时"
                value={stats.avgQueryTime}
                suffix="s"
                precision={3}
                valueStyle={{ fontSize: 24 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} size="small" style={{ borderRadius: componentRadius.card }}>
              <Statistic
                title="最大扫描行数"
                value={stats.maxRowsExamined}
                valueStyle={{ fontSize: 24 }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 筛选和操作 */}
      <Card bordered={false} style={{ borderRadius: componentRadius.card, marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Select
              placeholder="选择数据库"
              value={selectedDatabase || undefined}
              onChange={(val) => setSelectedDatabase(val || '')}
              allowClear
              style={{ width: '100%' }}
              options={[
                { value: 'production', label: '生产库' },
                { value: 'staging', label: '预发布库' },
                { value: 'development', label: '开发库' },
              ]}
            />
          </Col>
          <Col span={4}>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadSlowQueryData}
              loading={loading}
              block
            >
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Top N 慢查询 */}
      <Card bordered={false} style={{ borderRadius: componentRadius.card }}>
        <div style={{ marginBottom: 12 }}>
          <Text strong>Top 10 慢查询</Text>
        </div>
        <Table
          columns={topNColumns}
          dataSource={topN}
          rowKey="fingerprint"
          loading={loading}
          size="small"
          pagination={false}
          locale={{ emptyText: <Empty description="暂无慢查询数据" /> }}
          scroll={{ x: 900 }}
        />
      </Card>
    </div>
  );
};

// ==================== 敏感数据发现 Tab ====================

const SensitiveDataTab: React.FC = () => {
  const [detectValue, setDetectValue] = useState('');
  const [detectResult, setDetectResult] = useState<any>(null);
  const [maskValue, setMaskValue] = useState('');
  const [maskType, setMaskType] = useState<string>('phone');
  const [maskResult, setMaskResult] = useState<any>(null);
  const [scanDatabase, setScanDatabase] = useState('');
  const [scanReport, setScanReport] = useState<ScanReport | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanReport[]>([]);
  const [stats, setStats] = useState<SensitiveDataStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSensitiveDataStats();
  }, []);

  const loadSensitiveDataStats = async () => {
    try {
      const [statsData, historyData] = await Promise.all([
        getSensitiveDataStats(),
        getScanHistory(10),
      ]);
      setStats(statsData);
      setScanHistory(historyData);
    } catch (error) {
      console.error('Failed to load sensitive data stats:', error);
    }
  };

  // 检测敏感数据
  const handleDetect = async () => {
    if (!detectValue.trim()) {
      message.warning('请输入要检测的值');
      return;
    }
    setLoading(true);
    try {
      const result = await detectSensitiveData(detectValue);
      setDetectResult(result);
    } catch (error) {
      message.error('检测失败');
    } finally {
      setLoading(false);
    }
  };

  // 脱敏处理
  const handleMask = async () => {
    if (!maskValue.trim()) {
      message.warning('请输入要脱敏的值');
      return;
    }
    setLoading(true);
    try {
      const result = await maskSensitiveData({ value: maskValue, type: maskType });
      setMaskResult(result);
    } catch (error) {
      message.error('脱敏失败');
    } finally {
      setLoading(false);
    }
  };

  // 扫描数据库
  const handleScan = async () => {
    if (!scanDatabase.trim()) {
      message.warning('请输入数据库名');
      return;
    }
    setLoading(true);
    try {
      const report = await scanDatabaseSensitiveData({ database: scanDatabase });
      setScanReport(report);
      message.success(`扫描完成，发现 ${report.sensitiveFieldsFound} 个敏感字段`);
      // 刷新历史
      const historyData = await getScanHistory(10);
      setScanHistory(historyData);
    } catch (error) {
      message.error('扫描失败');
    } finally {
      setLoading(false);
    }
  };

  // 扫描历史列
  const scanHistoryColumns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (val: string) => new Date(val).toLocaleString(),
    },
    {
      title: '数据库',
      dataIndex: 'database',
      key: 'database',
      width: 120,
    },
    {
      title: '扫描表数',
      dataIndex: 'tablesScanned',
      key: 'tablesScanned',
      width: 100,
    },
    {
      title: '扫描字段',
      dataIndex: 'fieldsScanned',
      key: 'fieldsScanned',
      width: 100,
    },
    {
      title: '敏感字段',
      dataIndex: 'sensitiveFieldsFound',
      key: 'sensitiveFieldsFound',
      width: 100,
      render: (val: number) => (
        <Text style={{ color: val > 0 ? colors.warning[500] : colors.success[500], fontWeight: 600 }}>
          {val}
        </Text>
      ),
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (val: number) => `${(val / 1000).toFixed(1)}s`,
    },
  ];

  return (
    <div style={{ padding: '16px 0' }}>
      {/* 统计卡片 */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card bordered={false} size="small" style={{ borderRadius: componentRadius.card }}>
              <Statistic
                title="扫描次数"
                value={stats.totalScans}
                prefix={<FileSearchOutlined style={{ color: colors.primary[500] }} />}
                valueStyle={{ fontSize: 24 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} size="small" style={{ borderRadius: componentRadius.card }}>
              <Statistic
                title="敏感字段"
                value={stats.totalSensitiveFields}
                prefix={<LockOutlined style={{ color: colors.warning[500] }} />}
                valueStyle={{ fontSize: 24, color: colors.warning[500] }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} size="small" style={{ borderRadius: componentRadius.card }}>
              <Statistic
                title="脱敏次数"
                value={stats.totalMaskOperations}
                prefix={<SafetyCertificateOutlined style={{ color: colors.success[500] }} />}
                valueStyle={{ fontSize: 24 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} size="small" style={{ borderRadius: componentRadius.card }}>
              <Statistic
                title="敏感类型"
                value={Object.keys(stats.byType).length}
                prefix={<ExclamationCircleOutlined style={{ color: colors.info[500] }} />}
                valueStyle={{ fontSize: 24 }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={[16, 16]}>
        {/* 敏感数据检测 */}
        <Col xs={24} lg={12}>
          <Card bordered={false} style={{ borderRadius: componentRadius.card }}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>敏感数据检测</Text>
            </div>
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Input
                placeholder="输入要检测的值（如手机号、身份证号）"
                value={detectValue}
                onChange={(e) => setDetectValue(e.target.value)}
                suffix={
                  <Button
                    type="link"
                    icon={<SearchOutlined />}
                    onClick={handleDetect}
                    loading={loading}
                    size="small"
                  />
                }
              />
              {detectResult && (
                <Alert
                  type={detectResult ? 'warning' : 'success'}
                  message={detectResult ? `检测到敏感数据: ${detectResult.type}` : '未检测到敏感数据'}
                  description={detectResult ? `规则: ${detectResult.ruleName}, 置信度: ${(detectResult.confidence * 100).toFixed(0)}%` : undefined}
                  showIcon
                />
              )}
            </Space>
          </Card>
        </Col>

        {/* 数据脱敏 */}
        <Col xs={24} lg={12}>
          <Card bordered={false} style={{ borderRadius: componentRadius.card }}>
            <div style={{ marginBottom: 12 }}>
              <Text strong>数据脱敏</Text>
            </div>
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Input
                placeholder="输入要脱敏的值"
                value={maskValue}
                onChange={(e) => setMaskValue(e.target.value)}
              />
              <Select
                value={maskType}
                onChange={setMaskType}
                style={{ width: '100%' }}
                options={[
                  { value: 'phone', label: '手机号' },
                  { value: 'id_card', label: '身份证号' },
                  { value: 'email', label: '邮箱' },
                  { value: 'bank_card', label: '银行卡号' },
                  { value: 'name', label: '姓名' },
                ]}
              />
              <Button
                type="primary"
                icon={<SafetyCertificateOutlined />}
                onClick={handleMask}
                loading={loading}
                block
              >
                执行脱敏
              </Button>
              {maskResult && (
                <Alert
                  type="info"
                  message="脱敏结果"
                  description={
                    <div>
                      <div>原始值: <Text code>{maskResult.original}</Text></div>
                      <div>脱敏后: <Text code style={{ color: colors.success[500] }}>{maskResult.masked}</Text></div>
                      <div>策略: {maskResult.strategy}</div>
                    </div>
                  }
                  showIcon
                />
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 数据库扫描 */}
      <Card bordered={false} style={{ borderRadius: componentRadius.card, marginTop: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <Text strong>数据库敏感数据扫描</Text>
        </div>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={16}>
            <Input
              placeholder="输入数据库名"
              value={scanDatabase}
              onChange={(e) => setScanDatabase(e.target.value)}
              prefix={<DatabaseOutlined />}
            />
          </Col>
          <Col span={8}>
            <Button
              type="primary"
              icon={<FileSearchOutlined />}
              onClick={handleScan}
              loading={loading}
              block
            >
              开始扫描
            </Button>
          </Col>
        </Row>

        {/* 扫描结果 */}
        {scanReport && (
          <div style={{ marginBottom: 16 }}>
            <Alert
              type={scanReport.sensitiveFieldsFound > 0 ? 'warning' : 'success'}
              message={`扫描完成: ${scanReport.sensitiveFieldsFound} 个敏感字段`}
              description={`扫描 ${scanReport.tablesScanned} 张表, ${scanReport.fieldsScanned} 个字段, 耗时 ${(scanReport.duration / 1000).toFixed(1)}s`}
              showIcon
              style={{ marginBottom: 12 }}
            />
            {scanReport.results.length > 0 && (
              <Table
                columns={[
                  { title: '表名', dataIndex: 'tableName', key: 'tableName', width: 120 },
                  { title: '字段', dataIndex: 'columnName', key: 'columnName', width: 120 },
                  { title: '类型', dataIndex: 'matchedType', key: 'matchedType', width: 100, render: (v: string) => <Tag>{v}</Tag> },
                  { title: '置信度', dataIndex: 'confidence', key: 'confidence', width: 100, render: (v: number) => `${(v * 100).toFixed(0)}%` },
                  { title: '数据类型', dataIndex: 'dataType', key: 'dataType', width: 120 },
                ]}
                dataSource={scanReport.results}
                rowKey={(r) => `${r.tableName}.${r.columnName}`}
                size="small"
                pagination={false}
              />
            )}
          </div>
        )}

        {/* 扫描历史 */}
        <div>
          <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>扫描历史</Text>
          <Table
            columns={scanHistoryColumns}
            dataSource={scanHistory}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 5 }}
            locale={{ emptyText: <Empty description="暂无扫描记录" /> }}
          />
        </div>
      </Card>
    </div>
  );
};

// ==================== Schema 变更管理 Tab ====================

const SchemaChangeTab: React.FC = () => {
  const [changes, setChanges] = useState<SchemaChange[]>([]);
  const [stats, setStats] = useState<ChangeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadSchemaChangeData();
  }, []);

  const loadSchemaChangeData = async () => {
    setLoading(true);
    try {
      const [changesData, statsData] = await Promise.all([
        getSchemaChanges({ limit: 50 }),
        getSchemaChangeStats(),
      ]);
      setChanges(changesData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load schema change data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 创建变更
  const handleCreate = async (values: any) => {
    try {
      await createSchemaChange({
        ...values,
        createdBy: 'current-user',
      });
      message.success('变更创建成功');
      setCreateModalVisible(false);
      form.resetFields();
      loadSchemaChangeData();
    } catch (error) {
      message.error('创建失败');
    }
  };

  // 审批变更
  const handleReview = async (id: string, approved: boolean) => {
    try {
      await reviewSchemaChange(id, {
        approved,
        reviewedBy: 'current-user',
        comment: approved ? '审批通过' : '审批拒绝',
      });
      message.success(`变更已${approved ? '批准' : '拒绝'}`);
      loadSchemaChangeData();
    } catch (error) {
      message.error('审批失败');
    }
  };

  // 执行变更
  const handleExecute = async (id: string) => {
    Modal.confirm({
      title: '确认执行',
      content: '确定要执行此变更吗？此操作可能不可逆。',
      onOk: async () => {
        try {
          const result = await executeSchemaChange(id);
          if (result.success) {
            message.success('执行成功');
          } else {
            message.error(`执行失败: ${result.error}`);
          }
          loadSchemaChangeData();
        } catch (error) {
          message.error('执行失败');
        }
      },
    });
  };

  // 回滚变更
  const handleRollback = async (id: string) => {
    Modal.confirm({
      title: '确认回滚',
      content: '确定要回滚此变更吗？',
      onOk: async () => {
        try {
          const result = await rollbackSchemaChange(id);
          if (result.success) {
            message.success('回滚成功');
          } else {
            message.error(`回滚失败: ${result.error}`);
          }
          loadSchemaChangeData();
        } catch (error) {
          message.error('回滚失败');
        }
      },
    });
  };

  // 变更列表列
  const changeColumns = [
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 120,
      render: (val: string) => <Tag color="blue">{val}</Tag>,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '数据库',
      dataIndex: 'database',
      key: 'database',
      width: 120,
    },
    {
      title: '表',
      dataIndex: 'tableName',
      key: 'tableName',
      width: 120,
    },
    {
      title: '类型',
      dataIndex: 'changeType',
      key: 'changeType',
      width: 120,
      render: (val: string) => <Tag>{val}</Tag>,
    },
    {
      title: '风险',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 80,
      render: (val: string) => {
        const config = riskLevelConfig[val];
        return config ? <Tag color={config.color}>{config.label}</Tag> : <Tag>{val}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (val: string) => {
        const config = changeStatusConfig[val];
        return config ? <Tag color={config.color}>{config.label}</Tag> : <Tag>{val}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (val: string) => new Date(val).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: any, record: SchemaChange) => (
        <Space size={4}>
          {record.status === 'pending_review' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleReview(record.id, true)}
                style={{ color: colors.success[500] }}
              >
                批准
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={() => handleReview(record.id, false)}
                style={{ color: colors.error[500] }}
              >
                拒绝
              </Button>
            </>
          )}
          {record.status === 'approved' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleExecute(record.id)}
            >
              执行
            </Button>
          )}
          {record.status === 'executed' && record.rollbackSql && (
            <Button
              type="link"
              size="small"
              icon={<RollbackOutlined />}
              onClick={() => handleRollback(record.id)}
            >
              回滚
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px 0' }}>
      {/* 统计卡片 */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card bordered={false} size="small" style={{ borderRadius: componentRadius.card }}>
              <Statistic
                title="总变更数"
                value={stats.total}
                prefix={<CloudSyncOutlined style={{ color: colors.primary[500] }} />}
                valueStyle={{ fontSize: 24 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} size="small" style={{ borderRadius: componentRadius.card }}>
              <Statistic
                title="成功率"
                value={stats.successRate}
                suffix="%"
                precision={1}
                prefix={<CheckCircleOutlined style={{ color: colors.success[500] }} />}
                valueStyle={{ fontSize: 24, color: colors.success[500] }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} size="small" style={{ borderRadius: componentRadius.card }}>
              <Statistic
                title="回滚率"
                value={stats.rollbackRate}
                suffix="%"
                precision={1}
                prefix={<RollbackOutlined style={{ color: stats.rollbackRate > 10 ? colors.warning[500] : colors.neutral[500] }} />}
                valueStyle={{ fontSize: 24, color: stats.rollbackRate > 10 ? colors.warning[500] : undefined }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} size="small" style={{ borderRadius: componentRadius.card }}>
              <Statistic
                title="平均执行时间"
                value={stats.averageExecutionTime}
                suffix="ms"
                valueStyle={{ fontSize: 24 }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 操作栏 */}
      <Card bordered={false} style={{ borderRadius: componentRadius.card, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>Schema 变更列表</Text>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadSchemaChangeData}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              新建变更
            </Button>
          </Space>
        </div>
      </Card>

      {/* 变更列表 */}
      <Card bordered={false} style={{ borderRadius: componentRadius.card }}>
        <Table
          columns={changeColumns}
          dataSource={changes}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 15 }}
          locale={{ emptyText: <Empty description="暂无变更记录" /> }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 创建变更弹窗 */}
      <Modal
        title="创建 Schema 变更"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={640}
        style={{ borderRadius: componentRadius.modal }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          style={{ marginTop: 16 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="数据库"
                name="database"
                rules={[{ required: true, message: '请输入数据库名' }]}
              >
                <Input placeholder="如: production" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="表名"
                name="tableName"
                rules={[{ required: true, message: '请输入表名' }]}
              >
                <Input placeholder="如: users" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="变更类型"
            name="changeType"
            rules={[{ required: true, message: '请选择变更类型' }]}
          >
            <Select
              placeholder="选择变更类型"
              options={[
                { value: 'create_table', label: '创建表' },
                { value: 'alter_table', label: '修改表' },
                { value: 'add_column', label: '添加字段' },
                { value: 'drop_column', label: '删除字段' },
                { value: 'modify_column', label: '修改字段' },
                { value: 'create_index', label: '创建索引' },
                { value: 'drop_index', label: '删除索引' },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="标题"
            name="title"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="变更标题" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} placeholder="变更描述" />
          </Form.Item>
          <Form.Item
            label="SQL 语句"
            name="sql"
            rules={[{ required: true, message: '请输入 SQL 语句' }]}
          >
            <Input.TextArea rows={4} placeholder="ALTER TABLE ..." style={{ fontFamily: 'monospace' }} />
          </Form.Item>
          <Form.Item label="回滚 SQL" name="rollbackSql">
            <Input.TextArea rows={3} placeholder="回滚语句（可选）" style={{ fontFamily: 'monospace' }} />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => { setCreateModalVisible(false); form.resetFields(); }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ==================== 健康检查 Tab ====================

const HealthCheckTab: React.FC = () => {
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDb, setSelectedDb] = useState('');

  useEffect(() => {
    loadHealthData();
  }, []);

  const loadHealthData = async () => {
    setLoading(true);
    try {
      const data = await getDatabaseHealthCheck(selectedDb || undefined);
      setHealth(data);
    } catch (error) {
      console.error('Failed to load health data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '16px 0' }}>
      {/* 操作栏 */}
      <Card bordered={false} style={{ borderRadius: componentRadius.card, marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Select
              placeholder="选择数据库（可选）"
              value={selectedDb || undefined}
              onChange={(val) => setSelectedDb(val || '')}
              allowClear
              style={{ width: '100%' }}
              options={[
                { value: 'production', label: '生产库' },
                { value: 'staging', label: '预发布库' },
                { value: 'development', label: '开发库' },
              ]}
            />
          </Col>
          <Col span={4}>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={loadHealthData}
              loading={loading}
              block
            >
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 整体状态 */}
      {health && (
        <>
          <Card bordered={false} style={{ borderRadius: componentRadius.card, marginBottom: 16 }}>
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>
                {healthStatusConfig[health.status]?.icon || <HeartOutlined />}
              </div>
              <Title level={3} style={{ margin: 0, color: healthStatusConfig[health.status]?.color }}>
                {health.status === 'healthy' ? '健康' : health.status === 'warning' ? '警告' : '异常'}
              </Title>
              <Text type="secondary">检查时间: {new Date(health.timestamp).toLocaleString()}</Text>
            </div>
          </Card>

          {/* 各组件状态 */}
          <Row gutter={[16, 16]}>
            {Object.entries(health.components).map(([key, component]) => {
              const titleMap: Record<string, string> = {
                sqlAudit: 'SQL 审核',
                slowQuery: '慢查询分析',
                sensitiveData: '敏感数据',
                schemaChange: 'Schema 变更',
              };
              const iconMap: Record<string, React.ReactNode> = {
                sqlAudit: <AuditOutlined />,
                slowQuery: <ClockCircleOutlined />,
                sensitiveData: <SafetyCertificateOutlined />,
                schemaChange: <CloudSyncOutlined />,
              };

              return (
                <Col xs={24} sm={12} key={key}>
                  <Card bordered={false} style={{ borderRadius: componentRadius.card }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <Space>
                        <span style={{ fontSize: 20, color: colors.primary[500] }}>{iconMap[key]}</span>
                        <Text strong>{titleMap[key] || key}</Text>
                      </Space>
                      <Badge
                        status={component.status === 'healthy' ? 'success' : component.status === 'warning' ? 'warning' : 'error'}
                        text={component.status === 'healthy' ? '正常' : component.status === 'warning' ? '警告' : '异常'}
                      />
                    </div>
                    <Descriptions column={2} size="small">
                      {Object.entries(component).filter(([k]) => k !== 'status').map(([k, v]) => (
                        <Descriptions.Item key={k} label={k}>
                          <Text strong>{typeof v === 'number' ? v.toLocaleString() : String(v)}</Text>
                        </Descriptions.Item>
                      ))}
                    </Descriptions>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </>
      )}

      {!health && !loading && (
        <Card bordered={false} style={{ borderRadius: componentRadius.card }}>
          <Empty description="点击刷新获取健康状态" />
        </Card>
      )}
    </div>
  );
};

export default DatabaseDevOpsPage;

export default () => (
  <PermissionGuard requiredRoles={["admin", "platform_admin"]} pageLevel resourceName="数据库运维">
    <DatabaseDevOps />
  </PermissionGuard>
);
