/**
 * Code Scan / SAST Page (H1.8 OWASP Top 10)
 * Static Application Security Testing - code vulnerability scanning, OWASP Top 10 detection
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
  CodeOutlined,
  BugOutlined,
  ShieldOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;
const { Option } = Select;

type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';
type VulnCategory = 'injection' | 'auth' | 'xss' | 'csrf' | 'security_misconfig' | 'sensitive_data' | 'aam' | 'vulnerable_components' | 'integrity' | 'logging';

interface ScanRecord {
  id: string;
  target: string;
  branch: string;
  status: ScanStatus;
  totalVulns: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  duration: number;
  startedAt: string;
}

interface VulnFinding {
  id: string;
  category: VulnCategory;
  severity: SeverityLevel;
  file: string;
  line: number;
  description: string;
  fix?: string;
  scanId: string;
}

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`/api/v1/security/code-scan${path}`, {
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

const severityConfig: Record<SeverityLevel, { label: string; color: string }> = {
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

const categoryConfig: Record<VulnCategory, { label: string; owasp: string }> = {
  injection: { label: '注入攻击', owasp: 'A03:2021' },
  auth: { label: '身份认证失败', owasp: 'A07:2021' },
  xss: { label: '跨站脚本', owasp: 'A03:2021' },
  csrf: { label: 'CSRF 攻击', owasp: 'A05:2021' },
  security_misconfig: { label: '安全配置错误', owasp: 'A05:2021' },
  sensitive_data: { label: '敏感数据泄露', owasp: 'A02:2021' },
  aam: { label: '访问控制失效', owasp: 'A01:2021' },
  vulnerable_components: { label: '漏洞组件', owasp: 'A06:2021' },
  integrity: { label: '完整性校验失败', owasp: 'A06:2021' },
  logging: { label: '日志审计不足', owasp: 'A09:2021' },
};

const CodeScanPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [vulns, setVulns] = useState<VulnFinding[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm<{ target: string; branch?: string }>();
  const [scanning, setScanning] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadScans = async () => {
    setLoading(true);
    try {
      const [scansRes, vulnsRes] = await Promise.all([
        apiCall<ScanRecord[]>('/scans'),
        apiCall<VulnFinding[]>('/findings'),
      ]);
      setScans(Array.isArray(scansRes) ? scansRes : []);
      setVulns(Array.isArray(vulnsRes) ? vulnsRes : []);
    } catch (_err: unknown) {
      message.warning('代码扫描数据加载失败，显示默认状态');
      setScans([]);
      setVulns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadScans(); }, []);

  const handleScan = async (id: string) => {
    setScanning(id);
    try {
      await apiCall<void>(`/scans/${id}/run`, { method: 'POST' });
      message.success('代码安全扫描已启动');
      loadScans();
    } catch (_err: unknown) {
      message.warning('扫描启动失败，请稍后重试');
    } finally {
      setScanning(null);
    }
  };

  const scanColumns: ColumnsType<ScanRecord> = [
    {
      title: '扫描目标',
      dataIndex: 'target',
      key: 'target',
      render: (val: string) => <Text strong>{val}</Text>,
    },
    {
      title: '分支',
      dataIndex: 'branch',
      key: 'branch',
      width: 100,
      render: (val: string) => <Text code>{val}</Text>,
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
      title: '漏洞总数',
      dataIndex: 'totalVulns',
      key: 'totalVulns',
      width: 90,
      render: (val: number) => (
        <Tag color={val > 0 ? 'error' : 'success'}>{val}</Tag>
      ),
    },
    {
      title: 'C/H/M/L',
      key: 'breakdown',
      width: 120,
      render: (_: unknown, record: ScanRecord) => (
        <Space size="small">
          <Tag color="red">{record.critical}</Tag>
          <Tag color="orange">{record.high}</Tag>
          <Tag color="gold">{record.medium}</Tag>
          <Tag color="blue">{record.low}</Tag>
        </Space>
      ),
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      render: (val: number) => <Text>{val}s</Text>,
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 160,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: ScanRecord) => (
        <Button
          size="small"
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={scanning === record.id}
          disabled={record.status === 'running'}
          onClick={() => handleScan(record.id)}
        >
          重跑
        </Button>
      ),
    },
  ];

  const vulnColumns: ColumnsType<VulnFinding> = [
    {
      title: 'OWASP 分类',
      dataIndex: 'category',
      key: 'category',
      width: 140,
      render: (val: VulnCategory) => {
        const cfg = categoryConfig[val];
        return <Tag color="error">{cfg.label} ({cfg.owasp})</Tag>;
      },
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 90,
      render: (val: SeverityLevel) => (
        <Tag color={severityConfig[val].color}>{severityConfig[val].label}</Tag>
      ),
    },
    {
      title: '文件位置',
      key: 'location',
      width: 200,
      render: (_: unknown, record: VulnFinding) => (
        <Text code>{record.file}:{record.line}</Text>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '修复建议',
      dataIndex: 'fix',
      key: 'fix',
      ellipsis: true,
    },
  ];

  const completedScans = scans.filter((s) => s.status === 'completed');
  const totalVulns = vulns.length;
  const highAndAboveVulns = vulns.filter((v) => v.severity === 'critical' || v.severity === 'high').length;
  const passRate = completedScans.length > 0
    ? Math.round((completedScans.filter((s) => s.totalVulns === 0).length / completedScans.length) * 100)
    : 0;

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <CodeOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
        代码安全扫描 (SAST)
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        OWASP Top 10 静态分析 · 漏洞检测 · 修复建议
      </Text>

      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="扫描任务数" value={scans.length} prefix={<ShieldOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="漏洞总数" value={totalVulns} prefix={<BugOutlined />} valueStyle={{ color: colors.error[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="严重+高危漏洞"
              value={highAndAboveVulns}
              valueStyle={{ color: colors.error[500] }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="安全通过率"
              value={passRate}
              suffix="%"
              valueStyle={{ color: passRate >= 80 ? colors.success[500] : colors.warning[500] }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="扫描任务列表"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadScans}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
              新建扫描
            </Button>
          </Space>
        }
        style={{ marginBottom: spacing.md }}
      >
        <Table
          dataSource={scans}
          columns={scanColumns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={false}
          locale={{ emptyText: <Empty description="暂无代码扫描任务，请创建扫描任务执行 SAST 分析" /> }}
        />
      </Card>

      <Card title="漏洞发现列表">
        <Table
          dataSource={vulns}
          columns={vulnColumns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 8, showSizeChanger: false }}
          locale={{ emptyText: <Empty description="暂无漏洞发现，请先执行代码扫描" /> }}
        />
      </Card>

      <Modal
        title="新建代码扫描"
        open={createModalOpen}
        confirmLoading={creating}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields(); }}
        onOk={async () => {
          const values = await createForm.validateFields();
          setCreating(true);
          try {
            await apiCall<ScanRecord>('/scans', {
              method: 'POST',
              body: JSON.stringify(values),
            });
            message.success(`代码扫描 "${values.target}" 已创建`);
            setCreateModalOpen(false);
            createForm.resetFields();
            loadScans();
          } catch (_err: unknown) {
            message.warning('扫描创建失败，请稍后重试');
          } finally {
            setCreating(false);
          }
        }}
        okText="创建"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item label="扫描目标" name="target" rules={[{ required: true, message: '请输入扫描目标' }]}>
            <Input placeholder="例: orion-frontend 或 git@github.com:orion/orion-frontend.git" />
          </Form.Item>
          <Form.Item label="分支" name="branch">
            <Input placeholder="默认 main" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CodeScanPage;
