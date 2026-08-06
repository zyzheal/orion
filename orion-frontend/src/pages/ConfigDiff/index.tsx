/**
 * Configuration Version Diff Page
 * Compare two versions of a config item, visualize changes, and rollback.
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Select,
  Statistic,
  Row,
  Col,
  Space,
  message,
  Typography,
  Tag,
  Table,
  Modal,
  Descriptions,
  Input,
  Form,
} from 'antd';
import {
  DiffOutlined,
  ReloadOutlined,
  RollbackOutlined,
  FileTextOutlined,
  ArrowDownOutlined,
  CheckSquareOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import {
  getConfigs,
  getConfigVersions,
  compareConfigs,
  rollbackConfig,
  getDiffReport,
  type ConfigItem,
  type ConfigVersion,
  type ConfigDiff,
  type ConfigChange,
  type DiffReport,
} from '@/api/config';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const ConfigDiffPage: React.FC = () => {
  // Config list & selection
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [selectedConfig, setSelectedConfig] = useState<ConfigItem | null>(null);

  // Version selection
  const [versions, setVersions] = useState<ConfigVersion[]>([]);
  const [fromVersion, setFromVersion] = useState<number>(0);
  const [toVersion, setToVersion] = useState<number>(0);

  // Diff result
  const [diffResult, setDiffResult] = useState<ConfigDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<DiffReport | null>(null);

  // Rollback
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollbackReason, setRollbackReason] = useState('');
  const [rollbackLoading, setRollbackLoading] = useState(false);

  // Detail modal for a single change
  const [changeDetail, setChangeDetail] = useState<ConfigChange | null>(null);

  // Loading for config list
  const [configLoading, setConfigLoading] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  // When config selection changes, load its versions
  useEffect(() => {
    if (selectedConfigId) {
      loadVersions(selectedConfigId);
      setDiffResult(null);
      setReport(null);
      setFromVersion(0);
      setToVersion(0);
    }
  }, [selectedConfigId]);

  const loadConfigs = async () => {
    setConfigLoading(true);
    try {
      const res = await getConfigs();
      const configsData = res.data as { configs?: ConfigItem[]; data?: ConfigItem[] };
      const list = (configsData?.configs ?? (configsData?.data as ConfigItem[]) ?? []) as ConfigItem[];
      setConfigs(list);
    } catch {
      message.error('Failed to load config list');
    } finally {
      setConfigLoading(false);
    }
  };

  const loadVersions = async (id: string) => {
    try {
      const res = await getConfigVersions(id);
      const verData = res.data as { versions?: ConfigVersion[]; data?: ConfigVersion[] };
      const list = (verData?.versions ?? (verData?.data as ConfigVersion[]) ?? []) as ConfigVersion[];
      const sorted = list.sort((a, b) => a.version - b.version);
      setVersions(sorted);
      if (sorted.length >= 2) {
        setFromVersion(sorted[sorted.length - 2].version);
        setToVersion(sorted[sorted.length - 1].version);
      }
    } catch {
      message.error('Failed to load versions');
    }
  };

  const handleCompare = async () => {
    if (!selectedConfigId || !fromVersion || !toVersion) {
      message.warning('Please select a config and both versions');
      return;
    }
    if (fromVersion === toVersion) {
      message.warning('From and To versions must differ');
      return;
    }
    setDiffLoading(true);
    try {
      const res = await compareConfigs(selectedConfigId, fromVersion, toVersion);
      setDiffResult(res.data as ConfigDiff);
      message.success(`Diff loaded: ${(res.data as ConfigDiff).changes?.length ?? 0} changes found`);
    } catch {
      message.error('Failed to compute diff');
    } finally {
      setDiffLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!selectedConfigId || !toVersion) return;
    setRollbackLoading(true);
    try {
      await rollbackConfig(selectedConfigId, toVersion);
      message.success(`Rollback to v${toVersion} completed`);
      setRollbackOpen(false);
      setRollbackReason('');
      loadVersions(selectedConfigId);
      setDiffResult(null);
    } catch {
      message.error('Rollback failed');
    } finally {
      setRollbackLoading(false);
    }
  };

  const handleReport = async () => {
    setReportLoading(true);
    try {
      const res = await getDiffReport(selectedConfigId || undefined);
      setReport(res.data as DiffReport);
      message.success('Diff report loaded');
    } catch {
      message.error('Failed to load diff report');
    } finally {
      setReportLoading(false);
    }
  };

  const operationColor: Record<string, string> = {
    add: 'green',
    remove: 'red',
    update: 'blue',
  };
  const operationIcon: Record<string, React.ReactNode> = {
    add: <PlusOutlined />,
    remove: <DeleteOutlined />,
    update: <CheckSquareOutlined />,
  };

  const changeColumns = [
    {
      title: 'Path',
      dataIndex: 'path',
      key: 'path',
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: 'Operation',
      dataIndex: 'operation',
      key: 'operation',
      render: (v: string) => (
        <Tag color={operationColor[v]}>
          {operationIcon[v]} {v.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Old Value',
      dataIndex: 'oldValue',
      key: 'oldValue',
      render: (v: unknown) => {
        if (v === undefined || v === null) return <Text type="secondary">—</Text>;
        return <Text code>{typeof v === 'string' ? v : JSON.stringify(v)}</Text>;
      },
    },
    {
      title: 'New Value',
      dataIndex: 'newValue',
      key: 'newValue',
      render: (v: unknown) => {
        if (v === undefined || v === null) return <Text type="secondary">—</Text>;
        return <Text code>{typeof v === 'string' ? v : JSON.stringify(v)}</Text>;
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: unknown, record: ConfigChange) => (
        <Button size="small" onClick={() => setChangeDetail(record)}>
          Details
        </Button>
      ),
    },
  ];

  const reportColumns = [
    { title: 'Key', dataIndex: 'key', key: 'key' },
    { title: 'Environment', dataIndex: 'environment', key: 'environment' },
    {
      title: 'Latest',
      dataIndex: 'latestVersion',
      key: 'latestVersion',
      render: (v: number) => <Tag>v{v}</Tag>,
    },
    {
      title: 'Changes',
      dataIndex: 'changes',
      key: 'changes',
      render: (changes: ConfigChange[]) => <Tag color="blue">{changes.length}</Tag>,
    },
  ];

  const versionOptions = versions.map((v) => ({
    label: `v${v.version} — ${v.changedAt} (${v.changedBy})${v.changeReason ? ': ' + v.changeReason : ''}`,
    value: v.version,
  }));

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <DiffOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            Config Version Diff
          </Title>
          <Text type="secondary">Compare configuration versions, visualize changes, and rollback</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadConfigs} loading={configLoading}>
            Refresh
          </Button>
        </Space>
      </div>

      {/* Selection Panel */}
      <Card style={{ marginBottom: spacing.md }}>
        <Row gutter={spacing.md} align="middle">
          <Col flex="auto">
            <Select
              labelInValue
              placeholder="Select a config"
              style={{ width: 320 }}
              loading={configLoading}
              value={selectedConfigId ? { key: selectedConfigId } : undefined}
              onChange={(val) => {
                if (val?.key) {
                  setSelectedConfigId(val.key);
                  setSelectedConfig(configs.find((c) => c.id === val.key) || null);
                }
              }}
            >
              {configs.map((c) => (
                <Option key={c.id} value={c.id}>
                  {c.key} [{c.environment}] (v{c.version})
                </Option>
              ))}
            </Select>
          </Col>
          <Col>
            {selectedConfig && (
              <Descriptions size="small" column={2} style={{ width: 'auto' }}>
                <Descriptions.Item label="Category">{selectedConfig.category}</Descriptions.Item>
                <Descriptions.Item label="Status">{selectedConfig.status}</Descriptions.Item>
              </Descriptions>
            )}
          </Col>
          <Col>
            <Space>
              <Select
                placeholder="From version"
                style={{ width: 240 }}
                value={fromVersion || undefined}
                onChange={setFromVersion}
                disabled={!selectedConfigId}
              >
                {versionOptions.map((o) => (
                  <Option key={o.value} value={o.value}>{o.label}</Option>
                ))}
              </Select>
              <Select
                placeholder="To version"
                style={{ width: 240 }}
                value={toVersion || undefined}
                onChange={setToVersion}
                disabled={!selectedConfigId}
              >
                {versionOptions.map((o) => (
                  <Option key={o.value} value={o.value}>{o.label}</Option>
                ))}
              </Select>
              <Button
                type="primary"
                icon={<DiffOutlined />}
                onClick={handleCompare}
                loading={diffLoading}
                disabled={!fromVersion || !toVersion}
              >
                Compare
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Stats */}
      {diffResult && (
        <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
          <Col span={6}>
            <Card>
              <Statistic title="Total Changes" value={diffResult.changes?.length ?? 0} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Added"
                value={diffResult.changes?.filter((c) => c.operation === 'add').length ?? 0}
                valueStyle={{ color: colors.success[500] }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Removed"
                value={diffResult.changes?.filter((c) => c.operation === 'remove').length ?? 0}
                valueStyle={{ color: colors.error[500] }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Updated"
                value={diffResult.changes?.filter((c) => c.operation === 'update').length ?? 0}
                valueStyle={{ color: colors.primary[500] }}
              />
            </Card>
          </Col>
          <Col span={24} style={{ marginTop: spacing.sm }}>
            <Space>
              <Button
                icon={<RollbackOutlined />}
                onClick={() => setRollbackOpen(true)}
                disabled={!toVersion}
              >
                Rollback to v{toVersion}
              </Button>
              <Button
                icon={<FileTextOutlined />}
                onClick={handleReport}
                loading={reportLoading}
              >
                Load Diff Report
              </Button>
            </Space>
          </Col>
        </Row>
      )}

      {/* Diff Table */}
      {diffResult && diffResult.changes && (
        <Card title="Change Details" style={{ marginBottom: spacing.md }}>
          <Table
            columns={changeColumns}
            dataSource={diffResult.changes}
            rowKey="path"
            pagination={false}
            size="small"
          />
        </Card>
      )}

      {/* Empty state */}
      {!selectedConfigId && (
        <Card>
          <div style={{ textAlign: 'center', padding: spacing.xl, color: colors.neutral[500] }}>
            <DiffOutlined style={{ fontSize: 48, marginBottom: spacing.md, display: 'block' }} />
            <Title level={4}>Select a config to compare versions</Title>
            <Text type="secondary">Choose a config from the list above, pick two versions, and hit Compare</Text>
          </div>
        </Card>
      )}

      {/* Diff Report */}
      {report && (
        <Card title={`Diff Report — ${report.reportId}`} style={{ marginBottom: spacing.md }}>
          <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
            <Col span={6}>
              <Statistic title="Total Configs" value={report.totalConfigs} />
            </Col>
            <Col span={6}>
              <Statistic title="Total Differences" value={report.summary?.totalDifferences ?? 0} />
            </Col>
            <Col span={6}>
              <Statistic title="Generated" value={report.generatedAt} valueStyle={{ fontSize: 12 }} />
            </Col>
            <Col span={6}>
              <Statistic title="Environments" value={report.environments?.length ?? 0} />
            </Col>
          </Row>
          <Table
            columns={reportColumns}
            dataSource={report.items}
            rowKey="configId"
            pagination={{ pageSize: 10 }}
            size="small"
          />
        </Card>
      )}

      {/* Change Detail Modal */}
      <Modal
        title="Change Detail"
        open={!!changeDetail}
        onCancel={() => setChangeDetail(null)}
        footer={null}
      >
        {changeDetail && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Path">
              <Text code>{changeDetail.path}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Operation">
              <Tag color={operationColor[changeDetail.operation]}>
                {operationIcon[changeDetail.operation]} {changeDetail.operation.toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Old Value">
              {changeDetail.oldValue !== undefined && changeDetail.oldValue !== null ? (
                <TextArea
                  autoSize={{ minRows: 2, maxRows: 6 }}
                  value={typeof changeDetail.oldValue === 'string' ? changeDetail.oldValue : JSON.stringify(changeDetail.oldValue, null, 2)}
                />
              ) : (
                <Text type="secondary">—</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="New Value">
              {changeDetail.newValue !== undefined && changeDetail.newValue !== null ? (
                <TextArea
                  autoSize={{ minRows: 2, maxRows: 6 }}
                  value={typeof changeDetail.newValue === 'string' ? changeDetail.newValue : JSON.stringify(changeDetail.newValue, null, 2)}
                />
              ) : (
                <Text type="secondary">—</Text>
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Rollback Modal */}
      <Modal
        title="Rollback"
        open={rollbackOpen}
        onCancel={() => setRollbackOpen(false)}
        onOk={handleRollback}
        confirmLoading={rollbackLoading}
        width={500}
      >
        <p>
          <Text>
            Rollback <Text code>{selectedConfig?.key}</Text> to{' '}
            <Text code>v{toVersion}</Text>.
          </Text>
        </p>
        <p>
          <Text type="danger" strong>
            <ArrowDownOutlined />
            This will replace the current configuration with version {toVersion}.
          </Text>
        </p>
        <Form.Item label="Reason" name="reason">
          <TextArea
            rows={3}
            placeholder="Reason for rollback"
            value={rollbackReason}
            onChange={(e) => setRollbackReason(e.target.value)}
          />
        </Form.Item>
      </Modal>
    </div>
  );
};

export default ConfigDiffPage;
