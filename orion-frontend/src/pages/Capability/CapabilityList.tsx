/**
 * 能力列表页面
 * 查看系统中定义的所有能力，支持按类别、风险等级筛选
 */
import React, { useState, useEffect, useCallback } from 'react';
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
  message,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { capabilityApi, type Capability as ApiCapability } from '@/api/capability';

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

// ==================== API 数据映射 ====================

/** 将 API 返回的 snake_case 能力数据映射为组件使用的 camelCase 格式 */
const mapApiCapability = (cap: ApiCapability): Capability => ({
  id: cap.capability_id || cap.id,
  name: cap.name,
  description: cap.description || '',
  category: cap.category,
  riskLevel: (cap.risk_level || 1) as 1 | 2 | 3 | 4,
  requiresApproval: cap.requires_approval ?? false,
  parentId: cap.parent_capability_id ?? null,
  enabled: cap.enabled ?? true,
  childCount: cap.child_count ?? 0,
  roleCount: cap.role_count ?? 0,
  createdAt: cap.created_at ?? '',
  updatedAt: cap.updated_at ?? '',
});

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
  const [data, setData] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [riskLevelFilter, setRiskLevelFilter] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<boolean | null>(null);

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await capabilityApi.list();
      const items = (res.data as any)?.data || [];
      setData(items.map(mapApiCapability));
    } catch {
      message.error('加载能力列表失败');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
  const categories = Array.from(new Set(data.map((c) => c.category)));

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
    loadData();
  }, [loadData]);

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
