/**
 * PRTriggerManagement Page Tests
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PRTriggerManagement from '../index';

// Mock the API calls
jest.mock('@/api/prTriggers', () => ({
  getPRTriggerRules: jest.fn().mockResolvedValue({ data: [] }),
  createPRTrigger: jest.fn().mockResolvedValue({ data: {} }),
  updatePRTrigger: jest.fn().mockResolvedValue({ data: {} }),
  deletePRTrigger: jest.fn().mockResolvedValue({ data: {} }),
}));

jest.mock('@/api/pipelines', () => ({
  getPipelines: jest.fn().mockResolvedValue({ data: [] }),
}));

describe('PRTriggerManagement', () => {
  it('renders the page header', () => {
    render(<PRTriggerManagement />);
    expect(screen.getByText('PR/MR 触发管理')).toBeTruthy();
    expect(screen.getByText('配置 Pull Request / Merge Request 触发规则和状态回写')).toBeTruthy();
  });

  it('renders stats cards', () => {
    render(<PRTriggerManagement />);
    expect(screen.getByText('触发规则')).toBeTruthy();
    expect(screen.getByText('活跃规则')).toBeTruthy();
    expect(screen.getByText('GitHub PR')).toBeTruthy();
    expect(screen.getByText('GitLab MR')).toBeTruthy();
  });

  it('renders the add rule button', () => {
    render(<PRTriggerManagement />);
    expect(screen.getByText('添加规则')).toBeTruthy();
  });

  it('renders the refresh button', () => {
    render(<PRTriggerManagement />);
    expect(screen.getByText('刷新')).toBeTruthy();
  });
});
