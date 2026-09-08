/**
 * ScriptRunner 在线脚本执行页面 (组合层)
 * 拆分自 index.tsx (P2-9 Phase 230)
 * - constants.ts: languageOptions + levelOptions
 * - useScriptRunnerState.ts: 4 useState + Form.useForm + handleScan + handleExecute
 * - Components/PageHeader.tsx: 标题 + 描述
 * - Components/ConfigFormCard.tsx: 语言/级别/代码 + 按钮
 * - Components/ScanResultCard.tsx: 安全扫描结果
 * - Components/ExecutionResultCard.tsx: 执行结果
 * - index.tsx: 组合层
 */
import React from 'react';
import { spacing } from '@/tokens';
import { useScriptRunnerState } from './useScriptRunnerState';
import { PageHeader } from './Components/PageHeader';
import { ConfigFormCard } from './Components/ConfigFormCard';
import { ScanResultCard } from './Components/ScanResultCard';
import { ExecutionResultCard } from './Components/ExecutionResultCard';

const ScriptRunnerPage: React.FC = () => {
  const {
    loading,
    scanning,
    scanResult,
    execResult,
    form,
    handleScan,
    handleExecute,
  } = useScriptRunnerState();

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader />

      <ConfigFormCard
        form={form}
        loading={loading}
        scanning={scanning}
        onScan={handleScan}
        onExecute={handleExecute}
      />

      {scanResult && <ScanResultCard result={scanResult} />}

      {execResult && <ExecutionResultCard result={execResult} />}
    </div>
  );
};

export default ScriptRunnerPage;
