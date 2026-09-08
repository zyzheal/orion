/**
 * Capability Admin - 能力权限配置页面
 * P2-9 Phase 86: 主页面拆分 (658→~140 行)
 * P2-9 Phase 281: 168->76 行 (-55%), 新增 Components/{TabItems,ModalsBundle}.tsx
 */
import React from 'react';
import { Tabs, Button, Space } from 'antd';
import {
  PlusOutlined,
  ClockCircleOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';
import { useCapabilityAdminState } from './useCapabilityAdminState';
import { makeCapabilityColumns, makeTempPermColumns } from './columns';
import { buildCapabilityTabItems } from './Components/TabItems';
import { CapabilityModalsBundle } from './Components/ModalsBundle';

export const CapabilityAdmin: React.FC = () => {
  const s = useCapabilityAdminState();

  const capabilityColumns = makeCapabilityColumns(s.handleEdit, s.handleDelete);
  const tempPermColumns = makeTempPermColumns(s.handleRevokeTempPerm);
  const tabItems = buildCapabilityTabItems({ s, capabilityColumns, tempPermColumns });

  return (
    <div className="capability-admin" style={{ padding: spacing.md }}>
      <Tabs
        defaultActiveKey="capabilities"
        items={tabItems}
        tabBarExtraContent={
          <Space>
            <Button onClick={s.handleCleanup} icon={<ClockCircleOutlined />}>清理过期</Button>
            <Button onClick={s.handleCleanupTempPerm} icon={<PlusOutlined />}>授予临时权限</Button>
            <Button type="primary" onClick={s.handleRequestPermissionOpen} icon={<SendOutlined />}>申请权限</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={s.handleCreate}>新建能力</Button>
          </Space>
        }
      />
      <CapabilityModalsBundle s={s} />
    </div>
  );
};

export default CapabilityAdmin;
