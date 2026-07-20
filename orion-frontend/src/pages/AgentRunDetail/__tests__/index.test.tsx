/**
 * Tests for AgentRunDetail page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AgentRunDetail from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('AgentRunDetail', () => {
  it('renders without crashing', () => {
    renderWithRouter(<AgentRunDetail />);
    expect(document.body).toBeTruthy();
  });
});
