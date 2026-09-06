/**
 * API Governance Page (Enhanced Phase 4)
 *
 * Contract management, version control, governance rules, compliance reports
 * Enhanced with contract verification, API versioning, and deprecation tracking.
 *
 * P2-9 Phase 48 重构: 810 → 130 行 (-84%)
 * 拆分: useApiGovernanceState + ApiGovernanceColumns + ApiGovernanceModals +
 *       ReportStatsCard + 5 个 Tab 组件
 */
import React, { useState } from 'react';
import { Form, Tabs } from 'antd';
import {
  FileTextOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
  BranchesOutlined,
  VerifiedOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';
import { useApiGovernanceState } from './useApiGovernanceState';
import { ReportStatsCard } from './ReportStatsCard';
import { ContractsTab } from './ContractsTab';
import { RulesTab } from './RulesTab';
import { ViolationsTab } from './ViolationsTab';
import { VersionsTab } from './VersionsTab';
import { VerificationTab } from './VerificationTab';
import {
  CreateContractModal,
  CreateRuleModal,
  VerifyContractModal,
  RegisterVersionModal,
  DeprecateVersionModal,
} from './ApiGovernanceModals';
import type { ApiVersionType } from './useApiGovernanceState';

const ApiGovernancePage: React.FC = () => {
  const {
    contracts,
    rules,
    violations,
    report,
    loading,
    contractModal,
    setContractModal,
    ruleModal,
    setRuleModal,
    deprecateModal,
    setDeprecateModal,
    verifyModal,
    setVerifyModal,
    versionModal,
    setVersionModal,
    versions,
    verificationResults,
    selectedContract,
    setSelectedContract,
    activeTab,
    setActiveTab,
    deprecatedCount,
    loadData,
    handleCreateContract,
    handleCreateRule,
    handleEvaluate,
    handleVerify,
    handleRegisterVersion,
    handleDeprecateVersion,
    handleRetireVersion,
  } = useApiGovernanceState();

  const [form] = Form.useForm();
  const [verifyForm] = Form.useForm();
  const [versionForm] = Form.useForm();
  const [deprecateForm] = Form.useForm();

  const handleOpenDeprecate = (record: ApiVersionType) => {
    deprecateForm.setFieldsValue({ versionId: record.id });
    setDeprecateModal(true);
  };

  const handleSelectForVerify = (record: typeof contracts[number]) => {
    setSelectedContract(record);
    setVerifyModal(true);
  };

  return (
    <div style={{ padding: spacing.lg }}>
      <ReportStatsCard
        report={report}
        contractsCount={contracts.length}
        versionsCount={versions.length}
        violationsCount={violations.length}
        deprecatedCount={deprecatedCount}
        loading={loading}
      />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'contracts',
            label: (
              <>
                <FileTextOutlined /> Contracts
              </>
            ),
            children: (
              <ContractsTab
                contracts={contracts}
                loading={loading}
                onCreateContract={() => setContractModal(true)}
                onRefresh={loadData}
                onSelectForVerify={handleSelectForVerify}
                onEvaluate={handleEvaluate}
              />
            ),
          },
          {
            key: 'rules',
            label: (
              <>
                <SafetyCertificateOutlined /> Governance Rules
              </>
            ),
            children: (
              <RulesTab
                rules={rules}
                loading={loading}
                onCreateRule={() => setRuleModal(true)}
                onRefresh={loadData}
              />
            ),
          },
          {
            key: 'violations',
            label: (
              <>
                <WarningOutlined /> Violations
              </>
            ),
            children: <ViolationsTab violations={violations} loading={loading} onRefresh={loadData} />,
          },
          {
            key: 'versions',
            label: (
              <>
                <BranchesOutlined /> Version Management
              </>
            ),
            children: (
              <VersionsTab
                versions={versions}
                loading={loading}
                onRegisterVersion={() => setVersionModal(true)}
                onRefresh={loadData}
                onDeprecate={handleOpenDeprecate}
                onRetire={handleRetireVersion}
              />
            ),
          },
          {
            key: 'verification',
            label: (
              <>
                <VerifiedOutlined /> Verification History
              </>
            ),
            children: <VerificationTab verificationResults={verificationResults} />,
          },
        ]}
      />

      <CreateContractModal
        open={contractModal}
        form={form}
        onCancel={() => setContractModal(false)}
        onSubmit={handleCreateContract}
      />
      <CreateRuleModal
        open={ruleModal}
        form={form}
        onCancel={() => setRuleModal(false)}
        onSubmit={handleCreateRule}
      />
      <VerifyContractModal
        open={verifyModal}
        form={verifyForm}
        selectedContract={selectedContract}
        onCancel={() => setVerifyModal(false)}
        onSubmit={handleVerify}
      />
      <RegisterVersionModal
        open={versionModal}
        form={versionForm}
        onCancel={() => setVersionModal(false)}
        onSubmit={handleRegisterVersion}
      />
      <DeprecateVersionModal
        open={deprecateModal}
        form={deprecateForm}
        onCancel={() => setDeprecateModal(false)}
        onSubmit={handleDeprecateVersion}
      />
    </div>
  );
};

export default ApiGovernancePage;
