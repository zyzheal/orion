/**
 * Tests for TestReportPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TestReportPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('TestReportPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<TestReportPage />);
    expect(document.body).toBeTruthy();
  });
});
