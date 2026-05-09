/**
 * DAG Graph Component Tests
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DAGGraph, { validateDAG, calculateExecutionOrder } from './DAGGraph';

// Mock ReactFlow
vi.mock('reactflow', () => ({
  default: ({ nodes, edges }: any) => (
    <div data-testid="react-flow">
      <div data-testid="nodes">{nodes.length} nodes</div>
      <div data-testid="edges">{edges.length} edges</div>
    </div>
  ),
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  MarkerType: { ArrowClosed: 'arrowClosed' },
  NodeTypes: {},
  Position: { Top: 'top', Bottom: 'bottom' },
  Handle: () => <div data-testid="handle" />,
}));

describe('DAGGraph', () => {
  const mockStages = [
    { id: 'stage-1', name: 'Build', type: 'build', status: 'success', duration: 120 },
    { id: 'stage-2', name: 'Test', type: 'test', status: 'running', dependsOn: ['Build'], duration: 60 },
    { id: 'stage-3', name: 'Deploy', type: 'deploy', status: 'pending', dependsOn: ['Test'] },
  ];

  it('renders DAG graph with nodes and edges', () => {
    render(<DAGGraph stages={mockStages} />);
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    expect(screen.getByTestId('nodes')).toHaveTextContent('3 nodes');
    expect(screen.getByTestId('edges')).toHaveTextContent('2 edges');
  });

  it('calculates correct number of nodes based on stages', () => {
    const manyStages = [
      ...mockStages,
      { id: 'stage-4', name: 'Notify', type: 'notify', dependsOn: ['Deploy'] },
    ];
    render(<DAGGraph stages={manyStages} />);
    expect(screen.getByTestId('nodes')).toHaveTextContent('4 nodes');
  });

  it('handles empty stages', () => {
    render(<DAGGraph stages={[]} />);
    expect(screen.getByTestId('nodes')).toHaveTextContent('0 nodes');
    expect(screen.getByTestId('edges')).toHaveTextContent('0 edges');
  });
});

describe('validateDAG', () => {
  it('returns valid for simple linear DAG', () => {
    const stages = [
      { name: 'A', type: 'build' },
      { name: 'B', type: 'test', dependsOn: ['A'] },
      { name: 'C', type: 'deploy', dependsOn: ['B'] },
    ];
    const result = validateDAG(stages);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.cycles).toHaveLength(0);
  });

  it('returns valid for parallel DAG', () => {
    const stages = [
      { name: 'A', type: 'build' },
      { name: 'B', type: 'test', dependsOn: ['A'] },
      { name: 'C', type: 'scan', dependsOn: ['A'] },
      { name: 'D', type: 'deploy', dependsOn: ['B', 'C'] },
    ];
    const result = validateDAG(stages);
    expect(result.valid).toBe(true);
  });

  it('detects cycle in DAG', () => {
    const stages = [
      { name: 'A', type: 'build', dependsOn: ['C'] },
      { name: 'B', type: 'test', dependsOn: ['A'] },
      { name: 'C', type: 'deploy', dependsOn: ['B'] },
    ];
    const result = validateDAG(stages);
    expect(result.valid).toBe(false);
    expect(result.cycles.length).toBeGreaterThan(0);
  });

  it('detects missing dependency', () => {
    const stages = [
      { name: 'A', type: 'build' },
      { name: 'B', type: 'test', dependsOn: ['NonExistent'] },
    ];
    const result = validateDAG(stages);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Stage "B" depends on non-existent stage "NonExistent"'
    );
  });

  it('allows self-loop check', () => {
    const stages = [
      { name: 'A', type: 'build', dependsOn: ['A'] },
    ];
    const result = validateDAG(stages);
    expect(result.valid).toBe(false);
  });
});

describe('calculateExecutionOrder', () => {
  it('calculates correct order for linear DAG', () => {
    const stages = [
      { name: 'A', type: 'build' },
      { name: 'B', type: 'test', dependsOn: ['A'] },
      { name: 'C', type: 'deploy', dependsOn: ['B'] },
    ];
    const order = calculateExecutionOrder(stages);
    expect(order).toEqual([['A'], ['B'], ['C']]);
  });

  it('calculates correct order for parallel execution', () => {
    const stages = [
      { name: 'A', type: 'build' },
      { name: 'B', type: 'test', dependsOn: ['A'] },
      { name: 'C', type: 'scan', dependsOn: ['A'] },
      { name: 'D', type: 'deploy', dependsOn: ['B', 'C'] },
    ];
    const order = calculateExecutionOrder(stages);
    expect(order[0]).toContain('A');
    expect(order[1]).toEqual(expect.arrayContaining(['B', 'C']));
    expect(order[2]).toContain('D');
  });

  it('handles diamond dependency pattern', () => {
    const stages = [
      { name: 'A', type: 'build' },
      { name: 'B', type: 'test', dependsOn: ['A'] },
      { name: 'C', type: 'scan', dependsOn: ['A'] },
      { name: 'D', type: 'package', dependsOn: ['B'] },
      { name: 'E', type: 'verify', dependsOn: ['C'] },
      { name: 'F', type: 'deploy', dependsOn: ['D', 'E'] },
    ];
    const order = calculateExecutionOrder(stages);
    expect(order.length).toBe(4);
    expect(order[3]).toContain('F');
  });

  it('handles no dependencies', () => {
    const stages = [
      { name: 'A', type: 'build' },
      { name: 'B', type: 'test' },
      { name: 'C', type: 'deploy' },
    ];
    const order = calculateExecutionOrder(stages);
    expect(order[0]).toEqual(expect.arrayContaining(['A', 'B', 'C']));
  });
});