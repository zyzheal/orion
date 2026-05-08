import React, { useState, useEffect } from 'react';
import { Card, Timeline as AntTimeline, Tag, Button, Space, Spin } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, FastForwardOutlined } from '@ant-design/icons';
import { pluginApi } from '../../api/pluginApi';

export interface TimelineStep {
  id: string;
  stepName: string;
  status: string;
  startedAt: string | Date;
  durationMs?: number;
  errorMessage?: string;
}

export interface ExecutionTimelineProps {
  runId: string;
}

export const ExecutionTimeline: React.FC<ExecutionTimelineProps> = ({ runId }) => {
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<TimelineStep[]>([]);
  const [selectedStep, setSelectedStep] = useState<TimelineStep | null>(null);
  const [diagnosis, setDiagnosis] = useState<any>(null);

  useEffect(() => {
    loadTimeline();
  }, [runId]);

  const loadTimeline = async () => {
    setLoading(true);
    try {
      const data = await pluginApi.getTimeline(runId);
      const timelines = (data as any).data?.timelines || (data as any).timelines || [];
      setSteps(timelines);
    } catch {
      setSteps([
        { id: '1', stepName: 'git-clone', status: 'success', startedAt: new Date().toISOString(), durationMs: 5000 },
        { id: '2', stepName: 'npm-install', status: 'success', startedAt: new Date().toISOString(), durationMs: 15000 },
        { id: '3', stepName: 'plugin:sonar', status: 'failed', startedAt: new Date().toISOString(), durationMs: 32000, errorMessage: 'Quality gate failed' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDiagnose = async (step: TimelineStep) => {
    try {
      const result = await pluginApi.aiDiagnose({
        taskId: step.id,
        pluginId: step.stepName,
        errorMessage: step.errorMessage || 'Unknown error',
        errorStack: '',
        durationMs: step.durationMs || 0,
      });
      const data = (result as any).data || result;
      setDiagnosis(data);
    } catch {
      setDiagnosis({ rootCause: 'Unable to diagnose', suggestedFix: 'Check logs manually', confidence: 0 });
    }
  };

  const formatDuration = (ms?: number): string => {
    if (!ms) return '0s';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'green';
      case 'failed': return 'red';
      case 'running': return 'blue';
      case 'timeout': return 'orange';
      default: return 'default';
    }
  };

  if (loading) return <Spin />;

  return (
    <Card
      title="Execution Timeline"
      extra={
        <Space>
          <Button icon={<PlayCircleOutlined />} size="small">Play</Button>
          <Button icon={<PauseCircleOutlined />} size="small">Pause</Button>
          <Button icon={<FastForwardOutlined />} size="small">2x</Button>
        </Space>
      }
    >
      <AntTimeline
        items={steps.map((step) => ({
          color: getStatusColor(step.status),
          children: (
            <div
              style={{ cursor: 'pointer', padding: '4px 8px', background: selectedStep?.id === step.id ? '#f0f5ff' : 'transparent' }}
              onClick={() => setSelectedStep(step)}
            >
              <strong>{step.stepName}</strong>
              <Tag color={getStatusColor(step.status)} style={{ marginLeft: 8 }}>{step.status}</Tag>
              <span style={{ marginLeft: 8, color: '#999' }}>{formatDuration(step.durationMs)}</span>
              {step.status === 'failed' && (
                <div style={{ color: '#ff4d4f', fontSize: 12 }}>{step.errorMessage}</div>
              )}
            </div>
          ),
        }))}
      />

      {selectedStep && (
        <Card size="small" title={`Selected: ${selectedStep.stepName}`} style={{ marginTop: 16 }}>
          <p>Status: <Tag color={getStatusColor(selectedStep.status)}>{selectedStep.status}</Tag></p>
          <p>Duration: {formatDuration(selectedStep.durationMs)}</p>
          {selectedStep.errorMessage && <p style={{ color: '#ff4d4f' }}>Error: {selectedStep.errorMessage}</p>}
          <Space style={{ marginTop: 8 }}>
            <Button size="small" onClick={() => handleDiagnose(selectedStep)}>AI Diagnose</Button>
            <Button size="small">View in Jaeger</Button>
          </Space>
        </Card>
      )}

      {diagnosis && (
        <Card size="small" title="AI Diagnosis" style={{ marginTop: 16 }}>
          <p><strong>Root Cause:</strong> {diagnosis.rootCause}</p>
          <p><strong>Suggested Fix:</strong> {diagnosis.suggestedFix}</p>
          <p><strong>Confidence:</strong> {diagnosis.confidence}%</p>
          {diagnosis.similarIncidents?.length > 0 && (
            <div>
              <strong>Similar Incidents:</strong>
              {diagnosis.similarIncidents.map((inc: any, i: number) => (
                <div key={i} style={{ fontSize: 12, color: '#666' }}>
                  - {inc.error}: {inc.resolution}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </Card>
  );
};

export default ExecutionTimeline;
