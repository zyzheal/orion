/**
 * 菜单配置面板
 * 支持管理员自定义导航菜单模块名称、描述、子菜单项的启用/禁用
 * 支持新增/删除菜单项、跨模块拖拽移动
 */
import React, { useState } from 'react';
import { Drawer, Button, Input, Switch, Space, message, Tag, Typography, Modal, Select, Form } from 'antd';
import {
  SettingOutlined,
  SaveOutlined,
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  DragOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { useMenuConfigStore, type MenuModuleConfig, type MenuChildConfig } from '@/stores/menuConfigStore';
import { spacing } from '@/tokens';

const { Text } = Typography;

// ==================== Drag & Drop Context ====================

let dragSource: { moduleKey: string; childKey: string } | null = null;
let dragOverTarget: string | null = null;

function setDragSource(moduleKey: string, childKey: string) {
  dragSource = { moduleKey, childKey };
}

function clearDragSource() {
  dragSource = null;
}

function setDragOverTarget(targetKey: string) {
  dragOverTarget = targetKey;
}

function clearDragOverTarget() {
  dragOverTarget = null;
}

// ==================== Add Child Modal ====================

interface AddChildModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (child: Omit<MenuChildConfig, 'key'>) => void;
  moduleKey: string;
}

const AddChildModal: React.FC<AddChildModalProps> = ({ open, onClose, onAdd, moduleKey }) => {
  const [form] = Form.useForm();

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      onAdd({
        label: values.label,
        description: values.description,
        category: values.category || '自定义',
        enabled: true,
      });
      form.resetFields();
      message.success(`已添加菜单项 "${values.label}"`);
      onClose();
    });
  };

  return (
    <Modal
      title="新增菜单项"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="添加"
      cancelText="取消"
    >
      <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
        <Form.Item
          name="label"
          label="菜单名称"
          rules={[{ required: true, message: '请输入菜单名称' }]}
        >
          <Input placeholder="如：自定义页面" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input placeholder="可选，描述该菜单项的功能" />
        </Form.Item>
        <Form.Item name="category" label="分类">
          <Input placeholder="可选，如：自定义、扩展" />
        </Form.Item>
        <Text type="secondary" style={{ fontSize: 12 }}>
          路径将自动生成：/{moduleKey.replace(/^\//, '')}/菜单名称小写
        </Text>
      </Form>
    </Modal>
  );
};

// ==================== Move Child Modal ====================

interface MoveChildModalProps {
  open: boolean;
  onClose: () => void;
  onMove: (from: string, to: string, childKey: string) => void;
  child: MenuChildConfig;
  fromModuleKey: string;
  moduleOptions: Array<{ key: string; label: string }>;
}

const MoveChildModal: React.FC<MoveChildModalProps> = ({ open, onClose, onMove, child, fromModuleKey, moduleOptions }) => {
  const [targetModule, setTargetModule] = useState('');

  const handleMove = () => {
    if (!targetModule) {
      message.warning('请选择目标模块');
      return;
    }
    if (targetModule === fromModuleKey) {
      message.warning('不能移动到同一个模块');
      return;
    }
    onMove(fromModuleKey, targetModule, child.key);
    message.success(`已将 "${child.label}" 移动到目标模块`);
    setTargetModule('');
    onClose();
  };

  const options = moduleOptions.filter((m) => m.key !== fromModuleKey);

  return (
    <Modal
      title={`移动菜单项: ${child.label}`}
      open={open}
      onCancel={onClose}
      onOk={handleMove}
      okText="移动"
      cancelText="取消"
    >
      <div style={{ marginTop: spacing.md }}>
        <Text style={{ marginBottom: spacing.sm, display: 'block' }}>
          将 <Tag color="blue">{child.label}</Tag> 从 <Tag>{fromModuleKey}</Tag> 移动到：
        </Text>
        <Select
          value={targetModule || undefined}
          onChange={setTargetModule}
          options={options}
          style={{ width: '100%' }}
          placeholder="选择目标模块"
        />
      </div>
    </Modal>
  );
};

// ==================== Module Editor ====================

const ModuleEditor: React.FC<{
  module: MenuModuleConfig;
  moduleOrder: number;
  onUpdateModule: (updates: Partial<MenuModuleConfig>) => void;
  onUpdateChild: (childKey: string, updates: Partial<{ enabled: boolean }>) => void;
  onDeleteChild: (childKey: string) => void;
  onAddChild: (child: Omit<MenuChildConfig, 'key'>) => void;
  moduleOptions: Array<{ key: string; label: string }>;
}> = ({ module, moduleOrder, onUpdateModule, onUpdateChild, onDeleteChild, onAddChild, moduleOptions }) => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const hasChildren = module.children && module.children.length > 0;
  const [addOpen, setAddOpen] = useState(false);
  const [moveChild, setMoveChild] = useState<MenuChildConfig | null>(null);

  const handleDragStart = (childKey: string) => {
    setDragSource(module.key, childKey);
  };

  const handleDragOver = (e: React.DragEvent, childKey: string) => {
    e.preventDefault();
    setDragOverTarget(childKey);
  };

  const handleDrop = (e: React.DragEvent, targetChildKey: string) => {
    e.preventDefault();
    clearDragOverTarget();
    const source = dragSource;
    if (!source || source.childKey === targetChildKey) {
      clearDragSource();
      return;
    }

    // Same module: reorder; different module: move
    if (source.moduleKey === module.key) {
      // Find current index of target
      const targetIndex = module.children.findIndex((c) => c.key === targetChildKey);
      const child = module.children.find((c) => c.key === source.childKey);
      if (child) {
        const newChildren = module.children.filter((c) => c.key !== source.childKey);
        newChildren.splice(targetIndex, 0, child);
        onUpdateModule({ children: newChildren });
        message.info(`已调整 "${child.label}" 位置`);
      }
    } else {
      const store = useMenuConfigStore.getState();
      store.moveChild(source.moduleKey, module.key, source.childKey);
      message.success(`已将 "${source.childKey}" 移动到 "${module.label}"`);
    }
    clearDragSource();
  };

  const handleDragEnd = () => {
    clearDragSource();
    clearDragOverTarget();
  };

  return (
    <div
      style={{
        background: isDark ? 'rgba(255,255,255,0.03)' : 'colors.neutral[50]',
        borderRadius: 10,
        padding: spacing.md,
        marginBottom: spacing[3],
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : colors.neutral[200]}`,
      }}
    >
      {/* 模块头部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3], marginBottom: hasChildren ? 12 : 0 }}>
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
        <div style={{ display: 'flex', gap: spacing[3], marginBottom: spacing[3] }}>
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
          {module.children.map((child) => {
            const isDragOver = dragOverTarget === child.key;
            return (
              <div
                key={child.key}
                draggable
                onDragStart={() => handleDragStart(child.key)}
                onDragOver={(e) => handleDragOver(e, child.key)}
                onDrop={(e) => handleDrop(e, child.key)}
                onDragEnd={handleDragEnd}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: child.enabled
                    ? isDark ? 'rgba(51,112,230,0.1)' : 'rgba(51,112,230,0.06)'
                    : isDark ? 'rgba(255,255,255,0.03)' : colors.neutral[100],
                  border: `1px solid ${isDragOver
                    ? colors.primary
                    : child.enabled
                      ? isDark ? 'rgba(51,112,230,0.2)' : 'rgba(51,112,230,0.15)'
                      : isDark ? 'rgba(255,255,255,0.05)' : 'colors.neutral[200]'}`,
                  transition: 'all 0.2s',
                  opacity: child.enabled ? 1 : 0.5,
                  cursor: 'grab',
                }}
              >
                <DragOutlined
                  style={{ color: colors.neutral[400], fontSize: 10, cursor: 'grab' }}
                />
                <Switch
                  checked={child.enabled}
                  onChange={(checked) => onUpdateChild(child.key, { enabled: checked })}
                  size="small"
                />
                <Text style={{ fontSize: 12, color: child.enabled ? undefined : colors.neutral[400] }}>
                  {child.label}
                </Text>
                <Button
                  type="text"
                  size="small"
                  icon={<span style={{ fontSize: 10 }}>→</span>}
                  onClick={(e) => { e.stopPropagation(); setMoveChild(child); }}
                  title="移动到..."
                  style={{ padding: '0 2px', height: 20, minWidth: 20 }}
                />
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined style={{ fontSize: 10 }} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    Modal.confirm({
                      title: '确认删除',
                      content: `确定要删除菜单项 "${child.label}" 吗？`,
                      onOk: () => onDeleteChild(child.key),
                    });
                  }}
                  style={{ padding: '0 2px', height: 20, minWidth: 20 }}
                />
              </div>
            );
          })}
          {/* 新增按钮 */}
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setAddOpen(true)}
            style={{ borderRadius: 6, fontSize: 12, height: 28 }}
          >
            新增
          </Button>
        </div>
      )}

      {/* Add Child Modal */}
      <AddChildModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={onAddChild}
        moduleKey={module.key}
      />

      {/* Move Child Modal */}
      {moveChild && (
        <MoveChildModal
          open={!!moveChild}
          onClose={() => setMoveChild(null)}
          onMove={(from, to, childKey) => {
            const store = useMenuConfigStore.getState();
            store.moveChild(from, to, childKey);
          }}
          child={moveChild}
          fromModuleKey={module.key}
          moduleOptions={moduleOptions}
        />
      )}
    </div>
  );
};

// ==================== Main Panel ====================

export const MenuConfigPanel: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { modules, updateModule, updateChild, deleteChild, addChild, saveConfig, resetToDefault } = useMenuConfigStore();
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  const moduleKeys = Object.keys(modules);
  const moduleOptions = moduleKeys.map((key) => ({ key, label: modules[key].label }));

  const handleSave = () => {
    saveConfig();
    message.success('菜单配置已保存');
    onClose();
  };

  const handleReset = () => {
    Modal.confirm({
      title: '确认恢复默认',
      content: '这将清除所有自定义配置，恢复为默认的 7 域结构。是否继续？',
      onOk: () => {
        resetToDefault();
        message.info('已恢复默认配置');
      },
    });
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
      width={560}
      placement="right"
      styles={{
        body: { padding: '20px 24px', background: isDark ? colors.neutral[900] : colors.neutral[0] },
        header: {
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : colors.neutral[200]}`,
          paddingBottom: 16,
        },
      }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing[3] }}>
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
      <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: spacing.sm }}>
        自定义导航菜单的模块名称、描述及子菜单项
      </Text>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 20 }}>
        拖拽菜单项调整顺序或跨模块移动 · 点击 → 移动到指定模块 · 点击 🗑️ 删除
      </Text>

      <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto', paddingRight: 4 }}>
        {moduleKeys.map((key, index) => (
          <ModuleEditor
            key={key}
            module={modules[key]}
            moduleOrder={index + 1}
            onUpdateModule={(updates) => updateModule(key, updates)}
            onUpdateChild={(childKey, updates) => updateChild(key, childKey, updates)}
            onDeleteChild={(childKey) => deleteChild(key, childKey)}
            onAddChild={(child) => addChild(key, child)}
            moduleOptions={moduleOptions}
          />
        ))}
      </div>
    </Drawer>
  );
};

export default MenuConfigPanel;
