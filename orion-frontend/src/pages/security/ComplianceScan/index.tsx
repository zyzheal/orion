/**
 * Compliance Scan Page (H1.7 合规检查)
 * Security baseline scanning, compliance report generation, and remediation tracking
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Table,
  Statistic,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Progress,
  message,
  Empty,
} from 'antd';
import {
  CheckCircleOutlined,
  ScanOutlined,
  ExclamationCircleOutlined,
  FileProtectOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;
const { Option } = Select;

type ComplianceLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';

interface ComplianceFinding {
  id: string;
  rule: string;
  target: string;
  level: ComplianceLevel;
  status: ScanStatus;
  description: string;
  detectedAt: string;
}

interface ComplianceBaseline {
  id: string;
  name: string;
  framework: string;
  rules: number;
  lastScan: string;
  passRate: number;
}

type FrameworkType = 'owasp' | 'cis' | 'pci' | 'hipaa' | 'soc2' | 'internal';

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`/api/v1/compliance${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      ...options?.headers,
    },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${resp.status}`);
  }
  const json = await resp.json();
  return (json.data || json) as T;
}

const levelConfig: Record<ComplianceLevel, { label: string; color: string }> = {
  critical: { label: '严重', color: 'red' },
  high: { label: '高危', color: 'orange' },
  medium: { label: '中危', color: 'gold' },
  low: { label: '低危', color: 'blue' },
  info: { label: '信息', color: 'default' },
};

const statusConfig: Record<ScanStatus, { label: string; color: string }> = {
  pending: { label: '待扫描', color: 'default' },
  running: { label: '扫描中', color: 'processing' },
  completed: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
};

const frameworkConfig: Record<FrameworkType, { label: string; color: string }> = {
  owasp: { label: 'OWASP Top 10', color: 'red' },
  cis: { label: 'CIS Benchmark', color: 'blue' },
  pci: { label: 'PCI DSS', color: 'purple' },
  hipaa: { label: 'HIPAA', color: 'cyan' },
  soc2: { label: 'SOC 2', color: 'green' },
  internal: { label: '内部基线', color: 'default' },
};

const ComplianceScanPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [findings, setFindings] = useState<ComplianceFinding[]>([]);
  const [baselines, setBaselines] = useState<ComplianceBaseline[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm<{ name: string; framework: FrameworkType; description?: string }>();
  const [scanning, setScanning] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadCompliance = async () => {
    setLoading(true);
    setScanning(null);
    try {
      const [findingsRes, baselinesRes] = await Promise.all([
        apiCall<ComplianceFinding[]>('/findings'),
        apiCall<ComplianceBaseline[]>('/baselines'),
      ]);
      setFindings(Array.isArray(findingsRes) ? findingsRes : []);
      setBaselines(Array.isArray(baselinesRes) ? baselinesRes : []);
    } catch (_err: unknown) {
      message.warning('合规数据加载失败，显示默认状态');
      setFindings([]);
      setBaselines([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCompliance(); }, []);

  const handleScan = async (id: string, name: string) => {
    setScanning(id);
    try {
      await apiCall<void>(`/baselines/${id}/scan`, { method: 'POST' });
      message.success(`安全基线 "${name}" 扫描已启动`);
      loadCompliance();
    } catch (_err: unknown) {
      message.warning('扫描启动失败，请稍后重试');
    } finally {
      setScanning(null);
    }
  };

  const baselineColumns: ColumnsType<ComplianceBaseline> = [
    {
      title: '基线名称',
      dataIndex: 'name',
      key: 'name',
      render: (val: string) => <Text strong>{val}</Text>,
    },
    {
      title: '合规框架',
      dataIndex: 'framework',
      key: 'framework',
      width: 140,
      render: (val: string) => {
        const cfg = frameworkConfig[val as FrameworkType];
        return <Tag color={cfg?.color || 'default'}>{cfg?.label || val}</Tag>;
      },
    },
    {
      title: '规则数',
      dataIndex: 'rules',
      key: 'rules',
      width: 80,
    },
    {
      title: '合规率',
      dataIndex: 'passRate',
      key: 'passRate',
      width: 100,
      render: (val: number) => (
        <Progress
          type="circle"
          percent={val}
          size={40}
          strokeColor={val >= 80 ? colors.success[500] : val >= 50 ? colors.warning[500] : colors.error[500]}
        />
      ),
    },
    {
      title: '最后扫描',
      dataIndex: 'lastScan',
      key: 'lastScan',
      width: 160,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: ComplianceBaseline) => (
        <Button
          size="small"
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={scanning === record.id}
          onClick={() => handleScan(record.id, record.name)}
        >
          扫描
        </Button>
      ),
    },
  ];

  const findingColumns: ColumnsType<ComplianceFinding> = [
    {
      title: '规则 ID',
      dataIndex: 'rule',
      key: 'rule',
      width: 120,
      render: (val: string) => <Text code>{val}</Text>,
    },
    {
      title: '检测目标',
      dataIndex: 'target',
      key: 'target',
      render: (val: string) => <Text>{val}</Text>,
    },
    {
      title: '风险等级',
      dataIndex: 'level',
      key: 'level',
      width: 90,
      render: (val: ComplianceLevel) => (
        <Tag color={levelConfig[val].color}>{levelConfig[val].label}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (val: ScanStatus) => (
        <Tag color={statusConfig[val].color}>{statusConfig[val].label}</Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '发现时间',
      dataIndex: 'detectedAt',
      key: 'detectedAt',
      width: 160,
    },
  ];

  const totalRules = baselines.reduce((sum, b) => sum + b.rules, 0);
  const avgPassRate = baselines.length > 0
    ? Math.round(baselines.reduce((s, b) => s + b.passRate, 0) / baselines.length)
    : 0;
  const criticalCount = findings.filter((f) => f.level === 'critical' || f.level === 'high').length;

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <FileProtectOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
        安全合规检查
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        安全基线扫描 · 合规框架检测 · 违规发现与修复跟踪
      </Text>

      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="合规基线数" value={baselines.length} prefix={<FileProtectOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="规则总数" value={totalRules} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="平均合规率"
              value={avgPassRate}
              suffix="%"
              valueStyle={{ color: avgPassRate >= 80 ? colors.success[500] : colors.warning[500] }}
              prefix={<ScanOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="高危发现数"
              value={criticalCount}
              valueStyle={{ color: colors.error[500] }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="合规基线"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadCompliance}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
              新建基线
            </Button>
          </Space>
        }
        style={{ marginBottom: spacing.md }}
      >
        <Table
          dataSource={baselines}
          columns={baselineColumns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={false}
          locale={{ emptyText: <Empty description="暂无合规基线，请创建 OWASP/CIS/PCI/SOC2 基线" /> }}
        />
      </Card>

      <Card title="违规发现列表">
        <Table
          dataSource={findings}
          columns={findingColumns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 8, showSizeChanger: false }}
          locale={{ emptyText: <Empty description="暂无违规发现，请先执行安全基线扫描" /> }}
        />
      </Card>

      <Modal
        title="新建合规基线"
        open={createModalOpen}
        confirmLoading={creating}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields(); }}
        onOk={async () => {
          const values = await createForm.validateFields();
          setCreating(true);
          try {
            await apiCall<ComplianceBaseline>('/baselines', {
              method: 'POST',
              body: JSON.stringify(values),
            });
            message.success(`合规基线 "${values.name}" 创建成功`);
            setCreateModalOpen(false);
            createForm.resetFields();
            loadCompliance();
          } catch (_err: unknown) {
            message.warning('基线创建失败，请稍后重试');
          } finally {
            setCreating(false);
          }
        }}
        okText="创建"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item label="基线名称" name="name" rules={[{ required: true, message: '请输入基线名称' }]}>
            <Input placeholder="例: OWASP Top 10 2023 基线" />
          </Form.Item>
          <Form.Item label="合规框架" name="framework" rules={[{ required: true, message: '请选择合规框架' }]}>
            <Select placeholder="选择合规框架">
              <Option value="owasp">OWASP Top 10</Option>
              <Option value="cis">CIS Benchmark</Option>
              <Option value="pci">PCI DSS</Option>
              <Option value="hipaa">HIPAA</Option>
              <Option value="soc2">SOC 2</Option>
              <Option value="internal">内部基线</Option>
            </Select>
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} placeholder="基线描述说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ComplianceScanPage;
