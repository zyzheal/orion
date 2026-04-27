/**
 * Configuration Management Page
 * GitOps, config approval, diff analysis, and drift detection
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Table,
  Tag,
  Space,
  Button,
  Statistic,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Drawer,
  Descriptions,
  Tabs,
  Alert,
  List,
  Empty,
} from 'antd';
import { colors } from '@/tokens';
import {
  ReloadOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  CloudSyncOutlined,
  DiffOutlined,
  ScanOutlined,
  RocketOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import DashboardLayout from '@/components/DashboardLayout';
import {
  getConfigs,
  createConfig,
  getGitOpsConfig,
  syncFromGit,
  submitForApproval,
  compareEnvironments,
  compareConfigs,
  getDiffReport,
  detectDrift,
  type ConfigItem,
  type GitOpsConfig,
  type ConfigDiff,
  type EnvDiffResult,
  type DriftResult,
} from '@/api/config';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

/** 环境列表 */
const ENVIRONMENTS = ['dev', 'staging', 'prod'] as const;

/** 格式化配置变更展示 */
const renderChangeItem = (change: {
  path: string;
  operation: 'add' | 'remove' | 'update';
  oldValue?: unknown;
  newValue?: unknown;
}) => {
  const colorMap: Record<string, string> = {
    add: colors.success[500],
    remove: colors.error[500],
    update: colors.warning[500],
  };
  const labelMap: Record<string, string> = {
    add: '新增',
    remove: '删除',
    update: '变更',
  };

  return (
    <div
      key={change.path}
      style={{
        padding: '8px 12px',
        marginBottom: 8,
        borderRadius: 4,
        background: colors.neutral[50],
        borderLeft: `3px solid ${colorMap[change.operation] || colors.neutral[400]}`,
      }}
    >
      <Space style={{ marginBottom: 4 }}>
        <Tag color={colorMap[change.operation]}>{labelMap[change.operation]}</Tag>
        <Text strong>{change.path}</Text>
      </Space>
      {change.oldValue !== undefined && change.operation !== 'add' && (
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            旧值:{' '}
          </Text>
          <Text delete style={{ fontSize: 12, color: colors.error[500] }}>
            {typeof change.oldValue === 'string'
              ? change.oldValue
              : JSON.stringify(change.oldValue)}
          </Text>
        </div>
      )}
      {change.newValue !== undefined && change.operation !== 'remove' && (
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            新值:{' '}
          </Text>
          <Text style={{ fontSize: 12, color: colors.success[600] }}>
            {typeof change.newValue === 'string'
              ? change.newValue
              : JSON.stringify(change.newValue)}
          </Text>
        </div>
      )}
    </div>
  );
};

const ConfigManagementPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [gitOpsConfig, setGitOpsConfig] = useState<GitOpsConfig | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<ConfigItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [form] = Form.useForm();

  // === Diff Tab state ===
  const [activeTab, setActiveTab] = useState('overview');
  // Environment comparison
  const [sourceEnv, setSourceEnv] = useState<string>('dev');
  const [targetEnv, setTargetEnv] = useState<string>('staging');
  const [envDiffLoading, setEnvDiffLoading] = useState(false);
  const [envDiffResult, setEnvDiffResult] = useState<EnvDiffResult | null>(null);
  // Version comparison
  const [versionDiffConfigId, setVersionDiffConfigId] = useState<string>('');
  const [versionA, setVersionA] = useState<number>(1);
  const [versionB, setVersionB] = useState<number>(2);
  const [versionDiffLoading, setVersionDiffLoading] = useState(false);
  const [versionDiffResult, setVersionDiffResult] = useState<ConfigDiff | null>(null);
  // Diff report
  const [reportLoading, setReportLoading] = useState(false);
  const [diffReport, setDiffReport] = useState<{
    totalConfigs: number;
    totalDifferences: number;
    items: {
      key: string;
      environment: string;
      changes: {
        path: string;
        operation: string;
        oldValue?: unknown;
        newValue?: unknown;
      }[];
    }[];
  } | null>(null);

  // === Drift Detection state ===
  const [driftLoading, setDriftLoading] = useState(false);
  const [driftResult, setDriftResult] = useState<DriftResult | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configsRes, gitOpsRes] = await Promise.all([
        getConfigs({ pageSize: 50 }),
        getGitOpsConfig(),
      ]);
      setConfigs(configsRes.data.data.configs || []);
      setGitOpsConfig(gitOpsRes.data.data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载配置失败：${error.message}`);
      } else {
        message.error('加载配置失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (values: any) => {
    try {
      await createConfig(values);
      message.success('配置创建成功');
      setCreateModalOpen(false);
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`创建配置失败：${error.message}`);
      } else {
        message.error('创建配置失败，请稍后重试');
      }
    }
  };

  const handleSync = async () => {
    try {
      await syncFromGit();
      message.success('Git 同步成功');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`同步失败：${error.message}`);
      } else {
        message.error('同步失败，请稍后重试');
      }
    }
  };

  const handleApproval = async (id: string) => {
    try {
      await submitForApproval(id, ['admin']);
      message.success('已提交审批');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`提交失败：${error.message}`);
      } else {
        message.error('提交失败，请稍后重试');
      }
    }
  };

  // === Environment comparison handler ===
  const handleEnvCompare = async () => {
    if (!sourceEnv || !targetEnv) {
      message.warning('请选择源环境和目标环境');
      return;
    }
    if (sourceEnv === targetEnv) {
      message.warning('源环境和目标环境不能相同');
      return;
    }
    setEnvDiffLoading(true);
    try {
      const res = await compareEnvironments(sourceEnv, targetEnv);
      setEnvDiffResult(res.data.data);
      message.success('环境对比完成');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`环境对比失败：${error.message}`);
      } else {
        message.error('环境对比失败，请稍后重试');
      }
    } finally {
      setEnvDiffLoading(false);
    }
  };

  // === Version comparison handler ===
  const handleVersionCompare = async () => {
    if (!versionDiffConfigId) {
      message.warning('请选择配置项');
      return;
    }
    if (!versionA || !versionB) {
      message.warning('请选择对比版本');
      return;
    }
    if (versionA === versionB) {
      message.warning('两个版本不能相同');
      return;
    }
    setVersionDiffLoading(true);
    try {
      const res = await compareConfigs(versionDiffConfigId, versionA, versionB);
      setVersionDiffResult(res.data.data);
      message.success('版本对比完成');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`版本对比失败：${error.message}`);
      } else {
        message.error('版本对比失败，请稍后重试');
      }
    } finally {
      setVersionDiffLoading(false);
    }
  };

  // === Diff report handler ===
  const handleGenerateReport = async () => {
    setReportLoading(true);
    try {
      const res = await getDiffReport();
      const data = res.data.data;
      setDiffReport({
        totalConfigs: data.totalConfigs,
        totalDifferences: data.summary.totalDifferences,
        items: data.items.map((item) => ({
          key: item.key,
          environment: item.environment,
          changes: item.changes,
        })),
      });
      message.success('报告生成成功');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`生成报告失败：${error.message}`);
      } else {
        message.error('生成报告失败，请稍后重试');
      }
    } finally {
      setReportLoading(false);
    }
  };

  // === Drift detection handler ===
  const handleDriftDetect = async () => {
    setDriftLoading(true);
    try {
      const res = await detectDrift();
      setDriftResult(res.data.data);
      if (res.data.data.driftDetected) {
        message.warning(`发现 ${res.data.data.itemCount} 处配置漂移`);
      } else {
        message.success('未检测到配置漂移');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`漂移检测失败：${error.message}`);
      } else {
        message.error('漂移检测失败，请稍后重试');
      }
    } finally {
      setDriftLoading(false);
    }
  };

  const statusColorMap: Record<string, string> = {
    draft: 'default',
    pending_approval: 'orange',
    approved: 'blue',
    rejected: 'red',
    active: 'green',
  };

  const columns = [
    {
      title: '配置键',
      dataIndex: 'key',
      key: 'key',
      render: (text: string, record: ConfigItem) => (
        <Space>
          <FileTextOutlined />
          <Text strong>{text}</Text>
          {record.sensitive && <Tag color="red">敏感</Tag>}
          {record.encrypted && <Tag color="purple">加密</Tag>}
        </Space>
      ),
    },
    {
      title: '值',
      dataIndex: 'value',
      key: 'value',
      render: (value: unknown, record: ConfigItem) =>
        record.sensitive ? '***' : JSON.stringify(value)?.slice(0, 50),
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      filters: [
        { text: 'development', value: 'development' },
        { text: 'testing', value: 'testing' },
        { text: 'staging', value: 'staging' },
        { text: 'production', value: 'production' },
      ],
      onFilter: (value: unknown, record: ConfigItem) => record.environment === value,
      render: (env: string) => <Tag color={env === 'production' ? 'red' : 'blue'}>{env}</Tag>,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColorMap[status] || 'default'}>
          {status === 'active' ? '已激活' : status === 'pending_approval' ? '待审批' : status}
        </Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (ts: string) => new Date(ts).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: ConfigItem) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setSelectedConfig(record);
              setDetailDrawerOpen(true);
            }}
          >
            详情
          </Button>
          {record.status === 'draft' && (
            <Button type="link" size="small" onClick={() => handleApproval(record.id)}>
              提交审批
            </Button>
          )}
        </Space>
      ),
    },
  ];

  /** 获取配置项列表供版本对比选择 */
  const configSelectOptions = configs.map((c) => ({
    label: `${c.key} (${c.environment})`,
    value: c.id,
  }));

  /** 版本选择选项 */
  const versionOptions = Array.from({ length: 10 }, (_, i) => i + 1).map((v) => ({
    label: `v${v}`,
    value: v,
  }));

  // === Tabs definition ===
  const tabItems = [
    {
      key: 'overview',
      label: (
        <Space>
          <FileTextOutlined />
          配置概览
        </Space>
      ),
      children: (
        <>
          {/* Summary Cards */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={4}>
              <Card>
                <Statistic title="配置总数" value={configs.length} />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="已激活"
                  value={configs.filter((c) => c.status === 'active').length}
                  valueStyle={{ color: colors.success[500] }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="待审批"
                  value={configs.filter((c) => c.status === 'pending_approval').length}
                  valueStyle={{ color: colors.warning[500] }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="草稿"
                  value={configs.filter((c) => c.status === 'draft').length}
                  valueStyle={{ color: colors.neutral[400] }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="敏感配置"
                  value={configs.filter((c) => c.sensitive).length}
                  valueStyle={{ color: colors.error[500] }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="GitOps 状态"
                  value={gitOpsConfig?.syncStatus === 'success' ? 1 : 0}
                  valueStyle={{
                    color:
                      gitOpsConfig?.syncStatus === 'success'
                        ? colors.success[500]
                        : colors.error[500],
                  }}
                  prefix={
                    gitOpsConfig?.syncStatus === 'success' ? (
                      <CheckCircleOutlined />
                    ) : (
                      <CloseCircleOutlined />
                    )
                  }
                />
              </Card>
            </Col>
          </Row>

          {/* GitOps Status */}
          <Card title="GitOps 同步状态" style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col span={6}>
                <Text type="secondary">状态:</Text>{' '}
                <Tag color={gitOpsConfig?.syncStatus === 'success' ? 'green' : 'default'}>
                  {gitOpsConfig?.syncStatus || 'idle'}
                </Tag>
              </Col>
              <Col span={6}>
                <Text type="secondary">仓库:</Text>{' '}
                <Text code>{gitOpsConfig?.repository || '未配置'}</Text>
              </Col>
              <Col span={6}>
                <Text type="secondary">分支:</Text>{' '}
                <Text code>{gitOpsConfig?.branch || 'main'}</Text>
              </Col>
              <Col span={6}>
                <Text type="secondary">最后同步:</Text>{' '}
                {gitOpsConfig?.lastSyncAt
                  ? new Date(gitOpsConfig.lastSyncAt).toLocaleString()
                  : '从未'}
              </Col>
            </Row>
          </Card>

          {/* Config Table */}
          <Card title="配置列表">
            <Table
              columns={columns}
              dataSource={configs}
              loading={loading}
              pagination={{ pageSize: 10 }}
              rowKey="id"
            />
          </Card>
        </>
      ),
    },
    {
      key: 'diff',
      label: (
        <Space>
          <DiffOutlined />
          差异对比
        </Space>
      ),
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Environment Comparison */}
          <Card
            title="环境差异对比"
            extra={
              <Button
                type="primary"
                icon={<DiffOutlined />}
                onClick={handleEnvCompare}
                loading={envDiffLoading}
              >
                对比
              </Button>
            }
          >
            <Row gutter={24} align="middle">
              <Col span={6}>
                <Text strong>源环境:</Text>
                <Select
                  value={sourceEnv}
                  onChange={setSourceEnv}
                  style={{ width: '100%', marginTop: 8 }}
                  options={ENVIRONMENTS.map((e) => ({ label: e, value: e }))}
                />
              </Col>
              <Col span={2} style={{ textAlign: 'center' }}>
                <ArrowRightOutlined style={{ fontSize: 20, color: colors.primary[500] }} />
              </Col>
              <Col span={6}>
                <Text strong>目标环境:</Text>
                <Select
                  value={targetEnv}
                  onChange={setTargetEnv}
                  style={{ width: '100%', marginTop: 8 }}
                  options={ENVIRONMENTS.map((e) => ({ label: e, value: e }))}
                />
              </Col>
            </Row>

            {envDiffResult && (
              <div style={{ marginTop: 16 }}>
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <Statistic
                      title="配置总数"
                      value={envDiffResult.totalConfigs}
                      valueStyle={{ fontSize: 20 }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="完全一致"
                      value={envDiffResult.identical}
                      valueStyle={{ color: colors.success[500], fontSize: 20 }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="有差异"
                      value={envDiffResult.differences.length}
                      valueStyle={{ color: colors.warning[500], fontSize: 20 }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="仅在一侧"
                      value={
                        (envDiffResult.onlyInSource?.length || 0) +
                        (envDiffResult.onlyInTarget?.length || 0)
                      }
                      valueStyle={{ color: colors.error[500], fontSize: 20 }}
                    />
                  </Col>
                </Row>

                {envDiffResult.differences.length > 0 && (
                  <>
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>
                      差异详情 ({envDiffResult.differences.length} 项)
                    </Text>
                    {envDiffResult.differences.map((change) => renderChangeItem(change as any))}
                  </>
                )}

                {(envDiffResult.onlyInSource?.length > 0 ||
                  envDiffResult.onlyInTarget?.length > 0) && (
                  <>
                    <Text strong style={{ display: 'block', marginTop: 16, marginBottom: 8 }}>
                      仅存在于一侧的配置项
                    </Text>
                    {envDiffResult.onlyInSource?.map((key) => (
                      <Tag
                        key={`src-${key}`}
                        color={colors.warning[100]}
                        style={{ marginBottom: 4 }}
                      >
                        仅在 {sourceEnv}: {key}
                      </Tag>
                    ))}
                    {envDiffResult.onlyInTarget?.map((key) => (
                      <Tag key={`tgt-${key}`} color={colors.info[100]} style={{ marginBottom: 4 }}>
                        仅在 {targetEnv}: {key}
                      </Tag>
                    ))}
                  </>
                )}

                {envDiffResult.differences.length === 0 &&
                  (envDiffResult.onlyInSource?.length || 0) +
                    (envDiffResult.onlyInTarget?.length || 0) ===
                    0 && (
                    <Alert
                      message="两个环境的配置完全一致"
                      type="success"
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  )}
              </div>
            )}

            {!envDiffResult && (
              <Empty description="请选择环境并点击对比" style={{ marginTop: 16 }} />
            )}
          </Card>

          {/* Version Comparison */}
          <Card
            title="版本差异对比"
            extra={
              <Button
                type="primary"
                icon={<DiffOutlined />}
                onClick={handleVersionCompare}
                loading={versionDiffLoading}
              >
                对比
              </Button>
            }
          >
            <Row gutter={16} align="middle">
              <Col span={8}>
                <Text strong>配置项:</Text>
                <Select
                  value={versionDiffConfigId || undefined}
                  onChange={setVersionDiffConfigId}
                  style={{ width: '100%', marginTop: 8 }}
                  options={configSelectOptions}
                  placeholder="选择配置项"
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Col>
              <Col span={4}>
                <Text strong>版本 A:</Text>
                <Select
                  value={versionA}
                  onChange={setVersionA}
                  style={{ width: '100%', marginTop: 8 }}
                  options={versionOptions}
                />
              </Col>
              <Col span={4}>
                <Text strong>版本 B:</Text>
                <Select
                  value={versionB}
                  onChange={setVersionB}
                  style={{ width: '100%', marginTop: 8 }}
                  options={versionOptions}
                />
              </Col>
            </Row>

            {versionDiffResult &&
              versionDiffResult.changes &&
              versionDiffResult.changes.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    变更项 ({versionDiffResult.changes.length} 项)
                  </Text>
                  {versionDiffResult.changes.map((change) => renderChangeItem(change))}
                </div>
              )}
            {versionDiffResult &&
              (!versionDiffResult.changes || versionDiffResult.changes.length === 0) && (
                <Alert
                  message="两个版本的配置完全一致"
                  type="success"
                  showIcon
                  style={{ marginTop: 16 }}
                />
              )}
            {!versionDiffResult && (
              <Empty description="请选择配置项和版本并点击对比" style={{ marginTop: 16 }} />
            )}
          </Card>

          {/* Diff Report */}
          <Card
            title="综合差异报告"
            extra={
              <Button
                type="primary"
                icon={<RocketOutlined />}
                onClick={handleGenerateReport}
                loading={reportLoading}
              >
                生成报告
              </Button>
            }
          >
            {diffReport && (
              <>
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={8}>
                    <Statistic
                      title="配置总数"
                      value={diffReport.totalConfigs}
                      valueStyle={{ fontSize: 20 }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="差异总数"
                      value={diffReport.totalDifferences}
                      valueStyle={{
                        color:
                          diffReport.totalDifferences > 0
                            ? colors.warning[500]
                            : colors.success[500],
                        fontSize: 20,
                      }}
                    />
                  </Col>
                </Row>

                {diffReport.items.length > 0 ? (
                  <List
                    bordered
                    dataSource={diffReport.items}
                    renderItem={(item) => (
                      <List.Item>
                        <List.Item.Meta
                          title={
                            <Space>
                              <FileTextOutlined />
                              <Text strong>{item.key}</Text>
                              <Tag color="blue">{item.environment}</Tag>
                            </Space>
                          }
                          description={
                            <Space wrap>
                              {item.changes.map((c, idx) => (
                                <Tag
                                  key={idx}
                                  color={
                                    c.operation === 'add'
                                      ? 'green'
                                      : c.operation === 'remove'
                                        ? 'red'
                                        : 'orange'
                                  }
                                >
                                  {c.path} ({c.operation})
                                </Tag>
                              ))}
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Alert message="所有环境配置完全一致" type="success" showIcon />
                )}
              </>
            )}
            {!diffReport && <Empty description="点击生成报告查看综合差异" />}
          </Card>
        </Space>
      ),
    },
    {
      key: 'drift',
      label: (
        <Space>
          <ScanOutlined />
          漂移检测
        </Space>
      ),
      children: (
        <Card
          title="配置漂移检测"
          extra={
            <Button
              type="primary"
              icon={<ScanOutlined />}
              onClick={handleDriftDetect}
              loading={driftLoading}
            >
              检测漂移
            </Button>
          }
        >
          <Paragraph type="secondary">
            检测当前环境与 Git 仓库之间的配置差异，识别配置漂移。 漂移指本地配置与 Git
            中定义的配置不一致的情况。
          </Paragraph>

          {driftResult && (
            <>
              <Alert
                message={
                  driftResult.driftDetected
                    ? `检测到 ${driftResult.itemCount} 处配置漂移`
                    : '未检测到配置漂移'
                }
                type={driftResult.driftDetected ? 'warning' : 'success'}
                showIcon
                style={{ marginBottom: 16 }}
              />

              {driftResult.driftDetected && driftResult.items && driftResult.items.length > 0 && (
                <List
                  bordered
                  dataSource={driftResult.items}
                  renderItem={(item: any) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            <FileTextOutlined />
                            <Text strong>{item.key}</Text>
                            <Tag color="blue">{item.environment}</Tag>
                          </Space>
                        }
                        description={
                          <div>
                            <Paragraph
                              style={{
                                background: colors.error[50],
                                padding: '4px 8px',
                                borderRadius: 4,
                                marginBottom: 4,
                              }}
                            >
                              <Text type="secondary">当前值: </Text>
                              <Text delete style={{ fontSize: 12 }}>
                                {typeof item.localValue === 'string'
                                  ? item.localValue
                                  : JSON.stringify(item.localValue)}
                              </Text>
                            </Paragraph>
                            <Paragraph
                              style={{
                                background: colors.success[50],
                                padding: '4px 8px',
                                borderRadius: 4,
                              }}
                            >
                              <Text type="secondary">期望值: </Text>
                              <Text style={{ fontSize: 12, color: colors.success[600] }}>
                                {typeof item.remoteValue === 'string'
                                  ? item.remoteValue
                                  : JSON.stringify(item.remoteValue)}
                              </Text>
                            </Paragraph>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}

              {!driftResult.driftDetected && (
                <Empty
                  image={
                    <CheckCircleOutlined style={{ fontSize: 64, color: colors.success[500] }} />
                  }
                  description="当前环境与 Git 仓库配置完全一致"
                />
              )}
            </>
          )}

          {!driftResult && <Empty description="点击检测漂移按钮开始扫描" />}
        </Card>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <Title level={2}>配置管理</Title>
            <Text type="secondary">GitOps 工作流、变更审批、差异分析、漂移检测</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              刷新
            </Button>
            <Button icon={<CloudSyncOutlined />} onClick={handleSync} loading={loading}>
              Git 同步
            </Button>
            <Button icon={<ScanOutlined />} onClick={handleDriftDetect} loading={driftLoading}>
              漂移检测
            </Button>
            <Button icon={<PlusOutlined />} type="primary" onClick={() => setCreateModalOpen(true)}>
              新建配置
            </Button>
          </Space>
        </div>

        {/* Tabbed Content */}
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" />

        {/* Create Modal */}
        <Modal
          title="新建配置"
          open={createModalOpen}
          onCancel={() => setCreateModalOpen(false)}
          onOk={() => form.submit()}
          width={600}
        >
          <Form form={form} layout="vertical" onFinish={handleCreate}>
            <Form.Item label="配置键" name="key" rules={[{ required: true }]}>
              <Input placeholder="例如：app.name" />
            </Form.Item>
            <Form.Item label="配置值" name="value" rules={[{ required: true }]}>
              <TextArea placeholder='例如：{"key": "value"}' rows={3} />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="环境" name="environment" rules={[{ required: true }]}>
                  <Select>
                    <Select.Option value="development">development</Select.Option>
                    <Select.Option value="testing">testing</Select.Option>
                    <Select.Option value="staging">staging</Select.Option>
                    <Select.Option value="production">production</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="分类" name="category" rules={[{ required: true }]}>
                  <Select>
                    <Select.Option value="application">application</Select.Option>
                    <Select.Option value="database">database</Select.Option>
                    <Select.Option value="cache">cache</Select.Option>
                    <Select.Option value="feature">feature</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="敏感的配置" name="sensitive" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="加密存储" name="encrypted" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="描述" name="description">
              <TextArea rows={2} />
            </Form.Item>
          </Form>
        </Modal>

        {/* Detail Drawer */}
        <Drawer
          title="配置详情"
          placement="right"
          width={700}
          open={detailDrawerOpen}
          onClose={() => setDetailDrawerOpen(false)}
        >
          {selectedConfig && (
            <Descriptions column={1} bordered>
              <Descriptions.Item label="ID">{selectedConfig.id}</Descriptions.Item>
              <Descriptions.Item label="配置键">{selectedConfig.key}</Descriptions.Item>
              <Descriptions.Item label="配置值">
                <pre>{JSON.stringify(selectedConfig.value, null, 2)}</pre>
              </Descriptions.Item>
              <Descriptions.Item label="版本">{selectedConfig.version}</Descriptions.Item>
              <Descriptions.Item label="环境">{selectedConfig.environment}</Descriptions.Item>
              <Descriptions.Item label="分类">{selectedConfig.category}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColorMap[selectedConfig.status]}>{selectedConfig.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="敏感">
                {selectedConfig.sensitive ? '是' : '否'}
              </Descriptions.Item>
              <Descriptions.Item label="加密">
                {selectedConfig.encrypted ? '是' : '否'}
              </Descriptions.Item>
              <Descriptions.Item label="创建者">{selectedConfig.createdBy}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(selectedConfig.createdAt).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="更新者">{selectedConfig.updatedBy}</Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {new Date(selectedConfig.updatedAt).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
          )}
        </Drawer>
      </div>
    </DashboardLayout>
  );
};

export default ConfigManagementPage;
