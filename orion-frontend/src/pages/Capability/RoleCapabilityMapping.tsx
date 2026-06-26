/**
 * 角色能力分配页面
 * 为角色配置能力，支持权限矩阵视图
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  Table,
  Tag,
  Space,
  Button,
  Select,
  Card,
  Row,
  Col,
  Typography,
  Checkbox,
  message,
  Tabs,
  Badge,
  Tooltip,
} from 'antd';
import {
  TeamOutlined,
  SaveOutlined,
  ReloadOutlined,
  ExportOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

// ==================== 类型定义 ====================

/**
 * 能力数据模型
 */
interface Capability {
  id: string;
  name: string;
  description: string;
  category: string;
  riskLevel: 1 | 2 | 3 | 4;
  requiresApproval: boolean;
}

/**
 * 角色数据模型
 */
interface Role {
  id: string;
  name: string;
  description: string;
  userCount: number;
}

/**
 * 角色能力关联
 */
interface RoleCapability {
  roleId: string;
  capabilityId: string;
  granted: boolean;
  grantedAt?: string;
}

// ==================== Mock 数据 ====================

const mockRoles: Role[] = [
  {
    id: 'admin',
    name: 'Administrator',
    description: '系统管理员，拥有所有权限',
    userCount: 2,
  },
  {
    id: 'developer',
    name: 'Developer',
    description: '开发人员，拥有开发相关权限',
    userCount: 15,
  },
  {
    id: 'sre',
    name: 'SRE',
    description: '站点可靠性工程师',
    userCount: 5,
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: '只读用户，仅可查看',
    userCount: 30,
  },
];

const mockCapabilities: Capability[] = [
  // ChatOps 分类
  {
    id: 'chatops_view',
    name: 'ChatOps 查看',
    description: '查看命令目录、执行记录',
    category: 'ChatOps',
    riskLevel: 1,
    requiresApproval: false,
  },
  {
    id: 'chatops_card_manage',
    name: '问答卡片管理',
    description: '新增、编辑问答卡片',
    category: 'ChatOps',
    riskLevel: 2,
    requiresApproval: false,
  },
  {
    id: 'chatops_command_manage',
    name: '命令配置管理',
    description: '新增、编辑命令配置',
    category: 'ChatOps',
    riskLevel: 3,
    requiresApproval: true,
  },
  {
    id: 'chatops_platform_manage',
    name: '平台配置管理',
    description: '修改平台配置',
    category: 'ChatOps',
    riskLevel: 4,
    requiresApproval: true,
  },
  // Pipeline 分类
  {
    id: 'pipeline_view',
    name: '流水线查看',
    description: '查看流水线列表',
    category: 'Pipeline',
    riskLevel: 1,
    requiresApproval: false,
  },
  {
    id: 'pipeline_create',
    name: '流水线创建',
    description: '创建新流水线',
    category: 'Pipeline',
    riskLevel: 2,
    requiresApproval: false,
  },
  {
    id: 'pipeline_edit',
    name: '流水线编辑',
    description: '编辑流水线',
    category: 'Pipeline',
    riskLevel: 2,
    requiresApproval: false,
  },
  {
    id: 'pipeline_delete',
    name: '流水线删除',
    description: '删除流水线',
    category: 'Pipeline',
    riskLevel: 3,
    requiresApproval: true,
  },
  {
    id: 'pipeline_trigger',
    name: '流水线触发',
    description: '手动触发执行',
    category: 'Pipeline',
    riskLevel: 2,
    requiresApproval: false,
  },
  {
    id: 'pipeline_trigger_prod',
    name: '生产环境流水线触发',
    description: '触发生产流水线',
    category: 'Pipeline',
    riskLevel: 4,
    requiresApproval: true,
  },
  // Deployment 分类
  {
    id: 'deployment_view',
    name: '部署查看',
    description: '查看部署记录',
    category: 'Deployment',
    riskLevel: 1,
    requiresApproval: false,
  },
  {
    id: 'deployment_operations',
    name: '部署操作',
    description: '执行部署操作',
    category: 'Deployment',
    riskLevel: 3,
    requiresApproval: true,
  },
  {
    id: 'deployment_rollback',
    name: '部署回滚',
    description: '执行回滚',
    category: 'Deployment',
    riskLevel: 4,
    requiresApproval: true,
  },
  // Environment
  {
    id: 'environment_operations',
    name: '环境操作',
    description: '创建、修改环境',
    category: 'Environment',
    riskLevel: 3,
    requiresApproval: true,
  },
  // Security
  {
    id: 'secret_operations',
    name: '密钥操作',
    description: '管理密钥',
    category: 'Security',
    riskLevel: 4,
    requiresApproval: true,
  },
  {
    id: 'backup_operations',
    name: '备份操作',
    description: '执行备份',
    category: 'Security',
    riskLevel: 3,
    requiresApproval: true,
  },
];

// 初始角色能力分配
const initialRoleCapabilities: RoleCapability[] = [
  // Admin 拥有所有能力
  ...mockCapabilities.map((cap) => ({
    roleId: 'admin',
    capabilityId: cap.id,
    granted: true,
    grantedAt: '2026-04-01',
  })),
  // Developer
  { roleId: 'developer', capabilityId: 'chatops_view', granted: true, grantedAt: '2026-04-01' },
  {
    roleId: 'developer',
    capabilityId: 'chatops_card_manage',
    granted: true,
    grantedAt: '2026-04-01',
  },
  { roleId: 'developer', capabilityId: 'pipeline_view', granted: true, grantedAt: '2026-04-01' },
  { roleId: 'developer', capabilityId: 'pipeline_create', granted: true, grantedAt: '2026-04-01' },
  { roleId: 'developer', capabilityId: 'pipeline_edit', granted: true, grantedAt: '2026-04-01' },
  { roleId: 'developer', capabilityId: 'pipeline_trigger', granted: true, grantedAt: '2026-04-01' },
  { roleId: 'developer', capabilityId: 'deployment_view', granted: true, grantedAt: '2026-04-01' },
  // SRE
  { roleId: 'sre', capabilityId: 'chatops_view', granted: true, grantedAt: '2026-04-01' },
  { roleId: 'sre', capabilityId: 'chatops_command_manage', granted: true, grantedAt: '2026-04-01' },
  { roleId: 'sre', capabilityId: 'pipeline_view', granted: true, grantedAt: '2026-04-01' },
  { roleId: 'sre', capabilityId: 'pipeline_trigger', granted: true, grantedAt: '2026-04-01' },
  { roleId: 'sre', capabilityId: 'pipeline_trigger_prod', granted: true, grantedAt: '2026-04-01' },
  { roleId: 'sre', capabilityId: 'deployment_view', granted: true, grantedAt: '2026-04-01' },
  { roleId: 'sre', capabilityId: 'deployment_operations', granted: true, grantedAt: '2026-04-01' },
  { roleId: 'sre', capabilityId: 'deployment_rollback', granted: true, grantedAt: '2026-04-01' },
  { roleId: 'sre', capabilityId: 'environment_operations', granted: true, grantedAt: '2026-04-01' },
  { roleId: 'sre', capabilityId: 'backup_operations', granted: true, grantedAt: '2026-04-01' },
  // Viewer
  { roleId: 'viewer', capabilityId: 'chatops_view', granted: true, grantedAt: '2026-04-01' },
  { roleId: 'viewer', capabilityId: 'pipeline_view', granted: true, grantedAt: '2026-04-01' },
  { roleId: 'viewer', capabilityId: 'deployment_view', granted: true, grantedAt: '2026-04-01' },
];

// ==================== 工具函数 ====================

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

const getRiskLevelColor = (level: number): string => {
  const colorMap: Record<number, string> = {
    1: 'green',
    2: 'orange',
    3: 'red',
    4: 'magenta',
  };
  return colorMap[level] || 'default';
};

// ==================== 组件 ====================

/**
 * 角色能力分配页面
 */
const RoleCapabilityMapping: React.FC = () => {
  // 状态
  const [selectedRole, setSelectedRole] = useState<string>('developer');
  const [roleCapabilities, setRoleCapabilities] =
    useState<RoleCapability[]>(initialRoleCapabilities);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('list');

  // 获取当前角色的能力
  const currentRoleCaps = useMemo(() => {
    return roleCapabilities.filter((rc) => rc.roleId === selectedRole);
  }, [roleCapabilities, selectedRole]);

  // 获取当前角色的能力ID集合
  const grantedCapabilityIds = useMemo(() => {
    return new Set(currentRoleCaps.filter((rc) => rc.granted).map((rc) => rc.capabilityId));
  }, [currentRoleCaps]);

  // 按分类分组的能力
  const groupedCapabilities = useMemo(() => {
    const groups: Record<string, Capability[]> = {};
    mockCapabilities.forEach((cap) => {
      if (!groups[cap.category]) {
        groups[cap.category] = [];
      }
      groups[cap.category].push(cap);
    });
    return groups;
  }, []);

  // 切换能力授权状态
  const handleCapabilityToggle = useCallback(
    (capabilityId: string, granted: boolean) => {
      setRoleCapabilities((prev) => {
        const existing = prev.find(
          (rc) => rc.roleId === selectedRole && rc.capabilityId === capabilityId
        );
        if (existing) {
          return prev.map((rc) =>
            rc.roleId === selectedRole && rc.capabilityId === capabilityId ? { ...rc, granted } : rc
          );
        } else {
          return [
            ...prev,
            {
              roleId: selectedRole,
              capabilityId,
              granted,
              grantedAt: granted ? new Date().toISOString().split('T')[0] : undefined,
            },
          ];
        }
      });
      setHasChanges(true);
    },
    [selectedRole]
  );

  // 保存更改
  const handleSave = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setHasChanges(false);
      message.success('角色能力分配已保存');
    }, 500);
  }, []);

  // 取消更改
  const handleCancel = useCallback(() => {
    setRoleCapabilities(initialRoleCapabilities);
    setHasChanges(false);
    message.info('已取消更改');
  }, []);

  // 导出矩阵为 CSV
  const handleExport = useCallback(() => {
    const grantedMap = new Map<string, Set<string>>();
    for (const rc of roleCapabilities) {
      if (rc.granted) {
        if (!grantedMap.has(rc.roleId)) grantedMap.set(rc.roleId, new Set());
        grantedMap.get(rc.roleId)!.add(rc.capabilityId);
      }
    }
    const header = ['能力', '分类', ...mockRoles.map(r => r.name)];
    const rows = mockCapabilities.map(cap => [
      cap.name,
      cap.category,
      ...mockRoles.map(r => grantedMap.get(r.id)?.has(cap.id) ? '是' : '否'),
    ]);
    const csv = [header, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `角色能力矩阵_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('导出成功');
  }, [roleCapabilities]);

  // 渲染权限矩阵Tab
  const renderMatrixView = () => {
    const columns = [
      {
        title: '能力',
        dataIndex: 'capability',
        key: 'capability',
        fixed: 'left' as const,
        width: 250,
        render: (
          _: unknown,
          record: {
            key: string;
            category: string;
            name: string;
            riskLevel: number;
            requiresApproval: boolean;
          }
        ) => (
          <Space>
            <Tag color={getCategoryColor(record.category)}>{record.category}</Tag>
            <Text>{record.name}</Text>
            <Tag color={getRiskLevelColor(record.riskLevel)}>L{record.riskLevel}</Tag>
            {record.requiresApproval && (
              <Tooltip title="需要审批">
                <WarningOutlined style={{ color: colors.warning[500] }} />
              </Tooltip>
            )}
          </Space>
        ),
      },
      ...mockRoles.map((role) => ({
        title: (
          <Space>
            <TeamOutlined />
            {role.name}
            <Tag>{role.userCount}</Tag>
          </Space>
        ),
        dataIndex: role.id,
        key: role.id,
        width: 100,
        align: 'center' as const,
        render: (_: unknown, record: { key: string }) => {
          const hasCapability = roleCapabilities.some(
            (rc) => rc.roleId === role.id && rc.capabilityId === record.key && rc.granted
          );
          const requiresApproval = mockCapabilities.find(
            (c) => c.id === record.key
          )?.requiresApproval;

          if (hasCapability) {
            if (requiresApproval) {
              return <Badge status="warning" text="" />;
            }
            return <CheckCircleOutlined style={{ color: colors.success[500], fontSize: 18 }} />;
          }
          return <CloseCircleOutlined style={{ color: colors.neutral[300], fontSize: 14 }} />;
        },
      })),
    ];

    const matrixData = mockCapabilities.map((cap) => ({
      key: cap.id,
      category: cap.category,
      name: cap.name,
      riskLevel: cap.riskLevel,
      requiresApproval: cap.requiresApproval,
    }));

    return (
      <div>
        <div style={{ marginBottom: spacing.md, display: 'flex', justifyContent: 'flex-end' }}>
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            导出矩阵
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={matrixData}
          rowKey="key"
          pagination={false}
          size="small"
          scroll={{ x: 'max-content' }}
        />
      </div>
    );
  };

  const { Text } = Typography;

  return (
    <div>
      {/* 角色选择 */}
      <Card size="small" style={{ marginBottom: spacing.md }}>
        <Row gutter={[spacing.md, spacing.md]} align="middle">
          <Col>
            <Space>
              <Text strong>选择角色:</Text>
              <Select value={selectedRole} onChange={setSelectedRole} style={{ width: 200 }}>
                {mockRoles.map((role) => (
                  <Select.Option key={role.id} value={role.id}>
                    <Space>
                      {role.name}
                      <Tag>{role.userCount} 人</Tag>
                    </Space>
                  </Select.Option>
                ))}
              </Select>
            </Space>
          </Col>
          <Col flex="auto" style={{ textAlign: 'right' }}>
            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={loading}
                disabled={!hasChanges}
              >
                保存更改
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleCancel} disabled={!hasChanges}>
                取消
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 标签页 */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane tab="角色能力列表" key="list">
          <div>
            {/* 已分配能力 */}
            <div style={{ marginBottom: spacing.lg }}>
              <Text strong style={{ marginBottom: spacing.sm, display: 'block' }}>
                已分配能力 ({grantedCapabilityIds.size})
              </Text>
              <Row gutter={[spacing.sm, spacing.sm]}>
                {mockCapabilities
                  .filter((cap) => grantedCapabilityIds.has(cap.id))
                  .map((cap) => (
                    <Col key={cap.id} xs={24} sm={12} md={8} lg={6}>
                      <Card size="small" style={{ marginBottom: 0 }}>
                        <Checkbox
                          checked={grantedCapabilityIds.has(cap.id)}
                          onChange={(e) => handleCapabilityToggle(cap.id, e.target.checked)}
                        >
                          <Space direction="vertical" size={0}>
                            <Text strong style={{ fontSize: spacing[3] }}>
                              {cap.name}
                            </Text>
                            <Space>
                              <Tag color={getCategoryColor(cap.category)} style={{ fontSize: 10 }}>
                                {cap.category}
                              </Tag>
                              <Tag
                                color={getRiskLevelColor(cap.riskLevel)}
                                style={{ fontSize: 10 }}
                              >
                                L{cap.riskLevel}
                              </Tag>
                            </Space>
                          </Space>
                        </Checkbox>
                      </Card>
                    </Col>
                  ))}
              </Row>
            </div>

            {/* 可选能力 */}
            <div>
              <Text strong style={{ marginBottom: spacing.sm, display: 'block' }}>
                可选能力 ({mockCapabilities.length - grantedCapabilityIds.size})
              </Text>
              {Object.entries(groupedCapabilities).map(([category, caps]) => (
                <div key={category} style={{ marginBottom: spacing.md }}>
                  <Text type="secondary" style={{ marginBottom: spacing.xs, display: 'block' }}>
                    <Tag color={getCategoryColor(category)}>{category}</Tag>
                  </Text>
                  <Row gutter={[spacing.sm, spacing.sm]}>
                    {caps
                      .filter((cap) => !grantedCapabilityIds.has(cap.id))
                      .map((cap) => (
                        <Col key={cap.id} xs={24} sm={12} md={8} lg={6}>
                          <Card size="small">
                            <Checkbox
                              checked={grantedCapabilityIds.has(cap.id)}
                              onChange={(e) => handleCapabilityToggle(cap.id, e.target.checked)}
                            >
                              <Space direction="vertical" size={0}>
                                <Text strong style={{ fontSize: spacing[3] }}>
                                  {cap.name}
                                </Text>
                                <Space>
                                  <Tag
                                    color={getRiskLevelColor(cap.riskLevel)}
                                    style={{ fontSize: 10 }}
                                  >
                                    L{cap.riskLevel}
                                  </Tag>
                                  {cap.requiresApproval && (
                                    <Tag color="warning" style={{ fontSize: 10 }}>
                                      需审批
                                    </Tag>
                                  )}
                                </Space>
                              </Space>
                            </Checkbox>
                          </Card>
                        </Col>
                      ))}
                  </Row>
                </div>
              ))}
            </div>
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane tab="权限矩阵" key="matrix">
          {renderMatrixView()}
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default RoleCapabilityMapping;
