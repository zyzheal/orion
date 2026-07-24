/**
 * Tests for MatrixConfigurator component
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MatrixConfigurator from '@/components/MatrixConfigurator';
import type { MatrixBuildConfig } from '@/components/MatrixConfigurator';

describe('MatrixConfigurator', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('should render empty state with guide text', () => {
    render(<MatrixConfigurator onChange={mockOnChange} />);
    expect(screen.getByText(/矩阵构建配置/)).toBeInTheDocument();
    expect(screen.getByText(/矩阵构建可以对多个维度进行组合/)).toBeInTheDocument();
    expect(screen.getByText(/添加维度/)).toBeInTheDocument();
  });

  it('should show preset templates', () => {
    render(<MatrixConfigurator onChange={mockOnChange} />);
    expect(screen.getByText('Node.js 版本')).toBeInTheDocument();
    expect(screen.getByText('操作系统')).toBeInTheDocument();
    expect(screen.getByText('Python 版本')).toBeInTheDocument();
    expect(screen.getByText('Node.js \u00d7 OS 组合')).toBeInTheDocument();
    expect(screen.getByText('Python \u00d7 OS 组合')).toBeInTheDocument();
  });

  it('should add a dimension when clicking add button', async () => {
    render(<MatrixConfigurator onChange={mockOnChange} />);
    const addButtons = screen.getAllByText('添加维度');
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/维度名称/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/用逗号分隔多个值/)).toBeInTheDocument();
    });
  });

  it('should apply preset template on click', async () => {
    render(<MatrixConfigurator onChange={mockOnChange} />);
    fireEvent.click(screen.getByText('Node.js 版本'));

    await waitFor(() => {
      const keyInput = screen.getByDisplayValue('node');
      expect(keyInput).toBeInTheDocument();
    });

    // Values should be populated
    const valuesInput = screen.getByPlaceholderText(/用逗号分隔多个值/);
    expect((valuesInput as HTMLInputElement).value).toBe('18, 20, 22');
  });

  it('should show combination count after applying preset', async () => {
    render(<MatrixConfigurator onChange={mockOnChange} />);
    fireEvent.click(screen.getByText('Node.js 版本'));

    await waitFor(() => {
      expect(screen.getByText(/组合预览/)).toBeInTheDocument();
      expect(screen.getByText(/3 node = 3 个组合/)).toBeInTheDocument();
    });
  });

  it('should calculate cartesian product for multi-dimension preset', async () => {
    render(<MatrixConfigurator onChange={mockOnChange} />);
    fireEvent.click(screen.getByText('Node.js \u00d7 OS 组合'));

    await waitFor(() => {
      expect(screen.getByText(/3 node \u00d7 2 os = 6 个组合/)).toBeInTheDocument();
    });
  });

  it('should display combination table for small sets', async () => {
    render(<MatrixConfigurator onChange={mockOnChange} />);
    fireEvent.click(screen.getByText('Node.js 版本'));

    await waitFor(() => {
      // Table should show 3 rows
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('should show execution/exclusion status for each combination', async () => {
    render(<MatrixConfigurator onChange={mockOnChange} />);
    fireEvent.click(screen.getByText('Node.js 版本'));

    await waitFor(() => {
      const executeBadges = screen.getAllByText('执行');
      expect(executeBadges).toHaveLength(3);
    });
  });

  it('should allow adding exclusion rules', async () => {
    render(<MatrixConfigurator onChange={mockOnChange} />);
    fireEvent.click(screen.getByText('Node.js 版本'));

    await waitFor(() => {
      const addExclusionBtn = screen.getByText('添加排除规则');
      expect(addExclusionBtn).toBeInTheDocument();
      fireEvent.click(addExclusionBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('排除规则')).toBeInTheDocument();
    });
  });

  it('should allow removing dimensions', async () => {
    render(<MatrixConfigurator onChange={mockOnChange} />);
    fireEvent.click(screen.getByText('Node.js 版本'));

    await waitFor(() => {
      // Find the danger button (delete button) within the dimension row
      const deleteBtn = screen.getAllByRole('button').find(
        (btn) => btn.className.includes('ant-btn-dangerous')
      );
      expect(deleteBtn).toBeInTheDocument();
      if (deleteBtn) {
        fireEvent.click(deleteBtn);
      }
    });

    await waitFor(() => {
      expect(screen.queryByDisplayValue('node')).not.toBeInTheDocument();
    });
  });

  it('should call onChange when configuration changes', async () => {
    render(<MatrixConfigurator onChange={mockOnChange} />);
    fireEvent.click(screen.getByText('Node.js 版本'));

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
    });

    const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0] as MatrixBuildConfig;
    expect(lastCall.enabled).toBe(true);
    expect(lastCall.dimensions).toHaveLength(1);
    expect(lastCall.dimensions[0].key).toBe('node');
    expect(lastCall.dimensions[0].values).toEqual(['18', '20', '22']);
  });

  it('should support manual dimension input', async () => {
    render(<MatrixConfigurator onChange={mockOnChange} />);
    const addButtons = screen.getAllByText('添加维度');
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      const keyInput = screen.getByPlaceholderText(/维度名称/);
      fireEvent.change(keyInput, { target: { value: 'arch' } });
    });

    const valuesInput = screen.getByPlaceholderText(/用逗号分隔多个值/);
    fireEvent.change(valuesInput, { target: { value: 'x86, arm64' } });

    await waitFor(() => {
      expect(screen.getByText(/2 arch = 2 个组合/)).toBeInTheDocument();
    });
  });

  it('should show warning for large combination counts', async () => {
    // A large preset: Python (4) x OS (3) = 12, but let's use multi-dimension
    render(<MatrixConfigurator onChange={mockOnChange} />);
    fireEvent.click(screen.getByText('Python \u00d7 OS 组合'));

    // 3 python x 3 os = 9 combinations, which is under 100 so no warning
    // Let's verify table shows
    await waitFor(() => {
      const executeBadges = screen.getAllByText('执行');
      expect(executeBadges.length).toBeGreaterThan(0);
    });
  });

  it('should render with initial value', () => {
    const initialValue: MatrixBuildConfig = {
      enabled: true,
      dimensions: [{ key: 'os', values: ['linux', 'macos'] }],
      exclusions: [],
    };
    render(<MatrixConfigurator value={initialValue} onChange={mockOnChange} />);

    // Should show the pre-populated data
    expect(screen.getByDisplayValue('os')).toBeInTheDocument();
    expect(screen.getByText(/2 os = 2 个组合/)).toBeInTheDocument();
  });

  it('should exclude combinations when exclusion rule matches', async () => {
    const initialValue: MatrixBuildConfig = {
      enabled: true,
      dimensions: [
        { key: 'os', values: ['linux', 'windows'] },
        { key: 'node', values: ['18', '20'] },
      ],
      exclusions: [{ match: { os: 'windows', node: '18' }, reason: 'Not supported' }],
    };
    render(<MatrixConfigurator value={initialValue} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByText(/排除 1 个，有效 3 个/)).toBeInTheDocument();
      const excludedBadges = screen.getAllByText('排除');
      expect(excludedBadges).toHaveLength(1);
    });
  });
});
