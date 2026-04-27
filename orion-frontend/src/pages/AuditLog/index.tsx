/**
 * Audit Log Page
 * Immutable audit chain viewing and integrity verification
 */
import React, { useState } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Table,
  Space,
  Button,
  Statistic,
  Drawer,
  Descriptions,
  message,
} from 'antd';
import { colors } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import {
  ReloadOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import DashboardLayout from '@/components/DashboardLayout';
import {
  getAuditLogs,
  getChainInfo,
  verifyChain,
  getStorageStats,
  generateReport,
  type AuditLogEntry,
  type ChainInfo,
  type StorageStats,
} from '@/api/audit';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const AuditLogPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [chainInfo, setChainInfo] = useState<ChainInfo | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsRes, chainRes, storageRes] = await Promise.all([
        getAuditLogs({ limit: 50 }),
        getChainInfo(),
        getStorageStats(),
      ]);
      setAuditLogs(logsRes.data.data.entries || []);
      setChainInfo(chainRes.data.data);
      setStorageStats(storageRes.data.data);
    } catch (error) {
      console.error('Failed to load audit data:', error);
      message.error('加载审计日志失败');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    try {
      const result = await verifyChain();
      if (result.data.data.result.isValid) {
        message.success('审计链完整性验证通过');
      } else {
        message.warning(`发现 ${result.data.data.result.breaks?.length || 0} 处链断裂`);
      }
    } catch (error) {
      message.error('验证失败');
    }
  };

  const handleGenerateReport = async () => {
    try {
      await generateReport();
      message.success('完整性报告已生成');
    } catch (error) {
      message.error('生成报告失败');
    }
  };

  const handleViewDetail = (log: AuditLogEntry) => {
    setSelectedLog(log);
    setDrawerOpen(true);
  };

  const columns = [
    {
      title: '序列号',
      dataIndex: 'sequenceNumber',
      key: 'sequenceNumber',
      width: 80,
      render: (seq: number) => `#${seq}`,
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      render: (text: string) => (
        <Space>
          <FileTextOutlined />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '用户 ID',
      dataIndex: 'userId',
      key: 'userId',
    },
    {
      title: '资源类型',
      dataIndex: 'resourceType',
      key: 'resourceType',
      render: (text?: string) => text || '-',
    },
    {
      title: '时间戳',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (ts: string) => dayjs(ts).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '详情',
      key: 'detail',
      render: (_: any, record: AuditLogEntry) => (
        <Button type="link" size="small" onClick={() => handleViewDetail(record)}>
          查看
        </Button>
      ),
    },
  ];

  const tableData = auditLogs.map((log) => ({
    ...log,
    key: log.id,
  }));

  const isInitialLoading = loading && auditLogs.length === 0;

  return (
    <DashboardLayout>
      {isInitialLoading ? (
        <div style={{ padding: 24 }}>
          <PageSkeleton cards={3} rows={10} />
        </div>
      ) : (
      <div style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <Title level={2}>审计日志</Title>
            <Text type="secondary">不可逆审计链、完整性验证</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              刷新
            </Button>
            <Button icon={<SafetyCertificateOutlined />} onClick={handleVerify}>
              验证完整性
            </Button>
            <Button icon={<FileTextOutlined />} onClick={handleGenerateReport}>
              生成报告
            </Button>
          </Space>
        </div>

        {/* Summary Cards */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="审计条目总数"
                value={chainInfo?.totalEntries || 0}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="最早序列号"
                value={chainInfo?.firstSequence || 0}
                valueStyle={{ color: colors.primary[500] }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="最新序列号"
                value={chainInfo?.lastSequence || 0}
                valueStyle={{ color: colors.success[500] }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="存储条目数"
                value={storageStats?.totalEntries || 0}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* Chain Hash Info */}
        <Card title="链信息" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Text type="secondary">创世 Hash:</Text>
              <Text code style={{ marginLeft: 8 }} copyable>
                {chainInfo?.genesisHash || 'N/A'}
              </Text>
            </Col>
            <Col span={12}>
              <Text type="secondary">最新链 Hash:</Text>
              <Text code style={{ marginLeft: 8 }} copyable>
                {chainInfo?.lastChainHash || 'N/A'}
              </Text>
            </Col>
          </Row>
        </Card>

        {/* Audit Log Table */}
        <Card title="审计日志列表">
          <Table
            columns={columns}
            dataSource={tableData}
            loading={loading}
            pagination={{ pageSize: 10 }}
            size="small"
          />
        </Card>

        {/* Detail Drawer */}
        <Drawer
          title="审计日志详情"
          placement="right"
          width={700}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        >
          {selectedLog && (
            <Descriptions column={1} bordered>
              <Descriptions.Item label="ID">{selectedLog.id}</Descriptions.Item>
              <Descriptions.Item label="序列号">{selectedLog.sequenceNumber}</Descriptions.Item>
              <Descriptions.Item label="操作">{selectedLog.action}</Descriptions.Item>
              <Descriptions.Item label="用户 ID">{selectedLog.userId}</Descriptions.Item>
              <Descriptions.Item label="租户 ID">{selectedLog.tenantId || '-'}</Descriptions.Item>
              <Descriptions.Item label="资源类型">{selectedLog.resourceType || '-'}</Descriptions.Item>
              <Descriptions.Item label="资源 ID">{selectedLog.resourceId || '-'}</Descriptions.Item>
              <Descriptions.Item label="IP 地址">{selectedLog.ipAddress || '-'}</Descriptions.Item>
              <Descriptions.Item label="时间戳">
                {dayjs(selectedLog.timestamp).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="内容 Hash">
                <Text code copyable>
                  {selectedLog.contentHash}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="链 Hash">
                <Text code copyable>
                  {selectedLog.chainHash}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="前 Hash">
                <Text code copyable>
                  {selectedLog.prevHash}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="签名">{selectedLog.signature || '未签名'}</Descriptions.Item>
              <Descriptions.Item label="详情">
                <pre style={{ maxHeight: 200, overflow: 'auto' }}>
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </Descriptions.Item>
            </Descriptions>
          )}
        </Drawer>
      </div>
      )}
    </DashboardLayout>
  );
};

export default AuditLogPage;
