/**
 * Digital Twin Page
 * Phase 4 - Production snapshot and traffic replay
 *
 * P2-9 Phase 244 拆分:
 * - useDigitalTwinState.ts: state + loadData + 3 handlers
 * - Columns.tsx: buildSnapshotColumns + buildRecordingColumns
 * - Components/TabsContent.tsx: 两个 Tab 内容
 * - Components/Modals.tsx: Create Snapshot + Start Recording 两个 Modal
 */
import { spacing } from '@/tokens';
import { useDigitalTwinState } from './useDigitalTwinState';
import { TabsContent } from './Components/TabsContent';
import { Modals } from './Components/Modals';

const DigitalTwin: React.FC = () => {
  const {
    snapshots, recordings, loading,
    snapshotModal, setSnapshotModal,
    recordingModal, setRecordingModal,
    form,
    handleCreateSnapshot,
    handleStartRecording,
    handleStopRecording,
  } = useDigitalTwinState();

  return (
    <div style={{ padding: spacing.lg }}>
      <TabsContent
        snapshots={snapshots}
        recordings={recordings}
        loading={loading}
        onOpenSnapshotModal={() => setSnapshotModal(true)}
        onOpenRecordingModal={() => setRecordingModal(true)}
        onStopRecording={handleStopRecording}
      />

      <Modals
        snapshotModal={snapshotModal}
        setSnapshotModal={setSnapshotModal}
        recordingModal={recordingModal}
        setRecordingModal={setRecordingModal}
        form={form}
        handleCreateSnapshot={handleCreateSnapshot}
        handleStartRecording={handleStartRecording}
      />
    </div>
  );
};

export default DigitalTwin;
