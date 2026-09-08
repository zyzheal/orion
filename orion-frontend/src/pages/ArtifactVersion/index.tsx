/**
 * Artifact Version Management Page
 * Version listing, traceability, comparison, and deployment history
 *
 * 拆分自 index.tsx (P2-9 Phase 210)
 * - useArtifactVersionState.ts: state + loadVersions + handlers
 * - columns.tsx: buildArtifactVersionColumns
 * - Components/PageHeader.tsx: title + back + refresh
 * - Components/StatsCard.tsx: 4 stat cards
 * - Components/DetailModal.tsx: modal + descriptions + timeline
 */
import { Table } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useArtifactVersionState } from './useArtifactVersionState';
import { buildArtifactVersionColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { StatsCard } from './Components/StatsCard';
import { DetailModal } from './Components/DetailModal';

const ArtifactVersionPage = () => {
  const navigate = useNavigate();
  const {
    loading,
    versions,
    total,
    page,
    setPage,
    pageSize,
    detailVisible,
    chain,
    selectedVersion,
    loadVersions,
    showDetail,
    handleDeploy,
    handleCloseDetail,
  } = useArtifactVersionState();

  const columns = buildArtifactVersionColumns(showDetail, handleDeploy);

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        total={total}
        loading={loading}
        onBack={() => navigate('/artifacts')}
        onRefresh={loadVersions}
      />

      <StatsCard versions={versions} total={total} />

      <Table
        columns={columns}
        dataSource={versions}
        loading={loading}
        rowKey="id"
        size="middle"
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p) => setPage(p),
        }}
      />

      <DetailModal
        open={detailVisible}
        selectedVersion={selectedVersion}
        chain={chain}
        onClose={handleCloseDetail}
      />
    </div>
  );
};

export default ArtifactVersionPage;
