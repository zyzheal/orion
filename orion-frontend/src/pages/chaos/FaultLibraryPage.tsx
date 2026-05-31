/**
 * Fault Library Page
 * Catalog of chaos fault types with configuration templates
 */
import React, { useState } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Input,
  Typography,
  Tooltip,
  Row,
  Col,
  Empty,
} from 'antd';
import {
  BugOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  WifiOutlined,
  CloudServerOutlined,
  HddOutlined,
  MemoryOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';

const { Title, Text, Paragraph } = Typography;

interface FaultTemplate {
  id: string;
  name: string;
  type: string;
  category: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  defaultConfig: Record<string, unknown>;
  icon: React.ReactNode;
}

const faultTemplates: FaultTemplate[] = [
  {
    id: 'network-latency',
    name: '网络延迟',
    type: 'network_latency',
    category: '网络',
    description: '注入网络延迟，模拟高延迟网络环境。可配置延迟时长和目标服务。',
    severity: 'medium',
    defaultConfig: { delay_ms: 500, jitter_ms: 100 },
    icon: <WifiOutlined />,
  },
  {
    id: 'service-down',
    name: '服务宕机',
    type: 'service_down',
    category: '服务',
    description: '模拟服务完全不可用。可配置目标 Pod 和持续时间。',
    severity: 'critical',
    defaultConfig: { target_pods: 1, duration_ms: 60000 },
    icon: <CloudServerOutlined />,
  },
  {
    id: 'cpu-stress',
    name: 'CPU 压力',
    type: 'cpu_stress',
    category: '资源',
    description: '对目标容器施加 CPU 压力。可配置 CPU 核心数和负载百分比。',
    severity: 'high',
    defaultConfig: { cores: 2, load_percent: 80, duration_ms: 120000 },
    icon: <ThunderboltOutlined />,
  },
  {
    id: 'memory-stress',
    name: '内存压力',
    type: 'memory_stress',
    category: '资源',
    description: '对目标容器施加内存压力。可配置内存大小和填充速率。',
    severity: 'high',
    defaultConfig: { memory_mb: 512, duration_ms: 120000 },
    icon: <MemoryOutlined />,
  },
  {
    id: 'disk-full',
    name: '磁盘满',
    type: 'disk_full',
    category: '资源',
    description: '模拟磁盘空间不足。可配置填充大小和目标路径。',
    severity: 'medium',
    defaultConfig: { fill_size_mb: 1024, target_path: '/tmp' },
    icon: <HddOutlined />,
  },
  {
    id: 'pod-kill',
    name: 'Pod 杀死',
    type: 'pod_kill',
    category: 'K8s',
    description: '随机杀死 Pod，模拟容器崩溃。可配置杀死数量和选择器。',
    severity: 'high',
    defaultConfig: { kill_count: 1, grace_period: 0 },
    icon: <BugOutlined />,
  },
  {
    id: 'dns-failure',
    name: 'DNS 故障',
    type: 'dns_failure',
    category: '网络',
    description: '模拟 DNS 解析失败。可配置目标域名和故障类型。',
    severity: 'critical',
    defaultConfig: { target_domains: ['*.internal'], failure_type: 'timeout' },
    icon: <WifiOutlined />,
  },
  {
    id: 'packet-loss',
    name: '丢包',
    type: 'packet_loss',
    category: '网络',
    description: '模拟网络丢包。可配置丢包率和目标端口。',
    severity: 'medium',
    defaultConfig: { loss_percent: 30, target_ports: [80, 443] },
    icon: <WifiOutlined />,
  },
];

const severityConfig: Record<string, { color: string; label: string }> = {
  low: { color: 'green', label: '低' },
  medium: { color: 'orange', label: '中' },
  high: { color: 'red', label: '高' },
  critical: { color: 'magenta', label: '严重' },
};

export default function FaultLibraryPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const categories = [...new Set(faultTemplates.map(f => f.category))];

  const filtered = faultTemplates.filter(f => {
    const matchSearch = !search || f.name.includes(search) || f.description.includes(search);
    const matchCategory = !categoryFilter || f.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const columns = [
    {
      title: '故障类型',
      key: 'name',
      render: (_: any, record: FaultTemplate) => (
        <Space>
          <span style={{ fontSize: 18, color: colors.primary[500] }}>{record.icon}</span>
          <div>
            <Text strong>{record.name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{record.type}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      render: (v: string) => {
        const cfg = severityConfig[v] || severityConfig.medium;
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '默认配置',
      key: 'config',
      render: (_: any, record: FaultTemplate) => (
        <Tooltip title={<pre>{JSON.stringify(record.defaultConfig, null, 2)}</pre>}>
          <Button size="small">查看配置</Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 16 }}>
        <BugOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        故障库
      </Title>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Input
              placeholder="搜索故障类型..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={e => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={16}>
            <Space>
              <Button
                type={!categoryFilter ? 'primary' : 'default'}
                onClick={() => setCategoryFilter(null)}
              >
                全部
              </Button>
              {categories.map(cat => (
                <Button
                  key={cat}
                  type={categoryFilter === cat ? 'primary' : 'default'}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat}
                </Button>
              ))}
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          scroll={{ x: true }}
          locale={{ emptyText: <Empty description="暂无故障类型数据" /> }}
          pagination={{
            pageSize: 20,
            showQuickJumper: true,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total) => `共 ${total} 项`,
          }}
        />
      </Card>
    </div>
  );
}
