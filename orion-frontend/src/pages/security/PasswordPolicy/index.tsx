/**
 * Password Policy Configurable Page
 * 密码策略可配置页面 - P4-08
 * 纯前端 Mock 数据，包含密码策略配置、强度测试器、密码历史
 *
 * 拆分 (P2-9 Phase 144): helpers / usePasswordPolicyState / historyColumns / Components/*
 */
import React from 'react';
import { Col, Row } from 'antd';
import { spacing } from '@/tokens';
import { usePasswordPolicyState } from './usePasswordPolicyState';
import { PasswordPolicyHeader } from './Components/PasswordPolicyHeader';
import { PolicyConfigForm } from './Components/PolicyConfigForm';
import { StrengthTester } from './Components/StrengthTester';
import { HistoryTable } from './Components/HistoryTable';

const PasswordPolicyPage: React.FC = () => {
  const state = usePasswordPolicyState();

  return (
    <div>
      <PasswordPolicyHeader />
      <Row gutter={[spacing.lg, spacing.lg]}>
        <Col span={14}>
          <PolicyConfigForm form={state.form} />
        </Col>
        <Col span={10}>
          <StrengthTester
            testPassword={state.testPassword}
            onTestPasswordChange={state.setTestPassword}
            strength={state.strength}
            checkItems={state.checkItems}
          />
        </Col>
      </Row>
      <HistoryTable />
    </div>
  );
};

export default PasswordPolicyPage;
