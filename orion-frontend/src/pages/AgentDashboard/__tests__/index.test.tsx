/**
 * Tests for AgentDashboard page
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AgentDashboard from '../index';
import * as agentsApi from '@/api/agents';

// Mock the agents API
vi.mock('@/api/agents', () => ({
  getAgentProfiles: vi.fn(),
  getAgentRuns: vi.fn(),
  getAgentApprovals: vi.fn(),
  deleteAgentProfile: vi.fn(),
  toggleAgentProfile: vi.fn(),
  respondToApproval: vi.fn(),
  triggerAgentRun: vi.fn(),
  createAgentProfile: vi.fn(),
}));

// Mock sub-components to simplify testing
vi.mock('../AgentMetrics', () => ({
  default: ({ activeAgentCount, todayRunCount, successRate, avgDuration }: any) => (
    <div data-testid="agent-metrics">
      <span>Active: {activeAgentCount}</span>
      <span>Today Runs: {todayRunCount}</span>
      <span>Success Rate: {successRate}%</span>
      <span>Avg Duration: {avgDuration}s</span>
    </div>
  ),
}));

vi.mock('../AgentTable', () => ({
  default: ({ agents, filteredAgents, loading, searchQuery, onSearch }: any) => (
    <div data-testid="agent-table" data-loading={loading}>
      <input
        data-testid="agent-search"
        value={searchQuery || ''}
        onChange={(e) => onSearch(e.target.value)}
      />
      {filteredAgents?.map((agent: any) => (
        <div key={agent.id} data-testid={`agent-row-${agent.id}`}>
          {agent.name}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../AgentRunList', () => ({
  default: ({ runs, approvals }: any) => (
    <div data-testid="agent-run-list">
      <span>Runs: {runs?.length || 0}</span>
      <span>Approvals: {approvals?.length || 0}</span>
    </div>
  ),
}));

vi.mock('../AgentDetailDrawer', () => ({
  default: () => <div data-testid="agent-detail-drawer" />,
}));

vi.mock('../CreateAgentModal', () => ({
  default: ({ open, onCancel }: any) =>
    open ? <div data-testid="create-agent-modal"><button onClick={onCancel}>Close</button></div> : null,
}));

vi.mock('../TriggerRunModal', () => ({
  default: ({ open, onCancel }: any) =>
    open ? <div data-testid="trigger-run-modal"><button onClick={onCancel}>Close</button></div> : null,
}));

const mockAgents = [
  {
    id: 'agent-1',
    name: 'Code Reviewer',
    role: 'reviewer',
    description: 'Automated code review agent',
    tools: [{ toolName: 'git', permission: 'read' }],
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'agent-2',
    name: 'Deploy Agent',
    role: 'deployer',
    description: 'Automated deployment agent',
    tools: [{ toolName: 'kubectl', permission: 'write' }],
    enabled: false,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  },
];

const mockRuns = [
  {
    id: 'run-1',
    triggerEvent: 'pipeline.completed',
    triggerPayload: {},
    status: 'completed' as const,
    currentStep: 3,
    totalSteps: 3,
    startedAt: '2026-05-07T08:00:00Z',
    completedAt: '2026-05-07T08:05:00Z',
    timeoutAt: '2026-05-07T09:00:00Z',
  },
  {
    id: 'run-2',
    triggerEvent: 'manual',
    triggerPayload: {},
    status: 'running' as const,
    currentStep: 1,
    totalSteps: 5,
    startedAt: '2026-05-07T10:00:00Z',
    timeoutAt: '2026-05-07T11:00:00Z',
  },
];

const mockApprovals = [
  {
    id: 'approval-1',
    runId: 'run-2',
    agentId: 'agent-1',
    action: 'deploy',
    actionInput: {},
    status: 'pending' as const,
    createdAt: '2026-05-07T10:05:00Z',
  },
];

describe('AgentDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the AgentDashboard page', async () => {
    vi.mocked(agentsApi.getAgentProfiles).mockResolvedValue({ data: { data: mockAgents } } as any);
    vi.mocked(agentsApi.getAgentRuns).mockResolvedValue({ data: { data: mockRuns } } as any);
    vi.mocked(agentsApi.getAgentApprovals).mockResolvedValue(mockApprovals as any);

    render(<AgentDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('agent-dashboard-page')).toBeTruthy();
    });

    expect(screen.getByText('AI Agent 编排')).toBeTruthy();
  });

  it('displays summary metrics', async () => {
    vi.mocked(agentsApi.getAgentProfiles).mockResolvedValue({ data: { data: mockAgents } } as any);
    vi.mocked(agentsApi.getAgentRuns).mockResolvedValue({ data: { data: mockRuns } } as any);
    vi.mocked(agentsApi.getAgentApprovals).mockResolvedValue([] as any);

    render(<AgentDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('agent-metrics')).toBeTruthy();
    });

    // 1 enabled agent
    expect(screen.getByText('Active: 1')).toBeTruthy();
    // 2 runs total
    expect(screen.getByText('Today Runs: 2')).toBeTruthy();
  });

  it('displays agent list', async () => {
    vi.mocked(agentsApi.getAgentProfiles).mockResolvedValue({ data: { data: mockAgents } } as any);
    vi.mocked(agentsApi.getAgentRuns).mockResolvedValue({ data: { data: [] } } as any);
    vi.mocked(agentsApi.getAgentApprovals).mockResolvedValue([] as any);

    render(<AgentDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('agent-table')).toBeTruthy();
    });

    expect(screen.getByText('Code Reviewer')).toBeTruthy();
    expect(screen.getByText('Deploy Agent')).toBeTruthy();
  });

  it('shows run and approval counts', async () => {
    vi.mocked(agentsApi.getAgentProfiles).mockResolvedValue({ data: { data: mockAgents } } as any);
    vi.mocked(agentsApi.getAgentRuns).mockResolvedValue({ data: { data: mockRuns } } as any);
    vi.mocked(agentsApi.getAgentApprovals).mockResolvedValue(mockApprovals as any);

    render(<AgentDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('agent-run-list')).toBeTruthy();
    });

    expect(screen.getByText('Runs: 2')).toBeTruthy();
    expect(screen.getByText('Approvals: 1')).toBeTruthy();
  });

  it('opens create agent modal when button is clicked', async () => {
    vi.mocked(agentsApi.getAgentProfiles).mockResolvedValue({ data: { data: [] } } as any);
    vi.mocked(agentsApi.getAgentRuns).mockResolvedValue({ data: { data: [] } } as any);
    vi.mocked(agentsApi.getAgentApprovals).mockResolvedValue([] as any);

    render(<AgentDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('create-agent-button')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('create-agent-button'));

    await waitFor(() => {
      expect(screen.getByTestId('create-agent-modal')).toBeTruthy();
    });
  });

  it('opens trigger run modal when button is clicked', async () => {
    vi.mocked(agentsApi.getAgentProfiles).mockResolvedValue({ data: { data: [] } } as any);
    vi.mocked(agentsApi.getAgentRuns).mockResolvedValue({ data: { data: [] } } as any);
    vi.mocked(agentsApi.getAgentApprovals).mockResolvedValue([] as any);

    render(<AgentDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('trigger-run-button')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('trigger-run-button'));

    await waitFor(() => {
      expect(screen.getByTestId('trigger-run-modal')).toBeTruthy();
    });
  });

  it('shows approval count in header', async () => {
    vi.mocked(agentsApi.getAgentProfiles).mockResolvedValue({ data: { data: mockAgents } } as any);
    vi.mocked(agentsApi.getAgentRuns).mockResolvedValue({ data: { data: mockRuns } } as any);
    vi.mocked(agentsApi.getAgentApprovals).mockResolvedValue(mockApprovals as any);

    render(<AgentDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/1 个待审批/)).toBeTruthy();
    });
  });

  it('displays error message when API fails', async () => {
    vi.mocked(agentsApi.getAgentProfiles).mockRejectedValue(new Error('Network error'));
    vi.mocked(agentsApi.getAgentRuns).mockRejectedValue(new Error('Network error'));
    vi.mocked(agentsApi.getAgentApprovals).mockRejectedValue(new Error('Network error'));

    render(<AgentDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/加载数据失败/)).toBeTruthy();
    });
  });

  it('refreshes data when refresh button is clicked', async () => {
    vi.mocked(agentsApi.getAgentProfiles).mockResolvedValue({ data: { data: [] } } as any);
    vi.mocked(agentsApi.getAgentRuns).mockResolvedValue({ data: { data: [] } } as any);
    vi.mocked(agentsApi.getAgentApprovals).mockResolvedValue([] as any);

    render(<AgentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('刷新')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('刷新'));

    await waitFor(() => {
      expect(agentsApi.getAgentProfiles).toHaveBeenCalledTimes(2);
    });
  });
});
