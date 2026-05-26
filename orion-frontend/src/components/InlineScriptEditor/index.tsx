import React, { useState } from 'react';
import { Button, Radio, Select, Input, Tag, message, Card, Space } from 'antd';

const { TextArea } = Input;

export type ScriptLevel = 'safe' | 'standard' | 'advanced';

export interface InlineScriptEditorProps {
  onAdd: (config: { level: ScriptLevel; language: string; code: string }) => void;
  onCancel: () => void;
}

export const InlineScriptEditor: React.FC<InlineScriptEditorProps> = ({ onAdd, onCancel }) => {
  const [level, setLevel] = useState<ScriptLevel>('safe');
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState('');
  const [scanResult, setScanResult] = useState<{ valid: boolean; violations: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<string>('');

  const handleScan = async () => {
    setLoading(true);
    try {
      // TODO: 对接 pluginApi.scanCode
      const result = {
        valid: true,
        violations: [] as string[],
      };
      setScanResult(result);
      if (data?.valid) {
        message.success('Security scan passed');
      } else {
        message.error(`Security violations: ${data?.violations?.join(', ') || 'Unknown'}`);
      }
    } catch {
      message.error('Scan failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDryRun = async () => {
    setLoading(true);
    try {
      // TODO: 对接 pluginApi.dryRun
      await new Promise((resolve) => setTimeout(resolve, 1000));
      message.success('Dry run passed');
    } catch {
      message.error('Dry run failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestApproval = async () => {
    try {
      // TODO: 对接 pluginApi.requestApproval
      const result = { status: 'pending' as string };
      setApprovalStatus(result.status);
      message.info('Approval request submitted');
    } catch {
      message.error('Failed to request approval');
    }
  };

  const handleAdd = () => {
    if (!code.trim()) {
      message.warning('Please enter script code');
      return;
    }
    onAdd({ level, language, code });
  };

  const quickTemplates = [
    { name: 'Parse JSON', code: "const config = await readJson('./config.json');\nreturn { version: config.version };" },
    { name: 'Filter Data', code: 'const items = await fetchData();\nreturn items.filter(i => i.active);' },
    { name: 'Transform', code: 'const data = await getData();\nreturn data.map(d => ({ ...d, processed: true }));' },
  ];

  return (
    <Card title="Inline Script Editor" size="small">
      <div style={{ marginBottom: 16 }}>
        <Space>
          <span>Level:</span>
          <Radio.Group value={level} onChange={(e) => setLevel(e.target.value)} buttonStyle="solid">
            <Radio.Button value="safe">Safe</Radio.Button>
            <Radio.Button value="standard">Standard</Radio.Button>
            <Radio.Button value="advanced">Advanced</Radio.Button>
          </Radio.Group>
        </Space>
        <Tag color={level === 'safe' ? 'green' : level === 'standard' ? 'blue' : 'red'} style={{ marginLeft: 8 }}>
          {level === 'safe' ? 'WASM' : level === 'standard' ? 'Process Pool' : 'Container (Approval Required)'}
        </Tag>
      </div>

      <div style={{ marginBottom: 16 }}>
        <span>Language: </span>
        <Select value={language} onChange={setLanguage} style={{ width: 150 }}>
          <Select.Option value="javascript">JavaScript</Select.Option>
          <Select.Option value="python">Python</Select.Option>
        </Select>
      </div>

      <TextArea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={8}
        style={{ fontFamily: 'monospace', fontSize: 13, marginBottom: 16 }}
        placeholder="Enter script code..."
      />

      {scanResult && (
        <div style={{ marginBottom: 16 }}>
          <strong>Security Scan: </strong>
          {scanResult.valid ? (
            <Tag color="green">No violations detected</Tag>
          ) : (
            <Tag color="red">{scanResult.violations?.join(', ')}</Tag>
          )}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <span>Quick Templates: </span>
        <Space>
          {quickTemplates.map((t) => (
            <Button key={t.name} size="small" onClick={() => setCode(t.code)}>
              {t.name}
            </Button>
          ))}
        </Space>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Button onClick={handleScan} loading={loading}>Security Scan</Button>
        <Button onClick={handleDryRun} loading={loading}>Dry Run Test</Button>
      </Space>

      {level === 'advanced' && (
        <Card size="small" title="Level 3 Approval" style={{ marginBottom: 16 }}>
          <Input.TextArea placeholder="Reason for requiring advanced access..." rows={2} style={{ marginBottom: 8 }} />
          <Button onClick={handleRequestApproval} disabled={!code.trim()}>
            Submit for Approval
          </Button>
          {approvalStatus && <Tag color="orange" style={{ marginLeft: 8 }}>Status: {approvalStatus}</Tag>}
        </Card>
      )}

      <Space>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" onClick={handleAdd} disabled={!code.trim()}>
          Add to Pipeline
        </Button>
      </Space>
    </Card>
  );
};

export default InlineScriptEditor;
