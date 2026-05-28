import React, { useState, useEffect } from 'react';
import { Card, Timeline as AntTimeline, Tag, Button, Space, Spin } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, FastForwardOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';

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
  const [diagnosis, setDiagnosis] = useState<{ rootCause: string; suggestedFix: string; confidence: number } | null>(null);

  useEffect(() => {
    loadTimeline();
  }, [runId]);

  const loadTimeline = async () => {
    setLoading(true);
    try {
      // TODO: 对接 pluginApi.getTimeline(runId)
      // 临时使用 mock 数据
      setSteps([
        { id: '1', stepName: 'git-clone', status: 'success', startedAt: new Date().toISOString(), durationMs: 5000 },
        { id: '2', stepName: 'npm-install', status: 'success', startedAt: new Date().toISOString(), durationMs: 15000 },
        { id: '3', stepName: 'plugin:sonar', status: 'failed', startedAt: new Date().toISOString(), durationMs: 32000, errorMessage: 'Quality gate failed' },
      ]);
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
      // TODO: 对接 pluginApi.aiDiagnose
      const result = {
        rootCause: 'Simulated diagnosis result',
        suggestedFix: 'Check logs manually',
        confidence: 0.8,
      };
      setDiagnosis(result);
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
              style={{ cursor: 'pointer', padding: '4px 8px', background: selectedStep?.id === step.id ? 'colors.primary[50]' : 'transparent' }}
              onClick={() => setSelectedStep(step)}
            >
              <strong>{step.stepName}</strong>
              <Tag color={getStatusColor(step.status)} style={{ marginLeft: 8 }}>{step.status}</Tag>
              <span style={{ marginLeft: 8, color: colors.neutral[500] }}>{formatDuration(step.durationMs)}</span>
            </div>
          ),
        }))}
      />
      {selectedStep && (
        <div style={{ marginTop: 16 }}>
          <h4>Step Details</h4>
          <p><strong>Name:</strong> {selectedStep.stepName}</p>
          <p><strong>Status:</strong> {selectedStep.status}</p>
          <p><strong>Started At:</strong> {new Date(selectedStep.startedAt).toLocaleString()}</p>
          {selectedStep.durationMs && <p><strong>Duration:</strong> {formatDuration(selectedStep.durationMs)}</p>}
          {selectedStep.errorMessage && <p><strong>Error:</strong> {selectedStep.errorMessage}</p>}
          {diagnosis && (
            <div style={{ marginTop: 8, padding: 8, background: colors.primary[50], borderRadius: 4 }}>
              <h5>AI Diagnosis</h5>
              <p><strong>Root Cause:</strong> {diagnosis.rootCause}</p>
              <p><strong>Suggested Fix:</strong> {diagnosis.suggestedFix}</p>
              {diagnosis.confidence !== undefined && <p><strong>Confidence:</strong> {(diagnosis.confidence * 100).toFixed(0)}%</p>}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
