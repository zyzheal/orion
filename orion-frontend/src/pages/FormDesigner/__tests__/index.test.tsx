import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Page from '../index';
import { renderWithProviders } from '@/tests/render';

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  // Modal 是 function 类型组件，静态方法（confirm/info 等）挂在函数对象上。
  // 保留真实 Modal 组件（JSX 渲染 <Modal> 需要），仅替换静态方法为 mock。
  const Modal = actual.Modal as unknown as typeof actual.Modal & Record<string, unknown>;
  if (typeof Modal === 'function') {
    const staticKeys = ['confirm', 'info', 'success', 'error', 'warning', 'warn', 'destroyAll', 'useModal'];
    for (const k of staticKeys) {
      (Modal as Record<string, unknown>)[k] = k === 'useModal' ? vi.fn().mockReturnValue([null, { destroy: vi.fn() }]) : vi.fn();
    }
  }
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
    Modal,
  };
});

function renderPage() {
  return renderWithProviders(
    <BrowserRouter>
      <Page />
    </BrowserRouter>
  );
}

describe('FormDesigner', () => {
  it('renders without error', () => {
    const { container } = renderPage();
    expect(container.firstChild).toBeTruthy();
  });
});
