/**
 * TaskTimeouts constants
 * 抽取自 index.tsx (P2-9 Phase 200)
 */
import { Tag } from 'antd';

/** 动作说明文案 */
export const ACTION_DESCRIPTIONS: Record<string, string> = {
  remind: '发送提醒通知给任务负责人',
  escalate: '将任务升级给上级处理',
  auto_complete: '自动完成任务',
  cancel: '取消任务并跳过',
};

/** 超时动作标签 */
export const getActionTag = (action: string) => {
  switch (action) {
    case 'remind':
      return <Tag color="blue">提醒</Tag>;
    case 'escalate':
      return <Tag color="orange">升级</Tag>;
    case 'auto_complete':
      return <Tag color="green">自动完成</Tag>;
    case 'cancel':
      return <Tag color="red">取消</Tag>;
    default:
      return <Tag>{action}</Tag>;
  }
};
