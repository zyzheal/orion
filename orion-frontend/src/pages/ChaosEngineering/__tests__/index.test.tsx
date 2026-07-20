/**
 * Tests for ChaosEngineering page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChaosEngineering from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ChaosEngineering', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ChaosEngineering />);
    expect(document.body).toBeTruthy();
  });
});
