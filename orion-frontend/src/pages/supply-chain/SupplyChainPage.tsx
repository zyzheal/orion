/**
 * Supply Chain Security Page
 * Phase 3 - SBOM documents, vulnerability scanning, and compliance reports
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  message,
  Typography,
  Progress,
} from 'antd';
import {
  SecurityScanOutlined,
  PlusOutlined,
  ReloadOutlined,
  ScanOutlined,
  FileTextOutlined,
  TruckOutlined,} from '@ant-design/icons';
import {
  getSbomDocuments,
  getSbomVulnerabilityResults,
  getSbomComplianceReport,
  createSbomDocument,
  signSbomAttestation,
  type SbomDocument,
  type SbomVulnerabilityResult,
} from '@/api/sbom';

const { Title, Text } = Typography;

const SupplyChainPage: React.FC = () => {
  const [documents, setDocuments] = useState<SbomDocument[]>([]);
  const [vulnResults, setVulnResults] = useState<SbomVulnerabilityResult[]>([]);
  const [complianceRate, setComplianceRate] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [docRes, vulnRes, complianceRes] = await Promise.all([
        getSbomDocuments(),
        getSbomVulnerabilityResults(),
        getSbomComplianceReport(),
      ]);
      setDocuments((docRes.data as any) || []);
      setVulnResults((vulnRes.data as any) || []);
      setComplianceRate((complianceRes.data as any)?.complianceRate ?? 0);
    } catch {
      message.error('Failed to load supply chain data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      await createSbomDocument({
        buildId: values.buildId,
        pipelineRunId: values.pipelineRunId || '',
        format: values.format,
        specVersion: values.specVersion,
        documentId: values.documentId,
        content: {},
      });
      message.success('SBOM document created');
      setCreateModalOpen(false);
      loadData();
    } catch {
      message.error('Failed to create SBOM document');
    }
  };

  const handleSign = async (id: string) => {
    try {
      await signSbomAttestation(id);
      message.success('SBOM signed successfully');
      loadData();
    } catch {
      message.error('Failed to sign SBOM');
    }
  };

  const statusColor: Record<string, string> = {
    active: 'green',
    expired: 'gold',
    revoked: 'red',
  };

  const docColumns = [
    { title: 'Document ID', dataIndex: 'documentId', key: 'documentId' },
    { title: 'Build ID', dataIndex: 'buildId', key: 'buildId' },
    {
      title: 'Format',
      dataIndex: 'format',
      key: 'format',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    { title: 'Packages', dataIndex: 'packageCount', key: 'packageCount' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag>,
    },
    { title: 'Created', dataIndex: 'createdAt', key: 'createdAt' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: SbomDocument) => (
        <Space>
          <Button size="small" onClick={() => handleSign(record.id)}>Sign</Button>
        </Space>
      ),
    },
  ];

  const vulnColumns = [
    { title: 'Scanner', dataIndex: 'scanner', key: 'scanner' },
    { title: 'Total', dataIndex: 'totalVulns', key: 'totalVulns' },
    {
      title: 'Critical',
      dataIndex: 'criticalCount',
      key: 'criticalCount',
      render: (v: number) => <Tag color={v > 0 ? 'red' : 'green'}>{v}</Tag>,
    },
    {
      title: 'High',
      dataIndex: 'highCount',
      key: 'highCount',
      render: (v: number) => <Tag color={v > 0 ? 'orange' : 'green'}>{v}</Tag>,
    },
    {
      title: 'Gate',
      dataIndex: 'gatePassed',
      key: 'gatePassed',
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Passed' : 'Failed'}</Tag>,
    },
    { title: 'Scanned At', dataIndex: 'scannedAt', key: 'scannedAt' },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <TruckOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            <SecurityScanOutlined /> Supply Chain Security
          </Title>
          <Text type="secondary">SBOM management, vulnerability scanning, and compliance</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            Create SBOM
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="SBOM Documents" value={documents.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Vulnerability Scans" value={vulnResults.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Compliance Rate" value={complianceRate} suffix="%" />
            <Progress
              percent={complianceRate}
              status={complianceRate >= 80 ? 'success' : 'exception'}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active"
              value={documents.filter((d) => d.status === 'active').length}
            />
          </Card>
        </Col>
      </Row>

      {/* SBOM Documents */}
      <Card title={<><FileTextOutlined /> SBOM Documents</>} style={{ marginBottom: 24 }}>
        <Table
          columns={docColumns}
          dataSource={documents}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Vulnerability Results */}
      <Card title={<><ScanOutlined /> Vulnerability Scan Results</>}>
        <Table
          columns={vulnColumns}
          dataSource={vulnResults}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="Create SBOM Document"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="Build ID" name="buildId" rules={[{ required: true }]}>
            <Input placeholder="Build ID" />
          </Form.Item>
          <Form.Item label="Pipeline Run ID" name="pipelineRunId">
            <Input placeholder="Pipeline Run ID" />
          </Form.Item>
          <Form.Item label="Format" name="format" initialValue="cyclonedx">
            <Select
              options={[
                { value: 'cyclonedx', label: 'CycloneDX' },
                { value: 'spdx', label: 'SPDX' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Spec Version" name="specVersion" initialValue="1.4">
            <Input placeholder="1.4" />
          </Form.Item>
          <Form.Item label="Document ID" name="documentId" rules={[{ required: true }]}>
            <Input placeholder="Unique document ID" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SupplyChainPage;
