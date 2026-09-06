/**
 * useApiGovernanceState.ts - API Governance 页面状态管理
 * 抽取自 ApiGovernancePage.tsx (P2-9 Phase 48)
 * 包含: contracts/rules/violations/report/versions/verification 状态 + 全部 loader + handler
 */
import { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import {
  apiGovernanceApi,
  type GovernanceContract,
  type GovernanceRule,
  type GovernanceViolation,
  type GovernanceReport,
} from '@/api/api-governance';

export interface ApiVersionType {
  id: string;
  contract_id: string;
  version: string;
  changelog: string | null;
  breaking_changes: boolean;
  status: 'active' | 'deprecated' | 'archived';
  created_at: string;
}

export interface VerificationResult {
  contractId: string;
  passed: boolean;
  violations: string[];
  endpoint: string;
  method: string;
  verifiedAt: string;
}

export interface VerifyInput {
  actualResponse?: string;
  endpoint?: string;
  method?: string;
}

export interface RegisterVersionInput {
  apiName: string;
  version: string;
  status?: string;
  changelog?: string;
  contractId?: string;
}

export interface DeprecateVersionInput {
  versionId: string;
  replacementVersion?: string;
  retirementDate?: string;
}

export const useApiGovernanceState = () => {
  const [contracts, setContracts] = useState<GovernanceContract[]>([]);
  const [rules, setRules] = useState<GovernanceRule[]>([]);
  const [violations, setViolations] = useState<GovernanceViolation[]>([]);
  const [report, setReport] = useState<GovernanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [contractModal, setContractModal] = useState(false);
  const [ruleModal, setRuleModal] = useState(false);
  const [deprecateModal, setDeprecateModal] = useState(false);
  const [verifyModal, setVerifyModal] = useState(false);
  const [versionModal, setVersionModal] = useState(false);
  const [versions, setVersions] = useState<ApiVersionType[]>([]);
  const [verificationResults, setVerificationResults] = useState<VerificationResult[]>([]);
  const [selectedContract, setSelectedContract] = useState<GovernanceContract | null>(null);
  const [activeTab, setActiveTab] = useState('contracts');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [contractRes, ruleRes, violationRes, reportRes] = await Promise.all([
        apiGovernanceApi.listContracts(),
        apiGovernanceApi.listRules(),
        apiGovernanceApi.listViolations(),
        apiGovernanceApi.getReport(),
      ]);
      const contractData = (contractRes as any).data ?? contractRes ?? [];
      const ruleData = (ruleRes as any).data ?? ruleRes ?? [];
      const violationData = (violationRes as any).data ?? violationRes ?? [];
      const reportData = (reportRes as any).data ?? reportRes ?? null;

      setContracts(contractData);
      setRules(ruleData);
      setViolations(violationData);
      setReport(reportData);

      const allVersions: ApiVersionType[] = [];
      if (contractData.length > 0) {
        for (const contract of contractData) {
          try {
            const cvRes = await apiGovernanceApi.listVersions(contract.id);
            const contractVersions = (cvRes as any).data ?? cvRes;
            if (Array.isArray(contractVersions)) {
              allVersions.push(...contractVersions);
            }
          } catch {
            // Ignore individual version fetch failures
          }
        }
      }
      setVersions(allVersions);
    } catch {
      message.error('Failed to load data');
    }
    setLoading(false);
  }, []);

  const handleCreateContract = useCallback(
    async (values: any) => {
      try {
        await apiGovernanceApi.createContract(values);
        message.success('Contract created');
        setContractModal(false);
        loadData();
      } catch {
        message.error('Failed to create contract');
      }
    },
    [loadData],
  );

  const handleCreateRule = useCallback(
    async (values: any) => {
      try {
        await apiGovernanceApi.createRule(values);
        message.success('Rule created');
        setRuleModal(false);
        loadData();
      } catch {
        message.error('Failed to create rule');
      }
    },
    [loadData],
  );

  const handleEvaluate = useCallback(
    async (contractId: string) => {
      try {
        await apiGovernanceApi.evaluateContract(contractId);
        message.success('Evaluation completed');
        loadData();
      } catch {
        message.error('Failed to evaluate contract');
      }
    },
    [loadData],
  );

  const handleVerify = useCallback(
    async (values: VerifyInput) => {
      try {
        if (!selectedContract) {
          message.error('No contract selected');
          return;
        }
        const resultRes = await apiGovernanceApi.verifyContract(selectedContract.id, {
          actualResponse: values.actualResponse ? JSON.parse(values.actualResponse) : {},
          endpoint: values.endpoint,
          method: values.method,
        });
        const result = (resultRes as any).data ?? resultRes;
        setVerificationResults((prev) => [...prev, result as VerificationResult]);
        if ((result as VerificationResult).passed) {
          message.success('Verification passed');
        } else {
          message.warning(
            `Verification failed: ${(result as VerificationResult).violations.length} violations`,
          );
        }
        setVerifyModal(false);
      } catch {
        message.error('Failed to verify contract');
      }
    },
    [selectedContract],
  );

  const handleRegisterVersion = useCallback(
    async (values: RegisterVersionInput) => {
      try {
        await apiGovernanceApi.registerVersion({
          apiName: values.apiName,
          version: values.version,
          status: values.status || 'active',
          changelog: values.changelog,
        });
        const contractId = values.contractId || '';
        if (contractId) {
          const contractVersions = await apiGovernanceApi.listVersions(contractId);
          if (Array.isArray(contractVersions)) {
            setVersions(contractVersions);
          }
        }
        message.success('Version registered');
        setVersionModal(false);
      } catch {
        message.error('Failed to register version');
      }
    },
    [],
  );

  const handleDeprecateVersion = useCallback(
    async (values: DeprecateVersionInput) => {
      try {
        await apiGovernanceApi.deprecateVersion(values.versionId, {
          replacementVersion: values.replacementVersion,
          retirementDate: values.retirementDate,
        });
        message.success('Version deprecated');
        setDeprecateModal(false);
        loadData();
      } catch {
        message.error('Failed to deprecate version');
      }
    },
    [loadData],
  );

  const handleRetireVersion = useCallback(
    async (versionId: string) => {
      try {
        await apiGovernanceApi.retireVersion(versionId);
        message.success('Version retired');
        loadData();
      } catch {
        message.error('Failed to retire version');
      }
    },
    [loadData],
  );

  const deprecatedCount = versions.filter((v) => v.status === 'deprecated').length;

  return {
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
  };
};
