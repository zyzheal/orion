/**
 * Tests for RunnerManagement page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RunnerManagement from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('RunnerManagement', () => {
  it('renders without crashing', () => {
    renderWithRouter(<RunnerManagement />);
    expect(document.body).toBeTruthy();
  });
});
