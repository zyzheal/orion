/**
 * Tests for AIReviewLayout page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AIReviewLayout from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('AIReviewLayout', () => {
  it('renders without crashing', () => {
    renderWithRouter(<AIReviewLayout />);
    expect(document.body).toBeTruthy();
  });
});
