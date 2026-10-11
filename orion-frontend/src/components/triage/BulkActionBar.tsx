import React from 'react';
import { Button, Space } from 'antd';

interface Props {
  selectedCount: number;
  onAcknowledge: () => void;
  onAssign: () => void;
  onClear: () => void;
  disabled?: boolean;
}

export const BulkActionBar: React.FC<Props> = ({
  selectedCount,
  onAcknowledge,
  onAssign,
  onClear,
  disabled,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div
      style={{
        padding: '8px 16px',
        background: '#e6f7ff',
        borderRadius: 4,
        marginBottom: 12,
      }}
      role="toolbar"
      aria-label={`已选择 ${selectedCount} 项`}
    >
      <Space>
        <span aria-live="polite">已选择 {selectedCount} 项</span>
        <Button size="small" disabled={disabled} aria-keyshortcuts="a" onClick={onAcknowledge}>
          批量确认
        </Button>
        <Button size="small" disabled={disabled} aria-keyshortcuts="d" onClick={onAssign}>
          批量分配
        </Button>
        <Button size="small" type="link" aria-label="取消选择" aria-keyshortcuts="Escape" onClick={onClear}>
          取消选择
        </Button>
      </Space>
    </div>
  );
};

export default BulkActionBar;
