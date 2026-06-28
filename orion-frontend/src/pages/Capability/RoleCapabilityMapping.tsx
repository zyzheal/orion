/**
 * 角色能力分配页面
 * 为角色配置能力，支持权限矩阵视图
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { capabilityApi } from '@/api/capability';

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
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [roleCapabilities, setRoleCapabilities] = useState<RoleCapability[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('list');

  // 从 API 加载权限矩阵
  const loadMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const res = await capabilityApi.getCapabilityMatrix();
      const data = (res.data as any)?.data || res.data as any;
      if (data) {
        const apiRoles: Role[] = (data.roles || []).map((r: any) => ({
          id: r.role_id,
          name: r.role_name,
          description: '',
          userCount: 0,
        }));
        const apiCaps: Capability[] = (data.capabilities || []).map((c: any) => ({
          id: c.capability_id,
          name: c.capability_name,
          description: '',
          category: c.category || '',
          riskLevel: 1,
          requiresApproval: false,
        }));
        setRoles(apiRoles);
        setCapabilities(apiCaps);
        if (apiRoles.length > 0 && !selectedRole) {
          setSelectedRole(apiRoles[0].id);
        }
        // Convert matrix to RoleCapability[]
        const rcList: RoleCapability[] = [];
        const matrix = data.matrix || {};
        for (const [roleId, grants] of Object.entries(matrix)) {
          const grantArr = grants as boolean[];
          apiCaps.forEach((cap, idx) => {
            rcList.push({
              roleId,
              capabilityId: cap.id,
              granted: grantArr[idx] ?? false,
            });
          });
        }
        setRoleCapabilities(rcList);
      }
    } catch {
      message.error('加载权限矩阵失败');
    }
    setLoading(false);
  }, [selectedRole]);

  useEffect(() => { loadMatrix(); }, []);

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
    capabilities.forEach((cap) => {
      if (!groups[cap.category]) {
        groups[cap.category] = [];
      }
      groups[cap.category].push(cap);
    });
    return groups;
  }, [capabilities]);

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
  const handleSave = useCallback(async () => {
    setLoading(true);
    try {
      await capabilityApi.updateRoleCapabilities({
        role_id: selectedRole,
        capabilities: currentRoleCaps.map(rc => ({
          capability_id: rc.capabilityId,
          granted: rc.granted,
        })),
      });
      setHasChanges(false);
      message.success('角色能力分配已保存');
    } catch {
      message.error('保存失败');
    }
    setLoading(false);
  }, [selectedRole, currentRoleCaps]);

  // 取消更改
  const handleCancel = useCallback(() => {
    loadMatrix();
    setHasChanges(false);
    message.info('已取消更改');
  }, [loadMatrix]);

  // 导出矩阵为 CSV
  const handleExport = useCallback(() => {
    const grantedMap = new Map<string, Set<string>>();
    for (const rc of roleCapabilities) {
      if (rc.granted) {
        if (!grantedMap.has(rc.roleId)) grantedMap.set(rc.roleId, new Set());
        grantedMap.get(rc.roleId)!.add(rc.capabilityId);
      }
    }
    const header = ['能力', '分类', ...roles.map(r => r.name)];
    const rows = capabilities.map(cap => [
      cap.name,
      cap.category,
      ...roles.map(r => grantedMap.get(r.id)?.has(cap.id) ? '是' : '否'),
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
      ...roles.map((role) => ({
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
          const requiresApproval = capabilities.find(
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

    const matrixData = capabilities.map((cap) => ({
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
                {roles.map((role) => (
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
                {capabilities
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
                可选能力 ({capabilities.length - grantedCapabilityIds.size})
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
