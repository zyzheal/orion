/**
 * 菜单配置面板
 * 支持管理员自定义导航菜单模块名称、描述、子菜单项的启用/禁用
 */
import React from 'react';
import { Drawer, Button, Input, Switch, Space, message, Tag, Typography } from 'antd';
import {
  SettingOutlined,
  SaveOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { useMenuConfigStore, type MenuModuleConfig } from '@/stores/menuConfigStore';

const { Text } = Typography;

interface MenuConfigProps {
  open: boolean;
  onClose: () => void;
}

// 模块编辑行
const ModuleEditor: React.FC<{
  module: MenuModuleConfig;
  moduleOrder: number;
  onUpdateModule: (updates: Partial<MenuModuleConfig>) => void;
  onUpdateChild: (childKey: string, updates: Partial<{ enabled: boolean }>) => void;
}> = ({ module, moduleOrder, onUpdateModule, onUpdateChild }) => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const hasChildren = module.children && module.children.length > 0;

  return (
    <div
      style={{
        background: isDark ? 'rgba(255,255,255,0.03)' : '#fafbfc',
        borderRadius: 10,
        padding: 16,
        marginBottom: 12,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0'}`,
      }}
    >
      {/* 模块头部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: hasChildren ? 12 : 0 }}>
        <Tag color="blue" style={{ margin: 0, fontSize: 12, minWidth: 28, textAlign: 'center' }}>
          {moduleOrder}
        </Tag>
        <Input
          value={module.label}
          onChange={(e) => onUpdateModule({ label: e.target.value })}
          style={{ flex: 1, height: 32, fontSize: 14 }}
          placeholder="模块名称"
          variant="borderless"
        />
        <Switch
          checked={module.enabled}
          onChange={(checked) => onUpdateModule({ enabled: checked })}
          size="small"
        />
      </div>

      {/* 描述和系统信息 */}
      {hasChildren && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <Input
            value={module.description || ''}
            onChange={(e) => onUpdateModule({ description: e.target.value })}
            style={{ flex: 1, height: 32 }}
            placeholder="导航描述"
            size="small"
          />
          <Input
            value={module.systemDescription || ''}
            onChange={(e) => onUpdateModule({ systemDescription: e.target.value })}
            style={{ flex: 2, height: 32 }}
            placeholder="面板描述（mega menu 左侧）"
            size="small"
          />
        </div>
      )}

      {/* 子菜单项 */}
      {hasChildren && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {module.children.map((child) => (
            <div
              key={child.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 6,
                background: child.enabled
                  ? isDark ? 'rgba(51,112,230,0.1)' : 'rgba(51,112,230,0.06)'
                  : isDark ? 'rgba(255,255,255,0.03)' : '#f5f5f5',
                border: `1px solid ${child.enabled
                  ? isDark ? 'rgba(51,112,230,0.2)' : 'rgba(51,112,230,0.15)'
                  : isDark ? 'rgba(255,255,255,0.05)' : '#e8e8e8'}`,
                transition: 'all 0.2s',
                opacity: child.enabled ? 1 : 0.5,
              }}
            >
              <Switch
                checked={child.enabled}
                onChange={(checked) => onUpdateChild(child.key, { enabled: checked })}
                size="small"
              />
              <Text style={{ fontSize: 12, color: child.enabled ? undefined : colors.neutral[400] }}>
                {child.label}
              </Text>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const MenuConfigPanel: React.FC<MenuConfigProps> = ({ open, onClose }) => {
  const { modules, updateModule, updateChild, saveConfig, resetToDefault } = useMenuConfigStore();
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  const moduleKeys = Object.keys(modules);

  const handleSave = () => {
    saveConfig();
    message.success('菜单配置已保存');
    onClose();
  };

  const handleReset = () => {
    resetToDefault();
    message.info('已恢复默认配置');
  };

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SettingOutlined style={{ fontSize: 18, color: colors.primary[500] }} />
          <span style={{ fontSize: 16, fontWeight: 600 }}>菜单配置</span>
        </div>
      }
      open={open}
      onClose={onClose}
      width={520}
      placement="right"
      styles={{
        body: { padding: '20px 24px', background: isDark ? '#1f1f1f' : '#ffffff' },
        header: {
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0'}`,
          paddingBottom: 16,
        },
      }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            恢复默认
          </Button>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
              保存配置
            </Button>
          </Space>
        </div>
      }
    >
      <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 20 }}>
        自定义导航菜单的模块名称、描述及子菜单项的显示/隐藏
      </Text>

      <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto', paddingRight: 4 }}>
        {moduleKeys.map((key, index) => (
          <ModuleEditor
            key={key}
            module={modules[key]}
            moduleOrder={index + 1}
            onUpdateModule={(updates) => updateModule(key, updates)}
            onUpdateChild={(childKey, updates) => updateChild(key, childKey, updates)}
          />
        ))}
      </div>
    </Drawer>
  );
};

export default MenuConfigPanel;
