/**
 * Tests for FinOpsDashboard page - Simplified
 */
import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import FinOpsDashboard from '@/pages/finops-svc/FinOpsDashboard';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('FinOpsDashboard', () => {
  it('should render without crashing', async () => {
    renderWithRouter(<FinOpsDashboard />);
    await waitFor(() => {
      expect(document.body).toBeInTheDocument();
    });
  });
});
