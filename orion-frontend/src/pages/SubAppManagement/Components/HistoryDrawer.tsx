/**
 * HistoryDrawer - 配置历史抽屉
 * 抽取自 index.tsx (P2-9 Phase 127)
 */
import React from 'react';
import { Drawer, Timeline, Typography } from 'antd';
import type { SubAppManagementState } from '../useSubAppManagementState';

const { Text } = Typography;

interface HistoryDrawerProps {
  state: SubAppManagementState;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({ state }) => {
  const { historyDrawerOpen, selectedApp, historyData, historyLoading, setHistoryDrawerOpen } =
    state;

  return (
    <Drawer
      title={`${selectedApp?.name} - 配置历史`}
      placement="right"
      width={500}
      open={historyDrawerOpen}
      onClose={() => setHistoryDrawerOpen(false)}
    >
      {historyLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
      ) : (
        <Timeline
          items={historyData.map((item) => ({
            color:
              item.action === 'created' ? 'green' : item.action === 'deleted' ? 'red' : 'blue',
            children: (
              <div>
                <Text strong>
                  {item.action === 'created' && '创建'}
                  {item.action === 'updated' && '更新'}
                  {item.action === 'deleted' && '删除'}
                  {item.action === 'status_changed' && '状态变更'}
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {item.change_summary}
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {new Date(item.created_at).toLocaleString()}
                </Text>
              </div>
            ),
          }))}
        />
      )}
    </Drawer>
  );
};
