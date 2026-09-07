import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/providers/QueryProvider';
import RootCausePage from '../RootCausePage';

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return { ...actual, message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } };
});

function renderPage() {
  return render(
    <QueryClientProvider client={getQueryClient()}>
      <BrowserRouter>
        <RootCausePage />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('RootCausePage', () => {
  it('renders without error', async () => {
    renderPage();
    await waitFor(() => expect(document.body).toBeTruthy());
  });
});
