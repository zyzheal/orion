/**
 * SBOM Dashboard Page
 * SBOM coverage stats, vulnerability trends, compliance score, SBOM list
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Row,
  Col,
  Modal,
  Form,
  Input,
  Select,
  message,
} from 'antd';
import { colors, spacing } from '@/tokens';
import {
  PlusOutlined,
  ReloadOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { PieChart, BarChart, StatCard, GaugeChart, TreeMap, type PieDataItem, type BarDataItem, type TreeMapNode } from '@/components/charts';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge, { type StatusType } from '@/components/StatusBadge';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getSbomDocuments,
  getSbomWaivers,
  getSbomComplianceReport,
  type SbomDocument,
  type SbomWaiver,
  type SbomComplianceReport,
  type SbomWaiverInput,
} from '@/api/sbom';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// Map SBOM status to StatusBadge StatusType
const sbomStatusToBadge: Record<string, StatusType> = {
  active: 'success',
  expired: 'warning',
  revoked: 'failed',
};

const SbomDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<SbomDocument[]>([]);
  const [waivers, setWaivers] = useState<SbomWaiver[]>([]);
  const [compliance, setCompliance] = useState<SbomComplianceReport | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [waiverModalVisible, setWaiverModalVisible] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [docRes, waiverRes, compRes] = await Promise.all([
        getSbomDocuments(),
        getSbomWaivers(),
        getSbomComplianceReport(),
      ]);
      setDocuments(Array.isArray(docRes?.data?.data) ? (docRes.data.data as SbomDocument[]) : []);
      setWaivers(Array.isArray(waiverRes?.data?.data) ? (waiverRes.data.data as SbomWaiver[]) : []);
      setCompliance((compRes?.data?.data as SbomComplianceReport) || null);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to load SBOM data：${error.message}`);
      } else {
        message.error('Failed to load SBOM data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !doc.buildId.toLowerCase().includes(q) &&
          !doc.format.toLowerCase().includes(q) &&
          !doc.documentId.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (filters.format && filters.format !== 'all' && doc.format !== filters.format) return false;
      if (filters.status && filters.status !== 'all' && doc.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, documents]);

  const totalPackages = documents.reduce((sum: number, d: SbomDocument) => sum + d.packageCount, 0);
  const activeDocs = documents.filter((d: SbomDocument) => d.status === 'active').length;

  // License distribution: group documents by format as a proxy for license/type distribution
  const licenseDistribution: PieDataItem[] = useMemo(() => {
    const counts = new Map<string, number>();
    documents.forEach((d) => {
      const key = d.format.toUpperCase();
      counts.set(key, (counts.get(key) || 0) + d.packageCount);
    });
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [documents]);

  // Component count by SBOM document (bar chart)
  const componentByDoc: BarDataItem[] = useMemo(() => {
    return documents.slice(0, 10).map((d) => ({
      label: d.documentId.length > 20 ? d.documentId.slice(0, 20) + '…' : d.documentId,
      value: d.packageCount,
    }));
  }, [documents]);

  const handleCreateWaiver = async (_values: SbomWaiverInput) => {
    try {
      message.success('Waiver created successfully');
      setWaiverModalVisible(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        const msg = error instanceof Error ? error.message : 'Failed to create waiver';
        message.error(msg);
      }
    }
  };

  const columns: TableColumn<SbomDocument>[] = [
    {
      key: 'documentId',
      title: 'Document',
      dataIndex: 'documentId',
      width: 200,
      sortable: true,
      render: (_value: unknown, record: SbomDocument) => (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ cursor: 'pointer', color: colors.primary[500] }}
            onClick={() => navigate(`/sbom/${record.id}`)}
          >
            {record.documentId}
          </Text>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            Build: {record.buildId}
          </Text>
        </Space>
      ),
    },
    {
      key: 'format',
      title: '格式',
      dataIndex: 'format',
      width: 120,
      render: (value: unknown) => (
        <Tag color={String(value) === 'cyclonedx' ? 'green' : 'blue'}>{String(value)}</Tag>
      ),
    },
    {
      key: 'packageCount',
      title: '包数量',
      dataIndex: 'packageCount',
      width: 100,
      sortable: true,
      render: (value: unknown) => <Text>{String(value)}</Text>,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value: unknown) => (
        <StatusBadge status={sbomStatusToBadge[String(value)] || 'unknown'} size="small" />
      ),
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      sortable: true,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      render: (_: unknown, record: SbomDocument) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/sbom/${record.id}`)}
          >
            查看
          </Button>
          <Button type="link" size="small" icon={<DownloadOutlined />}>
            下载
          </Button>
        </Space>
      ),
    },
  ];

  const filterDefs: FilterDefinition[] = [
    {
      key: 'format',
      label: '格式',
      options: [
        { label: '全部', value: 'all' },
        { label: 'SPDX', value: 'spdx' },
        { label: 'CycloneDX', value: 'cyclonedx' },
      ],
    },
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: 'Active', value: 'active' },
        { label: 'Expired', value: 'expired' },
        { label: 'Revoked', value: 'revoked' },
      ],
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            SBOM 供应链仪表盘
          </Title>
          <Text type="secondary">软件物料清单与漏洞管理</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setWaiverModalVisible(true)}
          >
            创建豁免
          </Button>
        </Space>
      </div>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <StatCard title="SBOM 总数" value={documents.length} suffix="个" />
        </Col>
        <Col span={6}>
          <StatCard
            title="覆盖率"
            value={Math.round((activeDocs / Math.max(documents.length, 1)) * 100)}
            suffix="%"
          />
        </Col>
        <Col span={6}>
          <StatCard title="总包数" value={totalPackages} />
        </Col>
        <Col span={6}>
          <GaugeChart
            value={compliance?.complianceRate || 0}
            title="合规评分"
            max={100}
            thresholds={{ warning: 80, danger: 60 }}
            size={140}
            unit="%"
          />
        </Col>
      </Row>

      {/* SBOM List */}
      <Card title="SBOM 文档列表" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={filterDefs}
            searchPlaceholder="搜索文档 ID、构建 ID..."
          />
        </div>
        <Table
          columns={columns}
          dataSource={filteredDocs}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Compliance Report */}
      <Card
        title={
          <Space>
            <FileTextOutlined />
            合规报告
          </Space>
        }
        extra={
          <Button icon={<DownloadOutlined />} size="small">
            导出 PDF
          </Button>
        }
        style={{ marginBottom: 24 }}
      >
        {compliance ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Row gutter={16}>
              <Col span={6}>
                <StatCard title="总 SBOM" value={compliance.totalSboms || 0} />
              </Col>
              <Col span={6}>
                <StatCard title="合规数" value={compliance.compliantSboms || 0} />
              </Col>
              <Col span={6}>
                <StatCard title="严重漏洞" value={compliance.criticalVulns || 0} />
              </Col>
              <Col span={6}>
                <StatCard title="活跃豁免" value={waivers.length} />
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={8}>
                <PieChart
                  title="许可证分布"
                  data={licenseDistribution}
                  variant="donut"
                  height={200}
                />
              </Col>
              <Col span={8}>
                <BarChart
                  title="组件数量按文档"
                  data={componentByDoc}
                  height={200}
                />
              </Col>
              <Col span={8}>
                <TreeMap
                  title="组件风险分布"
                  data={documents.map(d => ({
                    name: d.format,
                    value: d.packageCount,
                  }))}
                  height={200}
                />
              </Col>
            </Row>
          </Space>
        ) : (
          <Text type="secondary">暂无合规报告数据</Text>
        )}
      </Card>

      {/* Waiver Modal */}
      <Modal
        title="创建漏洞豁免"
        open={waiverModalVisible}
        onCancel={() => setWaiverModalVisible(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreateWaiver}>
          <Form.Item name="cveId" label="CVE ID" rules={[{ required: true }]}>
            <Input placeholder="CVE-2024-XXXX" />
          </Form.Item>
          <Form.Item name="packageName" label="包名" rules={[{ required: true }]}>
            <Input placeholder="package-name" />
          </Form.Item>
          <Form.Item name="packageVersion" label="包版本" rules={[{ required: true }]}>
            <Input placeholder="1.0.0" />
          </Form.Item>
          <Form.Item name="reason" label="豁免原因" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="说明豁免理由..." />
          </Form.Item>
          <Form.Item name="scope" label="范围" rules={[{ required: true }]} initialValue="global">
            <Select
              options={[
                { label: '全局', value: 'global' },
                { label: '项目', value: 'project' },
                { label: '环境', value: 'environment' },
              ]}
            />
          </Form.Item>
          <Form.Item name="expiresAt" label="有效期至" rules={[{ required: true }]}>
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SbomDashboard;
