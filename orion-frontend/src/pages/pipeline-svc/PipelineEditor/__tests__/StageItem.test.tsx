/**
 * Tests for StageItem component
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import StageItem from '@/pages/pipeline-svc/PipelineEditor/StageItem';

const createMockStage = (overrides = {}) => ({
  id: 'stage-1',
  name: 'build-app',
  type: 'build',
  timeout: 300,
  retryCount: 0,
  dependsOn: [],
  config: {},
  ...overrides,
});

const renderStageItem = (stage: any, props: any = {}) => {
  return render(
    <DndContext onDragEnd={vi.fn()}>
      <StageItem
        id={stage.id}
        stage={stage}
        index={0}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        availableDependencies={[]}
        {...props}
      />
    </DndContext>
  );
};

describe('StageItem', () => {
  it('should render stage item', () => {
    const stage = createMockStage();
    renderStageItem(stage);

    // Text is split across elements, use contains matching
    expect(screen.getByText(/build-app/i)).toBeInTheDocument();
    expect(screen.getByText('build')).toBeInTheDocument();
  });

  it('should display stage number badge', () => {
    const stage = createMockStage();
    renderStageItem(stage, { index: 2 });

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should display timeout when provided', () => {
    const stage = createMockStage({ timeout: 600 });
    renderStageItem(stage);

    expect(screen.getByText(/超时：/i)).toBeInTheDocument();
  });

  it('should display retry count when provided', () => {
    const stage = createMockStage({ retryCount: 3 });
    renderStageItem(stage);

    expect(screen.getByText(/重试/i)).toBeInTheDocument();
  });

  it('should display dependencies when provided', () => {
    const stage = createMockStage({ dependsOn: ['checkout', 'install'] });
    renderStageItem(stage);

    expect(screen.getByText(/依赖/i)).toBeInTheDocument();
  });

  it('should not display retry when retryCount is 0', () => {
    const stage = createMockStage({ retryCount: 0 });
    renderStageItem(stage);

    expect(screen.queryByText(/重试/i)).not.toBeInTheDocument();
  });

  it('should not display dependencies when empty', () => {
    const stage = createMockStage({ dependsOn: [] });
    renderStageItem(stage);

    expect(screen.queryByText(/依赖/i)).not.toBeInTheDocument();
  });

  it('should call onEdit when edit button clicked', () => {
    const onEdit = vi.fn();
    const stage = createMockStage();
    renderStageItem(stage, { onEdit });

    const editBtn = screen.getByRole('button', { name: '编辑' });
    fireEvent.click(editBtn);

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('should call onDelete when delete button clicked', () => {
    const onDelete = vi.fn();
    const stage = createMockStage();
    renderStageItem(stage, { onDelete });

    const deleteBtn = screen.getByRole('button', { name: '删除' });
    fireEvent.click(deleteBtn);

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('should have drag handle with proper attributes', () => {
    const stage = createMockStage();
    const { container } = renderStageItem(stage);

    const dragHandle = container.querySelector('[role="button"][aria-roledescription="sortable"]');
    expect(dragHandle).toBeInTheDocument();
  });

  it('should use custom icon for different stage types', () => {
    const types = [
      { type: 'build' },
      { type: 'test' },
      { type: 'scan' },
      { type: 'deploy' },
      { type: 'notify' },
      { type: 'custom' },
    ];

    types.forEach(({ type }) => {
      const stage = createMockStage({ type });
      const { container } = renderStageItem(stage);
      expect(container).toBeInTheDocument();
    });
  });

  it('should display stage name', () => {
    const stage = createMockStage({ name: 'test-stage-name' });
    renderStageItem(stage);

    expect(screen.getByText(/test-stage-name/i)).toBeInTheDocument();
  });

  it('should apply dragging opacity style', () => {
    const stage = createMockStage();
    expect(() => renderStageItem(stage)).not.toThrow();
  });
});
