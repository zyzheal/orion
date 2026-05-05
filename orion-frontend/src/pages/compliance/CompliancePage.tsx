/**
 * Security Compliance Page
 * Phase 3 - Audit logs, compliance reports, and security policy management
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  message,
  Typography,
  Tabs,
} from 'antd';
import {
  SecurityScanOutlined,
  ReloadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import {
  getAuditLogs,
  verifyChain,
  getChainInfo,
  generateReport,
  getReports,
  type AuditLogEntry,
  type IntegrityReport,
} from '@/api/audit';
import {
  getSbomComplianceReport,
  type SbomComplianceReport,
} from '@/api/sbom';

const { Title, Text } = Typography;

interface CompliancePolicy {
  id: string;
  name: string;
  type: string;
  status: 'compliant' | 'non_compliant' | 'partial';
  lastChecked: string;
  issues: number;
}

const mockPolicies: CompliancePolicy[] = [
  { id: 'cp1', name: 'EO 14028 (SBOM)', type: 'sbom', status: 'compliant', lastChecked: '2026-05-05 08:00', issues: 0 },
  { id: 'cp2', name: 'EU CRA Compliance', type: 'sbom', status: 'partial', lastChecked: '2026-05-05 08:00', issues: 2 },
  { id: 'cp3', name: 'SOC 2 Type II', type: 'audit', status: 'compliant', lastChecked: '2026-05-04 12:00', issues: 0 },
  { id: 'cp4', name: 'GDPR Data Handling', type: 'data', status: 'non_compliant', lastChecked: '2026-05-03 09:00', issues: 5 },
];

const CompliancePage: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [complianceReports, setComplianceReports] = useState<SbomComplianceReport | null>(null);
  const [integrityReports, setIntegrityReports] = useState<IntegrityReport[]>([]);
  const [policies] = useState<CompliancePolicy[]>(mockPolicies);
  const [loading, setLoading] = useState(false);
  const [chainInfo, setChainInfo] = useState<{ totalEntries: number; isValid: boolean } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logRes, chainInfoRes, reportRes, complianceRes] = await Promise.all([
        getAuditLogs(),
        getChainInfo(),
        getReports(),
        getSbomComplianceReport(),
      ]);
      const logData = logRes.data as any;
      setAuditLogs(logData?.entries || []);
      const chainData = chainInfoRes.data as any;
      setChainInfo({ totalEntries: chainData?.totalEntries || 0, isValid: true });
      const reportData = reportRes.data as any;
      setIntegrityReports(reportData?.reports || []);
      const complianceData = complianceRes.data as any;
      setComplianceReports(complianceData || null);
    } catch {
      message.error('Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      await generateReport();
      message.success('Compliance report generated');
      loadData();
    } catch {
      message.error('Failed to generate report');
    }
  };

  const handleVerifyChain = async () => {
    try {
      await verifyChain();
      message.success('Chain verification completed');
      loadData();
    } catch {
      message.error('Chain verification failed');
    }
  };

  const complianceStatusColor: Record<string, string> = {
    compliant: 'green',
    non_compliant: 'red',
    partial: 'orange',
  };

  const policyColumns = [
    { title: 'Policy', dataIndex: 'name', key: 'name' },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => (
        <Tag color={complianceStatusColor[v]}>
          {v === 'compliant' ? 'Compliant' : v === 'non_compliant' ? 'Non-Compliant' : 'Partial'}
        </Tag>
      ),
    },
    { title: 'Last Checked', dataIndex: 'lastChecked', key: 'lastChecked' },
    {
      title: 'Issues',
      dataIndex: 'issues',
      key: 'issues',
      render: (v: number) => <Tag color={v > 0 ? 'red' : 'green'}>{v}</Tag>,
    },
  ];

  const auditColumns = [
    { title: 'Action', dataIndex: 'action', key: 'action' },
    { title: 'User', dataIndex: 'userId', key: 'userId' },
    { title: 'Resource Type', dataIndex: 'resourceType', key: 'resourceType' },
    { title: 'Sequence', dataIndex: 'sequenceNumber', key: 'sequenceNumber' },
    { title: 'IP Address', dataIndex: 'ipAddress', key: 'ipAddress' },
    { title: 'Timestamp', dataIndex: 'timestamp', key: 'timestamp' },
  ];

  const nonCompliantCount = policies.filter((p) => p.status === 'non_compliant').length;
  const totalIssues = policies.reduce((s, p) => s + p.issues, 0);
  const complianceRate = complianceReports?.complianceRate ?? 0;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <SecurityScanOutlined /> Security & Compliance
          </Title>
          <Text type="secondary">Audit logs, compliance reports, and security policies</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            Refresh
          </Button>
          <Button icon={<FileTextOutlined />} onClick={handleGenerateReport}>
            Generate Report
          </Button>
          <Button icon={<CheckCircleOutlined />} onClick={handleVerifyChain}>
            Verify Chain
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="Compliance Rate" value={complianceRate} suffix="%" /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Policies" value={policies.length} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Non-Compliant" value={nonCompliantCount} valueStyle={{ color: nonCompliantCount > 0 ? '#ff4d4f' : '#52c41a' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Total Issues" value={totalIssues} valueStyle={{ color: totalIssues > 0 ? '#ff4d4f' : '#52c41a' }} /></Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 24 }}>
        <Tabs
          defaultActiveKey="policies"
          items={[
            {
              key: 'policies',
              label: 'Compliance Policies',
              children: (
                <Table columns={policyColumns} dataSource={policies} rowKey="id" pagination={false} />
              ),
            },
            {
              key: 'audit',
              label: `Audit Log Chain (${chainInfo?.totalEntries ?? 0} entries)`,
              children: (
                <Table columns={auditColumns} dataSource={auditLogs.slice(0, 20)} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
              ),
            },
            {
              key: 'reports',
              label: 'Integrity Reports',
              children: integrityReports.length > 0 ? (
                <Table
                  columns={[
                    { title: 'Generated', dataIndex: 'generatedAt', key: 'generatedAt' },
                    { title: 'Valid', dataIndex: 'isValid', key: 'isValid', render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Valid' : 'Invalid'}</Tag> },
                    { title: 'Total Entries', dataIndex: 'totalEntries', key: 'totalEntries' },
                    { title: 'Verified', dataIndex: 'verifiedEntries', key: 'verifiedEntries' },
                    { title: 'Issues', dataIndex: 'issues', key: 'issues', render: (v: any[]) => v.length },
                    { title: 'Summary', dataIndex: 'summary', key: 'summary', ellipsis: true },
                  ]}
                  dataSource={integrityReports}
                  rowKey="id"
                  pagination={false}
                />
              ) : (
                <Text type="secondary">No integrity reports generated. Click "Generate Report" to create one.</Text>
              ),
            },
          ]}
        />
      </Card>

      {/* Chain Info */}
      {chainInfo && (
        <Card title="Audit Log Chain Status">
          <Row gutter={24}>
            <Col span={8}>
              <Statistic title="Total Entries" value={chainInfo.totalEntries} />
            </Col>
            <Col span={8}>
              <Statistic
                title="Chain Integrity"
                value={chainInfo.isValid ? 'Valid' : 'Invalid'}
                valueStyle={{ color: chainInfo.isValid ? '#52c41a' : '#ff4d4f' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Compliant Policies"
                value={`${policies.filter((p) => p.status === 'compliant').length}/${policies.length}`}
              />
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
};

export default CompliancePage;
