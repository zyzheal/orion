/**
 * 能力列表页面
 * 查看系统中定义的所有能力，支持按类别、风险等级筛选
 */
import React, { useState, useCallback } from 'react';
import {
  Table,
  Tag,
  Space,
  Button,
  Input,
  Select,
  Card,
  Row,
  Col,
  Typography,
  Tooltip,
  Badge,
  Empty,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Text } = Typography;

// ==================== 类型定义 ====================

/**
 * 能力数据模型
 */
export interface Capability {
  id: string;
  name: string;
  description: string;
  category: string;
  riskLevel: 1 | 2 | 3 | 4;
  requiresApproval: boolean;
  parentId: string | null;
  enabled: boolean;
  childCount: number;
  roleCount: number;
  createdAt: string;
  updatedAt: string;
}

// ==================== Mock 数据 ====================

const mockCapabilities: Capability[] = [
  // ChatOps 分类
  {
    id: 'chatops_view',
    name: 'ChatOps 查看',
    description: '查看命令目录、执行记录、配置',
    category: 'ChatOps',
    riskLevel: 1,
    requiresApproval: false,
    parentId: null,
    enabled: true,
    childCount: 0,
    roleCount: 5,
    createdAt: '2026-04-01',
    updatedAt: '2026-05-15',
  },
  {
    id: 'chatops_card_manage',
    name: '问答卡片管理',
    description: '新增、编辑、删除问答卡片',
    category: 'ChatOps',
    riskLevel: 2,
    requiresApproval: false,
    parentId: 'chatops_view',
    enabled: true,
    childCount: 0,
    roleCount: 3,
    createdAt: '2026-04-01',
    updatedAt: '2026-05-15',
  },
  {
    id: 'chatops_command_manage',
    name: '命令配置管理',
    description: '新增、编辑、删除命令配置',
    category: 'ChatOps',
    riskLevel: 3,
    requiresApproval: true,
    parentId: 'chatops_view',
    enabled: true,
    childCount: 0,
    roleCount: 2,
    createdAt: '2026-04-01',
    updatedAt: '2026-05-15',
  },
  {
    id: 'chatops_platform_manage',
    name: '平台配置管理',
    description: '修改平台 Webhook、Token 等敏感配置',
    category: 'ChatOps',
    riskLevel: 4,
    requiresApproval: true,
    parentId: 'chatops_view',
    enabled: true,
    childCount: 0,
    roleCount: 1,
    createdAt: '2026-04-01',
    updatedAt: '2026-05-15',
  },
  {
    id: 'chatops_notification_manage',
    name: '通知设置管理',
    description: '修改通知偏好、免打扰设置',
    category: 'ChatOps',
    riskLevel: 2,
    requiresApproval: false,
    parentId: 'chatops_view',
    enabled: true,
    childCount: 0,
    roleCount: 4,
    createdAt: '2026-04-01',
    updatedAt: '2026-05-15',
  },
  // Pipeline 分类
  {
    id: 'pipeline_view',
    name: '流水线查看',
    description: '查看流水线列表、运行记录',
    category: 'Pipeline',
    riskLevel: 1,
    requiresApproval: false,
    parentId: null,
    enabled: true,
    childCount: 0,
    roleCount: 5,
    createdAt: '2026-04-01',
    updatedAt: '2026-05-15',
  },
  {
    id: 'pipeline_create',
    name: '流水线创建',
    description: '创建新的流水线',
    category: 'Pipeline',
    riskLevel: 2,
    requiresApproval: false,
    parentId: 'pipeline_view',
    enabled: true,
    childCount: 0,
    roleCount: 3,
    createdAt: '2026-04-01',
    updatedAt: '2026-05-15',
  },
  {
    id: 'pipeline_edit',
    name: '流水线编辑',
    description: '编辑现有流水线配置',
    category: 'Pipeline',
    riskLevel: 2,
    requiresApproval: false,
    parentId: 'pipeline_view',
    enabled: true,
    childCount: 0,
    roleCount: 3,
    createdAt: '2026-04-01',
    updatedAt: '2026-05-15',
  },
  {
    id: 'pipeline_delete',
    name: '流水线删除',
    description: '删除流水线',
    category: 'Pipeline',
    riskLevel: 3,
    requiresApproval: true,
    parentId: 'pipeline_view',
    enabled: true,
    childCount: 0,
    roleCount: 1,
    createdAt: '2026-04-01',
    updatedAt: '2026-05-15',
  },
  {
    id: 'pipeline_trigger',
    name: '流水线触发',
    description: '手动触发流水线执行',
    category: 'Pipeline',
    riskLevel: 2,
    requiresApproval: false,
    parentId: 'pipeline_view',
    enabled: true,
    childCount: 0,
    roleCount: 4,
    createdAt: '2026-04-01',
    updatedAt: '2026-05-15',
  },
  {
    id: 'pipeline_trigger_prod',
    name: '生产环境流水线触发',
    description: '触发生产环境的流水线执行',
    category: 'Pipeline',
    riskLevel: 4,
    requiresApproval: true,
    parentId: 'pipeline_trigger',
    enabled: true,
    childCount: 0,
    roleCount: 1,
    createdAt: '2026-04-01',
    updatedAt: '2026-05-15',
  },
  // Deployment 分类
  {
    id: 'deployment_view',
    name: '部署查看',
    description: '查看部署记录、历史版本',
    category: 'Deployment',
    riskLevel: 1,
    requiresApproval: false,
    parentId: null,
    enabled: true,
    childCount: 0,
    roleCount: 5,
    createdAt: '2026-04-01',
    updatedAt: '2026-05-15',
  },
  {
    id: 'deployment_operations',
    name: '部署操作',
    description: '执行部署、回滚等操作',
    category: 'Deployment',
    riskLevel: 3,
    requiresApproval: true,
    parentId: 'deployment_view',
    enabled: true,
    childCount: 0,
    roleCount: 2,
    createdAt: '2026-04-01',
    updatedAt: '2026-05-15',
  },
  {
    id: 'deployment_rollback',
    name: '部署回滚',
    description: '执行部署回滚操作',
    category: 'Deployment',
    riskLevel: 4,
    requiresApproval: true,
    parentId: 'deployment_operations',
    enabled: true,
    childCount: 0,
    roleCount: 1,
    createdAt: '2026-04-01',
    updatedAt: '2026-05-15',
  },
  // 环境操作
  {
    id: 'environment_operations',
    name: '环境操作',
    description: '创建、修改、删除环境',
    category: 'Environment',
    riskLevel: 3,
    requiresApproval: true,
    parentId: null,
    enabled: true,
    childCount: 0,
    roleCount: 2,
    createdAt: '2026-04-01',
    updatedAt: '2026-05-15',
  },
  // 安全操作
  {
    id: 'secret_operations',
    name: '密钥操作',
    description: '管理敏感凭据、密钥',
    category: 'Security',
    riskLevel: 4,
    requiresApproval: true,
    parentId: null,
    enabled: true,
    childCount: 0,
    roleCount: 1,
    createdAt: '2026-04-01',
    updatedAt: '2026-05-15',
  },
  {
    id: 'backup_operations',
    name: '备份操作',
    description: '执行数据备份',
    category: 'Security',
    riskLevel: 3,
    requiresApproval: true,
    parentId: null,
    enabled: true,
    childCount: 0,
    roleCount: 2,
    createdAt: '2026-04-01',
    updatedAt: '2026-05-15',
  },
  {
    id: 'disaster_recovery',
    name: '灾备操作',
    description: '执行灾备切换、恢复',
    category: 'Security',
    riskLevel: 4,
    requiresApproval: true,
    parentId: null,
    enabled: true,
    childCount: 0,
    roleCount: 1,
    createdAt: '2026-04-01',
    updatedAt: '2026-05-15',
  },
];

// ==================== 工具函数 ====================

/**
 * 获取风险等级标签颜色
 */
const getRiskLevelColor = (level: number): string => {
  const colorMap: Record<number, string> = {
    1: 'green',
    2: 'orange',
    3: 'red',
    4: 'magenta',
  };
  return colorMap[level] || 'default';
};

/**
 * 获取风险等级标签文本
 */
const getRiskLevelText = (level: number): string => {
  const textMap: Record<number, string> = {
    1: '低风险',
    2: '中风险',
    3: '高风险',
    4: '极高风险',
  };
  return textMap[level] || '未知';
};

/**
 * 获取分类颜色
 */
const getCategoryColor = (category: string): string => {
  const colorMap: Record<string, string> = {
    ChatOps: 'blue',
    Pipeline: 'cyan',
    Deployment: 'purple',
    Environment: 'green',
    Security: 'red',
  };
  return colorMap[category] || 'default';
};

// ==================== 组件 ====================

/**
 * 能力列表页面
 */
const CapabilityList: React.FC = () => {
  // 状态
  const [data, setData] = useState<Capability[]>(mockCapabilities);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [riskLevelFilter, setRiskLevelFilter] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<boolean | null>(null);

  // 统计
  const totalCount = data.length;
  const categoryStats = data.reduce(
    (acc, cap) => {
      acc[cap.category] = (acc[cap.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // 获取所有分类
  const categories = Array.from(new Set(mockCapabilities.map((c) => c.category)));

  // 筛选数据
  const filteredData = data.filter((cap) => {
    // 搜索筛选
    if (searchText) {
      const search = searchText.toLowerCase();
      if (
        !cap.id.toLowerCase().includes(search) &&
        !cap.name.toLowerCase().includes(search) &&
        !cap.description.toLowerCase().includes(search)
      ) {
        return false;
      }
    }
    // 风险等级筛选
    if (riskLevelFilter !== null && cap.riskLevel !== riskLevelFilter) {
      return false;
    }
    // 分类筛选
    if (categoryFilter !== null && cap.category !== categoryFilter) {
      return false;
    }
    // 状态筛选
    if (statusFilter !== null && cap.enabled !== statusFilter) {
      return false;
    }
    return true;
  });

  // 刷新数据
  const handleRefresh = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setData([...mockCapabilities]);
      setLoading(false);
    }, 500);
  }, []);

  // 表格列定义
  const columns = [
    {
      title: '能力ID',
      dataIndex: 'id',
      key: 'id',
      width: 220,
      render: (id: string) => (
        <Text code style={{ fontSize: spacing[3] }}>
          {id}
        </Text>
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Capability) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            {record.description}
          </Text>
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category: string) => <Tag color={getCategoryColor(category)}>{category}</Tag>,
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 100,
      render: (level: number) => (
        <Tag color={getRiskLevelColor(level)}>
          <Space size={4}>
            <Tooltip title={getRiskLevelText(level)}>
              <span>L{level}</span>
            </Tooltip>
          </Space>
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean) =>
        enabled ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            启用
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="default">
            禁用
          </Tag>
        ),
    },
    {
      title: '审批',
      dataIndex: 'requiresApproval',
      key: 'requiresApproval',
      width: 80,
      render: (requires: boolean) =>
        requires ? <Badge status="warning" text="需要" /> : <Badge status="default" text="无需" />,
    },
    {
      title: '绑定角色',
      dataIndex: 'roleCount',
      key: 'roleCount',
      width: 100,
      render: (count: number) => (
        <Tooltip title={`${count} 个角色拥有此能力`}>
          <Tag color="blue">{count}</Tag>
        </Tooltip>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 120,
    },
  ];

  return (
    <div>
      {/* 分类统计 */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.lg }}>
        <Col>
          <Tag
            color={!categoryFilter ? colors.primary[500] : undefined}
            style={{ cursor: 'pointer', padding: '4px 12px' }}
            onClick={() => setCategoryFilter(null)}
          >
            全部 ({totalCount})
          </Tag>
        </Col>
        {categories.map((cat) => (
          <Col key={cat}>
            <Tag
              color={categoryFilter === cat ? colors.primary[500] : getCategoryColor(cat)}
              style={{ cursor: 'pointer', padding: '4px 12px' }}
              onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
            >
              {cat} ({categoryStats[cat] || 0})
            </Tag>
          </Col>
        ))}
      </Row>

      {/* 搜索和筛选 */}
      <Card size="small" style={{ marginBottom: spacing.md }}>
        <Row gutter={[spacing.md, spacing.md]} align="middle">
          <Col flex="auto">
            <Input
              placeholder="搜索能力ID、名称、描述..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ maxWidth: 400 }}
            />
          </Col>
          <Col>
            <Space>
              <Select
                placeholder="风险等级"
                value={riskLevelFilter}
                onChange={setRiskLevelFilter}
                allowClear
                style={{ width: 120 }}
              >
                <Select.Option value={1}>低风险 (L1)</Select.Option>
                <Select.Option value={2}>中风险 (L2)</Select.Option>
                <Select.Option value={3}>高风险 (L3)</Select.Option>
                <Select.Option value={4}>极高风险 (L4)</Select.Option>
              </Select>
              <Select
                placeholder="状态"
                value={statusFilter}
                onChange={setStatusFilter}
                allowClear
                style={{ width: 100 }}
              >
                <Select.Option value={true}>启用</Select.Option>
                <Select.Option value={false}>禁用</Select.Option>
              </Select>
              <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
                刷新
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 数据表格 */}
      <Table
        columns={columns}
        dataSource={filteredData}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
        size="middle"
        locale={{
          emptyText: <Empty description="暂无能力数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
        }}
      />
    </div>
  );
};

export default CapabilityList;
