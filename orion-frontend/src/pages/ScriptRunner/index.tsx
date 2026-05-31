/**
 * Script Runner Page
 *
 * Phase 2.3: Standalone online script execution UI
 */
import React, { useState } from 'react';
import {
  Button,
  Form,
  Select,
  Input,
  Card,
  Typography,
  message,
  Space,
  Tag,
  Alert,
} from 'antd';
import { PlayCircleOutlined, SafetyOutlined, CodeOutlined } from '@ant-design/icons';
import { scanScript, executeScript, ScriptConfig, ScriptScanResult, ScriptExecutionResult, ScriptLanguage, ScriptLevel } from '@/api/scripts';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;
const { TextArea } = Input;

const ScriptRunnerPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScriptScanResult | null>(null);
  const [execResult, setExecResult] = useState<ScriptExecutionResult | null>(null);
  const [form] = Form.useForm<ScriptConfig>();

  const languageOptions: { label: string; value: ScriptLanguage }[] = [
    { label: 'JavaScript', value: 'javascript' },
    { label: 'TypeScript', value: 'typescript' },
    { label: 'Python', value: 'python' },
    { label: 'Shell', value: 'shell' },
  ];

  const levelOptions: { label: string; value: ScriptLevel }[] = [
    { label: '安全 (safe)', value: 'safe' },
    { label: '标准 (standard)', value: 'standard' },
    { label: '高级 (advanced)', value: 'advanced' },
  ];

  const handleScan = async () => {
    const values = form.getFieldsValue();
    if (!values.code) {
      message.warning('请先输入脚本代码');
      return;
    }

    setScanning(true);
    try {
      const res = await scanScript(values as ScriptConfig);
      setScanResult(res.data || null);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '扫描失败');
    } finally {
      setScanning(false);
    }
  };

  const handleExecute = async () => {
    const values = await form.validateFields();
    setLoading(true);
    setExecResult(null);

    try {
      const res = await executeScript(
        `task-${Date.now()}`,
        'manual-run',
        'standalone',
        values as ScriptConfig,
      );
      const data = res.data;
      setExecResult(data || null);
      if (data?.success) {
        message.success('执行成功');
      } else {
        message.error('执行失败');
      }
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '执行失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <CodeOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          在线脚本执行
        </Title>
        <Text type="secondary">在线编写、执行和安全扫描脚本代码</Text>
      </div>

      <Card title="脚本配置" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" initialValues={{ language: 'javascript', level: 'safe' }}>
          <Space style={{ marginBottom: 16 }} wrap>
            <Form.Item name="language" label="语言" style={{ marginBottom: 0, width: 160 }}>
              <Select options={languageOptions} />
            </Form.Item>
            <Form.Item name="level" label="安全级别" style={{ marginBottom: 0, width: 160 }}>
              <Select options={levelOptions} />
            </Form.Item>
          </Space>
          <Form.Item name="code" label="脚本代码" rules={[{ required: true, message: '请输入脚本代码' }]}>
            <TextArea
              rows={12}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
              placeholder="输入脚本代码..."
            />
          </Form.Item>
          <Space>
            <Button
              icon={<SafetyOutlined />}
              onClick={handleScan}
              loading={scanning}
            >
              安全扫描
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleExecute}
              loading={loading}
            >
              执行脚本
            </Button>
          </Space>
        </Form>
      </Card>

      {scanResult && (
        <Card title="安全扫描结果" style={{ marginBottom: 16 }}>
          <Space style={{ marginBottom: 12 }}>
            <Tag color={scanResult.passed ? 'success' : 'error'}>
              {scanResult.passed ? '通过' : '未通过'}
            </Tag>
            <Tag color={scanResult.riskScore > 70 ? 'error' : scanResult.riskScore > 40 ? 'warning' : 'success'}>
              风险评分: {scanResult.riskScore}
            </Tag>
          </Space>
          {scanResult.warnings.length > 0 && (
            <Alert
              type="warning"
              message="警告"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {scanResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              }
              style={{ marginBottom: 8 }}
            />
          )}
          {scanResult.errors.length > 0 && (
            <Alert
              type="error"
              message="错误"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {scanResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              }
            />
          )}
        </Card>
      )}

      {execResult && (
        <Card title="执行结果">
          <Space style={{ marginBottom: 12 }}>
            <Tag color={execResult.success ? 'success' : 'error'}>
              {execResult.success ? '执行成功' : '执行失败'}
            </Tag>
            <Tag>耗时: {execResult.durationMs}ms</Tag>
            <Tag>退出码: {execResult.exitCode}</Tag>
          </Space>
          {execResult.output && (
            <Card size="small" title="输出" style={{ background: colors.light?.bg?.secondary || colors.neutral[100] }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12 }}>
                {execResult.output}
              </pre>
            </Card>
          )}
          {execResult.error && (
            <Alert type="error" message="错误信息" description={execResult.error} style={{ marginTop: 12 }} />
          )}
        </Card>
      )}
    </div>
  );
};

export default ScriptRunnerPage;
