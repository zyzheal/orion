import { Space } from 'antd';
import type { TabsProps } from 'antd';
import { FileTextOutlined, DiffOutlined, ScanOutlined } from '@ant-design/icons';
import { OverviewTab } from '../OverviewTab';
import { DiffTab } from '../DiffTab';
import { DriftTab } from '../DriftTab';
import { buildConfigColumns } from '../columns';
import { buildConfigSelectOptions } from '../config';
import type { useConfigManagementState } from '../useConfigManagementState';

type State = ReturnType<typeof useConfigManagementState>;

export function buildConfigTabItems(state: State): TabsProps['items'] {
  const s = state;
  const columns = buildConfigColumns({
    onEdit: s.handleEdit,
    onDelete: s.handleDelete,
    onApproval: s.handleApproval,
    onViewDetail: s.openViewDetail,
  });
  const configSelectOptions = buildConfigSelectOptions(s.configs);

  return [
    {
      key: 'overview',
      label: (<Space><FileTextOutlined />配置概览</Space>),
      children: (
        <OverviewTab
          configs={s.configs}
          gitOpsConfig={s.gitOpsConfig}
          loading={s.loading}
          columns={columns}
        />
      ),
    },
    {
      key: 'diff',
      label: (<Space><DiffOutlined />差异对比</Space>),
      children: (
        <DiffTab
          sourceEnv={s.sourceEnv}
          targetEnv={s.targetEnv}
          onSourceEnvChange={s.setSourceEnv}
          onTargetEnvChange={s.setTargetEnv}
          envDiffLoading={s.envDiffLoading}
          envDiffResult={s.envDiffResult}
          onEnvCompare={s.handleEnvCompare}
          versionDiffConfigId={s.versionDiffConfigId}
          versionA={s.versionA}
          versionB={s.versionB}
          onVersionDiffConfigIdChange={s.setVersionDiffConfigId}
          onVersionAChange={s.setVersionA}
          onVersionBChange={s.setVersionB}
          versionDiffLoading={s.versionDiffLoading}
          versionDiffResult={s.versionDiffResult}
          onVersionCompare={s.handleVersionCompare}
          configSelectOptions={configSelectOptions}
          reportLoading={s.reportLoading}
          diffReport={s.diffReport}
          onGenerateReport={s.handleGenerateReport}
        />
      ),
    },
    {
      key: 'drift',
      label: (<Space><ScanOutlined />漂移检测</Space>),
      children: (
        <DriftTab
          driftLoading={s.driftLoading}
          driftResult={s.driftResult}
          onDriftDetect={s.handleDriftDetect}
        />
      ),
    },
  ];
}
