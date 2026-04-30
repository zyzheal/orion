/**
 * TicketList Page Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TicketList from '../index';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    },
  };
});

describe('TicketList', () => {
  it('should render without crashing', async () => {
    render(
      <MemoryRouter>
        <TicketList />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(document.body).toBeInTheDocument();
    });
  });
});
