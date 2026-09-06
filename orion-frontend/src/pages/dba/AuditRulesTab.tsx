/**
 * AuditRulesTab.tsx - 审计规则 Tab（Refresh + Table）
 * 抽取自 DbaPage.tsx (P2-9 Phase 42)
 */
import React, { useState, useMemo } from 'react';
import {
  Button,
  Typography,
  Tag,
  Switch,
  Empty,
  message,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import { updateAuditRule, type AuditRule } from '@/api/dba';
import { spacing } from '@/tokens';

const { Text } = Typography;

export interface AuditRulesTabProps {
  auditRules: AuditRule[];
  ruleLoading: boolean;
  loadAuditRules: () => Promise<void> | void;
}

const severityColorMap: Record<AuditRule['severity'], string> = {
  info: 'blue',
  warning: 'orange',
  error: 'red',
};

const severityLabelMap: Record<AuditRule['severity'], string> = {
  info: '信息',
  warning: '警告',
  error: '错误',
};

const AuditRulesTab: React.FC<AuditRulesTabProps> = ({
  auditRules,
  ruleLoading,
  loadAuditRules,
}) => {
  const [toggling, setToggling] = useState<string | null>(null);

  const handleToggleRule = async (rule: AuditRule) => {
    setToggling(rule.id);
    try {
      await updateAuditRule(rule.id, { enabled: !rule.enabled });
      message.success(`规则已${rule.enabled ? '禁用' : '启用'}`);
      loadAuditRules();
    } catch (error: unknown) {
      message.error(`更新失败: ${(error as Error).message}`);
    } finally {
      setToggling(null);
    }
  };

  const ruleColumns = useMemo<TableColumn<AuditRule>[]>(
    () => [
      {
        key: 'id',
        title: '规则ID',
        dataIndex: 'id',
        width: 100,
        render: (v: unknown) => <Text code>{String(v).slice(0, 8)}</Text>,
      },
      {
        key: 'name',
        title: '规则名称',
        dataIndex: 'name',
        width: 180,
        render: (v: unknown) => <Text strong>{String(v)}</Text>,
      },
      {
        key: 'pattern',
        title: '匹配模式',
        dataIndex: 'pattern',
        render: (v: unknown) => (
          <Text code style={{ fontSize: 12 }}>
            {String(v)}
          </Text>
        ),
      },
      {
        key: 'severity',
        title: '严重级别',
        dataIndex: 'severity',
        width: 100,
        render: (v: unknown) => {
          const severity = v as AuditRule['severity'];
          return <Tag color={severityColorMap[severity]}>{severityLabelMap[severity]}</Tag>;
        },
      },
      {
        key: 'enabled',
        title: '启用',
        dataIndex: 'enabled',
        width: 80,
        render: (enabled: unknown, record: AuditRule) => (
          <Switch
            size="small"
            checked={!!enabled}
            loading={toggling === record.id}
            onChange={() => handleToggleRule(record)}
          />
        ),
      },
    ],
    [toggling]
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: spacing.md }}>
        <Button icon={<ReloadOutlined />} onClick={() => loadAuditRules()} loading={ruleLoading}>
          刷新
        </Button>
      </div>
      <Table
        columns={ruleColumns}
        dataSource={auditRules}
        loading={ruleLoading}
        rowKey="id"
        size="middle"
        striped
        locale={{
          emptyText: <Empty description="暂无审计规则" />,
        }}
      />
    </div>
  );
};

export default AuditRulesTab;
