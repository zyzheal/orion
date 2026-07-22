/**
 * Tests for function page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReportDesignerPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ReportDesigner', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ReportDesignerPage />);
    expect(document.body).toBeTruthy();
  });
});
