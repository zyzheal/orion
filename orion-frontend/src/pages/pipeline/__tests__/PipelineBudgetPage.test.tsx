import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PipelineBudgetPage from '../PipelineBudgetPage';

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return { ...actual, message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } };
});

function renderPage() {
  return render(<BrowserRouter><PipelineBudgetPage /></BrowserRouter>);
}

describe('PipelineBudgetPage', () => {
  it('renders without error', async () => {
    renderPage();
    await waitFor(() => expect(document.body).toBeTruthy());
  });
});
