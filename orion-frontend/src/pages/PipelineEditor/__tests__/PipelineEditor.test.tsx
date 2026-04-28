/**
 * Tests for PipelineEditor component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PipelineEditor from '@/pages/PipelineEditor';

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('PipelineEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render editor in create mode', () => {
    renderWithRouter(<PipelineEditor />);
    expect(screen.getByText(/创建 Pipeline/i)).toBeInTheDocument();
    expect(screen.getByText(/可视化编排/i)).toBeInTheDocument();
  });

  it('should render back button', () => {
    renderWithRouter(<PipelineEditor />);
    expect(screen.getByText('返回列表')).toBeInTheDocument();
  });

  it('should render basic info form', () => {
    renderWithRouter(<PipelineEditor />);
    expect(screen.getByPlaceholderText(/例如：build-deploy-pipeline/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/例如：1.0.0/i)).toBeInTheDocument();
  });

  it('should show empty state when no stages', () => {
    renderWithRouter(<PipelineEditor />);
    expect(screen.getByText('暂无阶段')).toBeInTheDocument();
    expect(screen.getByText(/点击上方「添加阶段」按钮开始编排流水线/i)).toBeInTheDocument();
  });

  it('should show stage type help section', () => {
    renderWithRouter(<PipelineEditor />);
    expect(screen.getByText('阶段类型说明')).toBeInTheDocument();
  });

  it('should show drag hint', () => {
    renderWithRouter(<PipelineEditor />);
    expect(screen.getByText(/拖拽阶段卡片右侧的拖拽图标可调整顺序/i)).toBeInTheDocument();
  });

  it('should show buttons for save and preview', () => {
    renderWithRouter(<PipelineEditor />);
    expect(screen.getByText('保存')).toBeInTheDocument();
    expect(screen.getByText('预览 YAML')).toBeInTheDocument();
    expect(screen.getByText('重置')).toBeInTheDocument();
  });

  it('should show modal has proper form fields', async () => {
    renderWithRouter(<PipelineEditor />);
    const addBtns = screen.getAllByText('添加阶段');
    fireEvent.click(addBtns[0]);

    await waitFor(() => {
      expect(screen.getByLabelText(/阶段名称/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/阶段类型/i)).toBeInTheDocument();
    });
  });
});
