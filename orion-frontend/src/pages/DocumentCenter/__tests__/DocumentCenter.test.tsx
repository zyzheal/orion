/**
 * Tests for DocumentCenter page
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DocumentCenter from '@/pages/DocumentCenter';

// Mock knowledge API
vi.mock('@/api/knowledge', () => ({
  getDocs: vi.fn().mockResolvedValue([]),
  createDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDocToc: vi.fn().mockResolvedValue([]),
}));

// Mock message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd') as any;
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
  };
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('DocumentCenter', () => {
  it('renders without crashing', async () => {
    renderWithRouter(<DocumentCenter />);
    await waitFor(() => {
      expect(screen.getByText('文档中心')).toBeInTheDocument();
    });
  });
});
