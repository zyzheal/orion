/**
 * StageModal 组件测试
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StageModal from '../StageModal';
import type { StageConfig } from '../types';

const defaultProps = {
  visible: true,
  stage: null as StageConfig | null,
  availableDependencies: [
    { label: 'Build', value: 'stage-1' },
    { label: 'Test', value: 'stage-2' },
  ],
  onSave: vi.fn(),
  onCancel: vi.fn(),
};

describe('StageModal', () => {
  it('renders timeout config tab', () => {
    render(<StageModal {...defaultProps} />);

    // 点击"超时策略配置" Tab/区域
    const timeoutTab = screen.getByText(/超时策略配置/);
    expect(timeoutTab).toBeInTheDocument();
  });

  it('renders approval config tab', () => {
    render(<StageModal {...defaultProps} />);

    // 点击"审批配置" Tab/区域
    const approvalTab = screen.getByText(/审批配置/);
    expect(approvalTab).toBeInTheDocument();
  });

  it('renders quality gate config tab', () => {
    render(<StageModal {...defaultProps} />);

    // 点击"质量门禁配置" Tab/区域
    const qualityGateTab = screen.getByText(/质量门禁配置/);
    expect(qualityGateTab).toBeInTheDocument();
  });

  it('shows timeout switch when clicking timeout config', () => {
    render(<StageModal {...defaultProps} />);

    const timeoutSection = screen.getByText(/超时策略配置/);
    fireEvent.click(timeoutSection);

    // 验证开关存在
    expect(screen.getByText(/启用超时策略/)).toBeInTheDocument();
  });

  it('shows approval switch when clicking approval config', () => {
    render(<StageModal {...defaultProps} />);

    const approvalSection = screen.getByText(/审批配置/);
    fireEvent.click(approvalSection);

    // 验证开关存在
    expect(screen.getByText(/启用审批/)).toBeInTheDocument();
  });

  it('shows quality gate switch when clicking quality gate config', () => {
    render(<StageModal {...defaultProps} />);

    const qualityGateSection = screen.getByText(/质量门禁配置/);
    fireEvent.click(qualityGateSection);

    // 验证开关存在
    expect(screen.getByText(/启用质量门禁/)).toBeInTheDocument();
  });

  it('loads existing timeout config when editing stage', () => {
    const stageWithTimeout: StageConfig = {
      id: 'test-stage',
      name: 'Test Stage',
      type: 'build',
      timeoutConfig: {
        enabled: true,
        duration: 600,
        action: 'fail',
        retryCount: 2,
      },
    };

    render(<StageModal {...defaultProps} stage={stageWithTimeout} visible={true} />);

    const timeoutSection = screen.getByText(/超时策略配置/);
    fireEvent.click(timeoutSection);

    // 验证已启用
    expect(screen.getByText(/启用超时策略/)).toBeInTheDocument();
  });

  it('loads existing approval config when editing stage', () => {
    const stageWithApproval: StageConfig = {
      id: 'test-stage',
      name: 'Test Stage',
      type: 'deploy',
      approvalConfig: {
        enabled: true,
        approvers: ['admin', 'tech-lead'],
        mode: 'any',
        timeout: 24,
        timeoutAction: 'approve',
      },
    };

    render(<StageModal {...defaultProps} stage={stageWithApproval} visible={true} />);

    const approvalSection = screen.getByText(/审批配置/);
    fireEvent.click(approvalSection);

    // 验证已启用
    expect(screen.getByText(/启用审批/)).toBeInTheDocument();
  });

  it('loads existing quality gate config when editing stage', () => {
    const stageWithQualityGate: StageConfig = {
      id: 'test-stage',
      name: 'Test Stage',
      type: 'test',
      qualityGateConfig: {
        enabled: true,
        rules: [
          { id: 'rule-1', metric: 'test_pass_rate', operator: '>=', threshold: 95 },
        ],
        failureAction: 'block',
      },
    };

    render(<StageModal {...defaultProps} stage={stageWithQualityGate} visible={true} />);

    const qualityGateSection = screen.getByText(/质量门禁配置/);
    fireEvent.click(qualityGateSection);

    // 验证已启用
    expect(screen.getByText(/启用质量门禁/)).toBeInTheDocument();
  });

  it('shows disabled state hint when timeout config is disabled', () => {
    render(<StageModal {...defaultProps} visible={true} />);

    const timeoutSection = screen.getByText(/超时策略配置/);
    fireEvent.click(timeoutSection);

    // 验证禁用状态提示存在
    expect(screen.getByText(/启用后可配置超时时长和超时后的动作/)).toBeInTheDocument();
  });

  it('shows disabled state hint when approval config is disabled', () => {
    render(<StageModal {...defaultProps} visible={true} />);

    const approvalSection = screen.getByText(/审批配置/);
    fireEvent.click(approvalSection);

    // 验证禁用状态提示存在
    expect(screen.getByText(/启用后可配置审批人、审批模式和超时处理策略/)).toBeInTheDocument();
  });
});