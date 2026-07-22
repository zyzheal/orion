/**
 * Tests for function page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProcessStepPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ProcessStep', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ProcessStepPage />);
    expect(document.body).toBeTruthy();
  });
});
