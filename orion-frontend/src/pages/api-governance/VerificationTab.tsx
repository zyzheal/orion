/**
 * VerificationTab.tsx - Verification History Tab
 * 抽取自 ApiGovernancePage.tsx (P2-9 Phase 48)
 */
import React from 'react';
import { Card, Descriptions, Tag } from 'antd';
import { colors, spacing } from '@/tokens';
import type { VerificationResult } from './useApiGovernanceState';

export interface VerificationTabProps {
  verificationResults: VerificationResult[];
}

export const VerificationTab: React.FC<VerificationTabProps> = ({ verificationResults }) => (
  <Card title="Contract Verification History">
    {verificationResults.length === 0 ? (
      <p style={{ color: colors.neutral[500] }}>
        No verification results yet. Use the Verify button on a contract to start.
      </p>
    ) : (
      verificationResults.map((result, idx) => (
        <Card key={String(idx)} size="small" style={{ marginBottom: spacing.sm }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="Contract">
              {result.contractId.slice(0, 16)}...
            </Descriptions.Item>
            <Descriptions.Item label="Result">
              <Tag color={result.passed ? 'green' : 'red'}>
                {result.passed ? 'Passed' : 'Failed'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Endpoint">
              {result.method} {result.endpoint}
            </Descriptions.Item>
            <Descriptions.Item label="Verified At">
              {new Date(result.verifiedAt).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
          {result.violations.length > 0 && (
            <div style={{ marginTop: spacing.sm }}>
              <strong>Violations:</strong>
              <ul>
                {result.violations.map((v, i) => (
                  <li key={String(i)}>{v}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      ))
    )}
  </Card>
);

export default VerificationTab;
