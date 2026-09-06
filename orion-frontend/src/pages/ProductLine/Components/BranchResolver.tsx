/**
 * BranchResolver.tsx - 分支环境解析工具
 * 抽取自 ProductLine/index.tsx (P2-9 Phase 95)
 */
import React, { useState } from 'react';
import {
  Card,
  Space,
  Select,
  Input,
  Button,
  message,
  Tag,
  Descriptions,
  Typography,
} from 'antd';
import { BranchesOutlined, SearchOutlined, FireOutlined } from '@ant-design/icons';
import {
  resolveEnvironment,
  requiresApproval,
  isHotfix,
  type ProductLine,
} from '@/api/product-lines';
import { spacing } from '@/tokens';

const { Text } = Typography;

interface BranchResolverProps {
  productLines: ProductLine[];
}

export const BranchResolver: React.FC<BranchResolverProps> = ({ productLines }) => {
  const [plId, setPlId] = useState<string>('');
  const [branch, setBranch] = useState('');
  const [result, setResult] = useState<{
    env?: string;
    needsApproval?: boolean;
    isHotfixBranch?: boolean;
  } | null>(null);

  const handleResolve = async () => {
    if (!plId || !branch) {
      message.warning('请选择产品线并输入分支名');
      return;
    }
    try {
      const [envRes, approvalRes, hotfixRes] = await Promise.all([
        resolveEnvironment(plId, branch).catch(() => null),
        requiresApproval(plId, branch).catch(() => null),
        isHotfix(plId, branch).catch(() => null),
      ]);
      setResult({
        env: envRes?.data ? String(envRes.data) : undefined,
        needsApproval: approvalRes?.data?.requiresApproval,
        isHotfixBranch: hotfixRes?.data?.isHotfix,
      });
    } catch (error: unknown) {
      // Try mock: find matching env mapping
      const pl = productLines.find((p) => p.id === plId);
      if (pl) {
        const mappings = pl.environmentMappings.mappings;
        let matchedEnv = pl.environmentMappings.defaultEnvironment;
        let needsApproval = true;
        for (const m of mappings) {
          if (m.patternType === 'exact' && m.branch === branch) {
            matchedEnv = m.environment;
            needsApproval = m.requireApproval ?? true;
            break;
          }
          if (m.patternType === 'glob') {
            const re = new RegExp('^' + m.branch.replace(/\*/g, '.*') + '$');
            if (re.test(branch)) {
              matchedEnv = m.environment;
              needsApproval = m.requireApproval ?? true;
              break;
            }
          }
        }
        const isHot =
          pl.branchPolicies.protectedBranches?.some((p) => p.pattern.startsWith('hotfix')) &&
          branch.startsWith('hotfix/');
        setResult({ env: matchedEnv, needsApproval, isHotfixBranch: isHot });
      }
    }
  };

  return (
    <Card
      size="small"
      title={
        <Space>
          <BranchesOutlined /> 分支环境解析工具
        </Space>
      }
      style={{ marginBottom: spacing.md }}
    >
      <Space wrap>
        <Select
          style={{ width: 200 }}
          placeholder="选择产品线"
          value={plId}
          onChange={setPlId}
          options={productLines.map((pl) => ({ label: pl.displayName, value: pl.id }))}
        />
        <Input
          placeholder="分支名称 (如: feature/xxx)"
          style={{ width: 240 }}
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          onPressEnter={handleResolve}
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={handleResolve}>
          解析
        </Button>
      </Space>
      {result && (
        <Descriptions size="small" style={{ marginTop: spacing[3] }} column={3} bordered>
          <Descriptions.Item label="目标环境">
            {result.env ? <Tag color="blue">{result.env}</Tag> : <Text type="secondary">未匹配</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="需要审批">
            {result.needsApproval !== undefined ? (
              result.needsApproval ? (
                <Tag color="orange">是</Tag>
              ) : (
                <Tag color="green">否</Tag>
              )
            ) : (
              <Text type="secondary">-</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Hotfix 分支">
            {result.isHotfixBranch !== undefined ? (
              result.isHotfixBranch ? (
                <Tag color="red">
                  <FireOutlined /> 是
                </Tag>
              ) : (
                <Tag>否</Tag>
              )
            ) : (
              <Text type="secondary">-</Text>
            )}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Card>
  );
};
