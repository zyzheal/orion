/**
 * TenantSelector - 租户选择器组件
 *
 * 功能：
 * - 显示当前租户名称
 * - 多租户时显示下拉选择框
 * - 单租户时隐藏选择器
 * - 支持切换租户
 */
import React, { useState, useEffect } from 'react';
import { Dropdown, Avatar, Menu, message, Spin } from 'antd';
import { TeamOutlined, SwapOutlined, CheckOutlined, DownOutlined } from '@ant-design/icons';
import { api } from '@/api/client';
import { colors } from '@/tokens/colors';

interface MyTenant {
  id: string;
  name: string;
  display_name: string | null;
  role: string;
  isCurrent: boolean;
}

interface TenantSelectorProps {
  onTenantChange?: (tenantId: string) => void;
}

export const TenantSelector: React.FC<TenantSelectorProps> = ({ onTenantChange }) => {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<MyTenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<MyTenant | null>(null);

  // 获取用户所属租户列表
  const fetchTenants = async () => {
    try {
      setLoading(true);
      const res = await api.get<{
        tenants: MyTenant[];
        currentTenant: MyTenant | null;
        total: number;
      }>('/v1/tenant/my-tenants');

      const body = (res.data as { tenants?: MyTenant[]; currentTenant?: MyTenant | null; total?: number }) ?? res.data;
      const tenantList = body?.tenants || [];
      const current = body?.currentTenant || tenantList.find((t: MyTenant) => t.isCurrent);

      setTenants(tenantList);
      setCurrentTenant(current);

      // 如果没有当前租户但有租户列表，取第一个
      if (!current && tenantList.length > 0) {
        setCurrentTenant(tenantList[0]);
      }
    } catch (error) {
      console.error('[TenantSelector] Failed to fetch tenants:', error);
      // 静默失败，不阻塞界面
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  // 单租户时隐藏选择器
  if (!loading && tenants.length <= 1) {
    // 单租户：显示租户名称但不需要下拉
    if (currentTenant) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            borderRadius: 6,
            fontSize: 13,
            color: colors.primary[500],
            background: colors.primary[50],
          }}
          title={`租户: ${currentTenant.display_name || currentTenant.name}`}
        >
          <TeamOutlined />
          <span style={{ fontWeight: 500 }}>{currentTenant.display_name || currentTenant.name}</span>
        </div>
      );
    }
    return null;
  }

  // 多租户：显示下拉选择器
  // P1-6 修复：切换租户前进行权限校验
  const handleSwitchTenant = async (tenantId: string) => {
    // P1-6 修复：先检查用户是否有该租户的权限
    const hasPermission = tenants.some(t => t.id === tenantId);
    if (!hasPermission) {
      message.error('您没有权限访问该租户');
      return;
    }

    // 更新 localStorage
    localStorage.setItem('tenant_id', tenantId);
    // 更新当前租户状态
    const newCurrent = tenants.find(t => t.id === tenantId);
    if (newCurrent) {
      setCurrentTenant({ ...newCurrent, isCurrent: true });
    }
    // 提示用户
    message.success(`已切换到 ${newCurrent?.display_name || newCurrent?.name}`);
    // 触发回调
    onTenantChange?.(tenantId);
    // 刷新页面以应用新租户上下文
    window.location.reload();
  };

  const menuItems = tenants.map((tenant) => ({
    key: tenant.id,
    label: (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minWidth: 180,
        }}
      >
        <div>
          <div style={{ fontWeight: tenant.isCurrent ? 600 : 400 }}>
            {tenant.display_name || tenant.name}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
            角色: {tenant.role}
          </div>
        </div>
        {tenant.isCurrent && (
          <CheckOutlined style={{ color: colors.primary[500] }} />
        )}
      </div>
    ),
    onClick: () => {
      if (!tenant.isCurrent) {
        handleSwitchTenant(tenant.id);
      }
    },
  }));

  // 添加分隔和切换提示
  if (tenants.length > 1) {
    menuItems.push(
      { type: 'divider' },
      {
        key: 'hint',
        label: (
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', padding: '4px 0' }}>
            <SwapOutlined /> 切换租户将刷新页面
          </div>
        ),
        disabled: true,
      }
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '4px 8px' }}>
        <Spin size="small" />
      </div>
    );
  }

  return (
    <Dropdown
      menu={{ items: menuItems }}
      placement="bottomRight"
      trigger={['click']}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: 6,
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <Avatar
          size="small"
          icon={<TeamOutlined />}
          style={{
            background: colors.primary[500],
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {currentTenant?.display_name || currentTenant?.name || '选择租户'}
        </span>
        {tenants.length > 1 && <DownOutlined style={{ fontSize: 10, opacity: 0.6 }} />}
      </div>
    </Dropdown>
  );
};

export default TenantSelector;