/**
 * Tests for TestSelector page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TestSelector from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('TestSelector', () => {
  it('renders without crashing', () => {
    renderWithRouter(<TestSelector />);
    expect(document.body).toBeTruthy();
  });
});
