/**
 * Tests for ChangeIntelligence page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChangeIntelligence from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ChangeIntelligence', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ChangeIntelligence />);
    expect(document.body).toBeTruthy();
  });
});
