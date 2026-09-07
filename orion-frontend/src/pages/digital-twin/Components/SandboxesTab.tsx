/**
 * SandboxesTab - 沙箱列表 Tab
 * 抽取自 index.tsx (P2-9 Phase 116)
 */
import React, { useMemo } from 'react';
import { Button, Empty, Space, Table } from 'antd';
import { ExperimentOutlined, ReloadOutlined } from '@ant-design/icons';
import type { SandboxEnv } from '@/api/digital-twin';
import { buildSandboxColumns } from '../columns';
import type { DigitalTwinState } from '../useDigitalTwinState';

interface SandboxesTabProps {
  state: DigitalTwinState;
}

export const SandboxesTab: React.FC<SandboxesTabProps> = ({ state }) => {
  const { sandboxes, handleCreateSandbox, loadSandboxes } = state;

  const columns = useMemo(() => buildSandboxColumns(), []);

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<ExperimentOutlined />} onClick={handleCreateSandbox}>创建沙箱</Button>
        <Button icon={<ReloadOutlined />} onClick={loadSandboxes}>刷新</Button>
      </Space>
      <Table<SandboxEnv>
        columns={columns}
        dataSource={sandboxes}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: <Empty description="暂无沙箱" /> }}
        scroll={{ x: 900 }}
      />
    </div>
  );
};
