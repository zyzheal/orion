/**
 * useDigitalTwinState.ts - Digital Twin 状态 Hook
 * 抽取自 index.tsx (P2-9 Phase 244)
 */
import { useState, useEffect } from 'react';
import { Form, message } from 'antd';
import { digitalTwinApi, TwinSnapshot, TrafficRecording } from '@/api/digital-twin';

export function useDigitalTwinState() {
  const [snapshots, setSnapshots] = useState<TwinSnapshot[]>([]);
  const [recordings, setRecordings] = useState<TrafficRecording[]>([]);
  const [loading, setLoading] = useState(false);
  const [snapshotModal, setSnapshotModal] = useState(false);
  const [recordingModal, setRecordingModal] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [snapRes, recRes] = await Promise.all([
        digitalTwinApi.listSnapshots(),
        digitalTwinApi.listRecordings(),
      ]);
      setSnapshots(snapRes || []);
      setRecordings(recRes || []);
    } catch {
      message.error('Failed to load data');
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateSnapshot = async (values: Record<string, unknown>) => {
    try {
      await digitalTwinApi.createSnapshot(values as { environment: string; note?: string });
      message.success('Snapshot creation started');
      setSnapshotModal(false);
      await loadData();
    } catch {
      message.error('Failed to create snapshot');
    }
  };

  const handleStartRecording = async (values: Record<string, unknown>) => {
    try {
      await digitalTwinApi.startRecording(values as { source_env: string; path_prefixes?: string[] });
      message.success('Recording started');
      setRecordingModal(false);
      await loadData();
    } catch {
      message.error('Failed to start recording');
    }
  };

  const handleStopRecording = async (recordingId: string) => {
    try {
      await digitalTwinApi.stopRecording(recordingId);
      message.success('Recording stopped');
      await loadData();
    } catch {
      message.error('Failed to stop recording');
    }
  };

  return {
    snapshots,
    recordings,
    loading,
    snapshotModal, setSnapshotModal,
    recordingModal, setRecordingModal,
    form,
    handleCreateSnapshot,
    handleStartRecording,
    handleStopRecording,
  };
}
