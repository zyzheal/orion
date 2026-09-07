/**
 * Script Version Management Page
 * Script content version tracking with diff comparison
 *
 * 拆分自 index.tsx (P2-9 Phase 187)
 */
import { useMemo } from 'react';
import { useScriptVersionsState } from './useScriptVersionsState';
import { buildVersionColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { VersionTable } from './Components/VersionTable';
import { CreateVersionModal } from './Components/CreateVersionModal';
import { DiffModal } from './Components/DiffModal';

const ScriptVersionsPage = () => {
  const {
    loading,
    scriptId,
    versions,
    modalVisible,
    diffVisible,
    diffData,
    diffV1,
    diffV2,
    form,
    versionList,
    setScriptId,
    setDiffV1,
    setDiffV2,
    loadVersions,
    handleCreate,
    handleDelete,
    handleSubmit,
    handleDiff,
    openDiff,
    closeCreate,
    closeDiff,
  } = useScriptVersionsState();

  const columns = useMemo(() => buildVersionColumns({ onDelete: handleDelete }), [handleDelete]);

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        scriptId={scriptId}
        loading={loading}
        onScriptIdChange={setScriptId}
        onSearch={loadVersions}
        onCreate={handleCreate}
        onDiff={openDiff}
        onRefresh={loadVersions}
      />

      <VersionTable columns={columns} versions={versions} loading={loading} onCreate={handleCreate} />

      <CreateVersionModal form={form} open={modalVisible} onSubmit={handleSubmit} onClose={closeCreate} />

      <DiffModal
        scriptId={scriptId}
        open={diffVisible}
        diffV1={diffV1}
        diffV2={diffV2}
        diffData={diffData}
        versionList={versionList}
        onV1Change={setDiffV1}
        onV2Change={setDiffV2}
        onDiff={handleDiff}
        onClose={closeDiff}
      />
    </div>
  );
};

export default ScriptVersionsPage;
