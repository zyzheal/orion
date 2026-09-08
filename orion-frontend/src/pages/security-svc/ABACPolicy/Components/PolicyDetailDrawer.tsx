/**
 * ABACPolicy PolicyDetailDrawer
 * 抽取自 index.tsx (P2-9 Phase 202)
 */
import { Drawer } from 'antd';
import type { AbacPolicy } from '@/api/abac-policy';
import { colors, spacing } from '@/tokens';

interface Props {
  open: boolean;
  policy: AbacPolicy | null;
  onClose: () => void;
}

export const PolicyDetailDrawer = ({ open, policy, onClose }: Props) => (
  <Drawer title="策略详情" open={open} onClose={onClose} width={500}>
    {policy && (
      <>
        <p>
          <strong>ID:</strong> {policy.id}
        </p>
        <p>
          <strong>名称:</strong> {policy.name}
        </p>
        <p>
          <strong>描述:</strong> {policy.description || '-'}
        </p>
        <p>
          <strong>资源类型:</strong>{' '}
          {Array.isArray(policy.resourceType)
            ? policy.resourceType.join(', ')
            : policy.resourceType}
        </p>
        <p>
          <strong>操作类型:</strong>{' '}
          {Array.isArray(policy.actionType) ? policy.actionType.join(', ') : policy.actionType}
        </p>
        <p>
          <strong>效果:</strong> {policy.effect === 'allow' ? '允许' : '拒绝'}
        </p>
        <p>
          <strong>优先级:</strong> {policy.priority}
        </p>
        <p>
          <strong>状态:</strong> {policy.enabled ? '启用' : '禁用'}
        </p>
        <p>
          <strong>条件:</strong>
        </p>
        <pre
          style={{ background: colors.neutral[100], padding: spacing[3], borderRadius: 4 }}
        >
          {JSON.stringify(policy.conditions, null, 2)}
        </pre>
      </>
    )}
  </Drawer>
);
