/**
 * Tests for TrafficGovernance page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TrafficGovernance from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('TrafficGovernance', () => {
  it('renders without crashing', () => {
    renderWithRouter(<TrafficGovernance />);
    expect(document.body).toBeTruthy();
  });
});
