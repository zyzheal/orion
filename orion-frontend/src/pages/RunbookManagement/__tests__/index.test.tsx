/**
 * Tests for function page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import function from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('function', () => {
  it('renders without crashing', () => {
    renderWithRouter(<function />);
    expect(document.body).toBeTruthy();
  });
});
