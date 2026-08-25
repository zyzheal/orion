import { colors, spacing } from '@/tokens';

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
  TruckOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import {
  getSbomDocuments,
  getSbomVulnerabilityResults,
  getSbomComplianceReport,
  createSbomDocument,
  signSbomAttestation,
  deleteSbomDocument,
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
      setDocuments(((docRes.data as { data?: unknown })?.data ?? []) as SbomDocument[]);
      setVulnResults(
        ((vulnRes.data as { data?: unknown })?.data ?? []) as SbomVulnerabilityResult[]
      );
      setComplianceRate(
        (complianceRes.data as { data?: { complianceRate?: number } })?.data?.complianceRate ?? 0
      );
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

  const handleSign = async (id: string, documentId: string) => {
    Modal.confirm({
      title: '确认签名SBOM文档？',
      content: `确定要为文档 "${documentId}" 生成SLSA签名吗？`,
      okText: '确认签名',
      cancelText: '取消',
      okButtonProps: { type: 'primary' },
      onOk: async () => {
        try {
          await signSbomAttestation(id);
          message.success('SBOM 签名成功');
          loadData();
        } catch {
          message.error('签名失败');
        }
      },
    });
  };

  const handleDeleteDocument = (doc: SbomDocument) => {
    Modal.confirm({
      title: '确认删除SBOM文档？',
      content: `确定要删除文档 "${doc.documentId}" 吗？此操作不可撤销。`,
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteSbomDocument(doc.id);
          message.success('SBOM 文档已删除');
          loadData();
        } catch {
          message.error('删除失败');
        }
      },
    });
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
          <Button size="small" onClick={() => handleSign(record.id, record.documentId)}>
            签名
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            复制
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteDocument(record)}
          >
            删除
          </Button>
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
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <TruckOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
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
      <Row gutter={24} style={{ marginBottom: spacing.lg }}>
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
      <Card
        title={
          <>
            <FileTextOutlined /> SBOM Documents
          </>
        }
        style={{ marginBottom: spacing.lg }}
      >
        <Table
          columns={docColumns}
          dataSource={documents}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Vulnerability Results */}
      <Card
        title={
          <>
            <ScanOutlined /> Vulnerability Scan Results
          </>
        }
      >
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
