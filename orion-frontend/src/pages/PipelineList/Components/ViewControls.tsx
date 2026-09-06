/**
 * ViewControls - 视图/列设置下拉菜单
 * 抽取自 index.tsx (P2-9 Phase 108)
 */
import React from 'react';
import { Button, Dropdown, Space, Checkbox } from 'antd';
import { SaveOutlined, ColumnHeightOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { PipelineListState } from '../usePipelineListState';
import { buildPipelineColumns } from '../columns';

interface ViewControlsProps {
  state: PipelineListState;
}

export const ViewControls: React.FC<ViewControlsProps> = ({ state }) => {
  const columns = buildPipelineColumns({
    navigate: state.navigate,
    canEdit: state.canEdit,
    columnVisible: {},
    handleDelete: state.handleDelete,
  });

  return (
    <div style={{ marginBottom: spacing.md, textAlign: 'right' }}>
      <Space>
        <Dropdown
          menu={{
            items: [
              ...state.savedViews.map((v) => ({
                key: v.id,
                label: v.name,
                onClick: () => state.handleApplyView(v),
              })),
              { type: 'divider' },
              {
                key: 'save',
                icon: <SaveOutlined />,
                label: '保存当前视图',
                onClick: () => state.setViewModalVisible(true),
              },
            ],
          }}
        >
          <Button icon={<SaveOutlined />}>视图</Button>
        </Dropdown>
        <Dropdown
          menu={{
            items: Object.keys(state.columnVisible).map((key) => ({
              key,
              label: (
                <Checkbox
                  checked={state.columnVisible[key]}
                  onChange={() =>
                    state.setColumnVisible((prev) => ({ ...prev, [key]: !prev[key] }))
                  }
                  onClick={(e) => e.stopPropagation()}
                >
                  {columns.find((c) => c.key === key)?.title || key}
                </Checkbox>
              ),
            })),
          }}
        >
          <Button icon={<ColumnHeightOutlined />}>列设置</Button>
        </Dropdown>
      </Space>
    </div>
  );
};
