import React from 'react';
import { Row, Col } from 'antd';
import { spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import { useContractTestState } from './useContractTestState';
import { PageHeader } from './Components/PageHeader';
import { StatsRow } from './Components/StatsRow';
import { PactInfoAlert } from './Components/PactInfo';
import { ContractsTable } from './Components/ContractsTable';
import { DriftPanel } from './Components/DriftPanel';
import { DetailModal } from './Components/DetailModal';

const ContractTestPage: React.FC = () => {
  const {
    selected, setSelected, verifying, loading,
    safeContracts, stats, load, handleVerify, columns,
  } = useContractTestState();

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader />
      {loading ? (
        <PageSkeleton rows={6} />
      ) : (
        <>
          <StatsRow stats={stats} />
          <PactInfoAlert />
          <Row gutter={[spacing.md, spacing.md]}>
            <Col span={16}>
              <ContractsTable contracts={safeContracts} columns={columns} load={load} />
            </Col>
            <Col span={8}>
              <DriftPanel />
            </Col>
          </Row>
        </>
      )}
      <DetailModal
        selected={selected}
        verifying={verifying}
        handleVerify={handleVerify}
        setSelected={setSelected}
      />
    </div>
  );
};

export default ContractTestPage;
