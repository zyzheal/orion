/**
 * PR/MR Trigger Configuration Component
 * Supports GitHub PR and GitLab MR trigger rules with path filtering,
 * branch filtering, label filtering, and draft PR policies.
 */
import React, { useState, useEffect } from 'react';
import {
  Select,
  Switch,
  Input,
  Space,
  Tag,
  Card,
  Divider,
  Alert,
} from 'antd';
import {
  GitlabOutlined,
  GithubOutlined,
  FilterOutlined,
  BranchesOutlined,
  TagOutlined,
  FileProtectOutlined,
} from '@ant-design/icons';

const { TextArea } = Input;

interface SecurityLevelOption {
  label: string;
  value: 'safe' | 'trusted' | 'full';
  description: string;
}

export interface PRTriggerConfig {
  enabled: boolean;
  provider: 'github' | 'gitlab' | 'both';
  prActions: string[];
  branchFilter: {
    targetBranches: string[];
    sourceBranches?: string[];
  };
  pathFilter: {
    includePaths: string[];
    excludePaths: string[];
  };
  labelFilter: {
    requiredLabels: string[];
    excludedLabels: string[];
  };
  draftPolicy: 'skip' | 'run';
  securityLevel: 'safe' | 'trusted' | 'full';
  statusCheckName?: string;
  autoComment: boolean;
  commentTemplate?: string;
}

interface PRTriggerConfigProps {
  value?: Partial<PRTriggerConfig>;
  onChange?: (config: PRTriggerConfig) => void;
}

const defaultConfig: PRTriggerConfig = {
  enabled: false,
  provider: 'github',
  prActions: ['opened', 'synchronize'],
  branchFilter: {
    targetBranches: ['main', 'master', 'develop'],
    sourceBranches: [],
  },
  pathFilter: {
    includePaths: [],
    excludePaths: ['docs/**', '*.md'],
  },
  labelFilter: {
    requiredLabels: [],
    excludedLabels: ['wip', 'do-not-merge'],
  },
  draftPolicy: 'skip',
  securityLevel: 'safe',
  statusCheckName: 'orion-ci',
  autoComment: false,
  commentTemplate:
    '### Orion CI 检查结果\n\nPipeline: {{pipelineName}}\n状态: {{status}}\n详情: {{url}}',
};

const securityLevelOptions: SecurityLevelOption[] = [
  {
    label: 'Safe（安全模式）',
    value: 'safe',
    description: '使用 fork 基础权限，不注入 secrets - 适合开源项目',
  },
  {
    label: 'Trusted（信任模式）',
    value: 'trusted',
    description: '使用目标分支权限，可注入只读 secrets - 适合内部项目',
  },
  {
    label: 'Full（完全模式）',
    value: 'full',
    description: '使用完整权限，等同 push 触发 - 仅限私有仓库',
  },
];

const PRTriggerConfig: React.FC<PRTriggerConfigProps> = ({ value, onChange }) => {
  const [config, setConfig] = useState<PRTriggerConfig>({ ...defaultConfig, ...value });

  // C1: 同步外部 value 变化
  useEffect(() => {
    if (value) {
      setConfig((prev) => ({ ...prev, ...value }));
    }
  }, [value]);

  const updateConfig = (updates: Partial<PRTriggerConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onChange?.(newConfig);
  };

  const addToList = (key: keyof PRTriggerConfig['branchFilter'] | keyof PRTriggerConfig['pathFilter'] | keyof PRTriggerConfig['labelFilter'], item: string) => {
    if (!item.trim()) return;

    if (key === 'targetBranches' || key === 'sourceBranches') {
      const current = config.branchFilter[key] || [];
      updateConfig({
        branchFilter: { ...config.branchFilter, [key]: [...current, item.trim()] },
      });
    } else if (key === 'includePaths' || key === 'excludePaths') {
      const current = config.pathFilter[key] || [];
      updateConfig({
        pathFilter: { ...config.pathFilter, [key]: [...current, item.trim()] },
      });
    } else if (key === 'requiredLabels' || key === 'excludedLabels') {
      const current = config.labelFilter[key] || [];
      updateConfig({
        labelFilter: { ...config.labelFilter, [key]: [...current, item.trim()] },
      });
    }
  };

  const removeFromList = (
    key: keyof PRTriggerConfig['branchFilter'] | keyof PRTriggerConfig['pathFilter'] | keyof PRTriggerConfig['labelFilter'],
    index: number
  ) => {
    if (key === 'targetBranches' || key === 'sourceBranches') {
      const current = config.branchFilter[key] || [];
      updateConfig({
        branchFilter: { ...config.branchFilter, [key]: current.filter((_, i) => i !== index) },
      });
    } else if (key === 'includePaths' || key === 'excludePaths') {
      const current = config.pathFilter[key] || [];
      updateConfig({
        pathFilter: { ...config.pathFilter, [key]: current.filter((_, i) => i !== index) },
      });
    } else if (key === 'requiredLabels' || key === 'excludedLabels') {
      const current = config.labelFilter[key] || [];
      updateConfig({
        labelFilter: { ...config.labelFilter, [key]: current.filter((_, i) => i !== index) },
      });
    }
  };

  const providerIcon = config.provider === 'github' ? <GithubOutlined /> : config.provider === 'gitlab' ? <GitlabOutlined /> : <><GithubOutlined /> <GitlabOutlined /></>;

  return (
    <Card size="small" title={<Space>{providerIcon} PR/MR 触发配置</Space>}>
      {/* 基础开关 */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ marginRight: 8 }}>启用 PR/MR 触发</span>
        <Switch
          checked={config.enabled}
          onChange={(checked) => updateConfig({ enabled: checked })}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      </div>

      {config.enabled && (
        <>
          {/* 代码托管平台 */}
          <Divider orientation="left" orientationMargin={0}>
            <Space><GithubOutlined /> 代码托管平台</Space>
          </Divider>

          <Form.Item label="支持平台">
            <Select
              value={config.provider}
              onChange={(v) => updateConfig({ provider: v })}
              options={[
                { label: 'GitHub Pull Request', value: 'github' },
                { label: 'GitLab Merge Request', value: 'gitlab' },
                { label: '两者都支持', value: 'both' },
              ]}
            />
          </Form.Item>

          {/* 安全模型 */}
          <Form.Item
            label="安全级别"
            tooltip="决定 PR 触发时的权限级别和 secrets 注入策略"
          >
            <Select
              value={config.securityLevel}
              onChange={(v) => updateConfig({ securityLevel: v })}
              options={securityLevelOptions}
              optionRender={(option) => {
                const data = option.data as SecurityLevelOption;
                return (
                  <Space direction="vertical" size={0}>
                    <span>{option.label}</span>
                    <span style={{ fontSize: 12, color: '#999' }}>{data.description}</span>
                  </Space>
                );
              }}
            />
          </Form.Item>

          {/* PR 动作过滤 */}
          <Divider orientation="left" orientationMargin={0}>
            <Space><FileProtectOutlined /> 触发事件</Space>
          </Divider>

          <Form.Item label="PR 动作" tooltip="哪些 PR 动作会触发 Pipeline">
            <Select
              mode="multiple"
              value={config.prActions}
              onChange={(v) => updateConfig({ prActions: v })}
              options={[
                { label: 'opened - PR 创建', value: 'opened' },
                { label: 'synchronize - 代码更新', value: 'synchronize' },
                { label: 'reopened - PR 重新打开', value: 'reopened' },
                { label: 'labeled - 标签变更', value: 'labeled' },
                { label: 'ready_for_review - 草稿转就绪', value: 'ready_for_review' },
              ]}
            />
          </Form.Item>

          <Form.Item label="Draft PR 策略">
            <Select
              value={config.draftPolicy}
              onChange={(v) => updateConfig({ draftPolicy: v })}
              options={[
                { label: '跳过 Draft PR', value: 'skip' },
                { label: '运行 Draft PR', value: 'run' },
              ]}
            />
          </Form.Item>

          {/* 分支过滤 */}
          <Divider orientation="left" orientationMargin={0}>
            <Space><BranchesOutlined /> 分支过滤</Space>
          </Divider>

          <Form.Item label="目标分支">
            <Space style={{ width: '100%' }}>
              <Input
                placeholder="输入分支名后回车添加"
                onPressEnter={(e) => {
                  const input = e.target as HTMLInputElement;
                  addToList('targetBranches', input.value);
                  input.value = '';
                }}
                style={{ flex: 1 }}
              />
            </Space>
            <div style={{ marginTop: 8 }}>
              {config.branchFilter.targetBranches.map((branch, index) => (
                <Tag
                  key={`target-${branch}-${index}`}
                  color="blue"
                  closable
                  onClose={() => removeFromList('targetBranches', index)}
                  style={{ marginBottom: 4 }}
                >
                  {branch}
                </Tag>
              ))}
              {config.branchFilter.targetBranches.length === 0 && (
                <span style={{ color: '#999', fontSize: 12 }}>未配置，将匹配所有分支</span>
              )}
            </div>
          </Form.Item>

          <Form.Item label="来源分支（可选）">
            <Space style={{ width: '100%' }}>
              <Input
                placeholder="输入分支名后回车添加"
                onPressEnter={(e) => {
                  const input = e.target as HTMLInputElement;
                  addToList('sourceBranches', input.value);
                  input.value = '';
                }}
                style={{ flex: 1 }}
              />
            </Space>
            <div style={{ marginTop: 8 }}>
              {config.branchFilter.sourceBranches?.map((branch, index) => (
                <Tag
                  key={`source-${branch}-${index}`}
                  color="green"
                  closable
                  onClose={() => removeFromList('sourceBranches', index)}
                  style={{ marginBottom: 4 }}
                >
                  {branch}
                </Tag>
              ))}
              {(!config.branchFilter.sourceBranches || config.branchFilter.sourceBranches.length === 0) && (
                <span style={{ color: '#999', fontSize: 12 }}>未配置，将匹配所有来源分支</span>
              )}
            </div>
          </Form.Item>

          {/* 路径过滤 */}
          <Divider orientation="left" orientationMargin={0}>
            <Space><FilterOutlined /> 路径过滤</Space>
          </Divider>

          <Alert
            type="info"
            message="路径过滤使用 glob 模式"
            description="例如：src/** 匹配 src 目录下所有文件，*.md 匹配所有 markdown 文件，!docs/** 排除 docs 目录"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item label="包含路径">
            <Space style={{ width: '100%' }}>
              <Input
                placeholder="输入路径模式后回车添加"
                onPressEnter={(e) => {
                  const input = e.target as HTMLInputElement;
                  addToList('includePaths', input.value);
                  input.value = '';
                }}
                style={{ flex: 1 }}
              />
            </Space>
            <div style={{ marginTop: 8 }}>
              {config.pathFilter.includePaths.map((path, index) => (
                <Tag
                  key={`include-${path}-${index}`}
                  color="blue"
                  closable
                  onClose={() => removeFromList('includePaths', index)}
                  style={{ marginBottom: 4 }}
                >
                  {path}
                </Tag>
              ))}
              {config.pathFilter.includePaths.length === 0 && (
                <span style={{ color: '#999', fontSize: 12 }}>未配置，将匹配所有文件变更</span>
              )}
            </div>
          </Form.Item>

          <Form.Item label="排除路径">
            <Space style={{ width: '100%' }}>
              <Input
                placeholder="输入路径模式后回车添加"
                onPressEnter={(e) => {
                  const input = e.target as HTMLInputElement;
                  addToList('excludePaths', input.value);
                  input.value = '';
                }}
                style={{ flex: 1 }}
              />
            </Space>
            <div style={{ marginTop: 8 }}>
              {config.pathFilter.excludePaths.map((path, index) => (
                <Tag
                  key={`exclude-${path}-${index}`}
                  color="red"
                  closable
                  onClose={() => removeFromList('excludePaths', index)}
                  style={{ marginBottom: 4 }}
                >
                  {path}
                </Tag>
              ))}
            </div>
          </Form.Item>

          {/* 标签过滤 */}
          <Divider orientation="left" orientationMargin={0}>
            <Space><TagOutlined /> 标签过滤</Space>
          </Divider>

          <Form.Item label="必须包含的标签">
            <Space style={{ width: '100%' }}>
              <Input
                placeholder="输入标签后回车添加"
                onPressEnter={(e) => {
                  const input = e.target as HTMLInputElement;
                  addToList('requiredLabels', input.value);
                  input.value = '';
                }}
                style={{ flex: 1 }}
              />
            </Space>
            <div style={{ marginTop: 8 }}>
              {config.labelFilter.requiredLabels.map((label, index) => (
                <Tag
                  key={`required-${label}-${index}`}
                  color="blue"
                  closable
                  onClose={() => removeFromList('requiredLabels', index)}
                  style={{ marginBottom: 4 }}
                >
                  {label}
                </Tag>
              ))}
              {config.labelFilter.requiredLabels.length === 0 && (
                <span style={{ color: '#999', fontSize: 12 }}>未配置，不限制标签</span>
              )}
            </div>
          </Form.Item>

          <Form.Item label="排除的标签">
            <Space style={{ width: '100%' }}>
              <Input
                placeholder="输入标签后回车添加"
                onPressEnter={(e) => {
                  const input = e.target as HTMLInputElement;
                  addToList('excludedLabels', input.value);
                  input.value = '';
                }}
                style={{ flex: 1 }}
              />
            </Space>
            <div style={{ marginTop: 8 }}>
              {config.labelFilter.excludedLabels.map((label, index) => (
                <Tag
                  key={`excluded-${label}-${index}`}
                  color="red"
                  closable
                  onClose={() => removeFromList('excludedLabels', index)}
                  style={{ marginBottom: 4 }}
                >
                  {label}
                </Tag>
              ))}
            </div>
          </Form.Item>

          {/* 状态回写 */}
          <Divider orientation="left" orientationMargin={0}>
            <Space><FileProtectOutlined /> 状态回写</Space>
          </Divider>

          <Form.Item label="状态检查名称" tooltip="在 PR 页面显示的检查名称">
            <Input
              value={config.statusCheckName}
              onChange={(e) => updateConfig({ statusCheckName: e.target.value })}
              placeholder="orion-ci"
            />
          </Form.Item>

          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ marginRight: 8 }}>自动评论</span>
            <Switch
              checked={config.autoComment}
              onChange={(checked) => updateConfig({ autoComment: checked })}
              checkedChildren="启用"
              unCheckedChildren="禁用"
            />
          </div>

          {config.autoComment && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8 }}>评论模板</div>
              <TextArea
                value={config.commentTemplate}
                onChange={(e) => updateConfig({ commentTemplate: e.target.value })}
                maxLength={2000}
                showCount
                rows={4}
                style={{ fontFamily: 'monospace' }}
                placeholder={`可用的变量：
{{pipelineName}} - Pipeline 名称
{{status}} - 执行状态
{{url}} - 详情链接
{{duration}} - 执行耗时
{{passRate}} - 测试通过率`}
              />
            </Form.Item>
          )}
        </>
      )}
    </Card>
  );
};

export default PRTriggerConfig;
