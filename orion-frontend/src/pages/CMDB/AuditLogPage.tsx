/**
 * Audit Log Page for CMDB
 * 终端连接日志、会话审计、文件传输日志
 *
 * 2026-05-19: 从 orion-visor-ui 资产审计模块迁移至 CMDB
 */
import React, { useState } from 'react';
import {
  Typography,
  Table,
  type TableProps,
  Tag,
  Space,
  Button,
  Select,
  Card,
  Statistic,
  Row,
  Col,
  Descriptions,
  Drawer,
  Tabs,
} from 'antd';
import {
  ReloadOutlined,
  CloudServerOutlined,
  UserOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';

const { Text } = Typography;

// ============================================================================
// Types
// ============================================================================

interface TerminalConnectLog {
  id: string;
  username: string;
  hostname: string;
  hostIp: string;
  connectTime: string;
  disconnectTime?: string;
  duration?: string;
  status: 'active' | 'closed' | 'terminated';
  clientIp: string;
}

interface TerminalFileLog {
  id: string;
  username: string;
  hostname: string;
  filePath: string;
  fileName: string;
  fileSize: string;
  operation: 'upload' | 'download';
  timestamp: string;
  status: 'success' | 'failed';
}

// ============================================================================
// Mock Data
// ============================================================================

const mockConnectLogs: TerminalConnectLog[] = [
  {
    id: 'conn-001',
    username: 'admin',
    hostname: 'prod-web-01',
    hostIp: '10.0.1.10',
    connectTime: '2026-05-19 14:30:00',
    status: 'active',
    clientIp: '192.168.1.100',
  },
  {
    id: 'conn-002',
    username: 'operator',
    hostname: 'prod-api-01',
    hostIp: '10.0.2.20',
    connectTime: '2026-05-19 13:15:00',
    disconnectTime: '2026-05-19 13:45:00',
    duration: '30m',
    status: 'closed',
    clientIp: '192.168.1.101',
  },
  {
    id: 'conn-003',
    username: 'admin',
    hostname: 'prod-web-02',
    hostIp: '10.0.1.11',
    connectTime: '2026-05-19 12:00:00',
    disconnectTime: '2026-05-19 12:10:00',
    duration: '10m',
    status: 'terminated',
    clientIp: '192.168.1.100',
  },
  {
    id: 'conn-004',
    username: 'developer',
    hostname: 'dev-web-01',
    hostIp: '10.0.3.10',
    connectTime: '2026-05-19 10:30:00',
    disconnectTime: '2026-05-19 11:30:00',
    duration: '1h',
    status: 'closed',
    clientIp: '192.168.1.102',
  },
];

const mockFileLogs: TerminalFileLog[] = [
  {
    id: 'file-001',
    username: 'admin',
    hostname: 'prod-web-01',
    filePath: '/tmp',
    fileName: 'config.yaml',
    fileSize: '2.4 KB',
    operation: 'upload',
    timestamp: '2026-05-19 14:35:00',
    status: 'success',
  },
  {
    id: 'file-002',
    username: 'operator',
    hostname: 'prod-api-01',
    filePath: '/var/log',
    fileName: 'app.log',
    fileSize: '15.2 MB',
    operation: 'download',
    timestamp: '2026-05-19 13:20:00',
    status: 'success',
  },
  {
    id: 'file-003',
    username: 'admin',
    hostname: 'prod-web-02',
    filePath: '/opt/app',
    fileName: 'deploy.sh',
    fileSize: '1.1 KB',
    operation: 'upload',
    timestamp: '2026-05-19 12:05:00',
    status: 'failed',
  },
];

// ============================================================================
// Status Maps
// ============================================================================

const connectStatusMap: Record<TerminalConnectLog['status'], { color: string; label: string }> = {
  active: { color: 'green', label: '活跃' },
  closed: { color: 'default', label: '已关闭' },
  terminated: { color: 'red', label: '已终止' },
};

const fileStatusMap: Record<TerminalFileLog['status'], { color: string; label: string }> = {
  success: { color: 'green', label: '成功' },
  failed: { color: 'red', label: '失败' },
};

const operationMap: Record<TerminalFileLog['operation'], string> = {
  upload: '上传',
  download: '下载',
};

// ============================================================================
// Connect Log Tab
// ============================================================================

const ConnectLogTab: React.FC = () => {
  const [logs, setLogs] = useState<TerminalConnectLog[]>(mockConnectLogs);
  const [selectedLog, setSelectedLog] = useState<TerminalConnectLog | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredLogs = filterStatus === 'all'
    ? logs
    : logs.filter((l) => l.status === filterStatus);

  const columns: TableProps<TerminalConnectLog>['columns'] = [
    {
      title: '会话ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 100,
      render: (v: string) => (
        <Space>
          <UserOutlined style={{ color: colors.primary[500] }} />
          {v}
        </Space>
      ),
    },
    {
      title: '目标主机',
      key: 'host',
      width: 200,
      render: (_: unknown, record: TerminalConnectLog) => (
        <Space>
          <CloudServerOutlined style={{ color: colors.primary[500] }} />
          <span>{record.hostname}</span>
          <Text type="secondary" style={{ fontSize: 12 }}>({record.hostIp})</Text>
        </Space>
      ),
    },
    {
      title: '连接时间',
      dataIndex: 'connectTime',
      key: 'connectTime',
      width: 170,
      render: (v: string) => <Text type="secondary">{v}</Text>,
    },
    {
      title: '持续时间',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (v: string) => (
        <Space>
          <ClockCircleOutlined style={{ color: colors.neutral[400] }} />
          {v || '-'}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: TerminalConnectLog['status']) => (
        <Tag color={connectStatusMap[v].color}>{connectStatusMap[v].label}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: TerminalConnectLog) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedLog(record);
            setDetailVisible(true);
          }}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Select
            style={{ width: 120 }}
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { label: '全部状态', value: 'all' },
              { label: '活跃', value: 'active' },
              { label: '已关闭', value: 'closed' },
              { label: '已终止', value: 'terminated' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => setLogs(mockConnectLogs)}>
            刷新
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={filteredLogs}
        rowKey="id"
        size="middle"
        pagination={{ pageSize: 10 }}
      />

      <Drawer
        title="连接详情"
        placement="right"
        width={500}
        open={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setSelectedLog(null);
        }}
      >
        {selectedLog && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="会话ID">{selectedLog.id}</Descriptions.Item>
            <Descriptions.Item label="用户">{selectedLog.username}</Descriptions.Item>
            <Descriptions.Item label="目标主机">{selectedLog.hostname} ({selectedLog.hostIp})</Descriptions.Item>
            <Descriptions.Item label="客户端IP">{selectedLog.clientIp}</Descriptions.Item>
            <Descriptions.Item label="连接时间">{selectedLog.connectTime}</Descriptions.Item>
            <Descriptions.Item label="断开时间">{selectedLog.disconnectTime || '-'}</Descriptions.Item>
            <Descriptions.Item label="持续时间">{selectedLog.duration || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={connectStatusMap[selectedLog.status].color}>
                {connectStatusMap[selectedLog.status].label}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

// ============================================================================
// File Log Tab
// ============================================================================

const FileLogTab: React.FC = () => {
  const [logs, setLogs] = useState<TerminalFileLog[]>(mockFileLogs);

  const columns: TableProps<TerminalFileLog>['columns'] = [
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 100,
      render: (v: string) => (
        <Space>
          <UserOutlined style={{ color: colors.primary[500] }} />
          {v}
        </Space>
      ),
    },
    {
      title: '主机',
      dataIndex: 'hostname',
      key: 'hostname',
      width: 150,
      render: (v: string) => (
        <Space>
          <CloudServerOutlined style={{ color: colors.primary[500] }} />
          {v}
        </Space>
      ),
    },
    {
      title: '文件',
      key: 'file',
      render: (_: unknown, record: TerminalFileLog) => (
        <Space direction="vertical" size={2}>
          <Space>
            <FileTextOutlined style={{ color: colors.primary[500] }} />
            <Text strong>{record.fileName}</Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.filePath}</Text>
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 100,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: '操作类型',
      dataIndex: 'operation',
      key: 'operation',
      width: 100,
      render: (v: TerminalFileLog['operation']) => (
        <Tag color={v === 'upload' ? 'blue' : 'purple'}>{operationMap[v]}</Tag>
      ),
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 170,
      render: (v: string) => <Text type="secondary">{v}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (v: TerminalFileLog['status']) => (
        <Tag color={fileStatusMap[v].color}>{fileStatusMap[v].label}</Tag>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={() => setLogs(mockFileLogs)}>
          刷新
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        size="middle"
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};

// ============================================================================
// Main AuditLogPage
// ============================================================================

const AuditLogPage: React.FC = () => {
  const tabItems = [
    {
      key: 'connect',
      label: (
        <span>
          <ClockCircleOutlined /> 连接日志
        </span>
      ),
      children: <ConnectLogTab />,
    },
    {
      key: 'file',
      label: (
        <span>
          <FileTextOutlined /> 文件传输日志
        </span>
      ),
      children: <FileLogTab />,
    },
  ];

  return (
    <div>
      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic title="连接日志" value={mockConnectLogs.length} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="活跃会话" value={mockConnectLogs.filter((l) => l.status === 'active').length} valueStyle={{ color: colors.success[500] }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="文件传输" value={mockFileLogs.length} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
      </Row>

      <Tabs defaultActiveKey="connect" items={tabItems} size="large" />
    </div>
  );
};

export default AuditLogPage;
