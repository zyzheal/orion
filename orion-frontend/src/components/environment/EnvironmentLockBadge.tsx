/**
 * EnvironmentLockBadge - Lock status indicator for environments
 *
 * Shows a lock icon when an environment is locked, with hover tooltip
 * displaying who locked it, when, and the reason.
 * Also provides lock/unlock buttons with confirmation dialog.
 */
import React, { useState } from 'react';
import { Tag, Tooltip, Popconfirm, message, Space } from 'antd';
import { LockOutlined, UnlockOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { spacing } from '@/tokens';

// ---- Types ----

export interface EnvironmentLockInfo {
  locked: boolean;
  lockedBy?: string;
  lockedAt?: string;
  reason?: string;
}

// ---- API calls ----

async function lockEnvironment(envId: string, reason: string): Promise<void> {
  const response = await fetch(`/api/v1/environments/${envId}/lock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, lockedBy: 'current-user' }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Failed to lock environment');
  }
}

async function unlockEnvironment(envId: string): Promise<void> {
  const response = await fetch(`/api/v1/environments/${envId}/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Failed to unlock environment');
  }
}

async function fetchLockStatus(envId: string): Promise<EnvironmentLockInfo> {
  const response = await fetch(`/api/v1/environments/${envId}/lock-status`);
  if (!response.ok) {
    throw new Error('Failed to fetch lock status');
  }
  return response.json();
}

// ---- Component ----

interface EnvironmentLockBadgeProps {
  envId: string;
  envName: string;
  /** Initial lock info (optional — component will fetch if not provided) */
  initialLockInfo?: EnvironmentLockInfo;
  /** Show lock/unlock action buttons */
  showActions?: boolean;
  /** Called after lock/unlock completes */
  onLockChange?: (info: EnvironmentLockInfo) => void;
}

const EnvironmentLockBadge: React.FC<EnvironmentLockBadgeProps> = ({
  envId,
  envName,
  initialLockInfo,
  showActions = false,
  onLockChange,
}) => {
  const [lockInfo, setLockInfo] = useState<EnvironmentLockInfo | undefined>(initialLockInfo);
  const [_loading, setLoading] = useState(false);

  const handleLock = async () => {
    try {
      setLoading(true);
      await lockEnvironment(envId, `Locked by user on ${dayjs().format('YYYY-MM-DD HH:mm')}`);
      const info = await fetchLockStatus(envId);
      setLockInfo(info);
      onLockChange?.(info);
      message.success(`环境 "${envName}" 已锁定`);
    } catch (error: unknown) {
      message.error(`锁定失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    try {
      setLoading(true);
      await unlockEnvironment(envId);
      const info = await fetchLockStatus(envId);
      setLockInfo(info);
      onLockChange?.(info);
      message.success(`环境 "${envName}" 已解锁`);
    } catch (error: unknown) {
      message.error(`解锁失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // Not locked — show unlock button if actions enabled
  if (!lockInfo || !lockInfo.locked) {
    return showActions ? (
      <Space size="small">
        <Popconfirm
          title="确认锁定环境?"
          description="锁定后将无法向此环境部署应用"
          onConfirm={handleLock}
        >
          <Tag
            color="default"
            style={{ cursor: 'pointer' }}
            icon={<UnlockOutlined />}
          >
            未锁定
          </Tag>
        </Popconfirm>
      </Space>
    ) : null;
  }

  // Locked — show lock badge with info
  const tooltipContent = (
    <div>
      <div><strong>锁定状态:</strong> 已锁定</div>
      {lockInfo.lockedBy && <div><strong>操作人:</strong> {lockInfo.lockedBy}</div>}
      {lockInfo.lockedAt && <div><strong>锁定时间:</strong> {dayjs(lockInfo.lockedAt).format('YYYY-MM-DD HH:mm:ss')}</div>}
      {lockInfo.reason && <div><strong>锁定原因:</strong> {lockInfo.reason}</div>}
      {showActions && (
        <div style={{ marginTop: spacing.sm }}>
          <Popconfirm
            title="确认解锁环境?"
            description="解锁后将允许向此环境部署应用"
            onConfirm={handleUnlock}
          >
            <Tag color="blue" style={{ cursor: 'pointer' }} icon={<LockOutlined />}>
              点击解锁
            </Tag>
          </Popconfirm>
        </div>
      )}
    </div>
  );

  return (
    <Tooltip title={tooltipContent} placement="topLeft">
      <Tag
        color="red"
        icon={<LockOutlined />}
        style={{ cursor: 'pointer' }}
      >
        已锁定
      </Tag>
    </Tooltip>
  );
};

export default EnvironmentLockBadge;
