/**
 * PRTriggerConfig Component Tests
 */
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PRTriggerConfig from '../index';

describe('PRTriggerConfig', () => {
  it('renders with default disabled state', () => {
    render(<PRTriggerConfig />);
    expect(screen.getByText('PR/MR 触发配置')).toBeTruthy();
    expect(screen.getByText('启用 PR/MR 触发')).toBeTruthy();
  });

  it('shows configuration when enabled', () => {
    render(<PRTriggerConfig />);
    const switchElement = screen.getByRole('switch');
    fireEvent.click(switchElement);

    expect(screen.getByText('代码托管平台')).toBeTruthy();
    expect(screen.getByText('安全级别')).toBeTruthy();
    expect(screen.getByText('触发事件')).toBeTruthy();
    expect(screen.getByText('分支过滤')).toBeTruthy();
    expect(screen.getByText('路径过滤')).toBeTruthy();
    expect(screen.getByText('标签过滤')).toBeTruthy();
    expect(screen.getByText('状态回写')).toBeTruthy();
  });

  it('calls onChange when config changes', () => {
    const handleChange = jest.fn();
    render(<PRTriggerConfig onChange={handleChange} />);

    const switchElement = screen.getByRole('switch');
    fireEvent.click(switchElement);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        provider: 'github',
        prActions: ['opened', 'synchronize'],
      })
    );
  });
});
