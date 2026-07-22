/**
 * Tests for PipelineList page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PipelineList from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('PipelineList', () => {
  it('renders without crashing', () => {
    renderWithRouter(<PipelineList />);
    expect(document.body).toBeTruthy();
  });
});
