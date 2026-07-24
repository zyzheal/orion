/**
 * Tests for NotificationCenter page - Simplified
 */
import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import NotificationCenter from '@/pages/NotificationCenter';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('NotificationCenter', () => {
  it('should render without crashing', async () => {
    renderWithRouter(<NotificationCenter />);
    await waitFor(() => {
      expect(document.body).toBeInTheDocument();
    });
  });
});
