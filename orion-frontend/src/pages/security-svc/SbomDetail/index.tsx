/**
 * SBOM Detail Page
 * SBOM document detail with package list, vulnerability scan results, attestation status
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Descriptions,
  Table as AntTable,
  Modal,
  message,
  Spin,
} from 'antd';
import { colors, spacing } from '@/tokens';
import { ArrowLeftOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import StatusBadge from '@/components/StatusBadge';
import type { TableColumn } from '@/components/Table';
import {
  getSbomDocument,
  getSbomPackages,
  getSbomVulnerabilityResults,
  getSbomVulnerabilityDetails,
  getSbomAttestation,
  triggerSbomVulnerabilityScan,
  downloadSbomDocument,
} from '@/api/sbom';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface SbomPackage {
  id: string;
  name: string;
  version: string;
  license?: string;
  purl?: string;
  supplier?: string;
}

interface SbomVulnResult {
  id: string;
  scanner: string;
  totalVulns: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  gatePassed: boolean;
  scannedAt: string;
}

interface SbomVulnDetail {
  id: string;
  cveId: string;
  severity: string;
  cvssScore?: number;
  affectedPackage: string;
  fixedVersion?: string;
  description?: string;
}

const SbomDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [doc, setDoc] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [vulnResults, setVulnResults] = useState<any[]>([]);
  const [vulnDetails, setVulnDetails] = useState<any[]>([]);
  const [attestation, setAttestation] = useState<any>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [vulnDetailVisible, setVulnDetailVisible] = useState(false);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [docRes, pkgRes, vulnRes, attRes] = await Promise.all([
        getSbomDocument(id),
        getSbomPackages(id),
        getSbomVulnerabilityResults({ sbomId: id }),
        getSbomAttestation(id),
      ]);
      setDoc(docRes.data.data);
      setPackages(Array.isArray(pkgRes.data.data) ? pkgRes.data.data : []);
      setVulnResults(Array.isArray(vulnRes.data.data) ? vulnRes.data.data : []);
      setAttestation(attRes.data.data);
    } catch {
      message.error('Failed to load SBOM detail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleScan = async () => {
    if (!id) return;
    setScanLoading(true);
    try {
      await triggerSbomVulnerabilityScan({ sbomId: id });
      message.success('Vulnerability scan triggered');
      loadData();
    } catch {
      message.error('Failed to trigger scan');
    } finally {
      setScanLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!id || !doc) return;
    try {
      await downloadSbomDocument(id, doc.format);
      message.success('Download started');
    } catch {
      message.error('Failed to download');
    }
  };

  const handleViewVulnDetails = async (resultId: string) => {
    try {
      const res = await getSbomVulnerabilityDetails(resultId);
      setVulnDetails(Array.isArray(res.data.data) ? res.data.data : []);
      setVulnDetailVisible(true);
    } catch {
      message.error('Failed to load vulnerability details');
    }
  };

  const packageColumns: TableColumn<SbomPackage>[] = [
    {
      title: '包名',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (value: unknown) => <Text strong>{String(value)}</Text>,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 100,
      render: (value: unknown) => <Tag color="blue">{String(value)}</Tag>,
    },
    {
      title: '许可证',
      dataIndex: 'license',
      key: 'license',
      width: 120,
      render: (value: unknown) =>
        value ? <Tag>{String(value)}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: 'PURL',
      dataIndex: 'purl',
      key: 'purl',
      width: 250,
      render: (value: unknown) => (
        <Text code ellipsis style={{ maxWidth: 250 }}>
          {value ? String(value) : '-'}
        </Text>
      ),
    },
    {
      title: '供应商',
      dataIndex: 'supplier',
      key: 'supplier',
      width: 150,
      render: (value: unknown) => <Text type="secondary">{value ? String(value) : '-'}</Text>,
    },
  ];

  const vulnColumns: TableColumn<SbomVulnResult>[] = [
    {
      title: '扫描器',
      dataIndex: 'scanner',
      key: 'scanner',
      width: 100,
      render: (value: unknown) => <Tag>{String(value)}</Tag>,
    },
    {
      title: '总计',
      dataIndex: 'totalVulns',
      key: 'totalVulns',
      width: 80,
      render: (value: unknown) => <Text>{String(value)}</Text>,
    },
    {
      title: '严重',
      dataIndex: 'criticalCount',
      key: 'criticalCount',
      width: 80,
      render: (value: unknown) => {
        const v = Number(value);
        return v > 0 ? (
          <Text style={{ color: colors.error[600] }}>{String(v)}</Text>
        ) : (
          <Text type="secondary">0</Text>
        );
      },
    },
    {
      title: '高危',
      dataIndex: 'highCount',
      key: 'highCount',
      width: 80,
      render: (value: unknown) => {
        const v = Number(value);
        return v > 0 ? (
          <Text style={{ color: colors.warning[500] }}>{String(v)}</Text>
        ) : (
          <Text type="secondary">0</Text>
        );
      },
    },
    {
      title: '中危',
      dataIndex: 'mediumCount',
      key: 'mediumCount',
      width: 80,
      render: (value: unknown) => <Text>{String(value)}</Text>,
    },
    {
      title: '低危',
      dataIndex: 'lowCount',
      key: 'lowCount',
      width: 80,
      render: (value: unknown) => <Text type="secondary">{String(value)}</Text>,
    },
    {
      title: '门禁',
      dataIndex: 'gatePassed',
      key: 'gatePassed',
      width: 100,
      render: (value: unknown) => (
        <StatusBadge status={value ? 'success' : 'failed'} size="small" />
      ),
    },
    {
      title: '扫描时间',
      dataIndex: 'scannedAt',
      key: 'scannedAt',
      width: 160,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: any) => (
        <Button type="link" size="small" onClick={() => handleViewVulnDetails(record.id)}>
          详情
        </Button>
      ),
    },
  ];

  const vulnDetailColumns: TableColumn<SbomVulnDetail>[] = [
    {
      title: 'CVE ID',
      dataIndex: 'cveId',
      key: 'cveId',
      width: 160,
      render: (value: unknown) => (
        <Text code style={{ color: colors.primary[500] }}>
          {String(value)}
        </Text>
      ),
    },
    {
      title: '严重级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (value: unknown) => {
        const colorMap: Record<string, string> = {
          critical: 'red',
          high: 'orange',
          medium: 'gold',
          low: 'default',
        };
        return <Tag color={colorMap[String(value)] || 'default'}>{String(value)}</Tag>;
      },
    },
    {
      title: 'CVSS',
      dataIndex: 'cvssScore',
      key: 'cvssScore',
      width: 80,
      render: (value: unknown) => (value ? String(value) : '-'),
    },
    {
      title: '受影响包',
      dataIndex: 'affectedPackage',
      key: 'affectedPackage',
      width: 180,
      render: (value: unknown) => <Text>{String(value)}</Text>,
    },
    {
      title: '修复版本',
      dataIndex: 'fixedVersion',
      key: 'fixedVersion',
      width: 120,
      render: (value: unknown) =>
        value ? <Tag color="green">{String(value)}</Tag> : <Text type="secondary">无</Text>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (value: unknown) => <Text type="secondary">{value ? String(value) : '-'}</Text>,
    },
  ];

  if (!doc && !loading) {
    return <Text type="secondary">SBOM document not found</Text>;
  }

  return (
    <Spin spinning={loading}>
      <div style={{ padding: 0 }}>
        <div style={{ marginBottom: 24 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/sbom')}
            style={{ marginBottom: 16 }}
          >
            返回
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            SBOM 详情
          </Title>
        </div>

        {doc && (
          <Card style={{ marginBottom: 24 }}>
            <Descriptions title="文档信息" bordered column={3}>
              <Descriptions.Item label="Document ID">{doc.documentId}</Descriptions.Item>
              <Descriptions.Item label="格式">{doc.format}</Descriptions.Item>
              <Descriptions.Item label="规范版本">{doc.specVersion}</Descriptions.Item>
              <Descriptions.Item label="Build ID">{doc.buildId}</Descriptions.Item>
              <Descriptions.Item label="Pipeline Run">{doc.pipelineRunId}</Descriptions.Item>
              <Descriptions.Item label="包数量">{doc.packageCount}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <StatusBadge status={doc.status as any} size="small" />
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(doc.createdAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="过期时间">
                {doc.expiresAt ? dayjs(doc.expiresAt).format('YYYY-MM-DD') : '-'}
              </Descriptions.Item>
            </Descriptions>
            <Space style={{ marginTop: 16 }}>
              <Button icon={<DownloadOutlined />} onClick={handleDownload}>
                下载 {doc.format.toUpperCase()}
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleScan} loading={scanLoading}>
                重新扫描漏洞
              </Button>
            </Space>
          </Card>
        )}

        {/* Attestation */}
        {attestation && (
          <Card title="签名证明" style={{ marginBottom: 24 }}>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="签名类型">{attestation.attestationType}</Descriptions.Item>
              <Descriptions.Item label="验证状态">
                <StatusBadge status={attestation.verified ? 'success' : 'warning'} size="small" />
              </Descriptions.Item>
              <Descriptions.Item label="签名时间">
                {dayjs(attestation.signedAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="验证时间">
                {attestation.verifiedAt
                  ? dayjs(attestation.verifiedAt).format('YYYY-MM-DD HH:mm')
                  : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {/* Package List */}
        <Card title={`包清单 (${packages.length})`} style={{ marginBottom: 24 }}>
          <AntTable
            columns={packageColumns}
            dataSource={packages}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10 }}
          />
        </Card>

        {/* Vulnerability Scan Results */}
        <Card title="漏洞扫描结果" style={{ marginBottom: 24 }}>
          {vulnResults.length > 0 ? (
            <AntTable columns={vulnColumns} dataSource={vulnResults} rowKey="id" size="small" />
          ) : (
            <Text type="secondary">暂无漏洞扫描数据</Text>
          )}
        </Card>

        {/* Vulnerability Detail Modal */}
        <Modal
          title="漏洞详情"
          open={vulnDetailVisible}
          onCancel={() => setVulnDetailVisible(false)}
          footer={null}
          width={900}
        >
          <AntTable
            columns={vulnDetailColumns}
            dataSource={vulnDetails}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10 }}
          />
        </Modal>
      </div>
    </Spin>
  );
};

export default SbomDetail;
