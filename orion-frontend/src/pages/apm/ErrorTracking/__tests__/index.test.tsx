/**
 * Tests for ApmErrorTrackingPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ApmErrorTrackingPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ApmErrorTrackingPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ApmErrorTrackingPage />);
    expect(document.body).toBeTruthy();
  });
});
