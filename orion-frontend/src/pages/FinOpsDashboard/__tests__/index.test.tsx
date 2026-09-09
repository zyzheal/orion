import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Page from '../index';

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
    Modal: Object.assign(actual.Modal, { confirm: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() }),
  };
});

function renderPage() {
  return render(
    <BrowserRouter>
      <Page />
    </BrowserRouter>
  );
}

describe('FinOpsDashboard', () => {
  it('renders without error', () => {
    const { container } = renderPage();
    expect(container.firstChild).toBeTruthy();
  });
});
